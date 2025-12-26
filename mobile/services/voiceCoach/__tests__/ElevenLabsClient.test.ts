/**
 * Unit tests for ElevenLabsClient
 */

import { ElevenLabsClient } from '../ElevenLabsClient';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ElevenLabsClient', () => {
  let client: ElevenLabsClient;
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

    client = new ElevenLabsClient('http://test-api.com');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('textToSpeech', () => {
    it('should return audio response on success', async () => {
      const mockResponse = {
        data: {
          audio: 'base64encodedaudio',
          format: 'mp3',
          durationMs: 1500,
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.textToSpeech({
        text: 'Hello world',
        language: 'en',
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/elevenlabs/tts', {
        text: 'Hello world',
        voiceId: undefined,
        language: 'en',
      });
    });

    it('should include voiceId when provided', async () => {
      const mockResponse = {
        data: {
          audio: 'base64encodedaudio',
          format: 'mp3',
          durationMs: 1500,
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await client.textToSpeech({
        text: 'Hello',
        voiceId: 'Rachel',
        language: 'en',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/elevenlabs/tts', {
        text: 'Hello',
        voiceId: 'Rachel',
        language: 'en',
      });
    });

    it('should throw network error when no response', async () => {
      const networkError = {
        isAxiosError: true,
        response: undefined,
      };
      mockAxiosInstance.post.mockRejectedValue(networkError);

      await expect(client.textToSpeech({ text: 'Hello' })).rejects.toEqual({
        type: 'network',
        message: 'Network error: Unable to reach server',
      });
    });

    it('should throw rate_limit error on 429', async () => {
      const rateLimitError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: { error: 'Too many requests', retry_after: 30 },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(rateLimitError);

      await expect(client.textToSpeech({ text: 'Hello' })).rejects.toEqual({
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        retryAfter: 30,
      });
    });

    it('should throw invalid_request error on 400', async () => {
      const badRequestError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: 'Text too long' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(badRequestError);

      await expect(client.textToSpeech({ text: 'Hello' })).rejects.toEqual({
        type: 'invalid_request',
        message: 'Text too long',
      });
    });
  });

  describe('speechToText', () => {
    it('should return transcript on success', async () => {
      const mockResponse = {
        data: {
          transcript: 'Hello world',
          confidence: 0.95,
          language: 'en',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.speechToText({
        audio: 'base64audio',
        language: 'en',
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/elevenlabs/stt', {
        audio: 'base64audio',
        language: 'en',
      });
    });

    it('should default to English language', async () => {
      const mockResponse = {
        data: {
          transcript: 'Hello',
          confidence: 0.9,
          language: 'en',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await client.speechToText({ audio: 'base64audio' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/elevenlabs/stt', {
        audio: 'base64audio',
        language: 'en',
      });
    });
  });

  describe('getVoices', () => {
    it('should return voices without language filter', async () => {
      const mockResponse = {
        data: {
          en: { default: 'Rachel', available: ['Rachel', 'Drew'] },
          es: { default: 'Laura', available: ['Laura', 'Pablo'] },
        },
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getVoices();

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/elevenlabs/voices');
    });

    it('should filter by language when provided', async () => {
      const mockResponse = {
        data: {
          en: { default: 'Rachel', available: ['Rachel', 'Drew'] },
        },
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      await client.getVoices('en');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/elevenlabs/voices?language=en');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockResponse = {
        data: { status: 'healthy', service: 'elevenlabs-proxy' },
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.healthCheck();

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/elevenlabs/health');
    });
  });
});
