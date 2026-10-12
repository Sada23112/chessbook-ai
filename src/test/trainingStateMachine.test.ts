import { describe, it, expect } from 'vitest';
import {
  validateMoveAgainstExercise,
  createTrainingMachineState,
  transitionTrainingMachine,
  canTransition,
  type TrainingExercise,
} from '../training/trainingStateMachine';

describe('Training State Machine & Move Validation', () => {
  const sampleExercise: TrainingExercise = {
    id: 'test_card_1',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5', // 4... Nxe4, White to play
    turn: 'w',
    solutionMovesSan: ['Qe2', 'd4'],
    solutionMovesUci: ['d1e2', 'd2d4'],
    lesson: 'Develop the queen or strike in center against the pinned knight',
    motif: 'Pin / Center Strike',
  };

  it('correctly accepts matching solution move and returns next FEN', () => {
    const res = validateMoveAgainstExercise(sampleExercise, {
      from: 'd1',
      to: 'e2',
    });

    expect(res.isLegal).toBe(true);
    expect(res.isCorrect).toBe(true);
    expect(res.san).toBe('Qe2');
    expect(res.uci).toBe('d1e2');
    expect(res.resultingFen).toContain(' b '); // Black's turn now
  });

  it('rejects an incorrect legal move without marking it as correct', () => {
    const res = validateMoveAgainstExercise(sampleExercise, {
      from: 'c4',
      to: 'f7', // Bxf7+ (sacrifices bishop, not solution)
    });

    expect(res.isLegal).toBe(true);
    expect(res.isCorrect).toBe(false);
    expect(res.san).toBe('Bxf7+');
  });

  it('rejects an illegal move cleanly', () => {
    const res = validateMoveAgainstExercise(sampleExercise, {
      from: 'e1',
      to: 'e8', // King cannot jump to e8
    });

    expect(res.isLegal).toBe(false);
    expect(res.isCorrect).toBe(false);
  });

  it('correctly validates pawn promotion to Queen', () => {
    const promoExercise: TrainingExercise = {
      id: 'promo_card',
      fen: '8/4P3/8/8/8/8/k7/4K3 w - - 0 1',
      turn: 'w',
      solutionMovesSan: ['e8=Q'],
      solutionMovesUci: ['e7e8q'],
    };

    const res = validateMoveAgainstExercise(promoExercise, {
      from: 'e7',
      to: 'e8',
      promotion: 'q',
    });

    expect(res.isLegal).toBe(true);
    expect(res.isCorrect).toBe(true);
    expect(res.san).toBe('e8=Q');
  });

  it('correctly validates kingside castling (O-O)', () => {
    const castleExercise: TrainingExercise = {
      id: 'castle_card',
      fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
      turn: 'w',
      solutionMovesSan: ['O-O'],
      solutionMovesUci: ['e1g1'],
    };

    const res = validateMoveAgainstExercise(castleExercise, {
      from: 'e1',
      to: 'g1',
    });

    expect(res.isLegal).toBe(true);
    expect(res.isCorrect).toBe(true);
    expect(res.san).toBe('O-O');
  });

  it('handles multiple acceptable engine moves', () => {
    const multiExercise: TrainingExercise = {
      id: 'multi_card',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      turn: 'b',
      solutionMovesSan: ['e5'],
      solutionMovesUci: ['e7e5'],
      alternateAcceptableUci: ['c7c5', 'e7e6'], // Sicilian and French also acceptable
    };

    const res1 = validateMoveAgainstExercise(multiExercise, { from: 'c7', to: 'c5' });
    expect(res1.isCorrect).toBe(true);

    const res2 = validateMoveAgainstExercise(multiExercise, { from: 'a7', to: 'a6' });
    expect(res2.isCorrect).toBe(false);
  });

  describe('State Machine Transitions', () => {
    it('initializes in awaiting_move status', () => {
      const state = createTrainingMachineState(sampleExercise);
      expect(state.status).toBe('awaiting_move');
      expect(state.attemptsCount).toBe(0);
      expect(state.isSolved).toBe(false);
    });

    it('transitions to correct_feedback on valid correct move without advancing index', () => {
      let state = createTrainingMachineState(sampleExercise);

      state = transitionTrainingMachine(state, {
        type: 'START_MOVE_VALIDATION',
        attempt: { from: 'd1', to: 'e2' },
        requestId: 'req_1',
      });
      expect(state.status).toBe('validating_move');

      state = transitionTrainingMachine(state, {
        type: 'MOVE_VALIDATION_RESULT',
        result: {
          isLegal: true,
          isCorrect: true,
          san: 'Qe2',
          uci: 'd1e2',
          resultingFen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPPQPPP/RNB1K2R b KQkq - 1 5',
        },
        requestId: 'req_1',
      });

      expect(state.status).toBe('correct_feedback');
      expect(state.isSolved).toBe(true);
      expect(state.attemptsCount).toBe(1);
    });

    it('transitions to incorrect_feedback on wrong move and stays on current exercise', () => {
      let state = createTrainingMachineState(sampleExercise);

      state = transitionTrainingMachine(state, {
        type: 'START_MOVE_VALIDATION',
        attempt: { from: 'c4', to: 'f7' },
        requestId: 'req_2',
      });

      state = transitionTrainingMachine(state, {
        type: 'MOVE_VALIDATION_RESULT',
        result: {
          isLegal: true,
          isCorrect: false,
          san: 'Bxf7+',
          uci: 'c4f7',
          resultingFen: 'r1bqkb1r/pppp1Bpp/2n5/4p3/4n3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 5',
          reason: 'Alternative move is not the best continuation',
        },
        requestId: 'req_2',
      });

      expect(state.status).toBe('incorrect_feedback');
      expect(state.isSolved).toBe(false);
      expect(state.attemptsCount).toBe(1);

      // User retries -> goes back to awaiting_move cleanly
      state = transitionTrainingMachine(state, { type: 'RETRY' });
      expect(state.status).toBe('awaiting_move');
      expect(state.error).toBeNull();
    });

    it('ignores stale async validation results with mismatched requestId', () => {
      let state = createTrainingMachineState(sampleExercise);

      state = transitionTrainingMachine(state, {
        type: 'START_MOVE_VALIDATION',
        attempt: { from: 'd1', to: 'e2' },
        requestId: 'req_active',
      });

      // Obsolete request response arrives
      state = transitionTrainingMachine(state, {
        type: 'MOVE_VALIDATION_RESULT',
        result: {
          isLegal: true,
          isCorrect: true,
          san: 'Qe2',
          uci: 'd1e2',
          resultingFen: '...',
        },
        requestId: 'req_old_stale',
      });

      // Still in validating_move because stale response was ignored!
      expect(state.status).toBe('validating_move');
    });
  });
});
