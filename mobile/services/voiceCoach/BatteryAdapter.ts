/**
 * Battery Adapter Service
 *
 * Monitors device battery level and adapts voice coaching behavior
 * to conserve battery when level is low (below 20%).
 *
 * When battery is low:
 * - Increases cooldown period to reduce API calls
 * - Reduces coaching frequency
 *
 * Requirements: 15.5
 */

export interface BatteryState {
  level: number; // 0-100
  isLowBattery: boolean;
  isCharging: boolean;
}

export interface BatteryAdapterConfig {
  lowBatteryThreshold?: number; // Default: 20%
  normalCooldownMs?: number; // Default: 3000ms
  lowBatteryCooldownMultiplier?: number; // Default: 2x
}

// Battery level provider interface for dependency injection
export interface BatteryLevelProvider {
  getBatteryLevel(): Promise<number>;
  isCharging(): Promise<boolean>;
}

// Default provider that returns normal battery (for when expo-battery is not available)
export class DefaultBatteryProvider implements BatteryLevelProvider {
  async getBatteryLevel(): Promise<number> {
    return 100; // Assume full battery when we can't detect
  }

  async isCharging(): Promise<boolean> {
    return false;
  }
}

export class BatteryAdapter {
  private lowBatteryThreshold: number;
  private normalCooldownMs: number;
  private lowBatteryCooldownMultiplier: number;
  private batteryProvider: BatteryLevelProvider;
  private cachedBatteryState: BatteryState | null = null;
  private lastBatteryCheck: number = 0;
  private batteryCheckIntervalMs: number = 60000; // Check every 60 seconds

  constructor(
    config: BatteryAdapterConfig = {},
    batteryProvider?: BatteryLevelProvider
  ) {
    this.lowBatteryThreshold = config.lowBatteryThreshold ?? 20;
    this.normalCooldownMs = config.normalCooldownMs ?? 3000;
    this.lowBatteryCooldownMultiplier = config.lowBatteryCooldownMultiplier ?? 2;
    this.batteryProvider = batteryProvider ?? new DefaultBatteryProvider();
  }

  /**
   * Get the current battery state
   * Caches the result to avoid frequent battery checks
   */
  public async getBatteryState(): Promise<BatteryState> {
    const now = Date.now();

    // Return cached state if still valid
    if (
      this.cachedBatteryState &&
      now - this.lastBatteryCheck < this.batteryCheckIntervalMs
    ) {
      return this.cachedBatteryState;
    }

    // Fetch fresh battery state
    try {
      const level = await this.batteryProvider.getBatteryLevel();
      const isCharging = await this.batteryProvider.isCharging();

      this.cachedBatteryState = {
        level,
        isLowBattery: level < this.lowBatteryThreshold && !isCharging,
        isCharging,
      };
      this.lastBatteryCheck = now;

      return this.cachedBatteryState;
    } catch (error) {
      console.error('[BatteryAdapter] Error getting battery state:', error);
      // Return default state on error
      return {
        level: 100,
        isLowBattery: false,
        isCharging: false,
      };
    }
  }

  /**
   * Check if battery is currently low (below threshold and not charging)
   */
  public async isLowBattery(): Promise<boolean> {
    const state = await this.getBatteryState();
    return state.isLowBattery;
  }

  /**
   * Get the adapted cooldown period based on battery state
   * Returns increased cooldown when battery is low
   */
  public async getAdaptedCooldown(): Promise<number> {
    const isLow = await this.isLowBattery();
    return this.calculateCooldown(isLow);
  }

  /**
   * Calculate cooldown based on low battery state
   * Pure function for easier testing
   */
  public calculateCooldown(isLowBattery: boolean): number {
    if (isLowBattery) {
      return this.normalCooldownMs * this.lowBatteryCooldownMultiplier;
    }
    return this.normalCooldownMs;
  }

  /**
   * Check if a given battery level is considered low
   * Pure function for property testing
   */
  public isLevelLow(level: number, isCharging: boolean = false): boolean {
    return level < this.lowBatteryThreshold && !isCharging;
  }

  /**
   * Get the cooldown for a specific battery level
   * Pure function for property testing
   */
  public getCooldownForLevel(level: number, isCharging: boolean = false): number {
    const isLow = this.isLevelLow(level, isCharging);
    return this.calculateCooldown(isLow);
  }

  /**
   * Set the battery provider (for testing or runtime configuration)
   */
  public setBatteryProvider(provider: BatteryLevelProvider): void {
    this.batteryProvider = provider;
    // Invalidate cache when provider changes
    this.cachedBatteryState = null;
    this.lastBatteryCheck = 0;
  }

  /**
   * Set the low battery threshold
   */
  public setLowBatteryThreshold(threshold: number): void {
    this.lowBatteryThreshold = threshold;
    // Invalidate cache when threshold changes
    this.cachedBatteryState = null;
  }

  /**
   * Get the low battery threshold
   */
  public getLowBatteryThreshold(): number {
    return this.lowBatteryThreshold;
  }

  /**
   * Set the normal cooldown period
   */
  public setNormalCooldown(ms: number): void {
    this.normalCooldownMs = ms;
  }

  /**
   * Get the normal cooldown period
   */
  public getNormalCooldown(): number {
    return this.normalCooldownMs;
  }

  /**
   * Set the low battery cooldown multiplier
   */
  public setLowBatteryCooldownMultiplier(multiplier: number): void {
    this.lowBatteryCooldownMultiplier = multiplier;
  }

  /**
   * Get the low battery cooldown multiplier
   */
  public getLowBatteryCooldownMultiplier(): number {
    return this.lowBatteryCooldownMultiplier;
  }

  /**
   * Invalidate the cached battery state (force refresh on next check)
   */
  public invalidateCache(): void {
    this.cachedBatteryState = null;
    this.lastBatteryCheck = 0;
  }
}
