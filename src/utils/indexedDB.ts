import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  ActivityDay,
  AppPrefs,
  ConfidenceLevel,
  Deck,
  LanguageItem,
  Note,
  SessionRecord,
  SmartDeck,
  StudyStats,
  ThemeMode,
  VocabCard,
} from '../types';
import { PRESET_LANGUAGES, SEED_CARDS, SEED_DECKS } from '../data/seedDecks';

interface NoorStudioDB extends DBSchema {
  languages: {
    key: string;
    value: LanguageItem;
  };
  decks: {
    key: string;
    value: Deck;
    indexes: { 'by-languageId': string };
  };
  cards: {
    key: string;
    value: VocabCard;
    indexes: { 'by-deckId': string };
  };
  stats: {
    key: string;
    value: StudyStats;
  };
  theme: {
    key: string;
    value: ThemeMode;
  };
  sfxMuted: {
    key: string;
    value: boolean;
  };
  ttsMuted: {
    key: string;
    value: boolean;
  };
  activity: {
    key: string;
    value: ActivityDay;
  };
  sessions: {
    key: string;
    value: SessionRecord;
  };
  smartDecks: {
    key: string;
    value: SmartDeck;
    indexes: { 'by-languageId': string };
  };
  meta: {
    key: string;
    value: unknown;
  };
  notes: {
    key: string;
    value: Note;
  };
}

const DB_NAME = 'noor-studio-db';
const DB_VERSION = 7;
const SEED_COMPLETED_KEY = 'seed-completed';

let dbPromise: Promise<IDBPDatabase<NoorStudioDB>> | null = null;

function getDB(): Promise<IDBPDatabase<NoorStudioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NoorStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Entity stores use an 'id' keyPath so put(value) can infer the key.
        // v1 stores were created without a keyPath, which made every entity
        // write fail — they are guaranteed empty, so recreate them safely.
        const ensureEntityStore = (
          name: 'languages' | 'decks' | 'cards',
          indexField?: 'languageId' | 'deckId'
        ) => {
          if (db.objectStoreNames.contains(name)) {
            // v1 stores lack a keyPath (all writes failed → empty); v2+ are fine
            if (oldVersion >= 2) return;
            db.deleteObjectStore(name);
          }
          const store = db.createObjectStore(name, { keyPath: 'id' }) as unknown as {
            createIndex: (indexName: string, keyPath: string) => unknown;
          };
          if (indexField) {
            store.createIndex(`by-${indexField}`, indexField);
          }
        };

        ensureEntityStore('languages');
        ensureEntityStore('decks', 'languageId');
        ensureEntityStore('cards', 'deckId');

        // Scalar stores are keyed explicitly ('main') and need no keyPath.
        // 'activity' is keyed by its 'date' field (YYYY-MM-DD).
        for (const name of ['stats', 'theme', 'sfxMuted', 'ttsMuted', 'meta'] as const) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
        if (!db.objectStoreNames.contains('activity')) {
          db.createObjectStore('activity', { keyPath: 'date' });
        }
        // v5: completed-session history for accuracy trends
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        // v6: saved dynamic (smart) decks
        if (!db.objectStoreNames.contains('smartDecks')) {
          const store = db.createObjectStore('smartDecks', {
            keyPath: 'id',
          }) as unknown as {
            createIndex: (indexName: string, keyPath: string) => unknown;
          };
          store.createIndex('by-languageId', 'languageId');
        }
        // v7: study notepad notes
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
      },
    }).catch((error) => {
      // Do not cache a rejected promise — let the next call retry the connection
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

// LocalStorage keys used by the previous storage layer. Presence of any key
// indicates that a migration is required; users are not required to have the
// legacy "initialized" marker.
const LS_KEYS = {
  DECKS: 'kalba_studio_decks_v1',
  CARDS: 'kalba_studio_cards_v1',
  LANGUAGES: 'kalba_studio_languages_v1',
  STATS: 'noor_studio_stats_v1',
  THEME: 'kalba_studio_theme',
  SFX_MUTED: 'noor_studio_sfx_muted_v1',
  INITIALIZED: 'kalba_studio_initialized_v1',
} as const;

const MIGRATION_BATCH_SIZE = 500;

async function putInBatches<T>(items: T[], put: (item: T) => Promise<unknown>): Promise<void> {
  for (let index = 0; index < items.length; index += MIGRATION_BATCH_SIZE) {
    await Promise.all(items.slice(index, index + MIGRATION_BATCH_SIZE).map((item) => put(item)));
  }
}

async function migrateArray<T extends { id: string }>(
  storeName: 'languages' | 'decks' | 'cards',
  rawValue: string | null,
  normalize?: (item: Partial<T> & { id: string }) => T
): Promise<boolean> {
  if (!rawValue) return false;
  const parsed = JSON.parse(rawValue);
  if (!Array.isArray(parsed)) return false;

  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.store as unknown as { put: (item: T) => Promise<unknown> };
  const items = normalize
    ? parsed.map((item) => normalize(item as Partial<T> & { id: string }))
    : (parsed as T[]);
  await putInBatches(items, (item) => store.put(item));
  await tx.done;
  return true;
}

function normalizeLegacyCard(card: Partial<VocabCard> & { id: string }): VocabCard {
  return {
    id: card.id,
    deckId: card.deckId ?? '',
    word: card.word ?? '',
    translation: card.translation ?? '',
    exampleSentence: card.exampleSentence,
    confidence: card.confidence ?? 'new',
    reviewCount: card.reviewCount ?? 0,
    lastReviewedAt: card.lastReviewedAt,
    createdAt: card.createdAt ?? new Date().toISOString(),
    srsBox: card.srsBox ?? 1,
    nextReviewAt: card.nextReviewAt,
    streak: card.streak ?? 0,
    lapses: card.lapses ?? 0,
    difficulty: card.difficulty,
    mnemonic: card.mnemonic,
    wrongCount: card.wrongCount,
  };
}

/**
 * Run a single key's migration in isolation. A corrupt or failing key logs an
 * error and reports `false` so its localStorage entry is retained for a future
 * retry, without blocking the other keys.
 */
async function attemptMigration(
  label: string,
  migrate: () => Promise<boolean>
): Promise<boolean> {
  try {
    return await migrate();
  } catch (error) {
    console.error(`[IndexedDB] Migration failed for "${label}":`, error);
    return false;
  }
}

async function migrateScalar(
  storeName: 'stats' | 'theme' | 'sfxMuted',
  rawValue: string | null,
  key: string,
  parse: (raw: string) => StudyStats | ThemeMode | boolean | null
): Promise<boolean> {
  if (!rawValue) return false;
  const value = parse(rawValue);
  if (value === null || value === undefined) return false;
  const db = await getDB();
  await db.put(storeName, value, key);
  return true;
}

/**
 * Migrate every supported localStorage key, then clear only the keys that
 * were successfully written. A failed write therefore remains available for
 * the next launch instead of being silently discarded.
 */
async function migrateFromLocalStorage(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  const [
    migratedLanguages,
    migratedDecks,
    migratedCards,
    migratedStats,
    migratedTheme,
    migratedSfxMuted,
  ] = await Promise.all([
    attemptMigration('languages', () =>
      migrateArray<LanguageItem>('languages', localStorage.getItem(LS_KEYS.LANGUAGES))
    ),
    attemptMigration('decks', () =>
      migrateArray<Deck>('decks', localStorage.getItem(LS_KEYS.DECKS))
    ),
    attemptMigration('cards', () =>
      migrateArray<VocabCard>('cards', localStorage.getItem(LS_KEYS.CARDS), normalizeLegacyCard)
    ),
    attemptMigration('stats', () =>
      migrateScalar('stats', localStorage.getItem(LS_KEYS.STATS), 'main', (raw) => {
        const stats = JSON.parse(raw);
        return stats && typeof stats === 'object' ? stats : null;
      })
    ),
    attemptMigration('theme', () =>
      migrateScalar('theme', localStorage.getItem(LS_KEYS.THEME), 'main', (raw) =>
        raw === 'dark' || raw === 'light' ? raw : null
      )
    ),
    attemptMigration('sfxMuted', () =>
      migrateScalar('sfxMuted', localStorage.getItem(LS_KEYS.SFX_MUTED), 'main', (raw) =>
        raw === '1' ? true : raw === '0' ? false : null
      )
    ),
  ]);

  if (migratedLanguages) localStorage.removeItem(LS_KEYS.LANGUAGES);
  if (migratedDecks) localStorage.removeItem(LS_KEYS.DECKS);
  if (migratedCards) localStorage.removeItem(LS_KEYS.CARDS);
  if (migratedStats) localStorage.removeItem(LS_KEYS.STATS);
  if (migratedTheme) localStorage.removeItem(LS_KEYS.THEME);
  if (migratedSfxMuted) localStorage.removeItem(LS_KEYS.SFX_MUTED);
  localStorage.removeItem(LS_KEYS.INITIALIZED);
}

/**
 * Seed only stores that are genuinely empty. A user can intentionally delete
 * every deck or card, and initialization must not recreate them on the next
 * launch.
 */
async function initializeWithSeedData(): Promise<void> {
  const db = await getDB();

  // Seeding runs exactly once. Without this marker, a user who intentionally
  // deletes every deck or card would see the seed data recreated on launch.
  if (await db.get('meta', SEED_COMPLETED_KEY)) return;

  let hasLanguages = (await db.getAll('languages')).length > 0;
  if (!hasLanguages) {
    const tx = db.transaction('languages', 'readwrite');
    await putInBatches(PRESET_LANGUAGES, (language) => tx.store.put(language));
    await tx.done;
    hasLanguages = true;
  }

  let hasDecks = (await db.getAll('decks')).length > 0;
  if (!hasDecks && hasLanguages) {
    const tx = db.transaction('decks', 'readwrite');
    await putInBatches(SEED_DECKS, (deck) => tx.store.put(deck));
    await tx.done;
    hasDecks = true;
  }

  const hasCards = (await db.getAll('cards')).length > 0;
  if (!hasCards && hasDecks) {
    const tx = db.transaction('cards', 'readwrite');
    await putInBatches(SEED_CARDS, (card) => tx.store.put(card));
    await tx.done;
  }

  await db.put('meta', true, SEED_COMPLETED_KEY);
}

/**
 * Initialize the database (migration + seed data)
 */
export async function initializeDatabase(): Promise<void> {
  await migrateFromLocalStorage();
  await initializeWithSeedData();
}

// Language operations
export async function getAllLanguages(): Promise<LanguageItem[]> {
  const db = await getDB();
  return db.getAll('languages');
}

export async function addLanguage(language: LanguageItem): Promise<void> {
  const db = await getDB();
  await db.put('languages', language);
}

export async function deleteLanguage(languageId: string): Promise<void> {
  const db = await getDB();
  await db.delete('languages', languageId);
}

export async function updateLanguage(
  languageId: string,
  updates: Partial<LanguageItem>
): Promise<void> {
  const db = await getDB();
  const language = await db.get('languages', languageId);
  if (language) {
    await db.put('languages', { ...language, ...updates });
  }
}

// Deck operations
export async function getAllDecks(): Promise<Deck[]> {
  const db = await getDB();
  return db.getAll('decks');
}

export async function addDeck(deck: Deck): Promise<void> {
  const db = await getDB();
  await db.put('decks', deck);
}

export async function updateDeck(deckId: string, updates: Partial<Deck>): Promise<void> {
  const db = await getDB();
  const deck = await db.get('decks', deckId);
  if (deck) {
    await db.put('decks', { ...deck, ...updates });
  }
}

export async function deleteDeck(deckId: string): Promise<void> {
  const db = await getDB();
  await db.delete('decks', deckId);
}

export async function deleteDecksByLanguage(languageId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('decks', 'readwrite');
  // Index reads must happen inside the transaction — awaiting outside it can
  // let the transaction auto-commit before the deletes are issued.
  const keys = await tx.store.index('by-languageId').getAllKeys(languageId);
  await putInBatches(keys as string[], (key) => tx.store.delete(key));
  await tx.done;
}

// Card operations
export async function getAllCards(): Promise<VocabCard[]> {
  const db = await getDB();
  return db.getAll('cards');
}

export async function addCard(card: VocabCard): Promise<void> {
  const db = await getDB();
  await db.put('cards', card);
}

export async function putCards(cards: VocabCard[]): Promise<void> {
  if (cards.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('cards', 'readwrite');
  await putInBatches(cards, (card) => tx.store.put(card));
  await tx.done;
}

export async function updateCard(cardId: string, updates: Partial<VocabCard>): Promise<void> {
  const db = await getDB();
  const card = await db.get('cards', cardId);
  if (card) {
    await db.put('cards', { ...card, ...updates });
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  const db = await getDB();
  await db.delete('cards', cardId);
}

export async function deleteCardsByDeck(deckId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cards', 'readwrite');
  const keys = await tx.store.index('by-deckId').getAllKeys(deckId);
  await putInBatches(keys as string[], (key) => tx.store.delete(key));
  await tx.done;
}

export async function deleteCardsByDecks(deckIds: string[]): Promise<void> {
  await Promise.all(deckIds.map((deckId) => deleteCardsByDeck(deckId)));
}

export async function deleteCardsByIds(cardIds: string[]): Promise<void> {
  await Promise.all(cardIds.map((id) => deleteCard(id)));
}

// Stats operations
export async function getStats(): Promise<StudyStats> {
  const db = await getDB();
  const stored = await db.get('stats', 'main');
  const stats: StudyStats = {
    streakDays: typeof stored?.streakDays === 'number' ? stored.streakDays : 0,
    lastStudyDate: typeof stored?.lastStudyDate === 'string' ? stored.lastStudyDate : null,
    totalQuizAnswered:
      typeof stored?.totalQuizAnswered === 'number' ? stored.totalQuizAnswered : 0,
    totalQuizCorrect:
      typeof stored?.totalQuizCorrect === 'number' ? stored.totalQuizCorrect : 0,
    bestQuizStreak:
      typeof stored?.bestQuizStreak === 'number' ? stored.bestQuizStreak : 0,
    dailyGoal:
      typeof stored?.dailyGoal === 'number' && stored.dailyGoal > 0
        ? stored.dailyGoal
        : 20,
  };

  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(today.getDate() - 1);
  const localYesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
  const streakIsCurrent =
    stats.lastStudyDate === localToday || stats.lastStudyDate === localYesterday;

  return {
    ...stats,
    streakDays: streakIsCurrent ? stats.streakDays : 0,
  };
}

export async function saveStats(stats: StudyStats): Promise<void> {
  const db = await getDB();
  await db.put('stats', stats, 'main');
}

// Theme operations
export async function getTheme(): Promise<ThemeMode> {
  const db = await getDB();
  const theme = await db.get('theme', 'main');
  return theme || 'light';
}

export async function saveTheme(theme: ThemeMode): Promise<void> {
  const db = await getDB();
  await db.put('theme', theme, 'main');
}

// SFX muted operations
export async function getSfxMuted(): Promise<boolean> {
  const db = await getDB();
  const muted = await db.get('sfxMuted', 'main');
  return muted || false;
}

export async function saveSfxMuted(muted: boolean): Promise<void> {
  const db = await getDB();
  await db.put('sfxMuted', muted, 'main');
}

// TTS muted operations
export async function getTtsMuted(): Promise<boolean> {
  const db = await getDB();
  const muted = await db.get('ttsMuted', 'main');
  return muted || false;
}

export async function saveTtsMuted(muted: boolean): Promise<void> {
  const db = await getDB();
  await db.put('ttsMuted', muted, 'main');
}

// App preference operations (stored as one JSON record in the meta store)
const APP_PREFS_KEY = 'appPrefs';

export async function getAppPrefs(): Promise<AppPrefs> {
  const db = await getDB();
  const stored = (await db.get('meta', APP_PREFS_KEY)) as Partial<AppPrefs> | undefined;
  const timer = stored?.defaultTimerSeconds;
  return {
    showToasts: typeof stored?.showToasts === 'boolean' ? stored.showToasts : true,
    autoAdvance: stored?.autoAdvance === true,
    defaultTimerSeconds:
      typeof timer === 'number' && Number.isFinite(timer) && timer >= 0
        ? timer
        : 0,
    autoSpeakPrompt: stored?.autoSpeakPrompt === true,
    autoSpeakAnswer: stored?.autoSpeakAnswer === true,
    reminderEnabled: stored?.reminderEnabled === true,
    notesAutoSave: stored?.notesAutoSave !== false,
    notesAutoSaveSeconds:
      typeof stored?.notesAutoSaveSeconds === 'number' &&
      [1, 2, 5, 10].includes(stored.notesAutoSaveSeconds)
        ? stored.notesAutoSaveSeconds
        : 2,
  };
}

export async function saveAppPrefs(prefs: AppPrefs): Promise<void> {
  const db = await getDB();
  await db.put('meta', prefs, APP_PREFS_KEY);
}

// Notes operations (study notepad)
export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  return db.getAll('notes');
}

export async function getNote(noteId: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', noteId);
}

export async function putNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(noteId: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', noteId);
}

// Daily activity history operations (keyed by YYYY-MM-DD)
export async function getActivityHistory(): Promise<ActivityDay[]> {
  const db = await getDB();
  return db.getAll('activity');
}

export async function putActivityDay(day: ActivityDay): Promise<void> {
  const db = await getDB();
  await db.put('activity', day);
}

// Completed-session history (accuracy trends). Capped so the store can't grow
// unbounded — oldest records are pruned beyond MAX_SESSION_RECORDS.
const MAX_SESSION_RECORDS = 200;

export async function getSessionHistory(limit = 50): Promise<SessionRecord[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}

export async function addSessionRecord(record: SessionRecord): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('sessions', 'readwrite');
  await tx.store.put(record);
  const all = await tx.store.getAll();
  if (all.length > MAX_SESSION_RECORDS) {
    const oldest = all
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
      .slice(0, all.length - MAX_SESSION_RECORDS);
    await Promise.all(oldest.map((r) => tx.store.delete(r.id)));
  }
  await tx.done;
}

// Smart decks (saved dynamic filters)
export async function getSmartDecks(): Promise<SmartDeck[]> {
  const db = await getDB();
  return db.getAll('smartDecks');
}

export async function addSmartDeck(smartDeck: SmartDeck): Promise<void> {
  const db = await getDB();
  await db.put('smartDecks', smartDeck);
}

export async function deleteSmartDeck(smartDeckId: string): Promise<void> {
  const db = await getDB();
  await db.delete('smartDecks', smartDeckId);
}

export async function deleteSmartDecksByLanguage(languageId: string): Promise<void> {
  const db = await getDB();
  const all = await db.getAll('smartDecks');
  await Promise.all(
    all.filter((s) => s.languageId === languageId).map((s) => db.delete('smartDecks', s.id))
  );
}

/**
 * Clear all data (for testing or reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['languages', 'decks', 'cards', 'stats', 'theme', 'sfxMuted', 'ttsMuted', 'activity', 'sessions', 'smartDecks', 'meta', 'notes'], 'readwrite');
  await Promise.all([
    tx.objectStore('languages').clear(),
    tx.objectStore('decks').clear(),
    tx.objectStore('cards').clear(),
    tx.objectStore('stats').clear(),
    tx.objectStore('theme').clear(),
    tx.objectStore('sfxMuted').clear(),
    tx.objectStore('ttsMuted').clear(),
    tx.objectStore('activity').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('smartDecks').clear(),
    tx.objectStore('meta').clear(),
    tx.objectStore('notes').clear(),
  ]);
  await tx.done;
}

/**
 * Mark seeding as completed without writing any seed data. Used after a full
 * backup restore so preset data isn't resurrected on the next launch.
 */
export async function markSeedCompleted(): Promise<void> {
  const db = await getDB();
  await db.put('meta', true, SEED_COMPLETED_KEY);
}

/**
 * Wipe all study progress while keeping content intact: clears global stats
 * and daily activity history, and resets every card's SRS/review fields back
 * to a fresh "new" state. Words, decks, languages, difficulty, mnemonics, and
 * preferences are preserved. Returns the reset cards for immediate state sync.
 */
export async function resetStudyProgress(): Promise<VocabCard[]> {
  const db = await getDB();
  const cards = (await db.getAll('cards')) as VocabCard[];
  const resetCards = cards.map((card) => {
    const {
      confidence: _c,
      reviewCount: _r,
      lastReviewedAt: _l,
      srsBox: _s,
      nextReviewAt: _n,
      streak: _st,
      lapses: _la,
      wrongCount: _w,
      ...rest
    } = card;
    return { ...rest, confidence: 'new' as const, reviewCount: 0 };
  });

  const tx = db.transaction(['cards', 'stats', 'activity', 'sessions'], 'readwrite');
  const cardsStore = tx.objectStore('cards');
  for (const card of resetCards) {
    cardsStore.put(card);
  }
  await Promise.all([
    tx.objectStore('stats').clear(),
    tx.objectStore('activity').clear(),
    tx.objectStore('sessions').clear(),
    tx.done,
  ]);
  return resetCards;
}
