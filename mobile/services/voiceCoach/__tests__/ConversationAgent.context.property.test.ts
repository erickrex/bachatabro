/**
 * Property-based tests for ConversationAgent - Context Retention
 * Feature: elevenlabs-voice-coach
 *
 * Property 11: Conversation Context Retention
 * Validates: Requirements 7.3
 */

import * as fc from 'fast-check';
import { ConversationAgent, ConversationAgentConfig, ConversationMessage } from '../ConversationAgent';
import { GeminiClient } from '../GeminiClient';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';

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

describe('ConversationAgent Property Tests - Context Retention', () => {
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

  // Feature: elevenlabs-voice-coach, Property 11: Conversation Context Retention
  describe('Property 11: Conversation Context Retention', () => {
    /**
     * Validates: Requirements 7.3
     *
     * For any conversation session, the context from previous messages should be
     * accessible and influence subsequent responses within the same session.
     */

    // Generator for dance-related messages (to avoid off-topic redirection)
    const danceMessageGen = fc.constantFrom(
      'How can I improve my dance moves?',
      'What should I focus on for better rhythm?',
      'Can you give me tips for arm movements?',
      'How do I improve my footwork?',
      'What is the best way to practice dancing?',
      'How can I stay on beat better?',
      'Tips for hip movements please',
      'How do I improve my posture while dancing?',
      'What exercises help with dance technique?',
      'How can I learn new dance steps?'
    );

    it('should retain all messages in context within a session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(danceMessageGen, { minLength: 1, maxLength: 5 }),
          async (messages) => {
            const agent = new ConversationAgent(config);
            agent.startConversation();

            // Process each message
            for (const message of messages) {
              await agent.processMessage(message);
            }

            // Get context and verify all messages are retained
            const context = agent.getContext();
            const contextMessages = agent.getMessages();

            // Each user message should have a corresponding assistant response
            // So total messages = 2 * number of user messages
            expect(contextMessages.length).toBe(messages.length * 2);

            // Verify user messages are in context
            const userMessages = contextMessages.filter(m => m.role === 'user');
            expect(userMessages.length).toBe(messages.length);

            // Verify each user message content matches
            for (let i = 0; i < messages.length; i++) {
              expect(userMessages[i].content).toBe(messages[i]);
            }

            agent.endConversation();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve message order in context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(danceMessageGen, { minLength: 2, maxLength: 5 }),
          async (messages) => {
            const agent = new ConversationAgent(config);
            agent.startConversation();

            // Process each message
            for (const message of messages) {
              await agent.processMessage(message);
            }

            const contextMessages = agent.getMessages();

            // Verify alternating user/assistant pattern
            for (let i = 0; i < contextMessages.length; i++) {
              const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
              expect(contextMessages[i].role).toBe(expectedRole);
            }

            // Verify timestamps are in ascending order
            for (let i = 1; i < contextMessages.length; i++) {
              expect(contextMessages[i].timestamp).toBeGreaterThanOrEqual(
                contextMessages[i - 1].timestamp
              );
            }

            agent.endConversation();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain context across multiple messages in same session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // Keep within maxContextMessages limit (10 / 2 = 5)
          async (messageCount) => {
            const agent = new ConversationAgent(config);
            agent.startConversation();

            const testMessages = [
              'How can I improve my dance moves?',
              'What about my arm technique?',
              'Any tips for rhythm?',
              'How do I practice footwork?',
              'What exercises help?',
            ].slice(0, messageCount);

            // Process messages
            for (const message of testMessages) {
              await agent.processMessage(message);
            }

            // Context should contain all messages (within maxContextMessages limit)
            const context = agent.getContext();
            const expectedMessages = Math.min(messageCount * 2, config.maxContextMessages || 10);
            expect(context.messages.length).toBe(expectedMessages);

            // Session start time should be set
            expect(context.sessionStartTime).toBeGreaterThan(0);

            // Language should match config
            expect(context.language).toBe('en');

            agent.endConversation();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear context when conversation ends and starts new session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(danceMessageGen, { minLength: 1, maxLength: 3 }),
          fc.array(danceMessageGen, { minLength: 1, maxLength: 3 }),
          async (firstSessionMessages, secondSessionMessages) => {
            const agent = new ConversationAgent(config);

            // First session
            agent.startConversation();
            for (const message of firstSessionMessages) {
              await agent.processMessage(message);
            }
            const firstSessionContext = agent.getMessages();
            expect(firstSessionContext.length).toBe(firstSessionMessages.length * 2);
            agent.endConversation();

            // Second session - context should be fresh
            agent.startConversation();
            const freshContext = agent.getMessages();
            expect(freshContext.length).toBe(0);

            // Add messages to second session
            for (const message of secondSessionMessages) {
              await agent.processMessage(message);
            }
            const secondSessionContext = agent.getMessages();
            expect(secondSessionContext.length).toBe(secondSessionMessages.length * 2);

            agent.endConversation();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect maxContextMessages limit', async () => {
      const smallContextConfig = {
        ...config,
        maxContextMessages: 4, // Only keep 4 messages (2 exchanges)
      };

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 6 }), // More messages than context limit
          async (messageCount) => {
            const agent = new ConversationAgent(smallContextConfig);
            agent.startConversation();

            const testMessages = [
              'How can I improve my dance?',
              'What about arms?',
              'Tips for rhythm?',
              'How to practice?',
              'What exercises?',
              'How to stay on beat?',
            ].slice(0, messageCount);

            // Process all messages
            for (const message of testMessages) {
              await agent.processMessage(message);
            }

            // Context should be trimmed to maxContextMessages
            const contextMessages = agent.getMessages();
            expect(contextMessages.length).toBeLessThanOrEqual(4);

            agent.endConversation();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include both user and assistant messages in context', async () => {
      await fc.assert(
        fc.asyncProperty(danceMessageGen, async (message) => {
          const agent = new ConversationAgent(config);
          agent.startConversation();

          await agent.processMessage(message);

          const contextMessages = agent.getMessages();

          // Should have exactly 2 messages: user + assistant
          expect(contextMessages.length).toBe(2);

          // First should be user message
          expect(contextMessages[0].role).toBe('user');
          expect(contextMessages[0].content).toBe(message);

          // Second should be assistant response
          expect(contextMessages[1].role).toBe('assistant');
          expect(contextMessages[1].content.length).toBeGreaterThan(0);

          agent.endConversation();
        }),
        { numRuns: 100 }
      );
    });
  });
});
