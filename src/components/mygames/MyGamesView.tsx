import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Globe,
  Trash2,
  Search,
  Sparkles,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { db } from '../../db/db';
import type { GameRecord } from '../../types/chess';
import { parseMultiplePgns, parseSinglePgn } from '../../utils/pgnParser';
import { fetchLichessGames, fetchChessComGames } from '../../services/onlineImportService';
import { useAppStore } from '../../store/useAppStore';
import { getGameOutcome } from '../../utils/gameOutcome';

const SAMPLE_GAMES: Array<{ title: string; desc: string; pgn: string }> = [
  {
    title: 'Kasparov vs. Topalov (1999)',
    desc: 'Kasparov’s Immortal — a tactical masterpiece featuring brilliant sacrifices and king hunts.',
    pgn: `[Event "Hoogovens Group A"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[ECO "B07"]
[Opening "Pirc Defense"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`,
  },
  {
    title: 'Carlsen vs. Nakamura (2020)',
    desc: 'Sharp clash in the Ruy Lopez with rapid tactical shifts.',
    pgn: `[Event "Chessable Masters"]
[Site "chess24.com"]
[Date "2020.06.28"]
[White "Magnus Carlsen"]
[Black "Hikaru Nakamura"]
[Result "1-0"]
[ECO "C65"]
[Opening "Ruy Lopez: Berlin Defense"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O 6. O-O d6 7. Nbd2 Ne7 8. d4 exd4 9. cxd4 Bb6 10. Re1 Bg4 11. h3 Bh5 12. Qb3 d5 13. e5 Nd7 14. Bd3 c5 15. Qc2 Bg6 16. Bxg6 Nxg6 17. dxc5 Bxc5 18. Nb3 Bb6 19. Qd3 Re8 20. Qxd5 Ndxe5 21. Qxd8 Raxd8 22. Nxe5 Nxe5 23. Be3 Nd3 24. Bxb6 axb6 25. Rxe8+ Rxe8 26. Rd1 Nxb2 27. Rd7 g6 28. Rxb7 Re1+ 29. Kh2 Re2 30. f4 Nd3 31. Kg3 Rxa2 32. Rxb6 Rb2 33. Rb5 Ne1 34. Nd4 Rxg2+ 35. Kh4 Rd2 36. Nc6 Kg7 37. Ne5 Nd3 38. Rd5 Nxe5 39. Rxd2 Nf3+ 1-0`,
  },
  {
    title: 'Sada012 vs. licht_d_god (2026)',
    desc: 'Sada012’s Scotch Game victory on Chess.com featuring tactical rook infiltration and king hunt.',
    pgn: `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.11"]
[White "licht_d_god"]
[Black "Sada012"]
[Result "0-1"]
[WhiteElo "722"]
[BlackElo "737"]
[ECO "C45"]
[Opening "Scotch Game"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nxd4 5. Qxd4 d6 6. Bc4 Nf6 7. O-O g6 8. Re1 Bg7 9. Bg5 O-O 10. e5 dxe5 11. Qxe5 Bf5 12. Bxf6 Bxf6 13. Qe3 Bxb2 14. Nd2 Bxa1 15. Rxa1 Bxc2 16. Nf3 Re8 17. Qd2 Qxd2 18. Nxd2 Ba4 19. h3 Rad8 20. Nf3 Bc6 21. Ng5 Re7 22. Bxf7+ Rxf7 23. Nxf7 Kxf7 24. Rc1 Kg7 25. Kh2 Rd2 26. Kg3 Rxa2 27. Re1 Rd2 28. Re7+ Kh6 29. Rxc7 a5 30. f4 Rxg2+ 31. Kh4 g5+ 32. fxg5+ Kg6 33. Re7 a4 34. Re3 Rg1 35. Re1 Rxe1 36. Kg4 Rf1 37. Kh4 a3 38. Kg4 a2 39. Kg3 a1=Q 40. Kh4 Qa4+ 41. Kg3 Rf3+ 42. Kg2 Qc2+ 43. Kg1 Ra3 0-1`,
  },
];

export const MyGamesView: React.FC = () => {
  const { setActiveGame, startAnalysis, settings } = useAppStore();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [search, setSearch] = useState('');
  const [activeImportTab, setActiveImportTab] = useState<'upload' | 'paste' | 'lichess' | 'chesscom'>('upload');

  // Input states
  const [pastedPgn, setPastedPgn] = useState('');
  const [lichessUser, setLichessUser] = useState('');
  const [chessComUser, setChessComUser] = useState(settings?.playerUsernames?.chessCom || 'Sada012');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGames = async () => {
    const list = await db.games.orderBy('createdAt').reverse().toArray();
    setGames(list);
  };

  useEffect(() => {
    loadGames();
  }, []);

  // Handle PGN File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setStatusMessage('Reading PGN file...');
    setErrorMessage(null);

    try {
      const file = files[0];
      const text = await file.text();
      const parsed = parseMultiplePgns(text, 'upload');

      if (parsed.length === 0) {
        setErrorMessage('Could not find any valid games in this PGN file.');
        setIsLoading(false);
        return;
      }

      const existingFp = new Set(await db.games.orderBy('fingerprint').keys());
      const newGames = parsed.filter((g) => !existingFp.has(g.fingerprint));

      if (newGames.length > 0) {
        await db.games.bulkPut(newGames);
        setStatusMessage(`Successfully imported ${newGames.length} new game(s)!`);
      } else {
        setStatusMessage('All games in this file were already in your library.');
      }

      await loadGames();
    } catch (err: unknown) {
      setErrorMessage(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Pasted PGN Text
  const handlePasteImport = async () => {
    if (!pastedPgn.trim()) return;

    setIsLoading(true);
    setStatusMessage('Parsing PGN text...');
    setErrorMessage(null);

    try {
      const parsed = parseMultiplePgns(pastedPgn, 'paste');
      if (parsed.length === 0) {
        setErrorMessage('Invalid PGN format. Please check your text.');
        setIsLoading(false);
        return;
      }

      const existingFp = new Set(await db.games.orderBy('fingerprint').keys());
      const newGames = parsed.filter((g) => !existingFp.has(g.fingerprint));

      if (newGames.length > 0) {
        await db.games.bulkPut(newGames);
        setStatusMessage(`Imported ${newGames.length} game(s) successfully!`);
        setPastedPgn('');
      } else {
        setStatusMessage('Game is already in your library (duplicate detected).');
      }

      await loadGames();
    } catch (err: unknown) {
      setErrorMessage(`Error parsing PGN: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Lichess fetch
  const handleLichessImport = async () => {
    if (!lichessUser.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await fetchLichessGames(lichessUser, 15, setStatusMessage);
    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setStatusMessage(
        `Imported ${result.newImported} new game(s) from Lichess (${result.duplicatesSkipped} duplicates skipped).`
      );
      await loadGames();
    }
    setIsLoading(false);
  };

  // Handle Chess.com fetch
  const handleChessComImport = async () => {
    if (!chessComUser.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await fetchChessComGames(chessComUser, 15, setStatusMessage);
    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setStatusMessage(
        `Imported ${result.newImported} new game(s) from Chess.com (${result.duplicatesSkipped} duplicates skipped).`
      );
      await loadGames();
    }
    setIsLoading(false);
  };

  // Load a sample demo game
  const handleLoadSample = async (sample: (typeof SAMPLE_GAMES)[0]) => {
    const parsed = parseSinglePgn(sample.pgn, 'paste');
    if (parsed) {
      await db.games.put(parsed);
      await loadGames();
      await setActiveGame(parsed.id);
    }
  };

  // Delete a game
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this game from your library?')) {
      await db.games.delete(id);
      await db.analyses.delete(id);
      await loadGames();
    }
  };

  const filteredGames = games.filter(
    (g) =>
      g.white.toLowerCase().includes(search.toLowerCase()) ||
      g.black.toLowerCase().includes(search.toLowerCase()) ||
      (g.opening && g.opening.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Game Library</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Import, organize, and analyze your games locally without a server.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => handleChessComImport()}
            disabled={isLoading}
            className="w-full sm:w-auto px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <Globe size={14} />
            <span>Sync Sada012 from Chess.com</span>
          </button>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search players or openings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Import Section Card */}
      <div className="bg-surface rounded-xl border border-surface-border p-5 mb-8">
        <h3 className="font-semibold text-slate-200 text-sm mb-3 flex items-center space-x-2">
          <Upload size={16} className="text-accent" />
          <span>Import Games</span>
        </h3>

        {/* Import Tabs */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-surface-border pb-3">
          {[
            { id: 'upload', label: 'PGN File Upload', icon: Upload },
            { id: 'paste', label: 'Paste PGN', icon: FileText },
            { id: 'lichess', label: 'Lichess API', icon: Globe },
            { id: 'chesscom', label: 'Chess.com API', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveImportTab(tab.id as any);
                  setStatusMessage(null);
                  setErrorMessage(null);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeImportTab === tab.id
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-slate-400 hover:text-slate-200 bg-surface-elevated'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: PGN File Upload */}
        {activeImportTab === 'upload' && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-surface-border hover:border-accent/50 rounded-xl p-6 bg-surface-muted transition cursor-pointer relative">
            <input
              type="file"
              accept=".pgn,.txt"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload size={28} className="text-accent mb-2" />
            <p className="text-sm font-medium text-slate-200">
              Drop your .pgn file here, or click to browse
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports single games or multi-game database archives
            </p>
          </div>
        )}

        {/* Tab 2: Paste PGN */}
        {activeImportTab === 'paste' && (
          <div className="space-y-3">
            <textarea
              rows={4}
              placeholder="Paste PGN text here (e.g. 1. e4 e5 2. Nf3 Nc6...)"
              value={pastedPgn}
              onChange={(e) => setPastedPgn(e.target.value)}
              className="w-full bg-surface-muted border border-surface-border rounded-lg p-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent"
            />
            <button
              onClick={handlePasteImport}
              disabled={isLoading || !pastedPgn.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition"
            >
              Parse & Save PGN
            </button>
          </div>
        )}

        {/* Tab 3: Lichess */}
        {activeImportTab === 'lichess' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Lichess username (e.g. DrNykterstein)"
                value={lichessUser}
                onChange={(e) => setLichessUser(e.target.value)}
                className="flex-1 bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleLichessImport}
                disabled={isLoading || !lichessUser.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition flex items-center space-x-1.5"
              >
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Fetch Games</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Fetches recent rated games directly via Lichess's public CORS API.
            </p>
          </div>
        )}

        {/* Tab 4: Chess.com */}
        {activeImportTab === 'chesscom' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Chess.com username (e.g. magnuscarlsen)"
                value={chessComUser}
                onChange={(e) => setChessComUser(e.target.value)}
                className="flex-1 bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleChessComImport}
                disabled={isLoading || !chessComUser.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black font-semibold rounded-lg text-xs transition flex items-center space-x-1.5"
              >
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Fetch Games</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Fetches monthly archives from Chess.com's public published archives.
            </p>
          </div>
        )}

        {/* Feedback Messages */}
        {statusMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 size={16} />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Demo Games */}
        <div className="mt-5 pt-4 border-t border-surface-border">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-2">
            Or test instantly with a Master Game:
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SAMPLE_GAMES.map((sample, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between hover:border-slate-600 transition"
              >
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">{sample.title}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{sample.desc}</p>
                </div>
                <button
                  onClick={() => handleLoadSample(sample)}
                  className="px-2.5 py-1 text-xs bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 rounded font-medium transition"
                >
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game List Table */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200 text-sm">
            Saved Games ({filteredGames.length})
          </h3>
        </div>

        {filteredGames.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-xl border border-surface-border">
            <p className="text-slate-400 text-sm">No games found.</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload a PGN or import from Lichess/Chess.com above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                onClick={() => setActiveGame(game.id)}
                className="p-4 rounded-xl bg-surface hover:bg-surface-elevated border border-surface-border hover:border-accent/40 transition cursor-pointer flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">{game.date}</span>
                    {(() => {
                      const outcome = getGameOutcome(
                        game,
                        settings?.playerUsernames?.chessCom || chessComUser || 'Sada012'
                      );
                      return (
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border flex items-center space-x-1.5 ${outcome.badgeClass}`}
                        >
                          <span>{game.result}</span>
                          {outcome.isWin && (
                            <span className="text-[10px] font-sans font-extrabold uppercase px-1 rounded bg-emerald-500/20 text-emerald-300">
                              WIN
                            </span>
                          )}
                          {outcome.isLoss && (
                            <span className="text-[10px] font-sans font-extrabold uppercase px-1 rounded bg-rose-500/20 text-rose-300">
                              LOSS
                            </span>
                          )}
                          {outcome.isDraw && (
                            <span className="text-[10px] font-sans font-extrabold uppercase px-1 rounded bg-slate-500/20 text-slate-300">
                              DRAW
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center space-x-1.5 text-sm font-semibold text-slate-200">
                      <span className="text-slate-400 font-mono text-xs">W:</span>
                      <span className="truncate">{game.white}</span>
                      {game.whiteElo && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({game.whiteElo})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 text-sm font-semibold text-slate-200">
                      <span className="text-slate-400 font-mono text-xs">B:</span>
                      <span className="truncate">{game.black}</span>
                      {game.blackElo && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({game.blackElo})
                        </span>
                      )}
                    </div>
                  </div>

                  {game.opening && (
                    <p className="text-xs text-slate-400 truncate mb-3">
                      <span className="font-mono text-slate-500">{game.eco}</span> {game.opening}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-surface-border/60 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">{game.movesCount} plies</span>
                      {game.summary ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium text-[10px] border border-emerald-500/30">
                          Analyzed
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          Unanalyzed
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDelete(game.id, e)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition rounded"
                      title="Delete game"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveGame(game.id, 'opening_coach');
                      }}
                      className="flex-1 py-1.5 px-2 bg-accent/15 hover:bg-accent text-accent hover:text-black font-semibold rounded-lg text-[11px] transition text-center border border-accent/30"
                    >
                      Review Opening Mistakes
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveGame(game.id, 'full_game');
                      }}
                      className="py-1.5 px-2.5 bg-surface-elevated hover:bg-surface-border text-slate-300 font-semibold rounded-lg text-[11px] transition border border-surface-border"
                    >
                      Full Game
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
