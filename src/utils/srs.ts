import { ConfidenceLevel, SmartDeckFilter, VocabCard } from '../types';

const BOX_INTERVAL_HOURS: Record<number, number> = {
  1: 0,        // Immediate re-review
  2: 12,       // 12 hours
  3: 48,       // 2 days
  4: 120,      // 5 days
  5: 336,      // 14 days
};

export function inferSrsBox(card: VocabCard): number {
  if (typeof card.srsBox === 'number' && card.srsBox >= 1 && card.srsBox <= 5) {
    return card.srsBox;
  }
  switch (card.confidence) {
    case 'easy':
      return 5;
    case 'good':
      return 3;
    case 'hard':
      return 1;
    default:
      return 1;
  }
}

export function isCardDue(card: VocabCard, nowMs = Date.now()): boolean {
  if (!card.nextReviewAt) return true;
  const dueMs = Date.parse(card.nextReviewAt);
  if (Number.isNaN(dueMs)) return true;
  return dueMs <= nowMs;
}

export function isWeakCard(card: VocabCard): boolean {
  if (card.confidence === 'hard') return true;
  const box = inferSrsBox(card);
  if ((card.lapses ?? 0) > 0 && box <= 2) return true;
  if ((card.reviewCount ?? 0) > 0 && box <= 2) return true;
  return false;
}

/**
 * Updates a card's Leitner SRS box, nextReviewAt timestamp, streak, lapses,
 * and derived confidence level after a flashcard rating or quiz answer.
 */
export function applySrsOutcome(
  card: VocabCard,
  outcome: 'hard' | 'good' | 'easy',
  now = new Date()
): VocabCard {
  const currentBox = inferSrsBox(card);
  const prevStreak = card.streak ?? 0;
  const prevLapses = card.lapses ?? 0;
  const nowIso = now.toISOString();

  let nextBox = currentBox;
  let nextStreak = prevStreak;
  let nextLapses = prevLapses;
  let nextConfidence: ConfidenceLevel = card.confidence;

  if (outcome === 'hard') {
    nextBox = 1;
    nextStreak = 0;
    nextLapses = prevLapses + 1;
    nextConfidence = 'hard';
  } else if (outcome === 'good') {
    nextBox = Math.min(5, Math.max(2, currentBox + 1));
    nextStreak = prevStreak + 1;
    nextConfidence = nextBox >= 4 && nextStreak >= 2 ? 'easy' : 'good';
  } else {
    // 'easy'
    nextBox = Math.min(5, Math.max(4, currentBox + 1));
    nextStreak = prevStreak + 1;
    nextConfidence = 'easy';
  }

  const hours = BOX_INTERVAL_HOURS[nextBox] ?? 0;
  const nextReviewAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

  return {
    ...card,
    confidence: nextConfidence,
    reviewCount: card.reviewCount + 1,
    lastReviewedAt: nowIso,
    srsBox: nextBox,
    nextReviewAt,
    streak: nextStreak,
    lapses: nextLapses,
  };
}

/**
 * Priority score (lower = higher priority in quiz / smart review queues):
 * - Box 1 / Hard / Lapsed cards surface first
 * - Due cards surface before spaced-out future cards
 * - Easy / Box 5 cards scheduled in the future are pushed to the end
 */
export function getCardPriorityScore(card: VocabCard, nowMs = Date.now()): number {
  const box = inferSrsBox(card);
  const due = isCardDue(card, nowMs);
  const lapses = card.lapses ?? 0;

  let score = box * 100;
  if (card.confidence === 'hard') score -= 90;
  if (due) score -= 45;
  else score += 180; // Space out non-due cards
  if (card.confidence === 'new') score -= 15;
  score -= Math.min(40, lapses * 10);

  return score;
}

export function sortCardsBySrsPriority(
  cards: VocabCard[],
  nowMs = Date.now()
): VocabCard[] {
  // Add small jitter so identical-tier cards rotate naturally across sessions
  return cards
    .map((card) => ({
      card,
      score: getCardPriorityScore(card, nowMs) + Math.random() * 14,
    }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.card);
}

export function getSmartReviewCards(
  cards: VocabCard[],
  nowMs = Date.now()
): { pool: VocabCard[]; mode: 'weak' | 'due' | 'all' } {
  const active = cards.filter((c) => !c.suspended);
  const weak = sortCardsBySrsPriority(active.filter(isWeakCard), nowMs);
  if (weak.length > 0) {
    return { pool: weak, mode: 'weak' };
  }

  const due = sortCardsBySrsPriority(
    active.filter((c) => isCardDue(c, nowMs)),
    nowMs
  );
  if (due.length > 0) {
    return { pool: due, mode: 'due' };
  }

  return { pool: sortCardsBySrsPriority(active, nowMs), mode: 'all' };
}

// ---------------------------------------------------------------------------
// Leech detection & deck mastery
// ---------------------------------------------------------------------------

export const LEECH_LAPSES_THRESHOLD = 3;
export const LEECH_WRONG_THRESHOLD = 5;

/**
 * A "leech" card is one the learner keeps missing: many SRS lapses or a high
 * cumulative wrong-answer count. These stall momentum and deserve targeted
 * review or exclusion from casual sessions.
 */
export function isLeechCard(card: VocabCard): boolean {
  return (
    (card.lapses ?? 0) >= LEECH_LAPSES_THRESHOLD ||
    (card.wrongCount ?? 0) >= LEECH_WRONG_THRESHOLD
  );
}

/**
 * Leech Lab graduation: clears the lapse counter and discounts the wrong
 * count by one threshold worth, so a card that keeps failing needs several
 * successful remediation rounds before its leech badge disappears for good.
 */
export function graduateLeechCard(card: VocabCard): VocabCard {
  return {
    ...card,
    lapses: 0,
    wrongCount: Math.max(0, (card.wrongCount ?? 0) - LEECH_WRONG_THRESHOLD),
  };
}

export interface DeckMastery {
  total: number;
  mastered: number;
  learning: number;
  fresh: number; // never reviewed
  masteryPct: number;
}

/**
 * Per-deck mastery breakdown:
 *  - mastered: Leitner box >= 4 or confidence 'easy'
 *  - fresh:    never reviewed (no reviewCount / nextReviewAt)
 *  - learning: everything else (reviewed but not yet mastered)
 */
export function getDeckMastery(cards: VocabCard[]): DeckMastery {
  let mastered = 0;
  let learning = 0;
  let fresh = 0;

  for (const card of cards) {
    const box = inferSrsBox(card);
    const reviewed = (card.reviewCount ?? 0) > 0 || !!card.nextReviewAt;
    if (box >= 4 || card.confidence === 'easy') {
      mastered += 1;
    } else if (!reviewed) {
      fresh += 1;
    } else {
      learning += 1;
    }
  }

  const total = cards.length;
  return {
    total,
    mastered,
    learning,
    fresh,
    masteryPct: total === 0 ? 0 : Math.round((mastered / total) * 100),
  };
}

export interface ReviewForecast {
  today: number;
  tomorrow: number;
  thisWeek: number;
}

/**
 * Evaluates a card against a SmartDeckFilter. Multiple enabled flags act as
 * OR conditions (e.g. "weak OR due"); an empty filter matches nothing.
 */
export function matchesSmartFilter(
  card: VocabCard,
  filter: SmartDeckFilter,
  nowMs = Date.now()
): boolean {
  if (card.suspended) return false;
  const checks: boolean[] = [];
  if (filter.weak) checks.push(isWeakCard(card));
  if (filter.due) checks.push(isCardDue(card, nowMs));
  if (filter.leeches) checks.push(isLeechCard(card));
  if (filter.newOnly) checks.push(card.confidence === 'new');
  if (filter.hardOnly) checks.push(card.confidence === 'hard');
  if (filter.tag) {
    const wanted = filter.tag.trim().toLowerCase();
    checks.push(
      wanted.length > 0 &&
        (card.tags ?? []).some((t) => t.toLowerCase() === wanted)
    );
  }
  return checks.length > 0 && checks.some(Boolean);
}

export function getSmartDeckCards(
  cards: VocabCard[],
  filter: SmartDeckFilter,
  nowMs = Date.now()
): VocabCard[] {
  return sortCardsBySrsPriority(
    cards.filter((c) => matchesSmartFilter(c, filter, nowMs)),
    nowMs
  );
}

/**
 * Bucket cards by when their next review is scheduled. Cards that were never
 * reviewed (no nextReviewAt) count as due today, matching isCardDue().
 */
export function getReviewForecast(
  cards: VocabCard[],
  now: Date = new Date()
): ReviewForecast {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  // Calendar-day boundaries via setDate — fixed +24h arithmetic drifts by an
  // hour across DST transitions and mis-buckets reviews near midnight.
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow);
  startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);
  const startOfNextWeek = new Date(startOfToday);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
  const endOfToday = startOfTomorrow.getTime();
  const endOfTomorrow = startOfDayAfterTomorrow.getTime();
  const endOfWeek = startOfNextWeek.getTime();

  let today = 0;
  let tomorrow = 0;
  let thisWeek = 0;

  for (const card of cards) {
    if (card.suspended) continue;
    const dueMs = card.nextReviewAt ? Date.parse(card.nextReviewAt) : NaN;
    if (Number.isNaN(dueMs)) {
      // Never scheduled or unparseable -> due immediately
      today += 1;
      thisWeek += 1;
    } else if (dueMs < endOfToday) {
      today += 1;
      thisWeek += 1;
    } else if (dueMs < endOfTomorrow) {
      tomorrow += 1;
      thisWeek += 1;
    } else if (dueMs < endOfWeek) {
      thisWeek += 1;
    }
  }

  return { today, tomorrow, thisWeek };
}

/**
 * Per-day due counts for the next `days` calendar days (index 0 = today).
 * Uses the same local-midnight boundaries as getReviewForecast, so cards
 * that were never scheduled or have unparseable dates count as due today.
 */
export function getDailyForecast(
  cards: VocabCard[],
  days = 7,
  now: Date = new Date()
): number[] {
  const buckets = new Array<number>(days).fill(0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  // Precompute local-midnight boundaries (DST-safe via setDate)
  const boundaries: number[] = [startOfToday.getTime()];
  for (let i = 1; i <= days; i++) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + i);
    boundaries.push(d.getTime());
  }

  for (const card of cards) {
    if (card.suspended) continue;
    const dueMs = card.nextReviewAt ? Date.parse(card.nextReviewAt) : NaN;
    const effective = Number.isNaN(dueMs) ? 0 : dueMs;
    // Never-scheduled/unparseable -> due today (bucket 0)
    if (Number.isNaN(dueMs)) {
      buckets[0] += 1;
      continue;
    }
    for (let i = 0; i < days; i++) {
      if (effective < boundaries[i + 1]) {
        buckets[i] += 1;
        break;
      }
    }
    // due beyond the window -> not counted
  }
  return buckets;
}
