import { Chess } from 'chess.js';
import type { GameRecord, GameResult, PieceColor } from '../types/chess';

// Simple fast string hashing for normalized fingerprint
export function computeFingerprint(white: string, black: string, date: string, movesSan: string[]): string {
  const normWhite = (white || '').trim().toLowerCase();
  const normBlack = (black || '').trim().toLowerCase();
  const normDate = (date || '').trim().replace(/[.?]/g, '-');
  // First 15 moves are usually unique enough, or entire sequence
  const moveSignature = movesSan.slice(0, 30).join(' ');
  const raw = `${normWhite}|${normBlack}|${normDate}|${moveSignature}`;

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `fp_${Math.abs(hash).toString(16)}_${movesSan.length}`;
}

export function splitPgnGames(pgnText: string): string[] {
  if (!pgnText || !pgnText.trim()) return [];

  // Normalize line endings
  const normalized = pgnText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match blocks starting with [Event or groups of headers followed by moves
  const games: string[] = [];
  const lines = normalized.split('\n');
  let currentGameLines: string[] = [];
  let inHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeaderLine = line.trim().startsWith('[') && line.trim().endsWith(']');

    if (isHeaderLine && !inHeader && currentGameLines.length > 0) {
      // Check if previous lines contain moves or are complete
      const content = currentGameLines.join('\n').trim();
      if (content) {
        games.push(content);
        currentGameLines = [];
      }
    }

    if (isHeaderLine) {
      inHeader = true;
    } else if (line.trim().length > 0 && !isHeaderLine) {
      inHeader = false;
    }

    currentGameLines.push(line);
  }

  if (currentGameLines.length > 0) {
    const content = currentGameLines.join('\n').trim();
    if (content) {
      games.push(content);
    }
  }

  // If simple splitting didn't find multiple headers, return whole text as one
  return games.length > 0 ? games : [pgnText.trim()];
}

export function parseSinglePgn(
  rawPgn: string,
  source: 'upload' | 'paste' | 'chess.com' | 'lichess' = 'paste',
  targetUsername?: string
): GameRecord | null {
  try {
    const cleanPgn = rawPgn.trim();
    if (!cleanPgn) return null;

    const chess = new Chess();
    // Load PGN with chess.js
    chess.loadPgn(cleanPgn, { strict: false });

    const headers = chess.header();
    const white = headers['White'] || 'Unknown White';
    const black = headers['Black'] || 'Unknown Black';
    const result = (headers['Result'] || '*') as GameResult;
    const date = headers['Date'] || headers['UTCDate'] || new Date().toISOString().split('T')[0];
    const timeControl = headers['TimeControl'] || headers['Time'] || undefined;
    const opening = headers['Opening'] || undefined;
    const eco = headers['ECO'] || undefined;
    const termination = headers['Termination'] || undefined;
    const whiteElo = headers['WhiteElo'] ? parseInt(headers['WhiteElo'], 10) : undefined;
    const blackElo = headers['BlackElo'] ? parseInt(headers['BlackElo'], 10) : undefined;

    const history = chess.history();
    if (history.length === 0) {
      // Could be an empty game or invalid moves
      return null;
    }

    const fingerprint = computeFingerprint(white, black, date, history);

    // Determine user color if targetUsername provided
    let userColor: PieceColor | undefined = undefined;
    if (targetUsername) {
      const lowerTarget = targetUsername.toLowerCase();
      if (white.toLowerCase().includes(lowerTarget)) {
        userColor = 'white';
      } else if (black.toLowerCase().includes(lowerTarget)) {
        userColor = 'black';
      }
    }

    // Stable ID
    const id = `game_${fingerprint}_${Date.now().toString(36)}`;

    return {
      id,
      white,
      black,
      whiteElo: isNaN(whiteElo || NaN) ? undefined : whiteElo,
      blackElo: isNaN(blackElo || NaN) ? undefined : blackElo,
      result,
      date,
      timeControl,
      opening,
      eco,
      termination,
      pgn: cleanPgn,
      fingerprint,
      source,
      userColor,
      movesCount: history.length,
      createdAt: Date.now(),
    };
  } catch (_err) {
    // Malformed PGN ignored gracefully
    return null;
  }
}

export function parseMultiplePgns(
  pgnText: string,
  source: 'upload' | 'paste' | 'chess.com' | 'lichess' = 'paste',
  targetUsername?: string
): GameRecord[] {
  const blocks = splitPgnGames(pgnText);
  const parsedGames: GameRecord[] = [];
  const seenFingerprints = new Set<string>();

  for (const block of blocks) {
    const game = parseSinglePgn(block, source, targetUsername);
    if (game && !seenFingerprints.has(game.fingerprint)) {
      seenFingerprints.add(game.fingerprint);
      parsedGames.push(game);
    }
  }

  return parsedGames;
}
