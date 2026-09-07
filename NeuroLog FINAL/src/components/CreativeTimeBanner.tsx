import React from 'react';
import { useApp } from '../context/AppContext';
import { Lightbulb, AlertCircle, Clock, Check } from 'lucide-react';

export const CreativeTimeBanner: React.FC = () => {
  const {
    creativeStatus,
    creativeWrapUpModalOpen,
    setCreativeWrapUpModalOpen,
  } = useApp();

  if (!creativeStatus?.isActive && !creativeWrapUpModalOpen) return null;

  return (
    <>
      {/* Subdued in-app status banner when Creative Time is running */}
      {creativeStatus?.isActive && (
        <div
          id="creative-active-banner"
          className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs shadow-sm mb-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-mono font-semibold tracking-wider text-[11px]">
              CREATIVE TIME ACTIVE
            </span>
            <span className="text-amber-400/50">·</span>
            <span className="text-amber-200/80 text-[11px]">{creativeStatus.scheduleLabel}</span>
          </div>
          <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
            {creativeStatus.timeRemainingMinutes}m left
          </span>
        </div>
      )}

      {/* End / Wrap-Up Warning Dialog */}
      {creativeWrapUpModalOpen && (
        <div
          id="creative-wrapup-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
        >
          <div
            id="creative-wrapup-modal"
            className="w-full max-w-sm bg-[#16161a]/95 border border-amber-500/30 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-100">Creative Time Wrapping Up</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Creative time is over. Wrap up what you're doing and save your inspirations.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                id="creative-extend-10m"
                onClick={() => setCreativeWrapUpModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors border border-white/[0.08]"
              >
                <Clock className="w-3.5 h-3.5" />
                +10 minutes
              </button>
              <button
                id="creative-end-now"
                onClick={() => setCreativeWrapUpModalOpen(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                End Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
