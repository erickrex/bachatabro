/**
 * Gemini API client for coaching intelligence
 *
 * Communicates with the backend proxy to access Google Gemini services
 * for generating coaching tips and performance reviews.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG, ENDPOINTS } from '../../config/api';
import type {
  CoachingTipRequest,
  CoachingTipResponse,
  PerformanceReviewRequest,
  PerformanceReviewResponse,
  SupportedLanguage,
  VoiceCoachError,
} from '../../types/voiceCoach';
import { FALLBACK_COACHING_TIPS, FALLBACK_ENCOURAGEMENTS, FALLBACK_REVIEWS } from '../../config/fallbackPhrases';

export class GeminiClient {
  private client: AxiosInstance;
  private useFallbackOnError: boolean;

  constructor(baseUrl?: string, useFallbackOnError = true) {
    this.client = axios.create({
      baseURL: baseUrl || API_CONFIG.baseUrl,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.useFallbackOnError = useFallbackOnError;
  }

  /**
   * Generate a coaching tip based on pose analysis
   *
   * @param request - Coaching tip request with score and body part analysis
   * @returns CoachingTipResponse with tip and target body part
   */
  async generateCoachingTip(request: CoachingTipRequest): Promise<CoachingTipResponse> {
    try {
      const response = await this.client.post<CoachingTipResponse>(
        ENDPOINTS.gemini.coachingTip,
        {
          score: request.score,
          weakPoints: request.weakPoints,
          strongPoints: request.strongPoints,
          language: request.language || 'en',
        }
      );

      return response.data;
    } catch (error) {
      if (this.useFallbackOnError) {
        return this.getFallbackCoachingTip(request);
      }
      throw this.handleError(error, 'Failed to generate coaching tip');
    }
  }

  /**
   * Generate a performance review after a dance session
   *
   * @param request - Performance review request with session data
   * @returns PerformanceReviewResponse with review and improvement tip
   */
  async generatePerformanceReview(request: PerformanceReviewRequest): Promise<PerformanceReviewResponse> {
    try {
      const response = await this.client.post<PerformanceReviewResponse>(
        ENDPOINTS.gemini.performanceReview,
        {
          songTitle: request.songTitle,
          songArtist: request.songArtist,
          finalScore: request.finalScore,
          previousBest: request.previousBest,
          strongestPart: request.strongestPart,
          weakestPart: request.weakestPart,
          totalFrames: request.totalFrames,
          language: request.language || 'en',
        }
      );

      return response.data;
    } catch (error) {
      if (this.useFallbackOnError) {
        return this.getFallbackPerformanceReview(request);
      }
      throw this.handleError(error, 'Failed to generate performance review');
    }
  }

  /**
   * Check service health
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    try {
      const response = await this.client.get(ENDPOINTS.gemini.health);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Health check failed');
    }
  }

  /**
   * Get fallback coaching tip when API fails
   */
  private getFallbackCoachingTip(request: CoachingTipRequest): CoachingTipResponse {
    const language = request.language || 'en';
    const score = request.score;
    const targetBodyPart = request.weakPoints[0] || 'overall';

    // Choose tip based on score
    let tip: string;
    if (score > 90) {
      // High score - encouragement
      const encouragements = FALLBACK_ENCOURAGEMENTS[language] || FALLBACK_ENCOURAGEMENTS.en;
      tip = encouragements[Math.floor(Math.random() * encouragements.length)];
    } else {
      // Lower score - coaching tip
      const tips = FALLBACK_COACHING_TIPS[language] || FALLBACK_COACHING_TIPS.en;
      tip = tips[Math.floor(Math.random() * tips.length)];
    }

    return {
      tip,
      targetBodyPart,
    };
  }

  /**
   * Get fallback performance review when API fails
   */
  private getFallbackPerformanceReview(request: PerformanceReviewRequest): PerformanceReviewResponse {
    const language = request.language || 'en';
    const reviews = FALLBACK_REVIEWS[language] || FALLBACK_REVIEWS.en;

    // Build review from template
    const review = reviews.template
      .replace('{songTitle}', request.songTitle)
      .replace('{score}', request.finalScore.toFixed(0));

    const improvementTip = `Focus on your ${request.weakestPart || 'timing'} movements next time.`;

    return {
      review,
      improvementTip,
    };
  }

  /**
   * Handle API errors and convert to VoiceCoachError
   */
  private handleError(error: unknown, defaultMessage: string): VoiceCoachError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; retry_after?: number }>;

      // Network error (no response)
      if (!axiosError.response) {
        return {
          type: 'network',
          message: 'Network error: Unable to reach server',
        };
      }

      const status = axiosError.response.status;
      const data = axiosError.response.data;

      // Rate limited
      if (status === 429) {
        return {
          type: 'rate_limit',
          message: 'Rate limit exceeded',
          retryAfter: data?.retry_after || 60,
        };
      }

      // Bad request
      if (status === 400) {
        return {
          type: 'invalid_request',
          message: data?.error || 'Invalid request',
        };
      }

      // Server error
      return {
        type: 'api_error',
        message: data?.error || defaultMessage,
      };
    }

    // Unknown error
    return {
      type: 'api_error',
      message: defaultMessage,
    };
  }
}

// Singleton instance for convenience
let defaultClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!defaultClient) {
    defaultClient = new GeminiClient();
  }
  return defaultClient;
}
