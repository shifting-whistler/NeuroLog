import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNativeSurface } from '../utils/nativeSurface';
import { isNativeWindow } from '../utils/tauriBridge';
import {
  Info,
  X,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Github,
  Send,
  Mail,
  GripHorizontal,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Why not just use a normal notes/blocker app?',
    answer:
      "Normal blockers fight your thoughts. NeuroLog remembers them for you so you can stay focused without the fear of forgetting something creative. And sticky notes? Well… comparing NeuroLog to those feels illegal.",
  },
  {
    question: 'Who made NeuroLog?',
    answer: <>NeuroLog was developed by Tanvir Mahtab. <i>(aka Shifting Whistler)</i></>,
  },
  {
    question: 'Does NeuroLog collect or steal my data?',
    answer:
      'Hell nah. NeuroLog runs locally on your computer. Your tasks and data stay on your device and go nowhere.',
  },
  {
    question: 'Does NeuroLog require an internet connection?',
    answer: 'Nope. The app is designed to work completely offline.',
  },
  {
    question: 'Can I suggest a feature?',
    answer: 'Absolutely. NeuroLog is an open-source project that can grow based on useful ideas and feedback.',
  },
];

export const AboutModal: React.FC = () => {
  const { isAboutOpen, setIsAboutOpen, settings } = useApp();
  const [openFaqIndexes, setOpenFaqIndexes] = useState<Set<number>>(new Set());
  const [copiedEmail, setCopiedEmail] = useState(false);

  const nativeWindow = isNativeWindow('about');
  const isOpen = nativeWindow ? true : isAboutOpen;
  const { position, size, isDragging, handleHeaderMouseDown, handleResizeMouseDown, modalRef } = useNativeSurface({
    label: 'about',
    isPopup: true,
    defaultWidth: 440,
    defaultHeight: 560,
    minWidth: 300,
    minHeight: 220,
  });

  if (!isOpen) return null;

  const toggleFaq = (index: number) => {
    setOpenFaqIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText('shiftingwhistler@gmail.com');
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // fallback
      const textArea = document.createElement('textarea');
      textArea.value = 'shiftingwhistler@gmail.com';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div
      id="about-overlay"
      className="fixed inset-0 z-50 pointer-events-none w-full h-full"
    >
      <div
        ref={modalRef}
        id="about-modal"
        style={{
          transform: nativeWindow ? 'none' : `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: nativeWindow ? '100%' : 'min(440px, calc(100vw - 24px))',
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
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-mono">
                About NeuroLog
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">v1.0.0 · Local & Offline</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="text-slate-600 px-1" title="Drag to move panel">
              <GripHorizontal className="w-4 h-4" />
            </div>
            <button
              id="about-close-btn"
              onClick={() => setIsAboutOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
          {/* Main Description */}
          <div className="space-y-2.5 leading-relaxed bg-[#0d0d0e]/40 p-3 rounded-xl border border-white/[0.06]">
            <p className="text-slate-100 font-medium">
              NeuroLog is a lightweight Windows companion built to catch the random thoughts that interrupt your focus.
            </p>
            <p className="text-slate-300 text-[11.5px]">
              Ever been studying and suddenly remembered an app idea, something you need to Google, a project you want to start, or some completely random shit? Instead of immediately chasing that thought and losing your focus, throw it into NeuroLog and get back to what you were doing.
            </p>
            <p className="text-blue-300/90 text-[11.5px] italic">
              It is especially designed for students and people whose brains constantly jump between ideas.
            </p>
          </div>

          {/* Collapsible FAQ Section */}
          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              FAQ
            </h4>
            <div className="space-y-1.5">
              {FAQ_ITEMS.map((faq, idx) => {
                const isOpen = openFaqIndexes.has(idx);
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/[0.08] bg-[#0d0d0e]/50 overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="pr-2">{faq.question}</span>
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-2.5 pt-1 text-[11.5px] text-slate-300 leading-relaxed border-t border-white/[0.04] animate-in fade-in duration-100 bg-[#0d0d0e]/30">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Section */}
          <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
            <h4 className="font-mono text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Contact
            </h4>
            <p className="text-[11.5px] text-slate-400 px-1">
              Got a feature idea, found a bug, or just want to say something? Feel free to reach out.
            </p>

            <div className="space-y-2">
              {/* GitHub Link */}
              <a
                href="https://github.com/shifting-whistler"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-200 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  <span className="font-medium">GitHub Profile</span>
                </div>
                <span className="text-[11px] text-slate-400 group-hover:text-blue-400 font-mono flex items-center gap-1">
                  @shifting-whistler <ExternalLink className="w-3 h-3" />
                </span>
              </a>

              {/* Telegram Link */}
              <a
                href="https://t.me/shifting_whistler"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-200 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span className="font-medium">Telegram</span>
                </div>
                <span className="text-[11px] text-slate-400 group-hover:text-sky-300 font-mono flex items-center gap-1">
                  @shifting_whistler <ExternalLink className="w-3 h-3" />
                </span>
              </a>

              {/* Email with Copy Button */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-300 truncate">
                    shiftingwhistler@gmail.com
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all ${
                    copiedEmail
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.08]'
                  }`}
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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
