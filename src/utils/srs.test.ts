import { describe, expect, it } from 'vitest';
import { VocabCard } from '../types';
import {
  applySrsOutcome,
  getCardPriorityScore,
  getDeckMastery,
  getSmartReviewCards,
  inferSrsBox,
  isCardDue,
  isLeechCard,
  isWeakCard,
} from './srs';

function makeCard(overrides: Partial<VocabCard> = {}): VocabCard {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    word: 'labas',
    translation: 'hello',
    confidence: 'new',
    reviewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    srsBox: 1,
    streak: 0,
    lapses: 0,
    ...overrides,
  };
}

const NOW = new Date('2026-11-17T12:00:00.000Z');
const NOW_MS = NOW.getTime();

describe('inferSrsBox', () => {
  it('returns a valid explicit srsBox unchanged', () => {
    expect(inferSrsBox(makeCard({ srsBox: 4 }))).toBe(4);
  });

  it('falls back to confidence when srsBox is missing or out of range', () => {
    expect(inferSrsBox(makeCard({ srsBox: undefined, confidence: 'easy' }))).toBe(5);
    expect(inferSrsBox(makeCard({ srsBox: undefined, confidence: 'good' }))).toBe(3);
    expect(inferSrsBox(makeCard({ srsBox: undefined, confidence: 'hard' }))).toBe(1);
    expect(inferSrsBox(makeCard({ srsBox: undefined, confidence: 'new' }))).toBe(1);
    expect(inferSrsBox(makeCard({ srsBox: 9, confidence: 'good' }))).toBe(3);
    expect(inferSrsBox(makeCard({ srsBox: 0, confidence: 'easy' }))).toBe(5);
  });
});

describe('isCardDue', () => {
  it('treats cards without a review date as due', () => {
    expect(isCardDue(makeCard({ nextReviewAt: undefined }), NOW_MS)).toBe(true);
  });

  it('treats past and malformed dates as due, future dates as not due', () => {
    expect(
      isCardDue(makeCard({ nextReviewAt: '2026-11-17T11:59:59.000Z' }), NOW_MS)
    ).toBe(true);
    expect(
      isCardDue(makeCard({ nextReviewAt: '2026-11-17T12:00:00.000Z' }), NOW_MS)
    ).toBe(true);
    expect(
      isCardDue(makeCard({ nextReviewAt: '2026-11-18T12:00:00.000Z' }), NOW_MS)
    ).toBe(false);
    expect(isCardDue(makeCard({ nextReviewAt: 'not-a-date' }), NOW_MS)).toBe(true);
  });
});

describe('isWeakCard', () => {
  it('flags hard cards and low-box cards with review history', () => {
    expect(isWeakCard(makeCard({ confidence: 'hard' }))).toBe(true);
    expect(
      isWeakCard(makeCard({ confidence: 'good', srsBox: 2, reviewCount: 3 }))
    ).toBe(true);
    expect(
      isWeakCard(makeCard({ confidence: 'good', srsBox: 2, reviewCount: 0, lapses: 1 }))
    ).toBe(true);
  });

  it('does not flag mastered or unreviewed high-box cards', () => {
    expect(isWeakCard(makeCard({ confidence: 'easy', srsBox: 5, reviewCount: 9 }))).toBe(false);
    expect(isWeakCard(makeCard({ confidence: 'new', srsBox: 1, reviewCount: 0 }))).toBe(false);
  });
});

describe('applySrsOutcome', () => {
  it('promotes a good answer one box and schedules the 12-hour interval', () => {
    const card = makeCard({ srsBox: 1, reviewCount: 0 });
    const result = applySrsOutcome(card, 'good', NOW);

    expect(result.srsBox).toBe(2);
    expect(result.streak).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.confidence).toBe('good');
    expect(result.reviewCount).toBe(1);
    expect(result.lastReviewedAt).toBe(NOW.toISOString());
    expect(result.nextReviewAt).toBe(
      new Date(NOW.getTime() + 12 * 60 * 60 * 1000).toISOString()
    );
  });

  it('caps promotion at box 5', () => {
    const result = applySrsOutcome(makeCard({ srsBox: 5 }), 'good', NOW);
    expect(result.srsBox).toBe(5);
    expect(result.nextReviewAt).toBe(
      new Date(NOW.getTime() + 336 * 60 * 60 * 1000).toISOString()
    );
  });

  it('marks good answers as easy once box >= 4 and streak >= 2', () => {
    const result = applySrsOutcome(
      makeCard({ srsBox: 3, streak: 1, confidence: 'good' }),
      'good',
      NOW
    );
    expect(result.srsBox).toBe(4);
    expect(result.streak).toBe(2);
    expect(result.confidence).toBe('easy');
  });

  it('resets a lapsed card to box 1 and increments lapses on hard', () => {
    const card = makeCard({
      srsBox: 4,
      streak: 6,
      lapses: 2,
      confidence: 'easy',
      reviewCount: 10,
    });
    const result = applySrsOutcome(card, 'hard', NOW);

    expect(result.srsBox).toBe(1);
    expect(result.streak).toBe(0);
    expect(result.lapses).toBe(3);
    expect(result.confidence).toBe('hard');
    expect(result.reviewCount).toBe(11);
    // Box 1 schedules an immediate re-review
    expect(result.nextReviewAt).toBe(NOW.toISOString());
  });

  it('promotes an easy answer to at least box 4 and marks it easy', () => {
    const fromLow = applySrsOutcome(makeCard({ srsBox: 1 }), 'easy', NOW);
    expect(fromLow.srsBox).toBe(4);
    expect(fromLow.confidence).toBe('easy');
    expect(fromLow.nextReviewAt).toBe(
      new Date(NOW.getTime() + 120 * 60 * 60 * 1000).toISOString()
    );

    const fromHigh = applySrsOutcome(makeCard({ srsBox: 5 }), 'easy', NOW);
    expect(fromHigh.srsBox).toBe(5);
  });

  it('does not mutate the input card', () => {
    const card = makeCard({ srsBox: 2 });
    const result = applySrsOutcome(card, 'good', NOW);
    expect(card.srsBox).toBe(2);
    expect(result).not.toBe(card);
  });
});

describe('getCardPriorityScore', () => {
  it('prioritizes weak due cards over mastered future-scheduled cards', () => {
    const weakDue = makeCard({
      confidence: 'hard',
      srsBox: 1,
      lapses: 3,
      nextReviewAt: '2026-11-17T00:00:00.000Z',
    });
    const mastered = makeCard({
      id: 'card-2',
      confidence: 'easy',
      srsBox: 5,
      nextReviewAt: '2026-12-01T00:00:00.000Z',
    });

    expect(getCardPriorityScore(weakDue, NOW_MS)).toBeLessThan(
      getCardPriorityScore(mastered, NOW_MS)
    );
  });

  it('scores due cards higher than identical non-due cards', () => {
    const base = { confidence: 'good' as const, srsBox: 3, lapses: 0 };
    const due = makeCard({ ...base, nextReviewAt: '2026-11-16T00:00:00.000Z' });
    const future = makeCard({ ...base, nextReviewAt: '2026-12-01T00:00:00.000Z' });
    expect(getCardPriorityScore(due, NOW_MS)).toBeLessThan(
      getCardPriorityScore(future, NOW_MS)
    );
  });
});

describe('isLeechCard', () => {
  it('flags cards with 3+ lapses or 5+ wrong answers', () => {
    expect(isLeechCard(makeCard({ lapses: 3 }))).toBe(true);
    expect(isLeechCard(makeCard({ wrongCount: 5 }))).toBe(true);
    expect(isLeechCard(makeCard({ lapses: 2, wrongCount: 4 }))).toBe(false);
    expect(isLeechCard(makeCard())).toBe(false);
  });
});

describe('getDeckMastery', () => {
  it('returns zeros for an empty deck', () => {
    const m = getDeckMastery([]);
    expect(m.total).toBe(0);
    expect(m.masteryPct).toBe(0);
  });

  it('counts mastered, learning, and fresh cards', () => {
    const mastered = makeCard({ id: 'm', srsBox: 5, reviewCount: 9, nextReviewAt: '2026-12-01T00:00:00.000Z' });
    const easy = makeCard({ id: 'e', confidence: 'easy', srsBox: 4 });
    const learning = makeCard({ id: 'l', confidence: 'good', srsBox: 2, reviewCount: 3, nextReviewAt: '2026-11-01T00:00:00.000Z' });
    const fresh = makeCard({ id: 'f', confidence: 'new', reviewCount: 0 });

    const m = getDeckMastery([mastered, easy, learning, fresh]);
    expect(m.total).toBe(4);
    expect(m.mastered).toBe(2);
    expect(m.learning).toBe(1);
    expect(m.fresh).toBe(1);
    expect(m.masteryPct).toBe(50);
  });
});

describe('getSmartReviewCards', () => {
  it('prefers the weak pool when weak cards exist', () => {
    const weak = makeCard({ confidence: 'hard', srsBox: 1 });
    const strong = makeCard({ id: 'card-2', confidence: 'easy', srsBox: 5 });
    const { pool, mode } = getSmartReviewCards([strong, weak], NOW_MS);
    expect(mode).toBe('weak');
    expect(pool[0].id).toBe('card-1');
  });

  it('falls back to due cards, then all cards', () => {
    const due = makeCard({ confidence: 'good', srsBox: 3, nextReviewAt: '2026-11-01T00:00:00.000Z' });
    const future = makeCard({
      id: 'card-2',
      confidence: 'easy',
      srsBox: 5,
      nextReviewAt: '2027-01-01T00:00:00.000Z',
    });
    const dueResult = getSmartReviewCards([due, future], NOW_MS);
    expect(dueResult.mode).toBe('due');
    expect(dueResult.pool.every((c) => c.id === 'card-1')).toBe(true);

    const allFuture = getSmartReviewCards([future], NOW_MS);
    expect(allFuture.mode).toBe('all');
    expect(allFuture.pool).toHaveLength(1);
  });
});
