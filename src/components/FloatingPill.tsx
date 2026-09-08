import React, { useEffect, useRef, useState } from 'react';
import { formatDurationHMS } from '../utils/time';
import { useApp } from '../context/AppContext';
import {
  Clock,
  EyeOff,
  Lightbulb,
  Move,
  BookOpen,
  Timer,
  Zap,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { QuickActionKey } from '../types';
import { ensurePillFitsWorkArea, fitPillToContent, getPillScreenPosition, isTauriEnvironment, positionCurrentNativeWindow, setNativeClickThrough, setNativeClickThroughControl } from '../utils/tauriBridge';

export const FloatingPill: React.FC = () => {
  const {
    urgentTimer,
    remainingTimerSeconds,
    creativeStatus,
    isClickThrough,
    toggleClickThrough,
    settings,
    updateSettings,
    isExpanded,
    setIsExpanded,
    activeCategoryId,
    setActiveCategoryId,
    setIsQuickAddOpen,
    setIsStopwatchOpen,
    stopwatchState,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    tasks,
  } = useApp();

  const isTauri = isTauriEnvironment();
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (isTauriEnvironment()) {
      return { x: 8, y: 8 };
    }
    return settings.lastPosition || { x: 24, y: 24 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const hasMovedRef = useRef(false);
  const lastDragEndTimeRef = useRef(0);
  const positionRef = useRef(position);
  positionRef.current = position;

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 24,
    startY: 24,
  });

  // Live stopwatch time tracking on the floating pill
  const [stopwatchMs, setStopwatchMs] = useState<number>(() => stopwatchState.accumulatedMs);

  useEffect(() => {
    let animId: number;

    const updateTime = () => {
      if (stopwatchState.isRunning && stopwatchState.startTime !== null) {
        const elapsed = stopwatchState.accumulatedMs + (Date.now() - stopwatchState.startTime);
        setStopwatchMs(elapsed);
        animId = requestAnimationFrame(updateTime);
      } else {
        setStopwatchMs(stopwatchState.accumulatedMs);
      }
    };

    if (stopwatchState.isRunning) {
      animId = requestAnimationFrame(updateTime);
    } else {
      setStopwatchMs(stopwatchState.accumulatedMs);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [stopwatchState.isRunning, stopwatchState.startTime, stopwatchState.accumulatedMs]);

  // Sync position from settings on mount or reset (for browser mode)
  useEffect(() => {
    if (!isTauri && settings.lastPosition) {
      setPosition(settings.lastPosition);
    }
  }, [settings.lastPosition, isTauri]);

  useEffect(() => {
    if (!isTauri || !settings.rememberPosition || !settings.lastPosition) return;
    void positionCurrentNativeWindow(settings.lastPosition.x, settings.lastPosition.y);
  }, []);

  // Native pill position follows the OS window. Persist it after native moves so
  // the existing Remember Position setting continues to work across launches.
  useEffect(() => {
    if (!isTauri) return;
    let cleanup: (() => void) | undefined;
    let saveTimer: number | undefined;
    let disposed = false;
    (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      cleanup = await win.onMoved(() => {
        if (disposed) return;
        // Keep the pill inside the usable desktop work area. This intentionally
        // excludes the taskbar so native dragging simply stops at its border.
        void ensurePillFitsWorkArea();
        if (!settings.rememberPosition) return;
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(async () => {
          const pos = await getPillScreenPosition();
          if (!disposed && pos) updateSettings({ lastPosition: { x: pos.x, y: pos.y } });
        }, 140);
      });
    })();
    return () => { disposed = true; window.clearTimeout(saveTimer); cleanup?.(); };
  }, [isTauri, settings.rememberPosition, updateSettings]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click and when not in click-through mode
    if (e.button !== 0 || isClickThrough) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [data-no-drag="true"]')) {
      return;
    }

    // In Tauri, the dedicated [data-tauri-drag-region] handle performs the
    // native drag. Do not also call startDragging() here; doing both causes
    // competing drag paths and visible lag.
    if (isTauri) return;

    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: positionRef.current.x,
      startY: positionRef.current.y,
    };
  };

  useEffect(() => {
    if (isTauri || !isDragging) return;

    let currentX = positionRef.current.x;
    let currentY = positionRef.current.y;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasMovedRef.current = true;
      }

      // Safe browser viewport boundary clamping
      const maxX = Math.max(10, window.innerWidth - 180);
      const maxY = Math.max(10, window.innerHeight - 50);

      currentX = Math.min(Math.max(8, dragStartRef.current.startX + deltaX), maxX);
      currentY = Math.min(Math.max(8, dragStartRef.current.startY + deltaY), maxY);

      setPosition({ x: currentX, y: currentY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (hasMovedRef.current) {
        lastDragEndTimeRef.current = Date.now();
        if (settings.rememberPosition) {
          updateSettings({ lastPosition: { x: currentX, y: currentY } });
        }
      }
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isTauri, settings.rememberPosition, updateSettings]);

  useEffect(() => {
    if (!isTauri) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'neurolog-expanded-open' && event.newValue === 'false') {
        setIsExpanded(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isTauri, setIsExpanded]);

  // Format seconds to HH:MM:SS
  const formatTime = formatDurationHMS;

  // Format stopwatch milliseconds to mm:ss.t or hh:mm:ss
  const formatStopwatchTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
  };

  const isStopwatchActive = stopwatchState.isRunning || stopwatchState.accumulatedMs > 0;
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const currentOpacity = isClickThrough ? settings.clickThroughOpacity : settings.widgetOpacity;

  // Handle clicking task-name / timer area / pill body: reliable immediate single-click toggle
  const handlePillClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea')) {
      return;
    }

    // Ignore synthetic click right after finishing a drag
    if (hasMovedRef.current || Date.now() - lastDragEndTimeRef.current < 200) {
      return;
    }

    setIsExpanded((prev) => !prev);
  };

  // Quick Action execution
  const handleQuickAction = (key: QuickActionKey, e: React.MouseEvent) => {
    e.stopPropagation();
    switch (key) {
      case 'study':
      case 'creative':
      case 'urgent':
      case 'timer': {
        const categoryId = key === 'study'
          ? 'cat-study'
          : key === 'creative'
          ? 'cat-creative'
          : 'cat-urgent';
        // Clicking the currently displayed quick category toggles the panel.
        // Clicking a different category while the panel is open switches tabs
        // without closing it.
        if (isExpanded && activeCategoryId === categoryId) {
          setIsExpanded(false);
        } else {
          setActiveCategoryId(categoryId);
          setIsExpanded(true);
        }
        break;
      }
      case 'stopwatch':
        setIsStopwatchOpen((prev) => !prev);
        break;
      case 'quick_add':
        setIsQuickAddOpen((prev) => !prev);
        break;
      case 'click_through':
        toggleClickThrough();
        break;
    }
  };

  const enabledActions = settings.enabledQuickActions || ['study', 'creative', 'urgent', 'stopwatch', 'quick_add'];
  const hasClickThroughQuickAction = enabledActions.includes('click_through');

  // Keep the pill itself visually intact. When click-through mode is active,
  // the native pill ignores all mouse input and a tiny separate native window is
  // placed exactly over the click-through icon so that only that icon remains interactive.
  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let raf = 0;
    const isCurrent = () => !disposed;

    const applyNativeSurfaceState = async () => {
      await fitPillToContent();
      if (disposed) return;

      if (isClickThrough) {
        const button = document.getElementById('floating-quick-click-through');
        const indicator = document.getElementById('floating-click-through-indicator');
        const root = document.getElementById('neurolog-floating-pill');
        const target = button || indicator;

        if (target && root && (hasClickThroughQuickAction || settings.showClickThroughIndicator)) {
          const targetRect = target.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          await setNativeClickThroughControl(true, {
            x: Math.max(0, targetRect.left - rootRect.left),
            y: Math.max(0, targetRect.top - rootRect.top),
            width: Math.max(1, targetRect.width),
            height: Math.max(1, targetRect.height),
          });
        } else {
          if (!isCurrent()) return;
          await setNativeClickThroughControl(false);
        }
        if (!isCurrent()) return;
        await setNativeClickThrough(true);
        return;
      }

      if (!isCurrent()) return;
      await setNativeClickThrough(false);
      if (!isCurrent()) return;
      await setNativeClickThroughControl(false);
    };

    raf = requestAnimationFrame(() => { void applyNativeSurfaceState(); });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [
    isTauri,
    isClickThrough,
    hasClickThroughQuickAction,
    settings.showClickThroughIndicator,
    settings.pillScale,
    settings.enabledQuickActions,
    urgentTimer?.taskTitle,
    stopwatchState.isRunning,
    stopwatchState.accumulatedMs,
    remainingTimerSeconds,
    pendingTasksCount,
    settings.lastPosition?.x,
    settings.lastPosition?.y,
  ]);

  return (
    <div
      id="neurolog-floating-pill"
      style={{
        left: `${isTauri ? 0 : position.x}px`,
        top: `${isTauri ? 0 : position.y}px`,
        transform: `scale(${settings.pillScale || 1.0})`,
        transformOrigin: 'top left',
        opacity: currentOpacity,
        pointerEvents: 'auto',
        width: 'max-content',
        height: 'max-content',
      }}
      className={`fixed top-0 left-0 z-50 transition-opacity duration-200 select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-default'
      }`}
    >
      <div
        onClick={handlePillClick}
        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16161a]/95 border shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all overflow-hidden cursor-pointer ${
          isExpanded
            ? 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-[#16161a]'
            : isStopwatchActive
            ? 'border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)] bg-[#16161a]'
            : 'border-white/[0.08] hover:border-blue-500/40 hover:bg-[#16161a]'
        }`}
      >
        {/* Drag handle icon */}
        <div
          data-tauri-drag-region
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
          title="Drag to move widget"
          className="relative z-10 text-slate-500 hover:text-slate-300 transition-colors cursor-grab active:cursor-grabbing p-0.5 shrink-0"
        >
          <Move className="w-3 h-3 opacity-60 group-hover:opacity-100 pointer-events-none" />
        </div>

        {/* Clickable Timer / Task-Name Area */}
        <div
          id="floating-pill-toggle-area"
          title={
            urgentTimer
              ? `Timer: ${urgentTimer.taskTitle} (Click to toggle panel)`
              : isStopwatchActive
              ? `Stopwatch: ${formatStopwatchTime(stopwatchMs)} (Click to toggle panel)`
              : isExpanded
              ? 'Click to collapse'
              : 'Click to open NeuroLog'
          }
          className="relative z-10 flex items-center gap-2 py-0.5 px-1 rounded-lg hover:bg-white/[0.04] transition-colors"
        >
          {/* Active Timer State */}
          {urgentTimer ? (
            <div className="flex items-center gap-1.5 font-mono text-xs text-orange-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
              </span>
              <span className="font-semibold tracking-wider text-orange-300">{formatTime(remainingTimerSeconds)}</span>
              <span className="text-slate-600 font-sans">·</span>
              <span className="text-slate-200 font-sans font-medium max-w-[130px] truncate">
                {urgentTimer.taskTitle}
              </span>
            </div>
          ) : isStopwatchActive ? (
            /* Active Stopwatch State - Displays live stopwatch time and inline Start/Pause & Reset buttons */
            <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-300">
              <Timer className={`w-3.5 h-3.5 ${stopwatchState.isRunning ? 'animate-pulse text-cyan-400' : 'text-slate-400'}`} />
              <span className="font-bold tracking-wider text-cyan-200 text-[12.5px]">
                {formatStopwatchTime(stopwatchMs)}
              </span>

              {/* Start/Pause Toggle Button */}
              <button
                type="button"
                id="floating-pill-stopwatch-toggle-btn"
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  if (stopwatchState.isRunning) {
                    pauseStopwatch();
                  } else {
                    startStopwatch();
                  }
                }}
                title={stopwatchState.isRunning ? "Pause Stopwatch" : "Start / Resume Stopwatch"}
                className={`p-1 rounded-md transition-all active:scale-95 flex items-center justify-center ${
                  stopwatchState.isRunning
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                }`}
              >
                {stopwatchState.isRunning ? (
                  <Pause className="w-2.5 h-2.5 fill-current" />
                ) : (
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                )}
              </button>

              {/* Reset Button beside Start/Pause */}
              <button
                type="button"
                id="floating-pill-stopwatch-reset-btn"
                data-no-drag="true"
                onClick={(e) => {
                  e.stopPropagation();
                  resetStopwatch();
                }}
                title="Reset Stopwatch (00:00:00)"
                className="p-1 rounded-md transition-all active:scale-95 flex items-center justify-center bg-white/[0.06] text-slate-300 hover:text-rose-300 hover:bg-rose-500/20 border border-white/[0.08]"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : creativeStatus?.isActive ? (
            /* Creative Time Active State */
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
              <Lightbulb className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              <span className="text-amber-300 font-mono text-[11px] uppercase tracking-wider">CREATIVE</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 text-[11px]">{pendingTasksCount}</span>
            </div>
          ) : (
            /* Default Minimalist Collapsed State */
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  isExpanded
                    ? 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,1)] scale-110'
                    : 'bg-blue-500 group-hover:bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]'
                }`}
              />
              <span className="font-semibold text-slate-100 tracking-tight text-[12.5px]">NeuroLog</span>
              {pendingTasksCount > 0 && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                  {pendingTasksCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Customizable Quick Action Icons on Floating Bar */}
        {enabledActions.length > 0 && (
          <div
            data-no-drag="true"
            className="relative z-10 flex items-center gap-0.5 pl-1 border-l border-white/[0.08]"
          >
            {enabledActions.includes('study') && (
              <button
                type="button"
                id="floating-quick-study"
                onClick={(e) => handleQuickAction('study', e)}
                title="Study Tasks"
                className="p-1 rounded-full text-slate-400 hover:text-blue-400 hover:bg-white/[0.08] transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}

            {enabledActions.includes('creative') && (
              <button
                type="button"
                id="floating-quick-creative"
                onClick={(e) => handleQuickAction('creative', e)}
                title="Creative Ideas"
                className="p-1 rounded-full text-slate-400 hover:text-amber-400 hover:bg-white/[0.08] transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5" />
              </button>
            )}

            {(enabledActions.includes('urgent') || enabledActions.includes('timer')) && (
              <button
                type="button"
                id="floating-quick-urgent"
                onClick={(e) => handleQuickAction('timer', e)}
                title="Task Timer"
                className="p-1 rounded-full text-slate-400 hover:text-orange-400 hover:bg-white/[0.08] transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            )}

            {enabledActions.includes('stopwatch') && (
              <button
                type="button"
                id="floating-quick-stopwatch"
                onClick={(e) => handleQuickAction('stopwatch', e)}
                title={stopwatchState.isRunning ? 'Stopwatch (Running)' : 'Open Stopwatch'}
                className={`p-1 rounded-full transition-colors relative ${
                  stopwatchState.isRunning
                    ? 'text-cyan-300 bg-cyan-500/20 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : isStopwatchActive
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-slate-400 hover:text-cyan-400 hover:bg-white/[0.08]'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                {stopwatchState.isRunning && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                )}
              </button>
            )}

            {enabledActions.includes('quick_add') && (
              <button
                type="button"
                id="floating-quick-add"
                onClick={(e) => handleQuickAction('quick_add', e)}
                title="Quick Capture Task"
                className="p-1 rounded-full text-slate-400 hover:text-emerald-400 hover:bg-white/[0.08] transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}

            {hasClickThroughQuickAction && (
              <button
                type="button"
                id="floating-quick-click-through"
                data-no-drag="true"
                onClick={(e) => handleQuickAction('click_through', e)}
                title={isClickThrough ? 'Disable Click-Through' : 'Enable Click-Through'}
                style={{ pointerEvents: 'auto', opacity: isClickThrough ? 0 : 1 }}
                className={`p-1 rounded-full transition-colors ${
                  isClickThrough
                    ? 'text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 shadow-[0_0_8px_rgba(59,130,246,0.25)]'
                    : 'text-slate-400 hover:text-blue-400 hover:bg-white/[0.08]'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Click-Through Mode Indicator */}
        {isClickThrough && settings.showClickThroughIndicator && !hasClickThroughQuickAction && (
          <div
            id="floating-click-through-indicator"
            title={`Click-Through Active (${settings.clickThroughShortcut} to restore)`}
            className="flex items-center gap-1 pl-1 text-[10px] text-blue-400 font-mono"
            style={{ opacity: 0 }}
          >
            <EyeOff className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
};
