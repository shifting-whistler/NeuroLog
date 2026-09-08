import React from 'react';
import { useApp } from '../context/AppContext';
import { Clock, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

export const TimerConflictModal: React.FC = () => {
  const {
    activeConflict,
    setActiveConflict,
    urgentTimer,
    stopUrgentTimer,
    startUrgentTask,
  } = useApp();

  if (!activeConflict || !urgentTimer) return null;

  const handleFinishCurrent = () => {
    stopUrgentTimer(true); // Mark current as done
    const { pendingTitle, pendingDuration } = activeConflict;
    setActiveConflict(null);
    startUrgentTask(pendingTitle, pendingDuration);
  };

  const handleCancelCurrent = () => {
    stopUrgentTimer(false); // Cancel current without completing
    const { pendingTitle, pendingDuration } = activeConflict;
    setActiveConflict(null);
    startUrgentTask(pendingTitle, pendingDuration);
  };

  return (
    <div
      id="timer-conflict-overlay"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
    >
      <div
        id="timer-conflict-modal"
        className="w-full max-w-sm bg-[#16161a]/95 border border-white/[0.08] rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-100">Timer Already Running</h3>
            <p className="text-xs text-slate-400 mt-1">
              Active: <span className="text-slate-200 font-medium">"{urgentTimer.taskTitle}"</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              New: <span className="text-blue-300 font-medium">"{activeConflict.pendingTitle}"</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
          <button
            id="conflict-finish-btn"
            onClick={handleFinishCurrent}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Finish current & start new
            </span>
            <span className="font-mono text-[10px] text-blue-400/80">Mark Done</span>
          </button>

          <button
            id="conflict-cancel-btn"
            onClick={handleCancelCurrent}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors border border-white/[0.08]"
          >
            <span className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Cancel current & start new
            </span>
            <span className="font-mono text-[10px] text-slate-500">Discard</span>
          </button>

          <button
            id="conflict-return-btn"
            onClick={() => setActiveConflict(null)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Keep current timer (Return)
          </button>
        </div>
      </div>
    </div>
  );
};
