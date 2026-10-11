import React from 'react';
import type { PieceColor } from '../../types/chess';

interface EvalBarProps {
  score: number; // White-relative centipawns (+ is white advantage)
  mate?: number; // In plies to mate (+ is white mates)
  orientation: PieceColor;
}

export const EvalBar: React.FC<EvalBarProps> = ({ score, mate, orientation }) => {
  // Convert score to percentage for white advantage (0% to 100%)
  // Range: -800 to +800 covers typical non-mate advantage
  let whitePercent: number;
  let label = '';

  if (mate !== undefined && mate !== 0) {
    whitePercent = mate > 0 ? 100 : 0;
    label = `M${Math.abs(mate)}`;
  } else {
    // Sigmoid mapping for smooth, readable eval bar
    const clamped = Math.max(-1000, Math.min(1000, score));
    whitePercent = 50 + 50 * (2 / (1 + Math.exp(-0.004 * clamped)) - 1);
    const scoreInPawns = (Math.abs(score) / 100).toFixed(1);
    label = score > 0 ? `+${scoreInPawns}` : score < 0 ? `-${scoreInPawns}` : '0.0';
  }

  // Cap within 3% and 97% so bar is always visible
  whitePercent = Math.max(3, Math.min(97, whitePercent));
  const blackPercent = 100 - whitePercent;

  // If orientation is black, invert bar (black at bottom, white at top)
  const isWhiteBottom = orientation === 'white';
  const bottomPercent = isWhiteBottom ? whitePercent : blackPercent;
  const isAdvantageBottom = isWhiteBottom ? score >= 0 : score <= 0;

  return (
    <div className="relative flex flex-col h-full w-7 bg-surface-elevated rounded-md overflow-hidden border border-surface-border shadow-inner select-none">
      {/* Top section (opponent color) */}
      <div
        className="w-full bg-[#1e2328] transition-all duration-300 ease-out flex items-start justify-center pt-1"
        style={{ height: `${100 - bottomPercent}%` }}
      >
        {!isAdvantageBottom && (
          <span className="text-[10px] font-mono font-bold text-slate-300 px-0.5">
            {label}
          </span>
        )}
      </div>

      {/* Bottom section (player color) */}
      <div
        className="w-full bg-[#e2e8f0] transition-all duration-300 ease-out flex items-end justify-center pb-1"
        style={{ height: `${bottomPercent}%` }}
      >
        {isAdvantageBottom && (
          <span className="text-[10px] font-mono font-bold text-slate-900 px-0.5">
            {label}
          </span>
        )}
      </div>

      {/* Center 0.0 line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-500/30" />
    </div>
  );
};
