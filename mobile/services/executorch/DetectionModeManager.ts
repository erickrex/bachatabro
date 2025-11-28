/**
 * Detection Mode Manager
 * Manages detection mode selection and automatic fallback
 * 
 * Task 3.1.2: Create Detection Mode Manager
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DetectionMode, DeviceCapabilities } from '@/types/detection';

const DETECTION_MODE_KEY = '@bacha_trainer:detection_mode';
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 60000; // 1 minute

export class DetectionModeManager {
  private currentMode: DetectionMode = DetectionMode.AUTO;
  private failures: number[] = []; // timestamps of failures
  private capabilities: DeviceCapabilities | null = null;

  /**
   * Initialize the detection mode manager
   */
  async initialize(): Promise<void> {
    // Detect device capabilities
    this.capabilities = await this.getDeviceCapabilities();

    // Load saved mode preference
    const savedMode = await AsyncStorage.getItem(DETECTION_MODE_KEY);
    
    if (savedMode && Object.values(DetectionMode).includes(savedMode as DetectionMode)) {
      this.currentMode = savedMode as DetectionMode;
    } else {
      // Auto-detect optimal mode
      this.currentMode = DetectionMode.AUTO;
    }

    console.log('Detection mode initialized:', this.currentMode);
    console.log('Device capabilities:', this.capabilities);
  }

  /**
   * Get device capabilities
   */
  private async getDeviceCapabilities(): Promise<DeviceCapabilities> {
    // Use Platform.Version to estimate device capabilities
    const modelName = this.getDeviceModel();
    const year = this.estimateDeviceYear(modelName);
    const memoryGB = this.estimateDeviceMemory();

    return {
      year,
      memoryGB,
      platform: Platform.OS as 'ios' | 'android',
      modelName,
    };
  }

  /**
   * Get device model name
   */
  private getDeviceModel(): string {
    if (Platform.OS === 'ios') {
      // iOS version can give us a rough idea
      const version = Platform.Version as number;
      if (version >= 17) return 'iPhone 15 or newer';
      if (version >= 16) return 'iPhone 14 series';
      if (version >= 15) return 'iPhone 13 series';
      if (version >= 14) return 'iPhone 12 series';
      return 'iPhone (older)';
    } else {
      // Android API level
      const apiLevel = Platform.Version as number;
      if (apiLevel >= 33) return 'Android 13+ device';
      if (apiLevel >= 31) return 'Android 12 device';
      if (apiLevel >= 29) return 'Android 10 device';
      return 'Android (older)';
    }
  }

  /**
   * Estimate device year from model name
   */
  private estimateDeviceYear(modelName: string): number {
    const currentYear = new Date().getFullYear();
    
    // Try to extract year from model name
    const yearMatch = modelName.match(/20\d{2}/);
    if (yearMatch) {
      return parseInt(yearMatch[0]);
    }

    // iPhone model year estimation
    if (modelName.includes('iPhone')) {
      if (modelName.includes('15')) return 2023;
      if (modelName.includes('14')) return 2022;
      if (modelName.includes('13')) return 2021;
      if (modelName.includes('12')) return 2020;
      if (modelName.includes('11')) return 2019;
      if (modelName.includes('X')) return 2017;
      return 2018; // Default for older iPhones
    }

    // Default to 3 years old if unknown
    return currentYear - 3;
  }

  /**
   * Estimate device memory
   */
  private estimateDeviceMemory(): number {
    // This is a rough estimation
    // In production, you might use a native module to get actual memory
    if (Platform.OS === 'ios') {
      return 4; // Most modern iPhones have 4GB+
    } else {
      return 3; // Conservative estimate for Android
    }
  }

  /**
   * Detect optimal detection mode based on device capabilities
   */
  async detectOptimalMode(): Promise<DetectionMode> {
    if (!this.capabilities) {
      await this.initialize();
    }

    const { year, memoryGB } = this.capabilities!;

    // Modern devices (2020+) with good specs can handle real-time
    if (year >= 2020 && memoryGB >= 4) {
      return DetectionMode.REAL_TIME;
    }

    // Older or lower-spec devices use pre-computed
    return DetectionMode.PRE_COMPUTED;
  }

  /**
   * Get current detection mode
   */
  getCurrentMode(): DetectionMode {
    return this.currentMode;
  }

  /**
   * Get effective detection mode (resolves AUTO to actual mode)
   */
  async getEffectiveMode(): Promise<DetectionMode> {
    if (this.currentMode === DetectionMode.AUTO) {
      return await this.detectOptimalMode();
    }
    return this.currentMode;
  }

  /**
   * Set detection mode manually
   */
  async setMode(mode: DetectionMode): Promise<void> {
    this.currentMode = mode;
    await AsyncStorage.setItem(DETECTION_MODE_KEY, mode);
    console.log('Detection mode set to:', mode);
  }

  /**
   * Record a detection failure
   */
  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);

    // Remove old failures outside the window
    this.failures = this.failures.filter(
      timestamp => now - timestamp < FAILURE_WINDOW_MS
    );

    console.warn(`Detection failure recorded. Recent failures: ${this.failures.length}`);

    // Trigger fallback if too many failures
    if (this.failures.length >= MAX_FAILURES) {
      this.triggerFallback('Too many detection failures');
    }
  }

  /**
   * Trigger fallback to pre-computed mode
   */
  triggerFallback(reason: string): void {
    console.warn(`Triggering fallback to pre-computed mode: ${reason}`);
    
    // Only fallback if currently in real-time mode
    if (this.currentMode === DetectionMode.REAL_TIME || 
        this.currentMode === DetectionMode.AUTO) {
      this.currentMode = DetectionMode.PRE_COMPUTED;
      
      // Don't persist this change - it's temporary
      // User can manually switch back if they want
    }

    // Reset failure count
    this.failures = [];
  }

  /**
   * Reset failure count
   */
  resetFailures(): void {
    this.failures = [];
  }

  /**
   * Check if device supports real-time detection
   */
  supportsRealTime(): boolean {
    if (!this.capabilities) {
      return false;
    }

    const { year, memoryGB } = this.capabilities;
    return year >= 2019 && memoryGB >= 3;
  }

  /**
   * Get device capabilities
   */
  getCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get failure statistics
   */
  getFailureStats(): { count: number; rate: number } {
    const count = this.failures.length;
    const rate = count / (FAILURE_WINDOW_MS / 1000); // failures per second
    return { count, rate };
  }
}
