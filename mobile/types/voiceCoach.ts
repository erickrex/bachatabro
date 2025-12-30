/**
 * Type definitions for Voice Coach integration
 */
import type { SessionCoverage } from './game';

// Supported languages for voice coaching
export type SupportedLanguage = 'en' | 'es' | 'de' | 'ru';

// Voice coach settings
export interface VoiceCoachSettings {
  enabled: boolean;
  language: SupportedLanguage;
  voiceId: string;
  realTimeCoachingEnabled: boolean;
  performanceReviewsEnabled: boolean;
  coachingFrequency: 'low' | 'normal' | 'high'; // cooldown: 6s, 3s, 1.5s
  muted: boolean;
}

export const DEFAULT_VOICE_COACH_SETTINGS: VoiceCoachSettings = {
  enabled: true,
  language: 'en',
  voiceId: 'Rachel',
  realTimeCoachingEnabled: true,
  performanceReviewsEnabled: true,
  coachingFrequency: 'normal',
  muted: false,
};

// ElevenLabs API types
export interface TTSRequest {
  text: string;
  voiceId?: string;
  language?: SupportedLanguage;
}

export interface TTSResponse {
  audio: string; // base64 encoded MP3
  format: 'mp3';
  durationMs: number;
}

export interface STTRequest {
  audio: string; // base64 encoded audio
  language?: SupportedLanguage;
}

export interface STTResponse {
  transcript: string;
  confidence: number;
  language: string;
}

// Gemini API types
export interface CoachingTipRequest {
  score: number;
  weakPoints: string[];
  strongPoints: string[];
  language?: SupportedLanguage;
}

export interface CoachingTipResponse {
  tip: string;
  targetBodyPart: string;
}

export interface PerformanceReviewRequest {
  songTitle: string;
  songArtist: string;
  finalScore: number;
  previousBest?: number | null;
  strongestPart?: string;
  weakestPart?: string;
  totalFrames?: number;
  language?: SupportedLanguage;
  coverage?: SessionCoverage;
}

export interface PerformanceReviewResponse {
  review: string;
  improvementTip: string;
}

// Voice coach state
export interface VoiceCoachState {
  isEnabled: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  currentTranscript: string;
  spokenText: string;
  language: SupportedLanguage;
  voiceId: string;
  error: string | null;
}

// Pose analysis for coaching
export interface PoseAnalysis {
  score: number;
  weakPoints: string[];
  strongPoints: string[];
  timestamp: number;
}

// Audio clip for playback queue
export interface AudioClip {
  id: string;
  audio: string; // base64
  priority: 'low' | 'normal' | 'high';
  text: string; // for transcript display
}

// Voice command types
export type VoiceCommand =
  | { type: 'play_song'; songName: string }
  | { type: 'show_leaderboard' }
  | { type: 'get_best_score'; songName?: string }
  | { type: 'open_settings' }
  | { type: 'help' }
  | { type: 'unknown'; transcript: string };

// API error types
export interface VoiceCoachError {
  type: 'network' | 'rate_limit' | 'api_error' | 'invalid_request';
  message: string;
  retryAfter?: number;
  context?: Record<string, unknown>;
}
