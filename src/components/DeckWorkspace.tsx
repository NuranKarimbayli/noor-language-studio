import { ChangeEvent, FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  BookOpen,
  FileDown,
  FileUp,
  ListPlus,
  MoreHorizontal,
  NotebookPen,
  NotebookText,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { ConfidenceLevel, Deck, DifficultyLevel, Note, SmartDeck, SmartDeckFilter, VocabCard } from '../types';
import { exportDeckAsCsv, exportDeckAsJson, findDuplicateCard, getCardDifficulty, parseCardTags, parseImportedDeckJson } from '../utils/storage';
import { getDeckMastery, getSmartDeckCards, isCardDue, isLeechCard, matchesSmartFilter } from '../utils/srs';
import { parseBulkLines } from '../utils/textUtils';
import { DiacriticBar } from './DiacriticBar';
import { Modal } from './Modal';
import { SpeakButton } from './SpeakButton';
import { VoiceSelection } from '../utils/speechUtils';
import { pluralize, t } from '../i18n';

interface DeckWorkspaceProps {
  languageName: string;
  languageCode: string;
  decks: Deck[];
  cards: VocabCard[];
  selectedDeckId: string;
  addWordsTrigger: number;
  onConsumeAddWords: () => void;
  createDeckTrigger?: number;
  onConsumeCreateDeck?: () => void;
  onSelectDeck: (deckId: string) => void;
  onCreateDeck: (data: { name: string; description: string }) => Promise<Deck>;
  onUpdateDeck: (
    deckId: string,
    updates: { name?: string; description?: string }
  ) => Promise<void>;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onAddCard: (
    deckId: string,
    data: {
      word: string;
      translation: string;
      exampleSentence?: string;
      difficulty?: DifficultyLevel;
      mnemonic?: string;
      tags?: string[];
    }
  ) => Promise<void>;
  onBulkAddCards: (
    deckId: string,
    items: Array<{ word: string; translation: string; exampleSentence?: string }>,
    difficulty?: DifficultyLevel
  ) => Promise<void>;
  onUpdateCard: (
    cardId: string,
    updates: {
      word: string;
      translation: string;
      exampleSentence?: string;
      difficulty?: DifficultyLevel;
      mnemonic?: string;
      tags?: string[];
    }
  ) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onToggleCardSuspended: (cardId: string, suspended: boolean) => Promise<void> | void;
  onBulkDeleteCards: (cardIds: string[]) => Promise<void>;
  onBulkUpdateCards: (
    cardIds: string[],
    updates: { deckId?: string; difficulty?: DifficultyLevel }
  ) => Promise<void>;
  onImportDeckJson: (payload: {
    deckName: string;
    description: string;
    cards: Array<{
      word: string;
      translation: string;
      exampleSentence?: string;
      confidence: ConfidenceLevel;
      difficulty?: DifficultyLevel;
      tags?: string[];
    }>;
  }) => Promise<void>;
  onPracticeDeck: (deckId: string) => void;
  smartDecks: SmartDeck[];
  onCreateSmartDeck: (data: {
    name: string;
    description?: string;
    filter: SmartDeckFilter;
  }) => Promise<void>;
  onDeleteSmartDeck: (smartDeckId: string) => Promise<void>;
  onStudySmartDeck: (smartDeck: SmartDeck) => void;
  onNotify: (text: string, variant?: 'success' | 'info' | 'error') => void;
  ttsMuted?: boolean;
  voice?: VoiceSelection | null;
  notes?: Note[];
  onSendCardToNote?: (card: VocabCard) => void;
  onOpenLinkedNote?: (noteId: string) => void;
}

type ModalState =
  | { type: 'none' }
  | { type: 'create-deck' }
  | { type: 'edit-deck'; deck: Deck }
  | { type: 'delete-deck'; deck: Deck }
  | { type: 'add-words'; tab: 'single' | 'bulk' }
  | { type: 'edit-card'; card: VocabCard }
  | { type: 'json-import' }
  | { type: 'create-smart-deck' }
  | { type: 'delete-smart-deck'; smartDeck: SmartDeck };

const CONFIDENCE_FILTERS: Array<{ value: 'all' | ConfidenceLevel; label: string }> = [
  { value: 'all', label: t('All') },
  { value: 'new', label: t('New') },
  { value: 'hard', label: t('Hard') },
  { value: 'good', label: t('Good') },
  { value: 'easy', label: t('Easy') },
];

const SMART_FILTER_OPTIONS: Array<{ key: keyof SmartDeckFilter; label: string; hint: string }> = [
  { key: 'weak', label: t('Weak words'), hint: t('Hard-rated or low Leitner box') },
  { key: 'due', label: t('Due for review'), hint: t('Scheduled review is due now') },
  { key: 'leeches', label: t('Leeches'), hint: t('Repeatedly missed cards') },
  { key: 'newOnly', label: t('New cards'), hint: t('Never reviewed yet') },
  { key: 'hardOnly', label: t('Hard-rated'), hint: t('Self-rated Hard') },
];

function smartFilterSummary(filter: SmartDeckFilter): string {
  const parts = SMART_FILTER_OPTIONS.filter((o) => filter[o.key]).map((o) => t(o.label).toLowerCase());
  if (filter.tag?.trim()) parts.push(`${t('tag')}: ${filter.tag.trim()}`);
  return parts.length > 0 ? parts.join(' + ') : t('no filters');
}

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyLevel; label: string }> = [
  { value: 'easy', label: t('Easy') },
  { value: 'medium', label: t('Medium') },
  { value: 'hard', label: t('Hard') },
];

export function DeckWorkspace({
  languageName,
  languageCode,
  decks,
  cards,
  selectedDeckId,
  addWordsTrigger,
  onConsumeAddWords,
  createDeckTrigger = 0,
  onConsumeCreateDeck,
  onSelectDeck,
  onCreateDeck,
  onUpdateDeck,
  onDeleteDeck,
  onAddCard,
  onBulkAddCards,
  onUpdateCard,
  onDeleteCard,
  onToggleCardSuspended,
  onBulkDeleteCards,
  onBulkUpdateCards,
  onImportDeckJson,
  onPracticeDeck,
  smartDecks,
  onCreateSmartDeck,
  onDeleteSmartDeck,
  onStudySmartDeck,
  onNotify,
  ttsMuted = false,
  voice,
  notes = [],
  onSendCardToNote,
  onOpenLinkedNote,
}: DeckWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | ConfidenceLevel>('all');
  const [modalState, setModal] = useState<ModalState>({ type: 'none' });
  // Keep the last open modal payload so the exit animation retains content
  const lastModalRef = useRef<ModalState>({ type: 'none' });
  if (modalState.type !== 'none') lastModalRef.current = modalState;
  const modal = modalState.type !== 'none' ? modalState : lastModalRef.current;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Dropdown menus
  const [openDeckMenuId, setOpenDeckMenuId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);

  // Bulk multi-select state for the word list
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bulkMoveDeckId, setBulkMoveDeckId] = useState('');

  // Smart deck selection + creation state
  const [selectedSmartDeckId, setSelectedSmartDeckId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [smartDeckName, setSmartDeckName] = useState('');
  const [smartDeckDesc, setSmartDeckDesc] = useState('');
  const [smartDeckFilter, setSmartDeckFilter] = useState<SmartDeckFilter>({});
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Deck form state
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');

  // Card form state
  const [cardWord, setCardWord] = useState('');
  const [cardTranslation, setCardTranslation] = useState('');
  const [cardExample, setCardExample] = useState('');
  const [cardMnemonic, setCardMnemonic] = useState('');
  const [cardTagsInput, setCardTagsInput] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [targetDeckNameForNew, setTargetDeckNameForNew] = useState('');
  const wordInputRef = useRef<HTMLInputElement>(null);
  const bulkTextRef = useRef<HTMLTextAreaElement>(null);

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [cardDifficulty, setCardDifficulty] = useState<DifficultyLevel>('medium');
  const [bulkDifficulty, setBulkDifficulty] = useState<DifficultyLevel>('medium');

  // JSON import state
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) ?? decks[0] ?? null,
    [decks, selectedDeckId]
  );

  // Auto-select first deck if selected deck no longer exists
  useEffect(() => {
    if (selectedDeckId && !decks.find((d) => d.id === selectedDeckId) && decks.length > 0) {
      onSelectDeck(decks[0].id);
    }
  }, [selectedDeckId, decks, onSelectDeck]);

  const deckCards = useMemo(() => {
    if (!selectedDeck) return [];
    return cards.filter((c) => c.deckId === selectedDeck.id);
  }, [cards, selectedDeck]);

  // Smart decks compute membership live from card SRS state
  const activeSmartDeck = useMemo(
    () => smartDecks.find((s) => s.id === selectedSmartDeckId) ?? null,
    [smartDecks, selectedSmartDeckId]
  );

  const smartDeckCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sd of smartDecks) {
      counts.set(
        sd.id,
        cards.reduce((n, c) => n + (matchesSmartFilter(c, sd.filter) ? 1 : 0), 0)
      );
    }
    return counts;
  }, [smartDecks, cards]);

  const smartPreviewCount = useMemo(
    () =>
      cards.reduce(
        (n, c) => n + (matchesSmartFilter(c, smartDeckFilter) ? 1 : 0),
        0
      ),
    [cards, smartDeckFilter]
  );

  const viewCards = useMemo(() => {
    const base = activeSmartDeck
      ? getSmartDeckCards(cards, activeSmartDeck.filter)
      : deckCards;
    return showArchived ? base : base.filter((c) => !c.suspended);
  }, [activeSmartDeck, cards, deckCards, showArchived]);

  // Single pass over cards to avoid O(decks × cards) filtering on every render
  const cardCountsByDeck = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      counts.set(card.deckId, (counts.get(card.deckId) ?? 0) + 1);
    }
    return counts;
  }, [cards]);

  // Per-deck count of cards currently due for SRS review
  const dueCountByDeck = useMemo(() => {
    const counts = new Map<string, number>();
    const nowMs = Date.now();
    for (const card of cards) {
      if (isCardDue(card, nowMs)) {
        counts.set(card.deckId, (counts.get(card.deckId) ?? 0) + 1);
      }
    }
    return counts;
  }, [cards]);

  // Per-deck mastery breakdown (mastered / learning / fresh + percentage)
  const masteryByDeck = useMemo(() => {
    const byDeck = new Map<string, VocabCard[]>();
    for (const card of cards) {
      const list = byDeck.get(card.deckId);
      if (list) list.push(card);
      else byDeck.set(card.deckId, [card]);
    }
    const result = new Map<string, ReturnType<typeof getDeckMastery>>();
    for (const [deckId, deckCards] of byDeck) {
      result.set(deckId, getDeckMastery(deckCards));
    }
    return result;
  }, [cards]);

  const selectedDeckMastery = selectedDeck
    ? masteryByDeck.get(selectedDeck.id)
    : undefined;

  const stats = useMemo(() => {
    const counts = { total: viewCards.length, new: 0, hard: 0, good: 0, easy: 0 };
    for (const c of viewCards) {
      counts[c.confidence] += 1;
    }
    return counts;
  }, [viewCards]);

  // Deferred value keeps the list responsive while a large filter recomputes
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);

  // Unique tags across the current view, for the filter dropdown + datalist
  const availableTags = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of viewCards) {
      for (const t of c.tags ?? []) {
        const key = t.toLowerCase();
        if (!set.has(key)) set.set(key, t);
      }
    }
    return [...set.values()].sort((a, b) => a.localeCompare(b));
  }, [viewCards]);

  const filteredCards = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const wantedTag = tagFilter === 'all' ? '' : tagFilter.toLowerCase();
    return viewCards.filter((card) => {
      if (confidenceFilter !== 'all' && card.confidence !== confidenceFilter) {
        return false;
      }
      if (
        wantedTag &&
        !(card.tags ?? []).some((t) => t.toLowerCase() === wantedTag)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        card.word.toLowerCase().includes(q) ||
        card.translation.toLowerCase().includes(q) ||
        (card.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (card.exampleSentence && card.exampleSentence.toLowerCase().includes(q))
      );
    });
  }, [viewCards, deferredSearchQuery, confidenceFilter, tagFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;

  // Clamp the page if deletions shrink the result set below the current page
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCards.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCards, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [confidenceFilter]);

  const bulkParsed = useMemo(() => parseBulkLines(bulkText), [bulkText]);

  // Bulk selection helpers — selection is scoped to the current view
  useEffect(() => {
    setSelectedCardIds(new Set());
    setBulkMoveDeckId('');
    setSelectionMode(false);
  }, [selectedDeckId, selectedSmartDeckId]);

  const toggleCardSelection = useCallback((cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedCardIds(new Set());
    setBulkMoveDeckId('');
  }, []);

  const runBulkMove = async (deckId: string) => {
    if (!deckId || selectedCardIds.size === 0) return;
    try {
      await onBulkUpdateCards([...selectedCardIds], { deckId });
      exitSelectionMode();
    } catch {
      onNotify(t('Could not move the words. Please try again.'), 'error');
    }
  };

  const runBulkDifficulty = async (difficulty: DifficultyLevel) => {
    if (selectedCardIds.size === 0) return;
    try {
      await onBulkUpdateCards([...selectedCardIds], { difficulty });
      exitSelectionMode();
    } catch {
      onNotify(t('Could not update difficulty. Please try again.'), 'error');
    }
  };

  const runBulkDelete = async () => {
    if (selectedCardIds.size === 0) return;
    try {
      await onBulkDeleteCards([...selectedCardIds]);
      exitSelectionMode();
    } catch {
      onNotify(t('Could not delete the words. Please try again.'), 'error');
    }
  };

  // Non-blocking duplicate warning: same word (case/diacritic-insensitive)
  // already present in the target deck
  const duplicateMatch = useMemo(() => {
    const word = cardWord.trim();
    if (!word) return undefined;
    if (modal.type !== 'add-words' && modal.type !== 'edit-card') return undefined;
    const pool =
      modal.type === 'edit-card'
        ? cards.filter((c) => c.deckId === modal.card.deckId)
        : selectedDeck
          ? deckCards
          : [];
    return findDuplicateCard(
      pool,
      word,
      modal.type === 'edit-card' ? modal.card.id : undefined
    );
  }, [cardWord, modal, cards, deckCards, selectedDeck]);

  // Close open dropdown menus when clicking anywhere outside
  useEffect(() => {
    if (!openDeckMenuId && !headerMenuOpen && !openCardMenuId) return;
    const handleDocClick = () => {
      setOpenDeckMenuId(null);
      setHeaderMenuOpen(false);
      setOpenCardMenuId(null);
    };
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, [openDeckMenuId, headerMenuOpen, openCardMenuId]);

  // Close all dropdowns on unmount
  useEffect(() => {
    return () => {
      setOpenDeckMenuId(null);
      setHeaderMenuOpen(false);
      setOpenCardMenuId(null);
    };
  }, []);

  // Escape closes open dropdown menus — but only when no modal layer is
  // above them (modals handle their own Escape via the shared Modal stack).
  useEffect(() => {
    if (modal.type !== 'none') return;
    if (!openDeckMenuId && !headerMenuOpen && !openCardMenuId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setOpenDeckMenuId(null);
        setHeaderMenuOpen(false);
        setOpenCardMenuId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal.type, openDeckMenuId, headerMenuOpen, openCardMenuId]);

  // Trigger "+ Add Words" modal from top navigation CTA / command palette.
  // If a modal is already open we just consume the trigger — never reset
  // an in-progress form.
  useEffect(() => {
    if (addWordsTrigger <= 0) return;
    onConsumeAddWords();
    if (modal.type !== 'none') return;
    setCardWord('');
    setCardTranslation('');
    setCardExample('');
    setCardMnemonic('');
    setCardTagsInput('');
    setBulkText('');
    setCardDifficulty('medium');
    setBulkDifficulty('medium');
    setTargetDeckNameForNew(`${languageName} Basics`);
    setModal({ type: 'add-words', tab: 'single' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addWordsTrigger]);

  // Trigger "New Deck" modal from the command palette
  useEffect(() => {
    if (createDeckTrigger <= 0) return;
    onConsumeCreateDeck?.();
    if (modal.type !== 'none') return;
    openCreateDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDeckTrigger]);

  const openCreateDeck = () => {
    setDeckName('');
    setDeckDescription('');
    setModal({ type: 'create-deck' });
  };

  const openEditDeck = (deck: Deck) => {
    setDeckName(deck.name);
    setDeckDescription(deck.description);
    setModal({ type: 'edit-deck', deck });
  };

  const openAddWords = (tab: 'single' | 'bulk' = 'single') => {
    setCardWord('');
    setCardTranslation('');
    setCardExample('');
    setCardMnemonic('');
    setCardTagsInput('');
    setBulkText('');
    setCardDifficulty('medium');
    setBulkDifficulty('medium');
    setTargetDeckNameForNew(`${languageName} Basics`);
    setModal({ type: 'add-words', tab });
  };

  const openEditCard = (card: VocabCard) => {
    setCardWord(card.word);
    setCardTranslation(card.translation);
    setCardExample(card.exampleSentence ?? '');
    setCardMnemonic(card.mnemonic ?? '');
    setCardTagsInput((card.tags ?? []).join(', '));
    setCardDifficulty(getCardDifficulty(card));
    setModal({ type: 'edit-card', card });
  };

  const openJsonImport = () => {
    setJsonText('');
    setJsonError(null);
    setModal({ type: 'json-import' });
  };

  const handleDeckSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = deckName.trim();
    if (!trimmedName) return;

    try {
      if (modal.type === 'create-deck') {
        const created = await onCreateDeck({
          name: trimmedName,
          description: deckDescription.trim(),
        });
        onSelectDeck(created.id);
        onNotify(t('Created deck "{name}"', { name: created.name }), 'success');
      } else if (modal.type === 'edit-deck') {
        await onUpdateDeck(modal.deck.id, {
          name: trimmedName,
          description: deckDescription.trim(),
        });
        onNotify(t('Updated deck "{name}"', { name: trimmedName }), 'success');
      }
      setModal({ type: 'none' });
    } catch {
      onNotify(t('Could not save the deck. Please try again.'), 'error');
    }
  };

  const ensureTargetDeck = async (): Promise<Deck> => {
    if (selectedDeck) return selectedDeck;
    const created = await onCreateDeck({
      name: targetDeckNameForNew.trim() || `${languageName} Vocabulary`,
      description: `Custom ${languageName} vocabulary list`,
    });
    onSelectDeck(created.id);
    return created;
  };

  const handleSingleCardSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const word = cardWord.trim();
    const translation = cardTranslation.trim();
    const exampleSentence = cardExample.trim() || undefined;
    const mnemonic = cardMnemonic.trim() || undefined;
    const tags = parseCardTags(cardTagsInput);
    if (!word || !translation) return;

    try {
      if (modal.type === 'edit-card') {
        await onUpdateCard(modal.card.id, {
          word,
          translation,
          exampleSentence,
          difficulty: cardDifficulty,
          mnemonic,
          tags,
        });
        onNotify(t('Updated "{word}"', { word }), 'success');
      } else {
        const target = await ensureTargetDeck();
        await onAddCard(target.id, {
          word,
          translation,
          exampleSentence,
          difficulty: cardDifficulty,
          mnemonic,
          tags,
        });
        onNotify(t('Added "{word}"', { word }), 'success');
      }
      setModal({ type: 'none' });
    } catch {
      onNotify(t('Could not save the word. Please try again.'), 'error');
    }
  };

  const handleBulkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (bulkParsed.items.length === 0) return;
    try {
      const target = await ensureTargetDeck();
      await onBulkAddCards(target.id, bulkParsed.items, bulkDifficulty);
      onNotify(
        t('Imported {count} {words} into "{name}"', {
          count: bulkParsed.items.length,
          words: pluralize(bulkParsed.items.length, 'word', 'words'),
          name: target.name,
        }),
        'success'
      );
      setModal({ type: 'none' });
    } catch {
      onNotify(t('Could not import the words. Please try again.'), 'error');
    }
  };

  const insertCharAtCursor = (
    input: HTMLInputElement | HTMLTextAreaElement | null,
    current: string,
    apply: (next: string) => void,
    char: string
  ) => {
    if (!input) {
      apply(current + char);
      return;
    }
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;
    apply(current.slice(0, start) + char + current.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + char.length, start + char.length);
    });
  };

  const handleInsertDiacritic = (char: string) => {
    insertCharAtCursor(wordInputRef.current, cardWord, setCardWord, char);
  };

  const handleInsertBulkDiacritic = (char: string) => {
    insertCharAtCursor(bulkTextRef.current, bulkText, setBulkText, char);
  };

  const handleJsonFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonText(reader.result);
        setJsonError(null);
      }
      // Allow re-selecting the same file on consecutive imports
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleJsonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const parsed = parseImportedDeckJson(jsonText);
      await onImportDeckJson(parsed);
      onNotify(
        `Imported "${parsed.deckName}" (${parsed.cards.length} words)`,
        'success'
      );
      setModal({ type: 'none' });
    } catch (err) {
      setJsonError(
        err instanceof Error ? err.message : t('Could not import the deck. Please try again.')
      );
    }
  };

  const handleSelectDeckCard = (deckId: string) => {
    setSelectedSmartDeckId(null);
    onSelectDeck(deckId);
  };

  const openCreateSmartDeck = () => {
    setSmartDeckName('');
    setSmartDeckDesc('');
    setSmartDeckFilter({});
    setModal({ type: 'create-smart-deck' });
  };

  const handleSmartDeckSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = smartDeckName.trim();
    if (!name) return;
    const hasFilter =
      SMART_FILTER_OPTIONS.some((o) => smartDeckFilter[o.key]) ||
      Boolean(smartDeckFilter.tag?.trim());
    if (!hasFilter) {
      onNotify(t('Pick at least one filter for the smart deck.'), 'error');
      return;
    }
    try {
      await onCreateSmartDeck({
        name,
        description: smartDeckDesc.trim() || undefined,
        filter: {
          ...smartDeckFilter,
          tag: smartDeckFilter.tag?.trim() || undefined,
        },
      });
      setModal({ type: 'none' });
    } catch {
      onNotify(t('Could not create the smart deck. Please try again.'), 'error');
    }
  };

  const handleBulkFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!text.trim()) {
        onNotify(t('That file appears to be empty.'), 'error');
        return;
      }
      setBulkText(text);
      const parsed = parseBulkLines(text);
      onNotify(
        `Loaded ${file.name} — ${parsed.items.length} entries detected.`,
        'success'
      );
    };
    reader.onerror = () => onNotify(t('Could not read that file.'), 'error');
    reader.readAsText(file);
  };

  const renderDifficultyPicker = (
    value: DifficultyLevel,
    onChange: (next: DifficultyLevel) => void
  ) => (
    <div>
      <span className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
        {t('Difficulty')}
      </span>
      <div className="flex items-center gap-1.5">
        {DIFFICULTY_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                active
                  ? opt.value === 'easy'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                    : opt.value === 'medium'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                      : 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200'
                  : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
              }`}
            >
              {t(opt.label)}
            </button>
          );
        })}
      </div>
    </div>
  );

  const confidenceStyle = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case 'easy':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'good':
        return 'text-[#B45309] dark:text-[#F59E0B]';
      case 'hard':
        return 'text-red-700 dark:text-red-400';
      default:
        return 'text-[#78716C] dark:text-[#A8A29E]';
    }
  };

  return (
    <div className="space-y-12">
      {/* Section 1: Airy Deck Selector Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-[#57534E] dark:text-[#A8A29E]">
            {languageName} Decks ({decks.length + smartDecks.length})
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openJsonImport}
              className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
            >
              {t('Import JSON')}
            </button>
            <button
              type="button"
              onClick={openCreateSmartDeck}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              {t('Smart Deck')}
            </button>
            <button
              type="button"
              onClick={openCreateDeck}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('New Deck')}
            </button>
          </div>
        </div>

        {decks.length === 0 && smartDecks.length === 0 ? (
          <div className="py-16 px-6 text-center bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] mb-2">
              No {languageName} decks yet
            </h1>
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mb-6 max-w-md mx-auto">
              Create your first {languageName} deck or import an existing JSON deck to begin.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openCreateDeck}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('Create First Deck')}
              </button>
              <button
                type="button"
                onClick={openJsonImport}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] transition-colors"
              >
                <FileUp className="w-4 h-4" />
                {t('Import JSON')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {smartDecks.map((sd) => {
              const count = smartDeckCounts.get(sd.id) ?? 0;
              const active = selectedSmartDeckId === sd.id;
              return (
                <div
                  key={sd.id}
                  onClick={() => setSelectedSmartDeckId(sd.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSmartDeckId(sd.id);
                    }
                  }}
                  className={`group relative text-left rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all duration-200 ease-out ${
                    active
                      ? 'bg-white dark:bg-[#1C1A17] border-[#B45309] dark:border-[#D97706] shadow-sm ring-1 ring-[#B45309]/20 dark:ring-[#D97706]/25'
                      : 'bg-[#FBF7F0]/70 dark:bg-[#1A1714] border-slate-200 dark:border-[#2E2A25] hover:border-[#D97706]/60 dark:hover:border-[#D97706]/40 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Zap className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
                      <h3 className="font-medium text-sm sm:text-base text-[#1C1917] dark:text-[#F5F2EC] leading-snug truncate">
                        {sd.name}
                      </h3>
                    </div>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#B45309]/10 dark:bg-[#D97706]/15 text-[#B45309] dark:text-[#F59E0B] text-[10px] font-semibold uppercase tracking-wide">
                      {t('Smart')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
                    {smartFilterSummary(sd.filter)}
                    {sd.description ? ` · ${sd.description}` : ''}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                    <span>
                      {count} {pluralize(count, 'word', 'words')} {t('now')}
                    </span>
                  </div>
                </div>
              );
            })}
            {decks.map((deck) => {
              const count = cardCountsByDeck.get(deck.id) ?? 0;
              const dueCount = dueCountByDeck.get(deck.id) ?? 0;
              const mastery = masteryByDeck.get(deck.id);
              const active = selectedDeck?.id === deck.id;
              const menuOpen = openDeckMenuId === deck.id;

              return (
                <div
                  key={deck.id}
                  onClick={() => handleSelectDeckCard(deck.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectDeckCard(deck.id);
                    }
                  }}
                  className={`group relative text-left rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all duration-200 ease-out ${
                    active
                      ? 'bg-white dark:bg-[#1C1A17] border-[#B45309] dark:border-[#D97706] shadow-sm ring-1 ring-[#B45309]/20 dark:ring-[#D97706]/25'
                      : 'bg-white/70 dark:bg-[#171513] border-slate-200 dark:border-[#2E2A25] hover:border-[#B45309]/50 dark:hover:border-[#D97706]/40 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm sm:text-base text-[#1C1917] dark:text-[#F5F2EC] leading-snug pr-2">
                      {deck.name}
                    </h3>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label={t('More actions for {name}', { name: deck.name })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHeaderMenuOpen(false);
                          setOpenCardMenuId(null);
                          setOpenDeckMenuId(menuOpen ? null : deck.id);
                        }}
                        className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      <AnimatePresence>
                      {menuOpen && (
                        <motion.div
                          key="deck-menu"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-1 w-40 z-20 bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-xl shadow-lg py-1 text-xs"
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          style={{ transformOrigin: 'top right' }}
                        >
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDeckMenuId(null);
                                onPracticeDeck(deck.id);
                              }}
                              className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#B45309] dark:text-[#F59E0B] font-medium hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              {t('Practice Deck')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenDeckMenuId(null);
                              openEditDeck(deck);
                            }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#78716C]" />
                            {t('Edit Deck')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenDeckMenuId(null);
                              const dCards = cards.filter((c) => c.deckId === deck.id);
                              exportDeckAsJson(deck, dCards);
                              onNotify(t('Exported "{name}" as JSON', { name: deck.name }), 'success');
                            }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                          >
                            <FileUp className="w-3.5 h-3.5 text-[#78716C]" />
                            {t('Export JSON')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenDeckMenuId(null);
                              const dCards = cards.filter((c) => c.deckId === deck.id);
                              exportDeckAsCsv(deck, dCards);
                              onNotify(t('Exported "{name}" as CSV', { name: deck.name }), 'success');
                            }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                          >
                            <FileDown className="w-3.5 h-3.5 text-[#78716C]" />
                            {t('Export CSV')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenDeckMenuId(null);
                              setModal({ type: 'delete-deck', deck });
                            }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('Delete Deck')}
                          </button>
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                    <span>
                      {count} {pluralize(count, 'word', 'words')}
                    </span>
                    {dueCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#B45309]/10 dark:bg-[#D97706]/15 text-[#B45309] dark:text-[#F59E0B] font-medium">
                        {dueCount} due
                      </span>
                    )}
                    {mastery && count > 0 && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium"
                        title={t('{mastered} mastered · {learning} learning · {fresh} new', { mastered: mastery.mastered, learning: mastery.learning, fresh: mastery.fresh })}
                      >
                        {mastery.masteryPct}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Active Deck Word List */}
      {selectedDeck && (
        <section className="space-y-5">
          {/* Calm Deck Title & Overflow Menu */}
          {activeSmartDeck ? (
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2E2A25]">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EC]">
                    {activeSmartDeck.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#B45309]/10 dark:bg-[#D97706]/15 text-[#B45309] dark:text-[#F59E0B] text-[10px] font-semibold uppercase tracking-wide">
                    <Zap className="w-3 h-3" />
                    {t('Smart')}
                  </span>
                </div>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] max-w-xl">
                  {smartFilterSummary(activeSmartDeck.filter)}
                  {activeSmartDeck.description ? ` — ${activeSmartDeck.description}` : ''}
                  {' '}Membership updates automatically as your SRS state changes.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums pt-0.5">
                  <span>{stats.total} {pluralize(stats.total, 'word', 'words')} {t('now')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.easy} easy</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.good} good</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.hard} hard</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.new} new</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onStudySmartDeck(activeSmartDeck)}
                  disabled={viewCards.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Play className="w-4 h-4" />
                  Study This Set ({viewCards.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'delete-smart-deck', smartDeck: activeSmartDeck })}
                  aria-label={t('Delete smart deck {name}', { name: activeSmartDeck.name })}
                  className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2E2A25]">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EC]">
                {selectedDeck?.name ?? ''}
              </h1>
              {selectedDeck.description && (
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] max-w-xl">
                  {selectedDeck.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums pt-0.5">
                <span>{stats.total} {pluralize(stats.total, 'word', 'words')}</span>
                <span aria-hidden="true">·</span>
                <span>{stats.easy} easy</span>
                <span aria-hidden="true">·</span>
                <span>{stats.good} good</span>
                <span aria-hidden="true">·</span>
                <span>{stats.hard} hard</span>
                <span aria-hidden="true">·</span>
                <span>{stats.new} new</span>
                {selectedDeckMastery && selectedDeckMastery.total > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className="text-emerald-700 dark:text-emerald-300 font-medium"
                      title={t('{mastered} mastered · {learning} learning · {fresh} new', { mastered: selectedDeckMastery.mastered, learning: selectedDeckMastery.learning, fresh: selectedDeckMastery.fresh })}
                    >
                      {selectedDeckMastery.masteryPct}% mastery
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {selectedDeckMastery.mastered} mastered ·{' '}
                      {selectedDeckMastery.learning} learning ·{' '}
                      {selectedDeckMastery.fresh} new
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  aria-label={t('Deck actions')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDeckMenuId(null);
                    setOpenCardMenuId(null);
                    setHeaderMenuOpen((prev) => !prev);
                  }}
                  className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                <AnimatePresence>
                {headerMenuOpen && (
                  <motion.div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-1.5 w-48 z-20 bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-xl shadow-lg py-1.5 text-xs"
                    initial={{ opacity: 0, scale: 0.92, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{ transformOrigin: 'top right' }}
                  >
                    {deckCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          onPracticeDeck(selectedDeck.id);
                        }}
                        className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#B45309] dark:text-[#F59E0B] font-medium hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {t('Practice This Deck')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        openAddWords('bulk');
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                    >
                      <ListPlus className="w-3.5 h-3.5 text-[#78716C]" />
                      {t('Bulk Import Words')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        openEditDeck(selectedDeck);
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#78716C]" />
                      {t('Edit Deck')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        exportDeckAsJson(selectedDeck, deckCards);
                        onNotify(t('Exported "{name}" as JSON', { name: selectedDeck.name }), 'success');
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                    >
                      <FileUp className="w-3.5 h-3.5 text-[#78716C]" />
                      {t('Export JSON')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        exportDeckAsCsv(selectedDeck, deckCards);
                        onNotify(t('Exported "{name}" as CSV', { name: selectedDeck.name }), 'success');
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                    >
                      <FileDown className="w-3.5 h-3.5 text-[#78716C]" />
                      {t('Export CSV')}
                    </button>
                    <div className="my-1 border-t border-slate-200 dark:border-[#2E2A25]" />
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setModal({ type: 'delete-deck', deck: selectedDeck });
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('Delete Deck')}
                    </button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          )}

          {/* Search & Minimal Filter Strip */}
          {viewCards.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78716C] dark:text-[#A8A29E] pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search words...')}
                    className="w-full pl-10 pr-9 py-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] placeholder:text-[#78716C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={t('Clear search')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {!activeSmartDeck && (
                <button
                  type="button"
                  onClick={() => openAddWords('single')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('New Word')}</span>
                </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    selectionMode ? exitSelectionMode() : setSelectionMode(true)
                  }
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectionMode
                      ? 'bg-[#B45309] text-white'
                      : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                  }`}
                >
                  {selectionMode ? t('Done') : t('Select')}
                </button>
                {deckCards.some((c) => c.suspended) && (
                  <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                      showArchived
                        ? 'bg-[#B45309] text-white'
                        : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                    }`}
                  >
                    <Archive className="w-3 h-3" />
                    {showArchived ? t('Hide archived') : t('Archived')}
                  </button>
                )}
                <div
                  role="group"
                  aria-label={t('Filter words by confidence')}
                  className="flex items-center gap-1 text-xs"
                >
                {CONFIDENCE_FILTERS.map((f) => {
                  const active = confidenceFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setConfidenceFilter(f.value)}
                      className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC]'
                          : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                      }`}
                    >
                      {t(f.label)}
                    </button>
                  );
                })}
                </div>
                {availableTags.length > 0 && (
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    aria-label={t('Filter words by tag')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] max-w-[140px] truncate"
                  >
                    <option value="all">{t('All tags')}</option>
                    {availableTags.map((t) => (
                      <option key={t.toLowerCase()} value={t}>
                        #{t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Bulk action bar (visible in selection mode) */}
          {selectionMode && viewCards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-2xl bg-[#F3EFE8]/80 dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25]">
              <span className="text-xs font-semibold text-[#1C1917] dark:text-[#F5F2EC] tabular-nums">
                {selectedCardIds.size} selected
              </span>
              {selectedCardIds.size > 0 && (
                <>
                  <select
                    value={bulkMoveDeckId}
                    onChange={(e) => {
                      const deckId = e.target.value;
                      setBulkMoveDeckId(deckId);
                      if (deckId) void runBulkMove(deckId);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#25221E] border border-slate-200 dark:border-[#2E2A25] text-xs text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                    aria-label={t('Move selected words to deck')}
                  >
                    <option value="">{t('Move to deck…')}</option>
                    {decks
                      .filter((d) => d.id !== selectedDeck?.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                  <div className="flex items-center gap-1">
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => void runBulkDifficulty(opt.value)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#25221E] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309] transition-colors capitalize"
                      >
                        {t(opt.label)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void runBulkDelete()}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('Delete')}
                  </button>
                </>
              )}
              {selectedCardIds.size === 0 && (
                <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                  {t('Tap the checkboxes next to words to select them')}
                </span>
              )}
            </div>
          )}

          {/* Uncluttered Word Pair List */}
          <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl">
            {viewCards.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-4">
                <p className="font-display text-xl font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                  {activeSmartDeck
                    ? t('No words match this smart deck right now')
                    : t('This deck has no words yet')}
                </p>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] max-w-md mx-auto">
                  {activeSmartDeck
                    ? t('The filter matches no cards at the moment — it will populate automatically as cards enter the matching SRS state.')
                    : t('Add words individually or paste a list in "{format}" format.', { format: t('word - translation') })}
                </p>
                {!activeSmartDeck && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => openAddWords('single')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Words')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddWords('bulk')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] transition-colors"
                  >
                    <ListPlus className="w-4 h-4" />
                    {t('Bulk Import')}
                  </button>
                </div>
                )}
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mb-3">
                  {t('No words match your current search or filter.')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setConfidenceFilter('all');
                    setTagFilter('all');
                  }}
                  className="text-sm font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline"
                >
                  {t('Reset filters')}
                </button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-200 dark:divide-[#2E2A25]">
                  {paginatedCards.map((card) => {
                  const cardMenuOpen = openCardMenuId === card.id;
                  return (
                    <li
                      key={card.id}
                      className={`group px-5 py-4 flex items-start gap-3.5 hover:bg-[#FAF8F5]/60 dark:hover:bg-[#221E1A]/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                        selectionMode && selectedCardIds.has(card.id)
                          ? 'bg-[#B45309]/5 dark:bg-[#D97706]/10'
                          : ''
                      } ${card.suspended ? 'opacity-55' : ''}`}
                    >
                      {selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedCardIds.has(card.id)}
                          onChange={() => toggleCardSelection(card.id)}
                          aria-label={t('Select {word}', { word: card.word })}
                          className="mt-1.5 w-4 h-4 shrink-0 rounded border-slate-300 dark:border-[#3A352F] accent-[#B45309] cursor-pointer"
                        />
                      )}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-display text-lg font-medium text-[#1C1917] dark:text-[#F5F2EC] select-text">
                            {card.word}
                          </span>
                          {card.suspended && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] text-[11px] font-semibold">
                              <Archive className="w-3 h-3" />
                              {t('Archived')}
                            </span>
                          )}
                          <SpeakButton
                            text={card.word}
                            langCode={languageCode}
                            muted={ttsMuted}
                            voice={voice}
                            className="-my-1"
                          />
                          <span className="text-[#A8A29E]" aria-hidden="true">
                            —
                          </span>
                          <span className="text-sm sm:text-base text-[#57534E] dark:text-[#C4BEB4] select-text">
                            {card.translation}
                          </span>
                          {(card.tags ?? []).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded-md bg-[#F3EFE8] dark:bg-[#25221E] text-[#78716C] dark:text-[#A8A29E] text-[11px] font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                        {card.exampleSentence && (
                          <p className="text-xs sm:text-sm italic text-[#78716C] dark:text-[#A8A29E]">
                            {card.exampleSentence}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 pt-0.5">
                        {card.linkedNoteId &&
                          notes.some((n) => n.id === card.linkedNoteId) &&
                          onOpenLinkedNote && (
                            <button
                              type="button"
                              onClick={() => onOpenLinkedNote(card.linkedNoteId!)}
                              aria-label={t('Open linked note for {word}', { word: card.word })}
                              title={t('Open linked notebook note')}
                              className="p-1.5 rounded-lg text-[#B45309] dark:text-[#F59E0B] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
                            >
                              <NotebookText className="w-4 h-4" />
                            </button>
                          )}
                        {isLeechCard(card) && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-semibold"
                            title={t('Leech card — repeatedly missed. Prioritize or exclude it in quiz setup.')}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {t('Leech')}
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium capitalize ${confidenceStyle(card.confidence)}`}
                        >
                          {card.confidence}
                        </span>

                        <div className="relative">
                          <button
                            type="button"
                            aria-label={t('Actions for {word}', { word: card.word })}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDeckMenuId(null);
                              setHeaderMenuOpen(false);
                              setOpenCardMenuId(cardMenuOpen ? null : card.id);
                            }}
                            className="p-1.5 rounded-lg text-[#A8A29E] opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-all"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          <AnimatePresence>
                          {cardMenuOpen && (
                            <motion.div
                              key="card-menu"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 mt-1 w-32 z-20 bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-xl shadow-lg py-1 text-xs"
                              initial={{ opacity: 0, scale: 0.92, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              style={{ transformOrigin: 'top right' }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCardMenuId(null);
                                  openEditCard(card);
                                }}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#78716C]" />
                                {t('Edit')}
                              </button>
                              {onSendCardToNote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenCardMenuId(null);
                                    onSendCardToNote(card);
                                  }}
                                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                                >
                                  <NotebookPen className="w-3.5 h-3.5 text-[#78716C]" />
                                  {card.linkedNoteId ? t('Open note') : t('Send to notebook')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenCardMenuId(null);
                                  try {
                                    await onToggleCardSuspended(card.id, !card.suspended);
                                    onNotify(
                                      card.suspended
                                        ? `"${card.word}" restored to study.`
                                        : `"${card.word}" archived — hidden from quizzes and reviews.`,
                                      'success'
                                    );
                                  } catch {
                                    onNotify(t('Could not update the card. Please try again.'), 'error');
                                  }
                                }}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-[#1C1917] dark:text-[#F5F2EC] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E]"
                              >
                                {card.suspended ? (
                                  <>
                                    <ArchiveRestore className="w-3.5 h-3.5 text-[#78716C]" />
                                    {t('Restore')}
                                  </>
                                ) : (
                                  <>
                                    <Archive className="w-3.5 h-3.5 text-[#78716C]" />
                                    {t('Archive')}
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenCardMenuId(null);
                                  try {
                                    await onDeleteCard(card.id);
                                  } catch {
                                    onNotify(t('Could not delete the word. Please try again.'), 'error');
                                  }
                                }}
                                className="w-full text-left px-3 py-2 flex items-center gap-2 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('Delete')}
                              </button>
                            </motion.div>
                          )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-[#2E2A25]">
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredCards.length)} of {filteredCards.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      {t('Previous')}
                    </button>
                    <span className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      {t('Next')}
                    </button>
                  </div>
                </div>
              )}
            </>
            )}
          </div>
        </section>
      )}

      {/* Modals */}
      <Modal
        open={modalState.type !== 'none'}
        onClose={() => setModal({ type: 'none' })}
        panelClassName="max-w-lg p-6 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]"
      >
            {(modal.type === 'create-deck' || modal.type === 'edit-deck') && (
              <form onSubmit={handleDeckSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {modal.type === 'create-deck' ? `New ${languageName} Deck` : t('Edit Deck')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    {t('Deck Name')}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={deckName}
                    onChange={(e) => setDeckName(e.target.value)}
                    placeholder={t('e.g., {name} Travel Essentials', { name: languageName })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    placeholder={t('Short note on what this vocabulary deck covers')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
                  >
                    {modal.type === 'create-deck' ? t('Create Deck') : t('Save Changes')}
                  </button>
                </div>
              </form>
            )}

            {modal.type === 'delete-deck' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {t('Delete Deck')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  {t('Are you sure you want to delete "{name}"? This removes all {count} {words} in this deck from your browser storage.', {
                    name: modal.deck.name,
                    count: cards.filter((c) => c.deckId === modal.deck.id).length,
                    words: pluralize(cards.filter((c) => c.deckId === modal.deck.id).length, 'word', 'words'),
                  })}
                </p>
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onDeleteDeck(modal.deck.id);
                        setModal({ type: 'none' });
                      } catch {
                        onNotify(t('Could not delete the deck. Please try again.'), 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium transition-colors"
                  >
                    {t('Delete Deck')}
                  </button>
                </div>
              </div>
            )}

            {modal.type === 'add-words' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {t('Add Words')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Single vs Bulk Tab Switch */}
                <div className="flex items-center gap-1 p-1 bg-[#F3EFE8] dark:bg-[#121110] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'add-words', tab: 'single' })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      modal.tab === 'single'
                        ? 'bg-white dark:bg-[#2A2621] text-[#1C1917] dark:text-[#F5F2EC] shadow-xs'
                        : 'text-[#57534E] dark:text-[#A8A29E]'
                    }`}
                  >
                    {t('Single Word')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'add-words', tab: 'bulk' })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      modal.tab === 'bulk'
                        ? 'bg-white dark:bg-[#2A2621] text-[#1C1917] dark:text-[#F5F2EC] shadow-xs'
                        : 'text-[#57534E] dark:text-[#A8A29E]'
                    }`}
                  >
                    {t('Bulk Import')}
                  </button>
                </div>

                {!selectedDeck && (
                  <div>
                    <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                      {t('New Deck Name')}
                    </label>
                    <input
                      type="text"
                      value={targetDeckNameForNew}
                      onChange={(e) => setTargetDeckNameForNew(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                    />
                  </div>
                )}

                {modal.tab === 'single' ? (
                  <form onSubmit={handleSingleCardSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                        {languageName} (Target)
                      </label>
                      <input
                        ref={wordInputRef}
                        type="text"
                        required
                        autoFocus
                        value={cardWord}
                        onChange={(e) => setCardWord(e.target.value)}
                        placeholder={t('e.g., a {name} word', { name: languageName })}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                      />
                      <DiacriticBar
                        langCode={languageCode}
                        onInsert={handleInsertDiacritic}
                      />
                      {duplicateMatch && (
                        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {t('"{word}" already exists in this deck — you can still add it if the meaning differs.', { word: duplicateMatch.word })}
                          </span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                        Translation (Meaning)
                      </label>
                      <input
                        type="text"
                        required
                        value={cardTranslation}
                        onChange={(e) => setCardTranslation(e.target.value)}
                        placeholder={t('e.g., its meaning in your language')}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                        Example Sentence (optional)
                      </label>
                      <input
                        type="text"
                        value={cardExample}
                        onChange={(e) => setCardExample(e.target.value)}
                        placeholder={t('e.g., Labas rytas!')}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                        Memory Tip (optional)
                      </label>
                      <input
                        type="text"
                        value={cardMnemonic}
                        onChange={(e) => setCardMnemonic(e.target.value)}
                        placeholder={t('e.g., Sounds like \'labas\' — imagine a lab assistant')}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                      />
                    </div>

                    <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Tags (optional)
                  </label>
                  <input
                    type="text"
                    value={cardTagsInput}
                    onChange={(e) => setCardTagsInput(e.target.value)}
                    placeholder={t('e.g., verbs, food, travel')}
                    list="card-tags-suggestions"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                  <datalist id="card-tags-suggestions">
                    {availableTags.map((t) => (
                      <option key={t.toLowerCase()} value={t} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                    {t('Comma-separated — used for filtering and smart decks.')}
                  </p>
                </div>

                {renderDifficultyPicker(cardDifficulty, setCardDifficulty)}

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'none' })}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
                      >
                        {t('Add Word')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleBulkSubmit} className="space-y-4">
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                      {t('Paste one entry per line as "{format}". Tabs, semicolons, commas and "{csv}" CSV rows also work — or load a .csv/.txt file below. Add an example sentence after "|".', {
                        format: `${languageName} word - meaning`,
                        csv: 'word,translation,example',
                      })}
                    </p>

                    <button
                      type="button"
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309] transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import .csv / .txt file
                    </button>
                    <input
                      ref={bulkFileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv,text/csv,text/plain"
                      className="hidden"
                      onChange={handleBulkFileImport}
                    />

                    <textarea
                      ref={bulkTextRef}
                      rows={7}
                      autoFocus
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`labas - salam | Labas rytas!\načiū - təşəkkür edirəm | Labai ačiū!\nvanduo - su`}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm font-mono text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                    />

                    <DiacriticBar
                      langCode={languageCode}
                      onInsert={handleInsertBulkDiacritic}
                    />

                    {renderDifficultyPicker(bulkDifficulty, setBulkDifficulty)}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        {t('{count} valid {entries}', { count: bulkParsed.items.length, entries: pluralize(bulkParsed.items.length, 'entry', 'entries') })}
                      </span>
                      {bulkParsed.skippedLines.length > 0 && (
                        <span className="text-amber-700 dark:text-amber-400">
                          Skipped lines: {bulkParsed.skippedLines.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'none' })}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={bulkParsed.items.length === 0}
                        className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Import {bulkParsed.items.length} Words
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {modal.type === 'edit-card' && (
              <form onSubmit={handleSingleCardSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {t('Edit Vocabulary Word')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    {languageName} (Target)
                  </label>
                  <input
                    ref={wordInputRef}
                    type="text"
                    required
                    autoFocus
                    value={cardWord}
                    onChange={(e) => setCardWord(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                  <DiacriticBar
                    langCode={languageCode}
                    onInsert={handleInsertDiacritic}
                  />
                  {duplicateMatch && (
                    <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t('"{word}" already exists in this deck — you can still save if the meaning differs.', { word: duplicateMatch.word })}
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Translation (Meaning)
                  </label>
                  <input
                    type="text"
                    required
                    value={cardTranslation}
                    onChange={(e) => setCardTranslation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Example Sentence (optional)
                  </label>
                  <input
                    type="text"
                    value={cardExample}
                    onChange={(e) => setCardExample(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Memory Tip (optional)
                  </label>
                  <input
                    type="text"
                    value={cardMnemonic}
                    onChange={(e) => setCardMnemonic(e.target.value)}
                    placeholder={t('e.g., Sounds like \'labas\' — imagine a lab assistant')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Tags (optional)
                  </label>
                  <input
                    type="text"
                    value={cardTagsInput}
                    onChange={(e) => setCardTagsInput(e.target.value)}
                    placeholder={t('e.g., verbs, food, travel')}
                    list="card-tags-suggestions"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                  <datalist id="card-tags-suggestions">
                    {availableTags.map((t) => (
                      <option key={t.toLowerCase()} value={t} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                    {t('Comma-separated — used for filtering and smart decks.')}
                  </p>
                </div>

                {renderDifficultyPicker(cardDifficulty, setCardDifficulty)}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
                  >
                    {t('Save Word')}
                  </button>
                </div>
              </form>
            )}

            {modal.type === 'json-import' && (
              <form onSubmit={handleJsonSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {t('Import Deck from JSON')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                    {t('Choose a .json file or paste exported JSON below.')}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleJsonFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] shrink-0"
                  >
                    {t('Choose File')}
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setJsonError(null);
                  }}
                  placeholder={`{\n  "name": "Lithuanian Food",\n  "cards": [\n    { "word": "obuolys", "translation": "alma", "exampleSentence": "Raudonas obuolys." }\n  ]\n}`}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-xs font-mono text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                />

                {jsonError && (
                  <p className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {jsonError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!jsonText.trim()}
                    className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {t('Import Deck')}
                  </button>
                </div>
              </form>
            )}

            {modal.type === 'create-smart-deck' && (
              <form onSubmit={handleSmartDeckSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                      {t('New Smart Deck')}
                    </h2>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
                      {t('A live view over your cards — membership updates as you study.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    {t('Name')}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={smartDeckName}
                    onChange={(e) => setSmartDeckName(e.target.value)}
                    placeholder={t('e.g., Words to Review, Leech Squad')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={smartDeckDesc}
                    onChange={(e) => setSmartDeckDesc(e.target.value)}
                    placeholder={t('What is this set for?')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
                    {t('Include cards matching any of these')}
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SMART_FILTER_OPTIONS.map((opt) => {
                      const checked = Boolean(smartDeckFilter[opt.key]);
                      return (
                        <label
                          key={opt.key}
                          className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                            checked
                              ? 'border-[#B45309] dark:border-[#D97706] bg-[#FAF8F5] dark:bg-[#25221E]'
                              : 'border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] hover:border-slate-300 dark:hover:border-[#443E37]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSmartDeckFilter((prev) => ({
                                ...prev,
                                [opt.key]: e.target.checked || undefined,
                              }))
                            }
                            className="mt-0.5 w-4 h-4 accent-[#B45309] rounded shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                              {t(opt.label)}
                            </span>
                            <span className="block text-xs text-[#78716C] dark:text-[#A8A29E]">
                              {t(opt.hint)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                    Currently matches{' '}
                    <strong className="text-[#B45309] dark:text-[#F59E0B]">
                      {smartPreviewCount}
                    </strong>{' '}
                    {pluralize(smartPreviewCount, 'word', 'words')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Tag filter (optional)
                  </label>
                  <input
                    type="text"
                    value={smartDeckFilter.tag ?? ''}
                    onChange={(e) =>
                      setSmartDeckFilter((prev) => ({
                        ...prev,
                        tag: e.target.value || undefined,
                      }))
                    }
                    placeholder={t('e.g., verbs — matches cards with this tag')}
                    list="smart-deck-tag-suggestions"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                  <datalist id="smart-deck-tag-suggestions">
                    {availableTags.map((t) => (
                      <option key={t.toLowerCase()} value={t} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!smartDeckName.trim() || smartPreviewCount === 0}
                    className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {t('Create Smart Deck')}
                  </button>
                </div>
              </form>
            )}

            {modal.type === 'delete-smart-deck' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                  <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {t('Delete Smart Deck')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="p-1.5 rounded-md text-[#78716C]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  {t('Delete "{name}"? This only removes the saved filter — your words and study progress are not affected.', { name: modal.smartDeck.name })}
                </p>
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'none' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onDeleteSmartDeck(modal.smartDeck.id);
                        if (selectedSmartDeckId === modal.smartDeck.id) {
                          setSelectedSmartDeckId(null);
                        }
                        setModal({ type: 'none' });
                      } catch {
                        onNotify(t('Could not delete the smart deck. Please try again.'), 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium transition-colors"
                  >
                    {t('Delete Smart Deck')}
                  </button>
                </div>
              </div>
            )}
      </Modal>
    </div>
  );
}
