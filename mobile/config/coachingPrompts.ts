/**
 * Coaching prompts and personality configuration for Gemini AI
 *
 * Defines the "Coach Rhythm" personality and prompt templates
 * for generating coaching tips and performance reviews.
 */

import type { PoseAnalysis, SupportedLanguage } from '../types/voiceCoach';

/**
 * Coach Rhythm personality definition
 * Used as system context for all Gemini interactions
 */
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

/**
 * Generate a coaching tip prompt for Gemini
 *
 * @param analysis - Pose analysis with score and body part data
 * @param language - Target language for the response
 * @returns Formatted prompt for Gemini
 */
export const COACHING_TIP_PROMPT = (analysis: PoseAnalysis, language: string): string => `
${COACH_PERSONALITY}

Generate a SHORT coaching tip (under 15 words) in ${language}.

Current score: ${analysis.score}%
Weak points: ${analysis.weakPoints.join(', ')}
Strong points: ${analysis.strongPoints.join(', ')}

Focus on the weakest point. Be encouraging and specific.
`;

/**
 * Game session data for performance review
 */
export interface GameSession {
  songTitle: string;
  songArtist: string;
  finalScore: number;
  previousBest: number | null;
  strongestPart: string;
  weakestPart: string;
  totalFrames?: number;
}

/**
 * Generate a performance review prompt for Gemini
 *
 * @param session - Game session data
 * @param language - Target language for the response
 * @returns Formatted prompt for Gemini
 */
export const PERFORMANCE_REVIEW_PROMPT = (session: GameSession, language: string): string => `
${COACH_PERSONALITY}

Generate a spoken performance review (under 100 words) in ${language}.

Song: ${session.songTitle} by ${session.songArtist}
Final Score: ${session.finalScore}%
Previous Best: ${session.previousBest !== null ? `${session.previousBest}%` : 'N/A'}
Strongest: ${session.strongestPart}
Weakest: ${session.weakestPart}

Include:
1. Congratulate on the score
2. Compare to previous best if available
3. Mention strongest body part
4. Give ONE tip for weakest body part
5. End with a motivating question
`;

/**
 * Conversation context for multi-turn interactions
 */
export interface ConversationContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionStartTime: number;
  language: SupportedLanguage;
}

/**
 * Generate a conversation prompt for Gemini
 *
 * @param userMessage - User's message
 * @param context - Conversation context
 * @returns Formatted prompt for Gemini
 */
export const CONVERSATION_PROMPT = (userMessage: string, context: ConversationContext): string => `
${COACH_PERSONALITY}

You are having a conversation with a dancer. Keep responses under 200 words.

Language: ${context.language}

Previous conversation:
${context.messages.map(m => `${m.role}: ${m.content}`).join('\n')}

User: ${userMessage}

Respond naturally and stay on topic about dance, music, or the app.
If the user asks about something off-topic, gently redirect to dance-related topics.
`;

/**
 * Cooldown periods by coaching frequency setting
 */
export const COOLDOWN_PERIODS = {
  low: 6000,    // 6 seconds
  normal: 3000, // 3 seconds
  high: 1500,   // 1.5 seconds
} as const;

/**
 * Score thresholds for feedback triggering
 */
export const SCORE_THRESHOLDS = {
  LOW_SCORE: 70,  // Below this triggers coaching tips
  HIGH_SCORE: 90, // Above this triggers encouragement
} as const;
