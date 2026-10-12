import type { PieceColor, RepertoireVariation } from '../../types/chess';

export type OpeningCategory =
  | 'open_games'
  | 'sicilian'
  | 'french'
  | 'caro_kann'
  | 'scandinavian'
  | 'pirc_modern'
  | 'alekhine'
  | 'queens_gambit'
  | 'slav_semislav'
  | 'kings_indian'
  | 'grunfeld'
  | 'nimzo_queens_indian'
  | 'dutch'
  | 'flank'
  | 'gambits_white'
  | 'countergambits_black'
  | 'traps_tactics'
  | 'anti_openings';

export type OpeningSoundness =
  | 'sound'
  | 'gambit_sound'
  | 'speculative'
  | 'dubious'
  | 'refuted';

export interface AntiOpeningGuide {
  targetOpeningName: string;
  defendingColor: PieceColor;
  identificationMoves: string[];
  recommendedResponseName: string;
  criticalPly: number; // 1-indexed ply where defender must choose the key move
  recommendedMoveSan: string;
  fullDefensiveLine: string[];
  opponentThreats: string[];
  commonDefenderMistakes: string[];
  positionalPlan: string;
  safeAlternative?: string;
  isRefutation?: boolean;
  explanation: string;
}

export interface TrapMetadata {
  trapName: string;
  openingName: string;
  blunderPly: number;
  blunderMove: string;
  punishmentLine: string[];
  soundness: OpeningSoundness;
  refutation: string;
  refutationLine?: string[];
  explanation: string;
}

export interface CatalogueOpeningItem extends RepertoireVariation {
  category: OpeningCategory;
  side: PieceColor;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  soundness: OpeningSoundness;
  tags: string[];
  strategicPlans?: string[];
  tacticalMotifs?: string[];
  antiOpeningGuide?: AntiOpeningGuide;
  trapMetadata?: TrapMetadata;
  alternativeNames?: string[];
  source?: string;
}
