import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCheck,
  Clock,
  Headphones,
  Keyboard,
  ListChecks,
  Mic,
  Play,
  TextCursorInput,
  X,
} from 'lucide-react';
import {
  Deck,
  DifficultyLevel,
  SessionConfig,
  SessionMode,
  StudyDirection,
  VocabCard,
} from '../types';
import { Modal } from './Modal';
import { createBlankedSentence } from '../utils/textUtils';
import { getCardDifficulty } from '../utils/storage';
import { isCardDue, isLeechCard } from '../utils/srs';
import { isSpeechRecognitionSupported, isVoiceSupported, useBrowserVoices, VoiceSelection } from '../utils/speechUtils';
import { t } from '../i18n';

interface QuizSetupModalProps {
  open: boolean;
  languageName: string;
  languageCode: string;
  voice?: VoiceSelection | null;
  decks: Deck[];
  cards: VocabCard[];
  initialDeckId?: string;
  initialMode?: SessionMode;
  defaultTimerSeconds?: number;
  onClose: () => void;
  onStartSession: (config: SessionConfig) => void;
}

const DIFFICULTY_OPTIONS: Array<{ id: DifficultyLevel; label: string }> = [
  { id: 'easy', label: t('Easy') },
  { id: 'medium', label: t('Medium') },
  { id: 'hard', label: t('Hard') },
];

const MODE_OPTIONS: Array<{
  id: SessionMode;
  title: string;
  desc: string;
  icon: typeof BookOpen;
}> = [
  {
    id: 'flashcards',
    title: t('Flashcards'),
    desc: t('3D flip cards with Hard, Good, and Easy self-rating.'),
    icon: BookOpen,
  },
  {
    id: 'true-false',
    title: t('True / False'),
    desc: t('Quickly verify whether a word and translation match.'),
    icon: CheckCheck,
  },
  {
    id: 'multiple-choice',
    title: t('Multiple Choice'),
    desc: t('Pick the right answer from 4 dynamic options.'),
    icon: ListChecks,
  },
  {
    id: 'listening',
    title: t('Listening Quiz'),
    desc: t('Hear the word aloud, then choose its meaning.'),
    icon: Headphones,
  },
  {
    id: 'typing',
    title: t('Written / Typing'),
    desc: t('Type translations manually with 1-char typo tolerance.'),
    icon: Keyboard,
  },
  {
    id: 'fill-blank',
    title: t('Fill-in-the-blanks'),
    desc: t('Complete missing words inside example sentences.'),
    icon: TextCursorInput,
  },
  {
    id: 'speaking',
    title: t('Speaking Practice'),
    desc: t('Hear the meaning, then say the word aloud. Chrome/Edge only.'),
    icon: Mic,
  },
];

// Speaking practice is feature-flagged off until it ships — the engine code
// remains in place but the mode is never selectable.
export const SPEAKING_PRACTICE_ENABLED = false;

export function QuizSetupModal({
  open,
  languageName,
  languageCode,
  voice,
  decks,
  cards,
  initialDeckId,
  initialMode = 'multiple-choice',
  defaultTimerSeconds = 0,
  onClose,
  onStartSession,
}: QuizSetupModalProps) {
  const [mode, setMode] = useState<SessionMode>(initialMode);
  const [direction, setDirection] = useState<StudyDirection>('word-to-translation');
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  // Empty selection = all difficulties
  const [difficulties, setDifficulties] = useState<DifficultyLevel[]>([]);
  const [sameDeckOptions, setSameDeckOptions] = useState<boolean>(true);
  const [dueOnly, setDueOnly] = useState<boolean>(false);
  const [leechFilter, setLeechFilter] = useState<'all' | 'exclude' | 'only'>('all');

  const browserVoices = useBrowserVoices();
  const voiceSupported = isVoiceSupported(languageCode, voice, browserVoices);
  const recognitionSupported = isSpeechRecognitionSupported();

  // Listening quiz is impossible without a native voice — fall back safely
  useEffect(() => {
    if (open && mode === 'listening' && !voiceSupported) {
      setMode('multiple-choice');
    }
  }, [open, mode, voiceSupported]);

  // Speaking practice is disabled app-wide (coming soon) — never selectable
  useEffect(() => {
    if (open && mode === 'speaking') {
      setMode('multiple-choice');
    }
  }, [open, mode]);

  // Sync defaults whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setDirection('word-to-translation');
    if (initialDeckId && decks.some((d) => d.id === initialDeckId)) {
      setSelectedDeckIds([initialDeckId]);
    } else if (decks.length > 0) {
      setSelectedDeckIds(decks.map((d) => d.id));
    } else {
      setSelectedDeckIds([]);
    }
    setSameDeckOptions(true);
    setDueOnly(false);
    setLeechFilter('all');
    setTimerSeconds(defaultTimerSeconds);
  }, [open, initialDeckId, initialMode, decks, defaultTimerSeconds]);

  const selectedDeckIdSet = useMemo(
    () => new Set(selectedDeckIds),
    [selectedDeckIds]
  );

  const selectedCards = useMemo(
    () =>
      cards.filter(
        (c) => selectedDeckIdSet.has(c.deckId) && !c.suspended
      ),
    [cards, selectedDeckIdSet]
  );

  // Per-deck card counts in one pass — filtering `cards` per deck row was
  // O(decks × cards) on every render.
  const cardCountByDeckId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) {
      counts.set(c.deckId, (counts.get(c.deckId) ?? 0) + 1);
    }
    return counts;
  }, [cards]);

  const difficultyFilteredCards = useMemo(
    () =>
      difficulties.length === 0
        ? selectedCards
        : selectedCards.filter((c) => difficulties.includes(getCardDifficulty(c))),
    [selectedCards, difficulties]
  );

  const dueFilteredCards = useMemo(
    () =>
      dueOnly
        ? difficultyFilteredCards.filter((c) => isCardDue(c))
        : difficultyFilteredCards,
    [difficultyFilteredCards, dueOnly]
  );

  const leechCount = useMemo(
    () => dueFilteredCards.filter(isLeechCard).length,
    [dueFilteredCards]
  );

  const filteredCards = useMemo(() => {
    if (leechFilter === 'exclude') {
      return dueFilteredCards.filter((c) => !isLeechCard(c));
    }
    if (leechFilter === 'only') {
      return dueFilteredCards.filter(isLeechCard);
    }
    return dueFilteredCards;
  }, [dueFilteredCards, leechFilter]);

  const blankEligibleCards = useMemo(
    () =>
      filteredCards.filter(
        (c) => c.exampleSentence && createBlankedSentence(c.exampleSentence, c.word) !== null
      ),
    [filteredCards]
  );

  const maxEligibleCount =
    mode === 'fill-blank' ? blankEligibleCards.length : filteredCards.length;

  useEffect(() => {
    if (maxEligibleCount > 0 && questionCount > maxEligibleCount) {
      setQuestionCount(maxEligibleCount);
    } else if (maxEligibleCount > 0 && questionCount < 1) {
      setQuestionCount(Math.min(10, maxEligibleCount));
    }
  }, [maxEligibleCount, questionCount]);

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds((prev) =>
      prev.includes(deckId) ? prev.filter((id) => id !== deckId) : [...prev, deckId]
    );
  };

  const effectiveCount =
    maxEligibleCount === 0 ? 0 : Math.min(questionCount, maxEligibleCount);

  // Rough duration estimate for session planning
  const estimatedLabel = useMemo(() => {
    if (effectiveCount === 0) return null;
    const perItem =
      mode === 'flashcards'
        ? 12
        : mode === 'speaking'
          ? 10
          : timerSeconds > 0
            ? timerSeconds + 4
            : mode === 'typing' || mode === 'fill-blank'
              ? 14
              : 8;
    const total = effectiveCount * perItem;
    return total >= 90
      ? `~${Math.round(total / 60)} min`
      : `~${Math.round(total / 5) * 5}s`;
  }, [effectiveCount, mode, timerSeconds]);

  const handleLaunch = () => {
    if (effectiveCount === 0) return;
    onStartSession({
      mode,
      deckIds: selectedDeckIds,
      direction,
      questionCount: effectiveCount,
      timerSeconds: mode === 'flashcards' ? 0 : timerSeconds,
      difficultyFilter: difficulties.length > 0 ? difficulties : undefined,
      isolateDistractorsByDeck: sameDeckOptions,
      dueOnly: dueOnly || undefined,
      leechFilter: leechFilter === 'all' ? undefined : leechFilter,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={t('Study and Quiz Setup')}
      panelClassName="max-w-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]"
    >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2E2A25]">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Start {languageName} Session
            </h2>
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
              {t('Choose a study or testing mode and customize your decks below.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close setup modal')}
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Visual Mode Selector */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
            {t('1. Mode')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = mode === opt.id;
              const optionDisabled =
                (opt.id === 'listening' && !voiceSupported) ||
                (opt.id === 'speaking' &&
                  (!SPEAKING_PRACTICE_ENABLED || !recognitionSupported));
              const disabledHint =
                opt.id === 'listening' && !voiceSupported
                  ? t('Listening quiz requires a supported browser voice for this language.')
                  : opt.id === 'speaking' && !SPEAKING_PRACTICE_ENABLED
                    ? t('Speaking Practice is coming soon.')
                    : opt.id === 'speaking' && !recognitionSupported
                      ? t('Speaking practice requires Chrome or Edge (speech recognition).')
                      : undefined;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={optionDisabled}
                  title={disabledHint}
                  onClick={() => setMode(opt.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-2 ${
                    optionDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    active
                      ? 'border-[#B45309] dark:border-[#D97706] bg-[#FAF8F5] dark:bg-[#25221E] shadow-sm'
                      : 'border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] hover:border-slate-300 dark:hover:border-[#443E37]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active
                          ? 'text-[#B45309] dark:text-[#F59E0B]'
                          : 'text-[#78716C] dark:text-[#A8A29E]'
                      }`}
                    />
                    <span className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                      {t(opt.title)}
                    </span>
                  </div>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                    {t(opt.desc)}
                    {opt.id === 'fill-blank' && (
                      <span className="block mt-1 font-mono text-[11px] text-[#B45309] dark:text-[#F59E0B] tabular-nums">
                        {blankEligibleCards.length} eligible sentences
                      </span>
                    )}
                    {opt.id === 'speaking' && !SPEAKING_PRACTICE_ENABLED && (
                      <span className="block mt-1 text-[11px] font-semibold text-[#B45309] dark:text-[#F59E0B]">
                        {t('Coming soon')}
                      </span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
          {!voiceSupported && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('Listening quiz requires a supported browser voice for this language. Speaker buttons are disabled for {name}.', { name: languageName })}
            </p>
          )}
          {!recognitionSupported && SPEAKING_PRACTICE_ENABLED && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('Speaking Practice is unavailable — it needs Chrome or Edge with microphone speech recognition.')}
            </p>
          )}
        </div>

        {/* 2. Deck Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              {t('2. Decks')}
            </span>
            <div className="flex items-center gap-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedDeckIds(decks.map((d) => d.id))}
                className="text-[#B45309] dark:text-[#F59E0B] hover:underline"
              >
                {t('Select All')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDeckIds([])}
                className="text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
              >
                {t('Clear')}
              </button>
            </div>
          </div>

          {decks.length === 0 ? (
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">
              No decks in {languageName} yet. Add words first.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 dark:divide-[#2E2A25] border border-slate-200 dark:border-[#2E2A25] rounded-xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-[#443E37]">
              {decks.map((deck) => {
                const count = cardCountByDeckId.get(deck.id) ?? 0;
                const checked = selectedDeckIdSet.has(deck.id);
                return (
                  <label
                    key={deck.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer text-sm ${
                      checked
                        ? 'bg-[#FAF8F5] dark:bg-[#25221E]'
                        : 'bg-white dark:bg-[#1C1A17]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDeck(deck.id)}
                        className="w-4 h-4 accent-[#B45309] rounded shrink-0"
                      />
                      <span className="truncate font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                        {deck.name}
                      </span>
                    </span>
                    <span className="text-xs font-mono text-[#78716C] dark:text-[#A8A29E] tabular-nums shrink-0">
                      {count}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Direction: recognition (word → meaning) vs production recall
            (meaning → word). Mixed alternates per question for balanced practice. */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
            {t('Direction')}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'word-to-translation', label: t('Word → Meaning') },
                { id: 'translation-to-word', label: t('Meaning → Word') },
                { id: 'random', label: t('Mixed') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDirection(opt.id)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                  direction === opt.id
                    ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
                    : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
                }`}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
            {t('Meaning → Word tests production recall — the harder, higher-value direction. Mixed alternates both.')}
          </p>
        </div>

        {/* 3. Difficulty Filter */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              {t('3. Difficulty')}
            </span>
            <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              {difficulties.length === 0
                ? t('All difficulties')
                : `${difficultyFilteredCards.length} matching words`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDifficulties([])}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                difficulties.length === 0
                  ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
                  : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
              }`}
            >
              {t('All')}
            </button>
            {DIFFICULTY_OPTIONS.map((opt) => {
              const active = difficulties.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setDifficulties((prev) =>
                      prev.includes(opt.id)
                        ? prev.filter((d) => d !== opt.id)
                        : [...prev, opt.id]
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                    active
                      ? opt.id === 'easy'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                        : opt.id === 'medium'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                          : 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200'
                      : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
                  }`}
                >
                  {t(opt.label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Question Count & Timer */}
        <div className="space-y-5 pt-1">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                  {t('4. Count')}
                </span>
                <span className="font-mono font-semibold text-[#B45309] dark:text-[#F59E0B] tabular-nums">
                  {effectiveCount} / {maxEligibleCount}
                  {estimatedLabel && (
                    <span className="ml-1.5 text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E]">
                      {estimatedLabel}
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(1, maxEligibleCount)}
                disabled={maxEligibleCount === 0}
                value={Math.max(1, effectiveCount)}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="noor-range w-full disabled:opacity-40"
                style={
                  {
                    '--range-pct': `${
                      maxEligibleCount > 1
                        ? ((Math.max(1, effectiveCount) - 1) / (maxEligibleCount - 1)) * 100
                        : 0
                    }%`,
                  } as CSSProperties
                }
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[5, 10, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={maxEligibleCount < 1}
                    onClick={() => setQuestionCount(Math.min(preset, maxEligibleCount))}
                    className="px-2 py-1 text-xs font-mono rounded-md bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309] disabled:opacity-40"
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={maxEligibleCount < 1}
                  onClick={() => setQuestionCount(maxEligibleCount)}
                  className="px-2 py-1 text-xs font-medium rounded-md bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309] disabled:opacity-40"
                >
                  {t('All')}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                <Clock className="w-3.5 h-3.5" />
                <span>{t('5. Timer')}</span>
              </div>
              {mode === 'flashcards' ? (
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                  {t('Flashcards are self-paced.')}
                </p>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 10, 15, 20, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setTimerSeconds(sec)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                        timerSeconds === sec
                          ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
                          : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E]'
                      }`}
                    >
                      {sec === 0 ? t('Off') : `${sec}s`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(mode === 'multiple-choice' ||
              mode === 'true-false' ||
              mode === 'listening') && (
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameDeckOptions}
                  onChange={(e) => setSameDeckOptions(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#B45309] rounded shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                    {t('Same-Deck Options Only')}
                  </span>
                  <span className="block text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed mt-0.5">
                    {t('Incorrect options are drawn from the same deck as the question whenever possible, keeping distractors contextually relevant.')}
                  </span>
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] cursor-pointer">
              <input
                type="checkbox"
                checked={dueOnly}
                onChange={(e) => setDueOnly(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#B45309] rounded shrink-0"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                  <CalendarClock className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" />
                  {t('Due Reviews Only')}
                </span>
                <span className="block text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed mt-0.5">
                  {t('Restrict this session to cards whose spaced-repetition review is due now. Turn off for full-deck practice.')}
                </span>
              </span>
            </label>

            {leechCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    {t('Leech cards')}
                  </span>
                  <span className="text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                    {leechCount} stubborn {leechCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'all', label: t('All') },
                      { id: 'exclude', label: t('Exclude') },
                      { id: 'only', label: t('Only leeches') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLeechFilter(opt.id)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        leechFilter === opt.id
                          ? 'border-[#B45309] dark:border-[#D97706] bg-[#B45309] text-white'
                          : 'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:border-[#B45309]'
                      }`}
                    >
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                  Leech words are repeatedly missed (3+ lapses or 5+ wrong
                  answers). Exclude them to keep momentum, or study only them for
                  targeted review.
                </p>
              </div>
            )}
          </div>
        </div>

        {maxEligibleCount === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {selectedDeckIds.length === 0
                ? t('Select at least one deck to begin.')
                : mode === 'fill-blank'
                  ? t('Selected decks have no example sentences containing the target word.')
                  : t('Selected decks contain no words yet.')}
            </span>
          </div>
        )}

        {/* Footer Launch */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-[#2E2A25]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            disabled={effectiveCount === 0}
            onClick={handleLaunch}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Play className="w-4 h-4" />
            {mode === 'flashcards'
              ? `Start Flashcards (${effectiveCount})`
              : `Start Quiz (${effectiveCount})`}
          </button>
        </div>
    </Modal>
  );
}
