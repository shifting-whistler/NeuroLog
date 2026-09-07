import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useApp } from '../context/AppContext';
import { useNativeSurface } from '../utils/nativeSurface';
import { isNativeWindow, isTauriEnvironment, positionNativeWindow, ensurePillFitsWorkArea, WINDOW_LABELS, openExternalUrl } from '../utils/tauriBridge';
import {
  X,
  Palette,
  Sliders,
  CheckSquare,
  Lightbulb,
  Volume2,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Play,
  RotateCcw,
  Package,
  GripHorizontal,
  BookOpen,
  Clock,
  Timer,
  Zap,
  EyeOff,
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import { QuickActionKey, SoundTone } from '../types';
import { downloadFile } from '../utils/zipGenerator';
import { validateImportData } from '../utils/storage';
import { GITHUB_REPOSITORY_URL } from '../config/links';

// Shortcut Recorder Input Component
const ShortcutInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setIsRecording(false);
      return;
    }

    // Ignore solitary modifier presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey && !e.ctrlKey) parts.push('Cmd');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    // Key representation
    let keyName = e.key.toUpperCase();
    if (e.code.startsWith('Key')) {
      keyName = e.code.replace('Key', '');
    } else if (e.code.startsWith('Digit')) {
      keyName = e.code.replace('Digit', '');
    } else if (keyName === ' ') {
      keyName = 'Space';
    }

    parts.push(keyName);
    const result = parts.join('+');
    onChange(result);
    setIsRecording(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        readOnly
        value={isRecording ? 'Press keys...' : value}
        onFocus={() => setIsRecording(true)}
        onBlur={() => setIsRecording(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Click to record'}
        title="Click and press your desired shortcut key combination"
        className={`w-32 px-2.5 py-1 text-center rounded-lg font-mono text-xs transition-all cursor-pointer ${
          isRecording
            ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-500 animate-pulse'
            : 'bg-[#0d0d0e] border border-white/[0.08] text-slate-200 hover:border-white/20 focus:border-blue-500'
        }`}
      />
      <button
        type="button"
        onClick={() => setIsRecording(!isRecording)}
        className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
          isRecording
            ? 'bg-blue-500 text-white border-blue-400'
            : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-slate-200 border-white/[0.08]'
        }`}
      >
        {isRecording ? 'Listening' : 'Record'}
      </button>
    </div>
  );
};

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    settings,
    updateSettings,
    resetSettings,
    factoryReset,
    getExportData,
    importAppData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'appearance' | 'widget' | 'tasks' | 'creative' | 'audio' | 'data'
  >('appearance');

  const [newScheduleLabel, setNewScheduleLabel] = useState('');
  const [newScheduleStart, setNewScheduleStart] = useState('14:00');
  const [newScheduleEnd, setNewScheduleEnd] = useState('16:00');
  const [importError, setImportError] = useState<string | null>(null);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [showFactoryConfirm, setShowFactoryConfirm] = useState<boolean>(false);

  const nativeWindow = isNativeWindow('settings');
  const isOpen = nativeWindow ? true : isSettingsOpen;
  const { position, size, isDragging, handleHeaderMouseDown, handleResizeMouseDown, modalRef } = useNativeSurface({
    label: 'settings',
    isPopup: true,
    defaultWidth: 500,
    defaultHeight: 580,
    minWidth: 300,
    minHeight: 220,
  });

  if (!isOpen) return null;

  const tones: { label: string; id: SoundTone }[] = [
    { label: 'Zen Chime', id: 'zen-chime' },
    { label: 'Soft Bell', id: 'soft-bell' },
    { label: 'Warm Marimba', id: 'marimba' },
    { label: 'Sonar Pulse', id: 'sonar' },
  ];

  const handleExportJson = async () => {
    setImportError(null);
    setBackupSuccessMessage(null);
    const exported = getExportData();
    const filename = `neurolog-backup-${new Date().toISOString().slice(0, 10)}.json`;

    try {
      if (isTauriEnvironment()) {
        await invoke('export_backup', {
          data: JSON.stringify(exported, null, 2),
          defaultFilename: filename,
        });
      } else {
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
        downloadFile(blob, filename);
      }
      setBackupSuccessMessage('✓ Backup exported successfully!');
      setTimeout(() => setBackupSuccessMessage(null), 3000);
    } catch (error) {
      setImportError(`Failed to export backup: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  const processImportedJson = (rawText: string) => {
    try {
      const raw = JSON.parse(rawText);
      const result = validateImportData(raw);
      if (result.valid && result.data) {
        importAppData(result.data);
        setImportError(null);
        setBackupSuccessMessage('✓ Data imported successfully!');
        setTimeout(() => setBackupSuccessMessage(null), 3000);
      } else {
        setBackupSuccessMessage(null);
        setImportError(result.error || 'Invalid backup format.');
      }
    } catch {
      setBackupSuccessMessage(null);
      setImportError('Failed to parse JSON file.');
    }
  };

  const handleImportJson = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setBackupSuccessMessage(null);
    try {
      if (isTauriEnvironment()) {
        const rawText = await invoke<string | null>('import_backup');
        if (rawText === null) return;
        processImportedJson(rawText);
      } else {
        const file = e?.target.files?.[0];
        if (!file) return;
        processImportedJson(await file.text());
        if (e) e.target.value = '';
      }
    } catch (error) {
      setImportError(`Failed to import backup: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  // Open the project repository on GitHub
  const handleOpenGitHubProject = () => {
    void openExternalUrl(GITHUB_REPOSITORY_URL);
  };

  const handleAddSchedule = () => {
    if (!newScheduleLabel.trim()) return;
    const newSched = {
      id: `sched-${Date.now()}`,
      label: newScheduleLabel.trim(),
      startTime: newScheduleStart,
      endTime: newScheduleEnd,
      enabled: true,
    };
    updateSettings({
      creativeSchedules: [...settings.creativeSchedules, newSched],
    });
    setNewScheduleLabel('');
  };

  const handleDeleteSchedule = (id: string) => {
    updateSettings({
      creativeSchedules: settings.creativeSchedules.filter((s) => s.id !== id),
    });
  };

  const handleToggleSchedule = (id: string) => {
    updateSettings({
      creativeSchedules: settings.creativeSchedules.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    });
  };

  const toggleQuickAction = (key: QuickActionKey) => {
    const current = settings.enabledQuickActions || ['study', 'creative', 'urgent', 'stopwatch', 'quick_add'];
    const updated = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    updateSettings({ enabledQuickActions: updated });
  };

  const enabledActions = settings.enabledQuickActions || ['study', 'creative', 'urgent', 'stopwatch', 'quick_add'];

  return (
    <div
      id="settings-overlay"
      className="fixed inset-0 z-50 pointer-events-none w-full h-full"
    >
      <div
        ref={modalRef}
        id="settings-modal"
        style={{
          transform: nativeWindow ? 'none' : `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: nativeWindow ? '100%' : 'min(500px, calc(100vw - 24px))',
          height: nativeWindow ? '100%' : undefined,
          maxHeight: nativeWindow ? '100%' : undefined,
          backgroundColor: settings.theme === 'light'
            ? `rgba(255, 255, 255, ${settings.bgOpacity})`
            : `rgba(22, 22, 26, ${settings.bgOpacity})`,
          backdropFilter: `blur(${settings.glassBlur}px)`,
          WebkitBackdropFilter: `blur(${settings.glassBlur}px)`,
        }}
        className={`pointer-events-auto fixed top-0 left-0 max-h-[85vh] border border-white/[0.08] rounded-2xl p-0 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none relative ${
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
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-mono">
                Preferences & Settings
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">Custom configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-slate-600 px-1" title="Drag to move panel">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <button
              id="settings-close-btn"
              onClick={() => setIsSettingsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-3 py-2 bg-[#0d0d0e]/40 border-b border-white/[0.06] overflow-x-auto text-xs shrink-0 scrollbar-none">
          {[
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'widget', label: 'Widget & Actions', icon: Sliders },
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'creative', label: 'Creative Time', icon: Lightbulb },
            { id: 'audio', label: 'Audio & Alerts', icon: Volume2 },
            { id: 'data', label: 'Data & Project', icon: HardDrive },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents (Scrollable body) */}
        <div className="flex-1 overflow-y-auto p-4 text-xs text-slate-300 space-y-4">
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {/* Theme Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-slate-200">Color Mode</label>
                  <p className="text-[11px] text-slate-500">Dark mode is default & recommended</p>
                </div>
                <div className="flex items-center gap-1 bg-[#0d0d0e] p-1 rounded-xl border border-white/[0.08]">
                  <button
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      settings.theme === 'dark'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      settings.theme === 'light'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>

              {/* Floating Pill Size */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-200">Floating Pill Size</span>
                  <span className="font-mono text-blue-400">
                    {Math.round((settings.pillScale || 1.0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={settings.pillScale || 1.0}
                  onChange={(e) => updateSettings({ pillScale: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 bg-[#0d0d0e] rounded-lg h-1.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10.5px] text-slate-500 font-mono">
                  <span>70% (Compact)</span>
                  <span>100% (Default)</span>
                  <span>140% (Large)</span>
                </div>
              </div>

              {/* Background Opacity */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-200">Panel Background Opacity</span>
                  <span className="font-mono text-blue-400">
                    {Math.round(settings.bgOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.0"
                  step="0.02"
                  value={settings.bgOpacity}
                  onChange={(e) => updateSettings({ bgOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-blue-500 bg-[#0d0d0e] rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              {/* Glass Blur Intensity */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-200">Glass Blur Strength</span>
                  <span className="font-mono text-blue-400">{settings.glassBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="2"
                  value={settings.glassBlur}
                  onChange={(e) => updateSettings({ glassBlur: parseInt(e.target.value) })}
                  className="w-full accent-blue-500 bg-[#0d0d0e] rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-200">Collapsed Widget Normal Opacity</span>
                  <span className="font-mono text-blue-400">{Math.round(settings.widgetOpacity * 100)}%</span>
                </div>
                <input type="range" min="0.3" max="1.0" step="0.05" value={settings.widgetOpacity} onChange={(e) => updateSettings({ widgetOpacity: parseFloat(e.target.value) })} className="w-full accent-blue-500 bg-[#0d0d0e] rounded-lg h-1.5 cursor-pointer" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-200">Click-Through Mode Opacity</span>
                  <span className="font-mono text-blue-400">{Math.round(settings.clickThroughOpacity * 100)}%</span>
                </div>
                <input type="range" min="0.05" max="0.9" step="0.05" value={settings.clickThroughOpacity} onChange={(e) => updateSettings({ clickThroughOpacity: parseFloat(e.target.value) })} className="w-full accent-blue-500 bg-[#0d0d0e] rounded-lg h-1.5 cursor-pointer" />
              </div>
            </div>
          )}

          {/* TAB 2: WIDGET & QUICK ACTIONS */}
          {activeTab === 'widget' && (
            <div className="space-y-4">
              {/* Quick Action Buttons on Floating Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100">Floating Bar Quick Actions</span>
                  <span className="text-[10px] text-slate-500 font-mono">Icons on floating pill</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select which one-click action icons appear directly on your floating widget:
                </p>

                <div className="space-y-1.5 pt-1">
                  {[
                    {
                      key: 'study' as QuickActionKey,
                      label: 'Study Tasks',
                      desc: 'Direct jump to Study list',
                      icon: BookOpen,
                      color: 'text-blue-400',
                    },
                    {
                      key: 'creative' as QuickActionKey,
                      label: 'Creative Time & Ideas',
                      desc: 'Direct jump to Creative thoughts',
                      icon: Lightbulb,
                      color: 'text-amber-400',
                    },
                    {
                      key: 'urgent' as QuickActionKey,
                      label: 'Task Timer',
                      desc: 'Direct jump to Timer countdown',
                      icon: Clock,
                      color: 'text-orange-400',
                    },
                    {
                      key: 'stopwatch' as QuickActionKey,
                      label: 'Stopwatch',
                      desc: 'One-click stopwatch launcher',
                      icon: Timer,
                      color: 'text-cyan-400',
                    },
                    {
                      key: 'quick_add' as QuickActionKey,
                      label: 'Quick Task Capture',
                      desc: 'Fast thought dump modal',
                      icon: Zap,
                      color: 'text-emerald-400',
                    },
                    {
                      key: 'click_through' as QuickActionKey,
                      label: 'Click-Through',
                      desc: 'Show a clickable pass-through control on the pill',
                      icon: EyeOff,
                      color: 'text-blue-400',
                    },
                  ].map((act) => {
                    const Icon = act.icon;
                    const isChecked = enabledActions.includes(act.key) || (act.key === 'urgent' && enabledActions.includes('timer'));
                    return (
                      <div
                        key={act.key}
                        onClick={() => toggleQuickAction(act.key)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-blue-500/10 border-blue-500/40 text-slate-200'
                            : 'bg-[#0d0d0e] border-white/[0.06] text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg bg-white/[0.05] ${act.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-medium text-xs text-slate-200">{act.label}</span>
                            <p className="text-[10.5px] text-slate-500">{act.desc}</p>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleQuickAction(act.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-slate-700 bg-[#16161a] text-blue-500 focus:ring-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Shortcuts with Recorder */}
              <div className="pt-2 border-t border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Click-Through Toggle Hotkey</span>
                    <p className="text-[11px] text-slate-500">
                      Passes mouse clicks straight through window
                    </p>
                  </div>
                  <ShortcutInput
                    value={settings.clickThroughShortcut}
                    onChange={(val) => updateSettings({ clickThroughShortcut: val })}
                    placeholder="e.g. Ctrl+Alt+X"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Global Quick Add Hotkey</span>
                    <p className="text-[11px] text-slate-500">Capture task from anywhere on desktop</p>
                  </div>
                  <ShortcutInput
                    value={settings.quickAddShortcut}
                    onChange={(val) => updateSettings({ quickAddShortcut: val })}
                    placeholder="e.g. Ctrl+Alt+N"
                  />
                </div>
              </div>

              {/* Startup */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Launch NeuroLog on Startup</span>
                    <p className="text-[11px] text-slate-500">Start NeuroLog automatically when you sign in to Windows</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.launchOnStartup}
                    onChange={(e) => updateSettings({ launchOnStartup: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500 focus:ring-0"
                  />
                </div>
              </div>

              {/* Position */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">Remember Screen Position</span>
                  <input
                    type="checkbox"
                    checked={settings.rememberPosition}
                    onChange={(e) => updateSettings({ rememberPosition: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500 focus:ring-0"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-medium text-slate-200">Position Recovery</span>
                    <p className="text-[11px] text-slate-500">
                      Reset widget if lost off-screen
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const resetPosition = async () => {
                        if (isTauriEnvironment()) {
                          await positionNativeWindow(WINDOW_LABELS.main, 24, 24);
                          await ensurePillFitsWorkArea();
                        }
                        updateSettings({ lastPosition: { x: 24, y: 24 } });
                      };
                      void resetPosition();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors text-xs border border-white/[0.08]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Position
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TASK BEHAVIOR */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {/* Completed Task Placement */}
              <div>
                <label className="block font-medium text-slate-200 mb-1">
                  Completed Task Placement
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Choose where finished items are grouped
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateSettings({ completedPlacement: 'global' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      settings.completedPlacement === 'global'
                        ? 'bg-blue-500/10 border-blue-500/40 text-slate-100 shadow-sm'
                        : 'bg-[#0d0d0e] border-white/[0.08] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold block text-xs">Option 1: Global Bottom</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      One unified Completed section at bottom of category
                    </span>
                  </button>

                  <button
                    onClick={() => updateSettings({ completedPlacement: 'subcategories' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      settings.completedPlacement === 'subcategories'
                        ? 'bg-blue-500/10 border-blue-500/40 text-slate-100 shadow-sm'
                        : 'bg-[#0d0d0e] border-white/[0.08] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold block text-xs">Option 2: Per-Subcategory</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Completed items sit under each individual subcategory
                    </span>
                  </button>
                </div>
              </div>

              {/* Confirm Delete & Timestamps */}
              <div className="pt-2 border-t border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Confirm Before Deleting Tasks</span>
                    <p className="text-[11px] text-slate-500">
                      Show verification dialog on trash icon click
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmTaskDelete}
                    onChange={(e) => updateSettings({ confirmTaskDelete: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500 focus:ring-0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Display Captured Timestamps</span>
                    <p className="text-[11px] text-slate-500">
                      Show created date on task cards
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.displayTimestamp}
                    onChange={(e) => updateSettings({ displayTimestamp: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500 focus:ring-0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-200">Hide Default "Study" Category</span>
                    <p className="text-[11px] text-slate-500">
                      Hide the default Study tab if you only use custom categories
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!settings.studyHidden}
                    onChange={(e) => updateSettings({ studyHidden: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500 focus:ring-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CREATIVE TIME SCHEDULES */}
          {activeTab === 'creative' && (
            <div className="space-y-4">
              <div>
                <span className="font-medium text-slate-200">Recurring Daily Creative Ranges</span>
                <p className="text-[11px] text-slate-500">
                  Dedicated time slots for unstructured thinking & idea dumps
                </p>
              </div>

              {/* Schedules List */}
              <div className="space-y-2">
                {settings.creativeSchedules.map((sched) => (
                  <div
                    key={sched.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d0d0e] border border-white/[0.08]"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sched.enabled}
                        onChange={() => handleToggleSchedule(sched.id)}
                        className="rounded border-slate-700 bg-[#16161a] text-blue-500"
                      />
                      <div>
                        <span className="font-medium text-slate-200">{sched.label}</span>
                        <span className="font-mono text-[11px] text-slate-500 ml-2">
                          {sched.startTime} – {sched.endTime}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSchedule(sched.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Schedule Form */}
              <div className="p-3 rounded-xl bg-[#0d0d0e]/80 border border-white/[0.08] space-y-2">
                <span className="font-medium text-slate-300 text-[11px]">Add Daily Schedule</span>
                <input
                  type="text"
                  placeholder="e.g. Afternoon Creative Flow"
                  value={newScheduleLabel}
                  onChange={(e) => setNewScheduleLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#16161a] border border-white/[0.08] text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500">Start Time</label>
                    <input
                      type="time"
                      value={newScheduleStart}
                      onChange={(e) => setNewScheduleStart(e.target.value)}
                      className="w-full px-2 py-1 bg-[#16161a] border border-white/[0.08] rounded text-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500">End Time</label>
                    <input
                      type="time"
                      value={newScheduleEnd}
                      onChange={(e) => setNewScheduleEnd(e.target.value)}
                      className="w-full px-2 py-1 bg-[#16161a] border border-white/[0.08] rounded text-slate-200 text-xs font-mono"
                    />
                  </div>
                  <button
                    onClick={handleAddSchedule}
                    disabled={!newScheduleLabel.trim()}
                    className="self-end px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium hover:bg-blue-500/30 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Start & End triggers */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2.5">
                <span className="font-medium text-slate-200 text-[11px] block">
                  Triggers & Alerts
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.creativeStartSound}
                      onChange={(e) => updateSettings({ creativeStartSound: e.target.checked })}
                      className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500"
                    />
                    <span>Start Chime</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.creativeStartNotification}
                      onChange={(e) =>
                        updateSettings({ creativeStartNotification: e.target.checked })
                      }
                      className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500"
                    />
                    <span>Start Toast</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.creativeEndSound}
                      onChange={(e) => updateSettings({ creativeEndSound: e.target.checked })}
                      className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500"
                    />
                    <span>End Chime</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.creativeEndWarning}
                      onChange={(e) => updateSettings({ creativeEndWarning: e.target.checked })}
                      className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500"
                    />
                    <span>Wrap-up Warning</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIO & ALERTS */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Silent Mode */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0d0d0e] border border-white/[0.08]">
                <div>
                  <span className="font-semibold text-slate-100">Silent Mode</span>
                  <p className="text-[11px] text-slate-500">
                    Mutes sounds & toasts while keeping timers active
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.silentMode}
                  onChange={(e) => updateSettings({ silentMode: e.target.checked })}
                  className="rounded border-slate-700 bg-[#16161a] text-blue-500 focus:ring-0"
                />
              </div>

              {/* Alarm Tone */}
              <div>
                <label className="block font-medium text-slate-200 mb-2">
                  Procedural Alarm Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {tones.map((tone) => (
                    <div
                      key={tone.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        settings.soundTone === tone.id
                          ? 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                          : 'bg-[#0d0d0e] border-white/[0.08] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <button
                        onClick={() => updateSettings({ soundTone: tone.id })}
                        className="flex-1 text-left font-medium text-xs"
                      >
                        {tone.label}
                      </button>
                      <button
                        onClick={() => soundManager.playTone(tone.id, settings.soundVolume)}
                        title="Preview Tone"
                        className="p-1 text-slate-400 hover:text-blue-400"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-200">Alert Volume</span>
                  <span className="font-mono text-blue-400">{settings.soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.soundVolume}
                  onChange={(e) => updateSettings({ soundVolume: parseInt(e.target.value) })}
                  className="w-full accent-blue-500 bg-[#0d0d0e] rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              {/* Timer Alert Settings */}
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <span className="font-medium text-slate-200 block">Task Timer Triggers</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.urgentSound}
                    onChange={(e) => updateSettings({ urgentSound: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500"
                  />
                  <span>Play Alarm Sound on completion</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.urgentNotification}
                    onChange={(e) => updateSettings({ urgentNotification: e.target.checked })}
                    className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500"
                  />
                  <span>Send Native Windows Notification</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 6: DATA & PROJECT */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* GitHub Project & ZIP Download Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#16161a] to-[#16161a] border border-blue-500/30 space-y-2.5 shadow-lg">
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  <Package className="w-4 h-4" />
                  <span>Download Project ZIP (from GitHub)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Access the official NeuroLog GitHub repository to download the complete source code ZIP archive, releases, Tauri v2 Rust backend, and latest updates.
                </p>
                {/* 
                  =========================================================================
                  GITHUB REPOSITORY LINK (Configured in src/config/links.ts)
                  =========================================================================
                */}
                <button
                  id="download-project-zip-btn"
                  onClick={handleOpenGitHubProject}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-[0_0_16px_rgba(59,130,246,0.35)] active:scale-[0.98] border border-blue-400/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Project ZIP (from GitHub)</span>
                </button>
              </div>

              {/* JSON Backup & Restore */}
              <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                <span className="font-medium text-slate-200">Local JSON Data Backup</span>
                <p className="text-[11px] text-slate-500">
                  Save all categories, tasks, schedules, and custom settings
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportJson}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 font-medium text-xs border border-white/[0.08] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    Export Backup
                  </button>

                  {isTauriEnvironment() ? (
                    <button
                      onClick={() => void handleImportJson()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 font-medium text-xs border border-white/[0.08] transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>Import Backup</span>
                    </button>
                  ) : (
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 font-medium text-xs border border-white/[0.08] transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>Import Backup</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportJson}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {backupSuccessMessage && (
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs">
                    {backupSuccessMessage}
                  </div>
                )}
                {importError && (
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    ⚠️ {importError}
                  </div>
                )}
              </div>

              {/* Reset to Factory Defaults */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-300">Restore Settings Defaults</span>
                  <p className="text-[11px] text-slate-500">Reset visual & shortcut preferences to initial defaults</p>
                </div>
                <button
                  onClick={resetSettings}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] text-slate-300 border border-white/[0.1] hover:bg-white/[0.12] text-xs font-medium transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Settings
                </button>
              </div>

              {/* Full Factory Wipe with Non-Blocking Inline Confirmation */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="font-medium text-rose-300">Factory Reset</span>
                  <p className="text-[11px] text-slate-500">Wipe all tasks, categories, and settings back to clean install</p>
                </div>
                {showFactoryConfirm ? (
                  <div className="flex items-center gap-2 animate-in fade-in duration-100">
                    <button
                      id="confirm-factory-reset-btn"
                      onClick={() => {
                        factoryReset();
                        setIsSettingsOpen(false);
                        setShowFactoryConfirm(false);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-[0_0_12px_rgba(225,29,72,0.4)] active:scale-95 transition-all"
                    >
                      Confirm Reset
                    </button>
                    <button
                      onClick={() => setShowFactoryConfirm(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] text-slate-300 hover:text-white text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    id="trigger-factory-reset-btn"
                    onClick={() => setShowFactoryConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 text-xs font-medium transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 text-rose-400" />
                    Factory Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d0d0e]/80 border-t border-white/[0.08] text-[11px] text-slate-500 shrink-0">
          <span>NeuroLog v1.0.0 · Local & Offline</span>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-white/[0.08] text-slate-200 font-medium hover:bg-white/[0.12] transition-colors border border-white/[0.08]"
          >
            Done
          </button>
        </div>
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
