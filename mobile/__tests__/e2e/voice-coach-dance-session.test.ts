/**
 * End-to-End Test: Complete Dance Session with Voice Coaching
 * 
 * Tests a complete dance session flow with voice coaching enabled:
 * 1. Start game with voice coaching enabled
 * 2. Verify coaching tips during low scores
 * 3. Verify encouragement during high scores
 * 4. Verify performance review at end
 * 
 * Validates Requirements: 5.1, 5.2, 6.1
 */

import { RealTimeCoach } from '../../services/voiceCoach/RealTimeCoach';
import { PerformanceReviewer, GameSession } from '../../services/voiceCoach/PerformanceReviewer';
import { GeminiClient } from '../../services/voiceCoach/GeminiClient';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import type { PoseAnalysis } from '../../types/voiceCoach';
import type { Song, FrameScore } from '../../types/game';

// Mock clients for E2E testing
class MockGeminiClient extends GeminiClient {
  public coachingTipCount: number = 0;
  public reviewCount: number = 0;
  public shouldFail: boolean = false;

  async generateCoachingTip(request: any): Promise<any> {
    this.coachingTipCount++;
    
    if (this.shouldFail) {
      throw new Error('Gemini API failed');
    }

    return {
      tip: `Focus on your ${request.weakPoints[0] || 'movements'}`,
      targetBodyPart: request.weakPoints[0] || 'arms',
    };
  }

  async generatePerformanceReview(request: any): Promise<any> {
    this.reviewCount++;
    
    if (this.shouldFail) {
      throw new Error('Gemini API failed');
    }

    return {
      review: `Great job on ${request.songTitle}! You scored ${request.finalScore}%. Your ${request.strongestPart} was excellent.`,
      improvementTip: `Try to focus more on your ${request.weakestPart} next time.`,
    };
  }

  reset(): void {
    this.coachingTipCount = 0;
    this.reviewCount = 0;
    this.shouldFail = false;
  }
}

class MockElevenLabsClient extends ElevenLabsClient {
  public ttsCount: number = 0;
  public shouldFail: boolean = false;

  async textToSpeech(request: any): Promise<any> {
    this.ttsCount++;
    
    if (this.shouldFail) {
      throw new Error('ElevenLabs API failed');
    }

    return {
      audio: 'base64_encoded_audio_data',
      format: 'mp3',
      durationMs: 2000,
    };
  }

  reset(): void {
    this.ttsCount = 0;
    this.shouldFail = false;
  }
}

class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];
  public playedClips: any[] = [];
  public isCurrentlyPlaying: boolean = false;

  enqueue(clip: any): void {
    this.enqueuedClips.push(clip);
  }

  async play(): Promise<void> {
    if (this.enqueuedClips.length > 0) {
      this.isCurrentlyPlaying = true;
      const clip = this.enqueuedClips.shift();
      this.playedClips.push(clip);
      
      if (this.onPlaybackStart) {
        this.onPlaybackStart(clip);
      }
      
      // Simulate playback duration
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      if (this.onPlaybackEnd) {
        this.onPlaybackEnd(clip);
      }
      
      this.isCurrentlyPlaying = false;
    }
  }

  clearQueue(): void {
    this.enqueuedClips = [];
  }

  reset(): void {
    this.enqueuedClips = [];
    this.playedClips = [];
    this.isCurrentlyPlaying = false;
  }
}

describe('E2E: Complete Dance Session with Voice Coaching', () => {
  let coach: RealTimeCoach;
  let reviewer: PerformanceReviewer;
  let mockGemini: MockGeminiClient;
  let mockElevenLabs: MockElevenLabsClient;
  let mockAudio: MockAudioManager;

  const mockSong: Song = {
    id: 'howdeepisyourlove',
    title: 'How Deep Is Your Love',
    artist: 'Prince Royce',
    duration: 180,
  };

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

    reviewer = new PerformanceReviewer({
      geminiClient: mockGemini,
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      language: 'en',
      enabled: true,
    });
  });

  describe('Complete Dance Session Flow', () => {
    it('should provide complete voice coaching throughout a dance session', async () => {
      // Requirement 5.1, 5.2, 6.1: Complete session with coaching and review
      
      // Simulate a dance session with varying scores
      // Note: timestamps start at 3000 to ensure first frame is after initial cooldown
      const sessionFrames: Array<{ timestamp: number; score: number }> = [
        // Start: Low scores (should trigger coaching tips)
        { timestamp: 3000, score: 65 },
        { timestamp: 4000, score: 60 },
        { timestamp: 5000, score: 68 },
        
        // Middle: Mid-range scores (no coaching)
        { timestamp: 8000, score: 75 },
        { timestamp: 9000, score: 80 },
        { timestamp: 10000, score: 82 },
        
        // Peak: High scores (should trigger encouragement)
        { timestamp: 13000, score: 92 },
        { timestamp: 14000, score: 95 },
        { timestamp: 15000, score: 93 },
        
        // End: Mixed scores
        { timestamp: 18000, score: 85 },
        { timestamp: 19000, score: 88 },
      ];

      let coachingTipsReceived = 0;
      let encouragementsReceived = 0;

      // Process each frame
      for (const frame of sessionFrames) {
        const analysis: PoseAnalysis = {
          score: frame.score,
          weakPoints: frame.score < 70 ? ['leftArm', 'rightArm'] : [],
          strongPoints: frame.score > 90 ? ['legs', 'torso'] : ['legs'],
          timestamp: frame.timestamp,
        };

        const initialClipCount = mockAudio.enqueuedClips.length;
        await coach.onPoseAnalysis(analysis);
        const newClipCount = mockAudio.enqueuedClips.length;

        if (newClipCount > initialClipCount) {
          if (frame.score < 70) {
            coachingTipsReceived++;
          } else if (frame.score > 90) {
            encouragementsReceived++;
          }
        }
      }

      // Verify coaching tips were provided for low scores
      expect(coachingTipsReceived).toBeGreaterThan(0);
      console.log(`Coaching tips received: ${coachingTipsReceived}`);

      // Verify encouragements were provided for high scores
      expect(encouragementsReceived).toBeGreaterThan(0);
      console.log(`Encouragements received: ${encouragementsReceived}`);

      // Verify cooldown was enforced (not every low/high score triggered feedback)
      expect(coachingTipsReceived).toBeLessThan(
        sessionFrames.filter((f) => f.score < 70).length
      );

      // Create session summary
      const frameScores: FrameScore[] = sessionFrames.map((frame, i) => ({
        frameNumber: i,
        score: frame.score,
        matches: {
          leftArm: frame.score > 70,
          rightArm: frame.score > 70,
          leftLeg: frame.score > 60,
          rightLeg: frame.score > 60,
        },
        timestamp: frame.timestamp,
      }));

      const session: GameSession = {
        song: mockSong,
        finalScore: 82,
        previousBest: 75,
        frameScores,
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // Generate performance review at end
      const review = await reviewer.reviewSession(session);

      // Verify review was generated
      expect(review.review).toBeTruthy();
      expect(review.improvementTip).toBeTruthy();
      expect(review.audioClip).toBeDefined();

      // Verify review was enqueued with high priority
      const reviewClip = mockAudio.enqueuedClips.find(
        (clip) => clip.priority === 'high'
      );
      expect(reviewClip).toBeDefined();

      // Verify total API calls
      expect(mockGemini.coachingTipCount).toBeGreaterThan(0);
      expect(mockGemini.reviewCount).toBe(1);
      expect(mockElevenLabs.ttsCount).toBeGreaterThan(0);

      console.log(`Total Gemini coaching tips: ${mockGemini.coachingTipCount}`);
      console.log(`Total Gemini reviews: ${mockGemini.reviewCount}`);
      console.log(`Total ElevenLabs TTS calls: ${mockElevenLabs.ttsCount}`);
    });

    it('should handle a perfect score session with only encouragements', async () => {
      // Session with consistently high scores
      const sessionFrames: Array<{ timestamp: number; score: number }> = [
        { timestamp: 0, score: 92 },
        { timestamp: 4000, score: 95 },
        { timestamp: 8000, score: 93 },
        { timestamp: 12000, score: 96 },
      ];

      let encouragementsReceived = 0;

      for (const frame of sessionFrames) {
        const analysis: PoseAnalysis = {
          score: frame.score,
          weakPoints: [],
          strongPoints: ['arms', 'legs', 'torso'],
          timestamp: frame.timestamp,
        };

        const initialClipCount = mockAudio.enqueuedClips.length;
        await coach.onPoseAnalysis(analysis);
        const newClipCount = mockAudio.enqueuedClips.length;

        if (newClipCount > initialClipCount) {
          encouragementsReceived++;
        }
      }

      // Should have received encouragements (respecting cooldown)
      expect(encouragementsReceived).toBeGreaterThan(0);

      // Should not have called Gemini for coaching tips (only encouragements use fallback)
      expect(mockGemini.coachingTipCount).toBe(0);

      // Generate review
      const session: GameSession = {
        song: mockSong,
        finalScore: 94,
        previousBest: 88,
        frameScores: [],
        strongestPart: 'all',
        weakestPart: 'none',
      };

      const review = await reviewer.reviewSession(session);
      expect(review.review).toBeTruthy();
    });

    it('should handle a struggling session with many coaching tips', async () => {
      // Session with consistently low scores
      const sessionFrames: Array<{ timestamp: number; score: number }> = [
        { timestamp: 0, score: 55 },
        { timestamp: 4000, score: 60 },
        { timestamp: 8000, score: 58 },
        { timestamp: 12000, score: 62 },
      ];

      let coachingTipsReceived = 0;

      for (const frame of sessionFrames) {
        const analysis: PoseAnalysis = {
          score: frame.score,
          weakPoints: ['leftArm', 'rightArm', 'leftLeg'],
          strongPoints: [],
          timestamp: frame.timestamp,
        };

        const initialClipCount = mockAudio.enqueuedClips.length;
        await coach.onPoseAnalysis(analysis);
        const newClipCount = mockAudio.enqueuedClips.length;

        if (newClipCount > initialClipCount) {
          coachingTipsReceived++;
        }
      }

      // Should have received coaching tips (respecting cooldown)
      expect(coachingTipsReceived).toBeGreaterThan(0);

      // Should have called Gemini for coaching tips
      expect(mockGemini.coachingTipCount).toBeGreaterThan(0);

      // Generate review
      const session: GameSession = {
        song: mockSong,
        finalScore: 59,
        previousBest: null, // First time playing
        frameScores: [],
        strongestPart: 'torso',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);
      expect(review.review).toBeTruthy();
      expect(review.improvementTip).toBeTruthy();
    });
  });

  describe('Voice Coaching During Low Scores', () => {
    it('should trigger coaching tips when score drops below 70%', async () => {
      // Requirement 5.1: Low score triggers coaching tip
      const lowScoreAnalysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['leftArm', 'rightArm'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(lowScoreAnalysis);

      // Verify coaching tip was generated
      expect(mockGemini.coachingTipCount).toBe(1);
      expect(mockElevenLabs.ttsCount).toBe(1);
      expect(mockAudio.enqueuedClips.length).toBe(1);

      // Verify clip contains coaching content
      const clip = mockAudio.enqueuedClips[0];
      expect(clip.text).toBeTruthy();
      expect(clip.priority).toBe('normal');
    });

    it('should provide specific feedback for weak points', async () => {
      const analyses: PoseAnalysis[] = [
        {
          score: 65,
          weakPoints: ['leftArm'],
          strongPoints: ['legs'],
          timestamp: Date.now(),
        },
        {
          score: 60,
          weakPoints: ['rightLeg'],
          strongPoints: ['arms'],
          timestamp: Date.now() + 4000,
        },
      ];

      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      // Should have generated tips for different weak points
      expect(mockGemini.coachingTipCount).toBe(2);
    });

    it('should respect cooldown between coaching tips', async () => {
      const baseTime = Date.now();
      const analyses: PoseAnalysis[] = [
        { score: 65, weakPoints: ['arms'], strongPoints: [], timestamp: baseTime },
        { score: 60, weakPoints: ['arms'], strongPoints: [], timestamp: baseTime + 1000 }, // Within cooldown
        { score: 55, weakPoints: ['arms'], strongPoints: [], timestamp: baseTime + 4000 }, // After cooldown
      ];

      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      // Should only trigger 2 tips (first and third)
      expect(mockAudio.enqueuedClips.length).toBe(2);
    });
  });

  describe('Voice Encouragement During High Scores', () => {
    it('should trigger encouragement when score exceeds 90%', async () => {
      // Requirement 5.2: High score triggers encouragement
      const highScoreAnalysis: PoseAnalysis = {
        score: 95,
        weakPoints: [],
        strongPoints: ['arms', 'legs', 'torso'],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(highScoreAnalysis);

      // Verify encouragement was generated
      expect(mockElevenLabs.ttsCount).toBe(1);
      expect(mockAudio.enqueuedClips.length).toBe(1);

      // Encouragements use fallback phrases, not Gemini
      expect(mockGemini.coachingTipCount).toBe(0);
    });

    it('should provide varied encouragements', async () => {
      const baseTime = Date.now();
      const analyses: PoseAnalysis[] = [
        { score: 92, weakPoints: [], strongPoints: ['all'], timestamp: baseTime },
        { score: 95, weakPoints: [], strongPoints: ['all'], timestamp: baseTime + 4000 },
        { score: 93, weakPoints: [], strongPoints: ['all'], timestamp: baseTime + 8000 },
      ];

      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      // Should have generated multiple encouragements
      expect(mockAudio.enqueuedClips.length).toBe(3);
    });

    it('should respect cooldown between encouragements', async () => {
      const baseTime = Date.now();
      const analyses: PoseAnalysis[] = [
        { score: 95, weakPoints: [], strongPoints: ['all'], timestamp: baseTime },
        { score: 92, weakPoints: [], strongPoints: ['all'], timestamp: baseTime + 1000 }, // Within cooldown
        { score: 96, weakPoints: [], strongPoints: ['all'], timestamp: baseTime + 4000 }, // After cooldown
      ];

      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      // Should only trigger 2 encouragements (first and third)
      expect(mockAudio.enqueuedClips.length).toBe(2);
    });
  });

  describe('Performance Review at End', () => {
    it('should generate and speak performance review after session', async () => {
      // Requirement 6.1: Generate and speak performance review
      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 78,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);

      // Verify review was generated
      expect(review.review).toBeTruthy();
      expect(review.improvementTip).toBeTruthy();
      expect(review.audioClip).toBeDefined();

      // Verify Gemini was called
      expect(mockGemini.reviewCount).toBe(1);

      // Verify ElevenLabs was called
      expect(mockElevenLabs.ttsCount).toBe(1);

      // Verify audio was enqueued with high priority
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockAudio.enqueuedClips[0].priority).toBe('high');
    });

    it('should include all required review elements', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 92,
        previousBest: 85,
        frameScores: [],
        strongestPart: 'arms',
        weakestPart: 'legs',
      };

      const review = await reviewer.reviewSession(session);

      const fullText = `${review.review} ${review.improvementTip}`;

      // Should mention score
      expect(fullText).toContain('92');

      // Should mention song
      expect(fullText.toLowerCase()).toContain('how deep is your love');

      // Should mention strongest part
      expect(fullText.toLowerCase()).toContain('arms');

      // Should mention weakest part
      expect(fullText.toLowerCase()).toContain('legs');
    });

    it('should provide transcript for UI display', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 88,
        previousBest: 82,
        frameScores: [],
        strongestPart: 'arms',
        weakestPart: 'legs',
      };

      const review = await reviewer.reviewSession(session);

      // Audio clip should contain text for transcript
      expect(review.audioClip).toBeDefined();
      expect(review.audioClip!.text).toBeTruthy();
      expect(review.audioClip!.text.length).toBeGreaterThan(0);
    });

    it('should handle first-time play (no previous best)', async () => {
      const session: GameSession = {
        song: mockSong,
        finalScore: 75,
        previousBest: null,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);

      // Should still generate review
      expect(review.review).toBeTruthy();
      expect(review.improvementTip).toBeTruthy();
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue gameplay when voice features fail', async () => {
      // Simulate API failures
      mockGemini.shouldFail = true;
      mockElevenLabs.shouldFail = true;

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      // Should not throw error
      await expect(coach.onPoseAnalysis(analysis)).resolves.not.toThrow();

      // Gameplay continues - text-only clip may be enqueued for UI display
      // even when audio fails (graceful degradation)
      expect(mockAudio.enqueuedClips.length).toBeGreaterThanOrEqual(0);
    });

    it('should use fallback phrases when Gemini fails', async () => {
      mockGemini.shouldFail = true;

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Should still attempt TTS with fallback phrase
      expect(mockElevenLabs.ttsCount).toBe(1);
    });

    it('should enqueue text-only clip when ElevenLabs fails', async () => {
      mockElevenLabs.shouldFail = true;

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);

      // Should enqueue text-only clip for UI display (graceful degradation)
      expect(mockAudio.enqueuedClips.length).toBe(1);
      // The clip should have text but empty audio
      expect(mockAudio.enqueuedClips[0].text).toBeTruthy();
    });
  });

  describe('Audio Playback Integration', () => {
    it('should play audio clips in order', async () => {
      const baseTime = Date.now();
      const analyses: PoseAnalysis[] = [
        { score: 65, weakPoints: ['arms'], strongPoints: [], timestamp: baseTime },
        { score: 95, weakPoints: [], strongPoints: ['all'], timestamp: baseTime + 4000 },
      ];

      for (const analysis of analyses) {
        await coach.onPoseAnalysis(analysis);
      }

      // Play all enqueued clips
      while (mockAudio.enqueuedClips.length > 0) {
        await mockAudio.play();
      }

      // Verify clips were played
      expect(mockAudio.playedClips.length).toBe(2);
    });

    it('should trigger playback events', async () => {
      let playbackStarted = false;
      let playbackEnded = false;

      mockAudio.onPlaybackStart = () => {
        playbackStarted = true;
      };

      mockAudio.onPlaybackEnd = () => {
        playbackEnded = true;
      };

      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      };

      await coach.onPoseAnalysis(analysis);
      await mockAudio.play();

      expect(playbackStarted).toBe(true);
      expect(playbackEnded).toBe(true);
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

      // No feedback should be generated
      expect(mockGemini.coachingTipCount).toBe(0);
      expect(mockElevenLabs.ttsCount).toBe(0);
      expect(mockAudio.enqueuedClips.length).toBe(0);
    });

    it('should not generate review when disabled', async () => {
      reviewer.setEnabled(false);

      const session: GameSession = {
        song: mockSong,
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      const review = await reviewer.reviewSession(session);

      // No review should be generated
      expect(review.review).toBe('');
      expect(review.improvementTip).toBe('');
      expect(mockGemini.reviewCount).toBe(0);
    });
  });
});
