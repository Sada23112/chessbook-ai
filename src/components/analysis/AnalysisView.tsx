import React, { useEffect, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { InteractiveChessboard, type SquareAnnotation } from '../common/InteractiveChessboard';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Lightbulb,
  Bookmark,
  Layers,
  Award,
  BarChart3,
  ListOrdered,
  Bot,
  Target,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { EvalBar } from '../common/EvalBar';
import { EvalGraph } from '../common/EvalGraph';
import { getGameOutcome } from '../../utils/gameOutcome';
import { db } from '../../db/db';
import type { MoveClassification, OpeningRepertoire } from '../../types/chess';
import { OpeningMistakeCoach } from './OpeningMistakeCoach';
import { findOpeningMistakes, detectOpeningBoundary } from '../../coach/openingCoachService';

export const CLASSIFICATION_BADGES: Record<
  MoveClassification,
  { label: string; bg: string; text: string; icon: string }
> = {
  brilliant: { label: 'Brilliant', bg: 'bg-cyan-500/20 border-cyan-500/40', text: 'text-cyan-300', icon: '!!' },
  great: { label: 'Great', bg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-300', icon: '!' },
  best: { label: 'Best', bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', icon: '★' },
  excellent: { label: 'Excellent', bg: 'bg-lime-500/15 border-lime-500/30', text: 'text-lime-400', icon: '✓' },
  good: { label: 'Good', bg: 'bg-slate-500/15 border-slate-500/30', text: 'text-slate-300', icon: '•' },
  inaccuracy: { label: 'Inaccuracy', bg: 'bg-yellow-500/15 border-yellow-500/30', text: 'text-yellow-400', icon: '?!' },
  mistake: { label: 'Mistake', bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400', icon: '?' },
  blunder: { label: 'Blunder', bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-400', icon: '??' },
  missedWin: { label: 'Missed Win', bg: 'bg-fuchsia-500/15 border-fuchsia-500/30', text: 'text-fuchsia-400', icon: '⚡' },
  forced: { label: 'Forced', bg: 'bg-cyan-500/15 border-cyan-500/30', text: 'text-cyan-400', icon: '□' },
  book: { label: 'Book', bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', icon: '📖' },
};

export const AnalysisView: React.FC = () => {
  const {
    activeGame,
    activeAnalysis,
    livePositions,
    currentPly,
    boardOrientation,
    isAnalyzing,
    analysisLifecycle,
    analysisError,
    analysisProgress,
    analysisStage,
    setAnalysisStage,
    setCurrentPly,
    nextPly,
    prevPly,
    firstPly,
    lastPly,
    flipBoard,
    startAnalysis,
    stopAnalysis,
    setTab,
    settings,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState<number>(14);
  const [sidebarTab, setSidebarTab] = useState<'review' | 'moves' | 'coach'>('review');
  const [repertoires, setRepertoires] = useState<OpeningRepertoire[]>([]);

  // Load repertoires for deviation detection
  useEffect(() => {
    db.repertoires.toArray().then(setRepertoires);
  }, []);

  // Build replay positions array from activeGame PGN
  const gamePositions = useMemo(() => {
    if (!activeGame) return [];
    try {
      const chess = new Chess();
      chess.loadPgn(activeGame.pgn);
      const history = chess.history({ verbose: true });

      const replay = new Chess();
      const list = [{ ply: 0, fen: replay.fen(), san: '', from: '', to: '' }];

      for (let i = 0; i < history.length; i++) {
        const m = history[i];
        replay.move(m);
        list.push({ ply: i + 1, fen: replay.fen(), san: m.san, from: m.from, to: m.to });
      }
      return list;
    } catch {
      return [];
    }
  }, [activeGame]);

  const [exploredFen, setExploredFen] = useState<string | null>(null);
  const [exploredSan, setExploredSan] = useState<string | null>(null);

  // Clear explored variations when navigating ply
  useEffect(() => {
    setExploredFen(null);
    setExploredSan(null);
  }, [currentPly]);

  const currentPosData = gamePositions[currentPly] || gamePositions[0];
  const currentFen = currentPosData ? currentPosData.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const displayFen = exploredFen || currentFen;

  // Analysis position data (supports real-time live positions during active review)
  const currentAnalysisPos =
    activeAnalysis?.positions[currentPly] ||
    livePositions.find((p) => p.ply === currentPly);
  const evalScore = currentAnalysisPos?.score ?? 0;
  const evalMate = currentAnalysisPos?.mate;

  // Detect opening mistakes
  const openingMistakesData = useMemo(() => {
    if (!activeGame || !activeAnalysis) return null;
    return findOpeningMistakes(activeGame, activeAnalysis, repertoires);
  }, [activeGame, activeAnalysis, repertoires]);

  // Best move arrow
  const customArrows = useMemo(() => {
    if (!currentAnalysisPos?.bestMove || currentAnalysisPos.bestMove.length < 4) return [];
    const startSquare = currentAnalysisPos.bestMove.slice(0, 2);
    const endSquare = currentAnalysisPos.bestMove.slice(2, 4);
    return [{ startSquare, endSquare, color: 'rgba(34, 197, 94, 0.75)' }];
  }, [currentAnalysisPos]);

  // Synchronized move classification annotation on target square
  const moveAnnotation = useMemo<SquareAnnotation | null>(() => {
    if (!currentAnalysisPos?.classification || !currentPosData?.to) return null;
    const badge = CLASSIFICATION_BADGES[currentAnalysisPos.classification];
    if (!badge) return null;

    let bgHex = '#22c55e';
    if (badge.bg.includes('cyan')) bgHex = '#06b6d4';
    else if (badge.bg.includes('blue')) bgHex = '#3b82f6';
    else if (badge.bg.includes('lime')) bgHex = '#84cc16';
    else if (badge.bg.includes('purple')) bgHex = '#a855f7';
    else if (badge.bg.includes('yellow')) bgHex = '#eab308';
    else if (badge.bg.includes('orange')) bgHex = '#f97316';
    else if (badge.bg.includes('rose')) bgHex = '#ef4444';
    else if (badge.bg.includes('fuchsia')) bgHex = '#d946ef';

    return {
      square: currentPosData.to,
      label: badge.icon,
      bg: bgHex,
      color: '#000000',
    };
  }, [currentAnalysisPos, currentPosData]);

  // Highlight squares for played move
  const customSquareStyles = useMemo(() => {
    if (!currentPosData?.from || !currentPosData?.to) return {};
    return {
      [currentPosData.from]: { backgroundColor: 'rgba(234, 179, 8, 0.28)' },
      [currentPosData.to]: { backgroundColor: 'rgba(234, 179, 8, 0.38)' },
    };
  }, [currentPosData]);

  // Autoplay moves
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (currentPly >= gamePositions.length - 1) {
        setIsPlaying(false);
      } else {
        nextPly();
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, currentPly, gamePositions.length, nextPly]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === 'ArrowLeft') {
        prevPly();
      } else if (e.key === 'ArrowRight') {
        nextPly();
      } else if (e.key === 'ArrowUp') {
        firstPly();
      } else if (e.key === 'ArrowDown') {
        lastPly();
      } else if (e.key === 'f' || e.key === 'F') {
        flipBoard();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPly, nextPly, firstPly, lastPly, flipBoard]);

  if (!activeGame) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-accent text-3xl mb-4">
          ♟
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">No Game Selected</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          Choose a game from your library to explore move-by-move evaluations, Stockfish coach explanations, and tactical exercises.
        </p>
        <button
          onClick={() => setTab('my-games')}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg shadow transition flex items-center space-x-2"
        >
          <Layers size={18} />
          <span>Open Game Library</span>
        </button>
      </div>
    );
  }

  // STAGE B: OPENING MISTAKE COACH
  if (analysisStage === 'opening_coach') {
    return (
      <OpeningMistakeCoach
        game={activeGame}
        analysis={activeAnalysis}
        repertoires={repertoires}
        onFinishReview={() => setAnalysisStage('summary')}
        onOpenFullGame={() => setAnalysisStage('full_game')}
        onStartFullAnalysis={() => startAnalysis(selectedDepth)}
        isAnalyzing={isAnalyzing}
      />
    );
  }

  const summary = activeAnalysis?.summary;

  // STAGE A: GAME SUMMARY (Concise, focused on opening review entry point)
  if (analysisStage === 'summary') {
    const openingBoundary = detectOpeningBoundary(activeGame, repertoires);
    const mistakesCount = openingMistakesData?.mistakes.length ?? 0;

    return (
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background max-w-5xl mx-auto w-full">
        {/* Game Title & Outcome Banner */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xs font-mono text-slate-500">{activeGame.date}</span>
                {activeGame.eco && (
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-xs font-mono font-bold text-accent">
                    {activeGame.eco}
                  </span>
                )}
                {activeGame.opening && (
                  <span className="text-xs text-slate-300 font-medium truncate max-w-xs">
                    {activeGame.opening}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-3">
                <span>{activeGame.white}</span>
                <span className="text-slate-500 text-lg font-mono">vs</span>
                <span>{activeGame.black}</span>
              </h1>
            </div>

            {/* Game Result */}
            <div>
              {(() => {
                const outcome = getGameOutcome(
                  activeGame,
                  settings?.playerUsernames?.chessCom || 'Sada012'
                );
                return (
                  <div className={`px-4 py-2 rounded-xl border flex items-center space-x-2 font-mono font-bold text-sm ${outcome.badgeClass}`}>
                    <span className="text-base">{activeGame.result}</span>
                    {outcome.isWin && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">VICTORY</span>}
                    {outcome.isLoss && <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">DEFEAT</span>}
                    {outcome.isDraw && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-300">DRAW</span>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Primary Coach Action Callout */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-accent/15 via-surface-elevated to-surface border border-accent/40 mb-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <GraduationCap size={20} className="text-accent" />
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Personal Opening Coach
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100">
                {activeAnalysis
                  ? mistakesCount > 0
                    ? `We found ${mistakesCount} opening mistake${mistakesCount > 1 ? 's' : ''} to review`
                    : 'Your opening play was accurate and solid!'
                  : 'Start opening-focused mistake review'}
              </h2>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                {activeAnalysis
                  ? mistakesCount > 0
                    ? `Learn where your opening diverged, guess the engine's recommended moves, and see how the continuation leads to a healthier, better position.`
                    : `No significant opening mistakes were detected up to ply ${openingBoundary.endPly}. You can inspect full-game accuracy or review move annotations.`
                  : 'Run Stockfish analysis to identify your opening inaccuracies and see how to reach a better position.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              {activeAnalysis ? (
                <>
                  <button
                    onClick={() => setAnalysisStage('opening_coach')}
                    className="px-6 py-3 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-sm transition shadow-lg flex items-center justify-center space-x-2"
                  >
                    <Target size={18} />
                    <span>Review Opening Mistakes</span>
                  </button>
                  <button
                    onClick={() => setAnalysisStage('full_game')}
                    className="px-5 py-3 bg-surface hover:bg-surface-border text-slate-200 font-semibold rounded-xl text-sm transition border border-surface-border flex items-center justify-center space-x-2"
                  >
                    <BarChart3 size={18} />
                    <span>Analyze Full Game</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startAnalysis(selectedDepth)}
                  disabled={isAnalyzing}
                  className="px-6 py-3 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-sm transition shadow-lg flex items-center justify-center space-x-2"
                >
                  <Sparkles size={18} />
                  <span>
                    {isAnalyzing
                      ? analysisLifecycle === 'finalizing'
                        ? 'Finalizing Game Review...'
                        : 'Analyzing with Stockfish...'
                      : 'Run Stockfish Review'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Accuracy and Performance Overview Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* White Player Card */}
            <div className="p-5 rounded-xl bg-surface border border-surface-border flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-white shadow" />
                  <span className="font-bold text-sm text-slate-200">{activeGame.white}</span>
                  {activeGame.whiteElo && (
                    <span className="text-xs text-slate-400 font-mono">
                      (Platform: {activeGame.whiteElo})
                    </span>
                  )}
                </div>
                <div className="flex items-baseline space-x-2 my-2">
                  <span className="text-3xl font-black font-mono text-emerald-400">
                    {Math.round(summary.accuracyWhite)}%
                  </span>
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    Game Accuracy
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-surface-border/60 flex items-center justify-between text-xs text-slate-400">
                <span>Game Rating:</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {summary.estimatedEloWhite || 1500}
                </span>
              </div>
            </div>

            {/* Black Player Card */}
            <div className="p-5 rounded-xl bg-surface border border-surface-border flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-600 shadow" />
                  <span className="font-bold text-sm text-slate-200">{activeGame.black}</span>
                  {activeGame.blackElo && (
                    <span className="text-xs text-slate-400 font-mono">
                      (Platform: {activeGame.blackElo})
                    </span>
                  )}
                </div>
                <div className="flex items-baseline space-x-2 my-2">
                  <span className="text-3xl font-black font-mono text-emerald-400">
                    {Math.round(summary.accuracyBlack)}%
                  </span>
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    Game Accuracy
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-surface-border/60 flex items-center justify-between text-xs text-slate-400">
                <span>Game Rating:</span>
                <span className="font-mono font-bold text-amber-300 text-sm">
                  {summary.estimatedEloBlack || 1500}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Coach Opening Boundary & Verdict */}
        {summary?.gameReviewVerdict && (
          <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border text-xs text-slate-300 flex items-start space-x-3">
            <Bot size={20} className="text-accent shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-accent block text-xs uppercase tracking-wider mb-1">
                Coach Verdict
              </span>
              <p className="leading-relaxed">{summary.gameReviewVerdict}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STAGE C: FULL-GAME REVIEW (with on-board move annotations, eval graph, and deep move table)
  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden bg-background">
      {/* Left / Center Column: Board, Eval, Navigation Controls */}
      <div className="flex-1 flex flex-col p-2 sm:p-4 lg:p-6 overflow-y-auto items-center">
        {/* Navigation & Header Bar */}
        <div className="w-full max-w-[560px] flex items-center justify-between mb-3 text-sm">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAnalysisStage('summary')}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-surface hover:bg-surface-border text-slate-300 border border-surface-border transition flex items-center space-x-1"
            >
              <span>← Summary</span>
            </button>
            <button
              onClick={() => setAnalysisStage('opening_coach')}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-accent/15 hover:bg-accent text-accent hover:text-black border border-accent/30 transition flex items-center space-x-1"
            >
              <Target size={13} />
              <span>Opening Coach</span>
            </button>
          </div>

          <button
            onClick={flipBoard}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-surface-elevated hover:bg-surface-border rounded-md border border-surface-border text-xs flex items-center space-x-1 transition"
            title="Flip board orientation (F)"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Flip</span>
          </button>
        </div>

        {/* Board & Eval Bar Container */}
        <div className="w-full max-w-[560px] flex gap-1.5 sm:gap-3 items-stretch justify-center px-0.5 sm:px-0">
          {/* Vertical Eval Bar */}
          <div className="w-5 sm:w-7 flex-shrink-0 flex items-stretch">
            <EvalBar
              score={evalScore}
              mate={evalMate}
              orientation={boardOrientation}
            />
          </div>

          {/* Interactive Chessboard */}
          <div className="flex-1 min-w-0 max-w-[490px] aspect-square flex items-center justify-center">
            <InteractiveChessboard
              fen={displayFen}
              boardOrientation={boardOrientation}
              allowMoves={!isAnalyzing}
              onMove={(move) => {
                const nextMove = gamePositions[currentPly + 1];
                if (nextMove && nextMove.san === move.san) {
                  setExploredFen(null);
                  setExploredSan(null);
                  nextPly();
                  return true;
                }
                setExploredFen(move.fen);
                setExploredSan(move.san);
                return true;
              }}
              arrows={customArrows}
              lastMove={
                currentPosData?.from && currentPosData?.to
                  ? { from: currentPosData.from, to: currentPosData.to }
                  : null
              }
              moveAnnotation={moveAnnotation}
              customSquareStyles={customSquareStyles}
              maxWidth="100%"
            />
          </div>
        </div>

        {/* Exploratory Variation Banner if off-book */}
        {exploredFen && (
          <div className="w-full max-w-[560px] mt-2.5 p-2.5 rounded-lg bg-surface-elevated border border-accent/40 flex items-center justify-between text-xs">
            <span className="text-slate-200">
              Exploring variation (<span className="text-accent font-mono font-bold">{exploredSan}</span>)
            </span>
            <button
              onClick={() => {
                setExploredFen(null);
                setExploredSan(null);
              }}
              className="px-3 py-1.5 min-h-[36px] text-xs bg-surface border border-surface-border hover:bg-surface-border text-slate-200 rounded-md font-semibold transition flex items-center space-x-1"
            >
              <span>Return to Game</span>
            </button>
          </div>
        )}

        {/* Move Navigation Bar */}
        <div className="w-full max-w-[560px] mt-4 flex items-center justify-between bg-surface-elevated border border-surface-border rounded-xl p-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={firstPly}
              disabled={isAnalyzing || currentPly === 0}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="First move (Up Arrow)"
            >
              <ChevronFirst size={20} />
            </button>
            <button
              onClick={prevPly}
              disabled={isAnalyzing || currentPly === 0}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="Previous move (Left Arrow)"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={isAnalyzing}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-accent hover:bg-accent/15 rounded-lg transition disabled:opacity-30"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              onClick={nextPly}
              disabled={isAnalyzing || currentPly >= gamePositions.length - 1}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="Next move (Right Arrow)"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={lastPly}
              disabled={isAnalyzing || currentPly >= gamePositions.length - 1}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="Last move (Down Arrow)"
            >
              <ChevronLast size={20} />
            </button>
          </div>

          {/* Engine Eval summary & depth */}
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            {currentAnalysisPos?.bestMoveSan && (
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                Best: {currentAnalysisPos.bestMoveSan}
              </span>
            )}
            <span>Ply {currentPly}</span>
          </div>
        </div>

        {/* Evaluation Sparkline Graph */}
        {activeAnalysis && (
          <div className="w-full max-w-[560px] mt-3">
            <EvalGraph
              positions={activeAnalysis.positions}
              currentPly={currentPly}
              onSelectPly={setCurrentPly}
            />
          </div>
        )}
      </div>

      {/* Right Column: Game Review, Move List & Coach Insights */}
      <div className="w-full lg:w-[440px] bg-surface border-t lg:border-t-0 lg:border-l border-surface-border flex flex-col h-auto lg:h-full">
        {/* Analysis Controls Header */}
        <div className="p-4 border-b border-surface-border bg-surface-muted">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Zap size={18} className="text-accent" />
              <h3 className="font-semibold text-slate-200 text-sm">Stockfish Engine</h3>
            </div>
            {/* Depth presets */}
            <div className="flex items-center space-x-1 text-xs">
              {[
                { label: 'Quick', depth: 10 },
                { label: 'Standard', depth: 14 },
                { label: 'Deep', depth: 18 },
              ].map((p) => (
                <button
                  key={p.depth}
                  onClick={() => setSelectedDepth(p.depth)}
                  disabled={isAnalyzing}
                  className={`px-2 py-1 rounded text-xs transition ${
                    selectedDepth === p.depth
                      ? 'bg-accent/20 text-accent font-semibold border border-accent/40'
                      : 'text-slate-400 hover:text-slate-200 bg-surface-elevated'
                  }`}
                >
                  {p.label} ({p.depth})
                </button>
              ))}
            </div>
          </div>

          {isAnalyzing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>
                  {analysisLifecycle === 'finalizing'
                    ? 'Finalizing Game Review report & saving...'
                    : analysisLifecycle === 'initializing'
                    ? 'Initializing engine...'
                    : `Analyzing move ${analysisProgress.current} of ${analysisProgress.total}...`}
                </span>
                <span className="font-mono text-accent">
                  {analysisProgress.total > 0
                    ? `${Math.min(100, Math.round((analysisProgress.current / analysisProgress.total) * 100))}%`
                    : '0%'}
                </span>
              </div>
              <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden border border-surface-border">
                <div
                  className="bg-accent h-full transition-all duration-300"
                  style={{
                    width: `${
                      analysisProgress.total > 0
                        ? Math.min(100, (analysisProgress.current / analysisProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <button
                onClick={stopAnalysis}
                className="w-full py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition"
              >
                Cancel Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {analysisLifecycle === 'failed' && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  <div className="flex items-center space-x-1.5 font-bold mb-1">
                    <AlertTriangle size={14} />
                    <span>Analysis Incomplete</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mb-2">
                    {analysisError || 'Engine evaluation stopped unexpectedly. You can safely retry.'}
                  </p>
                </div>
              )}
              <button
                onClick={() => startAnalysis(selectedDepth)}
                className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-black font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-2 shadow"
              >
                <Sparkles size={16} />
                <span>
                  {analysisLifecycle === 'failed'
                    ? 'Retry Game Review'
                    : activeAnalysis
                    ? 'Re-Analyze with Stockfish'
                    : 'Run Full Game Review'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs for Right Pane */}
        <div className="flex border-b border-surface-border bg-surface-elevated px-2 pt-2 gap-1 text-xs">
          <button
            onClick={() => setSidebarTab('review')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              sidebarTab === 'review'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <BarChart3 size={14} />
            <span>Game Review</span>
          </button>
          <button
            onClick={() => setSidebarTab('moves')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              sidebarTab === 'moves'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <ListOrdered size={14} />
            <span>Move List</span>
          </button>
          <button
            onClick={() => setSidebarTab('coach')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-semibold transition border-b-2 ${
              sidebarTab === 'coach'
                ? 'bg-surface text-accent border-accent'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Lightbulb size={14} />
            <span>Coach Lesson</span>
          </button>
        </div>

        {/* Tab 1: Game Review (Chess.com style) */}
        {sidebarTab === 'review' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isAnalyzing ? (
              <div className="p-4 bg-surface-elevated rounded-xl border border-surface-border space-y-4 shadow-sm">
                <div className="flex items-center space-x-2 text-accent font-semibold text-xs uppercase tracking-wider">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                  </span>
                  <span>Reviewing Game in Real-Time</span>
                </div>

                {currentPosData && currentPosData.ply > 0 ? (
                  <div className="p-3 bg-surface rounded-lg border border-surface-border flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Move Replaying on Board
                      </span>
                      <span className="text-base font-bold text-white font-mono">
                        {Math.ceil(currentPosData.ply / 2)}
                        {currentPosData.ply % 2 === 1 ? '.' : '...'} {currentPosData.san}
                      </span>
                    </div>
                    {currentAnalysisPos?.bestMoveSan && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Stockfish Recommends
                        </span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          {currentAnalysisPos.bestMoveSan}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-surface rounded-lg border border-surface-border text-center text-xs text-slate-400">
                    Evaluating initial board position...
                  </div>
                )}

                <div className="p-3 bg-surface rounded-lg border border-surface-border flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Live Engine Eval
                    </span>
                    <span className="font-mono font-bold text-slate-200">
                      {evalMate !== undefined
                        ? evalMate > 0
                          ? `+M${evalMate}`
                          : `-M${Math.abs(evalMate)}`
                        : `${evalScore >= 0 ? '+' : ''}${(evalScore / 100).toFixed(1)}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Engine Progress
                    </span>
                    <span className="font-mono font-bold text-accent">
                      {analysisProgress.current} / {analysisProgress.total} plies
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-surface-border text-slate-400 text-[11px] leading-relaxed flex items-start space-x-2">
                  <Sparkles size={14} className="text-accent flex-shrink-0 mt-0.5" />
                  <span>
                    The chessboard is actively stepping through each move while Stockfish calculates move accuracy, tags blunders, and produces your Chess.com-style Game Review.
                  </span>
                </div>
              </div>
            ) : !summary ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <BarChart3 size={28} className="mx-auto mb-2 text-slate-500" />
                <p className="font-semibold text-slate-300 mb-1">Game Review Not Yet Generated</p>
                <p className="mb-4 text-slate-500">
                  Click "Run Full Game Review" above to calculate accuracy %, performance Elo, and move breakdown.
                </p>
              </div>
            ) : (
              <>
                {/* Accuracy & Game Elo Header */}
                <div className="grid grid-cols-2 gap-3">
                  {/* White Card */}
                  <div className="bg-surface-elevated rounded-xl p-3 border border-surface-border flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-white inline-block shadow-sm" />
                      <span className="font-bold text-xs text-slate-200 truncate">
                        {activeGame.white}
                      </span>
                    </div>
                    <div className="my-2">
                      <span className="text-2xl font-black font-mono text-emerald-400">
                        {Math.round(summary.accuracyWhite)}%
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                        Accuracy
                      </span>
                    </div>
                    <div className="pt-2 border-t border-surface-border text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Game Rating:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {summary.estimatedEloWhite || 1500}
                      </span>
                    </div>
                  </div>

                  {/* Black Card */}
                  <div className="bg-surface-elevated rounded-xl p-3 border border-surface-border flex flex-col justify-between">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-600 inline-block shadow-sm" />
                      <span className="font-bold text-xs text-slate-200 truncate">
                        {activeGame.black}
                      </span>
                    </div>
                    <div className="my-2">
                      <span className="text-2xl font-black font-mono text-emerald-400">
                        {Math.round(summary.accuracyBlack)}%
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                        Accuracy
                      </span>
                    </div>
                    <div className="pt-2 border-t border-surface-border text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Game Rating:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {summary.estimatedEloBlack || 1500}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coach Verdict Banner */}
                {summary.gameReviewVerdict && (
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-xs text-slate-200 flex items-start space-x-2.5">
                    <Bot size={18} className="text-accent shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-accent block text-[11px] uppercase tracking-wider mb-0.5">
                        Coach Verdict
                      </span>
                      <p className="leading-relaxed text-xs">{summary.gameReviewVerdict}</p>
                    </div>
                  </div>
                )}

                {/* Move Breakdown Table (Chess.com Style) */}
                <div className="bg-surface-elevated rounded-xl border border-surface-border p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-surface-border">
                    <span className="w-8 text-center">White</span>
                    <span>Move Classification</span>
                    <span className="w-8 text-center">Black</span>
                  </div>

                  <div className="divide-y divide-surface-border/50 text-xs">
                    {(
                      [
                        'brilliant',
                        'great',
                        'best',
                        'excellent',
                        'good',
                        'book',
                        'inaccuracy',
                        'mistake',
                        'missedWin',
                        'blunder',
                      ] as MoveClassification[]
                    ).map((cls) => {
                      const badge = CLASSIFICATION_BADGES[cls];
                      const wCount = summary.whiteStats[cls] || 0;
                      const bCount = summary.blackStats[cls] || 0;

                      return (
                        <div key={cls} className="py-1.5 flex items-center justify-between">
                          {/* White Count */}
                          <span
                            className={`w-8 text-center font-mono font-bold text-xs ${
                              wCount > 0 ? badge.text : 'text-slate-600'
                            }`}
                          >
                            {wCount}
                          </span>

                          {/* Classification Badge Name */}
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`w-6 h-5 rounded flex items-center justify-center font-bold text-[10px] ${badge.bg} ${badge.text}`}
                            >
                              {badge.icon}
                            </span>
                            <span className="text-slate-300 font-medium text-xs">
                              {badge.label}
                            </span>
                          </div>

                          {/* Black Count */}
                          <span
                            className={`w-8 text-center font-mono font-bold text-xs ${
                              bCount > 0 ? badge.text : 'text-slate-600'
                            }`}
                          >
                            {bCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Centipawn Loss comparison */}
                <div className="bg-surface-elevated rounded-xl p-3 border border-surface-border flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      White Avg CPL
                    </span>
                    <span className="font-mono font-bold text-slate-200">
                      {summary.whiteCPL} centipawns
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Black Avg CPL
                    </span>
                    <span className="font-mono font-bold text-slate-200">
                      {summary.blackCPL} centipawns
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Move History */}
        {sidebarTab === 'moves' && (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
              Move History
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs font-mono">
              {Array.from({ length: Math.ceil((gamePositions.length - 1) / 2) }).map((_, moveIndex) => {
                const whitePly = moveIndex * 2 + 1;
                const blackPly = moveIndex * 2 + 2;
                const whiteData = gamePositions[whitePly];
                const blackData = gamePositions[blackPly];
                const whiteAnalysis = activeAnalysis?.positions[whitePly];
                const blackAnalysis = activeAnalysis?.positions[blackPly];

                return (
                  <React.Fragment key={moveIndex}>
                    {/* White move */}
                    <button
                      onClick={() => setCurrentPly(whitePly)}
                      className={`flex items-center justify-between p-1.5 rounded transition ${
                        currentPly === whitePly
                          ? 'bg-accent/20 text-accent font-bold border border-accent/40'
                          : 'text-slate-300 hover:bg-surface-elevated'
                      }`}
                    >
                      <span className="text-slate-500 w-6 text-left">{moveIndex + 1}.</span>
                      <span className="flex-1 text-left">{whiteData?.san}</span>
                      {whiteAnalysis?.classification && (
                        <span
                          className={`text-[10px] px-1 rounded font-bold ${
                            CLASSIFICATION_BADGES[whiteAnalysis.classification]?.text
                          }`}
                        >
                          {CLASSIFICATION_BADGES[whiteAnalysis.classification]?.icon}
                        </span>
                      )}
                    </button>

                    {/* Black move */}
                    {blackData ? (
                      <button
                        onClick={() => setCurrentPly(blackPly)}
                        className={`flex items-center justify-between p-1.5 rounded transition ${
                          currentPly === blackPly
                            ? 'bg-accent/20 text-accent font-bold border border-accent/40'
                            : 'text-slate-300 hover:bg-surface-elevated'
                        }`}
                      >
                        <span className="flex-1 text-left">{blackData.san}</span>
                        {blackAnalysis?.classification && (
                          <span
                            className={`text-[10px] px-1 rounded font-bold ${
                              CLASSIFICATION_BADGES[blackAnalysis.classification]?.text
                            }`}
                          >
                            {CLASSIFICATION_BADGES[blackAnalysis.classification]?.icon}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Coach Lesson (Current Move) */}
        {sidebarTab === 'coach' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentAnalysisPos?.explanation ? (
              <div className="p-4 rounded-xl border border-surface-border bg-surface-elevated space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lightbulb size={16} className="text-accent" />
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">
                      Coach Insight
                    </span>
                  </div>
                  {currentAnalysisPos.classification && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.bg || ''
                      } ${CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.text || ''}`}
                    >
                      {CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.label}
                    </span>
                  )}
                </div>

                {/* What you played vs Best move */}
                <div className="grid grid-cols-2 gap-2 my-2 text-xs">
                  <div className="bg-surface p-2 rounded border border-surface-border">
                    <span className="text-slate-400 text-[10px] block">Played</span>
                    <span className="font-mono font-bold text-slate-100">
                      {currentAnalysisPos.explanation.playedSan}
                    </span>
                    <span className="text-[10px] text-rose-400 block mt-0.5">
                      -{Math.round((currentAnalysisPos.explanation.evalDiff / 100) * 10) / 10} pawns
                    </span>
                  </div>
                  <div className="bg-surface p-2 rounded border border-surface-border">
                    <span className="text-slate-400 text-[10px] block">Engine Recommended</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {currentAnalysisPos.explanation.bestMoveSan}
                    </span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Optimal</span>
                  </div>
                </div>

                {/* Tactical consequence */}
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentAnalysisPos.explanation.consequence}
                </p>

                {/* Practical lesson */}
                <div className="p-2.5 rounded bg-surface border border-surface-border/60 text-xs text-slate-300">
                  <span className="text-accent font-semibold block text-[11px] mb-0.5">
                    Key Lesson:
                  </span>
                  {currentAnalysisPos.explanation.beginnerLesson}
                </div>

                {/* Practise button */}
                <button
                  onClick={() => setTab('training')}
                  className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-black rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow"
                >
                  <Bookmark size={14} />
                  <span>Practise in Training Studio</span>
                </button>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Lightbulb size={24} className="mx-auto mb-2 text-slate-500" />
                <p className="font-semibold text-slate-300 mb-1">No Mistakes Flagged on This Move</p>
                <p className="text-slate-500">
                  Navigate to an inaccuracy, mistake, or blunder to inspect tactical coach lessons.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
