# ElevenLabs Voice Coach Integration - Design Document

## Overview

This design document describes the architecture and implementation approach for integrating ElevenLabs voice AI and Google Cloud Gemini into the Bachata Bro mobile application. The system creates an AI-powered voice coaching experience that provides real-time spoken feedback during dance sessions, conversational AI interactions, and multilingual support.

### Design Principles

1. **Security First**: API keys never leave the backend; all external API calls proxied through Google Cloud Functions
2. **Graceful Degradation**: Voice features fail silently without impacting core gameplay
3. **Low Latency**: Optimize for <500ms voice feedback to maintain real-time feel
4. **Separation of Concerns**: Clear boundaries between audio, AI, and UI layers
5. **Testability**: All core logic testable without external dependencies

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE APP (React Native)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Game UI    │  │  Voice UI    │  │  Settings    │  │   Results    │    │
│  │  Components  │  │  Components  │  │    Screen    │  │    Screen    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│  ┌──────▼─────────────────▼─────────────────▼─────────────────▼──────┐     │
│  │                        Voice Coach Hook                            │     │
│  │                      (useVoiceCoach.ts)                           │     │
│  └──────┬─────────────────┬─────────────────┬─────────────────┬──────┘     │
│         │                 │                 │                 │             │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐    │
│  │ RealTime     │  │ Performance  │  │ Conversation │  │    Voice     │    │
│  │ Coach        │  │ Reviewer     │  │ Agent        │  │  Navigation  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│  ┌──────▼─────────────────▼─────────────────▼─────────────────▼──────┐     │
│  │                      Audio Playback System                         │     │
│  │                     (AudioManager.ts)                             │     │
│  └──────┬─────────────────┬─────────────────────────────────────────┘     │
│         │                 │                                                 │
│  ┌──────▼───────┐  ┌──────▼───────┐                                        │
│  │ ElevenLabs   │  │   Gemini     │                                        │
│  │   Client     │  │   Client     │                                        │
│  └──────┬───────┘  └──────┬───────┘                                        │
│         │                 │                                                 │
└─────────┼─────────────────┼────────────────────────────────────────────────┘
          │                 │
          │    HTTPS        │    HTTPS
          │                 │
┌─────────▼─────────────────▼────────────────────────────────────────────────┐
│                     BACKEND PROXY (Google Cloud Functions)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐              ┌──────────────────┐                     │
│  │  /elevenlabs     │              │    /gemini       │                     │
│  │    - /tts        │              │  - /coaching-tip │                     │
│  │    - /stt        │              │  - /review       │                     │
│  └────────┬─────────┘              └────────┬─────────┘                     │
│           │                                 │                                │
│  ┌────────▼─────────┐              ┌────────▼─────────┐                     │
│  │  Rate Limiter    │              │   Rate Limiter   │                     │
│  └────────┬─────────┘              └────────┬─────────┘                     │
│           │                                 │                                │
│  ┌────────▼─────────┐              ┌────────▼─────────┐                     │
│  │  ElevenLabs API  │              │   Vertex AI      │                     │
│  │     (TTS/STT)    │              │    (Gemini)      │                     │
│  └──────────────────┘              └──────────────────┘                     │
│                                                                              │
│  Environment Variables:                                                      │
│  - ELEVENLABS_API_KEY                                                       │
│  - GOOGLE_CLOUD_PROJECT                                                     │
│  - GOOGLE_CLOUD_LOCATION                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```


### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME COACHING FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

  Camera Frame    Pose Detection    Score Analysis    Coaching Decision
       │                │                 │                  │
       ▼                ▼                 ▼                  ▼
  ┌─────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────────┐
  │  Frame  │───▶│ ExecuTorch  │───▶│  Score   │───▶│  Should      │
  │ Capture │    │  Inference  │    │ Calculator│   │  Coach?      │
  └─────────┘    └─────────────┘    └──────────┘    └──────┬───────┘
                                                          │
                      ┌───────────────────────────────────┘
                      │
                      ▼ (if score < 70% or > 90%)
               ┌──────────────┐
               │   Cooldown   │
               │    Check     │
               └──────┬───────┘
                      │
                      ▼ (if cooldown elapsed)
               ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
               │   Gemini     │───▶│  ElevenLabs  │───▶│    Audio     │
               │  Generate    │    │     TTS      │    │   Playback   │
               └──────────────┘    └──────────────┘    └──────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         VOICE COMMAND FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  User Speech    Transcription    Command Parse    Action Execute
       │               │                │                │
       ▼               ▼                ▼                ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────────┐
  │  Mic    │───▶│  ElevenLabs  │───▶│  Command │───▶│   Router     │
  │ Record  │    │     STT      │    │  Parser  │    │   Action     │
  └─────────┘    └──────────────┘    └──────────┘    └──────┬───────┘
                                                           │
                      ┌────────────────────────────────────┘
                      │
          ┌───────────┼───────────┬───────────┬───────────┐
          ▼           ▼           ▼           ▼           ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │  Play   │ │  Show   │ │  Get    │ │  Open   │ │  Start  │
     │  Song   │ │ Leader  │ │  Score  │ │Settings │ │  Chat   │
     └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## Components and Interfaces

### Backend Proxy Components

#### 1. ElevenLabs Proxy Function

```typescript
// backend/functions/src/elevenlabs.ts
interface TTSRequest {
  text: string;
  voiceId?: string;
  language?: 'en' | 'es' | 'de' | 'ru';
}

interface TTSResponse {
  audio: string; // base64 encoded MP3
  format: 'mp3';
  durationMs: number;
}

interface STTRequest {
  audio: string; // base64 encoded audio
  language?: 'en' | 'es' | 'de' | 'ru';
}

interface STTResponse {
  transcript: string;
  confidence: number;
  language: string;
}

// Endpoints:
// POST /elevenlabs/tts - Text to Speech
// POST /elevenlabs/stt - Speech to Text
```

#### 2. Gemini Proxy Function

```typescript
// backend/functions/src/gemini.ts
interface CoachingTipRequest {
  score: number;
  weakPoints: string[];
  strongPoints: string[];
  language: 'en' | 'es' | 'de' | 'ru';
}

interface CoachingTipResponse {
  tip: string;
  targetBodyPart: string;
}

interface PerformanceReviewRequest {
  songTitle: string;
  songArtist: string;
  finalScore: number;
  previousBest: number | null;
  strongestPart: string;
  weakestPart: string;
  totalFrames: number;
  language: 'en' | 'es' | 'de' | 'ru';
}

interface PerformanceReviewResponse {
  review: string;
  improvementTip: string;
}

// Endpoints:
// POST /gemini/coaching-tip - Generate coaching tip
// POST /gemini/performance-review - Generate performance review
// POST /gemini/conversation - Handle conversation
```


### Mobile App Components

#### 3. API Client Services

```typescript
// mobile/services/voiceCoach/ElevenLabsClient.ts
export class ElevenLabsClient {
  private baseUrl: string;
  
  constructor(backendUrl: string) {
    this.baseUrl = `${backendUrl}/elevenlabs`;
  }
  
  async textToSpeech(request: TTSRequest): Promise<TTSResponse>;
  async speechToText(request: STTRequest): Promise<STTResponse>;
}

// mobile/services/voiceCoach/GeminiClient.ts
export class GeminiClient {
  private baseUrl: string;
  
  constructor(backendUrl: string) {
    this.baseUrl = `${backendUrl}/gemini`;
  }
  
  async generateCoachingTip(request: CoachingTipRequest): Promise<CoachingTipResponse>;
  async generatePerformanceReview(request: PerformanceReviewRequest): Promise<PerformanceReviewResponse>;
  async sendConversationMessage(message: string, context: ConversationContext): Promise<string>;
}
```

#### 4. Audio Manager

```typescript
// mobile/services/voiceCoach/AudioManager.ts
export interface AudioClip {
  id: string;
  audio: string; // base64
  priority: 'low' | 'normal' | 'high';
  text: string; // for transcript display
}

export class AudioManager {
  private queue: AudioClip[];
  private isPlaying: boolean;
  private isMuted: boolean;
  private originalMusicVolume: number;
  
  // Queue management
  enqueue(clip: AudioClip): void;
  clearQueue(): void;
  cancelCurrent(): void;
  
  // Playback control
  play(): Promise<void>;
  pause(): void;
  setMuted(muted: boolean): void;
  
  // Audio ducking
  private duckMusic(): Promise<void>;
  private restoreMusic(): Promise<void>;
  
  // Events
  onPlaybackStart: (clip: AudioClip) => void;
  onPlaybackEnd: (clip: AudioClip) => void;
  onQueueChange: (queue: AudioClip[]) => void;
}
```

#### 5. Real-Time Coach Service

```typescript
// mobile/services/voiceCoach/RealTimeCoach.ts
export interface PoseAnalysis {
  score: number;
  weakPoints: string[];
  strongPoints: string[];
  timestamp: number;
}

export class RealTimeCoach {
  private geminiClient: GeminiClient;
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private lastFeedbackTime: number;
  private cooldownMs: number; // 3000ms default
  private language: SupportedLanguage;
  private enabled: boolean;
  
  constructor(config: RealTimeCoachConfig);
  
  // Main entry point - called on each pose analysis
  async onPoseAnalysis(analysis: PoseAnalysis): Promise<void>;
  
  // Internal methods
  private shouldProvideFeedback(analysis: PoseAnalysis): boolean;
  private async generateAndSpeak(analysis: PoseAnalysis): Promise<void>;
  
  // Configuration
  setEnabled(enabled: boolean): void;
  setLanguage(language: SupportedLanguage): void;
  setCooldown(ms: number): void;
}
```

#### 6. Performance Reviewer Service

```typescript
// mobile/services/voiceCoach/PerformanceReviewer.ts
export interface GameSession {
  song: Song;
  finalScore: number;
  previousBest: number | null;
  frameScores: FrameScore[];
  strongestPart: string;
  weakestPart: string;
}

export class PerformanceReviewer {
  private geminiClient: GeminiClient;
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private language: SupportedLanguage;
  private enabled: boolean;
  
  constructor(config: PerformanceReviewerConfig);
  
  // Generate and speak performance review
  async reviewSession(session: GameSession): Promise<PerformanceReview>;
  
  // Configuration
  setEnabled(enabled: boolean): void;
  setLanguage(language: SupportedLanguage): void;
}
```


#### 7. Voice Navigation Service

```typescript
// mobile/services/voiceCoach/VoiceNavigation.ts
export type VoiceCommand = 
  | { type: 'play_song'; songName: string }
  | { type: 'show_leaderboard' }
  | { type: 'get_best_score'; songName?: string }
  | { type: 'open_settings' }
  | { type: 'help' }
  | { type: 'unknown'; transcript: string };

export class VoiceNavigation {
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private router: Router;
  private language: SupportedLanguage;
  
  constructor(config: VoiceNavigationConfig);
  
  // Parse transcript into command
  parseCommand(transcript: string): VoiceCommand;
  
  // Execute command
  async executeCommand(command: VoiceCommand): Promise<void>;
  
  // Start listening for voice input
  async startListening(): Promise<string>;
  
  // Speak help message
  async speakHelp(): Promise<void>;
}
```

#### 8. Conversation Agent Service

```typescript
// mobile/services/voiceCoach/ConversationAgent.ts
export interface ConversationContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionStartTime: number;
  language: SupportedLanguage;
}

export class ConversationAgent {
  private geminiClient: GeminiClient;
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private context: ConversationContext;
  private idleTimeoutMs: number; // 30000ms default
  private idleTimer: NodeJS.Timeout | null;
  
  constructor(config: ConversationAgentConfig);
  
  // Start conversation mode
  startConversation(): void;
  
  // End conversation mode
  endConversation(): void;
  
  // Process user message
  async processMessage(transcript: string): Promise<string>;
  
  // Check if message is off-topic
  private isOffTopic(message: string): boolean;
  
  // Reset idle timer
  private resetIdleTimer(): void;
}
```

#### 9. Voice Coach Hook

```typescript
// mobile/hooks/useVoiceCoach.ts
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

export interface VoiceCoachActions {
  // Real-time coaching
  onPoseAnalysis: (analysis: PoseAnalysis) => Promise<void>;
  
  // Performance review
  reviewSession: (session: GameSession) => Promise<void>;
  
  // Voice input
  startListening: () => Promise<void>;
  stopListening: () => void;
  
  // Conversation
  startConversation: () => void;
  endConversation: () => void;
  
  // Settings
  setEnabled: (enabled: boolean) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setVoiceId: (voiceId: string) => void;
  setMuted: (muted: boolean) => void;
}

export function useVoiceCoach(): [VoiceCoachState, VoiceCoachActions];
```

### UI Components

#### 10. Voice Indicator Component

```typescript
// mobile/components/VoiceCoach/VoiceIndicator.tsx
interface VoiceIndicatorProps {
  state: 'idle' | 'listening' | 'speaking';
  transcript?: string;
}

export function VoiceIndicator({ state, transcript }: VoiceIndicatorProps): JSX.Element;
```

#### 11. Coach Settings Component

```typescript
// mobile/components/VoiceCoach/CoachSettings.tsx
interface CoachSettingsProps {
  enabled: boolean;
  language: SupportedLanguage;
  voiceId: string;
  reviewsEnabled: boolean;
  coachingFrequency: 'low' | 'normal' | 'high';
  onSettingsChange: (settings: VoiceCoachSettings) => void;
}

export function CoachSettings(props: CoachSettingsProps): JSX.Element;
```


## Data Models

### Voice Coach Settings

```typescript
// mobile/types/voiceCoach.ts
export type SupportedLanguage = 'en' | 'es' | 'de' | 'ru';

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
```

### Voice Configuration by Language

```typescript
// mobile/config/voiceConfig.ts
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
```

### Coaching Prompts

```typescript
// mobile/config/coachingPrompts.ts
export const COACH_PERSONALITY = `
You are "Coach Rhythm", an enthusiastic AI dance instructor.

PERSONALITY:
- Encouraging and positive
- Uses dance terminology naturally
- Celebrates small wins
- Gives specific, actionable feedback
- Never discouraging or negative

CONSTRAINTS:
- Keep coaching tips under 15 words
- Keep performance reviews under 100 words
- Always end reviews with a motivating question
- Focus on ONE improvement at a time
`;

export const COACHING_TIP_PROMPT = (analysis: PoseAnalysis, language: string) => `
${COACH_PERSONALITY}

Generate a SHORT coaching tip (under 15 words) in ${language}.

Current score: ${analysis.score}%
Weak points: ${analysis.weakPoints.join(', ')}
Strong points: ${analysis.strongPoints.join(', ')}

Focus on the weakest point. Be encouraging and specific.
`;

export const PERFORMANCE_REVIEW_PROMPT = (session: GameSession, language: string) => `
${COACH_PERSONALITY}

Generate a spoken performance review (under 100 words) in ${language}.

Song: ${session.song.title} by ${session.song.artist}
Final Score: ${session.finalScore}%
Previous Best: ${session.previousBest ?? 'N/A'}%
Strongest: ${session.strongestPart}
Weakest: ${session.weakestPart}

Include:
1. Congratulate on the score
2. Compare to previous best if available
3. Mention strongest body part
4. Give ONE tip for weakest body part
5. End with a motivating question
`;
```

### Fallback Phrases

```typescript
// mobile/config/fallbackPhrases.ts
export const FALLBACK_COACHING_TIPS: Record<SupportedLanguage, string[]> = {
  en: [
    "Keep those arms up!",
    "Great energy! Watch your timing.",
    "Nice moves! Try bigger arm swings.",
    "You're doing great! Stay on beat.",
    "Awesome! Focus on your footwork.",
  ],
  es: [
    "¡Mantén los brazos arriba!",
    "¡Gran energía! Cuida el ritmo.",
    "¡Buenos movimientos! Intenta balanceos más grandes.",
    "¡Lo estás haciendo genial! Mantén el ritmo.",
    "¡Increíble! Concéntrate en tus pies.",
  ],
  de: [
    "Halte die Arme oben!",
    "Tolle Energie! Achte auf das Timing.",
    "Schöne Bewegungen! Versuche größere Armschwünge.",
    "Du machst das großartig! Bleib im Takt.",
    "Super! Konzentriere dich auf deine Fußarbeit.",
  ],
  ru: [
    "Держи руки выше!",
    "Отличная энергия! Следи за ритмом.",
    "Хорошие движения! Попробуй больше махов руками.",
    "Ты отлично справляешься! Держи ритм.",
    "Потрясающе! Сосредоточься на работе ног.",
  ],
};

export const FALLBACK_ENCOURAGEMENTS: Record<SupportedLanguage, string[]> = {
  en: [
    "Perfect! You're on fire!",
    "Amazing moves!",
    "You're crushing it!",
    "Incredible! Keep it up!",
    "Wow! That was perfect!",
  ],
  es: [
    "¡Perfecto! ¡Estás en llamas!",
    "¡Movimientos increíbles!",
    "¡Lo estás aplastando!",
    "¡Increíble! ¡Sigue así!",
    "¡Guau! ¡Eso fue perfecto!",
  ],
  de: [
    "Perfekt! Du bist on fire!",
    "Unglaubliche Bewegungen!",
    "Du rockst das!",
    "Unglaublich! Weiter so!",
    "Wow! Das war perfekt!",
  ],
  ru: [
    "Идеально! Ты в ударе!",
    "Потрясающие движения!",
    "Ты справляешься отлично!",
    "Невероятно! Продолжай!",
    "Вау! Это было идеально!",
  ],
};
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified for property-based testing:

### Property 1: Request Authentication Validation

*For any* API request to the backend proxy, if the request lacks valid authentication headers, the proxy should return a 401 Unauthorized response.

**Validates: Requirements 1.3**

### Property 2: Rate Limiting Enforcement

*For any* sequence of requests from a single client within a 1-minute window, if the count exceeds 100, subsequent requests should return a 429 Too Many Requests response.

**Validates: Requirements 1.4**

### Property 3: Error Response Code Mapping

*For any* invalid request (malformed body, missing fields, invalid values), the backend proxy should return the appropriate HTTP error code (400 for bad request, 401 for unauthorized, 429 for rate limit, 500 for server error).

**Validates: Requirements 1.5**

### Property 4: Text Length Boundary Validation

*For any* text-to-speech request where text length exceeds 5000 characters, the backend proxy should reject the request with a 400 error.

**Validates: Requirements 2.5**

### Property 5: Generated Text Word Count Limits

*For any* generated text from Gemini, the word count should not exceed the specified limit for its type: coaching tips ≤ 15 words, performance reviews ≤ 100 words, conversation responses ≤ 200 words.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Score-Based Feedback Triggering

*For any* pose analysis score, the Voice Coach should trigger the appropriate feedback type: coaching tip if score < 70%, encouragement if score > 90%, no feedback otherwise (subject to cooldown).

**Validates: Requirements 5.1, 5.2**

### Property 7: Feedback Cooldown Enforcement

*For any* sequence of feedback triggers, if the time between consecutive triggers is less than the cooldown period (default 3 seconds), the second trigger should be suppressed.

**Validates: Requirements 5.3**

### Property 8: Audio Queue Management

*For any* sequence of audio clips submitted to the AudioManager: (a) clips should be played in order of arrival within the same priority level, (b) high-priority clips should clear the queue of lower-priority clips, (c) new clips should not interrupt currently playing audio unless high-priority.

**Validates: Requirements 5.4, 10.3, 10.4**

### Property 9: Weak Point Prioritization

*For any* pose analysis with multiple weak points, the generated coaching tip should address the weakest body part (lowest score).

**Validates: Requirements 5.6**

### Property 10: Performance Review Completeness

*For any* generated performance review, it should contain all required elements: final score mention, comparison to previous best (if available), strongest body part, weakest body part, one improvement tip, and a closing question or call-to-action.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

### Property 11: Conversation Context Retention

*For any* conversation session, the context from previous messages should be accessible and influence subsequent responses within the same session.

**Validates: Requirements 7.3**

### Property 12: Language Consistency

*For any* language setting, all voice interactions (TTS output, STT input processing, Gemini responses, voice selection) should use the selected language consistently.

**Validates: Requirements 7.4, 9.2, 9.3, 9.4**

### Property 13: Off-Topic Redirection

*For any* user message classified as off-topic (not related to dance, music, or the app), the Voice Coach should respond with a redirection to dance-related topics.

**Validates: Requirements 7.6**

### Property 14: Voice Command Classification

*For any* voice input transcript, it should be correctly classified as either a recognized command (play song, show leaderboard, etc.) or an unknown command requiring clarification.

**Validates: Requirements 8.1, 8.6**

### Property 15: User Preference Persistence (Round-Trip)

*For any* user preference (language, voice, settings), saving the preference and then loading it should return the same value.

**Validates: Requirements 9.6, 12.6**

### Property 16: Audio Ducking Round-Trip

*For any* voice playback event, the background music volume should be reduced during playback and restored to its original level after playback completes.

**Validates: Requirements 10.1, 10.2**

### Property 17: Mute State Behavior

*For any* audio playback request while the Voice Coach is muted, no audio should be played through the speakers.

**Validates: Requirements 10.5**

### Property 18: Transcript Display Consistency

*For any* text that is spoken (TTS) or transcribed (STT), the same text should be displayed in the UI transcript area.

**Validates: Requirements 11.3, 11.4**

### Property 19: Network Retry Queue

*For any* voice request that fails due to network connectivity, the request should be queued and automatically retried when connectivity is restored.

**Validates: Requirements 13.4**

### Property 20: Response Caching

*For any* repeated API request with identical parameters within the cache TTL, the cached response should be returned without making a new API call.

**Validates: Requirements 15.4**

### Property 21: Low Battery Adaptation

*For any* device battery level below 20%, the Voice Coach should reduce coaching frequency (increase cooldown period).

**Validates: Requirements 15.5**


## Error Handling

### Error Categories and Responses

| Error Type | Source | User Impact | Handling Strategy |
|------------|--------|-------------|-------------------|
| Network Unreachable | Mobile App | Voice features disabled | Queue requests, show notification, continue gameplay |
| API Rate Limited | Backend Proxy | Temporary voice pause | Exponential backoff, use fallback phrases |
| TTS Generation Failed | ElevenLabs | No voice output | Skip feedback, log error, continue |
| STT Transcription Failed | ElevenLabs | Voice input not recognized | Show "Couldn't understand", allow retry |
| Gemini Generation Failed | Vertex AI | Generic coaching | Use fallback phrases from config |
| Invalid Request | Backend Proxy | Request rejected | Return appropriate error code, log |
| Audio Playback Failed | Mobile App | No sound | Log error, continue without audio |

### Error Recovery Flow

```typescript
// mobile/services/voiceCoach/ErrorHandler.ts
export class VoiceCoachErrorHandler {
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;
  private isDisabled: boolean = false;
  
  async handleError(error: VoiceCoachError): Promise<void> {
    this.consecutiveFailures++;
    
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.disableVoiceFeatures();
      this.showNotification('Voice coach temporarily unavailable');
    }
    
    // Log error for debugging
    console.error('[VoiceCoach]', error.type, error.message);
    
    // Use fallback if available
    if (error.type === 'gemini_failed' && error.context?.analysis) {
      return this.useFallbackPhrase(error.context.analysis);
    }
  }
  
  onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.isDisabled) {
      this.enableVoiceFeatures();
      this.showNotification('Voice coach restored');
    }
  }
  
  private disableVoiceFeatures(): void {
    this.isDisabled = true;
    // Emit event to disable UI indicators
  }
  
  private enableVoiceFeatures(): void {
    this.isDisabled = false;
    // Emit event to enable UI indicators
  }
}
```

## Testing Strategy

### Dual Testing Approach

This project uses both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all valid inputs using fast-check

### Property-Based Testing Configuration

- **Library**: fast-check (TypeScript property-based testing)
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: elevenlabs-voice-coach, Property {number}: {property_text}`

### Test File Structure

```
mobile/
├── services/
│   └── voiceCoach/
│       └── __tests__/
│           ├── AudioManager.test.ts           # Unit tests
│           ├── AudioManager.property.test.ts  # Property tests
│           ├── RealTimeCoach.test.ts
│           ├── RealTimeCoach.property.test.ts
│           ├── VoiceNavigation.test.ts
│           ├── VoiceNavigation.property.test.ts
│           └── ...
backend/
└── functions/
    └── __tests__/
        ├── elevenlabs.test.ts
        ├── elevenlabs.property.test.ts
        ├── gemini.test.ts
        ├── gemini.property.test.ts
        └── ...
```

### Property Test Examples

```typescript
// mobile/services/voiceCoach/__tests__/RealTimeCoach.property.test.ts
import * as fc from 'fast-check';
import { RealTimeCoach } from '../RealTimeCoach';

describe('RealTimeCoach Properties', () => {
  // Feature: elevenlabs-voice-coach, Property 6: Score-Based Feedback Triggering
  it('should trigger appropriate feedback based on score thresholds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const coach = new RealTimeCoach(mockConfig);
          const analysis = { score, weakPoints: ['arms'], strongPoints: ['legs'], timestamp: Date.now() };
          
          const shouldTrigger = coach.shouldProvideFeedback(analysis);
          const feedbackType = coach.getFeedbackType(analysis);
          
          if (score < 70) {
            expect(shouldTrigger).toBe(true);
            expect(feedbackType).toBe('coaching_tip');
          } else if (score > 90) {
            expect(shouldTrigger).toBe(true);
            expect(feedbackType).toBe('encouragement');
          } else {
            expect(shouldTrigger).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  // Feature: elevenlabs-voice-coach, Property 7: Feedback Cooldown Enforcement
  it('should enforce cooldown between consecutive feedback', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 2, maxLength: 10 }),
        (timestamps) => {
          const coach = new RealTimeCoach({ ...mockConfig, cooldownMs: 3000 });
          const sortedTimestamps = timestamps.sort((a, b) => a - b);
          
          let lastFeedbackTime = 0;
          const feedbackTimes: number[] = [];
          
          for (const ts of sortedTimestamps) {
            const analysis = { score: 50, weakPoints: ['arms'], strongPoints: [], timestamp: ts };
            if (coach.shouldProvideFeedback(analysis)) {
              feedbackTimes.push(ts);
              lastFeedbackTime = ts;
            }
          }
          
          // Verify all consecutive feedback times are at least 3000ms apart
          for (let i = 1; i < feedbackTimes.length; i++) {
            expect(feedbackTimes[i] - feedbackTimes[i - 1]).toBeGreaterThanOrEqual(3000);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Examples

```typescript
// mobile/services/voiceCoach/__tests__/AudioManager.test.ts
describe('AudioManager', () => {
  describe('queue management', () => {
    it('should play clips in FIFO order', async () => {
      const manager = new AudioManager();
      const clip1 = { id: '1', audio: 'base64...', priority: 'normal', text: 'First' };
      const clip2 = { id: '2', audio: 'base64...', priority: 'normal', text: 'Second' };
      
      manager.enqueue(clip1);
      manager.enqueue(clip2);
      
      const playedClips: string[] = [];
      manager.onPlaybackEnd = (clip) => playedClips.push(clip.id);
      
      await manager.play();
      
      expect(playedClips).toEqual(['1', '2']);
    });
    
    it('should clear queue when high-priority clip arrives', () => {
      const manager = new AudioManager();
      manager.enqueue({ id: '1', audio: 'base64...', priority: 'low', text: 'Low' });
      manager.enqueue({ id: '2', audio: 'base64...', priority: 'normal', text: 'Normal' });
      manager.enqueue({ id: '3', audio: 'base64...', priority: 'high', text: 'High' });
      
      expect(manager.getQueueLength()).toBe(1);
      expect(manager.peekNext()?.id).toBe('3');
    });
  });
});
```

## Project Structure

### Backend (Google Cloud Functions)

```
backend/
├── functions/
│   ├── src/
│   │   ├── elevenlabs.ts        # ElevenLabs proxy endpoints
│   │   ├── gemini.ts            # Gemini proxy endpoints
│   │   ├── middleware/
│   │   │   ├── auth.ts          # Request authentication
│   │   │   ├── rateLimiter.ts   # Rate limiting
│   │   │   └── validator.ts     # Input validation
│   │   └── index.ts             # Function exports
│   ├── __tests__/
│   │   ├── elevenlabs.test.ts
│   │   ├── elevenlabs.property.test.ts
│   │   ├── gemini.test.ts
│   │   └── gemini.property.test.ts
│   ├── pyproject.toml           # Python dependencies (UV)
│   ├── package.json             # Node.js dependencies
│   └── tsconfig.json
├── .env.example                 # Environment variable template
├── firebase.json                # Firebase configuration
└── README.md                    # Setup instructions with UV
```

### Mobile App Additions

```
mobile/
├── config/
│   ├── api.ts                   # Backend URL configuration
│   ├── voiceConfig.ts           # Voice/language configuration
│   ├── coachingPrompts.ts       # Gemini prompt templates
│   └── fallbackPhrases.ts       # Offline fallback phrases
├── services/
│   └── voiceCoach/
│       ├── ElevenLabsClient.ts  # ElevenLabs API client
│       ├── GeminiClient.ts      # Gemini API client
│       ├── AudioManager.ts      # Audio playback system
│       ├── RealTimeCoach.ts     # Real-time coaching logic
│       ├── PerformanceReviewer.ts # Post-dance reviews
│       ├── VoiceNavigation.ts   # Voice command handling
│       ├── ConversationAgent.ts # Conversational AI
│       ├── ErrorHandler.ts      # Error handling
│       └── __tests__/           # Tests
├── hooks/
│   └── useVoiceCoach.ts         # Main voice coach hook
├── components/
│   └── VoiceCoach/
│       ├── VoiceIndicator.tsx   # Speaking/listening indicator
│       ├── TranscriptDisplay.tsx # Transcript UI
│       ├── CoachSettings.tsx    # Settings component
│       └── VoiceButton.tsx      # Voice input button
├── types/
│   └── voiceCoach.ts            # TypeScript types
└── store/
    └── voiceCoachStore.ts       # Voice coach state (Zustand)
```

## Dependencies

### Backend Dependencies (pyproject.toml)

```toml
[project]
name = "bachatabro-backend"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "elevenlabs>=1.0.0",
    "google-cloud-aiplatform>=1.38.0",
    "python-dotenv>=1.0.0",
    "mangum>=0.19.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "hypothesis>=6.0.0",
    "httpx>=0.25.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### Mobile Dependencies (package.json additions)

```json
{
  "dependencies": {
    "expo-av": "~14.0.0",
    "expo-speech": "~12.0.0",
    "@react-native-async-storage/async-storage": "1.23.1"
  },
  "devDependencies": {
    "fast-check": "^3.15.0"
  }
}
```

## Approval

This design document must be approved by:
- [ ] Technical Lead
- [ ] Project Manager
- [ ] Product Owner

**Version**: 1.0.0
**Date**: December 26, 2025
**Status**: Draft → Ready for Review
