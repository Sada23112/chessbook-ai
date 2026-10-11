import { describe, it, expect } from 'vitest';
import { calculateNextReview, isCardDue, createTrainingCardFromMistake } from '../training/srsEngine';
import type { TrainingCard } from '../types/chess';

describe('Spaced Repetition System (SRS)', () => {
  const dummyCard: TrainingCard = {
    id: 'c1',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    playedMoveSan: 'h4',
    solutionMovesSan: ['e4'],
    solutionMovesUci: ['e2e4'],
    lesson: 'Control the center',
    motif: 'Center Control',
    type: 'mistake',
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: Date.now() - 1000, // Due
  };

  it('identifies due cards accurately', () => {
    expect(isCardDue(dummyCard)).toBe(true);

    const futureCard = { ...dummyCard, dueDate: Date.now() + 100000 };
    expect(isCardDue(futureCard)).toBe(false);
  });

  it('increases interval upon correct answers according to SM-2', () => {
    // First correct review: interval becomes 1, repetitions becomes 1
    const rev1 = calculateNextReview(dummyCard, true, 4);
    expect(rev1.repetitions).toBe(1);
    expect(rev1.interval).toBe(1);

    // Second correct review: interval becomes 3, repetitions becomes 2
    const card2 = { ...dummyCard, ...rev1 };
    const rev2 = calculateNextReview(card2, true, 4);
    expect(rev2.repetitions).toBe(2);
    expect(rev2.interval).toBe(3);

    // Third correct review: interval becomes 3 * 2.5 = 8
    const card3 = { ...dummyCard, ...rev2 };
    const rev3 = calculateNextReview(card3, true, 5);
    expect(rev3.repetitions).toBe(3);
    expect(rev3.interval).toBeGreaterThanOrEqual(7);
  });

  it('resets repetition streak upon failure', () => {
    const seasonedCard = {
      ...dummyCard,
      repetitions: 4,
      interval: 15,
      easeFactor: 2.5,
    };

    const failedRev = calculateNextReview(seasonedCard, false, 1);
    expect(failedRev.repetitions).toBe(0);
    expect(failedRev.interval).toBe(1);
  });

  it('creates training card from mistake with proper defaults', () => {
    const card = createTrainingCardFromMistake({
      gameId: 'g123',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      turn: 'w',
      playedMoveSan: 'Bc4',
      bestMoveSan: 'Bb5',
      bestMoveUci: 'f1b5',
      lesson: 'Ruy Lopez pins the knight',
      motif: 'Pin',
    });

    expect(card.gameId).toBe('g123');
    expect(card.solutionMovesSan).toContain('Bb5');
    expect(card.solutionMovesUci).toContain('f1b5');
    expect(card.type).toBe('mistake');
    expect(card.easeFactor).toBe(2.5);
  });
});
