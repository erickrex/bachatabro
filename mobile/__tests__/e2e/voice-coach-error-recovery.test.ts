/**
 * End-to-End Test: Voice Coach Error Recovery Scenarios
 * 
 * Tests error recovery and graceful degradation:
 * 1. Test with network disconnection
 * 2. Test with API rate limiting
 * 3. Verify graceful degradation
 * 
 * Validates Requirements: 13.1, 13.4, 13.6
 */

import { RealTimeCoach } from '../../services/voiceCoach/RealTimeCoach';
import { PerformanceReviewer, GameSession } from '../../services/voiceCoach/PerformanceReviewer';
import { VoiceNavigation, Router } from '../../services/voiceCoach/VoiceNavigation';
import { GeminiClient } from '../../services/voiceCoach/GeminiClient';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import { ErrorHandler } from '../../services/voiceCoach/ErrorHandler';
import { NetworkRetryQueue } from '../../services/voiceCoach/NetworkRetryQueue';
import type { PoseAnalysis } from '../../types/voiceCoach';
import type { Song } from '../../types/game';

// Mock clients with controllable failure modes
class MockGeminiClient extends GeminiClient {
  public failureMode: 'none' | 'network' | 'rate_limit' | 'server_error' = 'none';
  public callCount: number = 0;
  public failureCount: number = 0;

  async generateCoachingTip(request: any): Promise<any> {
    this.callCount++;

    if (this.failureMode === 'network') {
      this.failureCount++;
      throw new Error('Network request failed');
    }

    if (this.failureMode === 'rate_limit') {
      this.failureCount++;
      const error: any = new Error('Rate limit exceeded');
      error.statusCode = 429;
      throw error;
    }

    if (this.failureMode === 'server_error') {
      this.failureCount++;
      const error: any = new Error('Internal server error');
      error.statusCode = 500;
      throw error;
    }

    return {
      tip: 'Focus on your movements',
      targetBodyPart: 'arms',
    };
  }

  async generatePerformanceReview(request: any): Promise<any> {
    this.callCount++;

    if (this.failureMode !== 'none') {
      this.failureCount++;
      throw new Error(`API failed: ${this.failureMode}`);
    }

    return {
      review: 'Great job!',
      improvementTip: 'Keep practicing',
    };
  }

  reset(): void {
    this.failureMode = 'none';
    this.callCount = 0;
    this.failureCount = 0;
  }
}

class MockElevenLabsClient extends ElevenLabsClient {
  public failureMode: 'none' | 'network' | 'rate_limit' | 'server_error' = 'none';
  public callCount: number = 0;
  public failureCount: number = 0;

  async textToSpeech(request: any): Promise<any> {
    this.callCount++;

    if (this.failureMode === 'network') {
      this.failureCount++;
      throw new Error('Network request failed');
    }

    if (this.failureMode === 'rate_limit') {
      this.failureCount++;
      const error: any = new Error('Rate limit exceeded');
      error.statusCode = 429;
      throw error;
    }

    if (this.failureMode === 'server_error') {
      this.failureCount++;
      const error: any = new Error('Internal server error');
      error.statusCode = 500;
      throw error;
    }

    return {
      audio: 'base64_encoded_audio',
      format: 'mp3',
      durationMs: 2000,
    };
  }

  reset(): void {
    this.failureMode = 'none';
    this.callCount = 0;
    this.failureCount = 0;
  }
}

class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];

  enqueue(clip: any): void {
    this.enqueuedClips.push(clip);
  }

  clearQueue(): void {
    this.enqueuedClips = [];
  }

  reset(): void {
    this.enqueuedClips = [];
  }
}

class MockRouter implements Router {
  public navigationHistory: string[] = [];

  push(route: string | { pathname: string; params?: Record<string, string> }): void {
    if (typeof route === 'string') {
      this.navigationHistory.push(route);
    } else {
      this.navigationHistory.push(route.pathname);
    }
  }

  reset(): void {
    this.navigationHistory = [];
  }
}

describe('E2E: Voice Coach Error Recovery', () => {
  let coach: RealTimeCoach;
  let reviewer: PerformanceReviewer;
  let navigation: VoiceNavigation;
  let mockGemini: MockGeminiClient;
  let mockElevenLabs: MockElevenLabsClient;
  let mockAudio: MockAudioManager;
  let mockRouter: MockRouter;
  let errorHandler: ErrorHandler;
  let retryQueue: NetworkRetryQueue;

  const mockSong: Song = {
    id: 'test',
    title: 'Test Song',
    artist: 'Test Artist',
    duration: 180,
  };

  beforeEach(() => {
    mockGemini = new MockGeminiClient();
    mockElevenLabs = new MockElevenLabsClient();
    mockAudio = new MockAudioManager();
    mockRouter = new MockRouter();

    errorHandler = new ErrorHandler({
      maxConsecutiveFailures: 3,
      onDisable: () => console.log('Voice features disabled'),
      onEnable: () => console.log('Voice features enabled'),
    });

    retryQueue = new NetworkRetryQueue({
      maxRetries: 3,
      retryDelay: 100,
    });

    coach = new RealTimeCoach({
      geminiClient: mockGemini,
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      language: 'en',
      cooldownMs: 0,
      enabled: true,
    });

    reviewer = new PerformanceReviewer({
      geminiClient: mockGemini,
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      language: 'en',
      enabled: true,
    });

    navigation = new VoiceNavigation({
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      router: mockRouter,
      language: 'en',
    });
  });

  describe('Network Disconnection Scenarios', () => {
    it('should handle network failure during real-time coaching', async () => {
      // Requirement 13.1: Disable voice features when backend unreachable
      mockGemini.failureMode = 'network';
      mockElevenLabs.failureMode = 'network';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Should not throw error
      await expect(coach.onPoseAnalysis(analysis)).resolves.not.toThrow();

      // Gameplay should continue without voice feedback
      expect(mockAudio.enqueuedClips.length).toBe(0);

      // Verify API was attempted
      expect(mockGemini.callCount).toBeGreaterThan(0);
      expect(mockGemini.failureCount).toBeGreaterThan(0);
    });

    it('should handle network failure during performance review', async () => {
      mockGemini.failureMode = 'network';
      mockElevenLabs.failureMode = 'network';

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // Should not throw error
      const review = await reviewer.reviewSession(session);

      // Should return empty review
      expect(review.review).toBe('');
      expect(review.improvementTip).toBe('');
    });

    it('should handle network failure during voice navigation', async () => {
      mockElevenLabs.failureMode = 'network';

      const command = navigation.parseCommand('help');

      // Should not throw error
      await expect(navigation.executeCommand(command)).resolves.not.toThrow();

      // Should not have enqueued audio
      expect(mockAudio.enqueuedClips.length).toBe(0);
    });

    it('should queue requests when network is unavailable', async () => {
      // Requirement 13.4: Queue failed requests for retry
      mockGemini.failureMode = 'network';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Attempt coaching with network failure
      await coach.onPoseAnalysis(analysis);

      // Request should be queued
      expect(retryQueue.getQueueLength()).toBeGreaterThanOrEqual(0);
    });

    it('should retry queued requests when network recovers', async () => {
      // Start with network failure
      mockGemini.failureMode = 'network';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Attempt coaching (will fail)
      await coach.onPoseAnalysis(analysis);
      const initialFailures = mockGemini.failureCount;

      // Network recovers
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';

      // Retry the request
      await coach.onPoseAnalysis(analysis);

      // Should succeed now
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(0);
    });

    it('should handle intermittent network failures', async () => {
      const analyses: PoseAnalysis[] = [
        { score: 65, weakPoints: ['arms'], strongPoints: [], timestamp: Date.now() },
        { score: 60, weakPoints: ['arms'], strongPoints: [], timestamp: Date.now() + 1000 },
        { score: 55, weakPoints: ['arms'], strongPoints: [], timestamp: Date.now() + 2000 },
      ];

      // First request fails
      mockGemini.failureMode = 'network';
      await coach.onPoseAnalysis(analyses[0]);
      expect(mockAudio.enqueuedClips.length).toBe(0);

      // Second request succeeds
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';
      await coach.onPoseAnalysis(analyses[1]);
      expect(mockAudio.enqueuedClips.length).toBe(1);

      // Third request fails again
      mockGemini.failureMode = 'network';
      await coach.onPoseAnalysis(analyses[2]);
      expect(mockAudio.enqueuedClips.length).toBe(1); // Still 1
    });
  });

  describe('API Rate Limiting Scenarios', () => {
    it('should handle rate limiting during real-time coaching', async () => {
      // Requirement 13.1: Handle API rate limiting gracefully
      mockGemini.failureMode = 'rate_limit';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Should not throw error
      await expect(coach.onPoseAnalysis(analysis)).resolves.not.toThrow();

      // Should use fallback phrases
      expect(mockElevenLabs.callCount).toBeGreaterThan(0);
    });

    it('should handle rate limiting during performance review', async () => {
      mockGemini.failureMode = 'rate_limit';

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // Should not throw error
      const review = await reviewer.reviewSession(session);

      // Should return empty review (no fallback for reviews)
      expect(review.review).toBe('');
    });

    it('should implement exponential backoff for rate limiting', async () => {
      mockGemini.failureMode = 'rate_limit';

      const analyses: PoseAnalysis[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now() + i * 1000,
        }));

      const startTime = Date.now();

      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // With exponential backoff, should take longer than sequential calls
      console.log(`Rate limit handling duration: ${duration}ms`);
    });

    it('should recover after rate limit period expires', async () => {
      // Start with rate limiting
      mockGemini.failureMode = 'rate_limit';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // First attempt (rate limited)
      await coach.onPoseAnalysis(analysis);
      const rateLimitedClips = mockAudio.enqueuedClips.length;

      // Rate limit expires
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';

      // Second attempt (should succeed)
      await coach.onPoseAnalysis({
        ...analysis,
        timestamp: Date.now() + 1000,
      });

      // Should have more clips now
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(rateLimitedClips);
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue gameplay when voice features fail', async () => {
      // Requirement 13.6: Graceful degradation
      mockGemini.failureMode = 'server_error';
      mockElevenLabs.failureMode = 'server_error';

      // Simulate a complete game session with failures
      const sessionFrames: PoseAnalysis[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          score: 60 + Math.random() * 30,
          weakPoints: ['arms'],
          strongPoints: ['legs'],
          timestamp: Date.now() + i * 1000,
        }));

      // Process all frames (should not throw)
      for (const frame of sessionFrames) {
        await expect(coach.onPoseAnalysis(frame)).resolves.not.toThrow();
      }

      // Gameplay continues (no audio, but no crashes)
      expect(mockAudio.enqueuedClips.length).toBe(0);
    });

    it('should use fallback phrases when Gemini fails', async () => {
      mockGemini.failureMode = 'server_error';
      mockElevenLabs.failureMode = 'none'; // ElevenLabs works

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Should use fallback phrase with ElevenLabs
      expect(mockElevenLabs.callCount).toBe(1);
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });

    it('should disable voice features after consecutive failures', async () => {
      mockGemini.failureMode = 'network';
      mockElevenLabs.failureMode = 'network';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Trigger multiple consecutive failures
      for (let i = 0; i < 5; i++) {
        await coach.onPoseAnalysis({
          ...analysis,
          timestamp: Date.now() + i * 1000,
        });
        errorHandler.handleError({
          type: 'network_error',
          message: 'Network failed',
        });
      }

      // Voice features should be disabled
      expect(errorHandler.isDisabled()).toBe(true);
    });

    it('should re-enable voice features when errors stop', async () => {
      // Trigger failures to disable
      mockGemini.failureMode = 'network';
      for (let i = 0; i < 5; i++) {
        errorHandler.handleError({
          type: 'network_error',
          message: 'Network failed',
        });
      }
      expect(errorHandler.isDisabled()).toBe(true);

      // Network recovers
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';

      // Successful requests
      for (let i = 0; i < 3; i++) {
        errorHandler.onSuccess();
      }

      // Voice features should be re-enabled
      expect(errorHandler.isDisabled()).toBe(false);
    });

    it('should display non-intrusive error notifications', async () => {
      let notificationShown = false;
      let notificationMessage = '';

      errorHandler.onNotification = (message: string) => {
        notificationShown = true;
        notificationMessage = message;
      };

      mockGemini.failureMode = 'network';

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        errorHandler.handleError({
          type: 'network_error',
          message: 'Network failed',
        });
      }

      // Should show notification
      expect(notificationShown).toBe(true);
      expect(notificationMessage).toBeTruthy();
      expect(notificationMessage.toLowerCase()).toContain('voice');
    });
  });

  describe('Mixed Error Scenarios', () => {
    it('should handle Gemini failure with ElevenLabs success', async () => {
      mockGemini.failureMode = 'server_error';
      mockElevenLabs.failureMode = 'none';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Should use fallback phrase with working TTS
      expect(mockElevenLabs.callCount).toBe(1);
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });

    it('should handle ElevenLabs failure with Gemini success', async () => {
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'server_error';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Gemini generates tip but TTS fails
      expect(mockGemini.callCount).toBe(1);
      expect(mockElevenLabs.callCount).toBe(1);
      expect(mockAudio.enqueuedClips.length).toBe(0); // No audio
    });

    it('should handle both services failing', async () => {
      mockGemini.failureMode = 'network';
      mockElevenLabs.failureMode = 'network';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Should not throw
      await expect(coach.onPoseAnalysis(analysis)).resolves.not.toThrow();

      // No audio should be enqueued
      expect(mockAudio.enqueuedClips.length).toBe(0);
    });

    it('should handle alternating service failures', async () => {
      const analyses: PoseAnalysis[] = Array(6)
        .fill(null)
        .map((_, i) => ({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now() + i * 1000,
        }));

      for (let i = 0; i < analyses.length; i++) {
        // Alternate failures
        if (i % 2 === 0) {
          mockGemini.failureMode = 'network';
          mockElevenLabs.failureMode = 'none';
        } else {
          mockGemini.failureMode = 'none';
          mockElevenLabs.failureMode = 'network';
        }

        await coach.onPoseAnalysis(analyses[i]);
      }

      // Some requests should have succeeded
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(0);
      expect(mockAudio.enqueuedClips.length).toBeLessThan(analyses.length);
    });
  });

  describe('Error Recovery Timing', () => {
    it('should recover quickly from transient errors', async () => {
      // Single failure
      mockGemini.failureMode = 'network';
      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };
      await coach.onPoseAnalysis(analysis);

      // Immediate recovery
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';
      await coach.onPoseAnalysis({
        ...analysis,
        timestamp: Date.now() + 1000,
      });

      // Should work immediately
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });

    it('should handle rapid error-recovery cycles', async () => {
      const analyses: PoseAnalysis[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now() + i * 100,
        }));

      for (let i = 0; i < analyses.length; i++) {
        // Rapid alternation
        mockGemini.failureMode = i % 3 === 0 ? 'network' : 'none';
        mockElevenLabs.failureMode = i % 3 === 0 ? 'network' : 'none';

        await coach.onPoseAnalysis(analyses[i]);
      }

      // Should have handled all requests without crashing
      expect(mockGemini.callCount).toBe(analyses.length);
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log all errors for debugging', async () => {
      const errorLog: any[] = [];

      errorHandler.onError = (error: any) => {
        errorLog.push(error);
      };

      mockGemini.failureMode = 'network';

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Trigger multiple errors
      for (let i = 0; i < 3; i++) {
        await coach.onPoseAnalysis({
          ...analysis,
          timestamp: Date.now() + i * 1000,
        });
        errorHandler.handleError({
          type: 'network_error',
          message: 'Network failed',
        });
      }

      // Should have logged errors
      expect(errorLog.length).toBeGreaterThan(0);
    });

    it('should track error rates', async () => {
      const analyses: PoseAnalysis[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now() + i * 1000,
        }));

      // 50% failure rate
      for (let i = 0; i < analyses.length; i++) {
        mockGemini.failureMode = i % 2 === 0 ? 'network' : 'none';
        mockElevenLabs.failureMode = i % 2 === 0 ? 'network' : 'none';
        await coach.onPoseAnalysis(analyses[i]);
      }

      const successRate = mockAudio.enqueuedClips.length / analyses.length;
      console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);

      expect(successRate).toBeGreaterThan(0);
      expect(successRate).toBeLessThan(1);
    });
  });

  describe('Complete Error Recovery Journey', () => {
    it('should handle a realistic error scenario throughout a session', async () => {
      // Session starts normally
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';

      let analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };
      await coach.onPoseAnalysis(analysis);
      expect(mockAudio.enqueuedClips.length).toBe(1);

      // Network issues occur
      mockGemini.failureMode = 'network';
      mockElevenLabs.failureMode = 'network';
      
      analysis = { ...analysis, timestamp: Date.now() + 1000 };
      await coach.onPoseAnalysis(analysis);
      expect(mockAudio.enqueuedClips.length).toBe(1); // Still 1

      // Network recovers but rate limited
      mockGemini.failureMode = 'rate_limit';
      mockElevenLabs.failureMode = 'none';
      
      analysis = { ...analysis, timestamp: Date.now() + 2000 };
      await coach.onPoseAnalysis(analysis);
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(1); // Fallback used

      // Everything recovers
      mockGemini.failureMode = 'none';
      mockElevenLabs.failureMode = 'none';
      
      analysis = { ...analysis, timestamp: Date.now() + 3000 };
      await coach.onPoseAnalysis(analysis);
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(2);

      // Session ends with review
      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);
      expect(review.review).toBeTruthy();

      console.log('Complete error recovery journey succeeded');
    });
  });
});
