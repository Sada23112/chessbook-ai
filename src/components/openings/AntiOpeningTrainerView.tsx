import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lightbulb,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Flame,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type { LearningMode, TrainingArrow } from '../../types/chess';
import type { CatalogueOpeningItem } from '../../repertoire/data/types';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
import { getMoveArrow } from '../../repertoire/courseEngine';
import {
  getAntiOpeningsCatalogue,
  getCatalogueItemById,
} from '../../repertoire/data/catalogueIndex';

export interface AntiOpeningTrainerViewProps {
  initialOpeningId?: string;
  onExit: () => void;
}

export const AntiOpeningTrainerView: React.FC<AntiOpeningTrainerViewProps> = ({
  initialOpeningId,
  onExit,
}) => {
  const allGuides = useMemo(() => getAntiOpeningsCatalogue(), []);

  // Selected anti-opening item
  const [selectedItem, setSelectedItem] = useState<CatalogueOpeningItem>(() => {
    if (initialOpeningId) {
      const found = getCatalogueItemById(initialOpeningId);
      if (found?.antiOpeningGuide) return found;
    }
    return allGuides[0];
  });

  const guide = selectedItem.antiOpeningGuide!;
  const defendingColor = guide.defendingColor;

  // Mode: Guided vs Recall
  const [learningMode, setLearningMode] = useState<LearningMode>('guided');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showSolution, setShowSolution] = useState<boolean>(false);

  // Playback & practice state
  // currentStepIndex: how many moves of guide.fullDefensiveLine have been applied
  const [stepIndex, setStepIndex] = useState<number>(() => {
    // Start right at the critical ply decision point
    return Math.max(0, guide.criticalPly - 1);
  });
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isValidatingRef = useRef<boolean>(false);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
      }
    };
  }, []);

  // Reset when selected opening changes
  const resetExercise = useCallback((item: CatalogueOpeningItem) => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    isValidatingRef.current = false;
    setSelectedItem(item);
    const g = item.antiOpeningGuide!;
    setStepIndex(Math.max(0, g.criticalPly - 1));
    setIsSuccess(null);
    setFeedbackMessage('');
    setMistakeCount(0);
    setIsComplete(false);
    setShowHint(false);
    setShowSolution(false);
  }, []);

  // Compute current FEN based on guide's full line up to stepIndex
  const currentFen = useMemo(() => {
    const chess = new Chess();
    for (let i = 0; i < stepIndex && i < guide.fullDefensiveLine.length; i++) {
      chess.move(guide.fullDefensiveLine[i]);
    }
    return chess.fen();
  }, [guide.fullDefensiveLine, stepIndex]);

  // Turn in current position
  const currentTurn: 'white' | 'black' = stepIndex % 2 === 0 ? 'white' : 'black';
  const isDefenderTurn = currentTurn === defendingColor;

  // Expected move for defender
  const expectedMoveSan = guide.fullDefensiveLine[stepIndex];

  // Dynamic Move Arrow (Guided Solution / Recall Hint)
  const trainingArrows = useMemo((): TrainingArrow[] => {
    if (!expectedMoveSan || !isDefenderTurn) return [];

    if (learningMode === 'guided' || showSolution) {
      const arr = getMoveArrow(currentFen, expectedMoveSan, 'solution', '#10b981');
      return arr ? [arr] : [];
    }

    if (learningMode === 'recall' && showHint) {
      const arr = getMoveArrow(currentFen, expectedMoveSan, 'hint', '#f59e0b');
      return arr ? [arr] : [];
    }

    return [];
  }, [currentFen, expectedMoveSan, isDefenderTurn, learningMode, showSolution, showHint]);

  // Handle move on board
  const handleMove = useCallback(
    ({ san }: { san: string }): boolean => {
      if (isComplete || !isDefenderTurn || isValidatingRef.current) {
        return false;
      }

      isValidatingRef.current = true;

      if (san === expectedMoveSan) {
        const nextStep = stepIndex + 1;
        setStepIndex(nextStep);
        setIsSuccess(true);
        setShowHint(false);
        setShowSolution(false);
        setFeedbackMessage(`✓ Excellent! ${san} directly neutralizes the threat.`);

        if (nextStep >= guide.fullDefensiveLine.length) {
          // Finished entire defensive line
          setIsComplete(true);
          isValidatingRef.current = false;
          confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
          setFeedbackMessage(
            `Line Complete! You successfully countered ${guide.targetOpeningName}.`
          );
        } else {
          // Opponent replies with next move
          opponentTimerRef.current = setTimeout(() => {
            const oppStep = nextStep + 1;
            setStepIndex(oppStep);
            setIsSuccess(null);
            isValidatingRef.current = false;

            if (oppStep >= guide.fullDefensiveLine.length) {
              setIsComplete(true);
              confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
              setFeedbackMessage(
                `Line Complete! You successfully countered ${guide.targetOpeningName}.`
              );
            }
          }, 800);
        }

        return true;
      } else {
        // Incorrect defensive move
        setIsSuccess(false);
        setMistakeCount((prev) => prev + 1);
        isValidatingRef.current = false;

        const mistakeHint =
          guide.commonDefenderMistakes[0] ||
          'That move does not follow the principled anti-opening line.';
        setFeedbackMessage(`✗ Incorrect move: ${san}. Warning: ${mistakeHint}`);

        return false;
      }
    },
    [isComplete, isDefenderTurn, expectedMoveSan, stepIndex, guide]
  );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-background overflow-y-auto">
      {/* Header Bar */}
      <div className="px-5 py-4 bg-surface border-b border-surface-border/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition"
            title="Return"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm sm:text-base truncate">
                Anti-Opening Trainer
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                Defense & Refutation
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Neutralize aggressive gambits, traps, and tricky sidelines
            </p>
          </div>
        </div>

        {/* Guided vs Recall Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-elevated rounded-xl p-0.5 text-xs">
            <button
              onClick={() => {
                setLearningMode('guided');
                setShowHint(false);
                setShowSolution(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                learningMode === 'guided'
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Eye size={13} />
              <span className="hidden sm:inline">Guided</span>
            </button>
            <button
              onClick={() => {
                setLearningMode('recall');
                setShowHint(false);
                setShowSolution(false);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                learningMode === 'recall'
                  ? 'bg-amber-500/15 text-amber-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <EyeOff size={13} />
              <span className="hidden sm:inline">Recall</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chessboard & Move Ribbon (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center space-y-3">
          {/* Target Opening Selector Header */}
          <div className="w-full bg-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldAlert className="text-amber-400 shrink-0" size={18} />
              <div className="min-w-0">
                <span className="text-xs text-slate-500 block">
                  Defending against
                </span>
                <span className="font-medium text-slate-100 text-sm truncate block">
                  {guide.targetOpeningName}
                </span>
              </div>
            </div>

            {/* Quick Switch Dropdown */}
            <select
              value={selectedItem.id}
              onChange={(e) => {
                const found = getCatalogueItemById(e.target.value);
                if (found && found.antiOpeningGuide) {
                  resetExercise(found);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-surface-elevated text-xs text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-accent/40"
            >
              {allGuides.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.antiOpeningGuide?.targetOpeningName || item.name}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Chessboard */}
          <div className="w-full max-w-[500px]">
            <InteractiveChessboard
              fen={currentFen}
              boardOrientation={defendingColor}
              allowMoves={isDefenderTurn && !isComplete}
              onMove={handleMove}
              arrows={trainingArrows}
              lastMove={
                stepIndex > 0
                  ? {
                      from: '',
                      to: '',
                    }
                  : undefined
              }
            />
          </div>

          {/* Solution Ribbon & Controls */}
          <div className="w-full max-w-[500px] bg-surface rounded-2xl p-4 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs text-slate-500 block mb-0.5">
                {isDefenderTurn ? `Your turn (${defendingColor})` : 'Opponent move'}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-slate-200">
                  {learningMode === 'guided' || showSolution
                    ? `Play ${expectedMoveSan}`
                    : isDefenderTurn
                    ? 'Find the defensive move'
                    : `Opponent plays ${expectedMoveSan}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {learningMode === 'recall' && !showSolution && !isComplete && (
                <>
                  <button
                    onClick={() => setShowHint(true)}
                    className="py-1.5 px-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-amber-300 text-xs font-medium transition flex items-center gap-1"
                  >
                    <Lightbulb size={13} />
                    <span>Hint</span>
                  </button>
                  <button
                    onClick={() => setShowSolution(true)}
                    className="py-1.5 px-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs font-medium transition flex items-center gap-1"
                  >
                    <Eye size={13} />
                    <span>Show</span>
                  </button>
                </>
              )}

              <button
                onClick={() => resetExercise(selectedItem)}
                className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-slate-400 hover:text-white transition"
                title="Reset Position"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedbackMessage && (
            <div
              className={`w-full max-w-[500px] p-3.5 rounded-2xl text-xs font-medium transition animate-in fade-in duration-200 ${
                isSuccess
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-rose-500/10 text-rose-300'
              }`}
            >
              {feedbackMessage}
            </div>
          )}
        </div>

        {/* Right Column: Strategic Threat Analysis & Plan (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Guide Summary Card */}
          <div className="bg-surface rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Recommended Defense
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  guide.isRefutation
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-sky-500/10 text-sky-400'
                }`}
              >
                {guide.isRefutation ? 'Direct Refutation' : 'Neutralization'}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-slate-100">
              {guide.recommendedResponseName}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">{guide.explanation}</p>
          </div>

          {/* Opponent's Threats Card */}
          <div className="bg-surface rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-medium text-xs">
              <AlertTriangle size={14} />
              <span>Opponent’s Main Threats</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {guide.opponentThreats.map((threat, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{threat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Defender's Strategic Plan Card */}
          <div className="bg-surface rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
              <ShieldCheck size={14} />
              <span>Recommended Positional Plan</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {guide.positionalPlan}
            </p>
          </div>

          {/* Common Mistakes to Avoid */}
          <div className="bg-surface rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
              <HelpCircle size={14} />
              <span>Common Defender Mistakes</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {guide.commonDefenderMistakes.map((mistake, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{mistake}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Move Sequence Display */}
          <div className="bg-surface border border-surface-border rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Defensive Move Tree
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-xs">
              {guide.fullDefensiveLine.map((m, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded border ${
                    idx < stepIndex
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : idx === stepIndex
                      ? 'bg-accent/20 text-accent border-accent/40 font-bold ring-1 ring-accent'
                      : 'bg-surface-elevated text-slate-400 border-surface-border'
                  }`}
                >
                  {Math.floor(idx / 2) + 1}
                  {idx % 2 === 0 ? '.' : '...'} {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
