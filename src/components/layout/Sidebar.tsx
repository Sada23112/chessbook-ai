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
  Swords,
  Puzzle,
} from 'lucide-react';
import { useAppStore, type NavTab } from '../../store/useAppStore';

export const Sidebar: React.FC = () => {
  const { currentTab, setTab, isAnalyzing, analysisProgress, settings } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const username = settings?.playerUsernames?.chessCom || 'Sada012';

  const navItems: Array<{ id: NavTab; label: string; icon: React.ElementType; badge?: string }> = [
    { id: 'dashboard', label: 'Play', icon: Swords },
    { id: 'analysis', label: 'Game Review', icon: SearchCode, badge: 'New' },
    { id: 'my-games', label: 'Archive', icon: Library },
    { id: 'opening-book', label: 'Openings', icon: BookOpen },
    { id: 'training', label: 'Puzzles', icon: Puzzle },
    { id: 'progress', label: 'Stats', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-[#262421] border-r border-[#383531] transition-all duration-200 z-20 select-none ${
          collapsed ? 'w-[68px]' : 'w-[210px]'
        }`}
      >
        {/* Chess.com Brand Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-[#383531]">
          {!collapsed ? (
            <div
              onClick={() => setTab('dashboard')}
              className="flex items-center gap-2 cursor-pointer overflow-hidden py-1"
            >
              {/* Chess.com Green Pawn Logo */}
              <div className="w-7 h-7 rounded-[6px] bg-[#81b64c] flex items-center justify-center text-white font-black shadow-sm shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.34.66 2.53 1.67 3.25-.43.5-.83 1.13-1.07 1.87-.2.62-.27 1.36-.2 2.13.25 2.62 1.6 3.75 1.6 3.75v1H7v3h10v-3h-3v-1s1.35-1.13 1.6-3.75c.07-.77 0-1.51-.2-2.13-.24-.74-.64-1.37-1.07-1.87A3.99 3.99 0 0 0 16 6a4 4 0 0 0-4-4z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-[#ffffff] text-[15px] tracking-tight leading-none font-sans">
                  chess<span className="text-[#81b64c]">.com</span>
                </span>
                <span className="text-[10px] text-[#989795] font-semibold tracking-wider uppercase mt-0.5">
                  Review & Coach
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setTab('dashboard')}
              className="w-8 h-8 mx-auto rounded-[6px] bg-[#81b64c] flex items-center justify-center text-white font-black shadow-sm cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 2a4 4 0 0 0-4 4c0 1.34.66 2.53 1.67 3.25-.43.5-.83 1.13-1.07 1.87-.2.62-.27 1.36-.2 2.13.25 2.62 1.6 3.75 1.6 3.75v1H7v3h10v-3h-3v-1s1.35-1.13 1.6-3.75c.07-.77 0-1.51-.2-2.13-.24-.74-.64-1.37-1.07-1.87A3.99 3.99 0 0 0 16 6a4 4 0 0 0-4-4z" />
              </svg>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-[#8b8987] hover:text-[#ffffff] hover:bg-[#383531] rounded transition shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center rounded-[6px] py-2.5 px-3 text-[13px] font-bold transition-colors ${
                  isActive
                    ? 'bg-[#383531] text-[#ffffff] border-l-[3.5px] border-[#81b64c]'
                    : 'text-[#c3c2bf] hover:text-[#ffffff] hover:bg-[#312e2b]'
                } ${collapsed ? 'justify-center px-0' : 'gap-3'}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  size={19}
                  className={isActive ? 'text-[#81b64c]' : 'text-[#989795]'}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && !isActive && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#81b64c]/20 text-[#81b64c] font-black uppercase tracking-wider">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Engine status at footer */}
        <div className="p-3 border-t border-[#383531] space-y-2">
          {/* User profile capsule */}
          {!collapsed ? (
            <div className="flex items-center gap-2.5 p-1.5 rounded-[6px] bg-[#1f1e1b] border border-[#383531]">
              <div className="w-7 h-7 rounded-[4px] bg-[#81b64c] text-[#ffffff] font-extrabold flex items-center justify-center text-xs shadow-inner">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-white truncate leading-tight">
                  {username}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold text-[#e58f2a] font-mono leading-none">
                    1540
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#81b64c]" title="Online" />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-8 h-8 mx-auto rounded-[4px] bg-[#81b64c] text-[#ffffff] font-bold flex items-center justify-center text-xs"
              title={username}
            >
              {username.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Engine status indicator */}
          {isAnalyzing ? (
            <div className={`flex items-center gap-2 text-xs pt-1 ${collapsed ? 'justify-center' : ''}`}>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#81b64c] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#81b64c]" />
              </span>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[#81b64c] font-bold truncate text-[11px]">Analyzing…</p>
                  <div className="w-full bg-[#3d3a34] h-1 rounded-full mt-1 overflow-hidden">
                    <div
                      className="bg-[#81b64c] h-full transition-all duration-150"
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
            <div className={`flex items-center gap-2 text-xs pt-1 ${collapsed ? 'justify-center' : ''}`}>
              <Cpu size={14} className="text-[#8b8987] shrink-0" />
              {!collapsed && (
                <span className="text-[#8b8987] text-[11px] font-medium truncate">
                  Stockfish 10 Active
                </span>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#262421]/95 backdrop-blur-md border-t border-[#383531] z-40 flex items-center justify-around px-1 py-1"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition min-h-[48px] ${
                isActive ? 'text-[#81b64c]' : 'text-[#989795] hover:text-[#ffffff]'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.4 : 1.9} />
              <span className="mt-0.5 text-[9px] leading-tight truncate font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
