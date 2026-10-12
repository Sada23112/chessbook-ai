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
  Award,
  Layers,
  Flame,
} from 'lucide-react';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  OpeningCourse,
  CourseLesson,
  CourseLineRecord,
} from '../../types/chess';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
import { db } from '../../db/db';

export interface OpeningTrainingViewProps {
  repertoire: OpeningRepertoire;
  variation: RepertoireVariation;
  course?: OpeningCourse;
  lesson?: CourseLesson;
  onExitTraining: () => void;
  onSelectNextVariation?: () => void;
  onAdvanceToNextLesson?: (nextLesson: CourseLesson) => void;
}

export const OpeningTrainingView: React.FC<OpeningTrainingViewProps> = ({
  repertoire,
  variation,
  course,
  lesson,
  onExitTraining,
  onSelectNextVariation,
  onAdvanceToNextLesson,
}) => {
  const [plyIndex, setPlyIndex] = useState<number>(0);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [hintsCount, setHintsCount] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [savedRecord, setSavedRecord] = useState<CourseLineRecord | null>(null);

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

  // Variation line index within lesson
  const currentLineIndexInLesson = useMemo(() => {
    if (!lesson) return -1;
    return lesson.variations.findIndex((v) => v.id === variation.id);
  }, [lesson, variation.id]);

  const isLastLineInLesson = useMemo(() => {
    if (!lesson || currentLineIndexInLesson === -1) return false;
    return currentLineIndexInLesson === lesson.variations.length - 1;
  }, [lesson, currentLineIndexInLesson]);

  // Next lesson in course if this lesson is completed
  const nextLessonInCourse = useMemo(() => {
    if (!course || !lesson) return undefined;
    const currentIndex = course.lessons.findIndex((l) => l.id === lesson.id);
    if (currentIndex >= 0 && currentIndex < course.lessons.length - 1) {
      return course.lessons[currentIndex + 1];
    }
    return undefined;
  }, [course, lesson]);

  // Reset training state when variation changes
  useEffect(() => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    setMistakeCount(0);
    setCorrectCount(0);
    setHintsCount(0);
    setIsCompleted(false);
    setIsSuccess(null);
    setShowHint(false);
    setShowResultModal(false);
    setSavedRecord(null);

    // If opening starts with opponent's move (e.g. Black vs 1.e4), auto-play White's move on start
    if (repertoire.color === 'black' && variation.moves.length > 0) {
      setPlyIndex(0);
      opponentTimerRef.current = setTimeout(() => {
        setPlyIndex(1);
        setTrainingStatus('Your turn. Play Black’s opening defense.');
      }, 500);
    } else {
      setPlyIndex(0);
      setTrainingStatus(
        repertoire.color === 'white'
          ? 'Your turn (white). Find the opening move.'
          : 'Opponent is responding...'
      );
    }

    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, [variation.id, repertoire.color, variation.moves]);

  // Save progress record when line finishes
  const handleLineFinished = useCallback(
    async (finalMistakes: number, finalCorrect: number, finalHints: number) => {
      setIsCompleted(true);
      setShowResultModal(true);

      const totalAttempts = finalCorrect + finalMistakes;
      const accuracy =
        totalAttempts > 0
          ? Math.max(0, Math.min(100, Math.round((finalCorrect / totalAttempts) * 100)))
          : 100;

      const isMastered = finalMistakes === 0 && finalHints === 0;
      const status: 'completed' | 'mastered' = isMastered ? 'mastered' : 'completed';

      const courseId = course?.id || `course_${repertoire.id}`;
      const lessonId = lesson?.id || `${repertoire.id}_lvl_1`;

      try {
        const record = await db.recordLineProgress({
          courseId,
          lessonId,
          lineId: variation.id,
          repertoireId: repertoire.id,
          status,
          attemptsCount: 1,
          mistakesCount: finalMistakes,
          correctCount: finalCorrect,
          hintsUsedCount: finalHints,
          accuracy,
          lastPracticed: Date.now(),
        });
        setSavedRecord(record);
      } catch (err) {
        console.warn('Failed to save line progress:', err);
      }

      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.65 },
      });
    },
    [course?.id, lesson?.id, repertoire.id, variation.id]
  );

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
        const newCorrect = correctCount + 1;
        setCorrectCount(newCorrect);

        if (nextPly >= variation.moves.length) {
          // Line completed by user's move!
          setTrainingStatus('Line completed! Excellent repertoire memory.');
          handleLineFinished(mistakeCount, newCorrect, hintsCount);
        } else {
          setTrainingStatus(`✓ Correct! Played ${san}. Opponent responding...`);
          // Schedule opponent reply safely with opponentTimerRef
          opponentTimerRef.current = setTimeout(() => {
            const opponentNextPly = nextPly + 1;
            setPlyIndex(opponentNextPly);
            setIsSuccess(null);

            if (opponentNextPly >= variation.moves.length) {
              setTrainingStatus('Line completed! You mastered this variation.');
              handleLineFinished(mistakeCount, newCorrect, hintsCount);
            } else {
              setTrainingStatus(
                `Your turn again (${repertoire.color}). Find the next repertoire move.`
              );
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
    [
      isCompleted,
      isUserTurn,
      expectedMoveSan,
      plyIndex,
      variation.moves.length,
      repertoire.color,
      correctCount,
      mistakeCount,
      hintsCount,
      handleLineFinished,
    ]
  );

  const handleRestart = () => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    setMistakeCount(0);
    setCorrectCount(0);
    setHintsCount(0);
    setIsCompleted(false);
    setIsSuccess(null);
    setShowHint(false);
    setShowResultModal(false);
    setSavedRecord(null);

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

  const handleRequestHint = () => {
    setShowHint(true);
    setHintsCount((h) => h + 1);
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

  const totalAttempts = correctCount + mistakeCount;
  const currentAccuracy =
    totalAttempts > 0
      ? Math.max(0, Math.min(100, Math.round((correctCount / totalAttempts) * 100)))
      : 100;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background min-h-0 relative">
      {/* Top Header & Session Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={onExitTraining}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border transition flex items-center space-x-1.5 text-xs font-semibold"
          >
            <ArrowLeft size={16} />
            <span>Return to Course</span>
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center space-x-1">
                <Dumbbell size={12} />
                <span>Opening Trainer</span>
              </span>

              {lesson && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-300">
                  Level {lesson.levelNumber}: {lesson.title}
                </span>
              )}

              {variation.eco && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-accent">
                  {variation.eco}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 mt-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {variation.name}
              </h2>
              {lesson && currentLineIndexInLesson >= 0 && (
                <span className="text-xs font-mono text-slate-400">
                  (Line {currentLineIndexInLesson + 1} of {lesson.variations.length})
                </span>
              )}
            </div>

            <p className="text-slate-400 text-xs mt-0.5">
              Playing as{' '}
              <span className="font-semibold text-slate-200 capitalize">
                {repertoire.color}
              </span>{' '}
              • Move {Math.floor(plyIndex / 2) + 1}
            </p>
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="flex items-center space-x-4 text-xs self-start sm:self-auto">
          <div className="flex flex-col items-end">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-slate-300 font-bold">
                {plyIndex} / {variation.moves.length} plies
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {currentAccuracy}% acc
              </span>
            </div>
            <div className="w-28 sm:w-40 h-2 bg-surface-elevated rounded-full overflow-hidden border border-surface-border mt-1">
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
          <div className="w-full max-w-[480px] flex items-center justify-between mb-3 px-1 text-xs">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full border ${
                  currentTurn === 'white'
                    ? 'bg-white border-slate-300'
                    : 'bg-black border-slate-700'
                }`}
              />
              <span className="font-bold text-slate-200 capitalize">
                {currentTurn}&apos;s turn
              </span>
              {isUserTurn ? (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Your Move
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 bg-surface-elevated px-2 py-0.5 rounded border border-surface-border">
                  Waiting for reply...
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              {mistakeCount > 0 && (
                <span className="text-rose-400 font-mono font-bold">
                  {mistakeCount} mistake{mistakeCount > 1 ? 's' : ''}
                </span>
              )}
              {hintsCount > 0 && (
                <span className="text-amber-400 font-mono">
                  {hintsCount} hint{hintsCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Chessboard */}
          <div className="w-full max-w-[480px] bg-surface rounded-2xl p-2 sm:p-3 border border-surface-border shadow-md">
            <InteractiveChessboard
              fen={currentFen}
              boardOrientation={repertoire.color}
              onMove={handleMove}
              disabled={!isUserTurn || isCompleted}
              highlightSquares={hintSquare}
            />
          </div>

          {/* Move Sequence Ribbon */}
          <div className="w-full max-w-[480px] mt-4 flex items-center space-x-1.5 overflow-x-auto py-2 px-1 text-xs font-mono scrollbar-none">
            {variation.moves.map((m, idx) => {
              const isPast = idx < plyIndex;
              const isCurrent = idx === plyIndex;
              const moveNum = Math.floor(idx / 2) + 1;
              const isWhiteMove = idx % 2 === 0;

              return (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded transition shrink-0 ${
                    isCurrent
                      ? 'bg-accent text-black font-bold ring-2 ring-accent/50'
                      : isPast
                      ? 'bg-surface-elevated text-slate-200 border border-surface-border'
                      : 'text-slate-500 bg-surface-elevated/40'
                  }`}
                >
                  {isWhiteMove && <span className="text-slate-400 mr-1">{moveNum}.</span>}
                  {m}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right Column: Training Feedback & Instructions */}
        <div className="lg:col-span-5 bg-surface rounded-2xl border border-surface-border p-5 flex flex-col justify-between min-h-[460px]">
          <div>
            {/* Header info */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <BookOpen size={14} className="text-accent" />
                <span>Trainer Guidance</span>
              </span>

              <span className="text-xs font-mono text-slate-400">
                Move {Math.floor(plyIndex / 2) + 1} of {Math.ceil(variation.moves.length / 2)}
              </span>
            </div>

            {/* Dynamic Status / Feedback Box */}
            <div
              className={`p-4 rounded-xl border mb-5 transition-all ${
                isCompleted
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : isSuccess === true
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : isSuccess === false
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-surface-elevated border-surface-border text-slate-200'
              }`}
            >
              <div className="flex items-start space-x-2.5">
                {isCompleted ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : isSuccess === true ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : isSuccess === false ? (
                  <XCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles size={18} className="text-accent shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-xs mb-1">
                    {isCompleted
                      ? 'Variation Complete!'
                      : isSuccess === true
                      ? 'Correct Move'
                      : isSuccess === false
                      ? 'Incorrect Repertoire Move'
                      : 'Find the Repertoire Move'}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {trainingStatus || 'Play the standard repertoire continuation.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Variation Description / Notes */}
            {variation.description && (
              <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-surface-border mb-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                  Strategic Plan & Key Ideas
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {variation.description}
                </p>
              </div>
            )}

            {/* Hint Box */}
            {showHint && isUserTurn && !isCompleted && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-200 mb-4 flex items-start space-x-2.5">
                <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-amber-400 block mb-0.5">Move Hint</span>
                  <span className="text-slate-300">
                    The expected move is <span className="font-mono font-bold text-accent">{expectedMoveSan}</span>.
                    Look for the piece highlighted on the board.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="space-y-2.5 pt-4 border-t border-surface-border">
            {isCompleted ? (
              <div className="space-y-2">
                {onSelectNextVariation && (
                  <button
                    onClick={onSelectNextVariation}
                    className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow"
                  >
                    <span>
                      {isLastLineInLesson ? 'Proceed to Next Level' : 'Continue to Next Line'}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                )}
                <button
                  onClick={handleRestart}
                  className="w-full py-2.5 px-4 bg-surface-elevated hover:bg-surface-border text-slate-200 font-semibold rounded-xl text-xs border border-surface-border transition flex items-center justify-center space-x-2"
                >
                  <RotateCcw size={15} />
                  <span>Practice This Line Again</span>
                </button>
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
                  onClick={handleRequestHint}
                  className="flex-1 py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5"
                >
                  <Lightbulb size={15} />
                  <span>Show Hint</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleRequestHint}
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

      {/* Line Completion Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="text-center mb-5">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 border ${
                  mistakeCount === 0
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}
              >
                {mistakeCount === 0 ? <Award size={32} /> : <CheckCircle2 size={32} />}
              </div>

              <span className="text-[11px] font-bold uppercase tracking-wider text-accent block mb-1">
                {lesson ? `Level ${lesson.levelNumber}: ${lesson.title}` : 'Opening Repertoire'}
              </span>
              <h3 className="text-xl font-bold text-slate-100">
                {mistakeCount === 0 ? 'Line Mastered! 🌟' : 'Line Completed! 🎉'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{variation.name}</p>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Accuracy
                </span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {currentAccuracy}%
                </span>
              </div>
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Correct Moves
                </span>
                <span className="text-lg font-bold font-mono text-slate-100">
                  {correctCount}
                </span>
              </div>
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-3 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Mistakes
                </span>
                <span
                  className={`text-lg font-bold font-mono ${
                    mistakeCount > 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {mistakeCount}
                </span>
              </div>
            </div>

            {/* Lesson Completion Notice if last line */}
            {isLastLineInLesson && (
              <div className="p-3 rounded-xl bg-accent/15 border border-accent/30 text-xs text-slate-200 mb-5 flex items-center space-x-2.5">
                <Award size={18} className="text-accent shrink-0" />
                <span>
                  <strong className="text-accent block">Level {lesson?.levelNumber} Finished!</strong>
                  You completed all lines in this lesson. Ready to level up!
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {isLastLineInLesson && nextLessonInCourse && onAdvanceToNextLesson ? (
                <button
                  onClick={() => {
                    setShowResultModal(false);
                    onAdvanceToNextLesson(nextLessonInCourse);
                  }}
                  className="w-full py-3 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-md"
                >
                  <span>Proceed to Level {nextLessonInCourse.levelNumber}</span>
                  <ArrowRight size={16} />
                </button>
              ) : onSelectNextVariation ? (
                <button
                  onClick={() => {
                    setShowResultModal(false);
                    onSelectNextVariation();
                  }}
                  className="w-full py-3 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-md"
                >
                  <span>Continue to Next Line</span>
                  <ArrowRight size={16} />
                </button>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowResultModal(false);
                    handleRestart();
                  }}
                  className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-200 font-semibold rounded-xl text-xs border border-surface-border transition flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Retry This Line</span>
                </button>

                <button
                  onClick={() => {
                    setShowResultModal(false);
                    onExitTraining();
                  }}
                  className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white font-semibold rounded-xl text-xs border border-surface-border transition flex items-center justify-center space-x-1.5"
                >
                  <span>Return to Course</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
