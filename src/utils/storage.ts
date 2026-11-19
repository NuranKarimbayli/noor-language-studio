import {
  ActivityDay,
  ConfidenceLevel,
  Deck,
  DifficultyLevel,
  LanguageItem,
  StudyStats,
  VocabCard,
} from '../types';

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function applyStudyActivity(
  current: StudyStats,
  quizIncrement?: { isCorrect: boolean }
): StudyStats {
  const today = getLocalDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  let nextStreak = current.streakDays;
  if (current.lastStudyDate === today) {
    nextStreak = Math.max(1, current.streakDays);
  } else if (current.lastStudyDate === yesterday) {
    nextStreak = current.streakDays + 1;
  } else {
    nextStreak = 1;
  }

  return {
    streakDays: nextStreak,
    lastStudyDate: today,
    totalQuizAnswered: current.totalQuizAnswered + (quizIncrement ? 1 : 0),
    totalQuizCorrect:
      current.totalQuizCorrect + (quizIncrement?.isCorrect ? 1 : 0),
    bestQuizStreak: current.bestQuizStreak ?? 0,
  };
}

export function getCardDifficulty(card: Pick<VocabCard, 'difficulty'>): DifficultyLevel {
  return card.difficulty ?? 'medium';
}

/**
 * Case- and diacritic-insensitive key for duplicate word detection.
 * "Crème", "creme" and " CREME " all normalize to the same key.
 */
export function normalizeWordKey(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Find an existing card in `pool` whose word matches `word` (normalized). */
export function findDuplicateCard(
  pool: VocabCard[],
  word: string,
  excludeCardId?: string
): VocabCard | undefined {
  const key = normalizeWordKey(word);
  if (!key) return undefined;
  return pool.find(
    (c) => c.id !== excludeCardId && normalizeWordKey(c.word) === key
  );
}

export function matchesDifficultyFilter(
  card: Pick<VocabCard, 'difficulty'>,
  filter?: DifficultyLevel[]
): boolean {
  return !filter || filter.length === 0 || filter.includes(getCardDifficulty(card));
}

export interface ExportDeckPayload {
  version: number;
  exportedAt: string;
  deck: {
    name: string;
    description: string;
    cards: Array<{
      word: string;
      translation: string;
      exampleSentence?: string;
      confidence?: ConfidenceLevel;
      difficulty?: DifficultyLevel;
      mnemonic?: string;
    }>;
  };
}

export function exportDeckAsJson(deck: Deck, deckCards: VocabCard[]): void {
  const payload: ExportDeckPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    deck: {
      name: deck.name,
      description: deck.description,
      cards: deckCards.map((c) => ({
        word: c.word,
        translation: c.translation,
        ...(c.exampleSentence ? { exampleSentence: c.exampleSentence } : {}),
        confidence: c.confidence,
        difficulty: getCardDifficulty(c),
        ...(c.mnemonic ? { mnemonic: c.mnemonic } : {}),
      })),
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const slug =
    deck.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vocabulary-deck';
  anchor.href = url;
  anchor.download = `${slug}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportDeckAsCsv(deck: Deck, deckCards: VocabCard[]): void {
  // Always quote fields so the file round-trips through parseBulkLines even
  // when words/translations contain commas.
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = 'word,translation,example';
  const rows = deckCards.map((c) =>
    [c.word, c.translation, c.exampleSentence ?? ''].map(q).join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const slug =
    deck.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vocabulary-deck';
  anchor.href = url;
  anchor.download = `${slug}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const VALID_CONFIDENCE = new Set<ConfidenceLevel>(['new', 'hard', 'good', 'easy']);
const VALID_DIFFICULTY = new Set<DifficultyLevel>(['easy', 'medium', 'hard']);

export function parseImportedDeckJson(rawText: string): {
  deckName: string;
  description: string;
  cards: Array<{
    word: string;
    translation: string;
    exampleSentence?: string;
    confidence: ConfidenceLevel;
    difficulty?: DifficultyLevel;
    mnemonic?: string;
  }>;
} {
  const parsed = JSON.parse(rawText);
  const source = parsed && typeof parsed === 'object' && parsed.deck ? parsed.deck : parsed;

  if (!source || typeof source !== 'object') {
    throw new Error('JSON must contain a deck object or cards array.');
  }

  const rawCards = Array.isArray(source) ? source : source.cards;
  if (!Array.isArray(rawCards)) {
    throw new Error('JSON must include a "cards" array.');
  }

  const validCards: Array<{
    word: string;
    translation: string;
    exampleSentence?: string;
    confidence: ConfidenceLevel;
    difficulty?: DifficultyLevel;
    mnemonic?: string;
  }> = [];

  for (const item of rawCards) {
    if (!item || typeof item !== 'object') continue;
    const word = typeof item.word === 'string' ? item.word.trim() : '';
    const translation = typeof item.translation === 'string' ? item.translation.trim() : '';
    if (!word || !translation) continue;
    const exampleSentence =
      typeof item.exampleSentence === 'string' && item.exampleSentence.trim()
        ? item.exampleSentence.trim()
        : undefined;
    const confidence: ConfidenceLevel = VALID_CONFIDENCE.has(item.confidence)
      ? item.confidence
      : 'new';
    const difficulty: DifficultyLevel | undefined = VALID_DIFFICULTY.has(item.difficulty)
      ? item.difficulty
      : undefined;
    const mnemonic =
      typeof item.mnemonic === 'string' && item.mnemonic.trim()
        ? item.mnemonic.trim()
        : undefined;
    validCards.push({ word, translation, exampleSentence, confidence, difficulty, mnemonic });
  }

  if (validCards.length === 0) {
    throw new Error('No valid vocabulary entries with both "word" and "translation" were found.');
  }

  return {
    deckName:
      typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Imported Deck',
    description:
      typeof source.description === 'string' ? source.description.trim() : 'Imported from JSON',
    cards: validCards,
  };
}

// ---------------------------------------------------------------------------
// Full workspace backup / restore
// ---------------------------------------------------------------------------

export interface FullBackupPayload {
  version: 1;
  exportedAt: string;
  languages: LanguageItem[];
  decks: Deck[];
  cards: VocabCard[];
  stats?: StudyStats;
  activity?: ActivityDay[];
}

export function buildBackupPayload(input: {
  languages: LanguageItem[];
  decks: Deck[];
  cards: VocabCard[];
  stats?: StudyStats;
  activity?: ActivityDay[];
}): FullBackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    languages: input.languages,
    decks: input.decks,
    cards: input.cards,
    stats: input.stats,
    activity: input.activity,
  };
}

export function exportFullBackupJson(payload: FullBackupPayload): void {
  const dateSlug = getLocalDateString();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `noor-backup-${dateSlug}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function isValidLanguage(item: unknown): item is LanguageItem {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as LanguageItem).id === 'string' &&
    typeof (item as LanguageItem).name === 'string' &&
    typeof (item as LanguageItem).code === 'string'
  );
}

function isValidDeck(item: unknown): item is Deck {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as Deck).id === 'string' &&
    typeof (item as Deck).languageId === 'string'
  );
}

function isValidCard(item: unknown): item is VocabCard {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as VocabCard).id === 'string' &&
    typeof (item as VocabCard).deckId === 'string' &&
    typeof (item as VocabCard).word === 'string' &&
    typeof (item as VocabCard).translation === 'string'
  );
}

/**
 * Parse and validate a backup file. Tolerant of older/malformed payloads:
 * invalid records are dropped rather than failing the whole import, and
 * missing sections simply yield empty arrays.
 */
export function parseBackupJson(rawText: string): FullBackupPayload {
  const parsed = JSON.parse(rawText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is not a valid JSON object.');
  }

  // Accept both the versioned envelope and a bare {languages, decks, cards}
  const source = parsed;

  const languages = Array.isArray(source.languages)
    ? (source.languages as unknown[]).filter(isValidLanguage)
    : [];
  const decks = Array.isArray(source.decks)
    ? (source.decks as unknown[]).filter(isValidDeck)
    : [];
  const cards = Array.isArray(source.cards)
    ? (source.cards as unknown[]).filter(isValidCard)
        .map((c) => ({
          ...c,
          confidence: VALID_CONFIDENCE.has(c.confidence) ? c.confidence : 'new',
          reviewCount: typeof c.reviewCount === 'number' ? c.reviewCount : 0,
          createdAt:
            typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
        }))
    : [];

  const stats =
    source.stats && typeof source.stats === 'object' ? (source.stats as StudyStats) : undefined;
  const activity = Array.isArray(source.activity)
    ? (source.activity as unknown[]).filter(
        (d): d is ActivityDay =>
          !!d &&
          typeof d === 'object' &&
          typeof (d as ActivityDay).date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test((d as ActivityDay).date)
      )
    : undefined;

  if (languages.length === 0 && decks.length === 0 && cards.length === 0) {
    throw new Error('No valid languages, decks, or cards found in this backup.');
  }

  return {
    version: 1,
    exportedAt: typeof source.exportedAt === 'string' ? source.exportedAt : '',
    languages,
    decks,
    cards,
    stats,
    activity,
  };
}
