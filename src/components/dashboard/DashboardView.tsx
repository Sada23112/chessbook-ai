import React, { useEffect, useState } from 'react';
import {
  Upload,
  Dumbbell,
  SearchCode,
  Award,
  AlertTriangle,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { db } from '../../db/db';
import type { GameRecord, GameAnalysis, TrainingCard, WeaknessRecord } from '../../types/chess';
import { useAppStore } from '../../store/useAppStore';
import { getGameOutcome } from '../../utils/gameOutcome';

export const DashboardView: React.FC = () => {
  const { setTab, setActiveGame, settings } = useAppStore();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [analyses, setAnalyses] = useState<GameAnalysis[]>([]);
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [weaknesses, setWeaknesses] = useState<WeaknessRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const g = await db.games.orderBy('createdAt').reverse().toArray();
      const a = await db.analyses.toArray();
      const w = await db.weaknesses.toArray();
      const now = Date.now();
      const dueCards = await db.trainingCards.filter((c) => c.dueDate <= now).count();

      setGames(g);
      setAnalyses(a);
      setWeaknesses(w);
      setDueCardsCount(dueCards);
    };

    fetchData();
  }, []);

  const analyzedGamesCount = analyses.length;

  // Real calculated average CPL across analyzed games
  const avgCpl =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((acc, a) => acc + (a.summary.whiteCPL + a.summary.blackCPL) / 2, 0) /
            analyses.length
        )
      : null;

  // Aggregate blunders, mistakes, inaccuracies
  const totals = analyses.reduce(
    (acc, a) => {
      acc.blunders += (a.summary.whiteStats.blunder || 0) + (a.summary.blackStats.blunder || 0);
      acc.mistakes += (a.summary.whiteStats.mistake || 0) + (a.summary.blackStats.mistake || 0);
      acc.inaccuracies +=
        (a.summary.whiteStats.inaccuracy || 0) + (a.summary.blackStats.inaccuracy || 0);
      return acc;
    },
    { blunders: 0, mistakes: 0, inaccuracies: 0 }
  );

  const userHandle = settings?.playerUsernames?.chessCom || 'Sada012';

  // Opening breakdown
  const openingMap = new Map<string, { total: number; wins: number; draws: number; losses: number }>();
  for (const g of games) {
    if (g.opening) {
      if (!openingMap.has(g.opening)) {
        openingMap.set(g.opening, { total: 0, wins: 0, draws: 0, losses: 0 });
      }
      const item = openingMap.get(g.opening)!;
      item.total++;
      const outcome = getGameOutcome(g, userHandle);
      if (outcome.isWin) item.wins++;
      else if (outcome.isLoss) item.losses++;
      else if (outcome.isDraw) item.draws++;
    }
  }

  const topOpenings = Array.from(openingMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 4);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight">
            Personal Chess Coach
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Analyze your games locally, remember your recurring mistakes, and master opening theory.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setTab('my-games')}
            className="px-4 py-2 bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border text-sm font-semibold rounded-lg transition flex items-center space-x-2"
          >
            <Upload size={16} />
            <span>Import Games</span>
          </button>
          <button
            onClick={() => setTab('training')}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-black text-sm font-semibold rounded-lg shadow transition flex items-center space-x-2"
          >
            <Dumbbell size={16} />
            <span>Resume Training ({dueCardsCount})</span>
          </button>
        </div>
      </div>

      {/* Onboarding State if no games */}
      {games.length === 0 ? (
        <div className="p-8 md:p-12 bg-surface rounded-2xl border border-surface-border text-center max-w-2xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent text-3xl mx-auto mb-4">
            ♔
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Welcome to Chessbook AI</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Get started by importing your games. We’ll analyze them with Stockfish, uncover your tactical blindspots, track your openings, and build custom spaced-repetition exercises.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => setTab('my-games')}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-sm transition shadow flex items-center justify-center space-x-2"
            >
              <Upload size={18} />
              <span>Import Your First Game</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <div className="bg-surface rounded-xl p-4 border border-surface-border flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Games Analyzed</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-bold text-slate-100 font-mono">
                  {analyzedGamesCount}
                </span>
                <span className="text-xs text-slate-500">of {games.length} total</span>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4 border border-surface-border flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Average CPL</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-bold text-slate-100 font-mono">
                  {avgCpl !== null ? `${avgCpl} cp` : '—'}
                </span>
                <span className="text-xs text-slate-500">Centipawn Loss</span>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4 border border-surface-border flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Identified Mistakes</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-bold text-rose-400 font-mono">
                  {totals.blunders}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({totals.mistakes} mistakes)
                </span>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4 border border-surface-border flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-medium">Exercises Due</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-bold text-accent font-mono">{dueCardsCount}</span>
                <span className="text-xs text-slate-500">in review queue</span>
              </div>
            </div>
          </div>

          {/* Main Grid: Recent Games & Recurring Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Recent Games */}
            <div className="lg:col-span-2 bg-surface rounded-xl border border-surface-border p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                  <Activity size={16} className="text-accent" />
                  <span>Recent Games</span>
                </h3>
                <button
                  onClick={() => setTab('my-games')}
                  className="text-xs text-accent hover:underline"
                >
                  View All
                </button>
              </div>

              <div className="space-y-2 flex-1">
                {games.slice(0, 5).map((game) => (
                  <div
                    key={game.id}
                    onClick={() => setActiveGame(game.id)}
                    className="p-3 rounded-lg bg-surface-elevated hover:bg-surface-border border border-surface-border/60 transition cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      {(() => {
                        const outcome = getGameOutcome(game, userHandle);
                        return (
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] flex items-center space-x-1 border ${outcome.badgeClass}`}
                          >
                            <span>{game.result}</span>
                            {outcome.isWin && (
                              <span className="text-[9px] font-sans font-extrabold uppercase px-1 rounded bg-emerald-500/20 text-emerald-300">
                                WIN
                              </span>
                            )}
                            {outcome.isLoss && (
                              <span className="text-[9px] font-sans font-extrabold uppercase px-1 rounded bg-rose-500/20 text-rose-300">
                                LOSS
                              </span>
                            )}
                            {outcome.isDraw && (
                              <span className="text-[9px] font-sans font-extrabold uppercase px-1 rounded bg-slate-500/20 text-slate-300">
                                DRAW
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      <div className="truncate">
                        <span className="font-semibold text-slate-200">{game.white}</span>
                        <span className="text-slate-500 mx-1.5">vs</span>
                        <span className="font-semibold text-slate-200">{game.black}</span>
                        {game.opening && (
                          <span className="text-[11px] text-slate-400 block truncate">
                            {game.opening}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-slate-400 font-mono text-[11px]">
                      <span>{game.date}</span>
                      <span className="text-accent">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recurring Weaknesses Column */}
            <div className="bg-surface rounded-xl border border-surface-border p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  <span>Personal Weaknesses</span>
                </h3>
                <button
                  onClick={() => setTab('progress')}
                  className="text-xs text-accent hover:underline"
                >
                  Insights
                </button>
              </div>

              {weaknesses.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <p className="text-xs text-slate-400">No weaknesses detected yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Analyze more games to map your recurring tactical mistakes.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {weaknesses.slice(0, 4).map((w) => (
                    <div
                      key={w.id}
                      className="p-3 rounded-lg bg-surface-elevated border border-surface-border"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-200">{w.title}</span>
                        <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          {w.occurrences}x
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {w.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Opening Performance Section */}
          {topOpenings.length > 0 && (
            <div className="bg-surface rounded-xl border border-surface-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                  <BookOpen size={16} className="text-accent" />
                  <span>Opening Performance</span>
                </h3>
                <button
                  onClick={() => setTab('opening-book')}
                  className="text-xs text-accent hover:underline"
                >
                  Opening Repertoire
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {topOpenings.map(([openingName, stats], i) => {
                  const winRate = Math.round((stats.wins / stats.total) * 100);
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-surface-elevated border border-surface-border"
                    >
                      <h4 className="font-semibold text-xs text-slate-200 truncate mb-1" title={openingName}>
                        {openingName}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{stats.total} game(s)</span>
                        <span className="font-mono text-emerald-400 font-bold">{winRate}% wins</span>
                      </div>
                      <div className="w-full bg-surface-border h-1.5 rounded-full mt-2 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${(stats.wins / stats.total) * 100}%` }}
                        />
                        <div
                          className="bg-slate-400 h-full"
                          style={{ width: `${(stats.draws / stats.total) * 100}%` }}
                        />
                        <div
                          className="bg-rose-500 h-full"
                          style={{ width: `${(stats.losses / stats.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
