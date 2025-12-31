/**
 * Voice Navigation Service
 *
 * Provides voice-controlled navigation for the Bachata Bro app.
 * Implements command parsing, execution, and clarification for unrecognized commands.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { ElevenLabsClient } from './ElevenLabsClient';
import { AudioManager, AudioClip } from './AudioManager';
import type { SupportedLanguage, VoiceCommand } from '../../types/voiceCoach';
import { SONGS, Song } from '../assetLoader';
import { getBestScore } from '../database';
import { getLanguageAppropriateVoice } from '../../config/voiceConfig';

// Router interface for navigation (to be injected)
export interface Router {
  push: (route: string | { pathname: string; params?: Record<string, string> }) => void;
}

export interface VoiceNavigationConfig {
  elevenLabsClient: ElevenLabsClient;
  audioManager: AudioManager;
  router: Router;
  language?: SupportedLanguage;
  voiceId?: string;
}

// Help messages by language
const HELP_MESSAGES: Record<SupportedLanguage, string> = {
  en: 'You can say: play followed by a song name, show leaderboard, my best score, settings, or help.',
  es: 'Puedes decir: reproducir seguido del nombre de una canción, mostrar tabla de posiciones, mi mejor puntuación, configuración, o ayuda.',
  de: 'Du kannst sagen: spiele gefolgt von einem Songnamen, zeige Bestenliste, meine beste Punktzahl, Einstellungen, oder Hilfe.',
  ru: 'Вы можете сказать: играть и название песни, показать таблицу лидеров, мой лучший результат, настройки, или помощь.',
};

// Clarification messages by language
const CLARIFICATION_MESSAGES: Record<SupportedLanguage, string> = {
  en: "I didn't understand that. Try saying: play, leaderboard, my score, settings, or help.",
  es: 'No entendí eso. Intenta decir: reproducir, tabla de posiciones, mi puntuación, configuración, o ayuda.',
  de: 'Das habe ich nicht verstanden. Versuche: spielen, Bestenliste, meine Punktzahl, Einstellungen, oder Hilfe.',
  ru: 'Я не понял. Попробуйте сказать: играть, таблица лидеров, мой результат, настройки, или помощь.',
};

// Song not found messages by language
const SONG_NOT_FOUND_MESSAGES: Record<SupportedLanguage, string> = {
  en: "I couldn't find that song. Available songs are: {songs}.",
  es: 'No pude encontrar esa canción. Las canciones disponibles son: {songs}.',
  de: 'Ich konnte diesen Song nicht finden. Verfügbare Songs sind: {songs}.',
  ru: 'Я не смог найти эту песню. Доступные песни: {songs}.',
};

// Best score messages by language
const BEST_SCORE_MESSAGES: Record<SupportedLanguage, string> = {
  en: 'Your best score is {score} percent.',
  es: 'Tu mejor puntuación es {score} por ciento.',
  de: 'Deine beste Punktzahl ist {score} Prozent.',
  ru: 'Ваш лучший результат: {score} процентов.',
};

// No score messages by language
const NO_SCORE_MESSAGES: Record<SupportedLanguage, string> = {
  en: "You haven't played any songs yet. Try saying play followed by a song name.",
  es: 'Aún no has jugado ninguna canción. Intenta decir reproducir seguido del nombre de una canción.',
  de: 'Du hast noch keine Songs gespielt. Versuche spielen gefolgt von einem Songnamen.',
  ru: 'Вы ещё не играли ни одной песни. Попробуйте сказать играть и название песни.',
};

export class VoiceNavigation {
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private router: Router;
  private language: SupportedLanguage;
  private voiceId: string;

  constructor(config: VoiceNavigationConfig) {
    this.elevenLabsClient = config.elevenLabsClient;
    this.audioManager = config.audioManager;
    this.router = config.router;
    this.language = config.language || 'en';
    // Use language-appropriate voice if no voiceId provided
    this.voiceId = config.voiceId || getLanguageAppropriateVoice(this.language);
  }

  /**
   * Parse a transcript into a VoiceCommand
   * Implements command classification for: play, leaderboard, score, settings, help
   *
   * Requirements: 8.1, 8.6
   */
  public parseCommand(transcript: string): VoiceCommand {
    const normalized = transcript.toLowerCase().trim();

    // Check for play song by position (first, second, third, etc.)
    const positionPatterns = [
      /^play\s+(the\s+)?(first|1st)\s+(song)?$/i,
      /^play\s+(the\s+)?(second|2nd)\s+(song)?$/i,
      /^play\s+(the\s+)?(third|3rd)\s+(song)?$/i,
      /^play\s+song\s+(one|1)$/i,
      /^play\s+song\s+(two|2)$/i,
      /^play\s+song\s+(three|3)$/i,
    ];

    // Map position words to indices
    const positionMap: Record<string, number> = {
      'first': 0, '1st': 0, 'one': 0, '1': 0,
      'second': 1, '2nd': 1, 'two': 1, '2': 1,
      'third': 2, '3rd': 2, 'three': 2, '3': 2,
    };

    // Check for position-based play commands
    for (const [position, index] of Object.entries(positionMap)) {
      const patterns = [
        new RegExp(`^play\\s+(the\\s+)?${position}(\\s+song)?$`, 'i'),
        new RegExp(`^play\\s+song\\s+${position}$`, 'i'),
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          if (index < SONGS.length) {
            return { type: 'play_song', songName: SONGS[index].title };
          }
        }
      }
    }

    // Check for play song command
    // Patterns: "play [song]", "reproducir [song]", "spiele [song]", "играть [song]"
    const playPatterns = [
      /^play\s+(.+)$/i,
      /^reproducir\s+(.+)$/i,
      /^spiele\s+(.+)$/i,
      /^играть\s+(.+)$/i,
      /^start\s+(.+)$/i,
      /^iniciar\s+(.+)$/i,
    ];

    for (const pattern of playPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        return { type: 'play_song', songName: match[1].trim() };
      }
    }

    // Check for leaderboard command
    // Patterns: "show leaderboard", "leaderboard", "mostrar tabla", "bestenliste", "таблица лидеров"
    const leaderboardPatterns = [
      /^(show\s+)?leaderboard$/i,
      /^(show\s+)?scores$/i,
      /^rankings$/i,
      /^(mostrar\s+)?tabla(\s+de\s+posiciones)?$/i,
      /^bestenliste(\s+zeigen)?$/i,
      /^(показать\s+)?таблиц[ау]\s+лидеров$/i,
    ];

    for (const pattern of leaderboardPatterns) {
      if (pattern.test(normalized)) {
        return { type: 'show_leaderboard' };
      }
    }

    // Check for best score command
    // Patterns: "my best score", "my score", "mi mejor puntuación", "meine beste punktzahl", "мой лучший результат"
    const scorePatterns = [
      /^my\s+(best\s+)?score$/i,
      /^(mi\s+)?(mejor\s+)?puntuaci[oó]n$/i,
      /^meine\s+(beste\s+)?punktzahl$/i,
      /^мой\s+(лучший\s+)?результат$/i,
      /^best\s+score$/i,
      /^what('s|\s+is)\s+my\s+score$/i,
      /^show\s+my\s+score$/i,
    ];

    for (const pattern of scorePatterns) {
      if (pattern.test(normalized)) {
        return { type: 'get_best_score' };
      }
    }

    // Check for settings command
    // Patterns: "settings", "configuración", "einstellungen", "настройки"
    const settingsPatterns = [
      /^(open\s+)?settings$/i,
      /^(show\s+)?settings$/i,
      /^options$/i,
      /^preferences$/i,
      /^(abrir\s+)?configuraci[oó]n$/i,
      /^einstellungen(\s+[öo]ffnen)?$/i,
      /^(открыть\s+)?настройки$/i,
    ];

    for (const pattern of settingsPatterns) {
      if (pattern.test(normalized)) {
        return { type: 'open_settings' };
      }
    }

    // Check for help command
    // Patterns: "help", "ayuda", "hilfe", "помощь"
    const helpPatterns = [
      /^help$/i,
      /^help\s+me$/i,
      /^ayuda$/i,
      /^hilfe$/i,
      /^помощь$/i,
      /^what\s+can\s+(i|you)\s+(say|do)$/i,
      /^commands$/i,
      /^show\s+commands$/i,
    ];

    for (const pattern of helpPatterns) {
      if (pattern.test(normalized)) {
        return { type: 'help' };
      }
    }

    // Unknown command
    return { type: 'unknown', transcript };
  }

  /**
   * Execute a parsed voice command
   * Handles navigation and spoken responses
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   */
  public async executeCommand(command: VoiceCommand): Promise<void> {
    switch (command.type) {
      case 'play_song':
        await this.handlePlaySong(command.songName);
        break;
      case 'show_leaderboard':
        await this.handleShowLeaderboard();
        break;
      case 'get_best_score':
        await this.handleGetBestScore(command.songName);
        break;
      case 'open_settings':
        await this.handleOpenSettings();
        break;
      case 'help':
        await this.speakHelp();
        break;
      case 'unknown':
        await this.handleUnknownCommand(command.transcript);
        break;
    }
  }

  /**
   * Handle play song command
   * Finds matching song and navigates to game screen
   *
   * Requirement: 8.2
   */
  private async handlePlaySong(songName: string): Promise<void> {
    const song = this.findSong(songName);

    if (song) {
      // Navigate to game with the song
      this.router.push({
        pathname: '/(tabs)/game',
        params: { songId: song.id },
      });
    } else {
      // Song not found - speak available songs
      const availableSongs = SONGS.map((s) => s.title).join(', ');
      const message = SONG_NOT_FOUND_MESSAGES[this.language].replace('{songs}', availableSongs);
      await this.speak(message);
    }
  }

  /**
   * Handle show leaderboard command
   * Navigates to leaderboard screen
   *
   * Requirement: 8.3
   */
  private async handleShowLeaderboard(): Promise<void> {
    this.router.push('/(tabs)/leaderboard');
  }

  /**
   * Handle get best score command
   * Speaks the user's best score
   *
   * Requirement: 8.4
   */
  private async handleGetBestScore(songName?: string): Promise<void> {
    try {
      // If no song specified, get overall best score
      let bestScore: number | null = null;

      if (songName) {
        const song = this.findSong(songName);
        if (song) {
          const scoreRecord = await getBestScore(song.id);
          bestScore = scoreRecord?.score ?? null;
        }
      } else {
        // Get best score across all songs
        for (const song of SONGS) {
          const scoreRecord = await getBestScore(song.id);
          if (scoreRecord && (bestScore === null || scoreRecord.score > bestScore)) {
            bestScore = scoreRecord.score;
          }
        }
      }

      if (bestScore !== null) {
        const message = BEST_SCORE_MESSAGES[this.language].replace('{score}', bestScore.toString());
        await this.speak(message);
      } else {
        await this.speak(NO_SCORE_MESSAGES[this.language]);
      }
    } catch (error) {
      console.error('[VoiceNavigation] Error getting best score:', error);
      await this.speak(NO_SCORE_MESSAGES[this.language]);
    }
  }

  /**
   * Handle open settings command
   * Navigates to settings screen
   *
   * Requirement: 8.5
   */
  private async handleOpenSettings(): Promise<void> {
    this.router.push('/(tabs)/settings');
  }

  /**
   * Speak help message explaining available commands
   *
   * Requirement: 8.6
   */
  public async speakHelp(): Promise<void> {
    const message = HELP_MESSAGES[this.language];
    await this.speak(message);
  }

  /**
   * Handle unknown command with clarification
   *
   * Requirement: 8.6
   */
  private async handleUnknownCommand(transcript: string): Promise<void> {
    console.log('[VoiceNavigation] Unknown command:', transcript);
    const message = CLARIFICATION_MESSAGES[this.language];
    await this.speak(message);
  }

  /**
   * Find a song by name (fuzzy matching)
   */
  public findSong(songName: string): Song | null {
    const normalized = songName.toLowerCase().trim();

    // Exact match on ID
    const exactIdMatch = SONGS.find((s) => s.id.toLowerCase() === normalized);
    if (exactIdMatch) return exactIdMatch;

    // Exact match on title
    const exactTitleMatch = SONGS.find((s) => s.title.toLowerCase() === normalized);
    if (exactTitleMatch) return exactTitleMatch;

    // Partial match on title
    const partialMatch = SONGS.find(
      (s) =>
        s.title.toLowerCase().includes(normalized) || normalized.includes(s.title.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Fuzzy match - check if words overlap
    const searchWords = normalized.split(/\s+/);
    for (const song of SONGS) {
      const titleWords = song.title.toLowerCase().split(/\s+/);
      const hasOverlap = searchWords.some((word) =>
        titleWords.some((titleWord) => titleWord.includes(word) || word.includes(titleWord))
      );
      if (hasOverlap) return song;
    }

    return null;
  }

  /**
   * Speak a message using TTS
   */
  private async speak(text: string): Promise<void> {
    try {
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text,
        voiceId: this.voiceId,
        language: this.language,
      });

      const clip: AudioClip = {
        id: `navigation-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'high',
        text,
      };

      this.audioManager.enqueue(clip);
    } catch (error) {
      console.error('[VoiceNavigation] Error speaking:', error);
    }
  }

  /**
   * Set language and update voice to be language-appropriate
   */
  public setLanguage(language: SupportedLanguage): void {
    this.language = language;
    // Update voice to be appropriate for the new language
    this.voiceId = getLanguageAppropriateVoice(language, this.voiceId);
  }

  /**
   * Get language
   */
  public getLanguage(): SupportedLanguage {
    return this.language;
  }

  /**
   * Set voice ID
   */
  public setVoiceId(voiceId: string): void {
    this.voiceId = voiceId;
  }

  /**
   * Get voice ID
   */
  public getVoiceId(): string {
    return this.voiceId;
  }
}
