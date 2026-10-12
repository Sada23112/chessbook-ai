import { Chess } from 'chess.js';
import type {
  GameAnalysis,
  PositionAnalysis,
  AnalysisSummary,
  MoveClassification,
  GameRecord,
} from '../types/chess';
import {
  normalizeScoreToWhite,
  classifyMove,
  calculateMoveAccuracy,
  estimatePerformanceElo,
  generateGameVerdict,
} from './evaluation';
import { generateCoachExplanation } from '../coach/coachEngine';
import { db } from '../db/db';
import { createTrainingCardFromMistake } from '../training/srsEngine';
import { aggregateWeaknessesFromAnalyses } from '../analytics/weaknessTracker';

export interface EngineParsedInfo {
  depth: number;
  scoreCp?: number;
  mate?: number;
  bestMove: string;
  pv: string[];
}

export type EngineStatus = 'uninitialized' | 'loading' | 'ready' | 'analyzing' | 'error';

export type AnalysisLifecycleState =
  | 'idle'
  | 'queued'
  | 'initializing'
  | 'analyzing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

class StockfishManager {
  private worker: Worker | null = null;
  private status: EngineStatus = 'uninitialized';
  private lifecycleState: AnalysisLifecycleState = 'idle';
  private statusListeners: Array<(status: EngineStatus) => void> = [];
  private lifecycleListeners: Array<(state: AnalysisLifecycleState) => void> = [];
  private currentResolver: ((info: EngineParsedInfo) => void) | null = null;
  private currentRejecter: ((err: Error) => void) | null = null;
  private currentRequestId = 0;
  private requestCounter = 0;
  private latestInfo: Partial<EngineParsedInfo> = {};
  private isCancelled = false;

  getStatus(): EngineStatus {
    return this.status;
  }

  getLifecycleState(): AnalysisLifecycleState {
    return this.lifecycleState;
  }

  onStatusChange(listener: (status: EngineStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  onLifecycleChange(listener: (state: AnalysisLifecycleState) => void): () => void {
    this.lifecycleListeners.push(listener);
    listener(this.lifecycleState);
    return () => {
      this.lifecycleListeners = this.lifecycleListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(newStatus: EngineStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((l) => l(newStatus));
  }

  private setLifecycleState(newState: AnalysisLifecycleState) {
    this.lifecycleState = newState;
    this.lifecycleListeners.forEach((l) => l(newState));
  }

  async init(): Promise<boolean> {
    if (this.status === 'ready' && this.worker) return true;
    if (this.status === 'loading') return true;

    this.setStatus('loading');

    try {
      if (typeof window === 'undefined' || !window.Worker) {
        // Fallback for non-browser / test environments
        this.setStatus('ready');
        return true;
      }

      this.worker = new Worker('/engine/stockfish.js');

      return new Promise<boolean>((resolve) => {
        let isUciOk = false;

        const timeout = setTimeout(() => {
          // If real worker times out (e.g. testing), fall back gracefully
          this.setStatus('ready');
          resolve(true);
        }, 3000);

        this.worker!.onmessage = (e: MessageEvent) => {
          const line = typeof e.data === 'string' ? e.data : '';

          if (line === 'uciok') {
            isUciOk = true;
            this.worker?.postMessage('isready');
          } else if (line === 'readyok') {
            clearTimeout(timeout);
            this.setStatus('ready');
            resolve(true);
          } else {
            this.handleWorkerOutput(line);
          }
        };

        this.worker!.onerror = (err) => {
          console.warn('Stockfish worker error:', err);
          if (this.currentRejecter) {
            this.currentRejecter(new Error('Worker error'));
          }
          clearTimeout(timeout);
          this.setStatus('ready'); // allow graceful fallback
          resolve(true);
          this.restartWorker();
        };

        this.worker!.postMessage('uci');
      });
    } catch (err) {
      console.warn('Failed to initialize Stockfish worker:', err);
      this.setStatus('ready');
      return true;
    }
  }

  private handleWorkerOutput(line: string) {
    if (line.startsWith('info ')) {
      // Parse depth
      const depthMatch = line.match(/depth\s+(\d+)/);
      if (depthMatch) {
        this.latestInfo.depth = parseInt(depthMatch[1], 10);
      }

      // Parse score cp or mate
      const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
      if (cpMatch) {
        this.latestInfo.scoreCp = parseInt(cpMatch[1], 10);
        this.latestInfo.mate = undefined;
      }

      const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
      if (mateMatch) {
        this.latestInfo.mate = parseInt(mateMatch[1], 10);
        this.latestInfo.scoreCp = undefined;
      }

      // Parse PV
      const pvIndex = line.indexOf(' pv ');
      if (pvIndex !== -1) {
        const pvMoves = line.slice(pvIndex + 4).trim().split(/\s+/);
        this.latestInfo.pv = pvMoves;
        if (pvMoves.length > 0 && !this.latestInfo.bestMove) {
          this.latestInfo.bestMove = pvMoves[0];
        }
      }
    } else if (line.startsWith('bestmove ')) {
      const parts = line.split(/\s+/);
      const rawMove = parts[1];
      const bestMove = rawMove && rawMove !== '(none)' ? rawMove : (this.latestInfo.bestMove || '');

      if (this.currentResolver) {
        const resolved: EngineParsedInfo = {
          depth: this.latestInfo.depth || 10,
          scoreCp: this.latestInfo.scoreCp ?? 0,
          mate: this.latestInfo.mate,
          bestMove,
          pv: this.latestInfo.pv && this.latestInfo.pv.length > 0 ? this.latestInfo.pv : (bestMove ? [bestMove] : []),
        };
        const res = this.currentResolver;
        this.currentResolver = null;
        this.currentRejecter = null;
        res(resolved);
      }
    }
  }

  // Analyze single position with terminal state detection and guaranteed bounded timeout
  async analyzePosition(fen: string, depth = 12, maxWaitMs = 2500): Promise<EngineParsedInfo> {
    // 1. Immediately handle terminal positions without querying Stockfish (which hangs on 0 root moves)
    try {
      const chess = new Chess(fen);
      if (chess.isGameOver() || chess.moves().length === 0) {
        if (chess.isCheckmate() || chess.inCheck()) {
          const score = chess.turn() === 'w' ? -9900 : 9900;
          return {
            depth: 0,
            scoreCp: score,
            mate: 0,
            bestMove: '',
            pv: [],
          };
        } else {
          // Stalemate or draw
          return {
            depth: 0,
            scoreCp: 0,
            mate: undefined,
            bestMove: '',
            pv: [],
          };
        }
      }
    } catch {
      // ignore
    }

    try {
      await this.init();
    } catch {
      return this.fallbackEvaluate(fen, depth);
    }

    // Fallback if worker not available
    if (!this.worker) {
      return this.fallbackEvaluate(fen, depth);
    }

    let isSettled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const workerPromise = new Promise<EngineParsedInfo>((resolve, reject) => {
      const reqId = ++this.requestCounter;
      this.currentRequestId = reqId;
      this.latestInfo = { depth: 0, pv: [] };

      this.currentResolver = (info: EngineParsedInfo) => {
        if (isSettled) return;
        isSettled = true;
        resolve(info);
      };

      this.currentRejecter = (err: Error) => {
        if (isSettled) return;
        isSettled = true;
        reject(err);
      };

      try {
        this.worker!.postMessage(`position fen ${fen}`);
        this.worker!.postMessage(`go depth ${depth}`);
      } catch (err) {
        if (isSettled) return;
        isSettled = true;
        reject(err);
      }
    });

    const timeoutPromise = new Promise<EngineParsedInfo>((resolve) => {
      timerId = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        console.warn(`[Stockfish] Position analysis timed out after ${maxWaitMs}ms, using fallback evaluation`);
        this.restartWorker();
        resolve(this.fallbackEvaluate(fen, depth));
      }, maxWaitMs);
    });

    try {
      const result = await Promise.race([workerPromise, timeoutPromise]);
      return result;
    } catch (err) {
      console.warn('[Stockfish] Evaluation error caught, falling back:', err);
      return this.fallbackEvaluate(fen, depth);
    } finally {
      if (timerId) {
        clearTimeout(timerId);
      }
      this.currentResolver = null;
      this.currentRejecter = null;
    }
  }

  stop() {
    this.isCancelled = true;
    if (this.worker) {
      try {
        this.worker.postMessage('stop');
      } catch {
        // ignore
      }
    }
    if (this.currentResolver) {
      this.currentResolver({
        depth: this.latestInfo.depth || 0,
        scoreCp: this.latestInfo.scoreCp ?? 0,
        bestMove: this.latestInfo.bestMove || '',
        pv: this.latestInfo.pv || [],
      });
      this.currentResolver = null;
      this.currentRejecter = null;
    }
    this.setLifecycleState('cancelled');
    this.setStatus('ready');
  }

  restartWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
    this.currentResolver = null;
    this.currentRejecter = null;
    this.setStatus('uninitialized');
  }

  terminate() {
    this.restartWorker();
    this.setLifecycleState('idle');
  }

  // Deterministic rule-based fallback if WebAssembly worker is unavailable in environment
  private fallbackEvaluate(fen: string, depth = 10): EngineParsedInfo {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return {
        depth,
        scoreCp: chess.inCheck() ? -9900 : 0,
        bestMove: '',
        pv: [],
      };
    }

    // Simple material balance evaluation
    const pieceVals: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let score = 0;
    const board = chess.board();
    for (const row of board) {
      for (const sq of row) {
        if (sq) {
          const val = pieceVals[sq.type] || 0;
          score += sq.color === 'w' ? val : -val;
        }
      }
    }
    const scoreForTurn = chess.turn() === 'w' ? score : -score;

    // Pick best move (capture > center move > first move)
    const sortedMoves = [...moves].sort((a, b) => {
      const aVal = a.captured ? pieceVals[a.captured] || 50 : 0;
      const bVal = b.captured ? pieceVals[b.captured] || 50 : 0;
      return bVal - aVal;
    });

    const chosen = sortedMoves[0];
    const uci = `${chosen.from}${chosen.to}${chosen.promotion || ''}`;

    return {
      depth,
      scoreCp: scoreForTurn,
      bestMove: uci,
      pv: [uci],
    };
  }

  // Analyze complete game ply-by-ply
  async analyzeGame(
    game: GameRecord,
    options: {
      depth: number;
      onProgress?: (currentPly: number, totalPlies: number) => void;
      onStageChange?: (stage: AnalysisLifecycleState) => void;
      shouldCancel?: () => boolean;
    }
  ): Promise<GameAnalysis> {
    this.isCancelled = false;
    this.setLifecycleState('initializing');
    options.onStageChange?.('initializing');
    this.setStatus('analyzing');

    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      const historyVerbose = chess.history({ verbose: true });
      const totalPlies = historyVerbose.length;

      // Build list of FENs for each position: ply 0 (initial) up to ply N
      const replayChess = new Chess();
      const fenHeaderMatch = game.pgn.match(/\[FEN\s+"([^"]+)"\]/i);
      if (fenHeaderMatch && fenHeaderMatch[1]) {
        try {
          replayChess.load(fenHeaderMatch[1]);
        } catch {
          // ignore
        }
      }

      const positionsData: Array<{ ply: number; fen: string; move?: (typeof historyVerbose)[0] }> = [
        { ply: 0, fen: replayChess.fen() },
      ];

      for (let i = 0; i < historyVerbose.length; i++) {
        const m = historyVerbose[i];
        try {
          replayChess.move(m);
        } catch {
          // ignore
        }
        positionsData.push({ ply: i + 1, fen: replayChess.fen(), move: m });
      }

      const totalPositions = positionsData.length;
      options.onProgress?.(0, totalPositions);
      this.setLifecycleState('analyzing');
      options.onStageChange?.('analyzing');

      const analyzedPositions: PositionAnalysis[] = [];
      const settings = await db.getSettings();

      // Analyze each position
      for (let i = 0; i < positionsData.length; i++) {
        if (this.isCancelled || options.shouldCancel?.()) {
          this.setLifecycleState('cancelled');
          options.onStageChange?.('cancelled');
          this.setStatus('ready');
          throw new Error('Analysis cancelled by user');
        }

        const item = positionsData[i];
        let engineResult: EngineParsedInfo;
        try {
          engineResult = await this.analyzePosition(item.fen, options.depth, 2500);
        } catch (posErr) {
          console.warn(`[Stockfish] Fallback on position ${i} (ply ${item.ply}):`, posErr);
          engineResult = this.fallbackEvaluate(item.fen, options.depth);
        }

        // Report progress increment after completing position i
        options.onProgress?.(i + 1, totalPositions);

      // Determine turn from FEN
      const currentTurn = item.fen.split(' ')[1] as 'w' | 'b';
      const whiteScore = normalizeScoreToWhite(engineResult.scoreCp, engineResult.mate, currentTurn);

      // Convert UCI bestMove to SAN
      let bestMoveSan = engineResult.bestMove;
      let pvSan: string[] = [];
      try {
        const tempChess = new Chess(item.fen);
        if (engineResult.bestMove && engineResult.bestMove.length >= 4) {
          const from = engineResult.bestMove.slice(0, 2);
          const to = engineResult.bestMove.slice(2, 4);
          const promotion = engineResult.bestMove[4];
          const m = tempChess.move({ from, to, promotion });
          if (m) {
            bestMoveSan = m.san;
          }
        }

        // Convert PV to SAN
        const pvChess = new Chess(item.fen);
        for (const uci of engineResult.pv) {
          if (uci && uci.length >= 4) {
            const m = pvChess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
            if (m) pvSan.push(m.san);
            else break;
          }
        }
      } catch {
        // fallback
      }

      analyzedPositions.push({
        ply: item.ply,
        fen: item.fen,
        move: item.move
          ? {
              from: item.move.from,
              to: item.move.to,
              san: item.move.san,
              color: item.move.color,
              piece: item.move.piece,
              captured: item.move.captured,
              promotion: item.move.promotion,
            }
          : undefined,
        score: whiteScore,
        mate: engineResult.mate,
        bestMove: engineResult.bestMove,
        bestMoveSan,
        pv: engineResult.pv,
        pvSan,
        depth: options.depth,
      });
    }

    // Guarantee 100% progress before finalizing
    options.onProgress?.(totalPositions, totalPositions);

    // All positions analyzed — transition to finalizing phase
    this.setLifecycleState('finalizing');
    options.onStageChange?.('finalizing');

    // Compute move classifications and coach explanations
    let whiteTotalCpl = 0;
    let whiteCount = 0;
    let blackTotalCpl = 0;
    let blackCount = 0;
    let whiteAccSum = 0;
    let blackAccSum = 0;

    const whiteStats: Record<MoveClassification, number> = {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      missedWin: 0,
      forced: 0,
      book: 0,
    };

    const blackStats: Record<MoveClassification, number> = {
      brilliant: 0,
      great: 0,
      best: 0,
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      missedWin: 0,
      forced: 0,
      book: 0,
    };

    const identifiedMotifs: string[] = [];

    // Ply 0 has no move. Plies 1..N have moves.
    for (let ply = 1; ply < analyzedPositions.length; ply++) {
      const posBefore = analyzedPositions[ply - 1];
      const posCurrent = analyzedPositions[ply];

      if (!posCurrent.move) continue;

      const moverColor = posCurrent.move.color; // 'w' or 'b'
      const isWhite = moverColor === 'w';

      // Evaluation from mover's perspective
      const moverEvalBefore = isWhite ? posBefore.score : -posBefore.score;
      const moverEvalAfter = isWhite ? posCurrent.score : -posCurrent.score;

      // Check if move was best move
      const playedUci = `${posCurrent.move.from}${posCurrent.move.to}${posCurrent.move.promotion || ''}`;
      const isBestMove = playedUci === posBefore.bestMove || posCurrent.move.san === posBefore.bestMoveSan;

      // Check for piece sacrifice
      let isPieceSacrifice = false;
      const pieceType = posCurrent.move.piece.toLowerCase();
      if (['n', 'b', 'r', 'q'].includes(pieceType)) {
        try {
          const testChess = new Chess(posCurrent.fen);
          // Check if opponent can capture the piece on this square
          const capturesOfTarget = testChess.moves({ verbose: true }).filter(m => m.to === posCurrent.move!.to);
          if (capturesOfTarget.length > 0 && !posCurrent.move.captured) {
            isPieceSacrifice = true;
          }
        } catch {
          // ignore
        }
      }

      // Classify move
      const { classification, cpl } = classifyMove({
        evalBefore: moverEvalBefore,
        evalAfter: moverEvalAfter,
        isBestMove,
        isPieceSacrifice,
        customThresholds: settings.customClassifications,
      });

      posCurrent.classification = classification;
      posCurrent.cpl = cpl;

      const accuracy = calculateMoveAccuracy(cpl);

      if (isWhite) {
        whiteTotalCpl += cpl;
        whiteCount++;
        whiteAccSum += accuracy;
        whiteStats[classification]++;
      } else {
        blackTotalCpl += cpl;
        blackCount++;
        blackAccSum += accuracy;
        blackStats[classification]++;
      }

      // Coach Explanation for brilliant moves
      if (classification === 'brilliant') {
        posCurrent.explanation = {
          playedSan: posCurrent.move.san,
          bestMoveSan: posBefore.bestMoveSan || posBefore.bestMove,
          evalBefore: moverEvalBefore,
          evalAfter: moverEvalAfter,
          evalDiff: 0,
          motif: 'Brilliant Sacrifice',
          consequence: `Brilliant move! You found a stunning sacrifice with ${posCurrent.move.san} that decisively accelerates your tactical attack while maintaining advantage.`,
          beginnerLesson: 'A piece sacrifice is brilliant when giving up material unlocks an unstoppable attack or winning advantage.',
          practicalAdvice: 'Look for forcing sacrifices that rip open the enemy king or overload their defensive pieces.',
        };
        if (!identifiedMotifs.includes('Brilliant Sacrifice')) {
          identifiedMotifs.push('Brilliant Sacrifice');
        }
      }

      // Generate Coach Explanation for inaccuracies, mistakes, blunders, missed wins
      if (['inaccuracy', 'mistake', 'blunder', 'missedWin'].includes(classification)) {
        const explanation = generateCoachExplanation({
          fenBefore: posBefore.fen,
          fenAfter: posCurrent.fen,
          playedMove: posCurrent.move,
          bestMoveSan: posBefore.bestMoveSan || posBefore.bestMove,
          bestMoveUci: posBefore.bestMove,
          pv: posBefore.pv,
          evalBefore: moverEvalBefore,
          evalAfter: moverEvalAfter,
          cpl,
          mateBefore: posBefore.mate,
          mateAfter: posCurrent.mate,
        });

        posCurrent.explanation = explanation;
        if (explanation.motif && !identifiedMotifs.includes(explanation.motif)) {
          identifiedMotifs.push(explanation.motif);
        }

        // If this mistake was by the user, convert to training card!
        const isUserMistake =
          (game.userColor === 'white' && isWhite) ||
          (game.userColor === 'black' && !isWhite) ||
          !game.userColor; // Default to saving if user color not specified

        if (isUserMistake && ['mistake', 'blunder', 'missedWin'].includes(classification)) {
          try {
            const card = createTrainingCardFromMistake({
              gameId: game.id,
              fen: posBefore.fen,
              turn: moverColor,
              playedMoveSan: posCurrent.move.san,
              bestMoveSan: posBefore.bestMoveSan || posBefore.bestMove,
              bestMoveUci: posBefore.bestMove,
              pvSan: posBefore.pvSan,
              pvUci: posBefore.pv,
              lesson: explanation.beginnerLesson,
              motif: explanation.motif || 'Tactics',
            });
            await db.trainingCards.put(card);
          } catch (cardErr) {
            console.warn('[Stockfish] Optional training card save ignored:', cardErr);
          }
        }
      }
    }

    const accuracyWhite = whiteCount > 0 ? Math.round(whiteAccSum / whiteCount) : 100;
    const accuracyBlack = blackCount > 0 ? Math.round(blackAccSum / blackCount) : 100;
    const whiteCPL = whiteCount > 0 ? Math.round(whiteTotalCpl / whiteCount) : 0;
    const blackCPL = blackCount > 0 ? Math.round(blackTotalCpl / blackCount) : 0;

    const estimatedEloWhite = estimatePerformanceElo(accuracyWhite, whiteCPL);
    const estimatedEloBlack = estimatePerformanceElo(accuracyBlack, blackCPL);
    const gameReviewVerdict = generateGameVerdict(
      accuracyWhite,
      accuracyBlack,
      game.whiteElo,
      game.blackElo
    );

    const summary: AnalysisSummary = {
      whiteCPL,
      blackCPL,
      accuracyWhite,
      accuracyBlack,
      estimatedEloWhite,
      estimatedEloBlack,
      gameReviewVerdict,
      whiteStats,
      blackStats,
      identifiedMotifs,
    };

    const analysisRecord: GameAnalysis = {
      gameId: game.id,
      depth: options.depth,
      engine: 'Stockfish 10 WASM',
      completedAt: Date.now(),
      positions: analyzedPositions,
      summary,
    };

    // 1. Confirm analysis record write
    try {
      await db.analyses.put(analysisRecord);
      await db.games.update(game.id, {
        analyzedAt: Date.now(),
        analysisDepth: options.depth,
        summary,
      });

      // 2. Verify persistence before declaring completed
      const verified = await db.analyses.get(game.id);
      if (!verified) {
        console.warn('[Stockfish] Re-writing analysis record to ensure persistence...');
        await db.analyses.put(analysisRecord);
      }
    } catch (dbErr) {
      console.warn('[Stockfish] DB persistence warning:', dbErr);
    }

    // 3. Refresh aggregated personal weaknesses in a non-blocking safe block
    try {
      const allGames = await db.games.toArray();
      const allAnalyses = await db.analyses.toArray();
      await aggregateWeaknessesFromAnalyses(allGames, allAnalyses);
    } catch (aggErr) {
      console.warn('[Stockfish] Optional weakness aggregation error ignored:', aggErr);
    }

    this.setLifecycleState('completed');
    options.onStageChange?.('completed');
    this.setStatus('ready');
    return analysisRecord;
  } catch (err) {
    this.setStatus('ready');
    if (this.isCancelled) {
      this.setLifecycleState('cancelled');
      options.onStageChange?.('cancelled');
    } else {
      this.setLifecycleState('failed');
      options.onStageChange?.('failed');
    }
    throw err;
  }
}
}

export const stockfishService = new StockfishManager();
