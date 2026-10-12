import { Chess } from 'chess.js';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  OpeningCourse,
  CourseLesson,
  CourseLineRecord,
  CourseLessonRecord,
  CourseProgressSummary,
  LessonProgressSummary,
  TrainingArrow,
  LearningMode,
} from '../types/chess';

/**
 * Builds a structured, level-based course from an opening repertoire.
 * Dynamically partitions lines into appropriate lessons without altering
 * or inventing any moves.
 */
export function buildCourseFromRepertoire(repertoire: OpeningRepertoire): OpeningCourse {
  const variations: RepertoireVariation[] = repertoire.variations && repertoire.variations.length > 0
    ? [...repertoire.variations]
    : [
        {
          id: `${repertoire.id}_main`,
          name: `${repertoire.name} (Main Line)`,
          moves: [],
          description: repertoire.description,
        },
      ];

  const totalLines = variations.length;
  const lessons: CourseLesson[] = [];

  if (totalLines <= 2) {
    lessons.push({
      id: `${repertoire.id}_lvl_1`,
      levelNumber: 1,
      title: 'Main Line Fundamentals',
      description: 'Master the core foundational setup and key opening ideas.',
      variationIds: variations.map((v) => v.id),
      variations,
      difficulty: 'Beginner',
    });
  } else if (totalLines <= 5) {
    const splitIndex = Math.min(2, Math.ceil(totalLines / 2));
    const lvl1Vars = variations.slice(0, splitIndex);
    const lvl2Vars = variations.slice(splitIndex);

    lessons.push({
      id: `${repertoire.id}_lvl_1`,
      levelNumber: 1,
      title: 'Main Line Fundamentals',
      description: 'Core theoretical moves and primary piece placement.',
      variationIds: lvl1Vars.map((v) => v.id),
      variations: lvl1Vars,
      difficulty: 'Beginner',
    });

    lessons.push({
      id: `${repertoire.id}_lvl_2`,
      levelNumber: 2,
      title: 'Common Opponent Responses',
      description: 'Key defensive setups and main counter-play lines.',
      variationIds: lvl2Vars.map((v) => v.id),
      variations: lvl2Vars,
      difficulty: 'Intermediate',
    });
  } else if (totalLines <= 9) {
    // 3 to 4 Levels
    const chunkSize = Math.ceil(totalLines / 3);
    const lvl1Vars = variations.slice(0, 2);
    const lvl2Vars = variations.slice(2, 2 + chunkSize);
    const lvl3Vars = variations.slice(2 + chunkSize, 2 + chunkSize * 2);
    const lvl4Vars = variations.slice(2 + chunkSize * 2);

    lessons.push({
      id: `${repertoire.id}_lvl_1`,
      levelNumber: 1,
      title: 'Main Line Fundamentals',
      description: 'Crucial starting lines and development blueprints.',
      variationIds: lvl1Vars.map((v) => v.id),
      variations: lvl1Vars,
      difficulty: 'Beginner',
    });

    if (lvl2Vars.length > 0) {
      lessons.push({
        id: `${repertoire.id}_lvl_2`,
        levelNumber: 2,
        title: 'Primary Counter-Attacks & Defenses',
        description: 'Frequent opponent replies and critical center battles.',
        variationIds: lvl2Vars.map((v) => v.id),
        variations: lvl2Vars,
        difficulty: 'Intermediate',
      });
    }

    if (lvl3Vars.length > 0) {
      lessons.push({
        id: `${repertoire.id}_lvl_3`,
        levelNumber: 3,
        title: 'Sharp Alternatives & Gambits',
        description: 'Combative deviations, gambits, and dynamic branches.',
        variationIds: lvl3Vars.map((v) => v.id),
        variations: lvl3Vars,
        difficulty: 'Intermediate',
      });
    }

    if (lvl4Vars.length > 0) {
      lessons.push({
        id: `${repertoire.id}_lvl_4`,
        levelNumber: 4,
        title: 'Tactical Ideas & Complex Positions',
        description: 'Tactical sharpness, sacrifices, and endgame transitions.',
        variationIds: lvl4Vars.map((v) => v.id),
        variations: lvl4Vars,
        difficulty: 'Advanced',
      });
    }
  } else {
    // 5 Levels for comprehensive master repertoires (10+ variations)
    const perLevel = Math.max(2, Math.floor(totalLines / 5));
    const l1 = variations.slice(0, 3);
    const l2 = variations.slice(3, 3 + perLevel);
    const l3 = variations.slice(3 + perLevel, 3 + perLevel * 2);
    const l4 = variations.slice(3 + perLevel * 2, 3 + perLevel * 3);
    const l5 = variations.slice(3 + perLevel * 3);

    lessons.push({
      id: `${repertoire.id}_lvl_1`,
      levelNumber: 1,
      title: 'Main Line Fundamentals',
      description: 'The golden classical setups and essential piece harmony.',
      variationIds: l1.map((v) => v.id),
      variations: l1,
      difficulty: 'Beginner',
    });

    lessons.push({
      id: `${repertoire.id}_lvl_2`,
      levelNumber: 2,
      title: 'Classical Responses & Counter-Play',
      description: 'Major opponent defensive systems and strategic plans.',
      variationIds: l2.map((v) => v.id),
      variations: l2,
      difficulty: 'Intermediate',
    });

    lessons.push({
      id: `${repertoire.id}_lvl_3`,
      levelNumber: 3,
      title: 'Sharp Alternatives & Dynamic Lines',
      description: 'Uncompromising tactical branches requiring exact memory.',
      variationIds: l3.map((v) => v.id),
      variations: l3,
      difficulty: 'Intermediate',
    });

    lessons.push({
      id: `${repertoire.id}_lvl_4`,
      levelNumber: 4,
      title: 'Tactical Traps & Aggressive Gambits',
      description: 'Punishing mistakes and seizing decisive opening initiative.',
      variationIds: l4.map((v) => v.id),
      variations: l4,
      difficulty: 'Advanced',
    });

    if (l5.length > 0) {
      lessons.push({
        id: `${repertoire.id}_lvl_5`,
        levelNumber: 5,
        title: 'Master Consolidation & Deep Theory',
        description: 'Deep modern master treatments and rare winning sidelines.',
        variationIds: l5.map((v) => v.id),
        variations: l5,
        difficulty: 'Advanced',
      });
    }
  }

  return {
    id: `course_${repertoire.id}`,
    repertoireId: repertoire.id,
    name: repertoire.name,
    color: repertoire.color,
    description: repertoire.description || 'Structured opening repertoire course.',
    lessons,
    totalLines,
  };
}

/**
 * Derives arrow start and end squares from a FEN position and SAN/UCI move string.
 * Supports standard moves, knight moves, and castling (O-O, O-O-O).
 */
export function getMoveArrow(
  fen: string,
  moveSanOrUci: string,
  type: 'solution' | 'hint' | 'variation' = 'solution',
  color?: string
): TrainingArrow | null {
  if (!fen || !moveSanOrUci) return null;
  try {
    // 1. Direct UCI move pattern check (e.g. 'e2e4', 'g1f3')
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(moveSanOrUci)) {
      return {
        startSquare: moveSanOrUci.slice(0, 2).toLowerCase(),
        endSquare: moveSanOrUci.slice(2, 4).toLowerCase(),
        type,
        color,
      };
    }

    // 2. Parse SAN move using chess.js
    const chess = new Chess(fen);
    const move = chess.move(moveSanOrUci);
    if (move) {
      return {
        startSquare: move.from,
        endSquare: move.to,
        type,
        color,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Recommends Guided Learning or Blind Recall based on the line's past learning record.
 */
export function determineRecommendedMode(
  record?: CourseLineRecord
): LearningMode {
  if (!record || record.attemptsCount === 0 || !record.guidedCompleted) {
    return 'guided';
  }
  if (record.status === 'completed' || record.status === 'mastered') {
    return 'recall';
  }
  if (record.mistakesCount > record.correctCount) {
    return 'guided';
  }
  return 'recall';
}

/**
 * Evaluates the results of a level's blind recall test.
 */
export interface RecallTestResult {
  totalPositions: number;
  correctMoves: number;
  mistakesCount: number;
  hintsUsedCount: number;
  accuracy: number;
  passed: boolean;
  failedVariationIds: string[];
}

export function evaluateRecallTest(
  variations: RepertoireVariation[],
  lineRecords: Map<string, CourseLineRecord>
): RecallTestResult {
  let totalPositions = 0;
  let correctMoves = 0;
  let mistakesCount = 0;
  let hintsUsedCount = 0;
  const failedVariationIds: string[] = [];

  for (const v of variations) {
    const rec = lineRecords.get(v.id);
    const userMovesCount = Math.max(1, Math.ceil(v.moves.length / 2));
    totalPositions += userMovesCount;

    if (rec) {
      correctMoves += rec.correctCount;
      mistakesCount += rec.mistakesCount;
      hintsUsedCount += rec.hintsUsedCount || 0;

      // Fail a variation if too many mistakes or heavily hinted
      if (rec.mistakesCount > 2 || (rec.hintsUsedCount || 0) > 2 || rec.accuracy < 60) {
        failedVariationIds.push(v.id);
      }
    } else {
      failedVariationIds.push(v.id);
    }
  }

  const totalAttempts = correctMoves + mistakesCount;
  const accuracy =
    totalAttempts > 0
      ? Math.max(0, Math.min(100, Math.round((correctMoves / totalAttempts) * 100)))
      : 0;

  const passed = failedVariationIds.length === 0 && accuracy >= 75;

  return {
    totalPositions,
    correctMoves,
    mistakesCount,
    hintsUsedCount,
    accuracy,
    passed,
    failedVariationIds,
  };
}

/**
 * Calculates progress for a single lesson based on persistent line records
 * and optional lesson records.
 */
export function calculateLessonProgress(
  lesson: CourseLesson,
  lineRecordsMap: Map<string, CourseLineRecord>,
  lessonRecordsMap?: Map<string, CourseLessonRecord>,
  allLessons?: CourseLesson[]
): LessonProgressSummary {
  const totalLines = lesson.variations.length;
  if (totalLines === 0) {
    return {
      lessonId: lesson.id,
      levelNumber: lesson.levelNumber,
      title: lesson.title,
      totalLines: 0,
      completedLines: 0,
      percentage: 0,
      isCompleted: true,
      isLocked: false,
      learningStageCompleted: true,
      recallTestPassed: true,
      status: 'completed',
    };
  }

  let completedLines = 0;
  let guidedDoneLines = 0;
  let attemptedLines = 0;

  for (const v of lesson.variations) {
    const record = lineRecordsMap.get(v.id);
    if (record) {
      if (record.status === 'completed' || record.status === 'mastered') {
        completedLines++;
      }
      if (record.guidedCompleted || record.status === 'completed' || record.status === 'mastered') {
        guidedDoneLines++;
      }
      if (record.attemptsCount > 0) {
        attemptedLines++;
      }
    }
  }

  const lessonRecord = lessonRecordsMap?.get(lesson.id);
  const learningStageCompleted =
    lessonRecord?.learningStageCompleted || guidedDoneLines === totalLines;
  const recallTestPassed =
    lessonRecord?.recallTestPassed || (completedLines === totalLines && (lessonRecord?.recallTestPassed ?? false));

  // Determine lock state: Level 1 is always unlocked. Level N is unlocked if Level N-1 passed recall test.
  let isLocked = false;
  if (lesson.levelNumber > 1 && allLessons && lessonRecordsMap) {
    const prevLesson = allLessons.find((l) => l.levelNumber === lesson.levelNumber - 1);
    if (prevLesson) {
      const prevRecord = lessonRecordsMap.get(prevLesson.id);
      isLocked = !prevRecord?.recallTestPassed;
    }
  }

  const percentage = Math.min(100, Math.round((completedLines / totalLines) * 100));
  const isCompleted = recallTestPassed || (completedLines === totalLines && learningStageCompleted);

  let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
  if (isCompleted) {
    status = 'completed';
  } else if (attemptedLines > 0 || completedLines > 0 || guidedDoneLines > 0) {
    status = 'in_progress';
  }

  return {
    lessonId: lesson.id,
    levelNumber: lesson.levelNumber,
    title: lesson.title,
    totalLines,
    completedLines,
    percentage,
    isCompleted,
    isLocked,
    learningStageCompleted,
    recallTestPassed,
    status,
  };
}

/**
 * Calculates overall course progress and identifies the next recommended lesson & line.
 */
export function calculateCourseProgress(
  course: OpeningCourse,
  lineRecordsMap: Map<string, CourseLineRecord>
): CourseProgressSummary {
  const totalLines = course.totalLines;
  if (totalLines === 0) {
    return {
      courseId: course.id,
      totalLines: 0,
      completedLines: 0,
      masteredLines: 0,
      difficultLines: 0,
      percentage: 0,
      status: 'not_started',
      estimatedMinutesRemaining: 0,
    };
  }

  let completedLines = 0;
  let masteredLines = 0;
  let difficultLines = 0;

  let nextRecommendedLessonId: string | undefined = undefined;
  let nextRecommendedVariationId: string | undefined = undefined;

  for (const lesson of course.lessons) {
    const lessonSummary = calculateLessonProgress(lesson, lineRecordsMap);

    for (const v of lesson.variations) {
      const record = lineRecordsMap.get(v.id);
      if (record) {
        if (record.status === 'completed' || record.status === 'mastered') {
          completedLines++;
        }
        if (record.status === 'mastered') {
          masteredLines++;
        }
        if (record.mistakesCount > record.correctCount && record.attemptsCount > 0) {
          difficultLines++;
        }
      }

      // First uncompleted line becomes next recommended
      if (!nextRecommendedVariationId) {
        const isDone = record?.status === 'completed' || record?.status === 'mastered';
        if (!isDone) {
          nextRecommendedVariationId = v.id;
          nextRecommendedLessonId = lesson.id;
        }
      }
    }
  }

  // Fallback to first line if everything completed or none set
  if (!nextRecommendedLessonId && course.lessons.length > 0) {
    nextRecommendedLessonId = course.lessons[0].id;
    nextRecommendedVariationId = course.lessons[0].variations[0]?.id;
  }

  const percentage = Math.min(100, Math.round((completedLines / totalLines) * 100));

  let status: 'not_started' | 'in_progress' | 'completed' | 'mastered' = 'not_started';
  if (completedLines === totalLines) {
    status = masteredLines === totalLines ? 'mastered' : 'completed';
  } else if (completedLines > 0 || lineRecordsMap.size > 0) {
    status = 'in_progress';
  }

  const remainingLines = Math.max(0, totalLines - completedLines);
  const estimatedMinutesRemaining = remainingLines * 2; // ~2 mins per line

  return {
    courseId: course.id,
    totalLines,
    completedLines,
    masteredLines,
    difficultLines,
    percentage,
    status,
    nextRecommendedLessonId,
    nextRecommendedVariationId,
    estimatedMinutesRemaining,
  };
}
