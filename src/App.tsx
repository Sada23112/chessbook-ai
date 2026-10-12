import React, { useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { AnalysisView } from './components/analysis/AnalysisView';
import { MyGamesView } from './components/mygames/MyGamesView';
import { OpeningBookView } from './components/openings/OpeningBookView';
import { TrainingView } from './components/training/TrainingView';
import { ProgressView } from './components/progress/ProgressView';
import { SettingsView } from './components/settings/SettingsView';
import { useAppStore } from './store/useAppStore';
import { stockfishService } from './engine/stockfishService';

export const App: React.FC = () => {
  const { currentTab, loadSettings } = useAppStore();

  useEffect(() => {
    loadSettings();
    stockfishService.init().catch(console.warn);
  }, [loadSettings]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden bg-background text-slate-100 font-sans pb-[max(3.5rem,calc(env(safe-area-inset-bottom)+3.25rem))] md:pb-0">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden relative">
        {currentTab === 'dashboard' && <DashboardView />}
        {currentTab === 'analysis' && <AnalysisView />}
        {currentTab === 'my-games' && <MyGamesView />}
        {currentTab === 'opening-book' && <OpeningBookView />}
        {currentTab === 'training' && <TrainingView />}
        {currentTab === 'progress' && <ProgressView />}
        {currentTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
};

export default App;
