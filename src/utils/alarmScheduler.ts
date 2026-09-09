import type { Alarm, AlarmRepeat, NeuroLogData } from '../types';

export const ALARM_MISSED_GRACE_MS = 2 * 60 * 60 * 1000;

const pad2 = (value: number) => String(value).padStart(2, '0');

export const getLocalDateKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const getTimeValue = (timestamp: number): number => {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
};

export const parseTime = (time: string): { hour: number; minute: number } | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

export const toLocalDateInput = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const parseDateKey = (dateKey: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return null;
  return { year, month, day };
};

const dateFromKeyAndTime = (dateKey: string, time: string): number | null => {
  const parsed = parseTime(time);
  const dateParts = parseDateKey(dateKey);
  if (!parsed || !dateParts) return null;
  const date = new Date(dateParts.year, dateParts.month - 1, dateParts.day, parsed.hour, parsed.minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const matchesRepeatOnDate = (repeat: AlarmRepeat, date: Date, alarm: Alarm): boolean => {
  if (repeat.type === 'daily') return true;
  if (repeat.type === 'weekly') return repeat.weekdays.includes(date.getDay());
  if (repeat.type === 'custom') {
    const startKey = repeat.startDate || alarm.date || toLocalDateInput(date.getTime());
    const startParts = parseDateKey(startKey);
    if (!startParts) return false;
    const start = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
    const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((current - start) / 86400000);
    const interval = Math.max(1, Math.floor(repeat.intervalDays || 1));
    return diffDays >= 0 && diffDays % interval === 0;
  }
  return false;
};

export const getNextOccurrence = (alarm: Alarm, fromTimestamp = Date.now()): number | null => {
  if (!alarm.enabled) return null;
  const parsedTime = parseTime(alarm.time);
  if (!parsedTime) return null;

  if (alarm.repeat.type === 'once') {
    const dateKey = alarm.date || toLocalDateInput(fromTimestamp);
    const target = dateFromKeyAndTime(dateKey, alarm.time);
    return target !== null && target > fromTimestamp ? target : null;
  }

  const from = new Date(fromTimestamp);
  from.setSeconds(0, 0);

  for (let offset = 0; offset <= 366; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    if (candidate.getTime() <= fromTimestamp) continue;
    if (matchesRepeatOnDate(alarm.repeat, candidate, alarm)) return candidate.getTime();
  }

  return null;
};

export const getDueOccurrence = (alarm: Alarm, nowTimestamp = Date.now()): number | null => {
  if (!alarm.enabled) return null;
  const parsedTime = parseTime(alarm.time);
  if (!parsedTime) return null;

  const lastTriggeredAt = alarm.lastTriggeredAt || 0;

  if (alarm.repeat.type === 'once') {
    const dateKey = alarm.date || toLocalDateInput(nowTimestamp);
    const target = dateFromKeyAndTime(dateKey, alarm.time);
    if (target === null || target > nowTimestamp) return null;
    if (target <= lastTriggeredAt) return null;
    return target;
  }

  const now = new Date(nowTimestamp);
  for (let offset = 0; offset <= 366; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() - offset);
    candidate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    const target = candidate.getTime();
    if (target > nowTimestamp) continue;
    if (target <= lastTriggeredAt) break;
    if (matchesRepeatOnDate(alarm.repeat, candidate, alarm)) return target;
  }

  return null;
};

export const formatAlarmDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const formatAlarmTime = (time: string): string => {
  const parsed = parseTime(time);
  if (!parsed) return time;
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

export const getRepeatDescription = (alarm: Alarm): string => {
  switch (alarm.repeat.type) {
    case 'once':
      return alarm.date ? `Once · ${alarm.date}` : 'One time';
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return alarm.repeat.weekdays.length
        ? alarm.repeat.weekdays.slice().sort((a, b) => a - b).map((day) => names[day]).join(' · ')
        : 'Weekly';
    }
    case 'custom':
      return `Every ${Math.max(1, alarm.repeat.intervalDays || 1)} day${Math.max(1, alarm.repeat.intervalDays || 1) === 1 ? '' : 's'}`;
  }
};

export const normalizeAlarm = (alarm: Alarm): Alarm => {
  const fallbackDate = alarm.date || toLocalDateInput(Date.now());
  const repeat = alarm.repeat?.type === 'weekly'
    ? { type: 'weekly' as const, weekdays: Array.isArray(alarm.repeat.weekdays) ? alarm.repeat.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).filter((day, index, all) => all.indexOf(day) === index).sort((a, b) => a - b) : [] }
    : alarm.repeat?.type === 'custom'
    ? { type: 'custom' as const, intervalDays: Math.max(1, Math.floor(alarm.repeat.intervalDays || 1)), startDate: alarm.repeat.startDate || fallbackDate }
    : alarm.repeat?.type === 'daily'
    ? { type: 'daily' as const }
    : { type: 'once' as const };

  return {
    ...alarm,
    id: typeof alarm.id === 'string' && alarm.id ? alarm.id : `alarm-${Date.now()}`,
    label: typeof alarm.label === 'string' ? alarm.label.trim() : '',
    time: parseTime(alarm.time) ? alarm.time : '07:00',
    date: fallbackDate,
    enabled: Boolean(alarm.enabled),
    repeat,
    soundId: typeof alarm.soundId === 'string' && alarm.soundId ? alarm.soundId : 'alarm-pulse',
    windowsNotification: Boolean(alarm.windowsNotification),
    lastOutcome: alarm.lastOutcome === 'missed' || alarm.lastOutcome === 'dismissed' || alarm.lastOutcome === 'triggered' ? alarm.lastOutcome : undefined,
    lastTriggeredAt: typeof alarm.lastTriggeredAt === 'number' ? alarm.lastTriggeredAt : undefined,
    lastOutcomeAt: typeof alarm.lastOutcomeAt === 'number' ? alarm.lastOutcomeAt : undefined,
  };
};


export const getAlarmScheduleKey = (alarm: Alarm): string => {
  const normalized = normalizeAlarm(alarm);
  switch (normalized.repeat.type) {
    case 'once':
      return `once|${normalized.time}|${normalized.date || ''}`;
    case 'daily':
      return `daily|${normalized.time}`;
    case 'weekly':
      return `weekly|${normalized.time}|${[...normalized.repeat.weekdays].sort((a, b) => a - b).filter((day, index, all) => index === 0 || all[index - 1] !== day).join(',')}`;
    case 'custom':
      return `custom|${normalized.time}|${normalized.repeat.intervalDays}|${normalized.repeat.startDate}`;
  }
};

export const dedupeAlarmsBySchedule = (alarms: Alarm[]): Alarm[] => {
  const seen = new Set<string>();
  const result: Alarm[] = [];
  for (const alarm of alarms) {
    const normalized = normalizeAlarm(alarm);
    const key = getAlarmScheduleKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
};

export const normalizeAlarmData = (data: NeuroLogData): NeuroLogData => {
  const rawActive = data.activeAlarm;
  const activeAlarm = rawActive && typeof rawActive === 'object' && typeof rawActive.alarmId === 'string'
    && typeof rawActive.scheduledFor === 'number' && Number.isFinite(rawActive.scheduledFor)
    && typeof rawActive.triggeredAt === 'number' && Number.isFinite(rawActive.triggeredAt)
    ? {
        alarmId: rawActive.alarmId,
        scheduledFor: rawActive.scheduledFor,
        triggeredAt: rawActive.triggeredAt,
        missed: Boolean(rawActive.missed),
        snoozeUntil: typeof rawActive.snoozeUntil === 'number' && Number.isFinite(rawActive.snoozeUntil) ? rawActive.snoozeUntil : undefined,
        snoozeCount: typeof rawActive.snoozeCount === 'number' && Number.isFinite(rawActive.snoozeCount) ? Math.max(0, Math.floor(rawActive.snoozeCount)) : 0,
      }
    : null;

  return {
    ...data,
    alarms: Array.isArray(data.alarms) ? dedupeAlarmsBySchedule(data.alarms) : [],
    alarmSounds: Array.isArray(data.alarmSounds) ? data.alarmSounds.filter((sound) =>
      Boolean(sound && typeof sound.id === 'string' && typeof sound.name === 'string' && typeof sound.fileName === 'string' && typeof sound.relativePath === 'string')
    ) : [],
    activeAlarm,
  };
};
