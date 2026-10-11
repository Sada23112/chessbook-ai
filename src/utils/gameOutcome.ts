import type { GameRecord, PieceColor } from '../types/chess';

export interface GameOutcome {
  isWin: boolean;
  isLoss: boolean;
  isDraw: boolean;
  userColor?: PieceColor;
  label: string; // 'WIN' | 'LOSS' | 'DRAW'
  badgeClass: string;
  pillClass: string;
}

/**
 * Resolve which color the active user played.
 * Checks game.userColor first, then matches player names against target usernames (e.g., Sada012).
 */
export function resolveUserColor(
  game: GameRecord,
  targetUsername?: string
): PieceColor | undefined {
  if (game.userColor === 'white' || game.userColor === 'black') {
    return game.userColor;
  }

  const candidateNames = [targetUsername, 'Sada012', 'sada'].filter(
    Boolean
  ) as string[];

  for (const name of candidateNames) {
    const clean = name.trim().toLowerCase();
    if (!clean) continue;

    if (game.white && game.white.toLowerCase().includes(clean)) {
      return 'white';
    }
    if (game.black && game.black.toLowerCase().includes(clean)) {
      return 'black';
    }
  }

  return undefined;
}

/**
 * Determine whether a game was a Win, Loss, or Draw from the user's perspective.
 * Properly accounts for both White wins (1-0) and Black wins (0-1).
 */
export function getGameOutcome(
  game: GameRecord,
  targetUsername?: string
): GameOutcome {
  const userColor = resolveUserColor(game, targetUsername);
  const result = game.result?.trim();

  // Draw check
  if (result === '1/2-1/2') {
    return {
      isWin: false,
      isLoss: false,
      isDraw: true,
      userColor,
      label: 'DRAW',
      badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      pillClass: 'bg-slate-500/20 text-slate-300',
    };
  }

  // When user is White
  if (userColor === 'white') {
    if (result === '1-0') {
      return {
        isWin: true,
        isLoss: false,
        isDraw: false,
        userColor,
        label: 'WIN',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        pillClass: 'bg-emerald-500/20 text-emerald-300',
      };
    } else if (result === '0-1') {
      return {
        isWin: false,
        isLoss: true,
        isDraw: false,
        userColor,
        label: 'LOSS',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        pillClass: 'bg-rose-500/20 text-rose-300',
      };
    }
  }

  // When user is Black
  if (userColor === 'black') {
    if (result === '0-1') {
      return {
        isWin: true,
        isLoss: false,
        isDraw: false,
        userColor,
        label: 'WIN',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        pillClass: 'bg-emerald-500/20 text-emerald-300',
      };
    } else if (result === '1-0') {
      return {
        isWin: false,
        isLoss: true,
        isDraw: false,
        userColor,
        label: 'LOSS',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        pillClass: 'bg-rose-500/20 text-rose-300',
      };
    }
  }

  // Neutral or spectator game (e.g. master game where user is not playing)
  if (result === '1-0') {
    return {
      isWin: false,
      isLoss: false,
      isDraw: false,
      userColor: undefined,
      label: '1-0',
      badgeClass: 'bg-slate-700/50 text-slate-200 border-slate-600/40',
      pillClass: 'bg-slate-700 text-slate-200',
    };
  } else if (result === '0-1') {
    return {
      isWin: false,
      isLoss: false,
      isDraw: false,
      userColor: undefined,
      label: '0-1',
      badgeClass: 'bg-slate-700/50 text-slate-200 border-slate-600/40',
      pillClass: 'bg-slate-700 text-slate-200',
    };
  }

  return {
    isWin: false,
    isLoss: false,
    isDraw: false,
    userColor: undefined,
    label: result || '*',
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    pillClass: 'bg-slate-800 text-slate-400',
  };
}
