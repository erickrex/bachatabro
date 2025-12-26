/**
 * Voice configuration by language for ElevenLabs integration
 */

import type { SupportedLanguage } from '../types/voiceCoach';

export interface VoiceLanguageConfig {
  name: string;
  defaultVoice: string;
  availableVoices: string[];
  elevenLabsModel: string;
}

export const VOICE_CONFIG: Record<SupportedLanguage, VoiceLanguageConfig> = {
  en: {
    name: 'English',
    defaultVoice: 'Rachel',
    availableVoices: ['Rachel', 'Drew', 'Clyde', 'Paul', 'Domi'],
    elevenLabsModel: 'eleven_turbo_v2',
  },
  es: {
    name: 'Spanish',
    defaultVoice: 'Laura',
    availableVoices: ['Laura', 'Pablo', 'Sofia'],
    elevenLabsModel: 'eleven_multilingual_v2',
  },
  de: {
    name: 'German',
    defaultVoice: 'Hans',
    availableVoices: ['Hans', 'Greta', 'Klaus'],
    elevenLabsModel: 'eleven_multilingual_v2',
  },
  ru: {
    name: 'Russian',
    defaultVoice: 'Natasha',
    availableVoices: ['Natasha', 'Ivan', 'Olga'],
    elevenLabsModel: 'eleven_multilingual_v2',
  },
};

// Get default voice for a language
export function getDefaultVoice(language: SupportedLanguage): string {
  return VOICE_CONFIG[language]?.defaultVoice || VOICE_CONFIG.en.defaultVoice;
}

// Get available voices for a language
export function getAvailableVoices(language: SupportedLanguage): string[] {
  return VOICE_CONFIG[language]?.availableVoices || VOICE_CONFIG.en.availableVoices;
}

// Get language display name
export function getLanguageName(language: SupportedLanguage): string {
  return VOICE_CONFIG[language]?.name || 'English';
}

// Get language-appropriate voice for a given language and optional voice ID
// If voiceId is provided and valid for the language, returns it
// Otherwise returns the default voice for that language
export function getLanguageAppropriateVoice(
  language: SupportedLanguage,
  voiceId?: string
): string {
  const config = VOICE_CONFIG[language];
  
  // If voiceId is provided and is in the available voices for this language, use it
  if (voiceId && config.availableVoices.includes(voiceId)) {
    return voiceId;
  }
  
  // Otherwise return the default voice for this language
  return config.defaultVoice;
}

// Get the ElevenLabs model for a given language
export function getElevenLabsModel(language: SupportedLanguage): string {
  return VOICE_CONFIG[language]?.elevenLabsModel || VOICE_CONFIG.en.elevenLabsModel;
}

// Cooldown values by frequency setting (in milliseconds)
export const COACHING_COOLDOWNS = {
  low: 6000,    // 6 seconds
  normal: 3000, // 3 seconds
  high: 1500,   // 1.5 seconds
};
