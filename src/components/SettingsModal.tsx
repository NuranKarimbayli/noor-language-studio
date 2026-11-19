import { useEffect, useState } from 'react';
import {
  Bell,
  FastForward,
  Keyboard,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  TriangleAlert,
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
  onResetStatistics: () => Promise<void> | void;
  autoSpeakPrompt: boolean;
  onAutoSpeakPromptChange: (enabled: boolean) => void;
  autoSpeakAnswer: boolean;
  onAutoSpeakAnswerChange: (enabled: boolean) => void;
  reminderEnabled: boolean;
  onReminderChange: (enabled: boolean) => void;
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
  onResetStatistics,
  autoSpeakPrompt,
  onAutoSpeakPromptChange,
  autoSpeakAnswer,
  onAutoSpeakAnswerChange,
  reminderEnabled,
  onReminderChange,
}: SettingsModalProps) {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmResetOpen(false);
      setConfirmText('');
      setResetting(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmResetOpen) {
          setConfirmResetOpen(false);
          setConfirmText('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, confirmResetOpen]);

  return (
    <>
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
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'light' as ThemeMode, label: 'Light', Icon: Sun },
                  { id: 'dark' as ThemeMode, label: 'Dark', Icon: Moon },
                  { id: 'system' as ThemeMode, label: 'System', Icon: Monitor },
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
          <Toggle
            checked={reminderEnabled}
            onChange={onReminderChange}
            label="Review reminders"
            description="Browser notification (once a day) when cards are due for review. Requires notification permission."
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
          <Toggle
            checked={autoSpeakPrompt}
            onChange={onAutoSpeakPromptChange}
            label="Auto-speak prompts"
            description="Automatically pronounce the target word when a new flashcard or quiz question appears."
          />
          <Toggle
            checked={autoSpeakAnswer}
            onChange={onAutoSpeakAnswerChange}
            label="Auto-speak answers"
            description="Automatically pronounce the word or example sentence when an answer is revealed."
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

        {/* Danger Zone */}
        <Section icon={TriangleAlert} title="Danger Zone">
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-700 dark:text-red-400">
                Reset statistics
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                Permanently erase study streaks, quiz totals, daily activity
                history, and every card&apos;s review progress. Your languages,
                decks, and words are kept.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 transition-colors"
            >
              Reset…
            </button>
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

    {/* Strict confirmation for resetting study statistics */}
    <Modal
      open={open && confirmResetOpen}
      onClose={() => {
        setConfirmResetOpen(false);
        setConfirmText('');
      }}
      ariaLabel="Confirm reset statistics"
      panelClassName="max-w-sm"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
            <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Reset all study statistics?
            </h3>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 leading-relaxed">
              This action is <strong className="text-red-700 dark:text-red-400">permanent, irreversible, and cannot be undone</strong>.
              It will erase:
            </p>
          </div>
        </div>
        <ul className="text-xs text-[#57534E] dark:text-[#A8A29E] space-y-1.5 pl-1 list-disc list-inside">
          <li>Study streaks, quiz totals, and best streak</li>
          <li>Daily activity history and review forecast</li>
          <li>Every card&apos;s SRS box, due dates, lapses, and review counts</li>
        </ul>
        <p className="text-xs text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
          Your languages, decks, words, difficulty ratings, and settings are{' '}
          <strong>not</strong> affected.
        </p>
        <div>
          <label
            htmlFor="reset-confirm-input"
            className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5"
          >
            Type <kbd className="font-mono px-1 rounded bg-[#F3EFE8] dark:bg-[#25221E]">RESET</kbd> to
            confirm
          </label>
          <input
            id="reset-confirm-input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            autoComplete="off"
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-[#3A352F] bg-white dark:bg-[#121110] text-sm font-mono text-[#1C1917] dark:text-[#F5F2EC] placeholder:text-[#A8A29E]/60 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setConfirmResetOpen(false);
              setConfirmText('');
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmText !== 'RESET' || resetting}
            onClick={async () => {
              setResetting(true);
              try {
                await onResetStatistics();
              } finally {
                setResetting(false);
                setConfirmResetOpen(false);
                setConfirmText('');
              }
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {resetting ? 'Resetting…' : 'Reset statistics'}
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}
