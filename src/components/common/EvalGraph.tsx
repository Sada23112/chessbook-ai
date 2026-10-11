import React from 'react';
import type { PositionAnalysis } from '../../types/chess';

interface EvalGraphProps {
  positions: PositionAnalysis[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({
  positions,
  currentPly,
  onSelectPly,
}) => {
  if (positions.length <= 1) return null;

  const height = 64;
  const paddingY = 8;
  const usableHeight = height - paddingY * 2;
  const centerY = height / 2;

  // Max clamp score at +-600 centipawns for chart scaling
  const maxScore = 600;

  const points = positions.map((pos, idx) => {
    const x = (idx / (positions.length - 1)) * 100;
    // Map score -maxScore..+maxScore to usableHeight..0 (positive score is top)
    const clamped = Math.max(-maxScore, Math.min(maxScore, pos.score));
    const normalized = clamped / maxScore; // -1 to +1
    const y = centerY - normalized * (usableHeight / 2);
    return { x, y, pos, idx };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x}% ${pt.y}` : `${acc} L ${pt.x}% ${pt.y}`;
  }, '');

  return (
    <div className="w-full bg-surface-muted rounded-lg p-2 border border-surface-border select-none">
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1 px-1">
        <span>Eval Flow</span>
        <span>Ply {currentPly} / {positions.length - 1}</span>
      </div>

      <div className="relative h-16 w-full cursor-pointer overflow-hidden rounded bg-surface">
        {/* Zero baseline */}
        <div
          className="absolute left-0 right-0 border-b border-slate-700/60"
          style={{ top: `${centerY}px` }}
        />

        {/* SVG Eval curve */}
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="evalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#64748b" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots for mistakes / blunders */}
          {points.map((pt) => {
            const cls = pt.pos.classification;
            if (cls === 'blunder') {
              return (
                <circle
                  key={pt.idx}
                  cx={`${pt.x}%`}
                  cy={pt.y}
                  r="3.5"
                  fill="#ef4444"
                  className="animate-pulse"
                />
              );
            }
            if (cls === 'mistake') {
              return <circle key={pt.idx} cx={`${pt.x}%`} cy={pt.y} r="2.5" fill="#f97316" />;
            }
            if (cls === 'missedWin') {
              return <circle key={pt.idx} cx={`${pt.x}%`} cy={pt.y} r="3" fill="#ec4899" />;
            }
            return null;
          })}

          {/* Current ply indicator */}
          {points[currentPly] && (
            <circle
              cx={`${points[currentPly].x}%`}
              cy={points[currentPly].y}
              r="4.5"
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}
        </svg>

        {/* Click overlays per ply */}
        <div className="absolute inset-0 flex">
          {positions.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-full hover:bg-accent/10 transition-colors"
              onClick={() => onSelectPly(i)}
              title={`Ply ${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
