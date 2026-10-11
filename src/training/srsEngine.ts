import type { TrainingCard } from '../types/chess';

// SuperMemo SM-2 Spaced Repetition calculation
export function calculateNextReview(
  card: TrainingCard,
  isCorrect: boolean,
  grade: number = isCorrect ? 4 : 1 // grade 0 to 5
): { interval: number; easeFactor: number; repetitions: number; dueDate: number } {
  let { interval, easeFactor, repetitions } = card;

  if (isCorrect) {
    if (repetitions === 0) {
      interval = 1; // 1 day
    } else if (repetitions === 1) {
      interval = 3; // 3 days
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Reset streak on failure
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  easeFactor = Math.max(1.3, easeFactor + delta);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const dueDate = Date.now() + interval * MS_PER_DAY;

  return { interval, easeFactor, repetitions, dueDate };
}

export function isCardDue(card: TrainingCard, now: number = Date.now()): boolean {
  return card.dueDate <= now;
}

export function createTrainingCardFromMistake(params: {
  gameId: string;
  fen: string;
  turn: 'w' | 'b';
  playedMoveSan: string;
  bestMoveSan: string;
  bestMoveUci: string;
  pvSan?: string[];
  pvUci?: string[];
  lesson: string;
  motif: string;
}): TrainingCard {
  return {
    id: `card_${params.gameId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    gameId: params.gameId,
    fen: params.fen,
    turn: params.turn,
    playedMoveSan: params.playedMoveSan,
    solutionMovesSan: [params.bestMoveSan],
    solutionMovesUci: [params.bestMoveUci],
    continuation: params.pvSan,
    lesson: params.lesson,
    motif: params.motif,
    type: 'mistake',
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: Date.now(), // Due immediately for initial practice
    lastReviewed: undefined,
    lastSuccess: undefined,
  };
}
