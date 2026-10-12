import { describe, it, expect } from 'vitest';
import {
  detectOpeningBoundary,
  findOpeningMistakes,
  generateBetterPositionDemonstration,
} from '../coach/openingCoachService';
import { classifyMove, estimatePerformanceElo } from '../engine/evaluation';
import type { GameRecord, GameAnalysis, OpeningRepertoire, PositionAnalysis } from '../types/chess';

describe('Opening Mistake Coach & Move Classification', () => {
  const sampleGame: GameRecord = {
    id: 'game_scotch_test',
    white: 'licht_d_god',
    black: 'Sada012',
    whiteElo: 722,
    blackElo: 737,
    result: '0-1',
    date: '2026.10.11',
    eco: 'C45',
    opening: 'Scotch Game',
    pgn: `1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nxd4 5. Qxd4 d6 6. Bc4 Nf6 7. O-O g6 0-1`,
    fingerprint: 'fp_scotch_1',
    source: 'chess.com',
    userColor: 'black',
    movesCount: 14,
    createdAt: Date.now(),
  };

  it('detects opening boundary using ECO metadata when no repertoire exists', () => {
    const boundary = detectOpeningBoundary(sampleGame, []);
    expect(boundary.method).toBe('eco_metadata');
    expect(boundary.endPly).toBe(14); // capped by total plies
    expect(boundary.description).toContain('C45');
  });

  it('detects opening boundary using user repertoire when available', () => {
    const customRepertoire: OpeningRepertoire = {
      id: 'rep_scotch',
      name: 'Black vs 1.e4',
      color: 'black',
      rootMoves: ['root_e2e4'],
      allMoves: {
        root_e2e4: {
          id: 'root_e2e4',
          parentId: null,
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          san: 'e4',
          uci: 'e2e4',
          color: 'white',
          ply: 1,
          isUserMove: false,
          children: ['root_e2e4_e7e5'],
        },
        root_e2e4_e7e5: {
          id: 'root_e2e4_e7e5',
          parentId: 'root_e2e4',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
          san: 'e5',
          uci: 'e7e5',
          color: 'black',
          ply: 2,
          isUserMove: true,
          children: [],
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const boundary = detectOpeningBoundary(sampleGame, [customRepertoire]);
    // Scotch has 1.e4 e5 2.Nf3 Nc6 3.d4... Black diverged or opponent diverged
    expect(boundary.endPly).toBeGreaterThanOrEqual(10);
  });

  it('identifies earliest opening mistakes for user side', () => {
    // Mock analysis where Black made a mistake on ply 8 (4... Nxd4)
    const mockPositions: PositionAnalysis[] = [
      { ply: 0, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', score: 20, bestMove: 'e2e4', pv: ['e2e4'], depth: 12 },
      { ply: 1, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', move: { from: 'e2', to: 'e4', san: 'e4', color: 'w', piece: 'p' }, score: 20, bestMove: 'e7e5', pv: ['e7e5'], depth: 12, classification: 'book' },
      { ply: 2, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', move: { from: 'e7', to: 'e5', san: 'e5', color: 'b', piece: 'p' }, score: 20, bestMove: 'g1f3', pv: ['g1f3'], depth: 12, classification: 'book' },
      { ply: 3, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', move: { from: 'g1', to: 'f3', san: 'Nf3', color: 'w', piece: 'n' }, score: 25, bestMove: 'b8c6', pv: ['b8c6'], depth: 12, classification: 'book' },
      { ply: 4, fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', move: { from: 'b8', to: 'c6', san: 'Nc6', color: 'b', piece: 'n' }, score: 25, bestMove: 'd2d4', pv: ['d2d4'], depth: 12, classification: 'book' },
      { ply: 5, fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3', move: { from: 'd2', to: 'd4', san: 'd4', color: 'w', piece: 'p' }, score: 30, bestMove: 'e5d4', pv: ['e5d4'], depth: 12, classification: 'book' },
      { ply: 6, fen: 'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4', move: { from: 'e5', to: 'd4', san: 'exd4', color: 'b', piece: 'p' }, score: 30, bestMove: 'f3d4', pv: ['f3d4'], depth: 12, classification: 'book' },
      { ply: 7, fen: 'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4', move: { from: 'f3', to: 'd4', san: 'Nxd4', color: 'w', piece: 'n' }, score: 35, bestMove: 'g8f6', bestMoveSan: 'Nf6', pv: ['g8f6', 'b1c3', 'f8b4'], depth: 12, classification: 'book' },
      // Ply 8: Black plays Nxd4 (blunder/mistake) cpl 180
      { ply: 8, fen: 'r1bqkbnr/pppp1ppp/8/8/3nP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5', move: { from: 'c6', to: 'd4', san: 'Nxd4', color: 'b', piece: 'n' }, score: 215, bestMove: 'd1d4', bestMoveSan: 'Qxd4', pv: ['d1d4', 'd7d6', 'b1c3'], depth: 12, classification: 'mistake', cpl: 180 },
    ];

    const mockAnalysis: GameAnalysis = {
      gameId: sampleGame.id,
      depth: 12,
      engine: 'Stockfish',
      completedAt: Date.now(),
      positions: mockPositions,
      summary: {
        whiteCPL: 20,
        blackCPL: 60,
        accuracyWhite: 88,
        accuracyBlack: 74,
        whiteStats: { brilliant: 0, great: 0, best: 3, excellent: 1, good: 0, book: 3, inaccuracy: 0, mistake: 0, blunder: 0, missedWin: 0, forced: 0 },
        blackStats: { brilliant: 0, great: 0, best: 2, excellent: 0, good: 0, book: 2, inaccuracy: 0, mistake: 1, blunder: 0, missedWin: 0, forced: 0 },
        identifiedMotifs: ['Opening Principle'],
      },
    };

    const result = findOpeningMistakes(sampleGame, mockAnalysis, []);
    expect(result.hasOpeningMistakes).toBe(true);
    expect(result.mistakes.length).toBe(1);

    const m = result.mistakes[0];
    expect(m.ply).toBe(8);
    expect(m.playedSan).toBe('Nxd4');
    expect(m.bestMoveSan).toBe('Nf6');
    expect(m.demonstrationSteps.length).toBeGreaterThan(0);
    expect(m.comparison.summaryExplanation).toContain('Nf6');
  });

  it('handles games with no opening mistakes honestly', () => {
    const perfectPositions: PositionAnalysis[] = [
      { ply: 0, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', score: 10, bestMove: 'e2e4', pv: ['e2e4'], depth: 12 },
      { ply: 1, fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', move: { from: 'e2', to: 'e4', san: 'e4', color: 'w', piece: 'p' }, score: 10, bestMove: 'e7e5', pv: ['e7e5'], depth: 12, classification: 'book' },
      { ply: 2, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', move: { from: 'e7', to: 'e5', san: 'e5', color: 'b', piece: 'p' }, score: 10, bestMove: 'g1f3', pv: ['g1f3'], depth: 12, classification: 'book' },
    ];

    const cleanAnalysis: GameAnalysis = {
      gameId: sampleGame.id,
      depth: 12,
      engine: 'Stockfish',
      completedAt: Date.now(),
      positions: perfectPositions,
      summary: {
        whiteCPL: 5,
        blackCPL: 5,
        accuracyWhite: 98,
        accuracyBlack: 98,
        whiteStats: { brilliant: 0, great: 0, best: 1, excellent: 0, good: 0, book: 1, inaccuracy: 0, mistake: 0, blunder: 0, missedWin: 0, forced: 0 },
        blackStats: { brilliant: 0, great: 0, best: 1, excellent: 0, good: 0, book: 1, inaccuracy: 0, mistake: 0, blunder: 0, missedWin: 0, forced: 0 },
        identifiedMotifs: [],
      },
    };

    const result = findOpeningMistakes(sampleGame, cleanAnalysis, []);
    expect(result.hasOpeningMistakes).toBe(false);
    expect(result.mistakes.length).toBe(0);
  });

  describe('Move Classification Criteria', () => {
    it('classifies book moves accurately with 0 CPL', () => {
      const res = classifyMove({
        evalBefore: 15,
        evalAfter: 15,
        isBestMove: true,
        isBookMove: true,
      });
      expect(res.classification).toBe('book');
      expect(res.cpl).toBe(0);
    });

    it('requires piece sacrifice and maintained advantage for brilliant move', () => {
      // True sacrifice maintaining winning advantage
      const brilliantRes = classifyMove({
        evalBefore: 200,
        evalAfter: 250,
        isBestMove: true,
        isPieceSacrifice: true,
      });
      expect(brilliantRes.classification).toBe('brilliant');

      // Best move but not a piece sacrifice should be best, not brilliant!
      const regularBestRes = classifyMove({
        evalBefore: 200,
        evalAfter: 200,
        isBestMove: true,
        isPieceSacrifice: false,
      });
      expect(regularBestRes.classification).toBe('best');
    });

    it('classifies great only-moves accurately', () => {
      const greatRes = classifyMove({
        evalBefore: 80,
        evalAfter: 80,
        isBestMove: true,
        isGreatMove: true,
      });
      expect(greatRes.classification).toBe('great');
    });

    it('identifies missed win when player had +300 and dropped to equal/losing', () => {
      const missedWinRes = classifyMove({
        evalBefore: 350,
        evalAfter: 50, // Dropped advantage
        isBestMove: false,
      });
      expect(missedWinRes.classification).toBe('missedWin');
      expect(missedWinRes.cpl).toBe(300);
    });

    it('correctly rounds estimated performance ratings to whole numbers', () => {
      const elo = estimatePerformanceElo(82.4, 38.6);
      expect(Number.isInteger(elo)).toBe(true);
      expect(elo).toBeGreaterThan(1000);
      expect(elo).toBeLessThan(2600);
    });
  });
});
