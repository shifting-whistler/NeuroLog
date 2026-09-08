import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNativeSurface } from '../utils/nativeSurface';
import { isNativeWindow } from '../utils/tauriBridge';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Flag,
  X,
  GripHorizontal,
  Trash2,
} from 'lucide-react';

export const StopwatchModal: React.FC = () => {
  const {
    isStopwatchOpen,
    setIsStopwatchOpen,
    stopwatchState,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    addStopwatchLap,
    clearStopwatchLaps,
    settings,
  } = useApp();

  const [displayMs, setDisplayMs] = useState<number>(0);

  const nativeWindow = isNativeWindow('stopwatch');
  const isOpen = nativeWindow ? true : isStopwatchOpen;
  const { position, size, isDragging, handleHeaderMouseDown, handleResizeMouseDown, modalRef } = useNativeSurface({
    label: 'stopwatch',
    isPopup: true,
    defaultWidth: 360,
    defaultHeight: 460,
    minWidth: 300,
    minHeight: 220,
  });

  // Smooth animation frame loop when running
  useEffect(() => {
    let animId: number;

    const updateTime = () => {
      if (stopwatchState.isRunning && stopwatchState.startTime !== null) {
        const elapsed = stopwatchState.accumulatedMs + (Date.now() - stopwatchState.startTime);
        setDisplayMs(elapsed);
        animId = requestAnimationFrame(updateTime);
      } else {
        setDisplayMs(stopwatchState.accumulatedMs);
      }
    };

    if (stopwatchState.isRunning) {
      animId = requestAnimationFrame(updateTime);
    } else {
      setDisplayMs(stopwatchState.accumulatedMs);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [stopwatchState.isRunning, stopwatchState.startTime, stopwatchState.accumulatedMs]);

  if (!isOpen) return null;

  const formatStopwatch = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return {
        main: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
        sub: `.${pad(centiseconds)}`,
      };
    }
    return {
      main: `${pad(minutes)}:${pad(seconds)}`,
      sub: `.${pad(centiseconds)}`,
    };
  };

  const { main, sub } = formatStopwatch(displayMs);

  return (
    <div
      id="stopwatch-overlay"
      className="fixed inset-0 z-50 pointer-events-none w-full h-full"
    >
      <div
        ref={modalRef}
        id="stopwatch-modal"
        style={{
          transform: nativeWindow ? 'none' : `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: nativeWindow ? '100%' : 'min(360px, calc(100vw - 24px))',
          height: nativeWindow ? '100%' : undefined,
          maxHeight: nativeWindow ? '100%' : undefined,
          backgroundColor: settings.theme === 'light'
            ? `rgba(255, 255, 255, ${settings.bgOpacity})`
            : `rgba(22, 22, 26, ${settings.bgOpacity})`,
          backdropFilter: `blur(${settings.glassBlur}px)`,
          WebkitBackdropFilter: `blur(${settings.glassBlur}px)`,
        }}
        className={`pointer-events-auto fixed top-0 left-0 border border-white/[0.08] rounded-2xl p-0 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-slate-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150 select-none relative ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
      >
        {/* Draggable Header */}
        <div
          onMouseDown={handleHeaderMouseDown}
          className="relative z-10 flex items-center justify-between px-4 py-3 bg-[#0d0d0e]/70 border-b border-white/[0.08] cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-blue-500/15 text-blue-400">
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-mono">
                Stopwatch
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Precision timer</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-slate-600 px-1" title="Drag to move panel">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <button
              id="stopwatch-close-btn"
              onClick={() => setIsStopwatchOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stopwatch Display Card */}
        <div className="p-5 flex flex-col items-center justify-center bg-[#0d0d0e]/40 border-b border-white/[0.06]">
          <div className="flex items-baseline font-mono tracking-tight text-slate-100">
            <span className="text-4xl font-bold">{main}</span>
            <span className="text-xl font-medium text-blue-400 w-12 text-left">{sub}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-5">
            {/* Reset Button */}
            <button
              id="stopwatch-reset-btn"
              onClick={resetStopwatch}
              disabled={displayMs === 0 && !stopwatchState.isRunning}
              title="Reset stopwatch"
              className="p-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:hover:bg-white/[0.05] border border-white/[0.08] transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Play / Pause Main Button */}
            <button
              id="stopwatch-toggle-btn"
              onClick={() => {
                if (stopwatchState.isRunning) {
                  pauseStopwatch();
                } else {
                  startStopwatch();
                }
              }}
              className={`p-4 rounded-full text-white font-bold transition-all active:scale-95 shadow-lg ${
                stopwatchState.isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25'
              }`}
            >
              {stopwatchState.isRunning ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            {/* Lap Button */}
            <button
              id="stopwatch-lap-btn"
              onClick={addStopwatchLap}
              disabled={!stopwatchState.isRunning && displayMs === 0}
              title="Record Lap"
              className="p-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 disabled:hover:bg-white/[0.05] border border-white/[0.08] transition-all active:scale-95"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Laps List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[140px] max-h-[220px]">
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <span>Laps ({stopwatchState.laps.length})</span>
            {stopwatchState.laps.length > 0 && (
              <button
                onClick={clearStopwatchLaps}
                className="text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                title="Clear all recorded laps"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {stopwatchState.laps.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-600 italic">
              No laps recorded yet
            </div>
          ) : (
            <div className="space-y-1">
              {stopwatchState.laps.map((lap, index) => {
                const totalFormatted = formatStopwatch(lap.timeMs);
                const diffFormatted = formatStopwatch(lap.lapDiffMs);
                return (
                  <div
                    key={lap.id}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-xs font-mono"
                  >
                    <span className="text-slate-400 font-medium">Lap {stopwatchState.laps.length - index}</span>
                    <span className="text-slate-500 text-[11px]">+{diffFormatted.main}{diffFormatted.sub}</span>
                    <span className="text-slate-200 font-semibold">{totalFormatted.main}{totalFormatted.sub}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div
          onMouseDown={handleResizeMouseDown}
          title="Drag to resize panel"
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50 flex items-end justify-end p-1 text-slate-500 hover:text-blue-400 select-none"
        >
          <svg viewBox="0 0 8 8" className="w-2.5 h-2.5 fill-current opacity-70">
            <circle cx="7" cy="7" r="1" />
            <circle cx="7" cy="4" r="1" />
            <circle cx="4" cy="7" r="1" />
          </svg>
        </div>
      </div>
    </div>
  );
};
