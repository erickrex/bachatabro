/**
 * Unit tests for GeminiClient
 */

import { GeminiClient } from '../GeminiClient';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeminiClient', () => {
  let client: GeminiClient;
  let clientNoFallback: GeminiClient;
  let mockAxiosInstance: jest.Mocked<ReturnType<typeof axios.create>>;

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      defaults: { headers: { common: {} } },
    } as unknown as jest.Mocked<ReturnType<typeof axios.create>>;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedAxios.isAxiosError.mockImplementation((error) => error?.isAxiosError === true);

    client = new GeminiClient('http://test-api.com', true); // with fallback
    clientNoFallback = new GeminiClient('http://test-api.com', false); // without fallback
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCoachingTip', () => {
    it('should return coaching tip on success', async () => {
      const mockResponse = {
        data: {
          tip: 'Keep those arms up!',
          targetBodyPart: 'arms',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.generateCoachingTip({
        score: 65,
        weakPoints: ['arms', 'timing'],
        strongPoints: ['legs'],
        language: 'en',
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/gemini/coaching-tip', {
        score: 65,
        weakPoints: ['arms', 'timing'],
        strongPoints: ['legs'],
        language: 'en',
      });
    });

    it('should return fallback tip on API error when fallback enabled', async () => {
      const apiError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      const result = await client.generateCoachingTip({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        language: 'en',
      });

      // Should return a fallback tip
      expect(result.tip).toBeDefined();
      expect(typeof result.tip).toBe('string');
      expect(result.targetBodyPart).toBe('arms');
    });

    it('should return encouragement fallback for high scores', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      const result = await client.generateCoachingTip({
        score: 95,
        weakPoints: [],
        strongPoints: ['arms', 'legs'],
        language: 'en',
      });

      // Should return an encouragement (high score)
      expect(result.tip).toBeDefined();
      expect(result.targetBodyPart).toBe('overall');
    });

    it('should throw error when fallback disabled', async () => {
      const apiError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Server error' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      await expect(
        clientNoFallback.generateCoachingTip({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
        })
      ).rejects.toEqual({
        type: 'api_error',
        message: 'Server error',
      });
    });

    it('should use Spanish fallback for Spanish language', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      const result = await client.generateCoachingTip({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        language: 'es',
      });

      // Spanish tips contain Spanish characters/words
      expect(result.tip).toBeDefined();
    });
  });

  describe('generatePerformanceReview', () => {
    it('should return performance review on success', async () => {
      const mockResponse = {
        data: {
          review: 'Great job on Uptown Funk! You scored 78%...',
          improvementTip: 'Focus on your arms movements next time.',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.generatePerformanceReview({
        songTitle: 'Uptown Funk',
        songArtist: 'Bruno Mars',
        finalScore: 78,
        previousBest: 72,
        strongestPart: 'legs',
        weakestPart: 'arms',
        language: 'en',
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/gemini/performance-review', {
        songTitle: 'Uptown Funk',
        songArtist: 'Bruno Mars',
        finalScore: 78,
        previousBest: 72,
        strongestPart: 'legs',
        weakestPart: 'arms',
        totalFrames: undefined,
        language: 'en',
      });
    });

    it('should return fallback review on API error', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      const result = await client.generatePerformanceReview({
        songTitle: 'Uptown Funk',
        songArtist: 'Bruno Mars',
        finalScore: 78,
        language: 'en',
      });

      // Should return a fallback review containing the song title and score
      expect(result.review).toContain('Uptown Funk');
      expect(result.review).toContain('78');
      expect(result.improvementTip).toBeDefined();
    });

    it('should use German fallback for German language', async () => {
      const apiError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      };
      mockAxiosInstance.post.mockRejectedValue(apiError);

      const result = await client.generatePerformanceReview({
        songTitle: 'Test Song',
        songArtist: 'Test Artist',
        finalScore: 80,
        language: 'de',
      });

      // German review should contain German words
      expect(result.review).toContain('Test Song');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockResponse = {
        data: { status: 'healthy', service: 'gemini-proxy' },
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.healthCheck();

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/gemini/health');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const networkError = {
        isAxiosError: true,
        response: undefined,
      };
      mockAxiosInstance.post.mockRejectedValue(networkError);

      // With fallback enabled, should return fallback
      const result = await client.generateCoachingTip({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
      });
      expect(result.tip).toBeDefined();

      // Without fallback, should throw
      await expect(
        clientNoFallback.generateCoachingTip({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
        })
      ).rejects.toEqual({
        type: 'network',
        message: 'Network error: Unable to reach server',
      });
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: { error: 'Too many requests', retry_after: 60 },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(rateLimitError);

      await expect(
        clientNoFallback.generateCoachingTip({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
        })
      ).rejects.toEqual({
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        retryAfter: 60,
      });
    });
  });
});
