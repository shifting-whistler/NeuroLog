import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { useApp } from '../context/AppContext';
import { Check, Trash2 } from 'lucide-react';
import { ContextMenu } from './ContextMenu';

interface TaskItemProps {
  task: Task;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { toggleTaskCompletion, renameTask, confirmDeleteTask, settings } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleSaveRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      renameTask(task.id, trimmed);
    } else {
      setEditTitle(task.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  // Format captured timestamp (e.g. "Today 4:15 PM" or "Aug 30, 2:10 PM")
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  };

  return (
    <>
      <div
        id={`task-item-${task.id}`}
        onContextMenu={handleContextMenu}
        className={`group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all select-none border ${
          task.completed
            ? 'bg-emerald-950/15 border-emerald-500/25 opacity-55 hover:opacity-85 text-emerald-300/70'
            : 'bg-[#16161a]/70 border-white/[0.08] hover:border-white/20 hover:bg-[#16161a] text-slate-100 shadow-sm'
        }`}
      >
        {/* Task Title & Timestamp */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#1e1e24] border border-blue-500/60 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none shadow-[0_0_10px_rgba(59,130,246,0.2)]"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditing(true)}
              className={`text-xs font-normal tracking-tight break-words line-clamp-2 ${
                task.completed ? 'line-through text-emerald-300/60' : 'text-slate-200'
              }`}
            >
              {task.title}
            </span>
          )}

          {settings.displayTimestamp && task.createdAt && (
            <span className="text-[10px] font-mono text-slate-500 mt-0.5">
              {formatTimestamp(task.createdAt)}
            </span>
          )}
        </div>

        {/* Action Controls (Right side: Completion Toggle & Delete Button) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Circular Completion Toggle */}
          <button
            id={`toggle-task-${task.id}`}
            type="button"
            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            onClick={() => toggleTaskCompletion(task.id)}
            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all border ${
              task.completed
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'border-slate-600 hover:border-blue-400/80 bg-transparent text-transparent hover:text-slate-400'
            }`}
          >
            <Check className={`w-3 h-3 ${task.completed ? 'opacity-100' : 'opacity-0 hover:opacity-50'}`} />
          </button>

          {/* Delete Button directly beside completion button */}
          <button
            id={`delete-task-${task.id}`}
            type="button"
            title="Delete task"
            onClick={() => confirmDeleteTask(task)}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Context Menu for Rename */}
      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onRename={() => setIsEditing(true)}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </>
  );
};
