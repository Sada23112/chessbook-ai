import { describe, it, expect } from 'vitest';
import { Chess, type Square } from 'chess.js';

describe('Interactive Board Chess Logic', () => {
  it('correctly calculates legal move destinations for e2 pawn in initial position', () => {
    const chess = new Chess();
    const moves = chess.moves({ square: 'e2', verbose: true });
    expect(moves.length).toBe(2);
    const destinations = moves.map((m) => m.to);
    expect(destinations).toContain('e3');
    expect(destinations).toContain('e4');
  });

  it('differentiates empty square destinations from capture destinations', () => {
    // Position with a capture available: 1. e4 d5 (e4 can capture d5)
    const chess = new Chess('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    const moves = chess.moves({ square: 'e4', verbose: true });
    
    // e4 can advance to e5 (empty) or capture d5 (capture)
    const captureMove = moves.find((m) => m.to === 'd5');
    const quietMove = moves.find((m) => m.to === 'e5');

    expect(captureMove).toBeDefined();
    expect(Boolean(captureMove?.captured)).toBe(true);

    expect(quietMove).toBeDefined();
    expect(Boolean(quietMove?.captured)).toBe(false);
  });

  it('rejects illegal moves and maintains position integrity', () => {
    const chess = new Chess();
    const initialFen = chess.fen();

    // Attempt illegal move (e2 to e5)
    let moved = false;
    try {
      const res = chess.move({ from: 'e2', to: 'e5' });
      moved = Boolean(res);
    } catch {
      moved = false;
    }

    expect(moved).toBe(false);
    expect(chess.fen()).toBe(initialFen);
  });

  it('accurately identifies king in check square', () => {
    // Scholar's mate attack with check: Qxf7+
    const checkFen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const chess = new Chess(checkFen);
    expect(chess.inCheck()).toBe(true);
    expect(chess.turn()).toBe('b');

    // Find black king square
    let kingSquare: string | null = null;
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === 'b') {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          kingSquare = `${file}${rank}`;
        }
      }
    }
    expect(kingSquare).toBe('e8');
  });

  it('handles switching piece selection when tapping another friendly piece', () => {
    const chess = new Chess();
    // Start by selecting e2 pawn
    const e2Moves = chess.moves({ square: 'e2', verbose: true });
    expect(e2Moves.length).toBe(2);

    // Switch selection to g1 knight
    const g1Moves = chess.moves({ square: 'g1', verbose: true });
    expect(g1Moves.length).toBe(2);
    expect(g1Moves.map((m) => m.to)).toContain('f3');
    expect(g1Moves.map((m) => m.to)).toContain('h3');
  });
});
