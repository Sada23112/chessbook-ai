import Dexie, { type Table } from 'dexie';
import type {
  GameRecord,
  GameAnalysis,
  OpeningRepertoire,
  TrainingCard,
  WeaknessRecord,
  UserSettings,
  CourseLineRecord,
  CourseLessonRecord,
  RecommendationRecord,
  RecommendationStatus,
} from '../types/chess';

export class ChessbookDatabase extends Dexie {
  games!: Table<GameRecord, string>;
  analyses!: Table<GameAnalysis, string>;
  repertoires!: Table<OpeningRepertoire, string>;
  trainingCards!: Table<TrainingCard, string>;
  weaknesses!: Table<WeaknessRecord, string>;
  settings!: Table<UserSettings, string>;
  courseLineProgress!: Table<CourseLineRecord, string>;
  courseLessonProgress!: Table<CourseLessonRecord, string>;
  recommendationRecords!: Table<RecommendationRecord, string>;

  constructor() {
    super('ChessbookAIDB');

    // Schema version 1
    this.version(1).stores({
      games: 'id, fingerprint, white, black, date, result, analyzedAt, source, createdAt',
      analyses: 'gameId, depth, completedAt',
      repertoires: 'id, color, name, updatedAt',
      trainingCards: 'id, gameId, type, dueDate, repetitions, interval',
      weaknesses: 'id, pattern, occurrences, lastSeen, priority',
      settings: 'id',
    });

    // Schema version 2: Level-based courses & line progress
    this.version(2).stores({
      courseLineProgress: 'id, courseId, lessonId, lineId, repertoireId, status, lastPracticed',
    });

    // Schema version 3: Two-stage level progression & recall test
    this.version(3).stores({
      courseLessonProgress: 'id, courseId, lessonId, repertoireId, learningStageCompleted, recallTestPassed, unlocked',
    });

    // Schema version 4: Personalized opening recommendation tracking
    this.version(4).stores({
      recommendationRecords: 'id, recommendationId, status, dismissed, completedAt, updatedAt',
    });
  }

  async getCourseLinesProgress(courseIdOrRepertoireId: string): Promise<CourseLineRecord[]> {
    const byCourse = await this.courseLineProgress
      .where('courseId')
      .equals(courseIdOrRepertoireId)
      .toArray();
    if (byCourse.length > 0) return byCourse;

    return this.courseLineProgress
      .where('repertoireId')
      .equals(courseIdOrRepertoireId)
      .toArray();
  }

  async recordLineProgress(
    record: Omit<CourseLineRecord, 'id'> & { id?: string }
  ): Promise<CourseLineRecord> {
    const id = record.id || `${record.courseId}_${record.lineId}`;
    const fullRecord: CourseLineRecord = {
      ...record,
      id,
    };
    await this.courseLineProgress.put(fullRecord);
    return fullRecord;
  }

  async getCourseLessonsProgress(courseIdOrRepertoireId: string): Promise<CourseLessonRecord[]> {
    const byCourse = await this.courseLessonProgress
      .where('courseId')
      .equals(courseIdOrRepertoireId)
      .toArray();
    if (byCourse.length > 0) return byCourse;

    return this.courseLessonProgress
      .where('repertoireId')
      .equals(courseIdOrRepertoireId)
      .toArray();
  }

  async getLessonProgress(
    courseId: string,
    lessonId: string
  ): Promise<CourseLessonRecord | undefined> {
    const id = `${courseId}_${lessonId}`;
    return this.courseLessonProgress.get(id);
  }

  async recordLessonProgress(
    record: Omit<CourseLessonRecord, 'id'> & { id?: string }
  ): Promise<CourseLessonRecord> {
    const id = record.id || `${record.courseId}_${record.lessonId}`;
    const fullRecord: CourseLessonRecord = {
      ...record,
      id,
    };
    await this.courseLessonProgress.put(fullRecord);
    return fullRecord;
  }

  async resetCourseProgress(courseIdOrRepertoireId: string): Promise<void> {
    const lineRecords = await this.getCourseLinesProgress(courseIdOrRepertoireId);
    if (lineRecords.length > 0) {
      await this.courseLineProgress.bulkDelete(lineRecords.map((r) => r.id));
    }
    const lessonRecords = await this.getCourseLessonsProgress(courseIdOrRepertoireId);
    if (lessonRecords.length > 0) {
      await this.courseLessonProgress.bulkDelete(lessonRecords.map((r) => r.id));
    }
  }

  async getRecommendationRecords(): Promise<RecommendationRecord[]> {
    return this.recommendationRecords.toArray();
  }

  async getRecommendationRecord(id: string): Promise<RecommendationRecord | undefined> {
    return this.recommendationRecords.get(id);
  }

  async saveRecommendationRecord(record: RecommendationRecord): Promise<void> {
    await this.recommendationRecords.put(record);
  }

  async updateRecommendationStatus(
    recommendationId: string,
    status: RecommendationStatus,
    dismissed: boolean = false
  ): Promise<void> {
    const existing = await this.recommendationRecords.get(recommendationId);
    const now = Date.now();
    await this.recommendationRecords.put({
      id: recommendationId,
      recommendationId,
      status,
      dismissed,
      completedAt: status === 'completed' ? (existing?.completedAt || now) : existing?.completedAt,
      lastPracticed: status === 'in_progress' || status === 'completed' ? now : existing?.lastPracticed,
      updatedAt: now,
    });
  }

  async setRecommendationDismissed(recommendationId: string, dismissed: boolean): Promise<void> {
    const existing = await this.recommendationRecords.get(recommendationId);
    const now = Date.now();
    await this.recommendationRecords.put({
      id: recommendationId,
      recommendationId,
      status: existing?.status || 'not_started',
      dismissed,
      completedAt: existing?.completedAt,
      lastPracticed: existing?.lastPracticed,
      updatedAt: now,
    });
  }

  async getSettings(): Promise<UserSettings> {
    const existing = await this.settings.get('default');
    if (existing) return existing;

    const defaultSettings: UserSettings = {
      id: 'default',
      playerUsernames: {
        chessCom: 'Sada012',
      },
      enginePreset: 'standard',
      engineDepth: 14,
      soundEnabled: true,
      autoAnalyzeOnImport: false,
      boardTheme: 'emerald',
      showCoordinates: true,
      showEvalBar: true,
      showBestMoveArrow: true,
      customClassifications: {
        blunderThreshold: 200,
        mistakeThreshold: 90,
        inaccuracyThreshold: 40,
      },
    };

    await this.settings.put(defaultSettings);
    return defaultSettings;
  }

  async exportBackup(): Promise<string> {
    const [games, analyses, repertoires, trainingCards, weaknesses, settings] =
      await Promise.all([
        this.games.toArray(),
        this.analyses.toArray(),
        this.repertoires.toArray(),
        this.trainingCards.toArray(),
        this.weaknesses.toArray(),
        this.settings.toArray(),
      ]);

    const backup = {
      version: 1,
      exportedAt: Date.now(),
      data: {
        games,
        analyses,
        repertoires,
        trainingCards,
        weaknesses,
        settings,
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  async importBackup(jsonString: string): Promise<{ importedGames: number; importedCards: number }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      throw new Error('Invalid backup format');
    }

    const { games, analyses, repertoires, trainingCards, weaknesses, settings } = parsed.data;

    let importedGames = 0;
    let importedCards = 0;

    await this.transaction('rw', [this.games, this.analyses, this.repertoires, this.trainingCards, this.weaknesses, this.settings], async () => {
      if (Array.isArray(games)) {
        for (const g of games) {
          await this.games.put(g);
          importedGames++;
        }
      }
      if (Array.isArray(analyses)) {
        for (const a of analyses) {
          await this.analyses.put(a);
        }
      }
      if (Array.isArray(repertoires)) {
        for (const r of repertoires) {
          await this.repertoires.put(r);
        }
      }
      if (Array.isArray(trainingCards)) {
        for (const c of trainingCards) {
          await this.trainingCards.put(c);
          importedCards++;
        }
      }
      if (Array.isArray(weaknesses)) {
        for (const w of weaknesses) {
          await this.weaknesses.put(w);
        }
      }
      if (Array.isArray(settings) && settings.length > 0) {
        await this.settings.put(settings[0]);
      }
    });

    return { importedGames, importedCards };
  }
}

export const db = new ChessbookDatabase();
