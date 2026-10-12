import type { CatalogueOpeningItem, OpeningCategory, OpeningSoundness } from './types';
import { OPEN_GAMES_OPENINGS } from './openGames';
import { SICILIAN_OPENINGS } from './sicilian';
import { FRENCH_CARO_SCANDI_OPENINGS } from './frenchCaroScandi';
import { QUEENS_PAWN_INDIAN_OPENINGS } from './queensPawnIndian';
import { GAMBITS_AND_TRAPS_OPENINGS } from './gambitsAndTraps';
import { ANTI_OPENINGS_CATALOGUE } from './antiOpenings';

// Combine all opening sections
const RAW_CATALOGUE: CatalogueOpeningItem[] = [
  ...OPEN_GAMES_OPENINGS,
  ...SICILIAN_OPENINGS,
  ...FRENCH_CARO_SCANDI_OPENINGS,
  ...QUEENS_PAWN_INDIAN_OPENINGS,
  ...GAMBITS_AND_TRAPS_OPENINGS,
  ...ANTI_OPENINGS_CATALOGUE,
];

// Deduplicate by ID
const seenIds = new Set<string>();
export const MASTER_CATALOGUE_OPENINGS: CatalogueOpeningItem[] = [];

for (const item of RAW_CATALOGUE) {
  if (!seenIds.has(item.id)) {
    seenIds.add(item.id);
    MASTER_CATALOGUE_OPENINGS.push(item);
  }
}

/**
 * Filter options for catalogue queries.
 */
export interface CatalogueFilterOptions {
  category?: OpeningCategory;
  side?: 'white' | 'black';
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  soundness?: OpeningSoundness;
  tag?: string;
  isAntiOpening?: boolean;
  hasTrap?: boolean;
  quickFilter?:
    | 'all'
    | 'popular'
    | 'gambits'
    | 'traps'
    | 'anti_openings'
    | 'dubious'
    | 'against_e4'
    | 'against_d4'
    | 'beginner';
}

/**
 * Search and filter the master opening catalogue.
 */
export function searchCatalogue(
  query: string = '',
  options: CatalogueFilterOptions = {}
): CatalogueOpeningItem[] {
  const cleanQ = query.trim().toLowerCase();

  return MASTER_CATALOGUE_OPENINGS.filter((item) => {
    // 1. Quick filter tabs
    if (options.quickFilter) {
      switch (options.quickFilter) {
        case 'popular':
          if (!item.tags.includes('popular')) return false;
          break;
        case 'gambits':
          if (!item.tags.includes('gambit')) return false;
          break;
        case 'traps':
          if (!item.trapMetadata && !item.tags.includes('trap')) return false;
          break;
        case 'anti_openings':
          if (!item.antiOpeningGuide && item.category !== 'anti_openings') return false;
          break;
        case 'dubious':
          if (item.soundness !== 'dubious' && item.soundness !== 'speculative') return false;
          break;
        case 'against_e4':
          if (item.moves[0] !== 'e4' || item.side !== 'black') return false;
          break;
        case 'against_d4':
          if (item.moves[0] !== 'd4' || item.side !== 'black') return false;
          break;
        case 'beginner':
          if (item.difficulty !== 'Beginner' && !item.tags.includes('beginner_friendly')) return false;
          break;
        case 'all':
        default:
          break;
      }
    }

    // 2. Specific filter properties
    if (options.category && item.category !== options.category) return false;
    if (options.side && item.side !== options.side) return false;
    if (options.difficulty && item.difficulty !== options.difficulty) return false;
    if (options.soundness && item.soundness !== options.soundness) return false;
    if (options.tag && !item.tags.includes(options.tag)) return false;
    if (options.isAntiOpening !== undefined) {
      const hasAnti = Boolean(item.antiOpeningGuide || item.category === 'anti_openings');
      if (options.isAntiOpening !== hasAnti) return false;
    }
    if (options.hasTrap !== undefined) {
      const hasTrap = Boolean(item.trapMetadata || item.tags.includes('trap'));
      if (options.hasTrap !== hasTrap) return false;
    }

    // 3. Search query matching
    if (cleanQ) {
      const matchesName = item.name.toLowerCase().includes(cleanQ);
      const matchesEco = item.eco?.toLowerCase().includes(cleanQ) ?? false;
      const matchesDesc = item.description?.toLowerCase().includes(cleanQ) ?? false;
      const matchesMoves = item.moves.join(' ').toLowerCase().includes(cleanQ);
      const matchesTrap =
        item.trapMetadata?.trapName.toLowerCase().includes(cleanQ) ?? false;
      const matchesAnti =
        item.antiOpeningGuide?.targetOpeningName.toLowerCase().includes(cleanQ) ?? false;
      const matchesAlt =
        item.alternativeNames?.some((alt) => alt.toLowerCase().includes(cleanQ)) ?? false;
      const matchesTags = item.tags.some((t) => t.toLowerCase().includes(cleanQ));

      if (
        !matchesName &&
        !matchesEco &&
        !matchesDesc &&
        !matchesMoves &&
        !matchesTrap &&
        !matchesAnti &&
        !matchesAlt &&
        !matchesTags
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Retrieve a specific opening from the master catalogue by ID.
 */
export function getCatalogueItemById(id: string): CatalogueOpeningItem | undefined {
  return MASTER_CATALOGUE_OPENINGS.find((item) => item.id === id);
}

/**
 * Finds the anti-opening guide that teaches how to defend against a given opening.
 */
export function findAntiOpeningGuide(openingNameOrId: string): CatalogueOpeningItem | undefined {
  const q = openingNameOrId.toLowerCase();
  return MASTER_CATALOGUE_OPENINGS.find((item) => {
    if (!item.antiOpeningGuide) return false;
    const target = item.antiOpeningGuide.targetOpeningName.toLowerCase();
    return target.includes(q) || q.includes(target) || item.id === openingNameOrId;
  });
}

/**
 * Returns all openings that contain tactical trap metadata.
 */
export function getTrapsCatalogue(): CatalogueOpeningItem[] {
  return MASTER_CATALOGUE_OPENINGS.filter((item) => Boolean(item.trapMetadata));
}

/**
 * Returns all openings that have dedicated anti-opening guides.
 */
export function getAntiOpeningsCatalogue(): CatalogueOpeningItem[] {
  return MASTER_CATALOGUE_OPENINGS.filter(
    (item) => Boolean(item.antiOpeningGuide) || item.category === 'anti_openings'
  );
}
