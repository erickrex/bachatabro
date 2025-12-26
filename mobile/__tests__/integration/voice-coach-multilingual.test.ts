/**
 * Integration Test: Multilingual Voice Coach Flow
 * 
 * Tests the complete multilingual flow:
 * 1. Language switching mid-session
 * 2. Voice selection per language
 * 
 * Validates Requirements: 9.2, 9.4, 9.5
 */

import { RealTimeCoach } from '../../services/voiceCoach/RealTimeCoach';
import { PerformanceReviewer } from '../../services/voiceCoach/PerformanceReviewer';
import { VoiceNavigation, Router } from '../../services/voiceCoach/VoiceNavigation';
import { GeminiClient } from '../../services/voiceCoach/GeminiClient';
import { ElevenLabsClient } from '../../services/voiceCoach/ElevenLabsClient';
import { AudioManager } from '../../services/voiceCoach/AudioManager';
import type { PoseAnalysis, SupportedLanguage } from '../../types/voiceCoach';
import { VOICE_CONFIG } from '../../config/voiceConfig';

// Mock clients that track language usage
class MockGeminiClient extends GeminiClient {
  public requestHistory: Array<{ language: SupportedLanguage; type: string }> = [];

  async generateCoachingTip(request: any): Promise<any> {
    this.requestHistory.push({
      language: request.language,
      type: 'coaching_tip',
    });

    return {
      tip: 'Focus on your movements',
      targetBodyPart: 'arms',
    };
  }

  async generatePerformanceReview(request: any): Promise<any> {
    this.requestHistory.push({
      language: request.language,
      type: 'performance_review',
    });

    return {
      review: 'Great job!',
      improvementTip: 'Keep practicing',
    };
  }

  reset(): void {
    this.requestHistory = [];
  }
}

class MockElevenLabsClient extends ElevenLabsClient {
  public requestHistory: Array<{
    language: SupportedLanguage;
    voiceId: string;
    type: string;
  }> = [];

  async textToSpeech(request: any): Promise<any> {
    this.requestHistory.push({
      language: request.language,
      voiceId: request.voiceId,
      type: 'tts',
    });

    return {
      audio: 'base64_audio',
      format: 'mp3',
      durationMs: 2000,
    };
  }

  reset(): void {
    this.requestHistory = [];
  }
}

class MockAudioManager extends AudioManager {
  public enqueuedClips: any[] = [];

  enqueue(clip: any, autoPlay: boolean = true): void {
    this.enqueuedClips.push(clip);
  }

  clearQueue(): void {
    this.enqueuedClips = [];
  }
}

class MockRouter implements Router {
  push(route: string | { pathname: string; params?: Record<string, string> }): void {
    // No-op for testing
  }
}

describe('Multilingual Voice Coach Integration', () => {
  let mockGemini: MockGeminiClient;
  let mockElevenLabs: MockElevenLabsClient;
  let mockAudio: MockAudioManager;
  let mockRouter: MockRouter;

  beforeEach(() => {
    mockGemini = new MockGeminiClient();
    mockElevenLabs = new MockElevenLabsClient();
    mockAudio = new MockAudioManager();
    mockRouter = new MockRouter();
  });

  describe('Language Switching Mid-Session', () => {
    it('should switch language for real-time coaching mid-session', async () => {
      // Requirement 9.2: Language switching
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'en',
        cooldownMs: 0, // No cooldown for testing
      });

      const baseTime = Date.now();
      const analysis: PoseAnalysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime,
      };

      // First feedback in English
      await coach.onPoseAnalysis(analysis);
      expect(mockGemini.requestHistory[0].language).toBe('en');
      expect(mockElevenLabs.requestHistory[0].language).toBe('en');

      // Switch to Spanish
      coach.setLanguage('es');
      mockGemini.reset();
      mockElevenLabs.reset();

      // Second feedback in Spanish - use timestamp after first feedback
      await coach.onPoseAnalysis({
        ...analysis,
        timestamp: baseTime + 1000,
      });
      expect(mockGemini.requestHistory[0].language).toBe('es');
      expect(mockElevenLabs.requestHistory[0].language).toBe('es');

      // Switch to German
      coach.setLanguage('de');
      mockGemini.reset();
      mockElevenLabs.reset();

      // Third feedback in German - use timestamp after second feedback
      await coach.onPoseAnalysis({
        ...analysis,
        timestamp: baseTime + 2000,
      });
      expect(mockGemini.requestHistory[0].language).toBe('de');
      expect(mockElevenLabs.requestHistory[0].language).toBe('de');
    });

    it('should switch language for performance reviews mid-session', async () => {
      const reviewer = new PerformanceReviewer({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'en',
      });

      const mockSession = {
        song: {
          id: 'test',
          title: 'Test Song',
          artist: 'Test Artist',
          duration: 180,
          audioFile: null,
          videoFile: null,
          poseFile: null,
        },
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      };

      // First review in English
      await reviewer.reviewSession(mockSession);
      expect(mockGemini.requestHistory[0].language).toBe('en');
      expect(mockElevenLabs.requestHistory[0].language).toBe('en');

      // Switch to Russian
      reviewer.setLanguage('ru');
      mockGemini.reset();
      mockElevenLabs.reset();

      // Second review in Russian
      await reviewer.reviewSession(mockSession);
      expect(mockGemini.requestHistory[0].language).toBe('ru');
      expect(mockElevenLabs.requestHistory[0].language).toBe('ru');
    });

    it('should switch language for voice navigation mid-session', async () => {
      const navigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'en',
      });

      // First help in English
      await navigation.speakHelp();
      expect(mockElevenLabs.requestHistory[0].language).toBe('en');

      // Switch to Spanish
      navigation.setLanguage('es');
      mockElevenLabs.reset();

      // Second help in Spanish
      await navigation.speakHelp();
      expect(mockElevenLabs.requestHistory[0].language).toBe('es');
    });

    it('should maintain language consistency across all services', async () => {
      // Create all services with same language
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'de',
        cooldownMs: 0,
      });

      const reviewer = new PerformanceReviewer({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'de',
      });

      const navigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: 'de',
      });

      // Use all services
      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      await reviewer.reviewSession({
        song: {
          id: 'test',
          title: 'Test',
          artist: 'Test',
          duration: 180,
          audioFile: null,
          videoFile: null,
          poseFile: null,
        },
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      });

      await navigation.speakHelp();

      // All requests should be in German
      const allRequests = [
        ...mockGemini.requestHistory,
        ...mockElevenLabs.requestHistory,
      ];

      expect(allRequests.every((req) => req.language === 'de')).toBe(true);
    });
  });

  describe('Voice Selection Per Language', () => {
    it('should use language-appropriate voice for English', async () => {
      // Requirement 9.4: Language-appropriate voices
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'en',
        cooldownMs: 0,
      });

      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      // Should use an English voice
      const voiceId = mockElevenLabs.requestHistory[0].voiceId;
      const englishVoices = VOICE_CONFIG.en.availableVoices;
      expect(englishVoices).toContain(voiceId);
    });

    it('should use language-appropriate voice for Spanish', async () => {
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'es',
        cooldownMs: 0,
      });

      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      const voiceId = mockElevenLabs.requestHistory[0].voiceId;
      const spanishVoices = VOICE_CONFIG.es.availableVoices;
      expect(spanishVoices).toContain(voiceId);
    });

    it('should use language-appropriate voice for German', async () => {
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'de',
        cooldownMs: 0,
      });

      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      const voiceId = mockElevenLabs.requestHistory[0].voiceId;
      const germanVoices = VOICE_CONFIG.de.availableVoices;
      expect(germanVoices).toContain(voiceId);
    });

    it('should use language-appropriate voice for Russian', async () => {
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'ru',
        cooldownMs: 0,
      });

      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      const voiceId = mockElevenLabs.requestHistory[0].voiceId;
      const russianVoices = VOICE_CONFIG.ru.availableVoices;
      expect(russianVoices).toContain(voiceId);
    });

    it('should update voice when language changes', async () => {
      // Requirement 9.5: Voice changes with language
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'en',
        cooldownMs: 0,
      });

      const baseTime = Date.now();

      // Get initial voice
      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime,
      });
      const englishVoice = mockElevenLabs.requestHistory[0].voiceId;

      // Switch to Spanish
      coach.setLanguage('es');
      mockElevenLabs.reset();

      // Get new voice - use timestamp after first feedback
      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: baseTime + 1000,
      });
      const spanishVoice = mockElevenLabs.requestHistory[0].voiceId;

      // Voices should be different (language-appropriate)
      expect(englishVoice).not.toBe(spanishVoice);
      expect(VOICE_CONFIG.en.availableVoices).toContain(englishVoice);
      expect(VOICE_CONFIG.es.availableVoices).toContain(spanishVoice);
    });

    it('should allow custom voice override per language', async () => {
      const customVoice = 'CustomVoice';
      
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'en',
        voiceId: customVoice,
        cooldownMs: 0,
      });

      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      // Should use custom voice
      expect(mockElevenLabs.requestHistory[0].voiceId).toBe(customVoice);
    });
  });

  describe('All Supported Languages', () => {
    it('should work correctly for all 4 supported languages', async () => {
      const languages: SupportedLanguage[] = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        mockGemini.reset();
        mockElevenLabs.reset();
        mockAudio.clearQueue();

        const coach = new RealTimeCoach({
          geminiClient: mockGemini,
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          language: lang,
          cooldownMs: 0,
        });

        await coach.onPoseAnalysis({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now(),
        });

        // Verify language consistency
        expect(mockGemini.requestHistory[0].language).toBe(lang);
        expect(mockElevenLabs.requestHistory[0].language).toBe(lang);

        // Verify voice is appropriate for language
        const voiceId = mockElevenLabs.requestHistory[0].voiceId;
        expect(VOICE_CONFIG[lang].availableVoices).toContain(voiceId);
      }
    });

    it('should generate reviews in all 4 supported languages', async () => {
      const languages: SupportedLanguage[] = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        mockGemini.reset();
        mockElevenLabs.reset();

        const reviewer = new PerformanceReviewer({
          geminiClient: mockGemini,
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          language: lang,
        });

        await reviewer.reviewSession({
          song: {
            id: 'test',
            title: 'Test',
            artist: 'Test',
            duration: 180,
            audioFile: null,
            videoFile: null,
            poseFile: null,
          },
          finalScore: 85,
          previousBest: 80,
          frameScores: [],
          strongestPart: 'legs',
          weakestPart: 'arms',
        });

        expect(mockGemini.requestHistory[0].language).toBe(lang);
        expect(mockElevenLabs.requestHistory[0].language).toBe(lang);
      }
    });

    it('should parse voice commands in all 4 supported languages', () => {
      const testCases: Array<{
        lang: SupportedLanguage;
        command: string;
        expectedType: string;
      }> = [
        { lang: 'en', command: 'play how deep is your love', expectedType: 'play_song' },
        { lang: 'es', command: 'reproducir 30 minutos', expectedType: 'play_song' },
        { lang: 'de', command: 'spiele 30 minutos', expectedType: 'play_song' },
        { lang: 'ru', command: 'играть 30 minutos', expectedType: 'play_song' },
        { lang: 'en', command: 'help', expectedType: 'help' },
        { lang: 'es', command: 'ayuda', expectedType: 'help' },
        { lang: 'de', command: 'hilfe', expectedType: 'help' },
        { lang: 'ru', command: 'помощь', expectedType: 'help' },
      ];

      for (const testCase of testCases) {
        const navigation = new VoiceNavigation({
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          router: mockRouter,
          language: testCase.lang,
        });

        const command = navigation.parseCommand(testCase.command);
        expect(command.type).toBe(testCase.expectedType);
      }
    });
  });

  describe('Language Persistence', () => {
    it('should maintain language setting across multiple operations', async () => {
      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: 'es',
        cooldownMs: 0,
      });

      // Multiple operations
      for (let i = 0; i < 5; i++) {
        await coach.onPoseAnalysis({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now() + i * 1000,
        });
      }

      // All should be in Spanish
      expect(
        mockGemini.requestHistory.every((req) => req.language === 'es')
      ).toBe(true);
      expect(
        mockElevenLabs.requestHistory.every((req) => req.language === 'es')
      ).toBe(true);
    });

    it('should retrieve current language setting', () => {
      const languages: SupportedLanguage[] = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        const coach = new RealTimeCoach({
          geminiClient: mockGemini,
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          language: lang,
        });

        expect(coach.getLanguage()).toBe(lang);
      }
    });
  });

  describe('Fallback Phrases', () => {
    it('should use language-appropriate fallback phrases', async () => {
      const languages: SupportedLanguage[] = ['en', 'es', 'de', 'ru'];

      for (const lang of languages) {
        // Create coach with failing Gemini to trigger fallback
        const failingGemini = new MockGeminiClient();
        failingGemini.generateCoachingTip = async () => {
          throw new Error('API failed');
        };

        const coach = new RealTimeCoach({
          geminiClient: failingGemini,
          elevenLabsClient: mockElevenLabs,
          audioManager: mockAudio,
          language: lang,
          cooldownMs: 0,
        });

        mockElevenLabs.reset();

        await coach.onPoseAnalysis({
          score: 65,
          weakPoints: ['arms'],
          strongPoints: [],
          timestamp: Date.now(),
        });

        // Should still use correct language for fallback TTS
        expect(mockElevenLabs.requestHistory[0].language).toBe(lang);
      }
    });
  });

  describe('Cross-Service Language Coordination', () => {
    it('should coordinate language across coach, reviewer, and navigation', async () => {
      const targetLanguage: SupportedLanguage = 'de';

      const coach = new RealTimeCoach({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: targetLanguage,
        cooldownMs: 0,
      });

      const reviewer = new PerformanceReviewer({
        geminiClient: mockGemini,
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        language: targetLanguage,
      });

      const navigation = new VoiceNavigation({
        elevenLabsClient: mockElevenLabs,
        audioManager: mockAudio,
        router: mockRouter,
        language: targetLanguage,
      });

      // Use all services
      await coach.onPoseAnalysis({
        score: 65,
        weakPoints: ['arms'],
        strongPoints: [],
        timestamp: Date.now(),
      });

      await reviewer.reviewSession({
        song: {
          id: 'test',
          title: 'Test',
          artist: 'Test',
          duration: 180,
          audioFile: null,
          videoFile: null,
          poseFile: null,
        },
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'legs',
        weakestPart: 'arms',
      });

      await navigation.speakHelp();

      // All services should use the same language
      const allLanguages = [
        ...mockGemini.requestHistory.map((r) => r.language),
        ...mockElevenLabs.requestHistory.map((r) => r.language),
      ];

      expect(allLanguages.every((lang) => lang === targetLanguage)).toBe(true);
    });
  });
});
