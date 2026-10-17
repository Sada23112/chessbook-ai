import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Palette,
  User,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { db } from '../../db/db';
import type { UserSettings } from '../../types/chess';
import { useAppStore } from '../../store/useAppStore';
import { chessAudio } from '../../utils/chessAudio';
import { fetchChessComStats } from '../../services/onlineImportService';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, loadSettings } = useAppStore();
  const [chessComUser, setChessComUser] = useState('');
  const [lichessUser, setLichessUser] = useState('');
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [verifiedStats, setVerifiedStats] = useState<{ rapid?: number; blitz?: number; puzzles?: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(!chessAudio.isMuted());

  useEffect(() => {
    if (settings) {
      const cc = settings.playerUsernames?.chessCom || '';
      setChessComUser(cc);
      setLichessUser(settings.playerUsernames?.lichess || '');
      if (cc) {
        fetchChessComStats(cc).then((st) => {
          if (st) setVerifiedStats(st);
        });
      }
    }
  }, [settings]);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    chessAudio.setMuted(!enabled);
    if (enabled) {
      chessAudio.playMove();
    }
  };

  const handleSaveUsernames = async () => {
    const cleanCC = chessComUser.trim();
    await updateSettings({
      playerUsernames: {
        chessCom: cleanCC,
        lichess: lichessUser.trim(),
      },
    });

    if (cleanCC) {
      const stats = await fetchChessComStats(cleanCC);
      if (stats) {
        setVerifiedStats(stats);
        setBackupStatus(`Saved! Chess.com ratings verified: Rapid ${stats.rapid ?? '—'}, Blitz ${stats.blitz ?? '—'}`);
        setTimeout(() => setBackupStatus(null), 4000);
        return;
      }
    }

    setBackupStatus('Usernames saved successfully.');
    setTimeout(() => setBackupStatus(null), 3000);
  };

  const handleExportBackup = async () => {
    try {
      const json = await db.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chessbook_ai_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus('Backup file downloaded successfully.');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch {
      alert('Failed to export backup.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await db.importBackup(text);
      setBackupStatus(
        `Backup restored! Imported ${res.importedGames} games and ${res.importedCards} training exercises.`
      );
      await loadSettings();
    } catch (err) {
      alert('Failed to restore backup: Invalid file format.');
    }
  };

  const handleClearAllData = async () => {
    if (
      confirm(
        'Are you sure you want to delete all saved games, analyses, and training cards? This action cannot be undone.'
      )
    ) {
      await db.games.clear();
      await db.analyses.clear();
      await db.trainingCards.clear();
      await db.weaknesses.clear();
      window.location.reload();
    }
  };

  if (!settings) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-background select-none">
      <div className="max-w-3xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-[#989795] text-xs mt-1">
            Configure Chess.com board appearance, sound effects, and Stockfish engine.
          </p>
        </div>

        {backupStatus && (
          <div className="mb-6 p-3 rounded-[6px] bg-[#81b64c]/15 border border-[#81b64c]/30 text-[#81b64c] text-xs flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span className="font-semibold">{backupStatus}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Board & Audio Theme */}
          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-5 shadow-sm">
            <h3 className="font-bold text-white text-xs mb-4 flex items-center gap-2 uppercase tracking-wider text-[#81b64c]">
              <Palette size={16} />
              <span>Board & Sound</span>
            </h3>

            <div className="space-y-4">
              {/* Board Theme */}
              <div>
                <label className="text-xs text-[#989795] block mb-2 font-semibold">
                  Board Theme
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'emerald', label: 'Green (Chess.com)', dark: '#779952', light: '#edeed1' },
                    { id: 'wood', label: 'Wood', dark: '#b58863', light: '#f0d9b5' },
                    { id: 'midnight', label: 'Midnight', dark: '#414856', light: '#7988a1' },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateSettings({ boardTheme: theme.id as any })}
                      className={`p-2.5 rounded-[6px] border text-left transition flex items-center gap-2.5 ${
                        settings.boardTheme === theme.id || (!settings.boardTheme && theme.id === 'emerald')
                          ? 'border-[#81b64c] bg-[#312e2b]'
                          : 'border-[#383531] bg-[#1f1e1b] hover:border-[#4a463f]'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-[3px] overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/20">
                        <div style={{ backgroundColor: theme.light }} />
                        <div style={{ backgroundColor: theme.dark }} />
                        <div style={{ backgroundColor: theme.dark }} />
                        <div style={{ backgroundColor: theme.light }} />
                      </div>
                      <span className="text-xs font-bold text-white truncate">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Toggle */}
              <div className="flex items-center justify-between text-xs text-white pt-2 border-t border-[#383531]">
                <div className="flex items-center gap-2">
                  {soundEnabled ? (
                    <Volume2 size={16} className="text-[#81b64c]" />
                  ) : (
                    <VolumeX size={16} className="text-[#989795]" />
                  )}
                  <div>
                    <span className="font-bold block">Chess.com Sound Effects</span>
                    <span className="text-[11px] text-[#989795]">Wood moves, captures, castles, and checks</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleSound(!soundEnabled)}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-bold transition ${
                    soundEnabled
                      ? 'bg-[#81b64c] text-white'
                      : 'bg-[#383531] text-[#989795]'
                  }`}
                >
                  {soundEnabled ? 'Enabled' : 'Muted'}
                </button>
              </div>
            </div>
          </div>

          {/* Engine Settings */}
          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-5 shadow-sm">
            <h3 className="font-bold text-white text-xs mb-4 flex items-center gap-2 uppercase tracking-wider text-[#81b64c]">
              <Cpu size={16} />
              <span>Stockfish 10 Engine</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#989795] block mb-2 font-semibold">
                  Default Analysis Depth
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'quick', depth: 10, label: 'Quick (10 plies)' },
                    { id: 'standard', depth: 14, label: 'Standard (14 plies)' },
                    { id: 'deep', depth: 18, label: 'Deep (18 plies)' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() =>
                        updateSettings({
                          enginePreset: preset.id as any,
                          engineDepth: preset.depth,
                        })
                      }
                      className={`py-2 px-3 rounded-[6px] text-xs font-bold transition ${
                        settings.engineDepth === preset.depth
                          ? 'bg-[#81b64c] text-white shadow-sm'
                          : 'bg-[#1f1e1b] text-[#989795] hover:text-white border border-[#383531]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-white pt-2 border-t border-[#383531]">
                <div>
                  <span className="font-bold block">Best Move Arrows</span>
                  <span className="text-[11px] text-[#989795]">Display green arrows for recommended moves</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showBestMoveArrow}
                  onChange={(e) => updateSettings({ showBestMoveArrow: e.target.checked })}
                  className="w-4 h-4 accent-[#81b64c] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-white pt-2 border-t border-[#383531]">
                <div>
                  <span className="font-bold block">Evaluation Bar</span>
                  <span className="text-[11px] text-[#989795]">Show left vertical live advantage bar</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showEvalBar}
                  onChange={(e) => updateSettings({ showEvalBar: e.target.checked })}
                  className="w-4 h-4 accent-[#81b64c] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Player Profiles */}
          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-5 shadow-sm">
            <h3 className="font-bold text-white text-xs mb-3 flex items-center gap-2 uppercase tracking-wider text-[#81b64c]">
              <User size={16} />
              <span>Player Accounts</span>
            </h3>
            <p className="text-xs text-[#989795] mb-4">
              Enter your username to automatically identify your games and calculate win rates.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-[#989795] block mb-1 font-semibold">
                  Chess.com Username
                </label>
                <input
                  type="text"
                  value={chessComUser}
                  onChange={(e) => setChessComUser(e.target.value)}
                  placeholder="e.g. Sada012"
                  className="w-full bg-[#1f1e1b] border border-[#383531] rounded-[6px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#81b64c] placeholder-[#65625a]"
                />
              </div>
              <div>
                <label className="text-xs text-[#989795] block mb-1 font-semibold">
                  Lichess Username
                </label>
                <input
                  type="text"
                  value={lichessUser}
                  onChange={(e) => setLichessUser(e.target.value)}
                  placeholder="e.g. DrNykterstein"
                  className="w-full bg-[#1f1e1b] border border-[#383531] rounded-[6px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#81b64c] placeholder-[#65625a]"
                />
              </div>
            </div>

            {verifiedStats && (
              <div className="mb-4 p-2.5 rounded-[4px] bg-[#1a1917] border border-[#383531] text-xs flex items-center justify-between">
                <span className="text-[#989795]">Verified Chess.com:</span>
                <div className="flex items-center gap-2 text-white font-mono font-bold">
                  <span>Rapid: <span className="text-[#81b64c]">{verifiedStats.rapid ?? '—'}</span></span>
                  <span>•</span>
                  <span>Blitz: <span className="text-[#81b64c]">{verifiedStats.blitz ?? '—'}</span></span>
                  {verifiedStats.puzzles && (
                    <>
                      <span>•</span>
                      <span>Puzzles: <span className="text-[#81b64c]">{verifiedStats.puzzles}</span></span>
                    </>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleSaveUsernames}
              className="chess-btn-primary px-4 py-2 rounded-[6px] text-xs font-bold shadow"
            >
              Save Accounts
            </button>
          </div>

          {/* Data Portability */}
          <div className="bg-[#262421] border border-[#383531] rounded-[6px] p-5 shadow-sm">
            <h3 className="font-bold text-white text-xs mb-1.5 flex items-center gap-2 uppercase tracking-wider text-[#81b64c]">
              <Shield size={16} />
              <span>Data Portability & Backup</span>
            </h3>
            <p className="text-xs text-[#989795] mb-4 leading-relaxed">
              Everything is stored locally in your browser IndexedDB. Export a backup JSON to sync across devices.
            </p>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleExportBackup}
                className="chess-btn-secondary px-3.5 py-2 rounded-[6px] text-xs font-bold flex items-center gap-2"
              >
                <Download size={13} />
                <span>Export Backup</span>
              </button>

              <label className="chess-btn-secondary px-3.5 py-2 rounded-[6px] text-xs font-bold flex items-center gap-2 cursor-pointer">
                <Upload size={13} />
                <span>Restore Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-[#ca3431]/10 border border-[#ca3431]/30 rounded-[6px] p-5">
            <h3 className="font-bold text-[#ca3431] text-xs mb-1.5 flex items-center gap-2 uppercase tracking-wider">
              <AlertTriangle size={16} />
              <span>Danger Zone</span>
            </h3>
            <p className="text-xs text-[#989795] mb-4">
              Permanently delete all games, analyses, and training history.
            </p>
            <button
              onClick={handleClearAllData}
              className="px-4 py-2 bg-[#ca3431]/20 hover:bg-[#ca3431]/30 border border-[#ca3431]/40 text-white rounded-[6px] text-xs font-bold transition flex items-center gap-2"
            >
              <Trash2 size={13} />
              <span>Clear All Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
