import React from 'react';
import type { TrainingArrow } from '../../types/chess';

export interface BoardArrowOverlayProps {
  arrows: TrainingArrow[];
  boardOrientation?: 'white' | 'black';
  className?: string;
}

/**
 * Calculates center (x, y) coordinates for any board square on an 800x800 viewBox.
 */
export function getSquareCenter(
  square: string,
  orientation: 'white' | 'black' = 'white'
): { x: number; y: number } {
  if (!square || square.length < 2) return { x: 0, y: 0 };
  const file = square[0].toLowerCase();
  const rank = parseInt(square[1], 10);
  const fileIdx = file.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const rankIdx = rank - 1; // '1' -> 0, '8' -> 7

  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) {
    return { x: 0, y: 0 };
  }

  if (orientation === 'white') {
    const col = fileIdx;
    const row = 7 - rankIdx;
    return { x: col * 100 + 50, y: row * 100 + 50 };
  } else {
    const col = 7 - fileIdx;
    const row = rankIdx;
    return { x: col * 100 + 50, y: row * 100 + 50 };
  }
}

export const BoardArrowOverlay: React.FC<BoardArrowOverlayProps> = ({
  arrows,
  boardOrientation = 'white',
  className = '',
}) => {
  if (!arrows || arrows.length === 0) return null;

  return (
    <svg
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid meet"
      className={`absolute inset-0 w-full h-full pointer-events-none z-20 select-none ${className}`}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <filter id="arrow-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.45" />
        </filter>
      </defs>

      {arrows.map((arrow, idx) => {
        const p1 = getSquareCenter(arrow.startSquare, boardOrientation);
        const p2 = getSquareCenter(arrow.endSquare, boardOrientation);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return null;

        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;

        const isHint = arrow.type === 'hint';
        const isVariation = arrow.type === 'variation';

        // Color palette based on arrow type
        const color =
          arrow.color ||
          (isHint
            ? '#f59e0b' // Amber for hints
            : isVariation
            ? '#38bdf8' // Sky blue for variations
            : '#10b981'); // Vibrant emerald for solutions / guided moves

        const shaftWidth = isHint ? 11 : isVariation ? 13 : 15;
        const headWidth = isHint ? 30 : 36;
        const headLength = isHint ? 32 : 38;

        // Offsets
        const startOffset = 22;
        const endOffset = 18;

        const startX = p1.x + ux * startOffset;
        const startY = p1.y + uy * startOffset;

        const tipX = p2.x - ux * endOffset;
        const tipY = p2.y - uy * endOffset;

        const baseCenter = {
          x: tipX - ux * headLength,
          y: tipY - uy * headLength,
        };

        const leftX = baseCenter.x + px * (headWidth / 2);
        const leftY = baseCenter.y + py * (headWidth / 2);

        const rightX = baseCenter.x - px * (headWidth / 2);
        const rightY = baseCenter.y - py * (headWidth / 2);

        const arrowKey = `arrow_${arrow.startSquare}_${arrow.endSquare}_${idx}`;

        return (
          <g
            key={arrowKey}
            filter="url(#arrow-shadow)"
            opacity={isHint ? 0.9 : 0.95}
            className="transition-opacity duration-150"
          >
            {/* Arrow Shaft */}
            <line
              x1={startX}
              y1={startY}
              x2={baseCenter.x}
              y2={baseCenter.y}
              stroke={color}
              strokeWidth={shaftWidth}
              strokeLinecap="round"
              strokeDasharray={isHint ? '16 10' : undefined}
            />

            {/* Arrowhead */}
            <polygon
              points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
};
