import React, { useState } from 'react';
import {
  LayoutDashboard,
  SearchCode,
  BookOpen,
  Dumbbell,
  TrendingUp,
  Library,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { useAppStore, type NavTab } from '../../store/useAppStore';

export const Sidebar: React.FC = () => {
  const { currentTab, setTab, isAnalyzing, analysisProgress } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analysis', label: 'Game Analysis', icon: SearchCode },
    { id: 'my-games', label: 'My Games', icon: Library },
    { id: 'opening-book', label: 'Opening Book', icon: BookOpen },
    { id: 'training', label: 'Training', icon: Dumbbell },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-surface border-r border-surface-border transition-all duration-300 z-20 ${
          collapsed ? 'w-18' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-surface-border">
          {!collapsed && (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center text-accent font-bold">
                ♔
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100 text-sm tracking-tight leading-tight">
                  Chessbook AI
                </span>
                <span className="text-[11px] text-accent font-medium leading-none">
                  Personal Coach
                </span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto w-8 h-8 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center text-accent font-bold">
              ♔
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-surface-elevated rounded-md transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-accent/15 text-accent border border-accent/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
                } ${collapsed ? 'justify-center px-0' : 'space-x-3'}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className={isActive ? 'text-accent' : 'text-slate-400'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Engine status pill at footer */}
        <div className="p-3 border-t border-surface-border">
          <div
            className={`flex items-center rounded-lg bg-surface-muted p-2.5 border border-surface-border/50 text-xs ${
              collapsed ? 'justify-center' : 'space-x-2.5'
            }`}
          >
            <Cpu
              size={16}
              className={isAnalyzing ? 'text-accent animate-spin' : 'text-slate-400'}
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-300 truncate">
                  {isAnalyzing ? 'Analyzing Game...' : 'Stockfish Ready'}
                </p>
                {isAnalyzing && (
                  <div className="w-full bg-surface-elevated h-1 rounded-full mt-1 overflow-hidden">
                    <div
                      className="bg-accent h-full transition-all duration-200"
                      style={{
                        width: `${
                          analysisProgress.total > 0
                            ? Math.min(100, Math.round((analysisProgress.current / analysisProgress.total) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                )}
                {!isAnalyzing && (
                  <p className="text-[10px] text-slate-500 truncate">Local Web Worker</p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-surface-border z-40 flex items-center justify-around px-1 py-1"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const shortLabel =
            item.id === 'dashboard'
              ? 'Home'
              : item.id === 'analysis'
              ? 'Analysis'
              : item.id === 'my-games'
              ? 'Games'
              : item.id === 'opening-book'
              ? 'Openings'
              : item.id === 'training'
              ? 'Train'
              : item.id === 'progress'
              ? 'Stats'
              : 'Settings';

          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg font-medium transition min-h-[48px] ${
                isActive
                  ? 'text-accent font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={19} className={isActive ? 'text-accent' : 'text-slate-400'} />
              <span className="mt-0.5 text-[9px] leading-tight truncate">{shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
