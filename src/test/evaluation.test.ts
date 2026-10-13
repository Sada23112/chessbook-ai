import { describe, it, expect } from 'vitest';
import {
  mateToCentipawns,
  normalizeScoreToWhite,
  classifyMove,
  centipawnsToWinProbability,
  calculateMoveAccuracy,
  estimatePerformanceElo,
  generateGameVerdict,
} from '../engine/evaluation';

describe('Chess Evaluation & Move Classification', () => {
  it('converts forced mate scores correctly', () => {
    expect(mateToCentipawns(1)).toBe(9900);
    expect(mateToCentipawns(3)).toBe(9700);
    expect(mateToCentipawns(-1)).toBe(-9900);
    expect(mateToCentipawns(0)).toBe(0);
  });

  it('normalizes engine scores from White perspective for both turns', () => {
    // White turn, score +150 cp -> +150
    expect(normalizeScoreToWhite(150, undefined, 'w')).toBe(150);
    // Black turn, score +150 cp (means black is better by 150) -> -150 for white
    expect(normalizeScoreToWhite(150, undefined, 'b')).toBe(-150);
    // Black turn, score -200 cp (means black is worse by 200) -> +200 for white
    expect(normalizeScoreToWhite(-200, undefined, 'b')).toBe(200);
  });

  it('classifies forced moves correctly', () => {
    const result = classifyMove({
      evalBefore: 100,
      evalAfter: 100,
      isBestMove: true,
      isOnlyLegalMove: true,
    });
    expect(result.classification).toBe('forced');
  });

  it('classifies best and excellent moves', () => {
    const best = classifyMove({
      evalBefore: 50,
      evalAfter: 48,
      isBestMove: true,
    });
    expect(best.classification).toBe('best');
    expect(best.cpl).toBe(0);

    const excellent = classifyMove({
      evalBefore: 50,
      evalAfter: 38,
      isBestMove: false,
    });
    expect(excellent.classification).toBe('excellent');
    expect(excellent.cpl).toBe(12);
  });

  it('classifies inaccuracies, mistakes, and blunders based on centipawn loss', () => {
    const inacc = classifyMove({
      evalBefore: 100,
      evalAfter: 50, // 50 cpl
      isBestMove: false,
    });
    expect(inacc.classification).toBe('inaccuracy');

    const mist = classifyMove({
      evalBefore: 100,
      evalAfter: -20, // 120 cpl
      isBestMove: false,
    });
    expect(mist.classification).toBe('mistake');

    const blunder = classifyMove({
      evalBefore: 50,
      evalAfter: -250, // 300 cpl
      isBestMove: false,
    });
    expect(blunder.classification).toBe('blunder');
  });

  it('correctly detects missed wins when advantage is thrown away', () => {
    const missedWin = classifyMove({
      evalBefore: 350,
      evalAfter: 20, // Dropped from winning to drawish
      isBestMove: false,
    });
    expect(missedWin.classification).toBe('missedWin');
  });

  it('does not classify moves as blunders if the position remains overwhelmingly winning', () => {
    const winning = classifyMove({
      evalBefore: 800,
      evalAfter: 650, // dropped 150 cpl, but +6.5 is still completely winning
      isBestMove: false,
    });
    expect(winning.classification).toBe('good');
  });

  it('calculates win probability and accuracy accurately', () => {
    expect(centipawnsToWinProbability(0)).toBeCloseTo(50, 0);
    expect(centipawnsToWinProbability(400)).toBeGreaterThan(80);
    expect(centipawnsToWinProbability(-400)).toBeLessThan(20);

    expect(calculateMoveAccuracy(0)).toBe(100);
    expect(calculateMoveAccuracy(100)).toBeLessThan(75);
    expect(calculateMoveAccuracy(400)).toBeLessThan(25);
  });

  it('classifies brilliant moves when a piece sacrifice maintains a strong advantage', () => {
    const brilliant = classifyMove({
      evalBefore: 250,
      evalAfter: 260,
      isBestMove: true,
      isPieceSacrifice: true,
    });
    expect(brilliant.classification).toBe('brilliant');
    expect(brilliant.cpl).toBe(0);

    // Capturing sacrifice like Nxe3!! (-2.33 on Chess.com)
    const nxe3Brilliant = classifyMove({
      evalBefore: 180,
      evalAfter: 233,
      isBestMove: true,
      isPieceSacrifice: true,
    });
    expect(nxe3Brilliant.classification).toBe('brilliant');
    expect(nxe3Brilliant.cpl).toBe(0);
  });

  it('classifies great moves when critical tactical resource is found', () => {
    const great = classifyMove({
      evalBefore: 20,
      evalAfter: 120,
      isBestMove: true,
      isGreatMove: true,
    });
    expect(great.classification).toBe('great');
    expect(great.cpl).toBe(0);
  });

  it('preserves winning advantage without false mistakes (Chess.com CAPS2 rule)', () => {
    // If player is comfortably winning (+350) and plays a solid simplifying move (+240),
    // it dropped 110 cpl, but player is still totally winning: classify as 'good', not 'mistake'
    const winningSimplification = classifyMove({
      evalBefore: 350,
      evalAfter: 240,
      isBestMove: false,
    });
    expect(winningSimplification.classification).toBe('good');
    expect(winningSimplification.cpl).toBe(110);
  });

  it('does not classify sacrifices as brilliant if advantage is lost or negative', () => {
    const badSac = classifyMove({
      evalBefore: 150,
      evalAfter: -100, // blunder sacrifice
      isBestMove: false,
      isPieceSacrifice: true,
    });
    expect(badSac.classification).not.toBe('brilliant');
    expect(badSac.classification).toBe('blunder');
  });

  it('estimates performance Elo correctly across skill ranges', () => {
    // Grandmaster level precision
    const gmElo = estimatePerformanceElo(98, 12);
    expect(gmElo).toBeGreaterThan(2400);

    // Intermediate club level
    const clubElo = estimatePerformanceElo(75, 45);
    expect(clubElo).toBeGreaterThan(1200);
    expect(clubElo).toBeLessThan(1900);

    // Beginner level
    const beginnerElo = estimatePerformanceElo(35, 120);
    expect(beginnerElo).toBeGreaterThanOrEqual(400);
    expect(beginnerElo).toBeLessThan(1000);
  });

  it('generates coach game verdicts based on player accuracy', () => {
    const whiteWonVerdict = generateGameVerdict(88, 62);
    expect(whiteWonVerdict).toContain('White displayed higher precision');

    const blackWonVerdict = generateGameVerdict(65, 85);
    expect(blackWonVerdict).toContain('Black played with superior accuracy');

    const evenVerdict = generateGameVerdict(78, 77);
    expect(evenVerdict).toContain('well-matched struggle');
  });
});

