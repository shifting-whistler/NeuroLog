import { useEffect, useRef, useState, useCallback } from 'react';
import { isTauriEnvironment } from './tauriBridge';

interface UseDraggableOptions {
  isOpen: boolean;
  anchorPosition?: { x: number; y: number };
  defaultWidth?: number;
  defaultHeight?: number;
  offset?: { x: number; y: number };
}

export function useDraggable({
  isOpen,
  anchorPosition = { x: 40, y: 40 },
  defaultWidth = 420,
  defaultHeight = 520,
  offset = { x: 20, y: 45 },
}: UseDraggableOptions) {
  const isTauri = isTauriEnvironment();
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (isTauriEnvironment()) {
      return { x: 8, y: 44 };
    }
    const maxX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - defaultWidth - 16) : 300;
    const maxY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - defaultHeight - 16) : 200;
    return {
      x: Math.max(16, Math.min(anchorPosition.x + offset.x, maxX)),
      y: Math.max(16, Math.min(anchorPosition.y + offset.y, maxY)),
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const modalRef = useRef<HTMLDivElement>(null);

  // Position near anchor widget whenever modal opens (browser mode)
  useEffect(() => {
    if (isOpen && !isTauri) {
      const modalW = modalRef.current?.offsetWidth || defaultWidth;
      const modalH = modalRef.current?.offsetHeight || defaultHeight;
      const maxX = Math.max(16, window.innerWidth - modalW - 16);
      const maxY = Math.max(16, window.innerHeight - modalH - 16);

      let targetX = anchorPosition.x + offset.x;
      let targetY = anchorPosition.y + offset.y;

      // If opening below would overflow screen bottom, position above widget if possible
      if (targetY > maxY && anchorPosition.y - modalH - 10 > 16) {
        targetY = anchorPosition.y - modalH - 10;
      }

      setPosition({
        x: Math.max(16, Math.min(targetX, maxX)),
        y: Math.max(16, Math.min(targetY, maxY)),
      });
    }
  }, [isOpen, anchorPosition.x, anchorPosition.y, defaultWidth, defaultHeight, offset.x, offset.y, isTauri]);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag with left click and ignore clicks on interactive children (buttons, inputs, links)
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  }, [position, isTauri]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const modalW = modalRef.current?.offsetWidth || defaultWidth;
      const modalH = modalRef.current?.offsetHeight || defaultHeight;

      const maxX = Math.max(8, window.innerWidth - modalW - 8);
      const maxY = Math.max(8, window.innerHeight - modalH - 8);

      const nextX = Math.max(8, Math.min(dragStartRef.current.startX + deltaX, maxX));
      const nextY = Math.max(8, Math.min(dragStartRef.current.startY + deltaY, maxY));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, defaultWidth, defaultHeight]);

  return {
    position,
    setPosition,
    isDragging,
    handleHeaderMouseDown,
    modalRef,
  };
}
