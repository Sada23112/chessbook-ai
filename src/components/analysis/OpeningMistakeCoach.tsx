import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Eye,
  Award,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import type { GameRecord, GameAnalysis, OpeningRepertoire } from '../../types/chess';
import {
  findOpeningMistakes,
  type OpeningMistake,
  type DemonstrationStep,
} from '../../coach/openingCoachService';
import {
  createTrainingMachineState,
  transitionTrainingMachine,
  validateMoveAgainstExercise,
  type TrainingMachineState,
} from '../../training/trainingStateMachine';

export interface OpeningMistakeCoachProps {
  game: GameRecord;
  analysis: GameAnalysis | null;
  repertoires: OpeningRepertoire[];
  onFinishReview: () => void;
  onOpenFullGame: () => void;
  onStartFullAnalysis: () => void;
  isAnalyzing: boolean;
}

export const OpeningMistakeCoach: React.FC<OpeningMistakeCoachProps> = ({
  game,
  analysis,
  repertoires,
  onFinishReview,
  onOpenFullGame,
  onStartFullAnalysis,
  isAnalyzing,
}) => {
  // Extract opening mistakes
  const { openingBoundary, mistakes, hasOpeningMistakes } = useMemo(() => {
    if (!analysis) {
      return {
        openingBoundary: { endPly: 16, method: 'heuristics' as const, description: 'Opening phase' },
        mistakes: [],
        hasOpeningMistakes: false,
      };
    }
    return findOpeningMistakes(game, analysis, repertoires);
  }, [game, analysis, repertoires]);

  const [currentMistakeIndex, setCurrentMistakeIndex] = useState<number>(0);
  const activeMistake: OpeningMistake | undefined = mistakes[currentMistakeIndex];

  // Board and state machine state
  const [boardFen, setBoardFen] = useState<string>('');
  const [machineState, setMachineState] = useState<TrainingMachineState | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [activeDemoStepIndex, setActiveDemoStepIndex] = useState<number>(0);
  const [activeComparisonTab, setActiveComparisonTab] = useState<'better' | 'actual'>('better');

  const requestCounterRef = useRef<number>(0);
  const isValidatingRef = useRef<boolean>(false);

  // Initialize state machine whenever activeMistake changes
  useEffect(() => {
    isValidatingRef.current = false;
    if (activeMistake) {
      const state = createTrainingMachineState({
        id: activeMistake.id,
        fen: activeMistake.fenBefore,
        turn: activeMistake.turn,
        solutionMovesSan: [activeMistake.bestMoveSan],
        solutionMovesUci: [activeMistake.bestMoveUci],
      });
      setMachineState(state);
      setBoardFen(activeMistake.fenBefore);
      setLastMove(null);
      setShowHint(false);
      setActiveDemoStepIndex(0);
      setActiveComparisonTab('better');
    } else {
      setMachineState(null);
    }
  }, [activeMistake]);

  // Handle user move attempt on the board
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
      if (!activeMistake || !machineState) return false;
      if (machineState.status !== 'awaiting_move' || isValidatingRef.current) return false;

      isValidatingRef.current = true;
      const requestId = `req_${++requestCounterRef.current}`;

      const validatingState = transitionTrainingMachine(machineState, {
        type: 'START_MOVE_VALIDATION',
        attempt: { from, to, promotion, san },
        requestId,
      });
      setMachineState(validatingState);

      const validation = validateMoveAgainstExercise(
        {
          id: activeMistake.id,
          fen: activeMistake.fenBefore,
          turn: activeMistake.turn,
          solutionMovesSan: [activeMistake.bestMoveSan],
          solutionMovesUci: [activeMistake.bestMoveUci],
        },
        { from, to, promotion, san }
      );

      const nextState = transitionTrainingMachine(validatingState, {
        type: 'MOVE_VALIDATION_RESULT',
        result: validation,
        requestId,
      });
      setMachineState(nextState);
      isValidatingRef.current = false;

      if (validation.isCorrect) {
        setBoardFen(nextFen);
        setLastMove({ from, to });
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        return true;
      } else {
        // Keep position active for retry, do not advance
        setLastMove({ from, to });
        return false;
      }
    },
    [activeMistake, machineState]
  );

  const handleRetry = () => {
    isValidatingRef.current = false;
    if (activeMistake && machineState) {
      setBoardFen(activeMistake.fenBefore);
      setLastMove(null);
      setShowHint(false);
      setMachineState(transitionTrainingMachine(machineState, { type: 'RETRY' }));
    }
  };

  const handleRevealSolution = () => {
    if (!activeMistake || !machineState) return;
    try {
      const chess = new Chess(activeMistake.fenBefore);
      const from = activeMistake.bestMoveUci.slice(0, 2);
      const to = activeMistake.bestMoveUci.slice(2, 4);
      const promo = activeMistake.bestMoveUci[4] || undefined;
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
    } catch {
      // fallback
    }
  };

  // Step through demonstration line
  const handleSelectDemoStep = (index: number) => {
    if (!activeMistake || index < 0 || index >= activeMistake.demonstrationSteps.length) return;
    setActiveDemoStepIndex(index);
    const step = activeMistake.demonstrationSteps[index];
    setBoardFen(step.fen);
    if (step.uci && step.uci.length >= 4) {
      setLastMove({ from: step.uci.slice(0, 2), to: step.uci.slice(2, 4) });
    }
  };

  const isSolved = machineState?.status === 'correct_feedback';
  const isIncorrect = machineState?.status === 'incorrect_feedback';
  const isRevealed = machineState?.status === 'showing_solution';
  const isDemonstrating = isSolved || isRevealed;

  // If no analysis is available yet
  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center text-accent text-2xl mb-4">
          ♟
        </div>
        <h2 className="text-xl font-semibold text-slate-100 mb-2">Analysis required</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Run engine analysis to detect your opening inaccuracies and explore optimal continuations.
        </p>
        <button
          onClick={onStartFullAnalysis}
          disabled={isAnalyzing}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-medium rounded-xl transition flex items-center space-x-2"
        >
          <Sparkles size={16} />
          <span>{isAnalyzing ? 'Analyzing game...' : 'Analyze opening moves'}</span>
        </button>
      </div>
    );
  }

  // If no opening mistakes were found
  if (!hasOpeningMistakes || mistakes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto my-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Excellent opening play</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          No significant inaccuracies or blunders were found in your opening phase (up to ply {openingBoundary.endPly}). You followed sound opening principles and maintained a solid position.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onOpenFullGame}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-2"
          >
            <span>Review full game</span>
            <ChevronRight size={16} />
          </button>
          <button
            onClick={onFinishReview}
            className="px-5 py-2.5 bg-surface-elevated hover:bg-surface-border text-slate-300 font-medium rounded-xl text-xs transition"
          >
            Back to summary
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 pb-24 md:pb-6 overflow-y-auto bg-background">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
              Opening analysis
            </span>
            <span className="text-xs font-mono text-slate-400">
              {game.eco ? `${game.eco} · ` : ''}
              {game.opening || 'Opening Phase'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-1">
            Opening mistake {currentMistakeIndex + 1} of {mistakes.length}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onFinishReview}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-surface hover:bg-surface-elevated text-slate-300 transition"
          >
            Game summary
          </button>
          <button
            onClick={onOpenFullGame}
            className="px-3.5 py-2 rounded-xl text-xs font-medium bg-surface-elevated hover:bg-surface-border text-slate-200 transition flex items-center space-x-1.5"
          >
            <span>Full game</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
        {/* Left Column: Interactive Chessboard */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[480px] flex items-center justify-between mb-2.5 text-xs text-slate-400">
            <span className="flex items-center space-x-2 font-medium text-slate-200">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeMistake.turn === 'w' ? 'bg-white' : 'bg-slate-900 border border-slate-600'
                }`}
              />
              <span>
                {activeMistake.turn === 'w' ? 'White' : 'Black'} to move (Ply {activeMistake.ply})
              </span>
            </span>
            <span className="text-rose-400 font-medium">
              Played: <span className="font-mono font-bold">{activeMistake.playedSan}</span>
            </span>
          </div>

          <div className="w-full max-w-[min(100vw-2rem,38dvh,480px)] aspect-square flex items-center justify-center">
            <InteractiveChessboard
              fen={boardFen}
              boardOrientation={activeMistake.moverColor}
              turn={isDemonstrating ? undefined : activeMistake.turn}
              allowMoves={machineState?.status === 'awaiting_move'}
              onMove={handleMove}
              lastMove={lastMove}
              highlightSquares={
                showHint && !isDemonstrating
                  ? [activeMistake.bestMoveUci.slice(0, 2)]
                  : []
              }
              maxWidth="100%"
            />
          </div>

          {/* Stepper controls under board if demonstrating */}
          {isDemonstrating && activeMistake.demonstrationSteps.length > 0 && (
            <div className="w-full max-w-[480px] mt-3 p-3 rounded-2xl bg-surface-elevated flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                Engine line ({activeDemoStepIndex + 1}/{activeMistake.demonstrationSteps.length})
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleSelectDemoStep(activeDemoStepIndex - 1)}
                  disabled={activeDemoStepIndex === 0}
                  className="p-1 rounded-lg bg-surface hover:bg-surface-border disabled:opacity-30 text-slate-300 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex space-x-1 font-mono text-[11px] px-2">
                  {activeMistake.demonstrationSteps.map((step, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectDemoStep(idx)}
                      className={`px-2 py-0.5 rounded-md font-bold transition ${
                        activeDemoStepIndex === idx
                          ? 'bg-accent text-black'
                          : 'bg-surface text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {step.san}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleSelectDemoStep(activeDemoStepIndex + 1)}
                  disabled={activeDemoStepIndex >= activeMistake.demonstrationSteps.length - 1}
                  className="p-1 rounded-lg bg-surface hover:bg-surface-border disabled:opacity-30 text-slate-300 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Coach Feedback, Comparison & Progression */}
        <div className="lg:col-span-5 bg-surface rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Mistake Context Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    activeMistake.classification === 'blunder'
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-orange-500/10 text-orange-400'
                  }`}
                >
                  {activeMistake.classification} (CPL -{activeMistake.cpl})
                </span>
                {activeMistake.isRepertoireDeviation && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full font-medium">
                    Repertoire divergence
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-slate-100">
                Find the better continuation
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                In your game, you played <span className="font-mono text-rose-400 font-semibold">{activeMistake.playedSan}</span>.
                Make the move on the board that leads to a healthier, better position.
              </p>
            </div>

            {/* Status Feedback: Correct */}
            {isSolved && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400">
                <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                  <CheckCircle2 size={18} />
                  <span>Correct — you found {activeMistake.bestMoveSan}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {activeMistake.beginnerLesson}
                </p>
              </div>
            )}

            {/* Status Feedback: Incorrect */}
            {isIncorrect && (
              <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-400">
                <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                  <XCircle size={18} />
                  <span>Not the best alternative</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  That move doesn't achieve optimal central control or piece activity. Try another candidate move on the board.
                </p>
              </div>
            )}

            {/* Status Feedback: Revealed */}
            {isRevealed && (
              <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-300">
                <div className="flex items-center space-x-2 font-bold text-sm mb-1">
                  <Eye size={18} />
                  <span>Recommended: {activeMistake.bestMoveSan}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {activeMistake.beginnerLesson}
                </p>
              </div>
            )}

            {/* Hint Box */}
            {showHint && !isDemonstrating && (
              <div className="p-3.5 rounded-2xl bg-surface-elevated text-xs text-slate-300 flex items-start space-x-2.5">
                <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-amber-400 block mb-0.5">Opening hint</span>
                  <span>
                    Look for a move starting from square <span className="font-mono text-sky-400 font-bold uppercase">{activeMistake.bestMoveUci.slice(0, 2)}</span>. Focus on controlling central space and king safety.
                  </span>
                </div>
              </div>
            )}

            {/* Reaching a Better Position Demonstration Box */}
            {isDemonstrating && (
              <div className="p-4 rounded-2xl bg-surface-elevated space-y-3">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold text-accent flex items-center space-x-1.5">
                    <TrendingUp size={14} />
                    <span>How this reaches a better position</span>
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed">
                  {activeMistake.comparison.summaryExplanation}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-surface">
                    <span className="text-slate-400 block text-[11px] font-medium">
                      Material & Dynamics
                    </span>
                    <span className="text-slate-200 font-medium">
                      {activeMistake.comparison.materialAdvantage}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface">
                    <span className="text-slate-400 block text-[11px] font-medium">
                      King Safety
                    </span>
                    <span className="text-slate-200 font-medium">
                      {activeMistake.comparison.kingSafetyComparison}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-5 border-t border-surface-border mt-5">
            {isDemonstrating ? (
              <div className="space-y-2">
                {currentMistakeIndex < mistakes.length - 1 ? (
                  <button
                    onClick={() => setCurrentMistakeIndex((i) => i + 1)}
                    className="w-full py-3 px-4 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-2"
                  >
                    <span>Continue to next mistake</span>
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={onFinishReview}
                    className="w-full py-3 px-4 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-2"
                  >
                    <span>Finish opening review</span>
                    <Award size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHint(true)}
                  disabled={showHint}
                  className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border disabled:opacity-50 text-slate-300 rounded-xl text-xs font-medium transition flex items-center justify-center space-x-1.5"
                >
                  <Lightbulb size={14} className="text-amber-400" />
                  <span>Show hint</span>
                </button>
                <button
                  onClick={handleRevealSolution}
                  className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 rounded-xl text-xs font-medium transition flex items-center justify-center space-x-1.5"
                >
                  <Eye size={14} className="text-slate-400" />
                  <span>Reveal solution</span>
                </button>
              </div>
            )}

            {isIncorrect && (
              <button
                onClick={handleRetry}
                className="w-full py-2.5 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5"
              >
                <RotateCcw size={14} />
                <span>Try again</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
