export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  order: number;
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  order: number;
  subcategories: Subcategory[];
}

export interface Task {
  id: string;
  categoryId: string;
  subcategoryId?: string | null;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number | null;
}

export interface UrgentTimerState {
  taskId: string;
  taskTitle: string;
  initialDurationSeconds: number;
  startTimestamp: number;
  targetTimestamp: number;
  isPaused: boolean;
  pausedRemainingSeconds?: number;
}

export interface CreativeSchedule {
  id: string;
  label: string;
  startTime: string; // "HH:MM" 24h format
  endTime: string;   // "HH:MM" 24h format
  enabled: boolean;
}

export type CompletedPlacement = 'global' | 'subcategories';
export type SoundTone = 'zen-chime' | 'soft-bell' | 'marimba' | 'sonar';
export type QuickActionKey = 'study' | 'creative' | 'urgent' | 'timer' | 'stopwatch' | 'quick_add' | 'click_through';

export interface StopwatchState {
  isRunning: boolean;
  startTime: number | null; // Date.now() timestamp when current run started
  accumulatedMs: number;    // accumulated elapsed ms before current run
  laps: { id: string; timeMs: number; lapDiffMs: number }[];
}

export interface TimerPreset {
  id: string;
  label: string;
  seconds: number;
}

export interface AppSettings {
  // Appearance
  theme: 'dark' | 'light';
  bgOpacity: number; // 0.3 - 1.0
  glassBlur: number; // 0 - 30 px
  widgetOpacity: number; // 0.3 - 1.0
  clickThroughOpacity: number; // 0.05 - 0.9
  pillScale?: number; // 0.7 - 1.4 (default 1.0)
  studyHidden?: boolean;

  // Floating Widget Quick Actions
  enabledQuickActions: QuickActionKey[];

  // Floating Widget & Layout
  clickThroughShortcut: string; // e.g. "Ctrl+Alt+X"
  quickAddShortcut: string; // e.g. "Ctrl+Alt+N"
  rememberPosition: boolean;
  lastPosition: { x: number; y: number };
  showClickThroughIndicator: boolean;
  panelSize: { width: number; height: number };

  // Task & Timer Behavior
  completedPlacement: CompletedPlacement;
  confirmTaskDelete: boolean;
  displayTimestamp: boolean;
  timerPresets: TimerPreset[];

  // Creative Time
  creativeSchedules: CreativeSchedule[];
  creativeStartSound: boolean;
  creativeStartNotification: boolean;
  creativeStartAutoOpen: boolean;
  creativeEndSound: boolean;
  creativeEndNotification: boolean;
  creativeEndWarning: boolean;

  // Urgent & Notifications
  urgentSound: boolean;
  urgentNotification: boolean;
  soundVolume: number; // 0 - 100
  soundTone: SoundTone;
  silentMode: boolean;

  // System
  launchOnStartup: boolean;
  minimizeToTray: boolean;
}

export interface NeuroLogData {
  version: number;
  exportedAt: number;
  categories: Category[];
  tasks: Task[];
  urgentTimer: UrgentTimerState | null;
  settings: AppSettings;
}
