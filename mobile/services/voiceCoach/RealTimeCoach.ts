/**
 * Real-Time Voice Coach Service
 *
 * Provides real-time voice coaching during dance sessions based on pose analysis.
 * Implements score threshold detection, cooldown enforcement, and weak point prioritization.
 * Supports battery-aware cooldown adaptation (Requirements 15.5).
 */

import { GeminiClient } from './GeminiClient';
import { ElevenLabsClient } from './ElevenLabsClient';
import { AudioManager, AudioClip } from './AudioManager';
import { BatteryAdapter, BatteryLevelProvider } from './BatteryAdapter';
import type {
  PoseAnalysis,
  SupportedLanguage,
  CoachingTipRequest,
  VoiceCoachError,
} from '../../types/voiceCoach';
import { FALLBACK_COACHING_TIPS, FALLBACK_ENCOURAGEMENTS } from '../../config/fallbackPhrases';
import { getLanguageAppropriateVoice } from '../../config/voiceConfig';

export interface RealTimeCoachConfig {
  geminiClient: GeminiClient;
  elevenLabsClient: ElevenLabsClient;
  audioManager: AudioManager;
  language?: SupportedLanguage;
  cooldownMs?: number;
  enabled?: boolean;
  voiceId?: string;
  batteryAdapter?: BatteryAdapter;
  batteryAdaptationEnabled?: boolean;
}

export type FeedbackType = 'coaching_tip' | 'encouragement' | 'none';

export class RealTimeCoach {
  private geminiClient: GeminiClient;
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private lastFeedbackTime: number = 0;
  private cooldownMs: number;
  private language: SupportedLanguage;
  private enabled: boolean;
  private voiceId: string;
  private batteryAdapter: BatteryAdapter | null;
  private batteryAdaptationEnabled: boolean;
  private pendingTipFromTtsFailure: string | null = null;

  // Score thresholds
  private readonly LOW_SCORE_THRESHOLD = 70;
  private readonly HIGH_SCORE_THRESHOLD = 90;

  constructor(config: RealTimeCoachConfig) {
    this.geminiClient = config.geminiClient;
    this.elevenLabsClient = config.elevenLabsClient;
    this.audioManager = config.audioManager;
    this.language = config.language || 'en';
    this.cooldownMs = config.cooldownMs ?? 3000; // 3 seconds default
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    // Use language-appropriate voice if no voiceId provided
    this.voiceId = config.voiceId || getLanguageAppropriateVoice(this.language);
    // Battery adaptation
    this.batteryAdapter = config.batteryAdapter || null;
    this.batteryAdaptationEnabled = config.batteryAdaptationEnabled !== undefined 
      ? config.batteryAdaptationEnabled 
      : true;
  }

  /**
   * Main entry point - called on each pose analysis
   * Determines if feedback should be provided and generates/speaks it
   * Uses battery-aware cooldown when battery adapter is configured
   */
  public async onPoseAnalysis(analysis: PoseAnalysis): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Use battery-aware check if adapter is available
    const shouldProvide = this.batteryAdapter && this.batteryAdaptationEnabled
      ? await this.shouldProvideFeedbackAsync(analysis)
      : this.shouldProvideFeedback(analysis);

    if (!shouldProvide) {
      return;
    }

    try {
      await this.generateAndSpeak(analysis);
      this.lastFeedbackTime = analysis.timestamp;
    } catch (error) {
      console.error('[RealTimeCoach] Error providing feedback:', error);
      // Gracefully fail - don't interrupt gameplay
    }
  }

  /**
   * Determine if feedback should be provided based on score and cooldown
   */
  public shouldProvideFeedback(analysis: PoseAnalysis): boolean {
    // Check if cooldown has elapsed (use base cooldown for sync check)
    const timeSinceLastFeedback = analysis.timestamp - this.lastFeedbackTime;
    if (timeSinceLastFeedback < this.cooldownMs) {
      return false;
    }

    // Check if score is outside normal range (< 70% or > 90%)
    const feedbackType = this.getFeedbackType(analysis);
    return feedbackType !== 'none';
  }

  /**
   * Determine if feedback should be provided with battery-aware cooldown
   * Async version that checks battery state
   */
  public async shouldProvideFeedbackAsync(analysis: PoseAnalysis): Promise<boolean> {
    // Get effective cooldown (may be increased if battery is low)
    const effectiveCooldown = await this.getEffectiveCooldown();
    
    // Check if cooldown has elapsed
    const timeSinceLastFeedback = analysis.timestamp - this.lastFeedbackTime;
    if (timeSinceLastFeedback < effectiveCooldown) {
      return false;
    }

    // Check if score is outside normal range (< 70% or > 90%)
    const feedbackType = this.getFeedbackType(analysis);
    return feedbackType !== 'none';
  }

  /**
   * Get the effective cooldown period, considering battery state
   * Returns increased cooldown when battery is low
   */
  public async getEffectiveCooldown(): Promise<number> {
    if (!this.batteryAdaptationEnabled || !this.batteryAdapter) {
      return this.cooldownMs;
    }

    try {
      return await this.batteryAdapter.getAdaptedCooldown();
    } catch (error) {
      console.error('[RealTimeCoach] Error getting battery-adapted cooldown:', error);
      return this.cooldownMs;
    }
  }

  /**
   * Determine the type of feedback based on score
   */
  public getFeedbackType(analysis: PoseAnalysis): FeedbackType {
    if (analysis.score < this.LOW_SCORE_THRESHOLD) {
      return 'coaching_tip';
    } else if (analysis.score > this.HIGH_SCORE_THRESHOLD) {
      return 'encouragement';
    }
    return 'none';
  }

  /**
   * Get the weakest body part from the analysis
   * This is the primary target for coaching tips
   */
  public getWeakestBodyPart(analysis: PoseAnalysis): string {
    // If we have weak points, return the first one (assumed to be weakest)
    if (analysis.weakPoints && analysis.weakPoints.length > 0) {
      return analysis.weakPoints[0];
    }
    return 'overall';
  }

  /**
   * Generate coaching feedback and speak it
   */
  private async generateAndSpeak(analysis: PoseAnalysis): Promise<void> {
    const feedbackType = this.getFeedbackType(analysis);

    if (feedbackType === 'encouragement') {
      // For high scores, use simple encouragement
      await this.speakEncouragement();
    } else if (feedbackType === 'coaching_tip') {
      // For low scores, generate contextual coaching tip
      await this.speakCoachingTip(analysis);
    }
  }

  /**
   * Speak an encouragement for high scores
   */
  private async speakEncouragement(): Promise<void> {
    // Get random encouragement from fallback phrases
    const encouragements = FALLBACK_ENCOURAGEMENTS[this.language] || FALLBACK_ENCOURAGEMENTS.en;
    const text = encouragements[Math.floor(Math.random() * encouragements.length)];

    try {
      // Convert to speech
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text,
        voiceId: this.voiceId,
        language: this.language,
      });

      // Enqueue for playback
      const clip: AudioClip = {
        id: `encouragement-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'normal',
        text,
      };

      this.audioManager.enqueue(clip);
    } catch (error) {
      console.error('[RealTimeCoach] Error speaking encouragement:', error);
    }
  }

  /**
   * Generate and speak a coaching tip for low scores
   * Falls back to local audio clip if TTS fails
   */
  private async speakCoachingTip(analysis: PoseAnalysis): Promise<void> {
    let tipText = '';
    let geminiSucceeded = false;

    try {
      // Generate coaching tip using Gemini
      const request: CoachingTipRequest = {
        score: analysis.score,
        weakPoints: analysis.weakPoints,
        strongPoints: analysis.strongPoints,
        language: this.language,
      };

      const tipResponse = await this.geminiClient.generateCoachingTip(request);
      geminiSucceeded = true;
      tipText = tipResponse.tip;

      // Convert to speech
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text: tipText,
        voiceId: this.voiceId,
        language: this.language,
      });

      // Enqueue for playback
      const clip: AudioClip = {
        id: `coaching-tip-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'normal',
        text: tipText,
      };

      this.audioManager.enqueue(clip);
      this.pendingTipFromTtsFailure = null;
    } catch (error) {
      console.error('[RealTimeCoach] Error speaking coaching tip:', error);
      // If Gemini succeeded, TTS failed - don't enqueue fallback audio or text
      if (geminiSucceeded) {
        if (tipText) {
          this.pendingTipFromTtsFailure = tipText;
          if (this.shouldQueueTextFallbackForTtsFailure(error)) {
            this.enqueueTextOnlyClip(tipText);
          }
          if (this.shouldAttemptFallbackAfterTtsFailure(error)) {
            await this.enqueueFallbackTip();
          }
        }
        return;
      }
      if (this.shouldSkipFallback(error)) {
        await this.trySpeakPendingTip();
        return;
      }
      // Only use fallback phrases when Gemini failed but TTS is available
      await this.enqueueFallbackTip();
    }
  }

  /**
   * Enqueue a fallback coaching tip when API fails
   * This creates a clip with text but may not have audio if TTS is unavailable
   */
  private async enqueueFallbackTip(): Promise<void> {
    const tips = FALLBACK_COACHING_TIPS[this.language] || FALLBACK_COACHING_TIPS.en;
    const text = tips[Math.floor(Math.random() * tips.length)];

    try {
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text,
        voiceId: this.voiceId,
        language: this.language,
      });

      const clip: AudioClip = {
        id: `fallback-tip-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'normal',
        text,
      };

      this.audioManager.enqueue(clip);
      this.pendingTipFromTtsFailure = null;
    } catch (error) {
      // TTS also failed - log and allow gameplay to continue silently
      console.error('[RealTimeCoach] TTS fallback also failed:', error);
    }
  }

  /**
   * Speak a fallback coaching tip when API fails
   * @deprecated Use enqueueFallbackTip instead
   */
  private async speakFallbackTip(): Promise<void> {
    await this.enqueueFallbackTip();
  }

  /**
   * Determine if fallback audio should be skipped based on failure context
   */
  private shouldSkipFallback(error: unknown): boolean {
    return this.isNetworkError(error);
  }

  private shouldQueueTextFallbackForTtsFailure(error: unknown): boolean {
    if (this.isNetworkError(error)) {
      return false;
    }

    const statusCode = (error as any)?.statusCode;
    if (typeof statusCode === 'number') {
      return false;
    }

    return true;
  }

  private shouldAttemptFallbackAfterTtsFailure(error: unknown): boolean {
    return this.shouldQueueTextFallbackForTtsFailure(error);
  }

  private async trySpeakPendingTip(): Promise<boolean> {
    if (!this.pendingTipFromTtsFailure) {
      return false;
    }

    try {
      const text = this.pendingTipFromTtsFailure;
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text,
        voiceId: this.voiceId,
        language: this.language,
      });

      const clip: AudioClip = {
        id: `pending-tip-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'normal',
        text,
      };

      this.audioManager.enqueue(clip);
      this.pendingTipFromTtsFailure = null;
      return true;
    } catch (error) {
      console.error('[RealTimeCoach] Error speaking pending tip:', error);
      return false;
    }
  }

  private enqueueTextOnlyClip(text: string): void {
    const clip: AudioClip = {
      id: `text-only-${Date.now()}`,
      audio: '',
      priority: 'normal',
      text,
    };

    this.audioManager.enqueue(clip);
  }

  /**
   * Basic heuristics to detect network-related failures
   */
  private isNetworkError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    const statusCode = (error as any)?.statusCode;
    if (typeof statusCode === 'number' && statusCode >= 500) {
      return false;
    }

    if (typeof statusCode === 'number' && (statusCode === 0 || statusCode === 503)) {
      return true;
    }

    const message = typeof (error as any)?.message === 'string'
      ? (error as any).message.toLowerCase()
      : '';

    return message.includes('network');
  }

  /**
   * Set enabled state
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get enabled state
   */
  public getEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set language and update voice to be language-appropriate
   */
  public setLanguage(language: SupportedLanguage): void {
    this.language = language;
    // Update voice to be appropriate for the new language
    this.voiceId = getLanguageAppropriateVoice(language, this.voiceId);
  }

  /**
   * Get language
   */
  public getLanguage(): SupportedLanguage {
    return this.language;
  }

  /**
   * Set cooldown period in milliseconds
   */
  public setCooldown(ms: number): void {
    this.cooldownMs = ms;
  }

  /**
   * Get cooldown period in milliseconds
   */
  public getCooldown(): number {
    return this.cooldownMs;
  }

  /**
   * Set voice ID
   */
  public setVoiceId(voiceId: string): void {
    this.voiceId = voiceId;
  }

  /**
   * Get voice ID
   */
  public getVoiceId(): string {
    return this.voiceId;
  }

  /**
   * Reset the last feedback time (useful for testing)
   */
  public resetCooldown(): void {
    this.lastFeedbackTime = 0;
  }

  /**
   * Set the battery adapter for battery-aware cooldown
   */
  public setBatteryAdapter(adapter: BatteryAdapter | null): void {
    this.batteryAdapter = adapter;
  }

  /**
   * Get the battery adapter
   */
  public getBatteryAdapter(): BatteryAdapter | null {
    return this.batteryAdapter;
  }

  /**
   * Enable or disable battery adaptation
   */
  public setBatteryAdaptationEnabled(enabled: boolean): void {
    this.batteryAdaptationEnabled = enabled;
  }

  /**
   * Check if battery adaptation is enabled
   */
  public isBatteryAdaptationEnabled(): boolean {
    return this.batteryAdaptationEnabled;
  }
}
