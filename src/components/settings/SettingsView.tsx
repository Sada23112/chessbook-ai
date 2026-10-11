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
} from 'lucide-react';
import { db } from '../../db/db';
import type { UserSettings } from '../../types/chess';
import { useAppStore } from '../../store/useAppStore';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, loadSettings } = useAppStore();
  const [chessComUser, setChessComUser] = useState('');
  const [lichessUser, setLichessUser] = useState('');
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setChessComUser(settings.playerUsernames?.chessCom || '');
      setLichessUser(settings.playerUsernames?.lichess || '');
    }
  }, [settings]);

  const handleSaveUsernames = async () => {
    await updateSettings({
      playerUsernames: {
        chessCom: chessComUser.trim(),
        lichess: lichessUser.trim(),
      },
    });
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
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-background max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Configure engine parameters, default player identities, and local database backups.
        </p>
      </div>

      {backupStatus && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 size={16} />
          <span>{backupStatus}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Engine Settings */}
        <div className="bg-surface rounded-xl border border-surface-border p-6">
          <h3 className="font-semibold text-slate-200 text-sm mb-4 flex items-center space-x-2">
            <Cpu size={18} className="text-accent" />
            <span>Stockfish Engine Preferences</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Default Analysis Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'quick', depth: 10, label: 'Quick (Depth 10)' },
                  { id: 'standard', depth: 14, label: 'Standard (Depth 14)' },
                  { id: 'deep', depth: 18, label: 'Deep (Depth 18)' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() =>
                      updateSettings({
                        enginePreset: preset.id as any,
                        engineDepth: preset.depth,
                      })
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                      settings.engineDepth === preset.depth
                        ? 'bg-accent/15 text-accent border-accent/40 font-bold'
                        : 'bg-surface-elevated text-slate-400 border-surface-border hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-300">
              <span>Show Best Move Arrow on Board</span>
              <input
                type="checkbox"
                checked={settings.showBestMoveArrow}
                onChange={(e) => updateSettings({ showBestMoveArrow: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Show Live Evaluation Bar</span>
              <input
                type="checkbox"
                checked={settings.showEvalBar}
                onChange={(e) => updateSettings({ showEvalBar: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Player Profiles */}
        <div className="bg-surface rounded-xl border border-surface-border p-6">
          <h3 className="font-semibold text-slate-200 text-sm mb-4 flex items-center space-x-2">
            <User size={18} className="text-accent" />
            <span>Default Player Accounts</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Chess.com Username
              </label>
              <input
                type="text"
                value={chessComUser}
                onChange={(e) => setChessComUser(e.target.value)}
                placeholder="e.g. magnuscarlsen"
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Lichess Username
              </label>
              <input
                type="text"
                value={lichessUser}
                onChange={(e) => setLichessUser(e.target.value)}
                placeholder="e.g. DrNykterstein"
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            onClick={handleSaveUsernames}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold text-xs rounded-lg transition"
          >
            Save Player Usernames
          </button>
        </div>

        {/* Data Portability (Export & Restore) */}
        <div className="bg-surface rounded-xl border border-surface-border p-6">
          <h3 className="font-semibold text-slate-200 text-sm mb-2 flex items-center space-x-2">
            <Shield size={18} className="text-accent" />
            <span>Local Data Portability</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            All your games, opening repertoires, analysis trees, and spaced repetition cards are stored strictly inside your browser's IndexedDB. Export a JSON backup to transfer your data across machines.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportBackup}
              className="px-4 py-2 bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border rounded-lg text-xs font-semibold transition flex items-center space-x-2"
            >
              <Download size={14} />
              <span>Export Database Backup (.json)</span>
            </button>

            <label className="px-4 py-2 bg-surface-elevated hover:bg-surface-border text-slate-200 border border-surface-border rounded-lg text-xs font-semibold transition flex items-center space-x-2 cursor-pointer">
              <Upload size={14} />
              <span>Restore Database (.json)</span>
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
        <div className="bg-rose-500/5 rounded-xl border border-rose-500/20 p-6">
          <h3 className="font-semibold text-rose-400 text-sm mb-2 flex items-center space-x-2">
            <AlertTriangle size={18} />
            <span>Danger Zone</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Reset all local databases, saved game analyses, opening lines, and exercise histories.
          </p>
          <button
            onClick={handleClearAllData}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition flex items-center space-x-2"
          >
            <Trash2 size={14} />
            <span>Clear All Local Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
