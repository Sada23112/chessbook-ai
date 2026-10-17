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
  Plus,
  ChevronDown,
  ChevronUp,
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
    desc: 'Kasparov’s Immortal — tactical masterpiece with deep king hunt.',
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
    desc: 'Sharp clash in the Ruy Lopez Berlin Defense.',
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
    desc: 'Scotch Game with tactical rook penetration.',
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
  const { setActiveGame, settings } = useAppStore();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showImportSection, setShowImportSection] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<'upload' | 'paste' | 'lichess' | 'chesscom'>('upload');

  const [pastedPgn, setPastedPgn] = useState('');
  const [lichessUser, setLichessUser] = useState(settings?.playerUsernames?.lichess || '');
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
        setStatusMessage(`Imported ${newGames.length} new game(s).`);
      } else {
        setStatusMessage('All games were already in your library.');
      }

      await loadGames();
    } catch (err: unknown) {
      setErrorMessage(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

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
        setStatusMessage(`Imported ${newGames.length} game(s) successfully.`);
        setPastedPgn('');
      } else {
        setStatusMessage('Game is already in your library.');
      }

      await loadGames();
    } catch (err: unknown) {
      setErrorMessage(`Error parsing PGN: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLichessImport = async () => {
    if (!lichessUser.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await fetchLichessGames(lichessUser, 15, setStatusMessage);
    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setStatusMessage(
        `Imported ${result.newImported} game(s) from Lichess.`
      );
      await loadGames();
    }
    setIsLoading(false);
  };

  const handleChessComImport = async () => {
    if (!chessComUser.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    const result = await fetchChessComGames(chessComUser, 15, setStatusMessage);
    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setStatusMessage(
        `Imported ${result.newImported} game(s) from Chess.com.`
      );
      await loadGames();
    }
    setIsLoading(false);
  };

  const handleLoadSample = async (sample: (typeof SAMPLE_GAMES)[0]) => {
    const parsed = parseSinglePgn(sample.pgn, 'paste');
    if (parsed) {
      await db.games.put(parsed);
      await loadGames();
      await setActiveGame(parsed.id);
    }
  };

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
    <div className="flex-1 flex flex-col overflow-y-auto bg-background">
      <div className="max-w-6xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Game Library</h1>
            <p className="text-slate-500 text-sm mt-1">
              {games.length} {games.length === 1 ? 'game' : 'games'} stored locally in your browser.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search players or openings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 bg-surface rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-accent/40 w-48 sm:w-60"
              />
            </div>

            {/* Toggle Import Panel */}
            <button
              onClick={() => setShowImportSection((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                showImportSection
                  ? 'bg-surface-elevated text-slate-200'
                  : 'bg-accent hover:bg-accent-hover text-black shadow-sm'
              }`}
            >
              {showImportSection ? (
                <>
                  <span>Close</span>
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Import</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Import Drawer */}
        {showImportSection && (
          <div className="bg-surface rounded-2xl p-6 mb-8 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-200 text-sm">Import games</h3>
              <div className="flex items-center gap-1">
                {[
                  { id: 'upload', label: 'File' },
                  { id: 'paste', label: 'Paste PGN' },
                  { id: 'chesscom', label: 'Chess.com' },
                  { id: 'lichess', label: 'Lichess' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveImportTab(tab.id as any);
                      setStatusMessage(null);
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeImportTab === tab.id
                        ? 'bg-surface-elevated text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload tab */}
            {activeImportTab === 'upload' && (
              <label className="flex flex-col items-center justify-center rounded-xl p-8 bg-surface-elevated/50 hover:bg-surface-elevated transition cursor-pointer border border-dashed border-surface-border/80">
                <input
                  type="file"
                  accept=".pgn,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload size={22} className="text-slate-400 mb-2" />
                <p className="text-xs font-medium text-slate-200">
                  Select or drop a .pgn file
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Single games or multi-game PGN databases
                </p>
              </label>
            )}

            {/* Paste tab */}
            {activeImportTab === 'paste' && (
              <div className="space-y-3">
                <textarea
                  rows={4}
                  placeholder="Paste PGN here (e.g. 1. e4 e5 2. Nf3 Nc6...)"
                  value={pastedPgn}
                  onChange={(e) => setPastedPgn(e.target.value)}
                  className="w-full bg-surface-elevated rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-accent/40"
                />
                <button
                  onClick={handlePasteImport}
                  disabled={isLoading || !pastedPgn.trim()}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-black font-semibold rounded-xl text-xs transition"
                >
                  Parse & Save
                </button>
              </div>
            )}

            {/* Chess.com tab */}
            {activeImportTab === 'chesscom' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Chess.com username (e.g. Sada012)"
                    value={chessComUser}
                    onChange={(e) => setChessComUser(e.target.value)}
                    className="flex-1 bg-surface-elevated rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <button
                    onClick={handleChessComImport}
                    disabled={isLoading || !chessComUser.trim()}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-black font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    {isLoading && <Loader2 size={13} className="animate-spin" />}
                    <span>Fetch Games</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Fetches your recent rated games from Chess.com public archives.
                </p>
              </div>
            )}

            {/* Lichess tab */}
            {activeImportTab === 'lichess' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Lichess username (e.g. DrNykterstein)"
                    value={lichessUser}
                    onChange={(e) => setLichessUser(e.target.value)}
                    className="flex-1 bg-surface-elevated rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <button
                    onClick={handleLichessImport}
                    disabled={isLoading || !lichessUser.trim()}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-black font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    {isLoading && <Loader2 size={13} className="animate-spin" />}
                    <span>Fetch Games</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Fetches recent games directly from Lichess public API.
                </p>
              </div>
            )}

            {/* Status alerts */}
            {statusMessage && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} />
                <span>{statusMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Quick demo master games */}
            <div className="mt-6 pt-5 border-t border-surface-border/50">
              <p className="text-xs text-slate-500 mb-2.5">Or try a sample game:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SAMPLE_GAMES.map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => handleLoadSample(sample)}
                    className="text-left p-3 rounded-xl bg-surface-elevated hover:bg-surface-hover transition"
                  >
                    <p className="text-xs font-medium text-slate-200 truncate">{sample.title}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{sample.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game cards */}
        {filteredGames.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center text-2xl mb-4 text-slate-500">
              ♟
            </div>
            <h2 className="text-base font-medium text-slate-200 mb-1">No games found</h2>
            <p className="text-xs text-slate-500 max-w-sm mb-6">
              {search ? 'Try adjusting your search query.' : 'Import games above to start analyzing your moves.'}
            </p>
            {!showImportSection && (
              <button
                onClick={() => setShowImportSection(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-xl text-xs transition"
              >
                Import Games
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredGames.map((game) => {
              const outcome = getGameOutcome(
                game,
                settings?.playerUsernames?.chessCom || chessComUser || 'Sada012'
              );

              return (
                <div
                  key={game.id}
                  onClick={() => setActiveGame(game.id)}
                  className="bg-[#262421] hover:bg-[#312e2b] border border-[#383531] rounded-[6px] p-4 transition cursor-pointer flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    {/* Date & Outcome */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-[#989795] font-mono">{game.date}</span>
                      <span
                        className={`text-[11px] font-sans font-bold px-2 py-0.5 rounded-[4px] shadow-sm ${
                          outcome.isWin
                            ? 'bg-[#81b64c] text-white'
                            : outcome.isLoss
                            ? 'bg-[#ca3431] text-white'
                            : 'bg-[#65625a] text-white'
                        }`}
                      >
                        {outcome.isWin ? 'Win' : outcome.isLoss ? 'Loss' : 'Draw'} ({game.result})
                      </span>
                    </div>

                    {/* Players */}
                    <div className="space-y-1.5 mb-3 bg-[#1f1e1b] p-2.5 rounded-[4px] border border-[#383531]">
                      <div className="flex items-center justify-between text-xs text-white">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0 shadow-sm" />
                          <span className="font-bold truncate">{game.white}</span>
                        </div>
                        {game.whiteElo && (
                          <span className="text-[11px] text-[#989795] font-mono font-semibold shrink-0 ml-2">
                            ({game.whiteElo})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-white">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#181715] border border-[#524e47] shrink-0 shadow-sm" />
                          <span className="font-bold truncate">{game.black}</span>
                        </div>
                        {game.blackElo && (
                          <span className="text-[11px] text-[#989795] font-mono font-semibold shrink-0 ml-2">
                            ({game.blackElo})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Opening */}
                    {game.opening && (
                      <p className="text-xs text-[#989795] truncate mb-3">
                        {game.eco && (
                          <span className="font-mono text-white font-bold bg-[#383531] px-1 py-0.5 rounded text-[10px] mr-1.5">
                            {game.eco}
                          </span>
                        )}
                        <span>{game.opening}</span>
                      </p>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="pt-2.5 border-t border-[#383531] flex items-center justify-between text-xs">
                    <span className="text-[#989795] font-mono">{game.movesCount} plies</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveGame(game.id, 'opening_coach');
                        }}
                        className="chess-btn-secondary px-2.5 py-1 rounded-[4px] text-xs font-bold"
                      >
                        Coach
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveGame(game.id, 'full_game');
                        }}
                        className="chess-btn-primary px-3 py-1 rounded-[4px] text-xs font-bold shadow"
                      >
                        Review
                      </button>
                      <button
                        onClick={(e) => handleDelete(game.id, e)}
                        className="p-1 text-[#65625a] hover:text-[#ca3431] transition ml-1"
                        title="Delete game"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
