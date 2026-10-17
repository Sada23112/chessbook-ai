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
    <div className="flex-1 flex flex-col overflow-y-auto bg-background">
      <div className="max-w-3xl w-full mx-auto px-5 md:px-8 py-7 md:py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">
            Engine, player accounts, and data management.
          </p>
        </div>

        {backupStatus && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>{backupStatus}</span>
          </div>
        )}

        <div className="space-y-4">
        {/* Engine Settings */}
        <div className="bg-surface rounded-2xl p-6">
          <h3 className="font-medium text-slate-200 text-sm mb-4 flex items-center gap-2">
            <Cpu size={16} className="text-accent" />
            <span>Engine</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 block mb-2">
                Default analysis depth
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'quick', depth: 10, label: 'Quick (10)' },
                  { id: 'standard', depth: 14, label: 'Standard (14)' },
                  { id: 'deep', depth: 18, label: 'Deep (18)' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() =>
                      updateSettings({
                        enginePreset: preset.id as any,
                        engineDepth: preset.depth,
                      })
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition ${
                      settings.engineDepth === preset.depth
                        ? 'bg-accent/15 text-accent font-semibold'
                        : 'bg-surface-elevated text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Show best move arrow</span>
              <input
                type="checkbox"
                checked={settings.showBestMoveArrow}
                onChange={(e) => updateSettings({ showBestMoveArrow: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Show evaluation bar</span>
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
        <div className="bg-surface rounded-2xl p-6">
          <h3 className="font-medium text-slate-200 text-sm mb-4 flex items-center gap-2">
            <User size={16} className="text-accent" />
            <span>Player accounts</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">
                Chess.com username
              </label>
              <input
                type="text"
                value={chessComUser}
                onChange={(e) => setChessComUser(e.target.value)}
                placeholder="e.g. magnuscarlsen"
                className="w-full bg-surface-elevated border-none rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent/40 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">
                Lichess username
              </label>
              <input
                type="text"
                value={lichessUser}
                onChange={(e) => setLichessUser(e.target.value)}
                placeholder="e.g. DrNykterstein"
                className="w-full bg-surface-elevated border-none rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent/40 placeholder-slate-600"
              />
            </div>
          </div>

          <button
            onClick={handleSaveUsernames}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-black font-semibold text-xs rounded-xl transition"
          >
            Save
          </button>
        </div>

        {/* Data Portability */}
        <div className="bg-surface rounded-2xl p-6">
          <h3 className="font-medium text-slate-200 text-sm mb-1.5 flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <span>Data portability</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Everything is stored locally in your browser. Export a backup to move data across devices.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleExportBackup}
              className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-2"
            >
              <Download size={13} />
              <span>Export backup</span>
            </button>

            <label className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer">
              <Upload size={13} />
              <span>Restore backup</span>
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
        <div className="bg-rose-500/5 rounded-2xl p-6">
          <h3 className="font-medium text-rose-400/80 text-sm mb-1.5 flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>Danger zone</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Permanently delete all games, analyses, and training history.
          </p>
          <button
            onClick={handleClearAllData}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-medium transition flex items-center gap-2"
          >
            <Trash2 size={13} />
            <span>Clear all data</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
