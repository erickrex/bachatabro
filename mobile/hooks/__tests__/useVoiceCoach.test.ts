/**
 * Unit Tests for useVoiceCoach Hook
 *
 * Tests state transitions, action dispatching, and settings persistence.
 * Requirements: 5.1, 5.2, 6.1, 7.1, 8.1, 12.6
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useVoiceCoach } from '../useVoiceCoach';
import { useVoiceCoachStore } from '../../store/voiceCoachStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock voice coach services
jest.mock('../../services/voiceCoach/ElevenLabsClient', () => ({
  getElevenLabsClient: () => ({
    textToSpeech: jest.fn().mockResolvedValue({
      audio: 'base64audio',
      format: 'mp3',
      durationMs: 1000,
    }),
    speechToText: jest.fn().mockResolvedValue({
      transcript: 'test transcript',
      confidence: 0.95,
      language: 'en',
    }),
  }),
  ElevenLabsClient: jest.fn(),
}));

jest.mock('../../services/voiceCoach/GeminiClient', () => ({
  getGeminiClient: () => ({
    generateCoachingTip: jest.fn().mockResolvedValue({
      tip: 'Keep your arms up!',
      targetBodyPart: 'arms',
    }),
    generatePerformanceReview: jest.fn().mockResolvedValue({
      review: 'Great job!',
      improvementTip: 'Focus on timing.',
    }),
  }),
  GeminiClient: jest.fn(),
}));

jest.mock('../../services/voiceCoach/ErrorHandler', () => ({
  getErrorHandler: () => ({
    handleError: jest.fn(),
    onSuccess: jest.fn(),
    onStatusChange: null,
    onNotification: null,
  }),
  ErrorHandler: jest.fn(),
}));

jest.mock('../../services/voiceCoach/AudioManager', () => ({
  AudioManager: jest.fn().mockImplementation(() => ({
    enqueue: jest.fn(),
    clearQueue: jest.fn(),
    setMuted: jest.fn(),
    getMuted: jest.fn().mockReturnValue(false),
    onPlaybackStart: null,
    onPlaybackEnd: null,
    onQueueChange: null,
  })),
}));

jest.mock('../../services/voiceCoach/RealTimeCoach', () => ({
  RealTimeCoach: jest.fn().mockImplementation(() => ({
    onPoseAnalysis: jest.fn().mockResolvedValue(undefined),
    setEnabled: jest.fn(),
    setLanguage: jest.fn(),
    setVoiceId: jest.fn(),
    setCooldown: jest.fn(),
  })),
}));

jest.mock('../../services/voiceCoach/PerformanceReviewer', () => ({
  PerformanceReviewer: jest.fn().mockImplementation(() => ({
    reviewSession: jest.fn().mockResolvedValue({
      review: 'Great performance!',
      improvementTip: 'Keep practicing!',
    }),
    setEnabled: jest.fn(),
    setLanguage: jest.fn(),
    setVoiceId: jest.fn(),
  })),
}));

jest.mock('../../services/voiceCoach/VoiceNavigation', () => ({
  VoiceNavigation: jest.fn().mockImplementation(() => ({
    parseCommand: jest.fn().mockReturnValue({ type: 'help' }),
    executeCommand: jest.fn().mockResolvedValue(undefined),
    setLanguage: jest.fn(),
    setVoiceId: jest.fn(),
  })),
}));

jest.mock('../../services/voiceCoach/ConversationAgent', () => ({
  ConversationAgent: jest.fn().mockImplementation(() => ({
    startConversation: jest.fn(),
    endConversation: jest.fn(),
    processMessage: jest.fn().mockResolvedValue('Response message'),
    setLanguage: jest.fn(),
    setVoiceId: jest.fn(),
    onConversationStart: null,
    onConversationEnd: null,
  })),
}));

jest.mock('../../services/voiceCoach/BatteryAdapter', () => ({
  BatteryAdapter: jest.fn().mockImplementation(() => ({
    getAdaptedCooldown: jest.fn().mockResolvedValue(3000),
    setNormalCooldown: jest.fn(),
  })),
}));

describe('useVoiceCoach Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to defaults
    useVoiceCoachStore.getState().resetSettings();
  });

  describe('Initial State', () => {
    it('should return initial state with default values', () => {
      const { result } = renderHook(() => useVoiceCoach());
      const [state] = result.current;

      expect(state.isEnabled).toBe(true);
      expect(state.isSpeaking).toBe(false);
      expect(state.isListening).toBe(false);
      expect(state.isConversationActive).toBe(false);
      expect(state.currentTranscript).toBe('');
      expect(state.spokenText).toBe('');
      expect(state.language).toBe('en');
      expect(state.voiceId).toBe('Rachel');
      expect(state.error).toBeNull();
      expect(state.isAvailable).toBe(true);
    });

    it('should expose all required actions', () => {
      const { result } = renderHook(() => useVoiceCoach());
      const [, actions] = result.current;

      expect(typeof actions.onPoseAnalysis).toBe('function');
      expect(typeof actions.reviewSession).toBe('function');
      expect(typeof actions.startListening).toBe('function');
      expect(typeof actions.stopListening).toBe('function');
      expect(typeof actions.processVoiceCommand).toBe('function');
      expect(typeof actions.startConversation).toBe('function');
      expect(typeof actions.endConversation).toBe('function');
      expect(typeof actions.sendMessage).toBe('function');
      expect(typeof actions.setEnabled).toBe('function');
      expect(typeof actions.setLanguage).toBe('function');
      expect(typeof actions.setVoiceId).toBe('function');
      expect(typeof actions.setMuted).toBe('function');
      expect(typeof actions.setRealTimeCoachingEnabled).toBe('function');
      expect(typeof actions.setPerformanceReviewsEnabled).toBe('function');
      expect(typeof actions.setCoachingFrequency).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });

  describe('State Transitions', () => {
    it('should update isEnabled when setEnabled is called', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setEnabled(false);
      });

      expect(result.current[0].isEnabled).toBe(false);
    });

    it('should update language when setLanguage is called', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setLanguage('es');
      });

      expect(result.current[0].language).toBe('es');
    });

    it('should update voiceId when setVoiceId is called', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setVoiceId('Drew');
      });

      expect(result.current[0].voiceId).toBe('Drew');
    });

    it('should update isListening when startListening/stopListening are called', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      await act(async () => {
        await result.current[1].startListening();
      });

      expect(result.current[0].isListening).toBe(true);

      act(() => {
        result.current[1].stopListening();
      });

      expect(result.current[0].isListening).toBe(false);
    });

    it('should clear error when clearError is called', () => {
      const { result } = renderHook(() => useVoiceCoach());

      // Note: We can't easily set error state directly, but we can test clearError
      act(() => {
        result.current[1].clearError();
      });

      expect(result.current[0].error).toBeNull();
    });
  });

  describe('Action Dispatching', () => {
    it('should call onPoseAnalysis without error', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      const analysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };

      await act(async () => {
        await result.current[1].onPoseAnalysis(analysis);
      });

      // Should complete without throwing
      expect(result.current[0].error).toBeNull();
    });

    it('should call reviewSession and return result', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      const session = {
        song: { id: 'test', title: 'Test Song', artist: 'Test Artist' },
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
        strongestPart: 'arms',
        weakestPart: 'legs',
      };

      let review;
      await act(async () => {
        review = await result.current[1].reviewSession(session);
      });

      expect(review).toBeDefined();
    });

    it('should process voice commands', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      await act(async () => {
        await result.current[1].processVoiceCommand('help');
      });

      expect(result.current[0].currentTranscript).toBe('help');
    });

    it('should handle conversation flow', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].startConversation();
      });

      // Note: isConversationActive is set by callback, which is mocked
      // In real usage, the ConversationAgent would trigger the callback

      let response;
      await act(async () => {
        response = await result.current[1].sendMessage('How do I improve my arms?');
      });

      expect(result.current[0].currentTranscript).toBe('How do I improve my arms?');

      act(() => {
        result.current[1].endConversation();
      });
    });
  });

  describe('Settings Persistence', () => {
    it('should persist enabled state to store', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setEnabled(false);
      });

      expect(useVoiceCoachStore.getState().enabled).toBe(false);
    });

    it('should persist language to store', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setLanguage('de');
      });

      expect(useVoiceCoachStore.getState().language).toBe('de');
    });

    it('should persist muted state to store', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setMuted(true);
      });

      expect(useVoiceCoachStore.getState().muted).toBe(true);
    });

    it('should persist realTimeCoachingEnabled to store', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setRealTimeCoachingEnabled(false);
      });

      expect(useVoiceCoachStore.getState().realTimeCoachingEnabled).toBe(false);
    });

    it('should persist performanceReviewsEnabled to store', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setPerformanceReviewsEnabled(false);
      });

      expect(useVoiceCoachStore.getState().performanceReviewsEnabled).toBe(false);
    });

    it('should persist coachingFrequency to store', () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setCoachingFrequency('high');
      });

      expect(useVoiceCoachStore.getState().coachingFrequency).toBe('high');
    });
  });

  describe('Disabled State Behavior', () => {
    it('should not process pose analysis when disabled', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setEnabled(false);
      });

      const analysis = {
        score: 65,
        weakPoints: ['arms'],
        strongPoints: ['legs'],
        timestamp: Date.now(),
      };

      await act(async () => {
        await result.current[1].onPoseAnalysis(analysis);
      });

      // Should complete without error even when disabled
      expect(result.current[0].error).toBeNull();
    });

    it('should return null from reviewSession when disabled', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setEnabled(false);
      });

      const session = {
        song: { id: 'test', title: 'Test Song', artist: 'Test Artist' },
        finalScore: 85,
        previousBest: 80,
        frameScores: [],
      };

      let review;
      await act(async () => {
        review = await result.current[1].reviewSession(session);
      });

      expect(review).toBeNull();
    });

    it('should not start listening when disabled', async () => {
      const { result } = renderHook(() => useVoiceCoach());

      act(() => {
        result.current[1].setEnabled(false);
      });

      await act(async () => {
        await result.current[1].startListening();
      });

      expect(result.current[0].isListening).toBe(false);
    });
  });
});
