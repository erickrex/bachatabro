/**
 * End-to-End Test: Voice Navigation Across App
 * 
 * Tests voice navigation across the entire app:
 * 1. Test "play [song]" command
 * 2. Test "show leaderboard" command
 * 3. Test "settings" command
 * 
 * Validates Requirements: 8.1, 8.2, 8.4
 */

import { VoiceNavigation, Router } from '../../services/voiceCoach/VoiceNavigation';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import type { VoiceCommand } from '../../types/voiceCoach';

// Mock router that tracks navigation history
class MockRouter implements Router {
  public navigationHistory: Array<{
    route: string | { pathname: string; params?: Record<string, string> };
    timestamp: number;
  }> = [];

  push(route: string | { pathname: string; params?: Record<string, string> }): void {
    this.navigationHistory.push({
      route,
      timestamp: Date.now(),
    });
  }

  getLastNavigation(): string | { pathname: string; params?: Record<string, string> } | null {
    if (this.navigationHistory.length === 0) return null;
    return this.navigationHistory[this.navigationHistory.length - 1].route;
  }

  getNavigationCount(): number {
    return this.navigationHistory.length;
  }

  hasNavigatedTo(route: string): boolean {
    return this.navigationHistory.some((nav) => {
      if (typeof nav.route === 'string') {
        return nav.route === route;
      }
      return nav.route.pathname === route;
    });
  }

  reset(): void {
    this.navigationHistory = [];
  }
}

// Mock ElevenLabs client
class MockElevenLabsClient extends ElevenLabsClient {
  public ttsRequests: Array<{ text: string; language: string }> = [];
  public shouldFail: boolean = false;

  async textToSpeech(request: any): Promise<any> {
    this.ttsRequests.push({
      text: request.text,
      language: request.language,
    });

    if (this.shouldFail) {
      throw new Error('ElevenLabs API failed');
    }

    return {
      audio: 'base64_encoded_audio',
      format: 'mp3',
      durationMs: 2000,
    };
  }

  async speechToText(request: any): Promise<any> {
    // Simulate STT for testing
    return {
      transcript: 'play how deep is your love',
      confidence: 0.95,
      language: 'en',
    };
  }

  reset(): void {
    this.ttsRequests = [];
    this.shouldFail = false;
  }
}

// Mock audio manager
class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];
  public playedClips: any[] = [];

  enqueue(clip: any): void {
    this.enqueuedClips.push(clip);
  }

  async play(): Promise<void> {
    if (this.enqueuedClips.length > 0) {
      const clip = this.enqueuedClips.shift();
      this.playedClips.push(clip);

      if (this.onPlaybackStart) {
        this.onPlaybackStart(clip);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      if (this.onPlaybackEnd) {
        this.onPlaybackEnd(clip);
      }
    }
  }

  clearQueue(): void {
    this.enqueuedClips = [];
  }

  reset(): void {
    this.enqueuedClips = [];
    this.playedClips = [];
  }
}

describe('E2E: Voice Navigation Across App', () => {
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
    it('should navigate through entire app using voice commands', async () => {
      // Requirement 8.1, 8.2, 8.4: Complete voice navigation flow
      
      // 1. Start at home, navigate to game with an existing song
      const playCommand = navigation.parseCommand('play how deep is your love');
      expect(playCommand.type).toBe('play_song');
      await navigation.executeCommand(playCommand);
      expect(mockRouter.hasNavigatedTo('/(tabs)/game')).toBe(true);

      // 2. Navigate to leaderboard
      const leaderboardCommand = navigation.parseCommand('show leaderboard');
      expect(leaderboardCommand.type).toBe('show_leaderboard');
      await navigation.executeCommand(leaderboardCommand);
      expect(mockRouter.hasNavigatedTo('/(tabs)/leaderboard')).toBe(true);

      // 3. Navigate to settings
      const settingsCommand = navigation.parseCommand('settings');
      expect(settingsCommand.type).toBe('open_settings');
      await navigation.executeCommand(settingsCommand);
      expect(mockRouter.hasNavigatedTo('/(tabs)/settings')).toBe(true);

      // 4. Ask for help
      const helpCommand = navigation.parseCommand('help');
      expect(helpCommand.type).toBe('help');
      await navigation.executeCommand(helpCommand);
      // Help doesn't navigate, just speaks
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(0);

      // 5. Check score (speaks, doesn't navigate)
      const scoreCommand = navigation.parseCommand('my best score');
      expect(scoreCommand.type).toBe('get_best_score');
      await navigation.executeCommand(scoreCommand);
      expect(mockAudio.enqueuedClips.length).toBeGreaterThan(1);

      // Verify total navigation count
      expect(mockRouter.getNavigationCount()).toBe(3); // game, leaderboard, settings

      console.log('Navigation history:', mockRouter.navigationHistory);
    });

    it('should handle sequential navigation commands', async () => {
      const commands = [
        'show leaderboard',
        'settings',
        'play how deep is your love',
        'show leaderboard',
      ];

      for (const commandText of commands) {
        const command = navigation.parseCommand(commandText);
        await navigation.executeCommand(command);
      }

      // Should have navigated 4 times
      expect(mockRouter.getNavigationCount()).toBe(4);

      // Verify navigation order
      expect(mockRouter.navigationHistory[0].route).toBe('/(tabs)/leaderboard');
      expect(mockRouter.navigationHistory[1].route).toBe('/(tabs)/settings');
      // Game navigation includes params
      expect(mockRouter.navigationHistory[3].route).toBe('/(tabs)/leaderboard');
    });

    it('should handle mixed navigation and query commands', async () => {
      const commands = [
        { text: 'play how deep is your love', shouldNavigate: true },
        { text: 'my best score', shouldNavigate: false },
        { text: 'show leaderboard', shouldNavigate: true },
        { text: 'help', shouldNavigate: false },
        { text: 'settings', shouldNavigate: true },
      ];

      let navigationCount = 0;
      let queryCount = 0;

      for (const cmd of commands) {
        const command = navigation.parseCommand(cmd.text);
        await navigation.executeCommand(command);

        if (cmd.shouldNavigate) {
          navigationCount++;
        } else {
          queryCount++;
        }
      }

      // Verify navigation count
      expect(mockRouter.getNavigationCount()).toBe(navigationCount);

      // Verify query responses were spoken
      expect(mockAudio.enqueuedClips.length).toBeGreaterThanOrEqual(queryCount);
    });
  });

  describe('Play Song Command', () => {
    it('should navigate to game with song parameter', async () => {
      // Requirement 8.2: Play song command
      const command = navigation.parseCommand('play how deep is your love');
      expect(command.type).toBe('play_song');
      expect(command.songName).toBe('how deep is your love');

      await navigation.executeCommand(command);

      // Should navigate to game screen
      const lastNav = mockRouter.getLastNavigation();
      expect(lastNav).toBeTruthy();

      if (typeof lastNav === 'object' && lastNav !== null) {
        expect(lastNav.pathname).toBe('/(tabs)/game');
        expect(lastNav.params).toBeDefined();
        expect(lastNav.params?.songId).toBeTruthy();
      }
    });

    it('should handle various song name formats', async () => {
      const testCases = [
        { input: 'play how deep is your love', expected: 'how deep is your love' },
        { input: 'play 30 minutos', expected: '30 minutos' },
        { input: 'start how deep is your love', expected: 'how deep is your love' },
        { input: 'start 30 minutos', expected: '30 minutos' },
      ];

      for (const testCase of testCases) {
        mockRouter.reset();
        const command = navigation.parseCommand(testCase.input);
        
        expect(command.type).toBe('play_song');
        if (command.type === 'play_song') {
          expect(command.songName).toBe(testCase.expected);
        }

        await navigation.executeCommand(command);
        expect(mockRouter.getNavigationCount()).toBeGreaterThan(0);
      }
    });

    it('should handle song not found gracefully', async () => {
      const command = navigation.parseCommand('play xyz123abc');
      await navigation.executeCommand(command);

      // Should not navigate
      expect(mockRouter.getNavigationCount()).toBe(0);

      // Should speak error message
      expect(mockAudio.enqueuedClips.length).toBe(1);
      const errorMessage = mockAudio.enqueuedClips[0].text;
      expect(errorMessage.toLowerCase()).toContain('find');
    });

    it('should list available songs when song not found', async () => {
      const command: VoiceCommand = {
        type: 'play_song',
        songName: 'xyz123abc',
      };

      await navigation.executeCommand(command);

      // Error message should list available songs
      const message = mockAudio.enqueuedClips[0].text;
      expect(message.toLowerCase()).toContain('available');
    });

    it('should handle partial song name matches', async () => {
      const command = navigation.parseCommand('play how deep');
      await navigation.executeCommand(command);

      // Should find and navigate to song
      expect(mockRouter.getNavigationCount()).toBe(1);
    });
  });

  describe('Show Leaderboard Command', () => {
    it('should navigate to leaderboard screen', async () => {
      // Requirement 8.1: Show leaderboard command
      const command = navigation.parseCommand('show leaderboard');
      expect(command.type).toBe('show_leaderboard');

      await navigation.executeCommand(command);

      // Should navigate to leaderboard
      expect(mockRouter.getLastNavigation()).toBe('/(tabs)/leaderboard');
    });

    it('should handle various leaderboard command formats', async () => {
      const testCases = [
        'show leaderboard',
        'leaderboard',
        'scores',
        'rankings',
        'show scores',
      ];

      for (const input of testCases) {
        mockRouter.reset();
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('show_leaderboard');

        await navigation.executeCommand(command);
        expect(mockRouter.hasNavigatedTo('/(tabs)/leaderboard')).toBe(true);
      }
    });

    it('should navigate to leaderboard multiple times', async () => {
      // Navigate to leaderboard twice
      const command = navigation.parseCommand('show leaderboard');
      await navigation.executeCommand(command);
      await navigation.executeCommand(command);

      // Should have navigated twice
      expect(mockRouter.getNavigationCount()).toBe(2);
    });
  });

  describe('Settings Command', () => {
    it('should navigate to settings screen', async () => {
      // Requirement 8.4: Settings command
      const command = navigation.parseCommand('settings');
      expect(command.type).toBe('open_settings');

      await navigation.executeCommand(command);

      // Should navigate to settings
      expect(mockRouter.getLastNavigation()).toBe('/(tabs)/settings');
    });

    it('should handle various settings command formats', async () => {
      const testCases = [
        'settings',
        'open settings',
        'options',
        'preferences',
        'show settings',
      ];

      for (const input of testCases) {
        mockRouter.reset();
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('open_settings');

        await navigation.executeCommand(command);
        expect(mockRouter.hasNavigatedTo('/(tabs)/settings')).toBe(true);
      }
    });
  });

  describe('Best Score Command', () => {
    it('should speak best score without navigation', async () => {
      const command = navigation.parseCommand('my best score');
      expect(command.type).toBe('get_best_score');

      await navigation.executeCommand(command);

      // Should not navigate
      expect(mockRouter.getNavigationCount()).toBe(0);

      // Should speak score
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockElevenLabs.ttsRequests.length).toBe(1);
    });

    it('should handle various score query formats', async () => {
      const testCases = [
        'my best score',
        'my score',
        'best score',
        "what's my score",
        'show my score',
      ];

      for (const input of testCases) {
        mockAudio.reset();
        mockElevenLabs.reset();

        const command = navigation.parseCommand(input);
        expect(command.type).toBe('get_best_score');

        await navigation.executeCommand(command);
        expect(mockAudio.enqueuedClips.length).toBe(1);
      }
    });

    it('should speak score for specific song', async () => {
      const command = navigation.parseCommand('my best score for how deep is your love');
      
      if (command.type === 'get_best_score') {
        expect(command.songName).toBeTruthy();
      }

      await navigation.executeCommand(command);
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });
  });

  describe('Help Command', () => {
    it('should speak help message without navigation', async () => {
      const command = navigation.parseCommand('help');
      expect(command.type).toBe('help');

      await navigation.executeCommand(command);

      // Should not navigate
      expect(mockRouter.getNavigationCount()).toBe(0);

      // Should speak help
      expect(mockAudio.enqueuedClips.length).toBe(1);
      expect(mockElevenLabs.ttsRequests.length).toBe(1);
    });

    it('should include available commands in help message', async () => {
      await navigation.speakHelp();

      const helpText = mockAudio.enqueuedClips[0].text.toLowerCase();

      // Should mention key commands
      expect(helpText).toContain('play');
      expect(helpText).toContain('leaderboard');
      expect(helpText).toContain('settings');
    });

    it('should handle various help command formats', async () => {
      const testCases = [
        'help',
        'what can i say',
        'what can you do',
        'commands',
        'show commands',
      ];

      for (const input of testCases) {
        mockAudio.reset();
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('help');

        await navigation.executeCommand(command);
        expect(mockAudio.enqueuedClips.length).toBe(1);
      }
    });
  });

  describe('Unrecognized Commands', () => {
    it('should handle unrecognized commands gracefully', async () => {
      const command = navigation.parseCommand('do a backflip');
      expect(command.type).toBe('unknown');

      await navigation.executeCommand(command);

      // Should not navigate
      expect(mockRouter.getNavigationCount()).toBe(0);

      // Should speak clarification
      expect(mockAudio.enqueuedClips.length).toBe(1);
    });

    it('should provide clarification for unrecognized commands', async () => {
      const command: VoiceCommand = {
        type: 'unknown',
        transcript: 'random gibberish',
      };

      await navigation.executeCommand(command);

      const clarification = mockAudio.enqueuedClips[0].text.toLowerCase();

      // Should suggest valid commands
      expect(clarification).toContain('play');
      expect(clarification).toContain('leaderboard');
    });

    it('should handle multiple unrecognized commands', async () => {
      const testCases = [
        'do a backflip',
        'what is the weather',
        'tell me a joke',
      ];

      for (const input of testCases) {
        mockAudio.reset();
        const command = navigation.parseCommand(input);
        expect(command.type).toBe('unknown');

        await navigation.executeCommand(command);
        expect(mockAudio.enqueuedClips.length).toBe(1);
      }

      // Should not have navigated
      expect(mockRouter.getNavigationCount()).toBe(0);
    });
  });

  describe('Multi-Language Navigation', () => {
    it('should parse commands in Spanish', async () => {
      const esNavigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'es',
      });

      const testCases = [
        { input: 'reproducir 30 minutos', type: 'play_song' },
        { input: 'mostrar tabla de posiciones', type: 'show_leaderboard' },
        { input: 'configuración', type: 'open_settings' },
        { input: 'ayuda', type: 'help' },
      ];

      for (const testCase of testCases) {
        const command = esNavigation.parseCommand(testCase.input);
        expect(command.type).toBe(testCase.type);
      }
    });

    it('should parse commands in German', async () => {
      const deNavigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'de',
      });

      const testCases = [
        { input: 'spiele 30 minutos', type: 'play_song' },
        { input: 'bestenliste', type: 'show_leaderboard' },
        { input: 'einstellungen', type: 'open_settings' },
        { input: 'hilfe', type: 'help' },
      ];

      for (const testCase of testCases) {
        const command = deNavigation.parseCommand(testCase.input);
        expect(command.type).toBe(testCase.type);
      }
    });

    it('should parse commands in Russian', async () => {
      const ruNavigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'ru',
      });

      const testCases = [
        { input: 'играть 30 minutos', type: 'play_song' },
        { input: 'таблица лидеров', type: 'show_leaderboard' },
        { input: 'настройки', type: 'open_settings' },
        { input: 'помощь', type: 'help' },
      ];

      for (const testCase of testCases) {
        const command = ruNavigation.parseCommand(testCase.input);
        expect(command.type).toBe(testCase.type);
      }
    });

    it('should speak responses in selected language', async () => {
      const languages: Array<'en' | 'es' | 'de' | 'ru'> = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        mockElevenLabs.reset();

        const langNavigation = new VoiceNavigation({
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          router: mockRouter,
          language: lang,
        });

        await langNavigation.speakHelp();

        // Should speak in correct language
        expect(mockElevenLabs.ttsRequests[0].language).toBe(lang);
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

    it('should use high priority for error messages', async () => {
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
      mockElevenLabs.shouldFail = true;

      const command: VoiceCommand = { type: 'help' };

      // Should not throw
      await expect(navigation.executeCommand(command)).resolves.not.toThrow();
    });

    it('should continue navigation when TTS fails', async () => {
      mockElevenLabs.shouldFail = true;

      const command = navigation.parseCommand('show leaderboard');
      await navigation.executeCommand(command);

      // Should still navigate even if TTS fails
      expect(mockRouter.hasNavigatedTo('/(tabs)/leaderboard')).toBe(true);
    });
  });

  describe('Case Insensitivity and Whitespace', () => {
    it('should handle commands regardless of case', async () => {
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

    it('should handle extra whitespace', async () => {
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

  describe('Navigation Timing', () => {
    it('should track navigation timestamps', async () => {
      const commands = [
        'show leaderboard',
        'settings',
        'play how deep is your love',
      ];

      const startTime = Date.now();

      for (const commandText of commands) {
        const command = navigation.parseCommand(commandText);
        await navigation.executeCommand(command);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const endTime = Date.now();

      // Verify all navigations have timestamps
      expect(mockRouter.navigationHistory.length).toBe(3);
      
      for (const nav of mockRouter.navigationHistory) {
        expect(nav.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(nav.timestamp).toBeLessThanOrEqual(endTime);
      }
    });

    it('should handle rapid sequential commands', async () => {
      const commands = Array(10).fill('show leaderboard');

      for (const commandText of commands) {
        const command = navigation.parseCommand(commandText);
        await navigation.executeCommand(command);
      }

      // Should have navigated 10 times
      expect(mockRouter.getNavigationCount()).toBe(10);
    });
  });

  describe('Complete User Journey', () => {
    it('should handle a realistic user session', async () => {
      // User starts app and asks for help
      await navigation.executeCommand(navigation.parseCommand('help'));
      expect(mockAudio.enqueuedClips.length).toBe(1);

      // User checks their best score
      await navigation.executeCommand(navigation.parseCommand('my best score'));
      expect(mockAudio.enqueuedClips.length).toBe(2);

      // User plays a song
      await navigation.executeCommand(navigation.parseCommand('play how deep is your love'));
      expect(mockRouter.hasNavigatedTo('/(tabs)/game')).toBe(true);

      // After playing, user checks leaderboard
      await navigation.executeCommand(navigation.parseCommand('show leaderboard'));
      expect(mockRouter.hasNavigatedTo('/(tabs)/leaderboard')).toBe(true);

      // User goes to settings to adjust voice coach
      await navigation.executeCommand(navigation.parseCommand('settings'));
      expect(mockRouter.hasNavigatedTo('/(tabs)/settings')).toBe(true);

      // User plays another song
      await navigation.executeCommand(navigation.parseCommand('play 30 minutos'));
      
      // Verify complete journey
      expect(mockRouter.getNavigationCount()).toBe(4); // game, leaderboard, settings, game
      expect(mockAudio.enqueuedClips.length).toBeGreaterThanOrEqual(2); // help + score
    });
  });
});
