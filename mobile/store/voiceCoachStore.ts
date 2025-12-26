/**
 * Voice Coach Store
 *
 * Manages voice coach state and persists settings to AsyncStorage.
 * Uses Zustand for state management with AsyncStorage persistence.
 *
 * Requirements: 9.6, 12.6
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VoiceCoachSettings, SupportedLanguage } from '../types/voiceCoach';
import { DEFAULT_VOICE_COACH_SETTINGS } from '../types/voiceCoach';
import { getLanguageAppropriateVoice } from '../config/voiceConfig';

export interface VoiceCoachStore extends VoiceCoachSettings {
  // Actions
  setEnabled: (enabled: boolean) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setVoiceId: (voiceId: string) => void;
  setRealTimeCoachingEnabled: (enabled: boolean) => void;
  setPerformanceReviewsEnabled: (enabled: boolean) => void;
  setCoachingFrequency: (frequency: 'low' | 'normal' | 'high') => void;
  setMuted: (muted: boolean) => void;
  resetSettings: () => void;
}

/**
 * Voice Coach Store with AsyncStorage persistence
 *
 * Automatically saves settings to AsyncStorage and loads them on app startup.
 */
export const useVoiceCoachStore = create<VoiceCoachStore>()(
  persist(
    (set) => ({
      // Initial state from defaults
      ...DEFAULT_VOICE_COACH_SETTINGS,

      // Actions
      setEnabled: (enabled) => set({ enabled }),

      setLanguage: (language) =>
        set((state) => ({
          language,
          // Update voice to be appropriate for the new language
          voiceId: getLanguageAppropriateVoice(language, state.voiceId),
        })),

      setVoiceId: (voiceId) => set({ voiceId }),

      setRealTimeCoachingEnabled: (enabled) =>
        set({ realTimeCoachingEnabled: enabled }),

      setPerformanceReviewsEnabled: (enabled) =>
        set({ performanceReviewsEnabled: enabled }),

      setCoachingFrequency: (frequency) => set({ coachingFrequency: frequency }),

      setMuted: (muted) => set({ muted }),

      resetSettings: () => set(DEFAULT_VOICE_COACH_SETTINGS),
    }),
    {
      name: 'voice-coach-settings', // Storage key
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Load voice coach settings from AsyncStorage
 *
 * This is called automatically by Zustand's persist middleware,
 * but can be called manually if needed.
 */
export async function loadVoiceCoachSettings(): Promise<VoiceCoachSettings | null> {
  try {
    const stored = await AsyncStorage.getItem('voice-coach-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state as VoiceCoachSettings;
    }
    return null;
  } catch (error) {
    console.error('[VoiceCoachStore] Error loading settings:', error);
    return null;
  }
}

/**
 * Save voice coach settings to AsyncStorage
 *
 * This is called automatically by Zustand's persist middleware,
 * but can be called manually if needed.
 */
export async function saveVoiceCoachSettings(
  settings: VoiceCoachSettings
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      'voice-coach-settings',
      JSON.stringify({ state: settings, version: 0 })
    );
  } catch (error) {
    console.error('[VoiceCoachStore] Error saving settings:', error);
  }
}

/**
 * Clear voice coach settings from AsyncStorage
 */
export async function clearVoiceCoachSettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem('voice-coach-settings');
  } catch (error) {
    console.error('[VoiceCoachStore] Error clearing settings:', error);
  }
}
