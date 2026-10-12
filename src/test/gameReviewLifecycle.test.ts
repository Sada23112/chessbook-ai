import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stockfishService } from '../engine/stockfishService';
import type { GameRecord } from '../types/chess';
import { db } from '../db/db';

describe('Game Review Analysis Lifecycle and Timeout Resilience', () => {
  beforeEach(async () => {
    // Reset any ongoing engine state
    stockfishService.stop();
  });

  it('immediately evaluates terminal checkmate and stalemate positions without engine query hang', async () => {
    // Scholar's mate checkmate position: Qxf7#
    const checkmateFen = 'r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const resultMate = await stockfishService.analyzePosition(checkmateFen, 12);

    expect(resultMate.mate).toBe(0);
    expect(resultMate.scoreCp).toBe(9900); // Black is checkmated (White delivered checkmate -> +9900)
    expect(resultMate.depth).toBe(0);

    // Stalemate position
    const stalemateFen = 'k7/8/1Q6/8/8/8/8/7K b - - 0 1';
    const resultStalemate = await stockfishService.analyzePosition(stalemateFen, 12);

    expect(resultStalemate.scoreCp).toBe(0);
    expect(resultStalemate.mate).toBeUndefined();
    expect(resultStalemate.depth).toBe(0);
  });

  it('completes entire game review and transitions through explicit lifecycle states', async () => {
    const testGame: GameRecord = {
      id: 'test_game_lifecycle_1',
      date: '2026-10-12',
      white: 'PlayerOne',
      black: 'PlayerTwo',
      whiteElo: 1500,
      blackElo: 1480,
      result: '1-0',
      userColor: 'white',
      movesCount: 4,
      pgn: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',
      fingerprint: 'test_fingerprint_1',
      source: 'paste',
      createdAt: Date.now(),
    };

    await db.games.put(testGame);

    const stages: string[] = [];
    const progressList: Array<{ current: number; total: number }> = [];

    const analysis = await stockfishService.analyzeGame(testGame, {
      depth: 8,
      onProgress: (current, total) => {
        progressList.push({ current, total });
      },
      onStageChange: (stage) => {
        stages.push(stage);
      },
    });

    // Verify terminal lifecycle state reached
    expect(stockfishService.getLifecycleState()).toBe('completed');
    expect(stages).toContain('initializing');
    expect(stages).toContain('analyzing');
    expect(stages).toContain('finalizing');
    expect(stages).toContain('completed');

    // Verify progress tracking reached 100% exactly after all positions completed
    expect(progressList.length).toBeGreaterThan(0);
    const lastProgress = progressList[progressList.length - 1];
    expect(lastProgress.current).toBe(lastProgress.total);
    expect(lastProgress.total).toBe(8); // ply 0 + 7 plies = 8 positions

    // Verify database persistence confirmed
    const savedAnalysis = await db.analyses.get(testGame.id);
    expect(savedAnalysis).toBeDefined();
    expect(savedAnalysis?.positions.length).toBe(8);
    expect(savedAnalysis?.summary).toBeDefined();

    const updatedGame = await db.games.get(testGame.id);
    expect(updatedGame?.analyzedAt).toBeDefined();
    expect(updatedGame?.summary).toBeDefined();
  });

  it('handles cancellation gracefully and marks lifecycle state as cancelled', async () => {
    const testGame: GameRecord = {
      id: 'test_game_cancellation',
      date: '2026-10-12',
      white: 'PlayerA',
      black: 'PlayerB',
      result: '1-0',
      movesCount: 2,
      pgn: '1. e4 e5 2. Nf3 Nc6 1-0',
      fingerprint: 'test_fingerprint_cancel',
      source: 'paste',
      createdAt: Date.now(),
    };

    let cancelCalled = false;
    const stages: string[] = [];

    const promise = stockfishService.analyzeGame(testGame, {
      depth: 10,
      onProgress: (current) => {
        if (current === 1) {
          cancelCalled = true;
          stockfishService.stop();
        }
      },
      onStageChange: (stage) => {
        stages.push(stage);
      },
      shouldCancel: () => cancelCalled,
    });

    await expect(promise).rejects.toThrow();
    expect(stockfishService.getLifecycleState()).toBe('cancelled');
  });

  it('terminates and resets worker cleanly without leaving stale resolvers', () => {
    stockfishService.terminate();
    expect(stockfishService.getStatus()).toBe('uninitialized');
    expect(stockfishService.getLifecycleState()).toBe('idle');
  });

  it('recovers from position timeouts using bounded Promise.race and never hangs on position evaluation', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    // Test with tiny maxWaitMs to verify instant fallback resolution
    const start = Date.now();
    const result = await stockfishService.analyzePosition(fen, 14, 50);
    const elapsed = Date.now() - start;

    expect(result).toBeDefined();
    expect(result.bestMove).toBeDefined();
    expect(result.bestMove.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000); // Guarantees it didn't block or hang
  });

  it('completes long 28-position game review to 100% without stalling at 96% (27 of 28)', async () => {
    // 27 plies (positionsData length = 28)
    const pgn27 = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 9. exd5 Nxd5 10. Qb3 Nce7 11. O-O O-O 12. Rfe1 c6 13. a4 Qb6 14. a5 1-0';
    const longGame: GameRecord = {
      id: 'test_game_27_plies',
      date: '2026-10-12',
      white: 'Hero',
      black: 'Opponent',
      result: '1-0',
      userColor: 'white',
      movesCount: 27,
      pgn: pgn27,
      fingerprint: 'fp_27_plies',
      source: 'paste',
      createdAt: Date.now(),
    };

    await db.games.put(longGame);

    let finalProgress = { current: 0, total: 0 };
    const analysis = await stockfishService.analyzeGame(longGame, {
      depth: 8,
      onProgress: (current, total) => {
        finalProgress = { current, total };
      },
    });

    expect(stockfishService.getLifecycleState()).toBe('completed');
    expect(finalProgress.total).toBe(28);
    expect(finalProgress.current).toBe(28); // Crucial: Reaches 28 of 28 (100%), NOT 27 of 28 (96%)
    expect(analysis.positions.length).toBe(28);
    expect(analysis.summary.accuracyWhite).toBeGreaterThan(0);
  });
});
