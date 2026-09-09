import React from 'react';
import { AlarmClock, BellRing, Check, Clock3, GripHorizontal } from 'lucide-react';
import { emit } from '@tauri-apps/api/event';
import { useApp } from '../context/AppContext';
import { formatAlarmTime } from '../utils/alarmScheduler';
import { isNativeWindow } from '../utils/tauriBridge';
import { useNativeSurface } from '../utils/nativeSurface';

export const AlarmPopupModal: React.FC = () => {
  const { activeAlarm, alarms, settings, dismissAlarm, snoozeAlarm } = useApp();
  const nativeWindow = isNativeWindow('alarm-popup');
  const current = activeAlarm ? alarms.find((alarm) => alarm.id === activeAlarm.alarmId) : null;
  const { handleHeaderMouseDown, isDragging } = useNativeSurface({
    label: 'alarm-popup', isPopup: true, defaultWidth: 400, defaultHeight: 340, minWidth: 300, minHeight: 280,
  });

  const snoozeChoices = settings.alarm.snoozeDurationsMinutes.length ? settings.alarm.snoozeDurationsMinutes : [settings.alarm.defaultSnoozeMinutes];
  const isOpen = Boolean(activeAlarm && current);
  if (!isOpen || !activeAlarm || !current) return null;

  const handleDismiss = () => {
    if (nativeWindow) void emit('neurolog-alarm-action', { action: 'dismiss' });
    else dismissAlarm();
  };
  const handleSnooze = (minutes: number) => {
    if (nativeWindow) void emit('neurolog-alarm-action', { action: 'snooze', minutes });
    else snoozeAlarm(minutes);
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full flex items-center justify-center bg-transparent p-3 pointer-events-none animate-in fade-in duration-200">
      <div className="pointer-events-auto w-full max-w-sm border border-violet-500/35 rounded-2xl p-5 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200" style={{ backgroundColor: settings.theme === 'light' ? `rgba(255,255,255,${settings.bgOpacity})` : `rgba(22,22,26,${settings.bgOpacity})` }}>
        <div onMouseDown={handleHeaderMouseDown} className={`w-full flex flex-col items-center gap-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          <div className="w-14 h-14 rounded-full bg-violet-500/15 border border-violet-500/35 flex items-center justify-center text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.32)]"><BellRing className="w-7 h-7 animate-pulse" /></div>
          <div><span className="text-[11px] font-mono font-bold tracking-widest text-violet-300 uppercase">ALARM</span><h3 className="text-lg font-semibold text-slate-100 mt-1">{current.label || 'Alarm'}</h3><p className="text-3xl font-mono font-bold mt-1">{formatAlarmTime(current.time)}</p>{activeAlarm.missed && <p className="text-[10px] text-amber-300 mt-1">Missed while NeuroLog was unavailable</p>}</div>
        </div>
        <div className="w-full pt-2 border-t border-white/[0.08] space-y-2">
          <div className="flex items-center gap-2"><Clock3 className="w-3.5 h-3.5 text-slate-500" /><span className="text-[10px] font-mono text-slate-500">Snooze</span></div>
          <div className="grid grid-cols-4 gap-1.5">{snoozeChoices.map((minutes) => <button key={minutes} onClick={() => handleSnooze(minutes)} className="py-2 rounded-xl bg-white/[0.05] text-slate-300 hover:bg-white/[0.10] border border-white/[0.08] text-xs font-medium active:scale-95">{minutes}m</button>)}</div>
          <button onClick={handleDismiss} className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold shadow-[0_0_18px_rgba(139,92,246,0.3)] active:scale-95 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Dismiss Alarm</button>
        </div>
      </div>
    </div>
  );
};
