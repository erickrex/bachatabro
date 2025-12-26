/**
 * Property-based tests for RealTimeCoach
 * Feature: elevenlabs-voice-coach
 */

import * as fc from 'fast-check';
import { RealTimeCoach, RealTimeCoachConfig } from '../RealTimeCoach';
import { GeminiClient } from '../GeminiClient';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';
import type { PoseAnalysis } from '../../../types/voiceCoach';

// Mock dependencies
jest.mock('../GeminiClient');
jest.mock('../ElevenLabsClient');
jest.mock('../AudioManager');

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(() =>
        Promise.resolve({
          sound: {
            setOnPlaybackStatusUpdate: jest.fn(),
            unloadAsync: jest.fn(() => Promise.resolve()),
            stopAsync: jest.fn(() => Promise.resolve()),
          },
        })
      ),
    },
  },
}));

describe('RealTimeCoach Property Tests', () => {
  let mockGeminiClient: jest.Mocked<GeminiClient>;
  let mockElevenLabsClient: jest.Mocked<ElevenLabsClient>;
  let mockAudioManager: jest.Mocked<AudioManager>;
  let config: RealTimeCoachConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockGeminiClient = new GeminiClient() as jest.Mocked<GeminiClient>;
    mockElevenLabsClient = new ElevenLabsClient() as jest.Mocked<ElevenLabsClient>;
    mockAudioManager = new AudioManager() as jest.Mocked<AudioManager>;

    // Setup mock implementations
    mockGeminiClient.generateCoachingTip = jest.fn().mockResolvedValue({
      tip: 'Keep your arms up!',
      targetBodyPart: 'arms',
    });

    mockElevenLabsClient.textToSpeech = jest.fn().mockResolvedValue({
      audio: 'dGVzdA==', // base64 "test"
      format: 'mp3',
      durationMs: 1000,
    });

    mockAudioManager.enqueue = jest.fn();

    config = {
      geminiClient: mockGeminiClient,
      elevenLabsClient: mockElevenLabsClient,
      audioManager: mockAudioManager,
      language: 'en',
      cooldownMs: 3000,
      enabled: true,
    };
  });

  // Increase timeout for property-based tests
  jest.setTimeout(15000);

  // Feature: elevenlabs-voice-coach, Property 6: Score-Based Feedback Triggering
  describe('Property 6: Score-Based Feedback Triggering', () => {
    /**
     * Validates: Requirements 5.1, 5.2
     *
     * For any pose analysis score, the Voice Coach should trigger the appropriate
     * feedback type: coaching tip if score < 70%, encouragement if score > 90%,
     * no feedback otherwise (subject to cooldown).
     */

    it('should trigger coaching tip for scores below 70%', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 69 }), // Scores below 70%
          fc.array(fc.string(), { minLength: 1, maxLength: 3 }), // Weak points
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }), // Strong points
          async (score, weakPoints, strongPoints) => {
            const coach = new RealTimeCoach(config);
            coach.resetCooldown(); // Ensure cooldown doesn't interfere

            const analysis: PoseAnalysis = {
              score,
              weakPoints,
              strongPoints,
              timestamp: Date.now(),
            };

            // Should provide feedback for low scores
            const shouldProvide = coach.shouldProvideFeedback(analysis);
            expect(shouldProvide).toBe(true);

            // Feedback type should be coaching_tip
            const feedbackType = coach.getFeedbackType(analysis);
            expect(feedbackType).toBe('coaching_tip');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger encouragement for scores above 90%', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 91, max: 100 }), // Scores above 90%
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }), // Weak points
          fc.array(fc.string(), { minLength: 1, maxLength: 3 }), // Strong points
          async (score, weakPoints, strongPoints) => {
            const coach = new RealTimeCoach(config);
            coach.resetCooldown(); // Ensure cooldown doesn't interfere

            const analysis: PoseAnalysis = {
              score,
              weakPoints,
              strongPoints,
              timestamp: Date.now(),
            };

            // Should provide feedback for high scores
            const shouldProvide = coach.shouldProvideFeedback(analysis);
            expect(shouldProvide).toBe(true);

            // Feedback type should be encouragement
            const feedbackType = coach.getFeedbackType(analysis);
            expect(feedbackType).toBe('encouragement');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger feedback for scores between 70% and 90%', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 70, max: 90 }), // Scores in normal range
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }), // Weak points
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }), // Strong points
          async (score, weakPoints, strongPoints) => {
            const coach = new RealTimeCoach(config);
            coach.resetCooldown(); // Ensure cooldown doesn't interfere

            const analysis: PoseAnalysis = {
              score,
              weakPoints,
              strongPoints,
              timestamp: Date.now(),
            };

            // Should NOT provide feedback for normal scores
            const shouldProvide = coach.shouldProvideFeedback(analysis);
            expect(shouldProvide).toBe(false);

            // Feedback type should be none
            const feedbackType = coach.getFeedbackType(analysis);
            expect(feedbackType).toBe('none');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly classify all possible scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }),
          async (score) => {
            const coach = new RealTimeCoach(config);

            const analysis: PoseAnalysis = {
              score,
              weakPoints: ['arms'],
              strongPoints: ['legs'],
              timestamp: Date.now(),
            };

            const feedbackType = coach.getFeedbackType(analysis);

            // Verify correct classification
            if (score < 70) {
              expect(feedbackType).toBe('coaching_tip');
            } else if (score > 90) {
              expect(feedbackType).toBe('encouragement');
            } else {
              expect(feedbackType).toBe('none');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary scores correctly', async () => {
      const coach = new RealTimeCoach(config);

      // Test boundary at 70%
      const analysis70: PoseAnalysis = {
        score: 70,
        weakPoints: ['arms'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };
      expect(coach.getFeedbackType(analysis70)).toBe('none');

      // Test boundary at 90%
      const analysis90: PoseAnalysis = {
        score: 90,
        weakPoints: ['arms'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };
      expect(coach.getFeedbackType(analysis90)).toBe('none');

      // Test just below 70%
      const analysis69: PoseAnalysis = {
        score: 69,
        weakPoints: ['arms'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };
      expect(coach.getFeedbackType(analysis69)).toBe('coaching_tip');

      // Test just above 90%
      const analysis91: PoseAnalysis = {
        score: 91,
        weakPoints: ['arms'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };
      expect(coach.getFeedbackType(analysis91)).toBe('encouragement');
    });
  });
});
