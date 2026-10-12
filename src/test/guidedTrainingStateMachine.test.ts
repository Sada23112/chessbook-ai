import { describe, it, expect, beforeEach } from 'vitest';
import {
  determineRecommendedMode,
  evaluateRecallTest,
  calculateLessonProgress,
} from '../repertoire/courseEngine';
import { db } from '../db/db';
import type {
  CourseLesson,
  CourseLineRecord,
  CourseLessonRecord,
  RepertoireVariation,
} from '../types/chess';

describe('Guided Learning vs Blind Recall Training Engine', () => {
  beforeEach(async () => {
    if (db.courseLineProgress) {
      await db.courseLineProgress.clear();
    }
    if (db.courseLessonProgress) {
      await db.courseLessonProgress.clear();
    }
  });

  describe('determineRecommendedMode', () => {
    it('recommends guided mode when line has never been attempted', () => {
      expect(determineRecommendedMode(undefined)).toBe('guided');
    });

    it('recommends guided mode when line has attempts but guided stage was not completed', () => {
      const record: CourseLineRecord = {
        id: 'c1_v1',
        courseId: 'c1',
        lessonId: 'l1',
        lineId: 'v1',
        repertoireId: 'r1',
        status: 'in_progress',
        attemptsCount: 2,
        mistakesCount: 1,
        correctCount: 4,
        accuracy: 80,
        lastPracticed: Date.now(),
        guidedCompleted: false,
      };
      expect(determineRecommendedMode(record)).toBe('guided');
    });

    it('recommends guided mode when user made more mistakes than correct moves', () => {
      const record: CourseLineRecord = {
        id: 'c1_v1',
        courseId: 'c1',
        lessonId: 'l1',
        lineId: 'v1',
        repertoireId: 'r1',
        status: 'in_progress',
        attemptsCount: 3,
        mistakesCount: 6,
        correctCount: 2,
        accuracy: 25,
        lastPracticed: Date.now(),
        guidedCompleted: true,
      };
      expect(determineRecommendedMode(record)).toBe('guided');
    });

    it('recommends recall mode when line guided stage is completed and mastered', () => {
      const record: CourseLineRecord = {
        id: 'c1_v1',
        courseId: 'c1',
        lessonId: 'l1',
        lineId: 'v1',
        repertoireId: 'r1',
        status: 'mastered',
        attemptsCount: 2,
        mistakesCount: 0,
        correctCount: 8,
        accuracy: 100,
        lastPracticed: Date.now(),
        guidedCompleted: true,
      };
      expect(determineRecommendedMode(record)).toBe('recall');
    });

    it('recommends recall mode when line guided stage is completed with good accuracy', () => {
      const record: CourseLineRecord = {
        id: 'c1_v1',
        courseId: 'c1',
        lessonId: 'l1',
        lineId: 'v1',
        repertoireId: 'r1',
        status: 'completed',
        attemptsCount: 1,
        mistakesCount: 1,
        correctCount: 7,
        accuracy: 87,
        lastPracticed: Date.now(),
        guidedCompleted: true,
      };
      expect(determineRecommendedMode(record)).toBe('recall');
    });
  });

  describe('evaluateRecallTest', () => {
    const variations: RepertoireVariation[] = [
      { id: 'v1', name: 'Line 1', moves: ['e4', 'e5', 'Nf3', 'Nc6'] },
      { id: 'v2', name: 'Line 2', moves: ['e4', 'c5', 'Nf3', 'd6'] },
    ];

    it('passes when all variations meet accuracy and mistake thresholds', () => {
      const lineRecords = new Map<string, CourseLineRecord>([
        [
          'v1',
          {
            id: 'c_v1',
            courseId: 'c1',
            lessonId: 'l1',
            lineId: 'v1',
            repertoireId: 'r1',
            status: 'mastered',
            attemptsCount: 1,
            mistakesCount: 0,
            correctCount: 4,
            accuracy: 100,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
        [
          'v2',
          {
            id: 'c_v2',
            courseId: 'c1',
            lessonId: 'l1',
            lineId: 'v2',
            repertoireId: 'r1',
            status: 'completed',
            attemptsCount: 1,
            mistakesCount: 1,
            correctCount: 4,
            accuracy: 80,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
      ]);

      const result = evaluateRecallTest(variations, lineRecords);
      expect(result.passed).toBe(true);
      expect(result.failedVariationIds).toHaveLength(0);
      expect(result.accuracy).toBeGreaterThanOrEqual(75);
    });

    it('fails when any variation was not attempted', () => {
      const lineRecords = new Map<string, CourseLineRecord>([
        [
          'v1',
          {
            id: 'c_v1',
            courseId: 'c1',
            lessonId: 'l1',
            lineId: 'v1',
            repertoireId: 'r1',
            status: 'mastered',
            attemptsCount: 1,
            mistakesCount: 0,
            correctCount: 4,
            accuracy: 100,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
      ]);

      const result = evaluateRecallTest(variations, lineRecords);
      expect(result.passed).toBe(false);
      expect(result.failedVariationIds).toContain('v2');
    });

    it('fails when a variation exceeds 2 mistakes or has low accuracy', () => {
      const lineRecords = new Map<string, CourseLineRecord>([
        [
          'v1',
          {
            id: 'c_v1',
            courseId: 'c1',
            lessonId: 'l1',
            lineId: 'v1',
            repertoireId: 'r1',
            status: 'completed',
            attemptsCount: 1,
            mistakesCount: 0,
            correctCount: 4,
            accuracy: 100,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
        [
          'v2',
          {
            id: 'c_v2',
            courseId: 'c1',
            lessonId: 'l1',
            lineId: 'v2',
            repertoireId: 'r1',
            status: 'in_progress',
            attemptsCount: 1,
            mistakesCount: 3, // exceeds limit of 2
            correctCount: 2,
            accuracy: 40,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
      ]);

      const result = evaluateRecallTest(variations, lineRecords);
      expect(result.passed).toBe(false);
      expect(result.failedVariationIds).toContain('v2');
    });
  });

  describe('Two-Stage Progression & Level Locking', () => {
    const lesson1: CourseLesson = {
      id: 'lesson_lvl_1',
      levelNumber: 1,
      title: 'Main Line Fundamentals',
      description: 'Level 1',
      difficulty: 'Beginner',
      variationIds: ['v1', 'v2'],
      variations: [
        { id: 'v1', name: 'Line 1', moves: ['e4', 'e5'] },
        { id: 'v2', name: 'Line 2', moves: ['e4', 'c5'] },
      ],
    };

    const lesson2: CourseLesson = {
      id: 'lesson_lvl_2',
      levelNumber: 2,
      title: 'Common Opponent Responses',
      description: 'Level 2',
      difficulty: 'Intermediate',
      variationIds: ['v3'],
      variations: [
        { id: 'v3', name: 'Line 3', moves: ['e4', 'e6'] },
      ],
    };

    const allLessons = [lesson1, lesson2];

    it('unlocks Level 1 by default', () => {
      const summary1 = calculateLessonProgress(lesson1, new Map(), new Map(), allLessons);
      expect(summary1.isLocked).toBe(false);
      expect(summary1.learningStageCompleted).toBe(false);
      expect(summary1.recallTestPassed).toBe(false);
    });

    it('locks Level 2 until Level 1 passes Stage 2 Recall Test', () => {
      const summary2 = calculateLessonProgress(lesson2, new Map(), new Map(), allLessons);
      expect(summary2.isLocked).toBe(true);
    });

    it('marks Stage 1 complete when all lines have guidedCompleted true', () => {
      const lineMap = new Map<string, CourseLineRecord>([
        [
          'v1',
          {
            id: 'rec_1',
            courseId: 'course_1',
            lessonId: 'lesson_lvl_1',
            lineId: 'v1',
            repertoireId: 'r1',
            status: 'completed',
            attemptsCount: 1,
            mistakesCount: 0,
            correctCount: 2,
            accuracy: 100,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
        [
          'v2',
          {
            id: 'rec_2',
            courseId: 'course_1',
            lessonId: 'lesson_lvl_1',
            lineId: 'v2',
            repertoireId: 'r1',
            status: 'completed',
            attemptsCount: 1,
            mistakesCount: 0,
            correctCount: 2,
            accuracy: 100,
            lastPracticed: Date.now(),
            guidedCompleted: true,
          },
        ],
      ]);

      const summary1 = calculateLessonProgress(lesson1, lineMap, new Map(), allLessons);
      expect(summary1.learningStageCompleted).toBe(true);
      expect(summary1.recallTestPassed).toBe(false);

      // Level 2 should still be locked since Level 1 only finished Stage 1, not Stage 2
      const summary2 = calculateLessonProgress(lesson2, new Map(), new Map(), allLessons);
      expect(summary2.isLocked).toBe(true);
    });

    it('unlocks Level 2 once Level 1 records recallTestPassed: true in Dexie', async () => {
      await db.recordLessonProgress({
        courseId: 'course_1',
        lessonId: 'lesson_lvl_1',
        repertoireId: 'r1',
        learningStageCompleted: true,
        recallTestPassed: true,
        recallAttemptsCount: 1,
        recallMistakesCount: 0,
        recallAccuracy: 100,
        unlocked: true,
        lastTestedAt: Date.now(),
      });

      const lessonRecords = await db.getCourseLessonsProgress('course_1');
      const lessonMap = new Map<string, CourseLessonRecord>();
      for (const rec of lessonRecords) {
        lessonMap.set(rec.lessonId, rec);
      }

      const summary1 = calculateLessonProgress(lesson1, new Map(), lessonMap, allLessons);
      expect(summary1.recallTestPassed).toBe(true);

      const summary2 = calculateLessonProgress(lesson2, new Map(), lessonMap, allLessons);
      expect(summary2.isLocked).toBe(false);
    });
  });

  describe('Dexie Database Lesson Progress Persistence', () => {
    it('saves and fetches lesson progress records', async () => {
      const record = await db.recordLessonProgress({
        courseId: 'course_test_1',
        lessonId: 'lesson_1',
        repertoireId: 'rep_1',
        learningStageCompleted: true,
        recallTestPassed: false,
        recallAttemptsCount: 0,
        recallMistakesCount: 0,
        recallAccuracy: 0,
        unlocked: true,
      });

      expect(record.id).toBe('course_test_1_lesson_1');
      expect(record.learningStageCompleted).toBe(true);
      expect(record.recallTestPassed).toBe(false);

      const fetched = await db.getLessonProgress('course_test_1', 'lesson_1');
      expect(fetched?.learningStageCompleted).toBe(true);
      expect(fetched?.recallTestPassed).toBe(false);

      // Now pass the recall test
      const updated = await db.recordLessonProgress({
        courseId: 'course_test_1',
        lessonId: 'lesson_1',
        repertoireId: 'rep_1',
        learningStageCompleted: true,
        recallTestPassed: true,
        recallAttemptsCount: 1,
        recallMistakesCount: 0,
        recallAccuracy: 100,
        unlocked: true,
      });

      expect(updated.recallTestPassed).toBe(true);

      const list = await db.getCourseLessonsProgress('course_test_1');
      expect(list).toHaveLength(1);
      expect(list[0].recallTestPassed).toBe(true);
    });

    it('resets course lesson progress when resetCourseProgress is called', async () => {
      await db.recordLessonProgress({
        courseId: 'course_to_reset',
        lessonId: 'lesson_1',
        repertoireId: 'rep_1',
        learningStageCompleted: true,
        recallTestPassed: true,
        recallAttemptsCount: 1,
        recallMistakesCount: 0,
        recallAccuracy: 100,
        unlocked: true,
      });

      let list = await db.getCourseLessonsProgress('course_to_reset');
      expect(list).toHaveLength(1);

      await db.resetCourseProgress('course_to_reset');
      list = await db.getCourseLessonsProgress('course_to_reset');
      expect(list).toHaveLength(0);
    });
  });
});
