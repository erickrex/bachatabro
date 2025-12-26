/**
 * Property-based tests for VoiceNavigation
 * Feature: elevenlabs-voice-coach
 *
 * Property 14: Voice Command Classification
 * Validates: Requirements 8.1, 8.6
 */

import * as fc from 'fast-check';
import { VoiceNavigation, VoiceNavigationConfig, Router } from '../VoiceNavigation';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';
import type { VoiceCommand } from '../../../types/voiceCoach';

// Mock dependencies
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

describe('VoiceNavigation Property Tests', () => {
  let mockElevenLabsClient: jest.Mocked<ElevenLabsClient>;
  let mockAudioManager: jest.Mocked<AudioManager>;
  let mockRouter: Router;
  let config: VoiceNavigationConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockElevenLabsClient = new ElevenLabsClient() as jest.Mocked<ElevenLabsClient>;
    mockAudioManager = new AudioManager() as jest.Mocked<AudioManager>;
    mockRouter = {
      push: jest.fn(),
    };

    // Setup mock implementations
    mockElevenLabsClient.textToSpeech = jest.fn().mockResolvedValue({
      audio: 'dGVzdA==', // base64 "test"
      format: 'mp3',
      durationMs: 1000,
    });

    mockAudioManager.enqueue = jest.fn();

    config = {
      elevenLabsClient: mockElevenLabsClient,
      audioManager: mockAudioManager,
      router: mockRouter,
      language: 'en',
    };
  });

  // Increase timeout for property-based tests
  jest.setTimeout(30000);

  // Feature: elevenlabs-voice-coach, Property 14: Voice Command Classification
  describe('Property 14: Voice Command Classification', () => {
    /**
     * Validates: Requirements 8.1, 8.6
     *
     * For any voice input transcript, it should be correctly classified as either
     * a recognized command (play song, show leaderboard, etc.) or an unknown
     * command requiring clarification.
     */

    // Generators for recognized command patterns
    const leaderboardCommandGen = fc.constantFrom(
      'leaderboard',
      'show leaderboard',
      'Leaderboard',
      'LEADERBOARD',
      'scores',
      'rankings'
    );

    const scoreCommandGen = fc.constantFrom(
      'my score',
      'my best score',
      'My Score',
      'MY BEST SCORE',
      'best score',
      "what's my score"
    );

    const settingsCommandGen = fc.constantFrom(
      'settings',
      'Settings',
      'SETTINGS',
      'open settings',
      'options',
      'preferences'
    );

    const helpCommandGen = fc.constantFrom(
      'help',
      'Help',
      'HELP',
      'commands',
      'what can i say',
      'what can you do'
    );

    it('should classify play commands correctly for any song name', async () => {
      const navigation = new VoiceNavigation(config);

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          async (songName) => {
            const trimmedName = songName.trim();
            if (trimmedName.length === 0) return; // Skip empty names

            const transcript = `play ${trimmedName}`;
            const command = navigation.parseCommand(transcript);

            expect(command.type).toBe('play_song');
            if (command.type === 'play_song') {
              expect(command.songName.toLowerCase()).toBe(trimmedName.toLowerCase());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify leaderboard commands correctly', async () => {
      const navigation = new VoiceNavigation(config);

      await fc.assert(
        fc.asyncProperty(leaderboardCommandGen, async (transcript) => {
          const command = navigation.parseCommand(transcript);
          expect(command.type).toBe('show_leaderboard');
        }),
        { numRuns: 100 }
      );
    });

    it('should classify score commands correctly', async () => {
      const navigation = new VoiceNavigation(config);

      await fc.assert(
        fc.asyncProperty(scoreCommandGen, async (transcript) => {
          const command = navigation.parseCommand(transcript);
          expect(command.type).toBe('get_best_score');
        }),
        { numRuns: 100 }
      );
    });

    it('should classify settings commands correctly', async () => {
      const navigation = new VoiceNavigation(config);

      await fc.assert(
        fc.asyncProperty(settingsCommandGen, async (transcript) => {
          const command = navigation.parseCommand(transcript);
          expect(command.type).toBe('open_settings');
        }),
        { numRuns: 100 }
      );
    });

    it('should classify help commands correctly', async () => {
      const navigation = new VoiceNavigation(config);

      await fc.assert(
        fc.asyncProperty(helpCommandGen, async (transcript) => {
          const command = navigation.parseCommand(transcript);
          expect(command.type).toBe('help');
        }),
        { numRuns: 100 }
      );
    });

    it('should classify unrecognized commands as unknown', async () => {
      const navigation = new VoiceNavigation(config);

      // Generator for random strings that don't match any command pattern
      const unknownCommandGen = fc
        .string({ minLength: 1, maxLength: 50 })
        .filter((s: string) => {
          const lower = s.toLowerCase().trim();
          // Filter out strings that would match known commands
          return (
            !lower.startsWith('play ') &&
            !lower.startsWith('start ') &&
            lower !== 'leaderboard' &&
            !lower.includes('leaderboard') &&
            lower !== 'scores' &&
            lower !== 'rankings' &&
            !lower.includes('my score') &&
            !lower.includes('best score') &&
            lower !== 'settings' &&
            lower !== 'options' &&
            lower !== 'preferences' &&
            !lower.includes('settings') &&
            lower !== 'help' &&
            lower !== 'commands' &&
            !lower.includes('what can') &&
            lower.trim().length > 0
          );
        });

      await fc.assert(
        fc.asyncProperty(unknownCommandGen, async (transcript) => {
          const command = navigation.parseCommand(transcript);
          expect(command.type).toBe('unknown');
          if (command.type === 'unknown') {
            expect(command.transcript).toBe(transcript);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return a valid VoiceCommand type for any input', async () => {
      const navigation = new VoiceNavigation(config);

      // Valid command types
      const validTypes = ['play_song', 'show_leaderboard', 'get_best_score', 'open_settings', 'help', 'unknown'];

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 100 }),
          async (transcript) => {
            const command = navigation.parseCommand(transcript);

            // Command should always have a valid type
            expect(validTypes).toContain(command.type);

            // If play_song, should have songName
            if (command.type === 'play_song') {
              expect(typeof command.songName).toBe('string');
            }

            // If unknown, should have transcript
            if (command.type === 'unknown') {
              expect(typeof command.transcript).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case insensitivity for all command types', async () => {
      const navigation = new VoiceNavigation(config);

      // Test case variations
      const caseVariations = [
        { input: 'PLAY song', expectedType: 'play_song' },
        { input: 'Play Song', expectedType: 'play_song' },
        { input: 'play SONG', expectedType: 'play_song' },
        { input: 'LEADERBOARD', expectedType: 'show_leaderboard' },
        { input: 'Leaderboard', expectedType: 'show_leaderboard' },
        { input: 'MY SCORE', expectedType: 'get_best_score' },
        { input: 'My Score', expectedType: 'get_best_score' },
        { input: 'SETTINGS', expectedType: 'open_settings' },
        { input: 'Settings', expectedType: 'open_settings' },
        { input: 'HELP', expectedType: 'help' },
        { input: 'Help', expectedType: 'help' },
      ];

      for (const { input, expectedType } of caseVariations) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe(expectedType);
      }
    });

    it('should handle whitespace variations in play commands', async () => {
      const navigation = new VoiceNavigation(config);

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('play', 'start'),
          fc.string({ minLength: 1, maxLength: 10 }),
          async (prefix, songName) => {
            const trimmedSong = songName.trim();
            if (trimmedSong.length === 0) return; // Skip empty song names

            // Test with leading/trailing whitespace
            const transcript = `  ${prefix} ${trimmedSong}  `;
            const command = navigation.parseCommand(transcript);

            expect(command.type).toBe('play_song');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
