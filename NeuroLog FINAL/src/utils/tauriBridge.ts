// Native Tauri window controller for NeuroLog's multi-window desktop architecture.
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
// Browser mode keeps lightweight fallbacks so the UI remains previewable in Vite.

/**
 * Open an external URL using the platform's default browser. Tauri WebViews do
 * not reliably treat window.open() as an external navigation, so native builds
 * use Tauri's shell opener while browser previews keep the normal fallback.
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (!isTauriEnvironment()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch (error) {
    console.warn('Could not open external URL:', error);
  }
};

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export type NativeWindowLabel =
  | 'main'
  | 'expanded'
  | 'quick-add'
  | 'settings'
  | 'stopwatch'
  | 'about'
  | 'support'
  | 'timer-complete'
  | 'click-through-control';

export const WINDOW_LABELS = {
  main: 'main' as NativeWindowLabel,
  pill: 'main' as NativeWindowLabel,
  expanded: 'expanded' as NativeWindowLabel,
  quickAdd: 'quick-add' as NativeWindowLabel,
  settings: 'settings' as NativeWindowLabel,
  stopwatch: 'stopwatch' as NativeWindowLabel,
  about: 'about' as NativeWindowLabel,
  support: 'support' as NativeWindowLabel,
  timerComplete: 'timer-complete' as NativeWindowLabel,
  clickThroughControl: 'click-through-control' as NativeWindowLabel,
};

export const getCurrentWindowLabel = (): string => {
  if (!isTauriEnvironment()) return 'browser';
  try { return getCurrentWebviewWindow().label; } catch { return 'main'; }
};

export const isNativeWindow = (label: NativeWindowLabel): boolean =>
  isTauriEnvironment() && getCurrentWindowLabel() === label;

export const isPillWindow = () => isNativeWindow(WINDOW_LABELS.pill);
export const isExpandedWindow = () => isNativeWindow(WINDOW_LABELS.expanded);
export const isPopupWindow = () => ['quick-add', 'settings', 'stopwatch', 'about', 'support', 'timer-complete'].includes(getCurrentWindowLabel());

const getWindow = async (label?: NativeWindowLabel) => {
  if (!isTauriEnvironment()) return null;
  return label ? await WebviewWindow.getByLabel(label) : getCurrentWebviewWindow();
};

export const openNativeWindow = async (
  label: NativeWindowLabel,
  anchor?: { x: number; y: number },
): Promise<void> => {
  if (!isTauriEnvironment()) return;
  try {
    // Mark the requested intent first. If another WebView closes this surface
    // while positioning is still in progress, the native side will refuse to
    // resurrect the stale open request.
    await invoke('set_surface_intent', { label, open: true });

    const win = await getWindow(label);
    if (!win) return;

    if (anchor && label !== WINDOW_LABELS.main) {
      await positionWindowNearPoint(win, anchor.x, anchor.y);
    }

    await invoke('show_surface_if_requested', { label });
  } catch (error) {
    console.warn(`Could not open native window ${label}:`, error);
  }
};

export const hideNativeWindow = async (label?: NativeWindowLabel): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const target = label || (getCurrentWindowLabel() as NativeWindowLabel);
  try {
    // Cancel any in-flight show request before hiding the actual native window.
    await invoke('set_surface_intent', { label: target, open: false });
    await invoke('hide_surface', { label: target });
  } catch (error) {
    console.warn('Could not hide native window:', error);
  }
};

export const hideAllNativeWindows = async (): Promise<void> => {
  if (!isTauriEnvironment()) return;
  try {
    await invoke('hide_all_windows');
  } catch (error) {
    console.warn('Could not close NeuroLog panels:', error);
  }
};

export const setNativeClickThrough = async (enable: boolean): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow(WINDOW_LABELS.main);
  if (!win) return;
  try {
    await win.setIgnoreCursorEvents(enable);
  } catch (error) {
    console.warn('Could not set click-through:', error);
  }
};

let clickThroughControlRequest = 0;

export const setNativeClickThroughControl = async (
  enabled: boolean,
  rect?: { x: number; y: number; width: number; height: number },
): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const requestId = ++clickThroughControlRequest;
  try {
    const main = await getWindow(WINDOW_LABELS.main);
    const control = await getWindow(WINDOW_LABELS.clickThroughControl);
    if (!main || !control) return;
    if (requestId !== clickThroughControlRequest) return;

    if (!enabled || !rect) {
      await control.hide();
      return;
    }

    const [pillPosition, scaleFactor] = await Promise.all([
      main.outerPosition(),
      main.scaleFactor(),
    ]);
    const scale = Number(scaleFactor) || 1;
    const x = Math.round(pillPosition.x + rect.x * scale);
    const y = Math.round(pillPosition.y + rect.y * scale);
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));

    const { PhysicalPosition, PhysicalSize } = await import('@tauri-apps/api/dpi');
    await control.setSize(new PhysicalSize(width, height));
    if (requestId !== clickThroughControlRequest) return;
    await control.setPosition(new PhysicalPosition(x, y));
    if (requestId !== clickThroughControlRequest) return;
    await control.setAlwaysOnTop(true);
    if (requestId !== clickThroughControlRequest) return;
    await control.show();
  } catch (error) {
    console.warn('Could not position click-through control:', error);
  }
};

export const setNativeGlassEffect = async (glassBlur: number, theme: 'dark' | 'light', bgOpacity: number): Promise<void> => {
  if (!isTauriEnvironment()) return;
  try {
    await invoke('set_window_glass', {
      blur: Math.max(0, Math.round(glassBlur)),
      dark: theme === 'dark',
      opacity: Math.max(0, Math.min(1, bgOpacity)),
    });
  } catch (error) {
    console.warn('Could not set native glass effect:', error);
  }
};

export const setLaunchOnStartup = async (enabled: boolean): Promise<void> => {
  if (!isTauriEnvironment()) return;
  try {
    await invoke('set_launch_on_startup', { enabled });
  } catch (error) {
    console.warn('Could not update launch-on-startup setting:', error);
  }
};

export const syncGlobalShortcuts = async (quickAddShortcut: string, clickThroughShortcut: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  try {
    await invoke('sync_global_shortcuts', { quickAddShortcut, clickThroughShortcut });
  } catch (error) {
    console.warn('Could not synchronize global shortcuts:', error);
  }
};

export const sendNativeNotification = async (title: string, body: string) => {
  if (!isTauriEnvironment()) return;
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    await sendNotification({ title, body });
  } catch (error) {
    console.warn('Could not send native notification:', error);
  }
};

export const startDraggingCurrentWindow = async (): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow();
  try {
    await win?.startDragging();
  } catch (error) {
    console.warn('Could not start native drag:', error);
  }
};

export const resizeCurrentNativeWindow = async (width: number, height: number): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow();
  if (!win) return;
  const { LogicalSize } = await import('@tauri-apps/api/dpi');
  try {
    await win.setSize(new LogicalSize(Math.round(width), Math.round(height)));
  } catch (error) {
    console.warn('Could not resize native window:', error);
  }
};

export const positionCurrentNativeWindow = async (x: number, y: number): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow();
  if (!win) return;
  const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
  try {
    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  } catch (error) {
    console.warn('Could not position native window:', error);
  }
};

export const positionNativeWindow = async (label: NativeWindowLabel, x: number, y: number): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow(label);
  if (!win) return;
  const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
  try {
    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  } catch (error) {
    console.warn(`Could not position native window ${label}:`, error);
  }
};


const getMonitorForWindow = async (win: Awaited<ReturnType<typeof getWindow>>) => {
  if (!win) return null;
  const { monitorFromPoint } = await import('@tauri-apps/api/window');
  const pos = await win.outerPosition();
  return monitorFromPoint(pos.x, pos.y);
};

export const positionWindowNearPoint = async (
  win: NonNullable<Awaited<ReturnType<typeof getWindow>>>,
  anchorX: number,
  anchorY: number,
  preferredGap = 10,
): Promise<void> => {
  if (!win) return;
  const { monitorFromPoint } = await import('@tauri-apps/api/window');
  const monitor = await monitorFromPoint(anchorX, anchorY);
  if (!monitor) return;

  const size = await win.outerSize();
  const work = monitor.workArea;
  const gap = Math.round(preferredGap * (Number(monitor.scaleFactor) || 1));
  const margin = Math.round(8 * (Number(monitor.scaleFactor) || 1));

  // All values here are physical pixels, matching outerPosition/outerSize and
  // monitor.position/workArea. This avoids DPI-scale drift on high-resolution displays.
  const width = size.width;
  const height = size.height;
  const workLeft = work.position.x;
  const workTop = work.position.y;
  const workRight = workLeft + work.size.width;
  const workBottom = workTop + work.size.height;

  let x = anchorX;
  let y = anchorY + gap;
  if (y + height > workBottom - margin) y = anchorY - height - gap;
  x = Math.max(workLeft + margin, Math.min(x, workRight - width - margin));
  y = Math.max(workTop + margin, Math.min(y, workBottom - height - margin));

  const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
  await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
};

export const ensurePillFitsWorkArea = async (): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow(WINDOW_LABELS.main);
  if (!win) return;

  try {
    const monitor = await getMonitorForWindow(win);
    if (!monitor) return;
    const size = await win.outerSize();
    const work = monitor.workArea;
    const workLeft = work.position.x;
    const workTop = work.position.y;
    const workRight = work.position.x + work.size.width;
    const workBottom = work.position.y + work.size.height;
    const maxX = Math.max(workLeft, workRight - size.width);
    const maxY = Math.max(workTop, workBottom - size.height);
    const pos = await win.outerPosition();
    const nextX = Math.max(workLeft, Math.min(pos.x, maxX));
    const nextY = Math.max(workTop, Math.min(pos.y, maxY));

    if (nextX !== pos.x || nextY !== pos.y) {
      const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
      await win.setPosition(new PhysicalPosition(nextX, nextY));
    }
  } catch (error) {
    console.warn('Could not keep pill inside the work area:', error);
  }
};

// Backwards-compatible name used by a few older callers. The pill no longer
// uses full-monitor bounds; the taskbar is intentionally excluded.
export const ensurePillFitsMonitor = ensurePillFitsWorkArea;


export const fitPillToContent = async (): Promise<void> => {
  if (!isPillWindow()) return;
  const el = document.getElementById('neurolog-floating-pill');
  const win = await getWindow(WINDOW_LABELS.main);
  if (!el || !win) return;

  const width = Math.ceil(el.getBoundingClientRect().width);
  const height = Math.ceil(el.getBoundingClientRect().height);
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi');
    await win.setSize(new LogicalSize(Math.max(1, width), Math.max(1, height)));
    await win.setResizable(false);
    await ensurePillFitsWorkArea();
  } catch (error) {
    console.warn('Could not fit pill native window:', error);
  }
};

export const getPillScreenPosition = async (): Promise<{ x: number; y: number } | null> => {
  if (!isTauriEnvironment()) return null;
  const win = await getWindow(WINDOW_LABELS.main);
  if (!win) return null;
  try {
    const pos = await win.outerPosition();
    return { x: pos.x, y: pos.y };
  } catch {
    return null;
  }
};

export async function getCurrentMonitorWorkAreaLogicalSize(): Promise<{ width: number; height: number }> {
  if (!isTauriEnvironment()) {
    return { width: window.screen.availWidth, height: window.screen.availHeight };
  }
  try {
    const monitor = await currentMonitor();
    if (!monitor) return { width: window.screen.availWidth, height: window.screen.availHeight };
    const scale = Number(monitor.scaleFactor) || 1;
    return {
      width: Math.max(340, Math.floor(monitor.workArea.size.width / scale)),
      height: Math.max(400, Math.floor(monitor.workArea.size.height / scale)),
    };
  } catch {
    return { width: window.screen.availWidth, height: window.screen.availHeight };
  }
}

export const getNativeMonitorWorkArea = async () => {
  if (!isTauriEnvironment()) return null;
  const win = await getWindow();
  if (!win) return null;
  try {
    return await getMonitorForWindow(win);
  } catch {
    return null;
  }
};

const readExpandedNativeMetrics = async (win: NonNullable<Awaited<ReturnType<typeof getWindow>>>) => {
  const scale = Number(await win.scaleFactor()) || 1;
  const inner = await win.innerSize();
  const outer = await win.outerSize();
  const chromeWidth = Math.max(0, outer.width - inner.width);
  const chromeHeight = Math.max(0, outer.height - inner.height);
  return { scale, inner, outer, chromeWidth, chromeHeight };
};

const clampExpandedInnerPhysicalSize = (
  desiredLogicalWidth: number,
  desiredLogicalHeight: number,
  scale: number,
  work: { size: { width: number; height: number } },
  chromeWidth: number,
  chromeHeight: number,
  marginPhysical: number,
) => {
  const maxInnerWidthPhysical = Math.max(
    1,
    work.size.width - marginPhysical * 2 - chromeWidth,
  );
  const maxInnerHeightPhysical = Math.max(
    1,
    work.size.height - marginPhysical * 2 - chromeHeight,
  );

  const minLogicalWidth = 340;
  const minLogicalHeight = 400;
  const desiredPhysicalWidth = Math.max(1, Math.round(Math.max(minLogicalWidth, desiredLogicalWidth) * scale));
  const desiredPhysicalHeight = Math.max(1, Math.round(Math.max(minLogicalHeight, desiredLogicalHeight) * scale));

  return {
    width: Math.min(desiredPhysicalWidth, maxInnerWidthPhysical),
    height: Math.min(desiredPhysicalHeight, maxInnerHeightPhysical),
  };
};

const clampExpandedOuterPosition = (
  pos: { x: number; y: number },
  outer: { width: number; height: number },
  work: { position: { x: number; y: number }; size: { width: number; height: number } },
  marginPhysical: number,
) => {
  const left = work.position.x + marginPhysical;
  const top = work.position.y + marginPhysical;
  const right = work.position.x + work.size.width - marginPhysical;
  const bottom = work.position.y + work.size.height - marginPhysical;
  const maxX = Math.max(left, right - outer.width);
  const maxY = Math.max(top, bottom - outer.height);

  return {
    x: Math.max(left, Math.min(pos.x, maxX)),
    y: Math.max(top, Math.min(pos.y, maxY)),
  };
};

const calculateExpandedWindowGeometry = async (panelWidth: number, panelHeight: number) => {
  const expanded = await getWindow(WINDOW_LABELS.expanded);
  const pill = await getWindow(WINDOW_LABELS.main);
  if (!expanded || !pill) return null;

  const { monitorFromPoint } = await import('@tauri-apps/api/window');
  const pillPos = await pill.outerPosition();
  const pillSize = await pill.outerSize();
  const monitor = await monitorFromPoint(pillPos.x, pillPos.y);
  if (!monitor) return null;

  // setSize() changes the window's INNER/client size. Position and workArea
  // coordinates are PHYSICAL pixels, so we convert exactly once and then
  // clamp using the actual OUTER/native size after applying the requested size.
  const { PhysicalSize } = await import('@tauri-apps/api/dpi');
  const metrics = await readExpandedNativeMetrics(expanded);
  const margin = Math.round(8 * metrics.scale);
  const gap = Math.round(8 * metrics.scale);

  const desired = clampExpandedInnerPhysicalSize(
    panelWidth,
    panelHeight,
    metrics.scale,
    monitor.workArea,
    metrics.chromeWidth,
    metrics.chromeHeight,
    margin,
  );

  await expanded.setSize(new PhysicalSize(desired.width, desired.height));

  // Read back the real native dimensions. This is deliberately done after
  // setSize so invisible Windows non-client insets can never make the panel
  // extend past the work area and clip its right/bottom UI.
  const actual = await readExpandedNativeMetrics(expanded);
  const work = monitor.workArea;
  const positionAfterSize = clampExpandedOuterPosition(
    { x: pillPos.x, y: pillPos.y + pillSize.height + gap },
    actual.outer,
    work,
    margin,
  );

  const belowY = pillPos.y + pillSize.height + gap;
  const aboveY = pillPos.y - gap - actual.outer.height;
  const belowFits = belowY + actual.outer.height <= work.position.y + work.size.height - margin;
  const aboveFits = aboveY >= work.position.y + margin;

  let y = belowFits ? belowY : aboveFits ? aboveY : positionAfterSize.y;
  y = Math.max(
    work.position.y + margin,
    Math.min(y, work.position.y + work.size.height - margin - actual.outer.height),
  );

  const x = Math.max(
    work.position.x + margin,
    Math.min(pillPos.x, work.position.x + work.size.width - margin - actual.outer.width),
  );

  return {
    expanded,
    x,
    y,
    scale: actual.scale,
    work,
    margin,
    physicalInnerWidth: actual.inner.width,
    physicalInnerHeight: actual.inner.height,
  };
};

export const positionExpandedWindowNearPill = async (panelWidth: number, panelHeight: number) => {
  if (!isTauriEnvironment()) return;
  try {
    const geometry = await calculateExpandedWindowGeometry(panelWidth, panelHeight);
    if (!geometry) return;
    const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
    await geometry.expanded.setPosition(
      new PhysicalPosition(Math.round(geometry.x), Math.round(geometry.y)),
    );
    await geometry.expanded.setResizable(false);
  } catch (error) {
    console.warn('Could not position expanded window:', error);
  }
};

export const ensureExpandedFitsWorkArea = async (): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const win = await getWindow(WINDOW_LABELS.expanded);
  if (!win) return;

  try {
    const pos = await win.outerPosition();
    const monitor = await (await import('@tauri-apps/api/window')).monitorFromPoint(pos.x, pos.y);
    if (!monitor) return;

    const metrics = await readExpandedNativeMetrics(win);
    const margin = Math.round(8 * metrics.scale);
    const next = clampExpandedOuterPosition(pos, metrics.outer, monitor.workArea, margin);

    if (next.x !== pos.x || next.y !== pos.y) {
      const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
      await win.setPosition(new PhysicalPosition(Math.round(next.x), Math.round(next.y)));
    }
  } catch (error) {
    console.warn('Could not keep expanded window inside the work area:', error);
  }
};

let expandedResizeSequence = 0;
let expandedResizeChain = Promise.resolve();

export const resizeExpandedNativeWindow = async (panelWidth: number, panelHeight: number): Promise<void> => {
  if (!isTauriEnvironment()) return;
  const requestId = ++expandedResizeSequence;

  expandedResizeChain = expandedResizeChain.then(async () => {
    // Drop stale resize requests so rapid pointer movement cannot finish out
    // of order and make the native window jump backward.
    if (requestId !== expandedResizeSequence) return;

    try {
      const expanded = await getWindow(WINDOW_LABELS.expanded);
      if (!expanded) return;

      const currentPos = await expanded.outerPosition();
      const monitor = await (await import('@tauri-apps/api/window')).monitorFromPoint(currentPos.x, currentPos.y);
      if (!monitor) return;

      const metrics = await readExpandedNativeMetrics(expanded);
      const margin = Math.round(8 * metrics.scale);
      const desired = clampExpandedInnerPhysicalSize(
        panelWidth,
        panelHeight,
        metrics.scale,
        monitor.workArea,
        metrics.chromeWidth,
        metrics.chromeHeight,
        margin,
      );

      const { PhysicalSize, PhysicalPosition } = await import('@tauri-apps/api/dpi');
      await expanded.setSize(new PhysicalSize(desired.width, desired.height));

      const actual = await readExpandedNativeMetrics(expanded);
      const nextPos = clampExpandedOuterPosition(currentPos, actual.outer, monitor.workArea, margin);

      if (nextPos.x !== currentPos.x || nextPos.y !== currentPos.y) {
        await expanded.setPosition(
          new PhysicalPosition(Math.round(nextPos.x), Math.round(nextPos.y)),
        );
      }
      await expanded.setResizable(false);
    } catch (error) {
      console.warn('Could not resize expanded window:', error);
    }
  });

  await expandedResizeChain;
};


export const getOtherNeuroLogWindowLabels = (): NativeWindowLabel[] => [
  WINDOW_LABELS.main,
  WINDOW_LABELS.expanded,
  WINDOW_LABELS.quickAdd,
  WINDOW_LABELS.settings,
  WINDOW_LABELS.stopwatch,
  WINDOW_LABELS.about,
  WINDOW_LABELS.support,
];



// Backwards-compatible aliases retained so existing imports keep compiling during migration.
export const collapseNativeWindowToPill = async (): Promise<void> => {
  await hideNativeWindow(WINDOW_LABELS.expanded);
};

export type NativeExpansionLayout = never;
export const getNativeExpansionLayout = async (): Promise<null> => null;
