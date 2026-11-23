import { useMemo } from 'react';
import { Check, Circle, X } from 'lucide-react';
import { Deck, StudyStats, VocabCard } from '../types';
import { t } from '../i18n';

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
      { label: t('Create a deck for this language'), done: decks.length > 0, hint: t('Use the deck selector in Words to add one') },
      { label: t('Add your first words'), done: cards.length > 0, hint: t('Press "+ New Word" or bulk-import a list') },
      { label: t('Complete a study session'), done: hasSession, hint: t('Start a quiz or flashcard round from Quiz') },
      { label: t('Check your progress'), done: false, hint: t('Stats, forecast and session history live under Statistics') },
    ];
  }, [decks.length, cards.length, stats]);

  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount >= steps.length - 1) return null;

  return (
    <div className="px-5 py-4 rounded-2xl bg-white dark:bg-[#1C1A17] border border-[#B45309]/30 dark:border-[#D97706]/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            {t('Get started')}
          </div>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5 tabular-nums">
            {doneCount} of {steps.length - 1} setup steps complete
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('Dismiss getting started checklist')}
          className="p-1.5 -m-1 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar — animates width smoothly as steps complete */}
      <div
        className="mt-3 h-1 rounded-full bg-[#F3EFE8] dark:bg-[#25221E] overflow-hidden"
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length - 1}
        aria-label={t('Getting started progress')}
      >
        <div
          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-[width] duration-500 ease-out"
          style={{ width: `${(doneCount / (steps.length - 1)) * 100}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {steps.map((step, i) => (
          <li
            key={i}
            className={`flex items-start gap-2.5 text-sm rounded-lg px-2 py-1.5 -mx-2 ${
              step.done ? 'animate-step-glow' : ''
            }`}
          >
            {step.done ? (
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400 animate-check-pop" />
            ) : (
              <Circle className="w-4 h-4 mt-0.5 shrink-0 text-[#C4BEB4] dark:text-[#443E37]" />
            )}
            <span
              className={`transition-colors duration-500 ${
                step.done
                  ? 'text-[#78716C] dark:text-[#A8A29E]'
                  : 'text-[#1C1917] dark:text-[#F5F2EC]'
              }`}
            >
              <span className="relative">
                {t(step.label)}
                {/* Animated strikethrough — scales in when the step completes */}
                <span
                  aria-hidden="true"
                  className={`onboarding-strike absolute left-0 top-[0.58em] h-px w-full bg-current origin-left transition-transform duration-500 ease-out ${
                    step.done ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </span>
              {!step.done && (
                <span className="block text-[11px] text-[#78716C] dark:text-[#A8A29E]">{t(step.hint)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
