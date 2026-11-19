import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarClock,
  CheckCheck,
  Clock,
  Headphones,
  Keyboard,
  ListChecks,
  Play,
  TextCursorInput,
  X,
} from 'lucide-react';
import {
  Deck,
  DifficultyLevel,
  SessionConfig,
  SessionMode,
  VocabCard,
} from '../types';
import { Modal } from './Modal';
import { createBlankedSentence } from '../utils/textUtils';
import { getCardDifficulty } from '../utils/storage';
import { isCardDue, isLeechCard } from '../utils/srs';
import { isVoiceSupported, useBrowserVoices, VoiceSelection } from '../utils/speechUtils';

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
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const MODE_OPTIONS: Array<{
  id: SessionMode;
  title: string;
  desc: string;
  icon: typeof BookOpen;
}> = [
  {
    id: 'flashcards',
    title: 'Flashcards',
    desc: '3D flip cards with Hard, Good, and Easy self-rating.',
    icon: BookOpen,
  },
  {
    id: 'true-false',
    title: 'True / False',
    desc: 'Quickly verify whether a word and translation match.',
    icon: CheckCheck,
  },
  {
    id: 'multiple-choice',
    title: 'Multiple Choice',
    desc: 'Pick the right answer from 4 dynamic options.',
    icon: ListChecks,
  },
  {
    id: 'listening',
    title: 'Listening Quiz',
    desc: 'Hear the word aloud, then choose its meaning.',
    icon: Headphones,
  },
  {
    id: 'typing',
    title: 'Written / Typing',
    desc: 'Type translations manually with 1-char typo tolerance.',
    icon: Keyboard,
  },
  {
    id: 'fill-blank',
    title: 'Fill-in-the-blanks',
    desc: 'Complete missing words inside example sentences.',
    icon: TextCursorInput,
  },
];

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

  // Listening quiz is impossible without a native voice — fall back safely
  useEffect(() => {
    if (open && mode === 'listening' && !voiceSupported) {
      setMode('multiple-choice');
    }
  }, [open, mode, voiceSupported]);

  // Sync defaults whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const selectedCards = useMemo(
    () => cards.filter((c) => selectedDeckIds.includes(c.deckId)),
    [cards, selectedDeckIds]
  );

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

  const handleLaunch = () => {
    if (effectiveCount === 0) return;
    onStartSession({
      mode,
      deckIds: selectedDeckIds,
      // Strict anchoring: always prompt with the target word, answer with the translation
      direction: 'word-to-translation',
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
      ariaLabel="Study and Quiz Setup"
      panelClassName="max-w-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto space-y-6"
    >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2E2A25]">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Start {languageName} Session
            </h2>
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
              Choose a study or testing mode and customize your decks below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup modal"
            className="p-1.5 rounded-lg text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Visual Mode Selector */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
            1. Mode
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = mode === opt.id;
              const optionDisabled = opt.id === 'listening' && !voiceSupported;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={optionDisabled}
                  title={
                    optionDisabled
                      ? 'Listening quiz requires a supported browser voice for this language.'
                      : undefined
                  }
                  onClick={() => setMode(opt.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                    optionDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    active
                      ? 'border-[#B45309] dark:border-[#D97706] bg-[#FAF8F5] dark:bg-[#25221E]'
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
                      {opt.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                    {opt.desc}
                    {opt.id === 'fill-blank' && (
                      <span className="block mt-1 font-mono text-[11px] text-[#B45309] dark:text-[#F59E0B] tabular-nums">
                        {blankEligibleCards.length} eligible sentences
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
              Listening quiz requires a supported browser voice for this
              language. Speaker buttons are disabled for {languageName}.
            </p>
          )}
        </div>

        {/* 2. Deck Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              2. Decks
            </span>
            <div className="flex items-center gap-3 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedDeckIds(decks.map((d) => d.id))}
                className="text-[#B45309] dark:text-[#F59E0B] hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedDeckIds([])}
                className="text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
              >
                Clear
              </button>
            </div>
          </div>

          {decks.length === 0 ? (
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">
              No decks in {languageName} yet. Add words first.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 dark:divide-[#2E2A25] border border-slate-200 dark:border-[#2E2A25] rounded-xl">
              {decks.map((deck) => {
                const count = cards.filter((c) => c.deckId === deck.id).length;
                const checked = selectedDeckIds.includes(deck.id);
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

        {/* 3. Difficulty Filter */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
              3. Difficulty
            </span>
            <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              {difficulties.length === 0
                ? 'All difficulties'
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
              All
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
                  {opt.label}
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
                  4. Count
                </span>
                <span className="font-mono font-semibold text-[#B45309] dark:text-[#F59E0B] tabular-nums">
                  {effectiveCount} / {maxEligibleCount}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={Math.max(1, maxEligibleCount)}
                disabled={maxEligibleCount === 0}
                value={Math.max(1, effectiveCount)}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-[#B45309] cursor-pointer disabled:opacity-40"
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
                  All
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                <Clock className="w-3.5 h-3.5" />
                <span>5. Timer</span>
              </div>
              {mode === 'flashcards' ? (
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                  Flashcards are self-paced.
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
                      {sec === 0 ? 'Off' : `${sec}s`}
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
                    Same-Deck Options Only
                  </span>
                  <span className="block text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed mt-0.5">
                    Incorrect options are drawn from the same deck as the question
                    whenever possible, keeping distractors contextually relevant.
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
                  Due Reviews Only
                </span>
                <span className="block text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed mt-0.5">
                  Restrict this session to cards whose spaced-repetition review
                  is due now. Turn off for full-deck practice.
                </span>
              </span>
            </label>

            {leechCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Leech cards
                  </span>
                  <span className="text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                    {leechCount} stubborn {leechCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'exclude', label: 'Exclude' },
                      { id: 'only', label: 'Only leeches' },
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
                      {opt.label}
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
                ? 'Select at least one deck to begin.'
                : mode === 'fill-blank'
                  ? 'Selected decks have no example sentences containing the target word.'
                  : 'Selected decks contain no words yet.'}
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
            Cancel
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
