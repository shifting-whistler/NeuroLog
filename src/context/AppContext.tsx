import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alarm, AlarmSoundFile, AppSettings, Category, NeuroLogData, StopwatchState, Task, UrgentTimerState } from '../types';
import { soundManager } from '../utils/audio';
import { clearAllStoredData, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, INITIAL_TASKS, loadStoredData, saveStoredData } from '../utils/storage';
import { getCurrentWindowLabel, getPillScreenPosition, hideAllNativeWindows, hideNativeWindow, isPillWindow, isPopupWindow, isTauriEnvironment, openNativeWindow, positionExpandedWindowNearPill, setNativeGlassEffect, setLaunchOnStartup, syncGlobalShortcuts, WINDOW_LABELS, sendNativeNotification, readAlarmSound } from '../utils/tauriBridge';
import { getAlarmScheduleKey, getDueOccurrence, ALARM_MISSED_GRACE_MS, normalizeAlarm, normalizeAlarmData } from '../utils/alarmScheduler';

const formatAlarmClockTime = (time: string): string => {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

interface AppContextType {
  categories: Category[];
  tasks: Task[];
  activeCategoryId: string;
  urgentTimer: UrgentTimerState | null;
  settings: AppSettings;
  isExpanded: boolean;
  isClickThrough: boolean;
  isQuickAddOpen: boolean;
  isSettingsOpen: boolean;
  isAboutOpen: boolean;
  isSupportOpen: boolean;
  isStopwatchOpen: boolean;
  isAlarmOpen: boolean;
  alarms: Alarm[];
  alarmSounds: AlarmSoundFile[];
  activeAlarm: NeuroLogData['activeAlarm'];
  stopwatchState: StopwatchState;
  timesUpModalOpen: boolean;
  activeConflict: { pendingTitle: string; pendingDuration: number } | null;
  taskToDelete: Task | null;
  creativeStatus: { isActive: boolean; scheduleLabel: string; isEndingSoon: boolean; timeRemainingMinutes: number } | null;
  creativeWrapUpModalOpen: boolean;
  remainingTimerSeconds: number;

  // Actions
  setActiveCategoryId: (id: string) => void;
  setIsExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  setIsQuickAddOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsAboutOpen: (open: boolean) => void;
  setIsSupportOpen: (open: boolean) => void;
  setIsStopwatchOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsAlarmOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setTimesUpModalOpen: (open: boolean) => void;
  setActiveConflict: (conflict: { pendingTitle: string; pendingDuration: number } | null) => void;
  setTaskToDelete: (task: Task | null) => void;
  setCreativeWrapUpModalOpen: (open: boolean) => void;

  toggleClickThrough: () => void;
  closeAllPanels: () => void;
  addCategory: (name: string) => void;
  renameCategory: (id: string, newName: string) => void;
  deleteCategory: (id: string) => void;
  addSubcategory: (categoryId: string, name: string) => void;
  renameSubcategory: (categoryId: string, subId: string, newName: string) => void;
  deleteSubcategory: (categoryId: string, subId: string) => void;

  addTask: (categoryId: string, title: string, subcategoryId?: string | null) => Task;
  toggleTaskCompletion: (taskId: string) => void;
  renameTask: (taskId: string, newTitle: string) => void;
  confirmDeleteTask: (task: Task) => void;
  executeDeleteTask: (taskId: string, dontAskAgain?: boolean) => void;

  startUrgentTask: (title: string, durationSeconds: number) => void;
  pauseUrgentTimer: () => void;
  resumeUrgentTimer: () => void;
  stopUrgentTimer: (markDone?: boolean) => void;
  extendUrgentTimer: (additionalSeconds: number) => void;

  // Stopwatch actions
  startStopwatch: () => void;
  pauseStopwatch: () => void;
  resetStopwatch: () => void;
  addStopwatchLap: () => void;
  clearStopwatchLaps: () => void;

  // Alarm actions
  addAlarm: (alarm: Alarm) => boolean;
  updateAlarm: (alarmId: string, updates: Partial<Alarm>) => boolean;
  deleteAlarm: (alarmId: string) => void;
  addAlarmSound: (sound: AlarmSoundFile) => void;
  deleteAlarmSound: (soundId: string) => void;
  toggleAlarm: (alarmId: string) => void;
  dismissAlarm: () => void;
  snoozeAlarm: (minutes?: number) => void;

  updateSettings: (updated: Partial<AppSettings>) => void;
  resetSettings: () => void;
  factoryReset: () => void;
  importAppData: (data: NeuroLogData) => void;
  getExportData: () => NeuroLogData;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentWindowLabel = getCurrentWindowLabel();
  const [data, setData] = useState<NeuroLogData>(() => loadStoredData());
  const [activeCategoryId, setActiveCategoryIdState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('neurolog-active-category-id');
      if (stored && data.categories.some((category) => category.id === stored)) return stored;
    } catch {
      // Ignore storage access failures.
    }
    return data.categories[0]?.id || 'cat-study';
  });

  // Category selection is shared by the pill and expanded native windows.
  // Persisting this tiny piece of UI state lets the other WebView window pick
  // up the same category without coupling their React state.
  const setActiveCategoryId = (id: string) => {
    setActiveCategoryIdState(id);
    try {
      localStorage.setItem('neurolog-active-category-id', id);
    } catch {
      // Ignore storage failures; the local window remains usable.
    }
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'neurolog-active-category-id' || !event.newValue) return;
      setActiveCategoryIdState(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isClickThrough, setIsClickThrough] = useState<boolean>(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isStopwatchOpen, setIsStopwatchOpen] = useState<boolean>(false);
  const [isAlarmOpen, setIsAlarmOpen] = useState<boolean>(false);

  const isExpandedRef = useRef(false);
  const isQuickAddOpenRef = useRef(false);
  const isSettingsOpenRef = useRef(false);
  const isAboutOpenRef = useRef(false);
  const isSupportOpenRef = useRef(false);
  const isStopwatchOpenRef = useRef(false);
  const isAlarmOpenRef = useRef(false);
  const isClickThroughRef = useRef(false);
  const expandedSetterRef = useRef<((open: boolean | ((prev: boolean) => boolean)) => void) | undefined>(undefined);
  const settingsSetterRef = useRef<((open: boolean | ((prev: boolean) => boolean)) => void) | undefined>(undefined);
  const stopUrgentTimerRef = useRef<((markDone?: boolean) => void) | undefined>(undefined);
  const extendUrgentTimerRef = useRef<((additionalSeconds: number) => void) | undefined>(undefined);
  const alarmSoundKeyRef = useRef<string | null>(null);
  const alarmTriggerInFlightRef = useRef(false);
  const alarmPopupShownRef = useRef(false);
  const alarmDeliveryGenerationRef = useRef(0);
  const startAlarmSoundRef = useRef<(alarm: Alarm, generation?: number) => Promise<void>>(async () => undefined);
  const dismissAlarmRef = useRef<(() => void) | undefined>(undefined);
  const snoozeAlarmRef = useRef<((minutes?: number) => void) | undefined>(undefined);
  const shortcutSyncChainRef = useRef<Promise<void>>(Promise.resolve());
  const shortcutGenerationRef = useRef(0);
  const dataSaveTimerRef = useRef<number | undefined>(undefined);

  isExpandedRef.current = isExpanded;
  isQuickAddOpenRef.current = isQuickAddOpen;
  isSettingsOpenRef.current = isSettingsOpen;
  isAboutOpenRef.current = isAboutOpen;
  isSupportOpenRef.current = isSupportOpen;
  isStopwatchOpenRef.current = isStopwatchOpen;
  isAlarmOpenRef.current = isAlarmOpen;
  isClickThroughRef.current = isClickThrough;

  const [stopwatchState, setStopwatchState] = useState<StopwatchState>({
    isRunning: false,
    startTime: null,
    accumulatedMs: 0,
    laps: [],
  });

  // Stopwatch state is shared between native windows through localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('neurolog-stopwatch-state');
      if (raw) setStopwatchState(JSON.parse(raw) as StopwatchState);
    } catch {
      // Keep defaults on malformed storage.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('neurolog-stopwatch-state', JSON.stringify(stopwatchState));
    } catch {
      // Ignore storage failures; runtime state remains usable.
    }
  }, [stopwatchState]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'neurolog-stopwatch-state' || !event.newValue) return;
      try {
        setStopwatchState(JSON.parse(event.newValue) as StopwatchState);
      } catch {
        // Ignore malformed external state.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const [timesUpModalOpen, setTimesUpModalOpen] = useState<boolean>(false);
  const [creativeWrapUpModalOpen, setCreativeWrapUpModalOpen] = useState<boolean>(false);
  const [activeConflict, setActiveConflict] = useState<{ pendingTitle: string; pendingDuration: number } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const [remainingTimerSeconds, setRemainingTimerSeconds] = useState<number>(0);
  const [creativeStatus, setCreativeStatus] = useState<{
    isActive: boolean;
    scheduleLabel: string;
    isEndingSoon: boolean;
    timeRemainingMinutes: number;
  } | null>(null);

  const notifiedStartRef = useRef<Set<string>>(new Set());
  const notifiedEndRef = useRef<Set<string>>(new Set());
  const timerFinishedRef = useRef<boolean>(false);

  // Persist state on a short debounce. Settings sliders can emit many updates per second;
  // writing/serializing the whole application state on every tick causes needless work
  // and cross-WebView storage churn during pointer movement.
  useEffect(() => {
    window.clearTimeout(dataSaveTimerRef.current);
    dataSaveTimerRef.current = window.setTimeout(() => {
      saveStoredData(data);
      dataSaveTimerRef.current = undefined;
    }, 100);

    return () => window.clearTimeout(dataSaveTimerRef.current);
  }, [data]);

  // Keep the independent native windows synchronized with the same local app data.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'neurolog_data_v1' || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as NeuroLogData;
        if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.tasks)) return;
        const normalized = normalizeAlarmData(parsed);
        setData(normalized);
        if (normalized.categories.length && !parsed.categories.some((c) => c.id === activeCategoryId)) {
          setActiveCategoryId(parsed.categories[0].id);
        }
      } catch {
        // Ignore malformed external updates.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [activeCategoryId]);

  // Apply CSS custom properties for theming live
  useEffect(() => {
    const root = document.documentElement;
    const isLight = data.settings.theme === 'light';
    root.style.setProperty('--bg-opacity', String(data.settings.bgOpacity));
    root.style.setProperty('--glass-blur', `${data.settings.glassBlur}px`);
    root.setAttribute('data-theme', isLight ? 'light' : 'dark');

    if (isTauriEnvironment()) {
      void setNativeGlassEffect(data.settings.glassBlur, data.settings.theme, data.settings.bgOpacity);
    }

    if (isLight) {
      root.classList.add('light-theme');
      root.classList.remove('dark');
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark');
      root.style.setProperty('--bg', '#f1f5f9');
      root.style.setProperty('--panel', `rgba(255, 255, 255, ${data.settings.bgOpacity})`);
      root.style.setProperty('--panel-solid', '#ffffff');
      root.style.setProperty('--text', '#0f172a');
      root.style.setProperty('--text-dim', '#64748b');
      root.style.setProperty('--border', 'rgba(0, 0, 0, 0.1)');
    } else {
      root.classList.remove('light-theme');
      root.classList.add('dark');
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark');
      root.style.setProperty('--bg', '#0d0d0e');
      root.style.setProperty('--panel', `rgba(22, 22, 26, ${data.settings.bgOpacity})`);
      root.style.setProperty('--panel-solid', '#16161a');
      root.style.setProperty('--text', '#e2e8f0');
      root.style.setProperty('--text-dim', '#94a3b8');
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.08)');
    }

  }, [data.settings]);

  // Keep Windows startup registration synchronized with the persisted setting.
  // Only the pill/controller WebView owns this native side effect so multiple windows
  // do not race to update the same Run entry.
  useEffect(() => {
    if (!isPillWindow()) return;
    void setLaunchOnStartup(data.settings.launchOnStartup);
  }, [data.settings.launchOnStartup]);

  // Global shortcuts are owned by the native Tauri process so they remain
  // active even when another application or browser tab has focus.
  useEffect(() => {
    if (!isPillWindow()) return;

    const generation = ++shortcutGenerationRef.current;
    const quick = data.settings.quickAddShortcut?.trim() || '';
    const clickThrough = data.settings.clickThroughShortcut?.trim() || '';

    shortcutSyncChainRef.current = shortcutSyncChainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (generation !== shortcutGenerationRef.current) return;
        await syncGlobalShortcuts(quick, clickThrough);
      })
      .catch(() => undefined);

    return () => {
      if (generation === shortcutGenerationRef.current) {
        shortcutGenerationRef.current += 1;
      }
      shortcutSyncChainRef.current = shortcutSyncChainRef.current
        .catch(() => undefined)
        .then(() => syncGlobalShortcuts('', ''))
        .catch(() => undefined);
    };
  }, [data.settings.quickAddShortcut, data.settings.clickThroughShortcut]);

  // Escape closes the currently focused popup or modal. Global shortcuts remain
  // native/OS-level and therefore do not depend on this listener.
  useEffect(() => {
    if (!isPopupWindow() || currentWindowLabel === WINDOW_LABELS.alarmPopup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void hideNativeWindow(currentWindowLabel as any);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentWindowLabel]);


  // Urgent Timer & Creative Schedule Engine Loop (1 second tick)
  useEffect(() => {
    if (isTauriEnvironment() && !isPillWindow()) return;
    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Evaluate Urgent Timer
      if (data.urgentTimer) {
        if (data.urgentTimer.isPaused) {
          setRemainingTimerSeconds(data.urgentTimer.pausedRemainingSeconds || 0);
        } else {
          const diffMs = data.urgentTimer.targetTimestamp - now;
          const diffSec = Math.max(0, Math.ceil(diffMs / 1000));
          setRemainingTimerSeconds(diffSec);

          if (diffSec <= 0 && !timerFinishedRef.current) {
            timerFinishedRef.current = true;
            setTimesUpModalOpen(true);

            if (isTauriEnvironment() && isPillWindow()) {
              saveStoredData(data);
              void getPillScreenPosition().then((pillPosition) =>
                openNativeWindow(
                  WINDOW_LABELS.timerComplete,
                  pillPosition ? { x: pillPosition.x, y: pillPosition.y } : undefined,
                )
              );
            } else {
              setIsExpanded(true);
            }

            if (!data.settings.silentMode) {
              if (data.settings.urgentSound) {
                soundManager.playAlarm(data.settings.soundTone, data.settings.soundVolume);
              }
              if (data.settings.urgentNotification) {
                sendNativeNotification("NeuroLog: TIME'S UP", `Did you finish: ${data.urgentTimer.taskTitle}?`);
              }
            }
          }
        }
      } else {
        setRemainingTimerSeconds(0);
        timerFinishedRef.current = false;
      }

      // 2. Evaluate Creative Time Schedules
      const nowDate = new Date();
      const curMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      const dateKey = `${nowDate.getFullYear()}-${nowDate.getMonth() + 1}-${nowDate.getDate()}`;

      let activeSched: { isActive: boolean; scheduleLabel: string; isEndingSoon: boolean; timeRemainingMinutes: number } | null = null;

      for (const sched of data.settings.creativeSchedules) {
        if (!sched.enabled) continue;

        const [sh, sm] = sched.startTime.split(':').map(Number);
        const [eh, em] = sched.endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        if (curMinutes >= startMin && curMinutes < endMin) {
          const remainingMins = endMin - curMinutes;
          const isEndingSoon = remainingMins <= 5;

          activeSched = {
            isActive: true,
            scheduleLabel: sched.label || 'Creative Time',
            isEndingSoon,
            timeRemainingMinutes: remainingMins,
          };

          // Trigger Start Alert once per day per schedule
          const startKey = `${dateKey}_start_${sched.id}`;
          if (!notifiedStartRef.current.has(startKey)) {
            notifiedStartRef.current.add(startKey);
            if (!data.settings.silentMode) {
              if (data.settings.creativeStartSound) {
                soundManager.playTone(data.settings.soundTone, data.settings.soundVolume);
              }
              if (data.settings.creativeStartNotification) {
                sendNativeNotification('Creative Time Active', `${sched.label} has begun. Time for ideas and exploration!`);
              }
            }
            if (data.settings.creativeStartAutoOpen) {
              setIsExpanded(true);
            }
          }

          // Trigger Wrap-up Warning if within 5 mins
          const endKey = `${dateKey}_end_${sched.id}`;
          if (isEndingSoon && !notifiedEndRef.current.has(endKey)) {
            notifiedEndRef.current.add(endKey);
            if (!data.settings.silentMode) {
              if (data.settings.creativeEndSound) {
                soundManager.playTone('marimba', data.settings.soundVolume);
              }
              if (data.settings.creativeEndNotification) {
                sendNativeNotification('Creative Time Ending Soon', `Wrap up what you're doing (${remainingMins}m remaining).`);
              }
            }
            if (data.settings.creativeEndWarning) {
              setCreativeWrapUpModalOpen(true);
            }
          }
          break;
        }
      }

      setCreativeStatus(activeSched);
    }, 1000);

    return () => clearInterval(interval);
  }, [data.urgentTimer, data.settings]);

  const syncNativeSurface = useCallback((label: keyof typeof WINDOW_LABELS, open: boolean) => {
    if (!isTauriEnvironment()) return;

    const nativeLabel = WINDOW_LABELS[label];
    if (!open) {
      void hideNativeWindow(nativeLabel);
      return;
    }

    if (nativeLabel === WINDOW_LABELS.expanded) {
      const panelSize = data.settings.panelSize || { width: 420, height: 560 };
      void positionExpandedWindowNearPill(panelSize.width, panelSize.height)
        .then(() => openNativeWindow(nativeLabel));
      return;
    }

    void getPillScreenPosition().then((pillPosition) =>
      openNativeWindow(nativeLabel, pillPosition ? { x: pillPosition.x, y: pillPosition.y } : undefined)
    );
  }, [data.settings.panelSize]);

  const setExpanded = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(isExpandedRef.current) : value;
    isExpandedRef.current = next;
    setIsExpanded(next);
    if (isTauriEnvironment()) {
      try { localStorage.setItem('neurolog-expanded-open', String(next)); } catch {}
      syncNativeSurface('expanded', next);
    }
  }, [syncNativeSurface]);

  expandedSetterRef.current = setExpanded;

  const setQuickAddOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(isQuickAddOpenRef.current) : open;
    isQuickAddOpenRef.current = next;
    setIsQuickAddOpen(next);
    syncNativeSurface('quickAdd', next);
  }, [syncNativeSurface]);

  const setSettingsOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(isSettingsOpenRef.current) : open;
    isSettingsOpenRef.current = next;
    setIsSettingsOpen(next);
    syncNativeSurface('settings', next);
  }, [syncNativeSurface]);

  settingsSetterRef.current = setSettingsOpen;

  const setAboutOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(isAboutOpenRef.current) : open;
    isAboutOpenRef.current = next;
    setIsAboutOpen(next);
    syncNativeSurface('about', next);
  }, [syncNativeSurface]);

  const setSupportOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(isSupportOpenRef.current) : open;
    isSupportOpenRef.current = next;
    setIsSupportOpen(next);
    syncNativeSurface('support', next);
  }, [syncNativeSurface]);

  const setStopwatchOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(isStopwatchOpenRef.current) : open;
    isStopwatchOpenRef.current = next;
    setIsStopwatchOpen(next);
    syncNativeSurface('stopwatch', next);
  }, [syncNativeSurface]);

  const setAlarmOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(isAlarmOpenRef.current) : open;
    isAlarmOpenRef.current = next;
    setIsAlarmOpen(next);
    syncNativeSurface('alarm', next);
  }, [syncNativeSurface]);

  const toggleClickThrough = useCallback(() => {
    const next = !isClickThroughRef.current;
    isClickThroughRef.current = next;
    setIsClickThrough(next);
  }, []);

  // Tray actions are routed through the pill/controller WebView so native menu
  // actions use the same state transitions as the keyboard shortcuts and UI.
  useEffect(() => {
    if (!isPillWindow()) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        cleanup = await listen<string>('neurolog-tray-action', (event) => {
          if (disposed) return;
          if (event.payload === 'open') {
            expandedSetterRef.current?.(true);
          } else if (event.payload === 'settings') {
            settingsSetterRef.current?.(true);
          } else if (event.payload === 'click_through') {
            toggleClickThrough();
          }
        });
      } catch (error) {
        console.warn('Could not listen for tray actions:', error);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [toggleClickThrough]);

  // The click-through control is its own tiny native window. It emits here so the
  // actual click-through state remains owned by the pill/controller WebView.
  useEffect(() => {
    if (!isPillWindow()) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        cleanup = await listen('neurolog-click-through-control-action', () => {
          if (!disposed) toggleClickThrough();
        });
      } catch (error) {
        console.warn('Could not listen for click-through control actions:', error);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [toggleClickThrough]);

  // Receive actions from the native global shortcut handler. Only the pill/controller
  // WebView consumes them so popup WebViews cannot duplicate an action.
  useEffect(() => {
    if (!isPillWindow()) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        cleanup = await listen<string>('neurolog-global-shortcut', (event) => {
          if (disposed) return;
          if (event.payload === 'quick_add') {
            setQuickAddOpen((prev) => !prev);
            return;
          }
          if (event.payload === 'click_through') {
            toggleClickThrough();
          }
        });
      } catch (error) {
        console.warn('Could not listen for native global shortcuts:', error);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [toggleClickThrough, setQuickAddOpen]);


  const stopAlarmSound = useCallback(() => {
    soundManager.stopLoopingAlarm();
    alarmSoundKeyRef.current = null;
  }, []);

  const startAlarmSound = useCallback(async (alarm: Alarm, generation = alarmDeliveryGenerationRef.current) => {
    const soundKey = `${alarm.id}:${alarm.soundId}`;
    if (alarmSoundKeyRef.current === soundKey) return;
    if (generation !== alarmDeliveryGenerationRef.current) return;
    if (data.settings.alarm.respectSilentMode && data.settings.silentMode) return;
    if (data.settings.soundVolume <= 0) return;

    const custom = data.alarmSounds.find((sound) => sound.id === alarm.soundId);
    if (custom && isTauriEnvironment()) {
      try {
        const bytes = await readAlarmSound(custom.relativePath);
        if (generation !== alarmDeliveryGenerationRef.current) return;
        const extension = custom.fileName.split('.').pop()?.toLowerCase() || 'mp3';
        const mime = extension === 'wav' ? 'audio/wav' : extension === 'ogg' ? 'audio/ogg' : extension === 'm4a' ? 'audio/mp4' : extension === 'aac' ? 'audio/aac' : 'audio/mpeg';
        await soundManager.playLoopingCustomAlarm(bytes, mime, data.settings.soundVolume);
        if (generation !== alarmDeliveryGenerationRef.current) {
          soundManager.stopLoopingAlarm();
          return;
        }
        alarmSoundKeyRef.current = soundKey;
        return;
      } catch (error) {
        if (generation !== alarmDeliveryGenerationRef.current) return;
        console.warn('Could not play custom alarm sound; falling back to a bundled alarm tone:', error);
      }
    }

    if (generation !== alarmDeliveryGenerationRef.current) return;
    soundManager.playLoopingAlarm(
      (alarm.soundId === 'alarm-bell' || alarm.soundId === 'alarm-digital' ? alarm.soundId : 'alarm-pulse') as 'alarm-pulse' | 'alarm-bell' | 'alarm-digital',
      data.settings.soundVolume,
    );
    if (generation === alarmDeliveryGenerationRef.current) alarmSoundKeyRef.current = soundKey;
  }, [data.alarmSounds, data.settings.alarm.respectSilentMode, data.settings.silentMode, data.settings.soundVolume]);

  startAlarmSoundRef.current = startAlarmSound;

  const dismissAlarm = useCallback(() => {
    ++alarmDeliveryGenerationRef.current;
    stopAlarmSound();
    alarmPopupShownRef.current = false;
    const current = normalizeAlarmData(loadStoredData());
    if (!current.activeAlarm) {
      if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
      setData(current);
      return;
    }

    const activeId = current.activeAlarm.alarmId;
    const nextData = {
      ...current,
      alarms: current.alarms.map((alarm) => alarm.id === activeId
        ? { ...alarm, lastOutcome: 'dismissed' as const, lastOutcomeAt: Date.now() }
        : alarm),
      activeAlarm: null,
    };
    saveStoredData(nextData);
    setData(nextData);
    if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
  }, [stopAlarmSound]);

  const snoozeAlarm = useCallback((minutes?: number) => {
    const current = normalizeAlarmData(loadStoredData());
    if (!current.activeAlarm) return;
    const duration = Math.max(1, Math.round(minutes || current.settings.alarm.defaultSnoozeMinutes || 5));
    ++alarmDeliveryGenerationRef.current;
    stopAlarmSound();
    alarmPopupShownRef.current = false;
    const nextData = {
      ...current,
      activeAlarm: {
        ...current.activeAlarm,
        snoozeUntil: Date.now() + duration * 60 * 1000,
        snoozeCount: current.activeAlarm.snoozeCount + 1,
      },
    };
    saveStoredData(nextData);
    setData(nextData);
    if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
  }, [stopAlarmSound]);

  dismissAlarmRef.current = dismissAlarm;
  snoozeAlarmRef.current = snoozeAlarm;

  useEffect(() => {
    if (!isPillWindow()) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        cleanup = await listen<{ action: 'dismiss' | 'snooze'; minutes?: number }>('neurolog-alarm-action', (event) => {
          if (disposed) return;
          if (event.payload.action === 'dismiss') dismissAlarmRef.current?.();
          else if (event.payload.action === 'snooze') snoozeAlarmRef.current?.(event.payload.minutes);
        });
      } catch (error) {
        console.warn('Could not listen for alarm actions:', error);
      }
    })();
    return () => { disposed = true; cleanup?.(); };
  }, []);

  const closeAllPanels = useCallback(() => {
    isExpandedRef.current = false;
    isQuickAddOpenRef.current = false;
    isSettingsOpenRef.current = false;
    isAboutOpenRef.current = false;
    isSupportOpenRef.current = false;
    isStopwatchOpenRef.current = false;
    isAlarmOpenRef.current = false;
    setIsExpanded(false);
    setIsQuickAddOpen(false);
    setIsSettingsOpen(false);
    setIsAboutOpen(false);
    setIsSupportOpen(false);
    setIsStopwatchOpen(false);
    setIsAlarmOpen(false);
    if (isTauriEnvironment()) {
      void hideAllNativeWindows();
    }
    try { localStorage.setItem('neurolog-expanded-open', 'false'); } catch {}
  }, []);

  const addCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      isDefault: false,
      order: data.categories.length,
      subcategories: [],
    };
    setData((prev) => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));
    setActiveCategoryId(newCategory.id);
  };

  const renameCategory = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
    }));
  };

  const deleteCategory = (id: string) => {
    const target = data.categories.find((c) => c.id === id);
    if (!target || target.isDefault) return; // Prevent deleting default categories

    setData((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
      tasks: prev.tasks.filter((t) => t.categoryId !== id),
    }));

    if (activeCategoryId === id) {
      setActiveCategoryId(data.categories[0]?.id || 'cat-study');
    }
  };

  const addSubcategory = (categoryId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== categoryId) return c;
        const newSub = {
          id: `sub-${Date.now()}`,
          categoryId,
          name: trimmed,
          order: c.subcategories.length,
        };
        return { ...c, subcategories: [...c.subcategories, newSub] };
      }),
    }));
  };

  const renameSubcategory = (categoryId: string, subId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== categoryId) return c;
        return {
          ...c,
          subcategories: c.subcategories.map((s) => (s.id === subId ? { ...s, name: trimmed } : s)),
        };
      }),
    }));
  };

  const deleteSubcategory = (categoryId: string, subId: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== categoryId) return c;
        return {
          ...c,
          subcategories: c.subcategories.filter((s) => s.id !== subId),
        };
      }),
      tasks: prev.tasks.map((t) => (t.subcategoryId === subId ? { ...t, subcategoryId: null } : t)),
    }));
  };

  const addTask = (categoryId: string, title: string, subcategoryId?: string | null): Task => {
    const trimmed = title.trim();
    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      categoryId,
      subcategoryId: subcategoryId || null,
      title: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    setData((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));

    return newTask;
  };

  const toggleTaskCompletion = (taskId: string) => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id === taskId) {
          const nextCompleted = !t.completed;
          return {
            ...t,
            completed: nextCompleted,
            completedAt: nextCompleted ? Date.now() : null,
          };
        }
        return t;
      }),
    }));

    // If completed active urgent task, stop urgent timer
    if (data.urgentTimer && data.urgentTimer.taskId === taskId) {
      stopUrgentTimer(false);
    }
  };

  const renameTask = (taskId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)),
      urgentTimer:
        prev.urgentTimer && prev.urgentTimer.taskId === taskId
          ? { ...prev.urgentTimer, taskTitle: trimmed }
          : prev.urgentTimer,
    }));
  };

  const confirmDeleteTask = (task: Task) => {
    if (!data.settings.confirmTaskDelete) {
      executeDeleteTask(task.id);
    } else {
      setTaskToDelete(task);
    }
  };

  const executeDeleteTask = (taskId: string, dontAskAgain?: boolean) => {
    setData((prev) => {
      const nextSettings = dontAskAgain ? { ...prev.settings, confirmTaskDelete: false } : prev.settings;
      const isUrgent = prev.urgentTimer && prev.urgentTimer.taskId === taskId;
      return {
        ...prev,
        settings: nextSettings,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
        urgentTimer: isUrgent ? null : prev.urgentTimer,
      };
    });
    setTaskToDelete(null);
  };

  const startUrgentTask = (title: string, durationSeconds: number) => {
    const trimmed = title.trim();
    if (!trimmed || durationSeconds <= 0) return;

    if (data.urgentTimer) {
      setActiveConflict({ pendingTitle: trimmed, pendingDuration: durationSeconds });
      return;
    }

    const task = addTask('cat-urgent', trimmed, null);
    const startTimestamp = Date.now();
    const targetTimestamp = startTimestamp + durationSeconds * 1000;

    timerFinishedRef.current = false;
    setData((prev) => ({
      ...prev,
      urgentTimer: {
        taskId: task.id,
        taskTitle: trimmed,
        initialDurationSeconds: durationSeconds,
        startTimestamp,
        targetTimestamp,
        isPaused: false,
      },
    }));
  };

  const pauseUrgentTimer = () => {
    if (!data.urgentTimer || data.urgentTimer.isPaused) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((data.urgentTimer.targetTimestamp - now) / 1000));

    setData((prev) => {
      if (!prev.urgentTimer) return prev;
      return {
        ...prev,
        urgentTimer: {
          ...prev.urgentTimer,
          isPaused: true,
          pausedRemainingSeconds: remaining,
        },
      };
    });
  };

  const resumeUrgentTimer = () => {
    if (!data.urgentTimer || !data.urgentTimer.isPaused) return;
    const remaining = data.urgentTimer.pausedRemainingSeconds || 0;
    const now = Date.now();
    const targetTimestamp = now + remaining * 1000;

    setData((prev) => {
      if (!prev.urgentTimer) return prev;
      return {
        ...prev,
        urgentTimer: {
          ...prev.urgentTimer,
          isPaused: false,
          targetTimestamp,
          pausedRemainingSeconds: undefined,
        },
      };
    });
  };

  const stopUrgentTimer = (markDone: boolean = false) => {
    if (!data.urgentTimer) return;
    const currentTaskId = data.urgentTimer.taskId;

    setData((prev) => {
      let updatedTasks = prev.tasks;
      if (markDone && currentTaskId) {
        updatedTasks = prev.tasks.map((t) =>
          t.id === currentTaskId ? { ...t, completed: true, completedAt: Date.now() } : t
        );
      }
      return {
        ...prev,
        tasks: updatedTasks,
        urgentTimer: null,
      };
    });

    timerFinishedRef.current = false;
    setTimesUpModalOpen(false);
    if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.timerComplete);
  };

  const extendUrgentTimer = (additionalSeconds: number) => {
    if (!data.urgentTimer) return;
    const now = Date.now();
    const baseTimestamp = Math.max(now, data.urgentTimer.targetTimestamp);
    const targetTimestamp = baseTimestamp + additionalSeconds * 1000;

    timerFinishedRef.current = false;
    setTimesUpModalOpen(false);
    if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.timerComplete);

    setData((prev) => {
      if (!prev.urgentTimer) return prev;
      return {
        ...prev,
        urgentTimer: {
          ...prev.urgentTimer,
          isPaused: false,
          targetTimestamp,
          pausedRemainingSeconds: undefined,
        },
      };
    });
  };

  stopUrgentTimerRef.current = stopUrgentTimer;
  extendUrgentTimerRef.current = extendUrgentTimer;

  // Actions from the dedicated native timer-completion window are routed back to the
  // pill/controller WebView so timer state remains single-source-of-truth.
  useEffect(() => {
    if (!isPillWindow()) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        cleanup = await listen<{ action: 'stop' | 'extend'; seconds?: number }>('neurolog-timer-complete-action', (event) => {
          if (disposed) return;
          if (event.payload.action === 'stop') {
            stopUrgentTimerRef.current?.(true);
          } else if (event.payload.action === 'extend' && typeof event.payload.seconds === 'number') {
            extendUrgentTimerRef.current?.(event.payload.seconds);
          }
        });
      } catch (error) {
        console.warn('Could not listen for timer completion actions:', error);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  // Stopwatch handlers
  const startStopwatch = () => {
    setStopwatchState((prev) => {
      if (prev.isRunning) return prev;
      return {
        ...prev,
        isRunning: true,
        startTime: Date.now(),
      };
    });
  };

  const pauseStopwatch = () => {
    setStopwatchState((prev) => {
      if (!prev.isRunning || prev.startTime === null) return prev;
      const elapsedSinceStart = Date.now() - prev.startTime;
      return {
        ...prev,
        isRunning: false,
        startTime: null,
        accumulatedMs: prev.accumulatedMs + elapsedSinceStart,
      };
    });
  };

  const resetStopwatch = () => {
    setStopwatchState({
      isRunning: false,
      startTime: null,
      accumulatedMs: 0,
      laps: [],
    });
  };

  const addStopwatchLap = () => {
    setStopwatchState((prev) => {
      const currentMs = prev.accumulatedMs + (prev.isRunning && prev.startTime !== null ? Date.now() - prev.startTime : 0);
      const prevLapTime = prev.laps.length > 0 ? prev.laps[0].timeMs : 0;
      const lapDiff = Math.max(0, currentMs - prevLapTime);

      const newLap = {
        id: `lap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timeMs: currentMs,
        lapDiffMs: lapDiff,
      };

      return {
        ...prev,
        laps: [newLap, ...prev.laps],
      };
    });
  };

  const clearStopwatchLaps = () => {
    setStopwatchState((prev) => ({
      ...prev,
      laps: [],
    }));
  };


  const addAlarm = useCallback((alarm: Alarm): boolean => {
    const current = normalizeAlarmData(loadStoredData());
    const normalized = normalizeAlarm({ ...alarm, enabled: true });
    if (current.alarms.some((existing) => getAlarmScheduleKey(existing) === getAlarmScheduleKey(normalized))) {
      return false;
    }
    const nextData = { ...current, alarms: [...current.alarms, normalized] };
    saveStoredData(nextData);
    setData(nextData);
    return true;
  }, []);

  const updateAlarm = useCallback((alarmId: string, updates: Partial<Alarm>): boolean => {
    const current = normalizeAlarmData(loadStoredData());
    const existing = current.alarms.find((alarm) => alarm.id === alarmId);
    if (!existing) return false;
    const candidate = normalizeAlarm({ ...existing, ...updates, enabled: true });
    if (current.alarms.some((alarm) => alarm.id !== alarmId && getAlarmScheduleKey(alarm) === getAlarmScheduleKey(candidate))) {
      return false;
    }

    const scheduleChanged = getAlarmScheduleKey(existing) !== getAlarmScheduleKey(candidate)
      || existing.enabled !== candidate.enabled
      || existing.soundId !== candidate.soundId;
    if (scheduleChanged && current.activeAlarm?.alarmId === alarmId) {
      ++alarmDeliveryGenerationRef.current;
      stopAlarmSound();
      alarmPopupShownRef.current = false;
      if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
    } else if (scheduleChanged) {
      ++alarmDeliveryGenerationRef.current;
    }

    const nextData = {
      ...current,
      alarms: current.alarms.map((alarm) => alarm.id === alarmId ? candidate : alarm),
    };
    saveStoredData(nextData);
    setData(nextData);
    return true;
  }, [stopAlarmSound]);

  const deleteAlarm = useCallback((alarmId: string) => {
    const current = normalizeAlarmData(loadStoredData());
    const active = current.activeAlarm?.alarmId === alarmId;
    if (active) {
      ++alarmDeliveryGenerationRef.current;
      stopAlarmSound();
      alarmPopupShownRef.current = false;
      if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
    }
    const nextData = {
      ...current,
      alarms: current.alarms.filter((alarm) => alarm.id !== alarmId),
      activeAlarm: active ? null : current.activeAlarm,
    };
    saveStoredData(nextData);
    setData(nextData);
  }, [stopAlarmSound]);

  const addAlarmSound = useCallback((sound: AlarmSoundFile) => {
    const current = normalizeAlarmData(loadStoredData());
    const nextData = { ...current, alarmSounds: [...current.alarmSounds.filter((item) => item.id !== sound.id), sound] };
    saveStoredData(nextData);
    setData(nextData);
  }, []);

  const deleteAlarmSound = useCallback((soundId: string) => {
    const current = normalizeAlarmData(loadStoredData());
    const fallback = current.settings.alarm.lastSoundId === soundId ? 'alarm-pulse' : current.settings.alarm.lastSoundId;
    const nextData = {
      ...current,
      alarmSounds: current.alarmSounds.filter((sound) => sound.id !== soundId),
      alarms: current.alarms.map((alarm) => alarm.soundId === soundId ? { ...alarm, soundId: fallback } : alarm),
      settings: { ...current.settings, alarm: { ...current.settings.alarm, lastSoundId: fallback } },
    };
    saveStoredData(nextData);
    setData(nextData);
  }, []);

  const toggleAlarm = useCallback((alarmId: string) => {
    const current = normalizeAlarmData(loadStoredData());
    const alarm = current.alarms.find((item) => item.id === alarmId);
    if (!alarm) return;

    const isActive = current.activeAlarm?.alarmId === alarmId;
    const nextEnabled = !alarm.enabled;
    const nextData = {
      ...current,
      alarms: current.alarms.map((item) => item.id === alarmId
        ? { ...item, enabled: nextEnabled, ...(isActive && !nextEnabled ? { lastOutcome: 'dismissed' as const, lastOutcomeAt: Date.now() } : {}) }
        : item),
      activeAlarm: isActive && !nextEnabled ? null : current.activeAlarm,
    };
    if (isActive && !nextEnabled) {
      ++alarmDeliveryGenerationRef.current;
      stopAlarmSound();
      alarmPopupShownRef.current = false;
      if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
    } else {
      ++alarmDeliveryGenerationRef.current;
    }
    saveStoredData(nextData);
    setData(nextData);
  }, [stopAlarmSound]);

  // One authoritative alarm scheduler. The panel/editor never owns scheduling.
  useEffect(() => {
    if (isTauriEnvironment() && !isPillWindow()) return;

    const evaluateAlarms = async () => {
      if (alarmTriggerInFlightRef.current) return;
      const now = Date.now();
      const current = normalizeAlarmData(loadStoredData());
      let nextData = current;

      if (current.activeAlarm) {
        const active = current.alarms.find((alarm) => alarm.id === current.activeAlarm!.alarmId);
        if (!active) {
          ++alarmDeliveryGenerationRef.current;
          stopAlarmSound();
          alarmPopupShownRef.current = false;
          nextData = { ...current, activeAlarm: null };
          saveStoredData(nextData);
          setData(nextData);
          if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
          return;
        }

        if (current.activeAlarm.snoozeUntil && now >= current.activeAlarm.snoozeUntil) {
          const generation = alarmDeliveryGenerationRef.current;
          alarmTriggerInFlightRef.current = true;
          try {
            nextData = { ...current, activeAlarm: { ...current.activeAlarm, triggeredAt: now, snoozeUntil: undefined } };
            saveStoredData(nextData);
            setData(nextData);
            await startAlarmSoundRef.current(active, generation);
            if (generation !== alarmDeliveryGenerationRef.current) return;
            if (active.windowsNotification && !(nextData.settings.alarm.respectSilentMode && nextData.settings.silentMode)) {
              void sendNativeNotification(`NeuroLog · ${active.label || 'Alarm'}`, `Snoozed alarm · ${formatAlarmClockTime(active.time)}`);
            }
            if (isTauriEnvironment() && isPillWindow()) {
              const pillPosition = await getPillScreenPosition();
              if (generation !== alarmDeliveryGenerationRef.current) return;
              alarmPopupShownRef.current = true;
              await openNativeWindow(WINDOW_LABELS.alarmPopup, pillPosition ? { x: pillPosition.x, y: pillPosition.y } : undefined);
            }
          } catch (error) {
            console.warn('Could not complete snoozed alarm delivery:', error);
          } finally {
            alarmTriggerInFlightRef.current = false;
          }
          return;
        }

        if (!current.activeAlarm.snoozeUntil) {
          const generation = alarmDeliveryGenerationRef.current;
          await startAlarmSoundRef.current(active, generation);
          if (generation !== alarmDeliveryGenerationRef.current) return;
          if (!alarmPopupShownRef.current && isTauriEnvironment() && isPillWindow()) {
            const pillPosition = await getPillScreenPosition();
            if (generation !== alarmDeliveryGenerationRef.current) return;
            alarmPopupShownRef.current = true;
            try {
              await openNativeWindow(WINDOW_LABELS.alarmPopup, pillPosition ? { x: pillPosition.x, y: pillPosition.y } : undefined);
            } catch (error) {
              alarmPopupShownRef.current = false;
              console.warn('Could not open the alarm popup:', error);
            }
          }
        }
        return;
      }

      alarmPopupShownRef.current = false;

      for (const alarm of current.alarms) {
        if (!alarm.enabled) continue;
        const due = getDueOccurrence(alarm, now);
        if (due === null) continue;

        const age = Math.max(0, now - due);
        const missed = age > 60_000;
        const stale = age > ALARM_MISSED_GRACE_MS;
        const updatedAlarm = {
          ...alarm,
          lastTriggeredAt: due,
          lastOutcome: missed ? 'missed' as const : 'triggered' as const,
          lastOutcomeAt: now,
          enabled: alarm.repeat.type === 'once' ? false : alarm.enabled,
        };
        nextData = {
          ...current,
          alarms: current.alarms.map((item) => item.id === alarm.id ? updatedAlarm : item),
          activeAlarm: { alarmId: alarm.id, scheduledFor: due, triggeredAt: now, missed, snoozeCount: 0 },
        };

        const generation = alarmDeliveryGenerationRef.current;
        alarmTriggerInFlightRef.current = true;
        try {
          saveStoredData(nextData);
          setData(nextData);
          if (!stale && !(nextData.settings.alarm.respectSilentMode && nextData.settings.silentMode)) {
            await startAlarmSoundRef.current(updatedAlarm, generation);
          }
          if (generation !== alarmDeliveryGenerationRef.current) return;
          if (alarm.windowsNotification && !(nextData.settings.alarm.respectSilentMode && nextData.settings.silentMode)) {
            void sendNativeNotification(
              stale ? `Missed alarm · ${updatedAlarm.label || 'Alarm'}` : (missed ? `Missed alarm · ${updatedAlarm.label || 'Alarm'}` : `NeuroLog · ${updatedAlarm.label || 'Alarm'}`),
              stale ? `${formatAlarmClockTime(updatedAlarm.time)} was missed while NeuroLog was unavailable.` : (missed ? `${formatAlarmClockTime(updatedAlarm.time)} was missed.` : `Alarm set for ${formatAlarmClockTime(updatedAlarm.time)}.`),
            );
          }
          if (isTauriEnvironment() && isPillWindow()) {
            const pillPosition = await getPillScreenPosition();
            if (generation !== alarmDeliveryGenerationRef.current) return;
            alarmPopupShownRef.current = true;
            await openNativeWindow(WINDOW_LABELS.alarmPopup, pillPosition ? { x: pillPosition.x, y: pillPosition.y } : undefined);
          }
        } catch (error) {
          console.warn('Could not complete alarm delivery:', error);
          alarmPopupShownRef.current = false;
        } finally {
          alarmTriggerInFlightRef.current = false;
        }
        break;
      }
    };

    void evaluateAlarms();
    const interval = window.setInterval(() => { void evaluateAlarms(); }, 1000);
    return () => window.clearInterval(interval);
  }, [stopAlarmSound]);

  const updateSettings = useCallback((updated: Partial<AppSettings>) => {
    setData((prev) => {
      const next = {
        ...prev,
        settings: {
          ...prev.settings,
          ...updated,
          ...(updated.alarm ? { alarm: { ...prev.settings.alarm, ...updated.alarm } } : {}),
        },
      };
      if (updated.alarm?.lastSoundId !== undefined || updated.alarm?.defaultWindowsNotification !== undefined || updated.alarm?.defaultSnoozeMinutes !== undefined || updated.alarm?.respectSilentMode !== undefined || updated.alarm?.snoozeDurationsMinutes !== undefined) saveStoredData(next);
      return next;
    });
  }, []);

  const resetSettings = () => {
    setData((prev) => ({
      ...prev,
      settings: DEFAULT_SETTINGS,
    }));
  };

  const factoryReset = () => {
    ++alarmDeliveryGenerationRef.current;
    stopAlarmSound();
    alarmPopupShownRef.current = false;
    clearAllStoredData();
    const freshData: NeuroLogData = {
      version: 2,
      exportedAt: Date.now(),
      categories: DEFAULT_CATEGORIES,
      tasks: INITIAL_TASKS,
      urgentTimer: null,
      alarms: [],
      alarmSounds: [],
      activeAlarm: null,
      settings: DEFAULT_SETTINGS,
    };
    setData(freshData);
    setActiveCategoryId('cat-study');
    setStopwatchState({
      isRunning: false,
      startTime: null,
      accumulatedMs: 0,
      laps: [],
    });
    setTimesUpModalOpen(false);
    setCreativeWrapUpModalOpen(false);
    setActiveConflict(null);
    setTaskToDelete(null);
    setIsQuickAddOpen(false);
    setIsSettingsOpen(false);
    setIsAboutOpen(false);
    setIsSupportOpen(false);
    setIsStopwatchOpen(false);
    setIsAlarmOpen(false);
    if (isTauriEnvironment()) void hideAllNativeWindows();
  };

  const importAppData = (imported: NeuroLogData) => {
    ++alarmDeliveryGenerationRef.current;
    stopAlarmSound();
    alarmPopupShownRef.current = false;
    if (isTauriEnvironment()) void hideNativeWindow(WINDOW_LABELS.alarmPopup);
    setData({ ...normalizeAlarmData(imported), activeAlarm: null });
    if (imported.categories.length > 0) {
      setActiveCategoryId(imported.categories[0].id);
    }
  };

  const getExportData = (): NeuroLogData => {
    return {
      version: 2,
      exportedAt: Date.now(),
      categories: data.categories,
      tasks: data.tasks,
      urgentTimer: data.urgentTimer,
      alarms: data.alarms,
      alarmSounds: data.alarmSounds,
      activeAlarm: data.activeAlarm,
      settings: data.settings,
    };
  };

  return (
    <AppContext.Provider
      value={{
        categories: data.categories,
        tasks: data.tasks,
        activeCategoryId,
        urgentTimer: data.urgentTimer,
        settings: data.settings,
        isExpanded,
        isClickThrough,
        isQuickAddOpen,
        isSettingsOpen,
        isAboutOpen,
        isSupportOpen,
        isStopwatchOpen,
        isAlarmOpen,
        alarms: data.alarms,
        alarmSounds: data.alarmSounds,
        activeAlarm: data.activeAlarm,
        stopwatchState,
        timesUpModalOpen,
        activeConflict,
        taskToDelete,
        creativeStatus,
        creativeWrapUpModalOpen,
        remainingTimerSeconds,

        setActiveCategoryId,
        setIsExpanded: setExpanded,
        setIsQuickAddOpen: setQuickAddOpen,
        setIsSettingsOpen: setSettingsOpen,
        setIsAboutOpen: setAboutOpen,
        setIsSupportOpen: setSupportOpen,
        setIsStopwatchOpen: setStopwatchOpen,
        setIsAlarmOpen: setAlarmOpen,
        setTimesUpModalOpen,
        setActiveConflict,
        setTaskToDelete,
        setCreativeWrapUpModalOpen,

        toggleClickThrough,
        closeAllPanels,
        addCategory,
        renameCategory,
        deleteCategory,
        addSubcategory,
        renameSubcategory,
        deleteSubcategory,
        addTask,
        toggleTaskCompletion,
        renameTask,
        confirmDeleteTask,
        executeDeleteTask,
        startUrgentTask,
        pauseUrgentTimer,
        resumeUrgentTimer,
        stopUrgentTimer,
        extendUrgentTimer,
        startStopwatch,
        pauseStopwatch,
        resetStopwatch,
        addStopwatchLap,
        clearStopwatchLaps,
        addAlarm,
        updateAlarm,
        deleteAlarm,
        addAlarmSound,
        deleteAlarmSound,
        toggleAlarm,
        dismissAlarm,
        snoozeAlarm,
        updateSettings,
        resetSettings,
        factoryReset,
        importAppData,
        getExportData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
