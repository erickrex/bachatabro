/**
 * Fallback phrases for when API calls fail
 * Used by GeminiClient to provide graceful degradation
 */

import type { SupportedLanguage } from '../types/voiceCoach';

// Coaching tips for when score is below threshold
export const FALLBACK_COACHING_TIPS: Record<SupportedLanguage, string[]> = {
  en: [
    'Keep those arms up!',
    'Great energy! Watch your timing.',
    'Nice moves! Try bigger arm swings.',
    "You're doing great! Stay on beat.",
    'Awesome! Focus on your footwork.',
  ],
  es: [
    '¡Mantén los brazos arriba!',
    '¡Gran energía! Cuida el ritmo.',
    '¡Buenos movimientos! Intenta balanceos más grandes.',
    '¡Lo estás haciendo genial! Mantén el ritmo.',
    '¡Increíble! Concéntrate en tus pies.',
  ],
  de: [
    'Halte die Arme oben!',
    'Tolle Energie! Achte auf das Timing.',
    'Schöne Bewegungen! Versuche größere Armschwünge.',
    'Du machst das großartig! Bleib im Takt.',
    'Super! Konzentriere dich auf deine Fußarbeit.',
  ],
  ru: [
    'Держи руки выше!',
    'Отличная энергия! Следи за ритмом.',
    'Хорошие движения! Попробуй больше махов руками.',
    'Ты отлично справляешься! Держи ритм.',
    'Потрясающе! Сосредоточься на работе ног.',
  ],
};

// Encouragements for when score is high
export const FALLBACK_ENCOURAGEMENTS: Record<SupportedLanguage, string[]> = {
  en: [
    "Perfect! You're on fire!",
    'Amazing moves!',
    "You're crushing it!",
    'Incredible! Keep it up!',
    'Wow! That was perfect!',
  ],
  es: [
    '¡Perfecto! ¡Estás en llamas!',
    '¡Movimientos increíbles!',
    '¡Lo estás aplastando!',
    '¡Increíble! ¡Sigue así!',
    '¡Guau! ¡Eso fue perfecto!',
  ],
  de: [
    'Perfekt! Du bist on fire!',
    'Unglaubliche Bewegungen!',
    'Du rockst das!',
    'Unglaublich! Weiter so!',
    'Wow! Das war perfekt!',
  ],
  ru: [
    'Идеально! Ты в ударе!',
    'Потрясающие движения!',
    'Ты справляешься отлично!',
    'Невероятно! Продолжай!',
    'Вау! Это было идеально!',
  ],
};

// Performance review templates
export const FALLBACK_REVIEWS: Record<SupportedLanguage, { template: string }> = {
  en: {
    template:
      "Great job on {songTitle}! You scored {score}%. Keep practicing and you'll keep improving. Ready for another round?",
  },
  es: {
    template:
      '¡Buen trabajo en {songTitle}! Obtuviste {score}%. Sigue practicando y seguirás mejorando. ¿Listo para otra ronda?',
  },
  de: {
    template:
      'Gut gemacht bei {songTitle}! Du hast {score}% erreicht. Übe weiter und du wirst dich verbessern. Bereit für eine weitere Runde?',
  },
  ru: {
    template:
      'Отличная работа над {songTitle}! Ты набрал {score}%. Продолжай практиковаться. Готов к ещё одному раунду?',
  },
};
