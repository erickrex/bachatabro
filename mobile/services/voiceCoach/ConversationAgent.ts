/**
 * Conversational AI Agent Service
 *
 * Provides conversational AI capabilities for the Bacha Trainer app.
 * Implements conversation context management, idle timeout, and off-topic redirection.
 *
 * Requirements: 7.1, 7.3, 7.5, 7.6
 */

import { GeminiClient } from './GeminiClient';
import { ElevenLabsClient } from './ElevenLabsClient';
import { AudioManager, AudioClip } from './AudioManager';
import type { SupportedLanguage } from '../../types/voiceCoach';
import { getLanguageAppropriateVoice } from '../../config/voiceConfig';

// Conversation message structure
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Conversation context
export interface ConversationContext {
  messages: ConversationMessage[];
  sessionStartTime: number;
  language: SupportedLanguage;
}

// Configuration for ConversationAgent
export interface ConversationAgentConfig {
  geminiClient: GeminiClient;
  elevenLabsClient: ElevenLabsClient;
  audioManager: AudioManager;
  language?: SupportedLanguage;
  voiceId?: string;
  idleTimeoutMs?: number;
  maxContextMessages?: number;
}

// Off-topic redirection messages by language
const OFF_TOPIC_REDIRECTIONS: Record<SupportedLanguage, string[]> = {
  en: [
    "That's interesting! But let's focus on your dance moves. What would you like to know about dancing?",
    "I'd love to chat about that, but I'm here to help you dance better! Any questions about your technique?",
    "Great topic! But as your dance coach, I'm best at helping with dance. What can I help you improve?",
    "Let's get back to dancing! Do you have any questions about your moves or technique?",
  ],
  es: [
    '¡Interesante! Pero concentrémonos en tus movimientos de baile. ¿Qué te gustaría saber sobre bailar?',
    'Me encantaría hablar de eso, ¡pero estoy aquí para ayudarte a bailar mejor! ¿Alguna pregunta sobre tu técnica?',
    '¡Buen tema! Pero como tu entrenador de baile, soy mejor ayudando con el baile. ¿En qué puedo ayudarte a mejorar?',
    '¡Volvamos a bailar! ¿Tienes alguna pregunta sobre tus movimientos o técnica?',
  ],
  de: [
    'Das ist interessant! Aber lass uns auf deine Tanzbewegungen konzentrieren. Was möchtest du über das Tanzen wissen?',
    'Ich würde gerne darüber plaudern, aber ich bin hier, um dir beim Tanzen zu helfen! Fragen zu deiner Technik?',
    'Tolles Thema! Aber als dein Tanzcoach bin ich am besten beim Tanzen. Wobei kann ich dir helfen?',
    'Lass uns zum Tanzen zurückkehren! Hast du Fragen zu deinen Bewegungen oder Technik?',
  ],
  ru: [
    'Это интересно! Но давай сосредоточимся на твоих танцевальных движениях. Что бы ты хотел узнать о танцах?',
    'Я бы с удовольствием поговорил об этом, но я здесь, чтобы помочь тебе танцевать лучше! Есть вопросы о технике?',
    'Отличная тема! Но как твой танцевальный тренер, я лучше всего помогаю с танцами. Чем могу помочь?',
    'Давай вернёмся к танцам! Есть вопросы о твоих движениях или технике?',
  ],
};

// Conversation ended messages by language
const CONVERSATION_ENDED_MESSAGES: Record<SupportedLanguage, string> = {
  en: "It seems you're busy. Let me know when you want to chat about dancing!",
  es: 'Parece que estás ocupado. ¡Avísame cuando quieras hablar sobre bailar!',
  de: 'Du scheinst beschäftigt zu sein. Sag mir Bescheid, wenn du über Tanzen reden möchtest!',
  ru: 'Похоже, ты занят. Дай знать, когда захочешь поговорить о танцах!',
};

// Dance-related keywords for topic detection
const DANCE_KEYWORDS = [
  // English
  'dance', 'dancing', 'move', 'moves', 'step', 'steps', 'rhythm', 'beat', 'music',
  'choreography', 'routine', 'practice', 'technique', 'arms', 'legs', 'feet', 'foot',
  'hip', 'hips', 'body', 'posture', 'timing', 'score', 'performance', 'bachata',
  'salsa', 'song', 'play', 'game', 'improve', 'better', 'learn', 'teach', 'help',
  'tip', 'tips', 'advice', 'feedback', 'coach', 'training', 'workout', 'exercise',
  // Spanish
  'bailar', 'baile', 'movimiento', 'paso', 'pasos', 'ritmo', 'música', 'coreografía',
  'práctica', 'técnica', 'brazos', 'piernas', 'pies', 'cadera', 'cuerpo', 'postura',
  'puntuación', 'canción', 'jugar', 'mejorar', 'aprender', 'enseñar', 'ayuda',
  'consejo', 'consejos', 'entrenamiento',
  // German
  'tanzen', 'tanz', 'bewegung', 'schritt', 'schritte', 'takt', 'musik',
  'choreografie', 'übung', 'technik', 'arme', 'beine', 'füße', 'hüfte', 'körper',
  'haltung', 'punktzahl', 'lied', 'spielen', 'verbessern', 'lernen', 'lehren',
  'hilfe', 'tipp', 'tipps', 'rat', 'training',
  // Russian
  'танец', 'танцевать', 'движение', 'шаг', 'шаги', 'ритм', 'музыка', 'хореография',
  'практика', 'техника', 'руки', 'ноги', 'ступни', 'бёдра', 'тело', 'осанка',
  'счёт', 'песня', 'играть', 'улучшить', 'учиться', 'учить', 'помощь',
  'совет', 'советы', 'тренировка',
];

export class ConversationAgent {
  private geminiClient: GeminiClient;
  private elevenLabsClient: ElevenLabsClient;
  private audioManager: AudioManager;
  private context: ConversationContext;
  private idleTimeoutMs: number;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private isActive: boolean = false;
  private language: SupportedLanguage;
  private voiceId: string;
  private maxContextMessages: number;

  // Event handlers
  public onConversationStart: (() => void) | null = null;
  public onConversationEnd: (() => void) | null = null;
  public onMessageReceived: ((message: ConversationMessage) => void) | null = null;

  constructor(config: ConversationAgentConfig) {
    this.geminiClient = config.geminiClient;
    this.elevenLabsClient = config.elevenLabsClient;
    this.audioManager = config.audioManager;
    this.language = config.language || 'en';
    // Use language-appropriate voice if no voiceId provided
    this.voiceId = config.voiceId || getLanguageAppropriateVoice(this.language);
    this.idleTimeoutMs = config.idleTimeoutMs || 30000; // 30 seconds default
    this.maxContextMessages = config.maxContextMessages || 10;

    // Initialize empty context
    this.context = {
      messages: [],
      sessionStartTime: 0,
      language: this.language,
    };
  }


  /**
   * Start conversation mode
   * Initializes a new conversation session and starts idle timer
   *
   * Requirement: 7.1
   */
  public startConversation(): void {
    if (this.isActive) {
      return; // Already in conversation mode
    }

    this.isActive = true;
    this.context = {
      messages: [],
      sessionStartTime: Date.now(),
      language: this.language,
    };

    this.resetIdleTimer();

    if (this.onConversationStart) {
      this.onConversationStart();
    }
  }

  /**
   * End conversation mode
   * Clears context and stops idle timer
   *
   * Requirement: 7.5
   */
  public endConversation(): void {
    if (!this.isActive) {
      return; // Not in conversation mode
    }

    this.isActive = false;
    this.clearIdleTimer();

    if (this.onConversationEnd) {
      this.onConversationEnd();
    }
  }

  /**
   * Check if conversation is active
   */
  public isConversationActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current conversation context
   *
   * Requirement: 7.3
   */
  public getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Get conversation messages
   *
   * Requirement: 7.3
   */
  public getMessages(): ConversationMessage[] {
    return [...this.context.messages];
  }

  /**
   * Process a user message and generate a response
   * Handles off-topic detection and context retention
   *
   * Requirements: 7.3, 7.6
   */
  public async processMessage(transcript: string): Promise<string> {
    if (!this.isActive) {
      // Auto-start conversation if not active
      this.startConversation();
    }

    // Reset idle timer on each message
    this.resetIdleTimer();

    // Add user message to context
    const userMessage: ConversationMessage = {
      role: 'user',
      content: transcript,
      timestamp: Date.now(),
    };
    this.addMessageToContext(userMessage);

    if (this.onMessageReceived) {
      this.onMessageReceived(userMessage);
    }

    // Check if message is off-topic
    if (this.isOffTopic(transcript)) {
      const redirectionResponse = this.getOffTopicRedirection();
      
      // Add assistant response to context
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: redirectionResponse,
        timestamp: Date.now(),
      };
      this.addMessageToContext(assistantMessage);

      // Speak the redirection
      await this.speak(redirectionResponse);

      return redirectionResponse;
    }

    // Generate response using Gemini with context
    try {
      const response = await this.generateResponse(transcript);

      // Add assistant response to context
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      this.addMessageToContext(assistantMessage);

      // Speak the response
      await this.speak(response);

      return response;
    } catch (error) {
      console.error('[ConversationAgent] Error generating response:', error);
      
      // Use fallback response
      const fallbackResponse = this.getFallbackResponse();
      
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: fallbackResponse,
        timestamp: Date.now(),
      };
      this.addMessageToContext(assistantMessage);

      await this.speak(fallbackResponse);

      return fallbackResponse;
    }
  }

  /**
   * Check if a message is off-topic (not related to dance)
   *
   * Requirement: 7.6
   */
  public isOffTopic(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    
    // Check if any dance-related keyword is present as a whole word
    const hasDanceKeyword = DANCE_KEYWORDS.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      // Use word boundary regex to match whole words only
      const regex = new RegExp(`\\b${this.escapeRegex(keywordLower)}\\b`, 'i');
      return regex.test(normalizedMessage);
    });

    // If no dance keywords found, it's likely off-topic
    return !hasDanceKeyword;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get a random off-topic redirection message
   *
   * Requirement: 7.6
   */
  public getOffTopicRedirection(): string {
    const redirections = OFF_TOPIC_REDIRECTIONS[this.language] || OFF_TOPIC_REDIRECTIONS.en;
    return redirections[Math.floor(Math.random() * redirections.length)];
  }

  /**
   * Generate a response using Gemini with conversation context
   *
   * Requirement: 7.3
   */
  private async generateResponse(userMessage: string): Promise<string> {
    // Build context string from previous messages
    const contextString = this.buildContextString();

    // For now, use the coaching tip endpoint with context
    // In a full implementation, this would use a dedicated conversation endpoint
    const response = await this.geminiClient.generateCoachingTip({
      score: 75, // Neutral score for conversation
      weakPoints: [],
      strongPoints: [],
      language: this.language,
    });

    // The response tip serves as a conversation response
    // In production, this would be a dedicated conversation API
    return response.tip;
  }

  /**
   * Build a context string from conversation history
   *
   * Requirement: 7.3
   */
  private buildContextString(): string {
    return this.context.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Add a message to the conversation context
   * Maintains a maximum number of messages for context window
   *
   * Requirement: 7.3
   */
  private addMessageToContext(message: ConversationMessage): void {
    this.context.messages.push(message);

    // Trim context if it exceeds max messages
    if (this.context.messages.length > this.maxContextMessages) {
      this.context.messages = this.context.messages.slice(-this.maxContextMessages);
    }
  }

  /**
   * Get a fallback response when API fails
   */
  private getFallbackResponse(): string {
    const fallbacks: Record<SupportedLanguage, string[]> = {
      en: [
        "I'm here to help you dance better! What would you like to know?",
        "Let's talk about your dance moves! Any questions?",
        "Ready to improve your dancing? Ask me anything!",
      ],
      es: [
        '¡Estoy aquí para ayudarte a bailar mejor! ¿Qué te gustaría saber?',
        '¡Hablemos de tus movimientos de baile! ¿Alguna pregunta?',
        '¿Listo para mejorar tu baile? ¡Pregúntame lo que quieras!',
      ],
      de: [
        'Ich bin hier, um dir beim Tanzen zu helfen! Was möchtest du wissen?',
        'Lass uns über deine Tanzbewegungen sprechen! Fragen?',
        'Bereit, dein Tanzen zu verbessern? Frag mich alles!',
      ],
      ru: [
        'Я здесь, чтобы помочь тебе танцевать лучше! Что бы ты хотел узнать?',
        'Давай поговорим о твоих танцевальных движениях! Есть вопросы?',
        'Готов улучшить свой танец? Спрашивай что угодно!',
      ],
    };

    const responses = fallbacks[this.language] || fallbacks.en;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Speak a message using TTS
   */
  private async speak(text: string): Promise<void> {
    try {
      const ttsResponse = await this.elevenLabsClient.textToSpeech({
        text,
        voiceId: this.voiceId,
        language: this.language,
      });

      const clip: AudioClip = {
        id: `conversation-${Date.now()}`,
        audio: ttsResponse.audio,
        priority: 'normal',
        text,
      };

      this.audioManager.enqueue(clip);
    } catch (error) {
      console.error('[ConversationAgent] Error speaking:', error);
    }
  }

  /**
   * Reset the idle timer
   * Called on each user interaction
   *
   * Requirement: 7.5
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.idleTimeoutMs);
  }

  /**
   * Clear the idle timer
   */
  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Handle idle timeout - end conversation after inactivity
   *
   * Requirement: 7.5
   */
  private async handleIdleTimeout(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    // Speak goodbye message
    const message = CONVERSATION_ENDED_MESSAGES[this.language] || CONVERSATION_ENDED_MESSAGES.en;
    await this.speak(message);

    // End the conversation
    this.endConversation();
  }

  /**
   * Set language and update voice to be language-appropriate
   */
  public setLanguage(language: SupportedLanguage): void {
    this.language = language;
    this.context.language = language;
    // Update voice to be appropriate for the new language
    this.voiceId = getLanguageAppropriateVoice(language, this.voiceId);
  }

  /**
   * Get language
   */
  public getLanguage(): SupportedLanguage {
    return this.language;
  }

  /**
   * Set voice ID
   */
  public setVoiceId(voiceId: string): void {
    this.voiceId = voiceId;
  }

  /**
   * Get voice ID
   */
  public getVoiceId(): string {
    return this.voiceId;
  }

  /**
   * Set idle timeout in milliseconds
   */
  public setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms;
  }

  /**
   * Get idle timeout in milliseconds
   */
  public getIdleTimeout(): number {
    return this.idleTimeoutMs;
  }

  /**
   * Clear conversation context (useful for testing)
   */
  public clearContext(): void {
    this.context = {
      messages: [],
      sessionStartTime: this.isActive ? this.context.sessionStartTime : 0,
      language: this.language,
    };
  }
}
