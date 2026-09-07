import React from 'react';
import { emit } from '@tauri-apps/api/event';
import { EyeOff } from 'lucide-react';

/**
 * A tiny, independent native surface used only while click-through mode is active.
 * The main pill can therefore use Tauri's true ignore-cursor-events mode without
 * clipping its visual surface or subclassing the WebView window procedure.
 */
export const ClickThroughControl: React.FC = () => {
  const handleClick = () => {
    void emit('neurolog-click-through-control-action');
  };

  return (
    <button
      type="button"
      aria-label="Disable click-through mode"
      title="Disable Click-Through"
      onClick={handleClick}
      className="fixed inset-0 w-full h-full flex items-center justify-center bg-transparent text-blue-300 hover:text-blue-200 active:scale-95 transition-transform pointer-events-auto"
    >
      <EyeOff className="w-3.5 h-3.5 drop-shadow-[0_0_6px_rgba(59,130,246,0.65)]" />
    </button>
  );
};
