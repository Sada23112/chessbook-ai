import { Chess } from 'chess.js';
import type { MoveExplanation } from '../types/chess';

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export interface GenerateExplanationParams {
  fenBefore: string;
  fenAfter: string;
  playedMove: {
    from: string;
    to: string;
    san: string;
    piece: string;
    captured?: string;
  };
  bestMoveSan: string;
  bestMoveUci: string;
  pv: string[]; // UCI format e.g. ["e7e5", "g1f3"]
  evalBefore: number; // Mover's perspective centipawns
  evalAfter: number;  // Mover's perspective centipawns
  cpl: number;
  mateBefore?: number;
  mateAfter?: number;
}

export function generateCoachExplanation(params: GenerateExplanationParams): MoveExplanation {
  const {
    fenBefore,
    fenAfter,
    playedMove,
    bestMoveSan,
    pv,
    evalBefore,
    evalAfter,
    cpl,
    mateBefore,
    mateAfter,
  } = params;

  const chessBefore = new Chess(fenBefore);
  const moverColor = chessBefore.turn();
  const opponentColor = moverColor === 'w' ? 'b' : 'w';
  const moverColorName = moverColor === 'w' ? 'White' : 'Black';
  const opponentColorName = moverColor === 'w' ? 'Black' : 'White';

  const playedPieceName = PIECE_NAMES[playedMove.piece.toLowerCase()] || 'piece';
  const evalDiff = cpl;

  // 1. Missed Checkmate
  if (mateBefore !== undefined && mateBefore > 0) {
    if (mateAfter === undefined || mateAfter <= 0) {
      return {
        playedSan: playedMove.san,
        bestMoveSan,
        evalBefore,
        evalAfter,
        evalDiff,
        motif: 'Missed Checkmate',
        consequence: `You had a forced checkmate starting with ${bestMoveSan}, but ${playedMove.san} allowed ${opponentColorName} to escape immediate defeat.`,
        beginnerLesson: `When your opponent's king is cornered, calculate every check to completion before choosing a standard move.`,
        practicalAdvice: `Always look for forcing checks and mating nets when ahead in the attack.`,
      };
    }
  }

  // Check what the opponent's reply in the engine's line (pv[0]) does
  let opponentReplySan = '';
  let opponentCaptured = '';
  let isCheckReply = false;
  let replyPiece = '';
  let replyTo = '';

  if (pv.length > 0) {
    try {
      const chessAfter = new Chess(fenAfter);
      const replyUci = pv[0];
      const from = replyUci.slice(0, 2);
      const to = replyUci.slice(2, 4);
      const promotion = replyUci.length > 4 ? replyUci[4] : undefined;

      const replyMove = chessAfter.move({ from, to, promotion });
      if (replyMove) {
        opponentReplySan = replyMove.san;
        opponentCaptured = replyMove.captured || '';
        isCheckReply = chessAfter.inCheck();
        replyPiece = replyMove.piece;
        replyTo = replyMove.to;
      }
    } catch {
      // ignore
    }
  }

  // 2. Hanging Piece / Free Capture for Opponent
  if (opponentCaptured) {
    const capturedName = PIECE_NAMES[opponentCaptured.toLowerCase()] || 'piece';
    const capturedVal = PIECE_VALUES[opponentCaptured.toLowerCase()] || 0;

    // Check if player put their piece on the captured square or left it undefended
    if (replyTo === playedMove.to) {
      return {
        playedSan: playedMove.san,
        bestMoveSan,
        evalBefore,
        evalAfter,
        evalDiff,
        motif: 'Hanging Piece',
        consequence: `Moving your ${playedPieceName} to ${playedMove.to} blundered it directly into enemy fire. ${opponentColorName} plays ${opponentReplySan || 'a capture'} winning your ${capturedName} for free.`,
        opponentBestReply: opponentReplySan,
        beginnerLesson: `Before releasing your piece onto a square, count how many enemy pieces attack that square vs how many defenders you have.`,
        practicalAdvice: `Remember the cardinal rule: LPDO (Loose Pieces Drop Often).`,
      };
    }

    if (capturedVal >= 3) {
      return {
        playedSan: playedMove.san,
        bestMoveSan,
        evalBefore,
        evalAfter,
        evalDiff,
        motif: 'Unprotected Piece',
        consequence: `By playing ${playedMove.san}, your ${capturedName} was left unprotected, allowing ${opponentColorName} to capture it with ${opponentReplySan}.`,
        opponentBestReply: opponentReplySan,
        beginnerLesson: `Every time you move a piece, ask: "Did this move abandon the defense of any other friendly piece?"`,
        practicalAdvice: `Check all undefended pieces in your camp before confirming your move.`,
      };
    }
  }

  // 3. Missed Free Capture by Player
  try {
    const bestMoveObj = chessBefore.moves({ verbose: true }).find(m => m.san === bestMoveSan);
    if (bestMoveObj && bestMoveObj.captured) {
      const missedCapName = PIECE_NAMES[bestMoveObj.captured.toLowerCase()] || 'piece';
      if ((PIECE_VALUES[bestMoveObj.captured.toLowerCase()] || 0) >= 3) {
        return {
          playedSan: playedMove.san,
          bestMoveSan,
          evalBefore,
          evalAfter,
          evalDiff,
          motif: 'Missed Capture',
          consequence: `Your opponent left their ${missedCapName} vulnerable on ${bestMoveObj.to}. You played ${playedMove.san} instead of taking the free ${missedCapName} with ${bestMoveSan}.`,
          beginnerLesson: `Scan the entire board for undefended enemy pieces before developing or shifting pieces.`,
          practicalAdvice: `Start every calculation cycle by identifying all available captures.`,
        };
      }
    }
  } catch {
    // ignore
  }

  // 4. Forks and Double Attacks
  if (pv.length >= 2) {
    try {
      const chessAfter = new Chess(fenAfter);
      if (pv[0]) {
        const uci = pv[0];
        const move = chessAfter.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        if (move && (move.piece === 'n' || move.piece === 'p' || move.piece === 'q')) {
          // Check if this piece attacks 2+ pieces
          const attackedSquares = chessAfter.moves({ verbose: true }).filter(m => m.from === move.to && m.captured);
          if (attackedSquares.length >= 2) {
            return {
              playedSan: playedMove.san,
              bestMoveSan,
              evalBefore,
              evalAfter,
              evalDiff,
              motif: 'Tactical Fork',
              consequence: `${playedMove.san} walked into a double-attack. ${opponentColorName} responds with ${move.san}, forking multiple pieces simultaneously.`,
              opponentBestReply: move.san,
              beginnerLesson: `Look out for geometrical alignments, especially knights and pawns landing on squares that hit two targets.`,
              practicalAdvice: `Avoid placing high-value pieces on squares of the same color or knight-hop distance from each other.`,
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 5. Back Rank / King Safety
  if (isCheckReply) {
    const chessAfter = new Chess(fenAfter);
    const kingSquare = chessAfter.board().flatMap((r, rowIdx) =>
      r.map((sq, colIdx) => sq && sq.type === 'k' && sq.color === moverColor ? { rowIdx, colIdx } : null)
    ).find(Boolean);

    const isBackRank = moverColor === 'w' ? kingSquare?.rowIdx === 7 : kingSquare?.rowIdx === 0;

    if (isBackRank && (replyPiece === 'r' || replyPiece === 'q')) {
      return {
        playedSan: playedMove.san,
        bestMoveSan,
        evalBefore,
        evalAfter,
        evalDiff,
        motif: 'Back-Rank Vulnerability',
        consequence: `${playedMove.san} neglected back-rank defense. ${opponentColorName}'s ${opponentReplySan} delivers a punishing check on the back rank.`,
        opponentBestReply: opponentReplySan,
        beginnerLesson: `When heavy pieces remain on the board, keep a defender on the back rank or create 'luft' (an escape square) by pushing a rook pawn.`,
        practicalAdvice: `Address back-rank weaknesses before moving your defending rooks away from your first rank.`,
      };
    }

    return {
      playedSan: playedMove.san,
      bestMoveSan,
      evalBefore,
      evalAfter,
      evalDiff,
      motif: 'Compromised King Safety',
      consequence: `${playedMove.san} opens lines against your king. ${opponentColorName} immediately seizes initiative with ${opponentReplySan}.`,
      opponentBestReply: opponentReplySan,
      beginnerLesson: `Never open lines of attack or surrender key defensive diagonals around your king without concrete compensation.`,
      practicalAdvice: `Prioritize king security over passive pawn moves or premature flank adventures.`,
    };
  }

  // 6. Opening Principle (Early moves)
  const plyCount = chessBefore.history().length;
  if (plyCount <= 14) {
    // Check if player moved queen early or moved same piece multiple times
    if (playedMove.piece === 'q' && plyCount <= 6) {
      return {
        playedSan: playedMove.san,
        bestMoveSan,
        evalBefore,
        evalAfter,
        evalDiff,
        motif: 'Premature Queen Move',
        consequence: `Bringing the queen out this early (${playedMove.san}) exposes it to tempo-gaining attacks from developing minor pieces. Engine recommends ${bestMoveSan}.`,
        beginnerLesson: `Develop minor pieces (knights and bishops) and castle before mobilizing your queen.`,
        practicalAdvice: `Every time your queen is chased, your opponent gains a free development move.`,
      };
    }

    return {
      playedSan: playedMove.san,
      bestMoveSan,
      evalBefore,
      evalAfter,
      evalDiff,
      motif: 'Opening Principle',
      consequence: `${playedMove.san} loses momentum in the opening. The engine recommends ${bestMoveSan} to maintain center control and rapid development.`,
      opponentBestReply: opponentReplySan || undefined,
      beginnerLesson: `In the opening, focus on: 1. Control the center, 2. Develop minor pieces, 3. Castle to safety.`,
      practicalAdvice: `Prefer developing an undeveloped piece over making non-essential pawn moves.`,
    };
  }

  // 7. General Positional / Tactical Consequence
  const continuationText = pv.slice(0, 3).join(' ');
  return {
    playedSan: playedMove.san,
    bestMoveSan,
    evalBefore,
    evalAfter,
    evalDiff,
    motif: 'Tactical Consequence',
    consequence: `${playedMove.san} ceded a ${Math.round(evalDiff / 100 * 10) / 10} pawn advantage. The engine calculates ${bestMoveSan} as the superior continuation (${continuationText}).`,
    opponentBestReply: opponentReplySan || undefined,
    beginnerLesson: `The recommended line maintains piece coordination and pressure, while ${playedMove.san} ceded the advantage.`,
    practicalAdvice: `Examine candidate moves that restrict opponent counterplay and keep all pieces coordinated.`,
    isUncertain: false,
  };
}
