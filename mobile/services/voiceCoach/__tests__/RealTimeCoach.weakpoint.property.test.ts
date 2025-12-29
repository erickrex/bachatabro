/**
 * Property-based tests for RealTimeCoach weak point prioritization
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

describe('RealTimeCoach Weak Point Property Tests', () => {
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

  // Feature: elevenlabs-voice-coach, Property 9: Weak Point Prioritization
  describe('Property 9: Weak Point Prioritization', () => {
    /**
     * Validates: Requirements 5.6
     *
     * For any pose analysis with multiple weak points, the generated coaching tip
     * should address the weakest body part (lowest score).
     */

    it('should return the first weak point as the weakest', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          async (weakPoints) => {
            const coach = new RealTimeCoach(config);

            const analysis: PoseAnalysis = {
              score: 50,
              weakPoints,
              strongPoints: [],
              timestamp: Date.now(),
            };

            const weakestPart = coach.getWeakestBodyPart(analysis);

            // The weakest body part should be the first in the weak points array
            expect(weakestPart).toBe(weakPoints[0]);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should return "overall" when no weak points are provided', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const coach = new RealTimeCoach(config);

          const analysis: PoseAnalysis = {
            score: 50,
            weakPoints: [],
            strongPoints: ['legs', 'arms'],
            timestamp: Date.now(),
          };

          const weakestPart = coach.getWeakestBodyPart(analysis);

          // Should return "overall" when no weak points
          expect(weakestPart).toBe('overall');
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should handle single weak point correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          async (weakPoint) => {
            const coach = new RealTimeCoach(config);

            const analysis: PoseAnalysis = {
              score: 50,
              weakPoints: [weakPoint],
              strongPoints: [],
              timestamp: Date.now(),
            };

            const weakestPart = coach.getWeakestBodyPart(analysis);

            // Should return the single weak point
            expect(weakestPart).toBe(weakPoint);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should prioritize first weak point regardless of array length', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }),
          async (weakPoints) => {
            const coach = new RealTimeCoach(config);

            const analysis: PoseAnalysis = {
              score: 50,
              weakPoints,
              strongPoints: [],
              timestamp: Date.now(),
            };

            const weakestPart = coach.getWeakestBodyPart(analysis);

            // Should always return the first weak point
            expect(weakestPart).toBe(weakPoints[0]);

            // Should not return any other weak point
            if (weakPoints.length > 1) {
              for (let i = 1; i < weakPoints.length; i++) {
                if (weakPoints[i] !== weakPoints[0]) {
                  expect(weakestPart).not.toBe(weakPoints[i]);
                }
              }
            }
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should pass weakest body part to Gemini when generating tips', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
          async (weakPoints, strongPoints) => {
            const coach = new RealTimeCoach(config);
            coach.resetCooldown(); // Ensure cooldown doesn't interfere

            const analysis: PoseAnalysis = {
              score: 50, // Low score to trigger coaching tip
              weakPoints,
              strongPoints,
              timestamp: Date.now(),
            };

            // Trigger feedback generation
            await coach.onPoseAnalysis(analysis);

            // Verify Gemini was called with the weak points
            expect(mockGeminiClient.generateCoachingTip).toHaveBeenCalledWith(
              expect.objectContaining({
                weakPoints,
                strongPoints,
                score: 50,
              })
            );
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should handle body part names with special characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }),
            { minLength: 1, maxLength: 5 }
          ),
          async (weakPoints) => {
            const coach = new RealTimeCoach(config);

            const analysis: PoseAnalysis = {
              score: 50,
              weakPoints,
              strongPoints: [],
              timestamp: Date.now(),
            };

            const weakestPart = coach.getWeakestBodyPart(analysis);

            // Should handle any string as a body part name
            expect(typeof weakestPart).toBe('string');
            expect(weakestPart.length).toBeGreaterThan(0);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should consistently return the same weak point for the same analysis', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          async (weakPoints) => {
            const coach = new RealTimeCoach(config);

            const analysis: PoseAnalysis = {
              score: 50,
              weakPoints,
              strongPoints: [],
              timestamp: Date.now(),
            };

            // Call multiple times with same analysis
            const result1 = coach.getWeakestBodyPart(analysis);
            const result2 = coach.getWeakestBodyPart(analysis);
            const result3 = coach.getWeakestBodyPart(analysis);

            // Should return the same result every time
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });
  });
});
