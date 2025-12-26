/**
 * ElevenLabs API client for Text-to-Speech and Speech-to-Text
 *
 * Communicates with the backend proxy to access ElevenLabs services
 * without exposing API keys to the client.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_CONFIG, ENDPOINTS, buildUrl } from '../../config/api';
import type {
  TTSRequest,
  TTSResponse,
  STTRequest,
  STTResponse,
  SupportedLanguage,
  VoiceCoachError,
} from '../../types/voiceCoach';

export class ElevenLabsClient {
  private client: AxiosInstance;

  constructor(baseUrl?: string) {
    this.client = axios.create({
      baseURL: baseUrl || API_CONFIG.baseUrl,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Convert text to speech using ElevenLabs
   *
   * @param request - TTS request with text, optional voiceId and language
   * @returns TTSResponse with base64 encoded audio
   * @throws VoiceCoachError on failure
   */
  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await this.client.post<TTSResponse>(
        ENDPOINTS.elevenlabs.tts,
        {
          text: request.text,
          voiceId: request.voiceId,
          language: request.language || 'en',
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Text-to-speech failed');
    }
  }

  /**
   * Convert speech to text using ElevenLabs
   *
   * @param request - STT request with base64 audio and optional language
   * @returns STTResponse with transcript
   * @throws VoiceCoachError on failure
   */
  async speechToText(request: STTRequest): Promise<STTResponse> {
    try {
      const response = await this.client.post<STTResponse>(
        ENDPOINTS.elevenlabs.stt,
        {
          audio: request.audio,
          language: request.language || 'en',
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Speech-to-text failed');
    }
  }

  /**
   * Get available voices by language
   *
   * @param language - Optional language filter
   * @returns Voice configuration
   */
  async getVoices(language?: SupportedLanguage): Promise<Record<string, unknown>> {
    try {
      const url = language
        ? `${ENDPOINTS.elevenlabs.voices}?language=${language}`
        : ENDPOINTS.elevenlabs.voices;

      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get voices');
    }
  }

  /**
   * Check service health
   *
   * @returns Health status
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    try {
      const response = await this.client.get(ENDPOINTS.elevenlabs.health);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Health check failed');
    }
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
let defaultClient: ElevenLabsClient | null = null;

export function getElevenLabsClient(): ElevenLabsClient {
  if (!defaultClient) {
    defaultClient = new ElevenLabsClient();
  }
  return defaultClient;
}
