import { describe, expect, it } from 'vitest';
import {
  applyStudyActivity,
  buildBackupPayload,
  createId,
  parseBackupJson,
  parseImportedDeckJson,
} from './storage';
import { StudyStats } from '../types';

const baseStats = (overrides: Partial<StudyStats> = {}): StudyStats => ({
  streakDays: 0,
  lastStudyDate: null,
  totalQuizAnswered: 0,
  totalQuizCorrect: 0,
  ...overrides,
});

describe('createId', () => {
  it('generates prefixed unique ids', () => {
    const a = createId('card');
    const b = createId('card');
    expect(a).toMatch(/^card-/);
    expect(b).toMatch(/^card-/);
    expect(a).not.toBe(b);
  });
});

describe('applyStudyActivity', () => {
  const today = new Date();
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = ymd(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = ymd(yesterday);

  it('starts a streak at 1 for a first-time or stale lastStudyDate', () => {
    expect(applyStudyActivity(baseStats()).streakDays).toBe(1);
    expect(
      applyStudyActivity(baseStats({ streakDays: 9, lastStudyDate: '2020-01-01' })).streakDays
    ).toBe(1);
  });

  it('increments the streak when last study was yesterday', () => {
    const result = applyStudyActivity(
      baseStats({ streakDays: 4, lastStudyDate: yesterdayStr })
    );
    expect(result.streakDays).toBe(5);
    expect(result.lastStudyDate).toBe(todayStr);
  });

  it('keeps the streak when already studied today', () => {
    const result = applyStudyActivity(
      baseStats({ streakDays: 4, lastStudyDate: todayStr })
    );
    expect(result.streakDays).toBe(4);
  });

  it('tracks quiz totals only when an answer is recorded', () => {
    const withAnswer = applyStudyActivity(baseStats(), { isCorrect: true });
    expect(withAnswer.totalQuizAnswered).toBe(1);
    expect(withAnswer.totalQuizCorrect).toBe(1);

    const wrong = applyStudyActivity(baseStats(), { isCorrect: false });
    expect(wrong.totalQuizAnswered).toBe(1);
    expect(wrong.totalQuizCorrect).toBe(0);

    const noAnswer = applyStudyActivity(baseStats());
    expect(noAnswer.totalQuizAnswered).toBe(0);
  });
});

describe('parseImportedDeckJson', () => {
  it('parses a wrapped deck payload and filters invalid cards', () => {
    const payload = JSON.stringify({
      deck: {
        name: 'Travel',
        description: 'Trip words',
        cards: [
          { word: 'labas', translation: 'hello', confidence: 'easy' },
          { word: '', translation: 'skip me' },
          { word: 'vanduo', translation: 'water', exampleSentence: 'Geras vanduo.' },
          'not-an-object',
        ],
      },
    });

    const result = parseImportedDeckJson(payload);
    expect(result.deckName).toBe('Travel');
    expect(result.description).toBe('Trip words');
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].confidence).toBe('easy');
    expect(result.cards[1].exampleSentence).toBe('Geras vanduo.');
  });

  it('accepts a bare cards array and defaults confidence', () => {
    const result = parseImportedDeckJson(
      JSON.stringify([{ word: 'ačiū', translation: 'thanks', confidence: 'bogus' }])
    );
    expect(result.deckName).toBe('Imported Deck');
    expect(result.cards[0].confidence).toBe('new');
  });

  it('throws on malformed payloads and empty card sets', () => {
    expect(() => parseImportedDeckJson('{"foo":1}')).toThrow(/cards/);
    expect(() => parseImportedDeckJson(JSON.stringify({ cards: [] }))).toThrow(/No valid/);
    expect(() => parseImportedDeckJson('not json')).toThrow();
  });
});

describe('parseBackupJson', () => {
  const validPayload = buildBackupPayload({
    languages: [
      { id: 'lang-1', name: 'Lithuanian', nativeLabel: 'Lietuvių', code: 'LT' } as never,
    ],
    decks: [
      {
        id: 'deck-1',
        languageId: 'lang-1',
        name: 'Basics',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    cards: [
      {
        id: 'card-1',
        deckId: 'deck-1',
        word: 'labas',
        translation: 'hello',
        confidence: 'good',
        reviewCount: 4,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    stats: baseStats({ streakDays: 3 }),
    activity: [{ date: '2026-11-17', reviews: 10, quizzes: 2, correct: 8 }],
  });

  it('round-trips a full backup payload', () => {
    const parsed = parseBackupJson(JSON.stringify(validPayload));
    expect(parsed.version).toBe(1);
    expect(parsed.languages).toHaveLength(1);
    expect(parsed.decks).toHaveLength(1);
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.cards[0].confidence).toBe('good');
    expect(parsed.stats?.streakDays).toBe(3);
    expect(parsed.activity).toHaveLength(1);
  });

  it('accepts a bare {languages, decks, cards} payload', () => {
    const bare = {
      languages: validPayload.languages,
      decks: validPayload.decks,
      cards: validPayload.cards,
    };
    const parsed = parseBackupJson(JSON.stringify(bare));
    expect(parsed.cards).toHaveLength(1);
  });

  it('drops malformed records instead of failing', () => {
    const messy = {
      languages: [
        { id: 'lang-ok', name: 'Test', nativeLabel: 'T', code: 'TS', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'lang-bad' },
        'junk',
      ],
      decks: [{ id: 'd1', languageId: 'lang-1' }],
      cards: [
        { id: 'c1', deckId: 'd1', word: 'x', translation: 'y', confidence: 'bogus' },
        { id: 'c2' },
      ],
    };
    const parsed = parseBackupJson(JSON.stringify(messy));
    expect(parsed.languages).toHaveLength(1);
    expect(parsed.decks).toHaveLength(1);
    expect(parsed.cards).toHaveLength(1);
    expect(parsed.cards[0].confidence).toBe('new'); // invalid confidence normalized
  });

  it('throws on invalid JSON and empty backups', () => {
    expect(() => parseBackupJson('not json')).toThrow();
    expect(() => parseBackupJson('42')).toThrow(/JSON object/);
    expect(() => parseBackupJson('{"languages": [], "decks": [], "cards": []}')).toThrow(
      /No valid/
    );
  });
});
