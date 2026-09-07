import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { getCurrentWindowLabel, isTauriEnvironment, resizeCurrentNativeWindow, startDraggingCurrentWindow } from './tauriBridge';

export function useNativeSurface(options: {
  label: string;
  isPopup?: boolean;
  defaultWidth: number;
  defaultHeight: number;
  minWidth?: number;
  minHeight?: number;
}) {
  const isTauri = isTauriEnvironment();
  const currentLabel = getCurrentWindowLabel();
  const native = isTauri && currentLabel === options.label;
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [size, setSize] = useState({ width: options.defaultWidth, height: options.defaultHeight });
  const startRef = useRef({ mouseX: 0, mouseY: 0, startW: options.defaultWidth, startH: options.defaultHeight });
  const startDrag = useRef({ mouseX: 0, mouseY: 0, startX: 16, startY: 16 });
  const modalRef = useRef<HTMLDivElement>(null);

  const handleHeaderMouseDown = useCallback(async (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"], [data-no-drag="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    if (native) {
      setIsDragging(true);
      await startDraggingCurrentWindow();
      window.setTimeout(() => setIsDragging(false), 120);
      return;
    }
    setIsDragging(true);
    startDrag.current = { mouseX: e.clientX, mouseY: e.clientY, startX: position.x, startY: position.y };
  }, [native, position.x, position.y]);

  const handleResizeMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { mouseX: e.clientX, mouseY: e.clientY, startW: size.width, startH: size.height };
    setIsResizing(true);
  }, [size]);

  useEffect(() => {
    if (!isDragging || native) return;
    const move = (e: MouseEvent) => {
      const dx = e.clientX - startDrag.current.mouseX;
      const dy = e.clientY - startDrag.current.mouseY;
      const modal = modalRef.current;
      const width = modal?.offsetWidth ?? size.width;
      const height = modal?.offsetHeight ?? size.height;
      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);
      setPosition({
        x: Math.max(8, Math.min(startDrag.current.startX + dx, maxX)),
        y: Math.max(8, Math.min(startDrag.current.startY + dy, maxY)),
      });
    };
    const up = () => setIsDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isDragging, native, size.width, size.height]);

  useEffect(() => {
    if (!isResizing) return;
    const move = async (e: MouseEvent) => {
      const minW = options.minWidth ?? 260;
      const minH = options.minHeight ?? 180;
      const width = Math.max(minW, startRef.current.startW + e.clientX - startRef.current.mouseX);
      const height = Math.max(minH, startRef.current.startH + e.clientY - startRef.current.mouseY);
      setSize({ width, height });
      if (native) await resizeCurrentNativeWindow(width, height);
    };
    const up = () => setIsResizing(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isResizing, native, options.minHeight, options.minWidth]);

  return {
    native,
    position,
    setPosition,
    size,
    setSize,
    isDragging,
    isResizing,
    modalRef,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  };
}
