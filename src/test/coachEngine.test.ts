import { describe, it, expect } from 'vitest';
import { generateCoachExplanation } from '../coach/coachEngine';

describe('Chess Coach Explanation Layer', () => {
  it('identifies hanging piece blunders accurately', () => {
    // White hangs bishop on e4, Black captures with dxe4
    const explanation = generateCoachExplanation({
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4B3/8/PPPPPPPP/RNBQK1NR w KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4B3/8/PPPPPPPP/RNBQK1NR b KQkq - 0 1',
      playedMove: {
        from: 'f1',
        to: 'e4',
        san: 'Be4',
        piece: 'b',
      },
      bestMoveSan: 'Nf3',
      bestMoveUci: 'g1f3',
      pv: ['d7d5', 'e4d5'],
      evalBefore: 30,
      evalAfter: -280,
      cpl: 310,
    });

    expect(explanation.playedSan).toBe('Be4');
    expect(explanation.bestMoveSan).toBe('Nf3');
    expect(explanation.consequence).toBeDefined();
    expect(explanation.beginnerLesson).toBeDefined();
    expect(explanation.practicalAdvice).toBeDefined();
  });

  it('detects missed checkmate sequences', () => {
    const explanation = generateCoachExplanation({
      fenBefore: '6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1',
      fenAfter: '6k1/5ppp/8/8/8/4Q3/8/6K1 b - - 0 1',
      playedMove: {
        from: 'e1',
        to: 'e3',
        san: 'Qe3',
        piece: 'q',
      },
      bestMoveSan: 'Qe8#',
      bestMoveUci: 'e1e8',
      pv: ['e1e8'],
      evalBefore: 9900,
      evalAfter: 800,
      cpl: 9100,
      mateBefore: 1,
      mateAfter: undefined,
    });

    expect(explanation.motif).toBe('Missed Checkmate');
    expect(explanation.bestMoveSan).toBe('Qe8#');
    expect(explanation.consequence).toContain('forced checkmate');
  });

  it('detects premature queen development in the opening', () => {
    const explanation = generateCoachExplanation({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/5Q2/PPPP1PPP/RNB1KBNR b KQkq - 0 1',
      playedMove: {
        from: 'd1',
        to: 'f3',
        san: 'Qf3',
        piece: 'q',
      },
      bestMoveSan: 'Nf3',
      bestMoveUci: 'g1f3',
      pv: ['g8f6', 'b1c3'],
      evalBefore: 30,
      evalAfter: -10,
      cpl: 40,
    });

    expect(explanation.motif).toBe('Premature Queen Move');
    expect(explanation.consequence).toContain('queen');
  });
});
