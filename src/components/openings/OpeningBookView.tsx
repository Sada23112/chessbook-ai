import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
import {
  BookOpen,
  Plus,
  GitBranch,
  Dumbbell,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Play,
  Pause,
  Sparkles,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { db } from '../../db/db';
import type { OpeningRepertoire, GameRecord, PieceColor, RepertoireVariation } from '../../types/chess';
import {
  createDefaultRepertoire,
  addLineToRepertoire,
  detectGameDeviations,
  type DeviationResult,
} from '../../repertoire/repertoireEngine';
import { seedMasterRepertoires, MASTER_OPENING_REPERTOIRES } from '../../repertoire/defaultOpenings';

export const OpeningBookView: React.FC = () => {
  const [repertoires, setRepertoires] = useState<OpeningRepertoire[]>([]);
  const [activeRepId, setActiveRepId] = useState<string>('rep_white_e4');
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<string[]>([]);
  const [plyIndex, setPlyIndex] = useState<number>(0);
  const [deviations, setDeviations] = useState<DeviationResult[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Practice mode
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [practiceStatus, setPracticeStatus] = useState<string | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [isReseeding, setIsReseeding] = useState<boolean>(false);

  // New line input
  const [customPgnInput, setCustomPgnInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);

  // Load repertoires and compute game deviations
  const loadRepertoires = useCallback(async (forceSeed = false) => {
    setIsReseeding(true);
    try {
      let list = await db.repertoires.toArray();
      // If table is empty, or forceSeed, or missing newly added master repertoires
      if (list.length === 0 || forceSeed || list.length < MASTER_OPENING_REPERTOIRES.length) {
        list = await seedMasterRepertoires(forceSeed);
      }

      setRepertoires(list);
      const selected = list.find((r) => r.id === activeRepId) || list[0];
      if (selected) {
        setActiveRepId(selected.id);
        const firstVar = selected.variations?.[0];
        if (firstVar) {
          setSelectedVariationId(firstVar.id);
          setActiveLine(firstVar.moves);
          setPlyIndex(firstVar.moves.length);
        } else {
          loadLongestRepLine(selected);
        }
      }

      // Check deviations across user games
      const games = await db.games.toArray();
      const allDeviations: DeviationResult[] = [];
      for (const g of games) {
        const devs = detectGameDeviations(g, list);
        allDeviations.push(...devs);
      }
      setDeviations(allDeviations);
    } catch (err) {
      console.warn('Error loading opening repertoires:', err);
    } finally {
      setIsReseeding(false);
    }
  }, [activeRepId]);

  useEffect(() => {
    loadRepertoires(false);
  }, []);

  const activeRepertoire = useMemo(() => {
    return repertoires.find((r) => r.id === activeRepId) || repertoires[0];
  }, [repertoires, activeRepId]);

  // Load longest line from repertoire move-tree
  const loadLongestRepLine = (rep: OpeningRepertoire) => {
    let longestPath: string[] = [];
    const traverse = (nodeId: string, currentPath: string[]) => {
      const node = rep.allMoves[nodeId];
      if (!node) return;
      const nextPath = [...currentPath, node.san];
      if (!node.children || node.children.length === 0) {
        if (nextPath.length > longestPath.length) {
          longestPath = nextPath;
        }
      } else {
        node.children.forEach((c) => traverse(c, nextPath));
      }
    };

    rep.rootMoves.forEach((rootId) => traverse(rootId, []));
    setSelectedVariationId(null);
    setActiveLine(longestPath);
    setPlyIndex(longestPath.length);
  };

  // Switch to a specific variation
  const handleSelectVariation = (variation: RepertoireVariation) => {
    setSelectedVariationId(variation.id);
    setActiveLine(variation.moves);
    setPlyIndex(variation.moves.length);
    setIsPracticing(false);
    setPracticeStatus(null);
    setShowHint(false);
  };

  // Start practicing a variation
  const handleStartPractice = (variation?: RepertoireVariation) => {
    if (variation) {
      setSelectedVariationId(variation.id);
      setActiveLine(variation.moves);
    }
    setIsPracticing(true);
    setPlyIndex(0);
    setPracticeStatus(
      activeRepertoire?.color === 'white'
        ? 'White to move. Play the opening move for this line.'
        : 'Black to move. Play your defense response.'
    );
    setShowHint(false);
  };

  // Build current FEN based on activeLine and plyIndex
  const currentFen = useMemo(() => {
    const chess = new Chess();
    for (let i = 0; i < plyIndex && i < activeLine.length; i++) {
      chess.move(activeLine[i]);
    }
    return chess.fen();
  }, [activeLine, plyIndex]);

  // Identify candidate alternative branches in current position
  const candidateBranches = useMemo(() => {
    if (!activeRepertoire) return [];
    const chess = new Chess();
    let currentNodeId: string | null = null;

    for (let i = 0; i < plyIndex; i++) {
      const san = activeLine[i];
      const candidateIds: string[] = currentNodeId
        ? activeRepertoire.allMoves[currentNodeId]?.children || []
        : activeRepertoire.rootMoves;
      const matching: string | undefined = candidateIds.find(
        (id: string) => activeRepertoire.allMoves[id]?.san === san
      );
      if (matching) {
        currentNodeId = matching;
      } else {
        break;
      }
    }

    const nextChildIds: string[] = currentNodeId
      ? activeRepertoire.allMoves[currentNodeId]?.children || []
      : activeRepertoire.rootMoves;

    return nextChildIds
      .map((id) => activeRepertoire.allMoves[id])
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [activeRepertoire, activeLine, plyIndex]);

  // Handle move played in practice mode
  const handleMove = ({ san }: { san: string }): boolean => {
    if (!isPracticing || !activeRepertoire) return false;

    const expectedMove = activeLine[plyIndex];
    if (san === expectedMove) {
      const nextPly = plyIndex + 1;
      setPlyIndex(nextPly);
      setShowHint(false);

      if (nextPly >= activeLine.length) {
        setPracticeStatus('🎉 Line completed! Excellent repertoire memory.');
      } else {
        setPracticeStatus('✓ Correct move!');
        // If next move is opponent's, auto-play after 450ms
        setTimeout(() => {
          setPlyIndex(nextPly + 1);
          if (nextPly + 1 >= activeLine.length) {
            setPracticeStatus('🎉 Line completed! Mastered this variation.');
          } else {
            setPracticeStatus('Your turn again. Find the next repertoire move.');
          }
        }, 500);
      }
      return true;
    } else {
      setPracticeStatus(`❌ Incorrect (${san}). Expected repertoire move is ${expectedMove}.`);
      return false;
    }
  };

  // Add custom PGN line
  const handleAddCustomLine = async () => {
    if (!customPgnInput.trim() || !activeRepertoire) return;
    try {
      const chess = new Chess();
      chess.loadPgn(customPgnInput);
      const history = chess.history();
      if (history.length === 0) return;

      const varName = customNameInput.trim() || `Custom Line (${history.slice(0, 3).join(' ')}...)`;
      const newVar: RepertoireVariation = {
        id: `var_custom_${Date.now()}`,
        name: varName,
        moves: history,
        description: 'User-created custom repertoire line.',
      };

      let updated = addLineToRepertoire(activeRepertoire, history, varName);
      updated = {
        ...updated,
        variations: [...(updated.variations || []), newVar],
      };

      await db.repertoires.put(updated);
      setCustomPgnInput('');
      setCustomNameInput('');
      setShowAddLine(false);
      await loadRepertoires(false);
      handleSelectVariation(newVar);
    } catch {
      alert('Invalid PGN move sequence. Please verify standard SAN format.');
    }
  };

  // Filter variations for active repertoire
  const filteredVariations = useMemo(() => {
    if (!activeRepertoire?.variations) return [];
    if (!searchQuery.trim()) return activeRepertoire.variations;
    const q = searchQuery.toLowerCase();
    return activeRepertoire.variations.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.eco?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.moves.join(' ').toLowerCase().includes(q)
    );
  }, [activeRepertoire, searchQuery]);

  // Current active variation
  const activeVariation = useMemo(() => {
    return activeRepertoire?.variations?.find((v) => v.id === selectedVariationId);
  }, [activeRepertoire, selectedVariationId]);

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 lg:p-8 overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Opening Book</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-accent/15 text-accent border border-accent/30 font-mono">
              Master Theory
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Explore 50+ master opening lines, variations, move trees, and test your recall with interactive training.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => loadRepertoires(true)}
            disabled={isReseeding}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-300 border border-surface-border transition flex items-center space-x-1.5"
            title="Reset to latest master openings and variations"
          >
            <RefreshCw size={14} className={isReseeding ? 'animate-spin text-accent' : ''} />
            <span className="hidden sm:inline">Reset Openings</span>
          </button>

          <button
            onClick={() => {
              if (isPracticing) {
                setIsPracticing(false);
                setPlyIndex(activeLine.length);
                setPracticeStatus(null);
              } else {
                handleStartPractice();
              }
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 shadow ${
              isPracticing
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : 'bg-accent hover:bg-accent-hover text-black'
            }`}
          >
            <Dumbbell size={16} />
            <span>{isPracticing ? 'Exit Practice' : 'Practice This Line'}</span>
          </button>
        </div>
      </div>

      {/* Repertoire Categories / Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {repertoires.map((rep) => {
          const isActive = activeRepId === rep.id;
          const varCount = rep.variations?.length || 0;
          return (
            <button
              key={rep.id}
              onClick={() => {
                setActiveRepId(rep.id);
                setIsPracticing(false);
                setPracticeStatus(null);
                const firstVar = rep.variations?.[0];
                if (firstVar) {
                  handleSelectVariation(firstVar);
                } else {
                  loadLongestRepLine(rep);
                }
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition border flex items-center space-x-2 ${
                isActive
                  ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                  : 'bg-surface text-slate-400 hover:text-slate-200 border-surface-border'
              }`}
            >
              <BookOpen size={15} />
              <span>{rep.name}</span>
              {varCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-accent/20 text-accent font-bold' : 'bg-surface-elevated text-slate-400'
                  }`}
                >
                  {varCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Board + Variations & Tree */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-start">
        {/* Left Column: Board & Navigation */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Active Variation Info Pill */}
          <div className="w-full max-w-[460px] flex items-center justify-between mb-2.5 px-1 text-xs">
            <div className="flex items-center space-x-2 truncate">
              {activeVariation?.eco && (
                <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-surface-border font-mono font-bold text-accent text-[11px]">
                  {activeVariation.eco}
                </span>
              )}
              <span className="font-bold text-slate-200 truncate">
                {activeVariation?.name || 'Custom Repertoire Line'}
              </span>
            </div>
            <span className="text-slate-400 font-mono text-[11px] flex-shrink-0">
              Ply {plyIndex} / {activeLine.length}
            </span>
          </div>

          {/* Interactive Chessboard Container */}
          <div className="w-full max-w-[min(100vw-2rem,460px)] aspect-square flex items-center justify-center">
            <InteractiveChessboard
              id="repertoire-board"
              fen={currentFen}
              boardOrientation={activeRepertoire?.color || 'white'}
              turn={activeRepertoire?.color === 'white' ? 'w' : 'b'}
              allowMoves={isPracticing}
              onMove={handleMove}
              maxWidth="100%"
            />
          </div>

          {/* Practice Feedback Banner */}
          {isPracticing && practiceStatus && (
            <div
              className={`w-full max-w-[460px] mt-3 p-3 rounded-lg border text-xs text-center font-medium transition ${
                practiceStatus.includes('Correct') || practiceStatus.includes('completed')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : practiceStatus.includes('Incorrect')
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-surface-elevated border-surface-border text-slate-200'
              }`}
            >
              {practiceStatus}
              {showHint && (
                <p className="mt-1 font-mono text-accent text-[11px]">
                  Hint: Expected move is <span className="font-bold underline">{activeLine[plyIndex]}</span>
                </p>
              )}
              {!showHint && isPracticing && plyIndex < activeLine.length && (
                <button
                  onClick={() => setShowHint(true)}
                  className="mt-1.5 inline-block text-[10px] text-slate-400 hover:text-accent underline"
                >
                  Show Hint
                </button>
              )}
            </div>
          )}

          {/* Board Ply Navigation Controls */}
          <div className="w-full max-w-[460px] mt-3 flex items-center justify-between bg-surface border border-surface-border rounded-xl p-1.5">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPlyIndex(0)}
                disabled={plyIndex === 0}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-surface-elevated transition"
                title="Start of line"
              >
                <ChevronFirst size={18} />
              </button>
              <button
                onClick={() => setPlyIndex(Math.max(0, plyIndex - 1))}
                disabled={plyIndex === 0}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-surface-elevated transition"
                title="Previous move"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPlyIndex(Math.min(activeLine.length, plyIndex + 1))}
                disabled={plyIndex >= activeLine.length}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-surface-elevated transition"
                title="Next move"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setPlyIndex(activeLine.length)}
                disabled={plyIndex >= activeLine.length}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-surface-elevated transition"
                title="End of line"
              >
                <ChevronLast size={18} />
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400 pr-2">
              Move {Math.floor(plyIndex / 2) + 1}
            </div>
          </div>

          {/* Repertoire Move Path Pills */}
          <div className="w-full max-w-[460px] mt-3 p-3 bg-surface rounded-xl border border-surface-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Move Sequence
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {activeLine.length} plies
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center max-h-24 overflow-y-auto">
              {activeLine.map((move, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPlyIndex(i + 1);
                    setIsPracticing(false);
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition ${
                    i < plyIndex
                      ? 'bg-accent/20 text-accent font-semibold border border-accent/30'
                      : 'bg-surface-elevated text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {Math.floor(i / 2) + 1}.{i % 2 === 1 ? '..' : ''} {move}
                </button>
              ))}
            </div>
          </div>

          {/* Candidate Branch Moves from current position */}
          {candidateBranches.length > 0 && (
            <div className="w-full max-w-[460px] mt-3 p-3 bg-surface-elevated rounded-xl border border-surface-border">
              <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5 mb-2">
                <GitBranch size={13} className="text-accent" />
                <span>Repertoire Branches at this Position:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {candidateBranches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      // Switch to child move
                      const newPath = [...activeLine.slice(0, plyIndex), branch.san];
                      setActiveLine(newPath);
                      setPlyIndex(newPath.length);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border hover:border-accent text-xs font-mono text-slate-200 hover:text-accent transition flex items-center space-x-1"
                  >
                    <span className="font-bold text-accent">{branch.san}</span>
                    {branch.comment && (
                      <span className="text-[10px] text-slate-400 font-sans truncate max-w-[140px]">
                        ({branch.comment})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Variations Directory & Tree */}
        <div className="lg:col-span-6 space-y-5">
          {/* Repertoire Variations Directory Card */}
          <div className="bg-surface rounded-xl border border-surface-border p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-slate-100 text-sm flex items-center space-x-2">
                  <Compass size={17} className="text-accent" />
                  <span>Opening Variations Directory</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select any variation to examine move order, positional ideas, and practice.
                </p>
              </div>

              <button
                onClick={() => setShowAddLine(!showAddLine)}
                className="px-2.5 py-1.5 text-xs bg-surface-elevated hover:bg-surface-border text-accent border border-surface-border rounded-lg transition flex items-center space-x-1 self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>Add Custom Line</span>
              </button>
            </div>

            {/* Custom Line Modal/Form */}
            {showAddLine && (
              <div className="mb-4 p-3.5 bg-surface-elevated rounded-xl border border-surface-border space-y-2.5">
                <input
                  type="text"
                  placeholder="Variation Name (e.g. Italian Game: Giuoco Piano)"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Paste PGN / SAN line (e.g. 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5...)"
                  value={customPgnInput}
                  onChange={(e) => setCustomPgnInput(e.target.value)}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent font-mono"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowAddLine(false)}
                    className="px-3 py-1 bg-surface border border-surface-border text-slate-400 hover:text-slate-200 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomLine}
                    className="px-3 py-1 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs"
                  >
                    Save Variation
                  </button>
                </div>
              </div>
            )}

            {/* Search Filter */}
            <div className="relative mb-3.5">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search variations by name, ECO, or move (e.g. Najdorf, C50, Fried Liver)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Variations List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredVariations.map((v) => {
                const isSelected = selectedVariationId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVariation(v)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-accent/10 border-accent/50 shadow-sm'
                        : 'bg-surface-elevated hover:bg-surface-border/50 border-surface-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-2 truncate">
                        {v.eco && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-surface-border text-accent">
                            {v.eco}
                          </span>
                        )}
                        <h4 className="font-semibold text-slate-200 text-xs truncate">{v.name}</h4>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartPractice(v);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-accent/20 hover:bg-accent hover:text-black text-accent transition flex items-center space-x-1"
                        >
                          <Dumbbell size={11} />
                          <span>Practice</span>
                        </button>
                      </div>
                    </div>

                    {v.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                        {v.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-surface-border/50">
                      <span className="truncate max-w-[280px]">
                        {v.moves.slice(0, 6).join(' ')}...
                      </span>
                      <span>{v.moves.length} plies</span>
                    </div>
                  </div>
                );
              })}

              {filteredVariations.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No variations matched &quot;{searchQuery}&quot;. Try a different search term.
                </div>
              )}
            </div>

            {/* Tree Summary Footer */}
            <div className="mt-3 pt-3 border-t border-surface-border/60 flex items-center justify-between text-xs text-slate-400">
              <span>
                Total variations:{' '}
                <span className="font-mono text-accent font-bold">
                  {activeRepertoire?.variations?.length || 0}
                </span>
              </span>
              <span>
                Total moves mapped:{' '}
                <span className="font-mono text-accent font-bold">
                  {Object.keys(activeRepertoire?.allMoves || {}).length}
                </span>
              </span>
            </div>
          </div>

          {/* Game Deviations Section */}
          <div className="bg-surface rounded-xl border border-surface-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <span>Repertoire Deviations in Your Games</span>
              </h3>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {deviations.length} found
              </span>
            </div>

            {deviations.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                No deviations detected yet. As you import your games from Chess.com or PGN files, any moves where you deviated from your repertoire theory will be identified here.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {deviations.slice(0, 10).map((dev, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-200 block mb-0.5">
                        Ply {dev.ply} in {dev.repertoireName}
                      </span>
                      <div className="flex items-center space-x-2 font-mono text-[11px]">
                        <span className="text-rose-400">Played: {dev.playedSan}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-emerald-400">Repertoire: {dev.repertoireSan}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
