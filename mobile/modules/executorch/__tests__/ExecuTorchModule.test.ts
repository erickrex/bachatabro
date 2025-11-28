/**
 * ExecuTorch Module Tests
 */

import { NativeModules, Platform } from 'react-native';
import execuTorchModule from '../src';

// Mock the native module
jest.mock('react-native', () => ({
  NativeModules: {
    ExecuTorchModule: {
      loadModel: jest.fn(),
      setDelegate: jest.fn(),
      runInference: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      resetMetrics: jest.fn(),
      unloadModel: jest.fn(),
    },
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
}));

describe('ExecuTorchModule', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset module state
    try {
      await execuTorchModule.unloadModel();
    } catch (e) {
      // Ignore errors if model not loaded
    }
  });

  describe('loadModel', () => {
    it('should load model successfully', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      mockLoadModel.mockResolvedValue(true);

      await execuTorchModule.loadModel('movenet.pte');

      expect(mockLoadModel).toHaveBeenCalledWith('movenet.pte');
      expect(await execuTorchModule.isModelLoaded()).toBe(true);
    });

    it('should throw error on load failure', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      mockLoadModel.mockRejectedValue(new Error('Model not found'));

      await expect(execuTorchModule.loadModel('invalid.pte')).rejects.toThrow();
      expect(await execuTorchModule.isModelLoaded()).toBe(false);
    });
  });

  describe('setDelegate', () => {
    it('should set delegate after model is loaded', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      const mockSetDelegate = NativeModules.ExecuTorchModule.setDelegate as jest.Mock;
      
      mockLoadModel.mockResolvedValue(true);
      mockSetDelegate.mockResolvedValue(true);

      await execuTorchModule.loadModel('movenet.pte');
      await execuTorchModule.setDelegate('coreml');

      expect(mockSetDelegate).toHaveBeenCalledWith('coreml');
    });

    it('should throw error if model not loaded', async () => {
      await expect(execuTorchModule.setDelegate('coreml')).rejects.toThrow(
        'Model must be loaded'
      );
    });

    it('should warn and switch delegate on iOS when using xnnpack', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      const mockSetDelegate = NativeModules.ExecuTorchModule.setDelegate as jest.Mock;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockLoadModel.mockResolvedValue(true);
      mockSetDelegate.mockResolvedValue(true);

      await execuTorchModule.loadModel('movenet.pte');
      await execuTorchModule.setDelegate('xnnpack');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('XNNPACK not available on iOS')
      );
      expect(mockSetDelegate).toHaveBeenCalledWith('coreml');

      consoleSpy.mockRestore();
    });
  });

  describe('runInference', () => {
    const mockImageData = {
      width: 192,
      height: 192,
      data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    };

    const mockResult = {
      keypoints: Array(17).fill({ x: 0.5, y: 0.5, confidence: 0.9 }),
      inferenceTime: 45.2,
    };

    it('should run inference successfully', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      const mockRunInference = NativeModules.ExecuTorchModule.runInference as jest.Mock;

      mockLoadModel.mockResolvedValue(true);
      mockRunInference.mockResolvedValue(mockResult);

      await execuTorchModule.loadModel('movenet.pte');
      const result = await execuTorchModule.runInference(mockImageData);

      expect(mockRunInference).toHaveBeenCalledWith(mockImageData);
      expect(result.keypoints).toHaveLength(17);
      expect(result.inferenceTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error if model not loaded', async () => {
      await expect(execuTorchModule.runInference(mockImageData)).rejects.toThrow(
        'Model must be loaded'
      );
    });

    it('should handle inference errors', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      const mockRunInference = NativeModules.ExecuTorchModule.runInference as jest.Mock;

      mockLoadModel.mockResolvedValue(true);
      mockRunInference.mockRejectedValue(new Error('Inference failed'));

      await execuTorchModule.loadModel('movenet.pte');
      await expect(execuTorchModule.runInference(mockImageData)).rejects.toThrow();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const mockMetrics = {
        averageFPS: 25.5,
        averageLatency: 39.2,
        p50Latency: 38.0,
        p95Latency: 45.0,
        p99Latency: 50.0,
        totalInferences: 100,
      };

      const mockGetMetrics = NativeModules.ExecuTorchModule.getPerformanceMetrics as jest.Mock;
      mockGetMetrics.mockResolvedValue(mockMetrics);

      const metrics = await execuTorchModule.getPerformanceMetrics();

      expect(metrics.averageFPS).toBeGreaterThan(0);
      expect(metrics.totalInferences).toBe(100);
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics successfully', async () => {
      const mockResetMetrics = NativeModules.ExecuTorchModule.resetMetrics as jest.Mock;
      mockResetMetrics.mockResolvedValue(true);

      await execuTorchModule.resetMetrics();

      expect(mockResetMetrics).toHaveBeenCalled();
    });
  });

  describe('unloadModel', () => {
    it('should unload model successfully', async () => {
      const mockLoadModel = NativeModules.ExecuTorchModule.loadModel as jest.Mock;
      const mockUnloadModel = NativeModules.ExecuTorchModule.unloadModel as jest.Mock;

      mockLoadModel.mockResolvedValue(true);
      mockUnloadModel.mockResolvedValue(true);

      await execuTorchModule.loadModel('movenet.pte');
      expect(await execuTorchModule.isModelLoaded()).toBe(true);

      await execuTorchModule.unloadModel();
      expect(await execuTorchModule.isModelLoaded()).toBe(false);
    });
  });

  describe('platform-specific behavior', () => {
    it('should recommend coreml on iOS', () => {
      expect(execuTorchModule.getRecommendedDelegate()).toBe('coreml');
    });

    it('should recommend xnnpack on Android', () => {
      // Mock Platform.OS for this test
      const originalPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });
      
      expect(execuTorchModule.getRecommendedDelegate()).toBe('xnnpack');
      
      // Restore iOS
      Object.defineProperty(Platform, 'OS', {
        get: () => originalPlatform,
        configurable: true,
      });
    });
  });
});
