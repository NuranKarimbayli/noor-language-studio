import { useMemo } from 'react';
import { Bug, Flame, History, Minus, Plus, Target, TrendingUp } from 'lucide-react';
import { ActivityDay, SessionMode, SessionRecord, VocabCard } from '../types';
import { getLocalDateString } from '../utils/storage';
import { isLeechCard } from '../utils/srs';

interface ActivitySectionProps {
  activity: ActivityDay[];
  dailyGoal: number;
  onDailyGoalChange: (goal: number) => void;
  cards: VocabCard[];
  deckNameFor: (deckId: string) => string;
  onPracticeMistakes: (cardIds: string[]) => void;
  sessions: SessionRecord[];
  onStartLeechLab: () => void;
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
  sessions,
  onStartLeechLab,
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

  const leechCount = useMemo(() => cards.filter(isLeechCard).length, [cards]);

  const recentSessions = sessions.slice(0, 6);

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
    </div>
    </div>
  );
}
