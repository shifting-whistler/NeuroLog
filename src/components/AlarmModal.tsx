import React, { useEffect, useMemo, useState } from 'react';
import { AlarmClock, Bell, GripHorizontal, Plus, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Alarm, AlarmRepeat, BuiltinAlarmSound } from '../types';
import { formatAlarmDateTime, formatAlarmTime, getAlarmScheduleKey, getNextOccurrence, getRepeatDescription, normalizeAlarm, parseTime, toLocalDateInput } from '../utils/alarmScheduler';
import { pickAndStoreAlarmSound, readAlarmSound, removeAlarmSound, isNativeWindow, isTauriEnvironment } from '../utils/tauriBridge';
import { soundManager } from '../utils/audio';
import { useNativeSurface } from '../utils/nativeSurface';

const BUILTIN_SOUNDS: { id: BuiltinAlarmSound; label: string }[] = [
  { id: 'alarm-pulse', label: 'Pulse' },
  { id: 'alarm-bell', label: 'Bell' },
  { id: 'alarm-digital', label: 'Digital' },
];

const WEEKDAYS = [
  { id: 1, label: 'M' }, { id: 2, label: 'T' }, { id: 3, label: 'W' }, { id: 4, label: 'T' },
  { id: 5, label: 'F' }, { id: 6, label: 'S' }, { id: 0, label: 'S' },
];

const createNewAlarmDraft = (defaultSoundId: string, defaultWindowsNotification: boolean): Alarm => {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() + 5);
  return {
    id: `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    date: toLocalDateInput(now.getTime()),
    label: '',
    enabled: true,
    soundId: defaultSoundId || 'alarm-pulse',
    repeat: { type: 'once' },
    windowsNotification: defaultWindowsNotification,
  };
};

const formatOutcome = (alarm: Alarm) => {
  if (!alarm.lastOutcome || !alarm.lastOutcomeAt) return null;
  const when = formatAlarmDateTime(alarm.lastOutcomeAt);
  if (alarm.lastOutcome === 'missed') return `Missed · ${when}`;
  if (alarm.lastOutcome === 'dismissed') return `Dismissed · ${when}`;
  return `Triggered · ${when}`;
};

export const AlarmModal: React.FC = () => {
  const {
    alarms,
    alarmSounds,
    settings,
    isAlarmOpen,
    setIsAlarmOpen,
    addAlarm,
    updateAlarm,
    toggleAlarm,
    deleteAlarm,
    addAlarmSound,
    deleteAlarmSound,
    updateSettings,
  } = useApp();
  const nativeWindow = isNativeWindow('alarm');
  const isOpen = nativeWindow ? true : isAlarmOpen;
  const { position, size, isDragging, handleHeaderMouseDown, handleResizeMouseDown, modalRef } = useNativeSurface({
    label: 'alarm', isPopup: true, defaultWidth: 420, defaultHeight: 560, minWidth: 340, minHeight: 400,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAlarm, setDraftAlarm] = useState<Alarm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const builtInOrCustomSounds = useMemo(
    () => ([
      ...BUILTIN_SOUNDS.map((sound) => ({ id: sound.id, label: sound.label, custom: false })),
      ...alarmSounds.map((sound) => ({ id: sound.id, label: sound.name, custom: true })),
    ]),
    [alarmSounds],
  );

  if (!isOpen) return null;

  const beginNewAlarm = () => {
    setError(null);
    setNotice(null);
    setDraftAlarm(createNewAlarmDraft(settings.alarm.lastSoundId || 'alarm-pulse', settings.alarm.defaultWindowsNotification));
    setEditingId('__new_alarm__');
  };

  const beginEditAlarm = (alarm: Alarm) => {
    setError(null);
    setNotice(null);
    setDraftAlarm(normalizeAlarm({ ...alarm, repeat: alarm.repeat.type === 'weekly' ? { ...alarm.repeat, weekdays: [...alarm.repeat.weekdays] } : alarm.repeat.type === 'custom' ? { ...alarm.repeat } : { ...alarm.repeat } }));
    setEditingId(alarm.id);
  };

  const cancelEditor = () => {
    setEditingId(null);
    setDraftAlarm(null);
    setError(null);
  };

  const updateDraft = (updates: Partial<Alarm>) => {
    setDraftAlarm((prev) => (prev ? { ...prev, ...updates } : prev));
    setError(null);
    setNotice(null);
  };

  const updateDraftRepeat = (type: AlarmRepeat['type']) => {
    setDraftAlarm((prev) => {
      if (!prev) return prev;
      const today = toLocalDateInput(Date.now());
      if (type === 'once') {
        const currentDate = prev.date && /^\d{4}-\d{2}-\d{2}$/.test(prev.date) ? prev.date : today;
        return { ...prev, repeat: { type: 'once' }, date: currentDate };
      }
      if (type === 'daily') return { ...prev, repeat: { type: 'daily' } };
      if (type === 'weekly') return { ...prev, repeat: { type: 'weekly', weekdays: [1, 2, 3, 4, 5] } };
      const startDate = prev.repeat.type === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(prev.repeat.startDate) ? prev.repeat.startDate : today;
      return { ...prev, repeat: { type: 'custom', intervalDays: 2, startDate } };
    });
    setError(null);
    setNotice(null);
  };

  const toggleDraftWeekday = (day: number) => {
    setDraftAlarm((prev) => {
      if (!prev || prev.repeat.type !== 'weekly') return prev;
      const next = prev.repeat.weekdays.includes(day)
        ? prev.repeat.weekdays.filter((item) => item !== day)
        : [...prev.repeat.weekdays, day];
      return { ...prev, repeat: { ...prev.repeat, weekdays: next } };
    });
    setError(null);
    setNotice(null);
  };

  const validateDraft = (draft: Alarm): string | null => {
    if (!parseTime(draft.time)) return 'Enter a valid alarm time.';
    if (draft.repeat.type === 'once') {
      if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'Choose a valid alarm date.';
      const midnight = new Date(`${draft.date}T00:00:00`);
      if (Number.isNaN(midnight.getTime())) return 'Choose a valid alarm date.';
    }
    if (draft.repeat.type === 'weekly' && draft.repeat.weekdays.length === 0) return 'Choose at least one weekday.';
    if (draft.repeat.type === 'custom') {
      if (!Number.isInteger(draft.repeat.intervalDays) || draft.repeat.intervalDays < 1 || draft.repeat.intervalDays > 365) return 'Choose a custom interval from 1 to 365 days.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.repeat.startDate)) return 'Choose a valid custom start date.';
    }
    return null;
  };

  const commitDraft = () => {
    if (!draftAlarm || !editingId) return;
    setError(null);
    const validationError = validateDraft(draftAlarm);
    if (validationError) {
      setError(validationError);
      return;
    }

    const isNew = editingId === '__new_alarm__';
    const normalized = normalizeAlarm({
      ...draftAlarm,
      enabled: true,
      repeat: draftAlarm.repeat.type === 'weekly'
        ? { ...draftAlarm.repeat, weekdays: [...draftAlarm.repeat.weekdays].sort((a, b) => a - b) }
        : draftAlarm.repeat.type === 'custom'
        ? { ...draftAlarm.repeat, intervalDays: Math.round(draftAlarm.repeat.intervalDays) }
        : { ...draftAlarm.repeat },
    });

    const duplicate = alarms.some((alarm) => alarm.id !== normalized.id && getAlarmScheduleKey(alarm) === getAlarmScheduleKey(normalized));
    if (duplicate) {
      setError('An alarm with this schedule already exists.');
      return;
    }

    const saved = isNew ? addAlarm(normalized) : updateAlarm(normalized.id, normalized);
    if (!saved) {
      setError(isNew ? 'Could not add this alarm.' : 'Could not save this alarm.');
      return;
    }

    updateSettings({ alarm: { ...settings.alarm, lastSoundId: normalized.soundId } });
    setEditingId(null);
    setDraftAlarm(null);
    setError(null);
    setNotice(isNew ? 'Alarm added.' : 'Alarm updated.');
  };

  const handlePickSound = async () => {
    setError(null);
    if (!isTauriEnvironment()) {
      setError('Custom alarm sounds are available in the desktop app.');
      return;
    }
    try {
      const picked = await pickAndStoreAlarmSound();
      if (!picked) return;
      const bytes = await readAlarmSound(picked.relative_path);
      const extension = picked.file_name.split('.').pop()?.toLowerCase() || 'mp3';
      const valid = await soundManager.validateAudioData(bytes);
      if (!valid) {
        await removeAlarmSound(picked.relative_path);
        setError(`The selected .${extension} file could not be decoded by the desktop audio engine.`);
        return;
      }
      addAlarmSound({
        id: picked.id,
        name: picked.name || 'Custom alarm',
        fileName: picked.file_name,
        relativePath: picked.relative_path,
        createdAt: picked.created_at,
      });
      updateDraft({ soundId: picked.id });
    } catch (e) {
      setError(`Could not add custom sound: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteSound = async (soundId: string) => {
    const sound = alarmSounds.find((item) => item.id === soundId);
    if (!sound) return;
    try {
      await removeAlarmSound(sound.relativePath);
      deleteAlarmSound(soundId);
      if (draftAlarm?.soundId === soundId) updateDraft({ soundId: 'alarm-pulse' });
    } catch (e) {
      setError(`Could not remove custom sound: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const renderEditor = (alarm: Alarm, isNew: boolean) => {
    const weeklyRepeat = alarm.repeat.type === 'weekly' ? alarm.repeat : null;
    const customRepeat = alarm.repeat.type === 'custom' ? alarm.repeat : null;
    return (
    <form onSubmit={(event) => { event.preventDefault(); commitDraft(); }} className={`border-t p-3 space-y-3 ${settings.theme === 'light' ? 'border-slate-200' : 'border-white/[0.06]'}`}>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Time</span>
          <input type="time" value={alarm.time} onChange={(e) => updateDraft({ time: e.target.value })} className={`w-full px-2.5 py-2 rounded-xl border font-mono text-sm ${settings.theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0d0e] border-white/[0.10] text-slate-100'}`} />
        </label>
        <label className="space-y-1">
          <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Name</span>
          <input type="text" value={alarm.label} placeholder="Wake up" onChange={(e) => updateDraft({ label: e.target.value })} className={`w-full px-2.5 py-2 rounded-xl border text-xs ${settings.theme === 'light' ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400' : 'bg-[#0d0d0e] border-white/[0.10] text-slate-100 placeholder:text-slate-600'}`} />
        </label>
      </div>

      <div className="space-y-2">
        <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Repeat</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(['once', 'daily', 'weekly', 'custom'] as AlarmRepeat['type'][]).map((type) => (
            <button key={type} type="button" onClick={() => updateDraftRepeat(type)} className={`py-1.5 rounded-lg text-[10px] font-medium border ${alarm.repeat.type === type ? 'bg-violet-500/15 border-violet-500/35 text-violet-500 dark:text-violet-300' : settings.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900' : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-slate-200'}`}>{type === 'once' ? 'Once' : type === 'daily' ? 'Daily' : type === 'weekly' ? 'Weekdays' : 'Custom'}</button>
          ))}
        </div>
      </div>

      {alarm.repeat.type === 'once' && (
        <label className="space-y-1 block">
          <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Date</span>
          <input type="date" value={alarm.date || toLocalDateInput(Date.now())} onChange={(e) => updateDraft({ date: e.target.value })} className={`w-full px-2.5 py-2 rounded-xl border font-mono text-xs ${settings.theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0d0e] border-white/[0.10] text-slate-100'}`} />
        </label>
      )}

      {alarm.repeat.type === 'weekly' && (
        <div className="space-y-1.5">
          <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Days</span>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <button key={day.id} type="button" onClick={() => toggleDraftWeekday(day.id)} className={`h-8 rounded-lg text-[10px] font-semibold border ${(weeklyRepeat?.weekdays.includes(day.id) ?? false) ? 'bg-violet-500/15 border-violet-500/35 text-violet-500 dark:text-violet-300' : settings.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/[0.03] border-white/[0.07] text-slate-400'}`}>{day.label}</button>
            ))}
          </div>
        </div>
      )}

      {alarm.repeat.type === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Every days</span>
            <input type="number" min="1" max="365" value={customRepeat?.intervalDays ?? 1} onChange={(e) => updateDraft({ repeat: { ...((customRepeat ?? { type: 'custom' as const, intervalDays: 1, startDate: toLocalDateInput(Date.now()) })), intervalDays: Math.min(365, Math.max(1, Number(e.target.value) || 1)) } })} className={`w-full px-2.5 py-2 rounded-xl border font-mono text-xs ${settings.theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0d0e] border-white/[0.10] text-slate-100'}`} />
          </label>
          <label className="space-y-1">
            <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Starts</span>
            <input type="date" value={customRepeat?.startDate ?? toLocalDateInput(Date.now())} onChange={(e) => updateDraft({ repeat: { ...((customRepeat ?? { type: 'custom' as const, intervalDays: 1, startDate: toLocalDateInput(Date.now()) })), startDate: e.target.value } })} className={`w-full px-2.5 py-2 rounded-xl border font-mono text-xs ${settings.theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0d0d0e] border-white/[0.10] text-slate-100'}`} />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-mono uppercase ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Sound</span>
          <button type="button" onClick={async () => {
            const sound = builtInOrCustomSounds.find((item) => item.id === alarm.soundId);
            if (!sound) return;
            if (!sound.custom) {
              soundManager.playAlarm(sound.id === 'alarm-bell' ? 'soft-bell' : sound.id === 'alarm-digital' ? 'sonar' : 'zen-chime', settings.soundVolume);
              return;
            }
            const custom = alarmSounds.find((item) => item.id === sound.id);
            if (!custom || !isTauriEnvironment()) return;
            try {
              const bytes = await readAlarmSound(custom.relativePath);
              const extension = custom.fileName.split('.').pop()?.toLowerCase() || 'mp3';
              const mime = extension === 'wav' ? 'audio/wav' : extension === 'ogg' ? 'audio/ogg' : extension === 'm4a' ? 'audio/mp4' : extension === 'aac' ? 'audio/aac' : 'audio/mpeg';
              await soundManager.previewCustomAlarm(bytes, mime, settings.soundVolume);
            } catch {
              setError('Could not preview this sound file.');
            }
          }} className={`text-[10px] hover:text-violet-500 dark:hover:text-violet-300 flex items-center gap-1 ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}><Volume2 className="w-3 h-3" /> Preview</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {builtInOrCustomSounds.map((sound) => (
            <div key={sound.id} className="flex items-center gap-1">
              <button type="button" onClick={() => updateDraft({ soundId: sound.id })} className={`flex-1 px-2 py-1.5 rounded-lg text-left text-[10px] border truncate ${alarm.soundId === sound.id ? 'bg-violet-500/15 border-violet-500/35 text-violet-600 dark:text-violet-300' : settings.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.03] border-white/[0.07] text-slate-300'}`}>{sound.label}</button>
              {sound.custom && <button type="button" onClick={() => void handleDeleteSound(sound.id)} className={`p-1.5 rounded-lg hover:text-rose-500 dark:hover:text-rose-400 ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}><Trash2 className="w-3 h-3" /></button>}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => void handlePickSound()} className={`w-full py-1.5 rounded-lg border border-dashed text-[10px] hover:border-violet-400/40 flex items-center justify-center gap-1.5 ${settings.theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-white/[0.03] border-white/[0.12] text-slate-400 hover:text-slate-200'}`}><Plus className="w-3 h-3" /> Add custom sound</button>
      </div>

      <div className={`flex items-center justify-between pt-1 border-t ${settings.theme === 'light' ? 'border-slate-200' : 'border-white/[0.06]'}`}>
        <div><span className={`text-[10px] font-medium ${settings.theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>Windows notification</span><p className={`text-[9px] ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Uses the existing native Windows toast layer.</p></div>
        <input type="checkbox" checked={alarm.windowsNotification} onChange={(e) => updateDraft({ windowsNotification: e.target.checked })} className="rounded border-slate-400 text-violet-500" />
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-1">
        <button type="button" onClick={cancelEditor} className={`px-2.5 py-1.5 rounded-lg text-[10px] border ${settings.theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900' : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-200'}`}>Cancel</button>
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 font-semibold text-[10px]">{isNew ? 'Add Alarm' : 'Save Changes'}</button>
      </div>
    </form>
    );
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none w-full h-full">
      <div
        ref={modalRef}
        id="alarm-modal"
        style={{
          transform: nativeWindow ? 'none' : `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: nativeWindow ? '100%' : `min(420px, calc(100vw - 24px))`,
          height: nativeWindow ? '100%' : `${size.height}px`,
          backgroundColor: settings.theme === 'light' ? `rgba(255,255,255,${settings.bgOpacity})` : `rgba(22,22,26,${settings.bgOpacity})`,
          backdropFilter: `blur(${settings.glassBlur}px)`,
          WebkitBackdropFilter: `blur(${settings.glassBlur}px)`,
        }}
        className={`pointer-events-auto fixed top-0 left-0 border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 relative ${settings.theme === 'light' ? 'border-slate-200 text-slate-900' : 'border-white/[0.08] text-slate-100'} ${isDragging ? 'cursor-grabbing' : ''}`}
      >
        <div onMouseDown={handleHeaderMouseDown} className={`flex items-center justify-between px-4 py-3 border-b cursor-grab active:cursor-grabbing shrink-0 ${settings.theme === 'light' ? 'bg-white/85 border-slate-200' : 'bg-[#0d0d0e]/70 border-white/[0.08]'}`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-300"><AlarmClock className="w-4 h-4" /></div>
            <div><h2 className="font-bold text-xs uppercase tracking-wider font-mono">Alarms</h2><p className={`text-[10px] font-mono ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Wake your attention</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`px-1 ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-600'}`}><GripHorizontal className="w-4 h-4" /></div>
            <button type="button" onClick={() => setIsAlarmOpen(false)} className={`p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] ${settings.theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {alarms.length === 0 && !draftAlarm && (
            <div className={`rounded-2xl border border-dashed p-8 text-center ${settings.theme === 'light' ? 'border-slate-300' : 'border-white/[0.12]'}`}>
              <AlarmClock className={`w-7 h-7 mx-auto mb-2 ${settings.theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`} />
              <div className={`text-xs ${settings.theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>No alarms yet.</div>
              <div className={`text-[10px] mt-1 ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Add one for a gentle nudge or a hard stop.</div>
            </div>
          )}

          {alarms.map((alarm) => {
            const next = getNextOccurrence(alarm, Date.now());
            const isEditing = editingId === alarm.id && draftAlarm;
            return (
              <div key={alarm.id} className={`rounded-2xl border transition-colors ${isEditing ? settings.theme === 'light' ? 'border-violet-300 bg-violet-50/70' : 'border-violet-500/40 bg-violet-500/[0.05]' : settings.theme === 'light' ? 'border-slate-200 bg-white/60' : 'border-white/[0.08] bg-[#0d0d0e]/50'}`}>
                <div className="flex items-center gap-3 p-3">
                  <button type="button" onClick={() => toggleAlarm(alarm.id)} className={`w-9 h-9 rounded-xl border flex items-center justify-center ${alarm.enabled ? 'bg-violet-500/15 text-violet-500 dark:text-violet-300 border-violet-500/30' : settings.theme === 'light' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white/[0.04] text-slate-500 border-white/[0.08]'}`} title={alarm.enabled ? 'Disable alarm' : 'Enable alarm'}>
                    {alarm.enabled ? <Bell className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => isEditing ? cancelEditor() : beginEditAlarm(alarm)} className="min-w-0 flex-1 text-left">
                    <div className={`text-2xl leading-none font-mono font-semibold ${alarm.enabled ? settings.theme === 'light' ? 'text-slate-900' : 'text-slate-100' : settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>{formatAlarmTime(alarm.time)}</div>
                    <div className={`flex items-center gap-2 mt-1 text-[10px] font-mono truncate ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}><span>{alarm.label || 'Alarm'}</span><span>·</span><span>{getRepeatDescription(alarm)}</span></div>
                    {next && alarm.enabled && <div className={`text-[10px] mt-1 ${settings.theme === 'light' ? 'text-violet-700' : 'text-violet-300/90'}`}>Next · {formatAlarmDateTime(next)}</div>}
                    {formatOutcome(alarm) && <div className={`text-[9px] mt-0.5 ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>{formatOutcome(alarm)}</div>}
                  </button>
                  <button type="button" onClick={() => deleteAlarm(alarm.id)} className={`p-1.5 rounded-lg hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`} title="Delete alarm"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {isEditing && renderEditor(draftAlarm, false)}
              </div>
            );
          })}

          {draftAlarm && editingId === '__new_alarm__' && (
            <div className={`rounded-2xl border ${settings.theme === 'light' ? 'border-violet-300 bg-violet-50/50' : 'border-violet-500/40 bg-violet-500/[0.05]'}`}>
              <div className="flex items-center gap-2 p-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-300 border border-violet-500/25 flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <div><div className={`text-sm font-semibold ${settings.theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>New Alarm</div><div className={`text-[10px] ${settings.theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Configure it, then save it.</div></div>
              </div>
              {renderEditor(draftAlarm, true)}
            </div>
          )}
        </div>

        {error && <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-500 dark:text-rose-300">{error}</div>}
        {notice && !error && <div className={`mx-3 mb-2 px-3 py-2 rounded-xl border text-[10px] ${settings.theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>{notice}</div>}
        <div className={`p-3 border-t shrink-0 ${settings.theme === 'light' ? 'border-slate-200' : 'border-white/[0.06]'}`}>
          <button type="button" onClick={() => editingId === '__new_alarm__' ? undefined : beginNewAlarm()} disabled={editingId === '__new_alarm__'} className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-default text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(139,92,246,0.25)]"><Plus className="w-4 h-4" /> {editingId === '__new_alarm__' ? 'Add Alarm' : 'New Alarm'}</button>
        </div>
        <div onMouseDown={handleResizeMouseDown} title="Drag to resize panel" className={`absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-50 flex items-end justify-end p-1 hover:text-violet-500 dark:hover:text-violet-400 ${settings.theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}><svg viewBox="0 0 8 8" className="w-2.5 h-2.5 fill-current opacity-70"><circle cx="7" cy="7" r="1" /><circle cx="7" cy="4" r="1" /><circle cx="4" cy="7" r="1" /></svg></div>
      </div>
    </div>
  );
};
