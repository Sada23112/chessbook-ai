import React, { useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import { defaultPieces } from 'react-chessboard';

export interface CompactBoardPreviewProps {
  /** Position in FEN string, or moves array to play out */
  fen?: string;
  moves?: string[];
  /** Maximum plies to play from moves array (optional) */
  targetPly?: number;
  /** Board orientation ('white' | 'black') */
  boardOrientation?: 'white' | 'black';
  /** Max width/height in px or string (e.g. 160 or '100%') */
  size?: number | string;
  /** Optional last move squares to highlight */
  lastMove?: { from: string; to: string } | null;
  /** Extra CSS classes */
  className?: string;
}

const DARK_SQUARE = '#2e3a44';
const LIGHT_SQUARE = '#5c6d7c';

export const CompactBoardPreview: React.FC<CompactBoardPreviewProps> = ({
  fen,
  moves,
  targetPly,
  boardOrientation = 'white',
  size = 180,
  lastMove,
  className = '',
}) => {
  // Compute resulting FEN and board representation
  const { board, moveInfo } = useMemo(() => {
    try {
      const chess = new Chess(fen || undefined);
      let calculatedLastMove = lastMove;

      if (moves && moves.length > 0) {
        const limit = targetPly !== undefined ? Math.min(moves.length, targetPly) : moves.length;
        for (let i = 0; i < limit; i++) {
          const m = chess.move(moves[i]);
          if (m && i === limit - 1) {
            calculatedLastMove = { from: m.from, to: m.to };
          }
        }
      }

      return {
        board: chess.board(),
        moveInfo: calculatedLastMove,
      };
    } catch {
      const fallbackChess = new Chess();
      return {
        board: fallbackChess.board(),
        moveInfo: null,
      };
    }
  }, [fen, moves, targetPly, lastMove]);

  // Orientation rows/cols mapping
  const ranks = boardOrientation === 'black' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = boardOrientation === 'black' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div
      className={`aspect-square rounded-lg overflow-hidden border border-surface-border shadow-md select-none pointer-events-none relative ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        maxWidth: '100%',
      }}
    >
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((r) =>
          files.map((c) => {
            const piece = board[r][c];
            const isLightSquare = (r + c) % 2 === 1;
            const squareName = `${String.fromCharCode(97 + c)}${r + 1}` as Square;
            const isLastMoveSquare =
              moveInfo && (moveInfo.from === squareName || moveInfo.to === squareName);

            let pieceComponent: React.ReactNode = null;
            if (piece) {
              const pieceCode = `${piece.color}${piece.type.toUpperCase()}`;
              const PieceSvg = defaultPieces[pieceCode];
              if (PieceSvg) {
                pieceComponent = PieceSvg({
                  svgStyle: {
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                  },
                });
              }
            }

            return (
              <div
                key={`${r}-${c}`}
                className="w-full h-full flex items-center justify-center relative"
                style={{
                  backgroundColor: isLastMoveSquare
                    ? isLightSquare
                      ? '#7c8a68'
                      : '#4c6448'
                    : isLightSquare
                    ? LIGHT_SQUARE
                    : DARK_SQUARE,
                }}
              >
                {pieceComponent}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
