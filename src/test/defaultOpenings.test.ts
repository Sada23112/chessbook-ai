import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { MASTER_OPENING_REPERTOIRES, buildMasterRepertoires } from '../repertoire/defaultOpenings';

describe('Master Opening Repertoires Library', () => {
  it('contains comprehensive repertoires across White, Black vs 1.e4, Black vs 1.d4, and Flanks', () => {
    expect(MASTER_OPENING_REPERTOIRES.length).toBeGreaterThanOrEqual(5);

    const whiteE4 = MASTER_OPENING_REPERTOIRES.find((r) => r.id === 'rep_white_e4');
    const whiteD4 = MASTER_OPENING_REPERTOIRES.find((r) => r.id === 'rep_white_d4');
    const blackE4 = MASTER_OPENING_REPERTOIRES.find((r) => r.id === 'rep_black_e4');
    const blackD4 = MASTER_OPENING_REPERTOIRES.find((r) => r.id === 'rep_black_d4');
    const flank = MASTER_OPENING_REPERTOIRES.find((r) => r.id === 'rep_flank_gambits');

    expect(whiteE4).toBeDefined();
    expect(whiteD4).toBeDefined();
    expect(blackE4).toBeDefined();
    expect(blackD4).toBeDefined();
    expect(flank).toBeDefined();

    const totalVariations = MASTER_OPENING_REPERTOIRES.reduce(
      (sum, r) => sum + r.variations.length,
      0
    );
    expect(totalVariations).toBeGreaterThanOrEqual(45);
  });

  it('validates that every single variation has 100% legal moves in chess.js', () => {
    for (const rep of MASTER_OPENING_REPERTOIRES) {
      for (const variation of rep.variations) {
        const chess = new Chess();
        for (let i = 0; i < variation.moves.length; i++) {
          const san = variation.moves[i];
          const move = chess.move(san);
          expect(
            move,
            `Illegal move "${san}" at ply ${i + 1} in variation "${variation.name}" of repertoire "${rep.name}"`
          ).toBeTruthy();
        }
      }
    }
  });

  it('builds full move trees without crashing and assigns rootMoves & allMoves', () => {
    const builtReps = buildMasterRepertoires();
    expect(builtReps.length).toBe(MASTER_OPENING_REPERTOIRES.length);

    for (const rep of builtReps) {
      expect(rep.rootMoves.length).toBeGreaterThan(0);
      const movesCount = Object.keys(rep.allMoves).length;
      expect(movesCount).toBeGreaterThanOrEqual(20);
      expect(rep.variations).toBeDefined();
      expect(rep.variations!.length).toBeGreaterThanOrEqual(5);
    }
  });
});
