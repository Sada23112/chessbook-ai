import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type {
  Arrow,
  PieceDropHandlerArgs,
  SquareHandlerArgs,
  PieceHandlerArgs,
} from 'react-chessboard';
import type { TrainingArrow } from '../../types/chess';
import { BoardArrowOverlay } from './BoardArrowOverlay';

export interface SquareAnnotation {
  square: string;
  label: string;
  bg?: string;
  color?: string;
}

export interface InteractiveChessboardProps {
  /** Optional unique identifier for this board instance */
  id?: string;
  /** The position in FEN string format */
  fen: string;
  /** Board orientation ('white' or 'black') */
  boardOrientation?: 'white' | 'black';
  /** Whether user is allowed to make moves */
  allowMoves?: boolean;
  /** Restrict interaction to a specific turn ('w' | 'b' or undefined for both) */
  turn?: 'w' | 'b';
  /** Callback fired when a move is completed via tap-to-move or drag-and-drop */
  onMove?: (move: {
    from: string;
    to: string;
    san: string;
    fen: string;
    piece: string;
    captured?: string;
    promotion?: string;
  }) => boolean | void;
  /** Last move for visual origin/destination highlighting */
  lastMove?: { from: string; to: string } | null;
  /** Move-quality annotation badge on board (e.g. !!, ★, ?, ??) */
  moveAnnotation?: SquareAnnotation | null;
  /** Arrows to display on the board (e.g. engine best move, guided learning) */
  arrows?: (Arrow | TrainingArrow)[];
  /** Custom extra square styles to overlay */
  customSquareStyles?: Record<string, React.CSSProperties>;
  /** External highlighted squares (e.g. for training hints) */
  highlightSquares?: string[];
  /** Whether board interaction is disabled */
  disabled?: boolean;
  /** Optional extra callback when any square is tapped */
  onSquareClick?: (square: string) => void;
  /** Optional theme override */
  boardTheme?: 'emerald' | 'standard' | 'midnight' | 'wood';
  /** Extra container class names */
  className?: string;
  /** Responsive container max width (e.g. '500px') */
  maxWidth?: string;
}

const THEME_COLORS = {
  emerald: {
    dark: '#2e3a44',
    light: '#5c6d7c',
  },
  standard: {
    dark: '#769656',
    light: '#eeeed2',
  },
  midnight: {
    dark: '#1e293b',
    light: '#475569',
  },
  wood: {
    dark: '#b58863',
    light: '#f0d9b5',
  },
};

export const InteractiveChessboard: React.FC<InteractiveChessboardProps> = ({
  id: idProp,
  fen,
  boardOrientation = 'white',
  allowMoves = true,
  turn,
  onMove,
  lastMove,
  moveAnnotation,
  arrows = [],
  customSquareStyles = {},
  highlightSquares = [],
  disabled = false,
  onSquareClick: onSquareClickProp,
  boardTheme = 'emerald',
  className = '',
  maxWidth = '520px',
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const handledByBoardRef = useRef<boolean>(false);

  // Normalize arrows for rendering via custom SVG overlay
  const normalizedArrows: TrainingArrow[] = useMemo(() => {
    if (!arrows || arrows.length === 0) return [];
    return arrows.map((a) => ({
      startSquare: a.startSquare,
      endSquare: a.endSquare,
      color: a.color,
      type: 'type' in a && a.type ? a.type : 'solution',
    }));
  }, [arrows]);

  // Clear piece selection and reset touch refs whenever position FEN changes
  useEffect(() => {
    setSelectedSquare(null);
    touchStartRef.current = null;
    handledByBoardRef.current = false;
  }, [fen]);

  // Compute legal moves from the current position
  const currentChess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  // Find king in check square if king is checked
  const checkSquare = useMemo<string | null>(() => {
    if (!currentChess.inCheck()) return null;
    const activeColor = currentChess.turn();
    const board = currentChess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === activeColor) {
          const file = String.fromCharCode('a'.charCodeAt(0) + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
  }, [currentChess]);

  // Compute legal destination moves for currently selected square
  const legalDestinations = useMemo(() => {
    if (!selectedSquare) return [];
    try {
      return currentChess.moves({ square: selectedSquare, verbose: true });
    } catch {
      return [];
    }
  }, [currentChess, selectedSquare]);

  const handledPieceSquareRef = useRef<string | null>(null);

  // Execute a verified legal move
  const executeMove = useCallback(
    (from: string, to: string, promotion: string = 'q'): boolean => {
      try {
        const testChess = new Chess(fen);
        const moveResult = testChess.move({ from, to, promotion });
        if (!moveResult) {
          setSelectedSquare(null);
          return false;
        }

        // Always clear selected square after completing an attempted move
        setSelectedSquare(null);

        if (onMove) {
          const accepted = onMove({
            from,
            to,
            san: moveResult.san,
            fen: testChess.fen(),
            piece: moveResult.piece,
            captured: moveResult.captured,
            promotion: moveResult.promotion,
          });
          // If onMove returns explicitly false, move is rejected by trainer
          if (accepted === false) return false;
        }

        return true;
      } catch {
        setSelectedSquare(null);
        return false;
      }
    },
    [fen, onMove]
  );

  // Unified tap-to-select and tap-to-move processor
  const processSquareTap = useCallback(
    (square: string) => {
      if (disabled) return;

      onSquareClickProp?.(square);

      if (!allowMoves) {
        return;
      }

      const sq = square as Square;
      const pieceOnSquare = currentChess.get(sq);
      const activeTurn = currentChess.turn();

      // Case 1: A piece is already selected
      if (selectedSquare) {
        // Tapped the exact same square -> Deselect piece
        if (selectedSquare === sq) {
          setSelectedSquare(null);
          return;
        }

        // Tapped a verified legal destination square -> Execute move!
        const legalMove = legalDestinations.find((m) => m.to === sq);
        if (legalMove) {
          executeMove(selectedSquare, sq, legalMove.promotion || 'q');
          return;
        }

        // Tapped another friendly piece of the active player -> Switch selection!
        const canSwitch =
          pieceOnSquare &&
          pieceOnSquare.color === activeTurn &&
          (!turn || pieceOnSquare.color === turn);

        if (canSwitch) {
          const newMoves = currentChess.moves({ square: sq, verbose: true });
          if (newMoves.length > 0) {
            setSelectedSquare(sq);
          } else {
            setSelectedSquare(null);
          }
          return;
        }

        // Tapped an invalid/empty square -> Deselect without treating as an answer attempt
        setSelectedSquare(null);
        return;
      }

      // Case 2: No piece currently selected -> Select friendly piece with legal moves
      if (pieceOnSquare) {
        // If turn filter is active, only allow selecting user's side
        if (turn && pieceOnSquare.color !== turn) return;
        // Can only select pieces belonging to the side whose turn it is
        if (pieceOnSquare.color !== activeTurn) return;

        const moves = currentChess.moves({ square: sq, verbose: true });
        if (moves.length > 0) {
          setSelectedSquare(sq);
        }
      }
    },
    [
      disabled,
      allowMoves,
      selectedSquare,
      currentChess,
      turn,
      legalDestinations,
      executeMove,
      onSquareClickProp,
    ]
  );

  // Square click handler from react-chessboard
  const handleSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      handledByBoardRef.current = true;
      if (handledPieceSquareRef.current === square) return;
      processSquareTap(square);
    },
    [processSquareTap]
  );

  // Piece click handler from react-chessboard (critical for mobile and desktop piece selection)
  const handlePieceClick = useCallback(
    ({ square }: PieceHandlerArgs) => {
      if (!square) return;
      handledByBoardRef.current = true;
      handledPieceSquareRef.current = square;
      processSquareTap(square);
      // Clear in microtask so bubbling square click in this exact event tick is ignored,
      // while allowing immediate subsequent user clicks (e.g. rapid deselect or fast moves)
      Promise.resolve().then(() => {
        handledPieceSquareRef.current = null;
      });
    },
    [processSquareTap]
  );

  // Drag-and-drop handler
  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!allowMoves || disabled) return false;

      // If dropped on the same square, treat as a tap-to-select on that piece!
      if (!targetSquare || sourceSquare === targetSquare) {
        processSquareTap(sourceSquare);
        return false;
      }

      // Verify piece color
      const piece = currentChess.get(sourceSquare as Square);
      if (!piece) return false;
      if (turn && piece.color !== turn) return false;
      if (piece.color !== currentChess.turn()) return false;

      return executeMove(sourceSquare, targetSquare, 'q');
    },
    [allowMoves, disabled, currentChess, turn, executeMove, processSquareTap]
  );

  // Check if a piece can be dragged
  const canDragPiece = useCallback(
    ({ piece }: { piece: { pieceType: string } }): boolean => {
      if (!allowMoves || disabled) return false;
      const pieceColor = piece.pieceType.charAt(0) === 'w' ? 'w' : 'b';
      if (turn && pieceColor !== turn) return false;
      return pieceColor === currentChess.turn();
    },
    [allowMoves, disabled, turn, currentChess]
  );

  // Fallback touch event handlers for mobile touch devices
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    square: string | null;
  } | null>(null);

  const getSquareFromPoint = useCallback((clientX: number, clientY: number): string | null => {
    if (typeof document === 'undefined' || !document.elementFromPoint) return null;
    try {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const squareEl = el.closest('[data-square]');
      return squareEl?.getAttribute('data-square') || null;
    } catch {
      return null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      handledByBoardRef.current = false;
      if (e.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }
      const touch = e.touches[0];
      const sq = getSquareFromPoint(touch.clientX, touch.clientY);
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        square: sq,
      };
    },
    [getSquareFromPoint]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;

      // If react-chessboard's internal handler already processed this tap, skip fallback
      if (handledByBoardRef.current) {
        handledByBoardRef.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - start.time;

      // If movement is under 14px and completed within 450ms, it is a deliberate tap
      if (dist < 14 && elapsed < 450) {
        const endSquare = getSquareFromPoint(touch.clientX, touch.clientY);
        const targetSquare = endSquare || start.square;
        if (targetSquare) {
          processSquareTap(targetSquare);
        }
      }
    },
    [getSquareFromPoint, processSquareTap]
  );

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    handledByBoardRef.current = false;
  }, []);

  // Compose dynamic square styles
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Last move highlights (warm amber glow)
    if (lastMove?.from) {
      styles[lastMove.from] = {
        backgroundColor: 'rgba(234, 179, 8, 0.22)',
      };
    }
    if (lastMove?.to) {
      styles[lastMove.to] = {
        backgroundColor: 'rgba(234, 179, 8, 0.28)',
      };
    }

    // 2. King in check highlight (red radiant aura)
    if (checkSquare) {
      styles[checkSquare] = {
        background:
          'radial-gradient(circle, rgba(239, 68, 68, 0.85) 0%, rgba(239, 68, 68, 0.35) 60%, transparent 72%)',
      };
    }

    // 3. External hint highlight squares (e.g. piece or target zone)
    for (const hSquare of highlightSquares) {
      styles[hSquare] = {
        backgroundColor: 'rgba(56, 189, 248, 0.35)', // sky blue aura
        boxShadow: 'inset 0 0 0 3px rgba(56, 189, 248, 0.8)',
      };
    }

    // 4. Custom user styles (e.g. blunder/brilliant badges)
    Object.assign(styles, customSquareStyles);

    // 5. Selected square highlight (emerald green glow)
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(34, 197, 94, 0.35)',
        boxShadow: 'inset 0 0 0 3px #22c55e',
      };

      // 6. Legal destination indicators
      for (const move of legalDestinations) {
        const isCapture = Boolean(move.captured);
        if (isCapture) {
          // Distinct capture ring indicator
          styles[move.to] = {
            background:
              'radial-gradient(circle, transparent 66%, rgba(239, 68, 68, 0.6) 67%)',
            boxShadow: 'inset 0 0 0 3px rgba(239, 68, 68, 0.75)',
            cursor: 'pointer',
          };
        } else {
          // Subtle legal move dot on empty squares
          styles[move.to] = {
            background:
              'radial-gradient(circle, rgba(34, 197, 94, 0.65) 24%, transparent 25%)',
            cursor: 'pointer',
          };
        }
      }
    }

    return styles;
  }, [
    lastMove,
    checkSquare,
    highlightSquares,
    customSquareStyles,
    selectedSquare,
    legalDestinations,
  ]);

  const activeColors = THEME_COLORS[boardTheme] || THEME_COLORS.emerald;

  const squareRenderer = useCallback(
    ({ square, children }: SquareHandlerArgs & { children?: React.ReactNode }) => {
      const isAnnotated = moveAnnotation && moveAnnotation.square === square;
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {children}
          {isAnnotated && (
            <div
              style={{
                position: 'absolute',
                top: '4%',
                right: '4%',
                zIndex: 30,
                pointerEvents: 'none',
                borderRadius: '9999px',
                padding: '1px 5px',
                fontSize: '11px',
                fontWeight: 800,
                fontFamily: 'monospace',
                lineHeight: '1.2',
                backgroundColor: moveAnnotation.bg || '#22c55e',
                color: moveAnnotation.color || '#000000',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                border: '1.5px solid rgba(255,255,255,0.7)',
              }}
            >
              {moveAnnotation.label}
            </div>
          )}
        </div>
      );
    },
    [moveAnnotation]
  );

  // Memoize chessboard options to prevent unneeded sensor re-initialization and board re-renders
  const chessboardOptions = useMemo(
    () => ({
      id: idProp || 'chessbook-board',
      position: fen,
      boardOrientation,
      allowDragging: allowMoves && !disabled,
      dragActivationDistance: 25,
      canDragPiece,
      onPieceClick: handlePieceClick,
      onPieceDrop: handlePieceDrop,
      onSquareClick: handleSquareClick,
      squareRenderer: moveAnnotation ? squareRenderer : undefined,
      squareStyles,
      darkSquareStyle: { backgroundColor: activeColors.dark },
      lightSquareStyle: { backgroundColor: activeColors.light },
      boardStyle: {
        borderRadius: '10px',
        touchAction: 'manipulation',
      },
      animationDurationInMs: 200,
      showAnimations: true,
    }),
    [
      idProp,
      fen,
      boardOrientation,
      allowMoves,
      disabled,
      canDragPiece,
      handlePieceClick,
      handlePieceDrop,
      handleSquareClick,
      squareRenderer,
      moveAnnotation,
      squareStyles,
      activeColors,
    ]
  );

  return (
    <div
      className={`w-full aspect-square select-none rounded-xl overflow-hidden shadow-2xl border border-surface-border bg-surface-elevated transition-all relative ${className}`}
      style={{
        maxWidth,
        touchAction: 'manipulation',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <Chessboard options={chessboardOptions} />
      <BoardArrowOverlay arrows={normalizedArrows} boardOrientation={boardOrientation} />
    </div>
  );
};
