import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Dumbbell,
  CheckCircle2,
  XCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
  ArrowRight,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import type { OpeningRepertoire, RepertoireVariation } from '../../types/chess';
import { InteractiveChessboard } from '../common/InteractiveChessboard';

export interface OpeningTrainingViewProps {
  repertoire: OpeningRepertoire;
  variation: RepertoireVariation;
  onExitTraining: () => void;
  onSelectNextVariation?: () => void;
}

export const OpeningTrainingView: React.FC<OpeningTrainingViewProps> = ({
  repertoire,
  variation,
  onExitTraining,
  onSelectNextVariation,
}) => {
  const [plyIndex, setPlyIndex] = useState<number>(0);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);

  // Dedicated timer ref to prevent timeout overlap, race conditions, and memory leaks
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending timer on unmount
  useEffect(() => {
    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, []);

  // Compute current FEN based on variation moves and plyIndex
  const currentFen = useMemo(() => {
    const chess = new Chess();
    for (let i = 0; i < plyIndex && i < variation.moves.length; i++) {
      chess.move(variation.moves[i]);
    }
    return chess.fen();
  }, [variation.moves, plyIndex]);

  // Determine whose turn it is in the position
  const currentTurn: 'white' | 'black' = useMemo(() => {
    return plyIndex % 2 === 0 ? 'white' : 'black';
  }, [plyIndex]);

  // Is it the user's turn to move based on repertoire side?
  const isUserTurn = repertoire.color === currentTurn;

  // Expected move for this position
  const expectedMoveSan = variation.moves[plyIndex];

  // If opening starts with opponent's move (e.g. Black vs 1.e4), auto-play White's move on start
  useEffect(() => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }

    if (plyIndex === 0 && repertoire.color === 'black' && variation.moves.length > 0) {
      opponentTimerRef.current = setTimeout(() => {
        setPlyIndex(1);
        setTrainingStatus('Your turn. Play Black’s opening defense.');
      }, 500);
    } else {
      setTrainingStatus(
        isUserTurn
          ? `Your turn (${repertoire.color}). Find the correct repertoire move.`
          : 'Opponent is responding...'
      );
    }

    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, [repertoire.color, variation.moves]);

  // Handle user's move attempt on the interactive board
  const handleMove = useCallback(
    ({ san }: { san: string }): boolean => {
      if (isCompleted || !isUserTurn) return false;

      // Clear any pending opponent timer to avoid conflicting state updates
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }

      if (san === expectedMoveSan) {
        const nextPly = plyIndex + 1;
        setPlyIndex(nextPly);
        setIsSuccess(true);
        setShowHint(false);
        setCorrectCount((c) => c + 1);

        if (nextPly >= variation.moves.length) {
          // Line completed!
          setIsCompleted(true);
          setTrainingStatus('Line completed! Excellent repertoire memory.');
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { y: 0.65 },
          });
        } else {
          setTrainingStatus(`✓ Correct! Played ${san}. Opponent responding...`);
          // Schedule opponent reply safely with opponentTimerRef
          opponentTimerRef.current = setTimeout(() => {
            const opponentNextPly = nextPly + 1;
            setPlyIndex(opponentNextPly);
            setIsSuccess(null);

            if (opponentNextPly >= variation.moves.length) {
              setIsCompleted(true);
              setTrainingStatus('Line completed! You mastered this variation.');
              confetti({
                particleCount: 65,
                spread: 70,
                origin: { y: 0.65 },
              });
            } else {
              setTrainingStatus(`Your turn again (${repertoire.color}). Find the next repertoire move.`);
            }
          }, 500);
        }
        return true;
      } else {
        setIsSuccess(false);
        setMistakeCount((m) => m + 1);
        setTrainingStatus(
          `❌ Incorrect move (${san}). Expected repertoire move was ${expectedMoveSan}.`
        );
        return false;
      }
    },
    [isCompleted, isUserTurn, expectedMoveSan, plyIndex, variation.moves.length, repertoire.color]
  );

  const handleRestart = () => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    setMistakeCount(0);
    setCorrectCount(0);
    setIsCompleted(false);
    setIsSuccess(null);
    setShowHint(false);

    if (repertoire.color === 'black' && variation.moves.length > 0) {
      setPlyIndex(0);
      opponentTimerRef.current = setTimeout(() => {
        setPlyIndex(1);
        setTrainingStatus('Your turn. Play Black’s opening defense.');
      }, 500);
    } else {
      setPlyIndex(0);
      setTrainingStatus(`Your turn (${repertoire.color}). Find the opening move.`);
    }
  };

  const handleRetryCurrentMove = () => {
    setIsSuccess(null);
    setShowHint(false);
    setTrainingStatus(`Try again (${repertoire.color}). Find the correct move.`);
  };

  // Expected move hint details
  const hintSquare = useMemo(() => {
    if (!showHint || !expectedMoveSan) return [];
    try {
      const chess = new Chess(currentFen);
      const moves = chess.moves({ verbose: true });
      const target = moves.find((m) => m.san === expectedMoveSan);
      if (target) {
        return [target.from];
      }
      return [];
    } catch {
      return [];
    }
  }, [showHint, expectedMoveSan, currentFen]);

  const progressPercentage = Math.round(
    (plyIndex / Math.max(1, variation.moves.length)) * 100
  );

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background min-h-0">
      {/* Top Header & Session Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={onExitTraining}
            className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border transition flex items-center space-x-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={16} />
            <span>Exit Training</span>
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center space-x-1">
                <Dumbbell size={12} />
                <span>Training Mode</span>
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 truncate">
                {variation.name}
              </h2>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Playing as <span className="font-semibold text-slate-200 capitalize">{repertoire.color}</span> • Move {Math.floor(plyIndex / 2) + 1}
            </p>
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="flex items-center space-x-3 text-xs self-start sm:self-auto">
          <div className="flex flex-col items-end">
            <span className="font-mono text-slate-300 font-bold">
              {plyIndex} / {variation.moves.length} plies
            </span>
            <div className="w-28 sm:w-36 h-2 bg-surface-elevated rounded-full overflow-hidden border border-surface-border mt-1">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Training Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Board */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Turn Indicator */}
          <div className="w-full max-w-[480px] flex items-center justify-between mb-3 text-xs font-mono">
            <span className="flex items-center space-x-1.5 font-sans font-semibold text-slate-200">
              <span
                className={`w-3 h-3 rounded-full ${
                  currentTurn === 'white'
                    ? 'bg-white'
                    : 'bg-slate-900 border border-slate-600'
                }`}
              />
              <span>
                {currentTurn === 'white' ? 'White' : 'Black'} to move
                {isUserTurn ? ' (You)' : ' (Opponent)'}
              </span>
            </span>

            <span className="text-slate-400">
              Accuracy: {correctCount + mistakeCount > 0 ? Math.round((correctCount / (correctCount + mistakeCount)) * 100) : 100}%
            </span>
          </div>

          {/* Interactive Chessboard */}
          <div className="w-full max-w-[min(100vw-2.5rem,480px)] aspect-square flex items-center justify-center">
            <InteractiveChessboard
              id="training-arena-board"
              fen={currentFen}
              boardOrientation={repertoire.color}
              turn={repertoire.color === 'white' ? 'w' : 'b'}
              allowMoves={isUserTurn && !isCompleted}
              onMove={handleMove}
              highlightSquares={hintSquare}
              maxWidth="100%"
            />
          </div>
        </div>

        {/* Right Column: Coach & Action Panel */}
        <div className="lg:col-span-5 bg-surface rounded-2xl border border-surface-border p-6 flex flex-col justify-between space-y-6">
          <div>
            {/* Status Outcome Banner */}
            <div
              className={`p-4 rounded-xl border text-xs font-medium mb-4 transition ${
                isCompleted
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : isSuccess === true
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : isSuccess === false
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-surface-elevated border-surface-border text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                {isCompleted ? (
                  <>
                    <Sparkles size={18} className="text-accent" />
                    <span>Line Mastered!</span>
                  </>
                ) : isSuccess === true ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <span>Correct Move</span>
                  </>
                ) : isSuccess === false ? (
                  <>
                    <XCircle size={18} className="text-rose-400" />
                    <span>Incorrect Move</span>
                  </>
                ) : (
                  <>
                    <BookOpen size={18} className="text-accent" />
                    <span>Opening Objective</span>
                  </>
                )}
              </div>
              <p className="leading-relaxed mt-1">{trainingStatus}</p>

              {/* Expected Move Note on Failure */}
              {isSuccess === false && (
                <div className="mt-3 pt-2.5 border-t border-rose-500/20 text-slate-200">
                  <span>Repertoire line requires: </span>
                  <span className="font-mono text-emerald-400 font-bold">{expectedMoveSan}</span>
                </div>
              )}
            </div>

            {/* Strategic Notes */}
            {variation.description && (
              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-surface-border mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                  Theory Note
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {variation.description}
                </p>
              </div>
            )}

            {/* Hint Box */}
            {showHint && isUserTurn && !isCompleted && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-200 mb-4 flex items-start space-x-2">
                <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-amber-400 block mb-0.5">Move Clue</span>
                  <span>
                    The expected move is <span className="font-mono font-bold text-accent">{expectedMoveSan}</span>.
                    Look at the highlighted square on the board.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="space-y-2.5 pt-4 border-t border-surface-border">
            {isCompleted ? (
              <div className="space-y-2">
                <button
                  onClick={handleRestart}
                  className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow"
                >
                  <RotateCcw size={16} />
                  <span>Practice This Line Again</span>
                </button>
                {onSelectNextVariation && (
                  <button
                    onClick={onSelectNextVariation}
                    className="w-full py-2.5 px-4 bg-surface-elevated hover:bg-surface-border text-slate-200 font-semibold rounded-xl text-xs border border-surface-border transition flex items-center justify-center space-x-2"
                  >
                    <span>Next Variation in Repertoire</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            ) : isSuccess === false ? (
              <div className="flex gap-2">
                <button
                  onClick={handleRetryCurrentMove}
                  className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-xl text-xs font-semibold border border-surface-border transition flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw size={15} />
                  <span>Retry Move</span>
                </button>
                <button
                  onClick={() => setShowHint(true)}
                  className="flex-1 py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5"
                >
                  <Lightbulb size={15} />
                  <span>Show Hint</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHint(true)}
                  disabled={showHint}
                  className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold border border-surface-border transition flex items-center justify-center space-x-1.5"
                >
                  <Lightbulb size={15} className="text-amber-400" />
                  <span>Need a Hint?</span>
                </button>
                <button
                  onClick={handleRestart}
                  className="py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-400 hover:text-slate-200 rounded-xl text-xs border border-surface-border transition"
                  title="Restart line from beginning"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
