import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  MASTER_CATALOGUE_OPENINGS,
  searchCatalogue,
  getCatalogueItemById,
  findAntiOpeningGuide,
  getTrapsCatalogue,
  getAntiOpeningsCatalogue,
} from '../repertoire/data/catalogueIndex';
import { copyVariationToRepertoire, createDefaultRepertoire } from '../repertoire/repertoireEngine';

describe('Opening Master Catalogue Dataset', () => {
  it('contains at least 100 comprehensive, curated opening variations', () => {
    expect(MASTER_CATALOGUE_OPENINGS.length).toBeGreaterThanOrEqual(100);
  });

  it('ensures every catalogue item has required properties', () => {
    for (const item of MASTER_CATALOGUE_OPENINGS) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.moves.length).toBeGreaterThan(0);
      expect(item.category).toBeTruthy();
      expect(['white', 'black']).toContain(item.side);
      expect(['Beginner', 'Intermediate', 'Advanced']).toContain(item.difficulty);
      expect(['sound', 'gambit_sound', 'speculative', 'dubious', 'refuted']).toContain(item.soundness);
      expect(Array.isArray(item.tags)).toBe(true);
    }
  });

  it('validates that every single catalogue opening line has 100% legal moves in chess.js', () => {
    for (const item of MASTER_CATALOGUE_OPENINGS) {
      const chess = new Chess();
      for (let i = 0; i < item.moves.length; i++) {
        const san = item.moves[i];
        const move = chess.move(san);
        expect(
          move,
          `Illegal move "${san}" at ply ${i + 1} in catalogue opening "${item.name}" (id: ${item.id})`
        ).toBeTruthy();
      }
    }
  });

  it('validates tactical trap metadata and anti-opening guide consistency', () => {
    const traps = getTrapsCatalogue();
    expect(traps.length).toBeGreaterThanOrEqual(10);

    for (const trapItem of traps) {
      const meta = trapItem.trapMetadata!;
      expect(meta.trapName).toBeTruthy();
      expect(meta.blunderMove).toBeTruthy();
      expect(meta.refutation).toBeTruthy();
      expect(meta.punishmentLine.length).toBeGreaterThan(0);
    }

    const antiOpenings = getAntiOpeningsCatalogue();
    expect(antiOpenings.length).toBeGreaterThanOrEqual(8);

    for (const antiItem of antiOpenings) {
      if (antiItem.antiOpeningGuide) {
        const guide = antiItem.antiOpeningGuide;
        expect(guide.targetOpeningName).toBeTruthy();
        expect(guide.recommendedMoveSan).toBeTruthy();
        expect(guide.opponentThreats.length).toBeGreaterThan(0);
        expect(guide.commonDefenderMistakes.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Catalogue Search and Filter Utilities', () => {
  it('searches openings by name and ECO query', () => {
    const sicilianResults = searchCatalogue('Sicilian');
    expect(sicilianResults.length).toBeGreaterThanOrEqual(10);
    expect(sicilianResults.every((item) => item.name.toLowerCase().includes('sicilian') || item.category === 'sicilian')).toBe(true);

    const b20Results = searchCatalogue('B20');
    expect(b20Results.length).toBeGreaterThanOrEqual(1);
    expect(b20Results.some((item) => item.eco === 'B20')).toBe(true);
  });

  it('filters by quickFilter options correctly', () => {
    const gambits = searchCatalogue('', { quickFilter: 'gambits' });
    expect(gambits.length).toBeGreaterThanOrEqual(10);
    expect(gambits.every((item) => item.tags.includes('gambit'))).toBe(true);

    const traps = searchCatalogue('', { quickFilter: 'traps' });
    expect(traps.length).toBeGreaterThanOrEqual(10);
    expect(traps.every((item) => Boolean(item.trapMetadata) || item.tags.includes('trap'))).toBe(true);

    const anti = searchCatalogue('', { quickFilter: 'anti_openings' });
    expect(anti.length).toBeGreaterThanOrEqual(8);

    const againstE4 = searchCatalogue('', { quickFilter: 'against_e4' });
    expect(againstE4.length).toBeGreaterThanOrEqual(15);
    expect(againstE4.every((item) => item.side === 'black' && item.moves[0] === 'e4')).toBe(true);

    const againstD4 = searchCatalogue('', { quickFilter: 'against_d4' });
    expect(againstD4.length).toBeGreaterThanOrEqual(10);
    expect(againstD4.every((item) => item.side === 'black' && item.moves[0] === 'd4')).toBe(true);
  });

  it('retrieves items by ID and finds anti-opening guides', () => {
    const item = getCatalogueItemById('cat_italian_pianissimo');
    expect(item).toBeDefined();
    expect(item?.name).toContain('Giuoco Pianissimo');

    const staffordGuide = findAntiOpeningGuide('Stafford');
    expect(staffordGuide).toBeDefined();
    expect(staffordGuide?.antiOpeningGuide?.targetOpeningName).toContain('Stafford');

    const englundGuide = findAntiOpeningGuide('Englund');
    expect(englundGuide).toBeDefined();
    expect(englundGuide?.antiOpeningGuide?.targetOpeningName).toContain('Englund');
  });
});

describe('Personal Repertoire Integration', () => {
  it('copies a catalogue variation into a personal repertoire without mutating source', () => {
    const myRepertoire = createDefaultRepertoire('my_white_rep', 'My White Repertoire', 'white');
    expect(myRepertoire.variations).toBeUndefined();
    expect(Object.keys(myRepertoire.allMoves).length).toBe(0);

    const italianItem = getCatalogueItemById('cat_italian_pianissimo');
    expect(italianItem).toBeDefined();

    const updatedRep = copyVariationToRepertoire(myRepertoire, italianItem!);
    expect(updatedRep.variations).toBeDefined();
    expect(updatedRep.variations!.length).toBe(1);
    expect(updatedRep.variations![0].name).toBe(italianItem!.name);
    expect(Object.keys(updatedRep.allMoves).length).toBeGreaterThan(0);
    expect(updatedRep.rootMoves.length).toBe(1); // 1. e4

    // Ensure source catalogue item was not altered
    expect(italianItem?.moves.length).toBeGreaterThan(0);
  });
});
