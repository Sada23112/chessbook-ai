import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Flame,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Clock,
  Award,
  AlertTriangle,
  Play,
  RotateCcw,
  Plus,
  Eye,
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  X,
  RefreshCw,
  Swords,
  Layers,
  Upload,
} from 'lucide-react';
import type {
  OpeningRecommendation,
  OpeningPerformanceReport,
  RecommendationPriority,
  RecommendationType,
  RecommendationStatus,
  PieceColor,
  RepertoireVariation,
} from '../../types/chess';
import { db } from '../../db/db';
import {
  generatePersonalizedRecommendations,
  analyzeOpeningPerformance,
} from '../../repertoire/recommendationEngine';
import { CompactBoardPreview } from '../common/CompactBoardPreview';
import { getCatalogueItemById } from '../../repertoire/data/catalogueIndex';

export interface RecommendedOpeningsViewProps {
  onStartCourse: (repertoireId: string, variationId?: string, mistakeFen?: string) => void;
  onReviewGame: (gameId: string, ply?: number) => void;
  onAddToRepertoire: (variation: RepertoireVariation, side: PieceColor) => Promise<void>;
  onNavigateToGames?: () => void;
  onNavigateToAnalysis?: () => void;
}

export const RecommendedOpeningsView: React.FC<RecommendedOpeningsViewProps> = ({
  onStartCourse,
  onReviewGame,
  onAddToRepertoire,
  onNavigateToGames,
  onNavigateToAnalysis,
}) => {
  const [recommendations, setRecommendations] = useState<OpeningRecommendation[]>([]);
  const [report, setReport] = useState<OpeningPerformanceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterSide, setFilterSide] = useState<'all' | 'white' | 'black'>('all');
  const [filterType, setFilterType] = useState<'all' | RecommendationType>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | RecommendationPriority>('all');
  const [showDismissed, setShowDismissed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [addedSuccessId, setAddedSuccessId] = useState<string | null>(null);

  // Load all user games, analyses, and saved records from Dexie DB
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [games, analyses, repertoires, lineRecords, savedRecords, settings] =
        await Promise.all([
          db.games.toArray(),
          db.analyses.toArray(),
          db.repertoires.toArray(),
          db.courseLineProgress.toArray(),
          db.getRecommendationRecords(),
          db.getSettings(),
        ]);

      const username = settings?.playerUsernames?.chessCom || settings?.playerUsernames?.lichess;

      // Generate report & recommendations
      const perfReport = analyzeOpeningPerformance(games, analyses, username);
      setReport(perfReport);

      const recs = generatePersonalizedRecommendations({
        games,
        analyses,
        repertoires,
        lineRecords,
        savedRecords,
        userPlayerName: username,
      });

      setRecommendations(recs);
    } catch (err) {
      console.warn('Error computing personalized opening recommendations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle dismiss / undismiss
  const handleToggleDismiss = async (rec: OpeningRecommendation, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDismissed = !rec.dismissed;
    await db.setRecommendationDismissed(rec.id, newDismissed);
    setRecommendations((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, dismissed: newDismissed } : r))
    );
  };

  // Handle status update (e.g. mark completed)
  const handleUpdateStatus = async (
    rec: OpeningRecommendation,
    status: RecommendationStatus,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    await db.updateRecommendationStatus(rec.id, status, rec.dismissed);
    setRecommendations((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, status } : r))
    );
  };

  // Handle adding line to user repertoire
  const handleAddLine = async (rec: OpeningRecommendation, e: React.MouseEvent) => {
    e.stopPropagation();
    const variation: RepertoireVariation = {
      id: rec.variationId || `rec_var_${rec.id}`,
      name: rec.openingName,
      eco: rec.eco,
      moves: rec.moves,
      description: rec.reason,
    };
    await onAddToRepertoire(variation, rec.side);
    setAddedSuccessId(rec.id);
    setTimeout(() => {
      setAddedSuccessId(null);
    }, 2500);
  };

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      // Dismissed check
      if (!showDismissed && r.dismissed) return false;
      if (showDismissed && !r.dismissed) return false;

      // Side filter
      if (filterSide !== 'all' && r.side !== filterSide) return false;

      // Type filter
      if (filterType !== 'all' && r.type !== filterType) return false;

      // Priority filter
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.openingName.toLowerCase().includes(q);
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesReason = r.reason.toLowerCase().includes(q);
        const matchesEco = r.eco?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesTitle && !matchesReason && !matchesEco) {
          return false;
        }
      }

      return true;
    });
  }, [
    recommendations,
    showDismissed,
    filterSide,
    filterType,
    filterPriority,
    searchQuery,
  ]);

  // Priority color styling
  const renderPriorityBadge = (priority: RecommendationPriority) => {
    switch (priority) {
      case 'high':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400">
            <Flame size={12} />
            <span>High priority</span>
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300">
            <AlertTriangle size={12} />
            <span>Medium priority</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-slate-300">
            <Info size={12} />
            <span>Low priority</span>
          </span>
        );
    }
  };

  // Category badge styling
  const renderTypeBadge = (type: RecommendationType) => {
    switch (type) {
      case 'fix_mistake':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300">
            <AlertTriangle size={11} />
            <span>Fix move error</span>
          </span>
        );
      case 'anti_gambit_trap':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300">
            <ShieldAlert size={11} />
            <span>Anti-gambit / trap</span>
          </span>
        );
      case 'repertoire_expansion':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300">
            <Layers size={11} />
            <span>Repertoire gap</span>
          </span>
        );
      case 'starter':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300">
            <Sparkles size={11} />
            <span>Starter course</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300">
            <BookOpen size={11} />
            <span>New opening</span>
          </span>
        );
    }
  };

  // Status badge styling
  const renderStatusPill = (status: RecommendationStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={11} />
            <span>Completed</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
            <Sparkles size={11} />
            <span>In progress</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
            <RotateCcw size={11} />
            <span>Needs revision</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-slate-400">
            <span>Not started</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
        <RefreshCw size={28} className="animate-spin text-accent mb-3" />
        <p className="text-sm font-medium">Analyzing your game history and generating recommendations...</p>
      </div>
    );
  }

  const activeRecsCount = recommendations.filter((r) => !r.dismissed).length;
  const dismissedRecsCount = recommendations.filter((r) => r.dismissed).length;

  return (
    <div className="flex-1 flex flex-col space-y-6">
      {/* 1. Header Section */}
      <div className="bg-surface rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
                  <span>Recommended for you</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                    {activeRecsCount}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Personalized opening courses based on your games, mistakes, and repertoire gaps.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              className="px-3.5 py-2 bg-surface-elevated hover:bg-surface-border text-slate-300 rounded-xl text-xs font-medium transition flex items-center space-x-1.5"
              title="Re-scan games and update recommendations"
            >
              <RefreshCw size={13} />
              <span>Refresh recommendations</span>
            </button>
          </div>
        </div>

        {/* 2. Opening Performance Signals Banner */}
        {report && report.totalGames > 0 && (
          <div className="mt-5 pt-5 border-t border-surface-elevated grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-elevated rounded-xl p-3">
              <span className="text-xs font-medium text-slate-400 block">Games examined</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-100">{report.totalGames}</span>
                <span className="text-xs text-slate-500 font-mono">
                  ({report.gamesAsWhite}W / {report.gamesAsBlack}B)
                </span>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-3">
              <span className="text-xs font-medium text-slate-400 block">Analyzed with engine</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-accent">{report.analyzedGamesCount}</span>
                <span className="text-xs text-slate-500 font-mono">
                  / {report.totalGames} games
                </span>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-3">
              <span className="text-xs font-medium text-slate-400 block">Win rate as White</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-200">
                  {report.whiteStats.gamesCount > 0 ? `${report.whiteStats.winRate}%` : '—'}
                </span>
                <span className="text-xs text-slate-500">
                  ({report.whiteStats.wins}W - {report.whiteStats.losses}L)
                </span>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-3">
              <span className="text-xs font-medium text-slate-400 block">Win rate as Black</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-200">
                  {report.blackStats.gamesCount > 0 ? `${report.blackStats.winRate}%` : '—'}
                </span>
                <span className="text-xs text-slate-500">
                  ({report.blackStats.wins}W - {report.blackStats.losses}L)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Unanalyzed games prompt */}
        {report && report.totalGames > 0 && report.analyzedGamesCount < report.totalGames && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2 text-amber-200">
              <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                You have {report.totalGames - report.analyzedGamesCount} unanalyzed game{report.totalGames - report.analyzedGamesCount > 1 ? 's' : ''}. Run Game Review to unlock deep blunder detection and centipawn evaluations for opening lines.
              </span>
            </div>
            {onNavigateToAnalysis && (
              <button
                onClick={onNavigateToAnalysis}
                className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium rounded-lg transition"
              >
                Go to Game Review
              </button>
            )}
          </div>
        )}

        {/* Cold-start prompt if 0 games */}
        {(!report || report.totalGames === 0) && (
          <div className="mt-4 p-4 rounded-xl bg-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2.5 text-blue-200">
              <BookOpen size={17} className="shrink-0 mt-0.5 text-blue-400" />
              <div>
                <p className="font-semibold text-blue-100">No played games detected yet</p>
                <p className="text-blue-300/90 mt-0.5 leading-relaxed">
                  Showing foundational starter courses. Import your games from Chess.com, Lichess, or PGN files in My Games to unlock recommendations tailored directly to your personal opening blunders.
                </p>
              </div>
            </div>
            {onNavigateToGames && (
              <button
                onClick={onNavigateToGames}
                className="shrink-0 px-3.5 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 font-medium rounded-xl transition flex items-center space-x-1.5"
              >
                <Upload size={13} />
                <span>Import games</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-3.5 rounded-2xl">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recommendations..."
            className="w-full pl-9 pr-3.5 py-2 bg-surface-elevated rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Side filter */}
          <div className="flex rounded-xl bg-surface-elevated p-1 text-xs">
            <button
              onClick={() => setFilterSide('all')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                filterSide === 'all' ? 'bg-surface text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterSide('white')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                filterSide === 'white' ? 'bg-surface text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              White
            </button>
            <button
              onClick={() => setFilterSide('black')}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                filterSide === 'black' ? 'bg-surface text-slate-100 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Black
            </button>
          </div>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="px-3 py-2 bg-surface-elevated rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 bg-surface-elevated rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All types</option>
            <option value="fix_mistake">Fix move errors</option>
            <option value="anti_gambit_trap">Anti-gambit / traps</option>
            <option value="repertoire_expansion">Repertoire gaps</option>
            <option value="starter">Starter courses</option>
          </select>

          {/* Show Dismissed Toggle */}
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
              showDismissed
                ? 'bg-amber-500/10 text-amber-300'
                : 'bg-surface-elevated text-slate-400 hover:text-slate-200'
            }`}
          >
            {showDismissed ? 'Showing dismissed' : `Dismissed (${dismissedRecsCount})`}
          </button>
        </div>
      </div>

      {/* 4. Recommendation Cards Grid */}
      {filteredRecs.length === 0 ? (
        <div className="bg-surface rounded-2xl p-12 text-center text-slate-400">
          <CheckCircle2 size={36} className="mx-auto text-slate-500 mb-3" />
          <p className="text-base font-semibold text-slate-200">No recommendations match your filters</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {showDismissed
              ? 'You have not dismissed any recommendations yet.'
              : 'Try clearing your search or side filters to see all available opening courses.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecs.map((rec) => {
            const isExpanded = expandedRecId === rec.id;
            const isAddedSuccess = addedSuccessId === rec.id;

            return (
              <div
                key={rec.id}
                className="flex flex-col justify-between bg-surface rounded-2xl p-6 transition hover:bg-surface/90"
              >
                <div>
                  {/* Top Header Pills */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {renderTypeBadge(rec.type)}
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-slate-300 capitalize">
                        {rec.side}
                      </span>
                      {rec.eco && (
                        <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-surface-elevated text-accent">
                          {rec.eco}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {renderPriorityBadge(rec.priority)}
                    </div>
                  </div>

                  {/* Title & Opening Name */}
                  <h3 className="text-base font-bold text-slate-100 tracking-tight leading-snug">
                    {rec.title}
                  </h3>
                  <p className="text-xs font-medium text-accent mt-0.5">
                    {rec.openingName}
                  </p>

                  {/* Rationale backed by game data */}
                  <div className="mt-3 p-3.5 rounded-xl bg-surface-elevated text-xs text-slate-300 leading-relaxed">
                    <p className="font-semibold text-slate-200 mb-0.5">Why this is recommended:</p>
                    <p className="text-slate-300">{rec.reason}</p>
                    {rec.recurringMistake && (
                      <p className="text-slate-400 text-xs mt-2 border-t border-surface-border pt-1.5">
                        <span className="text-slate-300 font-medium">Specific issue:</span> {rec.recurringMistake}
                      </p>
                    )}
                  </div>

                  {/* Metadata Row: Games count, win rate, estimated time */}
                  <div className="flex flex-wrap items-center gap-3.5 mt-3.5 text-xs text-slate-400">
                    {rec.gamesCount > 0 ? (
                      <span className="flex items-center space-x-1.5">
                        <Swords size={13} className="text-slate-400" />
                        <span>
                          {rec.gamesCount} game{rec.gamesCount > 1 ? 's' : ''} ({rec.wins}W - {rec.losses}L)
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1.5">
                        <Sparkles size={13} className="text-emerald-400" />
                        <span>Curated starter</span>
                      </span>
                    )}

                    <span className="flex items-center space-x-1.5">
                      <Clock size={13} className="text-slate-400" />
                      <span>{rec.estimatedMinutes} mins est.</span>
                    </span>

                    <span className="flex items-center space-x-1.5">
                      <Award size={13} className="text-slate-400" />
                      <span>{rec.difficulty}</span>
                    </span>

                    <div className="ml-auto">
                      {renderStatusPill(rec.status)}
                    </div>
                  </div>

                  {/* Priority Reason Explanation */}
                  <div className="mt-2 text-xs text-slate-400 italic">
                    {rec.priorityReason}
                  </div>

                  {/* Expandable Evidence Drawer */}
                  {rec.evidence.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                        className="text-xs text-accent hover:text-accent-hover font-medium flex items-center space-x-1 transition"
                      >
                        <span>{isExpanded ? 'Hide game evidence' : `View ${rec.evidence.length} game examples`}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 space-y-2 p-3 rounded-xl bg-surface-elevated">
                          {rec.evidence.map((ev, i) => (
                            <div
                              key={i}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-surface text-xs"
                            >
                              <div>
                                <span className="font-semibold text-slate-200">{ev.gameTitle}</span>
                                <span className="text-xs text-slate-400 ml-1.5">({ev.date})</span>
                                <div className="mt-0.5 text-xs text-slate-300">
                                  Move {ev.moveNumber}: You played{' '}
                                  <span className="font-mono text-rose-300 font-bold">{ev.playedSan}</span>{' '}
                                  (Engine suggests{' '}
                                  <span className="font-mono text-emerald-300 font-bold">{ev.bestMoveSan}</span>
                                  {ev.cpl ? `, -${ev.cpl} cpl` : ''})
                                </div>
                                {ev.consequence && (
                                  <p className="text-xs text-slate-400 mt-0.5">{ev.consequence}</p>
                                )}
                              </div>

                              <button
                                onClick={() => onReviewGame(ev.gameId, ev.ply)}
                                className="shrink-0 px-3 py-1 bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-lg text-xs font-medium transition flex items-center space-x-1"
                              >
                                <ExternalLink size={11} />
                                <span>Replay position</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-4 pt-4 border-t border-surface-elevated flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Primary action: Start Course */}
                    <button
                      onClick={() => onStartCourse(rec.repertoireId || 'rep_white_e4', rec.variationId)}
                      className="px-4 py-2 bg-accent hover:bg-accent-hover text-black rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                    >
                      <Play size={13} />
                      <span>Start course</span>
                    </button>

                    {/* Targeted practice from mistake position */}
                    {rec.mistakeFen && (
                      <button
                        onClick={() =>
                          onStartCourse(rec.repertoireId || 'rep_white_e4', rec.variationId, rec.mistakeFen)
                        }
                        className="px-3.5 py-2 bg-surface-elevated hover:bg-surface-border text-slate-200 rounded-xl text-xs font-medium transition flex items-center space-x-1.5"
                        title="Practice move starting directly from the mistake position"
                      >
                        <RotateCcw size={12} />
                        <span>Practice from mistake</span>
                      </button>
                    )}

                    {/* Add to Personal Repertoire */}
                    <button
                      onClick={(e) => handleAddLine(rec, e)}
                      disabled={isAddedSuccess}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1 ${
                        isAddedSuccess
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-surface-elevated hover:bg-surface-border text-slate-300'
                      }`}
                      title="Add this opening variation to your personal repertoire"
                    >
                      {isAddedSuccess ? <Check size={12} /> : <Plus size={12} />}
                      <span>{isAddedSuccess ? 'Added' : 'Add to repertoire'}</span>
                    </button>
                  </div>

                  {/* Secondary actions: Dismiss or Mark Completed */}
                  <div className="flex items-center space-x-1">
                    {rec.status !== 'completed' ? (
                      <button
                        onClick={(e) => handleUpdateStatus(rec, 'completed', e)}
                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-surface-elevated rounded-lg transition"
                        title="Mark as completed"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleUpdateStatus(rec, 'not_started', e)}
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-elevated rounded-lg transition"
                        title="Reset progress"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleToggleDismiss(rec, e)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-surface-elevated rounded-lg transition"
                      title={rec.dismissed ? 'Restore recommendation' : 'Dismiss recommendation'}
                    >
                      {rec.dismissed ? <RotateCcw size={14} /> : <X size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
