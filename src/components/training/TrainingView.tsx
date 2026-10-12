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
                <span
                  className={`w-3 h-3 rounded-full ${
                    turn === 'white' ? 'bg-white' : 'bg-slate-900 border border-slate-600'
                  }`}
                />
                <span>{turn === 'white' ? 'White' : 'Black'} to move</span>
              </span>
              <span>
                Exercise {currentCardIndex + 1} of {trainingQueue.length}
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

              {/* Status Outcome: Correct */}
              {isSolved && (
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

              {/* Status Outcome: Incorrect */}
              {isIncorrect && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4 animate-in fade-in">
                  <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                    <XCircle size={18} />
                    <span>Not the Best Move</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed mt-1">
                    That move is not the accepted continuation. The position remains active so you can try again!
                  </p>
                </div>
              )}

              {/* Status Outcome: Revealed Solution */}
              {isShowingSolution && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-4 animate-in fade-in">
                  <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                    <Eye size={18} />
                    <span>Solution Revealed</span>
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
              {showHint && machineState?.status === 'awaiting_move' && (
                <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs text-slate-300 mb-4 flex items-start space-x-2">
                  <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-400 block mb-0.5">Tactical Hint</span>
                    <span>
                      The piece to move is on square <span className="font-mono text-sky-400 font-bold uppercase">{currentCard.solutionMovesUci[0]?.slice(0, 2)}</span>. Motif: {currentCard.motif}.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-surface-border mt-4">
              {isSolved || isShowingSolution ? (
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
                    onClick={handleRevealSolution}
                    className="flex-1 py-2 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 rounded-lg text-xs font-medium border border-surface-border transition flex items-center justify-center space-x-1.5"
                  >
                    <Eye size={14} className="text-slate-400" />
                    <span>Reveal Solution</span>
                  </button>
                </div>
              )}

              {isIncorrect && (
                <button
                  onClick={handleRetry}
                  className="w-full py-2.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold border border-rose-500/40 transition flex items-center justify-center space-x-1.5 shadow"
                >
                  <RotateCcw size={14} />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
