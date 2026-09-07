import React from 'react';
import { useApp } from '../context/AppContext';
import { useNativeSurface } from '../utils/nativeSurface';
import { isNativeWindow, openExternalUrl } from '../utils/tauriBridge';
import { Star, X, GripHorizontal } from 'lucide-react';
import { GITHUB_REPOSITORY_URL } from '../config/links';

export const SupportModal: React.FC = () => {
  const { isSupportOpen, setIsSupportOpen, settings } = useApp();

  const nativeWindow = isNativeWindow('support');
  const isOpen = nativeWindow ? true : isSupportOpen;
  const { position, size, isDragging, handleHeaderMouseDown, handleResizeMouseDown, modalRef } = useNativeSurface({
    label: 'support',
    isPopup: true,
    defaultWidth: 400,
    defaultHeight: 360,
    minWidth: 300,
    minHeight: 220,
  });

  if (!isOpen) return null;

  const handleGiveStar = () => {
    void openExternalUrl(GITHUB_REPOSITORY_URL);
  };

  return (
    <div
      id="support-overlay"
      className="fixed inset-0 z-50 pointer-events-none w-full h-full"
    >
      <div
        ref={modalRef}
        id="support-modal"
        style={{
          transform: nativeWindow ? 'none' : `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: nativeWindow ? '100%' : 'min(380px, calc(100vw - 24px))',
          height: nativeWindow ? '100%' : undefined,
          maxHeight: nativeWindow ? '100%' : undefined,
          backgroundColor: settings.theme === 'light'
            ? `rgba(255, 255, 255, ${settings.bgOpacity})`
            : `rgba(22, 22, 26, ${settings.bgOpacity})`,
          backdropFilter: `blur(${settings.glassBlur}px)`,
          WebkitBackdropFilter: `blur(${settings.glassBlur}px)`,
        }}
        className={`pointer-events-auto fixed top-0 left-0 border border-amber-500/25 rounded-2xl p-0 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none relative ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
      >
        {/* Draggable Header */}
        <div
          onMouseDown={handleHeaderMouseDown}
          className="relative z-10 flex items-center justify-between px-4 py-3 bg-[#0d0d0e]/70 border-b border-white/[0.08] cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-400">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-mono">
                Support NeuroLog
              </h3>
              <p className="text-[10px] text-amber-400/80 font-mono">Community & Open-Source</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-slate-600 px-1" title="Drag to move panel">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <button
              id="support-close-btn"
              onClick={() => setIsSupportOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative z-10 p-5 flex flex-col gap-4 text-center">
          <div className="relative w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(245,158,11,0.2)]">
            <Star className="w-7 h-7 text-amber-400" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-100 font-sans tracking-tight">
              Enjoying NeuroLog?
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed px-1">
              If NeuroLog helps you anchor your attention and clear mental overload, starring the project on GitHub helps more minds find calm and clarity.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
            {/* Primary GitHub Star Button */}
            <button
              id="support-give-star-btn"
              onClick={handleGiveStar}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-[0.98]"
            >
              <Star className="w-4 h-4 text-neutral-950" />
              <span>Star NeuroLog on GitHub</span>
            </button>

            {/* Subtle Dismiss Button */}
            <button
              id="support-dismiss-btn"
              onClick={() => setIsSupportOpen(false)}
              className="w-full py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
            >
              Maybe later
            </button>
          </div>
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
