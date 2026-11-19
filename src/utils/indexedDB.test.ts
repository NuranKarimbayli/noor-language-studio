import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCard,
  addDeck,
  addLanguage,
  clearAllData,
  deleteCard,
  deleteCardsByDeck,
  deleteDeck,
  getAllCards,
  getAllDecks,
  getAllLanguages,
  getSfxMuted,
  getStats,
  getTheme,
  initializeDatabase,
  putCards,
  saveSfxMuted,
  saveStats,
  saveTheme,
  updateCard,
  updateDeck,
} from './indexedDB';
import { PRESET_LANGUAGES, SEED_CARDS, SEED_DECKS } from '../data/seedDecks';
import { Deck, LanguageItem, VocabCard } from '../types';

const lang: LanguageItem = {
  id: 'lang-test',
  name: 'Testish',
  nativeLabel: 'Test',
  code: 'TS',
  createdAt: new Date().toISOString(),
};

const deck: Deck = {
  id: 'deck-test',
  languageId: 'lang-test',
  name: 'Test Deck',
  description: 'desc',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const card: VocabCard = {
  id: 'card-test',
  deckId: 'deck-test',
  word: 'hello',
  translation: 'world',
  confidence: 'new',
  reviewCount: 0,
  srsBox: 1,
  streak: 0,
  lapses: 0,
  createdAt: new Date().toISOString(),
};

beforeEach(async () => {
  await clearAllData();
  localStorage.clear();
});

describe('IndexedDB persistence layer', () => {
  it('seeds preset data only when stores are empty', async () => {
    await initializeDatabase();
    expect(await getAllLanguages()).toHaveLength(PRESET_LANGUAGES.length);
    expect(await getAllDecks()).toHaveLength(SEED_DECKS.length);
    expect(await getAllCards()).toHaveLength(SEED_CARDS.length);
  });

  it('does not reseed decks/cards the user intentionally deleted', async () => {
    await initializeDatabase();
    const decks = await getAllDecks();
    for (const d of decks) {
      await Promise.all([deleteDeck(d.id), deleteCardsByDeck(d.id)]);
    }
    await initializeDatabase();
    expect(await getAllDecks()).toHaveLength(0);
    expect(await getAllCards()).toHaveLength(0);
    // Languages survive — only genuinely empty stores reseed
    expect(await getAllLanguages()).toHaveLength(PRESET_LANGUAGES.length);
  });

  it('persists theme across reads (survives reload)', async () => {
    await initializeDatabase();
    await saveTheme('dark');
    expect(await getTheme()).toBe('dark');
    await saveTheme('light');
    expect(await getTheme()).toBe('light');
  });

  it('persists sfxMuted and stats', async () => {
    await initializeDatabase();
    await saveSfxMuted(true);
    expect(await getSfxMuted()).toBe(true);

    await saveStats({
      streakDays: 5,
      lastStudyDate: new Date().toISOString().slice(0, 10),
      totalQuizAnswered: 10,
      totalQuizCorrect: 8,
    });
    const stats = await getStats();
    expect(stats.totalQuizAnswered).toBe(10);
    expect(stats.totalQuizCorrect).toBe(8);
  });

  it('round-trips languages, decks, and cards', async () => {
    await initializeDatabase();
    await addLanguage(lang);
    await addDeck(deck);
    await addCard(card);

    expect((await getAllLanguages()).map((l) => l.id)).toContain('lang-test');
    expect((await getAllDecks()).map((d) => d.id)).toContain('deck-test');
    expect((await getAllCards()).map((c) => c.id)).toContain('card-test');
  });

  it('updates and deletes entity records', async () => {
    await initializeDatabase();
    await addDeck(deck);
    await addCard(card);

    await updateDeck('deck-test', { name: 'Renamed' });
    expect((await getAllDecks()).find((d) => d.id === 'deck-test')?.name).toBe('Renamed');

    await updateCard('card-test', { word: 'hola' });
    expect((await getAllCards()).find((c) => c.id === 'card-test')?.word).toBe('hola');

    await deleteCard('card-test');
    expect((await getAllCards()).map((c) => c.id)).not.toContain('card-test');
  });

  it('batch-writes cards via putCards', async () => {
    await initializeDatabase();
    const batch: VocabCard[] = Array.from({ length: 5 }, (_, i) => ({
      ...card,
      id: `card-batch-${i}`,
    }));
    await putCards(batch);
    const ids = (await getAllCards()).map((c) => c.id);
    for (const b of batch) expect(ids).toContain(b.id);
  });
});
