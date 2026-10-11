import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Award,
  Activity,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
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

  // Average CPL
  const avgCpl =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((acc, a) => acc + (a.summary.whiteCPL + a.summary.blackCPL) / 2, 0) /
            analyses.length
        )
      : null;

  // Average Accuracy
  const avgAccuracy =
    analyses.length > 0
      ? Math.round(
          analyses.reduce(
            (acc, a) => acc + (a.summary.accuracyWhite + a.summary.accuracyBlack) / 2,
            0
          ) / analyses.length
        )
      : null;

  // Training review accuracy
  const reviewedCards = trainingCards.filter((c) => c.lastReviewed !== undefined);
  const correctReviews = reviewedCards.filter((c) => c.lastSuccess === true);
  const trainingAccuracy =
    reviewedCards.length > 0
      ? Math.round((correctReviews.length / reviewedCards.length) * 100)
      : null;

  // Blunder rate per game
  const blundersTotal = analyses.reduce(
    (acc, a) => acc + (a.summary.whiteStats.blunder || 0) + (a.summary.blackStats.blunder || 0),
    0
  );
  const blundersPerGame =
    analyses.length > 0 ? (blundersTotal / (analyses.length * 2)).toFixed(1) : null;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Progress & Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Grounded performance metrics, weakness resolution tracking, and training memory.
        </p>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <span className="text-xs text-slate-400 font-medium">Avg Accuracy</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {avgAccuracy !== null ? `${avgAccuracy}%` : '—'}
            </span>
            <span className="text-xs text-emerald-400">calculated</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <span className="text-xs text-slate-400 font-medium">Average CPL</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {avgCpl !== null ? `${avgCpl}` : '—'}
            </span>
            <span className="text-xs text-slate-500">centipawns</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <span className="text-xs text-slate-400 font-medium">Blunders / Player</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-bold text-rose-400 font-mono">
              {blundersPerGame !== null ? blundersPerGame : '—'}
            </span>
            <span className="text-xs text-slate-500">per game</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <span className="text-xs text-slate-400 font-medium">Exercise Accuracy</span>
          <div className="flex items-baseline space-x-2 mt-2">
            <span className="text-2xl font-bold text-accent font-mono">
              {trainingAccuracy !== null ? `${trainingAccuracy}%` : '—'}
            </span>
            <span className="text-xs text-slate-500">
              ({reviewedCards.length} reviewed)
            </span>
          </div>
        </div>
      </div>

      {/* Weakness Memory Profiler */}
      <div className="bg-surface rounded-xl border border-surface-border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-100 text-base flex items-center space-x-2">
              <AlertTriangle size={18} className="text-amber-400" />
              <span>Personal Weakness Memory</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identified tactical blindspots mapped across your analyzed games.
            </p>
          </div>
        </div>

        {weaknesses.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs bg-surface-muted rounded-xl border border-surface-border">
            No weakness patterns detected yet. Analyze games in your library to populate your personalized weakness memory.
          </div>
        ) : (
          <div className="space-y-4">
            {weaknesses.map((w) => (
              <div
                key={w.id}
                className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-sm text-slate-100">{w.title}</h4>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        w.priority === 'high'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : w.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {w.priority} Priority
                    </span>
                    <span className="text-xs font-mono text-slate-400 bg-surface px-1.5 py-0.5 rounded border border-surface-border">
                      {w.occurrences} instances
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-2">{w.description}</p>

                  {/* Supporting Game Examples */}
                  {w.examples.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span className="text-slate-500">Supporting games:</span>
                      {w.examples.slice(0, 3).map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveGame(ex.gameId)}
                          className="font-mono text-accent hover:underline bg-surface px-1.5 py-0.5 rounded border border-surface-border"
                        >
                          {ex.gameTitle.split('(')[0]} ({ex.playedMove})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setTab('training')}
                  className="px-4 py-2 bg-surface hover:bg-surface-border text-accent border border-accent/40 rounded-lg text-xs font-semibold transition shrink-0"
                >
                  Train Weakness
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Methodology & Data Integrity Disclaimer */}
      <div className="p-4 rounded-xl bg-surface-muted border border-surface-border text-xs text-slate-400 space-y-1">
        <span className="font-semibold text-slate-300 block mb-1">
          Methodology & Data Integrity Note:
        </span>
        <p>
          All statistics above are strictly derived from your local game records and Stockfish analyses. Centipawn loss is computed by comparing engine evaluation swings on every move. Win probabilities and accuracies use the sigmoid distribution model standard in professional chess analysis.
        </p>
      </div>
    </div>
  );
};
