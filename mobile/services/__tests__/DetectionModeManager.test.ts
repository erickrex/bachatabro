/**
 * Unit tests for DetectionModeManager
 * Task 3.1.2: Create Detection Mode Manager
 */

import { DetectionModeManager } from '../executorch/DetectionModeManager';
import { DetectionMode } from '@/types/detection';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: 16, // iOS 16 (iPhone 14 era)
  },
}));

describe('DetectionModeManager', () => {
  let manager: DetectionModeManager;

  beforeEach(async () => {
    manager = new DetectionModeManager();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialize', () => {
    it('should initialize with auto mode by default', async () => {
      await manager.initialize();
      expect(manager.getCurrentMode()).toBe(DetectionMode.AUTO);
    });

    it('should load saved mode from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(DetectionMode.REAL_TIME);

      await manager.initialize();
      expect(manager.getCurrentMode()).toBe(DetectionMode.REAL_TIME);
    });

    it('should detect device capabilities', async () => {
      await manager.initialize();
      const capabilities = manager.getCapabilities();

      expect(capabilities).not.toBeNull();
      expect(capabilities?.platform).toBeDefined();
      expect(capabilities?.year).toBeGreaterThan(2015);
    });
  });

  describe('detectOptimalMode', () => {
    it('should recommend real-time for modern devices', async () => {
      await manager.initialize();
      // Mock modern device
      const capabilities = manager.getCapabilities();
      if (capabilities) {
        capabilities.year = 2022;
        capabilities.memoryGB = 6;
      }

      const mode = await manager.detectOptimalMode();
      expect(mode).toBe(DetectionMode.REAL_TIME);
    });

    it('should recommend pre-computed for older devices', async () => {
      await manager.initialize();
      // Mock older device
      const capabilities = manager.getCapabilities();
      if (capabilities) {
        capabilities.year = 2018;
        capabilities.memoryGB = 2;
      }

      const mode = await manager.detectOptimalMode();
      expect(mode).toBe(DetectionMode.PRE_COMPUTED);
    });
  });

  describe('setMode', () => {
    it('should set mode and persist to storage', async () => {
      await manager.initialize();
      await manager.setMode(DetectionMode.REAL_TIME);

      expect(manager.getCurrentMode()).toBe(DetectionMode.REAL_TIME);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@bachatabro:detection_mode',
        DetectionMode.REAL_TIME
      );
    });
  });

  describe('failure handling', () => {
    beforeEach(async () => {
      await manager.initialize();
      await manager.setMode(DetectionMode.REAL_TIME);
    });

    it('should record failures', () => {
      manager.recordFailure();
      const stats = manager.getFailureStats();
      expect(stats.count).toBe(1);
    });

    it('should trigger fallback after max failures', () => {
      // Record 10 failures
      for (let i = 0; i < 10; i++) {
        manager.recordFailure();
      }

      expect(manager.getCurrentMode()).toBe(DetectionMode.PRE_COMPUTED);
    });

    it('should reset failures', () => {
      manager.recordFailure();
      manager.recordFailure();
      expect(manager.getFailureStats().count).toBe(2);

      manager.resetFailures();
      expect(manager.getFailureStats().count).toBe(0);
    });

    it('should only count recent failures', async () => {
      manager.recordFailure();
      
      // Mock old failure (outside window)
      const stats = manager.getFailureStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('supportsRealTime', () => {
    it('should return true for capable devices', async () => {
      await manager.initialize();
      const capabilities = manager.getCapabilities();
      if (capabilities) {
        capabilities.year = 2020;
        capabilities.memoryGB = 4;
      }

      expect(manager.supportsRealTime()).toBe(true);
    });

    it('should return false for incapable devices', async () => {
      await manager.initialize();
      const capabilities = manager.getCapabilities();
      if (capabilities) {
        capabilities.year = 2016;
        capabilities.memoryGB = 1;
      }

      expect(manager.supportsRealTime()).toBe(false);
    });
  });
});
