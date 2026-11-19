import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Flame,
  Lightbulb,
  Mic,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  Deck,
  QuizAnswerRecord,
  QuizMode,
  QuizQuestion,
  QuizSessionSummary,
  SessionConfig,
  VocabCard,
} from '../types';
import { isCardDue, isLeechCard, sortCardsBySrsPriority } from '../utils/srs';
import {
  playCompleteSound,
  playCorrectSound,
  playIncorrectSound,
} from '../utils/soundEffects';
import { createBlankedSentence, evaluateTypedAnswer } from '../utils/textUtils';
import { matchesDifficultyFilter } from '../utils/storage';
import {
  isSpeechRecognitionSupported,
  isVoiceSupported,
  speakText,
  startSpeechRecognition,
  SpeechRecognitionSession,
  stopSpeaking,
  useBrowserVoices,
  VoiceSelection,
} from '../utils/speechUtils';
import { CelebrationBurst } from './CelebrationBurst';
import { DiacriticBar } from './DiacriticBar';
import { SpeakButton } from './SpeakButton';

interface QuizCenterProps {
  languageCode: string;
  decks: Deck[];
  cards: VocabCard[];
  sessionConfig: SessionConfig & { mode: QuizMode };
  sfxMuted: boolean;
  onRecordAnswer: (cardId: string, isCorrect: boolean, isExact: boolean) => void;
  onQuizComplete?: (summary: QuizSessionSummary) => void;
  onOpenSetup: () => void;
  onBackToWorkspace: () => void;
  ttsMuted?: boolean;
  voice?: VoiceSelection | null;
  autoAdvance?: boolean;
  autoSpeakPrompt?: boolean;
  autoSpeakAnswer?: boolean;
}

type QuizPhase = 'running' | 'results';

function shuffleList<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Interpolates the quiz cooldown bar color smoothly from green (full time)
 * through orange to red (nearly expired) as `ratio` decreases from 1 to 0.
 */
function cooldownBarColor(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  // Anchor stops: emerald -> amber at 50%, amber -> red below 50%
  const stops: Array<[number, [number, number, number]]> = [
    [1, [16, 185, 129]], // emerald-500
    [0.5, [245, 158, 11]], // amber-500
    [0, [239, 68, 68]], // red-500
  ];
  let upper = stops[0];
  let lower = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped <= stops[i][0] && clamped >= stops[i + 1][0]) {
      upper = stops[i];
      lower = stops[i + 1];
      break;
    }
  }
  const span = upper[0] - lower[0];
  const t = span === 0 ? 0 : (clamped - lower[0]) / span;
  const channel = (i: number) =>
    Math.round(lower[1][i] + (upper[1][i] - lower[1][i]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/**
 * Cards eligible for a quiz mode. Fill-in-the-blanks requires an example
 * sentence that actually contains the target word.
 */
function getEligiblePool(pool: VocabCard[], mode: QuizMode): VocabCard[] {
  if (mode !== 'fill-blank') return pool;
  return pool.filter(
    (c) => c.exampleSentence && createBlankedSentence(c.exampleSentence, c.word) !== null
  );
}

export function QuizCenter({
  languageCode,
  decks,
  cards,
  sessionConfig,
  sfxMuted,
  onRecordAnswer,
  onQuizComplete,
  onOpenSetup,
  onBackToWorkspace,
  ttsMuted = false,
  voice,
  autoAdvance = false,
  autoSpeakPrompt = false,
  autoSpeakAnswer = false,
}: QuizCenterProps) {
  const [phase, setPhase] = useState<QuizPhase>('running');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [records, setRecords] = useState<QuizAnswerRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<QuizAnswerRecord | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [hintRevealed, setHintRevealed] = useState(false);

  // Speaking-practice state (Web Speech recognition)
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionSession | null>(null);

  // Smooth millisecond cooldown bar state
  const [remainingMs, setRemainingMs] = useState<number>(
    sessionConfig.timerSeconds * 1000
  );

  // Tactile visual feedback state
  const [feedbackPulse, setFeedbackPulse] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [feedbackKey, setFeedbackKey] = useState(0);

  const answerInputRef = useRef<HTMLInputElement>(null);
  const timerRafRef = useRef<number | null>(null);
  const submissionLockRef = useRef(false);
  const sessionStartRef = useRef<number>(performance.now());
  const recordsRef = useRef<QuizAnswerRecord[]>([]);
  recordsRef.current = records;

  // Cooldown timer internals: wall-clock deadline + direct DOM writes
  const cooldownBarRef = useRef<HTMLDivElement>(null);
  const cooldownBadgeRef = useRef<HTMLSpanElement>(null);
  const cooldownDeadlineRef = useRef<number | null>(null);
  const armedQuestionKeyRef = useRef<string | null>(null);

  // Consecutive-correct streak derived from answer records
  const streak = useMemo(() => {
    let count = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (!records[i].isCorrect) break;
      count++;
    }
    return count;
  }, [records]);

  const bestStreak = useMemo(() => {
    let best = 0;
    let current = 0;
    for (const r of records) {
      current = r.isCorrect ? current + 1 : 0;
      if (current > best) best = current;
    }
    return best;
  }, [records]);

  const deckMap = useMemo(() => {
    const map = new Map<string, Deck>();
    for (const d of decks) map.set(d.id, d);
    return map;
  }, [decks]);

  const buildQuestions = useCallback(
    (sourceCards: VocabCard[], config: SessionConfig & { mode: QuizMode }): QuizQuestion[] => {
      // Leitner Spaced Repetition priority queue: struggling / due words come first
      const pool = sortCardsBySrsPriority(sourceCards).slice(0, config.questionCount);

      return pool.map((card, index) => {
        const deck = deckMap.get(card.deckId);
        const deckName = deck?.name ?? 'Deck';

        if (config.mode === 'fill-blank') {
          const blankResult = createBlankedSentence(card.exampleSentence ?? '', card.word);
          const expected = blankResult?.matchedToken ?? card.word;
          return {
            id: `q-${index}-${card.id}`,
            card,
            deckName,
            langCode: languageCode,
            direction: 'translation-to-word',
            promptText: card.translation,
            expectedAnswer: expected,
            hintText: expected.toLowerCase() !== card.word.toLowerCase() ? card.word : undefined,
            blankedSentence: blankResult?.blanked ?? card.exampleSentence ?? '',
          };
        }

        // Speaking practice: prompt is the native translation, the learner
        // must produce the target-language word aloud.
        if (config.mode === 'speaking') {
          return {
            id: `q-${index}-${card.id}`,
            card,
            deckName,
            langCode: languageCode,
            direction: 'translation-to-word',
            promptText: card.translation,
            expectedAnswer: card.word,
          };
        }

        // Strict anchoring: the prompt is always the target-language word and
        // every answer/option is drawn from the native translation field.
        const resolvedDirection: 'word-to-translation' | 'translation-to-word' =
          'word-to-translation';

        const promptText = card.word;
        const expectedAnswer = card.translation;

        // Distractor isolation: when enabled (default), candidates are ordered
        // so the question card's own deck is exhausted first, then other
        // in-scope decks, and only then unrelated decks — preventing obvious
        // cross-category spoilers. When disabled, all selected decks are mixed.
        const isolateByDeck = config.isolateDistractorsByDeck !== false;
        const sourceIdSet = new Set(sourceCards.map((c) => c.id));
        let distractorCandidates: VocabCard[];
        if (isolateByDeck) {
          const sameDeckPool = shuffleList(
            cards.filter((o) => o.id !== card.id && o.deckId === card.deckId)
          );
          const sameDeckIds = new Set(sameDeckPool.map((c) => c.id));
          const fallbackPool = shuffleList([
            ...sourceCards.filter((o) => o.id !== card.id && !sameDeckIds.has(o.id)),
            ...cards.filter(
              (o) => o.id !== card.id && o.deckId !== card.deckId && !sourceIdSet.has(o.id)
            ),
          ]);
          distractorCandidates = [...sameDeckPool, ...fallbackPool];
        } else {
          distractorCandidates = shuffleList([
            ...sourceCards.filter((o) => o.id !== card.id),
            ...cards.filter((o) => o.id !== card.id && !sourceIdSet.has(o.id)),
          ]);
        }

        // True / False mode: ~50% matching pair, ~50% plausible mismatch
        if (config.mode === 'true-false') {
          const otherCandidates = distractorCandidates.filter((other) => {
            const val =
              resolvedDirection === 'word-to-translation' ? other.translation : other.word;
            return val.toLowerCase() !== expectedAnswer.toLowerCase();
          });

          const shouldShowFalse = otherCandidates.length > 0 && Math.random() < 0.5;
          const proposedMatch = shouldShowFalse
            ? resolvedDirection === 'word-to-translation'
              ? otherCandidates[0].translation
              : otherCandidates[0].word
            : expectedAnswer;

          return {
            id: `q-${index}-${card.id}`,
            card,
            deckName,
            langCode: languageCode,
            direction: resolvedDirection,
            promptText,
            expectedAnswer,
            proposedMatch,
            isTrueStatement: !shouldShowFalse,
          };
        }

        let options: string[] | undefined;
        if (config.mode === 'multiple-choice' || config.mode === 'listening') {
          const candidateValues = new Set<string>();

          for (const other of distractorCandidates) {
            const val =
              resolvedDirection === 'word-to-translation' ? other.translation : other.word;
            if (val.toLowerCase() !== expectedAnswer.toLowerCase()) {
              candidateValues.add(val);
            }
            if (candidateValues.size >= 3) break;
          }

          options = shuffleList([expectedAnswer, ...Array.from(candidateValues)]);
        }

        return {
          id: `q-${index}-${card.id}`,
          card,
          deckName,
          langCode: languageCode,
          direction: resolvedDirection,
          promptText,
          expectedAnswer,
          options,
        };
      });
    },
    [cards, deckMap, languageCode]
  );

  const startWithPool = useCallback(
    (pool: VocabCard[], countOverride?: number) => {
      const targetCount = countOverride ?? Math.min(sessionConfig.questionCount, pool.length);
      if (pool.length === 0 || targetCount === 0) return;

      const built = buildQuestions(pool, {
        ...sessionConfig,
        questionCount: targetCount,
      });

      setQuestions(built);
      setCurrentIdx(0);
      setRecords([]);
      setCurrentRecord(null);
      setTypedAnswer('');
      setHintRevealed(false);
      setFeedbackPulse(null);
      setRemainingMs(sessionConfig.timerSeconds * 1000);
      // Force the cooldown timer to re-arm for the fresh question set
      cooldownDeadlineRef.current = null;
      armedQuestionKeyRef.current = null;
      setPhase('running');
      sessionStartRef.current = performance.now();
    },
    [buildQuestions, sessionConfig]
  );

  // Initialize quiz whenever sessionConfig changes
  useEffect(() => {
    let selectedPool = cards.filter((c) => sessionConfig.deckIds.includes(c.deckId));
    if (sessionConfig.smartReviewOnly && sessionConfig.smartCardIds?.length) {
      const targetSet = new Set(sessionConfig.smartCardIds);
      const focused = selectedPool.filter((c) => targetSet.has(c.id));
      if (focused.length > 0) {
        selectedPool = focused;
      }
    }
    if (sessionConfig.difficultyFilter?.length) {
      selectedPool = selectedPool.filter((c) =>
        matchesDifficultyFilter(c, sessionConfig.difficultyFilter)
      );
    }
    if (sessionConfig.dueOnly) {
      selectedPool = selectedPool.filter((c) => isCardDue(c));
    }
    if (sessionConfig.leechFilter === 'exclude') {
      selectedPool = selectedPool.filter((c) => !isLeechCard(c));
    } else if (sessionConfig.leechFilter === 'only') {
      selectedPool = selectedPool.filter(isLeechCard);
    }
    const eligible = getEligiblePool(selectedPool, sessionConfig.mode);
    startWithPool(eligible, Math.min(sessionConfig.questionCount, eligible.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionConfig]);

  const currentQuestion = questions[currentIdx] ?? null;

  const browserVoices = useBrowserVoices();
  const voiceSupported = isVoiceSupported(languageCode, voice, browserVoices);
  const recognitionSupported = isSpeechRecognitionSupported();

  // The audio model for a question: listening plays the prompt word;
  // speaking practice plays the target word the learner must repeat.
  const modelSpeechText = useCallback(
    (q: QuizQuestion) =>
      sessionConfig.mode === 'speaking' ? q.expectedAnswer : q.promptText,
    [sessionConfig.mode]
  );

  const replayPrompt = useCallback(() => {
    if (!currentQuestion || ttsMuted || !voiceSupported) return;
    speakText(
      modelSpeechText(currentQuestion),
      currentQuestion.langCode || languageCode,
      voice
    );
  }, [currentQuestion, modelSpeechText, ttsMuted, voiceSupported, voice, languageCode]);

  // Listening/speaking modes: auto-pronounce the model audio for each new
  // question and cancel any in-flight speech when it changes or we unmount.
  useEffect(() => {
    const audioMode =
      sessionConfig.mode === 'listening' || sessionConfig.mode === 'speaking';
    if (
      phase === 'running' &&
      audioMode &&
      currentQuestion &&
      !currentRecord &&
      !ttsMuted &&
      voiceSupported
    ) {
      speakText(
        modelSpeechText(currentQuestion),
        currentQuestion.langCode || languageCode,
        voice
      );
      return () => stopSpeaking();
    }
    return undefined;
  }, [
    phase,
    sessionConfig.mode,
    currentIdx,
    currentQuestion,
    currentRecord,
    modelSpeechText,
    ttsMuted,
    voiceSupported,
    voice,
    languageCode,
  ]);

  // Auto-speak the prompt: only when the prompt itself is the target-language
  // word (word-to-translation). Listening mode already auto-pronounces.
  useEffect(() => {
    if (
      phase !== 'running' ||
      currentRecord ||
      !autoSpeakPrompt ||
      ttsMuted ||
      !voiceSupported ||
      !currentQuestion ||
      sessionConfig.mode === 'listening' ||
      currentQuestion.direction !== 'word-to-translation'
    ) {
      return;
    }
    speakText(
      currentQuestion.promptText,
      currentQuestion.langCode || languageCode,
      voice
    );
  }, [
    phase,
    currentRecord,
    autoSpeakPrompt,
    ttsMuted,
    voiceSupported,
    currentQuestion,
    sessionConfig.mode,
    voice,
    languageCode,
  ]);

  // Auto-speak the answer context on reveal: example sentence when present,
  // otherwise the target word itself.
  useEffect(() => {
    if (
      !currentRecord ||
      !autoSpeakAnswer ||
      ttsMuted ||
      !voiceSupported ||
      !currentQuestion
    ) {
      return;
    }
    const text =
      currentQuestion.card.exampleSentence ?? currentQuestion.card.word;
    speakText(text, currentQuestion.langCode || languageCode, voice);
  }, [
    currentRecord,
    autoSpeakAnswer,
    ttsMuted,
    voiceSupported,
    currentQuestion,
    voice,
    languageCode,
  ]);

  useEffect(() => {
    if (
      phase === 'running' &&
      !currentRecord &&
      (sessionConfig.mode === 'typing' || sessionConfig.mode === 'fill-blank')
    ) {
      requestAnimationFrame(() => {
        answerInputRef.current?.focus();
      });
    }
  }, [phase, currentIdx, currentRecord, sessionConfig.mode]);

  const triggerFeedback = useCallback(
    (isCorrect: boolean) => {
      setFeedbackPulse(isCorrect ? 'correct' : 'incorrect');
      setFeedbackKey((k) => k + 1);
      if (isCorrect) {
        playCorrectSound(sfxMuted);
      } else {
        playIncorrectSound(sfxMuted);
      }
    },
    [sfxMuted]
  );

  const handleTrueFalseSelect = useCallback(
    (choice: boolean) => {
      if (!currentQuestion || currentRecord || submissionLockRef.current) return;
      submissionLockRef.current = true;
      const isCorrect = choice === Boolean(currentQuestion.isTrueStatement);
      const record: QuizAnswerRecord = {
        question: currentQuestion,
        userAnswer: choice ? 'True' : 'False',
        status: isCorrect ? 'exact' : 'incorrect',
        isCorrect,
      };
      setCurrentRecord(record);
      setRecords((prev) => [...prev, record]);
      onRecordAnswer(currentQuestion.card.id, isCorrect, isCorrect);
      triggerFeedback(isCorrect);
      setTimeout(() => {
        submissionLockRef.current = false;
      }, 300);
    },
    [currentQuestion, currentRecord, onRecordAnswer, triggerFeedback]
  );

  const handleMultipleChoiceSelect = useCallback(
    (option: string) => {
      if (!currentQuestion || currentRecord || submissionLockRef.current) return;
      submissionLockRef.current = true;
      const isCorrect = option === currentQuestion.expectedAnswer;
      const record: QuizAnswerRecord = {
        question: currentQuestion,
        userAnswer: option,
        status: isCorrect ? 'exact' : 'incorrect',
        isCorrect,
      };
      setCurrentRecord(record);
      setRecords((prev) => [...prev, record]);
      onRecordAnswer(currentQuestion.card.id, isCorrect, isCorrect);
      triggerFeedback(isCorrect);
      setTimeout(() => {
        submissionLockRef.current = false;
      }, 300);
    },
    [currentQuestion, currentRecord, onRecordAnswer, triggerFeedback]
  );

  const handleTypedSubmit = useCallback(
    (e?: FormEvent) => {
      if (e) e.preventDefault();
      if (!currentQuestion || currentRecord) return;
      if (!typedAnswer.trim()) return;

      const extraAccepted =
        sessionConfig.mode === 'fill-blank' ? [currentQuestion.card.word] : undefined;
      const evaluation = evaluateTypedAnswer(
        typedAnswer,
        currentQuestion.expectedAnswer,
        extraAccepted
      );

      const record: QuizAnswerRecord = {
        question: currentQuestion,
        userAnswer: typedAnswer.trim(),
        status: evaluation.status,
        isCorrect: evaluation.isCorrect,
      };
      setCurrentRecord(record);
      setRecords((prev) => [...prev, record]);
      onRecordAnswer(
        currentQuestion.card.id,
        evaluation.isCorrect,
        evaluation.status === 'exact'
      );
      triggerFeedback(evaluation.isCorrect);
    },
    [currentQuestion, currentRecord, typedAnswer, sessionConfig.mode, onRecordAnswer, triggerFeedback]
  );

  // Score a recognized transcript exactly like a typed answer.
  const submitSpeechAnswer = useCallback(
    (transcript: string) => {
      if (!currentQuestion || currentRecord || submissionLockRef.current) return;
      const text = transcript.trim();
      if (!text) return;
      submissionLockRef.current = true;

      const evaluation = evaluateTypedAnswer(text, currentQuestion.expectedAnswer);
      const record: QuizAnswerRecord = {
        question: currentQuestion,
        userAnswer: text,
        status: evaluation.status,
        isCorrect: evaluation.isCorrect,
      };
      setCurrentRecord(record);
      setRecords((prev) => [...prev, record]);
      onRecordAnswer(
        currentQuestion.card.id,
        evaluation.isCorrect,
        evaluation.status === 'exact'
      );
      triggerFeedback(evaluation.isCorrect);
      setTimeout(() => {
        submissionLockRef.current = false;
      }, 300);
    },
    [currentQuestion, currentRecord, onRecordAnswer, triggerFeedback]
  );

  const startListening = useCallback(() => {
    if (
      !currentQuestion ||
      currentRecord ||
      sessionConfig.mode !== 'speaking' ||
      !recognitionSupported
    ) {
      return;
    }
    recognitionRef.current?.abort();
    setSpeechTranscript('');
    setIsListening(true);
    recognitionRef.current = startSpeechRecognition(languageCode, {
      onTranscript: (text) => setSpeechTranscript(text),
      onFinal: (text) => {
        setSpeechTranscript(text);
        submitSpeechAnswer(text);
      },
      onEnd: () => setIsListening(false),
      onError: () => setIsListening(false),
    });
    if (!recognitionRef.current) {
      setIsListening(false);
    }
  }, [
    currentQuestion,
    currentRecord,
    sessionConfig.mode,
    recognitionSupported,
    languageCode,
    submitSpeechAnswer,
  ]);

  // Auto-arm the microphone for each new speaking question; disarm on
  // answer/unmount so the recognizer never leaks across questions.
  useEffect(() => {
    if (
      phase === 'running' &&
      sessionConfig.mode === 'speaking' &&
      currentQuestion &&
      !currentRecord &&
      recognitionSupported
    ) {
      startListening();
      return () => {
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setIsListening(false);
      };
    }
    return undefined;
  }, [
    phase,
    sessionConfig.mode,
    currentIdx,
    currentQuestion,
    currentRecord,
    recognitionSupported,
    startListening,
  ]);

  // Records a timeout answer exactly once — guarded by the same submission
  // lock used by click/keyboard handlers to prevent double-scoring races.
  const handleTimeout = useCallback(() => {
    if (!currentQuestion || currentRecord || submissionLockRef.current) return;
    submissionLockRef.current = true;
    cooldownDeadlineRef.current = null;

    const timeoutRecord: QuizAnswerRecord = {
      question: currentQuestion,
      userAnswer: '',
      status: 'timeout',
      isCorrect: false,
    };
    setCurrentRecord(timeoutRecord);
    setRecords((prev) => [...prev, timeoutRecord]);
    onRecordAnswer(currentQuestion.card.id, false, false);
    triggerFeedback(false);

    setTimeout(() => {
      submissionLockRef.current = false;
    }, 300);
  }, [currentQuestion, currentRecord, onRecordAnswer, triggerFeedback]);

  // --- Cooldown timer -------------------------------------------------------
  // Wall-clock deadline armed once per question; immune to effect re-runs,
  // tab-switch throttling, and early answers.
  const questionKey = currentQuestion
    ? `${currentIdx}:${currentQuestion.id}`
    : null;

  useEffect(() => {
    const totalMs = sessionConfig.timerSeconds * 1000;
    if (phase !== 'running' || sessionConfig.timerSeconds <= 0 || !questionKey) {
      cooldownDeadlineRef.current = null;
      armedQuestionKeyRef.current = null;
      return;
    }
    if (armedQuestionKeyRef.current !== questionKey) {
      armedQuestionKeyRef.current = questionKey;
      cooldownDeadlineRef.current = performance.now() + totalMs;
      setRemainingMs(totalMs);
    }
  }, [phase, questionKey, sessionConfig.timerSeconds]);

  // rAF loop writes bar width/color and the seconds badge straight to the DOM,
  // so the animation stays at full frame rate without re-rendering React.
  useEffect(() => {
    const totalMs = sessionConfig.timerSeconds * 1000;
    const bar = cooldownBarRef.current;
    const badge = cooldownBadgeRef.current;
    const active =
      phase === 'running' &&
      sessionConfig.timerSeconds > 0 &&
      totalMs > 0 &&
      !currentRecord &&
      !!currentQuestion;

    if (!active || !bar || !badge) {
      if (timerRafRef.current !== null) {
        window.cancelAnimationFrame(timerRafRef.current);
        timerRafRef.current = null;
      }
      return;
    }

    // Flash the bar during the final stretch (last ~2s or last 20%)
    const criticalMs = Math.min(2000, totalMs * 0.2);
    let lastCoarseBucket = -1;
    // Write-only-on-change trackers: avoids churning the DOM every frame,
    // which caused a 1-frame flicker when the displayed second rolled over.
    let lastWidthPct = -1;
    let lastBarColor = '';
    let lastBadgeSecs = -1;
    let lastBadgeColor = '';

    const tick = () => {
      const deadline = cooldownDeadlineRef.current;
      if (deadline === null) {
        timerRafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const remaining = Math.max(0, deadline - performance.now());
      const ratio = remaining / totalMs;

      // Width in 0.05% steps — far below perceptible, but skips redundant writes
      const widthPct = Math.round(ratio * 2000) / 20;
      if (widthPct !== lastWidthPct) {
        lastWidthPct = widthPct;
        bar.style.width = `${widthPct}%`;
      }

      // Color quantized to 1% ratio steps (~100 writes per question max)
      const color = cooldownBarColor(Math.round(ratio * 100) / 100);
      if (color !== lastBarColor) {
        lastBarColor = color;
        bar.style.backgroundColor = color;
      }
      if (color !== lastBadgeColor) {
        lastBadgeColor = color;
        badge.style.color = color;
      }

      // Badge text only rewrites when the displayed second actually changes —
      // textContent assignment replaces the text node, so doing it every frame
      // caused flicker at second boundaries.
      const secs = Math.ceil(remaining / 1000);
      if (secs !== lastBadgeSecs) {
        lastBadgeSecs = secs;
        badge.textContent = `${secs}s`;
      }

      bar.classList.toggle('animate-cooldown-critical', remaining <= criticalMs);

      // Coarse React state (~2 updates/sec) only for aria/labels
      const bucket = Math.ceil(remaining / 500);
      if (bucket !== lastCoarseBucket) {
        lastCoarseBucket = bucket;
        setRemainingMs(remaining);
      }

      if (remaining <= 0) {
        handleTimeout();
        return;
      }
      timerRafRef.current = window.requestAnimationFrame(tick);
    };

    timerRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (timerRafRef.current !== null) {
        window.cancelAnimationFrame(timerRafRef.current);
        timerRafRef.current = null;
      }
    };
  }, [
    phase,
    currentIdx,
    currentRecord,
    currentQuestion,
    sessionConfig.timerSeconds,
    handleTimeout,
  ]);

  const handleNextQuestion = useCallback(() => {
    if (!currentRecord) return;
    if (currentIdx + 1 >= questions.length) {
      setPhase('results');
      playCompleteSound(sfxMuted);
      const answered = recordsRef.current;
      onQuizComplete?.({
        mode: sessionConfig.mode,
        total: questions.length,
        correct: answered.filter((r) => r.isCorrect).length,
        durationMs: Math.max(0, performance.now() - sessionStartRef.current),
        bestStreak,
      });
    } else {
      setCurrentIdx((i) => i + 1);
      setCurrentRecord(null);
      setTypedAnswer('');
      setHintRevealed(false);
      setFeedbackPulse(null);
      setRemainingMs(sessionConfig.timerSeconds * 1000);
    }
  }, [currentRecord, currentIdx, questions.length, sessionConfig.timerSeconds, sessionConfig.mode, sfxMuted, bestStreak, onQuizComplete]);

  // Auto-advance to the next question ~1.5s after an answer is recorded
  useEffect(() => {
    if (!autoAdvance || phase !== 'running' || !currentRecord) return;
    const timeoutId = window.setTimeout(() => {
      handleNextQuestion();
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [autoAdvance, phase, currentRecord, handleNextQuestion]);

  const handleInsertDiacritic = (char: string) => {
    const input = answerInputRef.current;
    if (!input) {
      setTypedAnswer((prev) => prev + char);
      return;
    }
    const start = input.selectionStart ?? typedAnswer.length;
    const end = input.selectionEnd ?? typedAnswer.length;
    const next = typedAnswer.slice(0, start) + char + typedAnswer.slice(end);
    setTypedAnswer(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + char.length, start + char.length);
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== 'running' || !currentQuestion) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats and typing inside form fields
      if (e.repeat) return;
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

      if (sessionConfig.mode === 'true-false') {
        if (!currentRecord) {
          if (e.key === '1' || e.key.toLowerCase() === 't') {
            e.preventDefault();
            handleTrueFalseSelect(true);
            return;
          }
          if (e.key === '2' || e.key.toLowerCase() === 'f') {
            e.preventDefault();
            handleTrueFalseSelect(false);
            return;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleNextQuestion();
        }
      } else if (
        sessionConfig.mode === 'multiple-choice' ||
        sessionConfig.mode === 'listening'
      ) {
        if (sessionConfig.mode === 'listening' && !currentRecord) {
          if (e.key.toLowerCase() === 'r') {
            e.preventDefault();
            replayPrompt();
            return;
          }
        }
        if (!currentRecord && currentQuestion.options) {
          const num = Number(e.key);
          if (num >= 1 && num <= currentQuestion.options.length) {
            e.preventDefault();
            handleMultipleChoiceSelect(currentQuestion.options[num - 1]);
            return;
          }
        }
        if (currentRecord && e.key === 'Enter') {
          e.preventDefault();
          handleNextQuestion();
        }
      } else if (sessionConfig.mode === 'speaking') {
        if (!currentRecord && e.key.toLowerCase() === 'r') {
          e.preventDefault();
          replayPrompt();
          return;
        }
        if (currentRecord && e.key === 'Enter') {
          e.preventDefault();
          handleNextQuestion();
        }
      } else if (currentRecord && e.key === 'Enter') {
        e.preventDefault();
        handleNextQuestion();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    sessionConfig.mode,
    currentQuestion,
    currentRecord,
    handleTrueFalseSelect,
    handleMultipleChoiceSelect,
    handleNextQuestion,
    replayPrompt,
  ]);

  // Cleanup timer RAF, speech, and recognition on unmount
  useEffect(() => {
    return () => {
      if (timerRafRef.current !== null) {
        window.cancelAnimationFrame(timerRafRef.current);
        timerRafRef.current = null;
      }
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopSpeaking();
    };
  }, []);

  const scoreCount = useMemo(
    () => records.filter((r) => r.isCorrect).length,
    [records]
  );

  const missedRecords = useMemo(
    () => records.filter((r) => !r.isCorrect),
    [records]
  );

  const typoCount = useMemo(
    () => records.filter((r) => r.status === 'typo').length,
    [records]
  );

  if (phase === 'running' && currentQuestion) {
    const progressPct = Math.round(
      ((currentIdx + (currentRecord ? 1 : 0)) / questions.length) * 100
    );
    const isForeignPrompt =
      sessionConfig.mode !== 'fill-blank' &&
      currentQuestion.direction === 'word-to-translation';

    const hasTimer = sessionConfig.timerSeconds > 0;
    const totalTimerMs = sessionConfig.timerSeconds * 1000;
    const timerRatio = hasTimer && totalTimerMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalTimerMs)) : 1;

    const cardAnimationClass =
      feedbackPulse === 'correct'
        ? 'animate-correct-pulse border-emerald-500/70 dark:border-emerald-500/60'
        : feedbackPulse === 'incorrect'
          ? 'animate-incorrect-shake border-red-400/80 dark:border-red-700/80'
          : 'border-slate-200 dark:border-[#2E2A25]';

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Decks</span>
          </button>

          <div className="flex items-center gap-2">
            {sessionConfig.smartReviewOnly && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B45309] dark:text-[#F59E0B] pr-1">
                <Zap className="w-3.5 h-3.5" />
                Smart Review
              </span>
            )}
            <button
              type="button"
              onClick={onOpenSetup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Change Mode</span>
            </button>
          </div>
        </div>

        {/* Progress Header */}
        <div className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] tabular-nums">
              <span className="font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Score: {scoreCount}/{records.length}
              </span>
              {streak >= 2 && (
                <motion.span
                  key={streak}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900/60 text-orange-700 dark:text-orange-300 text-xs font-semibold"
                >
                  <Flame className="w-3.5 h-3.5" />
                  {streak}
                </motion.span>
              )}
            </div>

            {hasTimer && (
              <span className="text-[11px] font-medium text-[#78716C] dark:text-[#A8A29E]">
                {currentRecord?.status === 'timeout'
                  ? "Time's up!"
                  : currentRecord
                    ? 'Timer paused'
                    : timerRatio <= 0.25
                      ? 'Hurry!'
                      : 'Timed round'}
              </span>
            )}
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#E6E1D8] dark:bg-[#2E2A25] overflow-hidden">
            <div
              className="h-full bg-[#B45309] dark:bg-[#D97706] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question Stage with Prominent Cooldown Bar & Feedback FX */}
        <section
          key={feedbackKey}
          className={`relative overflow-hidden bg-white dark:bg-[#1C1A17] border rounded-2xl transition-colors ${cardAnimationClass}`}
        >
          {/* Prominent Animated Gradient Cooldown Bar + Live Seconds Badge */}
          {hasTimer && currentRecord?.status !== 'timeout' && (
            <div className="flex items-center gap-3 px-6 sm:px-8 pt-4">
              <div
                role="progressbar"
                aria-label="Question time remaining"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(timerRatio * 100)}
                className="h-2.5 flex-1 bg-[#F3EFE8] dark:bg-[#25221E] rounded-full overflow-hidden"
              >
                <div
                  ref={cooldownBarRef}
                  className="h-full"
                  style={{ width: '100%', backgroundColor: 'rgb(16, 185, 129)' }}
                />
              </div>
              <span
                ref={cooldownBadgeRef}
                className={`w-11 shrink-0 text-right font-mono text-sm font-semibold tabular-nums ${
                  timerRatio <= 0.25 ? 'animate-pulse' : ''
                }`}
                aria-live="off"
              >
                {sessionConfig.timerSeconds}s
              </span>
            </div>
          )}

          {/* Subtle Floating Success Indicator */}
          {feedbackPulse === 'correct' && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-5 right-5 z-20 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-float-up-fade"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>+1 Nice!</span>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-xs font-medium text-[#78716C] dark:text-[#A8A29E]">
              {currentQuestion.deckName} ·{' '}
              {sessionConfig.mode === 'true-false'
                ? 'Is this translation accurate?'
                : sessionConfig.mode === 'fill-blank'
                  ? 'Complete the sentence'
                  : sessionConfig.mode === 'listening'
                    ? 'Listen and pick the meaning'
                    : currentQuestion.direction === 'word-to-translation'
                      ? 'Translate to meaning'
                      : 'Translate to foreign word'}
            </div>

            {sessionConfig.mode === 'true-false' ? (
              <div className="py-4 space-y-4">
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-center space-y-2">
                  <p
                    className={`${
                      isForeignPrompt ? 'font-display text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                    } font-semibold text-[#1C1917] dark:text-[#F5F2EC] select-text`}
                  >
                    {currentQuestion.promptText}
                  </p>
                  <div className="text-xs text-[#78716C] dark:text-[#A8A29E]">means</div>
                  <p
                    className={`${
                      !isForeignPrompt ? 'font-display text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                    } font-medium text-[#57534E] dark:text-[#E7E2DA] select-text`}
                  >
                    {currentQuestion.proposedMatch}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'True', value: true, keyHint: '1' },
                    { label: 'False', value: false, keyHint: '2' },
                  ].map((btn) => {
                    const chosen =
                      currentRecord &&
                      currentRecord.userAnswer === btn.label;
                    const isExpectedButton =
                      currentRecord &&
                      currentQuestion.isTrueStatement === btn.value;

                    let style =
                      'border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309]';
                    if (currentRecord) {
                      if (isExpectedButton) {
                        style =
                          'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200';
                      } else if (chosen && !currentRecord.isCorrect) {
                        style =
                          'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200';
                      } else {
                        style =
                          'border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] opacity-55';
                      }
                    }

                    return (
                      <button
                        key={btn.label}
                        type="button"
                        disabled={Boolean(currentRecord)}
                        onClick={() => handleTrueFalseSelect(btn.value)}
                        className={`py-4 px-4 rounded-xl border text-base font-semibold flex items-center justify-center gap-2.5 transition-colors ${style}`}
                      >
                        <span>{btn.label}</span>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-[#78716C]">
                          {btn.keyHint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : sessionConfig.mode === 'fill-blank' ? (
              <div className="space-y-3 py-2">
                <p className="font-display text-2xl sm:text-3xl font-medium text-[#1C1917] dark:text-[#F5F2EC] leading-snug select-text">
                  {currentQuestion.blankedSentence}
                </p>
                <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">
                  Meaning clue:{' '}
                  <strong className="text-[#1C1917] dark:text-[#F5F2EC] select-text">
                    {currentQuestion.promptText}
                  </strong>
                </p>
              </div>
            ) : sessionConfig.mode === 'speaking' ? (
              <div className="py-4">
                <div className="p-6 sm:p-8 rounded-2xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-center space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E]">
                    Say this word aloud
                  </p>
                  <p className="font-display text-2xl sm:text-3xl font-medium text-[#1C1917] dark:text-[#F5F2EC] select-text">
                    {currentQuestion.promptText}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={replayPrompt}
                      disabled={Boolean(currentRecord) || ttsMuted || !voiceSupported}
                      aria-label="Hear the word"
                      title={
                        voiceSupported
                          ? 'Hear the word pronounced'
                          : 'Voice not supported for this language'
                      }
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-[#25221E] border border-slate-200 dark:border-[#3A352F] text-[#57534E] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                    {recognitionSupported ? (
                      <button
                        type="button"
                        onClick={startListening}
                        disabled={Boolean(currentRecord) || isListening}
                        aria-label={isListening ? 'Listening…' : 'Start speaking'}
                        className={`inline-flex items-center justify-center gap-2 px-5 h-12 rounded-full text-sm font-semibold transition-colors ${
                          isListening
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-[#B45309] hover:bg-[#92400E] text-white'
                        } disabled:opacity-50 disabled:pointer-events-none`}
                      >
                        <Mic className="w-4 h-4" />
                        {isListening ? 'Listening…' : currentRecord ? 'Answered' : 'Tap & Speak'}
                      </button>
                    ) : (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        Speech recognition unavailable in this browser.
                      </span>
                    )}
                  </div>
                  {(isListening || speechTranscript) && !currentRecord && (
                    <p className="text-sm text-[#57534E] dark:text-[#A8A29E] min-h-5">
                      {isListening ? (
                        <>
                          Heard:{' '}
                          <span className="text-[#1C1917] dark:text-[#F5F2EC] font-medium select-text">
                            {speechTranscript || '…'}
                          </span>
                        </>
                      ) : speechTranscript ? (
                        <>
                          Last heard:{' '}
                          <span className="text-[#1C1917] dark:text-[#F5F2EC] font-medium select-text">
                            {speechTranscript}
                          </span>
                          {' — '}tap the mic to retry
                        </>
                      ) : (
                        "Didn't catch that — tap the mic and try again."
                      )}
                    </p>
                  )}
                  {!currentRecord && (
                    <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                      Press{' '}
                      <kbd className="font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#25221E] border border-slate-200 dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC]">
                        R
                      </kbd>{' '}
                      to replay the word
                    </p>
                  )}
                </div>
              </div>
            ) : sessionConfig.mode === 'listening' ? (
              <div className="py-4">
                <div className="p-6 sm:p-8 rounded-2xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-center space-y-4">
                  <button
                    type="button"
                    onClick={replayPrompt}
                    disabled={Boolean(currentRecord) || ttsMuted || !voiceSupported}
                    aria-label="Replay pronunciation"
                    title={
                      voiceSupported
                        ? 'Replay pronunciation'
                        : 'Voice not supported for this language'
                    }
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B45309] hover:bg-[#92400E] text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Volume2 className="w-7 h-7" />
                  </button>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] select-text">
                      {currentRecord
                        ? `You heard: ${currentQuestion.promptText}`
                        : 'Listen carefully — what does this word mean?'}
                    </p>
                    {!currentRecord && (
                      <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                        Press{' '}
                        <kbd className="font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#25221E] border border-slate-200 dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC]">
                          R
                        </kbd>{' '}
                        to replay
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 flex items-center justify-center gap-2">
                <p
                  className={`${
                    isForeignPrompt ? 'font-display text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                  } font-semibold text-[#1C1917] dark:text-[#F5F2EC] tracking-tight select-text`}
                >
                  {currentQuestion.promptText}
                </p>
                <SpeakButton
                  text={currentQuestion.promptText}
                  langCode={currentQuestion.langCode || languageCode}
                  muted={ttsMuted}
                  voice={voice}
                  iconClassName="w-5 h-5"
                />
              </div>
            )}

            {/* Optional mnemonic hint */}
            {currentQuestion.card.mnemonic && !currentRecord && (
              <div>
                {hintRevealed ? (
                  <p className="text-xs sm:text-sm text-[#B45309] dark:text-[#F59E0B] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl px-3.5 py-2.5">
                    <Lightbulb className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
                    {currentQuestion.card.mnemonic}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHintRevealed(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Show memory tip
                  </button>
                )}
              </div>
            )}

            {(sessionConfig.mode === 'multiple-choice' ||
              sessionConfig.mode === 'listening') &&
              currentQuestion.options && (
              <div className="grid grid-cols-1 gap-2.5">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = currentRecord?.userAnswer === opt;
                  const isExpected = opt === currentQuestion.expectedAnswer;

                  let btnStyle =
                    'border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309]';
                  if (currentRecord) {
                    if (isExpected) {
                      btnStyle =
                        'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200';
                    } else if (isSelected && !currentRecord.isCorrect) {
                      btnStyle =
                        'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200';
                    } else {
                      btnStyle =
                        'border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] text-[#78716C] opacity-65';
                    }
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={Boolean(currentRecord)}
                      onClick={() => handleMultipleChoiceSelect(opt)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border text-left text-sm sm:text-base font-medium transition-colors ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/80 dark:bg-[#1C1A17]/80 border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="break-words select-text">{opt}</span>
                      </div>
                      {currentRecord && isExpected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      {currentRecord && isSelected && !currentRecord.isCorrect && (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {(sessionConfig.mode === 'typing' || sessionConfig.mode === 'fill-blank') && (
              <form onSubmit={handleTypedSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    ref={answerInputRef}
                    type="text"
                    disabled={Boolean(currentRecord)}
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="flex-1 px-4 py-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-base text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] disabled:opacity-70"
                  />
                  {!currentRecord && (
                    <button
                      type="submit"
                      disabled={!typedAnswer.trim()}
                      className="px-5 py-3 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Check Answer
                    </button>
                  )}
                </div>

                {!currentRecord && (
                  <DiacriticBar
                    langCode={currentQuestion.langCode}
                    defaultPresetId={
                      sessionConfig.mode === 'fill-blank' ||
                      currentQuestion.direction === 'translation-to-word'
                        ? undefined
                        : 'az-AZ'
                    }
                    onInsert={handleInsertDiacritic}
                  />
                )}
              </form>
            )}

            {currentRecord && (
              <div className="pt-4 border-t border-slate-200 dark:border-[#2E2A25] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  {currentRecord.status === 'exact' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : currentRecord.status === 'typo' ? (
                    <Check className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    {currentRecord.status === 'exact' && (
                      <div className="space-y-0.5">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                          Correct!
                        </span>
                        {sessionConfig.mode === 'true-false' && !currentQuestion.isTrueStatement && (
                          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                            Actual answer:{' '}
                            <strong className="text-[#1C1917] dark:text-[#F5F2EC] select-text">
                              {currentQuestion.expectedAnswer}
                            </strong>
                          </p>
                        )}
                      </div>
                    )}
                    {currentRecord.status === 'typo' && (
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[#B45309] dark:text-[#F59E0B]">
                          Accepted (1-character typo)
                        </span>
                        <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                          Exact spelling:{' '}
                          <strong className="text-[#1C1917] dark:text-[#F5F2EC] select-text">
                            {currentQuestion.expectedAnswer}
                          </strong>
                        </p>
                      </div>
                    )}
                    {(currentRecord.status === 'incorrect' || currentRecord.status === 'timeout') && (
                      <div className="space-y-0.5">
                        <span className="font-semibold text-red-800 dark:text-red-300">
                          {currentRecord.status === 'timeout' ? 'Time expired' : 'Incorrect'}
                        </span>
                        <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                          Actual answer:{' '}
                          <strong className="text-[#1C1917] dark:text-[#F5F2EC] select-text">
                            {currentQuestion.expectedAnswer}
                          </strong>
                          {currentQuestion.hintText && (
                            <span> (base: {currentQuestion.hintText})</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1C1917] hover:bg-[#292524] dark:bg-[#F5F2EC] dark:hover:bg-[#E6E1D8] text-white dark:text-[#121110] text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  {currentIdx + 1 >= questions.length ? 'View Results' : 'Next Question'}
                  <span className="font-mono text-xs opacity-70">Enter</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  const accuracyPct =
    records.length > 0 ? Math.round((scoreCount / records.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        type="button"
        onClick={onBackToWorkspace}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Decks</span>
      </button>

      <motion.section
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl p-6 sm:p-8 space-y-6"
      >
        <CelebrationBurst active />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#2E2A25]">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              Quiz Results
            </h1>
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
              {accuracyPct >= 80
                ? 'Strong recall across this session — intervals updated.'
                : 'Missed words have been prioritized in your Leitner review queue.'}
            </p>
          </div>
          <div className="font-mono text-4xl font-semibold text-[#B45309] dark:text-[#F59E0B] tabular-nums">
            {accuracyPct}%
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center tabular-nums">
          <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25]">
            <div className="font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {scoreCount}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">
              Correct{typoCount > 0 ? ` (${typoCount} typo)` : ''}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25]">
            <div className="font-mono text-2xl font-semibold text-red-700 dark:text-red-400">
              {missedRecords.length}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">Missed</div>
          </div>
          <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25]">
            <div className="font-mono text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              {records.length}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">Total</div>
          </div>
          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
            <div className="font-mono text-2xl font-semibold text-orange-700 dark:text-orange-400 inline-flex items-center justify-center gap-1">
              <Flame className="w-5 h-5" />
              {bestStreak}
            </div>
            <div className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-0.5">Best Streak</div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 pt-1">
          {missedRecords.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const missedCards = missedRecords.map((r) => r.question.card);
                startWithPool(missedCards, missedCards.length);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Review Mistakes ({missedRecords.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const selectedPool = cards
                .filter((c) => sessionConfig.deckIds.includes(c.deckId))
                .filter((c) => matchesDifficultyFilter(c, sessionConfig.difficultyFilter))
                .filter((c) => !sessionConfig.dueOnly || isCardDue(c))
                .filter(
                  (c) =>
                    sessionConfig.leechFilter === 'exclude'
                      ? !isLeechCard(c)
                      : sessionConfig.leechFilter === 'only'
                        ? isLeechCard(c)
                        : true
                );
              const eligible = getEligiblePool(selectedPool, sessionConfig.mode);
              startWithPool(eligible, Math.min(sessionConfig.questionCount, eligible.length));
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C1917] hover:bg-[#292524] dark:bg-[#F5F2EC] dark:hover:bg-[#E6E1D8] text-white dark:text-[#121110] text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Retake Quiz
          </button>
          <button
            type="button"
            onClick={onOpenSetup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] transition-colors"
          >
            New Setup
          </button>
        </div>
      </motion.section>

      <section className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2E2A25]">
          <h2 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
            Answer Breakdown
          </h2>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-[#2E2A25]">
          {records.map((rec, idx) => (
            <div key={`${rec.question.id}-${idx}`} className="px-5 py-3.5 space-y-1">
              <div className="flex items-center gap-2">
                {rec.status === 'exact' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                ) : rec.status === 'typo' ? (
                  <Check className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                )}
                <span className="font-display font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                  {rec.question.blankedSentence || rec.question.promptText}
                </span>
                {rec.question.proposedMatch && (
                  <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                    → “{rec.question.proposedMatch}”
                  </span>
                )}
              </div>
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E] pl-6">
                Expected:{' '}
                <span className="font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                  {rec.question.expectedAnswer}
                </span>
                {!rec.isCorrect && (
                  <>
                    {' · '}
                    Your answer:{' '}
                    <span className="text-red-700 dark:text-red-400">
                      {rec.userAnswer || (rec.status === 'timeout' ? '(Timed out)' : '(Blank)')}
                    </span>
                  </>
                )}
                {rec.status === 'typo' && (
                  <>
                    {' · '}
                    <span className="text-[#B45309] dark:text-[#F59E0B]">
                      Typed “{rec.userAnswer}” (accepted with 1-char typo)
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
