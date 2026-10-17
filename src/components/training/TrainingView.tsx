import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
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
  Eye,
  HelpCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { TrainingCard } from '../../types/chess';
import {
  type TrainingMachineState,
  createTrainingMachineState,
  transitionTrainingMachine,
  validateMoveAgainstExercise,
} from '../../training/trainingStateMachine';

export const TrainingView: React.FC = () => {
  const {
    trainingQueue,
    currentCardIndex,
    trainingFilter,
    setTrainingFilter,
    loadTrainingQueue,
    answerTrainingCard,
    nextTrainingCard,
  } = useAppStore();

  const [showHint, setShowHint] = useState<boolean>(false);
  const [boardFen, setBoardFen] = useState<string>('');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Load cards on initial mount
  useEffect(() => {
    loadTrainingQueue();
  }, [loadTrainingQueue]);

  const currentCard: TrainingCard | undefined = trainingQueue[currentCardIndex];

  // State machine state
  const [machineState, setMachineState] = useState<TrainingMachineState | null>(null);
  const requestCounterRef = useRef<number>(0);

  // Initialize state machine when current card changes
  useEffect(() => {
    if (currentCard) {
      const initial = createTrainingMachineState({
        id: currentCard.id,
        fen: currentCard.fen,
        turn: currentCard.turn,
        solutionMovesSan: currentCard.solutionMovesSan,
        solutionMovesUci: currentCard.solutionMovesUci,
        continuation: currentCard.continuation,
        playedMoveSan: currentCard.playedMoveSan,
        lesson: currentCard.lesson,
        motif: currentCard.motif,
      });
      setMachineState(initial);
      setBoardFen(currentCard.fen);
      setLastMove(null);
      setShowHint(false);
    } else {
      setMachineState(null);
    }
  }, [currentCard]);

  // Turn from FEN
  const turn: 'white' | 'black' = useMemo(() => {
    if (!currentCard) return 'white';
    return currentCard.turn === 'w' ? 'white' : 'black';
  }, [currentCard]);

  // Handle move on board with complete validation and state machine guards
  const handleMove = useCallback(
    ({
      from,
      to,
      san,
      fen: nextFen,
      promotion,
    }: {
      from: string;
      to: string;
      san: string;
      fen: string;
      promotion?: string;
    }): boolean => {
      if (!currentCard || !machineState) return false;
      if (machineState.status !== 'awaiting_move') return false;

      const requestId = `req_${++requestCounterRef.current}`;

      // Start validation transition
      const validatingState = transitionTrainingMachine(machineState, {
        type: 'START_MOVE_VALIDATION',
        attempt: { from, to, promotion, san },
        requestId,
      });
      setMachineState(validatingState);

      // Perform authoritative validation
      const validation = validateMoveAgainstExercise(
        {
          id: currentCard.id,
          fen: currentCard.fen,
          turn: currentCard.turn,
          solutionMovesSan: currentCard.solutionMovesSan,
          solutionMovesUci: currentCard.solutionMovesUci,
        },
        { from, to, promotion, san }
      );

      // Transition based on result
      const nextState = transitionTrainingMachine(validatingState, {
        type: 'MOVE_VALIDATION_RESULT',
        result: validation,
        requestId,
      });
      setMachineState(nextState);

      if (validation.isCorrect) {
        setBoardFen(nextFen);
        setLastMove({ from, to });
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        // Save success in SRS database (without auto-skipping to next card!)
        answerTrainingCard(currentCard.id, true);
        return true;
      } else {
        // Incorrect move: do not advance exercise, keep position active
        setLastMove({ from, to });
        answerTrainingCard(currentCard.id, false);
        return false;
      }
    },
    [currentCard, machineState, answerTrainingCard]
  );

  const handleNext = () => {
    setShowHint(false);
    setLastMove(null);
    nextTrainingCard();
  };

  const handleRetry = () => {
    if (currentCard && machineState) {
      setBoardFen(currentCard.fen);
      setLastMove(null);
      setShowHint(false);
      setMachineState(transitionTrainingMachine(machineState, { type: 'RETRY' }));
    }
  };

  const handleRevealSolution = () => {
    if (!currentCard || !machineState) return;

    try {
      const chess = new Chess(currentCard.fen);
      const bestUci = currentCard.solutionMovesUci[0];
      if (bestUci && bestUci.length >= 4) {
        const from = bestUci.slice(0, 2);
        const to = bestUci.slice(2, 4);
        const promo = bestUci[4] || undefined;
        const m = chess.move({ from, to, promotion: promo });
        if (m) {
          setBoardFen(chess.fen());
          setLastMove({ from, to });
          setMachineState(
            transitionTrainingMachine(machineState, {
              type: 'SHOW_SOLUTION',
              solutionFen: chess.fen(),
            })
          );
        }
      }
    } catch {
      // fallback
    }
  };

  const isSolved = machineState?.status === 'correct_feedback';
  const isIncorrect = machineState?.status === 'incorrect_feedback';
  const isShowingSolution = machineState?.status === 'showing_solution';

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background">
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
              Training
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Practice tactical motifs and key positions with spaced repetition.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'due', label: 'Due for review' },
              { id: 'mistakes', label: 'My mistakes' },
              { id: 'tactics', label: 'Tactics' },
              { id: 'all', label: 'All exercises' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTrainingFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  trainingFilter === f.id
                    ? 'bg-accent/15 text-accent font-semibold'
                    : 'bg-surface text-slate-500 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Training Body */}
        {!currentCard ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center text-2xl mb-4 text-emerald-400">
              ✓
            </div>
            <h2 className="text-base font-medium text-slate-200 mb-1">Queue clear</h2>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              You've completed all scheduled exercises in this queue. Analyze new games to discover more positions or switch modes above.
            </p>
            <button
              onClick={() => setTrainingFilter('all')}
              className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-300 font-medium rounded-xl text-xs transition"
            >
              Review all exercises
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Interactive Board */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full max-w-[480px] flex items-center justify-between mb-3 text-xs text-slate-400">
                <span className="flex items-center gap-2 font-medium text-slate-200">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      turn === 'white' ? 'bg-slate-100' : 'bg-slate-700'
                    }`}
                  />
                  <span>{turn === 'white' ? 'White' : 'Black'} to move</span>
                </span>
                <span className="text-slate-500 font-mono">
                  {currentCardIndex + 1} of {trainingQueue.length}
                </span>
              </div>

              <div className="w-full max-w-[min(100vw-2.5rem,480px)] aspect-square flex items-center justify-center">
                <InteractiveChessboard
                  fen={boardFen}
                  boardOrientation={turn}
                  turn={currentCard.turn}
                  allowMoves={machineState?.status === 'awaiting_move'}
                  onMove={handleMove}
                  lastMove={lastMove}
                  highlightSquares={
                    showHint && currentCard
                      ? [currentCard.solutionMovesUci[0]?.slice(0, 2)].filter(Boolean)
                      : []
                  }
                  maxWidth="100%"
                />
              </div>
            </div>

            {/* Right Column: Lesson, Verification & Controls */}
            <div className="lg:col-span-5 bg-surface rounded-2xl p-6 flex flex-col justify-between">
              <div>
                {/* Badge & Motif */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-accent">
                    {currentCard.motif || 'Tactics'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    #{currentCard.repetitions}
                  </span>
                </div>

                <h3 className="text-base font-medium text-slate-100 mb-2">
                  Find the best move
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-5">
                  You previously played <span className="font-mono text-rose-400 font-semibold">{currentCard.playedMoveSan}</span> here.
                  Can you find the stronger continuation?
                </p>

                {/* Status Outcome: Correct */}
                {isSolved && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400 mb-4 animate-in fade-in">
                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                      <CheckCircle2 size={16} />
                      <span>Solved correctly</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {currentCard.lesson}
                    </p>
                  </div>
                )}

                {/* Status Outcome: Incorrect */}
                {isIncorrect && (
                  <div className="p-4 rounded-xl bg-rose-500/10 text-rose-400 mb-4 animate-in fade-in">
                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                      <XCircle size={16} />
                      <span>Not quite</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      That move isn't the continuation we're looking for. Try again!
                    </p>
                  </div>
                )}

                {/* Status Outcome: Revealed Solution */}
                {isShowingSolution && (
                  <div className="p-4 rounded-xl bg-amber-500/10 text-amber-300 mb-4 animate-in fade-in">
                    <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                      <Eye size={16} />
                      <span>Solution revealed</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      The best move is <span className="font-mono text-emerald-400 font-bold">{currentCard.solutionMovesSan[0]}</span>.
                    </p>
                    {currentCard.lesson && (
                      <p className="text-xs text-slate-400 mt-2">
                        {currentCard.lesson}
                      </p>
                    )}
                  </div>
                )}

                {/* Hint section */}
                {showHint && machineState?.status === 'awaiting_move' && (
                  <div className="p-3.5 rounded-xl bg-surface-elevated text-xs text-slate-300 mb-4 flex items-start gap-2.5">
                    <Lightbulb size={15} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-medium text-amber-400 block mb-0.5">Hint</span>
                      <span className="text-slate-400">
                        Move the piece on <span className="font-mono text-slate-200 font-bold uppercase">{currentCard.solutionMovesUci[0]?.slice(0, 2)}</span>.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-surface-elevated mt-4">
                {isSolved || isShowingSolution ? (
                  <button
                    onClick={handleNext}
                    className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow"
                  >
                    <span>Next Exercise</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowHint(true)}
                      disabled={showHint}
                      className="flex-1 py-2 px-3 bg-surface-elevated hover:bg-surface-hover disabled:opacity-40 text-slate-300 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <Lightbulb size={13} className="text-amber-400" />
                      <span>Hint</span>
                    </button>
                    <button
                      onClick={handleRevealSolution}
                      className="flex-1 py-2 px-3 bg-surface-elevated hover:bg-surface-hover text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <Eye size={13} />
                      <span>Reveal</span>
                    </button>
                  </div>
                )}

                {isIncorrect && (
                  <button
                    onClick={handleRetry}
                    className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    <span>Try again</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
