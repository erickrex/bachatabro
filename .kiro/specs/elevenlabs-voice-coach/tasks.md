# Implementation Plan: ElevenLabs Voice Coach Integration

## Overview

This implementation plan transforms Bachata Bro into an AI-powered voice coaching dance app by integrating ElevenLabs voice AI and Google Cloud Gemini. The plan follows a phased approach: backend proxy setup first, then mobile client services, followed by UI integration and testing.

## Tasks

- [x] 1. Set up Backend Proxy Infrastructure
  - [x] 1.1 Initialize Google Cloud Functions project with UV and pyproject.toml
    - Create `backend/functions/` directory structure
    - Initialize pyproject.toml with fastapi, uvicorn, elevenlabs, google-cloud-aiplatform dependencies
    - Create .env.example with required environment variables
    - Create README.md with UV installation and setup instructions
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [x] 1.2 Implement ElevenLabs proxy endpoints
    - Create `backend/functions/src/elevenlabs.py` with TTS and STT endpoints
    - Implement text length validation (max 5000 characters)
    - Add rate limiting middleware (100 requests/minute)
    - Return base64 encoded audio for TTS responses
    - _Requirements: 1.1, 1.4, 2.1, 2.5, 3.2_

  - [x] 1.3 Write property tests for ElevenLabs proxy
    - **Property 4: Text Length Boundary Validation**
    - **Validates: Requirements 2.5**

  - [x] 1.4 Implement Gemini proxy endpoints
    - Create `backend/functions/src/gemini.py` with coaching-tip and performance-review endpoints
    - Implement Coach Rhythm personality in prompts
    - Add word count validation for responses
    - Support language parameter for multilingual responses
    - _Requirements: 1.2, 4.1, 4.2, 4.4, 4.5_

  - [x] 1.5 Write property tests for Gemini proxy
    - **Property 5: Generated Text Word Count Limits**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 1.6 Implement authentication and error handling middleware
    - Create request validation middleware
    - Implement error response mapping (400, 401, 429, 500)
    - Add request logging for monitoring
    - _Requirements: 1.3, 1.5, 1.6_

  - [x] 1.7 Write property tests for error handling
    - **Property 3: Error Response Code Mapping**
    - **Validates: Requirements 1.5**

- [x] 2. Checkpoint - Backend Proxy Complete
  - Ensure all backend tests pass with `uv run pytest`
  - Deploy to Google Cloud Functions
  - Test endpoints manually with curl
  - Ask the user if questions arise


- [x] 3. Implement Mobile API Client Services
  - [x] 3.1 Create API configuration and types
    - Create `mobile/config/api.ts` with backend URL configuration
    - Create `mobile/types/voiceCoach.ts` with TypeScript interfaces
    - Create `mobile/config/voiceConfig.ts` with language/voice configuration
    - _Requirements: 9.1, 9.4_

  - [x] 3.2 Implement ElevenLabsClient service
    - Create `mobile/services/voiceCoach/ElevenLabsClient.ts`
    - Implement textToSpeech method with base64 audio response
    - Implement speechToText method for voice input
    - Add error handling with graceful fallback
    - _Requirements: 2.1, 2.3, 2.6, 3.2, 3.5_

  - [x] 3.3 Implement GeminiClient service
    - Create `mobile/services/voiceCoach/GeminiClient.ts`
    - Implement generateCoachingTip method
    - Implement generatePerformanceReview method
    - Add fallback to pre-defined phrases on error
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 3.4 Write unit tests for API clients
    - Test ElevenLabsClient with mocked responses
    - Test GeminiClient with mocked responses
    - Test error handling and fallback behavior
    - _Requirements: 2.6, 4.6, 13.2, 13.3_

- [x] 4. Implement Audio Playback System
  - [x] 4.1 Create AudioManager service
    - Create `mobile/services/voiceCoach/AudioManager.ts`
    - Implement audio queue with priority levels
    - Implement play, pause, enqueue, clearQueue methods
    - Add audio ducking for background music
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 4.2 Write property tests for AudioManager
    - **Property 8: Audio Queue Management**
    - **Validates: Requirements 5.4, 10.3, 10.4**

  - [x] 4.3 Write property tests for audio ducking
    - **Property 16: Audio Ducking Round-Trip**
    - **Validates: Requirements 10.1, 10.2**

  - [x] 4.4 Write property tests for mute behavior
    - **Property 17: Mute State Behavior**
    - **Validates: Requirements 10.5**

- [x] 5. Checkpoint - Audio System Complete
  - Ensure all audio tests pass
  - Test audio playback on iOS and Android simulators
  - Verify audio ducking works with background music
  - Ask the user if questions arise

- [x] 6. Implement Real-Time Voice Coaching
  - [x] 6.1 Create RealTimeCoach service
    - Create `mobile/services/voiceCoach/RealTimeCoach.ts`
    - Implement score threshold detection (< 70% tip, > 90% encouragement)
    - Implement cooldown enforcement (3 seconds default)
    - Implement weak point prioritization
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 6.2 Write property tests for score-based feedback
    - **Property 6: Score-Based Feedback Triggering**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 6.3 Write property tests for cooldown enforcement
    - **Property 7: Feedback Cooldown Enforcement**
    - **Validates: Requirements 5.3**

  - [x] 6.4 Write property tests for weak point prioritization
    - **Property 9: Weak Point Prioritization**
    - **Validates: Requirements 5.6**

  - [x] 6.5 Create fallback phrases configuration
    - Create `mobile/config/fallbackPhrases.ts`
    - Add coaching tips in EN, ES, DE, RU
    - Add encouragements in EN, ES, DE, RU
    - _Requirements: 4.6, 9.1_

  - [x] 6.6 Create coaching prompts configuration
    - Create `mobile/config/coachingPrompts.ts`
    - Define Coach Rhythm personality
    - Create prompt templates for tips and reviews
    - _Requirements: 4.4_


- [x] 7. Implement Performance Review System
  - [x] 7.1 Create PerformanceReviewer service
    - Create `mobile/services/voiceCoach/PerformanceReviewer.ts`
    - Implement session analysis (strongest/weakest parts)
    - Generate review with all required elements
    - Integrate with AudioManager for playback
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.2 Write property tests for review completeness
    - **Property 10: Performance Review Completeness**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

  - [x] 7.3 Integrate PerformanceReviewer with Results screen
    - Update `mobile/app/(tabs)/results.tsx` to trigger review
    - Display transcript while review plays
    - Add enable/disable toggle
    - _Requirements: 6.1, 6.6, 12.2_

- [x] 8. Implement Voice Navigation
  - [x] 8.1 Create VoiceNavigation service
    - Create `mobile/services/voiceCoach/VoiceNavigation.ts`
    - Implement command parsing (play, leaderboard, score, settings, help)
    - Implement command execution with router navigation
    - Handle unrecognized commands with clarification
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 8.2 Write property tests for command classification
    - **Property 14: Voice Command Classification**
    - **Validates: Requirements 8.1, 8.6**

  - [x] 8.3 Write unit tests for specific commands
    - Test "play [song]" command parsing
    - Test "show leaderboard" navigation
    - Test "help" response generation
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [x] 9. Implement Conversational AI Agent
  - [x] 9.1 Create ConversationAgent service
    - Create `mobile/services/voiceCoach/ConversationAgent.ts`
    - Implement conversation context management
    - Implement 30-second idle timeout
    - Implement off-topic redirection
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [x] 9.2 Write property tests for context retention
    - **Property 11: Conversation Context Retention**
    - **Validates: Requirements 7.3**

  - [x] 9.3 Write property tests for off-topic handling
    - **Property 13: Off-Topic Redirection**
    - **Validates: Requirements 7.6**

- [x] 10. Checkpoint - Core Services Complete
  - Ensure all service tests pass
  - Test real-time coaching with mock pose data
  - Test voice navigation commands
  - Ask the user if questions arise


- [x] 11. Implement Multilingual Support
  - [x] 11.1 Implement language switching in services
    - Update all services to accept language parameter
    - Implement language-appropriate voice selection
    - Implement Gemini translation for non-English
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [x] 11.2 Write property tests for language consistency
    - **Property 12: Language Consistency**
    - **Validates: Requirements 7.4, 9.2, 9.3, 9.4**

  - [x] 11.3 Implement language preference persistence
    - Store language preference in AsyncStorage
    - Load preference on app startup
    - _Requirements: 9.6_

  - [x] 11.4 Write property tests for preference persistence
    - **Property 15: User Preference Persistence (Round-Trip)**
    - **Validates: Requirements 9.6, 12.6**

- [x] 12. Implement Error Handling and Resilience
  - [x] 12.1 Create ErrorHandler service
    - Create `mobile/services/voiceCoach/ErrorHandler.ts`
    - Implement consecutive failure tracking
    - Implement automatic disable/enable of voice features
    - Implement fallback phrase selection
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6_

  - [x] 12.2 Implement network retry queue
    - Queue failed requests when offline
    - Retry queued requests on connectivity restore
    - _Requirements: 13.4_

  - [x] 12.3 Write property tests for network retry
    - **Property 19: Network Retry Queue**
    - **Validates: Requirements 13.4**

  - [x] 12.4 Implement response caching
    - Cache recent API responses
    - Return cached response for identical requests
    - _Requirements: 15.4_

  - [x] 12.5 Write property tests for caching
    - **Property 20: Response Caching**
    - **Validates: Requirements 15.4**

- [x] 13. Implement Performance Optimizations
  - [x] 13.1 Implement low battery adaptation
    - Detect battery level below 20%
    - Increase cooldown period when low battery
    - _Requirements: 15.5_

  - [x] 13.2 Write property tests for battery adaptation
    - **Property 21: Low Battery Adaptation**
    - **Validates: Requirements 15.5**

  - [x] 13.3 Implement background audio processing
    - Process audio in background thread
    - Ensure UI remains responsive
    - _Requirements: 15.6_

- [x] 14. Checkpoint - Services Complete
  - Ensure all service tests pass
  - Test multilingual support in all 4 languages
  - Test error handling with network disconnection
  - Ask the user if questions arise


- [x] 15. Create Voice Coach Hook
  - [x] 15.1 Implement useVoiceCoach hook
    - Create `mobile/hooks/useVoiceCoach.ts`
    - Combine all services into unified interface
    - Expose state: isEnabled, isSpeaking, isListening, transcript, error
    - Expose actions: onPoseAnalysis, reviewSession, startListening, etc.
    - _Requirements: 5.1, 5.2, 6.1, 7.1, 8.1_

  - [x] 15.2 Create voiceCoachStore with Zustand
    - Create `mobile/store/voiceCoachStore.ts`
    - Persist settings to AsyncStorage
    - Manage voice coach state
    - _Requirements: 12.6_

  - [x] 15.3 Write unit tests for useVoiceCoach hook
    - Test state transitions
    - Test action dispatching
    - Test settings persistence
    - _Requirements: 12.6_

- [x] 16. Create Voice Coach UI Components
  - [x] 16.1 Create VoiceIndicator component
    - Create `mobile/components/VoiceCoach/VoiceIndicator.tsx`
    - Implement speaking animation
    - Implement listening animation
    - Display current state (idle, listening, speaking)
    - _Requirements: 11.1, 11.2_

  - [x] 16.2 Create TranscriptDisplay component
    - Create `mobile/components/VoiceCoach/TranscriptDisplay.tsx`
    - Display spoken text transcript
    - Display user speech transcript
    - _Requirements: 11.3, 11.4_

  - [x] 16.3 Write property tests for transcript display
    - **Property 18: Transcript Display Consistency**
    - **Validates: Requirements 11.3, 11.4**

  - [x] 16.4 Create VoiceButton component
    - Create `mobile/components/VoiceCoach/VoiceButton.tsx`
    - Implement mute/unmute toggle
    - Implement voice input trigger button
    - _Requirements: 11.5, 11.6_

  - [x] 16.5 Create CoachSettings component
    - Create `mobile/components/VoiceCoach/CoachSettings.tsx`
    - Enable/disable real-time coaching toggle
    - Enable/disable performance reviews toggle
    - Voice selection dropdown
    - Language selection dropdown
    - Coaching frequency slider
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 17. Integrate Voice Coach with Game Screen
  - [x] 17.1 Update Game screen with voice coaching
    - Update `mobile/app/(tabs)/game.tsx`
    - Add useVoiceCoach hook
    - Call onPoseAnalysis on each frame
    - Add VoiceIndicator component
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 17.2 Add voice input button to Game screen
    - Add VoiceButton for manual voice input
    - Handle voice commands during gameplay
    - _Requirements: 11.6, 8.1_

- [x] 18. Integrate Voice Coach with Settings Screen
  - [x] 18.1 Add Voice Coach settings section
    - Update `mobile/app/(tabs)/settings.tsx`
    - Add CoachSettings component
    - Persist settings changes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 19. Checkpoint - UI Integration Complete
  - Ensure all UI components render correctly
  - Test voice coaching during actual gameplay
  - Test settings persistence across app restarts
  - Ask the user if questions arise


- [x] 20. Integration Testing
  - [x] 20.1 Write integration tests for real-time coaching flow
    - Test pose analysis → coaching tip → audio playback
    - Test cooldown enforcement in real scenario
    - Test fallback when API fails
    - _Requirements: 5.1, 5.2, 5.3, 4.6_

  - [x] 20.2 Write integration tests for performance review flow
    - Test game end → review generation → audio playback
    - Test transcript display during playback
    - _Requirements: 6.1, 6.6_

  - [x] 20.3 Write integration tests for voice navigation flow
    - Test voice input → command parsing → navigation
    - Test unrecognized command handling
    - _Requirements: 8.1, 8.6_

  - [x] 20.4 Write integration tests for multilingual flow
    - Test language switching mid-session
    - Test voice selection per language
    - _Requirements: 9.2, 9.4, 9.5_

- [x] 21. End-to-End Testing
  - [x] 21.1 Test complete dance session with voice coaching
    - Start game with voice coaching enabled
    - Verify coaching tips during low scores
    - Verify encouragement during high scores
    - Verify performance review at end
    - _Requirements: 5.1, 5.2, 6.1_

  - [x] 21.2 Test voice navigation across app
    - Test "play [song]" command
    - Test "show leaderboard" command
    - Test "settings" command
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 21.3 Test error recovery scenarios
    - Test with network disconnection
    - Test with API rate limiting
    - Verify graceful degradation
    - _Requirements: 13.1, 13.4, 13.6_

- [x] 22. Final Checkpoint - All Tests Pass
  - Run full test suite: `npm test`
  - Run backend tests: `uv run pytest`
  - Verify all 21 correctness properties pass
  - Verify no regressions in existing tests
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each property test references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Backend uses UV and pyproject.toml for Python package management
- Mobile uses fast-check for property-based testing
