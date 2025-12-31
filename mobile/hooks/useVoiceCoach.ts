/**
 * useVoiceCoach Hook
 *
 * Unified interface for all voice coach functionality.
 * Combines RealTimeCoach, PerformanceReviewer, VoiceNavigation,
 * and ConversationAgent into a single hook.
 *
 * Requirements: 5.1, 5.2, 6.1, 7.1, 8.1
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useVoiceCoachStore } from '../store/voiceCoachStore';
import { RealTimeCoach } from '../services/voiceCoach/RealTimeCoach';
import { PerformanceReviewer, GameSession, PerformanceReview } from '../services/voiceCoach/PerformanceReviewer';
import { VoiceNavigation, Router } from '../services/voiceCoach/VoiceNavigation';
import { ConversationAgent } from '../services/voiceCoach/ConversationAgent';
import { AudioManager } from '../services/voiceCoach/AudioManager';
import { ElevenLabsClient, getElevenLabsClient } from '../services/voiceCoach/ElevenLabsClient';
import { GeminiClient, getGeminiClient } from '../services/voiceCoach/GeminiClient';
import { ErrorHandler, getErrorHandler } from '../services/voiceCoach/ErrorHandler';
import { BatteryAdapter } from '../services/voiceCoach/BatteryAdapter';
import { COACHING_COOLDOWNS } from '../config/voiceConfig';
import type { PoseAnalysis, SupportedLanguage, VoiceCommand } from '../types/voiceCoach';

/**
 * Voice Coach State exposed by the hook
 */
export interface VoiceCoachState {
  isEnabled: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isConversationActive: boolean;
  currentTranscript: string;
  spokenText: string;
  language: SupportedLanguage;
  voiceId: string;
  error: string | null;
  isAvailable: boolean;
}

/**
 * Voice Coach Actions exposed by the hook
 */
export interface VoiceCoachActions {
  // Real-time coaching
  onPoseAnalysis: (analysis: PoseAnalysis) => Promise<void>;

  // Performance review
  reviewSession: (session: GameSession) => Promise<PerformanceReview | null>;

  // Voice input
  startListening: () => Promise<void>;
  stopListening: () => void;

  // Voice navigation
  processVoiceCommand: (transcript: string) => Promise<void>;

  // Conversation
  startConversation: () => void;
  endConversation: () => void;
  sendMessage: (message: string) => Promise<string>;

  // Settings
  setEnabled: (enabled: boolean) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setVoiceId: (voiceId: string) => void;
  setMuted: (muted: boolean) => void;
  setRealTimeCoachingEnabled: (enabled: boolean) => void;
  setPerformanceReviewsEnabled: (enabled: boolean) => void;
  setCoachingFrequency: (frequency: 'low' | 'normal' | 'high') => void;

  // Error handling
  clearError: () => void;
}

/**
 * Hook return type
 */
export type UseVoiceCoachReturn = [VoiceCoachState, VoiceCoachActions];

/**
 * useVoiceCoach Hook
 *
 * Provides a unified interface for all voice coach functionality.
 * Manages service instances and synchronizes with the Zustand store.
 */
export function useVoiceCoach(): UseVoiceCoachReturn {
  // Get router for navigation
  const router = useRouter();

  // Get settings from store
  const storeSettings = useVoiceCoachStore();

  // Local state for dynamic values
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [spokenText, setSpokenText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  // Service instances (refs to persist across renders)
  const audioManagerRef = useRef<AudioManager | null>(null);
  const elevenLabsClientRef = useRef<ElevenLabsClient | null>(null);
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const realTimeCoachRef = useRef<RealTimeCoach | null>(null);
  const performanceReviewerRef = useRef<PerformanceReviewer | null>(null);
  const voiceNavigationRef = useRef<VoiceNavigation | null>(null);
  const conversationAgentRef = useRef<ConversationAgent | null>(null);
  const errorHandlerRef = useRef<ErrorHandler | null>(null);
  const batteryAdapterRef = useRef<BatteryAdapter | null>(null);

  // Initialize services on mount
  useEffect(() => {
    try {
      // Initialize clients
      elevenLabsClientRef.current = getElevenLabsClient();
      geminiClientRef.current = getGeminiClient();
      errorHandlerRef.current = getErrorHandler();

      // Initialize audio manager
      audioManagerRef.current = new AudioManager();

      // Set up audio manager callbacks
      if (audioManagerRef.current) {
        audioManagerRef.current.onPlaybackStart = (clip) => {
          setIsSpeaking(true);
          setSpokenText(clip.text);
        };

        audioManagerRef.current.onPlaybackEnd = () => {
          setIsSpeaking(false);
        };
      }

      // Initialize battery adapter
      batteryAdapterRef.current = new BatteryAdapter({
        normalCooldownMs: COACHING_COOLDOWNS[storeSettings.coachingFrequency] || 3000,
      });

      // Initialize real-time coach (only if dependencies are available)
      if (geminiClientRef.current && elevenLabsClientRef.current && audioManagerRef.current) {
        realTimeCoachRef.current = new RealTimeCoach({
          geminiClient: geminiClientRef.current,
          elevenLabsClient: elevenLabsClientRef.current,
          audioManager: audioManagerRef.current,
          language: storeSettings.language,
          cooldownMs: COACHING_COOLDOWNS[storeSettings.coachingFrequency] || 3000,
          enabled: storeSettings.realTimeCoachingEnabled && storeSettings.enabled,
          voiceId: storeSettings.voiceId,
          batteryAdapter: batteryAdapterRef.current,
        });

        // Initialize performance reviewer
        performanceReviewerRef.current = new PerformanceReviewer({
          geminiClient: geminiClientRef.current,
          elevenLabsClient: elevenLabsClientRef.current,
          audioManager: audioManagerRef.current,
          language: storeSettings.language,
          voiceId: storeSettings.voiceId,
          enabled: storeSettings.performanceReviewsEnabled && storeSettings.enabled,
        });

        // Initialize voice navigation
        const routerAdapter: Router = {
          push: (route) => {
            if (typeof route === 'string') {
              router.push(route as any);
            } else {
              router.push(route as any);
            }
          },
        };

        voiceNavigationRef.current = new VoiceNavigation({
          elevenLabsClient: elevenLabsClientRef.current,
          audioManager: audioManagerRef.current,
          router: routerAdapter,
          language: storeSettings.language,
          voiceId: storeSettings.voiceId,
        });

        // Initialize conversation agent
        conversationAgentRef.current = new ConversationAgent({
          geminiClient: geminiClientRef.current,
          elevenLabsClient: elevenLabsClientRef.current,
          audioManager: audioManagerRef.current,
          language: storeSettings.language,
          voiceId: storeSettings.voiceId,
        });

        // Set up conversation agent callbacks
        if (conversationAgentRef.current) {
          conversationAgentRef.current.onConversationStart = () => {
            setIsConversationActive(true);
          };

          conversationAgentRef.current.onConversationEnd = () => {
            setIsConversationActive(false);
          };
        }
      }

      // Set up error handler callbacks
      if (errorHandlerRef.current) {
        errorHandlerRef.current.onStatusChange = (status) => {
          setIsAvailable(status !== 'disabled');
        };

        errorHandlerRef.current.onNotification = (message) => {
          setError(message);
        };
      }
    } catch (err) {
      console.error('[useVoiceCoach] Error initializing services:', err);
      setError('Voice coach initialization failed');
      setIsAvailable(false);
    }

    // Cleanup on unmount
    return () => {
      try {
        conversationAgentRef.current?.endConversation();
      } catch (err) {
        console.error('[useVoiceCoach] Error during cleanup:', err);
      }
    };
  }, []);

  // Sync settings changes to services
  useEffect(() => {
    try {
      if (realTimeCoachRef.current) {
        realTimeCoachRef.current.setEnabled(
          storeSettings.realTimeCoachingEnabled && storeSettings.enabled && !storeSettings.muted
        );
        realTimeCoachRef.current.setLanguage(storeSettings.language);
        realTimeCoachRef.current.setVoiceId(storeSettings.voiceId);
        realTimeCoachRef.current.setCooldown(COACHING_COOLDOWNS[storeSettings.coachingFrequency] || 3000);
      }

      if (performanceReviewerRef.current) {
        performanceReviewerRef.current.setEnabled(
          storeSettings.performanceReviewsEnabled && storeSettings.enabled && !storeSettings.muted
        );
        performanceReviewerRef.current.setLanguage(storeSettings.language);
        performanceReviewerRef.current.setVoiceId(storeSettings.voiceId);
      }

      if (voiceNavigationRef.current) {
        voiceNavigationRef.current.setLanguage(storeSettings.language);
        voiceNavigationRef.current.setVoiceId(storeSettings.voiceId);
      }

      if (conversationAgentRef.current) {
        conversationAgentRef.current.setLanguage(storeSettings.language);
        conversationAgentRef.current.setVoiceId(storeSettings.voiceId);
      }

      if (audioManagerRef.current) {
        audioManagerRef.current.setMuted(storeSettings.muted);
      }

      if (batteryAdapterRef.current) {
        batteryAdapterRef.current.setNormalCooldown(COACHING_COOLDOWNS[storeSettings.coachingFrequency] || 3000);
      }
    } catch (err) {
      console.error('[useVoiceCoach] Error syncing settings:', err);
    }
  }, [
    storeSettings.enabled,
    storeSettings.language,
    storeSettings.voiceId,
    storeSettings.realTimeCoachingEnabled,
    storeSettings.performanceReviewsEnabled,
    storeSettings.coachingFrequency,
    storeSettings.muted,
  ]);

  // Actions

  /**
   * Process pose analysis for real-time coaching
   * Requirements: 5.1, 5.2
   */
  const onPoseAnalysis = useCallback(async (analysis: PoseAnalysis): Promise<void> => {
    if (!realTimeCoachRef.current || !storeSettings.enabled || !isAvailable) {
      return;
    }

    try {
      await realTimeCoachRef.current.onPoseAnalysis(analysis);
      errorHandlerRef.current?.onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errorHandlerRef.current?.handleError(
        { type: 'api_error', message: errorMessage },
        { analysis, operation: 'onPoseAnalysis' }
      );
    }
  }, [storeSettings.enabled, isAvailable]);

  /**
   * Generate and speak performance review
   * Requirement: 6.1
   */
  const reviewSession = useCallback(async (session: GameSession): Promise<PerformanceReview | null> => {
    if (!performanceReviewerRef.current || !storeSettings.enabled || !isAvailable) {
      return null;
    }

    try {
      const review = await performanceReviewerRef.current.reviewSession(session);
      errorHandlerRef.current?.onSuccess();
      return review;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errorHandlerRef.current?.handleError(
        { type: 'api_error', message: errorMessage },
        { operation: 'reviewSession' }
      );
      return null;
    }
  }, [storeSettings.enabled, isAvailable]);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(async (): Promise<void> => {
    if (!elevenLabsClientRef.current || !storeSettings.enabled) {
      return;
    }

    setIsListening(true);
    setCurrentTranscript('');

    // Note: Actual audio recording would be implemented here
    // using expo-av or similar. For now, this is a placeholder.
    // The transcript would come from ElevenLabs STT.
  }, [storeSettings.enabled]);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback((): void => {
    setIsListening(false);
  }, []);

  /**
   * Process a voice command transcript
   * Requirement: 8.1
   */
  const processVoiceCommand = useCallback(async (transcript: string): Promise<void> => {
    if (!voiceNavigationRef.current || !storeSettings.enabled) {
      return;
    }

    setCurrentTranscript(transcript);

    try {
      const command = voiceNavigationRef.current.parseCommand(transcript);
      await voiceNavigationRef.current.executeCommand(command);
      errorHandlerRef.current?.onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errorHandlerRef.current?.handleError(
        { type: 'api_error', message: errorMessage },
        { operation: 'processVoiceCommand' }
      );
    }
  }, [storeSettings.enabled]);

  /**
   * Start conversation mode
   * Requirement: 7.1
   */
  const startConversation = useCallback((): void => {
    if (!conversationAgentRef.current || !storeSettings.enabled) {
      return;
    }

    conversationAgentRef.current.startConversation();
  }, [storeSettings.enabled]);

  /**
   * End conversation mode
   */
  const endConversation = useCallback((): void => {
    if (!conversationAgentRef.current) {
      return;
    }

    conversationAgentRef.current.endConversation();
  }, []);

  /**
   * Send a message in conversation mode
   * Requirement: 7.1
   */
  const sendMessage = useCallback(async (message: string): Promise<string> => {
    if (!conversationAgentRef.current || !storeSettings.enabled) {
      return '';
    }

    setCurrentTranscript(message);

    try {
      const response = await conversationAgentRef.current.processMessage(message);
      errorHandlerRef.current?.onSuccess();
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errorHandlerRef.current?.handleError(
        { type: 'api_error', message: errorMessage },
        { operation: 'sendMessage' }
      );
      return '';
    }
  }, [storeSettings.enabled]);

  /**
   * Clear current error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Build state object
  const state: VoiceCoachState = {
    isEnabled: storeSettings.enabled,
    isSpeaking,
    isListening,
    isConversationActive,
    currentTranscript,
    spokenText,
    language: storeSettings.language,
    voiceId: storeSettings.voiceId,
    error,
    isAvailable,
  };

  // Build actions object
  const actions: VoiceCoachActions = {
    onPoseAnalysis,
    reviewSession,
    startListening,
    stopListening,
    processVoiceCommand,
    startConversation,
    endConversation,
    sendMessage,
    setEnabled: storeSettings.setEnabled,
    setLanguage: storeSettings.setLanguage,
    setVoiceId: storeSettings.setVoiceId,
    setMuted: storeSettings.setMuted,
    setRealTimeCoachingEnabled: storeSettings.setRealTimeCoachingEnabled,
    setPerformanceReviewsEnabled: storeSettings.setPerformanceReviewsEnabled,
    setCoachingFrequency: storeSettings.setCoachingFrequency,
    clearError,
  };

  return [state, actions];
}

export default useVoiceCoach;
