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

// Calculate move accuracy (0 to 100) based on centipawn loss
export function calculateMoveAccuracy(cpl: number): number {
  if (cpl <= 0) return 100;
  const acc = 103.1668 * Math.exp(-0.04354 * (cpl / 10)) - 3.1669;
  return Math.max(0, Math.min(100, Math.round(acc)));
}

export interface ClassificationParams {
  evalBefore: number; // Mover's perspective
  evalAfter: number;  // Mover's perspective
  isBestMove: boolean;
  isOnlyLegalMove?: boolean;
  isPieceSacrifice?: boolean;
  customThresholds?: UserSettings['customClassifications'];
}

export function classifyMove({
  evalBefore,
  evalAfter,
  isBestMove,
  isOnlyLegalMove = false,
  isPieceSacrifice = false,
  customThresholds,
}: ClassificationParams): { classification: MoveClassification; cpl: number } {
  if (isOnlyLegalMove) {
    return { classification: 'forced', cpl: 0 };
  }

  // Centipawn loss is how much the mover's advantage dropped
  const rawLoss = evalBefore - evalAfter;
  const cpl = Math.max(0, Math.round(rawLoss));

  // Brilliant move: Chess.com definition: piece sacrifice that is best move and maintains winning advantage
  if ((isBestMove || cpl <= 5) && isPieceSacrifice && evalAfter >= 100) {
    return { classification: 'brilliant', cpl: 0 };
  }

  if (isBestMove || cpl <= 5) {
    return { classification: 'best', cpl: 0 };
  }

  const blunderThresh = customThresholds?.blunderThreshold ?? 200;
  const mistakeThresh = customThresholds?.mistakeThreshold ?? 90;
  const inaccuracyThresh = customThresholds?.inaccuracyThreshold ?? 40;

  // Missed Win: player was winning (+300 or mate) but dropped to near equal (< +120) or losing
  if (evalBefore >= 300 && evalAfter < 120 && cpl >= 150) {
    return { classification: 'missedWin', cpl };
  }

  // If already overwhelmingly winning and still completely winning, don't penalize as blunder
  if (evalBefore >= 600 && evalAfter >= 450) {
    return { classification: 'good', cpl };
  }

  if (cpl >= blunderThresh) {
    return { classification: 'blunder', cpl };
  }

  if (cpl >= mistakeThresh) {
    return { classification: 'mistake', cpl };
  }

  if (cpl >= inaccuracyThresh) {
    return { classification: 'inaccuracy', cpl };
  }

  if (cpl <= 15) {
    return { classification: 'excellent', cpl };
  }

  return { classification: 'good', cpl };
}

// Estimate performance Elo based on game accuracy and average centipawn loss
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
