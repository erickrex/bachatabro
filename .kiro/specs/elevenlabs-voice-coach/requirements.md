# ElevenLabs Voice Coach Integration - Requirements Document

## Introduction

This document specifies the requirements for integrating ElevenLabs voice AI and Google Cloud Gemini into the Bachata Bro mobile application to create an AI-powered voice coaching system. The integration transforms the app from a silent dance game into an interactive AI dance instructor with real-time voice feedback, conversational capabilities, and multilingual support.

### Project Goals

1. **Real-Time Voice Coaching**: Provide spoken feedback during dance sessions based on pose analysis
2. **Conversational AI Instructor**: Enable natural voice conversations about dance techniques and progress
3. **Post-Dance Performance Review**: Generate spoken performance summaries after each session
4. **Voice-Controlled Navigation**: Allow hands-free app navigation through voice commands
5. **Multilingual Support**: Support multiple languages for global accessibility
6. **Secure API Integration**: Implement backend proxy architecture to protect API keys

### Success Criteria

- Real-time voice feedback latency <500ms from pose analysis to speech
- Conversational AI response time <2 seconds
- Support for 4 languages (English, Spanish, German, Russian)
- Zero API keys exposed in mobile app bundle
- Backend proxy handles 100+ requests per minute
- Voice coaching does not degrade pose detection performance

## Glossary

- **ElevenLabs**: AI voice platform providing text-to-speech (TTS) and speech-to-text (STT) capabilities
- **Google Gemini**: Google's multimodal AI model for content generation and analysis
- **Vertex AI**: Google Cloud's machine learning platform hosting Gemini models
- **TTS (Text-to-Speech)**: Converting text into spoken audio
- **STT (Speech-to-Text)**: Converting spoken audio into text transcripts
- **Backend_Proxy**: Google Cloud Functions that securely proxy API calls
- **Voice_Coach**: The AI coaching system combining Gemini analysis and ElevenLabs voice
- **Coaching_Tip**: Short spoken feedback during dance (under 15 words)
- **Performance_Review**: Spoken summary after dance session completion
- **Voice_Command**: Spoken instruction to navigate or control the app
- **Cooldown_Period**: Minimum time between consecutive voice feedback (3 seconds)

## Requirements

### Requirement 1: Backend Proxy Infrastructure

**User Story:** As a developer, I want API keys stored securely on a backend server, so that they are never exposed in the mobile app.

#### Acceptance Criteria

1. THE Backend_Proxy SHALL store ElevenLabs API keys in environment variables on Google Cloud Functions
2. THE Backend_Proxy SHALL store Google Cloud/Gemini credentials in environment variables on Google Cloud Functions
3. WHEN the mobile app makes an API request, THE Backend_Proxy SHALL authenticate the request before forwarding to external APIs
4. THE Backend_Proxy SHALL implement rate limiting of 100 requests per minute per client
5. THE Backend_Proxy SHALL return appropriate error responses (400, 401, 429, 500) for invalid requests
6. THE Backend_Proxy SHALL log all API requests for monitoring and debugging

### Requirement 2: ElevenLabs Text-to-Speech Integration

**User Story:** As a player, I want to hear the AI coach speak feedback, so that I can receive guidance without looking at the screen.

#### Acceptance Criteria

1. WHEN the Voice_Coach generates a coaching tip, THE ElevenLabs_Service SHALL convert text to speech using the eleven_turbo_v2 model
2. WHEN text-to-speech is requested, THE ElevenLabs_Service SHALL return audio within 500ms for texts under 50 characters
3. WHEN audio is received, THE Mobile_App SHALL play the audio through the device speakers
4. THE ElevenLabs_Service SHALL support configurable voice selection (at least 5 voice options)
5. WHEN text exceeds 5000 characters, THE Backend_Proxy SHALL reject the request with a 400 error
6. IF text-to-speech fails, THEN THE Mobile_App SHALL continue gameplay without voice feedback

### Requirement 3: ElevenLabs Speech-to-Text Integration

**User Story:** As a player, I want to speak commands to the app, so that I can interact hands-free while dancing.

#### Acceptance Criteria

1. WHEN the user activates voice input, THE Mobile_App SHALL record audio from the device microphone
2. WHEN audio recording completes, THE ElevenLabs_Service SHALL transcribe the audio to text
3. WHEN transcription completes, THE Mobile_App SHALL process the transcript as a voice command or conversation input
4. THE ElevenLabs_Service SHALL support transcription in 4 languages (English, Spanish, German, Russian)
5. IF speech-to-text fails, THEN THE Mobile_App SHALL display a "Couldn't understand" message and allow retry
6. WHEN recording, THE Mobile_App SHALL display a visual indicator that voice input is active

### Requirement 4: Google Gemini Coaching Intelligence

**User Story:** As a player, I want intelligent coaching feedback based on my dance performance, so that I receive personalized guidance.

#### Acceptance Criteria

1. WHEN pose analysis detects weak points, THE Gemini_Service SHALL generate a contextual coaching tip under 15 words
2. WHEN a dance session ends, THE Gemini_Service SHALL generate a performance review under 100 words
3. WHEN the user asks a dance question, THE Gemini_Service SHALL generate a helpful response under 200 words
4. THE Gemini_Service SHALL maintain a consistent "Coach Rhythm" personality across all responses
5. WHEN generating responses, THE Gemini_Service SHALL consider the user's current score and weak points
6. IF Gemini API fails, THEN THE Voice_Coach SHALL use fallback pre-defined coaching phrases

### Requirement 5: Real-Time Voice Coaching During Dance

**User Story:** As a player, I want to hear coaching tips while dancing, so that I can improve my moves in real-time.

#### Acceptance Criteria

1. WHEN the player's score drops below 70%, THE Voice_Coach SHALL provide a coaching tip
2. WHEN the player achieves a score above 90%, THE Voice_Coach SHALL provide encouragement
3. THE Voice_Coach SHALL enforce a 3-second cooldown between consecutive tips
4. WHEN providing feedback, THE Voice_Coach SHALL not interrupt currently playing audio
5. WHILE voice feedback is playing, THE Mobile_App SHALL continue pose detection without degradation
6. THE Voice_Coach SHALL prioritize tips for the weakest body part in the current analysis

### Requirement 6: Post-Dance Performance Review

**User Story:** As a player, I want a spoken summary after each dance, so that I understand my performance and areas for improvement.

#### Acceptance Criteria

1. WHEN a dance session ends, THE Voice_Coach SHALL generate and speak a performance review
2. THE Performance_Review SHALL include the final score and comparison to previous best
3. THE Performance_Review SHALL identify the strongest and weakest body parts
4. THE Performance_Review SHALL provide one actionable improvement tip
5. THE Performance_Review SHALL end with a motivating question or call-to-action
6. WHEN the review is playing, THE Mobile_App SHALL display the transcript on screen

### Requirement 7: Conversational AI Instructor

**User Story:** As a player, I want to have voice conversations with the AI coach, so that I can ask questions about dance techniques.

#### Acceptance Criteria

1. WHEN the user initiates a conversation, THE Voice_Coach SHALL listen for voice input
2. WHEN the user asks a question, THE Voice_Coach SHALL respond with relevant dance guidance
3. THE Voice_Coach SHALL remember context within a single conversation session
4. THE Voice_Coach SHALL respond in the same language the user speaks
5. WHEN the conversation is idle for 30 seconds, THE Voice_Coach SHALL end the conversation mode
6. THE Voice_Coach SHALL handle off-topic questions by redirecting to dance-related topics

### Requirement 8: Voice-Controlled Navigation

**User Story:** As a player, I want to navigate the app using voice commands, so that I can control the app hands-free.

#### Acceptance Criteria

1. WHEN the user says "play [song name]", THE Mobile_App SHALL navigate to and start that song
2. WHEN the user says "show leaderboard", THE Mobile_App SHALL navigate to the leaderboard screen
3. WHEN the user says "my best score", THE Voice_Coach SHALL speak the user's personal best score
4. WHEN the user says "settings", THE Mobile_App SHALL navigate to the settings screen
5. WHEN the user says "help", THE Voice_Coach SHALL explain available voice commands
6. IF a voice command is not recognized, THEN THE Voice_Coach SHALL ask for clarification

### Requirement 9: Multilingual Support

**User Story:** As a player, I want the AI coach to speak my language, so that I can understand feedback regardless of my native language.

#### Acceptance Criteria

1. THE Voice_Coach SHALL support 4 languages: English, Spanish, German, Russian
2. WHEN the user selects a language in settings, THE Voice_Coach SHALL use that language for all speech
3. WHEN generating coaching tips, THE Gemini_Service SHALL translate responses to the selected language
4. THE ElevenLabs_Service SHALL use language-appropriate voices for each supported language
5. WHEN the app language changes, THE Voice_Coach SHALL immediately switch to the new language
6. THE Mobile_App SHALL persist the language preference in local storage

### Requirement 10: Audio Playback System

**User Story:** As a player, I want voice feedback to play clearly without interfering with game audio, so that I can hear both the music and the coach.

#### Acceptance Criteria

1. WHEN voice feedback plays, THE Audio_System SHALL duck (reduce volume of) the background music
2. WHEN voice feedback ends, THE Audio_System SHALL restore background music to original volume
3. THE Audio_System SHALL queue multiple voice clips if they arrive in quick succession
4. THE Audio_System SHALL support canceling queued voice clips when a new high-priority clip arrives
5. WHEN the device is muted, THE Audio_System SHALL not play voice feedback
6. THE Audio_System SHALL respect the device's audio session settings (e.g., silent mode)

### Requirement 11: Voice Coach UI Components

**User Story:** As a player, I want visual indicators for the voice coach, so that I know when the coach is speaking or listening.

#### Acceptance Criteria

1. WHEN the Voice_Coach is speaking, THE UI SHALL display a speaking indicator animation
2. WHEN the Voice_Coach is listening, THE UI SHALL display a listening indicator animation
3. THE UI SHALL display a transcript of what the Voice_Coach is saying
4. THE UI SHALL display a transcript of what the user said (after speech-to-text)
5. THE UI SHALL provide a button to mute/unmute the Voice_Coach
6. THE UI SHALL provide a button to manually trigger voice input

### Requirement 12: Voice Coach Settings

**User Story:** As a player, I want to customize the voice coach settings, so that I can personalize my experience.

#### Acceptance Criteria

1. THE Settings_Screen SHALL allow enabling/disabling real-time voice coaching
2. THE Settings_Screen SHALL allow enabling/disabling post-dance reviews
3. THE Settings_Screen SHALL allow selecting the coach voice from available options
4. THE Settings_Screen SHALL allow selecting the coach language
5. THE Settings_Screen SHALL allow adjusting the coaching frequency (more/less feedback)
6. WHEN settings change, THE Mobile_App SHALL persist preferences to local storage

### Requirement 13: Error Handling and Resilience

**User Story:** As a player, I want the app to handle errors gracefully, so that my gameplay is not interrupted by voice coach failures.

#### Acceptance Criteria

1. IF the Backend_Proxy is unreachable, THEN THE Mobile_App SHALL disable voice features and continue gameplay
2. IF ElevenLabs API returns an error, THEN THE Voice_Coach SHALL skip that feedback and log the error
3. IF Gemini API returns an error, THEN THE Voice_Coach SHALL use fallback pre-defined phrases
4. WHEN network connectivity is lost, THE Mobile_App SHALL queue voice requests and retry when connected
5. THE Mobile_App SHALL display a non-intrusive notification when voice features are unavailable
6. WHEN voice features recover, THE Mobile_App SHALL automatically re-enable them

### Requirement 14: Python Tooling Standards

**User Story:** As a developer, I want consistent Python tooling for backend development, so that the project follows modern Python best practices.

#### Acceptance Criteria

1. THE Backend_Proxy development SHALL use UV as the Python package manager and runner
2. THE Backend_Proxy project SHALL use pyproject.toml for all package configuration and dependencies
3. WHEN running Python scripts, THE Developer SHALL use `uv run` command instead of direct Python execution
4. THE pyproject.toml SHALL specify all required dependencies including elevenlabs and google-cloud-aiplatform
5. THE Backend_Proxy SHALL include a README with UV installation and setup instructions
6. WHEN adding new dependencies, THE Developer SHALL add them to pyproject.toml and run `uv sync`

### Requirement 15: Performance and Resource Management

**User Story:** As a player, I want voice coaching to not impact game performance, so that my dance experience remains smooth.

#### Acceptance Criteria

1. THE Voice_Coach SHALL not increase pose detection latency by more than 10ms
2. THE Voice_Coach SHALL use less than 50MB additional memory during operation
3. THE Audio_System SHALL preload common coaching phrases for faster playback
4. THE Mobile_App SHALL cache recent voice responses to reduce API calls
5. WHEN battery is below 20%, THE Voice_Coach SHALL reduce coaching frequency
6. THE Voice_Coach SHALL process audio in a background thread to avoid UI blocking

## Non-Functional Requirements

### Performance Requirements

#### NFR-001: Voice Feedback Latency
- Text-to-speech generation: <500ms for texts under 50 characters
- Speech-to-text transcription: <1 second for audio under 10 seconds
- Gemini response generation: <2 seconds for coaching tips
- Audio playback start: <100ms after audio data received

#### NFR-002: Resource Usage
- Additional memory: <50MB during voice coach operation
- Network bandwidth: <100KB per voice interaction
- Battery impact: <5% additional drain per 30-minute session
- Storage for cached audio: <20MB

#### NFR-003: Reliability
- Voice feature availability: >95% uptime
- Successful API call rate: >98%
- Graceful degradation: 100% (gameplay continues if voice fails)

### Security Requirements

#### NFR-004: API Key Protection
- API keys stored only in backend environment variables
- No API keys in mobile app bundle or source code
- Backend proxy validates all incoming requests
- Rate limiting prevents abuse

#### NFR-005: Data Privacy
- Voice recordings not stored permanently
- Transcripts not sent to third parties beyond ElevenLabs/Google
- User can disable voice features entirely
- No personally identifiable information in coaching prompts

### Compatibility Requirements

#### NFR-006: Platform Support
- iOS: 13.0+ with microphone permission
- Android: 8.0+ with microphone permission
- Expo SDK: 54+
- React Native: 0.74+

#### NFR-007: Audio Requirements
- Supported audio formats: MP3, WAV
- Sample rate: 22050Hz or higher
- Microphone access required for voice input
- Speaker/headphone output for voice feedback

### Maintainability Requirements

#### NFR-008: Code Quality
- TypeScript for all mobile code
- ESLint compliance for all new code
- Unit test coverage: >80% for voice coach services
- Integration tests for backend proxy endpoints

#### NFR-009: Documentation
- API documentation for all backend endpoints
- Setup guide for ElevenLabs and Google Cloud accounts
- Troubleshooting guide for common voice issues
- Code comments for complex audio handling logic

## Dependencies

### External Dependencies

1. **ElevenLabs API**
   - Text-to-Speech (eleven_turbo_v2 model)
   - Speech-to-Text
   - Multilingual voice support

2. **Google Cloud Platform**
   - Cloud Functions for backend proxy
   - Vertex AI / Gemini API for coaching intelligence
   - Cloud Logging for monitoring

3. **React Native Libraries**
   - expo-av for audio playback and recording
   - expo-speech (fallback TTS)
   - @react-native-async-storage/async-storage for preferences

### Internal Dependencies

1. **Existing Codebase**
   - Pose detection service (for score/weak point data)
   - Game store (for session state)
   - Score calculator (for performance metrics)
   - Results screen (for review integration)

2. **New Components**
   - Backend proxy (Google Cloud Functions)
   - Voice coach services
   - Audio playback system
   - Voice UI components

## Out of Scope

The following features are explicitly out of scope for this version:

- Video analysis by AI (only pose data is analyzed)
- Voice cloning or custom voice creation
- Offline voice coaching (requires network)
- Real-time voice chat with other players
- Voice-based song creation or choreography
- Integration with smart speakers or external devices
- Voice authentication or user identification

## Risks and Mitigation

### Technical Risks

**Risk**: ElevenLabs API latency may exceed targets
**Mitigation**: Use eleven_turbo_v2 model optimized for low latency, implement audio caching

**Risk**: Voice feedback may interfere with pose detection performance
**Mitigation**: Process audio in background threads, implement performance monitoring

**Risk**: Network issues may cause voice features to fail frequently
**Mitigation**: Implement robust fallback to pre-defined phrases, queue and retry mechanism

**Risk**: Microphone permissions may be denied by users
**Mitigation**: Gracefully disable voice input features, provide clear permission explanations

### Cost Risks

**Risk**: API costs may exceed free tier during hackathon
**Mitigation**: Implement rate limiting, use caching, monitor usage closely

**Risk**: Google Cloud Functions may incur unexpected charges
**Mitigation**: Set billing alerts, use free tier limits, implement request throttling

### Schedule Risks

**Risk**: Backend proxy setup takes longer than expected
**Mitigation**: Use Firebase Functions for faster setup, have fallback to direct API calls for demo

**Risk**: Audio playback issues on specific devices
**Mitigation**: Test on multiple devices early, use expo-av which handles cross-platform audio

## Acceptance Criteria Summary

Total Acceptance Criteria: 90

- Backend Proxy Infrastructure: AC-001 to AC-006 (6 criteria)
- ElevenLabs TTS Integration: AC-007 to AC-012 (6 criteria)
- ElevenLabs STT Integration: AC-013 to AC-018 (6 criteria)
- Gemini Coaching Intelligence: AC-019 to AC-024 (6 criteria)
- Real-Time Voice Coaching: AC-025 to AC-030 (6 criteria)
- Post-Dance Performance Review: AC-031 to AC-036 (6 criteria)
- Conversational AI Instructor: AC-037 to AC-042 (6 criteria)
- Voice-Controlled Navigation: AC-043 to AC-048 (6 criteria)
- Multilingual Support: AC-049 to AC-054 (6 criteria)
- Audio Playback System: AC-055 to AC-060 (6 criteria)
- Voice Coach UI Components: AC-061 to AC-066 (6 criteria)
- Voice Coach Settings: AC-067 to AC-072 (6 criteria)
- Error Handling and Resilience: AC-073 to AC-078 (6 criteria)
- Python Tooling Standards: AC-079 to AC-084 (6 criteria)
- Performance and Resource Management: AC-085 to AC-090 (6 criteria)

All acceptance criteria must be met for project completion.

## Approval

This requirements document must be approved by:
- [ ] Technical Lead
- [ ] Project Manager
- [ ] Product Owner

**Version**: 1.0.0
**Date**: December 26, 2025
**Status**: Draft → Ready for Review
