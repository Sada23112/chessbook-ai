import { describe, it, expect } from 'vitest';
import {
  createDefaultRepertoire,
  addLineToRepertoire,
  detectGameDeviations,
} from '../repertoire/repertoireEngine';
import type { GameRecord } from '../types/chess';

describe('Opening Repertoire Engine', () => {
  it('creates an empty repertoire and adds lines correctly', () => {
    let rep = createDefaultRepertoire('rep_white', 'White Repertoire', 'white');
    expect(rep.color).toBe('white');
    expect(rep.rootMoves).toHaveLength(0);

    // Add Italian line: 1. e4 e5 2. Nf3 Nc6 3. Bc4
    rep = addLineToRepertoire(rep, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 'Italian Game');
    expect(rep.rootMoves).toHaveLength(1);

    const rootNodeId = rep.rootMoves[0];
    const rootNode = rep.allMoves[rootNodeId];
    expect(rootNode.san).toBe('e4');
    expect(rootNode.color).toBe('white');
    expect(rootNode.isUserMove).toBe(true);

    // Check last node comment
    const allNodes = Object.values(rep.allMoves);
    const lastNode = allNodes.find(n => n.san === 'Bc4');
    expect(lastNode).toBeDefined();
    expect(lastNode?.comment).toBe('Italian Game');
  });

  it('detects when a player diverges from their repertoire', () => {
    let rep = createDefaultRepertoire('rep_white', 'White Repertoire', 'white');
    rep = addLineToRepertoire(rep, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);

    // Game where White plays 3. d4 instead of 3. Bc4
    const sampleGame: GameRecord = {
      id: 'g1',
      white: 'Hero',
      black: 'Villain',
      result: '1-0',
      date: '2024-01-01',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 1-0',
      fingerprint: 'fp1',
      source: 'paste',
      userColor: 'white',
      movesCount: 7,
      createdAt: Date.now(),
    };

    const deviations = detectGameDeviations(sampleGame, [rep]);
    expect(deviations).toHaveLength(1);
    expect(deviations[0].ply).toBe(5); // 3. d4 is ply 5 (1.e4 is 1, 1..e5 is 2, 2.Nf3 is 3, 2..Nc6 is 4, 3.d4 is 5)
    expect(deviations[0].playedSan).toBe('d4');
    expect(deviations[0].repertoireSan).toBe('Bc4');
  });
});
