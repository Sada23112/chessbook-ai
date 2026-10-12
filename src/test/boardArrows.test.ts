import { describe, it, expect } from 'vitest';
import { getSquareCenter } from '../components/common/BoardArrowOverlay';
import { getMoveArrow } from '../repertoire/courseEngine';

describe('Chessboard Move Arrow System', () => {
  describe('getSquareCenter geometry calculations', () => {
    it('calculates correct square center coordinates for White orientation', () => {
      // White orientation:
      // file 'a' = 0 -> x = 50, 'h' = 7 -> x = 750
      // rank '1' = 0 -> y = (7 - 0)*100 + 50 = 750, '8' = 7 -> y = (7 - 7)*100 + 50 = 50
      expect(getSquareCenter('a1', 'white')).toEqual({ x: 50, y: 750 });
      expect(getSquareCenter('h8', 'white')).toEqual({ x: 750, y: 50 });
      expect(getSquareCenter('e2', 'white')).toEqual({ x: 450, y: 650 });
      expect(getSquareCenter('e4', 'white')).toEqual({ x: 450, y: 450 });
      expect(getSquareCenter('d4', 'white')).toEqual({ x: 350, y: 450 });
      expect(getSquareCenter('g1', 'white')).toEqual({ x: 650, y: 750 });
      expect(getSquareCenter('f3', 'white')).toEqual({ x: 550, y: 550 });
    });

    it('calculates correct flipped square center coordinates for Black orientation', () => {
      // Black orientation:
      // file 'a' = 0 -> x = (7 - 0)*100 + 50 = 750, 'h' = 7 -> x = (7 - 7)*100 + 50 = 50
      // rank '1' = 0 -> y = 0*100 + 50 = 50, '8' = 7 -> y = 7*100 + 50 = 750
      expect(getSquareCenter('a1', 'black')).toEqual({ x: 750, y: 50 });
      expect(getSquareCenter('h8', 'black')).toEqual({ x: 50, y: 750 });
      expect(getSquareCenter('e2', 'black')).toEqual({ x: 350, y: 150 });
      expect(getSquareCenter('e4', 'black')).toEqual({ x: 350, y: 350 });
      expect(getSquareCenter('d5', 'black')).toEqual({ x: 450, y: 450 });
      expect(getSquareCenter('e7', 'black')).toEqual({ x: 350, y: 650 });
    });

    it('returns { x: 0, y: 0 } gracefully for invalid or empty square strings', () => {
      expect(getSquareCenter('', 'white')).toEqual({ x: 0, y: 0 });
      expect(getSquareCenter('z9', 'white')).toEqual({ x: 0, y: 0 });
      expect(getSquareCenter('invalid', 'white')).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getMoveArrow generation', () => {
    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    it('resolves standard pawn SAN moves to correct start and end squares', () => {
      const arrow = getMoveArrow(START_FEN, 'e4', 'solution');
      expect(arrow).not.toBeNull();
      expect(arrow?.startSquare).toBe('e2');
      expect(arrow?.endSquare).toBe('e4');
      expect(arrow?.type).toBe('solution');
    });

    it('resolves piece SAN moves (e.g. Nf3)', () => {
      const arrow = getMoveArrow(START_FEN, 'Nf3', 'solution');
      expect(arrow).not.toBeNull();
      expect(arrow?.startSquare).toBe('g1');
      expect(arrow?.endSquare).toBe('f3');
    });

    it('resolves Black moves from corresponding FEN', () => {
      const fenAfterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const arrow = getMoveArrow(fenAfterE4, 'c5', 'solution');
      expect(arrow).not.toBeNull();
      expect(arrow?.startSquare).toBe('c7');
      expect(arrow?.endSquare).toBe('c5');
    });

    it('resolves Kingside Castling (O-O) to king move from e1 to g1', () => {
      // Position where White can castle Kingside
      const fenCastling = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5';
      const arrow = getMoveArrow(fenCastling, 'O-O', 'solution');
      expect(arrow).not.toBeNull();
      expect(arrow?.startSquare).toBe('e1');
      expect(arrow?.endSquare).toBe('g1');
    });

    it('resolves Black Kingside Castling (O-O) to king move from e8 to g8', () => {
      const fenBlackCastling = 'r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 2 5';
      const arrow = getMoveArrow(fenBlackCastling, 'O-O', 'solution');
      expect(arrow).not.toBeNull();
      expect(arrow?.startSquare).toBe('e8');
      expect(arrow?.endSquare).toBe('g8');
    });

    it('resolves Queenside Castling (O-O-O) to king move from e1 to c1', () => {
      // Position where White can legally castle Queenside (b1, c1, d1 are empty, King on e1, Rook on a1)
      const fenQCastling = 'r3kbnr/pppqpppp/2np4/8/3PP3/8/PPP2PPP/R3K2R w KQkq - 0 1';
      const arrow = getMoveArrow(fenQCastling, 'O-O-O', 'solution');
      expect(arrow).not.toBeNull();
      expect(arrow?.startSquare).toBe('e1');
      expect(arrow?.endSquare).toBe('c1');
    });

    it('supports direct UCI move strings (e.g. e2e4, g1f3)', () => {
      const uciArrow = getMoveArrow(START_FEN, 'e2e4', 'hint');
      expect(uciArrow).not.toBeNull();
      expect(uciArrow?.startSquare).toBe('e2');
      expect(uciArrow?.endSquare).toBe('e4');
      expect(uciArrow?.type).toBe('hint');
    });

    it('supports custom arrow types and custom colors', () => {
      const hintArrow = getMoveArrow(START_FEN, 'd4', 'hint', '#f59e0b');
      expect(hintArrow?.type).toBe('hint');
      expect(hintArrow?.color).toBe('#f59e0b');

      const varArrow = getMoveArrow(START_FEN, 'c4', 'variation', '#38bdf8');
      expect(varArrow?.type).toBe('variation');
      expect(varArrow?.color).toBe('#38bdf8');
    });

    it('returns null for illegal or impossible moves without throwing', () => {
      const illegalArrow = getMoveArrow(START_FEN, 'Ke4', 'solution');
      expect(illegalArrow).toBeNull();

      const invalidSan = getMoveArrow(START_FEN, 'xyz99', 'solution');
      expect(invalidSan).toBeNull();
    });

    it('returns null when FEN or move is empty', () => {
      expect(getMoveArrow('', 'e4')).toBeNull();
      expect(getMoveArrow(START_FEN, '')).toBeNull();
    });
  });
});
