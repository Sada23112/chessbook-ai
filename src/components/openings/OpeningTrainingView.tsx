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
  Eye,
  EyeOff,
  Compass,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  OpeningCourse,
  CourseLesson,
  CourseLineRecord,
  CourseLessonRecord,
  TrainingArrow,
  LearningMode,
  OpeningTrainingPhase,
} from '../../types/chess';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
import { db } from '../../db/db';
import {
  getMoveArrow,
  determineRecommendedMode,
  evaluateRecallTest,
  type RecallTestResult,
} from '../../repertoire/courseEngine';

export interface OpeningTrainingViewProps {
  repertoire: OpeningRepertoire;
  variation: RepertoireVariation;
  course?: OpeningCourse;
  lesson?: CourseLesson;
  initialMode?: LearningMode;
  isRecallTest?: boolean;
  onExitTraining: () => void;
  onSelectNextVariation?: () => void;
  onAdvanceToNextLesson?: (nextLesson: CourseLesson) => void;
  onStartRecallTest?: (lesson: CourseLesson) => void;
}

export const OpeningTrainingView: React.FC<OpeningTrainingViewProps> = ({
  repertoire,
  variation,
  course,
  lesson,
  initialMode,
  isRecallTest = false,
  onExitTraining,
  onSelectNextVariation,
  onAdvanceToNextLesson,
  onStartRecallTest,
}) => {
  const [learningMode, setLearningMode] = useState<LearningMode>(initialMode || 'guided');
  const [phase, setPhase] = useState<OpeningTrainingPhase>('guided_learning');

  const [plyIndex, setPlyIndex] = useState<number>(0);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  // Hint and Solution reveal state
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [hintsCount, setHintsCount] = useState<number>(0);
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);

  // Modals & Stage Result state
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [showStage1CompleteModal, setShowStage1CompleteModal] = useState<boolean>(false);
  const [showRecallTestModal, setShowRecallTestModal] = useState<boolean>(false);
  const [recallTestResult, setRecallTestResult] = useState<RecallTestResult | null>(null);
  const [savedRecord, setSavedRecord] = useState<CourseLineRecord | null>(null);

  // Guard against rapid duplicate taps
  const isValidatingRef = useRef<boolean>(false);
  // Dedicated timer ref to avoid race conditions and memory leaks
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

  // Determine and initialize learning mode based on past history or props
  useEffect(() => {
    const initMode = async () => {
      if (isRecallTest) {
        setLearningMode('recall');
        return;
      }
      if (initialMode) {
        setLearningMode(initialMode);
        return;
      }
      try {
        const courseId = course?.id || `course_${repertoire.id}`;
        const record = await db.courseLineProgress.get(`${courseId}_${variation.id}`);
        setLearningMode(determineRecommendedMode(record));
      } catch {
        setLearningMode('guided');
      }
    };
    initMode();
  }, [variation.id, isRecallTest, initialMode, course?.id, repertoire.id]);

  // Reset training state when variation or mode changes
  useEffect(() => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    isValidatingRef.current = false;
    setMistakeCount(0);
    setCorrectCount(0);
    setHintsCount(0);
    setIsSuccess(null);
    setShowHint(false);
    setShowSolution(false);
    setShowResultModal(false);
    setShowStage1CompleteModal(false);
    setShowRecallTestModal(false);
    setRecallTestResult(null);
    setSavedRecord(null);

    const isGuided = learningMode === 'guided';
    setPhase(isGuided ? 'guided_learning' : 'blind_recall');

    // Auto-play opponent's first move if repertoire is Black and ply 0 is White
    if (repertoire.color === 'black' && variation.moves.length > 0) {
      setPlyIndex(0);
      opponentTimerRef.current = setTimeout(() => {
        setPlyIndex(1);
        setTrainingStatus(
          isGuided
            ? `Your turn (Black). Follow the guided move.`
            : `Your turn (Black). Recall the opening defense.`
        );
        setPhase(isGuided ? 'guided_move_pending' : 'blind_recall');
      }, 500);
    } else {
      setPlyIndex(0);
      setTrainingStatus(
        repertoire.color === 'white'
          ? isGuided
            ? 'Your turn (White). Play the guided opening move.'
            : 'Your turn (White). Find the opening move.'
          : 'Opponent is responding...'
      );
      setPhase(isGuided ? 'guided_move_pending' : 'blind_recall');
    }

    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, [variation.id, learningMode, repertoire.color, variation.moves]);

  // Calculate dynamic arrows based on mode, hints, and solution reveals
  const activeArrows: TrainingArrow[] = useMemo(() => {
    if (!isUserTurn || !expectedMoveSan || plyIndex >= variation.moves.length) {
      return [];
    }

    // 1. In Guided Learning: always show solution arrow
    if (learningMode === 'guided') {
      const arrow = getMoveArrow(currentFen, expectedMoveSan, 'solution');
      return arrow ? [arrow] : [];
    }

    // 2. In Blind Recall: only show arrow if user explicitly requested Solution or Hint
    if (showSolution) {
      const arrow = getMoveArrow(currentFen, expectedMoveSan, 'solution');
      return arrow ? [arrow] : [];
    }

    if (showHint) {
      const arrow = getMoveArrow(currentFen, expectedMoveSan, 'hint');
      return arrow ? [arrow] : [];
    }

    return [];
  }, [isUserTurn, expectedMoveSan, plyIndex, variation.moves.length, learningMode, currentFen, showSolution, showHint]);

  // Handles completion of an entire variation line
  const handleLineFinished = useCallback(
    async (finalMistakes: number, finalCorrect: number, finalHints: number) => {
      const totalAttempts = finalCorrect + finalMistakes;
      const accuracy =
        totalAttempts > 0
          ? Math.max(0, Math.min(100, Math.round((finalCorrect / totalAttempts) * 100)))
          : 100;

      const isGuided = learningMode === 'guided';
      const isMastered = finalMistakes === 0 && finalHints === 0 && !showSolution;
      const status: 'completed' | 'mastered' = isMastered ? 'mastered' : 'completed';

      const courseId = course?.id || `course_${repertoire.id}`;
      const lessonId = lesson?.id || `${repertoire.id}_lvl_1`;

      let updatedRecord: CourseLineRecord | null = null;
      try {
        const prev = await db.courseLineProgress.get(`${courseId}_${variation.id}`);
        updatedRecord = await db.recordLineProgress({
          courseId,
          lessonId,
          lineId: variation.id,
          repertoireId: repertoire.id,
          status,
          attemptsCount: (prev?.attemptsCount || 0) + 1,
          mistakesCount: finalMistakes,
          correctCount: finalCorrect,
          hintsUsedCount: finalHints,
          accuracy,
          lastPracticed: Date.now(),
          guidedCompleted: isGuided ? true : prev?.guidedCompleted ?? true,
          recallPassed: !isGuided ? finalMistakes === 0 : prev?.recallPassed ?? false,
          learningMode,
        });
        setSavedRecord(updatedRecord);
      } catch (err) {
        console.warn('Failed to save line progress:', err);
      }

      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.65 },
      });

      // Check level-level stage progression
      if (lesson) {
        try {
          const allLinesProgress = await db.getCourseLinesProgress(courseId);
          const lineMap = new Map<string, CourseLineRecord>();
          for (const rec of allLinesProgress) {
            lineMap.set(rec.lineId, rec);
          }
          if (updatedRecord) {
            lineMap.set(updatedRecord.lineId, updatedRecord);
          }

          // Case A: Running Recall Test and finished the last line
          if (isRecallTest && isLastLineInLesson) {
            const testResult = evaluateRecallTest(lesson.variations, lineMap);
            setRecallTestResult(testResult);

            if (testResult.passed) {
              setPhase('level_passed');
              // Record lesson progress as passed and unlock next level
              await db.recordLessonProgress({
                courseId,
                lessonId: lesson.id,
                repertoireId: repertoire.id,
                learningStageCompleted: true,
                recallTestPassed: true,
                recallAttemptsCount: 1,
                recallMistakesCount: testResult.mistakesCount,
                recallAccuracy: testResult.accuracy,
                unlocked: true,
                completedAt: Date.now(),
                lastTestedAt: Date.now(),
              });

              if (nextLessonInCourse) {
                await db.recordLessonProgress({
                  courseId,
                  lessonId: nextLessonInCourse.id,
                  repertoireId: repertoire.id,
                  learningStageCompleted: false,
                  recallTestPassed: false,
                  recallAttemptsCount: 0,
                  recallMistakesCount: 0,
                  recallAccuracy: 0,
                  unlocked: true,
                });
              } else {
                setPhase('course_completed');
              }
            } else {
              setPhase('level_failed');
            }

            setShowRecallTestModal(true);
            return;
          }

          // Case B: Guided Learning and all lines in lesson are now learned
          if (isGuided) {
            const allGuidedDone = lesson.variations.every(
              (v) => lineMap.get(v.id)?.guidedCompleted === true || v.id === variation.id
            );

            if (allGuidedDone && isLastLineInLesson) {
              setPhase('level_learning_completed');
              await db.recordLessonProgress({
                courseId,
                lessonId: lesson.id,
                repertoireId: repertoire.id,
                learningStageCompleted: true,
                recallTestPassed: false,
                recallAttemptsCount: 0,
                recallMistakesCount: 0,
                recallAccuracy: 0,
                unlocked: true,
              });
              setShowStage1CompleteModal(true);
              return;
            }
          }
        } catch (err) {
          console.warn('Error checking stage progression:', err);
        }
      }

      setPhase('line_completed');
      setShowResultModal(true);
    },
    [
      learningMode,
      showSolution,
      course?.id,
      repertoire.id,
      lesson,
      variation.id,
      isRecallTest,
      isLastLineInLesson,
      nextLessonInCourse,
    ]
  );

  // Handle user's move attempt on the interactive board
  const handleMove = useCallback(
    ({ san }: { san: string }): boolean => {
      // Prevent moves if completed, not user turn, or currently validating
      if (
        phase === 'line_completed' ||
        phase === 'level_passed' ||
        phase === 'level_learning_completed' ||
        !isUserTurn ||
        isValidatingRef.current
      ) {
        return false;
      }

      isValidatingRef.current = true;
      setPhase('validating_move');

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
        setShowSolution(false);
        setPhase('correct_feedback');
        const newCorrect = correctCount + 1;
        setCorrectCount(newCorrect);

        if (nextPly >= variation.moves.length) {
          // Line completed by user's final move
          setTrainingStatus('Line completed! Excellent repertoire recall.');
          handleLineFinished(mistakeCount, newCorrect, hintsCount);
        } else {
          setTrainingStatus(`✓ Correct! Played ${san}. Opponent replying...`);
          // Schedule opponent reply safely
          opponentTimerRef.current = setTimeout(() => {
            const opponentNextPly = nextPly + 1;
            setPlyIndex(opponentNextPly);
            setIsSuccess(null);
            isValidatingRef.current = false;

            if (opponentNextPly >= variation.moves.length) {
              setTrainingStatus('Line completed! You mastered this variation.');
              handleLineFinished(mistakeCount, newCorrect, hintsCount);
            } else {
              setPhase(learningMode === 'guided' ? 'guided_move_pending' : 'blind_recall');
              setTrainingStatus(
                learningMode === 'guided'
                  ? `Your turn (${repertoire.color}). Follow the indicated move.`
                  : `Your turn again (${repertoire.color}). Find the next repertoire move.`
              );
            }
          }, 500);
        }
        return true;
      } else {
        // Move is INCORRECT - do NOT advance
        isValidatingRef.current = false;
        setIsSuccess(false);
        setPhase('incorrect_feedback');
        setMistakeCount((m) => m + 1);

        if (learningMode === 'guided') {
          setTrainingStatus(
            `❌ Move ${san} does not match the guided move (${expectedMoveSan}). Try again!`
          );
        } else {
          setTrainingStatus(
            `❌ Incorrect move (${san}). Expected repertoire move was different. Try again or ask for a hint!`
          );
        }
        return false;
      }
    },
    [
      phase,
      isUserTurn,
      expectedMoveSan,
      plyIndex,
      variation.moves.length,
      correctCount,
      mistakeCount,
      hintsCount,
      learningMode,
      repertoire.color,
      handleLineFinished,
    ]
  );

  // Restart training for the current line
  const handleRestart = () => {
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    isValidatingRef.current = false;
    setMistakeCount(0);
    setCorrectCount(0);
    setHintsCount(0);
    setIsSuccess(null);
    setShowHint(false);
    setShowSolution(false);
    setShowResultModal(false);
    setShowStage1CompleteModal(false);
    setShowRecallTestModal(false);
    setRecallTestResult(null);
    setSavedRecord(null);

    const isGuided = learningMode === 'guided';
    setPhase(isGuided ? 'guided_learning' : 'blind_recall');

    if (repertoire.color === 'black' && variation.moves.length > 0) {
      setPlyIndex(0);
      opponentTimerRef.current = setTimeout(() => {
        setPlyIndex(1);
        setTrainingStatus(
          isGuided
            ? 'Your turn (Black). Follow the guided move.'
            : 'Your turn (Black). Recall the opening defense.'
        );
        setPhase(isGuided ? 'guided_move_pending' : 'blind_recall');
      }, 500);
    } else {
      setPlyIndex(0);
      setTrainingStatus(
        repertoire.color === 'white'
          ? isGuided
            ? 'Your turn (White). Play the guided opening move.'
            : 'Your turn (White). Find the opening move.'
          : 'Opponent is responding...'
      );
      setPhase(isGuided ? 'guided_move_pending' : 'blind_recall');
    }
  };

  const handleRetryCurrentMove = () => {
    setIsSuccess(null);
    setShowHint(false);
    setShowSolution(false);
    setPhase(learningMode === 'guided' ? 'guided_move_pending' : 'blind_recall');
    setTrainingStatus(`Try again (${repertoire.color}). Find the correct move.`);
  };

  const handleRequestHint = () => {
    setShowHint(true);
    setHintsCount((h) => h + 1);
  };

  const handleRevealSolution = () => {
    setShowSolution(true);
    setShowHint(false);
    setMistakeCount((m) => m + 1);
  };

  const handleToggleMode = (newMode: LearningMode) => {
    setLearningMode(newMode);
  };

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
              {/* Learning Mode Indicator Badge */}
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded flex items-center space-x-1.5 border ${
                  isRecallTest
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                    : learningMode === 'guided'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                }`}
              >
                {isRecallTest ? (
                  <>
                    <ShieldCheck size={13} />
                    <span>Stage 2: Blind Recall Test</span>
                  </>
                ) : learningMode === 'guided' ? (
                  <>
                    <Eye size={13} />
                    <span>Mode: Guided Learning</span>
                  </>
                ) : (
                  <>
                    <EyeOff size={13} />
                    <span>Mode: Blind Recall</span>
                  </>
                )}
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

        {/* Right Header: Mode Switcher & Stats */}
        <div className="flex items-center space-x-4 self-start sm:self-auto">
          {!isRecallTest && (
            <div className="flex items-center bg-surface-elevated p-1 rounded-xl border border-surface-border text-xs">
              <button
                onClick={() => handleToggleMode('guided')}
                className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
                  learningMode === 'guided'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Compass size={13} />
                <span>Guided</span>
              </button>
              <button
                onClick={() => handleToggleMode('recall')}
                className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
                  learningMode === 'recall'
                    ? 'bg-accent/20 text-accent font-bold border border-accent/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles size={13} />
                <span>Blind Recall</span>
              </button>
            </div>
          )}

          <div className="flex flex-col items-end text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-slate-300 font-bold">
                {plyIndex} / {variation.moves.length} plies
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {currentAccuracy}% acc
              </span>
            </div>
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
        {/* Left Column: Interactive Board with Move Arrows */}
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

          {/* Interactive Chessboard with dynamic SVG Move Arrow Overlay */}
          <div className="w-full max-w-[480px] bg-surface rounded-2xl p-2 sm:p-3 border border-surface-border shadow-md">
            <InteractiveChessboard
              fen={currentFen}
              boardOrientation={repertoire.color}
              onMove={handleMove}
              disabled={!isUserTurn || phase === 'line_completed'}
              arrows={activeArrows}
            />
          </div>

          {/* Move Sequence Ribbon */}
          <div className="w-full max-w-[480px] mt-4 flex items-center space-x-1.5 overflow-x-auto py-2 px-1 text-xs font-mono scrollbar-none">
            {variation.moves.map((m, idx) => {
              const isPast = idx < plyIndex;
              const isCurrent = idx === plyIndex;
              const moveNum = Math.floor(idx / 2) + 1;
              const isWhiteMove = idx % 2 === 0;

              // Hide future moves during blind recall to prevent leaking answers
              const hideMove = learningMode === 'recall' && !isPast && !showSolution;

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
                  {hideMove ? '•••' : m}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right Column: Training Guidance, Prompts & Move Notation */}
        <div className="lg:col-span-5 bg-surface rounded-2xl border border-surface-border p-5 flex flex-col justify-between min-h-[460px]">
          <div>
            {/* Header info */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <BookOpen size={14} className="text-accent" />
                <span>
                  {learningMode === 'guided'
                    ? 'Guided Learning Mode'
                    : isRecallTest
                    ? 'Blind Recall Test'
                    : 'Blind Recall Mode'}
                </span>
              </span>

              <span className="text-xs font-mono text-slate-400">
                Move {Math.floor(plyIndex / 2) + 1} of {Math.ceil(variation.moves.length / 2)}
              </span>
            </div>

            {/* Guided Move Spotlight (Visible only in Guided mode or when solution revealed) */}
            {isUserTurn && expectedMoveSan && (learningMode === 'guided' || showSolution) && (
              <div className="p-4 rounded-xl bg-accent/15 border border-accent/40 mb-4 animate-in fade-in duration-150">
                <span className="text-[10px] uppercase font-bold text-accent block tracking-wider mb-1">
                  {showSolution ? 'Revealed Solution' : 'Recommended Move'}
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-xl font-bold font-mono text-slate-100">
                    {Math.floor(plyIndex / 2) + 1}.{repertoire.color === 'black' ? '..' : ''}{' '}
                    <span className="text-accent underline decoration-accent/60 underline-offset-4">
                      {expectedMoveSan}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400">
                    (Follow the green arrow on the board)
                  </span>
                </div>
              </div>
            )}

            {/* Dynamic Status / Feedback Box */}
            <div
              className={`p-4 rounded-xl border mb-5 transition-all ${
                phase === 'line_completed'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : isSuccess === true
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : isSuccess === false
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-surface-elevated border-surface-border text-slate-200'
              }`}
            >
              <div className="flex items-start space-x-2.5">
                {phase === 'line_completed' || isSuccess === true ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : isSuccess === false ? (
                  <XCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles size={18} className="text-accent shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-xs mb-1">
                    {phase === 'line_completed'
                      ? 'Variation Complete!'
                      : isSuccess === true
                      ? 'Correct Move'
                      : isSuccess === false
                      ? 'Incorrect Move'
                      : learningMode === 'guided'
                      ? 'Play the Indicated Move'
                      : 'Recall Repertoire Move'}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {trainingStatus ||
                      (learningMode === 'guided'
                        ? 'Follow the green arrow and play the recommended move on the board.'
                        : 'Play the move from memory without looking at hints.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Variation Strategic Notes */}
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

            {/* Hint Notice */}
            {showHint && isUserTurn && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-slate-200 mb-4 flex items-start space-x-2.5">
                <Lightbulb size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-amber-400 block mb-0.5">Move Clue</span>
                  <span className="text-slate-300">
                    A dashed amber arrow has been placed on the board pointing to the target square.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="space-y-2.5 pt-4 border-t border-surface-border">
            {phase === 'line_completed' ? (
              <div className="space-y-2">
                {onSelectNextVariation && (
                  <button
                    onClick={onSelectNextVariation}
                    className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow"
                  >
                    <span>
                      {isLastLineInLesson ? 'Finish Level Lesson' : 'Continue to Next Line'}
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
                {learningMode === 'recall' && (
                  <>
                    <button
                      onClick={handleRequestHint}
                      className="flex-1 py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5"
                    >
                      <Lightbulb size={15} />
                      <span>Show Hint</span>
                    </button>
                    <button
                      onClick={handleRevealSolution}
                      className="py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white rounded-xl text-xs border border-surface-border transition flex items-center justify-center space-x-1"
                      title="Reveal solution arrow"
                    >
                      <Eye size={14} />
                      <span>Reveal</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                {learningMode === 'recall' && (
                  <button
                    onClick={handleRequestHint}
                    disabled={showHint || showSolution}
                    className="flex-1 py-2.5 px-3 bg-surface-elevated hover:bg-surface-border disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold border border-surface-border transition flex items-center justify-center space-x-1.5"
                  >
                    <Lightbulb size={15} className="text-amber-400" />
                    <span>Need a Hint?</span>
                  </button>
                )}
                {learningMode === 'recall' && (
                  <button
                    onClick={handleRevealSolution}
                    disabled={showSolution}
                    className="py-2.5 px-3 bg-surface-elevated hover:bg-surface-border disabled:opacity-40 text-slate-400 hover:text-white rounded-xl text-xs border border-surface-border transition flex items-center space-x-1"
                    title="Reveal expected move arrow"
                  >
                    <Eye size={14} />
                    <span>Reveal</span>
                  </button>
                )}
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

      {/* Modal 1: Standard Line Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="text-center mb-5">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 border ${
                  mistakeCount === 0 && hintsCount === 0
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}
              >
                {mistakeCount === 0 && hintsCount === 0 ? <Award size={32} /> : <CheckCircle2 size={32} />}
              </div>

              <span className="text-[11px] font-bold uppercase tracking-wider text-accent block mb-1">
                {lesson ? `Level ${lesson.levelNumber}: ${lesson.title}` : 'Opening Repertoire'}
              </span>
              <h3 className="text-xl font-bold text-slate-100">
                {learningMode === 'guided'
                  ? 'Line Guided Practice Complete!'
                  : mistakeCount === 0
                  ? 'Line Mastered from Memory! 🌟'
                  : 'Line Recall Finished! 🎉'}
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
                  Correct
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

            {/* Actions */}
            <div className="space-y-2.5">
              {onSelectNextVariation ? (
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
                  <span>Retry Line</span>
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

      {/* Modal 2: Stage 1 Learning Completed Modal (Prompt to Test Memory) */}
      {showStage1CompleteModal && lesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3 border bg-emerald-500/20 border-emerald-500/40 text-emerald-400">
              <CheckCircle2 size={36} />
            </div>

            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              Stage 1 Complete
            </span>
            <h3 className="text-xl font-bold text-slate-100">
              Level {lesson.levelNumber} Lines Learned!
            </h3>
            <p className="text-xs text-slate-300 mt-2 mb-6 leading-relaxed">
              You have studied all {lesson.variations.length} variations in{' '}
              <strong>{lesson.title}</strong> with guided move arrows.
              To unlock the next level, you must pass the <strong>Blind Recall Test</strong> without hints.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setShowStage1CompleteModal(false);
                  if (onStartRecallTest) {
                    onStartRecallTest(lesson);
                  } else {
                    setLearningMode('recall');
                    handleRestart();
                  }
                }}
                className="w-full py-3.5 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg"
              >
                <ShieldCheck size={16} />
                <span>Test My Memory (Start Blind Recall)</span>
              </button>

              <button
                onClick={() => {
                  setShowStage1CompleteModal(false);
                  onExitTraining();
                }}
                className="w-full py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white font-semibold rounded-xl text-xs border border-surface-border transition"
              >
                Return to Course Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Stage 2 Blind Recall Test Result Modal (Pass / Fail) */}
      {showRecallTestModal && recallTestResult && lesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center">
            <div
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3 border ${
                recallTestResult.passed
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
              }`}
            >
              {recallTestResult.passed ? <Award size={36} /> : <AlertCircle size={36} />}
            </div>

            <span
              className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                recallTestResult.passed ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {recallTestResult.passed ? 'Level Passed!' : 'Needs More Practice'}
            </span>
            <h3 className="text-xl font-bold text-slate-100">
              {recallTestResult.passed
                ? `Level ${lesson.levelNumber} Mastered!`
                : `Recall Test Not Passed`}
            </h3>
            <p className="text-xs text-slate-300 mt-2 mb-5 leading-relaxed">
              {recallTestResult.passed
                ? nextLessonInCourse
                  ? `Congratulations! You scored ${recallTestResult.accuracy}% recall accuracy. Level ${nextLessonInCourse.levelNumber} is now unlocked!`
                  : `Masterclass! You completed and recalled all levels in this course!`
                : `You scored ${recallTestResult.accuracy}% recall accuracy with ${recallTestResult.mistakesCount} mistake(s). Review the difficult lines in guided mode before testing again.`}
            </p>

            {/* Test Stats */}
            <div className="grid grid-cols-3 gap-2.5 mb-6 text-center">
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Accuracy
                </span>
                <span
                  className={`text-lg font-bold font-mono ${
                    recallTestResult.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {recallTestResult.accuracy}%
                </span>
              </div>
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Correct
                </span>
                <span className="text-lg font-bold font-mono text-slate-100">
                  {recallTestResult.correctMoves}
                </span>
              </div>
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Mistakes
                </span>
                <span className="text-lg font-bold font-mono text-rose-400">
                  {recallTestResult.mistakesCount}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              {recallTestResult.passed && nextLessonInCourse && onAdvanceToNextLesson ? (
                <button
                  onClick={() => {
                    setShowRecallTestModal(false);
                    onAdvanceToNextLesson(nextLessonInCourse);
                  }}
                  className="w-full py-3.5 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg"
                >
                  <span>Continue to Level {nextLessonInCourse.levelNumber}</span>
                  <ArrowRight size={16} />
                </button>
              ) : !recallTestResult.passed ? (
                <button
                  onClick={() => {
                    setShowRecallTestModal(false);
                    setLearningMode('guided');
                    handleRestart();
                  }}
                  className="w-full py-3.5 px-4 bg-accent hover:bg-accent-hover text-black font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg"
                >
                  <RotateCcw size={15} />
                  <span>Review Lines in Guided Mode</span>
                </button>
              ) : null}

              <button
                onClick={() => {
                  setShowRecallTestModal(false);
                  onExitTraining();
                }}
                className="w-full py-2.5 px-3 bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white font-semibold rounded-xl text-xs border border-surface-border transition"
              >
                Return to Course Curriculum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
