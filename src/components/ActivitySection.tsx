import { useMemo } from 'react';
import { Flame, Minus, Plus, Target, TrendingUp } from 'lucide-react';
import { ActivityDay, VocabCard } from '../types';
import { getLocalDateString } from '../utils/storage';

interface ActivitySectionProps {
  activity: ActivityDay[];
  dailyGoal: number;
  onDailyGoalChange: (goal: number) => void;
  cards: VocabCard[];
  deckNameFor: (deckId: string) => string;
  onPracticeMistakes: (cardIds: string[]) => void;
}

const HEATMAP_WEEKS = 16;
const GOAL_STEP = 5;
const GOAL_MIN = 5;
const GOAL_MAX = 200;
const MISTAKE_BANK_SIZE = 10;

function dayActivityValue(day: ActivityDay | undefined): number {
  if (!day) return 0;
  return day.reviews + day.quizzes * 2;
}

function intensityLevel(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  if (value <= 10) return 3;
  return 4;
}

const LEVEL_CLASSES = [
  'bg-[#ECE7DD] dark:bg-[#25221E]',
  'bg-amber-200 dark:bg-amber-900/50',
  'bg-amber-400/80 dark:bg-amber-700/70',
  'bg-amber-500 dark:bg-amber-600',
  'bg-[#B45309] dark:bg-[#D97706]',
] as const;

interface HeatCell {
  date: string;
  value: number;
  reviews: number;
}

export function ActivitySection({
  activity,
  dailyGoal,
  onDailyGoalChange,
  cards,
  deckNameFor,
  onPracticeMistakes,
}: ActivitySectionProps) {
  const activityByDate = useMemo(() => {
    const map = new Map<string, ActivityDay>();
    for (const day of activity) map.set(day.date, day);
    return map;
  }, [activity]);

  // Last ~16 weeks of days, aligned to Sunday-start weeks (GitHub style)
  const heatmapCells = useMemo<(HeatCell | null)[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));
    start.setDate(start.getDate() - start.getDay());

    const cells: (HeatCell | null)[] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const dateStr = getLocalDateString(cursor);
      const rec = activityByDate.get(dateStr);
      cells.push({
        date: dateStr,
        value: dayActivityValue(rec),
        reviews: rec?.reviews ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [activityByDate]);

  const todayKey = getLocalDateString();
  const todayRecord = activityByDate.get(todayKey);
  const todayReviews = todayRecord?.reviews ?? 0;
  const goalPct = Math.min(100, Math.round((todayReviews / dailyGoal) * 100));
  const goalReached = todayReviews >= dailyGoal;

  // Weakness Radar: top missed words across the active language
  const mistakeBank = useMemo(() => {
    return cards
      .map((card) => ({
        card,
        misses: Math.max(card.wrongCount ?? 0, card.lapses ?? 0),
      }))
      .filter((entry) => entry.misses > 0)
      .sort((a, b) => b.misses - a.misses || a.card.word.localeCompare(b.card.word))
      .slice(0, MISTAKE_BANK_SIZE);
  }, [cards]);

  const adjustGoal = (delta: number) => {
    onDailyGoalChange(
      Math.min(GOAL_MAX, Math.max(GOAL_MIN, dailyGoal + delta))
    );
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* Activity Heatmap + Daily Goal */}
      <div className="lg:col-span-2 bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Activity
            </h3>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              Words reviewed over the last {HEATMAP_WEEKS} weeks
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
            <span>Less</span>
            {LEVEL_CLASSES.map((cls, i) => (
              <span
                key={i}
                className={`w-3 h-3 rounded-[3px] ${cls}`}
                aria-hidden="true"
              />
            ))}
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="grid grid-flow-col grid-rows-7 gap-1 w-max">
            {heatmapCells.map((cell, idx) =>
              cell ? (
                <div
                  key={cell.date}
                  title={`${cell.date} — ${cell.reviews} ${cell.reviews === 1 ? 'review' : 'reviews'}`}
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] transition-colors ${LEVEL_CLASSES[intensityLevel(cell.value)]}`}
                />
              ) : (
                <div key={`pad-${idx}`} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              )
            )}
          </div>
        </div>

        {/* Daily Review Goal */}
        <div className="pt-4 border-t border-slate-200 dark:border-[#2E2A25] space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
              <span className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                Daily Review Goal
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                {todayReviews} / {dailyGoal}
              </span>
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-[#2E2A25] overflow-hidden">
                <button
                  type="button"
                  onClick={() => adjustGoal(-GOAL_STEP)}
                  disabled={dailyGoal <= GOAL_MIN}
                  aria-label="Decrease daily goal"
                  className="px-1.5 py-1 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] disabled:opacity-40 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustGoal(GOAL_STEP)}
                  disabled={dailyGoal >= GOAL_MAX}
                  aria-label="Increase daily goal"
                  className="px-1.5 py-1 text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] disabled:opacity-40 transition-colors border-l border-slate-200 dark:border-[#2E2A25]"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#E6E1D8] dark:bg-[#2E2A25] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                goalReached ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-[#B45309] dark:bg-[#D97706]'
              }`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
            {goalReached
              ? 'Daily goal reached — nicely done.'
              : `${dailyGoal - todayReviews} more ${dailyGoal - todayReviews === 1 ? 'word' : 'words'} to hit today's goal.`}
          </p>
        </div>
      </div>

      {/* Weakness Radar / Mistake Bank */}
      <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Weakness Radar
            </h3>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              Most frequently missed words
            </p>
          </div>
          <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
        </div>

        {mistakeBank.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              No missed words yet. Keep practicing!
            </p>
          </div>
        ) : (
          <>
            <ul className="flex-1 min-h-0 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-[#2E2A25] -mx-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]">
              {mistakeBank.map(({ card, misses }) => (
                <li
                  key={card.id}
                  className="flex items-center justify-between gap-3 px-2 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] truncate select-text">
                        {card.word}
                      </span>
                      <span className="text-xs text-[#78716C] dark:text-[#A8A29E] truncate select-text">
                        {card.translation}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
                      {deckNameFor(card.deckId)}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-red-700 dark:text-red-400 tabular-nums">
                    ×{misses}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onPracticeMistakes(mistakeBank.map((m) => m.card.id))}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold transition-colors"
            >
              <Flame className="w-4 h-4" />
              Practice Mistakes ({mistakeBank.length})
            </button>
          </>
        )}
      </div>
    </section>
  );
}
