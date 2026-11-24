import { X } from 'lucide-react';
import { Modal } from './Modal';
import { t } from '../i18n';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-[#2E2A25] bg-slate-50 dark:bg-[#242220] text-[11px] font-semibold text-[#44403C] dark:text-[#D6D3D1] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.04)] dark:shadow-none">
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-[#44403C] dark:text-[#D6D3D1]">{label}</span>
      <span className="flex items-center gap-1 shrink-0">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#A8A29E] dark:text-[#78716C] mb-1">
        {title}
      </h3>
      <div className="divide-y divide-slate-100 dark:divide-[#2E2A25]">{children}</div>
    </div>
  );
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={t('Keyboard shortcuts')}
      panelClassName="max-w-md [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold leading-snug text-[#1C1917] dark:text-[#F5F2EC]">
              {t('Keyboard Shortcuts')}
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              {t('Press')} <Kbd>?</Kbd> {t('anytime to toggle this panel.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            title={t('Close')}
            className="p-1.5 -mr-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="space-y-6">
          <Section title={t('Flashcards')}>
            <ShortcutRow keys={[t('Space')]} label={t('Flip card')} />
            <ShortcutRow keys={['←', '→']} label={t('Previous / next card')} />
            <ShortcutRow keys={['1']} label={t('Rate: Hard')} />
            <ShortcutRow keys={['2']} label={t('Rate: Good')} />
            <ShortcutRow keys={['3']} label={t('Rate: Easy')} />
          </Section>

          <Section title={t('Quizzes')}>
            <ShortcutRow keys={['1', '–', '4']} label={t('Select answer option')} />
            <ShortcutRow keys={['T']} label={t('True / False: True')} />
            <ShortcutRow keys={['F']} label={t('True / False: False')} />
            <ShortcutRow keys={['R']} label={t('Replay pronunciation')} />
            <ShortcutRow keys={[t('Enter')]} label={t('Submit / Continue')} />
            <ShortcutRow keys={[t('Esc')]} label={t('Close dialog / menu')} />
          </Section>

          <Section title={t('Global')}>
            <ShortcutRow keys={[t('Ctrl'), 'K']} label={t('Command palette (Cmd on Mac)')} />
            <ShortcutRow keys={['G', 'W']} label={t('Go to Words')} />
            <ShortcutRow keys={['G', 'Q']} label={t('Go to Quiz')} />
            <ShortcutRow keys={['G', 'S']} label={t('Go to Statistics')} />
            <ShortcutRow keys={['G', 'N']} label={t('Go to Notes')} />
            <ShortcutRow keys={['C']} label={t('New word')} />
            <ShortcutRow keys={['?']} label={t('Toggle this cheat-sheet')} />
          </Section>
        </div>
      </div>
    </Modal>
  );
}
