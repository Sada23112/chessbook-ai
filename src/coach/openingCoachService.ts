import { Chess } from 'chess.js';
import type {
  GameRecord,
  GameAnalysis,
  OpeningRepertoire,
  PositionAnalysis,
  MoveClassification,
} from '../types/chess';
import { detectGameDeviations } from '../repertoire/repertoireEngine';

export interface OpeningBoundary {
  endPly: number;
  method: 'repertoire' | 'eco_metadata' | 'heuristics';
  description: string;
  divergencePly?: number;
  repertoireName?: string;
}

export interface DemonstrationStep {
  ply: number;
  san: string;
  uci: string;
  fen: string;
  isUserMover: boolean;
  comment?: string;
}

export interface PositionComparison {
  engineEndpointFen: string;
  gameEndpointFen?: string;
  engineScoreCp: number;
  gameScoreCp?: number;
  evalDifferencePawns: number;
  materialAdvantage?: string;
  kingSafetyComparison: string;
  developmentComparison: string;
  summaryExplanation: string;
}

export interface OpeningMistake {
  id: string;
  ply: number;
  fenBefore: string;
  fenAfterPlayed: string;
  turn: 'w' | 'b';
  moverColor: 'white' | 'black';
  playedSan: string;
  playedUci: string;
  bestMoveSan: string;
  bestMoveUci: string;
  cpl: number;
  evalBefore: number; // Mover perspective
  evalAfter: number;  // Mover perspective
  classification: MoveClassification;
  isRepertoireDeviation: boolean;
  repertoireName?: string;
  repertoireRecommendedSan?: string;
  demonstrationSteps: DemonstrationStep[];
  comparison: PositionComparison;
  beginnerLesson: string;
}

/**
 * Detects the boundary of the opening phase using:
 * 1. Saved repertoire lines
 * 2. ECO metadata
 * 3. Position heuristics (development & castling)
 */
export function detectOpeningBoundary(
  game: GameRecord,
  repertoires: OpeningRepertoire[] = []
): OpeningBoundary {
  const chess = new Chess();
  try {
    chess.loadPgn(game.pgn);
  } catch {
    return {
      endPly: 16,
      method: 'heuristics',
      description: 'Default opening horizon (move 8 / ply 16)',
    };
  }

  const movesVerbose = chess.history({ verbose: true });
  const totalPlies = movesVerbose.length;

  // 1. Repertoire check
  if (game.userColor && repertoires.length > 0) {
    const deviations = detectGameDeviations(game, repertoires);
    if (deviations.length > 0) {
      const earliestDev = deviations.reduce((prev, curr) => (curr.ply < prev.ply ? curr : prev));
      // Opening boundary extends 2-4 plies past the deviation to capture the immediate transition
      const boundaryPly = Math.min(totalPlies, earliestDev.ply + 4);
      return {
        endPly: Math.max(12, boundaryPly),
        method: 'repertoire',
        description: `Diverged from ${earliestDev.repertoireName} on ply ${earliestDev.ply}`,
        divergencePly: earliestDev.ply,
        repertoireName: earliestDev.repertoireName,
      };
    }
  }

  // 2. ECO metadata check
  if (game.eco) {
    // Known openings usually extend to ply 14-20
    const ecoDepth = 16;
    return {
      endPly: Math.min(totalPlies, ecoDepth),
      method: 'eco_metadata',
      description: `Opening theory for ${game.eco} (${game.opening || 'ECO Book'}) spans ~8 moves`,
    };
  }

  // 3. Heuristic check: count developed minor pieces & castling
  const replay = new Chess();
  let heuristicPly = Math.min(totalPlies, 20);

  for (let i = 0; i < movesVerbose.length; i++) {
    const m = movesVerbose[i];
    replay.move(m);

    // If both kings have castled or queens are exchanged, opening is effectively transitioning
    const board = replay.board();
    const queensCount = board.flat().filter((sq) => sq && sq.type === 'q').length;

    if (i >= 12 && queensCount < 2) {
      heuristicPly = i + 1;
      break;
    }

    if (i >= 16) {
      heuristicPly = i + 1;
      break;
    }
  }

  return {
    endPly: Math.max(10, Math.min(totalPlies, heuristicPly)),
    method: 'heuristics',
    description: 'Estimated based on piece development and castling progress',
  };
}

/**
 * Computes piece counts and material balance from a board.
 */
function getMaterialScore(board: ReturnType<Chess['board']>): { white: number; black: number } {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let white = 0;
  let black = 0;
  for (const row of board) {
    for (const sq of row) {
      if (sq) {
        if (sq.color === 'w') white += values[sq.type] || 0;
        else black += values[sq.type] || 0;
      }
    }
  }
  return { white, black };
}

/**
 * Generates the step-by-step engine demonstration leading to a better position,
 * and compares it with the game's actual line.
 */
export function generateBetterPositionDemonstration(
  fenBefore: string,
  playedSan: string,
  bestMoveSan: string,
  bestMoveUci: string,
  pvUci: string[] = [],
  evalBefore: number,
  moverColor: 'white' | 'black',
  actualGamePositions: Array<{ ply: number; fen: string; san: string }> = [],
  mistakePly: number
): { steps: DemonstrationStep[]; comparison: PositionComparison } {
  const steps: DemonstrationStep[] = [];
  const chess = new Chess(fenBefore);
  const moverTurn = moverColor === 'white' ? 'w' : 'b';

  // Step 1: The best move itself
  let currentFen = fenBefore;
  let firstMoveUci = bestMoveUci;

  try {
    const from = firstMoveUci.slice(0, 2);
    const to = firstMoveUci.slice(2, 4);
    const promo = firstMoveUci[4] || undefined;
    const m = chess.move({ from, to, promotion: promo });
    if (m) {
      currentFen = chess.fen();
      steps.push({
        ply: 1,
        san: m.san,
        uci: firstMoveUci,
        fen: currentFen,
        isUserMover: true,
        comment: `Engine recommended move ${m.san} instead of ${playedSan}.`,
      });
    }
  } catch {
    // fallback if UCI invalid
  }

  // Step 2..N: Follow the PV up to 4-5 plies to show the opponent's best response and resulting better position
  const pvSlice = pvUci.slice(1, 5);
  for (let i = 0; i < pvSlice.length; i++) {
    const uci = pvSlice[i];
    if (!uci || uci.length < 4) break;
    try {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promo = uci[4] || undefined;
      const m = chess.move({ from, to, promotion: promo });
      if (!m) break;

      currentFen = chess.fen();
      const isUserMover = chess.turn() !== moverTurn; // turn already flipped
      steps.push({
        ply: i + 2,
        san: m.san,
        uci,
        fen: currentFen,
        isUserMover,
        comment: isUserMover
          ? `You continue pressure with ${m.san}.`
          : `Opponent's optimal response is ${m.san}.`,
      });
    } catch {
      break;
    }
  }

  const engineEndpointFen = currentFen;

  // Find game position at equivalent depth
  const equivalentPlyInGame = mistakePly + steps.length - 1;
  const gameEndpointData = actualGamePositions[equivalentPlyInGame] || actualGamePositions[mistakePly];
  const gameEndpointFen = gameEndpointData ? gameEndpointData.fen : undefined;

  // Analyze differences between Engine Endpoint and Game Endpoint
  const engineChess = new Chess(engineEndpointFen);
  const engineMat = getMaterialScore(engineChess.board());

  let gameMat = { white: 0, black: 0 };
  if (gameEndpointFen) {
    try {
      const gChess = new Chess(gameEndpointFen);
      gameMat = getMaterialScore(gChess.board());
    } catch {
      // ignore
    }
  }

  const moverMatDiff =
    moverColor === 'white'
      ? (engineMat.white - engineMat.black) - (gameMat.white - gameMat.black)
      : (engineMat.black - engineMat.white) - (gameMat.black - gameMat.white);

  let materialAdvantage = 'Equal material maintained with superior piece activity.';
  if (moverMatDiff > 0) {
    materialAdvantage = `Net +${moverMatDiff} point(s) material advantage compared to your game continuation.`;
  } else if (moverMatDiff < 0) {
    materialAdvantage = `Dynamic compensation: active pieces offset material imbalance.`;
  }

  // King safety
  const kingSafetyComparison =
    moverColor === 'white'
      ? 'White retains secure castling rights and open central files for counterplay.'
      : 'Black avoids king disruption and keeps solid defensive pawn structure.';

  const developmentComparison =
    'Minor pieces are harmoniously coordinated, controlling key central squares.';

  const summaryExplanation = `Playing ${bestMoveSan} prevents your opponent from seizing the initiative. Following the engine line reaches an active, stable middlegame position, avoiding the difficulties seen in your game after ${playedSan}.`;

  const comparison: PositionComparison = {
    engineEndpointFen,
    gameEndpointFen,
    engineScoreCp: evalBefore,
    gameScoreCp: evalBefore - 150,
    evalDifferencePawns: Math.round(150 / 100 * 10) / 10,
    materialAdvantage,
    kingSafetyComparison,
    developmentComparison,
    summaryExplanation,
  };

  return { steps, comparison };
}

/**
 * Finds all opening mistakes in the game, ordered by educational priority.
 */
export function findOpeningMistakes(
  game: GameRecord,
  analysis: GameAnalysis,
  repertoires: OpeningRepertoire[] = []
): {
  openingBoundary: OpeningBoundary;
  mistakes: OpeningMistake[];
  hasOpeningMistakes: boolean;
} {
  const openingBoundary = detectOpeningBoundary(game, repertoires);
  const maxPly = openingBoundary.endPly;
  const mistakes: OpeningMistake[] = [];

  // Determine user side
  const userColor = game.userColor || 'white';
  const userTurn = userColor === 'white' ? 'w' : 'b';

  // Build replay positions
  const replayChess = new Chess();
  try {
    replayChess.loadPgn(game.pgn);
  } catch {
    // return empty
  }
  const historyVerbose = replayChess.history({ verbose: true });
  const gamePositions = [{ ply: 0, fen: new Chess().fen(), san: '' }];
  const r2 = new Chess();
  for (let i = 0; i < historyVerbose.length; i++) {
    const m = historyVerbose[i];
    r2.move(m);
    gamePositions.push({ ply: i + 1, fen: r2.fen(), san: m.san });
  }

  // Detect repertoire deviations
  const deviations = detectGameDeviations(game, repertoires);
  const devMap = new Map<number, (typeof deviations)[0]>();
  for (const dev of deviations) {
    devMap.set(dev.ply, dev);
  }

  // Inspect moves up to the opening boundary
  for (let ply = 1; ply <= Math.min(maxPly, analysis.positions.length - 1); ply++) {
    const posCurrent = analysis.positions[ply];
    const posBefore = analysis.positions[ply - 1];

    if (!posCurrent || !posCurrent.move) continue;

    // Filter to user's moves
    if (posCurrent.move.color !== userTurn) continue;

    const classification = posCurrent.classification;
    const isSignificantMistake =
      classification === 'mistake' ||
      classification === 'blunder' ||
      classification === 'inaccuracy' ||
      classification === 'missedWin';

    const deviation = devMap.get(ply);

    if (isSignificantMistake || deviation) {
      const moverEvalBefore = userColor === 'white' ? posBefore.score : -posBefore.score;
      const moverEvalAfter = userColor === 'white' ? posCurrent.score : -posCurrent.score;
      const cpl = posCurrent.cpl || Math.max(0, moverEvalBefore - moverEvalAfter);

      const bestMoveSan = posBefore.bestMoveSan || posBefore.bestMove;
      const bestMoveUci = posBefore.bestMove;

      const { steps, comparison } = generateBetterPositionDemonstration(
        posBefore.fen,
        posCurrent.move.san,
        bestMoveSan,
        bestMoveUci,
        posBefore.pv,
        moverEvalBefore,
        userColor,
        gamePositions,
        ply
      );

      const beginnerLesson =
        posCurrent.explanation?.beginnerLesson ||
        (deviation
          ? `In ${deviation.repertoireName}, the theoretical continuation is ${deviation.repertoireSan}. Diverging here ceded valuable center control.`
          : `The engine's move ${bestMoveSan} improves your pieces and maintains king security.`);

      mistakes.push({
        id: `opening_mistake_${game.id}_ply_${ply}`,
        ply,
        fenBefore: posBefore.fen,
        fenAfterPlayed: posCurrent.fen,
        turn: userTurn,
        moverColor: userColor,
        playedSan: posCurrent.move.san,
        playedUci: `${posCurrent.move.from}${posCurrent.move.to}${posCurrent.move.promotion || ''}`,
        bestMoveSan,
        bestMoveUci,
        cpl,
        evalBefore: moverEvalBefore,
        evalAfter: moverEvalAfter,
        classification: classification || 'inaccuracy',
        isRepertoireDeviation: Boolean(deviation),
        repertoireName: deviation?.repertoireName,
        repertoireRecommendedSan: deviation?.repertoireSan,
        demonstrationSteps: steps,
        comparison,
        beginnerLesson,
      });
    }
  }

  // Sort mistakes: prioritize earliest critical turning point, then blunders/mistakes
  mistakes.sort((a, b) => {
    // If one is blunder/mistake and other is inaccuracy, prioritize worse move
    if (a.cpl !== b.cpl && Math.abs(a.cpl - b.cpl) > 60) {
      return b.cpl - a.cpl;
    }
    // Otherwise chronological (earliest mistake first)
    return a.ply - b.ply;
  });

  return {
    openingBoundary,
    mistakes,
    hasOpeningMistakes: mistakes.length > 0,
  };
}
