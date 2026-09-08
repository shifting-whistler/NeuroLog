import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Play, Pause, Square, Plus, CheckCircle2, X, BookmarkPlus } from 'lucide-react';
import { TaskItem } from './TaskItem';
import { TimerPreset } from '../types';
import { formatDurationHMS } from '../utils/time';

export const UrgentTimerView: React.FC = () => {
  const {
    tasks,
    urgentTimer,
    startUrgentTask,
    pauseUrgentTimer,
    resumeUrgentTimer,
    stopUrgentTimer,
    extendUrgentTimer,
    settings,
    updateSettings,
  } = useApp();

  const [taskInput, setTaskInput] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<number>(300); // 5 mins default
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customHours, setCustomHours] = useState<number>(0);
  const [customMins, setCustomMins] = useState<number>(15);
  const [customSecs, setCustomSecs] = useState<number>(0);
  const [newPresetLabel, setNewPresetLabel] = useState<string>('');
  const [showSavePreset, setShowSavePreset] = useState<boolean>(false);

  const timerTasks = tasks.filter((t) => t.categoryId === 'cat-urgent');
  const pendingTimerTasks = timerTasks.filter((t) => !t.completed);
  const completedTimerTasks = timerTasks.filter((t) => t.completed);

  const presets = settings.timerPresets || [
    { label: '2m', seconds: 120 },
    { label: '5m', seconds: 300 },
    { label: '10m', seconds: 600 },
    { label: '15m', seconds: 900 },
    { label: '25m', seconds: 1500 },
    { label: '45m', seconds: 2700 },
    { label: '1h', seconds: 3600 },
  ];

  const handleStartTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskInput.trim();
    if (!trimmed) return;

    let finalDuration = selectedDuration;
    if (isCustomMode) {
      finalDuration = Math.max(10, customHours * 3600 + customMins * 60 + customSecs);
    }

    startUrgentTask(trimmed, finalDuration);
    setTaskInput('');
  };

  const handleSaveCurrentAsPreset = () => {
    const totalSecs = customHours * 3600 + customMins * 60 + customSecs;
    if (totalSecs < 10) return;

    let autoLabel = '';
    if (customHours > 0) autoLabel += `${customHours}h `;
    if (customMins > 0) autoLabel += `${customMins}m `;
    if (customSecs > 0 && customHours === 0) autoLabel += `${customSecs}s`;
    autoLabel = autoLabel.trim();

    const labelToUse = newPresetLabel.trim() || autoLabel || `${Math.ceil(totalSecs / 60)}m`;

    // Avoid duplicate seconds
    const updatedPresets: TimerPreset[] = [
      ...presets.filter((p) => p.seconds !== totalSecs),
      { id: `preset-${Date.now()}`, label: labelToUse, seconds: totalSecs },
    ];
    // Sort by seconds
    updatedPresets.sort((a, b) => a.seconds - b.seconds);

    updateSettings({ timerPresets: updatedPresets });
    setSelectedDuration(totalSecs);
    setIsCustomMode(false);
    setShowSavePreset(false);
    setNewPresetLabel('');
  };

  const handleDeletePreset = (secs: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (presets.length <= 1) return;
    const updated = presets.filter((p) => p.seconds !== secs);
    updateSettings({ timerPresets: updated });
    if (selectedDuration === secs && updated.length > 0) {
      setSelectedDuration(updated[0].seconds);
    }
  };

  const [displayRemainingSeconds, setDisplayRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!urgentTimer) {
      setDisplayRemainingSeconds(0);
      return;
    }

    const update = () => {
      if (urgentTimer.isPaused) {
        setDisplayRemainingSeconds(urgentTimer.pausedRemainingSeconds || 0);
        return;
      }
      setDisplayRemainingSeconds(Math.max(0, Math.ceil((urgentTimer.targetTimestamp - Date.now()) / 1000)));
    };

    update();
    const interval = window.setInterval(update, 500);
    return () => window.clearInterval(interval);
  }, [urgentTimer?.targetTimestamp, urgentTimer?.isPaused, urgentTimer?.pausedRemainingSeconds]);

  return (
    <div className="flex flex-col gap-4">
      {/* Active Timer Card or Timer Launcher */}
      {urgentTimer ? (
        <div
          id="urgent-active-card"
          className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-[#16161a] via-[#16161a] to-orange-950/30 border border-orange-500/30 shadow-2xl"
        >
          {/* Top banner */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-orange-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
              </span>
              ACTIVE TIMER
            </span>
            <span className="text-slate-500 text-[11px]">Single-Task Focus</span>
          </div>

          {/* Task title */}
          <h2 className="text-sm font-semibold text-slate-100 mt-2 line-clamp-2 break-words">
            {urgentTimer.taskTitle}
          </h2>

          {/* Large Countdown Display */}
          <div className="my-3 flex items-center justify-center">
            <div className="font-mono text-3xl font-bold tracking-widest text-orange-400 drop-shadow-[0_0_16px_rgba(249,115,22,0.4)]">
              {formatDurationHMS(displayRemainingSeconds)}
            </div>
          </div>

          {/* Timer Actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center gap-1.5">
              {urgentTimer.isPaused ? (
                <button
                  id="resume-urgent-btn"
                  onClick={resumeUrgentTimer}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-medium hover:bg-orange-500/30 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Resume
                </button>
              ) : (
                <button
                  id="pause-urgent-btn"
                  onClick={pauseUrgentTimer}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] text-slate-300 border border-white/[0.08] text-xs font-medium hover:bg-white/[0.12] hover:text-white transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause
                </button>
              )}

              <button
                id="cancel-urgent-btn"
                onClick={() => stopUrgentTimer(false)}
                title="Discard Timer"
                className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Finish / Done button */}
            <button
              id="finish-urgent-btn"
              onClick={() => stopUrgentTimer(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-semibold transition-all shadow-[0_0_16px_rgba(249,115,22,0.4)] active:scale-95 border border-orange-400/40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Done
            </button>
          </div>
        </div>
      ) : (
        /* Create Timer Task Form */
        <form
          id="urgent-create-form"
          onSubmit={handleStartTimer}
          className="flex flex-col gap-3 p-3.5 rounded-2xl bg-[#16161a]/90 border border-white/[0.08] shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              Start Task Timer
            </span>
            <span className="text-[10px] text-slate-500">Focused Countdown</span>
          </div>

          <input
            id="urgent-task-input"
            type="text"
            placeholder="What are you working on right now?"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-[#0d0d0e] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500/60 transition-colors"
            autoFocus
          />

          {/* Preset durations & Custom toggle */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Duration Presets</span>
              <button
                type="button"
                onClick={() => setIsCustomMode(!isCustomMode)}
                className={`text-[11px] font-medium transition-colors ${
                  isCustomMode ? 'text-orange-400 underline' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isCustomMode ? 'Use Presets' : 'Custom Time'}
              </button>
            </div>

            {!isCustomMode ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((p) => (
                  <div key={p.seconds} className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDuration(p.seconds);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                        selectedDuration === p.seconds
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                          : 'bg-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] border border-transparent'
                      }`}
                    >
                      <span>{p.label}</span>
                    </button>
                    {presets.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(p.seconds, e)}
                        title={`Remove ${p.label} preset`}
                        className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-neutral-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center border border-white/20 transition-all text-[9px]"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Custom duration dials with Hours, Minutes, Seconds */
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[#0d0d0e]/80 border border-white/[0.06] animate-in fade-in duration-100">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-center gap-1 text-xs">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={customHours}
                      onChange={(e) => setCustomHours(Math.min(24, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-10 text-center bg-[#16161a] border border-white/[0.08] rounded py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-slate-400 text-[11px]">hr</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1 text-xs">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={customMins}
                      onChange={(e) => setCustomMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-10 text-center bg-[#16161a] border border-white/[0.08] rounded py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-slate-400 text-[11px]">min</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1 text-xs">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="15"
                      value={customSecs}
                      onChange={(e) => setCustomSecs(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-10 text-center bg-[#16161a] border border-white/[0.08] rounded py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-slate-400 text-[11px]">sec</span>
                  </div>
                </div>

                {/* Optional Save as Preset */}
                {!showSavePreset ? (
                  <button
                    type="button"
                    onClick={() => setShowSavePreset(true)}
                    className="self-end text-[10px] text-slate-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    Save as Preset
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                    <input
                      type="text"
                      placeholder="Preset label (e.g. 45m Focus)"
                      value={newPresetLabel}
                      onChange={(e) => setNewPresetLabel(e.target.value)}
                      className="flex-1 px-2 py-1 text-[11px] bg-[#16161a] border border-white/[0.08] rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCurrentAsPreset}
                      className="px-2.5 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[11px] font-medium border border-orange-500/30 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSavePreset(false)}
                      className="p-1 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            id="start-urgent-timer-btn"
            type="submit"
            disabled={!taskInput.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-semibold disabled:opacity-40 disabled:hover:bg-orange-500 transition-all shadow-[0_0_16px_rgba(249,115,22,0.3)] active:scale-[0.98] border border-orange-400/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Timer
          </button>
        </form>
      )}

      {/* Timer Tasks Queue & History */}
      <div className="flex flex-col gap-2">
        {pendingTimerTasks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
              Queued Timer Tasks ({pendingTimerTasks.length})
            </span>
            {pendingTimerTasks.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        )}

        {completedTimerTasks.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2 pt-3 border-t border-white/[0.08]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
              Completed ({completedTimerTasks.length})
            </span>
            {completedTimerTasks.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>


    </div>
  );
};
