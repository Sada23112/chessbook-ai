import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/db';
import type { GameRecord } from '../types/chess';

describe('Dexie Database Persistence & Backup', () => {
  beforeEach(async () => {
    await db.games.clear();
    await db.analyses.clear();
    await db.settings.clear();
  });

  it('saves and retrieves game records persistently', async () => {
    const sampleGame: GameRecord = {
      id: 'test_game_1',
      white: 'Alice',
      black: 'Bob',
      result: '1-0',
      date: '2024-05-01',
      pgn: '1. e4 e5 2. Nf3 Nc6 1-0',
      fingerprint: 'fp_abc',
      source: 'upload',
      movesCount: 4,
      createdAt: Date.now(),
    };

    await db.games.put(sampleGame);
    const retrieved = await db.games.get('test_game_1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.white).toBe('Alice');
    expect(retrieved?.movesCount).toBe(4);
  });

  it('loads and stores default settings', async () => {
    const settings = await db.getSettings();
    expect(settings).toBeDefined();
    expect(settings.enginePreset).toBe('standard');
    expect(settings.boardTheme).toBe('emerald');
  });

  it('exports and restores full database backup JSON', async () => {
    const sampleGame: GameRecord = {
      id: 'backup_game_1',
      white: 'Hero',
      black: 'Villain',
      result: '0-1',
      date: '2024-06-01',
      pgn: '1. d4 d5 0-1',
      fingerprint: 'fp_backup',
      source: 'paste',
      movesCount: 2,
      createdAt: Date.now(),
    };

    await db.games.put(sampleGame);
    const backupJson = await db.exportBackup();
    expect(backupJson).toContain('backup_game_1');

    // Clear db
    await db.games.clear();
    expect(await db.games.count()).toBe(0);

    // Restore from backup
    const result = await db.importBackup(backupJson);
    expect(result.importedGames).toBe(1);

    const restoredGame = await db.games.get('backup_game_1');
    expect(restoredGame).toBeDefined();
    expect(restoredGame?.white).toBe('Hero');
  });
});
