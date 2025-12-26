/**
 * API configuration for Voice Coach backend
 */

// Backend URL configuration
// In production, this should be set via environment variables
export const API_CONFIG = {
  // Base URL for the backend proxy
  // Development: http://localhost:8080
  // Production: Your deployed Cloud Run/Functions URL
  baseUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080',

  // Request timeout in milliseconds
  timeout: 10000,

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // ms

  // Rate limiting
  maxRequestsPerMinute: 100,
};

// Endpoint paths
export const ENDPOINTS = {
  // ElevenLabs proxy
  elevenlabs: {
    tts: '/elevenlabs/tts',
    stt: '/elevenlabs/stt',
    voices: '/elevenlabs/voices',
    health: '/elevenlabs/health',
  },
  // Gemini proxy
  gemini: {
    coachingTip: '/gemini/coaching-tip',
    performanceReview: '/gemini/performance-review',
    health: '/gemini/health',
  },
  // Global
  health: '/health',
};

// Build full URL for an endpoint
export function buildUrl(endpoint: string): string {
  return `${API_CONFIG.baseUrl}${endpoint}`;
}
