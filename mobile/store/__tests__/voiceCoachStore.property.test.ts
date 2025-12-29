/**
 * Property-Based Tests for Voice Coach Store Persistence
 *
 * Feature: elevenlabs-voice-coach, Property 15: User Preference Persistence (Round-Trip)
 * Validates: Requirements 9.6, 12.6
 *
 * Tests that user preferences can be saved and loaded correctly,
 * implementing a round-trip property test.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveVoiceCoachSettings,
  loadVoiceCoachSettings,
  clearVoiceCoachSettings,
} from '../voiceCoachStore';
import type { VoiceCoachSettings, SupportedLanguage } from '../../types/voiceCoach';
import { propertyConfig } from '../../test/propertyConfig';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Voice Coach Store Persistence Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup AsyncStorage mock to actually store data in memory
    const storage: Record<string, string> = {};
    
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key: string, value: string) => {
        storage[key] = value;
      }
    );
    
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      async (key: string) => {
        return storage[key] || null;
      }
    );
    
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(
      async (key: string) => {
        delete storage[key];
      }
    );
  });

  /**
   * Property 15: User Preference Persistence (Round-Trip)
   *
   * For any user preference (language, voice, settings), saving the preference
   * and then loading it should return the same value.
   */
  describe('Property 15: User Preference Persistence (Round-Trip)', () => {
    // Arbitrary for VoiceCoachSettings
    const voiceCoachSettingsArb = fc.record({
      enabled: fc.boolean(),
      language: fc.constantFrom<SupportedLanguage>('en', 'es', 'de', 'ru'),
      voiceId: fc.string({ minLength: 1, maxLength: 20 }),
      realTimeCoachingEnabled: fc.boolean(),
      performanceReviewsEnabled: fc.boolean(),
      coachingFrequency: fc.constantFrom<'low' | 'normal' | 'high'>(
        'low',
        'normal',
        'high'
      ),
      muted: fc.boolean(),
    });

    it('should preserve settings through save/load round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(voiceCoachSettingsArb, async (settings) => {
          // Save settings
          await saveVoiceCoachSettings(settings);

          // Load settings
          const loaded = await loadVoiceCoachSettings();

          // Verify round-trip: loaded settings should match saved settings
          expect(loaded).not.toBeNull();
          expect(loaded?.enabled).toBe(settings.enabled);
          expect(loaded?.language).toBe(settings.language);
          expect(loaded?.voiceId).toBe(settings.voiceId);
          expect(loaded?.realTimeCoachingEnabled).toBe(
            settings.realTimeCoachingEnabled
          );
          expect(loaded?.performanceReviewsEnabled).toBe(
            settings.performanceReviewsEnabled
          );
          expect(loaded?.coachingFrequency).toBe(settings.coachingFrequency);
          expect(loaded?.muted).toBe(settings.muted);
        }),
        propertyConfig({ numRuns: 100 }))
      );
    });

    it('should preserve language preference through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<SupportedLanguage>('en', 'es', 'de', 'ru'),
          async (language) => {
            // Create settings with specific language
            const settings: VoiceCoachSettings = {
              enabled: true,
              language,
              voiceId: 'TestVoice',
              realTimeCoachingEnabled: true,
              performanceReviewsEnabled: true,
              coachingFrequency: 'normal',
              muted: false,
            };

            // Save and load
            await saveVoiceCoachSettings(settings);
            const loaded = await loadVoiceCoachSettings();

            // Verify language is preserved
            expect(loaded?.language).toBe(language);
          }
        ),
        propertyConfig({ numRuns: 100 }))
      );
    });

    it('should preserve voice ID through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (voiceId) => {
            // Create settings with specific voice ID
            const settings: VoiceCoachSettings = {
              enabled: true,
              language: 'en',
              voiceId,
              realTimeCoachingEnabled: true,
              performanceReviewsEnabled: true,
              coachingFrequency: 'normal',
              muted: false,
            };

            // Save and load
            await saveVoiceCoachSettings(settings);
            const loaded = await loadVoiceCoachSettings();

            // Verify voice ID is preserved
            expect(loaded?.voiceId).toBe(voiceId);
          }
        ),
        propertyConfig({ numRuns: 100 }))
      );
    });

    it('should preserve boolean flags through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          async (enabled, realTime, reviews, muted) => {
            // Create settings with specific boolean values
            const settings: VoiceCoachSettings = {
              enabled,
              language: 'en',
              voiceId: 'TestVoice',
              realTimeCoachingEnabled: realTime,
              performanceReviewsEnabled: reviews,
              coachingFrequency: 'normal',
              muted,
            };

            // Save and load
            await saveVoiceCoachSettings(settings);
            const loaded = await loadVoiceCoachSettings();

            // Verify all boolean flags are preserved
            expect(loaded?.enabled).toBe(enabled);
            expect(loaded?.realTimeCoachingEnabled).toBe(realTime);
            expect(loaded?.performanceReviewsEnabled).toBe(reviews);
            expect(loaded?.muted).toBe(muted);
          }
        ),
        propertyConfig({ numRuns: 100 }))
      );
    });

    it('should preserve coaching frequency through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<'low' | 'normal' | 'high'>('low', 'normal', 'high'),
          async (frequency) => {
            // Create settings with specific frequency
            const settings: VoiceCoachSettings = {
              enabled: true,
              language: 'en',
              voiceId: 'TestVoice',
              realTimeCoachingEnabled: true,
              performanceReviewsEnabled: true,
              coachingFrequency: frequency,
              muted: false,
            };

            // Save and load
            await saveVoiceCoachSettings(settings);
            const loaded = await loadVoiceCoachSettings();

            // Verify frequency is preserved
            expect(loaded?.coachingFrequency).toBe(frequency);
          }
        ),
        propertyConfig({ numRuns: 100 }))
      );
    });

    it('should return null when no settings are stored', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Clear any existing settings
          await clearVoiceCoachSettings();

          // Try to load settings
          const loaded = await loadVoiceCoachSettings();

          // Should return null when nothing is stored
          expect(loaded).toBeNull();
        }),
        propertyConfig({ numRuns: 10 }))
      );
    });

    it('should handle multiple save/load cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(voiceCoachSettingsArb, { minLength: 2, maxLength: 5 }),
          async (settingsArray) => {
            let lastSaved: VoiceCoachSettings | null = null;

            // Perform multiple save/load cycles
            for (const settings of settingsArray) {
              await saveVoiceCoachSettings(settings);
              lastSaved = settings;
            }

            // Load final settings
            const loaded = await loadVoiceCoachSettings();

            // Should match the last saved settings
            expect(loaded).not.toBeNull();
            expect(loaded?.enabled).toBe(lastSaved?.enabled);
            expect(loaded?.language).toBe(lastSaved?.language);
            expect(loaded?.voiceId).toBe(lastSaved?.voiceId);
          }
        ),
        propertyConfig({ numRuns: 50 }))
      );
    });

    it('should handle clear and reload', async () => {
      await fc.assert(
        fc.asyncProperty(voiceCoachSettingsArb, async (settings) => {
          // Save settings
          await saveVoiceCoachSettings(settings);

          // Verify they were saved
          let loaded = await loadVoiceCoachSettings();
          expect(loaded).not.toBeNull();

          // Clear settings
          await clearVoiceCoachSettings();

          // Verify they were cleared
          loaded = await loadVoiceCoachSettings();
          expect(loaded).toBeNull();
        }),
        propertyConfig({ numRuns: 50 }))
      );
    });
  });
});
