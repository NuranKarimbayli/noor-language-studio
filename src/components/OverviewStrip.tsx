import { memo, useMemo, useState } from 'react';
import { CalendarClock, Flame, RefreshCw, Shuffle, Zap } from 'lucide-react';
import { Deck, StudyStats, VocabCard } from '../types';
import { getLocalDateString } from '../utils/storage';
import { getReviewForecast, isCardDue, isWeakCard } from '../utils/srs';
import { pluralize, t } from '../i18n';

interface OverviewStripProps {
  languageId: string;
  decks: Deck[];
  cards: VocabCard[];
  stats: StudyStats;
  onStartSmartReview: () => void;
}

const DAILY_QUOTES: Array<{ text: string; author?: string }> = [
  { text: t('Every new word is a new window to the world.') },
  { text: t('To have another language is to possess a second soul.'), author: t('Charlemagne') },
  { text: t('Small daily practice turns unfamiliar sounds into fluent thought.') },
  { text: t('Language is the road map of a culture.'), author: t('Rita Mae Brown') },
  { text: t('Ten quiet minutes a day outweighs an occasional marathon.') },
  { text: t('Mistakes are proof that you are actively recalling, not passively reading.') },
  { text: t('A different language is a different vision of life.'), author: t('Federico Fellini') },
  { text: t('Fluency grows one recalled word at a time.') },
];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function OverviewStripInner({
  languageId,
  decks,
  cards,
  stats,
  onStartSmartReview,
}: OverviewStripProps) {
  const [quoteOffset, setQuoteOffset] = useState(0);
  const [wordOffset, setWordOffset] = useState(0);

  const quote = useMemo(() => {
    const idx = (getDayOfYear() + quoteOffset) % DAILY_QUOTES.length;
    return DAILY_QUOTES[idx];
  }, [quoteOffset]);

  const deckNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of decks) map.set(d.id, d.name);
    return map;
  }, [decks]);

  // Deterministic daily Word of the Day per language + date
  const wordOfTheDay = useMemo(() => {
    if (cards.length === 0) return null;
    const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
    const dateSeed = `${getLocalDateString()}:${languageId}`;
    const baseIdx = hashString(dateSeed) % sorted.length;
    const idx = (baseIdx + wordOffset) % sorted.length;
    const card = sorted[idx];
    return {
      card,
      deckName: deckNameMap.get(card.deckId) ?? t('Vocabulary'),
    };
  }, [cards, languageId, wordOffset, deckNameMap]);

  const { easyCount, goodCount, masteryPct, weakCount, dueCount } = useMemo(() => {
    if (cards.length === 0) {
      return { easyCount: 0, goodCount: 0, masteryPct: 0, weakCount: 0, dueCount: 0 };
    }
    const nowMs = Date.now();
    let easy = 0;
    let good = 0;
    let weak = 0;
    let due = 0;
    for (const c of cards) {
      if (c.confidence === 'easy') easy += 1;
      else if (c.confidence === 'good') good += 1;
      if (isWeakCard(c)) weak += 1;
      if (isCardDue(c, nowMs)) due += 1;
    }
    const pct = Math.round((easy / cards.length) * 100);
    return { easyCount: easy, goodCount: good, masteryPct: pct, weakCount: weak, dueCount: due };
  }, [cards]);

  // Spaced-repetition forecast: cards due today / tomorrow / this week
  const forecast = useMemo(() => getReviewForecast(cards), [cards]);

  const accuracyPct =
    stats.totalQuizAnswered > 0
      ? Math.round((stats.totalQuizCorrect / stats.totalQuizAnswered) * 100)
      : null;

  return (
    <section className="space-y-4">
      {/* Row 1: Daily Motivation + Smart Review & Word of the Day */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        {/* Left column: Daily Quote + Smart Review Quick Action */}
        <div className="md:col-span-7 flex flex-col justify-between gap-3.5">
          {/* Daily Motivation Quote */}
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-[#F3EFE8]/70 dark:bg-[#171513] border border-slate-200 dark:border-[#2E2A25]">
            <p className="text-xs sm:text-sm italic text-[#57534E] dark:text-[#C4BEB4] leading-relaxed">
              “{t(quote.text)}”
              {quote.author && (
                <span className="not-italic text-[#78716C] dark:text-[#A8A29E] ml-2">
                  — {quote.author}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setQuoteOffset((n) => n + 1)}
              aria-label={t('Next motivation quote')}
              title={t('Another quote')}
              className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-white/70 dark:hover:bg-[#25221E] transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sleek Smart Review / Weak Words Quick Action */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25]">
            <div className="space-y-0.5 min-w-0">
              <div className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {weakCount > 0 ? t('Weak Words Need Review') : t('Leitner Smart Review')}
              </div>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                {cards.length === 0
                  ? t('Add vocabulary words to unlock adaptive review.')
                  : weakCount > 0
                    ? t('{count} {words} marked hard or missed recently', {
                        count: weakCount,
                        words: pluralize(weakCount, 'word', 'words'),
                      })
                    : t('{count} {words} ready in your spaced queue', {
                        count: dueCount,
                        words: pluralize(dueCount, 'word', 'words'),
                      })}
              </p>
            </div>

            <button
              type="button"
              disabled={cards.length === 0}
              onClick={onStartSmartReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#25221E] border border-[#B45309]/40 dark:border-[#D97706]/50 hover:bg-[#B45309] hover:text-white dark:hover:bg-[#D97706] dark:hover:text-[#121110] hover:-translate-y-px hover:shadow-md text-xs sm:text-sm font-semibold text-[#B45309] dark:text-[#F59E0B] transition-all duration-200 ease-out whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{weakCount > 0 ? t('Weak Words ({count})', { count: weakCount }) : t('Smart Review')}</span>
            </button>
          </div>
        </div>

        {/* Right column: Word of the Day Minimalist Widget */}
        <div className="md:col-span-5 bg-gradient-to-br from-white to-[#FAF6EE] dark:from-[#1C1A17] dark:to-[#181512] border border-[#B45309]/25 dark:border-[#D97706]/30 rounded-2xl p-5 flex flex-col justify-between gap-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-[#B45309]/50 dark:hover:border-[#D97706]/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309] dark:text-[#F59E0B]">
              {t('Word of the Day')}
            </span>
            {cards.length > 1 && (
              <button
                type="button"
                onClick={() => setWordOffset((n) => n + 1)}
                aria-label={t('Show another spotlight word')}
                title={t('Cycle spotlight word')}
                className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-white/70 dark:hover:bg-[#25221E] transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {wordOfTheDay ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] tracking-tight">
                  {wordOfTheDay.card.word}
                </span>
                <span className="text-[#A8A29E]" aria-hidden="true">
                  —
                </span>
                <span className="text-sm sm:text-base font-medium text-[#57534E] dark:text-[#D6D0C6]">
                  {wordOfTheDay.card.translation}
                </span>
              </div>
              {wordOfTheDay.card.exampleSentence && (
                <p className="text-xs italic text-[#78716C] dark:text-[#A8A29E] line-clamp-2">
                  “{wordOfTheDay.card.exampleSentence}”
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              {t('Add words to highlight one daily spotlight entry.')}
            </p>
          )}

          <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
            {wordOfTheDay ? wordOfTheDay.deckName : t('Daily Spotlight')}
          </div>
        </div>
      </div>

      {/* Row 2: 4 Compact Progress & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Words */}
        <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 flex flex-col justify-between gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-[#D97706]/50 dark:hover:border-[#D97706]/40">
          <span className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
            {t('Total Words')}
          </span>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] tabular-nums">
            {cards.length}
          </div>
          <span className="text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
            {t('across {count} {decks}', {
              count: decks.length,
              decks: pluralize(decks.length, 'deck', 'decks'),
            })}
          </span>
        </div>

        {/* Card 2: Mastery / Progress */}
        <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 flex flex-col justify-between gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-[#D97706]/50 dark:hover:border-[#D97706]/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
              {t('Mastery')}
            </span>
            <span className="font-mono text-xs font-medium text-[#B45309] dark:text-[#F59E0B] tabular-nums">
              {masteryPct}%
            </span>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] tabular-nums">
              {easyCount}{' '}
              <span className="text-sm font-sans font-normal text-[#78716C] dark:text-[#A8A29E]">
                {t('/ {total} easy', { total: cards.length })}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#E6E1D8] dark:bg-[#2E2A25] overflow-hidden">
              <div
                className="h-full bg-[#B45309] dark:bg-[#D97706] transition-all duration-300"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
            {t('{count} in progress (Good)', { count: goodCount })}
          </span>
        </div>

        {/* Card 3: Study Streak & Accuracy */}
        <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 flex flex-col justify-between gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-[#D97706]/50 dark:hover:border-[#D97706]/40">
          <span className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
            Study Streak &amp; Accuracy
          </span>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] tabular-nums">
            {stats.streakDays}{' '}
            <span className="text-sm font-sans font-normal text-[#78716C] dark:text-[#A8A29E]">
              {stats.streakDays === 1 ? t('Day') : t('Days')}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
            <span>
              {accuracyPct !== null
                ? `${accuracyPct}% quiz accuracy · ${stats.totalQuizAnswered} answered`
                : t('No quizzes completed yet')}
            </span>
            {(stats.bestQuizStreak ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 font-medium whitespace-nowrap">
                <Flame className="w-3.5 h-3.5" />
                Best {stats.bestQuizStreak}
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Review Forecast */}
        <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 flex flex-col justify-between gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-[#D97706]/50 dark:hover:border-[#D97706]/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
              {t('Review Forecast')}
            </span>
            <CalendarClock className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] tabular-nums">
            {forecast.today}
            <span className="text-sm font-sans font-normal text-[#78716C] dark:text-[#A8A29E]">
              {' '}
              today
            </span>
          </div>
          <span className="text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
            {forecast.tomorrow} tomorrow · {forecast.thisWeek} this week
          </span>
        </div>
      </div>
    </section>
  );
}

export const OverviewStrip = memo(OverviewStripInner);
