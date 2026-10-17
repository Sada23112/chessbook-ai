import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Dumbbell,
  Play,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Clock,
  Compass,
  Layers,
  AlertCircle,
  Award,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  OpeningCourse,
  CourseLesson,
  CourseLineRecord,
  CourseLessonRecord,
  LearningMode,
} from '../../types/chess';
import { db } from '../../db/db';
import {
  buildCourseFromRepertoire,
  calculateCourseProgress,
  calculateLessonProgress,
} from '../../repertoire/courseEngine';
import { CompactBoardPreview } from '../common/CompactBoardPreview';
import {
  Lock,
  ShieldCheck,
  Eye,
} from 'lucide-react';

export interface OpeningCourseViewProps {
  repertoire: OpeningRepertoire;
  onBackToLibrary: () => void;
  onStartLessonTraining: (
    repertoire: OpeningRepertoire,
    lesson: CourseLesson,
    variationId?: string,
    mode?: LearningMode,
    isRecallTest?: boolean
  ) => void;
  onBrowseMoveTree: (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => void;
}

export const OpeningCourseView: React.FC<OpeningCourseViewProps> = ({
  repertoire,
  onBackToLibrary,
  onStartLessonTraining,
  onBrowseMoveTree,
}) => {
  const [lineRecords, setLineRecords] = useState<CourseLineRecord[]>([]);
  const [lessonRecords, setLessonRecords] = useState<CourseLessonRecord[]>([]);
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [isResetting, setIsResetting] = useState(false);

  // Build the structured course from repertoire variations
  const course: OpeningCourse = useMemo(() => {
    return buildCourseFromRepertoire(repertoire);
  }, [repertoire]);

  // Load persistent progress records from Dexie IndexedDB
  const loadProgress = useCallback(async () => {
    try {
      const records = await db.getCourseLinesProgress(course.id);
      setLineRecords(records);
      const lRecs = await db.getCourseLessonsProgress(course.id);
      setLessonRecords(lRecs);
    } catch (err) {
      console.warn('Error loading course progress:', err);
    }
  }, [course.id]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Map of lineId -> CourseLineRecord
  const lineRecordsMap = useMemo(() => {
    const map = new Map<string, CourseLineRecord>();
    for (const rec of lineRecords) {
      map.set(rec.lineId, rec);
    }
    return map;
  }, [lineRecords]);

  // Map of lessonId -> CourseLessonRecord
  const lessonRecordsMap = useMemo(() => {
    const map = new Map<string, CourseLessonRecord>();
    for (const rec of lessonRecords) {
      map.set(rec.lessonId, rec);
    }
    return map;
  }, [lessonRecords]);

  // Overall course progress
  const courseProgress = useMemo(() => {
    return calculateCourseProgress(course, lineRecordsMap);
  }, [course, lineRecordsMap]);

  // Initialize all lessons as expanded by default
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const l of course.lessons) {
      initial[l.id] = true;
    }
    setExpandedLessons(initial);
  }, [course.lessons]);

  const toggleLessonExpanded = (lessonId: string) => {
    setExpandedLessons((prev) => ({
      ...prev,
      [lessonId]: !prev[lessonId],
    }));
  };

  // Find representative variation for preview
  const previewVariation = useMemo(() => {
    return course.lessons[0]?.variations[0] || repertoire.variations?.[0];
  }, [course.lessons, repertoire.variations]);

  const previewPly = Math.min(previewVariation?.moves?.length || 0, 10);

  // Continue Learning handler
  const handleContinueLearning = () => {
    if (!course.lessons || course.lessons.length === 0) return;

    let targetLesson = course.lessons[0];
    let targetVarId = targetLesson.variations[0]?.id;

    if (courseProgress.nextRecommendedLessonId) {
      const foundLesson = course.lessons.find((l) => l.id === courseProgress.nextRecommendedLessonId);
      if (foundLesson) {
        targetLesson = foundLesson;
        targetVarId = courseProgress.nextRecommendedVariationId || foundLesson.variations[0]?.id;
      }
    }

    onStartLessonTraining(repertoire, targetLesson, targetVarId);
  };

  // Start from Beginning handler
  const handleStartFromBeginning = () => {
    if (!course.lessons || course.lessons.length === 0) return;
    const firstLesson = course.lessons[0];
    onStartLessonTraining(repertoire, firstLesson, firstLesson.variations[0]?.id);
  };

  // Review Mistakes handler
  const handleReviewMistakes = () => {
    // Look for lines with mistakes or not completed
    for (const lesson of course.lessons) {
      for (const v of lesson.variations) {
        const record = lineRecordsMap.get(v.id);
        if (record && record.mistakesCount > 0) {
          onStartLessonTraining(repertoire, lesson, v.id);
          return;
        }
      }
    }
    // Fallback to continue learning
    handleContinueLearning();
  };

  // Reset Progress handler
  const handleResetProgress = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset your training progress for this opening course? This will clear all line completions and allow you to learn from scratch.'
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      await db.resetCourseProgress(course.id);
      await loadProgress();
    } catch (err) {
      console.error('Failed to reset course progress:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Status badge styling
  const getStatusBadge = (status: 'not_started' | 'in_progress' | 'completed' | 'mastered') => {
    switch (status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <Award size={12} />
            <span>Mastered</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={12} />
            <span>Completed</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
            <Sparkles size={12} />
            <span>In progress</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
            <span>Not started</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background min-h-0">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          onClick={onBackToLibrary}
          className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-surface hover:bg-surface-elevated text-slate-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-medium"
        >
          <ArrowLeft size={16} />
          <span>Back to library</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onBrowseMoveTree(repertoire)}
            className="px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-border text-slate-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-medium"
          >
            <Compass size={15} className="text-accent" />
            <span>Browse move tree</span>
          </button>

          <button
            onClick={handleResetProgress}
            disabled={isResetting || lineRecords.length === 0}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-surface hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 disabled:opacity-40 transition flex items-center space-x-1 text-xs font-medium"
            title="Reset course progress"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset progress</span>
          </button>
        </div>
      </div>

      {/* Course Header Banner */}
      <div className="bg-surface rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center space-x-2 mb-2.5">
              {previewVariation?.eco && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-surface-elevated text-accent">
                  {previewVariation.eco}
                </span>
              )}
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-surface-elevated text-slate-300 capitalize">
                {repertoire.color} course
              </span>
              {getStatusBadge(courseProgress.status)}
            </div>

            {/* Title & Description */}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight mb-2">
              {course.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
              {course.description}
            </p>

            {/* Quick Summary Meta */}
            <div className="flex flex-wrap items-center gap-5 mt-4 text-xs text-slate-400">
              <div className="flex items-center space-x-1.5">
                <Layers size={14} className="text-accent" />
                <span>{course.lessons.length} Learning Levels</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <BookOpen size={14} className="text-accent" />
                <span>{course.totalLines} Opening Variations</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Clock size={14} className="text-accent" />
                <span>
                  {courseProgress.estimatedMinutesRemaining > 0
                    ? `~${courseProgress.estimatedMinutesRemaining} mins remaining`
                    : 'Course completed'}
                </span>
              </div>
            </div>
          </div>

          {/* Representative Board Preview */}
          {previewVariation && (
            <div className="flex items-center space-x-4 p-3 bg-surface-elevated rounded-2xl shrink-0 self-center md:self-auto">
              <CompactBoardPreview
                moves={previewVariation.moves}
                targetPly={previewPly}
                boardOrientation={repertoire.color}
                size={110}
              />
              <div className="text-xs">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Main line target
                </span>
                <span className="text-xs font-semibold text-slate-200 block truncate max-w-[150px]">
                  {previewVariation.name}
                </span>
                <span className="text-[11px] font-mono text-emerald-400 mt-1 block">
                  Ply {previewPly}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overall Progress & Primary Actions Bar */}
      <div className="bg-surface rounded-2xl p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Progress Visual */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                Course progress
              </span>
              <span className="text-xs font-mono font-semibold text-accent">
                {courseProgress.completedLines} of {courseProgress.totalLines} lines completed ·{' '}
                {courseProgress.percentage}%
              </span>
            </div>

            {/* Visual animated progress bar */}
            <div className="w-full h-2.5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  courseProgress.percentage === 100
                    ? 'bg-emerald-400'
                    : 'bg-accent'
                }`}
                style={{ width: `${courseProgress.percentage}%` }}
              />
            </div>

            {/* Metrics Breakdown Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              <div className="bg-surface-elevated rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Completed
                </span>
                <span className="text-base font-bold font-mono text-slate-100">
                  {courseProgress.completedLines} / {courseProgress.totalLines}
                </span>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Mastered
                </span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {courseProgress.masteredLines}
                </span>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Needs review
                </span>
                <span className="text-base font-bold font-mono text-amber-400">
                  {courseProgress.difficultLines}
                </span>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Time left
                </span>
                <span className="text-base font-bold font-mono text-slate-300">
                  {courseProgress.estimatedMinutesRemaining}m
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 lg:w-56 shrink-0 justify-center">
            <button
              onClick={handleContinueLearning}
              className="py-3 px-4 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-2"
            >
              <Play size={16} className="fill-black" />
              <span>
                {courseProgress.completedLines === 0
                  ? 'Start learning'
                  : courseProgress.percentage === 100
                  ? 'Review all lines'
                  : 'Continue learning'}
              </span>
            </button>

            <button
              onClick={handleStartFromBeginning}
              className="py-2.5 px-4 bg-surface-elevated hover:bg-surface-border text-slate-200 font-medium rounded-xl text-xs transition flex items-center justify-center space-x-2"
            >
              <RotateCcw size={14} />
              <span>Start from beginning</span>
            </button>

            {courseProgress.difficultLines > 0 && (
              <button
                onClick={handleReviewMistakes}
                className="py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium rounded-xl text-xs transition flex items-center justify-center space-x-2"
              >
                <AlertCircle size={14} />
                <span>Review mistakes ({courseProgress.difficultLines})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ordered Lessons List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <Layers size={18} className="text-accent" />
            <span>Course Curriculum ({course.lessons.length} Levels)</span>
          </h2>
          <span className="text-xs text-slate-400">
            Train line-by-line with instant move validation
          </span>
        </div>

        <div className="space-y-4">
          {course.lessons.map((lesson) => {
            const lessonSummary = calculateLessonProgress(
              lesson,
              lineRecordsMap,
              lessonRecordsMap,
              course.lessons
            );
            const isExpanded = !!expandedLessons[lesson.id];

            return (
              <div
                key={lesson.id}
                className={`bg-surface rounded-2xl transition duration-200 overflow-hidden ${
                  lessonSummary.recallTestPassed
                    ? 'ring-1 ring-emerald-500/30'
                    : lessonSummary.isLocked
                    ? 'opacity-60'
                    : ''
                }`}
              >
                {/* Lesson Header Card */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    {/* Level Number Badge */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 ${
                        lessonSummary.recallTestPassed
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : lessonSummary.isLocked
                          ? 'bg-surface-elevated text-slate-500'
                          : lessonSummary.learningStageCompleted
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {lessonSummary.recallTestPassed ? (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                      ) : lessonSummary.isLocked ? (
                        <Lock size={18} className="text-slate-500" />
                      ) : (
                        <span>L{lesson.levelNumber}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-400">
                          Level {lesson.levelNumber}
                        </span>
                        <h3 className="text-sm font-bold text-slate-100">{lesson.title}</h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            lesson.difficulty === 'Beginner'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : lesson.difficulty === 'Intermediate'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                          }`}
                        >
                          {lesson.difficulty}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                        {lesson.description}
                      </p>

                      {/* Two-Stage Progress Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {lessonSummary.isLocked ? (
                          <span className="text-xs font-medium text-amber-400/90 flex items-center space-x-1">
                            <Lock size={12} />
                            <span>Locked: Pass Level {lesson.levelNumber - 1} recall test to unlock</span>
                          </span>
                        ) : (
                          <>
                            <span
                              className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                                lessonSummary.learningStageCompleted
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-surface-elevated text-slate-400'
                              }`}
                            >
                              <Eye size={11} />
                              <span>
                                Stage 1: {lessonSummary.learningStageCompleted ? 'Lines learned ✓' : 'Guided'}
                              </span>
                            </span>

                            <span
                              className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                                lessonSummary.recallTestPassed
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : lessonSummary.learningStageCompleted
                                  ? 'bg-blue-500/10 text-blue-300'
                                  : 'bg-surface-elevated text-slate-500'
                              }`}
                            >
                              <ShieldCheck size={11} />
                              <span>
                                Stage 2:{' '}
                                {lessonSummary.recallTestPassed
                                  ? 'Recall test passed ✓'
                                  : lessonSummary.learningStageCompleted
                                  ? 'Ready for test'
                                  : 'Locked'}
                              </span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Lesson Progress Bar */}
                      <div className="flex items-center space-x-3 text-xs">
                        <div className="w-32 sm:w-48 h-2 bg-surface-elevated rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              lessonSummary.recallTestPassed ? 'bg-emerald-400' : 'bg-accent'
                            }`}
                            style={{ width: `${lessonSummary.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          {lessonSummary.completedLines} of {lessonSummary.totalLines} lines (
                          {lessonSummary.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lesson Controls */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
                    {lessonSummary.isLocked ? (
                      <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-surface-elevated text-slate-500 text-xs font-medium">
                        <Lock size={13} />
                        <span>Locked</span>
                      </div>
                    ) : !lessonSummary.learningStageCompleted ? (
                      <button
                        onClick={() =>
                          onStartLessonTraining(
                            repertoire,
                            lesson,
                            lesson.variations.find((v) => !lineRecordsMap.get(v.id)?.guidedCompleted)?.id ||
                              lesson.variations[0]?.id,
                            'guided',
                            false
                          )
                        }
                        className="py-2 px-3.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 bg-accent hover:bg-accent-hover text-black"
                      >
                        <Eye size={14} />
                        <span>Learn lines (Guided)</span>
                      </button>
                    ) : !lessonSummary.recallTestPassed ? (
                      <button
                        onClick={() =>
                          onStartLessonTraining(
                            repertoire,
                            lesson,
                            lesson.variations[0]?.id,
                            'recall',
                            true
                          )
                        }
                        className="py-2 px-3.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 bg-accent hover:bg-accent-hover text-black"
                      >
                        <ShieldCheck size={14} />
                        <span>Test my memory</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() =>
                            onStartLessonTraining(
                              repertoire,
                              lesson,
                              lesson.variations[0]?.id,
                              'guided',
                              false
                            )
                          }
                          className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-surface-elevated hover:bg-surface-border text-slate-200 transition flex items-center space-x-1"
                        >
                          <Eye size={12} />
                          <span>Guided</span>
                        </button>
                        <button
                          onClick={() =>
                            onStartLessonTraining(
                              repertoire,
                              lesson,
                              lesson.variations[0]?.id,
                              'recall',
                              true
                            )
                          }
                          className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition flex items-center space-x-1"
                        >
                          <ShieldCheck size={12} />
                          <span>Retest</span>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => toggleLessonExpanded(lesson.id)}
                      className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-border text-slate-400 hover:text-white transition"
                      title={isExpanded ? 'Collapse variation lines' : 'Expand variation lines'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Lesson Lines */}
                {isExpanded && (
                  <div className="border-t border-surface-elevated bg-surface-elevated/40 px-5 py-4 space-y-2">
                    <div className="text-xs font-medium text-slate-400 mb-1">
                      Included opening lines ({lesson.variations.length})
                    </div>
                    {lesson.variations.map((v, idx) => {
                      const record = lineRecordsMap.get(v.id);
                      const isLineCompleted =
                        record?.status === 'completed' || record?.status === 'mastered';
                      const isLineMastered = record?.status === 'mastered';

                      return (
                        <div
                          key={v.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-surface hover:bg-surface/80 transition text-xs"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="text-xs font-mono text-slate-500 w-5">
                              #{idx + 1}
                            </span>
                            {v.eco && (
                              <span className="font-mono text-xs font-medium px-1.5 py-0.5 rounded bg-surface-elevated text-accent">
                                {v.eco}
                              </span>
                            )}
                            <div className="min-w-0">
                              <span className="font-medium text-slate-200 block truncate">
                                {v.name}
                              </span>
                              <span className="text-xs font-mono text-slate-400 truncate block">
                                {v.moves.slice(0, 5).join(' ')}... ({v.moves.length} plies)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-auto">
                            {isLineMastered ? (
                              <span className="font-mono text-xs font-semibold text-amber-400 flex items-center space-x-1">
                                <Award size={12} />
                                <span>Mastered</span>
                              </span>
                            ) : isLineCompleted ? (
                              <span className="font-mono text-xs font-semibold text-emerald-400 flex items-center space-x-1">
                                <CheckCircle2 size={12} />
                                <span>Completed</span>
                              </span>
                            ) : record?.attemptsCount ? (
                              <span className="font-mono text-xs text-blue-400">
                                In progress
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Not started</span>
                            )}

                            {record?.accuracy !== undefined && (
                              <span className="font-mono text-xs text-slate-400">
                                {record.accuracy}% acc
                              </span>
                            )}

                            <button
                              onClick={() => onStartLessonTraining(repertoire, lesson, v.id)}
                              className="py-1.5 px-3 rounded-lg bg-surface-elevated hover:bg-surface-border text-slate-200 text-xs font-medium transition flex items-center space-x-1"
                            >
                              <Play size={10} />
                              <span>Train</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
