import type {
  OpeningRepertoire,
  RepertoireVariation,
  OpeningCourse,
  CourseLesson,
  CourseLineRecord,
  CourseProgressSummary,
  LessonProgressSummary,
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
 * Calculates progress for a single lesson based on persistent line records.
 */
export function calculateLessonProgress(
  lesson: CourseLesson,
  lineRecordsMap: Map<string, CourseLineRecord>
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
      status: 'completed',
    };
  }

  let completedLines = 0;
  let attemptedLines = 0;

  for (const v of lesson.variations) {
    const record = lineRecordsMap.get(v.id);
    if (record) {
      if (record.status === 'completed' || record.status === 'mastered') {
        completedLines++;
      }
      if (record.attemptsCount > 0) {
        attemptedLines++;
      }
    }
  }

  const percentage = Math.min(100, Math.round((completedLines / totalLines) * 100));
  const isCompleted = completedLines === totalLines;

  let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
  if (isCompleted) {
    status = 'completed';
  } else if (attemptedLines > 0 || completedLines > 0) {
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
    isLocked: false, // Accessible, level-based recommendation
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
