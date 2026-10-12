import type { OpeningRepertoire, PieceColor, RepertoireVariation } from '../types/chess';
import { createDefaultRepertoire, addLineToRepertoire } from './repertoireEngine';
import { db } from '../db/db';
import { OPEN_GAMES_OPENINGS } from './data/openGames';
import { SICILIAN_OPENINGS } from './data/sicilian';
import { FRENCH_CARO_SCANDI_OPENINGS } from './data/frenchCaroScandi';
import { QUEENS_PAWN_INDIAN_OPENINGS } from './data/queensPawnIndian';
import { GAMBITS_AND_TRAPS_OPENINGS } from './data/gambitsAndTraps';
import { ANTI_OPENINGS_CATALOGUE } from './data/antiOpenings';
import { MASTER_CATALOGUE_OPENINGS } from './data/catalogueIndex';

export interface MasterRepertoireDefinition {
  id: string;
  name: string;
  color: PieceColor;
  sideAgainst?: 'e4' | 'd4' | 'other';
  description: string;
  variations: RepertoireVariation[];
}

export const MASTER_OPENING_REPERTOIRES: MasterRepertoireDefinition[] = [
  // ==========================================
  // 1. WHITE: 1.e4 KING'S PAWN OPENINGS & ATTACKS
  // ==========================================
  {
    id: 'rep_white_e4',
    name: 'White: 1.e4 Open Games & Mainlines',
    color: 'white',
    description: 'Premier 1.e4 repertoire covering Italian Game, Ruy Lopez, Scotch, and responses to Sicilian, French, and Caro-Kann.',
    variations: [
      ...OPEN_GAMES_OPENINGS.filter((v) => v.side === 'white'),
      ...SICILIAN_OPENINGS.filter((v) => v.side === 'white'),
      ...FRENCH_CARO_SCANDI_OPENINGS.filter((v) => v.side === 'white'),
    ],
  },

  // ==========================================
  // 2. WHITE: 1.d4 QUEEN'S PAWN & SYSTEMS
  // ==========================================
  {
    id: 'rep_white_d4',
    name: 'White: 1.d4 Queen’s Gambit & Systems',
    color: 'white',
    description: 'Premier 1.d4 master repertoire featuring the Queen’s Gambit, Slav, King’s Indian, Grünfeld, and London System.',
    variations: [
      ...QUEENS_PAWN_INDIAN_OPENINGS.filter((v) => v.side === 'white'),
    ],
  },

  // ==========================================
  // 3. BLACK: SHIELD AGAINST 1.e4
  // ==========================================
  {
    id: 'rep_black_e4',
    name: 'Black: Shield Against 1.e4',
    color: 'black',
    sideAgainst: 'e4',
    description: 'Black defensive repertoire against 1.e4 covering the Sicilian (Najdorf, Dragon, Sveshnikov), Open Games, French, and Caro-Kann.',
    variations: [
      ...OPEN_GAMES_OPENINGS.filter((v) => v.side === 'black'),
      ...SICILIAN_OPENINGS.filter((v) => v.side === 'black'),
      ...FRENCH_CARO_SCANDI_OPENINGS.filter((v) => v.side === 'black'),
    ],
  },

  // ==========================================
  // 4. BLACK: FORTRESSES AGAINST 1.d4
  // ==========================================
  {
    id: 'rep_black_d4',
    name: 'Black: Fortresses Against 1.d4',
    color: 'black',
    sideAgainst: 'd4',
    description: 'Black repertoire against 1.d4 featuring the King’s Indian, Nimzo-Indian, Grünfeld, Slav, and Queen’s Gambit Declined.',
    variations: [
      ...QUEENS_PAWN_INDIAN_OPENINGS.filter((v) => v.side === 'black'),
    ],
  },

  // ==========================================
  // 5. FLANK OPENINGS & ROMANTIC GAMBITS
  // ==========================================
  {
    id: 'rep_flank_gambits',
    name: 'Flank Openings & Romantic Gambits',
    color: 'white',
    sideAgainst: 'other',
    description: 'Flank systems (English 1.c4, Réti 1.Nf3) alongside romantic attacking gambits (King’s Gambit, Vienna Gambit).',
    variations: [
      ...QUEENS_PAWN_INDIAN_OPENINGS.filter((v) => v.category === 'flank'),
      ...GAMBITS_AND_TRAPS_OPENINGS.filter((v) => v.id.includes('kings_gambit')),
    ],
  },

  // ==========================================
  // 6. FAMOUS GAMBITS & TACTICAL TRAPS
  // ==========================================
  {
    id: 'rep_gambits_traps',
    name: 'Famous Gambits & Tactical Traps',
    color: 'white',
    sideAgainst: 'other',
    description: 'Dedicated collection of legendary gambits (Evans, Danish, Morra, Halloween, Blackmar-Diemer) and famous opening traps (Légal, Stafford, Blackburne Shilling, Fishing Pole, Noah’s Ark).',
    variations: [
      ...GAMBITS_AND_TRAPS_OPENINGS,
    ],
  },

  // ==========================================
  // 7. ANTI-OPENING REPERTOIRES & REFUTATIONS
  // ==========================================
  {
    id: 'rep_anti_openings',
    name: 'Anti-Opening Defense & Refutations',
    color: 'black',
    sideAgainst: 'other',
    description: 'Practical guides and lines teaching how to neutralize and refute aggressive gambits, traps, and tricky sidelines (Anti-Englund, Anti-Stafford, Anti-Smith-Morra, Anti-Fried Liver, Anti-London, Anti-Danish).',
    variations: [
      ...ANTI_OPENINGS_CATALOGUE,
      ...SICILIAN_OPENINGS.filter((v) => v.tags.includes('anti_opening')),
      ...OPEN_GAMES_OPENINGS.filter((v) => v.tags.includes('anti_opening')),
      ...FRENCH_CARO_SCANDI_OPENINGS.filter((v) => v.tags.includes('anti_opening')),
      ...QUEENS_PAWN_INDIAN_OPENINGS.filter((v) => v.tags.includes('anti_opening')),
    ],
  },
];

/**
 * Builds fully-instantiated OpeningRepertoire objects with full move trees and variations.
 */
export function buildMasterRepertoires(): OpeningRepertoire[] {
  return MASTER_OPENING_REPERTOIRES.map((def) => {
    let rep = createDefaultRepertoire(def.id, def.name, def.color, def.sideAgainst);
    rep.description = def.description;

    // Filter duplicates within a repertoire
    const uniqueVars: RepertoireVariation[] = [];
    const seenVarIds = new Set<string>();
    for (const v of def.variations) {
      if (!seenVarIds.has(v.id)) {
        seenVarIds.add(v.id);
        uniqueVars.push(v);
      }
    }
    rep.variations = uniqueVars;

    // Fold every variation line into the repertoire's tree
    for (const v of uniqueVars) {
      rep = addLineToRepertoire(rep, v.moves, `${v.name} (${v.eco || ''})`);
    }

    return rep;
  });
}

/**
 * Seeds or updates the IndexedDB repertoires table with all master opening lines.
 * If forceReset is true, overwrites default repertoires with the latest master repertoire data.
 */
export async function seedMasterRepertoires(forceReset: boolean = false): Promise<OpeningRepertoire[]> {
  const masterReps = buildMasterRepertoires();

  for (const master of masterReps) {
    const existing = await db.repertoires.get(master.id);
    if (!existing || forceReset) {
      await db.repertoires.put(master);
    } else {
      // If repertoire exists, update if the master definition has more variations or moves
      const existingVarsCount = existing.variations?.length || 0;
      const masterVarsCount = master.variations?.length || 0;

      if (existingVarsCount < masterVarsCount) {
        await db.repertoires.put(master);
      }
    }
  }

  return await db.repertoires.toArray();
}

export { MASTER_CATALOGUE_OPENINGS };
