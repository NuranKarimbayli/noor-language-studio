import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ConfidenceLevel,
  Deck,
  SessionConfig,
  VocabCard,
} from '../types';
import { isCardDue, isLeechCard, sortCardsBySrsPriority } from '../utils/srs';
import { matchesDifficultyFilter } from '../utils/storage';
import {
  playCompleteSound,
  playCorrectSound,
  playIncorrectSound,
} from '../utils/soundEffects';
import { CelebrationBurst } from './CelebrationBurst';
import { SpeakButton } from './SpeakButton';
import { stopSpeaking, VoiceSelection } from '../utils/speechUtils';

interface FlashcardStudyProps {
  decks: Deck[];
  cards: VocabCard[];
  sessionConfig: SessionConfig;
  sfxMuted: boolean;
  onRateCard: (cardId: string, confidence: ConfidenceLevel) => void;
  onOpenSetup: () => void;
  onBackToWorkspace: () => void;
  ttsMuted?: boolean;
  langCode?: string;
  voice?: VoiceSelection | null;
}

type QueueOrder = 'smart' | 'sequential' | 'shuffled';

interface StudyItem {
  card: VocabCard;
  deckName: string;
  promptSide: 'word' | 'translation';
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardStudy({
  decks,
  cards,
  sessionConfig,
  sfxMuted,
  onRateCard,
  onOpenSetup,
  onBackToWorkspace,
  ttsMuted = false,
  langCode = 'EN',
  voice,
}: FlashcardStudyProps) {
  const [queueOrder, setQueueOrder] = useState<QueueOrder>('smart');
  const [onlyHardMode, setOnlyHardMode] = useState(false);

  const [sessionSeed, setSessionSeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionRatings, setSessionRatings] = useState({ hard: 0, good: 0, easy: 0 });
  const [ratingPulse, setRatingPulse] = useState<'good' | 'hard' | null>(null);

  const advanceLockRef = useRef(false);
  const rateTimeoutRef = useRef<number | null>(null);

  const deckMap = useMemo(() => {
    const map = new Map<string, Deck>();
    for (const d of decks) map.set(d.id, d);
    return map;
  }, [decks]);

  // Reset session when config changes
  useEffect(() => {
    setOnlyHardMode(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setSessionRatings({ hard: 0, good: 0, easy: 0 });
    setRatingPulse(null);
    setSessionSeed((s) => s + 1);
  }, [sessionConfig]);

  const studyQueue: StudyItem[] = useMemo(() => {
    let pool = cards.filter(
      (c) =>
        sessionConfig.deckIds.includes(c.deckId) &&
        matchesDifficultyFilter(c, sessionConfig.difficultyFilter)
    );

    if (onlyHardMode) {
      pool = pool.filter((c) => c.confidence === 'hard');
    }

    if (sessionConfig.dueOnly) {
      pool = pool.filter((c) => isCardDue(c));
    }

    if (sessionConfig.leechFilter === 'exclude') {
      pool = pool.filter((c) => !isLeechCard(c));
    } else if (sessionConfig.leechFilter === 'only') {
      pool = pool.filter(isLeechCard);
    }

    if (queueOrder === 'smart') {
      pool = sortCardsBySrsPriority(pool);
    } else if (queueOrder === 'shuffled') {
      pool = shuffleArray(pool);
    }

    if (!onlyHardMode && sessionConfig.questionCount > 0) {
      pool = pool.slice(0, sessionConfig.questionCount);
    }

    return pool.map((card) => {
      const deck = deckMap.get(card.deckId);
      // Strict anchoring: the prompt is always the target-language word
      const promptSide: 'word' | 'translation' = 'word';

      return {
        card,
        deckName: deck?.name ?? 'Vocabulary Deck',
        promptSide,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionConfig, queueOrder, onlyHardMode, sessionSeed]);

  const currentItem = studyQueue[currentIndex] ?? null;
  const liveCard = currentItem
    ? cards.find((c) => c.id === currentItem.card.id) ?? currentItem.card
    : null;

  const cancelPendingAdvance = useCallback(() => {
    if (rateTimeoutRef.current !== null) {
      window.clearTimeout(rateTimeoutRef.current);
      rateTimeoutRef.current = null;
    }
    advanceLockRef.current = false;
  }, []);

  const restartSession = useCallback((hardOnly = false) => {
    cancelPendingAdvance();
    setOnlyHardMode(hardOnly);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setSessionRatings({ hard: 0, good: 0, easy: 0 });
    setRatingPulse(null);
    setSessionSeed((s) => s + 1);
  }, [cancelPendingAdvance]);

  const handleOrderChange = (nextOrder: QueueOrder) => {
    cancelPendingAdvance();
    setQueueOrder(nextOrder);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
    setSessionSeed((s) => s + 1);
  };

  const goToIndex = useCallback(
    (nextIdx: number) => {
      if (nextIdx < 0 || nextIdx >= studyQueue.length) return;
      cancelPendingAdvance();
      setIsFlipped(false);
      setCurrentIndex(nextIdx);
    },
    [studyQueue.length, cancelPendingAdvance]
  );

  const handleRate = useCallback(
    (level: 'hard' | 'good' | 'easy') => {
      if (!currentItem || !isFlipped || advanceLockRef.current) return;
      advanceLockRef.current = true;

      if (level === 'hard') {
        setRatingPulse('hard');
        playIncorrectSound(sfxMuted);
      } else {
        setRatingPulse('good');
        playCorrectSound(sfxMuted);
      }

      onRateCard(currentItem.card.id, level);
      setSessionRatings((prev) => ({ ...prev, [level]: prev[level] + 1 }));
      setIsFlipped(false);

      if (rateTimeoutRef.current !== null) {
        window.clearTimeout(rateTimeoutRef.current);
      }

      rateTimeoutRef.current = window.setTimeout(() => {
        setRatingPulse(null);
        setIsFlipped(false);
        if (currentIndex + 1 >= studyQueue.length) {
          setSessionComplete(true);
          playCompleteSound(sfxMuted);
        } else {
          setCurrentIndex((i) => i + 1);
        }
        advanceLockRef.current = false;
        rateTimeoutRef.current = null;
      }, 220);
    },
    [currentItem, isFlipped, onRateCard, currentIndex, studyQueue.length, sfxMuted]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (sessionComplete || !currentItem || e.repeat) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToIndex(currentIndex - 1);
      } else if (isFlipped && e.key === '1') {
        e.preventDefault();
        handleRate('hard');
      } else if (isFlipped && e.key === '2') {
        e.preventDefault();
        handleRate('good');
      } else if (isFlipped && e.key === '3') {
        e.preventDefault();
        handleRate('easy');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessionComplete, currentItem, isFlipped, currentIndex, goToIndex, handleRate]);

  // Cleanup rate timeout and any ongoing speech on unmount
  useEffect(() => {
    return () => {
      if (rateTimeoutRef.current !== null) {
        window.clearTimeout(rateTimeoutRef.current);
      }
      stopSpeaking();
    };
  }, []);

  // Stop pronunciation when advancing to a different card
  useEffect(() => {
    stopSpeaking();
  }, [currentIndex]);

  const progressPct =
    studyQueue.length > 0 ? Math.round(((currentIndex + 1) / studyQueue.length) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Study Bar */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#2E2A25]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Decks</span>
          </button>

          {onlyHardMode && (
            <button
              type="button"
              onClick={() => restartSession(false)}
              className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline"
            >
              Hard cards only · Show all
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Card queue order"
            className="flex items-center gap-1 p-1 bg-[#F3EFE8] dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-lg"
          >
            {(
              [
                { id: 'smart', label: 'Smart' },
                { id: 'sequential', label: 'Order' },
                { id: 'shuffled', label: 'Shuffle' },
              ] as Array<{ id: QueueOrder; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleOrderChange(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  queueOrder === opt.id
                    ? 'bg-white dark:bg-[#2A2621] text-[#1C1917] dark:text-[#F5F2EC] shadow-xs'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenSetup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Mode</span>
          </button>
        </div>
      </section>

      {/* Main Flashcard Stage */}
      {studyQueue.length === 0 ? (
        <div className="max-w-xl mx-auto py-16 px-6 text-center bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl">
          <BookOpen className="w-10 h-10 mx-auto text-[#78716C] dark:text-[#A8A29E] mb-4" />
          <h2 className="font-display text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] mb-2">
            {onlyHardMode ? 'No cards marked Hard' : 'No flashcards in this selection'}
          </h2>
          <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mb-6">
            {onlyHardMode
              ? 'Great work — none of the selected cards are currently marked Hard.'
              : 'Add vocabulary entries before starting a flashcard session.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {onlyHardMode ? (
              <button
                type="button"
                onClick={() => restartSession(false)}
                className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
              >
                Study All Cards
              </button>
            ) : (
              <button
                type="button"
                onClick={onBackToWorkspace}
                className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
              >
                Back to Decks
              </button>
            )}
          </div>
        </div>
      ) : sessionComplete ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-xl mx-auto py-12 px-6 sm:px-10 text-center bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl space-y-6 overflow-hidden"
        >
          <CelebrationBurst active />
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-700 dark:text-emerald-400 relative z-10" />
          <div className="space-y-2 relative z-10">
            <h2 className="font-display text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Session Complete
            </h2>
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">
              You reviewed {studyQueue.length} {studyQueue.length === 1 ? 'card' : 'cards'} and updated your Leitner spacing schedule.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-2 pb-2 border-y border-slate-200 dark:border-[#2E2A25] tabular-nums relative z-10">
            <div className="py-2">
              <div className="font-mono text-2xl font-semibold text-red-700 dark:text-red-400">
                {sessionRatings.hard}
              </div>
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">Hard</div>
            </div>
            <div className="py-2">
              <div className="font-mono text-2xl font-semibold text-[#B45309] dark:text-[#F59E0B]">
                {sessionRatings.good}
              </div>
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">Good</div>
            </div>
            <div className="py-2">
              <div className="font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
                {sessionRatings.easy}
              </div>
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">Easy</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
            {sessionRatings.hard > 0 && (
              <button
                type="button"
                onClick={() => restartSession(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Practice Hard Cards
              </button>
            )}
            <button
              type="button"
              onClick={() => restartSession(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C1917] hover:bg-[#292524] dark:bg-[#F5F2EC] dark:hover:bg-[#E6E1D8] text-white dark:text-[#121110] text-sm font-medium transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              Restart Cards
            </button>
            <button
              type="button"
              onClick={onOpenSetup}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] transition-colors"
            >
              Try Another Mode
            </button>
          </div>
        </motion.div>
      ) : (
        currentItem &&
        liveCard && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E]">
                <span className="truncate max-w-[70%]">{currentItem.deckName}</span>
                <span className="font-mono tabular-nums shrink-0">
                  {currentIndex + 1} / {studyQueue.length}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#E6E1D8] dark:bg-[#2E2A25] overflow-hidden">
                <div
                  className="h-full bg-[#B45309] dark:bg-[#D97706] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div
              className={`perspective-1200 rounded-2xl ${
                ratingPulse === 'good'
                  ? 'animate-correct-pulse'
                  : ratingPulse === 'hard'
                    ? 'animate-incorrect-shake'
                    : ''
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label={
                  isFlipped
                    ? 'Flashcard answer side. Click or press Space to flip back'
                    : 'Flashcard prompt side. Click or press Space to reveal answer'
                }
                onClick={() => setIsFlipped((f) => !f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.repeat) {
                    e.preventDefault();
                    setIsFlipped((f) => !f);
                  }
                }}
                className={`flashcard-inner relative w-full min-h-[340px] sm:min-h-[380px] cursor-pointer preserve-3d transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] rounded-2xl ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* Front Face */}
                <div className="absolute inset-0 backface-hidden bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-6 sm:p-10 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
                    <span>
                      {currentItem.promptSide === 'word'
                        ? `Word · ${liveCard.confidence}`
                        : `Translation · ${liveCard.confidence}`}
                    </span>
                    <span className="font-mono tabular-nums">
                      Box {liveCard.srsBox ?? 1}/5
                    </span>
                  </div>

                  <div className="my-auto py-6 text-center space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <p
                        className={`${
                          currentItem.promptSide === 'word'
                            ? 'font-display text-4xl sm:text-5xl font-semibold'
                            : 'text-2xl sm:text-3xl font-semibold'
                        } text-[#1C1917] dark:text-[#F5F2EC] tracking-tight break-words select-text`}
                      >
                        {currentItem.promptSide === 'word'
                          ? currentItem.card.word
                          : currentItem.card.translation}
                      </p>
                      <SpeakButton
                        text={currentItem.card.word}
                        langCode={langCode}
                        muted={ttsMuted}
                        voice={voice}
                        iconClassName="w-6 h-6"
                        className="p-2"
                      />
                    </div>
                  </div>

                  <div className="text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
                    Click card or press{' '}
                    <kbd className="font-mono px-1.5 py-0.5 rounded bg-[#F3EFE8] dark:bg-[#25221E] text-[#1C1917] dark:text-[#F5F2EC]">
                      Space
                    </kbd>{' '}
                    to flip
                  </div>
                </div>

                {/* Back Face */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#FAF8F5] dark:bg-[#1E1B18] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-6 sm:p-10 flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
                    <span>
                      {currentItem.promptSide === 'word' ? 'Translation' : 'Word'}
                    </span>
                    <span className="font-mono tabular-nums">
                      Box {liveCard.srsBox ?? 1}/5
                    </span>
                  </div>

                  <div className="my-auto py-4 text-center space-y-4">
                    <p
                      className={`${
                        currentItem.promptSide === 'translation'
                          ? 'font-display text-4xl sm:text-5xl font-semibold'
                          : 'text-2xl sm:text-4xl font-semibold'
                      } text-[#1C1917] dark:text-[#F5F2EC] tracking-tight break-words select-text`}
                    >
                      {currentItem.promptSide === 'word'
                        ? currentItem.card.translation
                        : currentItem.card.word}
                    </p>

                    <p className="text-sm text-[#57534E] dark:text-[#A8A29E] select-text">
                      {currentItem.promptSide === 'word'
                        ? currentItem.card.word
                        : currentItem.card.translation}
                    </p>

                    {currentItem.card.exampleSentence && (
                      <p className="text-sm sm:text-base italic text-[#57534E] dark:text-[#C4BEB4] max-w-lg mx-auto pt-3 border-t border-slate-200 dark:border-[#2E2A25]">
                        “{currentItem.card.exampleSentence}”
                      </p>
                    )}

                    {currentItem.card.mnemonic && (
                      <p className="text-xs sm:text-sm text-[#B45309] dark:text-[#F59E0B] max-w-lg mx-auto pt-3">
                        <span className="font-medium">Memory tip:</span>{' '}
                        {currentItem.card.mnemonic}
                      </p>
                    )}
                  </div>

                  <div className="text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
                    Rate recall below or press{' '}
                    <kbd className="font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#25221E] text-[#1C1917] dark:text-[#F5F2EC]">
                      1
                    </kbd>
                    –
                    <kbd className="font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#25221E] text-[#1C1917] dark:text-[#F5F2EC]">
                      3
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => goToIndex(currentIndex - 1)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={currentIndex + 1 >= studyQueue.length}
                  onClick={() => goToIndex(currentIndex + 1)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Skip
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {!isFlipped ? (
                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
                >
                  Reveal Answer (Space)
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 flex-1 sm:max-w-md">
                  <button
                    type="button"
                    onClick={() => handleRate('hard')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-300 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70 text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Hard</span>
                    <span className="font-mono text-xs opacity-70">1</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('good')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/70 text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Good</span>
                    <span className="font-mono text-xs opacity-70">2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('easy')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Easy</span>
                    <span className="font-mono text-xs opacity-70">3</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
