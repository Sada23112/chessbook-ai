import React, { useEffect, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import confetti from 'canvas-confetti';
import {
  Dumbbell,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BookOpen,
  Filter,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { db } from '../../db/db';
import type { TrainingCard } from '../../types/chess';

export const TrainingView: React.FC = () => {
  const {
    trainingQueue,
    currentCardIndex,
    trainingFilter,
    setTrainingFilter,
    loadTrainingQueue,
    answerTrainingCard,
  } = useAppStore();

  const [hasSolved, setHasSolved] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [boardFen, setBoardFen] = useState<string>('');

  useEffect(() => {
    loadTrainingQueue();
  }, [loadTrainingQueue]);

  const currentCard: TrainingCard | undefined = trainingQueue[currentCardIndex];

  // Reset board when card changes
  useEffect(() => {
    if (currentCard) {
      setBoardFen(currentCard.fen);
      setHasSolved(null);
      setShowHint(false);
    }
  }, [currentCard]);

  // Turn from FEN
  // Turn from FEN
  const turn: 'white' | 'black' = useMemo(() => {
    if (!currentCard) return 'white';
    return currentCard.turn === 'w' ? 'white' : 'black';
  }, [currentCard]);

  // Handle move on board
  const onPieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean => {
    if (!currentCard || hasSolved !== null || !targetSquare) return false;

    try {
      const chess = new Chess(boardFen);
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) return false;

      const playedUci = `${sourceSquare}${targetSquare}${move.promotion || ''}`;

      // Check if played move matches solution (either SAN or UCI)
      const isCorrect =
        currentCard.solutionMovesSan.includes(move.san) ||
        currentCard.solutionMovesUci.includes(playedUci);

      if (isCorrect) {
        setBoardFen(chess.fen());
        setHasSolved(true);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        answerTrainingCard(currentCard.id, true);
        return true;
      } else {
        setBoardFen(chess.fen());
        setHasSolved(false);
        answerTrainingCard(currentCard.id, false);
        return true;
      }
    } catch {
      return false;
    }
  };

  const handleNext = () => {
    setHasSolved(null);
    setShowHint(false);
    useAppStore.setState((s) => ({
      currentCardIndex: s.currentCardIndex + 1,
    }));
  };

  const handleRetry = () => {
    if (currentCard) {
      setBoardFen(currentCard.fen);
      setHasSolved(null);
      setShowHint(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Personal Training Studio
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Turn your game mistakes into permanent mastery with spaced repetition.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'due', label: 'Due for Review' },
            { id: 'mistakes', label: 'My Game Mistakes' },
            { id: 'tactics', label: 'Tactical Motifs' },
            { id: 'all', label: 'All Exercises' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTrainingFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                trainingFilter === f.id
                  ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                  : 'bg-surface text-slate-400 hover:text-slate-200 border-surface-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Training Body */}
      {!currentCard ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface rounded-2xl border border-surface-border text-center max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent text-3xl mb-4">
            ✓
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Training Queue Clear!</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            You've completed all scheduled training exercises for this mode. Analyze new games to discover more personalized exercises or switch modes above.
          </p>
          <button
            onClick={() => setTrainingFilter('all')}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs transition"
          >
            Review All Exercises
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Board */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full max-w-[480px] flex items-center justify-between mb-3 text-xs font-mono text-slate-400">
              <span className="flex items-center space-x-1.5 font-sans font-semibold text-slate-200">
                <span className={`w-3 h-3 rounded-full ${turn === 'white' ? 'bg-white' : 'bg-slate-900 border border-slate-600'}`} />
                <span>{turn === 'white' ? 'White' : 'Black'} to move</span>
              </span>
              <span>
                Exercise {currentCardIndex + 1} of {trainingQueue.length}
              </span>
            </div>

            <div className="w-full max-w-[480px] aspect-square rounded-xl overflow-hidden shadow-2xl border border-surface-border bg-surface-elevated">
              <Chessboard
                options={{
                  position: boardFen,
                  boardOrientation: turn,
                  onPieceDrop,
                  darkSquareStyle: { backgroundColor: '#2e3a44' },
                  lightSquareStyle: { backgroundColor: '#5c6d7c' },
                }}
              />
            </div>
          </div>

          {/* Right Column: Lesson, Verification & Controls */}
          <div className="lg:col-span-5 bg-surface rounded-xl border border-surface-border p-6 flex flex-col justify-between">
            <div>
              {/* Badge & Motif */}
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded bg-accent/10 border border-accent/30 text-accent text-xs font-bold uppercase tracking-wider">
                  {currentCard.motif || 'Tactics'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Repetition #{currentCard.repetitions}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-100 mb-2">
                Find the best move in this position
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                You previously played <span className="font-mono text-rose-400 font-bold">{currentCard.playedMoveSan}</span> here.
                Can you find the engine-recommended continuation?
              </p>

              {/* Status Outcome */}
              {hasSolved === true && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4 animate-in fade-in">
                  <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                    <CheckCircle2 size={18} />
                    <span>Solved Correctly!</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed mt-1">
                    {currentCard.lesson}
                  </p>
                </div>
              )}

              {hasSolved === false && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4 animate-in fade-in">
                  <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                    <XCircle size={18} />
                    <span>Incorrect Move</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed mt-1">
                    The optimal move was <span className="font-mono text-emerald-400 font-bold">{currentCard.solutionMovesSan[0]}</span>.
                  </p>
                  <p className="text-xs text-slate-300 mt-2">
                    <span className="font-bold text-slate-100">Coach Note:</span> {currentCard.lesson}
                  </p>
                </div>
              )}

              {/* Hint section */}
              {showHint && hasSolved === null && (
                <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs text-slate-300 mb-4 flex items-start space-x-2">
                  <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-400 block mb-0.5">Tactical Hint</span>
                    <span>Focus on motif: {currentCard.motif}. Look for forcing candidate moves.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-surface-border mt-4">
              {hasSolved !== null ? (
                <button
                  onClick={handleNext}
                  className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs transition flex items-center justify-center space-x-2 shadow"
                >
                  <span>Next Exercise</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowHint(true)}
                    disabled={showHint}
                    className="flex-1 py-2 px-3 bg-surface-elevated hover:bg-surface-border disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition flex items-center justify-center space-x-1.5"
                  >
                    <Lightbulb size={14} className="text-amber-400" />
                    <span>Show Hint</span>
                  </button>
                  <button
                    onClick={() => setHasSolved(false)}
                    className="flex-1 py-2 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition"
                  >
                    Show Solution
                  </button>
                </div>
              )}

              {hasSolved === false && (
                <button
                  onClick={handleRetry}
                  className="w-full py-2 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Retry Position</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
