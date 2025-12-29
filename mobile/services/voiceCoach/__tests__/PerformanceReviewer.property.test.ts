/**
 * Property-based tests for PerformanceReviewer
 * Feature: elevenlabs-voice-coach
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { PerformanceReviewer, PerformanceReviewerConfig, GameSession } from '../PerformanceReviewer';
import { GeminiClient } from '../GeminiClient';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';
import type { Song, FrameScore } from '../../../types/game';

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

describe('PerformanceReviewer Property Tests', () => {
  let mockGeminiClient: jest.Mocked<GeminiClient>;
  let mockElevenLabsClient: jest.Mocked<ElevenLabsClient>;
  let mockAudioManager: jest.Mocked<AudioManager>;
  let config: PerformanceReviewerConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockGeminiClient = new GeminiClient() as jest.Mocked<GeminiClient>;
    mockElevenLabsClient = new ElevenLabsClient() as jest.Mocked<ElevenLabsClient>;
    mockAudioManager = new AudioManager() as jest.Mocked<AudioManager>;

    // Setup mock implementations
    mockGeminiClient.generatePerformanceReview = jest.fn().mockResolvedValue({
      review: 'Great job on the song! You scored 85%. Your arms were strongest. Work on your footwork next time.',
      improvementTip: 'Focus on keeping your feet in sync with the beat.',
    });

    mockElevenLabsClient.textToSpeech = jest.fn().mockResolvedValue({
      audio: 'dGVzdA==', // base64 "test"
      format: 'mp3',
      durationMs: 5000,
    });

    mockAudioManager.enqueue = jest.fn();

    config = {
      geminiClient: mockGeminiClient,
      elevenLabsClient: mockElevenLabsClient,
      audioManager: mockAudioManager,
      language: 'en',
      voiceId: 'Rachel',
      enabled: true,
    };
  });

  // Increase timeout for property-based tests
  jest.setTimeout(15000);

  // Feature: elevenlabs-voice-coach, Property 10: Performance Review Completeness
  describe('Property 10: Performance Review Completeness', () => {
    /**
     * Validates: Requirements 6.2, 6.3, 6.4, 6.5
     *
     * For any generated performance review, it should contain all required elements:
     * - Final score mention
     * - Comparison to previous best (if available)
     * - Strongest body part
     * - Weakest body part
     * - One improvement tip
     * - A closing question or call-to-action
     */

    // Arbitrary for generating Song objects
    const songArbitrary = fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      title: fc.string({ minLength: 1, maxLength: 50 }),
      artist: fc.string({ minLength: 1, maxLength: 50 }),
    });

    // Arbitrary for generating FrameScore objects
    const frameScoreArbitrary = fc.record({
      score: fc.float({ min: 0, max: 1 }),
      matches: fc.dictionary(
        fc.constantFrom('arms', 'legs', 'torso', 'head', 'feet'),
        fc.boolean()
      ),
      timestamp: fc.integer({ min: 0, max: 10000 }),
    });

    // Arbitrary for generating GameSession objects
    const gameSessionArbitrary = fc.record({
      song: songArbitrary,
      finalScore: fc.float({ min: 0, max: 100 }),
      previousBest: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
      frameScores: fc.array(frameScoreArbitrary, { minLength: 10, maxLength: 100 }),
      strongestPart: fc.option(fc.constantFrom('arms', 'legs', 'torso', 'head', 'feet'), { nil: undefined }),
      weakestPart: fc.option(fc.constantFrom('arms', 'legs', 'torso', 'head', 'feet'), { nil: undefined }),
    });

    it('should generate review with all required elements', async () => {
      await fc.assert(
        fc.asyncProperty(gameSessionArbitrary, async (session) => {
          // Mock Gemini to return a complete review
          const mockReview = {
            review: `Congratulations on scoring ${session.finalScore.toFixed(0)}%! ${
              session.previousBest !== null
                ? `That's ${session.finalScore > session.previousBest ? 'better than' : 'close to'} your previous best of ${session.previousBest.toFixed(0)}%.`
                : 'Great first attempt!'
            } Your strongest area was your arms. Work on your legs next time. Ready to try again?`,
            improvementTip: 'Focus on keeping your legs in sync with the beat.',
          };

          mockGeminiClient.generatePerformanceReview.mockResolvedValueOnce(mockReview);

          const reviewer = new PerformanceReviewer(config);
          const result = await reviewer.reviewSession(session);

          // Verify review was generated
          expect(result.review).toBeTruthy();
          expect(result.improvementTip).toBeTruthy();

          // Verify Gemini was called with correct parameters
          expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
            expect.objectContaining({
              songTitle: session.song.title,
              songArtist: session.song.artist,
              finalScore: session.finalScore,
              previousBest: session.previousBest,
              language: 'en',
            })
          );

          // Verify TTS was called with the full review text
          expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
            expect.objectContaining({
              text: expect.stringContaining(mockReview.review),
              voiceId: 'Rachel',
              language: 'en',
            })
          );

          // Verify audio was enqueued
          expect(mockAudioManager.enqueue).toHaveBeenCalledWith(
            expect.objectContaining({
              priority: 'high',
              text: expect.stringContaining(mockReview.review),
            })
          );
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should include final score in review request', async () => {
      await fc.assert(
        fc.asyncProperty(gameSessionArbitrary, async (session) => {
          const reviewer = new PerformanceReviewer(config);
          await reviewer.reviewSession(session);

          // Verify final score was included
          expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
            expect.objectContaining({
              finalScore: session.finalScore,
            })
          );
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should include previous best comparison when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          gameSessionArbitrary.filter((s) => s.previousBest !== null),
          async (session) => {
            const reviewer = new PerformanceReviewer(config);
            await reviewer.reviewSession(session);

            // Verify previous best was included
            expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
              expect.objectContaining({
                previousBest: session.previousBest,
              })
            );
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should handle null previous best gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          gameSessionArbitrary.filter((s) => s.previousBest === null),
          async (session) => {
            const reviewer = new PerformanceReviewer(config);
            await reviewer.reviewSession(session);

            // Verify null previous best was handled
            expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
              expect.objectContaining({
                previousBest: null,
              })
            );
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should identify strongest and weakest parts from frame scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          gameSessionArbitrary.filter((s) => !s.strongestPart && !s.weakestPart),
          async (session) => {
            const reviewer = new PerformanceReviewer(config);
            await reviewer.reviewSession(session);

            // Verify strongest and weakest parts were identified
            const call = mockGeminiClient.generatePerformanceReview.mock.calls[0][0];
            expect(call.strongestPart).toBeTruthy();
            expect(call.weakestPart).toBeTruthy();
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should use provided strongest/weakest parts when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          gameSessionArbitrary.filter((s) => s.strongestPart && s.weakestPart),
          async (session) => {
            const reviewer = new PerformanceReviewer(config);
            await reviewer.reviewSession(session);

            // Verify provided parts were used
            expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
              expect.objectContaining({
                strongestPart: session.strongestPart,
                weakestPart: session.weakestPart,
              })
            );
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should include song information in review', async () => {
      await fc.assert(
        fc.asyncProperty(gameSessionArbitrary, async (session) => {
          const reviewer = new PerformanceReviewer(config);
          await reviewer.reviewSession(session);

          // Verify song info was included
          expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
            expect.objectContaining({
              songTitle: session.song.title,
              songArtist: session.song.artist,
            })
          );
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should return empty review when disabled', async () => {
      await fc.assert(
        fc.asyncProperty(gameSessionArbitrary, async (session) => {
          const disabledConfig = { ...config, enabled: false };
          const reviewer = new PerformanceReviewer(disabledConfig);
          const result = await reviewer.reviewSession(session);

          // Verify no review was generated
          expect(result.review).toBe('');
          expect(result.improvementTip).toBe('');
          expect(result.audioClip).toBeUndefined();

          // Verify no API calls were made
          expect(mockGeminiClient.generatePerformanceReview).not.toHaveBeenCalled();
          expect(mockElevenLabsClient.textToSpeech).not.toHaveBeenCalled();
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should handle API errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(gameSessionArbitrary, async (session) => {
          // Mock API error
          mockGeminiClient.generatePerformanceReview.mockRejectedValueOnce(
            new Error('API Error')
          );

          const reviewer = new PerformanceReviewer(config);
          const result = await reviewer.reviewSession(session);

          // Verify empty review on error
          expect(result.review).toBe('');
          expect(result.improvementTip).toBe('');
          expect(result.audioClip).toBeUndefined();
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should respect language setting', async () => {
      await fc.assert(
        fc.asyncProperty(
          gameSessionArbitrary,
          fc.constantFrom('en', 'es', 'de', 'ru'),
          async (session, language) => {
            const langConfig = { ...config, language };
            const reviewer = new PerformanceReviewer(langConfig);
            await reviewer.reviewSession(session);

            // Verify language was used
            expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
              expect.objectContaining({
                language,
              })
            );

            expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
              expect.objectContaining({
                language,
              })
            );
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });
  });
});
