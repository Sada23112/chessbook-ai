export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type PieceColor = 'white' | 'black';

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missedWin'
  | 'forced'
  | 'book';

export interface TacticalMotif {
  id: string;
  name: string;
  description: string;
}

export interface MoveExplanation {
  playedSan: string;
  bestMoveSan: string;
  evalBefore: number; // White perspective centipawns
  evalAfter: number;
  evalDiff: number; // Mover perspective centipawns lost
  motif?: string;
  consequence: string;
  opponentBestReply?: string;
  beginnerLesson: string;
  practicalAdvice: string;
  isUncertain?: boolean;
}

export interface PositionAnalysis {
  ply: number;
  fen: string;
  move?: {
    from: string;
    to: string;
    san: string;
    color: 'w' | 'b';
    piece: string;
    captured?: string;
    promotion?: string;
  };
  score: number; // Normalized to White-relative centipawns (+ is good for white)
  mate?: number; // In plies/moves to mate; + is white mates, - is black mates
  bestMove: string; // UCI format e.g. "e2e4"
  bestMoveSan?: string;
  pv: string[]; // List of UCI moves
  pvSan?: string[];
  depth: number;
  classification?: MoveClassification;
  cpl?: number; // Centipawn loss (>= 0)
  explanation?: MoveExplanation;
}

export interface AnalysisSummary {
  whiteCPL: number;
  blackCPL: number;
  accuracyWhite: number;
  accuracyBlack: number;
  estimatedEloWhite?: number;
  estimatedEloBlack?: number;
  gameReviewVerdict?: string;
  whiteStats: Record<MoveClassification, number>;
  blackStats: Record<MoveClassification, number>;
  identifiedMotifs: string[];
}

export interface GameRecord {
  id: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: GameResult;
  date: string;
  timeControl?: string;
  opening?: string;
  eco?: string;
  termination?: string;
  pgn: string;
  fingerprint: string;
  source: 'upload' | 'paste' | 'chess.com' | 'lichess';
  userColor?: PieceColor;
  movesCount: number;
  createdAt: number;
  analyzedAt?: number;
  analysisDepth?: number;
  summary?: AnalysisSummary;
}

export interface GameAnalysis {
  gameId: string;
  depth: number;
  engine: string;
  completedAt: number;
  positions: PositionAnalysis[];
  summary: AnalysisSummary;
}

export interface RepertoireMove {
  id: string;
  parentId: string | null;
  fen: string;
  san: string;
  uci: string;
  color: PieceColor;
  ply: number;
  comment?: string;
  isUserMove: boolean;
  frequency?: number;
  children: string[]; // RepertoireMove IDs
}

export interface RepertoireVariation {
  id: string;
  name: string;
  eco?: string;
  moves: string[];
  description?: string;
}

export interface OpeningRepertoire {
  id: string;
  name: string;
  color: PieceColor;
  sideAgainst?: 'e4' | 'd4' | 'other';
  description?: string;
  rootMoves: string[]; // top level move IDs
  allMoves: Record<string, RepertoireMove>;
  variations?: RepertoireVariation[];
  createdAt: number;
  updatedAt: number;
}

export interface CourseLesson {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  variationIds: string[];
  variations: RepertoireVariation[];
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface OpeningCourse {
  id: string;
  repertoireId: string;
  name: string;
  color: PieceColor;
  eco?: string;
  description: string;
  lessons: CourseLesson[];
  totalLines: number;
}

export type LearningMode = 'guided' | 'recall';

export interface TrainingArrow {
  startSquare: string; // e.g. 'g1'
  endSquare: string; // e.g. 'f3'
  color?: string;
  type?: 'solution' | 'hint' | 'variation';
}

export type OpeningTrainingPhase =
  | 'guided_learning'
  | 'guided_move_pending'
  | 'validating_move'
  | 'correct_feedback'
  | 'blind_recall'
  | 'incorrect_feedback'
  | 'line_completed'
  | 'level_learning_completed'
  | 'recall_test'
  | 'level_passed'
  | 'level_failed'
  | 'course_completed';

export interface CourseLineRecord {
  id: string; // `${courseId}_${lineId}`
  courseId: string;
  lessonId: string;
  lineId: string;
  repertoireId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'mastered';
  attemptsCount: number;
  correctCount: number;
  mistakesCount: number;
  hintsUsedCount?: number;
  lastPracticed: number;
  accuracy: number;
  completedAt?: number;
  interruptedPly?: number;
  guidedCompleted?: boolean;
  recallPassed?: boolean;
  learningMode?: LearningMode;
}

export interface CourseLessonRecord {
  id: string; // `${courseId}_${lessonId}`
  courseId: string;
  lessonId: string;
  repertoireId: string;
  learningStageCompleted: boolean;
  recallTestPassed: boolean;
  recallAttemptsCount: number;
  recallMistakesCount: number;
  recallAccuracy: number;
  unlocked: boolean;
  completedAt?: number;
  lastTestedAt?: number;
}

export interface CourseProgressSummary {
  courseId: string;
  totalLines: number;
  completedLines: number;
  masteredLines: number;
  difficultLines: number;
  percentage: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'mastered';
  nextRecommendedLessonId?: string;
  nextRecommendedVariationId?: string;
  estimatedMinutesRemaining: number;
}

export interface LessonProgressSummary {
  lessonId: string;
  levelNumber: number;
  title: string;
  totalLines: number;
  completedLines: number;
  percentage: number;
  isCompleted: boolean;
  isLocked: boolean;
  learningStageCompleted?: boolean;
  recallTestPassed?: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface TrainingCard {
  id: string;
  gameId?: string;
  fen: string;
  turn: 'w' | 'b';
  playedMoveSan: string;
  solutionMovesSan: string[];
  solutionMovesUci: string[];
  continuation?: string[];
  lesson: string;
  motif: string;
  type: 'mistake' | 'opening' | 'tactical';
  repertoireId?: string;
  interval: number; // days
  easeFactor: number; // SM-2 parameter (default 2.5)
  repetitions: number;
  dueDate: number; // timestamp
  lastReviewed?: number;
  lastSuccess?: boolean;
}

export interface WeaknessExample {
  gameId: string;
  gameTitle: string;
  fen: string;
  playedMove: string;
  betterMove: string;
  cpl: number;
  date: string;
}

export interface WeaknessRecord {
  id: string;
  pattern: string;
  title: string;
  description: string;
  occurrences: number;
  lastSeen: number;
  examples: WeaknessExample[];
  improvementStatus: 'worsening' | 'stable' | 'improving';
  priority: 'high' | 'medium' | 'low';
}

export interface UserSettings {
  id: 'default';
  playerUsernames: {
    chessCom?: string;
    lichess?: string;
  };
  preferredColor?: PieceColor;
  enginePreset: 'quick' | 'standard' | 'deep';
  engineDepth: number;
  soundEnabled: boolean;
  autoAnalyzeOnImport: boolean;
  boardTheme: 'standard' | 'emerald' | 'wood' | 'midnight';
  showCoordinates: boolean;
  showEvalBar: boolean;
  showBestMoveArrow: boolean;
  customClassifications?: {
    blunderThreshold: number; // e.g. 200 cpl
    mistakeThreshold: number; // e.g. 90 cpl
    inaccuracyThreshold: number; // e.g. 40 cpl
  };
}
