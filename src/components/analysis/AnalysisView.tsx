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
import { chessAudio } from '../../utils/chessAudio';

function getCapturedPiecesAndMaterial(fen: string) {
  const pieces = fen.split(' ')[0] || '';
  const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentWhite = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const currentBlack = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  for (const char of pieces) {
    const lower = char.toLowerCase() as keyof typeof initial;
    if (initial[lower] !== undefined) {
      if (char === char.toUpperCase()) {
        currentWhite[lower]++;
      } else {
        currentBlack[lower]++;
      }
    }
  }

  const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let whiteMaterial = 0;
  let blackMaterial = 0;

  const blackCapturedByWhite: Array<{ type: string; symbol: string; count: number }> = [];
  const whiteCapturedByBlack: Array<{ type: string; symbol: string; count: number }> = [];

  const symbols: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

  (['q', 'r', 'b', 'n', 'p'] as const).forEach((t) => {
    const wCap = Math.max(0, initial[t] - currentBlack[t]);
    if (wCap > 0) blackCapturedByWhite.push({ type: t, symbol: symbols[t], count: wCap });

    const bCap = Math.max(0, initial[t] - currentWhite[t]);
    if (bCap > 0) whiteCapturedByBlack.push({ type: t, symbol: symbols[t], count: bCap });

    whiteMaterial += currentWhite[t] * pieceValues[t];
    blackMaterial += currentBlack[t] * pieceValues[t];
  });

  const whiteDiff = whiteMaterial - blackMaterial;
  const blackDiff = blackMaterial - whiteMaterial;

  return {
    whiteAdvantage: whiteDiff > 0 ? `+${whiteDiff}` : null,
    blackAdvantage: blackDiff > 0 ? `+${blackDiff}` : null,
    blackCapturedByWhite,
    whiteCapturedByBlack,
  };
}

export const CLASSIFICATION_BADGES: Record<
  MoveClassification,
  { label: string; bg: string; text: string; icon: string; hex: string }
> = {
  brilliant: { label: 'Brilliant', bg: 'bg-[#1baca6]/20 border-[#1baca6]', text: 'text-[#1baca6]', icon: '!!', hex: '#1baca6' },
  great: { label: 'Great', bg: 'bg-[#5c8bb0]/20 border-[#5c8bb0]', text: 'text-[#5c8bb0]', icon: '!', hex: '#5c8bb0' },
  best: { label: 'Best', bg: 'bg-[#81b64c]/20 border-[#81b64c]', text: 'text-[#81b64c]', icon: '★', hex: '#81b64c' },
  excellent: { label: 'Excellent', bg: 'bg-[#81b64c]/15 border-[#81b64c]/50', text: 'text-[#95c95d]', icon: '✓', hex: '#81b64c' },
  good: { label: 'Good', bg: 'bg-[#96bc4b]/15 border-[#96bc4b]/40', text: 'text-[#96bc4b]', icon: '•', hex: '#96bc4b' },
  inaccuracy: { label: 'Inaccuracy', bg: 'bg-[#f0c15c]/20 border-[#f0c15c]', text: 'text-[#f0c15c]', icon: '?!', hex: '#f0c15c' },
  mistake: { label: 'Mistake', bg: 'bg-[#e58f2a]/20 border-[#e58f2a]', text: 'text-[#e58f2a]', icon: '?', hex: '#e58f2a' },
  blunder: { label: 'Blunder', bg: 'bg-[#ca3431]/20 border-[#ca3431]', text: 'text-[#ca3431]', icon: '??', hex: '#ca3431' },
  missedWin: { label: 'Missed Win', bg: 'bg-[#db4542]/20 border-[#db4542]', text: 'text-[#db4542]', icon: '⚡', hex: '#db4542' },
  forced: { label: 'Forced', bg: 'bg-[#96bc4b]/15 border-[#96bc4b]', text: 'text-[#96bc4b]', icon: '□', hex: '#96bc4b' },
  book: { label: 'Book', bg: 'bg-[#d5a47d]/20 border-[#d5a47d]', text: 'text-[#d5a47d]', icon: '📖', hex: '#d5a47d' },
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
  const [sidebarTab, setSidebarTab] = useState<'review' | 'moves' | 'coach' | 'graph'>('coach');
  const [repertoires, setRepertoires] = useState<OpeningRepertoire[]>([]);

  useEffect(() => {
    if (isAnalyzing) {
      setSidebarTab('review');
    }
  }, [isAnalyzing]);

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

  // Play authentic Chess.com move sounds on navigation
  const prevPlyRef = React.useRef(currentPly);
  useEffect(() => {
    if (prevPlyRef.current !== currentPly && currentPly > 0) {
      const pos = gamePositions[currentPly];
      if (pos?.san) {
        if (pos.san.includes('x')) {
          chessAudio.playCapture();
        } else if (pos.san.includes('O-O')) {
          chessAudio.playCastle();
        } else if (pos.san.includes('+') || pos.san.includes('#')) {
          chessAudio.playCheck();
        } else {
          chessAudio.playMove();
        }
      }
    }
    prevPlyRef.current = currentPly;
  }, [currentPly, gamePositions]);

  // Audio trigger when review completes
  useEffect(() => {
    if (analysisLifecycle === 'completed') {
      chessAudio.playReviewComplete();
    }
  }, [analysisLifecycle]);

  const currentPosData = gamePositions[currentPly] || gamePositions[0];
  const currentFen = currentPosData ? currentPosData.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const displayFen = exploredFen || currentFen;

  const materialData = useMemo(() => {
    return getCapturedPiecesAndMaterial(displayFen);
  }, [displayFen]);

  const isOrientationWhite = boardOrientation === 'white';
  const topPlayerName = isOrientationWhite ? (activeGame?.black || 'Black') : (activeGame?.white || 'White');
  const topPlayerElo = isOrientationWhite ? (activeGame?.blackElo || 1500) : (activeGame?.whiteElo || 1500);
  const topCapturedPieces = isOrientationWhite ? materialData.whiteCapturedByBlack : materialData.blackCapturedByWhite;
  const topMaterialAdvantage = isOrientationWhite ? materialData.blackAdvantage : materialData.whiteAdvantage;

  const bottomPlayerName = isOrientationWhite ? (activeGame?.white || 'White') : (activeGame?.black || 'Black');
  const bottomPlayerElo = isOrientationWhite ? (activeGame?.whiteElo || 1500) : (activeGame?.blackElo || 1500);
  const bottomCapturedPieces = isOrientationWhite ? materialData.blackCapturedByWhite : materialData.whiteCapturedByBlack;
  const bottomMaterialAdvantage = isOrientationWhite ? materialData.whiteAdvantage : materialData.blackAdvantage;

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
        <div className="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center text-2xl mb-5 text-slate-500">
          ♟
        </div>
        <h2 className="text-lg font-semibold text-slate-200 mb-2">No game selected</h2>
        <p className="text-slate-500 text-sm max-w-sm mb-7 leading-relaxed">
          Pick a game from your library to explore move evaluations, Stockfish analysis, and opening coaching.
        </p>
        <button
          onClick={() => setTab('my-games')}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl shadow transition flex items-center gap-2"
        >
          <Layers size={16} />
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
    const outcome = getGameOutcome(activeGame, settings?.playerUsernames?.chessCom || 'Sada012');

    return (
      <div className="flex-1 flex flex-col overflow-y-auto bg-background pb-24 md:pb-0">
        <div className="max-w-3xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">

          {/* Game header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-600 font-mono">{activeGame.date}</span>
                {activeGame.eco && (
                  <span className="px-1.5 py-0.5 rounded-md bg-surface-elevated text-xs font-mono text-slate-400">
                    {activeGame.eco}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-semibold text-slate-100">
                {activeGame.white}
                <span className="text-slate-600 text-base font-normal mx-2">vs</span>
                {activeGame.black}
              </h1>
              {activeGame.opening && (
                <p className="text-sm text-slate-500 mt-1 truncate max-w-sm">{activeGame.opening}</p>
              )}
            </div>

            <div className={`px-3.5 py-2 rounded-xl text-sm font-semibold font-mono shrink-0 ${outcome.badgeClass}`}>
              {activeGame.result}
              {outcome.isWin && <span className="ml-2 text-xs opacity-80">Victory</span>}
              {outcome.isLoss && <span className="ml-2 text-xs opacity-80">Defeat</span>}
              {outcome.isDraw && <span className="ml-2 text-xs opacity-80">Draw</span>}
            </div>
          </div>

          {/* Opening review action */}
          <div className="bg-surface rounded-2xl p-5 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-medium text-slate-200 text-sm mb-1">
                  {activeAnalysis
                    ? mistakesCount > 0
                      ? `${mistakesCount} opening mistake${mistakesCount > 1 ? 's' : ''} to review`
                      : 'Opening looked solid'
                    : 'Opening review'}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                  {activeAnalysis
                    ? mistakesCount > 0
                      ? `See where your opening diverged and practice the correct continuations.`
                      : `No significant mistakes up to move ${Math.ceil(openingBoundary.endPly / 2)}. Check full-game stats below.`
                    : 'Run analysis to see opening mistakes and overall accuracy.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {activeAnalysis ? (
                  <>
                    <button
                      onClick={() => setAnalysisStage('opening_coach')}
                      className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-sm transition flex items-center gap-2"
                    >
                      <Target size={15} />
                      Review openings
                    </button>
                    <button
                      onClick={() => setAnalysisStage('full_game')}
                      className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-300 font-medium rounded-xl text-sm transition flex items-center gap-2"
                    >
                      <BarChart3 size={15} />
                      Full game
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startAnalysis(selectedDepth)}
                    disabled={isAnalyzing}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-sm transition flex items-center gap-2 disabled:opacity-60"
                  >
                    <Sparkles size={15} />
                    {isAnalyzing
                      ? analysisLifecycle === 'finalizing'
                        ? 'Finalizing…'
                        : 'Analyzing…'
                      : 'Analyze game'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Accuracy cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {/* White */}
              <div className="bg-surface rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-100 shadow-sm shrink-0" />
                  <span className="font-medium text-sm text-slate-300">{activeGame.white}</span>
                  {activeGame.whiteElo && (
                    <span className="text-xs text-slate-600 font-mono ml-auto">{activeGame.whiteElo}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-emerald-400">
                    {Math.round(summary.accuracyWhite)}%
                  </span>
                  <span className="text-xs text-slate-500">accuracy</span>
                </div>
                <div className="mt-3 pt-3 border-t border-surface-elevated flex items-center justify-between">
                  <span className="text-xs text-slate-600">Game rating</span>
                  <span className="font-mono font-semibold text-amber-300 text-sm">
                    {summary.estimatedEloWhite || 1500}
                  </span>
                </div>
              </div>

              {/* Black */}
              <div className="bg-surface rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-600 shadow-sm shrink-0" />
                  <span className="font-medium text-sm text-slate-300">{activeGame.black}</span>
                  {activeGame.blackElo && (
                    <span className="text-xs text-slate-600 font-mono ml-auto">{activeGame.blackElo}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-emerald-400">
                    {Math.round(summary.accuracyBlack)}%
                  </span>
                  <span className="text-xs text-slate-500">accuracy</span>
                </div>
                <div className="mt-3 pt-3 border-t border-surface-elevated flex items-center justify-between">
                  <span className="text-xs text-slate-600">Game rating</span>
                  <span className="font-mono font-semibold text-amber-300 text-sm">
                    {summary.estimatedEloBlack || 1500}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Coach verdict */}
          {summary?.gameReviewVerdict && (
            <div className="bg-surface rounded-2xl p-4 flex items-start gap-3">
              <Bot size={16} className="text-accent shrink-0 mt-0.5" />
              <p className="text-sm text-slate-400 leading-relaxed">{summary.gameReviewVerdict}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // TAB RENDERERS
  const renderReviewTab = () => (
    <div className="space-y-3">
      {isAnalyzing ? (
        <div className="p-3.5 bg-surface-elevated rounded-xl border border-surface-border space-y-3 shadow-sm">
          <div className="flex items-center space-x-2 text-accent font-semibold text-xs uppercase tracking-wider">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
            </span>
            <span>Reviewing Game in Real-Time</span>
          </div>

          {currentPosData && currentPosData.ply > 0 ? (
            <div className="p-2.5 bg-surface rounded-lg border border-surface-border flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Move Replaying on Board
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {Math.ceil(currentPosData.ply / 2)}
                  {currentPosData.ply % 2 === 1 ? '.' : '...'} {currentPosData.san}
                </span>
              </div>
              {currentAnalysisPos?.bestMoveSan && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Stockfish Recommends
                  </span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {currentAnalysisPos.bestMoveSan}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-surface rounded-lg border border-surface-border text-center text-xs text-slate-400">
              Evaluating initial board position...
            </div>
          )}

          <div className="p-2.5 bg-surface rounded-lg border border-surface-border flex items-center justify-between text-xs">
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

          <div className="w-full bg-surface h-2 rounded-full overflow-hidden border border-surface-border">
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
      ) : !summary ? (
        <div className="p-6 text-center text-slate-400 text-xs bg-surface-elevated rounded-xl border border-surface-border">
          <BarChart3 size={28} className="mx-auto mb-2 text-slate-500" />
          <p className="font-semibold text-slate-300 mb-1">Game Review Not Yet Generated</p>
          <p className="mb-4 text-slate-400">
            Click below to calculate accuracy %, performance rating, and move classification.
          </p>
          <div className="flex items-center justify-center space-x-1.5 mb-3">
            {[
              { label: 'Quick', depth: 10 },
              { label: 'Standard', depth: 14 },
              { label: 'Deep', depth: 18 },
            ].map((p) => (
              <button
                key={p.depth}
                onClick={() => setSelectedDepth(p.depth)}
                className={`px-2.5 py-1 rounded text-xs transition ${
                  selectedDepth === p.depth
                    ? 'bg-accent/20 text-accent font-semibold border border-accent/40'
                    : 'text-slate-400 hover:text-slate-200 bg-surface'
                }`}
              >
                {p.label} ({p.depth})
              </button>
            ))}
          </div>
          <button
            onClick={() => startAnalysis(selectedDepth)}
            className="w-full py-2.5 px-3 bg-accent hover:bg-accent-hover text-black font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-2 shadow"
          >
            <Sparkles size={16} />
            <span>Run Full Game Review</span>
          </button>
        </div>
      ) : (
        <>
          {/* Accuracy & Game Rating Header */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* White Card */}
            <div className="bg-[#262421] rounded-[6px] p-3 border border-[#383531] flex flex-col justify-between">
              <div className="flex items-center space-x-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-white inline-block shadow-sm" />
                <span className="font-bold text-xs text-white truncate">
                  {activeGame.white}
                </span>
              </div>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-sans text-[#81b64c]">
                  {Math.round(summary.accuracyWhite)}%
                </span>
                <span className="text-[10px] text-[#989795] uppercase tracking-wider font-bold">
                  Accuracy
                </span>
              </div>
              <div className="pt-2 border-t border-[#383531] text-[11px] text-[#c3c2bf] flex items-center justify-between">
                <span className="text-[#989795]">Game Rating:</span>
                <span className="font-bold text-[#e58f2a]">
                  {summary.estimatedEloWhite || 1500}
                </span>
              </div>
            </div>

            {/* Black Card */}
            <div className="bg-[#262421] rounded-[6px] p-3 border border-[#383531] flex flex-col justify-between">
              <div className="flex items-center space-x-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#181715] border border-[#524e47] inline-block shadow-sm" />
                <span className="font-bold text-xs text-white truncate">
                  {activeGame.black}
                </span>
              </div>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-black font-sans text-[#81b64c]">
                  {Math.round(summary.accuracyBlack)}%
                </span>
                <span className="text-[10px] text-[#989795] uppercase tracking-wider font-bold">
                  Accuracy
                </span>
              </div>
              <div className="pt-2 border-t border-[#383531] text-[11px] text-[#c3c2bf] flex items-center justify-between">
                <span className="text-[#989795]">Game Rating:</span>
                <span className="font-bold text-[#e58f2a]">
                  {summary.estimatedEloBlack || 1500}
                </span>
              </div>
            </div>
          </div>

          {/* Coach Verdict Banner */}
          {summary.gameReviewVerdict && (
            <div className="p-3 rounded-[6px] bg-[#262421] border border-[#383531] text-xs text-[#c3c2bf] flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-[4px] bg-[#81b64c] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                <GraduationCap size={18} />
              </div>
              <div>
                <span className="font-bold text-[#81b64c] block text-[11px] uppercase tracking-wider mb-0.5">
                  Coach Verdict
                </span>
                <p className="leading-relaxed text-xs">{summary.gameReviewVerdict}</p>
              </div>
            </div>
          )}

          {/* Move Breakdown Table (Chess.com Style) */}
          <div className="bg-[#262421] rounded-[6px] border border-[#383531] p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#989795] uppercase tracking-wider pb-2 border-b border-[#383531]">
              <span className="w-8 text-center">White</span>
              <span>Classification (click to jump)</span>
              <span className="w-8 text-center">Black</span>
            </div>

            <div className="divide-y divide-[#383531]/50 text-xs mt-1">
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
                const hasMoves = wCount > 0 || bCount > 0;

                return (
                  <button
                    key={cls}
                    onClick={() => {
                      if (!activeAnalysis) return;
                      const matchPlies = activeAnalysis.positions
                        .filter((p) => p.classification === cls && p.ply > 0)
                        .map((p) => p.ply);
                      if (matchPlies.length === 0) return;
                      const nextMatch = matchPlies.find((ply) => ply > currentPly);
                      setCurrentPly(nextMatch !== undefined ? nextMatch : matchPlies[0]);
                    }}
                    disabled={!hasMoves}
                    className={`w-full py-1.5 px-1 flex items-center justify-between rounded transition text-left ${
                      hasMoves
                        ? 'hover:bg-[#383531] cursor-pointer'
                        : 'opacity-40 cursor-default'
                    }`}
                    title={hasMoves ? `Jump to ${badge.label} moves` : undefined}
                  >
                    <span
                      className={`w-8 text-center font-mono font-bold text-xs ${
                        wCount > 0 ? badge.text : 'text-[#6b6967]'
                      }`}
                    >
                      {wCount}
                    </span>

                    <div className="flex items-center space-x-2">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white shadow-sm shrink-0"
                        style={{ backgroundColor: badge.hex }}
                      >
                        {badge.icon}
                      </span>
                      <span className="text-[#e2e1de] font-bold text-xs">
                        {badge.label}
                      </span>
                    </div>

                    <span
                      className={`w-8 text-center font-mono font-bold text-xs ${
                        bCount > 0 ? badge.text : 'text-[#6b6967]'
                      }`}
                    >
                      {bCount}
                    </span>
                  </button>
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

          {/* Depth selector & Re-run in pane */}
          <div className="p-3 bg-surface-elevated rounded-xl border border-surface-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Analysis Depth:</span>
              <div className="flex items-center space-x-1">
                {[
                  { label: 'Quick', depth: 10 },
                  { label: 'Standard', depth: 14 },
                  { label: 'Deep', depth: 18 },
                ].map((p) => (
                  <button
                    key={p.depth}
                    onClick={() => setSelectedDepth(p.depth)}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      selectedDepth === p.depth
                        ? 'bg-accent/20 text-accent font-semibold border border-accent/40'
                        : 'text-slate-400 hover:text-slate-200 bg-surface'
                    }`}
                  >
                    {p.depth}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => startAnalysis(selectedDepth)}
              className="w-full py-2 bg-surface hover:bg-surface-border border border-surface-border text-slate-200 font-semibold text-xs rounded-lg transition flex items-center justify-center space-x-2"
            >
              <Sparkles size={14} className="text-accent" />
              <span>Re-Analyze with Depth {selectedDepth}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderMovesTab = () => (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
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
                <span className="text-slate-500 w-5 text-left">{moveIndex + 1}.</span>
                <span className="flex-1 text-left">{whiteData?.san}</span>
                {whiteAnalysis?.classification && (
                  <span
                    className={`text-[10px] px-1 rounded font-bold ${
                      CLASSIFICATION_BADGES[whiteAnalysis.classification]?.text || ''
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
                        CLASSIFICATION_BADGES[blackAnalysis.classification]?.text || ''
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
  );

  const renderCoachTab = () => (
    <div className="space-y-3">
      {currentAnalysisPos?.explanation ? (
        <div className="p-3.5 rounded-xl border border-surface-border bg-surface-elevated space-y-3">
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
        <div className="p-6 text-center text-slate-400 text-xs bg-surface-elevated rounded-xl border border-surface-border">
          <Lightbulb size={24} className="mx-auto mb-2 text-slate-500" />
          <p className="font-semibold text-slate-300 mb-1">
            {currentPosData && currentPosData.ply > 0
              ? `Move ${Math.ceil(currentPosData.ply / 2)}${
                  currentPosData.ply % 2 === 1 ? '.' : '...'
                } ${currentPosData.san} is sound!`
              : 'Initial Board Position'}
          </p>
          <p className="text-slate-400 text-[11px] max-w-xs mx-auto">
            {currentAnalysisPos?.bestMoveSan
              ? `Stockfish rates this move well. Engine top recommendation: ${currentAnalysisPos.bestMoveSan}.`
              : 'Step through moves using the controls below to inspect coach feedback on inaccuracies or blunders.'}
          </p>
        </div>
      )}
    </div>
  );

  const renderGraphTab = () => (
    <div className="space-y-3">
      {activeAnalysis ? (
        <div className="p-3 bg-surface-elevated rounded-xl border border-surface-border space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1">
            <span>Evaluation Swing Flow</span>
            <span className="text-accent font-mono">Ply {currentPly}</span>
          </div>
          <EvalGraph
            positions={activeAnalysis.positions}
            currentPly={currentPly}
            onSelectPly={setCurrentPly}
          />
          <p className="text-[11px] text-slate-400 mt-2">
            Tap anywhere along the curve to jump directly to that point in the game. Blunders are marked with red dots.
          </p>
        </div>
      ) : (
        <div className="p-6 text-center text-slate-400 text-xs bg-surface-elevated rounded-xl border border-surface-border">
          <TrendingUp size={24} className="mx-auto mb-2 text-slate-500" />
          <p className="font-semibold text-slate-300 mb-1">No Evaluation Data Yet</p>
          <p className="text-slate-400">
            Run a full Game Review to chart evaluation swings move-by-move.
          </p>
        </div>
      )}
    </div>
  );

  // STAGE C: FULL-GAME REVIEW (Responsive Desktop + Mobile Experience)
  return (
    <>
      {/* DESKTOP LAYOUT (visible on lg and larger) */}
      <div className="hidden lg:flex flex-1 flex-row h-full overflow-hidden bg-background">
        {/* Left Column: Board, EvalBar, Nav Controls, EvalGraph */}
        <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto items-center">
          {/* Chess.com Action Header */}
          <div className="w-full max-w-[540px] flex items-center justify-between mb-2.5 text-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAnalysisStage('summary')}
                className="chess-btn-secondary text-xs px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
              >
                <ChevronLeft size={13} />
                <span>Summary</span>
              </button>
              <button
                onClick={() => setAnalysisStage('opening_coach')}
                className="chess-btn-primary text-xs px-3 py-1.5 rounded-[6px] flex items-center gap-1.5"
              >
                <Target size={13} />
                <span>Coach</span>
              </button>
            </div>

            <button
              onClick={flipBoard}
              className="chess-btn-secondary px-2.5 py-1.5 rounded-[6px] text-xs flex items-center gap-1.5"
              title="Flip board orientation (F)"
            >
              <RotateCcw size={13} />
              <span>Flip</span>
            </button>
          </div>

          {/* Board Area Framed with Chess.com Player Cards */}
          <div className="w-full max-w-[540px] flex flex-col items-center">
            {/* Top Opponent Card */}
            <div className="w-full flex items-center justify-between py-1.5 px-3 bg-[#262421] rounded-t-[6px] border border-[#3d3a34]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-[4px] bg-[#383531] border border-[#4a463f] flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {topPlayerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-white truncate max-w-[140px]">
                    {topPlayerName}
                  </span>
                  <span className="text-[11px] font-semibold text-[#989795] font-mono">
                    ({topPlayerElo})
                  </span>
                </div>
                {/* Captured pieces rack */}
                <div className="flex items-center gap-0.5 ml-2 text-xs text-[#b8b6b4]">
                  {topCapturedPieces.map((p, i) => (
                    <span key={i} className="inline-flex items-center">
                      {Array.from({ length: p.count }).map((_, idx) => (
                        <span key={idx} className="text-[13px] -mr-1">{p.symbol}</span>
                      ))}
                    </span>
                  ))}
                  {topMaterialAdvantage && (
                    <span className="text-[11px] font-black text-[#81b64c] ml-1.5 font-mono">
                      {topMaterialAdvantage}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {currentAnalysisPos && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#312e2b] text-[#989795]">
                    d:{currentAnalysisPos.depth}
                  </span>
                )}
              </div>
            </div>

            {/* Board & Eval Bar Container */}
            <div className="w-full flex gap-2.5 items-stretch justify-center my-1">
              <div className="w-6 shrink-0 flex items-stretch">
                <EvalBar
                  score={evalScore}
                  mate={evalMate}
                  orientation={boardOrientation}
                  className="w-6"
                />
              </div>

              <div className="flex-1 min-w-0 max-w-[490px] aspect-square flex items-center justify-center">
                <InteractiveChessboard
                  id="analysis-board-desktop"
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

            {/* Bottom User Card */}
            <div className="w-full flex items-center justify-between py-1.5 px-3 bg-[#262421] rounded-b-[6px] border border-[#3d3a34]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-[4px] bg-[#81b64c] flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm">
                  {bottomPlayerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-white truncate max-w-[140px]">
                    {bottomPlayerName}
                  </span>
                  <span className="text-[11px] font-semibold text-[#989795] font-mono">
                    ({bottomPlayerElo})
                  </span>
                </div>
                {/* Captured pieces rack */}
                <div className="flex items-center gap-0.5 ml-2 text-xs text-[#b8b6b4]">
                  {bottomCapturedPieces.map((p, i) => (
                    <span key={i} className="inline-flex items-center">
                      {Array.from({ length: p.count }).map((_, idx) => (
                        <span key={idx} className="text-[13px] -mr-1">{p.symbol}</span>
                      ))}
                    </span>
                  ))}
                  {bottomMaterialAdvantage && (
                    <span className="text-[11px] font-black text-[#81b64c] ml-1.5 font-mono">
                      {bottomMaterialAdvantage}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#81b64c]" title="You" />
              </div>
            </div>
          </div>

          {/* Exploratory Variation Banner if off-book */}
          {exploredFen && (
            <div className="w-full max-w-[540px] mt-2.5 p-2.5 rounded-[6px] bg-[#262421] border border-[#81b64c]/50 flex items-center justify-between text-xs">
              <span className="text-white">
                Exploring variation (<span className="text-[#81b64c] font-mono font-bold">{exploredSan}</span>)
              </span>
              <button
                onClick={() => {
                  setExploredFen(null);
                  setExploredSan(null);
                }}
                className="chess-btn-secondary px-3 py-1 text-xs rounded-[4px]"
              >
                <span>Return to Game</span>
              </button>
            </div>
          )}

          {/* Chess.com Desktop Navigation Bar */}
          <div className="w-full max-w-[540px] mt-2.5 flex items-center justify-between bg-[#262421] border border-[#3d3a34] rounded-[6px] p-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={firstPly}
                disabled={isAnalyzing || currentPly === 0}
                className="p-2 text-[#c3c2bf] hover:text-white disabled:opacity-30 hover:bg-[#383531] rounded transition"
                title="First move (Up Arrow)"
              >
                <ChevronFirst size={20} />
              </button>
              <button
                onClick={prevPly}
                disabled={isAnalyzing || currentPly === 0}
                className="p-2 text-[#c3c2bf] hover:text-white disabled:opacity-30 hover:bg-[#383531] rounded transition"
                title="Previous move (Left Arrow)"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={isAnalyzing}
                className="p-2 text-[#81b64c] hover:bg-[#81b64c]/20 rounded transition disabled:opacity-30"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={nextPly}
                disabled={isAnalyzing || currentPly >= gamePositions.length - 1}
                className="p-2 text-[#c3c2bf] hover:text-white disabled:opacity-30 hover:bg-[#383531] rounded transition"
                title="Next move (Right Arrow)"
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={lastPly}
                disabled={isAnalyzing || currentPly >= gamePositions.length - 1}
                className="p-2 text-[#c3c2bf] hover:text-white disabled:opacity-30 hover:bg-[#383531] rounded transition"
                title="Last move (Down Arrow)"
              >
                <ChevronLast size={20} />
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              {currentPosData && currentPosData.ply > 0 ? (
                <div className="flex items-center space-x-1 font-bold text-slate-200">
                  <span>
                    {Math.ceil(currentPosData.ply / 2)}
                    {currentPosData.ply % 2 === 1 ? '.' : '...'} {currentPosData.san}
                  </span>
                  {currentAnalysisPos?.classification && (
                    <span
                      className={`text-[10px] px-1 rounded font-bold ${
                        CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.text || ''
                      }`}
                    >
                      {CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.icon}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400">Start</span>
              )}

              {currentAnalysisPos?.bestMoveSan && (
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  Best: {currentAnalysisPos.bestMoveSan}
                </span>
              )}
            </div>
          </div>

          {/* Desktop EvalGraph */}
          {activeAnalysis && (
            <div className="w-full max-w-[540px] mt-3">
              <EvalGraph
                positions={activeAnalysis.positions}
                currentPly={currentPly}
                onSelectPly={setCurrentPly}
              />
            </div>
          )}
        </div>

        {/* Right Column: Engine header, Tabs, Tab Content */}
        <div className="w-[420px] bg-[#262421] border-l border-[#383531] flex flex-col h-full select-none">
          {/* Analysis Controls Header */}
          <div className="px-4 py-3 border-b border-[#383531] bg-[#21201d]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-[#81b64c]" />
                <h3 className="font-bold text-white text-sm">Stockfish 10</h3>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {[
                  { label: 'Quick', depth: 10 },
                  { label: 'Standard', depth: 14 },
                  { label: 'Deep', depth: 18 },
                ].map((p) => (
                  <button
                    key={p.depth}
                    onClick={() => setSelectedDepth(p.depth)}
                    disabled={isAnalyzing}
                    className={`px-2 py-1 rounded-[4px] text-xs font-bold transition ${
                      selectedDepth === p.depth
                        ? 'bg-[#81b64c] text-white shadow-sm'
                        : 'text-[#989795] hover:text-white bg-[#262421]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {isAnalyzing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#c3c2bf]">
                  <span>
                    {analysisLifecycle === 'finalizing'
                      ? 'Finalizing report…'
                      : analysisLifecycle === 'initializing'
                      ? 'Initializing engine…'
                      : `Evaluating ply ${analysisProgress.current} of ${analysisProgress.total}`}
                  </span>
                  <span className="font-mono text-[#81b64c] font-bold">
                    {analysisProgress.total > 0
                      ? `${Math.min(100, Math.round((analysisProgress.current / analysisProgress.total) * 100))}%`
                      : '0%'}
                  </span>
                </div>
                <div className="w-full bg-[#3d3a34] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#81b64c] h-full transition-all duration-200"
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
                  className="w-full py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 rounded-[4px] transition"
                >
                  Cancel Analysis
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {analysisLifecycle === 'failed' && (
                  <div className="p-2.5 rounded-[4px] bg-rose-500/10 text-rose-400 text-xs">
                    <div className="flex items-center gap-1.5 font-medium mb-1">
                      <AlertTriangle size={13} />
                      <span>Analysis failed</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">
                      {analysisError || 'Engine stopped unexpectedly. You can safely retry.'}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => startAnalysis(selectedDepth)}
                  className="chess-btn-primary w-full py-2.5 px-3 rounded-[6px] text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Sparkles size={15} />
                  <span>
                    {analysisLifecycle === 'failed'
                      ? 'Retry Analysis'
                      : activeAnalysis
                      ? 'Re-Run Game Review'
                      : 'Start Game Review'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop Tabs Header (Chess.com Style) */}
          <div className="flex border-b border-[#383531] bg-[#21201d] px-2 pt-1.5 gap-1 text-xs">
            <button
              onClick={() => setSidebarTab('review')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-[6px] font-bold transition border-b-2 ${
                sidebarTab === 'review'
                  ? 'text-white border-[#81b64c] bg-[#262421]'
                  : 'text-[#989795] hover:text-white border-transparent'
              }`}
            >
              <BarChart3 size={14} className={sidebarTab === 'review' ? 'text-[#81b64c]' : ''} />
              <span>Review</span>
            </button>
            <button
              onClick={() => setSidebarTab('moves')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-[6px] font-bold transition border-b-2 ${
                sidebarTab === 'moves'
                  ? 'text-white border-[#81b64c] bg-[#262421]'
                  : 'text-[#989795] hover:text-white border-transparent'
              }`}
            >
              <ListOrdered size={14} className={sidebarTab === 'moves' ? 'text-[#81b64c]' : ''} />
              <span>Moves</span>
            </button>
            <button
              onClick={() => setSidebarTab('coach')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-[6px] font-bold transition border-b-2 ${
                sidebarTab === 'coach'
                  ? 'text-white border-[#81b64c] bg-[#262421]'
                  : 'text-[#989795] hover:text-white border-transparent'
              }`}
            >
              <Lightbulb size={14} className={sidebarTab === 'coach' ? 'text-[#81b64c]' : ''} />
              <span>Coach</span>
            </button>
            <button
              onClick={() => setSidebarTab('graph')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-[6px] font-bold transition border-b-2 ${
                sidebarTab === 'graph'
                  ? 'text-white border-[#81b64c] bg-[#262421]'
                  : 'text-[#989795] hover:text-white border-transparent'
              }`}
            >
              <TrendingUp size={14} className={sidebarTab === 'graph' ? 'text-[#81b64c]' : ''} />
              <span>Graph</span>
            </button>
          </div>

          {/* Desktop Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sidebarTab === 'review' && renderReviewTab()}
            {sidebarTab === 'moves' && renderMovesTab()}
            {sidebarTab === 'coach' && renderCoachTab()}
            {sidebarTab === 'graph' && renderGraphTab()}
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT (visible on screens smaller than lg) */}
      <div className="flex lg:hidden flex-1 flex-col h-full overflow-hidden bg-background select-none">
        {/* 1. Mobile Compact Top Header */}
        <div className="px-3 py-2 border-b border-[#383531] bg-[#262421] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setAnalysisStage('summary')}
              className="chess-btn-secondary px-2.5 py-1 rounded text-[11px] font-bold"
            >
              ← Summary
            </button>
            <button
              onClick={() => setAnalysisStage('opening_coach')}
              className="chess-btn-primary px-2.5 py-1 rounded text-[11px] font-bold flex items-center space-x-1"
            >
              <Target size={12} />
              <span>Coach</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Live Eval pill */}
            <div className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#21201d] border border-[#383531] text-white">
              {evalMate !== undefined
                ? evalMate > 0
                  ? `+M${evalMate}`
                  : `-M${Math.abs(evalMate)}`
                : `${evalScore >= 0 ? '+' : ''}${(evalScore / 100).toFixed(1)}`}
            </div>

            <button
              onClick={flipBoard}
              className="chess-btn-secondary p-1.5 rounded text-xs"
              title="Flip board orientation (F)"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* 2. Viewport-Bounded Board & EvalBar Container */}
        <div className="flex flex-col items-center justify-center p-2 shrink-0 bg-[#2b2825]">
          {/* Mobile Opponent Strip */}
          <div className="w-full max-w-[340px] flex items-center justify-between py-1 px-2 bg-[#262421] rounded-t-[4px] border border-[#383531] text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-white truncate">{topPlayerName}</span>
              <span className="text-[#989795] font-mono">({topPlayerElo})</span>
            </div>
            {topMaterialAdvantage && (
              <span className="font-bold text-[#81b64c] font-mono">{topMaterialAdvantage}</span>
            )}
          </div>

          <div
            className="w-full flex gap-1.5 items-stretch justify-center my-0.5"
            style={{ maxHeight: 'min(36dvh, 320px)' }}
          >
            <div className="w-4 shrink-0 flex items-stretch">
              <EvalBar
                score={evalScore}
                mate={evalMate}
                orientation={boardOrientation}
                className="w-4"
              />
            </div>
            <div className="h-full aspect-square max-h-[min(36dvh,320px)] max-w-[min(calc(100vw-2.5rem),36dvh,320px)] flex items-center justify-center">
              <InteractiveChessboard
                id="analysis-board-mobile"
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

          {/* Mobile User Strip */}
          <div className="w-full max-w-[340px] flex items-center justify-between py-1 px-2 bg-[#262421] rounded-b-[4px] border border-[#383531] text-[11px]">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-white truncate">{bottomPlayerName}</span>
              <span className="text-[#989795] font-mono">({bottomPlayerElo})</span>
            </div>
            {bottomMaterialAdvantage && (
              <span className="font-bold text-[#81b64c] font-mono">{bottomMaterialAdvantage}</span>
            )}
          </div>

          {exploredFen && (
            <div className="w-full max-w-[340px] mt-1 px-2 py-1 rounded bg-[#262421] border border-[#81b64c]/40 flex items-center justify-between text-[11px]">
              <span className="text-white truncate">
                Exploring <span className="text-[#81b64c] font-mono font-bold">{exploredSan}</span>
              </span>
              <button
                onClick={() => {
                  setExploredFen(null);
                  setExploredSan(null);
                }}
                className="chess-btn-secondary px-2 py-0.5 text-[10px] rounded shrink-0 ml-2"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* 3. Compact Move Navigation Bar */}
        <div className="px-2 py-1.5 bg-[#262421] border-y border-[#383531] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-0.5 sm:space-x-1">
            <button
              onClick={firstPly}
              disabled={isAnalyzing || currentPly === 0}
              className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-surface-border transition"
              title="First Move"
            >
              <ChevronFirst size={18} />
            </button>
            <button
              onClick={prevPly}
              disabled={isAnalyzing || currentPly === 0}
              className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-surface-border transition"
              title="Previous Move"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={isAnalyzing}
              className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-accent hover:bg-accent/15 rounded transition disabled:opacity-30"
              title={isPlaying ? 'Pause' : 'Autoplay'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={nextPly}
              disabled={isAnalyzing || currentPly >= gamePositions.length - 1}
              className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-surface-border transition"
              title="Next Move"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={lastPly}
              disabled={isAnalyzing || currentPly >= gamePositions.length - 1}
              className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-surface-border transition"
              title="Last Move"
            >
              <ChevronLast size={18} />
            </button>
          </div>

          {/* Current Move badge & Best Move recommendation */}
          <div className="flex items-center space-x-2 text-xs">
            {currentPosData && currentPosData.ply > 0 ? (
              <div className="flex items-center space-x-1 font-mono font-bold text-slate-200">
                <span>
                  {Math.ceil(currentPosData.ply / 2)}
                  {currentPosData.ply % 2 === 1 ? '.' : '...'} {currentPosData.san}
                </span>
                {currentAnalysisPos?.classification && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                      CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.text || ''
                    }`}
                  >
                    {CLASSIFICATION_BADGES[currentAnalysisPos.classification]?.icon}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 font-mono text-[11px]">Start</span>
            )}

            {currentAnalysisPos?.bestMoveSan && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 truncate max-w-[110px]">
                Best: {currentAnalysisPos.bestMoveSan}
              </span>
            )}
          </div>
        </div>

        {/* 4. Segmented Mobile Tabs Bar */}
        <div className="grid grid-cols-4 border-b border-surface-border bg-surface shrink-0 text-xs">
          <button
            onClick={() => setSidebarTab('coach')}
            className={`py-2 flex items-center justify-center space-x-1 font-semibold transition border-b-2 ${
              sidebarTab === 'coach'
                ? 'text-accent border-accent bg-surface-elevated/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Lightbulb size={13} />
            <span>Coach</span>
          </button>
          <button
            onClick={() => setSidebarTab('review')}
            className={`py-2 flex items-center justify-center space-x-1 font-semibold transition border-b-2 ${
              sidebarTab === 'review'
                ? 'text-accent border-accent bg-surface-elevated/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <BarChart3 size={13} />
            <span>Review</span>
          </button>
          <button
            onClick={() => setSidebarTab('moves')}
            className={`py-2 flex items-center justify-center space-x-1 font-semibold transition border-b-2 ${
              sidebarTab === 'moves'
                ? 'text-accent border-accent bg-surface-elevated/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <ListOrdered size={13} />
            <span>Moves</span>
          </button>
          <button
            onClick={() => setSidebarTab('graph')}
            className={`py-2 flex items-center justify-center space-x-1 font-semibold transition border-b-2 ${
              sidebarTab === 'graph'
                ? 'text-accent border-accent bg-surface-elevated/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <TrendingUp size={13} />
            <span>Graph</span>
          </button>
        </div>

        {/* 5. Scrollable Tab Content Pane */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-8 bg-surface space-y-3">
          {sidebarTab === 'coach' && renderCoachTab()}
          {sidebarTab === 'review' && renderReviewTab()}
          {sidebarTab === 'moves' && renderMovesTab()}
          {sidebarTab === 'graph' && renderGraphTab()}
        </div>
      </div>
    </>
  );
};
