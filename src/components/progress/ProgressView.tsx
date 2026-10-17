import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Award,
  Activity,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../db/db';
import type { GameRecord, GameAnalysis, WeaknessRecord, TrainingCard } from '../../types/chess';
import { useAppStore } from '../../store/useAppStore';

export const ProgressView: React.FC = () => {
  const { setTab, setActiveGame } = useAppStore();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [analyses, setAnalyses] = useState<GameAnalysis[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessRecord[]>([]);
  const [trainingCards, setTrainingCards] = useState<TrainingCard[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const g = await db.games.toArray();
      const a = await db.analyses.toArray();
      const w = await db.weaknesses.toArray();
      const c = await db.trainingCards.toArray();

      setGames(g);
      setAnalyses(a);
      setWeaknesses(w);
      setTrainingCards(c);
    };

    fetchData();
  }, []);

  const totalAnalyzed = analyses.length;

  const avgCpl =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((acc, a) => acc + (a.summary.whiteCPL + a.summary.blackCPL) / 2, 0) /
            analyses.length
        )
      : null;

  const avgAccuracy =
    analyses.length > 0
      ? Math.round(
          analyses.reduce(
            (acc, a) => acc + (a.summary.accuracyWhite + a.summary.accuracyBlack) / 2,
            0
          ) / analyses.length
        )
      : null;

  const reviewedCards = trainingCards.filter((c) => c.lastReviewed !== undefined);
  const correctReviews = reviewedCards.filter((c) => c.lastSuccess === true);
  const trainingAccuracy =
    reviewedCards.length > 0
      ? Math.round((correctReviews.length / reviewedCards.length) * 100)
      : null;

  const blundersTotal = analyses.reduce(
    (acc, a) => acc + (a.summary.whiteStats.blunder || 0) + (a.summary.blackStats.blunder || 0),
    0
  );
  const blundersPerGame =
    analyses.length > 0 ? (blundersTotal / (analyses.length * 2)).toFixed(1) : null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background">
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Progress</h1>
          <p className="text-slate-500 text-sm mt-1">
            Performance stats and weakness memory across {totalAnalyzed} analyzed games.
          </p>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-surface rounded-2xl p-5">
            <span className="text-xs text-slate-500">Average accuracy</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {avgAccuracy !== null ? `${avgAccuracy}%` : '—'}
              </span>
            </div>
            <span className="text-xs text-slate-600 block mt-1">overall play</span>
          </div>

          <div className="bg-surface rounded-2xl p-5">
            <span className="text-xs text-slate-500">Average CPL</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-slate-100 font-mono">
                {avgCpl !== null ? avgCpl : '—'}
              </span>
            </div>
            <span className="text-xs text-slate-600 block mt-1">centipawn loss</span>
          </div>

          <div className="bg-surface rounded-2xl p-5">
            <span className="text-xs text-slate-500">Blunders</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-rose-400 font-mono">
                {blundersPerGame !== null ? blundersPerGame : '—'}
              </span>
            </div>
            <span className="text-xs text-slate-600 block mt-1">per game / player</span>
          </div>

          <div className="bg-surface rounded-2xl p-5">
            <span className="text-xs text-slate-500">Exercise accuracy</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-accent font-mono">
                {trainingAccuracy !== null ? `${trainingAccuracy}%` : '—'}
              </span>
            </div>
            <span className="text-xs text-slate-600 block mt-1">{reviewedCards.length} reviewed</span>
          </div>
        </div>

        {/* Weakness Memory */}
        <div className="bg-surface rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-400" />
                <span>Weakness Memory</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tactical blindspots tracked across your games.
              </p>
            </div>
          </div>

          {weaknesses.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <p>No weakness patterns detected yet.</p>
              <p className="text-slate-600 mt-1">
                Analyze more games to start identifying recurring mistakes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {weaknesses.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-xl bg-surface-elevated flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h4 className="font-medium text-sm text-slate-100">{w.title}</h4>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          w.priority === 'high'
                            ? 'bg-rose-500/10 text-rose-400'
                            : w.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {w.priority} priority
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {w.occurrences}×
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2.5">{w.description}</p>

                    {/* Supporting Game Examples */}
                    {w.examples.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>Games:</span>
                        {w.examples.slice(0, 3).map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveGame(ex.gameId)}
                            className="font-mono text-[11px] text-accent hover:underline bg-surface px-2 py-0.5 rounded-lg transition"
                          >
                            {ex.gameTitle.split('(')[0]} · {ex.playedMove}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setTab('training')}
                    className="px-3.5 py-2 bg-surface hover:bg-surface-hover text-slate-300 rounded-xl text-xs font-medium transition shrink-0 flex items-center gap-1.5"
                  >
                    <span>Train</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
