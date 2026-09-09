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
  startTime: string;
  endTime: string;
  enabled: boolean;
}

export type CompletedPlacement = 'global' | 'subcategories';
export type SoundTone = 'zen-chime' | 'soft-bell' | 'marimba' | 'sonar';
export type QuickActionKey = 'study' | 'creative' | 'urgent' | 'timer' | 'stopwatch' | 'alarm' | 'quick_add' | 'click_through';

export interface StopwatchState {
  isRunning: boolean;
  startTime: number | null;
  accumulatedMs: number;
  laps: { id: string; timeMs: number; lapDiffMs: number }[];
}

export interface TimerPreset {
  id: string;
  label: string;
  seconds: number;
}

export type BuiltinAlarmSound = 'alarm-pulse' | 'alarm-bell' | 'alarm-digital';
export type AlarmRepeat =
  | { type: 'once' }
  | { type: 'daily' }
  | { type: 'weekly'; weekdays: number[] }
  | { type: 'custom'; intervalDays: number; startDate: string };

export interface AlarmSoundFile {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  createdAt: number;
}

export interface Alarm {
  id: string;
  time: string;
  date?: string;
  label: string;
  enabled: boolean;
  soundId: BuiltinAlarmSound | string;
  repeat: AlarmRepeat;
  windowsNotification: boolean;
  lastTriggeredAt?: number;
  lastOutcome?: 'triggered' | 'missed' | 'dismissed';
  lastOutcomeAt?: number;
}

export interface ActiveAlarmState {
  alarmId: string;
  scheduledFor: number;
  triggeredAt: number;
  missed: boolean;
  snoozeUntil?: number;
  snoozeCount: number;
}

export interface AlarmSettings {
  defaultSnoozeMinutes: number;
  snoozeDurationsMinutes: number[];
  lastSoundId: BuiltinAlarmSound | string;
  defaultWindowsNotification: boolean;
  respectSilentMode: boolean;
}

export interface AppSettings {
  // Appearance
  theme: 'dark' | 'light';
  bgOpacity: number;
  glassBlur: number;
  widgetOpacity: number;
  clickThroughOpacity: number;
  pillScale?: number;
  studyHidden?: boolean;

  // Floating Widget Quick Actions
  enabledQuickActions: QuickActionKey[];

  // Floating Widget & Layout
  clickThroughShortcut: string;
  quickAddShortcut: string;
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
  soundVolume: number;
  soundTone: SoundTone;
  silentMode: boolean;

  // Alarm
  alarm: AlarmSettings;

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
  alarms: Alarm[];
  alarmSounds: AlarmSoundFile[];
  activeAlarm: ActiveAlarmState | null;
  settings: AppSettings;
}
