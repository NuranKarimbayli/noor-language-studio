import { useMemo } from 'react';
import { Check, Circle, X } from 'lucide-react';
import { Deck, StudyStats, VocabCard } from '../types';

interface OnboardingChecklistProps {
  decks: Deck[];
  cards: VocabCard[];
  stats: StudyStats;
  dismissed: boolean;
  onDismiss: () => void;
}

/**
 * First-run checklist shown at the top of the workspace. Auto-completes as
 * the learner hits each milestone and disappears once dismissed or finished.
 */
export function OnboardingChecklist({
  decks,
  cards,
  stats,
  dismissed,
  onDismiss,
}: OnboardingChecklistProps) {
  const steps = useMemo(() => {
    const hasSession =
      stats.totalQuizAnswered > 0 || stats.streakDays > 0 || stats.totalQuizCorrect > 0;
    return [
      { label: 'Create a deck for this language', done: decks.length > 0, hint: 'Use the deck selector in Words to add one' },
      { label: 'Add your first words', done: cards.length > 0, hint: 'Press "+ New Word" or bulk-import a list' },
      { label: 'Complete a study session', done: hasSession, hint: 'Start a quiz or flashcard round from Quiz' },
      { label: 'Check your progress', done: false, hint: 'Stats, forecast and session history live under Statistics' },
    ];
  }, [decks.length, cards.length, stats]);

  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount >= steps.length - 1) return null;

  return (
    <div className="px-5 py-4 rounded-2xl bg-white dark:bg-[#1C1A17] border border-[#B45309]/30 dark:border-[#D97706]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            Get started
          </div>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
            {doneCount} of {steps.length - 1} setup steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss getting started checklist"
          className="p-1.5 -m-1 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {step.done ? (
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="w-4 h-4 mt-0.5 shrink-0 text-[#C4BEB4] dark:text-[#443E37]" />
            )}
            <span className={step.done ? 'text-[#78716C] dark:text-[#A8A29E] line-through' : 'text-[#1C1917] dark:text-[#F5F2EC]'}>
              {step.label}
              {!step.done && (
                <span className="block text-[11px] text-[#78716C] dark:text-[#A8A29E]">{step.hint}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
