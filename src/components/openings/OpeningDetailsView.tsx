import React, { useState, useMemo, useEffect } from 'react';
import { Chess } from 'chess.js';
import {
  ArrowLeft,
  Dumbbell,
  GitBranch,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  RotateCcw,
  AlertTriangle,
  Play,
  Pause,
  Plus,
} from 'lucide-react';
import type { OpeningRepertoire, RepertoireVariation } from '../../types/chess';
import { InteractiveChessboard } from '../common/InteractiveChessboard';
import { addLineToRepertoire, type DeviationResult } from '../../repertoire/repertoireEngine';
import { db } from '../../db/db';

export interface OpeningDetailsViewProps {
  repertoire: OpeningRepertoire;
  initialVariation?: RepertoireVariation;
  deviations: DeviationResult[];
  onBackToLibrary: () => void;
  onStartTraining: (repertoire: OpeningRepertoire, variation: RepertoireVariation) => void;
  onRepertoireUpdated: () => Promise<void>;
}

export const OpeningDetailsView: React.FC<OpeningDetailsViewProps> = ({
  repertoire,
  initialVariation,
  deviations,
  onBackToLibrary,
  onStartTraining,
  onRepertoireUpdated,
}) => {
  const [selectedVariation, setSelectedVariation] = useState<RepertoireVariation>(() => {
    return initialVariation || repertoire.variations?.[0] || {
      id: `${repertoire.id}_main`,
      name: repertoire.name,
      moves: [],
      description: repertoire.description,
    };
  });

  const [plyIndex, setPlyIndex] = useState<number>(() => selectedVariation.moves.length);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showAddLineModal, setShowAddLineModal] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customPgn, setCustomPgn] = useState<string>('');

  // Synchronize when initialVariation changes
  useEffect(() => {
    if (initialVariation) {
      setSelectedVariation(initialVariation);
      setPlyIndex(initialVariation.moves.length);
    }
  }, [initialVariation]);

  // Compute current FEN based on active variation line and plyIndex
  const currentFen = useMemo(() => {
    const chess = new Chess();
    for (let i = 0; i < plyIndex && i < selectedVariation.moves.length; i++) {
      chess.move(selectedVariation.moves[i]);
    }
    return chess.fen();
  }, [selectedVariation.moves, plyIndex]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlyIndex((prev) => {
        if (prev >= selectedVariation.moves.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying, selectedVariation.moves.length]);

  // Candidate Branch Moves from current position in repertoire move-tree
  const candidateBranches = useMemo(() => {
    if (!repertoire) return [];
    let currentNodeId: string | null = null;

    for (let i = 0; i < plyIndex; i++) {
      const san = selectedVariation.moves[i];
      const candidateIds: string[] = currentNodeId
        ? repertoire.allMoves[currentNodeId]?.children || []
        : repertoire.rootMoves;
      const matching: string | undefined = candidateIds.find(
        (id: string) => repertoire.allMoves[id]?.san === san
      );
      if (matching) {
        currentNodeId = matching;
      } else {
        break;
      }
    }

    const nextChildIds: string[] = currentNodeId
      ? repertoire.allMoves[currentNodeId]?.children || []
      : repertoire.rootMoves;

    return nextChildIds
      .map((id) => repertoire.allMoves[id])
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [repertoire, selectedVariation.moves, plyIndex]);

  // Filter deviations relevant to this repertoire
  const relevantDeviations = useMemo(() => {
    return deviations.filter((d) => d.repertoireId === repertoire.id);
  }, [deviations, repertoire.id]);

  const handleAddVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPgn.trim()) return;

    try {
      const chess = new Chess();
      chess.loadPgn(customPgn);
      const history = chess.history();
      if (history.length === 0) return;

      const varName = customName.trim() || `Variation (${history.slice(0, 3).join(' ')}...)`;
      const newVar: RepertoireVariation = {
        id: `var_${Date.now()}`,
        name: varName,
        moves: history,
        description: 'Custom user variation added to this repertoire.',
      };

      let updated = addLineToRepertoire(repertoire, history, varName);
      updated = {
        ...updated,
        variations: [...(updated.variations || []), newVar],
      };

      await db.repertoires.put(updated);
      setCustomPgn('');
      setCustomName('');
      setShowAddLineModal(false);
      await onRepertoireUpdated();
      setSelectedVariation(newVar);
      setPlyIndex(newVar.moves.length);
    } catch {
      alert('Invalid PGN move sequence.');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto bg-background min-h-0">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToLibrary}
            className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-surface hover:bg-surface-elevated text-slate-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-medium"
          >
            <ArrowLeft size={16} />
            <span>Back to library</span>
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-surface-elevated text-accent">
                {selectedVariation.eco || 'Theory'}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 truncate">
                {selectedVariation.name}
              </h2>
            </div>
            <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xl">
              {repertoire.name} · {repertoire.color === 'white' ? 'White perspective' : 'Black perspective'}
            </p>
          </div>
        </div>

        {/* Primary Action: Start Training */}
        <button
          onClick={() => onStartTraining(repertoire, selectedVariation)}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition flex items-center space-x-2 self-start sm:self-auto"
        >
          <Dumbbell size={16} />
          <span>Start training</span>
        </button>
      </div>

      {/* Main Grid: Demonstration Board & Theory Study */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Board & Move Controls */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Position Info Pill */}
          <div className="w-full max-w-[480px] flex items-center justify-between mb-2.5 px-1 text-xs">
            <span className="font-medium text-slate-300">
              {plyIndex === 0 ? 'Starting position' : `Position after ply ${plyIndex}`}
            </span>
            <span className="font-mono text-slate-400 text-xs">
              {selectedVariation.moves.length} total plies
            </span>
          </div>

          {/* Interactive Chessboard (Read-Only demonstration during study) */}
          <div className="w-full max-w-[min(100vw-2.5rem,480px)] aspect-square flex items-center justify-center">
            <InteractiveChessboard
              id="details-board"
              fen={currentFen}
              boardOrientation={repertoire.color}
              allowMoves={false}
              maxWidth="100%"
            />
          </div>

          {/* Board Navigation Toolbar */}
          <div className="w-full max-w-[480px] mt-3 flex items-center justify-between bg-surface rounded-2xl p-2">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  setPlyIndex(0);
                  setIsPlaying(false);
                }}
                disabled={plyIndex === 0}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-xl hover:bg-surface-elevated transition"
                title="First move"
              >
                <ChevronFirst size={18} />
              </button>
              <button
                onClick={() => {
                  setPlyIndex(Math.max(0, plyIndex - 1));
                  setIsPlaying(false);
                }}
                disabled={plyIndex === 0}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-xl hover:bg-surface-elevated transition"
                title="Previous move"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-accent hover:bg-accent/15 rounded-xl transition"
                title={isPlaying ? 'Pause' : 'Play demonstration'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => {
                  setPlyIndex(Math.min(selectedVariation.moves.length, plyIndex + 1));
                  setIsPlaying(false);
                }}
                disabled={plyIndex >= selectedVariation.moves.length}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-xl hover:bg-surface-elevated transition"
                title="Next move"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => {
                  setPlyIndex(selectedVariation.moves.length);
                  setIsPlaying(false);
                }}
                disabled={plyIndex >= selectedVariation.moves.length}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-xl hover:bg-surface-elevated transition"
                title="Last move"
              >
                <ChevronLast size={18} />
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 pr-3">
              Move {Math.floor(plyIndex / 2) + 1}
            </div>
          </div>

          {/* Move Sequence Pills */}
          <div className="w-full max-w-[480px] mt-3 p-4 bg-surface rounded-2xl">
            <span className="text-xs font-semibold text-slate-400 block mb-2.5">
              Move sequence
            </span>
            <div className="flex flex-wrap gap-1.5 items-center max-h-24 overflow-y-auto">
              {selectedVariation.moves.map((move, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPlyIndex(i + 1);
                    setIsPlaying(false);
                  }}
                  className={`px-2 py-0.5 rounded-md text-xs font-mono transition ${
                    i < plyIndex
                      ? 'bg-accent/15 text-accent font-semibold'
                      : 'bg-surface-elevated text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {Math.floor(i / 2) + 1}.{i % 2 === 1 ? '..' : ''} {move}
                </button>
              ))}
            </div>
          </div>

          {/* Branching Alternatives */}
          {candidateBranches.length > 0 && (
            <div className="w-full max-w-[480px] mt-3 p-4 bg-surface rounded-2xl">
              <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5 mb-2.5">
                <GitBranch size={13} className="text-accent" />
                <span>Repertoire alternatives at this position:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {candidateBranches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      const newMoves = [...selectedVariation.moves.slice(0, plyIndex), branch.san];
                      setSelectedVariation((prev) => ({
                        ...prev,
                        moves: newMoves,
                      }));
                      setPlyIndex(newMoves.length);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-border text-xs font-mono text-slate-200 hover:text-accent transition flex items-center space-x-1.5"
                  >
                    <span className="font-bold text-accent">{branch.san}</span>
                    {branch.comment && (
                      <span className="text-xs text-slate-400 font-sans truncate max-w-[140px]">
                        ({branch.comment})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Strategic Description, Sister Variations, and Deviations */}
        <div className="lg:col-span-6 space-y-5">
          {/* Strategic Context Card */}
          <div className="bg-surface rounded-2xl p-6">
            <h3 className="font-semibold text-slate-100 text-sm mb-2 flex items-center space-x-2">
              <BookOpen size={16} className="text-accent" />
              <span>Strategic overview & motifs</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {selectedVariation.description || repertoire.description}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-elevated text-xs">
              <div>
                <span className="text-slate-400 block text-xs">Side played</span>
                <span className="font-medium text-slate-200 capitalize">{repertoire.color}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Deepest preparation</span>
                <span className="font-medium text-slate-200 font-mono">
                  {selectedVariation.moves.length} plies
                </span>
              </div>
            </div>
          </div>

          {/* Sister Variations in this Repertoire */}
          <div className="bg-surface rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center space-x-2">
                <GitBranch size={16} className="text-accent" />
                <span>Lines in this repertoire ({repertoire.variations?.length || 0})</span>
              </h3>
              <button
                onClick={() => setShowAddLineModal(true)}
                className="px-2.5 py-1 text-xs bg-surface-elevated hover:bg-surface-border text-accent rounded-lg transition flex items-center space-x-1"
              >
                <Plus size={13} />
                <span>Add variation</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(repertoire.variations || []).map((v) => {
                const isCurrent = v.id === selectedVariation.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVariation(v);
                      setPlyIndex(v.moves.length);
                      setIsPlaying(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between text-xs ${
                      isCurrent
                        ? 'bg-accent/10 text-accent font-semibold ring-1 ring-accent/30'
                        : 'bg-surface-elevated hover:bg-surface-border text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-xs mr-2 text-slate-400">{v.eco || 'Line'}</span>
                      <span className="truncate">{v.name}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 shrink-0">
                      {v.moves.length} plies
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Deviations in this Repertoire */}
          <div className="bg-surface rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center space-x-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <span>Game deviations</span>
              </h3>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                {relevantDeviations.length} detected
              </span>
            </div>

            {relevantDeviations.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                No deviations detected. When you import games that diverge from your repertoire lines, they will appear here so you can patch holes in your theory.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {relevantDeviations.slice(0, 8).map((dev, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-surface-elevated flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-200 block mb-0.5">
                        Ply {dev.ply} in your game
                      </span>
                      <div className="flex items-center space-x-2 font-mono text-xs">
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

      {/* Modal: Add Variation to this Repertoire */}
      {showAddLineModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Plus size={18} className="text-accent" />
              <span>Add Variation to {repertoire.name}</span>
            </h3>

            <form onSubmit={handleAddVariation} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Variation Name</label>
                <input
                  type="text"
                  placeholder="e.g. Italian Game: Giuoco Piano"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">PGN / SAN Moves</label>
                <textarea
                  rows={4}
                  placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5..."
                  value={customPgn}
                  onChange={(e) => setCustomPgn(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg p-3 text-xs text-slate-200 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLineModal(false)}
                  className="px-4 py-2 bg-surface-elevated border border-surface-border rounded-lg text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs shadow"
                >
                  Save Variation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
