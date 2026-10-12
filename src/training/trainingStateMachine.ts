import { Chess } from 'chess.js';

export type TrainingStatus =
  | 'loading_position'
  | 'awaiting_move'
  | 'validating_move'
  | 'correct_feedback'
  | 'incorrect_feedback'
  | 'showing_solution'
  | 'demonstrating_continuation'
  | 'completed'
  | 'error';

export interface MoveAttempt {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
}

export interface TrainingExercise {
  id: string;
  fen: string;
  turn: 'w' | 'b';
  solutionMovesSan: string[];
  solutionMovesUci: string[];
  alternateAcceptableUci?: string[];
  continuation?: string[];
  playedMoveSan?: string;
  lesson?: string;
  motif?: string;
}

export interface ValidationResult {
  isLegal: boolean;
  isCorrect: boolean;
  san: string;
  uci: string;
  resultingFen: string;
  reason?: string;
}

export interface TrainingMachineState {
  exerciseId: string;
  status: TrainingStatus;
  currentFen: string;
  lastAttempt: MoveAttempt | null;
  attemptsCount: number;
  isSolved: boolean;
  error: string | null;
  requestId: string | null;
  demonstrationPly: number;
}

// Valid transitions map
const VALID_TRANSITIONS: Record<TrainingStatus, TrainingStatus[]> = {
  loading_position: ['awaiting_move', 'error'],
  awaiting_move: ['validating_move', 'showing_solution', 'loading_position'],
  validating_move: ['correct_feedback', 'incorrect_feedback', 'error'],
  correct_feedback: ['demonstrating_continuation', 'completed', 'loading_position'],
  incorrect_feedback: ['awaiting_move', 'showing_solution', 'loading_position'],
  showing_solution: ['awaiting_move', 'completed', 'loading_position'],
  demonstrating_continuation: ['completed', 'loading_position'],
  completed: ['loading_position', 'awaiting_move'],
  error: ['loading_position', 'awaiting_move'],
};

export function canTransition(from: TrainingStatus, to: TrainingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates a move attempt strictly against the chess position and solution set.
 */
export function validateMoveAgainstExercise(
  exercise: TrainingExercise,
  attempt: MoveAttempt
): ValidationResult {
  try {
    const chess = new Chess(exercise.fen);

    // Validate turn matches
    if (chess.turn() !== exercise.turn) {
      return {
        isLegal: false,
        isCorrect: false,
        san: '',
        uci: '',
        resultingFen: exercise.fen,
        reason: 'Not your turn',
      };
    }

    // Execute move in chess.js
    const moveRes = chess.move({
      from: attempt.from,
      to: attempt.to,
      promotion: attempt.promotion || 'q',
    });

    if (!moveRes) {
      return {
        isLegal: false,
        isCorrect: false,
        san: '',
        uci: '',
        resultingFen: exercise.fen,
        reason: 'Illegal chess move',
      };
    }

    const playedUci = `${moveRes.from}${moveRes.to}${moveRes.promotion || ''}`;
    const playedSan = moveRes.san;

    // Check if played move matches accepted solution set
    const isSolutionUci = exercise.solutionMovesUci.some((u) => {
      const cleanU = u.trim().toLowerCase();
      return cleanU === playedUci || cleanU === `${moveRes.from}${moveRes.to}`;
    });

    const isSolutionSan = exercise.solutionMovesSan.some((s) => s.trim() === playedSan);

    const isAlternateAcceptable = (exercise.alternateAcceptableUci || []).some((u) => {
      const cleanU = u.trim().toLowerCase();
      return cleanU === playedUci || cleanU === `${moveRes.from}${moveRes.to}`;
    });

    const isCorrect = isSolutionUci || isSolutionSan || isAlternateAcceptable;

    return {
      isLegal: true,
      isCorrect,
      san: playedSan,
      uci: playedUci,
      resultingFen: chess.fen(),
      reason: isCorrect ? 'Accepted solution' : 'Alternative move is not the best continuation',
    };
  } catch (err: unknown) {
    return {
      isLegal: false,
      isCorrect: false,
      san: '',
      uci: '',
      resultingFen: exercise.fen,
      reason: err instanceof Error ? err.message : 'Validation error',
    };
  }
}

/**
 * Initializes a new clean state machine for an exercise.
 */
export function createTrainingMachineState(exercise: TrainingExercise): TrainingMachineState {
  return {
    exerciseId: exercise.id,
    status: 'awaiting_move',
    currentFen: exercise.fen,
    lastAttempt: null,
    attemptsCount: 0,
    isSolved: false,
    error: null,
    requestId: null,
    demonstrationPly: 0,
  };
}

/**
 * Pure transition handler for training state machine.
 */
export function transitionTrainingMachine(
  state: TrainingMachineState,
  action:
    | { type: 'START_MOVE_VALIDATION'; attempt: MoveAttempt; requestId: string }
    | { type: 'MOVE_VALIDATION_RESULT'; result: ValidationResult; requestId: string }
    | { type: 'RETRY' }
    | { type: 'SHOW_SOLUTION'; solutionFen: string }
    | { type: 'DEMONSTRATE_STEP'; nextFen: string; ply: number }
    | { type: 'COMPLETE' }
    | { type: 'RESET'; exercise: TrainingExercise }
): TrainingMachineState {
  switch (action.type) {
    case 'START_MOVE_VALIDATION': {
      if (!canTransition(state.status, 'validating_move')) {
        return state;
      }
      return {
        ...state,
        status: 'validating_move',
        lastAttempt: action.attempt,
        requestId: action.requestId,
      };
    }

    case 'MOVE_VALIDATION_RESULT': {
      // Discard stale responses from obsolete requests
      if (state.requestId !== action.requestId) {
        return state;
      }

      if (!action.result.isLegal) {
        return {
          ...state,
          status: 'awaiting_move',
          requestId: null,
        };
      }

      if (action.result.isCorrect) {
        if (!canTransition(state.status, 'correct_feedback')) {
          return state;
        }
        return {
          ...state,
          status: 'correct_feedback',
          currentFen: action.result.resultingFen,
          attemptsCount: state.attemptsCount + 1,
          isSolved: true,
          requestId: null,
          error: null,
        };
      } else {
        if (!canTransition(state.status, 'incorrect_feedback')) {
          return state;
        }
        return {
          ...state,
          status: 'incorrect_feedback',
          attemptsCount: state.attemptsCount + 1,
          requestId: null,
          error: action.result.reason || 'Incorrect move',
        };
      }
    }

    case 'RETRY': {
      if (!canTransition(state.status, 'awaiting_move')) {
        return state;
      }
      return {
        ...state,
        status: 'awaiting_move',
        error: null,
        requestId: null,
      };
    }

    case 'SHOW_SOLUTION': {
      if (!canTransition(state.status, 'showing_solution')) {
        return state;
      }
      return {
        ...state,
        status: 'showing_solution',
        currentFen: action.solutionFen,
        requestId: null,
      };
    }

    case 'DEMONSTRATE_STEP': {
      return {
        ...state,
        status: 'demonstrating_continuation',
        currentFen: action.nextFen,
        demonstrationPly: action.ply,
      };
    }

    case 'COMPLETE': {
      return {
        ...state,
        status: 'completed',
        requestId: null,
      };
    }

    case 'RESET': {
      return createTrainingMachineState(action.exercise);
    }

    default:
      return state;
  }
}
