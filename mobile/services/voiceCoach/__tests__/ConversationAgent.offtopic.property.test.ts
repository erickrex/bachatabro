/**
 * Property-based tests for ConversationAgent - Off-Topic Handling
 * Feature: elevenlabs-voice-coach
 *
 * Property 13: Off-Topic Redirection
 * Validates: Requirements 7.6
 */

import * as fc from 'fast-check';
import { ConversationAgent, ConversationAgentConfig } from '../ConversationAgent';
import { GeminiClient } from '../GeminiClient';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';
import type { SupportedLanguage } from '../../../types/voiceCoach';

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

describe('ConversationAgent Property Tests - Off-Topic Handling', () => {
  let mockGeminiClient: jest.Mocked<GeminiClient>;
  let mockElevenLabsClient: jest.Mocked<ElevenLabsClient>;
  let mockAudioManager: jest.Mocked<AudioManager>;
  let config: ConversationAgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mock instances
    mockGeminiClient = new GeminiClient() as jest.Mocked<GeminiClient>;
    mockElevenLabsClient = new ElevenLabsClient() as jest.Mocked<ElevenLabsClient>;
    mockAudioManager = new AudioManager() as jest.Mocked<AudioManager>;

    // Setup mock implementations
    mockGeminiClient.generateCoachingTip = jest.fn().mockResolvedValue({
      tip: 'Great question! Focus on your arm movements.',
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
      idleTimeoutMs: 30000,
      maxContextMessages: 10,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Increase timeout for property-based tests
  jest.setTimeout(30000);

  // Feature: elevenlabs-voice-coach, Property 13: Off-Topic Redirection
  describe('Property 13: Off-Topic Redirection', () => {
    /**
     * Validates: Requirements 7.6
     *
     * For any user message classified as off-topic (not related to dance, music, or the app),
     * the Voice Coach should respond with a redirection to dance-related topics.
     */

    // Generator for off-topic messages (not related to dance)
    // These messages must NOT contain any dance-related keywords
    const offTopicMessageGen = fc.constantFrom(
      'What is the weather like today?',
      'Tell me about politics',
      'What is your favorite food?',
      'What time is it?',
      'Tell me a joke',
      'What is the capital of France?',
      'How do I cook pasta?',
      'What is the meaning of life?',
      'Tell me about cars',
      'What is your opinion on movies?',
      'How do I fix my computer?',
      'What is the stock market doing?',
      'What is the best programming language?',
      'Who won the world cup?',
      'What is quantum physics?'
    );

    // Generator for dance-related messages (on-topic)
    const onTopicMessageGen = fc.constantFrom(
      'How can I improve my dance moves?',
      'What should I focus on for better rhythm?',
      'Can you give me tips for arm movements?',
      'How do I improve my footwork?',
      'What is the best way to practice dancing?',
      'How can I stay on beat better?',
      'Tips for hip movements please',
      'How do I improve my posture while dancing?',
      'What exercises help with dance technique?',
      'How can I learn new dance steps?',
      'Tell me about bachata',
      'How do I improve my score?',
      'What music is good for practice?',
      'How do I move my body better?',
      'Can you help me with my choreography?'
    );

    it('should classify off-topic messages correctly', async () => {
      const agent = new ConversationAgent(config);

      await fc.assert(
        fc.asyncProperty(offTopicMessageGen, async (message) => {
          const isOffTopic = agent.isOffTopic(message);
          expect(isOffTopic).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should classify on-topic messages correctly', async () => {
      const agent = new ConversationAgent(config);

      await fc.assert(
        fc.asyncProperty(onTopicMessageGen, async (message) => {
          const isOffTopic = agent.isOffTopic(message);
          expect(isOffTopic).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should redirect off-topic messages to dance-related topics', async () => {
      await fc.assert(
        fc.asyncProperty(offTopicMessageGen, async (message) => {
          const agent = new ConversationAgent(config);
          agent.startConversation();

          const response = await agent.processMessage(message);

          // Response should be a redirection message
          // Check that it contains dance-related keywords
          const redirectionKeywords = [
            'dance', 'dancing', 'moves', 'technique', 'improve',
            'baile', 'bailar', 'movimientos', 'técnica', 'mejorar',
            'tanzen', 'tanz', 'bewegungen', 'technik', 'verbessern',
            'танц', 'движения', 'техника', 'улучшить'
          ];

          const hasRedirection = redirectionKeywords.some(keyword =>
            response.toLowerCase().includes(keyword.toLowerCase())
          );

          expect(hasRedirection).toBe(true);

          agent.endConversation();
        }),
        { numRuns: 100 }
      );
    });

    it('should not redirect on-topic messages', async () => {
      await fc.assert(
        fc.asyncProperty(onTopicMessageGen, async (message) => {
          const agent = new ConversationAgent(config);
          agent.startConversation();

          // For on-topic messages, the Gemini client should be called
          await agent.processMessage(message);

          // Gemini should have been called for on-topic messages
          expect(mockGeminiClient.generateCoachingTip).toHaveBeenCalled();

          agent.endConversation();
          mockGeminiClient.generateCoachingTip.mockClear();
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid redirection message for any language', async () => {
      const languages: SupportedLanguage[] = ['en', 'es', 'de', 'ru'];

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...languages),
          offTopicMessageGen,
          async (language, message) => {
            const langConfig = { ...config, language };
            const agent = new ConversationAgent(langConfig);

            const redirection = agent.getOffTopicRedirection();

            // Redirection should be a non-empty string
            expect(typeof redirection).toBe('string');
            expect(redirection.length).toBeGreaterThan(0);

            // Should contain a question mark (asking about dance)
            expect(redirection).toContain('?');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add off-topic redirection to conversation context', async () => {
      await fc.assert(
        fc.asyncProperty(offTopicMessageGen, async (message) => {
          const agent = new ConversationAgent(config);
          agent.startConversation();

          await agent.processMessage(message);

          const messages = agent.getMessages();

          // Should have 2 messages: user message and assistant redirection
          expect(messages.length).toBe(2);

          // First message should be user's off-topic message
          expect(messages[0].role).toBe('user');
          expect(messages[0].content).toBe(message);

          // Second message should be assistant's redirection
          expect(messages[1].role).toBe('assistant');
          expect(messages[1].content.length).toBeGreaterThan(0);

          agent.endConversation();
        }),
        { numRuns: 100 }
      );
    });

    it('should speak the redirection message via TTS', async () => {
      await fc.assert(
        fc.asyncProperty(offTopicMessageGen, async (message) => {
          const agent = new ConversationAgent(config);
          agent.startConversation();

          await agent.processMessage(message);

          // TTS should have been called
          expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalled();

          // Audio should have been enqueued
          expect(mockAudioManager.enqueue).toHaveBeenCalled();

          agent.endConversation();
          mockElevenLabsClient.textToSpeech.mockClear();
          mockAudioManager.enqueue.mockClear();
        }),
        { numRuns: 100 }
      );
    });

    it('should handle mixed on-topic and off-topic messages in same session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(onTopicMessageGen, offTopicMessageGen),
            { minLength: 2, maxLength: 4 }
          ),
          async (messages) => {
            const agent = new ConversationAgent(config);
            agent.startConversation();

            for (const message of messages) {
              await agent.processMessage(message);
            }

            // All messages should be in context
            const contextMessages = agent.getMessages();
            expect(contextMessages.length).toBe(messages.length * 2);

            agent.endConversation();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
