import { useEffect } from 'react';
import { Modal } from './Modal';

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
      ariaLabel="Keyboard shortcuts"
      panelClassName="max-w-md"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Keyboard Shortcuts
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              Press <Kbd>?</Kbd> anytime to toggle this panel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
          >
            Close
          </button>
        </div>

        <div className="space-y-6">
          <Section title="Flashcards">
            <ShortcutRow keys={['Space']} label="Flip card" />
            <ShortcutRow keys={['←', '→']} label="Previous / next card" />
            <ShortcutRow keys={['1']} label="Rate: Hard" />
            <ShortcutRow keys={['2']} label="Rate: Good" />
            <ShortcutRow keys={['3']} label="Rate: Easy" />
          </Section>

          <Section title="Quizzes">
            <ShortcutRow keys={['1', '–', '4']} label="Select answer option" />
            <ShortcutRow keys={['T']} label="True / False: True" />
            <ShortcutRow keys={['F']} label="True / False: False" />
            <ShortcutRow keys={['R']} label="Replay pronunciation" />
            <ShortcutRow keys={['Enter']} label="Submit / Continue" />
            <ShortcutRow keys={['Esc']} label="Close dialog / menu" />
          </Section>

          <Section title="Global">
            <ShortcutRow keys={['?']} label="Toggle this cheat-sheet" />
          </Section>
        </div>
      </div>
    </Modal>
  );
}
