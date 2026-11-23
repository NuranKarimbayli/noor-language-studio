import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  Layers,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { Deck, Note, VocabCard } from '../types';
import { Modal } from './Modal';
import { t } from '../i18n';

export type PaletteActionId =
  | 'new-deck'
  | 'add-words'
  | 'smart-review'
  | 'due-review'
  | 'new-note'
  | 'export-backup';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  decks: Deck[];
  cards: VocabCard[];
  notes: Note[];
  onOpenDeck: (deckId: string) => void;
  onOpenCard: (card: VocabCard) => void;
  onOpenNote: (noteId: string) => void;
  onAction: (id: PaletteActionId) => void;
}

type PaletteItem =
  | { kind: 'action'; id: PaletteActionId; label: string; hint: string; icon: typeof Zap }
  | { kind: 'deck'; id: string; label: string; hint: string; deck: Deck }
  | { kind: 'card'; id: string; label: string; hint: string; card: VocabCard }
  | { kind: 'note'; id: string; label: string; hint: string; note: Note };

const ACTIONS: Array<{
  id: PaletteActionId;
  label: string;
  hint: string;
  icon: typeof Zap;
  keywords: string;
}> = [
  { id: 'smart-review', label: t('Start Smart Review'), hint: t('Due & weak cards first'), icon: Sparkles, keywords: 'study quiz review srs' },
  { id: 'due-review', label: t('Review Due Cards'), hint: t('Everything due today'), icon: Zap, keywords: 'study quiz due today' },
  { id: 'add-words', label: t('Add Words'), hint: t('New vocabulary entry'), icon: Plus, keywords: 'new card word vocabulary' },
  { id: 'new-deck', label: t('New Deck'), hint: t('Create a vocabulary deck'), icon: Layers, keywords: 'create deck folder' },
  { id: 'new-note', label: t('New Note'), hint: t('Blacknotes sheet'), icon: NotebookPen, keywords: 'notebook write note' },
  { id: 'export-backup', label: t('Export Backup'), hint: t('Download full JSON backup'), icon: Download, keywords: 'backup export json save data' },
];

/** Subsequence fuzzy match — returns a score (lower = better) or null. */
function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  const idx = t.indexOf(q);
  if (idx >= 0) return 2 + idx * 0.01;
  // Subsequence match
  let qi = 0;
  let firstIdx = -1;
  let gaps = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstIdx === -1) firstIdx = ti;
      else gaps += ti - (firstIdx + qi) - 1;
      qi++;
    }
  }
  if (qi < q.length) return null;
  return 10 + gaps + firstIdx * 0.1;
}

function buildItems(
  query: string,
  decks: Deck[],
  cards: VocabCard[],
  notes: Note[]
): PaletteItem[] {
  const scored: Array<{ item: PaletteItem; score: number }> = [];

  for (const a of ACTIONS) {
    const s = Math.min(
      fuzzyScore(query, a.label) ?? Infinity,
      fuzzyScore(query, a.keywords) ?? Infinity
    );
    if (Number.isFinite(s)) {
      scored.push({
        score: s,
        item: { kind: 'action', id: a.id, label: a.label, hint: a.hint, icon: a.icon },
      });
    }
  }

  for (const d of decks) {
    const s = fuzzyScore(query, d.name);
    if (s !== null) {
      scored.push({
        score: s,
        item: { kind: 'deck', id: d.id, label: d.name, hint: t('Deck'), deck: d },
      });
    }
  }

  // Cards: match word, translation, or tags. Cap to keep the palette fast.
  for (const c of cards) {
    const s = Math.min(
      fuzzyScore(query, c.word) ?? Infinity,
      fuzzyScore(query, c.translation) ?? Infinity,
      ...(c.tags ?? []).map((t) => fuzzyScore(query, t) ?? Infinity)
    );
    if (Number.isFinite(s)) {
      scored.push({
        score: s + 0.5, // rank slightly below decks/actions on ties
        item: {
          kind: 'card',
          id: c.id,
          label: c.word,
          hint: c.translation,
          card: c,
        },
      });
    }
  }

  for (const n of notes) {
    const title = n.title?.trim() || t('Untitled note');
    const s = Math.min(
      fuzzyScore(query, title) ?? Infinity,
      fuzzyScore(query, n.content.slice(0, 200)) ?? Infinity
    );
    if (s !== null) {
      scored.push({
        score: s + 0.5,
        item: { kind: 'note', id: n.id, label: title, hint: t('Note'), note: n },
      });
    }
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 24).map((s) => s.item);
}

export function CommandPalette({
  open,
  onClose,
  decks,
  cards,
  notes,
  onOpenDeck,
  onOpenCard,
  onOpenNote,
  onAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => (open ? buildItems(query, decks, cards, notes) : []),
    [open, query, decks, cards, notes]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const activate = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    if (item.kind === 'action') onAction(item.id);
    else if (item.kind === 'deck') onOpenDeck(item.deck.id);
    else if (item.kind === 'card') onOpenCard(item.card);
    else onOpenNote(item.note.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(items[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Global Escape closes the palette even when focus isn't in the input
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Keep the active row scrolled into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const sectionOf = (item: PaletteItem) =>
    item.kind === 'action' ? t('Actions') : item.kind === 'deck' ? t('Decks') : item.kind === 'card' ? t('Words') : t('Notes');

  let lastSection = '';

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Command palette" panelClassName="max-w-xl overflow-hidden">
      <div className="w-full">
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-200 dark:border-[#2E2A25]">
          <Search className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('Search decks, words, notes, or actions…')}
            aria-label={t('Command palette search')}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[activeIndex] ? `cp-${items[activeIndex].id}` : undefined}
            className="flex-1 py-3.5 bg-transparent text-sm text-[#1C1917] dark:text-[#F5F2EC] placeholder:text-[#A8A29E] focus:outline-none"
          />
          <kbd className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#F3EFE8] dark:bg-[#25221E] text-[#78716C] dark:text-[#A8A29E]">
            esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            title={t('Close')}
            className="p-1.5 rounded-lg text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-[24rem] overflow-y-auto py-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]"
        >
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[#78716C] dark:text-[#A8A29E]">
              No matches{query ? ` for “${query}”` : ''}.
            </p>
          )}
          {items.map((item, idx) => {
            const section = sectionOf(item);
            const showHeader = section !== lastSection;
            lastSection = section;
            const Icon =
              item.kind === 'action'
                ? item.icon
                : item.kind === 'deck'
                  ? Layers
                  : item.kind === 'card'
                    ? BookOpen
                    : ClipboardList;
            return (
              <div key={`${item.kind}-${item.id}`}>
                {showHeader && (
                  <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A8A29E] dark:text-[#57534E]">
                    {section}
                  </p>
                )}
                <button
                  id={`cp-${item.id}`}
                  data-idx={idx}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => activate(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    idx === activeIndex
                      ? 'bg-[#B45309]/10 dark:bg-[#D97706]/15'
                      : 'hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] truncate">
                      {t(item.label)}
                    </span>
                    {item.hint && (
                      <span className="block text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
                        {t(item.hint)}
                      </span>
                    )}
                  </span>
                  {idx === activeIndex && (
                    <ArrowRight className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-200 dark:border-[#2E2A25] text-[10px] text-[#A8A29E] dark:text-[#57534E]">
          <span className="inline-flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-[#F3EFE8] dark:bg-[#25221E]">↑↓</kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-[#F3EFE8] dark:bg-[#25221E]">↵</kbd>
            select
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="font-mono px-1 py-0.5 rounded bg-[#F3EFE8] dark:bg-[#25221E]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </Modal>
  );
}
