import React from 'react';
import { emit } from '@tauri-apps/api/event';
import { CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isNativeWindow } from '../utils/tauriBridge';
import { useNativeSurface } from '../utils/nativeSurface';

export const TimerCompletionModal: React.FC = () => {
  const { urgentTimer, timesUpModalOpen, stopUrgentTimer, extendUrgentTimer, settings } = useApp();
  const nativeWindow = isNativeWindow('timer-complete');
  const isOpen = nativeWindow ? Boolean(urgentTimer) : timesUpModalOpen && Boolean(urgentTimer);
  const { handleHeaderMouseDown, isDragging } = useNativeSurface({
    label: 'timer-complete', isPopup: true, defaultWidth: 400, defaultHeight: 320, minWidth: 300, minHeight: 280,
  });

  const handleStop = () => {
    if (nativeWindow) {
      void emit('neurolog-timer-complete-action', { action: 'stop' });
    } else {
      stopUrgentTimer(true);
    }
  };

  const handleExtend = (seconds: number) => {
    if (nativeWindow) {
      void emit('neurolog-timer-complete-action', { action: 'extend', seconds });
    } else {
      extendUrgentTimer(seconds);
    }
  };

  if (!isOpen || !urgentTimer) return null;
  return (
    <div id="timer-completion-surface" className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-transparent p-3 pointer-events-none animate-in fade-in duration-200">
      <div id="times-up-modal" className="pointer-events-auto w-full max-w-sm border border-orange-500/40 rounded-2xl p-5 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200" style={{ backgroundColor: settings.theme === 'light' ? `rgba(255, 255, 255, ${settings.bgOpacity})` : `rgba(22, 22, 26, ${settings.bgOpacity})` }}>
        <div onMouseDown={handleHeaderMouseDown} className={`w-full flex flex-col items-center gap-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold tracking-widest text-orange-400 uppercase">TIME'S UP</span>
            <h3 className="text-base font-semibold text-slate-100 mt-1">Did you finish?</h3>
            <p className="text-xs text-slate-300 mt-2 px-3 py-1.5 rounded-xl bg-[#0d0d0e]/80 border border-white/[0.08] max-w-xs break-words">"{urgentTimer.taskTitle}"</p>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
          <button id="times-up-done-btn" onClick={handleStop} className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold transition-all shadow-[0_0_16px_rgba(249,115,22,0.4)] active:scale-95 flex items-center justify-center gap-2 border border-orange-400/40"><CheckCircle2 className="w-4 h-4" />Done! Mark as Finished</button>
          <div className="flex items-center gap-1.5 w-full">
            <button id="extend-1m-btn" onClick={() => handleExtend(60)} className="flex-1 py-1.5 rounded-xl bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] text-xs font-medium border border-white/[0.08] transition-colors">+1 min</button>
            <button id="extend-2m-btn" onClick={() => handleExtend(120)} className="flex-1 py-1.5 rounded-xl bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] text-xs font-medium border border-white/[0.08] transition-colors">+2 min</button>
            <button id="extend-5m-btn" onClick={() => handleExtend(300)} className="flex-1 py-1.5 rounded-xl bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] text-xs font-medium border border-white/[0.08] transition-colors">+5 min</button>
          </div>
        </div>
      </div>
    </div>
  );
};
