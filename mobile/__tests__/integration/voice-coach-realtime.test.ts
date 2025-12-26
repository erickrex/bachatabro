/**
 * Integration Test: Real-Time Voice Coaching Flow
 * 
 * Tests the complete real-time coaching flow:
 * 1. Pose analysis → coaching tip generation → audio playback
 * 2. Cooldown enforcement in real scenario
 * 3. Fallback when API fails
 * 
 * Validates Requirements: 5.1, 5.2, 5.3, 4.6
 */

import { RealTimeCoach } from '../../services/voiceCoach/RealTimeCoach';
import { GeminiClient } from '../../services/voiceCoach/GeminiClient';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import type { PoseAnalysis } from '../../types/voiceCoach';

// Mock clients for integration testing
class MockGeminiClient extends GeminiClient {
  public shouldFail: boolean = false;
  public callCount: number = 0;

  async generateCoachingTip(request: any): Promise<any> {
    this.callCount++;
    
    if (this.shouldFail) {
      throw new Error('Gemini API failed');
    }

    return {
      tip: 'Focus on your arm movements',
      targetBodyPart: request.weakPoints[0] || 'arms',
    };
  }
}

class MockElevenLabsClient extends ElevenLabsClient {
  public shouldFail: boolean = false;
  public callCount: number = 0;

  async textToSpeech(request: any): Promise<any> {
    this.callCount++;
    
    if (this.shouldFail) {
      throw new Error('ElevenLabs API failed');
    }

    return {
      audio: 'base64_encoded_audio_data',
      format: 'mp3',
      durationMs: 2000,
    };
  }
}

class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];
  public playCount: number = 0;

  enqueue(clip: any, autoPlay: boolean = true): void {
    this.enqueuedClips.push(clip);
    // Don't actually play in tests
  }

  async play(): Promise<void> {
    this.playCount++;
    // Simulate playback without actual audio
    return Promise.resolve();
  }

  clearQueue(): void {
    this.enqueuedClips = [];
  }
}

describe('Real-Time Voice Coaching Integration', () => {
  let coach: RealTimeCoach;
  let mockGemini: MockGeminiClient;
  let mockElevenLabs: MockElevenLabsClient;
  let mockAudio: MockAudioManager;

  beforeEach(() => {
    mockGemini = new MockGeminiClient();
    mockElevenLabs = new MockElevenLabsClient();
    mockAudio = new MockAudioManager();

    coach = new RealTimeCoach({
      geminiClient: mockGemini,
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      language: 'en',
      cooldownMs: 3000,
      enabled: true,
    });
  });

  describe('Complete Coaching Flow', () => {
    it('should complete full flow: pose analysis → coaching tip → audio playback', async () => {
      // Requirement 5.1: Low score triggers coaching tip
      const lowScoreAnalysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['leftArm', 'rightArm'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };

      // Execute coaching flow
      await coach.onPoseAnalysis(lowScoreAnalysis);

      // Verify Gemini was called to generate tip
      expect(mockGemini.callCount).toBe(1);

      // Verify ElevenLabs was called to convert to speech
      expect(mockElevenLabs.callCount).toBe(1);

      // Verify audio was enqueued for playback
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockAudio.enqueuedClips[0].priority).toBe('normal');
      expect(mockAudio.enqueuedClips[0].text).toBeTruthy();
    });

    it('should trigger encouragement for high scores', async () => {
      // Requirement 5.2: High score triggers encouragement
      const highScoreAnalysis: PoseAnalysis = {
        score: 95,
        weakPoints: [],
        strongPoints: ['arms', 'legs'],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(highScoreAnalysis);

      // Encouragement uses fallback phrases, not Gemini
      expect(mockGemini.callCount).toBe(0);

      // But still uses ElevenLabs for TTS
      expect(mockElevenLabs.callCount).toBe(1);

      // Audio should be enqueued
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });

    it('should not trigger feedback for mid-range scores', async () => {
      // Scores between 70-90% should not trigger feedback
      const midScoreAnalysis: PoseAnalysis = {
        score: 80,
        weakPoints: ['leftArm'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(midScoreAnalysis);

      // No API calls should be made
      expect(mockGemini.callCount).toBe(0);
      expect(mockElevenLabs.callCount).toBe(0);
      expect(mockAudio.enqueuedClips.length).toBe(0);
    });
  });

  describe('Cooldown Enforcement', () => {
    it('should enforce cooldown between consecutive feedback', async () => {
      // Requirement 5.3: 3-second cooldown between tips
      const baseTime = Date.now();

      const analysis1: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime,
      };

      const analysis2: PoseAnalysis = {
        score: 60,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime + 1000, // 1 second later (within cooldown)
      };

      const analysis3: PoseAnalysis = {
        score: 55,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime + 4000, // 4 seconds later (after cooldown)
      };

      // First analysis should trigger feedback
      await coach.onPoseAnalysis(analysis1);
      expect(mockAudio.enqueuedClips.length).toBe(1);

      // Second analysis should be suppressed (within cooldown)
      await coach.onPoseAnalysis(analysis2);
      expect(mockAudio.enqueuedClips.length).toBe(1); // Still 1

      // Third analysis should trigger feedback (after cooldown)
      await coach.onPoseAnalysis(analysis3);
      expect(mockAudio.enqueuedClips.length).toBe(2);
    });

    it('should handle rapid pose updates correctly', async () => {
      const baseTime = Date.now();
      const analyses: PoseAnalysis[] = [];

      // Generate 10 analyses over 5 seconds (every 500ms)
      for (let i = 0; i < 10; i++) {
        analyses.push({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: baseTime + i * 500,
        });
      }

      // Process all analyses
      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      // With 3-second cooldown, should only get 2 feedback instances
      // (at 0ms and 3500ms)
      expect(mockAudio.enqueuedClips.length).toBe(2);
    });
  });

  describe('API Failure Fallback', () => {
    it('should use fallback phrases when Gemini fails', async () => {
      // Requirement 4.6: Fallback to pre-defined phrases on API failure
      mockGemini.shouldFail = true;

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Gemini should have been attempted
      expect(mockGemini.callCount).toBe(1);

      // Should fall back to ElevenLabs with fallback phrase
      expect(mockElevenLabs.callCount).toBe(1);

      // Audio should still be enqueued
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });

    it('should gracefully handle ElevenLabs failure', async () => {
      mockElevenLabs.shouldFail = true;

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Should not throw error
      await expect(coach.onPoseAnalysis(analysis)).resolves.not.toThrow();

      // Gemini should have been called
      expect(mockGemini.callCount).toBe(1);

      // ElevenLabs should have been attempted twice (main tip + fallback)
      expect(mockElevenLabs.callCount).toBe(2);

      // Text-only clip should be enqueued for graceful degradation
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockAudio.enqueuedClips[0].text).toBeTruthy();
    });

    it('should continue gameplay when both APIs fail', async () => {
      mockGemini.shouldFail = true;
      mockElevenLabs.shouldFail = true;

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Should not throw error - graceful degradation
      await expect(coach.onPoseAnalysis(analysis)).resolves.not.toThrow();

      // APIs should have been attempted
      expect(mockGemini.callCount).toBe(1);
      expect(mockElevenLabs.callCount).toBe(1);
    });
  });

  describe('Weak Point Prioritization', () => {
    it('should target the weakest body part in coaching tips', async () => {
      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['leftArm', 'rightLeg', 'torso'], // leftArm is first = weakest
        strongPoints: ['rightArm'],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Verify the weakest body part is identified correctly
      const weakest = coach.getWeakestBodyPart(analysis);
      expect(weakest).toBe('leftArm');
    });
  });

  describe('Multi-Language Support', () => {
    it('should work with different languages', async () => {
      const languages: Array<'en' | 'es' | 'de' | 'ru'> = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        const langCoach = new RealTimeCoach({
          geminiClient: mockGemini,
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          language: lang,
          cooldownMs: 3000,
        });

        mockAudio.clearQueue();
        mockGemini.callCount = 0;
        mockElevenLabs.callCount = 0;

        const analysis: PoseAnalysis = {
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now(),
        };

        await langCoach.onPoseAnalysis(analysis);

        // Should work for all languages
        expect(mockAudio.enqueuedClips.length).toBe(1);
      }
    });
  });

  describe('Enable/Disable State', () => {
    it('should not provide feedback when disabled', async () => {
      coach.setEnabled(false);

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // No API calls should be made
      expect(mockGemini.callCount).toBe(0);
      expect(mockElevenLabs.callCount).toBe(0);
      expect(mockAudio.enqueuedClips.length).toBe(0);
    });

    it('should resume feedback when re-enabled', async () => {
      coach.setEnabled(false);
      coach.setEnabled(true);

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Should work normally
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });
  });
});
