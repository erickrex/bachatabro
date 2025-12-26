/**
 * Integration Test: Voice Navigation Flow
 * 
 * Tests the complete voice navigation flow:
 * 1. Voice input → command parsing → navigation
 * 2. Unrecognized command handling
 * 
 * Validates Requirements: 8.1, 8.6
 */

import { VoiceNavigation, Router } from '../../services/voiceCoach/VoiceNavigation';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import type { VoiceCommand } from '../../types/voiceCoach';

// Mock router for navigation testing
class MockRouter implements Router {
  public navigationHistory: Array<string | { pathname: string; params?: Record<string, string> }> = [];

  push(route: string | { pathname: string; params?: Record<string, string> }): void {
    this.navigationHistory.push(route);
  }

  reset(): void {
    this.navigationHistory = [];
  }

  getLastNavigation(): string | { pathname: string; params?: Record<string, string> } | null {
    return this.navigationHistory.length > 0
      ? this.navigationHistory[this.navigationHistory.length - 1]
      : null;
  }
}

// Mock ElevenLabs client
class MockElevenLabsClient extends ElevenLabsClient {
  public callCount: number = 0;
  public lastRequest: any = null;

  async textToSpeech(request: any): Promise<any> {
    this.callCount++;
    this.lastRequest = request;

    return {
      audio: 'base64_encoded_audio',
      format: 'mp3',
      durationMs: 2000,
    };
  }

  async speechToText(request: any): Promise<any> {
    // Not used in these tests
    return {
      transcript: '',
      confidence: 1.0,
      language: 'en',
    };
  }
}

// Mock audio manager
class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];

  enqueue(clip: any, autoPlay: boolean = true): void {
    this.enqueuedClips.push(clip);
  }

  clearQueue(): void {
    this.enqueuedClips = [];
  }
}

describe('Voice Navigation Integration', () => {
  let navigation: VoiceNavigation;
  let mockRouter: MockRouter;
  let mockElevenLabs: MockElevenLabsClient;
  let mockAudio: MockAudioManager;

  beforeEach(() => {
    mockRouter = new MockRouter();
    mockElevenLabs = new MockElevenLabsClient();
    mockAudio = new MockAudioManager();

    navigation = new VoiceNavigation({
      elevenLabsClient: mockElevenLabs,
      audioManager: mockAudio,
      router: mockRouter,
      language: 'en',
    });
  });

  describe('Complete Navigation Flow', () => {
    it('should complete full flow: voice input → command parsing → navigation', async () => {
      // Requirement 8.1: Parse and execute voice commands
      const transcript = 'show leaderboard';

      // Parse command
      const command = navigation.parseCommand(transcript);
      expect(command.type).toBe('show_leaderboard');

      // Execute command
      await navigation.executeCommand(command);

      // Verify navigation occurred
      expect(mockRouter.navigationHistory.length).toBe(1);
      expect(mockRouter.getLastNavigation()).toBe('/(tabs)/leaderboard');
    });

    it('should handle play song command with navigation', async () => {
      // Requirement 8.2: Play song command
      const transcript = 'play how deep is your love';

      const command = navigation.parseCommand(transcript);
      expect(command.type).toBe('play_song');
      expect(command.songName).toBe('how deep is your love');

      await navigation.executeCommand(command);

      // Should navigate to game with song parameter
      const lastNav = mockRouter.getLastNavigation();
      expect(lastNav).toMatchObject({
        pathname: '/(tabs)/game',
        params: expect.objectContaining({
          songId: expect.any(String),
        }),
      });
    });

    it('should handle settings command', async () => {
      // Requirement 8.5: Settings navigation
      const transcript = 'settings';

      const command = navigation.parseCommand(transcript);
      expect(command.type).toBe('open_settings');

      await navigation.executeCommand(command);

      expect(mockRouter.getLastNavigation()).toBe('/(tabs)/settings');
    });

    it('should handle best score command with spoken response', async () => {
      // Requirement 8.4: Speak best score
      const transcript = 'my best score';

      const command = navigation.parseCommand(transcript);
      expect(command.type).toBe('get_best_score');

      await navigation.executeCommand(command);

      // Should speak the score (audio enqueued)
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(0);
      expect(mockElevenLabs.callCount).toBe(1);
    });

    it('should handle help command with spoken response', async () => {
      // Requirement 8.6: Help command
      const transcript = 'help';

      const command = navigation.parseCommand(transcript);
      expect(command.type).toBe('help');

      await navigation.executeCommand(command);

      // Should speak help message
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockElevenLabs.callCount).toBe(1);

      // Help message should explain available commands
      const helpText = mockAudio.enqueuedClips[0].text;
      expect(helpText.toLowerCase()).toContain('play');
      expect(helpText.toLowerCase()).toContain('leaderboard');
    });
  });

  describe('Command Parsing', () => {
    it('should parse play song commands in multiple formats', () => {
      const testCases = [
        { input: 'play how deep is your love', expected: 'how deep is your love' },
        { input: 'play 30 minutos', expected: '30 minutos' },
        { input: 'start how deep is your love', expected: 'how deep is your love' },
      ];

      for (const testCase of testCases) {
        const command = navigation.parseCommand(testCase.input);
        expect(command.type).toBe('play_song');
        if (command.type === 'play_song') {
          expect(command.songName).toBe(testCase.expected);
        }
      }
    });

    it('should parse leaderboard commands in multiple formats', () => {
      const testCases = [
        'show leaderboard',
        'leaderboard',
        'scores',
        'rankings',
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('show_leaderboard');
      }
    });

    it('should parse score commands in multiple formats', () => {
      const testCases = [
        'my best score',
        'my score',
        'best score',
        "what's my score",
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('get_best_score');
      }
    });

    it('should parse settings commands in multiple formats', () => {
      const testCases = [
        'settings',
        'open settings',
        'options',
        'preferences',
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('open_settings');
      }
    });

    it('should parse help commands in multiple formats', () => {
      const testCases = [
        'help',
        'what can i say',
        'what can you do',
        'commands',
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('help');
      }
    });
  });

  describe('Unrecognized Command Handling', () => {
    it('should classify unrecognized commands correctly', () => {
      // Requirement 8.6: Handle unrecognized commands
      const testCases = [
        'do a backflip',
        'what is the weather',
        'tell me a joke',
        'random gibberish',
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('unknown');
        if (command.type === 'unknown') {
          expect(command.transcript).toBe(input);
        }
      }
    });

    it('should provide clarification for unrecognized commands', async () => {
      const transcript = 'do something random';

      const command = navigation.parseCommand(transcript);
      expect(command.type).toBe('unknown');

      await navigation.executeCommand(command);

      // Should speak clarification message
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockElevenLabs.callCount).toBe(1);

      // Clarification should suggest valid commands
      const clarificationText = mockAudio.enqueuedClips[0].text;
      expect(clarificationText.toLowerCase()).toContain('play');
      expect(clarificationText.toLowerCase()).toContain('leaderboard');
    });

    it('should not navigate for unrecognized commands', async () => {
      const command: VoiceCommand = {
        type: 'unknown',
        transcript: 'invalid command',
      };

      await navigation.executeCommand(command);

      // Should not navigate
      expect(mockRouter.navigationHistory.length).toBe(0);

      // But should speak clarification
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });
  });

  describe('Song Matching', () => {
    it('should find songs with exact title match', () => {
      const song = navigation.findSong('how deep is your love');
      expect(song).toBeTruthy();
      expect(song?.title.toLowerCase()).toContain('how deep is your love');
    });

    it('should find songs with partial match', () => {
      const song = navigation.findSong('how deep');
      expect(song).toBeTruthy();
    });

    it('should handle song not found', async () => {
      const transcript = 'play xyz123abc';

      const command = navigation.parseCommand(transcript);
      await navigation.executeCommand(command);

      // Should not navigate
      expect(mockRouter.navigationHistory.length).toBe(0);

      // Should speak "song not found" message
      expect(mockAudio.enqueuedClips.length).toBe(1);
      const message = mockAudio.enqueuedClips[0].text;
      expect(message.toLowerCase()).toContain('find');
    });

    it('should list available songs when song not found', async () => {
      const command: VoiceCommand = {
        type: 'play_song',
        songName: 'xyz123abc',
      };

      await navigation.executeCommand(command);

      // Message should list available songs
      const message = mockAudio.enqueuedClips[0].text;
      expect(message.toLowerCase()).toContain('available');
    });
  });

  describe('Multi-Language Support', () => {
    it('should parse commands in Spanish', () => {
      const esNavigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'es',
      });

      const testCases = [
        { input: 'reproducir 30 minutos', type: 'play_song' },
        { input: 'mostrar tabla de posiciones', type: 'show_leaderboard' },
        { input: 'mi mejor puntuación', type: 'get_best_score' },
        { input: 'configuración', type: 'open_settings' },
        { input: 'ayuda', type: 'help' },
      ];

      for (const testCase of testCases) {
        const command = esNavigation.parseCommand(testCase.input);
        expect(command.type).toBe(testCase.type);
      }
    });

    it('should parse commands in German', () => {
      const deNavigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'de',
      });

      const testCases = [
        { input: 'spiele 30 minutos', type: 'play_song' },
        { input: 'bestenliste', type: 'show_leaderboard' },
        { input: 'meine beste punktzahl', type: 'get_best_score' },
        { input: 'einstellungen', type: 'open_settings' },
        { input: 'hilfe', type: 'help' },
      ];

      for (const testCase of testCases) {
        const command = deNavigation.parseCommand(testCase.input);
        expect(command.type).toBe(testCase.type);
      }
    });

    it('should parse commands in Russian', () => {
      const ruNavigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'ru',
      });

      const testCases = [
        { input: 'играть 30 minutos', type: 'play_song' },
        { input: 'таблица лидеров', type: 'show_leaderboard' },
        { input: 'мой лучший результат', type: 'get_best_score' },
        { input: 'настройки', type: 'open_settings' },
        { input: 'помощь', type: 'help' },
      ];

      for (const testCase of testCases) {
        const command = ruNavigation.parseCommand(testCase.input);
        expect(command.type).toBe(testCase.type);
      }
    });

    it('should speak responses in the selected language', async () => {
      const languages: Array<'en' | 'es' | 'de' | 'ru'> = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        const langNavigation = new VoiceNavigation({
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          router: mockRouter,
          language: lang,
        });

        mockAudio.clearQueue();
        mockElevenLabs.callCount = 0;

        await langNavigation.speakHelp();

        // Should speak in the correct language
        expect(mockElevenLabs.callCount).toBe(1);
        expect(mockElevenLabs.lastRequest.language).toBe(lang);
      }
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle commands regardless of case', () => {
      const testCases = [
        'PLAY HOW DEEP IS YOUR LOVE',
        'Play How Deep Is Your Love',
        'play how deep is your love',
        'pLaY hOw DeEp Is YoUr LoVe',
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('play_song');
      }
    });

    it('should handle extra whitespace', () => {
      const testCases = [
        '  play 30 minutos  ',
        'play   30   minutos',
        '\tplay 30 minutos\n',
      ];

      for (const input of testCases) {
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('play_song');
      }
    });
  });

  describe('Audio Priority', () => {
    it('should use high priority for navigation responses', async () => {
      const command: VoiceCommand = { type: 'help' };
      await navigation.executeCommand(command);

      // Navigation audio should have high priority
      expect(mockAudio.enqueuedClips[0].priority).toBe('high');
    });

    it('should use high priority for clarification messages', async () => {
      const command: VoiceCommand = {
        type: 'unknown',
        transcript: 'invalid',
      };
      await navigation.executeCommand(command);

      expect(mockAudio.enqueuedClips[0].priority).toBe('high');
    });
  });

  describe('Error Handling', () => {
    it('should handle TTS failure gracefully', async () => {
      const failingElevenLabs = new MockElevenLabsClient();
      failingElevenLabs.textToSpeech = async () => {
        throw new Error('TTS failed');
      };

      const errorNavigation = new VoiceNavigation({
        elevenLabsClient: failingElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
      });

      const command: VoiceCommand = { type: 'help' };

      // Should not throw
      await expect(errorNavigation.executeCommand(command)).resolves.not.toThrow();
    });
  });

  describe('Sequential Commands', () => {
    it('should handle multiple commands in sequence', async () => {
      const commands = [
        'show leaderboard',
        'settings',
        'help',
      ];

      for (const transcript of commands) {
        const command = navigation.parseCommand(transcript);
        await navigation.executeCommand(command);
      }

      // Should have navigated twice (leaderboard and settings)
      // Help doesn't navigate, just speaks
      expect(mockRouter.navigationHistory.length).toBe(2);
      expect(mockRouter.navigationHistory[0]).toBe('/(tabs)/leaderboard');
      expect(mockRouter.navigationHistory[1]).toBe('/(tabs)/settings');

      // Should have spoken help message
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(0);
    });
  });
});
