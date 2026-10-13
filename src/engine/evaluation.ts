import type { MoveClassification, UserSettings } from '../types/chess';

// Convert mate in N to centipawns
export function mateToCentipawns(mate: number): number {
  if (mate === 0) return 0;
  // Positive mate means white mates in N moves; negative means black mates
  const sign = mate > 0 ? 1 : -1;
  const distance = Math.abs(mate);
  return sign * Math.max(10000 - distance * 100, 3000);
}

// Convert engine score to White-relative centipawns
export function normalizeScoreToWhite(
  scoreCp: number | undefined,
  mate: number | undefined,
  turn: 'w' | 'b'
): number {
  let score = 0;
  if (mate !== undefined && mate !== 0) {
    const mateCp = mateToCentipawns(mate);
    score = turn === 'w' ? mateCp : -mateCp;
  } else if (scoreCp !== undefined) {
    score = turn === 'w' ? scoreCp : -scoreCp;
  }
  return score;
}

// Convert centipawns to expected win probability (0 to 100%)
export function centipawnsToWinProbability(cp: number): number {
  // Sigmoid formula used in chess analysis models
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Calculate move accuracy (0 to 100) based on centipawn loss and game context (Chess.com CAPS2 aligned)
export function calculateMoveAccuracy(cpl: number, evalBefore?: number, evalAfter?: number): number {
  if (cpl <= 0) return 100;
  // If comfortably winning and maintained advantage, award high accuracy (Chess.com CAPS2 model)
  if (evalBefore !== undefined && evalAfter !== undefined && evalBefore >= 200 && evalAfter >= 130) {
    return Math.max(88, Math.min(100, Math.round(100 - cpl * 0.06)));
  }
  const acc = 103.1668 * Math.exp(-0.04354 * (cpl / 10)) - 3.1669;
  return Math.max(0, Math.min(100, Math.round(acc)));
}

export interface ClassificationParams {
  evalBefore: number; // Mover's perspective centipawns
  evalAfter: number;  // Mover's perspective centipawns
  isBestMove: boolean;
  isBookMove?: boolean;
  isOnlyLegalMove?: boolean;
  isGreatMove?: boolean;
  isPieceSacrifice?: boolean;
  customThresholds?: UserSettings['customClassifications'];
}

/**
 * Classifies a played move based on engine evaluation, tactical context, and repertoire data.
 * Adheres to Chess.com-style classifications with rigorous, documented criteria.
 */
export function classifyMove({
  evalBefore,
  evalAfter,
  isBestMove,
  isBookMove = false,
  isOnlyLegalMove = false,
  isGreatMove = false,
  isPieceSacrifice = false,
  customThresholds,
}: ClassificationParams): { classification: MoveClassification; cpl: number } {
  // 1. Book move: Verified match against opening repertoire or opening book
  if (isBookMove) {
    return { classification: 'book', cpl: 0 };
  }

  // 2. Forced move: The only legal option available
  if (isOnlyLegalMove) {
    return { classification: 'forced', cpl: 0 };
  }

  // Centipawn loss is how much the mover's advantage dropped
  const rawLoss = evalBefore - evalAfter;
  const cpl = Math.max(0, Math.round(rawLoss));

  // 3. Brilliant move: Piece sacrifice that is top engine move or near-best and maintains a decisive winning advantage
  if ((isBestMove || cpl <= 10) && isPieceSacrifice && evalAfter >= 70 && evalBefore < 1000) {
    return { classification: 'brilliant', cpl: 0 };
  }

  // 4. Great move: Crucial only-move or key tactical find maintaining advantage
  if (isGreatMove && (isBestMove || cpl <= 10)) {
    return { classification: 'great', cpl: 0 };
  }

  // 5. Best move: Top engine choice within analysis settings
  if (isBestMove || cpl <= 5) {
    return { classification: 'best', cpl: 0 };
  }

  const blunderThresh = customThresholds?.blunderThreshold ?? 200;
  const mistakeThresh = customThresholds?.mistakeThreshold ?? 90;
  const inaccuracyThresh = customThresholds?.inaccuracyThreshold ?? 40;

  // 6. Missed Win: Player had a winning position (+300 or mate) but dropped to equal/losing
  if (evalBefore >= 300 && evalAfter < 120 && cpl >= 150) {
    return { classification: 'missedWin', cpl };
  }

  // 7. Preserving winning advantage (Chess.com CAPS2 rule):
  // If mover was already clearly winning (>= 200 cp) and remains decisively winning (>= 130 cp),
  // do not penalize simplifying or solid moves as mistakes or blunders!
  if (evalBefore >= 200 && evalAfter >= 130) {
    if (cpl <= 50) return { classification: 'excellent', cpl };
    return { classification: 'good', cpl };
  }

  // Overwhelmingly winning positions: If eval is +500 and still +300, it's good
  if (evalBefore >= 500 && evalAfter >= 300) {
    return { classification: 'good', cpl };
  }

  // 8. Blunder
  if (cpl >= blunderThresh) {
    return { classification: 'blunder', cpl };
  }

  // 9. Mistake
  if (cpl >= mistakeThresh) {
    return { classification: 'mistake', cpl };
  }

  // 10. Inaccuracy
  if (cpl >= inaccuracyThresh) {
    return { classification: 'inaccuracy', cpl };
  }

  // 11. Excellent move (near optimal, <= 15 CPL)
  if (cpl <= 15) {
    return { classification: 'excellent', cpl };
  }

  // 12. Good move
  return { classification: 'good', cpl };
}

// Estimate performance rating based on game accuracy and average centipawn loss
export function estimatePerformanceElo(accuracy: number, avgCpl: number): number {
  const base = 400 + Math.pow(Math.max(0, accuracy) / 100, 2.3) * 2350;
  const cplDeduction = Math.min(350, avgCpl * 2.2);
  const estimated = Math.round(base - cplDeduction);
  return Math.max(400, Math.min(2900, estimated));
}

// Generate Chess.com-style Game Review verdict
export function generateGameVerdict(
  whiteAcc: number,
  blackAcc: number,
  whiteElo?: number,
  blackElo?: number
): string {
  const diff = whiteAcc - blackAcc;
  if (Math.abs(diff) <= 3) {
    return 'A well-matched struggle with both players trading balanced resources into the endgame.';
  } else if (diff > 0) {
    return `White displayed higher precision (${whiteAcc}% vs ${blackAcc}%), effectively punishing opponent inaccuracies in key phases.`;
  } else {
    return `Black played with superior accuracy (${blackAcc}% vs ${whiteAcc}%), capitalizing on critical tactical openings.`;
  }
}
