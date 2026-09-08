import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  Plus,
  Minimize2,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Zap,
  BookOpen,
  Clock,
  Layers,
  Folder,
  Info,
  Star,
  GripHorizontal,
} from 'lucide-react';
import { TaskItem } from './TaskItem';
import { UrgentTimerView } from './UrgentTimerView';
import { CreativeTimeBanner } from './CreativeTimeBanner';
import { isExpandedWindow, isTauriEnvironment, resizeExpandedNativeWindow, positionExpandedWindowNearPill, startDraggingCurrentWindow, ensureExpandedFitsWorkArea } from '../utils/tauriBridge';

export const ExpandedPanel: React.FC = () => {
  const {
    categories,
    tasks,
    activeCategoryId,
    setActiveCategoryId,
    addCategory,
    renameCategory,
    deleteCategory,
    addSubcategory,
    renameSubcategory,
    deleteSubcategory,
    addTask,
    setIsExpanded,
    setIsSettingsOpen,
    setIsQuickAddOpen,
    setIsAboutOpen,
    setIsSupportOpen,
    settings,
    updateSettings,
  } = useApp();

  const isTauri = isTauriEnvironment();
  const nativeExpanded = isExpandedWindow();
  if (isTauri && !nativeExpanded) return null;
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddingSubcategory, setIsAddingSubcategory] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');

  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set());
  const [isCompletedSectionCollapsed, setIsCompletedSectionCollapsed] = useState(false);

  // Filter visible categories based on settings (e.g. studyHidden)
  const visibleCategories = categories.filter((c) => {
    if (c.id === 'cat-study' && settings.studyHidden) return false;
    return true;
  });

  // Panel size & position state
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>(() => {
    return settings.panelSize || { width: 420, height: 560 };
  });

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (isTauriEnvironment()) {
      return { x: 8, y: 44 };
    }
    const defaultW = settings.panelSize?.width || 420;
    const defaultH = settings.panelSize?.height || 560;
    const anchor = settings.lastPosition || { x: 24, y: 24 };

    const maxX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - defaultW - 16) : 200;
    const maxY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - defaultH - 16) : 200;

    let targetX = anchor.x + 10;
    let targetY = anchor.y + 42;

    if (typeof window !== 'undefined' && targetY > maxY && anchor.y - defaultH - 10 > 16) {
      targetY = anchor.y - defaultH - 10;
    }

    return {
      x: Math.max(16, Math.min(targetX, maxX)),
      y: Math.max(16, Math.min(targetY, maxY)),
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: 420,
    startH: 560,
  });
  const latestPanelSizeRef = useRef(panelSize);
  const resizeFrameRef = useRef<number | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    latestPanelSizeRef.current = panelSize;
  }, [panelSize]);

  // Initial positioning near widget whenever expanded becomes active (browser mode)
  useEffect(() => {
    if (isTauri) return;
    const anchor = settings.lastPosition || { x: 24, y: 24 };
    const curW = panelSize.width;
    const curH = panelSize.height;

    const maxX = Math.max(16, window.innerWidth - curW - 16);
    const maxY = Math.max(16, window.innerHeight - curH - 16);

    let targetX = anchor.x + 10;
    let targetY = anchor.y + 42;

    if (targetY > maxY && anchor.y - curH - 10 > 16) {
      targetY = anchor.y - curH - 10;
    }

    setPosition({
      x: Math.max(16, Math.min(targetX, maxX)),
      y: Math.max(16, Math.min(targetY, maxY)),
    });
  }, [settings.lastPosition, isTauri, panelSize.width, panelSize.height]);

  // Each time the panel opens, start it near the pill. After opening, the
  // panel is freely draggable; only the work-area clamp keeps it visible.
  useEffect(() => {
    if (!nativeExpanded) return;
    void positionExpandedWindowNearPill(panelSize.width, panelSize.height);
  }, [nativeExpanded]);

  useEffect(() => {
    if (!nativeExpanded || !isTauri) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      cleanup = await win.onMoved(() => {
        if (!disposed) void ensureExpandedFitsWorkArea();
      });
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [nativeExpanded, isTauri]);

  useEffect(() => {
    if (!nativeExpanded) return;
    localStorage.setItem('neurolog-expanded-open', 'true');
  }, [nativeExpanded]);

  // Drag the native expanded window from its header.
  const handleHeaderMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [data-no-drag="true"]')) return;

    e.preventDefault();
    e.stopPropagation();

    if (isTauri) {
      setIsDragging(true);
      try {
        await startDraggingCurrentWindow();
      } finally {
        window.setTimeout(() => setIsDragging(false), 120);
      }
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  }, [position, isTauri]);

  useEffect(() => {
    if (isTauri || !isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const maxX = Math.max(8, window.innerWidth - panelSize.width - 8);
      const maxY = Math.max(8, window.innerHeight - panelSize.height - 8);

      const nextX = Math.max(8, Math.min(dragStartRef.current.startX + deltaX, maxX));
      const nextY = Math.max(8, Math.min(dragStartRef.current.startY + deltaY, maxY));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, panelSize, isTauri]);

  // Resizing handler
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: panelSize.width,
      startH: panelSize.height,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      const minW = 340;
      const minH = 400;
      const maxW = isTauri ? 1600 : Math.max(minW, window.innerWidth - position.x - 16);
      const maxH = isTauri ? 1100 : Math.max(minH, window.innerHeight - position.y - 16);
      const nextSize = {
        width: Math.max(minW, Math.min(resizeStartRef.current.startW + deltaX, maxW)),
        height: Math.max(minH, Math.min(resizeStartRef.current.startH + deltaY, maxH)),
      };

      latestPanelSizeRef.current = nextSize;
      setPanelSize(nextSize);

      if (isTauri && resizeFrameRef.current === null) {
        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          const { width, height } = latestPanelSizeRef.current;
          void resizeExpandedNativeWindow(width, height);
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      updateSettings({ panelSize: latestPanelSizeRef.current });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [isResizing, isTauri, position.x, position.y, updateSettings]);

  // Ensure active category is valid among visible categories
  useEffect(() => {
    if (visibleCategories.length > 0 && !visibleCategories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(visibleCategories[0].id);
    }
  }, [visibleCategories, activeCategoryId, setActiveCategoryId]);

  const currentCategory = categories.find((c) => c.id === activeCategoryId) || visibleCategories[0] || categories[0];
  const isTimerCategory = currentCategory?.id === 'cat-urgent' || currentCategory?.name.toLowerCase() === 'timer' || currentCategory?.name.toLowerCase() === 'urgent';
  const isCreativeCategory = currentCategory?.id === 'cat-creative' || currentCategory?.name.toLowerCase() === 'creative';

  // Filter tasks for active category
  const categoryTasks = tasks.filter((t) => t.categoryId === activeCategoryId);
  const rootTasks = categoryTasks.filter((t) => !t.subcategoryId);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    addTask(activeCategoryId, trimmed, selectedSubcategoryId);
    setNewTaskTitle('');
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (trimmed) {
      addCategory(trimmed);
      setNewCatName('');
      setIsAddingCategory(false);
    }
  };

  const handleCreateSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubName.trim();
    if (trimmed) {
      addSubcategory(activeCategoryId, trimmed);
      setNewSubName('');
      setIsAddingSubcategory(false);
    }
  };

  const toggleSubcategoryCollapse = (subId: string) => {
    setCollapsedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const getCategoryIcon = (catName: string) => {
    const name = catName.toLowerCase();
    if (name === 'study') return BookOpen;
    if (name === 'creative') return Lightbulb;
    if (name === 'timer' || name === 'urgent') return Clock;
    return Layers;
  };

  return (
    <div
      ref={panelRef}
      id="neurolog-expanded-panel"
      style={{
        left: isTauri ? 0 : `${position.x}px`,
        top: isTauri ? 0 : `${position.y}px`,
        width: isTauri ? '100%' : `${panelSize.width}px`,
        height: isTauri ? '100%' : `${panelSize.height}px`,
        backgroundColor: settings.theme === 'light'
          ? `rgba(255, 255, 255, ${settings.bgOpacity})`
          : `rgba(22, 22, 26, ${settings.bgOpacity})`,
        backdropFilter: `blur(${settings.glassBlur}px)`,
        WebkitBackdropFilter: `blur(${settings.glassBlur}px)`,
        boxSizing: 'border-box',
      }}
      className={`pointer-events-auto fixed top-0 left-0 z-40 border border-white/[0.08] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-slate-100 flex flex-col overflow-hidden select-none transition-shadow duration-150 relative ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
    >
      {/* Top Header Bar (Draggable) */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="relative z-10 flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-[#0d0d0e]/70 shrink-0 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          <h1 className="font-bold text-xs tracking-tight text-slate-100 font-mono uppercase">
            NeuroLog
          </h1>

          {/* About Button */}
          <button
            id="header-about-btn"
            data-no-drag="true"
            onClick={() => setIsAboutOpen(true)}
            title="About NeuroLog & FAQ"
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-blue-300 border border-white/[0.06] text-[10.5px] font-medium transition-colors ml-1"
          >
            <Info className="w-3 h-3 text-blue-400" />
            <span>About</span>
          </button>

          {/* Support Button */}
          <button
            id="header-support-btn"
            data-no-drag="true"
            onClick={() => setIsSupportOpen(true)}
            title="Support NeuroLog"
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10.5px] font-medium transition-colors"
          >
            <Star className="w-3 h-3 text-amber-400" />
            <span>Support</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Drag Handle Indicator */}
          <div className="text-slate-600 px-0.5 cursor-grab active:cursor-grabbing" title="Drag to move panel">
            <GripHorizontal className="w-3.5 h-3.5" />
          </div>

          {/* Quick Add Button */}
          <button
            id="header-quick-add-btn"
            data-no-drag="true"
            onClick={() => setIsQuickAddOpen(true)}
            title="Quick Capture (Ctrl+Alt+N)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-white/[0.06] transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>

          {/* Settings Button */}
          <button
            id="header-settings-btn"
            data-no-drag="true"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings & Preferences"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Collapse to Pill Button */}
          <button
            id="header-minimize-btn"
            data-no-drag="true"
            onClick={() => setIsExpanded(false)}
            title="Collapse to floating widget"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Tabs Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0d0d0e]/40 border-b border-white/[0.06] overflow-x-auto shrink-0 scrollbar-none">
        {visibleCategories.map((cat) => {
          const Icon = getCategoryIcon(cat.name);
          const isActive = cat.id === activeCategoryId;
          const pendingCount = tasks.filter((t) => t.categoryId === cat.id && !t.completed).length;

          return (
            <div key={cat.id} className="relative group/tab shrink-0">
              {editingCategoryId === cat.id ? (
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  onBlur={() => {
                    if (editCatName.trim()) renameCategory(cat.id, editCatName.trim());
                    setEditingCategoryId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editCatName.trim()) renameCategory(cat.id, editCatName.trim());
                      setEditingCategoryId(null);
                    } else if (e.key === 'Escape') {
                      setEditingCategoryId(null);
                    }
                  }}
                  autoFocus
                  className="px-2 py-1 bg-[#1e1e24] border border-blue-500/60 rounded text-xs text-slate-100 font-medium w-24 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    setSelectedSubcategoryId(null);
                  }}
                  onDoubleClick={() => {
                    // Allow renaming for study category or custom categories
                    setEditingCategoryId(cat.id);
                    setEditCatName(cat.name);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.name}</span>
                  {pendingCount > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded-full ${
                        isActive ? 'bg-blue-500/30 text-blue-200' : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              )}

              {/* Delete custom category button (hover) */}
              {!cat.isDefault && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCategory(cat.id);
                  }}
                  title="Delete category"
                  className="hidden group-hover/tab:flex absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500/80 text-white items-center justify-center text-[9px] hover:bg-rose-600 transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {/* Add Category button & input */}
        {isAddingCategory ? (
          <form onSubmit={handleCreateCategory} className="flex items-center shrink-0">
            <input
              type="text"
              placeholder="Category..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onBlur={() => {
                if (!newCatName.trim()) setIsAddingCategory(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsAddingCategory(false);
              }}
              autoFocus
              className="px-2 py-1 bg-[#1e1e24] border border-blue-500/60 rounded-lg text-xs text-slate-100 placeholder-slate-500 w-24 focus:outline-none"
            />
          </form>
        ) : (
          <button
            id="add-category-tab-btn"
            onClick={() => setIsAddingCategory(true)}
            title="Add new category"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Creative Time active status banner */}
        {isCreativeCategory && <CreativeTimeBanner />}

        {/* TIMER CATEGORY (Special Countdown Intention View) */}
        {isTimerCategory ? (
          <UrgentTimerView />
        ) : (
          /* STANDARD CATEGORIES (Study, Creative, Custom) */
          <>
            {/* Add Task Input Card */}
            <form
              id="add-task-form"
              onSubmit={handleCreateTask}
              className="flex items-center gap-2 p-1.5 rounded-xl bg-[#0d0d0e]/80 border border-white/[0.08] shadow-inner focus-within:border-blue-500/50 transition-colors"
            >
              <input
                ref={inputRef}
                id="add-task-input"
                type="text"
                placeholder={
                  isCreativeCategory
                    ? 'Capture a random thought or idea...'
                    : `Add task to ${currentCategory?.name || 'list'}...`
                }
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="flex-1 px-2.5 py-1 text-xs bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
              />

              {/* Subcategory target dropdown if subcategories exist */}
              {currentCategory && currentCategory.subcategories.length > 0 && (
                <select
                  value={selectedSubcategoryId || ''}
                  onChange={(e) => setSelectedSubcategoryId(e.target.value || null)}
                  className="bg-[#1e1e24] text-slate-400 text-[11px] rounded-lg px-2 py-1 border border-white/[0.08] focus:outline-none focus:text-slate-200"
                >
                  <option value="">(Root)</option>
                  {currentCategory.subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                id="submit-task-btn"
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 transition-all active:scale-95 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </form>

            {/* Subcategory Management Bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                {currentCategory?.name} Tasks
              </span>

              {/* Add Subcategory Trigger */}
              {isAddingSubcategory ? (
                <form onSubmit={handleCreateSubcategory} className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Subcategory..."
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onBlur={() => {
                      if (!newSubName.trim()) setIsAddingSubcategory(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsAddingSubcategory(false);
                    }}
                    autoFocus
                    className="px-2 py-0.5 bg-[#1e1e24] border border-blue-500/50 rounded text-[11px] text-slate-100 w-24 focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  id="add-subcategory-btn"
                  onClick={() => setIsAddingSubcategory(true)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>+ Subcategory</span>
                </button>
              )}
            </div>

            {/* Root Tasks List */}
            {rootTasks.filter((t) => (settings.completedPlacement === 'global' ? !t.completed : true))
              .length > 0 && (
              <div className="space-y-1.5">
                {rootTasks
                  .filter((t) =>
                    settings.completedPlacement === 'global' ? !t.completed : true
                  )
                  .map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
              </div>
            )}

            {/* Subcategories with their respective tasks */}
            {currentCategory?.subcategories.map((sub) => {
              const subTasks = categoryTasks.filter((t) => t.subcategoryId === sub.id);
              const activeSubTasks = subTasks.filter((t) => !t.completed);
              const completedSubTasks = subTasks.filter((t) => t.completed);
              const isCollapsed = collapsedSubcategories.has(sub.id);

              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-white/[0.08] bg-[#0d0d0e]/40 overflow-hidden"
                >
                  {/* Subcategory Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d0e]/60 border-b border-white/[0.06] text-xs">
                    <div
                      onClick={() => toggleSubcategoryCollapse(sub.id)}
                      className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-slate-100 font-medium"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-blue-400/80" />

                      {editingSubId === sub.id ? (
                        <input
                          type="text"
                          value={editSubName}
                          onChange={(e) => setEditSubName(e.target.value)}
                          onBlur={() => {
                            if (editSubName.trim())
                              renameSubcategory(activeCategoryId, sub.id, editSubName.trim());
                            setEditingSubId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editSubName.trim())
                                renameSubcategory(activeCategoryId, sub.id, editSubName.trim());
                              setEditingSubId(null);
                            } else if (e.key === 'Escape') {
                              setEditingSubId(null);
                            }
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="px-1.5 py-0.2 bg-[#1e1e24] border border-blue-500 rounded text-xs text-slate-100 focus:outline-none"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingSubId(sub.id);
                            setEditSubName(sub.name);
                          }}
                        >
                          {sub.name}
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-slate-500">
                        ({activeSubTasks.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingSubId(sub.id);
                          setEditSubName(sub.name);
                        }}
                        title="Rename subcategory"
                        className="text-slate-500 hover:text-slate-300 p-1"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteSubcategory(activeCategoryId, sub.id)}
                        title="Delete subcategory"
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategory Task List */}
                  {!isCollapsed && (
                    <div className="p-2 space-y-1.5">
                      {activeSubTasks.length === 0 && (
                        <div className="text-center py-2 text-[11px] text-slate-600 italic">
                          No active tasks in this section
                        </div>
                      )}
                      {activeSubTasks.map((t) => (
                        <TaskItem key={t.id} task={t} />
                      ))}

                      {/* Completed tasks under subcategory (OPTION 2: Per-Subcategory) */}
                      {settings.completedPlacement === 'subcategories' &&
                        completedSubTasks.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block px-1">
                              Completed ({completedSubTasks.length})
                            </span>
                            {completedSubTasks.map((t) => (
                              <TaskItem key={t.id} task={t} />
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Empty category placeholder */}
            {categoryTasks.length === 0 && currentCategory?.subcategories.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-slate-400">
                  <Layers className="w-4 h-4" />
                </div>
                <span>No tasks yet. Capture your first thought above!</span>
              </div>
            )}

            {/* Global Completed Section */}
            {settings.completedPlacement === 'global' &&
              categoryTasks.filter((t) => t.completed).length > 0 && (
                <div className="pt-3 border-t border-white/[0.08] space-y-2">
                  <button
                    onClick={() => setIsCompletedSectionCollapsed(!isCompletedSectionCollapsed)}
                    className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors px-1"
                  >
                    <span className="flex items-center gap-1.5">
                      {isCompletedSectionCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      Completed (
                      {categoryTasks.filter((t) => t.completed).length})
                    </span>
                  </button>

                  {!isCompletedSectionCollapsed && (
                    <div className="space-y-1.5 animate-in fade-in duration-100">
                      {categoryTasks
                        .filter((t) => t.completed)
                        .map((task) => (
                          <TaskItem key={task.id} task={task} />
                        ))}
                    </div>
                  )}
                </div>
              )}
          </>
        )}
      </div>

      {/* Panel Footer with requested Tagline */}
      <div className="px-4 py-2 bg-[#0d0d0e]/70 border-t border-white/[0.06] text-[10px] font-mono text-slate-400 flex items-center justify-between shrink-0">
        <span className="text-slate-300 font-semibold">Idea? → Dump → Focus</span>
        <span className="text-slate-500">{categoryTasks.filter((t) => !t.completed).length} pending</span>
      </div>

      {/* Resize Handle (Bottom-Right Corner) */}
      <div
        onMouseDown={handleResizeMouseDown}
        onClick={(e) => e.stopPropagation()}
        data-no-drag="true"
        role="separator"
        aria-label="Resize NeuroLog panel"
        title="Drag to resize panel"
        className="absolute right-1 bottom-1 w-9 h-9 cursor-se-resize flex items-end justify-end p-1.5 text-slate-400 hover:text-blue-400 transition-colors z-[1000] select-none rounded-tl-xl bg-black/20 hover:bg-blue-500/10"
      >
        <svg viewBox="0 0 14 14" className="w-6 h-6 fill-current opacity-100 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="12" cy="8" r="1.2" />
          <circle cx="12" cy="4" r="1.2" />
          <circle cx="8" cy="12" r="1.2" />
          <circle cx="4" cy="12" r="1.2" />
        </svg>
      </div>
    </div>
  );
};

