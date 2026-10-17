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
    <div className="flex-1 flex flex-col overflow-y-auto bg-background select-none">
      <div className="max-w-5xl w-full mx-auto px-4 md:px-8 py-6 md:py-8">

        {/* Chess.com Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7 bg-[#262421] p-5 rounded-[6px] border border-[#383531]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[6px] bg-[#81b64c] text-white font-black text-xl flex items-center justify-center shadow-md shrink-0">
              {userHandle.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {userHandle}
                </h1>
                <span className="px-1.5 py-0.2 bg-[#81b64c]/20 text-[#81b64c] text-[10px] font-bold rounded uppercase">
                  Online
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#989795] mt-0.5">
                <span>Rapid: <strong className="text-white font-mono">1540</strong></span>
                <span>•</span>
                <span>Blitz: <strong className="text-white font-mono">1485</strong></span>
                <span>•</span>
                <span>Puzzles: <strong className="text-white font-mono">1620</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setTab('my-games')}
              className="chess-btn-secondary px-4 py-2 text-xs font-bold rounded-[6px] flex items-center gap-2"
            >
              <Upload size={14} />
              <span>Import PGN</span>
            </button>
            <button
              onClick={() => setTab('training')}
              className="chess-btn-primary px-4 py-2 text-xs font-bold rounded-[6px] flex items-center gap-2 shadow"
            >
              <Dumbbell size={14} />
              <span>Train Puzzles ({dueCardsCount})</span>
            </button>
          </div>
        </div>

        {/* Quick Action Tiles (Chess.com Style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-7">
          <div
            onClick={() => {
              if (games.length > 0) {
                setActiveGame(games[0].id);
                setTab('analysis');
              } else {
                setTab('my-games');
              }
            }}
            className="bg-[#262421] hover:bg-[#312e2b] p-4 rounded-[6px] border border-[#383531] cursor-pointer transition flex items-center gap-3.5 group shadow-sm"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#81b64c]/15 text-[#81b64c] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Activity size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white group-hover:text-[#81b64c] transition-colors">
                Game Review
              </h3>
              <p className="text-xs text-[#989795] truncate">
                Analyze games with Stockfish & coach
              </p>
            </div>
          </div>

          <div
            onClick={() => setTab('training')}
            className="bg-[#262421] hover:bg-[#312e2b] p-4 rounded-[6px] border border-[#383531] cursor-pointer transition flex items-center gap-3.5 group shadow-sm"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#e58f2a]/15 text-[#e58f2a] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Dumbbell size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white group-hover:text-[#e58f2a] transition-colors">
                Tactics & Puzzles
              </h3>
              <p className="text-xs text-[#989795] truncate">
                {dueCardsCount > 0 ? `${dueCardsCount} exercises due today` : 'Daily puzzle training'}
              </p>
            </div>
          </div>

          <div
            onClick={() => setTab('opening-book')}
            className="bg-[#262421] hover:bg-[#312e2b] p-4 rounded-[6px] border border-[#383531] cursor-pointer transition flex items-center gap-3.5 group shadow-sm"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#1baca6]/15 text-[#1baca6] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white group-hover:text-[#1baca6] transition-colors">
                Openings Explorer
              </h3>
              <p className="text-xs text-[#989795] truncate">
                Master opening repertoires & traps
              </p>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {games.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center bg-[#262421] rounded-[6px] border border-[#383531] p-8">
            <div className="w-14 h-14 rounded-[8px] bg-[#383531] flex items-center justify-center text-2xl mb-4 text-[#81b64c]">
              ♟
            </div>
            <h2 className="text-base font-bold text-white mb-1.5">No Games Imported Yet</h2>
            <p className="text-[#989795] text-xs leading-relaxed max-w-sm mb-6">
              Paste a PGN or import from Chess.com to get instant Stockfish game reviews, accuracy scores, and coach blunder explanations.
            </p>
            <button
              onClick={() => setTab('my-games')}
              className="chess-btn-primary px-5 py-2.5 rounded-[6px] text-xs font-bold transition flex items-center gap-2"
            >
              <Upload size={14} />
              <span>Import Your First Game</span>
            </button>
          </div>
        ) : (
          <>
            {/* Stats row (Chess.com Style) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
              <div className="bg-[#262421] rounded-[6px] p-4 border border-[#383531]">
                <p className="text-[#989795] text-xs font-semibold mb-2">Games Analyzed</p>
                <p className="text-2xl font-black text-white font-sans">{analyzedGamesCount}</p>
                <p className="text-[#6b6967] text-[11px] mt-1">of {games.length} total games</p>
              </div>

              <div className="bg-[#262421] rounded-[6px] p-4 border border-[#383531]">
                <p className="text-[#989795] text-xs font-semibold mb-2">Avg Accuracy</p>
                <p className="text-2xl font-black text-[#81b64c] font-sans">
                  {analyses.length > 0
                    ? `${Math.round(
                        analyses.reduce((acc, a) => acc + (a.summary.accuracyWhite + a.summary.accuracyBlack) / 2, 0) /
                          analyses.length
                      )}%`
                    : '—'}
                </p>
                <p className="text-[#6b6967] text-[11px] mt-1">across review history</p>
              </div>

              <div className="bg-[#262421] rounded-[6px] p-4 border border-[#383531]">
                <p className="text-[#989795] text-xs font-semibold mb-2">Blunders Caught</p>
                <p className="text-2xl font-black text-[#ca3431] font-sans">{totals.blunders}</p>
                <p className="text-[#6b6967] text-[11px] mt-1">{totals.mistakes} mistakes identified</p>
              </div>

              <div className="bg-[#262421] rounded-[6px] p-4 border border-[#383531]">
                <p className="text-[#989795] text-xs font-semibold mb-2">Puzzles in Queue</p>
                <p className="text-2xl font-black text-[#81b64c] font-sans">{dueCardsCount}</p>
                <p className="text-[#6b6967] text-[11px] mt-1">due for spaced repetition</p>
              </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">
              {/* Recent Games (Chess.com table style) */}
              <div className="lg:col-span-2 bg-[#262421] rounded-[6px] p-4 border border-[#383531]">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#383531]">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Activity size={15} className="text-[#81b64c]" />
                    Recent Games Archive
                  </h3>
                  <button
                    onClick={() => setTab('my-games')}
                    className="text-xs text-[#989795] hover:text-white font-bold flex items-center gap-1 transition"
                  >
                    View All <ArrowRight size={12} />
                  </button>
                </div>

                <div className="divide-y divide-[#383531]/60">
                  {games.slice(0, 5).map((game) => {
                    const outcome = getGameOutcome(game, userHandle);
                    const gameAnalysis = analyses.find((a) => a.gameId === game.id);
                    return (
                      <div
                        key={game.id}
                        onClick={() => {
                          setActiveGame(game.id);
                          setTab('analysis');
                        }}
                        className="py-2.5 px-2 hover:bg-[#312e2b] transition cursor-pointer flex items-center justify-between group rounded-[4px]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Chess.com result badge */}
                          <span
                            className={`w-6 h-6 rounded-[3px] text-xs font-black flex items-center justify-center shrink-0 shadow-sm ${
                              outcome.isWin
                                ? 'bg-[#81b64c] text-white'
                                : outcome.isLoss
                                ? 'bg-[#ca3431] text-white'
                                : 'bg-[#6b6967] text-white'
                            }`}
                          >
                            {outcome.isWin ? 'W' : outcome.isLoss ? 'L' : 'D'}
                          </span>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate group-hover:text-[#81b64c] transition-colors">
                              <span>{game.white}</span>
                              <span className="text-[#989795] font-normal mx-1">vs</span>
                              <span>{game.black}</span>
                            </p>
                            {game.opening && (
                              <p className="text-[11px] text-[#989795] truncate mt-0.5 font-medium">
                                {game.eco && <span className="font-mono text-[#81b64c] mr-1">[{game.eco}]</span>}
                                {game.opening}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          {gameAnalysis && (
                            <span className="text-[11px] font-bold font-sans px-2 py-0.5 rounded bg-[#81b64c]/15 text-[#81b64c] border border-[#81b64c]/30">
                              {Math.round(gameAnalysis.summary.accuracyWhite)}%
                            </span>
                          )}
                          <span className="text-[11px] text-[#989795] font-mono">{game.date}</span>
                          <span className="text-xs text-[#81b64c] opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                            Review →
                          </span>
                        </div>
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
