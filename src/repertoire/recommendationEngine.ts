import { Chess } from 'chess.js';
import type {
  GameRecord,
  GameAnalysis,
  OpeningRepertoire,
  PieceColor,
  CourseLineRecord,
  OpeningRecommendation,
  OpeningPerformanceReport,
  OpeningPerformanceStats,
  RecommendationEvidence,
  RecommendationRecord,
  RecommendationType,
  RecommendationPriority,
  RecommendationStatus,
} from '../types/chess';
import {
  MASTER_CATALOGUE_OPENINGS,
  findAntiOpeningGuide,
  getCatalogueItemById,
} from './data/catalogueIndex';
import type { CatalogueOpeningItem } from './data/types';
import { MASTER_OPENING_REPERTOIRES } from './defaultOpenings';
import { detectOpeningBoundary } from '../coach/openingCoachService';

/**
 * Normalizes a FEN string to ignore halfmove and fullmove counters
 * to allow reliable transposition matching.
 */
export function normalizeFen(fen: string): string {
  try {
    const parts = fen.trim().split(' ');
    // Keep pieces, active color, castling rights, and en-passant square
    return parts.slice(0, 4).join(' ');
  } catch {
    return fen;
  }
}

/**
 * Pre-computes FEN and prefix positions for each catalogue opening
 * for fast prefix and transposition lookups.
 */
interface IndexedCatalogueItem {
  item: CatalogueOpeningItem;
  fens: string[]; // Normalized FEN after each move
  sanSequence: string[];
}

let cachedIndexedCatalogue: IndexedCatalogueItem[] | null = null;

function getIndexedCatalogue(): IndexedCatalogueItem[] {
  if (cachedIndexedCatalogue) return cachedIndexedCatalogue;

  cachedIndexedCatalogue = MASTER_CATALOGUE_OPENINGS.map((item) => {
    const chess = new Chess();
    const fens: string[] = [normalizeFen(chess.fen())];
    const sanSequence: string[] = [];

    for (const san of item.moves) {
      try {
        const m = chess.move(san);
        if (m) {
          sanSequence.push(m.san);
          fens.push(normalizeFen(chess.fen()));
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    return {
      item,
      fens,
      sanSequence,
    };
  });

  return cachedIndexedCatalogue;
}

/**
 * Identifies the best-matching catalogue opening for a game move sequence.
 * Prefers deepest prefix match; falls back to deepest transposition match.
 */
export function matchGameToCatalogueOpening(
  gameMovesSan: string[]
): { item: CatalogueOpeningItem; matchedPlies: number } | null {
  const indexed = getIndexedCatalogue();
  let bestMatch: { item: CatalogueOpeningItem; matchedPlies: number } | null = null;

  for (const entry of indexed) {
    const seq = entry.sanSequence;
    if (seq.length === 0) continue;

    // Check prefix match
    let prefixMatches = 0;
    for (let i = 0; i < seq.length && i < gameMovesSan.length; i++) {
      if (seq[i] === gameMovesSan[i]) {
        prefixMatches++;
      } else {
        break;
      }
    }

    if (prefixMatches > 0) {
      if (!bestMatch || prefixMatches > bestMatch.matchedPlies) {
        bestMatch = { item: entry.item, matchedPlies: prefixMatches };
      }
    }
  }

  return bestMatch;
}

/**
 * Finds the corresponding master repertoire ID for a given catalogue variation.
 */
export function findMasterRepertoireForVariation(
  variationId: string,
  side: PieceColor,
  sideAgainst?: 'e4' | 'd4' | 'other'
): string {
  // Check if it exists in one of the specific repertoires
  for (const rep of MASTER_OPENING_REPERTOIRES) {
    if (rep.variations.some((v) => v.id === variationId)) {
      return rep.id;
    }
  }

  // Fallback based on side and target
  if (side === 'white') {
    return sideAgainst === 'd4' ? 'rep_white_d4' : 'rep_white_e4';
  } else {
    return sideAgainst === 'd4' ? 'rep_black_d4' : 'rep_black_e4';
  }
}

/**
 * Determines whether a game outcome is a win, loss, or draw for the user.
 */
export function getUserGameOutcome(
  game: GameRecord,
  userColor: PieceColor
): 'win' | 'loss' | 'draw' {
  if (game.result === '1/2-1/2') return 'draw';
  if (game.result === '1-0') return userColor === 'white' ? 'win' : 'loss';
  if (game.result === '0-1') return userColor === 'black' ? 'win' : 'loss';
  return 'draw';
}

/**
 * Analyzes all user games and generates a structured opening performance report.
 */
export function analyzeOpeningPerformance(
  games: GameRecord[],
  analyses: GameAnalysis[],
  userPlayerName?: string
): OpeningPerformanceReport {
  const analysisMap = new Map<string, GameAnalysis>(analyses.map((a) => [a.gameId, a]));

  const initStats = (): OpeningPerformanceStats => ({
    gamesCount: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    avgCpl: 0,
  });

  const report: OpeningPerformanceReport = {
    totalGames: games.length,
    gamesAsWhite: 0,
    gamesAsBlack: 0,
    analyzedGamesCount: 0,
    whiteStats: initStats(),
    blackStats: initStats(),
    blackAgainstFirstMove: {
      againstE4: initStats(),
      againstD4: initStats(),
      againstOther: initStats(),
    },
    whiteFirstMove: {
      withE4: initStats(),
      withD4: initStats(),
      withOther: initStats(),
    },
    topWeaknesses: [],
  };

  const weaknessMap = new Map<string, { count: number; totalCpl: number; side: PieceColor }>();

  for (const game of games) {
    // Determine user color
    let userColor: PieceColor = game.userColor || 'white';
    if (!game.userColor && userPlayerName) {
      if (game.black.toLowerCase() === userPlayerName.toLowerCase()) {
        userColor = 'black';
      } else if (game.white.toLowerCase() === userPlayerName.toLowerCase()) {
        userColor = 'white';
      }
    }

    const outcome = getUserGameOutcome(game, userColor);
    const analysis = analysisMap.get(game.id);
    if (analysis) report.analyzedGamesCount++;

    // Parse moves
    const chess = new Chess();
    try {
      chess.loadPgn(game.pgn);
    } catch {
      continue;
    }
    const moves = chess.history();
    if (moves.length === 0) continue;

    const firstMove = moves[0];
    const updateStats = (stats: OpeningPerformanceStats, cpl?: number) => {
      stats.gamesCount++;
      if (outcome === 'win') stats.wins++;
      else if (outcome === 'loss') stats.losses++;
      else stats.draws++;
      stats.winRate = Math.round((stats.wins / stats.gamesCount) * 100);
      if (cpl !== undefined && cpl > 0) {
        stats.avgCpl = Math.round(((stats.avgCpl || 0) * (stats.gamesCount - 1) + cpl) / stats.gamesCount);
      }
    };

    if (userColor === 'white') {
      report.gamesAsWhite++;
      updateStats(report.whiteStats);

      if (firstMove === 'e4') {
        updateStats(report.whiteFirstMove.withE4);
      } else if (firstMove === 'd4') {
        updateStats(report.whiteFirstMove.withD4);
      } else {
        updateStats(report.whiteFirstMove.withOther);
      }
    } else {
      report.gamesAsBlack++;
      updateStats(report.blackStats);

      if (firstMove === 'e4') {
        updateStats(report.blackAgainstFirstMove.againstE4);
      } else if (firstMove === 'd4') {
        updateStats(report.blackAgainstFirstMove.againstD4);
      } else {
        updateStats(report.blackAgainstFirstMove.againstOther);
      }
    }

    // Inspect opening mistakes if analysis is available
    if (analysis) {
      const boundary = detectOpeningBoundary(game);
      for (const pos of analysis.positions) {
        if (pos.ply > boundary.endPly) continue;
        if (!pos.move) continue;

        const isUserTurn =
          (pos.move.color === 'w' && userColor === 'white') ||
          (pos.move.color === 'b' && userColor === 'black');

        if (
          isUserTurn &&
          (pos.classification === 'blunder' ||
            pos.classification === 'mistake' ||
            pos.classification === 'inaccuracy')
        ) {
          const motif = pos.explanation?.motif || 'Opening Inaccuracy';
          const existing = weaknessMap.get(motif) || { count: 0, totalCpl: 0, side: userColor };
          existing.count++;
          existing.totalCpl += pos.cpl || 50;
          weaknessMap.set(motif, existing);
        }
      }
    }
  }

  // Compile top weaknesses
  report.topWeaknesses = Array.from(weaknessMap.entries())
    .map(([name, data]) => ({
      name,
      mistakeCount: data.count,
      avgCpl: Math.round(data.totalCpl / Math.max(1, data.count)),
      side: data.side,
    }))
    .sort((a, b) => b.mistakeCount - a.mistakeCount)
    .slice(0, 5);

  return report;
}

/**
 * Parameters for generating personalized opening recommendations.
 */
export interface GenerateRecommendationsParams {
  games: GameRecord[];
  analyses: GameAnalysis[];
  repertoires?: OpeningRepertoire[];
  lineRecords?: CourseLineRecord[];
  savedRecords?: RecommendationRecord[];
  userPlayerName?: string;
}

/**
 * Generates personalized opening recommendations backed by actual game evidence.
 */
export function generatePersonalizedRecommendations(
  params: GenerateRecommendationsParams
): OpeningRecommendation[] {
  const {
    games,
    analyses,
    repertoires = [],
    lineRecords = [],
    savedRecords = [],
    userPlayerName,
  } = params;

  const analysisMap = new Map<string, GameAnalysis>(analyses.map((a) => [a.gameId, a]));
  const savedRecordsMap = new Map<string, RecommendationRecord>(
    savedRecords.map((r) => [r.recommendationId, r])
  );
  const completedLineIds = new Set<string>(
    lineRecords
      .filter((r) => r.status === 'completed' || r.status === 'mastered')
      .map((r) => r.lineId)
  );

  const rawRecommendations: OpeningRecommendation[] = [];

  // =========================================================================
  // 1. GROUP GAMES BY MATCHED CATALOGUE OPENINGS & TRACK MISTAKES & DEV
  // =========================================================================
  interface OpeningCluster {
    catalogueItem: CatalogueOpeningItem;
    games: GameRecord[];
    userColor: PieceColor;
    wins: number;
    losses: number;
    draws: number;
    evidenceList: RecommendationEvidence[];
    recurringMoveMistakes: Map<
      string,
      { count: number; playedSan: string; bestMoveSan: string; fen: string; cplSum: number }
    >;
    gambitOrTrapEncountered?: boolean;
    unhandledDeviationsCount: number;
  }

  const clusters = new Map<string, OpeningCluster>();

  for (const game of games) {
    let userColor: PieceColor = game.userColor || 'white';
    if (!game.userColor && userPlayerName) {
      if (game.black.toLowerCase() === userPlayerName.toLowerCase()) userColor = 'black';
      else if (game.white.toLowerCase() === userPlayerName.toLowerCase()) userColor = 'white';
    }

    const outcome = getUserGameOutcome(game, userColor);

    const chess = new Chess();
    try {
      chess.loadPgn(game.pgn);
    } catch {
      continue;
    }
    const moves = chess.history();
    if (moves.length === 0) continue;

    // Match to catalogue
    const matched = matchGameToCatalogueOpening(moves);
    if (!matched) continue;

    const catItem = matched.item;
    const clusterKey = `${catItem.id}_${userColor}`;

    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, {
        catalogueItem: catItem,
        games: [],
        userColor,
        wins: 0,
        losses: 0,
        draws: 0,
        evidenceList: [],
        recurringMoveMistakes: new Map(),
        gambitOrTrapEncountered: Boolean(catItem.trapMetadata || catItem.antiOpeningGuide),
        unhandledDeviationsCount: 0,
      });
    }

    const cluster = clusters.get(clusterKey)!;
    cluster.games.push(game);
    if (outcome === 'win') cluster.wins++;
    else if (outcome === 'loss') cluster.losses++;
    else cluster.draws++;

    // Inspect analysis
    const analysis = analysisMap.get(game.id);
    if (analysis) {
      const boundary = detectOpeningBoundary(game);
      for (const pos of analysis.positions) {
        if (pos.ply > boundary.endPly) continue;
        if (!pos.move) continue;

        const isUserTurn =
          (pos.move.color === 'w' && userColor === 'white') ||
          (pos.move.color === 'b' && userColor === 'black');

        if (
          isUserTurn &&
          (pos.classification === 'blunder' ||
            pos.classification === 'mistake' ||
            (pos.cpl !== undefined && pos.cpl >= 80))
        ) {
          const moveKey = `${pos.ply}_${pos.move.san}`;
          const existing = cluster.recurringMoveMistakes.get(moveKey) || {
            count: 0,
            playedSan: pos.move.san,
            bestMoveSan: pos.bestMoveSan || pos.bestMove || 'better move',
            fen: pos.fen,
            cplSum: 0,
          };
          existing.count++;
          existing.cplSum += pos.cpl || 80;
          cluster.recurringMoveMistakes.set(moveKey, existing);

          if (cluster.evidenceList.length < 4) {
            cluster.evidenceList.push({
              gameId: game.id,
              gameTitle: `${game.white} vs ${game.black} (${game.date || 'Recent'})`,
              date: game.date || new Date().toISOString().split('T')[0],
              ply: pos.ply,
              moveNumber: Math.ceil(pos.ply / 2),
              playedSan: pos.move.san,
              bestMoveSan: pos.bestMoveSan || pos.bestMove || '',
              fen: pos.fen,
              cpl: pos.cpl,
              motif: pos.explanation?.motif,
              consequence: pos.explanation?.consequence,
            });
          }
        }
      }
    } else {
      // If unanalyzed, check if user left book early (unhandled deviation)
      if (moves.length >= 4 && moves.length > matched.matchedPlies) {
        cluster.unhandledDeviationsCount++;
      }
    }
  }

  // =========================================================================
  // 2. BUILD RECOMMENDATIONS FROM IDENTIFIED CLUSTERS
  // =========================================================================
  for (const cluster of clusters.values()) {
    const item = cluster.catalogueItem;
    const totalClusterGames = cluster.games.length;
    const losses = cluster.losses;
    const wins = cluster.wins;
    const winRate = Math.round((wins / totalClusterGames) * 100);

    // Compute recurring mistake details
    let maxMistakeCount = 0;
    let worstMistake: { playedSan: string; bestMoveSan: string; fen: string; count: number; avgCpl: number } | null = null;

    for (const m of cluster.recurringMoveMistakes.values()) {
      if (m.count > maxMistakeCount) {
        maxMistakeCount = m.count;
        worstMistake = {
          playedSan: m.playedSan,
          bestMoveSan: m.bestMoveSan,
          fen: m.fen,
          count: m.count,
          avgCpl: Math.round(m.cplSum / m.count),
        };
      }
    }

    const analyzedGamesCount = cluster.evidenceList.length > 0
      ? cluster.games.filter((g) => analysisMap.has(g.id)).length
      : 0;

    // A. Fix Recurring Mistake Recommendation
    if (worstMistake && worstMistake.count >= 1) {
      const isRepeated = worstMistake.count >= 2;
      const priorityScore =
        totalClusterGames * 15 +
        worstMistake.count * 25 +
        (worstMistake.avgCpl > 150 ? 30 : 15) +
        (losses > wins ? 20 : 0);

      const priority: RecommendationPriority =
        priorityScore >= 75 ? 'high' : priorityScore >= 45 ? 'medium' : 'low';

      const priorityReason = isRepeated
        ? `Repeated blunder: You made this mistake ${worstMistake.count} times in ${totalClusterGames} games (avg ${worstMistake.avgCpl} centipawns lost).`
        : `Critical blunder on move in ${totalClusterGames} games resulting in a loss.`;

      const repId = findMasterRepertoireForVariation(item.id, cluster.userColor);

      rawRecommendations.push({
        id: `rec_mistake_${item.id}_${cluster.userColor}`,
        type: 'fix_mistake',
        title: `Fix Move Error in ${item.name}`,
        openingName: item.name,
        variationName: item.description || 'Main Continuation',
        eco: item.eco,
        side: cluster.userColor,
        sideAgainst: item.moves[0] === 'e4' ? 'e4' : item.moves[0] === 'd4' ? 'd4' : 'other',
        reason: `You faced ${item.name} in ${totalClusterGames} game${totalClusterGames > 1 ? 's' : ''} as ${cluster.userColor} and repeatedly played ${worstMistake.playedSan} instead of the engine recommendation ${worstMistake.bestMoveSan}.`,
        recurringMistake: `Played ${worstMistake.playedSan} instead of ${worstMistake.bestMoveSan} in key position.`,
        gamesCount: totalClusterGames,
        analyzedGamesCount,
        wins,
        losses,
        draws: cluster.draws,
        winRate,
        avgCpl: worstMistake.avgCpl,
        difficulty: item.difficulty,
        estimatedMinutes: item.difficulty === 'Beginner' ? 12 : item.difficulty === 'Intermediate' ? 18 : 25,
        priority,
        priorityReason,
        status: completedLineIds.has(item.id) ? 'completed' : 'not_started',
        dismissed: false,
        catalogueId: item.id,
        repertoireId: repId,
        variationId: item.id,
        moves: item.moves,
        mistakeFen: worstMistake.fen,
        evidence: cluster.evidenceList,
        strategicPlan: item.strategicPlans?.[0],
        tacticalMotifs: item.tacticalMotifs,
      });
      continue;
    }

    // B. Anti-Gambit or Trap Response Recommendation
    if (
      (item.category === 'gambits_white' ||
        item.category === 'countergambits_black' ||
        item.category === 'traps_tactics' ||
        item.category === 'anti_openings' ||
        item.trapMetadata ||
        item.antiOpeningGuide) &&
      (losses > 0 || winRate < 50 || cluster.evidenceList.length > 0)
    ) {
      const antiGuide = findAntiOpeningGuide(item.name) || (item.antiOpeningGuide ? item : undefined);
      const repId = 'rep_anti_openings';

      const priorityScore = totalClusterGames * 20 + losses * 25 + 30;
      const priority: RecommendationPriority = priorityScore >= 70 ? 'high' : 'medium';

      rawRecommendations.push({
        id: `rec_trap_${item.id}_${cluster.userColor}`,
        type: 'anti_gambit_trap',
        title: `Train Response to ${item.name}`,
        openingName: item.name,
        variationName: item.antiOpeningGuide?.recommendedResponseName || 'Correct Refutation',
        eco: item.eco,
        side: cluster.userColor,
        sideAgainst: item.moves[0] === 'e4' ? 'e4' : item.moves[0] === 'd4' ? 'd4' : 'other',
        reason: `You encountered the aggressive ${item.name} in ${totalClusterGames} game${totalClusterGames > 1 ? 's' : ''} and suffered tactical pressure or dropped material.`,
        recurringMistake: `Missed critical defensive resource against opponent's early initiative.`,
        gamesCount: totalClusterGames,
        analyzedGamesCount,
        wins,
        losses,
        draws: cluster.draws,
        winRate,
        difficulty: item.difficulty,
        estimatedMinutes: 15,
        priority,
        priorityReason: `Dangerous tactical trap: Faced in ${totalClusterGames} games with ${losses} losses.`,
        status: completedLineIds.has(item.id) ? 'completed' : 'not_started',
        dismissed: false,
        catalogueId: item.id,
        repertoireId: repId,
        variationId: item.id,
        moves: item.moves,
        evidence: cluster.evidenceList,
        strategicPlan: item.antiOpeningGuide?.positionalPlan || item.strategicPlans?.[0],
        tacticalMotifs: item.tacticalMotifs,
        antiOpeningGuideId: antiGuide?.id,
      });
      continue;
    }

    // C. Repertoire Expansion / Coverage Gap
    if (totalClusterGames >= 2 && (losses >= wins || cluster.unhandledDeviationsCount >= 1)) {
      const repId = findMasterRepertoireForVariation(item.id, cluster.userColor);
      const priority: RecommendationPriority = totalClusterGames >= 3 ? 'high' : 'medium';

      rawRecommendations.push({
        id: `rec_expand_${item.id}_${cluster.userColor}`,
        type: 'repertoire_expansion',
        title: `Expand Coverage: ${item.name}`,
        openingName: item.name,
        variationName: item.name,
        eco: item.eco,
        side: cluster.userColor,
        sideAgainst: item.moves[0] === 'e4' ? 'e4' : item.moves[0] === 'd4' ? 'd4' : 'other',
        reason: `You frequently face this variation (${totalClusterGames} games) but left the main theoretical path early, leading to passive positions.`,
        recurringMistake: `Lacks structured theoretical line in your personal repertoire.`,
        gamesCount: totalClusterGames,
        analyzedGamesCount,
        wins,
        losses,
        draws: cluster.draws,
        winRate,
        difficulty: item.difficulty,
        estimatedMinutes: 20,
        priority,
        priorityReason: `Frequent encounter without full coverage in your personal repertoire (${totalClusterGames} games).`,
        status: completedLineIds.has(item.id) ? 'completed' : 'not_started',
        dismissed: false,
        catalogueId: item.id,
        repertoireId: repId,
        variationId: item.id,
        moves: item.moves,
        evidence: cluster.evidenceList,
        strategicPlan: item.strategicPlans?.[0],
        tacticalMotifs: item.tacticalMotifs,
      });
    }
  }

  // =========================================================================
  // 3. COLD START / STARTER RECOMMENDATIONS (If < 3 games available)
  // =========================================================================
  if (rawRecommendations.length < 3) {
    const starterItems = [
      {
        id: 'starter_italian',
        catId: 'cat_italian_pianissimo',
        title: 'Master the Italian Game: Giuoco Piano',
        side: 'white' as PieceColor,
        reason: 'Essential starter course: Develop central control, rapid kingside castling, and active piece placement.',
        difficulty: 'Beginner' as const,
        mins: 15,
      },
      {
        id: 'starter_scandi',
        catId: 'cat_scandinavian_main',
        title: 'Shield with the Scandinavian Defense',
        side: 'black' as PieceColor,
        reason: 'Solid defense against 1.e4: Immediately challenge the white center and activate all minor pieces freely.',
        difficulty: 'Beginner' as const,
        mins: 15,
      },
      {
        id: 'starter_qgd',
        catId: 'cat_qgd_tartakower',
        title: 'Resilient Defense: Queen’s Gambit Declined',
        side: 'black' as PieceColor,
        reason: 'Fundamental counter to 1.d4: Maintain a rock-solid pawn wedge in the center with harmonious development.',
        difficulty: 'Intermediate' as const,
        mins: 20,
      },
      {
        id: 'starter_sicilian_alapin',
        catId: 'cat_sicilian_alapin_white',
        title: 'Tame the Sicilian with 2.c3 Alapin',
        side: 'white' as PieceColor,
        reason: 'Direct, principled anti-Sicilian system that avoids sharp open Sicilian tactical complications.',
        difficulty: 'Intermediate' as const,
        mins: 18,
      },
    ];

    for (const s of starterItems) {
      const catItem = getCatalogueItemById(s.catId);
      if (!catItem) continue;

      // Don't add duplicate if already present
      if (rawRecommendations.some((r) => r.catalogueId === catItem.id)) continue;

      const repId = findMasterRepertoireForVariation(catItem.id, s.side);

      rawRecommendations.push({
        id: s.id,
        type: 'starter',
        title: s.title,
        openingName: catItem.name,
        variationName: catItem.name,
        eco: catItem.eco,
        side: s.side,
        sideAgainst: catItem.moves[0] === 'e4' ? 'e4' : catItem.moves[0] === 'd4' ? 'd4' : 'other',
        reason: s.reason,
        recurringMistake: 'Foundational repertoire course recommended while your game history builds up.',
        gamesCount: 0,
        analyzedGamesCount: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        difficulty: s.difficulty,
        estimatedMinutes: s.mins,
        priority: 'medium',
        priorityReason: 'Core foundational repertoire recommended for balanced progression.',
        status: completedLineIds.has(catItem.id) ? 'completed' : 'not_started',
        dismissed: false,
        catalogueId: catItem.id,
        repertoireId: repId,
        variationId: catItem.id,
        moves: catItem.moves,
        evidence: [],
        strategicPlan: catItem.strategicPlans?.[0],
        tacticalMotifs: catItem.tacticalMotifs,
      });
    }
  }

  // =========================================================================
  // 4. MERGE PERSISTED RECOMMENDATION STATE (STATUS & DISMISSAL)
  // =========================================================================
  const finalRecommendations = rawRecommendations.map((rec) => {
    const saved = savedRecordsMap.get(rec.id);
    if (saved) {
      return {
        ...rec,
        status: saved.status,
        dismissed: saved.dismissed,
      };
    }
    return rec;
  });

  // =========================================================================
  // 5. SORT BY PRIORITY AND GAME IMPACT
  // =========================================================================
  const priorityRank: Record<RecommendationPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return finalRecommendations.sort((a, b) => {
    // 1. Incompleted before completed
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;

    // 2. Priority rank
    const diff = priorityRank[b.priority] - priorityRank[a.priority];
    if (diff !== 0) return diff;

    // 3. Number of games analyzed
    return b.gamesCount - a.gamesCount;
  });
}
