import React, { useEffect, useState } from 'react';
import {
  Upload,
  Dumbbell,
  Award,
  AlertTriangle,
  Activity,
  Layers,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../db/db';
import type {
  GameRecord,
  GameAnalysis,
  TrainingCard,
  WeaknessRecord,
  CourseLineRecord,
} from '../../types/chess';
import { useAppStore } from '../../store/useAppStore';
import { getGameOutcome } from '../../utils/gameOutcome';
import {
  buildCourseFromRepertoire,
  calculateCourseProgress,
} from '../../repertoire/courseEngine';

export const DashboardView: React.FC = () => {
  const { setTab, setActiveGame, settings } = useAppStore();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [analyses, setAnalyses] = useState<GameAnalysis[]>([]);
  const [dueCardsCount, setDueCardsCount] = useState(0);
  const [weaknesses, setWeaknesses] = useState<WeaknessRecord[]>([]);
  const [courseMastery, setCourseMastery] = useState<{
    totalCourses: number;
    totalLines: number;
    completedLines: number;
    masteredLines: number;
    percentage: number;
    recentCourses: Array<{
      id: string;
      name: string;
      color: string;
      completedLines: number;
      totalLines: number;
      percentage: number;
    }>;
  }>({
    totalCourses: 0,
    totalLines: 0,
    completedLines: 0,
    masteredLines: 0,
    percentage: 0,
    recentCourses: [],
  });

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

      try {
        const reps = await db.repertoires.toArray();
        const progressRecords = await db.courseLineProgress.toArray();
        const recMap = new Map<string, CourseLineRecord>();
        for (const r of progressRecords) {
          recMap.set(r.lineId, r);
        }

        let totalLines = 0;
        let completedLines = 0;
        let masteredLines = 0;
        const recentList: Array<{
          id: string;
          name: string;
          color: string;
          completedLines: number;
          totalLines: number;
          percentage: number;
          lastPracticed: number;
        }> = [];

        for (const rep of reps) {
          const course = buildCourseFromRepertoire(rep);
          const cp = calculateCourseProgress(course, recMap);
          totalLines += cp.totalLines;
          completedLines += cp.completedLines;
          masteredLines += cp.masteredLines;

          let latestPractice = 0;
          for (const v of rep.variations || []) {
            const rec = recMap.get(v.id);
            if (rec?.lastPracticed && rec.lastPracticed > latestPractice) {
              latestPractice = rec.lastPracticed;
            }
          }
          if (latestPractice > 0) {
            recentList.push({
              id: rep.id,
              name: rep.name,
              color: rep.color,
              completedLines: cp.completedLines,
              totalLines: cp.totalLines,
              percentage: cp.percentage,
              lastPracticed: latestPractice,
            });
          }
        }

        recentList.sort((a, b) => b.lastPracticed - a.lastPracticed);

        const percentage =
          totalLines > 0 ? Math.min(100, Math.round((completedLines / totalLines) * 100)) : 0;

        setCourseMastery({
          totalCourses: reps.length,
          totalLines,
          completedLines,
          masteredLines,
          percentage,
          recentCourses: recentList.slice(0, 3),
        });
      } catch (err) {
        console.warn('Error loading course mastery on dashboard:', err);
      }
    };

    fetchData();
  }, []);

  const analyzedGamesCount = analyses.length;

  const avgCpl =
    analyses.length > 0
      ? Math.round(
          analyses.reduce((acc, a) => acc + (a.summary.whiteCPL + a.summary.blackCPL) / 2, 0) /
            analyses.length
        )
      : null;

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
    <div className="flex-1 flex flex-col overflow-y-auto bg-background">
      <div className="max-w-5xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
              Good morning
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Here's where your chess stands today.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setTab('my-games')}
              className="px-3.5 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-300 border border-surface-border/70 text-sm font-medium rounded-xl transition flex items-center gap-2"
            >
              <Upload size={14} className="text-slate-400" />
              Import Games
            </button>
            <button
              onClick={() => setTab('training')}
              className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-black text-sm font-semibold rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <Dumbbell size={14} />
              Train ({dueCardsCount})
            </button>
          </div>
        </div>

        {/* Empty state */}
        {games.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center text-2xl mb-5 text-slate-500">
              ♟
            </div>
            <h2 className="text-lg font-semibold text-slate-200 mb-2">No games yet</h2>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-7">
              Import your games and we'll analyze them with Stockfish, track your opening mistakes, and build a personalized training queue.
            </p>
            <button
              onClick={() => setTab('my-games')}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-sm transition shadow flex items-center gap-2"
            >
              <Upload size={15} />
              Import Your First Game
            </button>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <div className="bg-surface rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-3">Games analyzed</p>
                <p className="text-2xl font-bold text-slate-100 font-mono">{analyzedGamesCount}</p>
                <p className="text-slate-600 text-xs mt-1">of {games.length} total</p>
              </div>

              <div className="bg-surface rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-3">Avg CPL</p>
                <p className="text-2xl font-bold text-slate-100 font-mono">
                  {avgCpl !== null ? avgCpl : '—'}
                </p>
                <p className="text-slate-600 text-xs mt-1">centipawn loss</p>
              </div>

              <div className="bg-surface rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-3">Blunders</p>
                <p className="text-2xl font-bold text-rose-400 font-mono">{totals.blunders}</p>
                <p className="text-slate-600 text-xs mt-1">{totals.mistakes} mistakes</p>
              </div>

              <div className="bg-surface rounded-2xl p-5">
                <p className="text-slate-500 text-xs mb-3">Due exercises</p>
                <p className="text-2xl font-bold text-accent font-mono">{dueCardsCount}</p>
                <p className="text-slate-600 text-xs mt-1">in review queue</p>
              </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
              {/* Recent Games */}
              <div className="lg:col-span-2 bg-surface rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                    <Activity size={14} className="text-accent" />
                    Recent Games
                  </h3>
                  <button
                    onClick={() => setTab('my-games')}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    View all <ArrowRight size={11} />
                  </button>
                </div>

                <div className="space-y-1">
                  {games.slice(0, 5).map((game) => {
                    const outcome = getGameOutcome(game, userHandle);
                    return (
                      <div
                        key={game.id}
                        onClick={() => setActiveGame(game.id)}
                        className="px-3 py-2.5 rounded-xl hover:bg-surface-elevated transition cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`text-[11px] font-bold w-8 shrink-0 ${
                              outcome.isWin
                                ? 'text-emerald-400'
                                : outcome.isLoss
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {outcome.isWin ? 'WIN' : outcome.isLoss ? 'LOSS' : 'DRAW'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-300 truncate">
                              <span className="font-medium">{game.white}</span>
                              <span className="text-slate-600 mx-1.5 text-xs">vs</span>
                              <span className="font-medium">{game.black}</span>
                            </p>
                            {game.opening && (
                              <p className="text-[11px] text-slate-600 truncate mt-0.5">{game.opening}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-600 font-mono shrink-0 ml-3">{game.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recurring Weaknesses */}
              <div className="bg-surface rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Weaknesses
                  </h3>
                  <button
                    onClick={() => setTab('progress')}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    Insights <ArrowRight size={11} />
                  </button>
                </div>

                {weaknesses.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-slate-500">No patterns yet</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Analyze more games to surface recurring mistakes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weaknesses.slice(0, 4).map((w) => (
                      <div
                        key={w.id}
                        className="px-3 py-2.5 rounded-xl bg-surface-elevated"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-200">{w.title}</span>
                          <span className="text-xs font-mono text-amber-400/80">{w.occurrences}×</span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {w.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Repertoire Mastery */}
            <div className="bg-surface rounded-2xl p-5 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                    <Layers size={14} className="text-accent" />
                    Repertoire Coverage
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Opening lines practiced and mastered.
                  </p>
                </div>
                <button
                  onClick={() => setTab('opening-book')}
                  className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-hover text-slate-300 border border-surface-border/70 rounded-xl text-xs font-medium transition flex items-center gap-1.5 self-start sm:self-auto"
                >
                  Browse repertoires
                  <ArrowRight size={12} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-400">Overall completion</span>
                  <span className="font-mono text-slate-300 font-semibold">
                    {courseMastery.completedLines}/{courseMastery.totalLines} lines · {courseMastery.percentage}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      courseMastery.percentage === 100
                        ? 'bg-emerald-400'
                        : 'bg-accent'
                    }`}
                    style={{ width: `${courseMastery.percentage}%` }}
                  />
                </div>
              </div>

              {/* Quick metrics */}
              <div className="flex items-center gap-4 text-xs mb-5">
                <div>
                  <span className="text-slate-600 block">Courses</span>
                  <span className="font-semibold text-slate-300 font-mono">{courseMastery.totalCourses}</span>
                </div>
                <div className="w-px h-6 bg-surface-border" />
                <div>
                  <span className="text-slate-600 block">Completed</span>
                  <span className="font-semibold text-slate-300 font-mono">{courseMastery.completedLines}</span>
                </div>
                <div className="w-px h-6 bg-surface-border" />
                <div>
                  <span className="text-slate-600 block">Mastered</span>
                  <span className="font-semibold text-emerald-400 font-mono">{courseMastery.masteredLines}</span>
                </div>
              </div>

              {/* Recently practiced */}
              {courseMastery.recentCourses.length > 0 && (
                <div>
                  <p className="text-xs text-slate-600 mb-2.5">Recently practiced</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {courseMastery.recentCourses.map((rc) => (
                      <div
                        key={rc.id}
                        onClick={() => setTab('opening-book')}
                        className="px-3.5 py-3 rounded-xl bg-surface-elevated hover:bg-surface-hover cursor-pointer transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                            {rc.color}
                          </span>
                          <span className="text-xs font-mono text-accent font-semibold">
                            {rc.percentage}%
                          </span>
                        </div>
                        <h4 className="text-xs font-medium text-slate-300 truncate mb-2.5">{rc.name}</h4>
                        <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-accent h-full rounded-full"
                            style={{ width: `${rc.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Opening Performance */}
            {topOpenings.length > 0 && (
              <div className="bg-surface rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                    <BookOpen size={14} className="text-accent" />
                    Opening Performance
                  </h3>
                  <button
                    onClick={() => setTab('opening-book')}
                    className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    Repertoire <ArrowRight size={11} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {topOpenings.map(([openingName, stats], i) => {
                    const winRate = Math.round((stats.wins / stats.total) * 100);
                    return (
                      <div
                        key={i}
                        className="px-3.5 py-3 rounded-xl bg-surface-elevated"
                      >
                        <h4
                          className="font-medium text-xs text-slate-300 truncate mb-1"
                          title={openingName}
                        >
                          {openingName}
                        </h4>
                        <div className="flex items-center justify-between text-xs mb-2.5">
                          <span className="text-slate-600">{stats.total} game{stats.total !== 1 ? 's' : ''}</span>
                          <span className="font-mono text-emerald-400 font-semibold">{winRate}% W</span>
                        </div>
                        <div className="w-full h-1 rounded-full overflow-hidden flex bg-surface">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${(stats.wins / stats.total) * 100}%` }}
                          />
                          <div
                            className="bg-slate-500/60 h-full"
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
    </div>
  );
};
