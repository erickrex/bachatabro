/**
 * Integration Test: Performance Review Flow
 * 
 * Tests the complete performance review flow:
 * 1. Game end → review generation → audio playback
 * 2. Transcript display during playback
 * 
 * Validates Requirements: 6.1, 6.6
 */

import { PerformanceReviewer, GameSession } from '../../services/voiceCoach/PerformanceReviewer';
import { GeminiClient } from '../../services/voiceCoach/GeminiClient';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import type { Song, FrameScore } from '../../types/game';

// Mock clients for integration testing
class MockGeminiClient extends GeminiClient {
  public callCount: number = 0;
  public lastRequest: any = null;

  async generatePerformanceReview(request: any): Promise<any> {
    this.callCount++;
    this.lastRequest = request;

    return {
      review: `Great job on ${request.songTitle}! You scored ${request.finalScore}%. Your ${request.strongestPart} was excellent.`,
      improvementTip: `Try to focus more on your ${request.weakestPart} next time.`,
    };
  }
}

class MockElevenLabsClient extends ElevenLabsClient {
  public callCount: number = 0;
  public lastRequest: any = null;

  async textToSpeech(request: any): Promise<any> {
    this.callCount++;
    this.lastRequest = request;

    return {
      audio: 'base64_encoded_review_audio',
      format: 'mp3',
      durationMs: 5000,
    };
  }
}

class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];
  public currentlyPlaying: any = null;

  enqueue(clip: any, autoPlay: boolean = true): void {
    this.enqueuedClips.push(clip);
  }

  async play(): Promise<void> {
    if (this.enqueuedClips.length > 0) {
      this.currentlyPlaying = this.enqueuedClips[0];
      // Simulate playback
      if (this.onPlaybackStart) {
        this.onPlaybackStart(this.currentlyPlaying);
      }
      // Simulate completion
      if (this.onPlaybackEnd) {
        this.onPlaybackEnd(this.currentlyPlaying);
      }
    }
    return Promise.resolve();
  }

  clearQueue(): void {
    this.enqueuedClips = [];
    this.currentlyPlaying = null;
  }
}

describe('Performance Review Integration', () => {
  let reviewer: PerformanceReviewer;
  let mockGemini: MockGeminiClient;
  let mockElevenLabs: MockElevenLabsClient;
  let mockAudio: MockAudioManager;

  const mockSong: Song = {
    id: 'howdeepisyourlove',
    title: 'How Deep Is Your Love',
    artist: 'Prince Royce',
    duration: 180,
    audioFile: require('../../assets/audio/howdeepisyourlove.mp3'),
    videoFile: require('../../assets/videos/howdeepisyourlove.mp4'),
    poseFile: require('../../assets/poses/howdeepisyourlove.json'),
  };

  const createMockFrameScores = (count: number): FrameScore[] => {
    return Array.from({ length: count }, (_, i) => ({
      frameNumber: i,
      score: 80 + Math.random() * 20,
      matches: {
        leftArm: i % 3 !== 0,
        rightArm: i % 3 !== 1,
        leftLeg: i % 2 === 0,
        rightLeg: i % 2 === 1,
      },
      timestamp: i * 100,
    }));
  };

  beforeEach(() => {
    mockGemini = new MockGeminiClient();
    mockElevenLabs = new MockElevenLabsClient();
    mockAudio = new MockAudioManager();

    reviewer = new PerformanceReviewer({
      geminiClient: mockGemini,
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      language: 'en',
      enabled: true,
    });
  });

  describe('Complete Review Flow', () => {
    it('should complete full flow: game end → review generation → audio playback', async () => {
      // Requirement 6.1: Generate and speak performance review after session
      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 78,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // Execute review flow
      const review = await reviewer.reviewSession(session);

      // Verify Gemini was called to generate review
      expect(mockGemini.callCount).toBe(1);
      expect(mockGemini.lastRequest).toMatchObject({
        songTitle: 'How Deep Is Your Love',
        songArtist: 'Prince Royce',
        finalScore: 85,
        previousBest: 78,
        strongestPart: 'legs',
        weakestPart: 'arms',
      });

      // Verify ElevenLabs was called to convert to speech
      expect(mockElevenLabs.callCount).toBe(1);

      // Verify audio was enqueued with high priority
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockAudio.enqueuedClips[0].priority).toBe('high');

      // Verify review contains required elements
      expect(review.review).toBeTruthy();
      expect(review.improvementTip).toBeTruthy();
      expect(review.audioClip).toBeTruthy();
    });

    it('should include all required review elements', async () => {
      // Requirement 6.2, 6.3, 6.4, 6.5: Review completeness
      const session: GameSession = {
        song: mockSong,
        finalScore: 92,
        previousBest: 85,
        frameScores: createMockFrameScores(100),
        strongestPart: 'arms',
        weakestPart: 'legs',
      };

      const review = await reviewer.reviewSession(session);

      // Verify review text contains key elements
      const fullText = `${review.review} ${review.improvementTip}`;
      
      // Should mention the score
      expect(fullText).toContain('92');
      
      // Should mention the song
      expect(fullText.toLowerCase()).toContain('how deep is your love');
      
      // Should mention strongest part
      expect(fullText.toLowerCase()).toContain('arms');
      
      // Should mention weakest part
      expect(fullText.toLowerCase()).toContain('legs');
    });

    it('should handle first-time play (no previous best)', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 75,
        previousBest: null, // First time playing
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);

      // Should still generate review
      expect(review.review).toBeTruthy();
      expect(review.improvementTip).toBeTruthy();

      // Verify Gemini received null for previousBest
      expect(mockGemini.lastRequest.previousBest).toBeNull();
    });
  });

  describe('Transcript Display', () => {
    it('should provide transcript text for UI display', async () => {
      // Requirement 6.6: Display transcript during playback
      const session: GameSession = {
        song: mockSong,
        finalScore: 88,
        previousBest: 82,
        frameScores: createMockFrameScores(100),
        strongestPart: 'arms',
        weakestPart: 'legs',
      };

      const review = await reviewer.reviewSession(session);

      // Audio clip should contain text for transcript display
      expect(review.audioClip).toBeDefined();
      expect(review.audioClip!.text).toBeTruthy();
      expect(review.audioClip!.text.length).toBeGreaterThan(0);

      // Text should be the full review
      const expectedText = `${review.review} ${review.improvementTip}`;
      expect(review.audioClip!.text).toBe(expectedText);
    });

    it('should trigger playback events for transcript updates', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 90,
        previousBest: 85,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      let playbackStarted = false;
      let playbackEnded = false;
      let transcriptText = '';

      mockAudio.onPlaybackStart = (clip) => {
        playbackStarted = true;
        transcriptText = clip.text;
      };

      mockAudio.onPlaybackEnd = (clip) => {
        playbackEnded = true;
      };

      await reviewer.reviewSession(session);
      await mockAudio.play();

      // Verify playback events were triggered
      expect(playbackStarted).toBe(true);
      expect(playbackEnded).toBe(true);
      expect(transcriptText).toBeTruthy();
    });
  });

  describe('Session Analysis', () => {
    it('should analyze frame scores when strongest/weakest not provided', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        // No strongestPart or weakestPart provided
      };

      const review = await reviewer.reviewSession(session);

      // Should still generate review with analyzed parts
      expect(review.review).toBeTruthy();
      expect(mockGemini.lastRequest.strongestPart).toBeTruthy();
      expect(mockGemini.lastRequest.weakestPart).toBeTruthy();
    });

    it('should use provided strongest/weakest when available', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        strongestPart: 'custom_strong',
        weakestPart: 'custom_weak',
      };

      await reviewer.reviewSession(session);

      // Should use provided values
      expect(mockGemini.lastRequest.strongestPart).toBe('custom_strong');
      expect(mockGemini.lastRequest.weakestPart).toBe('custom_weak');
    });
  });

  describe('Multi-Language Support', () => {
    it('should generate reviews in different languages', async () => {
      const languages: Array<'en' | 'es' | 'de' | 'ru'> = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        const langReviewer = new PerformanceReviewer({
          geminiClient: mockGemini,
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          language: lang,
        });

        mockAudio.clearQueue();
        mockGemini.callCount = 0;
        mockElevenLabs.callCount = 0;

        const session: GameSession = {
          song: mockSong,
          finalScore: 85,
          previousBest: 80,
          frameScores: createMockFrameScores(100),
          strongestPart: 'legs',
          weakestPart: 'arms',
        };

        const review = await langReviewer.reviewSession(session);

        // Should work for all languages
        expect(review.review).toBeTruthy();
        expect(mockGemini.lastRequest.language).toBe(lang);
        expect(mockElevenLabs.lastRequest.language).toBe(lang);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Gemini API failure gracefully', async () => {
      const failingGemini = new MockGeminiClient();
      failingGemini.generatePerformanceReview = async () => {
        throw new Error('Gemini API failed');
      };

      const errorReviewer = new PerformanceReviewer({
        geminiClient: failingGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
      });

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // Should not throw
      const review = await errorReviewer.reviewSession(session);

      // Should return empty review
      expect(review.review).toBe('');
      expect(review.improvementTip).toBe('');
      expect(review.audioClip).toBeUndefined();
    });

    it('should handle ElevenLabs API failure gracefully', async () => {
      const failingElevenLabs = new MockElevenLabsClient();
      failingElevenLabs.textToSpeech = async () => {
        throw new Error('ElevenLabs API failed');
      };

      const errorReviewer = new PerformanceReviewer({
        geminiClient: mockGemini,
        elevenLabsClient: failingElevenLabs,
        audioManager: mockAudio,
      });

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // Should not throw
      const review = await errorReviewer.reviewSession(session);

      // Should return empty review
      expect(review.review).toBe('');
      expect(review.improvementTip).toBe('');
    });
  });

  describe('Enable/Disable State', () => {
    it('should not generate review when disabled', async () => {
      reviewer.setEnabled(false);

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);

      // Should return empty review
      expect(review.review).toBe('');
      expect(review.improvementTip).toBe('');

      // No API calls should be made
      expect(mockGemini.callCount).toBe(0);
      expect(mockElevenLabs.callCount).toBe(0);
    });

    it('should resume reviews when re-enabled', async () => {
      reviewer.setEnabled(false);
      reviewer.setEnabled(true);

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);

      // Should work normally
      expect(review.review).toBeTruthy();
      expect(mockGemini.callCount).toBe(1);
    });
  });

  describe('Audio Priority', () => {
    it('should enqueue review with high priority', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: createMockFrameScores(100),
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      await reviewer.reviewSession(session);

      // Review should have high priority to clear other queued audio
      expect(mockAudio.enqueuedClips[0].priority).toBe('high');
    });
  });
});
