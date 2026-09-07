import React, { useEffect, useRef } from 'react';
import { Edit2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onRename, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust coordinates if menu would render off-screen
  const posX = Math.min(x, window.innerWidth - 160);
  const posY = Math.min(y, window.innerHeight - 100);

  return (
    <div
      ref={menuRef}
      id="neurolog-context-menu"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 min-w-[150px] bg-[#16161a]/95 border border-white/[0.08] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl p-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        id="context-menu-rename"
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/15 hover:text-blue-300 transition-colors text-left font-medium"
      >
        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
        <span>Rename Task</span>
      </button>
    </div>
  );
};
