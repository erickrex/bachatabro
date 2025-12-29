/**
 * Property-based tests for RealTimeCoach cooldown enforcement
 * Feature: elevenlabs-voice-coach
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
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

describe('RealTimeCoach Cooldown Property Tests', () => {
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

  // Feature: elevenlabs-voice-coach, Property 7: Feedback Cooldown Enforcement
  describe('Property 7: Feedback Cooldown Enforcement', () => {
    /**
     * Validates: Requirements 5.3
     *
     * For any sequence of feedback triggers, if the time between consecutive
     * triggers is less than the cooldown period (default 3 seconds), the second
     * trigger should be suppressed.
     */

    it('should enforce cooldown between consecutive feedback attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1000, max: 5000 }), // Cooldown period
          async (timeDeltas, cooldownMs) => {
            const coach = new RealTimeCoach({
              ...config,
              cooldownMs,
            });

            let currentTime = 0;
            const feedbackAttempts: { time: number; allowed: boolean }[] = [];

            for (const delta of timeDeltas) {
              currentTime += delta;

              const analysis: PoseAnalysis = {
                score: 50, // Low score to trigger feedback
                weakPoints: ['arms'],
                strongPoints: [],
                timestamp: currentTime,
              };

              const shouldProvide = coach.shouldProvideFeedback(analysis);
              feedbackAttempts.push({ time: currentTime, allowed: shouldProvide });

              // If feedback was provided, simulate it by calling onPoseAnalysis
              if (shouldProvide) {
                await coach.onPoseAnalysis(analysis);
              }
            }

            // Verify cooldown enforcement
            for (let i = 1; i < feedbackAttempts.length; i++) {
              const prev = feedbackAttempts[i - 1];
              const curr = feedbackAttempts[i];

              if (prev.allowed) {
                const timeSinceLast = curr.time - prev.time;
                if (timeSinceLast < cooldownMs) {
                  // Should be suppressed due to cooldown
                  expect(curr.allowed).toBe(false);
                }
              }
            }
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should allow feedback after cooldown period has elapsed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 5000 }), // Cooldown period
          fc.integer({ min: 0, max: 2000 }), // Extra time beyond cooldown
          async (cooldownMs, extraTime) => {
            const coach = new RealTimeCoach({
              ...config,
              cooldownMs,
            });

            // Base time must be >= cooldown to ensure first feedback passes
            // (since lastFeedbackTime starts at 0)
            const baseTime = cooldownMs;

            // First feedback attempt
            const analysis1: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime,
            };

            const shouldProvide1 = coach.shouldProvideFeedback(analysis1);
            expect(shouldProvide1).toBe(true);

            // Simulate providing feedback
            await coach.onPoseAnalysis(analysis1);

            // Second attempt after cooldown + extra time
            const analysis2: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime + cooldownMs + extraTime,
            };

            const shouldProvide2 = coach.shouldProvideFeedback(analysis2);
            expect(shouldProvide2).toBe(true);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should suppress feedback during cooldown period', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 5000 }), // Cooldown period
          fc.integer({ min: 1, max: 999 }), // Time less than cooldown
          async (cooldownMs, timeLessThanCooldown) => {
            const coach = new RealTimeCoach({
              ...config,
              cooldownMs,
            });

            // Base time must be >= cooldown to ensure first feedback passes
            const baseTime = cooldownMs;

            // First feedback attempt
            const analysis1: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime,
            };

            const shouldProvide1 = coach.shouldProvideFeedback(analysis1);
            expect(shouldProvide1).toBe(true);

            // Simulate providing feedback
            await coach.onPoseAnalysis(analysis1);

            // Second attempt before cooldown expires
            const analysis2: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime + timeLessThanCooldown,
            };

            const shouldProvide2 = coach.shouldProvideFeedback(analysis2);
            expect(shouldProvide2).toBe(false);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should handle multiple consecutive attempts within cooldown', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2000, max: 5000 }), // Cooldown period
          fc.array(fc.integer({ min: 10, max: 500 }), { minLength: 3, maxLength: 10 }),
          async (cooldownMs, timeDeltas) => {
            const coach = new RealTimeCoach({
              ...config,
              cooldownMs,
            });

            // Start at cooldown time to ensure first feedback passes
            let currentTime = cooldownMs;
            let feedbackCount = 0;
            const firstFeedbackTime = currentTime;

            // First feedback should be allowed
            const analysis1: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: currentTime,
            };

            if (coach.shouldProvideFeedback(analysis1)) {
              await coach.onPoseAnalysis(analysis1);
              feedbackCount++;
            }

            // All subsequent attempts within cooldown should be suppressed
            for (const delta of timeDeltas) {
              currentTime += delta;

              const analysis: PoseAnalysis = {
                score: 50,
                weakPoints: ['arms'],
                strongPoints: [],
                timestamp: currentTime,
              };

              const shouldProvide = coach.shouldProvideFeedback(analysis);

              // Since all deltas are small (< cooldown), all should be suppressed
              if (currentTime - firstFeedbackTime < cooldownMs) {
                expect(shouldProvide).toBe(false);
              }
            }

            // Only the first feedback should have been provided
            expect(feedbackCount).toBe(1);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should respect different cooldown periods', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(1500, 3000, 6000), // Different cooldown periods (high, normal, low frequency)
          async (cooldownMs) => {
            const coach = new RealTimeCoach({
              ...config,
              cooldownMs,
            });

            // Base time must be >= cooldown to ensure first feedback passes
            const baseTime = cooldownMs;

            // First feedback
            const analysis1: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime,
            };

            expect(coach.shouldProvideFeedback(analysis1)).toBe(true);
            await coach.onPoseAnalysis(analysis1);

            // Attempt just before cooldown expires
            const analysis2: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime + cooldownMs - 1,
            };

            expect(coach.shouldProvideFeedback(analysis2)).toBe(false);

            // Attempt exactly at cooldown expiry
            const analysis3: PoseAnalysis = {
              score: 50,
              weakPoints: ['arms'],
              strongPoints: [],
              timestamp: baseTime + cooldownMs,
            };

            expect(coach.shouldProvideFeedback(analysis3)).toBe(true);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should reset cooldown correctly', async () => {
      const coach = new RealTimeCoach(config);

      // Base time must be >= cooldown (3000ms default) to ensure first feedback passes
      const baseTime = 3000;

      // First feedback
      const analysis1: PoseAnalysis = {
        score: 50,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime,
      };

      await coach.onPoseAnalysis(analysis1);

      // Attempt during cooldown - should be suppressed
      const analysis2: PoseAnalysis = {
        score: 50,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime + 1000,
      };

      expect(coach.shouldProvideFeedback(analysis2)).toBe(false);

      // Reset cooldown
      coach.resetCooldown();

      // Now feedback should be allowed immediately
      expect(coach.shouldProvideFeedback(analysis2)).toBe(true);
    });
  });
});
