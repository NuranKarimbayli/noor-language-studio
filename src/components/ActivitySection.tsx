import { memo, useMemo, useState } from 'react';
import { Bug, CalendarClock, Flame, History, Minus, Plus, Target, TrendingUp } from 'lucide-react';
import { ActivityDay, MasterySnapshot, SessionMode, SessionRecord, VocabCard } from '../types';
import { getLocalDateString } from '../utils/storage';
import { getDailyForecast, isLeechCard } from '../utils/srs';

interface ActivitySectionProps {
  activity: ActivityDay[];
  dailyGoal: number;
  onDailyGoalChange: (goal: number) => void;
  cards: VocabCard[];
  deckNameFor: (deckId: string) => string;
  onPracticeMistakes: (cardIds: string[]) => void;
  sessions: SessionRecord[];
  onStartLeechLab: () => void;
  snapshots?: MasterySnapshot[];
  lastBackupAt?: string;
  onExportBackup?: () => void;
}

const HEATMAP_WEEKS = 16;
const GOAL_STEP = 5;
const GOAL_MIN = 5;
const GOAL_MAX = 200;
const MISTAKE_BANK_SIZE = 10;

const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  flashcards: 'Flashcards',
  'true-false': 'True/False',
  'multiple-choice': 'Quiz',
  listening: 'Listening',
  typing: 'Typing',
  'fill-blank': 'Fill Blank',
  speaking: 'Speaking',
};

function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDuration(durationMs: number): string {
  const secs = Math.round(durationMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

/** Lightweight SVG accuracy sparkline over the most recent sessions. */
function AccuracySparkline({ sessions }: { sessions: SessionRecord[] }) {
  const points = useMemo(
    () => [...sessions].slice(0, 10).reverse(),
    [sessions]
  );
  if (points.length < 2) return null;

  const W = 260;
  const H = 56;
  const PAD = 6;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const coords = points.map((s, i) => {
    const acc = s.total > 0 ? s.correct / s.total : 0;
    return {
      x: PAD + i * stepX,
      y: H - PAD - acc * (H - PAD * 2),
      acc,
    };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-14"
      role="img"
      aria-label="Quiz accuracy trend over recent sessions"
      preserveAspectRatio="none"
    >
      <polygon points={area} className="fill-[#B45309]/10 dark:fill-[#D97706]/10" />
      <polyline
        points={line}
        fill="none"
        className="stroke-[#B45309] dark:stroke-[#D97706]"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r="2.5"
          className="fill-[#B45309] dark:fill-[#D97706]"
        />
      ))}
    </svg>
  );
}

function dayActivityValue(day: ActivityDay | undefined): number {
  if (!day) return 0;
  return day.reviews + day.quizzes * 2 + (day.cardsAdded ?? 0);
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
  quizzes: number;
  added: number;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function parseHeatDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatHeatDate(dateStr: string): string {
  return parseHeatDate(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface TooltipState {
  cell: HeatCell;
  x: number;
  y: number;
  below: boolean;
}

const TOOLTIP_W = 190;
const TOOLTIP_H = 64;

function showTooltipFor(
  cell: HeatCell,
  el: HTMLElement,
  setTip: (t: TooltipState | null) => void
) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const x = Math.min(
    Math.max(cx - TOOLTIP_W / 2, 8),
    window.innerWidth - TOOLTIP_W - 8
  );
  const aboveY = rect.top - TOOLTIP_H - 8;
  const below = aboveY < 8;
  const y = below ? rect.bottom + 8 : aboveY;
  setTip({ cell, x, y: Math.max(y, 8), below });
}

/** Memoized GitHub-style contribution grid: month labels + rich tooltips. */
const ActivityHeatmap = memo(function ActivityHeatmap({
  cells,
}: {
  cells: (HeatCell | null)[];
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);

  // Chunk flat day cells into week columns (grid-flow-col already renders
  // column-major, so index w*7..w*7+6 is week w)
  const weeks: (HeatCell | null)[][] = [];
  for (let w = 0; w * 7 < cells.length; w++) {
    weeks.push(cells.slice(w * 7, w * 7 + 7));
  }

  // Month label for each week column: shown when the month's first day
  // appears in (or starts) that column, GitHub-style
  const monthLabels = weeks.map((week) => {
    const firstDay = week.find((c) => c !== null);
    if (!firstDay) return null;
    const d = parseHeatDate(firstDay.date);
    // Label the column containing the 1st of a month, else the column where
    // the month changes vs the previous week
    const hasMonthStart = week.some((c) => {
      if (!c) return false;
      const cd = parseHeatDate(c.date);
      return cd.getDate() === 1;
    });
    if (hasMonthStart) return MONTH_LABELS[d.getMonth()];
    return null;
  });

  // Fallback: if no week got a label (edge case), label the first column
  const anyLabel = monthLabels.some(Boolean);
  if (!anyLabel && weeks.length > 0) {
    const first = weeks[0].find((c) => c !== null);
    if (first) monthLabels[0] = MONTH_LABELS[parseHeatDate(first.date).getMonth()];
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="w-max">
        {/* Month labels aligned to week columns */}
        <div className="flex gap-1 mb-1.5" aria-hidden="true">
          {weeks.map((_, wi) => (
            <div
              key={wi}
              className="w-3 sm:w-3.5 shrink-0 relative h-3.5 overflow-visible"
            >
              {monthLabels[wi] && (
                <span className="absolute left-0 top-0 text-[10px] leading-3.5 font-medium text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
                  {monthLabels[wi]}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-flow-col grid-rows-7 gap-1 w-max">
          {cells.map((cell, idx) =>
            cell ? (
              <div
                key={cell.date}
                tabIndex={0}
                role="img"
                aria-label={`${formatHeatDate(cell.date)}: ${
                  cell.value > 0
                    ? `${cell.reviews} ${cell.reviews === 1 ? 'review' : 'reviews'}${cell.quizzes > 0 ? `, ${cell.quizzes} ${cell.quizzes === 1 ? 'quiz' : 'quizzes'}` : ''}${cell.added > 0 ? `, ${cell.added} new ${cell.added === 1 ? 'word' : 'words'}` : ''}`
                    : 'No practice recorded'
                }`}
                onMouseEnter={(e) => showTooltipFor(cell, e.currentTarget, setTip)}
                onMouseLeave={() => setTip(null)}
                onFocus={(e) => showTooltipFor(cell, e.currentTarget, setTip)}
                onBlur={() => setTip(null)}
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] transition-colors cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] dark:focus-visible:ring-[#D97706] ${LEVEL_CLASSES[intensityLevel(cell.value)]}`}
              />
            ) : (
              <div key={`pad-${idx}`} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )
          )}
        </div>
      </div>

      {/* Floating tooltip — position:fixed escapes the overflow-x-auto clip */}
      {tip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tip.x,
            top: tip.y,
            width: TOOLTIP_W,
            transform: tip.below ? 'translateY(0)' : 'translateY(-100%)',
          }}
        >
          <div className="rounded-lg bg-[#1C1917] dark:bg-[#F5F2EC] text-[#FAF8F5] dark:text-[#1C1917] px-3 py-2 shadow-lg border border-[#2E2A25] dark:border-[#D6D0C6]">
            <div className="text-xs font-semibold tabular-nums">
              {formatHeatDate(tip.cell.date)}
            </div>
            <div className="text-[11px] text-[#D6D0C6] dark:text-[#57534E] mt-0.5 tabular-nums">
              {tip.cell.value > 0 ? (
                <>
                  <span className="font-medium text-[#FAF8F5] dark:text-[#1C1917]">
                    {tip.cell.value}
                  </span>{' '}
                  practice {tip.cell.value === 1 ? 'action' : 'actions'}
                  {tip.cell.reviews > 0 && ` · ${tip.cell.reviews} ${tip.cell.reviews === 1 ? 'review' : 'reviews'}`}
                  {tip.cell.quizzes > 0 && ` · ${tip.cell.quizzes} ${tip.cell.quizzes === 1 ? 'quiz' : 'quizzes'}`}
                  {tip.cell.added > 0 && ` · ${tip.cell.added} new ${tip.cell.added === 1 ? 'word' : 'words'}`}
                </>
              ) : (
                'No practice recorded'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export function ActivitySection({
  activity,
  dailyGoal,
  onDailyGoalChange,
  cards,
  deckNameFor,
  onPracticeMistakes,
  sessions,
  onStartLeechLab,
  snapshots = [],
  lastBackupAt,
  onExportBackup,
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
        quizzes: rec?.quizzes ?? 0,
        added: rec?.cardsAdded ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [activityByDate]);

  const todayKey = getLocalDateString();
  const todayRecord = activityByDate.get(todayKey);
  const todayReviews = todayRecord?.reviews ?? 0;
  const todayAdded = todayRecord?.cardsAdded ?? 0;
  const totalCardsAdded = useMemo(
    () => activity.reduce((sum, d) => sum + (d.cardsAdded ?? 0), 0),
    [activity]
  );
  const goalPct = Math.min(100, Math.round((todayReviews / dailyGoal) * 100));
  const goalReached = todayReviews >= dailyGoal;

  // Weakness Radar: top missed words across the active language
  const mistakeBank = useMemo(() => {
    return cards
      .map((card) => ({
        card,
        misses: Math.max(card.wrongCount ?? 0, card.lapses ?? 0),
      }))
      .filter((entry) => entry.misses > 0 && !entry.card.suspended)
      .sort((a, b) => b.misses - a.misses || a.card.word.localeCompare(b.card.word))
      .slice(0, MISTAKE_BANK_SIZE);
  }, [cards]);

  const leechCount = useMemo(
    () => cards.filter((c) => !c.suspended && isLeechCard(c)).length,
    [cards]
  );

  const recentSessions = sessions.slice(0, 6);

  // 7-day due forecast (calendar-day buckets, index 0 = today)
  const forecast = useMemo(() => getDailyForecast(cards, 7), [cards]);
  const forecastLabels = useMemo(() => {
    const labels: string[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      labels.push(
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tmrw'
            : d.toLocaleDateString(undefined, { weekday: 'short' })
      );
    }
    return labels;
  }, []);

  // Per-deck accuracy — only single-deck sessions can be attributed
  // honestly; multi-deck sessions are excluded rather than double-counted.
  const perDeckAccuracy = useMemo(() => {
    const acc = new Map<string, { total: number; correct: number }>();
    for (const s of sessions) {
      if (s.deckIds.length !== 1 || s.total <= 0) continue;
      const id = s.deckIds[0];
      const cur = acc.get(id) ?? { total: 0, correct: 0 };
      cur.total += s.total;
      cur.correct += s.correct;
      acc.set(id, cur);
    }
    return [...acc.entries()]
      .map(([deckId, v]) => ({
        deckId,
        name: deckNameFor(deckId),
        total: v.total,
        correct: v.correct,
        pct: Math.round((v.correct / v.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [sessions, deckNameFor]);

  // Mastery trend: latest weekly snapshots, oldest → newest
  const masteryTrend = useMemo(
    () => [...snapshots].sort((a, b) => a.weekKey.localeCompare(b.weekKey)).slice(-8),
    [snapshots]
  );

  // Stale-backup reminder (>14 days)
  const backupStaleDays = useMemo(() => {
    if (!lastBackupAt) return null;
    const days = Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86400000);
    return Number.isFinite(days) && days >= 14 ? days : null;
  }, [lastBackupAt]);

  const adjustGoal = (delta: number) => {
    onDailyGoalChange(
      Math.min(GOAL_MAX, Math.max(GOAL_MIN, dailyGoal + delta))
    );
  };

  return (
    <div className="space-y-6">
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

        <ActivityHeatmap cells={heatmapCells} />

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
            {todayAdded > 0 && (
              <span className="text-emerald-700 dark:text-emerald-400">
                {' '}
                · +{todayAdded} new {todayAdded === 1 ? 'word' : 'words'} today
              </span>
            )}
          </p>
          {totalCardsAdded > 0 && (
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              <span className="font-semibold text-[#1C1917] dark:text-[#F5F2EC] tabular-nums">
                {totalCardsAdded}
              </span>{' '}
              new {totalCardsAdded === 1 ? 'word' : 'words'} added all-time
            </p>
          )}
        </div>

        {/* 7-day review forecast */}
        <div className="pt-4 border-t border-slate-200 dark:border-[#2E2A25] space-y-2.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
            <span className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
              Upcoming Reviews
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {forecast.map((count, i) => (
              <div
                key={forecastLabels[i]}
                className="rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200/70 dark:border-[#2E2A25] px-1 py-2 text-center"
              >
                <div className="text-[10px] font-medium text-[#78716C] dark:text-[#A8A29E] truncate">
                  {forecastLabels[i]}
                </div>
                <div
                  className={`font-mono text-sm font-semibold tabular-nums mt-0.5 ${
                    count > 0
                      ? 'text-[#B45309] dark:text-[#F59E0B]'
                      : 'text-[#A8A29E] dark:text-[#57534E]'
                  }`}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>

          {/* Stale-backup nudge — subtle, only when backups are old */}
          {backupStaleDays !== null && onExportBackup && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <span>
                Last backup {backupStaleDays === 0 ? 'today' : `${backupStaleDays}d`} ago —
                your data lives only in this browser.
              </span>
              <button
                type="button"
                onClick={onExportBackup}
                className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-300 transition-colors"
              >
                Export now
              </button>
            </p>
          )}
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
            {leechCount > 0 && (
              <button
                type="button"
                onClick={onStartLeechLab}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
              >
                <Bug className="w-4 h-4" />
                Leech Lab ({leechCount})
              </button>
            )}
          </>
        )}
      </div>
    </section>

    {/* Weekly mastery trend — snapshots are captured once per ISO week */}
    {masteryTrend.length > 0 && (
      <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Mastery Trend
            </h3>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              Share of words at Leitner box 4+ — captured weekly
            </p>
          </div>
          <TrendingUp className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E] shrink-0" />
        </div>
        <div className="flex items-end gap-2 h-24">
          {masteryTrend.map((snap) => (
            <div
              key={snap.id}
              className="flex-1 flex flex-col items-center gap-1 min-w-0"
              title={`${snap.weekKey}: ${snap.masteryPct}% mastery (${snap.mastered}/${snap.total} mastered)`}
            >
              <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                {snap.masteryPct}%
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md bg-[#B45309]/80 dark:bg-[#D97706]/80 transition-all duration-500"
                  style={{ height: `${Math.max(4, snap.masteryPct)}%` }}
                />
              </div>
              <span className="text-[10px] text-[#A8A29E] dark:text-[#57534E] truncate w-full text-center">
                {snap.weekKey.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Session History & Accuracy Trend */}
    <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            Session History
          </h3>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
            Completed study sessions and accuracy trend
          </p>
        </div>
        <History className="w-4 h-4 text-[#78716C] dark:text-[#A8A29E] shrink-0" />
      </div>

      {sessions.length === 0 ? (
        <p className="text-xs text-[#78716C] dark:text-[#A8A29E] py-4 text-center">
          No sessions completed yet — finish a quiz or flashcard round to start
          tracking accuracy.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
              Accuracy — last {Math.min(sessions.length, 10)} sessions
            </div>
            <AccuracySparkline sessions={sessions} />
            <div className="flex items-center justify-between text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
              <span>Older</span>
              <span>
                {(() => {
                  const recent = sessions.slice(0, Math.min(sessions.length, 10));
                  const avg =
                    recent.reduce(
                      (sum, s) => sum + (s.total > 0 ? s.correct / s.total : 0),
                      0
                    ) / recent.length;
                  return `${Math.round(avg * 100)}% avg`;
                })()}
              </span>
              <span>Recent</span>
            </div>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-[#2E2A25] -mx-2">
            {recentSessions.map((s) => {
              const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-2 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] truncate">
                      {SESSION_MODE_LABELS[s.mode] ?? s.mode}
                    </div>
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] truncate">
                      {s.deckNames.length > 0
                        ? s.deckNames.slice(0, 2).join(', ') +
                          (s.deckNames.length > 2 ? ` +${s.deckNames.length - 2}` : '')
                        : 'All decks'}
                      {' · '}
                      {formatSessionTime(s.completedAt)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`font-mono text-sm font-semibold tabular-nums ${
                        acc >= 80
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : acc >= 50
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {acc}%
                    </div>
                    <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                      {s.correct}/{s.total} · {formatDuration(s.durationMs)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Per-deck accuracy — single-deck sessions only (honest attribution) */}
      {perDeckAccuracy.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-[#2E2A25] space-y-2.5">
          <div className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
            Accuracy by deck
            <span className="font-normal"> — single-deck sessions</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
            {perDeckAccuracy.map((d) => (
              <li
                key={d.deckId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-[#1C1917] dark:text-[#F5F2EC] truncate">
                  {d.name}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                  <span
                    className={`font-semibold ${
                      d.pct >= 80
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : d.pct >= 50
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {d.pct}%
                  </span>{' '}
                  · {d.correct}/{d.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    </div>
  );
}
