/**
 * Unit tests for VoiceNavigation
 *
 * Tests specific command parsing and execution
 * Requirements: 8.2, 8.3, 8.4, 8.5
 */

import { VoiceNavigation, VoiceNavigationConfig, Router } from '../VoiceNavigation';
import { ElevenLabsClient } from '../ElevenLabsClient';
import { AudioManager } from '../AudioManager';
import * as database from '../../database';

// Mock dependencies
jest.mock('../ElevenLabsClient');
jest.mock('../AudioManager');
jest.mock('../../database');

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

describe('VoiceNavigation', () => {
  let mockElevenLabsClient: jest.Mocked<ElevenLabsClient>;
  let mockAudioManager: jest.Mocked<AudioManager>;
  let mockRouter: Router;
  let config: VoiceNavigationConfig;
  let navigation: VoiceNavigation;

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

    navigation = new VoiceNavigation(config);
  });

  describe('parseCommand - play [song]', () => {
    /**
     * Requirement 8.2: WHEN the user says "play [song name]",
     * THE Mobile_App SHALL navigate to and start that song
     */

    it('should parse "play how deep is your love" correctly', () => {
      const command = navigation.parseCommand('play how deep is your love');

      expect(command.type).toBe('play_song');
      if (command.type === 'play_song') {
        expect(command.songName).toBe('how deep is your love');
      }
    });

    it('should parse "play 30 minutos" correctly', () => {
      const command = navigation.parseCommand('play 30 minutos');

      expect(command.type).toBe('play_song');
      if (command.type === 'play_song') {
        expect(command.songName).toBe('30 minutos');
      }
    });

    it('should parse "start" as play command', () => {
      const command = navigation.parseCommand('start bachata song');

      expect(command.type).toBe('play_song');
      if (command.type === 'play_song') {
        expect(command.songName).toBe('bachata song');
      }
    });

    it('should handle Spanish "reproducir" command', () => {
      const command = navigation.parseCommand('reproducir cancion');

      expect(command.type).toBe('play_song');
      if (command.type === 'play_song') {
        expect(command.songName).toBe('cancion');
      }
    });

    it('should handle German "spiele" command', () => {
      const command = navigation.parseCommand('spiele lied');

      expect(command.type).toBe('play_song');
      if (command.type === 'play_song') {
        expect(command.songName).toBe('lied');
      }
    });
  });

  describe('parseCommand - show leaderboard', () => {
    /**
     * Requirement 8.3: WHEN the user says "show leaderboard",
     * THE Mobile_App SHALL navigate to the leaderboard screen
     */

    it('should parse "show leaderboard" correctly', () => {
      const command = navigation.parseCommand('show leaderboard');
      expect(command.type).toBe('show_leaderboard');
    });

    it('should parse "leaderboard" correctly', () => {
      const command = navigation.parseCommand('leaderboard');
      expect(command.type).toBe('show_leaderboard');
    });

    it('should parse "scores" as leaderboard command', () => {
      const command = navigation.parseCommand('scores');
      expect(command.type).toBe('show_leaderboard');
    });

    it('should parse "rankings" as leaderboard command', () => {
      const command = navigation.parseCommand('rankings');
      expect(command.type).toBe('show_leaderboard');
    });
  });

  describe('parseCommand - my best score', () => {
    /**
     * Requirement 8.4: WHEN the user says "my best score",
     * THE Voice_Coach SHALL speak the user's personal best score
     */

    it('should parse "my best score" correctly', () => {
      const command = navigation.parseCommand('my best score');
      expect(command.type).toBe('get_best_score');
    });

    it('should parse "my score" correctly', () => {
      const command = navigation.parseCommand('my score');
      expect(command.type).toBe('get_best_score');
    });

    it('should parse "best score" correctly', () => {
      const command = navigation.parseCommand('best score');
      expect(command.type).toBe('get_best_score');
    });

    it('should parse "what\'s my score" correctly', () => {
      const command = navigation.parseCommand("what's my score");
      expect(command.type).toBe('get_best_score');
    });
  });

  describe('parseCommand - settings', () => {
    /**
     * Requirement 8.5: WHEN the user says "settings",
     * THE Mobile_App SHALL navigate to the settings screen
     */

    it('should parse "settings" correctly', () => {
      const command = navigation.parseCommand('settings');
      expect(command.type).toBe('open_settings');
    });

    it('should parse "open settings" correctly', () => {
      const command = navigation.parseCommand('open settings');
      expect(command.type).toBe('open_settings');
    });

    it('should parse "options" as settings command', () => {
      const command = navigation.parseCommand('options');
      expect(command.type).toBe('open_settings');
    });

    it('should parse "preferences" as settings command', () => {
      const command = navigation.parseCommand('preferences');
      expect(command.type).toBe('open_settings');
    });
  });

  describe('parseCommand - help', () => {
    /**
     * Requirement 8.6: WHEN the user says "help",
     * THE Voice_Coach SHALL explain available voice commands
     */

    it('should parse "help" correctly', () => {
      const command = navigation.parseCommand('help');
      expect(command.type).toBe('help');
    });

    it('should parse "commands" as help command', () => {
      const command = navigation.parseCommand('commands');
      expect(command.type).toBe('help');
    });

    it('should parse "what can i say" as help command', () => {
      const command = navigation.parseCommand('what can i say');
      expect(command.type).toBe('help');
    });

    it('should parse "what can you do" as help command', () => {
      const command = navigation.parseCommand('what can you do');
      expect(command.type).toBe('help');
    });
  });

  describe('executeCommand - play song', () => {
    it('should navigate to game screen with matching song', async () => {
      const command = navigation.parseCommand('play how deep is your love');
      await navigation.executeCommand(command);

      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/game',
        params: { songId: 'howdeepisyourlove' },
      });
    });

    it('should navigate to game screen with partial song match', async () => {
      const command = navigation.parseCommand('play deep');
      await navigation.executeCommand(command);

      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/game',
        params: { songId: 'howdeepisyourlove' },
      });
    });

    it('should speak error when song not found', async () => {
      const command = navigation.parseCommand('play unknown song');
      await navigation.executeCommand(command);

      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalled();
      expect(mockAudioManager.enqueue).toHaveBeenCalled();
    });
  });

  describe('executeCommand - show leaderboard', () => {
    it('should navigate to leaderboard screen', async () => {
      const command = navigation.parseCommand('show leaderboard');
      await navigation.executeCommand(command);

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/leaderboard');
    });
  });

  describe('executeCommand - get best score', () => {
    it('should speak best score when available', async () => {
      (database.getBestScore as jest.Mock).mockResolvedValue({
        score: 85,
        songId: 'howdeepisyourlove',
        playerName: 'Player',
      });

      const command = navigation.parseCommand('my best score');
      await navigation.executeCommand(command);

      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('85'),
        })
      );
      expect(mockAudioManager.enqueue).toHaveBeenCalled();
    });

    it('should speak no score message when no scores exist', async () => {
      (database.getBestScore as jest.Mock).mockResolvedValue(null);

      const command = navigation.parseCommand('my best score');
      await navigation.executeCommand(command);

      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("haven't played"),
        })
      );
    });
  });

  describe('executeCommand - open settings', () => {
    it('should navigate to settings screen', async () => {
      const command = navigation.parseCommand('settings');
      await navigation.executeCommand(command);

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/settings');
    });
  });

  describe('executeCommand - help', () => {
    it('should speak help message', async () => {
      const command = navigation.parseCommand('help');
      await navigation.executeCommand(command);

      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('play'),
        })
      );
      expect(mockAudioManager.enqueue).toHaveBeenCalled();
    });
  });

  describe('executeCommand - unknown', () => {
    it('should speak clarification message for unknown commands', async () => {
      const command = navigation.parseCommand('random gibberish');
      await navigation.executeCommand(command);

      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("didn't understand"),
        })
      );
      expect(mockAudioManager.enqueue).toHaveBeenCalled();
    });
  });

  describe('findSong', () => {
    it('should find song by exact ID', () => {
      const song = navigation.findSong('howdeepisyourlove');
      expect(song).not.toBeNull();
      expect(song?.id).toBe('howdeepisyourlove');
    });

    it('should find song by exact title', () => {
      const song = navigation.findSong('How Deep Is Your Love');
      expect(song).not.toBeNull();
      expect(song?.id).toBe('howdeepisyourlove');
    });

    it('should find song by partial title match', () => {
      const song = navigation.findSong('deep');
      expect(song).not.toBeNull();
      expect(song?.id).toBe('howdeepisyourlove');
    });

    it('should find song by word overlap', () => {
      const song = navigation.findSong('love');
      expect(song).not.toBeNull();
      expect(song?.id).toBe('howdeepisyourlove');
    });

    it('should return null for non-existent song', () => {
      const song = navigation.findSong('xyz123abc');
      expect(song).toBeNull();
    });
  });

  describe('language settings', () => {
    it('should use configured language for TTS', async () => {
      navigation.setLanguage('es');
      await navigation.speakHelp();

      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'es',
        })
      );
    });

    it('should get and set language correctly', () => {
      expect(navigation.getLanguage()).toBe('en');
      navigation.setLanguage('de');
      expect(navigation.getLanguage()).toBe('de');
    });
  });

  describe('voice settings', () => {
    it('should use configured voice ID for TTS', async () => {
      navigation.setVoiceId('Drew');
      await navigation.speakHelp();

      expect(mockElevenLabsClient.textToSpeech).toHaveBeenCalledWith(
        expect.objectContaining({
          voiceId: 'Drew',
        })
      );
    });

    it('should get and set voice ID correctly', () => {
      expect(navigation.getVoiceId()).toBe('Rachel');
      navigation.setVoiceId('Clyde');
      expect(navigation.getVoiceId()).toBe('Clyde');
    });
  });
});
