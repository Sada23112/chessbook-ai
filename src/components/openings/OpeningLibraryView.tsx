import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Dumbbell,
  Compass,
  ArrowRight,
  Upload,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Award,
} from 'lucide-react';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  PieceColor,
  CourseLineRecord,
} from '../../types/chess';
import { db } from '../../db/db';
import {
  buildCourseFromRepertoire,
  calculateCourseProgress,
} from '../../repertoire/courseEngine';
import { CompactBoardPreview } from '../common/CompactBoardPreview';

export interface OpeningLibraryViewProps {
  repertoires: OpeningRepertoire[];
  onSelectOpening: (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => void;
  onStartTraining: (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => void;
  onReseedMasterOpenings: () => Promise<void>;
  onImportPgn: (repertoireId: string, pgn: string, name?: string) => Promise<void>;
  onCreateRepertoire: (
    name: string,
    color: PieceColor,
    sideAgainst?: 'e4' | 'd4' | 'other'
  ) => Promise<void>;
  isReseeding?: boolean;
}

type TabSection = 'all' | 'white' | 'black_e4' | 'black_d4' | 'flank';
type SortOption = 'default' | 'name' | 'moves' | 'eco';
type LibraryViewMode = 'courses' | 'variations';

export const OpeningLibraryView: React.FC<OpeningLibraryViewProps> = ({
  repertoires,
  onSelectOpening,
  onStartTraining,
  onReseedMasterOpenings,
  onImportPgn,
  onCreateRepertoire,
  isReseeding = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabSection>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [viewMode, setViewMode] = useState<LibraryViewMode>('courses');
  const [progressRecords, setProgressRecords] = useState<CourseLineRecord[]>([]);

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [importPgnText, setImportPgnText] = useState('');
  const [importLineName, setImportLineName] = useState('');
  const [targetRepId, setTargetRepId] = useState(repertoires[0]?.id || '');
  const [newRepName, setNewRepName] = useState('');
  const [newRepColor, setNewRepColor] = useState<PieceColor>('white');
  const [newRepSide, setNewRepSide] = useState<'e4' | 'd4' | 'other'>('e4');

  // Load persistent progress records from Dexie IndexedDB
  const loadProgress = useCallback(async () => {
    try {
      const records = await db.courseLineProgress.toArray();
      setProgressRecords(records);
    } catch (err) {
      console.warn('Failed to load course progress:', err);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Map of lineId -> CourseLineRecord
  const lineRecordsMap = useMemo(() => {
    const map = new Map<string, CourseLineRecord>();
    for (const rec of progressRecords) {
      map.set(rec.lineId, rec);
    }
    return map;
  }, [progressRecords]);

  // Pre-calculate structured courses and progress for each repertoire
  const repertoireCourseData = useMemo(() => {
    return repertoires.map((rep) => {
      const course = buildCourseFromRepertoire(rep);
      const progress = calculateCourseProgress(course, lineRecordsMap);
      const primaryVar = rep.variations?.[0];
      return {
        repertoire: rep,
        course,
        progress,
        primaryVariation: primaryVar,
      };
    });
  }, [repertoires, lineRecordsMap]);

  // Flatten all individual variations paired with their parent repertoire
  const allOpeningEntries = useMemo(() => {
    const list: Array<{
      repertoire: OpeningRepertoire;
      variation: RepertoireVariation;
      lineRecord?: CourseLineRecord;
    }> = [];

    for (const rep of repertoires) {
      if (rep.variations && rep.variations.length > 0) {
        for (const v of rep.variations) {
          list.push({
            repertoire: rep,
            variation: v,
            lineRecord: lineRecordsMap.get(v.id),
          });
        }
      } else {
        list.push({
          repertoire: rep,
          variation: {
            id: `${rep.id}_main`,
            name: `${rep.name} (Main Line)`,
            moves: [],
            description: rep.description,
          },
          lineRecord: lineRecordsMap.get(`${rep.id}_main`),
        });
      }
    }

    return list;
  }, [repertoires, lineRecordsMap]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    return repertoireCourseData.filter(({ repertoire, course, primaryVariation }) => {
      if (activeTab === 'white' && repertoire.color !== 'white') return false;
      if (
        activeTab === 'black_e4' &&
        (repertoire.color !== 'black' || repertoire.sideAgainst !== 'e4')
      )
        return false;
      if (
        activeTab === 'black_d4' &&
        (repertoire.color !== 'black' || repertoire.sideAgainst !== 'd4')
      )
        return false;
      if (
        activeTab === 'flank' &&
        repertoire.sideAgainst !== 'other' &&
        !repertoire.id.includes('flank')
      )
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = course.name.toLowerCase().includes(q);
        const matchesDesc = course.description.toLowerCase().includes(q);
        const matchesEco = primaryVariation?.eco?.toLowerCase().includes(q);
        const matchesAnyVar = repertoire.variations?.some((v) =>
          v.name.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesDesc && !matchesEco && !matchesAnyVar) {
          return false;
        }
      }

      return true;
    });
  }, [repertoireCourseData, activeTab, searchQuery]);

  // Sort courses
  const sortedCourses = useMemo(() => {
    const copy = [...filteredCourses];
    if (sortBy === 'name') {
      copy.sort((a, b) => a.course.name.localeCompare(b.course.name));
    } else if (sortBy === 'moves') {
      copy.sort((a, b) => b.course.totalLines - a.course.totalLines);
    } else if (sortBy === 'eco') {
      copy.sort((a, b) =>
        (a.primaryVariation?.eco || 'Z99').localeCompare(b.primaryVariation?.eco || 'Z99')
      );
    }
    return copy;
  }, [filteredCourses, sortBy]);

  // Filter individual entries
  const filteredEntries = useMemo(() => {
    return allOpeningEntries.filter(({ repertoire, variation }) => {
      if (activeTab === 'white' && repertoire.color !== 'white') return false;
      if (
        activeTab === 'black_e4' &&
        (repertoire.color !== 'black' || repertoire.sideAgainst !== 'e4')
      )
        return false;
      if (
        activeTab === 'black_d4' &&
        (repertoire.color !== 'black' || repertoire.sideAgainst !== 'd4')
      )
        return false;
      if (
        activeTab === 'flank' &&
        repertoire.sideAgainst !== 'other' &&
        !repertoire.id.includes('flank')
      )
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = variation.name.toLowerCase().includes(q);
        const matchesRep = repertoire.name.toLowerCase().includes(q);
        const matchesEco = variation.eco?.toLowerCase().includes(q);
        const matchesDesc = variation.description?.toLowerCase().includes(q);
        const matchesMoves = variation.moves.join(' ').toLowerCase().includes(q);
        if (!matchesName && !matchesRep && !matchesEco && !matchesDesc && !matchesMoves) {
          return false;
        }
      }

      return true;
    });
  }, [allOpeningEntries, activeTab, searchQuery]);

  // Sort individual entries
  const sortedEntries = useMemo(() => {
    const copy = [...filteredEntries];
    if (sortBy === 'name') {
      copy.sort((a, b) => a.variation.name.localeCompare(b.variation.name));
    } else if (sortBy === 'moves') {
      copy.sort((a, b) => b.variation.moves.length - a.variation.moves.length);
    } else if (sortBy === 'eco') {
      copy.sort((a, b) => (a.variation.eco || 'Z99').localeCompare(b.variation.eco || 'Z99'));
    }
    return copy;
  }, [filteredEntries, sortBy]);

  // Section count badges
  const counts = useMemo(() => {
    return {
      all: repertoireCourseData.length,
      white: repertoireCourseData.filter(
        (e) => e.repertoire.color === 'white' && e.repertoire.sideAgainst !== 'other'
      ).length,
      black_e4: repertoireCourseData.filter(
        (e) => e.repertoire.color === 'black' && e.repertoire.sideAgainst === 'e4'
      ).length,
      black_d4: repertoireCourseData.filter(
        (e) => e.repertoire.color === 'black' && e.repertoire.sideAgainst === 'd4'
      ).length,
      flank: repertoireCourseData.filter(
        (e) =>
          e.repertoire.sideAgainst === 'other' || e.repertoire.id.includes('flank')
      ).length,
    };
  }, [repertoireCourseData]);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPgnText.trim()) return;
    await onImportPgn(targetRepId || repertoires[0]?.id, importPgnText, importLineName);
    setImportPgnText('');
    setImportLineName('');
    setShowImportModal(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepName.trim()) return;
    await onCreateRepertoire(newRepName, newRepColor, newRepSide);
    setNewRepName('');
    setShowCreateModal(false);
  };

  // Status badge helper
  const renderStatusBadge = (
    status: 'not_started' | 'in_progress' | 'completed' | 'mastered'
  ) => {
    switch (status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Award size={11} />
            <span>Mastered</span>
          </span>
        );
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
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-elevated text-slate-400 border border-surface-border">
            <span>Not Started</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background min-h-0">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                Opening Courses & Repertoire
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Level-based courses with sequential lessons, interactive move trainer, and progress tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <Upload size={14} />
            <span>Import PGN</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-2 bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <Plus size={14} />
            <span>New Repertoire</span>
          </button>

          <button
            onClick={onReseedMasterOpenings}
            disabled={isReseeding}
            className="p-2 bg-surface-elevated hover:bg-surface-border text-slate-400 hover:text-slate-200 border border-surface-border rounded-xl text-xs transition"
            title="Reload official master repertoires"
          >
            <RefreshCw size={15} className={isReseeding ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* View Mode Toggle & Category Filter Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
        {/* Repertoire Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'all'
                ? 'bg-accent text-black font-bold shadow-sm'
                : 'bg-surface-elevated text-slate-400 hover:text-slate-200 hover:bg-surface-border'
            }`}
          >
            <span>All Courses</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('white')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'white'
                ? 'bg-accent text-black font-bold shadow-sm'
                : 'bg-surface-elevated text-slate-400 hover:text-slate-200 hover:bg-surface-border'
            }`}
          >
            <span>White Repertoire</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
              {counts.white}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('black_e4')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'black_e4'
                ? 'bg-accent text-black font-bold shadow-sm'
                : 'bg-surface-elevated text-slate-400 hover:text-slate-200 hover:bg-surface-border'
            }`}
          >
            <span>Black vs 1.e4</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
              {counts.black_e4}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('black_d4')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'black_d4'
                ? 'bg-accent text-black font-bold shadow-sm'
                : 'bg-surface-elevated text-slate-400 hover:text-slate-200 hover:bg-surface-border'
            }`}
          >
            <span>Black vs 1.d4</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
              {counts.black_d4}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('flank')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'flank'
                ? 'bg-accent text-black font-bold shadow-sm'
                : 'bg-surface-elevated text-slate-400 hover:text-slate-200 hover:bg-surface-border'
            }`}
          >
            <span>Flank & Other</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
              {counts.flank}
            </span>
          </button>
        </div>

        {/* View Mode Toggle: Courses vs All Lines */}
        <div className="flex items-center space-x-1 bg-surface-elevated p-1 rounded-xl border border-surface-border self-start lg:self-auto">
          <button
            onClick={() => setViewMode('courses')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
              viewMode === 'courses'
                ? 'bg-accent text-black font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={13} />
            <span>Courses</span>
          </button>
          <button
            onClick={() => setViewMode('variations')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
              viewMode === 'variations'
                ? 'bg-accent text-black font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen size={13} />
            <span>All Lines ({allOpeningEntries.length})</span>
          </button>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-surface p-3 rounded-2xl border border-surface-border">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              viewMode === 'courses'
                ? 'Search courses by name, ECO, or ideas...'
                : 'Search variation lines, moves, or ECO...'
            }
            className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Sort & Count */}
        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <span>
            Showing{' '}
            {viewMode === 'courses' ? sortedCourses.length : sortedEntries.length}{' '}
            {viewMode === 'courses' ? 'courses' : 'lines'}
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-surface-elevated border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
            >
              <option value="default">Repertoire Order</option>
              <option value="name">Name (A-Z)</option>
              <option value="moves">
                {viewMode === 'courses' ? 'Most Variations' : 'Deepest Line'}
              </option>
              <option value="eco">ECO Code</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid: Courses Mode (Default) */}
      {viewMode === 'courses' ? (
        sortedCourses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface rounded-2xl border border-surface-border text-center max-w-md mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-400 text-2xl mb-3">
              🔍
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">No Courses Found</h3>
            <p className="text-xs text-slate-400 mb-4">
              No opening courses matched your query &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="px-4 py-2 bg-surface-elevated hover:bg-surface-border text-accent border border-surface-border rounded-lg text-xs font-semibold"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedCourses.map(({ repertoire, course, progress, primaryVariation }) => {
              const previewPly = Math.min(primaryVariation?.moves?.length || 0, 10);
              return (
                <div
                  key={course.id}
                  className="bg-surface hover:bg-surface-elevated/70 border border-surface-border hover:border-accent/40 rounded-2xl p-4 transition duration-200 flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    {/* Top Header: ECO, Color & Status */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center space-x-1.5">
                        {primaryVariation?.eco && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-accent">
                            {primaryVariation.eco}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            repertoire.color === 'white'
                              ? 'bg-slate-100 text-slate-900 border-white'
                              : 'bg-slate-900 text-slate-100 border-slate-700'
                          }`}
                        >
                          {repertoire.color}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {renderStatusBadge(progress.status)}
                        <span className="text-[11px] font-mono text-slate-400">
                          {course.totalLines} lines
                        </span>
                      </div>
                    </div>

                    {/* Course Title & Description */}
                    <h3
                      onClick={() => onSelectOpening(repertoire, primaryVariation)}
                      className="text-sm font-bold text-slate-100 group-hover:text-accent transition truncate mb-1 cursor-pointer"
                    >
                      {course.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3 min-h-[32px]">
                      {course.description}
                    </p>

                    {/* Genuine Board Preview & Key Position */}
                    {primaryVariation && (
                      <div className="flex gap-3 items-center mb-3 p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-border">
                        <CompactBoardPreview
                          moves={primaryVariation.moves}
                          targetPly={previewPly}
                          boardOrientation={repertoire.color}
                          size={110}
                          className="flex-shrink-0"
                        />

                        <div className="flex-1 min-w-0 flex flex-col justify-between text-xs space-y-1.5">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wide">
                              Representative Line
                            </span>
                            <span className="text-[11px] font-semibold text-slate-200 truncate block">
                              {primaryVariation.name}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold truncate block">
                              After move {Math.floor(previewPly / 2) + 1}
                            </span>
                          </div>

                          <div className="text-[10px] font-mono text-slate-400 truncate bg-surface px-2 py-1 rounded border border-surface-border">
                            {primaryVariation.moves.slice(0, 4).join(' ')}...
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Meaningful Progress Bar */}
                    <div className="mb-3 px-1">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-300">Course Progress</span>
                        <span className="font-mono text-slate-400">
                          {progress.completedLines} of {progress.totalLines} lines completed ·{' '}
                          <span className="text-accent font-bold">{progress.percentage}%</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden border border-surface-border">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            progress.percentage === 100
                              ? 'bg-emerald-400'
                              : progress.percentage > 0
                              ? 'bg-accent'
                              : 'bg-transparent'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Actions: Study Course & Train Line */}
                  <div className="flex items-center gap-2 pt-3 border-t border-surface-border/60">
                    <button
                      onClick={() => onSelectOpening(repertoire, primaryVariation)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border transition flex items-center justify-center space-x-1.5"
                    >
                      <Layers size={14} className="text-accent" />
                      <span>Course Levels</span>
                    </button>

                    <button
                      onClick={() => onStartTraining(repertoire, primaryVariation)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-accent/20 hover:bg-accent text-accent hover:text-black border border-accent/40 transition flex items-center justify-center space-x-1.5"
                    >
                      <Dumbbell size={14} />
                      <span>
                        {progress.completedLines > 0 && progress.percentage < 100
                          ? 'Continue'
                          : 'Train'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Variations Mode (Individual Lines) */
        sortedEntries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface rounded-2xl border border-surface-border text-center max-w-md mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-400 text-2xl mb-3">
              🔍
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-1">No Variations Found</h3>
            <p className="text-xs text-slate-400 mb-4">
              No opening variations matched your current query &quot;{searchQuery}&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedEntries.map(({ repertoire, variation, lineRecord }) => {
              const previewPly = Math.min(variation.moves.length, 10);
              const isLineDone =
                lineRecord?.status === 'completed' || lineRecord?.status === 'mastered';
              const lineStatus = lineRecord?.status || 'not_started';

              return (
                <div
                  key={`${repertoire.id}_${variation.id}`}
                  className="bg-surface hover:bg-surface-elevated/70 border border-surface-border hover:border-accent/40 rounded-2xl p-4 transition duration-200 flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    {/* Top Header: ECO, Color & Side */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center space-x-1.5">
                        {variation.eco && (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-accent">
                            {variation.eco}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            repertoire.color === 'white'
                              ? 'bg-slate-100 text-slate-900 border-white'
                              : 'bg-slate-900 text-slate-100 border-slate-700'
                          }`}
                        >
                          {repertoire.color}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {renderStatusBadge(lineStatus)}
                        <span className="text-[11px] font-mono text-slate-400">
                          {variation.moves.length} plies
                        </span>
                      </div>
                    </div>

                    {/* Opening Title & Description */}
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-accent transition truncate mb-1">
                      {variation.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3 min-h-[32px]">
                      {variation.description || repertoire.description}
                    </p>

                    {/* Genuine Board Preview & Key Position */}
                    <div className="flex gap-3 items-center mb-3 p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-border">
                      <CompactBoardPreview
                        moves={variation.moves}
                        targetPly={previewPly}
                        boardOrientation={repertoire.color}
                        size={110}
                        className="flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0 flex flex-col justify-between text-xs space-y-1.5">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wide">
                            Representative Position
                          </span>
                          <span className="text-[11px] font-mono text-emerald-400 font-bold truncate block">
                            After move {Math.floor(previewPly / 2) + 1}
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 truncate bg-surface px-2 py-1 rounded border border-surface-border">
                          {variation.moves.slice(0, 4).join(' ')}...
                        </div>
                      </div>
                    </div>

                    {/* Line Completion Progress Bar */}
                    <div className="mb-3 px-1">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-300">Line Mastery</span>
                        <span className="font-mono text-slate-400">
                          {isLineDone ? '1 of 1 completed · 100%' : '0 of 1 completed · 0%'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-surface-border">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isLineDone ? 'bg-emerald-400' : 'bg-transparent'
                          }`}
                          style={{ width: isLineDone ? '100%' : '0%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Actions: Study Details & Start Training */}
                  <div className="flex items-center gap-2 pt-3 border-t border-surface-border/60">
                    <button
                      onClick={() => onSelectOpening(repertoire, variation)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border transition flex items-center justify-center space-x-1.5"
                    >
                      <Compass size={14} className="text-accent" />
                      <span>Inspect Line</span>
                    </button>

                    <button
                      onClick={() => onStartTraining(repertoire, variation)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-accent/20 hover:bg-accent text-accent hover:text-black border border-accent/40 transition flex items-center justify-center space-x-1.5"
                    >
                      <Dumbbell size={14} />
                      <span>Train Line</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Import PGN Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">Import PGN Opening Line</h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste a PGN or move sequence to add it directly to your repertoire course.
            </p>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Target Opening Course
                </label>
                <select
                  value={targetRepId}
                  onChange={(e) => setTargetRepId(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                >
                  {repertoires.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.color})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Variation Line Name (Optional)
                </label>
                <input
                  type="text"
                  value={importLineName}
                  onChange={(e) => setImportLineName(e.target.value)}
                  placeholder="e.g. Vienna Gambit: Hamppe-Meitner"
                  className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  PGN / SAN Move Sequence
                </label>
                <textarea
                  value={importPgnText}
                  onChange={(e) => setImportPgnText(e.target.value)}
                  rows={4}
                  placeholder="1. e4 e5 2. Nc3 Nc6 3. f4 exf4 4. Nf3 g5..."
                  className="w-full bg-surface-elevated border border-surface-border rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-accent resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-300 border border-surface-border transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent-hover text-black transition"
                >
                  Import into Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Custom Repertoire Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1">
              Create Opening Repertoire Course
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Build a custom repertoire from scratch and structure it into learning levels.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  placeholder="e.g. My London System Repertoire"
                  className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Playing Color
                  </label>
                  <select
                    value={newRepColor}
                    onChange={(e) => setNewRepColor(e.target.value as PieceColor)}
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="white">White</option>
                    <option value="black">Black</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Defending Against
                  </label>
                  <select
                    value={newRepSide}
                    onChange={(e) => setNewRepSide(e.target.value as 'e4' | 'd4' | 'other')}
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="e4">1.e4</option>
                    <option value="d4">1.d4</option>
                    <option value="other">Flank / Other</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-300 border border-surface-border transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-accent hover:bg-accent-hover text-black transition"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
