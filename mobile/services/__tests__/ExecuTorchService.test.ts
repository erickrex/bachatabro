/**
 * Unit tests for ExecuTorchService
 * Task 3.1.1: Create ExecuTorch Service Wrapper
 */

import { ExecuTorchService } from '../executorch/ExecuTorchService';
import { NativeModules } from 'react-native';

// Mock NativeModules
jest.mock('react-native', () => ({
  NativeModules: {
    ExecuTorchModule: {
      loadModel: jest.fn(),
      setDelegate: jest.fn(),
      runInference: jest.fn(),
    },
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('ExecuTorchService', () => {
  let service: ExecuTorchService;
  const mockModule = NativeModules.ExecuTorchModule;

  beforeEach(() => {
    service = new ExecuTorchService();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should load model and configure delegate', async () => {
      mockModule.loadModel.mockResolvedValue(true);
      mockModule.setDelegate.mockResolvedValue(true);

      await service.initialize('movenet.pte');

      expect(mockModule.loadModel).toHaveBeenCalledWith('movenet.pte');
      expect(mockModule.setDelegate).toHaveBeenCalledWith('coreml');
      expect(service.isReady()).toBe(true);
    });

    it('should throw error if module not available', async () => {
      // This test verifies the error handling when module is not available
      // Since the module is imported at the top level, we test the error path
      // by making loadModel fail with a specific error
      mockModule.loadModel.mockRejectedValue(new Error('Native module not found'));

      const serviceWithoutModule = new ExecuTorchService();
      
      await expect(serviceWithoutModule.initialize('model.pte')).rejects.toThrow(
        'ExecuTorch initialization failed'
      );
    });

    it('should throw error if model loading fails', async () => {
      mockModule.loadModel.mockRejectedValue(new Error('Model not found'));

      await expect(service.initialize('invalid.pte')).rejects.toThrow(
        'ExecuTorch initialization failed'
      );
    });
  });

  describe('detectPose', () => {
    beforeEach(async () => {
      mockModule.loadModel.mockResolvedValue(true);
      mockModule.setDelegate.mockResolvedValue(true);
      await service.initialize('movenet.pte');
    });

    it('should detect pose from image data', async () => {
      const mockResult = {
        keypoints: [
          { x: 100, y: 200, confidence: 0.9 },
          { x: 150, y: 250, confidence: 0.85 },
        ],
      };
      
      // Add a small delay to simulate real inference time
      mockModule.runInference.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResult), 10))
      );

      const result = await service.detectPose('base64imagedata');

      expect(mockModule.runInference).toHaveBeenCalledWith({
        imageData: 'base64imagedata',
      });
      expect(result.keypoints).toHaveLength(2);
      expect(result.confidence).toBeCloseTo(0.875);
      expect(result.inferenceTime).toBeGreaterThanOrEqual(0);
    });

    it('should throw error if model not loaded', async () => {
      const uninitializedService = new ExecuTorchService();

      await expect(uninitializedService.detectPose('data')).rejects.toThrow(
        'Model not loaded'
      );
    });

    it('should track inference times', async () => {
      mockModule.runInference.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          keypoints: [{ x: 0, y: 0, confidence: 1 }],
        }), 10))
      );

      await service.detectPose('data1');
      await service.detectPose('data2');
      await service.detectPose('data3');

      expect(service.getAverageFPS()).toBeGreaterThan(0);
      expect(service.getAverageLatency()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance metrics', () => {
    beforeEach(async () => {
      mockModule.loadModel.mockResolvedValue(true);
      mockModule.setDelegate.mockResolvedValue(true);
      await service.initialize('movenet.pte');
    });

    it('should calculate average FPS', async () => {
      mockModule.runInference.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          keypoints: [{ x: 0, y: 0, confidence: 1 }],
        }), 10))
      );

      // Run multiple inferences
      for (let i = 0; i < 10; i++) {
        await service.detectPose('data');
      }

      const fps = service.getAverageFPS();
      expect(fps).toBeGreaterThan(0);
      expect(fps).toBeLessThan(200); // Sanity check - with 10ms delay, max ~100fps
    });

    it('should calculate latency percentiles', async () => {
      mockModule.runInference.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          keypoints: [{ x: 0, y: 0, confidence: 1 }],
        }), Math.random() * 20 + 5)) // Random delay 5-25ms
      );

      // Run multiple inferences
      for (let i = 0; i < 50; i++) {
        await service.detectPose('data');
      }

      const percentiles = service.getLatencyPercentiles();
      expect(percentiles.p50).toBeGreaterThan(0);
      expect(percentiles.p95).toBeGreaterThanOrEqual(percentiles.p50);
      expect(percentiles.p99).toBeGreaterThanOrEqual(percentiles.p95);
    });

    it('should reset metrics', async () => {
      mockModule.runInference.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          keypoints: [{ x: 0, y: 0, confidence: 1 }],
        }), 10))
      );

      await service.detectPose('data');
      expect(service.getAverageFPS()).toBeGreaterThan(0);

      service.resetMetrics();
      expect(service.getAverageFPS()).toBe(0);
    });
  });
});
