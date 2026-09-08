import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle } from 'lucide-react';

export const DeleteConfirmModal: React.FC = () => {
  const { taskToDelete, setTaskToDelete, executeDeleteTask } = useApp();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!taskToDelete) return null;

  return (
    <div
      id="delete-confirm-overlay"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
    >
      <div
        id="delete-confirm-modal"
        className="w-full max-w-xs bg-[#16161a]/95 border border-white/[0.08] rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-slate-100">Delete Task?</h3>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2 break-words">
              "{taskToDelete.title}"
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none hover:text-slate-300">
          <input
            id="delete-dont-ask-again"
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="rounded border-slate-700 bg-[#0d0d0e] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span>Don't ask again</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button
            id="delete-confirm-cancel"
            onClick={() => setTaskToDelete(null)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
          <button
            id="delete-confirm-btn"
            onClick={() => executeDeleteTask(taskToDelete.id, dontAskAgain)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all active:scale-95"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
