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
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Flame size={12} />
            <span>High Priority</span>
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle size={12} />
            <span>Medium Priority</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Info size={12} />
            <span>Low Priority</span>
          </span>
        );
    }
  };

  // Category badge styling
  const renderTypeBadge = (type: RecommendationType) => {
    switch (type) {
      case 'fix_mistake':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 text-red-300 border border-red-800/50">
            <AlertTriangle size={10} />
            <span>Fix Move Error</span>
          </span>
        );
      case 'anti_gambit_trap':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50">
            <ShieldAlert size={10} />
            <span>Anti-Gambit / Trap</span>
          </span>
        );
      case 'repertoire_expansion':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/60 text-blue-300 border border-blue-800/50">
            <Layers size={10} />
            <span>Repertoire Gap</span>
          </span>
        );
      case 'starter':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
            <Sparkles size={10} />
            <span>Starter Course</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-800/50">
            <BookOpen size={10} />
            <span>New Opening</span>
          </span>
        );
    }
  };

  // Status badge styling
  const renderStatusPill = (status: RecommendationStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 size={11} />
            <span>Completed</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Sparkles size={11} />
            <span>In Progress</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <RotateCcw size={11} />
            <span>Needs Revision</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-elevated text-slate-400 border border-surface-border">
            <span>Not Started</span>
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
      <div className="bg-surface-elevated/70 border border-surface-border/80 rounded-2xl p-4 sm:p-6 backdrop-blur-sm shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                  <span>Recommended for You</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold border border-accent/30">
                    {activeRecsCount}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Personalized opening courses based on your games, mistakes, and playing style.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-border text-slate-300 border border-surface-border rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm"
              title="Re-scan games and update recommendations"
            >
              <RefreshCw size={13} />
              <span>Refresh Recommendations</span>
            </button>
          </div>
        </div>

        {/* 2. Opening Performance Signals Banner */}
        {report && report.totalGames > 0 && (
          <div className="mt-5 pt-5 border-t border-surface-border/70 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-dark/60 border border-surface-border/50 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Games Examined</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-100">{report.totalGames}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({report.gamesAsWhite}W / {report.gamesAsBlack}B)
                </span>
              </div>
            </div>

            <div className="bg-surface-dark/60 border border-surface-border/50 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Analyzed with Engine</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-accent">{report.analyzedGamesCount}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  / {report.totalGames} games
                </span>
              </div>
            </div>

            <div className="bg-surface-dark/60 border border-surface-border/50 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Win Rate as White</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-200">
                  {report.whiteStats.gamesCount > 0 ? `${report.whiteStats.winRate}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-500">
                  ({report.whiteStats.wins}W - {report.whiteStats.losses}L)
                </span>
              </div>
            </div>

            <div className="bg-surface-dark/60 border border-surface-border/50 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-400 block">Win Rate as Black</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-lg font-bold text-slate-200">
                  {report.blackStats.gamesCount > 0 ? `${report.blackStats.winRate}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-500">
                  ({report.blackStats.wins}W - {report.blackStats.losses}L)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Unanalyzed games prompt */}
        {report && report.totalGames > 0 && report.analyzedGamesCount < report.totalGames && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2 text-amber-200">
              <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                You have {report.totalGames - report.analyzedGamesCount} unanalyzed game{report.totalGames - report.analyzedGamesCount > 1 ? 's' : ''}. Run Game Review to unlock deep blunder detection and centipawn evaluations for opening lines.
              </span>
            </div>
            {onNavigateToAnalysis && (
              <button
                onClick={onNavigateToAnalysis}
                className="shrink-0 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold rounded-lg transition"
              >
                Go to Game Review
              </button>
            )}
          </div>
        )}

        {/* Cold-start prompt if 0 games */}
        {(!report || report.totalGames === 0) && (
          <div className="mt-4 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-2.5 text-blue-200">
              <BookOpen size={17} className="shrink-0 mt-0.5 text-blue-400" />
              <div>
                <p className="font-semibold text-blue-100">No played games detected yet</p>
                <p className="text-blue-300/90 mt-0.5">
                  Showing foundational starter courses. Import your games from Chess.com, Lichess, or PGN files in My Games to unlock recommendations tailored directly to your personal opening blunders.
                </p>
              </div>
            </div>
            {onNavigateToGames && (
              <button
                onClick={onNavigateToGames}
                className="shrink-0 px-3 py-1.5 bg-blue-500/25 hover:bg-blue-500/35 text-blue-200 font-semibold rounded-lg transition flex items-center space-x-1"
              >
                <Upload size={13} />
                <span>Import Games</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-elevated/40 border border-surface-border/50 p-3 rounded-xl">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recommendations..."
            className="w-full pl-9 pr-3 py-1.5 bg-surface-dark border border-surface-border rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Side filter */}
          <div className="flex rounded-lg bg-surface-dark p-0.5 border border-surface-border text-xs">
            <button
              onClick={() => setFilterSide('all')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filterSide === 'all' ? 'bg-surface-border text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Sides
            </button>
            <button
              onClick={() => setFilterSide('white')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filterSide === 'white' ? 'bg-surface-border text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              White
            </button>
            <button
              onClick={() => setFilterSide('black')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                filterSide === 'black' ? 'bg-surface-border text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Black
            </button>
          </div>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="px-2.5 py-1 bg-surface-dark border border-surface-border rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-2.5 py-1 bg-surface-dark border border-surface-border rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="fix_mistake">Fix Move Errors</option>
            <option value="anti_gambit_trap">Anti-Gambit / Traps</option>
            <option value="repertoire_expansion">Repertoire Gaps</option>
            <option value="starter">Starter Courses</option>
          </select>

          {/* Show Dismissed Toggle */}
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              showDismissed
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-surface-dark text-slate-400 hover:text-slate-200 border-surface-border'
            }`}
          >
            {showDismissed ? 'Showing Dismissed' : `Dismissed (${dismissedRecsCount})`}
          </button>
        </div>
      </div>

      {/* 4. Recommendation Cards Grid */}
      {filteredRecs.length === 0 ? (
        <div className="bg-surface-elevated/40 border border-surface-border rounded-2xl p-10 text-center text-slate-400">
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
                className={`flex flex-col justify-between bg-surface-elevated/80 border rounded-2xl p-4 sm:p-5 transition hover:shadow-xl ${
                  rec.priority === 'high'
                    ? 'border-rose-500/30 hover:border-rose-500/50'
                    : 'border-surface-border hover:border-slate-600'
                }`}
              >
                <div>
                  {/* Top Header Pills */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {renderTypeBadge(rec.type)}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-dark text-slate-300 border border-surface-border uppercase">
                        {rec.side}
                      </span>
                      {rec.eco && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-dark text-slate-400 border border-surface-border">
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
                  <div className="mt-2.5 p-2.5 rounded-xl bg-surface-dark/70 border border-surface-border/60 text-xs text-slate-300 leading-relaxed">
                    <p className="font-semibold text-slate-200 mb-0.5">Why this is recommended:</p>
                    <p className="text-slate-300">{rec.reason}</p>
                    {rec.recurringMistake && (
                      <p className="text-slate-400 text-[11px] mt-1.5 border-t border-surface-border/50 pt-1">
                        <span className="text-slate-300 font-medium">Specific issue:</span> {rec.recurringMistake}
                      </p>
                    )}
                  </div>

                  {/* Metadata Row: Games count, win rate, estimated time */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-400">
                    {rec.gamesCount > 0 ? (
                      <span className="flex items-center space-x-1">
                        <Swords size={12} className="text-slate-400" />
                        <span>
                          {rec.gamesCount} game{rec.gamesCount > 1 ? 's' : ''} ({rec.wins}W - {rec.losses}L)
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <Sparkles size={12} className="text-emerald-400" />
                        <span>Curated Starter</span>
                      </span>
                    )}

                    <span className="flex items-center space-x-1">
                      <Clock size={12} className="text-slate-400" />
                      <span>{rec.estimatedMinutes} mins est.</span>
                    </span>

                    <span className="flex items-center space-x-1">
                      <Award size={12} className="text-slate-400" />
                      <span>{rec.difficulty}</span>
                    </span>

                    <div className="ml-auto">
                      {renderStatusPill(rec.status)}
                    </div>
                  </div>

                  {/* Priority Reason Explanation */}
                  <div className="mt-2 text-[10px] text-slate-400 italic">
                    {rec.priorityReason}
                  </div>

                  {/* Expandable Evidence Drawer */}
                  {rec.evidence.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandedRecId(isExpanded ? null : rec.id)}
                        className="text-xs text-accent hover:text-accent-hover font-medium flex items-center space-x-1 transition"
                      >
                        <span>{isExpanded ? 'Hide Game Evidence' : `View ${rec.evidence.length} Game Examples`}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 p-3 rounded-xl bg-surface-dark border border-surface-border">
                          {rec.evidence.map((ev, i) => (
                            <div
                              key={i}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-surface-elevated/50 border border-surface-border/50 text-xs"
                            >
                              <div>
                                <span className="font-semibold text-slate-200">{ev.gameTitle}</span>
                                <span className="text-[11px] text-slate-400 ml-1.5">({ev.date})</span>
                                <div className="mt-0.5 text-[11px] text-slate-300">
                                  Move {ev.moveNumber}: You played{' '}
                                  <span className="font-mono text-rose-300 font-bold">{ev.playedSan}</span>{' '}
                                  (Engine suggests{' '}
                                  <span className="font-mono text-emerald-300 font-bold">{ev.bestMoveSan}</span>
                                  {ev.cpl ? `, -${ev.cpl} cpl` : ''})
                                </div>
                                {ev.consequence && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">{ev.consequence}</p>
                                )}
                              </div>

                              <button
                                onClick={() => onReviewGame(ev.gameId, ev.ply)}
                                className="shrink-0 px-2.5 py-1 bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border rounded-lg text-[11px] font-semibold transition flex items-center space-x-1"
                              >
                                <ExternalLink size={11} />
                                <span>Replay Position</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-4 pt-3.5 border-t border-surface-border/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Primary action: Start Course */}
                    <button
                      onClick={() => onStartCourse(rec.repertoireId || 'rep_white_e4', rec.variationId)}
                      className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-black rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <Play size={13} />
                      <span>Start Course</span>
                    </button>

                    {/* Targeted practice from mistake position */}
                    {rec.mistakeFen && (
                      <button
                        onClick={() =>
                          onStartCourse(rec.repertoireId || 'rep_white_e4', rec.variationId, rec.mistakeFen)
                        }
                        className="px-3 py-1.5 bg-surface-dark hover:bg-surface-border text-slate-200 border border-surface-border rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                        title="Practice move starting directly from the mistake position"
                      >
                        <RotateCcw size={12} />
                        <span>Practice from Mistake</span>
                      </button>
                    )}

                    {/* Add to Personal Repertoire */}
                    <button
                      onClick={(e) => handleAddLine(rec, e)}
                      disabled={isAddedSuccess}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1 border ${
                        isAddedSuccess
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-surface-dark hover:bg-surface-border text-slate-300 border-surface-border'
                      }`}
                      title="Add this opening variation to your personal repertoire"
                    >
                      {isAddedSuccess ? <Check size={12} /> : <Plus size={12} />}
                      <span>{isAddedSuccess ? 'Added!' : 'Add to Repertoire'}</span>
                    </button>
                  </div>

                  {/* Secondary actions: Dismiss or Mark Completed */}
                  <div className="flex items-center space-x-1">
                    {rec.status !== 'completed' ? (
                      <button
                        onClick={(e) => handleUpdateStatus(rec, 'completed', e)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-surface-dark rounded-lg transition"
                        title="Mark as completed"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleUpdateStatus(rec, 'not_started', e)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-dark rounded-lg transition"
                        title="Reset progress"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleToggleDismiss(rec, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-surface-dark rounded-lg transition"
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
