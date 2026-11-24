import { useRef, useState } from 'react';
import {
  Accessibility,
  Bell,
  DatabaseBackup,
  Download,
  FastForward,
  FileUp,
  Languages,
  Monitor,
  Moon,
  NotebookPen,
  Rocket,
  RotateCcw,
  Sun,
  TriangleAlert,
  Upload,
  Volume2,
} from 'lucide-react';
import { AppPrefs, ThemeMode } from '../types';
import { Modal } from './Modal';
import { pluralize, t, UI_LANGUAGES, UiLanguage } from '../i18n';
import { parseBackupJson } from '../utils/storage';

type LandingView = NonNullable<AppPrefs['defaultLanding']>;
type MotionPref = NonNullable<AppPrefs['reducedMotion']>;

interface SettingsPageProps {
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
  onFullReset: () => Promise<void> | void;
  autoSpeakPrompt: boolean;
  onAutoSpeakPromptChange: (enabled: boolean) => void;
  autoSpeakAnswer: boolean;
  onAutoSpeakAnswerChange: (enabled: boolean) => void;
  reminderEnabled: boolean;
  onReminderChange: (enabled: boolean) => void;
  notesAutoSave: boolean;
  onNotesAutoSaveChange: (enabled: boolean) => void;
  notesAutoSaveSeconds: number;
  onNotesAutoSaveSecondsChange: (seconds: number) => void;
  reducedMotion: MotionPref;
  onReducedMotionChange: (pref: MotionPref) => void;
  defaultLanding: LandingView;
  onDefaultLandingChange: (view: LandingView) => void;
  backupReminderDays: number;
  onBackupReminderChange: (days: number) => void;
  canInstallApp?: boolean;
  onInstallApp?: () => void;
  lastBackupAt?: string;
  onExportBackup: () => void;
  onImportBackup: (rawText: string, mode: 'merge' | 'replace') => Promise<void>;
  uiLanguage?: UiLanguage;
  onUiLanguageChange?: (lang: UiLanguage) => void;
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
  className = '',
  children,
}: {
  icon: typeof Bell;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] pb-3 border-b border-slate-100 dark:border-[#2E2A25]">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-[#2E2A25]">{children}</div>
    </section>
  );
}

function OptionGrid<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (opt: T) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
            value === opt
              ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
              : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

const TIMER_OPTIONS = [0, 10, 15, 20, 30];
const NOTES_INTERVAL_OPTIONS = [1, 2, 5, 10];
const MOTION_OPTIONS: MotionPref[] = ['system', 'on', 'off'];
const LANDING_OPTIONS: LandingView[] = ['words', 'quiz', 'stats', 'notes'];
const BACKUP_REMINDER_OPTIONS = [0, 7, 14, 30];

const LANDING_LABELS: Record<LandingView, string> = {
  words: 'Words',
  quiz: 'Quiz',
  stats: 'Statistics',
  notes: 'Notes',
};

export function SettingsPage({
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
  onFullReset,
  autoSpeakPrompt,
  onAutoSpeakPromptChange,
  autoSpeakAnswer,
  onAutoSpeakAnswerChange,
  reminderEnabled,
  onReminderChange,
  notesAutoSave,
  onNotesAutoSaveChange,
  notesAutoSaveSeconds,
  onNotesAutoSaveSecondsChange,
  reducedMotion,
  onReducedMotionChange,
  defaultLanding,
  onDefaultLandingChange,
  backupReminderDays,
  onBackupReminderChange,
  canInstallApp = false,
  onInstallApp,
  lastBackupAt,
  onExportBackup,
  onImportBackup,
  uiLanguage = 'en',
  onUiLanguageChange,
}: SettingsPageProps) {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [confirmFullResetOpen, setConfirmFullResetOpen] = useState(false);
  const [fullResetText, setFullResetText] = useState('');
  const [fullResetting, setFullResetting] = useState(false);

  // Backup import flow (same pattern as the Languages screen)
  const backupFileRef = useRef<HTMLInputElement | null>(null);
  const [importState, setImportState] = useState<
    | { status: 'ready'; rawText: string; counts: { languages: number; decks: number; cards: number } }
    | { status: 'error'; message: string }
    | null
  >(null);
  const [importing, setImporting] = useState(false);

  const handleBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      try {
        const payload = parseBackupJson(text);
        setImportState({
          status: 'ready',
          rawText: text,
          counts: {
            languages: payload.languages.length,
            decks: payload.decks.length,
            cards: payload.cards.length,
          },
        });
      } catch (err) {
        setImportState({
          status: 'error',
          message: err instanceof Error ? err.message : t('Could not read this backup file.'),
        });
      }
    };
    reader.readAsText(file);
  };

  const handleImportChoice = async (mode: 'merge' | 'replace') => {
    if (importState?.status !== 'ready') return;
    setImporting(true);
    try {
      await onImportBackup(importState.rawText, mode);
      setImportState(null);
    } catch (err) {
      setImportState({
        status: 'error',
        message: err instanceof Error ? err.message : t('Restore failed.'),
      });
    } finally {
      setImporting(false);
    }
  };

  const backupAgeLabel = (() => {
    if (!lastBackupAt) return t('Never backed up');
    const days = Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86400000);
    if (!Number.isFinite(days) || days < 0) return t('Never backed up');
    if (days === 0) return t('Backed up today');
    if (days === 1) return t('Last backup yesterday');
    return t('Last backup {days} days ago', { days });
  })();

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
          {t('Settings')}
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
          {t('Preferences are saved automatically on this device.')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Interface language */}
        {onUiLanguageChange && (
          <Section icon={Languages} title={t('Interface language')}>
            <div className="py-3 space-y-2">
              <OptionGrid
                options={UI_LANGUAGES.map((l) => l.id)}
                value={uiLanguage}
                onChange={(id) => onUiLanguageChange(id)}
                render={(id) => UI_LANGUAGES.find((l) => l.id === id)?.nativeLabel}
              />
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                {t('Interface text language for menus, buttons, and labels.')}
              </p>
            </div>
          </Section>
        )}

        {/* Appearance */}
        <Section icon={Moon} title={t('Appearance')}>
          <div className="py-3 space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Theme')}
              </div>
              <OptionGrid
                options={['light', 'dark', 'system'] as ThemeMode[]}
                value={theme}
                onChange={onThemeChange}
                render={(id) =>
                  id === 'light' ? t('Light') : id === 'dark' ? t('Dark') : t('System')
                }
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Motion')}
              </div>
              <OptionGrid
                options={MOTION_OPTIONS}
                value={reducedMotion}
                onChange={onReducedMotionChange}
                render={(id) =>
                  id === 'system' ? t('System') : id === 'on' ? t('Reduce') : t('Full')
                }
              />
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                {t('Reduce disables non-essential animations. System follows your OS setting.')}
              </p>
            </div>
          </div>
        </Section>

        {/* Startup */}
        <Section icon={Rocket} title={t('Startup')}>
          <div className="py-3 space-y-2">
            <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
              {t('Open app to')}
            </div>
            <OptionGrid
              options={LANDING_OPTIONS}
              value={defaultLanding}
              onChange={onDefaultLandingChange}
              render={(id) => t(LANDING_LABELS[id])}
            />
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              {t('Which screen is shown when you launch the app.')}
            </p>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title={t('Notifications')}>
          <Toggle
            checked={showToasts}
            onChange={onShowToastsChange}
            label={t('Toast notifications')}
            description={t('Show success and info toasts. Errors and Undo actions always appear.')}
          />
          <Toggle
            checked={reminderEnabled}
            onChange={onReminderChange}
            label={t('Review reminders')}
            description={t('Browser notification (once a day) when cards are due for review. Requires notification permission.')}
          />
          <div className="py-3 space-y-2">
            <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
              {t('Backup reminders')}
            </div>
            <OptionGrid
              options={BACKUP_REMINDER_OPTIONS}
              value={backupReminderDays}
              onChange={onBackupReminderChange}
              render={(days) => (days === 0 ? t('Off') : t('Every {days} days', { days }))}
            />
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              {t('Show a reminder in the app when it has been this long since your last backup export.')}
            </p>
          </div>
        </Section>

        {/* Audio */}
        <Section icon={Volume2} title={t('Audio')}>
          <Toggle
            checked={soundEffectsEnabled}
            onChange={onSoundEffectsChange}
            label={t('Sound effects')}
            description={t('Correct/incorrect chimes and quiz completion sounds.')}
          />
          <Toggle
            checked={speechEnabled}
            onChange={onSpeechChange}
            label={t('Pronunciation voice')}
            description={t('Speak words aloud in decks, flashcards, and quizzes when a native voice exists.')}
          />
          <Toggle
            checked={autoSpeakPrompt}
            onChange={onAutoSpeakPromptChange}
            label={t('Auto-speak prompts')}
            description={t('Automatically pronounce the target word when a new flashcard or quiz question appears.')}
          />
          <Toggle
            checked={autoSpeakAnswer}
            onChange={onAutoSpeakAnswerChange}
            label={t('Auto-speak answers')}
            description={t('Automatically pronounce the word or example sentence when an answer is revealed.')}
          />
        </Section>

        {/* Study */}
        <Section icon={FastForward} title={t('Study')}>
          <Toggle
            checked={autoAdvance}
            onChange={onAutoAdvanceChange}
            label={t('Auto-advance questions')}
            description={t('Move to the next quiz question automatically about 1.5s after answering.')}
          />
          <div className="py-3 space-y-2">
            <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
              {t('Default quiz timer')}
            </div>
            <OptionGrid
              options={TIMER_OPTIONS}
              value={defaultTimerSeconds}
              onChange={onDefaultTimerChange}
              render={(sec) => (sec === 0 ? t('Off') : `${sec}s`)}
            />
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              {t('Pre-selects a timer when opening quiz setup. You can still change it per session.')}
            </p>
          </div>
        </Section>

        {/* Notes */}
        <Section icon={NotebookPen} title={t('Notes')}>
          <Toggle
            checked={notesAutoSave}
            onChange={onNotesAutoSaveChange}
            label={t('Auto-save notes')}
            description={t('Automatically persist your notepad while you type. When off, use the Save button.')}
          />
          {notesAutoSave && (
            <div className="py-3 space-y-2">
              <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Auto-save interval')}
              </div>
              <OptionGrid
                options={NOTES_INTERVAL_OPTIONS}
                value={notesAutoSaveSeconds}
                onChange={onNotesAutoSaveSecondsChange}
                render={(sec) => `${sec}s`}
              />
              <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                {t('How often unsaved changes are written while you type.')}
              </p>
            </div>
          )}
        </Section>

        {/* App / PWA */}
        {canInstallApp && onInstallApp && (
          <Section icon={Download} title={t('App')}>
            <div className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                  {t('Install Noor Language Studio')}
                </div>
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                  {t('Add to your home screen or desktop for offline access and a dedicated window.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onInstallApp()}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#B45309] hover:bg-[#92400E] transition-colors"
              >
                {t('Install')}
              </button>
            </div>
          </Section>
        )}

        {/* Data & Backup */}
        <Section icon={DatabaseBackup} title={t('Data & Backup')}>
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Export all data')}
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                {backupAgeLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onExportBackup}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1C1917] dark:bg-[#F5F2EC] hover:opacity-90 dark:text-[#121110] transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              {t('Export')}
            </button>
          </div>
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Import backup')}
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                {t('Restore languages, decks, words, notes, stats, and settings from a JSON backup file.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => backupFileRef.current?.click()}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#3A352F] text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('Import')}
            </button>
            <input
              ref={backupFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleBackupFile}
            />
          </div>
        </Section>

        {/* Danger Zone */}
        <Section icon={TriangleAlert} title={t('Danger Zone')} className="lg:col-span-2">
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-700 dark:text-red-400">
                {t('Reset statistics')}
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                {t('Permanently erase study streaks, quiz totals, daily activity history, and every card\'s review progress. Your languages, decks, and words are kept.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 transition-colors"
            >
              {t('Reset…')}
            </button>
          </div>
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Reset all preferences')}
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                {t('Restore every setting on this page to its default value. Your study data is not affected.')}
              </p>
            </div>
            <button
              type="button"
              onClick={onResetDefaults}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#57534E] dark:text-[#A8A29E] border border-slate-300 dark:border-[#3A352F] hover:text-red-700 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('Reset defaults')}
            </button>
          </div>
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-700 dark:text-red-400">
                {t('Erase all data')}
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                {t('Factory reset: permanently delete every language, deck, word, note, statistic, session record, and preference — the app returns to a completely clean state. This cannot be undone.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmFullResetOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-700 hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700 transition-colors"
            >
              {t('Erase everything…')}
            </button>
          </div>
        </Section>
      </div>

      {/* Restore Backup Modal */}
      <Modal
        open={importState !== null}
        onClose={() => !importing && setImportState(null)}
        ariaLabel={t('Restore backup')}
        panelClassName="max-w-md p-6 space-y-4"
      >
        {importState?.status === 'error' ? (
          <>
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Invalid Backup File')}
              </h2>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {importState.message}
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setImportState(null)}
                className="px-4 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EC] text-white dark:text-[#121110] text-sm font-medium"
              >
                {t('Close')}
              </button>
            </div>
          </>
        ) : importState?.status === 'ready' ? (
          <>
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] flex items-center gap-2">
                <FileUp className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B]" />
                {t('Restore Backup')}
              </h2>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {t('This backup contains')}{' '}
                <span className="font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                  {importState.counts.languages} {pluralize(importState.counts.languages, 'language')},{' '}
                  {importState.counts.decks} {pluralize(importState.counts.decks, 'deck')},{' '}
                  {importState.counts.cards} {pluralize(importState.counts.cards, 'word')}
                </span>
                {t(', plus study stats and activity.')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                type="button"
                disabled={importing}
                onClick={() => handleImportChoice('merge')}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2E2A25] hover:border-[#B45309] dark:hover:border-[#D97706] bg-[#FAF8F5] dark:bg-[#121110] transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                  {t('Merge into current data')}
                </span>
                <span className="block text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                  {t('Add backup records alongside existing ones. Matching IDs are updated; nothing is deleted.')}
                </span>
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => handleImportChoice('replace')}
                className="w-full text-left px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/50 hover:border-red-400 dark:hover:border-red-700 bg-red-50/50 dark:bg-red-950/20 transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-red-700 dark:text-red-400">
                  {t('Replace all current data')}
                </span>
                <span className="block text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                  {t('Overwrite everything with the backup contents. Your current data will be lost.')}
                </span>
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      {/* Strict confirmation for resetting study statistics */}
      <Modal
        open={confirmResetOpen}
        onClose={() => {
          setConfirmResetOpen(false);
          setConfirmText('');
        }}
        ariaLabel={t('Confirm reset statistics')}
        panelClassName="max-w-sm"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
              <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Reset all study statistics?')}
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 leading-relaxed">
                {t('This action is')} <strong className="text-red-700 dark:text-red-400">{t('permanent, irreversible, and cannot be undone')}</strong>.{' '}
                {t('It will erase:')}
              </p>
            </div>
          </div>
          <ul className="text-xs text-[#57534E] dark:text-[#A8A29E] space-y-1.5 pl-1 list-disc list-inside">
            <li>{t('Study streaks, quiz totals, and best streak')}</li>
            <li>{t('Daily activity history and review forecast')}</li>
            <li>{t('Every card\'s SRS box, due dates, lapses, and review counts')}</li>
          </ul>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
            {t('Your languages, decks, words, difficulty ratings, and settings are not affected.')}
          </p>
          {(() => {
            const days = lastBackupAt
              ? Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86400000)
              : null;
            if (days === null || !Number.isFinite(days) || days < 14) return null;
            return (
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-1.5">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {t('Your last backup was {days} days ago — consider exporting one before resetting.', { days })}
                </span>
              </p>
            );
          })()}
          <div>
            <label
              htmlFor="reset-confirm-input"
              className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5"
            >
              {t('Type')} <kbd className="font-mono px-1 rounded bg-[#F3EFE8] dark:bg-[#25221E]">{t('RESET')}</kbd>{' '}
              {t('to confirm')}
            </label>
            <input
              id="reset-confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('RESET')}
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
              {t('Cancel')}
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
              {resetting ? t('Resetting…') : t('Reset statistics')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Strict confirmation for the full factory reset */}
      <Modal
        open={confirmFullResetOpen}
        onClose={() => {
          setConfirmFullResetOpen(false);
          setFullResetText('');
        }}
        ariaLabel={t('Confirm full reset')}
        panelClassName="max-w-sm"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
              <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Erase everything?')}
              </h3>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1 leading-relaxed">
                {t('This action is')} <strong className="text-red-700 dark:text-red-400">{t('permanent, irreversible, and cannot be undone')}</strong>.{' '}
                {t('It will erase:')}
              </p>
            </div>
          </div>
          <ul className="text-xs text-[#57534E] dark:text-[#A8A29E] space-y-1.5 pl-1 list-disc list-inside">
            <li>{t('All languages, decks, words, tags, and mnemonics')}</li>
            <li>{t('All notes and smart decks')}</li>
            <li>{t('Study stats, session history, activity, and mastery snapshots')}</li>
            <li>{t('Every preference on this page, including backup reminders and interface language')}</li>
          </ul>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('Export a backup first if you want to keep a copy of your data.')}</span>
          </p>
          <div>
            <label
              htmlFor="full-reset-confirm-input"
              className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5"
            >
              {t('Type')} <kbd className="font-mono px-1 rounded bg-[#F3EFE8] dark:bg-[#25221E]">{t('ERASE')}</kbd>{' '}
              {t('to confirm')}
            </label>
            <input
              id="full-reset-confirm-input"
              type="text"
              value={fullResetText}
              onChange={(e) => setFullResetText(e.target.value)}
              placeholder={t('ERASE')}
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-[#3A352F] bg-white dark:bg-[#121110] text-sm font-mono text-[#1C1917] dark:text-[#F5F2EC] placeholder:text-[#A8A29E]/60 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setConfirmFullResetOpen(false);
                setFullResetText('');
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              disabled={fullResetText !== 'ERASE' || fullResetting}
              onClick={async () => {
                setFullResetting(true);
                try {
                  await onFullReset();
                } finally {
                  setFullResetting(false);
                  setConfirmFullResetOpen(false);
                  setFullResetText('');
                }
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-red-700 hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {fullResetting ? t('Erasing…') : t('Erase everything')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
