/**
 * Performance Reviewer Service
 *
 * Generates and speaks performance reviews after dance sessions.
 * Analyzes session data to identify strongest/weakest parts and
 * provides actionable feedback.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { GeminiClient } from './GeminiClient';
import { ElevenLabsClient } from './ElevenLabsClient';
import { AudioManager, AudioClip } from './AudioManager';
import type {
  PerformanceReviewRequest,
  PerformanceReviewResponse,
  SupportedLanguage,
} from '../../types/voiceCoach';
import type { FrameScore, Song, SessionCoverage } from '../../types/game';
import { getLanguageAppropriateVoice } from '../../config/voiceConfig';

export interface GameSession {
  song: Song;
  finalScore: number;
  previousBest: number | null;
  frameScores: FrameScore[];
  strongestPart?: string;
  weakestPart?: string;
  coverage?: SessionCoverage;
}

export interface PerformanceReview {
  review: string;
  improvementTip: string;
  audioClip?: AudioClip;
}

export interface PerformanceReviewerConfig {
  geminiClient?: GeminiClient;
  elevenLabsClient?: ElevenLabsClient;
  audioManager?: AudioManager;
  language?: SupportedLanguage;
  voiceId?: string;
  enabled?: boolean;
}

export class PerformanceReviewer {
  private geminiClient: GeminiClient;
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private language: SupportedLanguage;
  private voiceId: string;
  private enabled: boolean;

  constructor(config: PerformanceReviewerConfig = {}) {
    this.geminiClient = config.geminiClient || new GeminiClient();
    this.elevenLabsClient = config.elevenLabsClient || new ElevenLabsClient();
    this.audioManager = config.audioManager || new AudioManager();
    this.language = config.language || 'en';
    // Use language-appropriate voice if no voiceId provided
    this.voiceId = config.voiceId || getLanguageAppropriateVoice(this.language);
    this.enabled = config.enabled !== undefined ? config.enabled : true;
  }

  /**
   * Generate and speak performance review for a completed session
   *
   * Analyzes the session to identify strongest/weakest parts,
   * generates a comprehensive review, converts to speech, and plays it.
   *
   * @param session - Game session data
   * @returns Performance review with text and audio
   */
  async reviewSession(session: GameSession): Promise<PerformanceReview> {
    if (!this.enabled) {
      return {
        review: '',
        improvementTip: '',
      };
    }

    try {
      // Analyze session to identify strongest/weakest parts if not provided
      const analysis = this.analyzeSession(session);

      // Generate review using Gemini
      const reviewRequest: PerformanceReviewRequest = {
        songTitle: session.song.title,
        songArtist: session.song.artist,
        finalScore: session.finalScore,
        previousBest: session.previousBest,
        strongestPart: analysis.strongestPart,
        weakestPart: analysis.weakestPart,
        totalFrames: session.frameScores.length,
        language: this.language,
        coverage: session.coverage,
      };

      const reviewResponse = await this.geminiClient.generatePerformanceReview(reviewRequest);

      // Convert review to speech
      const fullReviewText = `${reviewResponse.review} ${reviewResponse.improvementTip}`;
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text: fullReviewText,
        voiceId: this.voiceId,
        language: this.language,
      });

      // Create audio clip
      const audioClip: AudioClip = {
        id: `review-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'high',
        text: fullReviewText,
      };

      // Enqueue for playback
      this.audioManager.enqueue(audioClip);

      return {
        review: reviewResponse.review,
        improvementTip: reviewResponse.improvementTip,
        audioClip,
      };
    } catch (error) {
      console.error('[PerformanceReviewer] Error generating review:', error);
      
      // Return empty review on error
      return {
        review: '',
        improvementTip: '',
      };
    }
  }

  /**
   * Analyze session to identify strongest and weakest body parts
   *
   * Examines frame scores to determine which body parts performed best/worst.
   * If session already has these values, returns them; otherwise calculates.
   *
   * @param session - Game session data
   * @returns Analysis with strongest and weakest parts
   */
  private analyzeSession(session: GameSession): {
    strongestPart: string;
    weakestPart: string;
  } {
    // If already provided, use those values
    if (session.strongestPart && session.weakestPart) {
      return {
        strongestPart: session.strongestPart,
        weakestPart: session.weakestPart,
      };
    }

    // Analyze frame scores to identify body part performance
    const bodyPartScores: Record<string, number[]> = {};

    session.frameScores.forEach((frameScore) => {
      if (frameScore.matches) {
        Object.entries(frameScore.matches).forEach(([bodyPart, matched]) => {
          if (!bodyPartScores[bodyPart]) {
            bodyPartScores[bodyPart] = [];
          }
          // Convert boolean match to score (1 for match, 0 for no match)
          bodyPartScores[bodyPart].push(matched ? 1 : 0);
        });
      }
    });

    // Calculate average score for each body part
    const bodyPartAverages: Record<string, number> = {};
    Object.entries(bodyPartScores).forEach(([bodyPart, scores]) => {
      if (scores.length > 0) {
        bodyPartAverages[bodyPart] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    });

    // Find strongest and weakest
    let strongestPart = 'overall';
    let weakestPart = 'overall';
    let highestScore = -1;
    let lowestScore = 2;

    Object.entries(bodyPartAverages).forEach(([bodyPart, avgScore]) => {
      if (avgScore > highestScore) {
        highestScore = avgScore;
        strongestPart = bodyPart;
      }
      if (avgScore < lowestScore) {
        lowestScore = avgScore;
        weakestPart = bodyPart;
      }
    });

    return {
      strongestPart,
      weakestPart,
    };
  }

  /**
   * Set whether performance reviews are enabled
   *
   * @param enabled - Enable or disable reviews
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get current enabled state
   *
   * @returns Whether reviews are enabled
   */
  getEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the language for reviews and update voice to be language-appropriate
   *
   * @param language - Target language
   */
  setLanguage(language: SupportedLanguage): void {
    this.language = language;
    // Update voice to be appropriate for the new language
    this.voiceId = getLanguageAppropriateVoice(language, this.voiceId);
  }

  /**
   * Get current language
   *
   * @returns Current language
   */
  getLanguage(): SupportedLanguage {
    return this.language;
  }

  /**
   * Set the voice ID for TTS
   *
   * @param voiceId - ElevenLabs voice ID
   */
  setVoiceId(voiceId: string): void {
    this.voiceId = voiceId;
  }

  /**
   * Get current voice ID
   *
   * @returns Current voice ID
   */
  getVoiceId(): string {
    return this.voiceId;
  }
}
