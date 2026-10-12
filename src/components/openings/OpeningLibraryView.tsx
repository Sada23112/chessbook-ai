import React, { useState, useMemo } from 'react';
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
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { OpeningRepertoire, RepertoireVariation, PieceColor } from '../../types/chess';
import { CompactBoardPreview } from '../common/CompactBoardPreview';

export interface OpeningLibraryViewProps {
  repertoires: OpeningRepertoire[];
  onSelectOpening: (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => void;
  onStartTraining: (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => void;
  onReseedMasterOpenings: () => Promise<void>;
  onImportPgn: (repertoireId: string, pgn: string, name?: string) => Promise<void>;
  onCreateRepertoire: (name: string, color: PieceColor, sideAgainst?: 'e4' | 'd4' | 'other') => Promise<void>;
  isReseeding?: boolean;
}

type TabSection = 'all' | 'white' | 'black_e4' | 'black_d4' | 'flank';
type SortOption = 'default' | 'name' | 'moves' | 'eco';

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

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [importPgnText, setImportPgnText] = useState('');
  const [importLineName, setImportLineName] = useState('');
  const [targetRepId, setTargetRepId] = useState(repertoires[0]?.id || '');
  const [newRepName, setNewRepName] = useState('');
  const [newRepColor, setNewRepColor] = useState<PieceColor>('white');
  const [newRepSide, setNewRepSide] = useState<'e4' | 'd4' | 'other'>('e4');

  // Flatten all variations paired with their parent repertoire
  const allOpeningEntries = useMemo(() => {
    const list: Array<{
      repertoire: OpeningRepertoire;
      variation: RepertoireVariation;
    }> = [];

    for (const rep of repertoires) {
      if (rep.variations && rep.variations.length > 0) {
        for (const v of rep.variations) {
          list.push({ repertoire: rep, variation: v });
        }
      } else {
        // Fallback synthetic entry if custom repertoire has no variations array yet
        list.push({
          repertoire: rep,
          variation: {
            id: `${rep.id}_main`,
            name: `${rep.name} (Main Line)`,
            moves: [],
            description: rep.description,
          },
        });
      }
    }

    return list;
  }, [repertoires]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return allOpeningEntries.filter(({ repertoire, variation }) => {
      // 1. Tab filter
      if (activeTab === 'white' && repertoire.color !== 'white') return false;
      if (activeTab === 'black_e4' && (repertoire.color !== 'black' || repertoire.sideAgainst !== 'e4'))
        return false;
      if (activeTab === 'black_d4' && (repertoire.color !== 'black' || repertoire.sideAgainst !== 'd4'))
        return false;
      if (activeTab === 'flank' && repertoire.sideAgainst !== 'other' && !repertoire.id.includes('flank'))
        return false;

      // 2. Search query filter
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

  // Sort entries
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
      all: allOpeningEntries.length,
      white: allOpeningEntries.filter((e) => e.repertoire.color === 'white' && e.repertoire.sideAgainst !== 'other').length,
      black_e4: allOpeningEntries.filter((e) => e.repertoire.color === 'black' && e.repertoire.sideAgainst === 'e4').length,
      black_d4: allOpeningEntries.filter((e) => e.repertoire.color === 'black' && e.repertoire.sideAgainst === 'd4').length,
      flank: allOpeningEntries.filter((e) => e.repertoire.sideAgainst === 'other' || e.repertoire.id.includes('flank')).length,
    };
  }, [allOpeningEntries]);

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

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background min-h-0">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Opening Repertoire Library
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/15 text-accent border border-accent/30">
              {allOpeningEntries.length} Lines
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Browse opening systems with genuine board previews, study deep theoretical variations, and master them with spaced repetition.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onReseedMasterOpenings()}
            disabled={isReseeding}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-300 border border-surface-border transition flex items-center space-x-1.5"
            title="Reset or synchronize master opening lines"
          >
            <RefreshCw size={14} className={isReseeding ? 'animate-spin text-accent' : ''} />
            <span>Reset Master Book</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border transition flex items-center space-x-1.5"
          >
            <Upload size={14} className="text-accent" />
            <span>Import PGN</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent hover:bg-accent-hover text-black transition flex items-center space-x-1.5 shadow"
          >
            <Plus size={15} />
            <span>New Repertoire</span>
          </button>
        </div>
      </div>

      {/* Repertoire Category Sections */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-surface-border pb-3">
        {[
          { id: 'all' as TabSection, label: 'All Openings', count: counts.all },
          { id: 'white' as TabSection, label: 'White Repertoires', count: counts.white },
          { id: 'black_e4' as TabSection, label: 'Black vs 1.e4', count: counts.black_e4 },
          { id: 'black_d4' as TabSection, label: 'Black vs 1.d4', count: counts.black_d4 },
          { id: 'flank' as TabSection, label: 'Flanks & Gambits', count: counts.flank },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold transition border flex items-center space-x-2 ${
                isActive
                  ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                  : 'bg-surface text-slate-400 hover:text-slate-200 border-surface-border'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-accent/20 text-accent font-bold' : 'bg-surface-elevated text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search by opening name, ECO (e.g. C50, B90), or move..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-elevated border border-surface-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Sort & Count */}
        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <span>Showing {sortedEntries.length} openings</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-surface-elevated border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
            >
              <option value="default">Repertoire Order</option>
              <option value="name">Name (A-Z)</option>
              <option value="moves">Deepest Line</option>
              <option value="eco">ECO Code</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opening Cards Grid */}
      {sortedEntries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface rounded-2xl border border-surface-border text-center max-w-md mx-auto my-12">
          <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-slate-400 text-2xl mb-3">
            🔍
          </div>
          <h3 className="text-base font-bold text-slate-200 mb-1">No Openings Found</h3>
          <p className="text-xs text-slate-400 mb-4">
            No openings matched your current filter or query &quot;{searchQuery}&quot;.
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
          {sortedEntries.map(({ repertoire, variation }) => {
            const previewPly = Math.min(variation.moves.length, 10);
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

                    <span className="text-[11px] font-mono text-slate-400">
                      {variation.moves.length} plies
                    </span>
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
      )}

      {/* Modal: Import PGN Line */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Upload size={18} className="text-accent" />
              <span>Import PGN Opening Line</span>
            </h3>

            <form onSubmit={handleImportSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Repertoire</label>
                <select
                  value={targetRepId}
                  onChange={(e) => setTargetRepId(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  {repertoires.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.color})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Variation Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Sicilian Najdorf Adams Attack"
                  value={importLineName}
                  onChange={(e) => setImportLineName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">PGN / SAN Moves</label>
                <textarea
                  rows={4}
                  placeholder="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6..."
                  value={importPgnText}
                  onChange={(e) => setImportPgnText(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg p-3 text-xs text-slate-200 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs shadow"
                >
                  Import to Repertoire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Custom Repertoire */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Plus size={18} className="text-accent" />
              <span>Create New Custom Repertoire</span>
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Repertoire Title</label>
                <input
                  type="text"
                  placeholder="e.g. My London System Defense"
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Color Played</label>
                  <select
                    value={newRepColor}
                    onChange={(e) => setNewRepColor(e.target.value as PieceColor)}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="white">White</option>
                    <option value="black">Black</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category / Versus</label>
                  <select
                    value={newRepSide}
                    onChange={(e) => setNewRepSide(e.target.value as any)}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="e4">vs 1.e4</option>
                    <option value="d4">vs 1.d4</option>
                    <option value="other">Flank / Other</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs shadow"
                >
                  Create Repertoire
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
