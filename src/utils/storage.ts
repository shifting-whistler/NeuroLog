import { Alarm, AlarmSoundFile, AppSettings, Category, NeuroLogData, Task, UrgentTimerState } from '../types';
import { dedupeAlarmsBySchedule, normalizeAlarm } from './alarmScheduler';

const STORAGE_KEY = 'neurolog_data_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  bgOpacity: 0.90,
  glassBlur: 0,
  widgetOpacity: 0.95,
  clickThroughOpacity: 0.60,
  pillScale: 1.0,
  studyHidden: false,

  enabledQuickActions: ['study', 'creative', 'urgent', 'stopwatch', 'alarm', 'quick_add'],

  clickThroughShortcut: 'Ctrl+Alt+X',
  quickAddShortcut: 'Ctrl+Alt+N',
  rememberPosition: true,
  lastPosition: { x: 24, y: 24 },
  showClickThroughIndicator: true,
  panelSize: { width: 420, height: 560 },

  completedPlacement: 'global',
  confirmTaskDelete: true,
  displayTimestamp: true,
  timerPresets: [
    { id: 'p-5m', label: '5m', seconds: 300 },
    { id: 'p-10m', label: '10m', seconds: 600 },
    { id: 'p-25m', label: '25m', seconds: 1500 },
    { id: 'p-1h', label: '1h', seconds: 3600 },
  ],

  creativeSchedules: [
    {
      id: 'sched-1',
      label: 'Creative Session',
      startTime: '16:00',
      endTime: '18:00',
      enabled: true,
    },
    {
      id: 'sched-2',
      label: 'Evening Exploration',
      startTime: '20:00',
      endTime: '21:30',
      enabled: true,
    },
  ],
  creativeStartSound: true,
  creativeStartNotification: true,
  creativeStartAutoOpen: false,
  creativeEndSound: true,
  creativeEndNotification: true,
  creativeEndWarning: true,

  urgentSound: true,
  urgentNotification: true,
  soundVolume: 75,
  soundTone: 'zen-chime',
  silentMode: false,

  alarm: {
    defaultSnoozeMinutes: 5,
    snoozeDurationsMinutes: [5, 10, 15, 30],
    lastSoundId: 'alarm-pulse',
    defaultWindowsNotification: false,
    respectSilentMode: false,
  },

  launchOnStartup: true,
  minimizeToTray: true,
};


const normalizeAlarmSettings = (raw: unknown): AppSettings['alarm'] => {
  const source = raw && typeof raw === 'object' ? raw as Partial<AppSettings['alarm']> : {};
  const snooze = Array.isArray(source.snoozeDurationsMinutes)
    ? source.snoozeDurationsMinutes
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 120)
        .map((value) => Math.round(value))
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((a, b) => a - b)
    : [];
  const defaultSnooze = Number(source.defaultSnoozeMinutes);
  const legacyDefaultSound = (source as Partial<AppSettings['alarm']> & { defaultSoundId?: unknown }).defaultSoundId;
  const lastSound = typeof source.lastSoundId === 'string' && source.lastSoundId.trim()
    ? source.lastSoundId
    : typeof legacyDefaultSound === 'string' && legacyDefaultSound.trim()
    ? legacyDefaultSound
    : DEFAULT_SETTINGS.alarm.lastSoundId;
  return {
    defaultSnoozeMinutes: Number.isFinite(defaultSnooze) ? Math.min(120, Math.max(1, Math.round(defaultSnooze))) : DEFAULT_SETTINGS.alarm.defaultSnoozeMinutes,
    snoozeDurationsMinutes: snooze.length ? snooze : [...DEFAULT_SETTINGS.alarm.snoozeDurationsMinutes],
    lastSoundId: lastSound,
    defaultWindowsNotification: Boolean(source.defaultWindowsNotification),
    respectSilentMode: Boolean(source.respectSilentMode),
  };
};

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-study',
    name: 'Study',
    isDefault: true,
    order: 0,
    subcategories: [
      { id: 'sub-physics', categoryId: 'cat-study', name: 'Physics', order: 0 },
      { id: 'sub-math', categoryId: 'cat-study', name: 'Math', order: 1 },
    ],
  },
  {
    id: 'cat-creative',
    name: 'Creative',
    isDefault: true,
    order: 1,
    subcategories: [
      { id: 'sub-app-ideas', categoryId: 'cat-creative', name: 'App Ideas', order: 0 },
      { id: 'sub-design', categoryId: 'cat-creative', name: 'Design Ideas', order: 1 },
    ],
  },
  {
    id: 'cat-urgent',
    name: 'Timer',
    isDefault: true,
    order: 2,
    subcategories: [], // Timer has strictly flat tasks
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    categoryId: 'cat-study',
    subcategoryId: 'sub-physics',
    title: 'Physics Chapter 7 - Electromagnetism',
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 120,
  },
  {
    id: 'task-2',
    categoryId: 'cat-study',
    subcategoryId: 'sub-math',
    title: 'Finish Integration Problem Set 4',
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 90,
  },
  {
    id: 'task-3',
    categoryId: 'cat-creative',
    subcategoryId: 'sub-app-ideas',
    title: 'Minimalist local audio synthesizer plugin',
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 300,
  },
  {
    id: 'task-4',
    categoryId: 'cat-creative',
    subcategoryId: 'sub-design',
    title: 'Futuristic glassmorphic HUD design concepts',
    completed: false,
    createdAt: Date.now() - 1000 * 60 * 240,
  },
];

export const BUILTIN_ALARM_SOUNDS: AlarmSoundFile[] = [];

export const DEFAULT_ALARMS: Alarm[] = [];

const buildInitialData = (): NeuroLogData => ({
  version: 2,
  exportedAt: Date.now(),
  categories: DEFAULT_CATEGORIES,
  tasks: INITIAL_TASKS,
  urgentTimer: null,
  alarms: DEFAULT_ALARMS,
  alarmSounds: BUILTIN_ALARM_SOUNDS,
  activeAlarm: null,
  settings: DEFAULT_SETTINGS,
});

export const loadStoredData = (): NeuroLogData => {
  if (typeof window === 'undefined') return buildInitialData();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = buildInitialData();
      saveStoredData(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    const rawCategories = Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_CATEGORIES;
    const migratedCategories: Category[] = rawCategories.map((c: Category) => {
      if (c.id === 'cat-urgent' || c.name.toLowerCase() === 'urgent') return { ...c, name: 'Timer' };
      return c;
    });

    const settings = (() => {
      const { alwaysOnTop: _legacyAlwaysOnTop, ...storedSettings } = (parsed.settings || {}) as Partial<AppSettings> & { alwaysOnTop?: unknown };
      void _legacyAlwaysOnTop;
      const storedAlarm = (storedSettings as Partial<AppSettings>).alarm;
      return {
        ...DEFAULT_SETTINGS,
        ...storedSettings,
        alarm: normalizeAlarmSettings(storedAlarm),
      };
    })();

    const alarms: Alarm[] = Array.isArray(parsed.alarms) ? dedupeAlarmsBySchedule(parsed.alarms.map((alarm: Alarm) => normalizeAlarm(alarm))) : [];
    const alarmSounds = Array.isArray(parsed.alarmSounds) ? parsed.alarmSounds.filter((sound: AlarmSoundFile) =>
      sound && typeof sound.id === 'string' && typeof sound.relativePath === 'string' && typeof sound.fileName === 'string'
    ) : [];

    return {
      version: 2,
      exportedAt: parsed.exportedAt || Date.now(),
      categories: migratedCategories,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : INITIAL_TASKS,
      urgentTimer: parsed.urgentTimer || null,
      alarms,
      alarmSounds,
      activeAlarm: parsed.activeAlarm && typeof parsed.activeAlarm === 'object' ? parsed.activeAlarm : null,
      settings,
    };
  } catch (err) {
    console.error('Failed to parse local storage, recovering defaults:', err);
    return buildInitialData();
  }
};

export const saveStoredData = (data: NeuroLogData): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
};

export const validateImportData = (raw: unknown): { valid: boolean; data?: NeuroLogData; error?: string } => {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object.' };
  }

  const obj = raw as Partial<NeuroLogData>;
  if (!Array.isArray(obj.categories)) {
    return { valid: false, error: 'Missing or invalid "categories" list.' };
  }
  if (!Array.isArray(obj.tasks)) {
    return { valid: false, error: 'Missing or invalid "tasks" list.' };
  }

  const validatedCategories: Category[] = obj.categories.map((c, i) => ({
    id: typeof c.id === 'string' && c.id.trim() ? c.id : `cat-custom-${Date.now()}-${i}`,
    name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'Unnamed Category',
    isDefault: Boolean(c.isDefault),
    order: typeof c.order === 'number' ? c.order : i,
    subcategories: Array.isArray(c.subcategories)
      ? c.subcategories.map((s: { id?: string; categoryId?: string; name?: string; order?: number }, si: number) => ({
          id: typeof s.id === 'string' ? s.id : `sub-${Date.now()}-${si}`,
          categoryId: typeof s.categoryId === 'string' ? s.categoryId : c.id,
          name: typeof s.name === 'string' ? s.name.trim() : 'Subcategory',
          order: typeof s.order === 'number' ? s.order : si,
        }))
      : [],
  }));

  // Ensure default categories exist
  ['Study', 'Creative', 'Timer'].forEach((defaultName) => {
    if (!validatedCategories.some((c) => c.name.toLowerCase() === defaultName.toLowerCase() || (defaultName === 'Timer' && c.name.toLowerCase() === 'urgent'))) {
      const def = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === defaultName.toLowerCase());
      if (def) validatedCategories.push(def);
    }
  });

  const validatedTasks: Task[] = obj.tasks
    .filter((t) => typeof t.title === 'string' && t.title.trim().length > 0)
    .map((t, i) => ({
      id: typeof t.id === 'string' ? t.id : `task-${Date.now()}-${i}`,
      categoryId: typeof t.categoryId === 'string' ? t.categoryId : 'cat-study',
      subcategoryId: typeof t.subcategoryId === 'string' ? t.subcategoryId : null,
      title: t.title.trim(),
      completed: Boolean(t.completed),
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      completedAt: typeof t.completedAt === 'number' ? t.completedAt : null,
    }));

  const rawSettings = typeof obj.settings === 'object' && obj.settings !== null ? obj.settings as Partial<AppSettings> : {};
  const validatedSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    alarm: normalizeAlarmSettings(rawSettings.alarm),
  };

  let urgentTimer: UrgentTimerState | null = null;
  if (obj.urgentTimer && typeof obj.urgentTimer === 'object') {
    urgentTimer = {
      taskId: String(obj.urgentTimer.taskId || ''),
      taskTitle: String(obj.urgentTimer.taskTitle || ''),
      initialDurationSeconds: Number(obj.urgentTimer.initialDurationSeconds || 300),
      startTimestamp: Number(obj.urgentTimer.startTimestamp || Date.now()),
      targetTimestamp: Number(obj.urgentTimer.targetTimestamp || Date.now() + 300000),
      isPaused: Boolean(obj.urgentTimer.isPaused),
      pausedRemainingSeconds: obj.urgentTimer.pausedRemainingSeconds,
    };
  }

  const validatedAlarms: Alarm[] = Array.isArray((obj as NeuroLogData).alarms)
    ? dedupeAlarmsBySchedule(((obj as NeuroLogData).alarms as unknown[]).filter((alarm): alarm is Alarm => Boolean(alarm && typeof alarm === 'object')).map((alarm) => normalizeAlarm(alarm)))
    : [];

  const validatedAlarmSounds: AlarmSoundFile[] = Array.isArray((obj as NeuroLogData).alarmSounds)
    ? ((obj as NeuroLogData).alarmSounds as unknown[]).filter((sound): sound is AlarmSoundFile => Boolean(sound && typeof sound === 'object' && typeof (sound as AlarmSoundFile).id === 'string' && typeof (sound as AlarmSoundFile).relativePath === 'string' && typeof (sound as AlarmSoundFile).fileName === 'string'))
    : [];

  return {
    valid: true,
    data: {
      version: 2,
      exportedAt: Date.now(),
      categories: validatedCategories,
      tasks: validatedTasks,
      urgentTimer,
      alarms: validatedAlarms,
      alarmSounds: validatedAlarmSounds,
      activeAlarm: null,
      settings: validatedSettings,
    },
  };
};

export const clearAllStoredData = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear localStorage:', err);
  }
};
