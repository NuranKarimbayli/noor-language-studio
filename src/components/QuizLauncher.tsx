import {
  Bug,
  CalendarClock,
  Headphones,
  Keyboard,
  Layers,
  ListChecks,
  Mic,
  PenLine,
  ToggleLeft,
  Zap,
} from 'lucide-react';
import { SessionMode } from '../types';
import { SPEAKING_PRACTICE_ENABLED } from './QuizSetupModal';

interface QuizLauncherProps {
  hasCards: boolean;
  dueCount: number;
  leechCount: number;
  voiceReady: boolean;
  onSmartReview: () => void;
  onDueReview: () => void;
  onLeechLab: () => void;
  onOpenSetup: (mode: SessionMode) => void;
}

const MODE_CARDS: Array<{
  mode: SessionMode;
  label: string;
  description: string;
  icon: typeof Layers;
}> = [
  { mode: 'flashcards', label: 'Flashcards', description: 'Flip through cards and self-grade', icon: Layers },
  { mode: 'multiple-choice', label: 'Multiple Choice', description: 'Pick the correct translation', icon: ListChecks },
  { mode: 'true-false', label: 'True / False', description: 'Judge if the pair matches', icon: ToggleLeft },
  { mode: 'listening', label: 'Listening', description: 'Hear the word, choose the meaning', icon: Headphones },
  { mode: 'typing', label: 'Typing', description: 'Type the translation from memory', icon: Keyboard },
  { mode: 'fill-blank', label: 'Fill in the Blank', description: 'Complete the example sentence', icon: PenLine },
  { mode: 'speaking', label: 'Speaking', description: 'Say the word out loud', icon: Mic },
];

export function QuizLauncher({
  hasCards,
  dueCount,
  leechCount,
  voiceReady,
  onSmartReview,
  onDueReview,
  onLeechLab,
  onOpenSetup,
}: QuizLauncherProps) {
  return (
    <div className="space-y-6">
      {/* Guided sessions */}
      <section className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            Guided Sessions
          </h3>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
            Let the scheduler pick your next cards
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={onSmartReview}
            disabled={!hasCards}
            className="text-left px-4 py-3.5 rounded-xl border border-[#B45309]/40 dark:border-[#D97706]/40 bg-[#B45309]/5 dark:bg-[#D97706]/10 hover:bg-[#B45309]/10 dark:hover:bg-[#D97706]/15 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              <Zap className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" />
              Smart Review
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
              Weak words first, then what's due
            </p>
          </button>

          <button
            type="button"
            onClick={onDueReview}
            disabled={dueCount === 0}
            className="text-left px-4 py-3.5 rounded-xl border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] hover:border-amber-400 dark:hover:border-amber-700 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Due Today
              {dueCount > 0 && (
                <span className="ml-auto font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {dueCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
              {dueCount > 0 ? 'Cards scheduled for review now' : 'Nothing due right now'}
            </p>
          </button>

          <button
            type="button"
            onClick={onLeechLab}
            disabled={leechCount === 0}
            className="text-left px-4 py-3.5 rounded-xl border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] hover:border-amber-400 dark:hover:border-amber-700 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              <Bug className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Leech Lab
              {leechCount > 0 && (
                <span className="ml-auto font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {leechCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
              {leechCount > 0 ? 'Targeted practice for problem words' : 'No leech cards'}
            </p>
          </button>
        </div>
      </section>

      {/* Mode picker */}
      <section className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            Practice Modes
          </h3>
          <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
            Choose a format, then pick decks and question count
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODE_CARDS.map(({ mode, label, description, icon: Icon }) => {
            const isSpeakingLocked = mode === 'speaking' && !SPEAKING_PRACTICE_ENABLED;
            const isListeningBlocked = mode === 'listening' && !voiceReady;
            const disabled = isSpeakingLocked || isListeningBlocked || !hasCards;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onOpenSetup(mode)}
                disabled={disabled}
                title={
                  isSpeakingLocked
                    ? 'Coming soon'
                    : isListeningBlocked
                      ? 'Requires a supported browser voice for this language'
                      : undefined
                }
                className="text-left px-4 py-3.5 rounded-xl border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] hover:border-[#B45309] dark:hover:border-[#D97706] hover:bg-white dark:hover:bg-[#1C1A17] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
                  <span className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                    {label}
                  </span>
                  {isSpeakingLocked && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#2E2A25] text-[#57534E] dark:text-[#A8A29E]">
                      Soon
                    </span>
                  )}
                  {isListeningBlocked && !isSpeakingLocked && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#2E2A25] text-[#57534E] dark:text-[#A8A29E]">
                      No voice
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                  {isSpeakingLocked
                    ? 'Speech recognition practice is coming soon.'
                    : isListeningBlocked
                      ? 'Enable a compatible voice in Settings to use this mode.'
                      : description}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
