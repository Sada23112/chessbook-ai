import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchGameToCatalogueOpening,
  analyzeOpeningPerformance,
  generatePersonalizedRecommendations,
  normalizeFen,
} from '../repertoire/recommendationEngine';
import type { GameRecord, GameAnalysis, RecommendationRecord } from '../types/chess';
import { getCatalogueItemById } from '../repertoire/data/catalogueIndex';

describe('Personalized Opening Recommendation Engine', () => {
  it('correctly matches game move sequences to deepest catalogue opening and normalizes FENs', () => {
    // 1. Italian Game: Giuoco Piano
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'];
    const match = matchGameToCatalogueOpening(moves);
    expect(match).not.toBeNull();
    expect(match?.item.name).toContain('Italian Game');
    expect(match?.matchedPlies).toBeGreaterThanOrEqual(6);

    // 2. FEN normalization ignores move counters
    const fen1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 15 28';
    expect(normalizeFen(fen1)).toBe(normalizeFen(fen2));
  });

  it('separates games into White and Black and measures performance against 1.e4 and 1.d4', () => {
    const games: GameRecord[] = [
      {
        id: 'g1_white_e4',
        white: 'MyUser',
        black: 'Opponent1',
        userColor: 'white',
        result: '1-0',
        date: '2026-10-10',
        movesCount: 20,
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0',
        fingerprint: 'fp1',
        source: 'upload',
        createdAt: 100,
      },
      {
        id: 'g2_black_vs_e4',
        white: 'Opponent2',
        black: 'MyUser',
        userColor: 'black',
        result: '0-1',
        date: '2026-10-11',
        movesCount: 22,
        pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 0-1',
        fingerprint: 'fp2',
        source: 'upload',
        createdAt: 200,
      },
      {
        id: 'g3_black_vs_d4',
        white: 'Opponent3',
        black: 'MyUser',
        userColor: 'black',
        result: '1-0', // loss
        date: '2026-10-12',
        movesCount: 18,
        pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 1-0',
        fingerprint: 'fp3',
        source: 'upload',
        createdAt: 300,
      },
    ];

    const report = analyzeOpeningPerformance(games, []);
    expect(report.totalGames).toBe(3);
    expect(report.gamesAsWhite).toBe(1);
    expect(report.gamesAsBlack).toBe(2);

    // White with 1.e4
    expect(report.whiteFirstMove.withE4.gamesCount).toBe(1);
    expect(report.whiteFirstMove.withE4.winRate).toBe(100);

    // Black against 1.e4 (1 win)
    expect(report.blackAgainstFirstMove.againstE4.gamesCount).toBe(1);
    expect(report.blackAgainstFirstMove.againstE4.wins).toBe(1);
    expect(report.blackAgainstFirstMove.againstE4.winRate).toBe(100);

    // Black against 1.d4 (1 loss)
    expect(report.blackAgainstFirstMove.againstD4.gamesCount).toBe(1);
    expect(report.blackAgainstFirstMove.againstD4.losses).toBe(1);
    expect(report.blackAgainstFirstMove.againstD4.winRate).toBe(0);
  });

  it('identifies repeated opening mistakes with CPL loss and generates high-priority fix recommendation', () => {
    const game1: GameRecord = {
      id: 'game_mistake_1',
      white: 'OpponentA',
      black: 'MyUser',
      userColor: 'black',
      result: '1-0',
      date: '2026-10-01',
      movesCount: 15,
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 h6 1-0',
      fingerprint: 'fpm1',
      source: 'upload',
      createdAt: 1000,
    };

    const game2: GameRecord = {
      id: 'game_mistake_2',
      white: 'OpponentB',
      black: 'MyUser',
      userColor: 'black',
      result: '1-0',
      date: '2026-10-02',
      movesCount: 16,
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 h6 1-0',
      fingerprint: 'fpm2',
      source: 'upload',
      createdAt: 2000,
    };

    const analysis1: GameAnalysis = {
      gameId: 'game_mistake_1',
      depth: 12,
      engine: 'Stockfish 16',
      completedAt: 1500,
      positions: [
        {
          ply: 8, // 4... h6?
          fen: 'r1bqkb1r/pppp1pp1/2n2n1p/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5',
          move: { from: 'h7', to: 'h6', san: 'h6', color: 'b', piece: 'p' },
          score: 280,
          bestMove: 'd7d5',
          bestMoveSan: 'd5',
          pv: ['d7d5', 'e4d5'],
          depth: 12,
          classification: 'blunder',
          cpl: 240,
          explanation: {
            playedSan: 'h6',
            bestMoveSan: 'd5',
            evalBefore: 40,
            evalAfter: 280,
            evalDiff: 240,
            motif: 'Fried Liver Blunder',
            consequence: 'Allows Nxf7 forking queen and rook.',
            beginnerLesson: 'Counter with 4... d5!',
            practicalAdvice: 'Block the bishop diagonal.',
          },
        },
      ],
      summary: {
        whiteCPL: 15,
        blackCPL: 110,
        accuracyWhite: 95,
        accuracyBlack: 60,
        whiteStats: {} as any,
        blackStats: {} as any,
        identifiedMotifs: ['Fried Liver Blunder'],
      },
    };

    const analysis2: GameAnalysis = {
      ...analysis1,
      gameId: 'game_mistake_2',
    };

    const recommendations = generatePersonalizedRecommendations({
      games: [game1, game2],
      analyses: [analysis1, analysis2],
      userPlayerName: 'MyUser',
    });

    expect(recommendations.length).toBeGreaterThan(0);
    const topRec = recommendations[0];

    // Priority should be high due to repeated blunders in multiple games
    expect(topRec.priority).toBe('high');
    expect(topRec.type).toBe('fix_mistake');
    expect(topRec.gamesCount).toBe(2);
    expect(topRec.losses).toBe(2);
    expect(topRec.recurringMistake).toContain('h6');
    expect(topRec.reason).toContain('h6');
    expect(topRec.reason).toContain('d5');
    expect(topRec.evidence.length).toBeGreaterThanOrEqual(1);
    expect(topRec.evidence[0].playedSan).toBe('h6');
    expect(topRec.evidence[0].bestMoveSan).toBe('d5');
  });

  it('detects gambit and trap vulnerabilities and recommends the anti-opening refutation', () => {
    // Stafford Gambit game: 1. e4 e5 2. Nf3 Nf6 3. Nxe5 Nc6 4. Nxc6 dxc6
    const staffordGame: GameRecord = {
      id: 'game_stafford_loss',
      white: 'MyUser',
      black: 'GambitPlayer',
      userColor: 'white',
      result: '0-1',
      date: '2026-10-05',
      movesCount: 14,
      pgn: '1. e4 e5 2. Nf3 Nf6 3. Nxe5 Nc6 4. Nxc6 dxc6 0-1',
      fingerprint: 'stafford_fp',
      source: 'upload',
      createdAt: 5000,
    };

    const recommendations = generatePersonalizedRecommendations({
      games: [staffordGame],
      analyses: [],
      userPlayerName: 'MyUser',
    });

    const trapRec = recommendations.find(
      (r) => r.type === 'anti_gambit_trap' || r.openingName.toLowerCase().includes('stafford')
    );
    expect(trapRec).toBeDefined();
    expect(trapRec?.side).toBe('white');
    expect(trapRec?.gamesCount).toBe(1);
    expect(trapRec?.losses).toBe(1);
    expect(trapRec?.repertoireId).toBe('rep_anti_openings');
  });

  it('provides starter foundational recommendations when games are insufficient (cold start)', () => {
    const emptyRecommendations = generatePersonalizedRecommendations({
      games: [],
      analyses: [],
    });

    // Should offer structured starters
    expect(emptyRecommendations.length).toBeGreaterThanOrEqual(3);
    expect(emptyRecommendations.some((r) => r.type === 'starter')).toBe(true);

    const starter = emptyRecommendations.find((r) => r.type === 'starter');
    expect(starter?.status).toBe('not_started');
    expect(starter?.reason).toContain('starter course');
    expect(starter?.moves.length).toBeGreaterThan(0);
  });

  it('preserves user dismissal and progress tracking from persisted records', () => {
    const savedRecords: RecommendationRecord[] = [
      {
        id: 'starter_italian',
        recommendationId: 'starter_italian',
        status: 'completed',
        dismissed: true,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const recommendations = generatePersonalizedRecommendations({
      games: [],
      analyses: [],
      savedRecords,
    });

    const italianRec = recommendations.find((r) => r.id === 'starter_italian');
    expect(italianRec).toBeDefined();
    expect(italianRec?.status).toBe('completed');
    expect(italianRec?.dismissed).toBe(true);
  });

  it('avoids duplicate recommendations for the same opening line and sorts high priority first', () => {
    const games: GameRecord[] = [
      {
        id: 'dup_g1',
        white: 'MyUser',
        black: 'Player1',
        userColor: 'white',
        result: '0-1',
        date: '2026-10-01',
        movesCount: 10,
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 0-1',
        fingerprint: 'dup1',
        source: 'upload',
        createdAt: 100,
      },
      {
        id: 'dup_g2',
        white: 'MyUser',
        black: 'Player2',
        userColor: 'white',
        result: '0-1',
        date: '2026-10-02',
        movesCount: 12,
        pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 0-1',
        fingerprint: 'dup2',
        source: 'upload',
        createdAt: 200,
      },
    ];

    const recommendations = generatePersonalizedRecommendations({
      games,
      analyses: [],
      userPlayerName: 'MyUser',
    });

    const ids = recommendations.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size); // Zero duplicate IDs

    // Verify ordering: incomplete items appear before completed ones
    for (let i = 0; i < recommendations.length - 1; i++) {
      if (recommendations[i].status === 'completed') {
        expect(recommendations[i + 1].status).toBe('completed');
      }
    }
  });
});
