import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CloudOff, Loader2, NotebookPen, Save } from 'lucide-react';
import { Note } from '../types';

type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

interface NotesPanelProps {
  /** The note currently being edited (null = nothing saved yet). */
  note: Note | null;
  autoSave: boolean;
  /** Debounce interval in seconds between auto-save writes. */
  intervalSeconds: number;
  /** Persist the draft; resolves when the write completes. */
  onPersist: (content: string) => Promise<void> | void;
}

const STATUS_STYLES: Record<SaveStatus, { label: string; className: string; icon: typeof Check }> = {
  clean: { label: 'Saved', className: 'text-emerald-700 dark:text-emerald-400', icon: Check },
  dirty: { label: 'Unsaved changes', className: 'text-amber-700 dark:text-amber-400', icon: CloudOff },
  saving: { label: 'Saving…', className: 'text-[#78716C] dark:text-[#A8A29E]', icon: Loader2 },
  saved: { label: 'Saved', className: 'text-emerald-700 dark:text-emerald-400', icon: Check },
  error: { label: 'Save failed', className: 'text-red-700 dark:text-red-400', icon: CloudOff },
};

export function NotesPanel({
  note,
  autoSave,
  intervalSeconds,
  onPersist,
}: NotesPanelProps) {
  const [draft, setDraft] = useState(note?.content ?? '');
  const [status, setStatus] = useState<SaveStatus>('clean');
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const savedTimerRef = useRef<number | null>(null);

  draftRef.current = draft;

  // Sync the draft when the persisted note changes externally
  // (e.g. backup restore) — never clobber in-progress typing.
  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(note?.content ?? '');
    }
  }, [note?.content]);

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return;
    setStatus('saving');
    try {
      await onPersist(draftRef.current);
      dirtyRef.current = false;
      setStatus('saved');
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setStatus('clean'), 2000);
    } catch {
      setStatus('error');
    }
  }, [onPersist]);

  // Auto-save: trailing debounce on the configured interval
  useEffect(() => {
    if (!autoSave) return;
    const id = window.setInterval(() => {
      void flush();
    }, intervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoSave, intervalSeconds, flush]);

  // Flush pending changes when leaving the view or closing the tab
  useEffect(() => {
    const onHide = () => {
      if (dirtyRef.current && autoSave) {
        void onPersist(draftRef.current);
      }
    };
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      onHide();
    };
  }, [autoSave, onPersist]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    },
    []
  );

  const handleChange = (value: string) => {
    setDraft(value);
    dirtyRef.current = true;
    setStatus('dirty');
  };

  const statusInfo = STATUS_STYLES[status];
  const StatusIcon = statusInfo.icon;
  const charCount = draft.length;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl overflow-hidden flex flex-col min-h-[28rem]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-[#2E2A25] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <NotebookPen className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
          <span className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC] truncate">
            Study Notes
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} chars
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums ${statusInfo.className}`}
            role="status"
            aria-live="polite"
          >
            <StatusIcon className={`w-3.5 h-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
            {statusInfo.label}
          </span>
          {!autoSave && (
            <button
              type="button"
              onClick={() => void flush()}
              disabled={!dirtyRef.current}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Jot down grammar rules, example sentences, tricky words, or anything worth remembering…"
        aria-label="Study notes"
        spellCheck
        className="flex-1 min-h-[20rem] w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-[#1C1917] dark:text-[#F5F2EC] placeholder:text-[#A8A29E] dark:placeholder:text-[#57534E] focus:outline-none"
      />
    </div>
  );
}
