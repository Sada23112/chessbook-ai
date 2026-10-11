import React, { useEffect, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
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
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { EvalBar } from '../common/EvalBar';
import { EvalGraph } from '../common/EvalGraph';
import type { MoveClassification } from '../../types/chess';

export const CLASSIFICATION_BADGES: Record<
  MoveClassification,
  { label: string; bg: string; text: string; icon: string }
> = {
  brilliant: { label: 'Brilliant', bg: 'bg-cyan-500/20 border-cyan-500/40', text: 'text-cyan-300', icon: '!!' },
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
    currentPly,
    boardOrientation,
    isAnalyzing,
    analysisProgress,
    setCurrentPly,
    nextPly,
    prevPly,
    firstPly,
    lastPly,
    flipBoard,
    startAnalysis,
    stopAnalysis,
    setTab,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState<number>(14);
  const [sidebarTab, setSidebarTab] = useState<'review' | 'moves' | 'coach'>('review');

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

  const currentPosData = gamePositions[currentPly] || gamePositions[0];
  const currentFen = currentPosData ? currentPosData.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Analysis position data
  const currentAnalysisPos = activeAnalysis?.positions[currentPly];
  const evalScore = currentAnalysisPos?.score ?? 0;
  const evalMate = currentAnalysisPos?.mate;

  // Best move arrow
  const customArrows = useMemo(() => {
    if (!currentAnalysisPos?.bestMove || currentAnalysisPos.bestMove.length < 4) return [];
    const startSquare = currentAnalysisPos.bestMove.slice(0, 2);
    const endSquare = currentAnalysisPos.bestMove.slice(2, 4);
    return [{ startSquare, endSquare, color: 'rgba(34, 197, 94, 0.75)' }];
  }, [currentAnalysisPos]);

  // Highlight squares for played move
  const customSquareStyles = useMemo(() => {
    if (!currentPosData?.from || !currentPosData?.to) return {};
    return {
      [currentPosData.from]: { backgroundColor: 'rgba(234, 179, 8, 0.35)' },
      [currentPosData.to]: { backgroundColor: 'rgba(234, 179, 8, 0.45)' },
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

  const summary = activeAnalysis?.summary;

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden bg-background">
      {/* Left / Center Column: Board, Eval, Navigation Controls */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto items-center">
        {/* Game Title & Header */}
        <div className="w-full max-w-[560px] flex items-center justify-between mb-3 text-sm">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-bold text-slate-200 truncate">{activeGame.white}</span>
            <span className="text-slate-500 font-mono text-xs">vs</span>
            <span className="font-bold text-slate-200 truncate">{activeGame.black}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated font-mono text-slate-400 border border-surface-border">
              {activeGame.result}
            </span>
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
        <div className="w-full max-w-[560px] flex gap-3 items-stretch justify-center">
          {/* Vertical Eval Bar */}
          <EvalBar
            score={evalScore}
            mate={evalMate}
            orientation={boardOrientation}
          />

          {/* Interactive Chessboard */}
          <div className="w-[340px] sm:w-[480px] md:w-[500px] aspect-square rounded-xl overflow-hidden shadow-2xl border border-surface-border bg-surface-elevated">
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation: boardOrientation,
                allowDragging: false,
                arrows: customArrows,
                squareStyles: customSquareStyles,
                darkSquareStyle: { backgroundColor: '#2e3a44' },
                lightSquareStyle: { backgroundColor: '#5c6d7c' },
                boardStyle: {
                  borderRadius: '8px',
                  boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
                },
              }}
            />
          </div>
        </div>

        {/* Move Navigation Bar */}
        <div className="w-full max-w-[560px] mt-4 flex items-center justify-between bg-surface-elevated border border-surface-border rounded-xl p-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={firstPly}
              disabled={currentPly === 0}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="First move (Up Arrow)"
            >
              <ChevronFirst size={18} />
            </button>
            <button
              onClick={prevPly}
              disabled={currentPly === 0}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="Previous move (Left Arrow)"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 text-accent hover:bg-accent/15 rounded-lg transition"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={nextPly}
              disabled={currentPly >= gamePositions.length - 1}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="Next move (Right Arrow)"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={lastPly}
              disabled={currentPly >= gamePositions.length - 1}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 hover:bg-surface-border rounded-lg transition"
              title="Last move (Down Arrow)"
            >
              <ChevronLast size={18} />
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

      {/* Right Column: Game Review, Coach Insights & Move List */}
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
                <span>Analyzing move {analysisProgress.current} of {analysisProgress.total}...</span>
                <span className="font-mono text-accent">
                  {analysisProgress.total > 0
                    ? `${Math.round((analysisProgress.current / analysisProgress.total) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden border border-surface-border">
                <div
                  className="bg-accent h-full transition-all duration-300"
                  style={{
                    width: `${
                      analysisProgress.total > 0
                        ? (analysisProgress.current / analysisProgress.total) * 100
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
            <button
              onClick={() => startAnalysis(selectedDepth)}
              className="w-full py-2 px-3 bg-accent hover:bg-accent-hover text-black font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-2 shadow"
            >
              <Sparkles size={16} />
              <span>{activeAnalysis ? 'Re-Analyze with Stockfish' : 'Run Full Game Review'}</span>
            </button>
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
            {!summary ? (
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
                        {summary.accuracyWhite}%
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                        Accuracy
                      </span>
                    </div>
                    <div className="pt-2 border-t border-surface-border text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Game Elo:</span>
                      <span className="font-mono font-bold text-amber-300">
                        ~{summary.estimatedEloWhite || 1500}
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
                        {summary.accuracyBlack}%
                      </span>
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                        Accuracy
                      </span>
                    </div>
                    <div className="pt-2 border-t border-surface-border text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">Game Elo:</span>
                      <span className="font-mono font-bold text-amber-300">
                        ~{summary.estimatedEloBlack || 1500}
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
