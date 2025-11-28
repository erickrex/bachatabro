/**
 * ExecuTorch Native Module
 * React Native bridge for PyTorch ExecuTorch pose detection
 */

import { NativeModules, Platform } from 'react-native';
import type {
  ExecuTorchModuleInterface,
  HardwareDelegate,
  ImageData,
  PoseResult,
  PerformanceMetrics,
} from './types';

const LINKING_ERROR =
  `The package 'executorch' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const ExecuTorchNative = NativeModules.ExecuTorchModule
  ? NativeModules.ExecuTorchModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

/**
 * ExecuTorch Module Wrapper
 * Provides TypeScript-friendly interface to native module
 */
class ExecuTorchModule implements ExecuTorchModuleInterface {
  private modelLoaded = false;
  private currentDelegate: HardwareDelegate = 'none';

  /**
   * Load ExecuTorch model from file path
   */
  async loadModel(modelPath: string): Promise<void> {
    try {
      await ExecuTorchNative.loadModel(modelPath);
      this.modelLoaded = true;
    } catch (error) {
      this.modelLoaded = false;
      throw new Error(`Failed to load model: ${error}`);
    }
  }

  /**
   * Set hardware acceleration delegate
   */
  async setDelegate(delegate: HardwareDelegate): Promise<void> {
    if (!this.modelLoaded) {
      throw new Error('Model must be loaded before setting delegate');
    }

    // Validate delegate for platform
    if (Platform.OS === 'ios' && delegate === 'xnnpack') {
      console.warn('XNNPACK not available on iOS, using CoreML instead');
      delegate = 'coreml';
    } else if (Platform.OS === 'android' && delegate === 'coreml') {
      console.warn('CoreML not available on Android, using XNNPACK instead');
      delegate = 'xnnpack';
    }

    try {
      await ExecuTorchNative.setDelegate(delegate);
      this.currentDelegate = delegate;
    } catch (error) {
      throw new Error(`Failed to set delegate: ${error}`);
    }
  }

  /**
   * Run pose detection inference
   */
  async runInference(imageData: ImageData): Promise<PoseResult> {
    if (!this.modelLoaded) {
      throw new Error('Model must be loaded before running inference');
    }

    try {
      const result = await ExecuTorchNative.runInference(imageData);
      return {
        ...result,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Inference failed: ${error}`);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      return await ExecuTorchNative.getPerformanceMetrics();
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error}`);
    }
  }

  /**
   * Reset performance metrics
   */
  async resetMetrics(): Promise<void> {
    try {
      await ExecuTorchNative.resetMetrics();
    } catch (error) {
      throw new Error(`Failed to reset metrics: ${error}`);
    }
  }

  /**
   * Check if model is loaded
   */
  async isModelLoaded(): Promise<boolean> {
    return this.modelLoaded;
  }

  /**
   * Unload model and free resources
   */
  async unloadModel(): Promise<void> {
    try {
      await ExecuTorchNative.unloadModel();
      this.modelLoaded = false;
      this.currentDelegate = 'none';
    } catch (error) {
      throw new Error(`Failed to unload model: ${error}`);
    }
  }

  /**
   * Get current delegate
   */
  getCurrentDelegate(): HardwareDelegate {
    return this.currentDelegate;
  }

  /**
   * Get recommended delegate for current platform
   */
  getRecommendedDelegate(): HardwareDelegate {
    return Platform.OS === 'ios' ? 'coreml' : 'xnnpack';
  }
}

// Export singleton instance
export const execuTorchModule = new ExecuTorchModule();

// Export types
export * from './types';

// Default export
export default execuTorchModule;
