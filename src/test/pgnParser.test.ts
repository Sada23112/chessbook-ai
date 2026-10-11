import { describe, it, expect } from 'vitest';
import { parseSinglePgn, parseMultiplePgns, computeFingerprint, splitPgnGames } from '../utils/pgnParser';

const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "MagnusCarlsen"]
[Black "HikaruNakamura"]
[Result "1-0"]
[WhiteElo "2830"]
[BlackElo "2800"]
[ECO "C50"]
[Opening "Italian Game"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6 6. c3 O-O 1-0`;

const SAMPLE_MULTI_PGN = `[Event "Game 1"]
[White "PlayerA"]
[Black "PlayerB"]
[Result "1-0"]
[Date "2024.02.01"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 1-0

[Event "Game 2"]
[White "PlayerC"]
[Black "PlayerD"]
[Result "0-1"]
[Date "2024.02.02"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 0-1`;

describe('PGN Parser', () => {
  it('correctly parses a single PGN with headers and moves', () => {
    const game = parseSinglePgn(SAMPLE_PGN, 'upload', 'MagnusCarlsen');
    expect(game).not.toBeNull();
    expect(game?.white).toBe('MagnusCarlsen');
    expect(game?.black).toBe('HikaruNakamura');
    expect(game?.result).toBe('1-0');
    expect(game?.whiteElo).toBe(2830);
    expect(game?.blackElo).toBe(2800);
    expect(game?.opening).toBe('Italian Game');
    expect(game?.userColor).toBe('white');
    expect(game?.movesCount).toBe(12);
  });

  it('splits and parses multi-game PGNs', () => {
    const games = parseMultiplePgns(SAMPLE_MULTI_PGN, 'upload');
    expect(games).toHaveLength(2);
    expect(games[0].white).toBe('PlayerA');
    expect(games[1].white).toBe('PlayerC');
  });

  it('generates deterministic fingerprints for duplicate detection', () => {
    const fp1 = computeFingerprint('PlayerA', 'PlayerB', '2024.01.01', ['e4', 'e5', 'Nf3']);
    const fp2 = computeFingerprint('PlayerA', 'PlayerB', '2024.01.01', ['e4', 'e5', 'Nf3']);
    const fp3 = computeFingerprint('PlayerA', 'PlayerC', '2024.01.01', ['e4', 'e5', 'Nf3']);
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });

  it('handles invalid or empty PGN gracefully without crashing', () => {
    const game = parseSinglePgn('This is not a real PGN chess game.');
    expect(game).toBeNull();

    const empty = parseSinglePgn('');
    expect(empty).toBeNull();
  });
});
