import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNativeSurface } from '../utils/nativeSurface';
import { isNativeWindow } from '../utils/tauriBridge';
import { Plus, X, Zap, GripHorizontal } from 'lucide-react';

export const QuickAddModal: React.FC = () => {
  const {
    isQuickAddOpen,
    setIsQuickAddOpen,
    categories,
    addTask,
    startUrgentTask,
    activeCategoryId,
    setActiveCategoryId,
    setIsExpanded,
    closeAllPanels,
    settings,
  } = useApp();

  const [title, setTitle] = useState('');
  const [targetCategory, setTargetCategory] = useState<string>(activeCategoryId || 'cat-study');
  const [targetSubcategory, setTargetSubcategory] = useState<string>('');
  const [urgentDuration, setUrgentDuration] = useState<number>(300); // 5 mins

  const inputRef = useRef<HTMLInputElement>(null);

  const nativeWindow = isNativeWindow('quick-add');
  const isOpen = nativeWindow ? true : isQuickAddOpen;
  const { position, size, isDragging, handleHeaderMouseDown, handleResizeMouseDown, modalRef } = useNativeSurface({
    label: 'quick-add',
    isPopup: true,
    defaultWidth: 380,
    defaultHeight: 460,
    minWidth: 300,
    minHeight: 220,
  });

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTargetCategory(activeCategoryId || categories[0]?.id || 'cat-study');
      setTargetSubcategory('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, activeCategoryId, categories]);

  useEffect(() => {
    if (!nativeWindow) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      cleanup = await win.onFocusChanged(({ payload: focused }) => {
        if (!focused) return;
        setTitle('');
        setTargetCategory(activeCategoryId || categories[0]?.id || 'cat-study');
        setTargetSubcategory('');
        window.setTimeout(() => inputRef.current?.focus(), 40);
      });
    })();
    return () => cleanup?.();
  }, [nativeWindow, activeCategoryId, categories]);

  if (!isOpen) return null;

  const currentCat = categories.find((c) => c.id === targetCategory);
  const isUrgent = currentCat?.name.toLowerCase() === 'urgent';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    if (isUrgent) {
      startUrgentTask(trimmed, urgentDuration);
    } else {
      addTask(targetCategory, trimmed, targetSubcategory || null);
    }

    setActiveCategoryId(targetCategory);
    closeAllPanels();
  };

  return (
    <div
      id="quick-add-overlay"
      className="fixed inset-0 z-50 pointer-events-none w-full h-full"
    >
      <div
        ref={modalRef}
        id="quick-add-modal"
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
        className={`pointer-events-auto fixed top-0 left-0 border border-white/[0.08] rounded-2xl p-0 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none relative ${
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
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-mono">
                Quick Task Capture
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">Capture now, focus later</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-slate-600 px-1" title="Drag to move panel">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <button
              id="quick-add-close-btn"
              onClick={() => setIsQuickAddOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body Form */}
        <form onSubmit={handleSave} autoComplete="off" className="p-4 flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              What do you need to remember?
            </label>
            <input
              ref={inputRef}
              id="quick-add-input"
              type="text"
              autoComplete="off"
              name="neurolog-quick-task"
              placeholder="e.g. Physics Chapter 7 or Idea for audio engine..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[#0d0d0e] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>

          {/* Category selection */}
          <div className="flex flex-col gap-1.5">
            <label className="block text-[11px] font-medium text-slate-400">Category</label>
            <div className="grid grid-cols-3 gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setTargetCategory(c.id);
                    setTargetSubcategory('');
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-medium truncate transition-all text-center ${
                    targetCategory === c.id
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'bg-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] border border-transparent'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subcategory selection if available and not urgent */}
          {!isUrgent && currentCat && currentCat.subcategories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="block text-[11px] font-medium text-slate-400">
                Subcategory (optional)
              </label>
              <select
                id="quick-add-subcategory"
                value={targetSubcategory}
                onChange={(e) => setTargetSubcategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-[#0d0d0e] border border-white/[0.08] text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">(Root Category)</option>
                {currentCat.subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Urgent duration selector if Urgent category is picked */}
          {isUrgent && (
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-[#0d0d0e]/80 border border-white/[0.06]">
              <label className="block text-[11px] font-medium text-slate-400">
                Urgent Duration
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: '2 min', val: 120 },
                  { label: '5 min', val: 300 },
                  { label: '10 min', val: 600 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setUrgentDuration(item.val)}
                    className={`py-1 rounded-lg text-xs font-medium transition-all ${
                      urgentDuration === item.val
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : 'bg-white/[0.05] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            id="quick-add-save-btn"
            type="submit"
            disabled={!title.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] active:scale-[0.98] mt-1 border border-blue-400/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isUrgent ? 'Start Urgent Intention' : 'Capture & Save'}</span>
          </button>
        </form>
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
