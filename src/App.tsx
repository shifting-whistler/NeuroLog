import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { FloatingPill } from './components/FloatingPill';
import { ExpandedPanel } from './components/ExpandedPanel';
import { QuickAddModal } from './components/QuickAddModal';
import { SettingsModal } from './components/SettingsModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { TimerConflictModal } from './components/TimerConflictModal';
import { StopwatchModal } from './components/StopwatchModal';
import { AboutModal } from './components/AboutModal';
import { SupportModal } from './components/SupportModal';
import { TimerCompletionModal } from './components/TimerCompletionModal';
import { ClickThroughControl } from './components/ClickThroughControl';
import { Download, Zap, EyeOff } from 'lucide-react';
import { GITHUB_REPOSITORY_URL } from './config/links';
import { getCurrentWindowLabel, openExternalUrl } from './utils/tauriBridge';

const isTauri = typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI__ || (window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

const MainAppContent: React.FC = () => {
  const windowLabel = getCurrentWindowLabel();
  if (isTauri) {
    if (windowLabel === 'expanded') return <><ExpandedPanel /><DeleteConfirmModal /><TimerConflictModal /></>;
    if (windowLabel === 'quick-add') return <><QuickAddModal /><DeleteConfirmModal /><TimerConflictModal /></>;
    if (windowLabel === 'settings') return <SettingsModal />;
    if (windowLabel === 'stopwatch') return <StopwatchModal />;
    if (windowLabel === 'about') return <AboutModal />;
    if (windowLabel === 'support') return <SupportModal />;
    if (windowLabel === 'timer-complete') return <TimerCompletionModal />;
  }

  const {
    isExpanded,
    isClickThrough,
    toggleClickThrough,
    setIsQuickAddOpen,
    settings,
  } = useApp();

  const handleOpenGitHubProject = () => {
    void openExternalUrl(GITHUB_REPOSITORY_URL);
  };

  return (
    <div
      id="neurolog-root-container"
      className={`relative w-screen h-screen overflow-hidden ${
        isTauri
          ? 'bg-transparent pointer-events-none'
          : settings.theme === 'light'
          ? 'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 pointer-events-none'
          : 'bg-neutral-950/80 pointer-events-none'
      } ${settings.theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}
    >
      {/* Top Floating Control / Quick Bar (Desktop Web Preview Helpers - hidden in native Tauri exe) */}
      {!isTauri && (
        <header className="pointer-events-auto absolute top-3 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-2xl glass-panel shadow-xl backdrop-blur-xl text-xs">
          {/* Quick Add Helper */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            title="Quick Capture Task (Ctrl+Alt+N)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 font-medium transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-[11px]">Quick Add</span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({settings.quickAddShortcut})</span>
          </button>

          {/* Click-Through Toggle */}
          <button
            onClick={toggleClickThrough}
            title={`Toggle Click-Through Pass-Through (${settings.clickThroughShortcut})`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-medium transition-all ${
              isClickThrough
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">{isClickThrough ? 'Click-Thru: ON' : 'Click-Thru'}</span>
          </button>

          {/* Download Project ZIP from GitHub */}
          <button
            id="topbar-download-zip-btn"
            onClick={handleOpenGitHubProject}
            title="Download the complete runnable Tauri v2 + Rust + React Windows project from GitHub"
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-[0_0_16px_rgba(59,130,246,0.35)] active:scale-95 border border-blue-400/30"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Download Project ZIP (from GitHub)</span>
          </button>
        </header>
      )}

      {/* Floating Pill (Always visible collapsed widget) */}
      <FloatingPill />

      {/* Expanded Main Notepad Panel (Opens near floating pill, freely draggable and resizable) */}
      {!isTauri && isExpanded && <ExpandedPanel />}

      {/* Ambient background hint (hidden in native Tauri exe) */}
      {!isTauri && (
        <div className="absolute bottom-4 left-6 pointer-events-none select-none text-slate-500 text-xs font-mono flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
          <span>NeuroLog · Drag floating pill anywhere or press {settings.quickAddShortcut} to capture</span>
        </div>
      )}

      {/* Modals & Panels: in Tauri each major surface is its own native window. */}
      {!isTauri && (
        <>
          <QuickAddModal />
          <SettingsModal />
          <StopwatchModal />
          <AboutModal />
          <SupportModal />
          <DeleteConfirmModal />
          <TimerConflictModal />
          <TimerCompletionModal />
        </>
      )}

      {/* Small global overlays remain owned by the browser/native surface that triggered them. */}
      {isTauri && <><DeleteConfirmModal /><TimerConflictModal /></>}
    </div>
  );
};

export default function App() {
  // This tiny overlay is intentionally outside AppProvider: it has no shared state,
  // must never run timer/storage/theme effects, and should remain non-focusable.
  if (isTauri && getCurrentWindowLabel() === 'click-through-control') {
    return <ClickThroughControl />;
  }

  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
