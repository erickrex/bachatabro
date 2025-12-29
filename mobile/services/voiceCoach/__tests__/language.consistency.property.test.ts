/**
 * Property-Based Tests for Language Consistency
 *
 * Feature: elevenlabs-voice-coach, Property 12: Language Consistency
 * Validates: Requirements 7.4, 9.2, 9.3, 9.4
 *
 * Tests that all voice interactions (TTS output, STT input processing,
 * Gemini responses, voice selection) use the selected language consistently.
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { RealTimeCoach } from '../RealTimeCoach';
import { PerformanceReviewer } from '../PerformanceReviewer';
import { ConversationAgent } from '../ConversationAgent';
import { VoiceNavigation } from '../VoiceNavigation';
import { GeminiClient } from '../GeminiClient';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';
import type { SupportedLanguage, PoseAnalysis } from '../../../types/voiceCoach';
import type { GameSession } from '../PerformanceReviewer';
import { getLanguageAppropriateVoice, VOICE_CONFIG } from '../../../config/voiceConfig';

// Mock implementations
jest.mock('../GeminiClient');
jest.mock('../ElevenLabsClient');

describe('Language Consistency Properties', () => {
  let mockGeminiClient: jest.Mocked<GeminiClient>;
  let mockElevenLabsClient: jest.Mocked<ElevenLabsClient>;
  let mockAudioManager: AudioManager;
  let mockRouter: { push: jest.Mock };

  beforeEach(() => {
    // Create mock clients
    mockGeminiClient = new GeminiClient() as jest.Mocked<GeminiClient>;
    mockElevenLabsClient = new ElevenLabsClient() as jest.Mocked<ElevenLabsClient>;
    mockAudioManager = new AudioManager();
    mockRouter = { push: jest.fn() };

    // Mock Gemini responses
    mockGeminiClient.generateCoachingTip = jest.fn().mockResolvedValue({
      tip: 'Test tip',
      targetBodyPart: 'arms',
    });

    mockGeminiClient.generatePerformanceReview = jest.fn().mockResolvedValue({
      review: 'Test review',
      improvementTip: 'Test improvement',
    });

    // Mock ElevenLabs responses
    mockElevenLabsClient.textToSpeech = jest.fn().mockResolvedValue({
      audio: 'base64audio',
      format: 'mp3' as const,
      durationMs: 1000,
    });

    mockElevenLabsClient.speechToText = jest.fn().mockResolvedValue({
      transcript: 'test transcript',
      confidence: 0.95,
      language: 'en',
    });

    // Spy on audio manager
    jest.spyOn(mockAudioManager, 'enqueue');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 12: Language Consistency
   *
   * For any language setting, all voice interactions should use
   * the selected language consistently across:
   * - TTS output
   * - STT input processing
   * - Gemini responses
   * - Voice selection
   */
  describe('Property 12: Language Consistency', () => {
    // Arbitrary for supported languages
    const supportedLanguageArb = fc.constantFrom<SupportedLanguage>('en', 'es', 'de', 'ru');

    it('RealTimeCoach should use consistent language for all operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLanguageArb,
          fc.integer({ min: 0, max: 100 }),
          fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
          async (language, score, weakPoints, strongPoints) => {
            // Clear mocks at start of each iteration
            mockGeminiClient.generateCoachingTip.mockClear();
            mockElevenLabsClient.textToSpeech.mockClear();

            // Create coach with specific language
            const coach = new RealTimeCoach({
              geminiClient: mockGeminiClient,
              elevenLabsClient: mockElevenLabsClient,
              audioManager: mockAudioManager,
              language,
              cooldownMs: 0, // No cooldown for testing
            });

            // Verify language is set
            expect(coach.getLanguage()).toBe(language);

            // Verify voice is appropriate for language
            const expectedVoice = getLanguageAppropriateVoice(language);
            expect(coach.getVoiceId()).toBe(expectedVoice);

            // Trigger feedback
            const analysis: PoseAnalysis = {
              score,
              weakPoints,
              strongPoints,
              timestamp: Date.now(),
            };

            await coach.onPoseAnalysis(analysis);

            // If feedback was triggered, verify language consistency
            if (score < 70 || score > 90) {
              // Check Gemini was called with correct language (if score < 70)
              if (score < 70 && mockGeminiClient.generateCoachingTip.mock.calls.length > 0) {
                const geminiCall = mockGeminiClient.generateCoachingTip.mock.calls[0][0];
                expect(geminiCall.language).toBe(language);
              }

              // Check ElevenLabs TTS was called with correct language
              if (mockElevenLabsClient.textToSpeech.mock.calls.length > 0) {
                const ttsCall = mockElevenLabsClient.textToSpeech.mock.calls[0][0];
                expect(ttsCall.language).toBe(language);
                expect(ttsCall.voiceId).toBe(expectedVoice);
              }
            }
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('PerformanceReviewer should use consistent language for reviews', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLanguageArb,
          fc.integer({ min: 0, max: 100 }),
          async (language, finalScore) => {
            // Clear mocks at start of each iteration
            mockGeminiClient.generatePerformanceReview.mockClear();
            mockElevenLabsClient.textToSpeech.mockClear();

            // Create reviewer with specific language
            const reviewer = new PerformanceReviewer({
              geminiClient: mockGeminiClient,
              elevenLabsClient: mockElevenLabsClient,
              audioManager: mockAudioManager,
              language,
            });

            // Verify language is set
            expect(reviewer.getLanguage()).toBe(language);

            // Verify voice is appropriate for language
            const expectedVoice = getLanguageAppropriateVoice(language);
            expect(reviewer.getVoiceId()).toBe(expectedVoice);

            // Generate review
            const session: GameSession = {
              song: { id: 'test', title: 'Test Song', artist: 'Test Artist' } as any,
              finalScore,
              previousBest: null,
              frameScores: [],
              strongestPart: 'arms',
              weakestPart: 'legs',
            };

            await reviewer.reviewSession(session);

            // Verify Gemini was called with correct language
            expect(mockGeminiClient.generatePerformanceReview).toHaveBeenCalledWith(
              expect.objectContaining({
                language,
              })
            );

            // Verify ElevenLabs TTS was called with correct language and voice
            expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
              expect.objectContaining({
                language,
                voiceId: expectedVoice,
              })
            );
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('ConversationAgent should use consistent language for conversations', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLanguageArb,
          fc.string({ minLength: 5, maxLength: 50 }),
          async (language, userMessage) => {
            // Clear mocks at start of each iteration
            mockElevenLabsClient.textToSpeech.mockClear();

            // Create agent with specific language
            const agent = new ConversationAgent({
              geminiClient: mockGeminiClient,
              elevenLabsClient: mockElevenLabsClient,
              audioManager: mockAudioManager,
              language,
            });

            // Verify language is set
            expect(agent.getLanguage()).toBe(language);

            // Verify voice is appropriate for language
            const expectedVoice = getLanguageAppropriateVoice(language);
            expect(agent.getVoiceId()).toBe(expectedVoice);

            // Process message
            await agent.processMessage(userMessage);

            // Verify context uses correct language
            const context = agent.getContext();
            expect(context.language).toBe(language);

            // Verify ElevenLabs TTS was called with correct language and voice
            if (mockElevenLabsClient.textToSpeech.mock.calls.length > 0) {
              expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
                expect.objectContaining({
                  language,
                  voiceId: expectedVoice,
                })
              );
            }
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('VoiceNavigation should use consistent language for commands', async () => {
      await fc.assert(
        fc.asyncProperty(supportedLanguageArb, async (language) => {
          // Clear mocks at start of each iteration
          mockElevenLabsClient.textToSpeech.mockClear();

          // Create navigation with specific language
          const navigation = new VoiceNavigation({
            elevenLabsClient: mockElevenLabsClient,
            audioManager: mockAudioManager,
            router: mockRouter,
            language,
          });

          // Verify language is set
          expect(navigation.getLanguage()).toBe(language);

          // Verify voice is appropriate for language
          const expectedVoice = getLanguageAppropriateVoice(language);
          expect(navigation.getVoiceId()).toBe(expectedVoice);

          // Execute help command (always speaks)
          await navigation.speakHelp();

          // Verify ElevenLabs TTS was called with correct language and voice
          expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
            expect.objectContaining({
              language,
              voiceId: expectedVoice,
            })
          );
        }),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should update voice when language changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLanguageArb,
          supportedLanguageArb,
          async (initialLanguage, newLanguage) => {
            // Create coach with initial language
            const coach = new RealTimeCoach({
              geminiClient: mockGeminiClient,
              elevenLabsClient: mockElevenLabsClient,
              audioManager: mockAudioManager,
              language: initialLanguage,
            });

            // Verify initial state
            expect(coach.getLanguage()).toBe(initialLanguage);
            const initialVoice = getLanguageAppropriateVoice(initialLanguage);
            expect(coach.getVoiceId()).toBe(initialVoice);

            // Change language
            coach.setLanguage(newLanguage);

            // Verify new state
            expect(coach.getLanguage()).toBe(newLanguage);
            const newVoice = getLanguageAppropriateVoice(newLanguage);
            expect(coach.getVoiceId()).toBe(newVoice);

            // Verify voice changed if languages are different
            if (initialLanguage !== newLanguage) {
              // Voice should be appropriate for new language
              expect(VOICE_CONFIG[newLanguage].availableVoices).toContain(newVoice);
            }
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should maintain language consistency across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          supportedLanguageArb,
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 3, maxLength: 10 }),
          async (language, scores) => {
            // Clear mocks at start of each iteration
            mockGeminiClient.generateCoachingTip.mockClear();
            mockElevenLabsClient.textToSpeech.mockClear();

            // Create coach with specific language
            const coach = new RealTimeCoach({
              geminiClient: mockGeminiClient,
              elevenLabsClient: mockElevenLabsClient,
              audioManager: mockAudioManager,
              language,
              cooldownMs: 0, // No cooldown for testing
            });

            // Perform multiple operations
            for (const score of scores) {
              const analysis: PoseAnalysis = {
                score,
                weakPoints: ['arms'],
                strongPoints: ['legs'],
                timestamp: Date.now(),
              };

              await coach.onPoseAnalysis(analysis);
            }

            // Verify all TTS calls used the same language
            const ttsCalls = mockElevenLabsClient.textToSpeech.mock.calls;
            for (const call of ttsCalls) {
              expect(call[0].language).toBe(language);
            }

            // Verify all Gemini calls used the same language
            const geminiCalls = mockGeminiClient.generateCoachingTip.mock.calls;
            for (const call of geminiCalls) {
              expect(call[0].language).toBe(language);
            }
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });
  });
});
