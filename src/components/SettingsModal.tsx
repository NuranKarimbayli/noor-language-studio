import { useEffect } from 'react';
import {
  Bell,
  FastForward,
  Keyboard,
  Moon,
  RotateCcw,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { ThemeMode } from '../types';
import { Modal } from './Modal';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  soundEffectsEnabled: boolean;
  onSoundEffectsChange: (enabled: boolean) => void;
  speechEnabled: boolean;
  onSpeechChange: (enabled: boolean) => void;
  showToasts: boolean;
  onShowToastsChange: (enabled: boolean) => void;
  autoAdvance: boolean;
  onAutoAdvanceChange: (enabled: boolean) => void;
  defaultTimerSeconds: number;
  onDefaultTimerChange: (seconds: number) => void;
  onResetDefaults: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 py-3 text-left group"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
          {label}
        </span>
        <span className="block text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
          {description}
        </span>
      </span>
      <span
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#B45309]' : 'bg-slate-300 dark:bg-[#3A352F]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bell;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] pb-1">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-[#2E2A25]">{children}</div>
    </div>
  );
}

const TIMER_OPTIONS = [0, 10, 15, 20, 30];

export function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  soundEffectsEnabled,
  onSoundEffectsChange,
  speechEnabled,
  onSpeechChange,
  showToasts,
  onShowToastsChange,
  autoAdvance,
  onAutoAdvanceChange,
  defaultTimerSeconds,
  onDefaultTimerChange,
  onResetDefaults,
}: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="Settings"
      panelClassName="max-w-md flex flex-col max-h-[85vh] overflow-hidden"
    >
      <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-slate-200 dark:border-[#2E2A25]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            Settings
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
            Preferences are saved automatically on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-4 pb-2 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]">
        {/* Appearance */}
        <Section icon={Moon} title="Appearance">
          <div className="py-3 space-y-2">
            <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
              Theme
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'light' as ThemeMode, label: 'Light', Icon: Sun },
                  { id: 'dark' as ThemeMode, label: 'Dark', Icon: Moon },
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onThemeChange(opt.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    theme === opt.id
                      ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
                      : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
                  }`}
                >
                  <opt.Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          <Toggle
            checked={showToasts}
            onChange={onShowToastsChange}
            label="Toast notifications"
            description="Show success and info toasts. Errors and Undo actions always appear."
          />
        </Section>

        {/* Audio */}
        <Section icon={Volume2} title="Audio">
          <Toggle
            checked={soundEffectsEnabled}
            onChange={onSoundEffectsChange}
            label="Sound effects"
            description="Correct/incorrect chimes and quiz completion sounds."
          />
          <Toggle
            checked={speechEnabled}
            onChange={onSpeechChange}
            label="Pronunciation voice"
            description="Speak words aloud in decks, flashcards, and quizzes when a native voice exists."
          />
        </Section>

        {/* Study */}
        <Section icon={FastForward} title="Study">
          <Toggle
            checked={autoAdvance}
            onChange={onAutoAdvanceChange}
            label="Auto-advance questions"
            description="Move to the next quiz question automatically about 1.5s after answering."
          />
          <div className="py-3 space-y-2">
            <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
              Default quiz timer
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {TIMER_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onDefaultTimerChange(sec)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                    defaultTimerSeconds === sec
                      ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
                      : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
                  }`}
                >
                  {sec === 0 ? 'Off' : `${sec}s`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              Pre-selects a timer when opening quiz setup. You can still change
              it per session.
            </p>
          </div>
        </Section>

      </div>

      <div className="shrink-0 px-6 pb-6 pt-3 border-t border-slate-200 dark:border-[#2E2A25] flex items-center justify-between gap-3">
        <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5">
          <Keyboard className="w-3 h-3" />
          Press <kbd className="font-mono px-1 rounded bg-[#F3EFE8] dark:bg-[#25221E]">?</kbd> for
          shortcuts
        </p>
        <button
          type="button"
          onClick={onResetDefaults}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-red-700 dark:hover:text-red-400 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset defaults
        </button>
      </div>
    </Modal>
  );
}
