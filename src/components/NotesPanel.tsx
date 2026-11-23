import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CloudOff,
  Loader2,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';
import { Note } from '../types';
import { pluralize, t } from '../i18n';

type SaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

const STATUS_STYLES: Record<
  SaveStatus,
  { label: string; className: string; icon: typeof Check }
> = {
  clean: { label: t('Saved'), className: 'text-emerald-700 dark:text-emerald-400', icon: Check },
  dirty: { label: t('Unsaved changes'), className: 'text-amber-700 dark:text-amber-400', icon: CloudOff },
  saving: { label: t('Saving…'), className: 'text-[#78716C] dark:text-[#A8A29E]', icon: Loader2 },
  saved: { label: t('Saved'), className: 'text-emerald-700 dark:text-emerald-400', icon: Check },
  error: { label: t('Save failed'), className: 'text-red-700 dark:text-red-400', icon: CloudOff },
};

function noteTitle(note: Note): string {
  return note.title?.trim() || t('Untitled note');
}

function notePreview(note: Note): string {
  const text = note.content.replace(/\s+/g, ' ').trim();
  return text.length > 48 ? `${text.slice(0, 48)}…` : text || t('Empty note');
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface NoteEditorProps {
  note: Note;
  autoSave: boolean;
  intervalSeconds: number;
  onPersist: (noteId: string, content: string) => Promise<void> | void;
}

/** Single-note editor with debounce auto-save. Remounts per note via key. */
function NoteEditor({ note, autoSave, intervalSeconds, onPersist }: NoteEditorProps) {
  const [draft, setDraft] = useState(note.content);
  const [status, setStatus] = useState<SaveStatus>('clean');
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const savedTimerRef = useRef<number | null>(null);

  draftRef.current = draft;

  // Sync when the note's content changes externally (e.g. backup restore)
  // — never clobber in-progress typing.
  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(note.content);
    }
  }, [note.content]);

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return;
    setStatus('saving');
    try {
      await onPersist(note.id, draftRef.current);
      dirtyRef.current = false;
      setStatus('saved');
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setStatus('clean'), 2000);
    } catch {
      setStatus('error');
    }
  }, [onPersist, note.id]);

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
      if (dirtyRef.current) {
        void onPersist(note.id, draftRef.current);
      }
    };
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      onHide();
    };
  }, [autoSave, onPersist, note.id]);

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

  // Print-friendly export: opens a clean document window (title + content
  // only, no app chrome) and triggers the browser print dialog. Prints the
  // live draft so unsaved edits are included.
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const title = escapeHtml(noteTitle(note));
    const bodyHtml = draft.trim()
      ? escapeHtml(draft).replace(/\n/g, '<br>')
      : `<em>${escapeHtml(t('No content'))}</em>`;
    const updated = new Date(note.updatedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
        `<style>body{font-family:Georgia,'Times New Roman',serif;max-width:640px;margin:48px auto;padding:0 24px;color:#1c1917;line-height:1.75}h1{font-size:24px;margin-bottom:4px}h1{font-weight:600}.meta{color:#78716c;font-size:12px;margin-bottom:28px}.content{font-size:15px;white-space:normal}@media print{body{margin:24px}}</style>` +
        `</head><body><h1>${title}</h1><div class="meta">${updated}</div><div class="content">${bodyHtml}</div>` +
        `<scr` + `ipt>window.addEventListener('load',()=>window.print())</scr` + `ipt></body></html>`
    );
    win.document.close();
  };

  return (
    <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl overflow-hidden flex flex-col min-h-[26rem]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-[#2E2A25] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <NotebookPen className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
          <span className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC] truncate">
            {noteTitle(note)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
            {wordCount} {pluralize(wordCount, 'word', 'words')} · {charCount} {pluralize(charCount, 'char', 'chars')}
          </span>
          <button
            type="button"
            onClick={handlePrint}
            aria-label={t('Print {title}', { title: noteTitle(note) })}
            title={t('Print / export as PDF')}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums ${statusInfo.className}`}
            role="status"
            aria-live="polite"
          >
            <StatusIcon className={`w-3.5 h-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />
            {t(statusInfo.label)}
          </span>
          {!autoSave && (
            <button
              type="button"
              onClick={() => void flush()}
              disabled={!dirtyRef.current}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Save className="w-3.5 h-3.5" />
              {t('Save')}
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <textarea
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t('Jot down grammar rules, example sentences, tricky words, or anything worth remembering…')}
        aria-label={t('Note: {title}', { title: noteTitle(note) })}
        spellCheck
        className="flex-1 min-h-[20rem] w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-[#1C1917] dark:text-[#F5F2EC] placeholder:text-[#A8A29E] dark:placeholder:text-[#57534E] focus:outline-none"
      />
    </div>
  );
}

interface NotesPanelProps {
  notes: Note[];
  autoSave: boolean;
  intervalSeconds: number;
  onCreateNote: () => void;
  onRenameNote: (noteId: string, title: string) => void;
  onTogglePin: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onPersist: (noteId: string, content: string) => Promise<void> | void;
  focusNoteId?: string | null;
  onConsumeFocusNote?: () => void;
}

export function NotesPanel({
  notes,
  autoSave,
  intervalSeconds,
  onCreateNote,
  onRenameNote,
  onTogglePin,
  onDeleteNote,
  onPersist,
  focusNoteId = null,
  onConsumeFocusNote,
}: NotesPanelProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Pinned first, then most recently updated
  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [notes]
  );

  // Keep a valid selection; default to the first note
  useEffect(() => {
    if (sortedNotes.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !sortedNotes.some((n) => n.id === activeId)) {
      setActiveId(sortedNotes[0].id);
    }
  }, [sortedNotes, activeId]);

  // First visit with no notes: create a starter sheet
  useEffect(() => {
    if (notes.length === 0) onCreateNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External "jump to this note" requests (card → note links, palette)
  useEffect(() => {
    if (!focusNoteId) return;
    if (sortedNotes.some((n) => n.id === focusNoteId)) {
      setActiveId(focusNoteId);
    }
    onConsumeFocusNote?.();
  }, [focusNoteId, sortedNotes, onConsumeFocusNote]);

  const activeNote = sortedNotes.find((n) => n.id === activeId) ?? null;

  const commitRename = () => {
    if (renamingId) {
      onRenameNote(renamingId, renameDraft.trim());
      setRenamingId(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Note sheets list — deck-style */}
      <aside className="w-full lg:w-60 shrink-0 bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-[#2E2A25]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
            Notes · {sortedNotes.length}
          </span>
          <button
            type="button"
            onClick={onCreateNote}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-[11px] font-semibold transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t('New')}
          </button>
        </div>
        <ul className="max-h-72 lg:max-h-[26rem] overflow-y-auto divide-y divide-slate-100 dark:divide-[#2E2A25] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]">
          {sortedNotes.map((note) => {
            const selected = note.id === activeId;
            const renaming = renamingId === note.id;
            return (
              <li key={note.id}>
                <div
                  className={`group w-full text-left px-4 py-3 transition-colors ${
                    selected
                      ? 'bg-[#B45309]/5 dark:bg-[#D97706]/10'
                      : 'hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveId(note.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        {note.pinned && (
                          <Pin className="w-3 h-3 text-[#B45309] dark:text-[#F59E0B] shrink-0 fill-current" />
                        )}
                        {renaming ? (
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-[#B45309] outline-none text-[#1C1917] dark:text-[#F5F2EC]"
                            aria-label={t('Rename note')}
                          />
                        ) : (
                          <span className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] truncate">
                            {noteTitle(note)}
                          </span>
                        )}
                      </div>
                      {!renaming && (
                        <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate mt-0.5">
                          {notePreview(note)}
                        </p>
                      )}
                      <p className="text-[10px] text-[#A8A29E] dark:text-[#57534E] mt-0.5 tabular-nums">
                        {formatNoteDate(note.updatedAt)}
                      </p>
                    </button>
                    {!renaming && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(note.id);
                            setRenameDraft(note.title ?? '');
                          }}
                          aria-label={t('Rename {title}', { title: noteTitle(note) })}
                          title={t('Rename')}
                          className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-white dark:hover:bg-[#1C1A17] transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onTogglePin(note.id)}
                          aria-label={note.pinned ? `Unpin ${noteTitle(note)}` : `Pin ${noteTitle(note)}`}
                          title={note.pinned ? t('Unpin') : t('Pin to top')}
                          className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-white dark:hover:bg-[#1C1A17] transition-colors"
                        >
                          {note.pinned ? (
                            <PinOff className="w-3 h-3" />
                          ) : (
                            <Pin className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteNote(note.id)}
                          aria-label={t('Delete {title}', { title: noteTitle(note) })}
                          title={t('Delete')}
                          className="p-1 rounded-md text-red-700/70 dark:text-red-400/70 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {sortedNotes.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
              {t('No notes yet — create your first sheet.')}
            </li>
          )}
        </ul>
      </aside>

      {/* Editor */}
      <div className="flex-1 min-w-0 w-full">
        {activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            autoSave={autoSave}
            intervalSeconds={intervalSeconds}
            onPersist={onPersist}
          />
        ) : (
          <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-10 text-center text-sm text-[#78716C] dark:text-[#A8A29E]">
            {t('Select or create a note to start writing.')}
          </div>
        )}
      </div>
    </div>
  );
}
