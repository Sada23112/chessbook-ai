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
          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-4 shadow-sm">
            <span className="text-xs text-[#989795] font-semibold">Average Accuracy</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-[#81b64c] font-sans">
                {avgAccuracy !== null ? `${avgAccuracy}%` : '—'}
              </span>
            </div>
            <span className="text-[11px] text-[#989795] block mt-1">Stockfish evaluation</span>
          </div>

          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-4 shadow-sm">
            <span className="text-xs text-[#989795] font-semibold">Average CPL</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-white font-sans">
                {avgCpl !== null ? avgCpl : '—'}
              </span>
            </div>
            <span className="text-[11px] text-[#989795] block mt-1">Centipawns per move</span>
          </div>

          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-4 shadow-sm">
            <span className="text-xs text-[#989795] font-semibold">Blunder Rate</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-[#ca3431] font-sans">
                {blundersPerGame !== null ? blundersPerGame : '—'}
              </span>
            </div>
            <span className="text-[11px] text-[#989795] block mt-1">Blunders / game</span>
          </div>

          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-4 shadow-sm">
            <span className="text-xs text-[#989795] font-semibold">Puzzle Accuracy</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-3xl font-black text-[#e58f2a] font-sans">
                {trainingAccuracy !== null ? `${trainingAccuracy}%` : '—'}
              </span>
            </div>
            <span className="text-[11px] text-[#989795] block mt-1">{reviewedCards.length} solved</span>
          </div>
        </div>

        {/* Weakness Memory */}
        <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-5 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#383531]">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#e58f2a]" />
                <span>Weakness Memory</span>
              </h3>
              <p className="text-xs text-[#989795] mt-0.5">
                Tactical blindspots tracked across your games.
              </p>
            </div>
          </div>

          {weaknesses.length === 0 ? (
            <div className="py-10 text-center text-[#989795] text-xs">
              <p>No weakness patterns detected yet.</p>
              <p className="text-[#65625a] mt-1">
                Analyze more games to start identifying recurring mistakes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {weaknesses.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-[6px] bg-[#1f1e1b] border border-[#383531] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h4 className="font-bold text-xs text-white">{w.title}</h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                          w.priority === 'high'
                            ? 'bg-[#ca3431]/20 text-[#ca3431]'
                            : w.priority === 'medium'
                            ? 'bg-[#e58f2a]/20 text-[#e58f2a]'
                            : 'bg-[#65625a]/20 text-[#989795]'
                        }`}
                      >
                        {w.priority} priority
                      </span>
                      <span className="text-xs font-mono font-bold text-[#81b64c]">
                        {w.occurrences}×
                      </span>
                    </div>
                    <p className="text-xs text-[#c3c2bf] leading-relaxed mb-2.5">{w.description}</p>

                    {/* Supporting Game Examples */}
                    {w.examples.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#989795]">
                        <span>Games:</span>
                        {w.examples.slice(0, 3).map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveGame(ex.gameId)}
                            className="font-mono text-[11px] text-[#81b64c] hover:underline bg-[#262421] px-2 py-0.5 rounded border border-[#383531] transition"
                          >
                            {ex.gameTitle.split('(')[0]} · {ex.playedMove}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setTab('training')}
                    className="chess-btn-primary px-3 py-1.5 rounded-[4px] text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow"
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
