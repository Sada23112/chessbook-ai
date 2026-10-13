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
  // If comfortably winning and maintained advantage, award soft decay without harsh drop
  if (evalBefore !== undefined && evalAfter !== undefined && evalBefore >= 200 && evalAfter >= 130) {
    const winningAcc = 100 * Math.exp(-0.0035 * cpl);
    return Math.max(40, Math.min(100, Math.round(winningAcc)));
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

// Estimate performance rating based on game accuracy, average centipawn loss, and player baseline (Chess.com aligned)
export function estimatePerformanceElo(
  accuracy: number,
  avgCpl: number,
  playerElo?: number
): number {
  const acc = Math.max(0, Math.min(100, accuracy));

  if (playerElo && playerElo >= 400 && playerElo <= 2800) {
    // Chess.com Game Rating model anchored to player's official rating
    // E.g. for a 730 player: 69.5% accuracy -> ~950, 83.3% accuracy -> ~1400
    let delta = 0;
    if (acc >= 95) {
      delta = 1050 + (acc - 95) * 70;
    } else if (acc >= 85) {
      delta = 725 + (acc - 85) * 32.5;
    } else if (acc >= 80) {
      delta = 600 + (acc - 80) * 25;
    } else if (acc >= 65) {
      delta = 180 + (acc - 65) * 20;
    } else if (acc >= 50) {
      delta = -100 + (acc - 50) * 18;
    } else {
      delta = -350 + acc * 5;
    }
    const cplPenalty = Math.min(100, avgCpl * 0.6);
    const estimated = Math.round(playerElo + delta - cplPenalty);
    return Math.max(400, Math.min(3000, estimated));
  }

  // Absolute estimation calibrated to Chess.com Game Ratings
  let baseElo = 400;
  if (acc >= 95) {
    baseElo = 1950 + (acc - 95) * 150;
  } else if (acc >= 85) {
    baseElo = 1480 + (acc - 85) * 47;
  } else if (acc >= 75) {
    baseElo = 1150 + (acc - 75) * 33;
  } else if (acc >= 65) {
    baseElo = 880 + (acc - 65) * 27;
  } else if (acc >= 50) {
    baseElo = 620 + (acc - 50) * 17;
  } else {
    baseElo = 400 + acc * 4.4;
  }

  const cplDeduction = Math.min(180, avgCpl * 1.1);
  const estimated = Math.round(baseElo - cplDeduction);
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
