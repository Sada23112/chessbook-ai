import { describe, it, expect } from 'vitest';
import { getGameOutcome, resolveUserColor } from '../utils/gameOutcome';
import type { GameRecord } from '../types/chess';

function makeMockGame(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: 'test_game',
    white: 'PlayerA',
    black: 'PlayerB',
    result: '1-0',
    date: '2026.10.11',
    pgn: '1. e4 e5',
    fingerprint: 'test_fingerprint',
    source: 'upload',
    movesCount: 2,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('Game Outcome & Color Resolution', () => {
  it('correctly resolves user as Black when Sada012 plays Black', () => {
    const game = makeMockGame({
      white: 'licht_d_god',
      black: 'Sada012',
      result: '0-1',
    });
    expect(resolveUserColor(game, 'Sada012')).toBe('black');
  });

  it('correctly resolves user as White when Sada012 plays White', () => {
    const game = makeMockGame({
      white: 'Sada012',
      black: 'aymankhattab19',
      result: '1-0',
    });
    expect(resolveUserColor(game, 'Sada012')).toBe('white');
  });

  it('classifies Black win (0-1) as a WIN (Emerald Green)', () => {
    const game = makeMockGame({
      white: 'licht_d_god',
      black: 'Sada012',
      result: '0-1',
    });
    const outcome = getGameOutcome(game, 'Sada012');
    expect(outcome.isWin).toBe(true);
    expect(outcome.isLoss).toBe(false);
    expect(outcome.label).toBe('WIN');
    expect(outcome.badgeClass).toContain('emerald');
  });

  it('classifies White win (1-0) as a WIN (Emerald Green)', () => {
    const game = makeMockGame({
      white: 'Sada012',
      black: 'aymankhattab19',
      result: '1-0',
    });
    const outcome = getGameOutcome(game, 'Sada012');
    expect(outcome.isWin).toBe(true);
    expect(outcome.isLoss).toBe(false);
    expect(outcome.label).toBe('WIN');
    expect(outcome.badgeClass).toContain('emerald');
  });

  it('classifies White loss (0-1) as a LOSS (Rose Red)', () => {
    const game = makeMockGame({
      white: 'Sada012',
      black: 'PressdoSupreme',
      result: '0-1',
    });
    const outcome = getGameOutcome(game, 'Sada012');
    expect(outcome.isWin).toBe(false);
    expect(outcome.isLoss).toBe(true);
    expect(outcome.label).toBe('LOSS');
    expect(outcome.badgeClass).toContain('rose');
  });

  it('classifies Black loss (1-0) as a LOSS (Rose Red)', () => {
    const game = makeMockGame({
      white: 'SomeOpponent',
      black: 'Sada012',
      result: '1-0',
    });
    const outcome = getGameOutcome(game, 'Sada012');
    expect(outcome.isWin).toBe(false);
    expect(outcome.isLoss).toBe(true);
    expect(outcome.label).toBe('LOSS');
    expect(outcome.badgeClass).toContain('rose');
  });

  it('classifies draws correctly as DRAW (Slate Gray)', () => {
    const game = makeMockGame({
      white: 'Sada012',
      black: 'Opponent',
      result: '1/2-1/2',
    });
    const outcome = getGameOutcome(game, 'Sada012');
    expect(outcome.isDraw).toBe(true);
    expect(outcome.isWin).toBe(false);
    expect(outcome.isLoss).toBe(false);
    expect(outcome.label).toBe('DRAW');
    expect(outcome.badgeClass).toContain('slate');
  });

  it('handles spectator/master games with neutral badges without false win/loss', () => {
    const game = makeMockGame({
      white: 'Garry Kasparov',
      black: 'Veselin Topalov',
      result: '1-0',
    });
    const outcome = getGameOutcome(game, 'Sada012');
    expect(outcome.isWin).toBe(false);
    expect(outcome.isLoss).toBe(false);
    expect(outcome.isDraw).toBe(false);
    expect(outcome.label).toBe('1-0');
  });
});
