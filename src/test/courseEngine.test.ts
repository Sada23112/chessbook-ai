import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCourseFromRepertoire,
  calculateLessonProgress,
  calculateCourseProgress,
} from '../repertoire/courseEngine';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  CourseLineRecord,
} from '../types/chess';
import { db } from '../db/db';

describe('Opening Course Engine & Progress System', () => {
  beforeEach(async () => {
    if (db.courseLineProgress) {
      await db.courseLineProgress.clear();
    }
  });

  const createDummyRepertoire = (variationCount: number): OpeningRepertoire => {
    const variations: RepertoireVariation[] = [];
    for (let i = 1; i <= variationCount; i++) {
      variations.push({
        id: `var_${i}`,
        name: `Variation Line ${i}`,
        moves: ['e4', 'e5', 'Nf3', 'Nc6'],
        eco: `C${50 + i}`,
        description: `Description for variation ${i}`,
      });
    }

    return {
      id: `rep_test_${variationCount}`,
      name: `Test Repertoire (${variationCount} lines)`,
      color: 'white',
      rootMoves: [],
      allMoves: {},
      variations,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };

  describe('buildCourseFromRepertoire', () => {
    it('creates 1 level for small repertoires (1-2 lines)', () => {
      const rep = createDummyRepertoire(2);
      const course = buildCourseFromRepertoire(rep);

      expect(course.lessons).toHaveLength(1);
      expect(course.lessons[0].levelNumber).toBe(1);
      expect(course.lessons[0].title).toBe('Main Line Fundamentals');
      expect(course.lessons[0].variations).toHaveLength(2);
      expect(course.totalLines).toBe(2);
    });

    it('creates 2 levels for medium repertoires (3-5 lines)', () => {
      const rep = createDummyRepertoire(5);
      const course = buildCourseFromRepertoire(rep);

      expect(course.lessons).toHaveLength(2);
      expect(course.lessons[0].levelNumber).toBe(1);
      expect(course.lessons[1].levelNumber).toBe(2);
      expect(course.lessons[0].title).toBe('Main Line Fundamentals');
      expect(course.lessons[1].title).toBe('Common Opponent Responses');
      expect(course.totalLines).toBe(5);
      // All variations preserved without alteration
      const combinedVars = [...course.lessons[0].variations, ...course.lessons[1].variations];
      expect(combinedVars).toHaveLength(5);
    });

    it('creates 3-4 levels for larger repertoires (6-9 lines)', () => {
      const rep = createDummyRepertoire(9);
      const course = buildCourseFromRepertoire(rep);

      expect(course.lessons.length).toBeGreaterThanOrEqual(3);
      expect(course.lessons.length).toBeLessThanOrEqual(4);
      expect(course.totalLines).toBe(9);

      const allVars = course.lessons.flatMap((l) => l.variations);
      expect(allVars).toHaveLength(9);
      // Ensure unique lines across levels
      const ids = new Set(allVars.map((v) => v.id));
      expect(ids.size).toBe(9);
    });

    it('creates 5 levels for comprehensive repertoires (10+ lines)', () => {
      const rep = createDummyRepertoire(12);
      const course = buildCourseFromRepertoire(rep);

      expect(course.lessons).toHaveLength(5);
      expect(course.lessons[0].levelNumber).toBe(1);
      expect(course.lessons[4].levelNumber).toBe(5);
      expect(course.lessons[4].title).toContain('Deep Theory');
      expect(course.totalLines).toBe(12);

      const allVars = course.lessons.flatMap((l) => l.variations);
      expect(allVars).toHaveLength(12);
    });

    it('handles repertoires with zero initial variations without throwing', () => {
      const emptyRep: OpeningRepertoire = {
        id: 'rep_empty',
        name: 'Empty Repertoire',
        color: 'black',
        rootMoves: [],
        allMoves: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const course = buildCourseFromRepertoire(emptyRep);
      expect(course.lessons).toHaveLength(1);
      expect(course.lessons[0].variations).toHaveLength(1);
      expect(course.totalLines).toBe(1);
    });
  });

  describe('calculateLessonProgress', () => {
    it('returns 0% and not_started when no lines have records', () => {
      const rep = createDummyRepertoire(3);
      const course = buildCourseFromRepertoire(rep);
      const lesson = course.lessons[0];
      const recordsMap = new Map<string, CourseLineRecord>();

      const progress = calculateLessonProgress(lesson, recordsMap);
      expect(progress.percentage).toBe(0);
      expect(progress.completedLines).toBe(0);
      expect(progress.totalLines).toBe(lesson.variations.length);
      expect(progress.status).toBe('not_started');
      expect(progress.isCompleted).toBe(false);
    });

    it('returns in_progress when partial lines are completed', () => {
      const rep = createDummyRepertoire(4);
      const course = buildCourseFromRepertoire(rep);
      const lesson = course.lessons[0]; // has 2 lines

      const recordsMap = new Map<string, CourseLineRecord>();
      recordsMap.set(lesson.variations[0].id, {
        id: 'rec_1',
        courseId: course.id,
        lessonId: lesson.id,
        lineId: lesson.variations[0].id,
        repertoireId: rep.id,
        status: 'completed',
        attemptsCount: 1,
        mistakesCount: 1,
        correctCount: 4,
        accuracy: 80,
        lastPracticed: Date.now(),
      });

      const progress = calculateLessonProgress(lesson, recordsMap);
      expect(progress.completedLines).toBe(1);
      expect(progress.totalLines).toBe(2);
      expect(progress.percentage).toBe(50);
      expect(progress.status).toBe('in_progress');
      expect(progress.isCompleted).toBe(false);
    });

    it('returns 100% and completed when all lines are mastered or completed', () => {
      const rep = createDummyRepertoire(4);
      const course = buildCourseFromRepertoire(rep);
      const lesson = course.lessons[0];

      const recordsMap = new Map<string, CourseLineRecord>();
      for (const v of lesson.variations) {
        recordsMap.set(v.id, {
          id: `rec_${v.id}`,
          courseId: course.id,
          lessonId: lesson.id,
          lineId: v.id,
          repertoireId: rep.id,
          status: 'mastered',
          attemptsCount: 1,
          mistakesCount: 0,
          correctCount: 5,
          accuracy: 100,
          lastPracticed: Date.now(),
        });
      }

      const progress = calculateLessonProgress(lesson, recordsMap);
      expect(progress.percentage).toBe(100);
      expect(progress.completedLines).toBe(lesson.variations.length);
      expect(progress.status).toBe('completed');
      expect(progress.isCompleted).toBe(true);
    });
  });

  describe('calculateCourseProgress', () => {
    it('returns accurate course progress stats and next recommended line', () => {
      const rep = createDummyRepertoire(4);
      const course = buildCourseFromRepertoire(rep);

      const recordsMap = new Map<string, CourseLineRecord>();
      // Complete line 1
      recordsMap.set(rep.variations![0].id, {
        id: 'rec_1',
        courseId: course.id,
        lessonId: course.lessons[0].id,
        lineId: rep.variations![0].id,
        repertoireId: rep.id,
        status: 'mastered',
        attemptsCount: 1,
        mistakesCount: 0,
        correctCount: 4,
        accuracy: 100,
        lastPracticed: Date.now(),
      });

      const progress = calculateCourseProgress(course, recordsMap);
      expect(progress.totalLines).toBe(4);
      expect(progress.completedLines).toBe(1);
      expect(progress.masteredLines).toBe(1);
      expect(progress.percentage).toBe(25);
      expect(progress.status).toBe('in_progress');
      expect(progress.nextRecommendedVariationId).toBe(rep.variations![1].id);
      expect(progress.estimatedMinutesRemaining).toBe(6); // (4 - 1) * 2 mins
    });

    it('handles course completion when all lines are done', () => {
      const rep = createDummyRepertoire(3);
      const course = buildCourseFromRepertoire(rep);

      const recordsMap = new Map<string, CourseLineRecord>();
      for (const v of rep.variations!) {
        recordsMap.set(v.id, {
          id: `rec_${v.id}`,
          courseId: course.id,
          lessonId: course.lessons[0].id,
          lineId: v.id,
          repertoireId: rep.id,
          status: 'completed',
          attemptsCount: 1,
          mistakesCount: 1,
          correctCount: 4,
          accuracy: 80,
          lastPracticed: Date.now(),
        });
      }

      const progress = calculateCourseProgress(course, recordsMap);
      expect(progress.completedLines).toBe(3);
      expect(progress.percentage).toBe(100);
      expect(progress.status).toBe('completed');
      expect(progress.estimatedMinutesRemaining).toBe(0);
    });

    it('prevents NaN or Infinity division if totalLines is 0', () => {
      const dummyCourse = {
        id: 'empty_c',
        repertoireId: 'empty_r',
        name: 'Empty',
        color: 'white' as const,
        description: '',
        lessons: [],
        totalLines: 0,
      };

      const progress = calculateCourseProgress(dummyCourse, new Map());
      expect(progress.percentage).toBe(0);
      expect(progress.totalLines).toBe(0);
      expect(Number.isNaN(progress.percentage)).toBe(false);
    });
  });

  describe('Dexie Database Course Line Progress Storage', () => {
    it('records and retrieves line progress in courseLineProgress table', async () => {
      const record = await db.recordLineProgress({
        courseId: 'course_test',
        lessonId: 'lvl_1',
        lineId: 'line_italian_1',
        repertoireId: 'rep_white_e4',
        status: 'mastered',
        attemptsCount: 1,
        mistakesCount: 0,
        correctCount: 8,
        accuracy: 100,
        lastPracticed: 1700000000,
      });

      expect(record.id).toBe('course_test_line_italian_1');
      expect(record.status).toBe('mastered');

      const retrieved = await db.getCourseLinesProgress('course_test');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].accuracy).toBe(100);
    });

    it('updates existing record and resets course progress cleanly', async () => {
      await db.recordLineProgress({
        courseId: 'course_reset_test',
        lessonId: 'lvl_1',
        lineId: 'line_1',
        repertoireId: 'rep_1',
        status: 'completed',
        attemptsCount: 1,
        mistakesCount: 2,
        correctCount: 6,
        accuracy: 75,
        lastPracticed: 1700000000,
      });

      // Update same line with improved score
      await db.recordLineProgress({
        courseId: 'course_reset_test',
        lessonId: 'lvl_1',
        lineId: 'line_1',
        repertoireId: 'rep_1',
        status: 'mastered',
        attemptsCount: 2,
        mistakesCount: 0,
        correctCount: 8,
        accuracy: 100,
        lastPracticed: 1700000500,
      });

      let records = await db.getCourseLinesProgress('course_reset_test');
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe('mastered');
      expect(records[0].attemptsCount).toBe(2);

      // Reset course progress
      await db.resetCourseProgress('course_reset_test');
      records = await db.getCourseLinesProgress('course_reset_test');
      expect(records).toHaveLength(0);
    });
  });
});
