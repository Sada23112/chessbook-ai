import { create } from 'zustand';
import type { GameRecord, GameAnalysis, TrainingCard, UserSettings, PieceColor } from '../types/chess';
import { db } from '../db/db';
import { stockfishService } from '../engine/stockfishService';
import { calculateNextReview } from '../training/srsEngine';

export type NavTab =
  | 'dashboard'
  | 'analysis'
  | 'my-games'
  | 'opening-book'
  | 'training'
  | 'progress'
  | 'settings';

interface AppState {
  currentTab: NavTab;
  setTab: (tab: NavTab) => void;

  // Active game in analysis view
  activeGameId: string | null;
  activeGame: GameRecord | null;
  activeAnalysis: GameAnalysis | null;
  currentPly: number;
  boardOrientation: PieceColor;
  isAnalyzing: boolean;
  analysisProgress: { current: number; total: number };
  engineStatus: string;
  analysisStage: 'summary' | 'opening_coach' | 'full_game';
  setAnalysisStage: (stage: 'summary' | 'opening_coach' | 'full_game') => void;

  // Training state
  trainingFilter: 'due' | 'all' | 'mistakes' | 'tactics';
  trainingQueue: TrainingCard[];
  currentCardIndex: number;

  // App settings
  settings: UserSettings | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  setActiveGame: (gameId: string, initialStage?: 'summary' | 'opening_coach' | 'full_game') => Promise<void>;
  setCurrentPly: (ply: number) => void;
  nextPly: () => void;
  prevPly: () => void;
  firstPly: () => void;
  lastPly: () => void;
  flipBoard: () => void;
  startAnalysis: (depth?: number) => Promise<void>;
  stopAnalysis: () => void;
  setTrainingFilter: (filter: 'due' | 'all' | 'mistakes' | 'tactics') => void;
  loadTrainingQueue: () => Promise<void>;
  answerTrainingCard: (cardId: string, isCorrect: boolean) => Promise<void>;
  nextTrainingCard: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTab: 'dashboard',
  setTab: (tab) => set({ currentTab: tab }),

  activeGameId: null,
  activeGame: null,
  activeAnalysis: null,
  currentPly: 0,
  boardOrientation: 'white',
  isAnalyzing: false,
  analysisProgress: { current: 0, total: 0 },
  engineStatus: 'ready',
  analysisStage: 'summary',
  setAnalysisStage: (stage) => set({ analysisStage: stage }),

  trainingFilter: 'due',
  trainingQueue: [],
  currentCardIndex: 0,

  settings: null,

  loadSettings: async () => {
    const settings = await db.getSettings();
    set({ settings });
  },

  updateSettings: async (partial) => {
    const current = get().settings || (await db.getSettings());
    const updated = { ...current, ...partial };
    await db.settings.put(updated);
    set({ settings: updated });
  },

  setActiveGame: async (gameId: string, initialStage: 'summary' | 'opening_coach' | 'full_game' = 'summary') => {
    const game = await db.games.get(gameId);
    if (!game) return;

    const analysis = (await db.analyses.get(gameId)) || null;

    set({
      activeGameId: gameId,
      activeGame: game,
      activeAnalysis: analysis,
      currentPly: 0,
      boardOrientation: game.userColor || 'white',
      analysisStage: initialStage,
      currentTab: 'analysis',
    });
  },

  setCurrentPly: (ply: number) => {
    const { activeAnalysis, activeGame } = get();
    const maxPly = activeAnalysis ? activeAnalysis.positions.length - 1 : activeGame ? activeGame.movesCount : 0;
    const clamped = Math.max(0, Math.min(ply, maxPly));
    set({ currentPly: clamped });
  },

  nextPly: () => {
    const { currentPly } = get();
    get().setCurrentPly(currentPly + 1);
  },

  prevPly: () => {
    const { currentPly } = get();
    get().setCurrentPly(currentPly - 1);
  },

  firstPly: () => {
    get().setCurrentPly(0);
  },

  lastPly: () => {
    const { activeAnalysis, activeGame } = get();
    const maxPly = activeAnalysis ? activeAnalysis.positions.length - 1 : activeGame ? activeGame.movesCount : 0;
    get().setCurrentPly(maxPly);
  },

  flipBoard: () => {
    set((state) => ({
      boardOrientation: state.boardOrientation === 'white' ? 'black' : 'white',
    }));
  },

  startAnalysis: async (depthOverride?: number) => {
    const { activeGame, isAnalyzing, settings } = get();
    if (!activeGame || isAnalyzing) return;

    const targetDepth = depthOverride || settings?.engineDepth || 14;

    set({ isAnalyzing: true, analysisProgress: { current: 0, total: activeGame.movesCount } });

    try {
      const analysis = await stockfishService.analyzeGame(activeGame, {
        depth: targetDepth,
        onProgress: (current, total) => {
          set({ analysisProgress: { current, total } });
        },
      });

      // Reload updated game and analysis
      const updatedGame = await db.games.get(activeGame.id);
      set({
        activeAnalysis: analysis,
        activeGame: updatedGame || activeGame,
        isAnalyzing: false,
      });
    } catch (err) {
      console.warn('Game analysis error:', err);
      set({ isAnalyzing: false });
    }
  },

  stopAnalysis: () => {
    stockfishService.stop();
    set({ isAnalyzing: false });
  },

  setTrainingFilter: (filter) => {
    set({ trainingFilter: filter, currentCardIndex: 0 });
    get().loadTrainingQueue();
  },

  loadTrainingQueue: async () => {
    const { trainingFilter } = get();
    const allCards = await db.trainingCards.toArray();
    const now = Date.now();

    let filtered = allCards;
    if (trainingFilter === 'due') {
      filtered = allCards.filter((c) => c.dueDate <= now);
    } else if (trainingFilter === 'mistakes') {
      filtered = allCards.filter((c) => c.type === 'mistake');
    } else if (trainingFilter === 'tactics') {
      filtered = allCards.filter((c) => c.type === 'tactical');
    }

    set({ trainingQueue: filtered, currentCardIndex: 0 });
  },

  answerTrainingCard: async (cardId: string, isCorrect: boolean) => {
    const card = await db.trainingCards.get(cardId);
    if (!card) return;

    const update = calculateNextReview(card, isCorrect);

    await db.trainingCards.update(cardId, {
      ...update,
      lastReviewed: Date.now(),
      lastSuccess: isCorrect,
    });
    // NOTE: Does NOT advance currentCardIndex automatically so user can review feedback, inspect solution, or retry!
  },

  nextTrainingCard: () => {
    set((state) => ({
      currentCardIndex: state.currentCardIndex + 1,
    }));
  },
}));
