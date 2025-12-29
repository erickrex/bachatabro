/**
 * Property-based tests for BatteryAdapter
 * Feature: elevenlabs-voice-coach
 * Property 21: Low Battery Adaptation
 * Validates: Requirements 15.5
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import {
  BatteryAdapter,
  BatteryAdapterConfig,
  BatteryLevelProvider,
  DefaultBatteryProvider,
} from '../BatteryAdapter';

// Mock battery provider for testing
class MockBatteryProvider implements BatteryLevelProvider {
  private level: number = 100;
  private charging: boolean = false;

  setLevel(level: number): void {
    this.level = level;
  }

  setCharging(charging: boolean): void {
    this.charging = charging;
  }

  async getBatteryLevel(): Promise<number> {
    return this.level;
  }

  async isCharging(): Promise<boolean> {
    return this.charging;
  }
}

describe('BatteryAdapter Property Tests', () => {
  // Increase timeout for property-based tests
  jest.setTimeout(15000);

  /**
   * Feature: elevenlabs-voice-coach, Property 21: Low Battery Adaptation
   * Validates: Requirements 15.5
   *
   * For any device battery level below 20%, the Voice Coach should reduce
   * coaching frequency (increase cooldown period).
   */
  describe('Property 21: Low Battery Adaptation', () => {
    it('should increase cooldown when battery is below threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 19 }), // Low battery levels (0-19%)
          fc.integer({ min: 1000, max: 5000 }), // Normal cooldown
          fc.integer({ min: 2, max: 5 }), // Multiplier
          async (batteryLevel, normalCooldown, multiplier) => {
            const mockProvider = new MockBatteryProvider();
            mockProvider.setLevel(batteryLevel);
            mockProvider.setCharging(false);

            const adapter = new BatteryAdapter(
              {
                lowBatteryThreshold: 20,
                normalCooldownMs: normalCooldown,
                lowBatteryCooldownMultiplier: multiplier,
              },
              mockProvider
            );

            const adaptedCooldown = await adapter.getAdaptedCooldown();
            const expectedCooldown = normalCooldown * multiplier;

            expect(adaptedCooldown).toBe(expectedCooldown);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should use normal cooldown when battery is at or above threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 100 }), // Normal/high battery levels (20-100%)
          fc.integer({ min: 1000, max: 5000 }), // Normal cooldown
          fc.integer({ min: 2, max: 5 }), // Multiplier
          async (batteryLevel, normalCooldown, multiplier) => {
            const mockProvider = new MockBatteryProvider();
            mockProvider.setLevel(batteryLevel);
            mockProvider.setCharging(false);

            const adapter = new BatteryAdapter(
              {
                lowBatteryThreshold: 20,
                normalCooldownMs: normalCooldown,
                lowBatteryCooldownMultiplier: multiplier,
              },
              mockProvider
            );

            const adaptedCooldown = await adapter.getAdaptedCooldown();

            expect(adaptedCooldown).toBe(normalCooldown);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should use normal cooldown when charging regardless of battery level', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }), // Any battery level
          fc.integer({ min: 1000, max: 5000 }), // Normal cooldown
          fc.integer({ min: 2, max: 5 }), // Multiplier
          async (batteryLevel, normalCooldown, multiplier) => {
            const mockProvider = new MockBatteryProvider();
            mockProvider.setLevel(batteryLevel);
            mockProvider.setCharging(true); // Charging

            const adapter = new BatteryAdapter(
              {
                lowBatteryThreshold: 20,
                normalCooldownMs: normalCooldown,
                lowBatteryCooldownMultiplier: multiplier,
              },
              mockProvider
            );

            const adaptedCooldown = await adapter.getAdaptedCooldown();

            // When charging, should always use normal cooldown
            expect(adaptedCooldown).toBe(normalCooldown);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should correctly identify low battery state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }), // Any battery level
          fc.integer({ min: 5, max: 50 }), // Threshold
          fc.boolean(), // Charging state
          async (batteryLevel, threshold, isCharging) => {
            const adapter = new BatteryAdapter({
              lowBatteryThreshold: threshold,
            });

            const isLow = adapter.isLevelLow(batteryLevel, isCharging);
            const expectedLow = batteryLevel < threshold && !isCharging;

            expect(isLow).toBe(expectedLow);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should respect configurable threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 50 }), // Threshold
          fc.integer({ min: 1000, max: 5000 }), // Normal cooldown
          async (threshold, normalCooldown) => {
            const mockProvider = new MockBatteryProvider();
            mockProvider.setCharging(false);

            const adapter = new BatteryAdapter(
              {
                lowBatteryThreshold: threshold,
                normalCooldownMs: normalCooldown,
                lowBatteryCooldownMultiplier: 2,
              },
              mockProvider
            );

            // Test at threshold boundary
            mockProvider.setLevel(threshold);
            const atThreshold = await adapter.getAdaptedCooldown();
            expect(atThreshold).toBe(normalCooldown); // At threshold = normal

            mockProvider.invalidateCache?.();
            adapter.invalidateCache();

            mockProvider.setLevel(threshold - 1);
            const belowThreshold = await adapter.getAdaptedCooldown();
            expect(belowThreshold).toBe(normalCooldown * 2); // Below threshold = increased
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should calculate cooldown correctly for any battery level', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // Battery level
          fc.integer({ min: 1000, max: 5000 }), // Normal cooldown
          fc.integer({ min: 2, max: 5 }), // Multiplier
          fc.integer({ min: 5, max: 50 }), // Threshold
          fc.boolean(), // Charging
          (batteryLevel, normalCooldown, multiplier, threshold, isCharging) => {
            const adapter = new BatteryAdapter({
              lowBatteryThreshold: threshold,
              normalCooldownMs: normalCooldown,
              lowBatteryCooldownMultiplier: multiplier,
            });

            const cooldown = adapter.getCooldownForLevel(batteryLevel, isCharging);
            const isLow = batteryLevel < threshold && !isCharging;
            const expectedCooldown = isLow ? normalCooldown * multiplier : normalCooldown;

            expect(cooldown).toBe(expectedCooldown);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should always return positive cooldown values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // Battery level
          fc.integer({ min: 1, max: 10000 }), // Normal cooldown (positive)
          fc.integer({ min: 1, max: 10 }), // Multiplier (positive)
          fc.boolean(), // Charging
          (batteryLevel, normalCooldown, multiplier, isCharging) => {
            const adapter = new BatteryAdapter({
              normalCooldownMs: normalCooldown,
              lowBatteryCooldownMultiplier: multiplier,
            });

            const cooldown = adapter.getCooldownForLevel(batteryLevel, isCharging);

            expect(cooldown).toBeGreaterThan(0);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should have low battery cooldown always greater than or equal to normal cooldown', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 5000 }), // Normal cooldown
          fc.integer({ min: 1, max: 10 }), // Multiplier (>= 1)
          (normalCooldown, multiplier) => {
            const adapter = new BatteryAdapter({
              normalCooldownMs: normalCooldown,
              lowBatteryCooldownMultiplier: multiplier,
            });

            const normalResult = adapter.calculateCooldown(false);
            const lowBatteryResult = adapter.calculateCooldown(true);

            expect(lowBatteryResult).toBeGreaterThanOrEqual(normalResult);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });
  });

  describe('DefaultBatteryProvider', () => {
    it('should return default values when battery detection is unavailable', async () => {
      const provider = new DefaultBatteryProvider();

      const level = await provider.getBatteryLevel();
      const charging = await provider.isCharging();

      expect(level).toBe(100);
      expect(charging).toBe(false);
    });
  });

  describe('BatteryAdapter configuration', () => {
    it('should use default values when no config provided', () => {
      const adapter = new BatteryAdapter();

      expect(adapter.getLowBatteryThreshold()).toBe(20);
      expect(adapter.getNormalCooldown()).toBe(3000);
      expect(adapter.getLowBatteryCooldownMultiplier()).toBe(2);
    });

    it('should allow updating configuration', () => {
      const adapter = new BatteryAdapter();

      adapter.setLowBatteryThreshold(15);
      adapter.setNormalCooldown(4000);
      adapter.setLowBatteryCooldownMultiplier(3);

      expect(adapter.getLowBatteryThreshold()).toBe(15);
      expect(adapter.getNormalCooldown()).toBe(4000);
      expect(adapter.getLowBatteryCooldownMultiplier()).toBe(3);
    });
  });
});
