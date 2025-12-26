/**
 * Error Handler service for Voice Coach
 * 
 * Implements resilient error handling with:
 * - Consecutive failure tracking
 * - Automatic disable/enable of voice features
 * - Fallback phrase selection
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.5, 13.6
 */

import type { SupportedLanguage, VoiceCoachError, PoseAnalysis } from '../../types/voiceCoach';
import { FALLBACK_COACHING_TIPS, FALLBACK_ENCOURAGEMENTS } from '../../config/fallbackPhrases';

export type ErrorType = 'network' | 'rate_limit' | 'api_error' | 'invalid_request' | 'elevenlabs' | 'gemini';

export interface ErrorContext {
  analysis?: PoseAnalysis;
  language?: SupportedLanguage;
  operation?: string;
  [key: string]: unknown;
}

export interface ErrorHandlerConfig {
  maxConsecutiveFailures?: number;
  recoveryCheckIntervalMs?: number;
}

export type VoiceFeatureStatus = 'enabled' | 'disabled' | 'degraded';

export interface ErrorHandlerState {
  consecutiveFailures: number;
  status: VoiceFeatureStatus;
  lastError: VoiceCoachError | null;
  lastErrorTime: number | null;
}

export class ErrorHandler {
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number;
  private status: VoiceFeatureStatus = 'enabled';
  private lastError: VoiceCoachError | null = null;
  private lastErrorTime: number | null = null;
  private recoveryCheckIntervalMs: number;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  // Event handlers
  public onStatusChange: ((status: VoiceFeatureStatus) => void) | null = null;
  public onNotification: ((message: string) => void) | null = null;

  constructor(config?: ErrorHandlerConfig) {
    this.maxConsecutiveFailures = config?.maxConsecutiveFailures ?? 5;
    this.recoveryCheckIntervalMs = config?.recoveryCheckIntervalMs ?? 30000;
  }

  /**
   * Handle an error from voice coach operations
   * Tracks consecutive failures and disables features if threshold exceeded
   */
  handleError(error: VoiceCoachError, context?: ErrorContext): void {
    this.consecutiveFailures++;
    this.lastError = error;
    this.lastErrorTime = Date.now();

    // Log error for debugging
    console.error('[VoiceCoach]', error.type, error.message, context?.operation);

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.disableVoiceFeatures();
      this.notifyUser('Voice coach temporarily unavailable');
      this.scheduleRecoveryCheck();
    } else if (this.consecutiveFailures >= Math.floor(this.maxConsecutiveFailures / 2)) {
      // Degraded mode after half the failures
      this.setStatus('degraded');
      this.notifyUser('Voice coach experiencing issues');
    }
  }

  /**
   * Report a successful operation
   * Resets failure counter and re-enables features if disabled
   */
  onSuccess(): void {
    const wasDisabled = this.status === 'disabled';
    const wasDegraded = this.status === 'degraded';
    
    this.consecutiveFailures = 0;
    this.lastError = null;
    
    if (wasDisabled || wasDegraded) {
      this.enableVoiceFeatures();
      if (wasDisabled) {
        this.notifyUser('Voice coach restored');
      }
    }
    
    this.clearRecoveryTimer();
  }

  /**
   * Get a fallback phrase based on context
   * Used when API calls fail
   */
  getFallbackPhrase(context: ErrorContext): string {
    const language = context.language || 'en';
    const score = context.analysis?.score ?? 50;

    if (score > 90) {
      // High score - encouragement
      const encouragements = FALLBACK_ENCOURAGEMENTS[language] || FALLBACK_ENCOURAGEMENTS.en;
      return this.selectRandomPhrase(encouragements);
    } else {
      // Lower score - coaching tip
      const tips = FALLBACK_COACHING_TIPS[language] || FALLBACK_COACHING_TIPS.en;
      return this.selectRandomPhrase(tips);
    }
  }

  /**
   * Check if voice features are currently available
   */
  isAvailable(): boolean {
    return this.status !== 'disabled';
  }

  /**
   * Check if voice features are currently disabled
   */
  isDisabled(): boolean {
    return this.status === 'disabled';
  }

  /**
   * Check if voice features are in degraded mode
   */
  isDegraded(): boolean {
    return this.status === 'degraded';
  }

  /**
   * Get current status
   */
  getStatus(): VoiceFeatureStatus {
    return this.status;
  }

  /**
   * Get current state for debugging/testing
   */
  getState(): ErrorHandlerState {
    return {
      consecutiveFailures: this.consecutiveFailures,
      status: this.status,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Reset the error handler state
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.lastErrorTime = null;
    this.setStatus('enabled');
    this.clearRecoveryTimer();
  }

  /**
   * Manually enable voice features
   */
  enableVoiceFeatures(): void {
    this.setStatus('enabled');
    this.clearRecoveryTimer();
  }

  /**
   * Manually disable voice features
   */
  disableVoiceFeatures(): void {
    this.setStatus('disabled');
  }

  /**
   * Attempt recovery - check if features can be re-enabled
   */
  attemptRecovery(): boolean {
    // If we haven't had errors recently, try to recover
    const timeSinceLastError = this.lastErrorTime 
      ? Date.now() - this.lastErrorTime 
      : Infinity;
    
    if (timeSinceLastError > this.recoveryCheckIntervalMs) {
      this.consecutiveFailures = 0;
      this.enableVoiceFeatures();
      return true;
    }
    
    return false;
  }

  private setStatus(status: VoiceFeatureStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange?.(status);
    }
  }

  private notifyUser(message: string): void {
    this.onNotification?.(message);
  }

  private selectRandomPhrase(phrases: string[]): string {
    if (phrases.length === 0) {
      return '';
    }
    const index = Math.floor(Math.random() * phrases.length);
    return phrases[index];
  }

  private scheduleRecoveryCheck(): void {
    this.clearRecoveryTimer();
    this.recoveryTimer = setTimeout(() => {
      this.attemptRecovery();
    }, this.recoveryCheckIntervalMs);
  }

  private clearRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }
}

// Singleton instance
let defaultErrorHandler: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!defaultErrorHandler) {
    defaultErrorHandler = new ErrorHandler();
  }
  return defaultErrorHandler;
}
