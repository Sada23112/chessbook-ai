import type { OpeningRepertoire, PieceColor, RepertoireVariation } from '../types/chess';
import { createDefaultRepertoire, addLineToRepertoire } from './repertoireEngine';
import { db } from '../db/db';

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
  // 1. WHITE: 1.e4 KING'S PAWN OPENINGS
  // ==========================================
  {
    id: 'rep_white_e4',
    name: 'White: 1.e4 Open Games & Mainlines',
    color: 'white',
    description: 'Comprehensive 1.e4 repertoire covering Italian, Ruy Lopez, Scotch, and responses to Sicilian, French, and Caro-Kann.',
    variations: [
      {
        id: 'var_italian_pianissimo',
        name: 'Italian Game: Giuoco Pianissimo',
        eco: 'C50',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'a6', 'Bb3', 'Ba7', 'Re1', 'O-O'],
        description: 'The solid, classical Italian setup controlling central squares before kingside maneuvering.',
      },
      {
        id: 'var_italian_two_knights',
        name: 'Italian Game: Two Knights Defense',
        eco: 'C55',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'c3', 'd6', 'O-O', 'O-O', 'Nbd2', 'a6'],
        description: 'Modern grandmaster treatment against the Two Knights, prioritizing harmonious piece coordination.',
      },
      {
        id: 'var_italian_fried_liver',
        name: 'Italian Game: Fried Liver Attack',
        eco: 'C57',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3'],
        description: 'Aggressive tactical sacrifice punishing Black for recapturing on d5 with the knight.',
      },
      {
        id: 'var_italian_polerio',
        name: 'Italian Game: Knight Attack (Polerio)',
        eco: 'C58',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Be2', 'h6', 'Nf3', 'e4', 'Ne5'],
        description: 'The mainline continuation after Black’s 5...Na5 counter-attack on the c4 bishop.',
      },
      {
        id: 'var_evans_gambit',
        name: 'Evans Gambit Accepted',
        eco: 'C51',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'O-O', 'Nge7'],
        description: 'Sacrificing the b4 pawn for rapid development, open diagonals, and overwhelming center presence.',
      },
      {
        id: 'var_ruy_lopez_closed',
        name: 'Ruy Lopez: Closed Main Line',
        eco: 'C84',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3'],
        description: 'The pinnacle of classical chess strategy; White prepares d4 while controlling the e-file.',
      },
      {
        id: 'var_ruy_lopez_berlin',
        name: 'Ruy Lopez: Berlin Defense',
        eco: 'C65',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'd4', 'Nd6', 'Bxc6', 'dxc6', 'dxe5', 'Nf5', 'Qxd8+', 'Kxd8'],
        description: 'The Berlin Wall endgame; White trades queens for superior pawn structure and kingside majority.',
      },
      {
        id: 'var_ruy_lopez_exchange',
        name: 'Ruy Lopez: Exchange Variation',
        eco: 'C68',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O', 'f6', 'd4', 'exd4', 'Nxd4', 'c5', 'Nb3', 'Qxd1', 'Rxd1'],
        description: 'Bobby Fischer’s favorite method of creating an endgame four-versus-three kingside pawn majority.',
      },
      {
        id: 'var_scotch_classical',
        name: 'Scotch Game: Classical Variation',
        eco: 'C45',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Bc5', 'Be3', 'Qf6', 'c3', 'Nge7', 'Bc4', 'O-O'],
        description: 'Instant center strike opening lines with active knight dominance on d4.',
      },
      {
        id: 'var_open_sicilian_najdorf',
        name: 'Open Sicilian: English Attack vs Najdorf',
        eco: 'B90',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3', 'Be7', 'Qd2', 'O-O', 'O-O-O'],
        description: 'White castles queenside to initiate a ferocious kingside storm with g4 and h4.',
      },
      {
        id: 'var_open_sicilian_dragon',
        name: 'Open Sicilian: Yugoslav Attack vs Dragon',
        eco: 'B77',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3', 'O-O', 'Qd2', 'Nc6', 'Bc4', 'Bd7', 'O-O-O'],
        description: 'The sharpest battle in the Sicilian; opposite-side castling attack against Black’s fianchettoed bishop.',
      },
      {
        id: 'var_sicilian_alapin',
        name: 'Sicilian Defense: Alapin Variation (2.c3)',
        eco: 'B22',
        moves: ['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nf6', 'Nf3', 'e6', 'Be2', 'Be7', 'O-O', 'O-O'],
        description: 'Solid anti-Sicilian creating an uncontested d4 pawn center.',
      },
      {
        id: 'var_french_advance',
        name: 'French Defense: Advance Variation',
        eco: 'C02',
        moves: ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6', 'a3', 'c4', 'Nbd2', 'Na5'],
        description: 'Locking down central space with e5 and controlling the queenside outposts.',
      },
      {
        id: 'var_french_steinitz',
        name: 'French Defense: Steinitz Variation',
        eco: 'C11',
        moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'e5', 'Nfd7', 'f4', 'c5', 'Nf3', 'Nc6', 'Be3', 'a6', 'Qd2', 'b5'],
        description: 'Classical center fortress fortified with f4, fighting for every inch of central territory.',
      },
      {
        id: 'var_caro_kann_advance',
        name: 'Caro-Kann Defense: Advance (Short System)',
        eco: 'B12',
        moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'Nd7', 'O-O', 'h6', 'Nbd2', 'Ne7'],
        description: 'Nigel Short’s elegant modern strategy neutralizing Black’s light-squared bishop with Be2 and Nd2.',
      },
      {
        id: 'var_scandinavian_main',
        name: 'Scandinavian Defense: Modern Main Line',
        eco: 'B01',
        moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Nf3', 'c6', 'Bc4', 'Bf5', 'Bd2', 'e6', 'Qe2'],
        description: 'Fast developmental initiative penalizing Black’s early queen wanderings.',
      },
      {
        id: 'var_pirc_austrian',
        name: 'Pirc Defense: Austrian Attack',
        eco: 'B09',
        moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'f4', 'Bg7', 'Nf3', 'O-O', 'Bd3'],
        description: 'Direct three-pawn steamroller (d4, e4, f4) seeking to overpower Black’s hypermodern setup.',
      },
    ],
  },

  // ==========================================
  // 2. WHITE: 1.d4 QUEEN'S PAWN & GAMBITS
  // ==========================================
  {
    id: 'rep_white_d4',
    name: 'White: 1.d4 Queen’s Gambit & Systems',
    color: 'white',
    description: 'Premier 1.d4 master repertoire featuring the Queen’s Gambit, Slav, King’s Indian, Grunfeld, and London System.',
    variations: [
      {
        id: 'var_qgd_exchange',
        name: 'Queen’s Gambit Declined: Exchange Variation',
        eco: 'D35',
        moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'cxd5', 'exd5', 'Bg5', 'c6', 'e3', 'Be7', 'Bd3', 'O-O', 'Qc2', 'Nbd7', 'Nge2'],
        description: 'The Carlisle/Botvinnik minority attack blueprint on the queenside or central e4 advance.',
      },
      {
        id: 'var_qgd_tartakower',
        name: 'Queen’s Gambit Declined: Tartakower Line',
        eco: 'D58',
        moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'h6', 'Bh4', 'b6', 'Bd3', 'Bb7', 'O-O'],
        description: 'Classical pressure keeping Black’s central pawns under strict confinement.',
      },
      {
        id: 'var_qga_main',
        name: 'Queen’s Gambit Accepted: Main Line',
        eco: 'D27',
        moves: ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3', 'e6', 'Bxc4', 'c5', 'O-O', 'a6', 'Qe2', 'b5', 'Bb3', 'Bb7', 'Rd1'],
        description: 'Swift recovery of the gambited pawn with relentless pressure along the d-file.',
      },
      {
        id: 'var_slav_classical',
        name: 'Slav Defense: Classical Main Line',
        eco: 'D15',
        moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5', 'e3', 'e6', 'Bxc4', 'Bb4', 'O-O', 'O-O'],
        description: 'Playing 5.a4 to stifle Black’s ...b5 expansion and recapturing on c4 with an enduring initiative.',
      },
      {
        id: 'var_semi_slav_meran',
        name: 'Semi-Slav Defense: Meran Variation',
        eco: 'D47',
        moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6', 'e3', 'Nbd7', 'Bd3', 'dxc4', 'Bxc4', 'b5', 'Bd3', 'a6', 'e4', 'c5', 'e5', 'cxd4', 'Nxb5'],
        description: 'Deeply tactical confrontation requiring precise piece sacrifices in the center.',
      },
      {
        id: 'var_kid_mar_del_plata',
        name: 'King’s Indian Defense: Classical Mar del Plata',
        eco: 'E99',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'b4'],
        description: 'White launches the Bayonet Attack (b4) queenside storm against Black’s kingside aspirations.',
      },
      {
        id: 'var_kid_samisch',
        name: 'King’s Indian Defense: Sämisch Variation',
        eco: 'E81',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'f3', 'O-O', 'Be3', 'e5', 'd5', 'c6', 'Qd2', 'cxd5', 'cxd5'],
        description: 'Ironclad pawn wall with f3, consolidating central dominance before queenside operations.',
      },
      {
        id: 'var_grunfeld_exchange',
        name: 'Grünfeld Defense: Classical Exchange',
        eco: 'D85',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7', 'Nf3', 'c5', 'Rb1', 'O-O', 'Be2', 'Nc6', 'd5'],
        description: 'Modern Rb1 setup taking the rook off the g7 bishop’s diagonal while anchoring d4 and e4.',
      },
      {
        id: 'var_nimzo_capablanca',
        name: 'Nimzo-Indian Defense: Classical 4.Qc2',
        eco: 'E32',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3', 'b6', 'Bg5', 'Bb7', 'f3'],
        description: 'Capablanca’s system preventing doubled pawns on c3 and securing the bishop pair.',
      },
      {
        id: 'var_nimzo_rubinstein',
        name: 'Nimzo-Indian Defense: Rubinstein 4.e3',
        eco: 'E40',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O', 'Bd3', 'd5', 'Nf3', 'c5', 'O-O', 'Nc6', 'a3', 'Bxc3', 'bxc3'],
        description: 'Solid harmonic development maintaining fluid pawn play throughout the middlegame.',
      },
      {
        id: 'var_london_system',
        name: 'London System: Modern Setup',
        eco: 'D02',
        moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'c5', 'c3', 'Nc6', 'Nd2', 'e6', 'Ngf3', 'Bd6', 'Bg3', 'O-O', 'Bd3', 'b6', 'Ne5'],
        description: 'Universal setup creating a dark-squared pyramid and installing an outpost knight on e5.',
      },
      {
        id: 'var_catalan_open',
        name: 'Catalan Opening: Open Catalan',
        eco: 'E04',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'dxc4', 'Nf3', 'a6', 'O-O', 'Nc6', 'e3', 'Rb8', 'Nfd2'],
        description: 'Long-range sniper bishop on g2 maintaining persistent pressure against Black’s queenside.',
      },
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
      {
        id: 'var_black_sicilian_najdorf',
        name: 'Sicilian Defense: Najdorf Variation',
        eco: 'B90',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3', 'Be7', 'Qd2', 'O-O', 'O-O-O', 'Nbd7', 'g4', 'b5'],
        description: 'The weapon of World Champions; sharp queenside counter-offensive against White’s English Attack.',
      },
      {
        id: 'var_black_sicilian_dragon',
        name: 'Sicilian Defense: Dragon Variation',
        eco: 'B78',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3', 'O-O', 'Qd2', 'Nc6', 'Bc4', 'Bd7', 'O-O-O', 'Rc8', 'Bb3', 'Ne5', 'h4', 'h5'],
        description: 'The Soltis Chinese Dragon defense stopping White’s h5 push and counter-attacking down the c-file.',
      },
      {
        id: 'var_black_sicilian_scheveningen',
        name: 'Sicilian Defense: Scheveningen Variation',
        eco: 'B85',
        moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e6', 'Be2', 'a6', 'O-O', 'Be7', 'f4', 'O-O', 'Kh1', 'Qc7'],
        description: 'Classic small pawn center (d6+e6) giving extraordinary flexibility against all White setups.',
      },
      {
        id: 'var_black_sicilian_sveshnikov',
        name: 'Sicilian Defense: Sveshnikov Main Line',
        eco: 'B33',
        moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5', 'Nd5', 'Be7', 'Bxf6', 'Bxf6', 'c3', 'O-O'],
        description: 'Dynamic piece play trading central pawn structure for total control of the dark squares.',
      },
      {
        id: 'var_black_sicilian_classical',
        name: 'Sicilian Defense: Classical / Richter-Rauzer',
        eco: 'B63',
        moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'd6', 'Bg5', 'e6', 'Qd2', 'a6', 'O-O-O', 'Bd7', 'f4', 'b5'],
        description: 'Active minor piece development and immediate queenside pawn advance against White’s setup.',
      },
      {
        id: 'var_black_ruy_breyer',
        name: 'Open Games: Ruy Lopez Breyer Defense',
        eco: 'C95',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4', 'Nbd7'],
        description: 'Breyer’s deep regrouping maneuver rerouting the knight to d7 for complete central harmony.',
      },
      {
        id: 'var_black_ruy_marshall',
        name: 'Open Games: Ruy Lopez Marshall Attack',
        eco: 'C89',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'O-O', 'c3', 'd5', 'exd5', 'Nxd5', 'Nxe5', 'Nxe5', 'Rxe5', 'c6', 'd4', 'Bd6', 'Re1', 'Qh4'],
        description: 'Frank Marshall’s historic pawn sacrifice launching a devastating tactical siege on White’s king.',
      },
      {
        id: 'var_black_italian_two_knights',
        name: 'Open Games: Italian Two Knights Counter',
        eco: 'C55',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Be7', 'O-O', 'O-O', 'Re1', 'd6', 'a4', 'Kh8', 'h3', 'Ng8'],
        description: 'Prophylactic play preparing the thematic ...f5 counter-stroke to seize center initiative.',
      },
      {
        id: 'var_black_petrov_defense',
        name: 'Open Games: Petrov’s Defense (Russian Game)',
        eco: 'C42',
        moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'd4', 'd5', 'Bd3', 'Nc6', 'O-O', 'Be7', 'c4', 'Nb4', 'Be2', 'O-O'],
        description: 'Carlsen’s and Caruana’s impregnable symmetrical barricade neutralizing White’s first-move advantage.',
      },
      {
        id: 'var_black_french_winawer',
        name: 'French Defense: Winawer Poisoned Pawn',
        eco: 'C18',
        moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3+', 'bxc3', 'Ne7', 'Qg4', 'Qc7', 'Qxg7', 'Rg8', 'Qxh7', 'cxd4'],
        description: 'Fierce double-edged counter-strike where Black’s open files and queenside pawns counter White’s queen.',
      },
      {
        id: 'var_black_caro_classical',
        name: 'Caro-Kann Defense: Classical Capablanca',
        eco: 'B18',
        moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6', 'h4', 'h6', 'Nf3', 'Nd7', 'h5', 'Bh7', 'Bd3', 'Bxd3', 'Qxd3', 'e6', 'Bd2', 'Ngf6', 'O-O-O', 'Be7'],
        description: 'Capablanca’s bulletproof structure placing the bishop outside before completing development.',
      },
      {
        id: 'var_black_caro_advance',
        name: 'Caro-Kann Defense: Advance Variation Counter',
        eco: 'B12',
        moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5', 'Be3', 'Qb6', 'Nc3', 'Nc6', 'O-O', 'Qxb2', 'Qe1', 'cxd4'],
        description: 'Active queen raid on b2 destabilizing White’s queenside structure.',
      },
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
      {
        id: 'var_black_kid_mar_del_plata',
        name: 'King’s Indian: Mar del Plata Avalanche',
        eco: 'E99',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'Ne1', 'Nd7', 'Be3', 'f5', 'f3', 'f4', 'Bf2', 'g5', 'a4', 'Ng6'],
        description: 'The ultimate attacking formation; Black storms kingside pawns (...g5, ...f4, ...g4) to deliver checkmate.',
      },
      {
        id: 'var_black_kid_gligoric',
        name: 'King’s Indian: Gligoric System',
        eco: 'E92',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'Be3', 'Ng4', 'Bg5', 'f6', 'Bh4', 'Nc6', 'd5', 'Ne7', 'Nd2', 'Nh6'],
        description: 'Flexible counter-thrust harassing White’s dark-squared bishop with ...Ng4 and ...Nh6.',
      },
      {
        id: 'var_black_nimzo_classical',
        name: 'Nimzo-Indian: Classical 4.Qc2 (Zürich)',
        eco: 'E38',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3', 'b6', 'Bg5', 'Bb7', 'e3', 'd6', 'f3', 'Nbd7', 'Bd3', 'c5'],
        description: 'Immediate central challenge with ...c5 breaking down White’s uncastled king position.',
      },
      {
        id: 'var_black_nimzo_rubinstein',
        name: 'Nimzo-Indian: Rubinstein 4.e3',
        eco: 'E53',
        moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O', 'Bd3', 'd5', 'Nf3', 'c5', 'O-O', 'dxc4', 'Bxc4', 'Nbd7', 'Qe2', 'b6'],
        description: 'Harmonious pawn liquidation leading to active minor piece counterplay.',
      },
      {
        id: 'var_black_grunfeld_exchange',
        name: 'Grünfeld Defense: Exchange Main Line',
        eco: 'D85',
        moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7', 'Nf3', 'c5', 'Rb1', 'O-O', 'Be2', 'cxd4', 'cxd4', 'Qa5+', 'Bd2', 'Qxa2'],
        description: 'Pawn capture on a2 while applying immense pressure down the long diagonal and c-file.',
      },
      {
        id: 'var_black_slav_czech',
        name: 'Slav Defense: Classical Czech Variation',
        eco: 'D17',
        moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5', 'e3', 'e6', 'Bxc4', 'Bb4', 'O-O', 'O-O', 'Qe2', 'Nbd7', 'e4', 'Bg6'],
        description: 'Pinning down the e4 square with active bishops and rock-solid pawn integrity.',
      },
      {
        id: 'var_black_semi_slav_meran',
        name: 'Semi-Slav Defense: Meran Counter-Attack',
        eco: 'D47',
        moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'e6', 'e3', 'Nbd7', 'Bd3', 'dxc4', 'Bxc4', 'b5', 'Bd3', 'a6', 'e4', 'c5', 'd5', 'c4', 'Bc2', 'Qc7'],
        description: 'Uncompromising counter-attack with ...b5 and ...c4 claiming queenside dominance.',
      },
      {
        id: 'var_black_qgd_tartakower',
        name: 'Queen’s Gambit Declined: Tartakower',
        eco: 'D58',
        moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'h6', 'Bh4', 'b6', 'cxd5', 'Nxd5', 'Bxe7', 'Qxe7', 'Nxd5', 'exd5', 'Rc1', 'Be6'],
        description: 'Karpov’s fortress solving the problem of Black’s light-squared bishop with ...b6 and ...Bb7.',
      },
      {
        id: 'var_black_semi_tarrasch',
        name: 'Queen’s Gambit Declined: Semi-Tarrasch',
        eco: 'D41',
        moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'c5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'cxd4', 'cxd4', 'Bb4+', 'Bd2', 'Bxd2+', 'Qxd2', 'O-O'],
        description: 'Direct central liquidation producing dynamic equality and free piece maneuvering.',
      },
    ],
  },

  // ==========================================
  // 5. FLANK OPENINGS & GAMBITS
  // ==========================================
  {
    id: 'rep_flank_gambits',
    name: 'Flank Openings & Romantic Gambits',
    color: 'white',
    sideAgainst: 'other',
    description: 'Flank systems (English 1.c4, Réti 1.Nf3) alongside romantic attacking gambits (King’s Gambit, Vienna Gambit).',
    variations: [
      {
        id: 'var_english_four_knights',
        name: 'English Opening: Four Knights Variation',
        eco: 'A29',
        moves: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6', 'g3', 'd5', 'cxd5', 'Nxd5', 'Bg2', 'Nb6', 'O-O', 'Be7', 'a3', 'O-O', 'b4'],
        description: 'Fianchettoed bishop combined with early a3/b4 queenside pawn rush.',
      },
      {
        id: 'var_english_symmetrical',
        name: 'English Opening: Symmetrical Main Line',
        eco: 'A36',
        moves: ['c4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7', 'Nf3', 'Nf6', 'O-O', 'O-O', 'd4', 'cxd4', 'Nxd4', 'Nxd4', 'Qxd4', 'd6'],
        description: 'Positional maneuvering in the center seizing control of d5 and open diagonals.',
      },
      {
        id: 'var_kings_gambit_cunningham',
        name: 'King’s Gambit Accepted: Cunningham Defense',
        eco: 'C35',
        moves: ['e4', 'e5', 'f4', 'exf4', 'Nf3', 'Be7', 'Bc4', 'Nf6', 'e5', 'Ng4', 'O-O', 'd5', 'exd6', 'Qxd6', 'd4'],
        description: 'The romantic gambit from the golden age of chess; rapid f-file and central attack.',
      },
      {
        id: 'var_vienna_gambit',
        name: 'Vienna Game: Vienna Gambit',
        eco: 'C29',
        moves: ['e4', 'e5', 'Nc3', 'Nf6', 'f4', 'd5', 'fxe5', 'Nxe4', 'Qf3', 'f5', 'd3', 'Nxc3', 'bxc3', 'd4', 'Qg3'],
        description: 'Steinitz’s fierce attacking weapon tearing open the f-file with queenside piece development.',
      },
      {
        id: 'var_reti_kia',
        name: 'Réti Opening: King’s Indian Attack Setup',
        eco: 'A07',
        moves: ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'c6', 'O-O', 'Bf5', 'd3', 'e6', 'Nbd2', 'h6', 'Qe1', 'Be7', 'e4', 'Bh7'],
        description: 'Bobby Fischer’s favorite flank weapon engineering a kingside e4-e5 steamroller.',
      },
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
    rep.variations = [...def.variations];

    // Fold every variation line into the repertoire's tree
    for (const v of def.variations) {
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
      // If repertoire exists, merge variations and tree if it only had a legacy line
      const existingMovesCount = Object.keys(existing.allMoves || {}).length;
      const masterMovesCount = Object.keys(master.allMoves || {}).length;

      if (existingMovesCount < masterMovesCount || !existing.variations || existing.variations.length === 0) {
        await db.repertoires.put(master);
      }
    }
  }

  return await db.repertoires.toArray();
}
