/**
 * ExecuTorch Service
 * TypeScript wrapper for native ExecuTorch modules
 * 
 * Task 3.1.1: Create ExecuTorch Service Wrapper
 */

import { NativeModules, Platform } from 'react-native';
import { PoseResult } from '@/types/detection';

const { ExecuTorchModule } = NativeModules;

export class ExecuTorchService {
  private modelLoaded = false;
  private inferenceTimes: number[] = [];
  private readonly MAX_INFERENCE_TIMES = 100;

  /**
   * Initialize the ExecuTorch service and load the model
   */
  async initialize(modelPath: string): Promise<void> {
    if (!ExecuTorchModule) {
      throw new Error('ExecuTorchModule not available. Native module not linked.');
    }

    try {
      await ExecuTorchModule.loadModel(modelPath);
      await this.configureDelegate();
      this.modelLoaded = true;
      console.log('ExecuTorch model loaded successfully');
    } catch (error) {
      console.error('Failed to initialize ExecuTorch:', error);
      throw new Error(`ExecuTorch initialization failed: ${error}`);
    }
  }

  /**
   * Configure hardware acceleration delegate
   */
  private async configureDelegate(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // Use CoreML delegate on iOS
        await ExecuTorchModule.setDelegate('coreml');
      } else if (Platform.OS === 'android') {
        // Use XNNPACK delegate on Android
        await ExecuTorchModule.setDelegate('xnnpack');
      }
      console.log(`Hardware delegate configured for ${Platform.OS}`);
    } catch (error) {
      console.warn('Failed to configure hardware delegate, using CPU:', error);
    }
  }

  /**
   * Detect pose from image data
   */
  async detectPose(imageData: string): Promise<PoseResult> {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded. Call initialize() first.');
    }

    const startTime = performance.now();

    try {
      const result = await ExecuTorchModule.runInference({ imageData });
      const inferenceTime = performance.now() - startTime;

      // Track inference times for performance metrics
      this.inferenceTimes.push(inferenceTime);
      if (this.inferenceTimes.length > this.MAX_INFERENCE_TIMES) {
        this.inferenceTimes.shift();
      }

      return {
        keypoints: this.parseKeypoints(result),
        inferenceTime,
        confidence: this.calculateConfidence(result),
      };
    } catch (error) {
      console.error('Inference failed:', error);
      throw new Error(`Pose detection failed: ${error}`);
    }
  }

  /**
   * Parse keypoints from model output
   */
  private parseKeypoints(result: any): Array<{ x: number; y: number; confidence: number }> {
    if (!result || !result.keypoints) {
      return [];
    }

    // ExecuTorch model outputs 17 keypoints in COCO format
    return result.keypoints.map((kp: any) => ({
      x: kp.x || kp[0],
      y: kp.y || kp[1],
      confidence: kp.confidence || kp[2] || 0,
    }));
  }

  /**
   * Calculate overall confidence from keypoints
   */
  private calculateConfidence(result: any): number {
    if (!result || !result.keypoints || result.keypoints.length === 0) {
      return 0;
    }

    const confidences = result.keypoints.map((kp: any) => 
      kp.confidence || kp[2] || 0
    );
    
    return confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
  }

  /**
   * Get average FPS from recent inferences
   */
  getAverageFPS(): number {
    if (this.inferenceTimes.length === 0) {
      return 0;
    }

    const avgTime = this.inferenceTimes.reduce((a, b) => a + b, 0) / this.inferenceTimes.length;
    return 1000 / avgTime;
  }

  /**
   * Get average inference latency in milliseconds
   */
  getAverageLatency(): number {
    if (this.inferenceTimes.length === 0) {
      return 0;
    }

    return this.inferenceTimes.reduce((a, b) => a + b, 0) / this.inferenceTimes.length;
  }

  /**
   * Get latency percentiles
   */
  getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    if (this.inferenceTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.inferenceTimes].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index],
      p95: sorted[p95Index],
      p99: sorted[p99Index],
    };
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.inferenceTimes = [];
  }
}
