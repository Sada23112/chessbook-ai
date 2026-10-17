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
        className={`hidden md:flex flex-col bg-surface border-r border-surface-border/60 transition-all duration-300 z-20 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-surface-border/60">
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden pl-1">
              <span className="text-lg leading-none select-none">♔</span>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100 text-[13px] tracking-tight leading-tight">
                  Chessbook AI
                </span>
                <span className="text-[10px] text-slate-500 font-normal leading-none mt-0.5">
                  Personal Coach
                </span>
              </div>
            </div>
          )}
          {collapsed && (
            <span className="mx-auto text-lg leading-none select-none text-slate-300">♔</span>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-slate-600 hover:text-slate-300 rounded-md transition shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center rounded-lg px-3 py-2 text-sm transition-all ${
                  isActive
                    ? 'bg-surface-elevated text-slate-100 font-medium'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-surface-elevated/60'
                } ${collapsed ? 'justify-center px-0' : 'gap-3'}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  size={17}
                  className={isActive ? 'text-accent' : 'text-slate-500'}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Engine status at footer */}
        <div className="p-3 border-t border-surface-border/60">
          {isAnalyzing ? (
            <div className={`flex items-center gap-2 text-xs ${collapsed ? 'justify-center' : ''}`}>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-accent font-medium truncate text-[11px]">Analyzing…</p>
                  <div className="w-full bg-surface-border h-0.5 rounded-full mt-1 overflow-hidden">
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
                </div>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-2 text-xs ${collapsed ? 'justify-center' : ''}`}>
              <Cpu size={14} className="text-slate-600 shrink-0" />
              {!collapsed && (
                <span className="text-slate-600 text-[11px] truncate">Stockfish ready</span>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-surface-border/60 z-40 flex items-center justify-around px-1 py-1"
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
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition min-h-[48px] ${
                isActive ? 'text-accent' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="mt-0.5 text-[9px] leading-tight truncate font-medium">{shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
