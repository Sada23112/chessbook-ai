import React, { useEffect, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
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
} from 'lucide-react';
import { db } from '../../db/db';
import type { OpeningRepertoire, GameRecord, PieceColor } from '../../types/chess';
import {
  createDefaultRepertoire,
  addLineToRepertoire,
  detectGameDeviations,
  type DeviationResult,
} from '../../repertoire/repertoireEngine';

const INITIAL_DEFAULT_REPERTOIRES = [
  {
    id: 'rep_white',
    name: 'White: Italian & Open Games',
    color: 'white' as PieceColor,
    initialLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3'],
  },
  {
    id: 'rep_black_e4',
    name: 'Black: Sicilian Defense (vs 1.e4)',
    color: 'black' as PieceColor,
    sideAgainst: 'e4' as const,
    initialLine: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
  },
  {
    id: 'rep_black_d4',
    name: 'Black: King’s Indian (vs 1.d4)',
    color: 'black' as PieceColor,
    sideAgainst: 'd4' as const,
    initialLine: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'],
  },
];

export const OpeningBookView: React.FC = () => {
  const [repertoires, setRepertoires] = useState<OpeningRepertoire[]>([]);
  const [activeRepId, setActiveRepId] = useState<string>('rep_white');
  const [activeLine, setActiveLine] = useState<string[]>([]);
  const [plyIndex, setPlyIndex] = useState<number>(0);
  const [deviations, setDeviations] = useState<DeviationResult[]>([]);

  // Practice mode
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [practiceStatus, setPracticeStatus] = useState<string | null>(null);

  // New line input
  const [customPgnInput, setCustomPgnInput] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);

  // Load repertoires and compute game deviations
  const loadRepertoires = async () => {
    let list = await db.repertoires.toArray();
    if (list.length === 0) {
      // Seed default repertoires
      for (const def of INITIAL_DEFAULT_REPERTOIRES) {
        let rep = createDefaultRepertoire(def.id, def.name, def.color, def.sideAgainst);
        rep = addLineToRepertoire(rep, def.initialLine);
        await db.repertoires.put(rep);
      }
      list = await db.repertoires.toArray();
    }

    setRepertoires(list);
    const selected = list.find((r) => r.id === activeRepId) || list[0];
    if (selected) {
      setActiveRepId(selected.id);
      loadRepLine(selected);
    }

    // Check deviations across user games
    const games = await db.games.toArray();
    const allDeviations: DeviationResult[] = [];
    for (const g of games) {
      const devs = detectGameDeviations(g, list);
      allDeviations.push(...devs);
    }
    setDeviations(allDeviations);
  };

  useEffect(() => {
    loadRepertoires();
  }, []);

  const activeRepertoire = repertoires.find((r) => r.id === activeRepId);

  // Load longest line from repertoire to display on board
  const loadRepLine = (rep: OpeningRepertoire) => {
    // DFS to find deepest line
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
    setActiveLine(longestPath);
    setPlyIndex(longestPath.length);
  };

  // Build current FEN based on activeLine and plyIndex
  const currentFen = useMemo(() => {
    const chess = new Chess();
    for (let i = 0; i < plyIndex && i < activeLine.length; i++) {
      chess.move(activeLine[i]);
    }
    return chess.fen();
  }, [activeLine, plyIndex]);

  // Handle move played in practice mode
  const onPieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean => {
    if (!isPracticing || !activeRepertoire || !targetSquare) return false;

    try {
      const chess = new Chess(currentFen);
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) return false;

      // Check if move matches next expected move in active line
      const expectedMove = activeLine[plyIndex];
      if (move.san === expectedMove) {
        setPracticeStatus('Correct move! Excellent memory.');
        const nextPly = plyIndex + 1;
        setPlyIndex(nextPly);

        // If next move is opponent's, auto-play it after 600ms
        if (nextPly < activeLine.length) {
          setTimeout(() => {
            setPlyIndex(nextPly + 1);
            setPracticeStatus('Your turn again. Find the next repertoire move.');
          }, 600);
        } else {
          setPracticeStatus('Line completed! You mastered this variation.');
        }
        return true;
      } else {
        setPracticeStatus(`Incorrect (${move.san}). Expected repertoire move is ${expectedMove}.`);
        return false;
      }
    } catch {
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

      const updated = addLineToRepertoire(activeRepertoire, history);
      await db.repertoires.put(updated);
      setCustomPgnInput('');
      setShowAddLine(false);
      await loadRepertoires();
    } catch {
      alert('Invalid PGN move sequence');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Opening Book</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Build your opening repertoires, test your recall, and identify game deviations.
          </p>
        </div>

        {/* Practice Toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setIsPracticing(!isPracticing);
              setPlyIndex(0);
              setPracticeStatus(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
              isPracticing
                ? 'bg-amber-500 text-black shadow'
                : 'bg-accent hover:bg-accent-hover text-black shadow'
            }`}
          >
            <Dumbbell size={16} />
            <span>{isPracticing ? 'Exit Practice Mode' : 'Start Repertoire Practice'}</span>
          </button>
        </div>
      </div>

      {/* Repertoire Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {repertoires.map((rep) => (
          <button
            key={rep.id}
            onClick={() => {
              setActiveRepId(rep.id);
              loadRepLine(rep);
              setIsPracticing(false);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition border flex items-center space-x-2 ${
              activeRepId === rep.id
                ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                : 'bg-surface text-slate-400 hover:text-slate-200 border-surface-border'
            }`}
          >
            <BookOpen size={14} />
            <span>{rep.name}</span>
          </button>
        ))}
      </div>

      {/* Main Grid: Board + Tree/Deviations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Column: Board & Navigation */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-[460px] aspect-square rounded-xl overflow-hidden shadow-2xl border border-surface-border bg-surface-elevated">
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation: activeRepertoire?.color || 'white',
                allowDragging: isPracticing,
                onPieceDrop,
                darkSquareStyle: { backgroundColor: '#2e3a44' },
                lightSquareStyle: { backgroundColor: '#5c6d7c' },
              }}
            />
          </div>

          {/* Practice Feedback */}
          {practiceStatus && (
            <div className="w-full max-w-[460px] mt-3 p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs text-center font-medium text-slate-200">
              {practiceStatus}
            </div>
          )}

          {/* Repertoire Move Path Pills */}
          <div className="w-full max-w-[460px] mt-4 p-3 bg-surface rounded-xl border border-surface-border flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Line:</span>
            {activeLine.map((move, i) => (
              <button
                key={i}
                onClick={() => setPlyIndex(i + 1)}
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

        {/* Right Column: Move Tree & Deviations */}
        <div className="lg:col-span-6 space-y-6">
          {/* Add Line Action */}
          <div className="bg-surface rounded-xl border border-surface-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                <GitBranch size={16} className="text-accent" />
                <span>Repertoire Variations</span>
              </h3>
              <button
                onClick={() => setShowAddLine(!showAddLine)}
                className="px-2.5 py-1 text-xs bg-surface-elevated hover:bg-surface-border text-accent border border-surface-border rounded-lg transition flex items-center space-x-1"
              >
                <Plus size={14} />
                <span>Add Variation</span>
              </button>
            </div>

            {showAddLine && (
              <div className="mb-4 p-3 bg-surface-elevated rounded-lg border border-surface-border space-y-2">
                <input
                  type="text"
                  placeholder="Paste PGN line (e.g. 1. e4 c5 2. Nf3 d6 3. d4 cxd4...)"
                  value={customPgnInput}
                  onChange={(e) => setCustomPgnInput(e.target.value)}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleAddCustomLine}
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-black font-semibold rounded-lg text-xs"
                >
                  Save to Repertoire
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed">
              Total moves mapped in this repertoire:{' '}
              <span className="font-mono text-accent font-bold">
                {Object.keys(activeRepertoire?.allMoves || {}).length}
              </span>
            </p>
          </div>

          {/* Game Deviations Section */}
          <div className="bg-surface rounded-xl border border-surface-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center space-x-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <span>Repertoire Deviations in Your Games</span>
              </h3>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                {deviations.length} found
              </span>
            </div>

            {deviations.length === 0 ? (
              <p className="text-xs text-slate-400">
                No deviations detected. When you import and analyze games, any moves that diverge from your prepared lines will appear here.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {deviations.map((dev, i) => (
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
                        <span className="text-emerald-400">Preferred: {dev.repertoireSan}</span>
                      </div>
                    </div>
                    <span className="text-xs text-accent font-mono font-bold">Review</span>
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
