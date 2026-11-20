import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, AudioLines, CalendarClock, Keyboard, MicOff, Monitor, Moon, Plus, Settings2, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { DeckWorkspace } from './components/DeckWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FlashcardStudy } from './components/FlashcardStudy';
import { LanguageScreen } from './components/LanguageScreen';
import { OverviewStrip } from './components/OverviewStrip';
import { ActivitySection } from './components/ActivitySection';
import { QuizCenter } from './components/QuizCenter';
import { QuizSetupModal } from './components/QuizSetupModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ToastContainer } from './components/Toast';
import { PRESET_LANGUAGES, SEED_CARDS, SEED_DECKS } from './data/seedDecks';
import {
  ActivityDay,
  AppPrefs,
  AppStage,
  ConfidenceLevel,
  Deck,
  DifficultyLevel,
  LanguageItem,
  QuizMode,
  QuizSessionSummary,
  SessionCompletionSummary,
  SessionConfig,
  SessionRecord,
  SmartDeck,
  SmartDeckFilter,
  StudyStats,
  ThemeMode,
  ToastMessage,
  VocabCard,
} from './types';
import { cleanupAudioContext } from './utils/soundEffects';
import { preloadVoices, stopSpeaking } from './utils/speechUtils';
import {
  applySrsOutcome,
  getReviewForecast,
  getSmartDeckCards,
  getSmartReviewCards,
  graduateLeechCard,
  isCardDue,
  isLeechCard,
} from './utils/srs';
import {
  applyStudyActivity,
  buildBackupPayload,
  createId,
  exportFullBackupJson,
  getLocalDateString,
  parseBackupJson,
} from './utils/storage';
import {
  addCard,
  addDeck,
  addLanguage,
  addSessionRecord,
  addSmartDeck,
  clearAllData,
  deleteCard as dbDeleteCard,
  deleteCardsByIds,
  deleteDeck as dbDeleteDeck,
  deleteCardsByDeck,
  deleteCardsByDecks,
  deleteDecksByLanguage,
  deleteLanguage as dbDeleteLanguage,
  deleteSmartDeck as dbDeleteSmartDeck,
  deleteSmartDecksByLanguage,
  getActivityHistory,
  getAllCards,
  getAllDecks,
  getAllLanguages,
  getAppPrefs,
  getSfxMuted,
  getSessionHistory,
  getSmartDecks,
  getStats,
  getTheme,
  getTtsMuted,
  initializeDatabase,
  markSeedCompleted,
  putActivityDay,
  putCards,
  resetStudyProgress,
  saveAppPrefs,
  saveSfxMuted,
  saveStats,
  saveTheme,
  saveTtsMuted,
  updateCard,
  updateDeck,
  updateLanguage,
} from './utils/indexedDB';

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((i) => i.id));
  return [...incoming, ...existing.filter((e) => !incomingIds.has(e.id))];
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [studyStats, setStudyStats] = useState<StudyStats>({
    streakDays: 0,
    lastStudyDate: null,
    totalQuizAnswered: 0,
    totalQuizCorrect: 0,
    bestQuizStreak: 0,
  });

  const [stage, setStage] = useState<AppStage>('workspace');
  const [activeLanguageId, setActiveLanguageId] = useState<string>('');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');

  const [activeSession, setActiveSession] = useState<SessionConfig | null>(null);
  const [quizSetupOpen, setQuizSetupOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [setupInitialDeckId, setSetupInitialDeckId] = useState<string | undefined>(
    undefined
  );
  const [addWordsTrigger, setAddWordsTrigger] = useState(0);

  const [theme, setTheme] = useState<ThemeMode>('light');
  const [sfxMuted, setSfxMuted] = useState<boolean>(false);
  const [ttsMuted, setTtsMuted] = useState<boolean>(false);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [smartDecks, setSmartDecks] = useState<SmartDeck[]>([]);
  const [dueBannerDismissedFor, setDueBannerDismissedFor] = useState<string>('');
  const [appPrefs, setAppPrefs] = useState<AppPrefs>({
    showToasts: true,
    autoAdvance: false,
    defaultTimerSeconds: 0,
    autoSpeakPrompt: false,
    autoSpeakAnswer: false,
    reminderEnabled: false,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimeoutsRef = useRef<Set<number>>(new Set());

  // Initialize IndexedDB and load initial data
  useEffect(() => {
    preloadVoices();
    async function init() {
      try {
        await initializeDatabase();
        const [
          loadedLanguages,
          loadedDecks,
          loadedCards,
          loadedStats,
          loadedTheme,
          loadedSfxMuted,
          loadedTtsMuted,
          loadedActivity,
          loadedPrefs,
          loadedSessions,
          loadedSmartDecks,
        ] = await Promise.all([
          getAllLanguages(),
          getAllDecks(),
          getAllCards(),
          getStats(),
          getTheme(),
          getSfxMuted(),
          getTtsMuted(),
          getActivityHistory(),
          getAppPrefs(),
          getSessionHistory(50),
          getSmartDecks(),
        ]);

        setLanguages(loadedLanguages);
        setDecks(loadedDecks);
        setCards(loadedCards);
        setStudyStats(loadedStats);
        setTheme(loadedTheme);
        setSfxMuted(loadedSfxMuted);
        setTtsMuted(loadedTtsMuted);
        setActivity(loadedActivity);
        setSessions(loadedSessions);
        setSmartDecks(loadedSmartDecks);
        setAppPrefs(loadedPrefs);

        setActiveLanguageId(loadedLanguages[0]?.id ?? PRESET_LANGUAGES[0].id);
        setSelectedDeckId(loadedDecks[0]?.id ?? '');
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Keep the app usable even if IndexedDB is unavailable (e.g. private mode)
        setLanguages(PRESET_LANGUAGES);
        setDecks(SEED_DECKS);
        setCards(SEED_CARDS);
        setActiveLanguageId(PRESET_LANGUAGES[0].id);
        setSelectedDeckId(SEED_DECKS[0]?.id ?? '');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Persist data to IndexedDB when state changes
  useEffect(() => {
    if (isLoading) return;
    saveStats(studyStats).catch(console.error);
  }, [studyStats, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    saveTheme(theme).catch(console.error);
  }, [theme, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    saveSfxMuted(sfxMuted).catch(console.error);
  }, [sfxMuted, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    saveTtsMuted(ttsMuted).catch(console.error);
  }, [ttsMuted, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    saveAppPrefs(appPrefs).catch(console.error);
  }, [appPrefs, isLoading]);

  // Apply theme to document — 'system' follows prefers-color-scheme live
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => root.classList.toggle('dark', mq.matches);
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Cleanup audio context and speech on unmount
  useEffect(() => {
    return () => {
      cleanupAudioContext();
      stopSpeaking();
    };
  }, []);

  // Optional browser reminders: at most one Notification per day, only when
  // cards are actually due and permission was granted in Settings.
  useEffect(() => {
    if (
      !appPrefs.reminderEnabled ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    const maybeNotify = () => {
      const due = getReviewForecast(cards).today;
      if (due <= 0) return;
      const today = getLocalDateString();
      if (localStorage.getItem('noor_last_review_reminder') === today) return;
      localStorage.setItem('noor_last_review_reminder', today);
      try {
        const notification = new Notification('Noor Language Studio', {
          body: `${due} ${due === 1 ? 'card is' : 'cards are'} due for review today.`,
        });
        notification.onclick = () => window.focus();
      } catch {
        // Notification constructor can throw in restricted contexts
      }
    };
    maybeNotify();
    const intervalId = window.setInterval(maybeNotify, 30 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [appPrefs.reminderEnabled, cards]);

  const activeLanguage = useMemo(
    () =>
      languages.find((l) => l.id === activeLanguageId) ??
      languages[0] ??
      PRESET_LANGUAGES[0],
    [languages, activeLanguageId]
  );

  // Scope decks and cards strictly to the active language workspace
  const languageDecks = useMemo(
    () => decks.filter((d) => d.languageId === activeLanguage.id),
    [decks, activeLanguage.id]
  );

  const languageCards = useMemo(() => {
    const deckIds = new Set(languageDecks.map((d) => d.id));
    return cards.filter((c) => deckIds.has(c.deckId));
  }, [cards, languageDecks]);

  const languageSmartDecks = useMemo(
    () => smartDecks.filter((s) => s.languageId === activeLanguage.id),
    [smartDecks, activeLanguage.id]
  );

  // Due-today count for the workspace entry banner
  const dueTodayCount = useMemo(
    () => getReviewForecast(languageCards).today,
    [languageCards]
  );
  const showDueBanner =
    stage === 'workspace' &&
    !activeSession &&
    dueTodayCount > 0 &&
    dueBannerDismissedFor !== getLocalDateString();

  // TTS voice binding for the active language
  const activeVoice = useMemo(
    () => ({
      name: activeLanguage.voiceName,
      lang: activeLanguage.voiceLang,
      disabled: activeLanguage.voiceDisabled,
    }),
    [activeLanguage]
  );

  const notify = useCallback(
    (
      text: string,
      variant: 'success' | 'info' | 'error' = 'info',
      action?: { label: string; onAction: () => void }
    ) => {
      // Non-critical toasts can be muted in Settings; errors and actionable
      // toasts (e.g. Undo) always show.
      if (!appPrefs.showToasts && variant !== 'error' && !action) return;
      const id = createId('toast');
      setToasts((prev) => [
        ...prev.slice(-2),
        { id, text, variant, actionLabel: action?.label, onAction: action?.onAction },
      ]);
      // Action toasts (e.g. Undo) stay visible longer
      const timeoutId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        toastTimeoutsRef.current.delete(timeoutId);
      }, action ? 8000 : 3400);
      toastTimeoutsRef.current.add(timeoutId);
    },
    [appPrefs.showToasts]
  );

  // Cleanup all toast timeouts on unmount
  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTheme = () => {
    // Header quick-toggle cycles light -> dark -> system -> light
    setTheme((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'));
  };

  const toggleSfxMute = () => {
    setSfxMuted((prev) => !prev);
  };

  const toggleTtsMute = () => {
    setTtsMuted((prev) => {
      const next = !prev;
      if (next) stopSpeaking();
      return next;
    });
  };

  const handleResetSettings = () => {
    setTheme('light');
    setSfxMuted(false);
    setTtsMuted(false);
    setAppPrefs({
      showToasts: true,
      autoAdvance: false,
      defaultTimerSeconds: 0,
      autoSpeakPrompt: false,
      autoSpeakAnswer: false,
      reminderEnabled: false,
    });
    notify('Settings reset to defaults', 'success');
  };

  // Wipe study progress (stats, activity, session history, per-card SRS)
  // while keeping content
  const handleResetStatistics = useCallback(async () => {
    const resetCards = await resetStudyProgress();
    setCards(resetCards);
    setActivity([]);
    setSessions([]);
    setStudyStats((prev) => ({
      ...prev,
      streakDays: 0,
      lastStudyDate: null,
      totalQuizAnswered: 0,
      totalQuizCorrect: 0,
      bestQuizStreak: 0,
    }));
    notify('Study statistics reset — progress history cleared', 'success');
  }, [notify]);

  // Record daily study activity (reviews / quizzes) into IndexedDB
  const bumpActivity = useCallback(
    (delta: { reviews?: number; quizzes?: number; correct?: number; cardsAdded?: number }) => {
      const date = getLocalDateString();
      setActivity((prev) => {
        const existing = prev.find((d) => d.date === date);
        const nextDay: ActivityDay = {
          date,
          reviews: (existing?.reviews ?? 0) + (delta.reviews ?? 0),
          quizzes: (existing?.quizzes ?? 0) + (delta.quizzes ?? 0),
          correct: (existing?.correct ?? 0) + (delta.correct ?? 0),
          cardsAdded: (existing?.cardsAdded ?? 0) + (delta.cardsAdded ?? 0),
        };
        putActivityDay(nextDay).catch(console.error);
        return existing
          ? prev.map((d) => (d.date === date ? nextDay : d))
          : [...prev, nextDay];
      });
    },
    []
  );

  // Stage Navigation Handlers
  const handleEnterLanguage = useCallback(
    (languageId: string) => {
      const firstDeckForLang = decks.find((d) => d.languageId === languageId);
      setActiveLanguageId(languageId);
      setSelectedDeckId(firstDeckForLang?.id ?? '');
      setActiveSession(null);
      setQuizSetupOpen(false);
      setStage('workspace');
    },
    [decks]
  );

  const handleAddCustomLanguage = useCallback(
    async (data: {
      name: string;
      nativeLabel: string;
      code: string;
      voiceName?: string;
      voiceLang?: string;
      voiceDisabled?: boolean;
    }): Promise<LanguageItem> => {
      const newLang: LanguageItem = {
        id: createId('lang'),
        name: data.name,
        nativeLabel: data.nativeLabel,
        code: data.code,
        isCustom: true,
        createdAt: new Date().toISOString(),
        voiceName: data.voiceName,
        voiceLang: data.voiceLang,
        voiceDisabled: data.voiceDisabled,
      };
      await addLanguage(newLang);
      setLanguages((prev) => [...prev, newLang]);
      notify(`Added "${newLang.name}" to your languages`, 'success');
      return newLang;
    },
    [notify]
  );

  const handleUpdateLanguage = useCallback(
    async (
      languageId: string,
      updates: Partial<{
        name: string;
        nativeLabel: string;
        code: string;
        voiceName?: string;
        voiceLang?: string;
        voiceDisabled?: boolean;
        pinned?: boolean;
      }>
    ) => {
      await updateLanguage(languageId, updates);
      setLanguages((prev) =>
        prev.map((l) => (l.id === languageId ? { ...l, ...updates } : l))
      );
    },
    []
  );

  const handleDeleteLanguage = useCallback(
    async (languageId: string) => {
      const target = languages.find((l) => l.id === languageId);
      if (!target) return;
      if (languages.length <= 1) {
        notify('You must keep at least one language', 'error');
        return;
      }

      const removedDecks = decks.filter((d) => d.languageId === languageId);
      const removedDeckIds = new Set(removedDecks.map((d) => d.id));
      const removedCards = cards.filter((c) => removedDeckIds.has(c.deckId));
      const removedSmartDecks = smartDecks.filter((s) => s.languageId === languageId);
      const wasActive = activeLanguageId === languageId;
      const remaining = languages.filter((l) => l.id !== languageId);
      const nextActiveId = wasActive ? remaining[0]?.id ?? '' : activeLanguageId;
      await Promise.all([
        dbDeleteLanguage(languageId),
        deleteDecksByLanguage(languageId),
        deleteCardsByDecks([...removedDeckIds]),
        deleteSmartDecksByLanguage(languageId),
      ]);
      setLanguages(remaining);
      setDecks((prev) => prev.filter((d) => d.languageId !== languageId));
      setCards((prev) => prev.filter((c) => !removedDeckIds.has(c.deckId)));
      setSmartDecks((prev) => prev.filter((s) => s.languageId !== languageId));
      if (selectedDeckId && removedDeckIds.has(selectedDeckId)) {
        setSelectedDeckId('');
      }
      if (activeSession && activeSession.deckIds.some((id) => removedDeckIds.has(id))) {
        setActiveSession(null);
      }
      if (wasActive) {
        setActiveLanguageId(nextActiveId);
        setStage('languages');
      }
      notify(`Removed "${target.name}"`, 'info', {
        label: 'Undo',
        onAction: () => {
          void Promise.all([
            addLanguage(target),
            ...removedDecks.map((d) => addDeck(d)),
            putCards(removedCards),
            ...removedSmartDecks.map((s) => addSmartDeck(s)),
          ])
            .then(() => {
              setLanguages((prev) => [
                target,
                ...prev.filter((l) => l.id !== target.id),
              ]);
              setDecks((prev) => [
                ...removedDecks,
                ...prev.filter((d) => !removedDeckIds.has(d.id)),
              ]);
              setCards((prev) => [
                ...removedCards,
                ...prev.filter((c) => !removedDeckIds.has(c.deckId)),
              ]);
              setSmartDecks((prev) => [
                ...removedSmartDecks,
                ...prev.filter((s) => s.languageId !== target.id),
              ]);
              if (wasActive) setActiveLanguageId(target.id);
            })
            .catch(console.error);
        },
      });
    },
    [languages, decks, cards, smartDecks, selectedDeckId, activeSession, activeLanguageId, notify]
  );

  // Deck CRUD handlers (scoped to activeLanguage.id)
  const handleCreateDeck = useCallback(
    async (data: { name: string; description: string }): Promise<Deck> => {
      const now = new Date().toISOString();
      const newDeck: Deck = {
        id: createId('deck'),
        languageId: activeLanguage.id,
        name: data.name,
        description: data.description,
        createdAt: now,
        updatedAt: now,
      };
      await addDeck(newDeck);
      setDecks((prev) => [...prev, newDeck]);
      setSelectedDeckId(newDeck.id);
      return newDeck;
    },
    [activeLanguage.id]
  );

  const handleUpdateDeck = useCallback(
    async (deckId: string, updates: { name?: string; description?: string }) => {
      const now = new Date().toISOString();
      await updateDeck(deckId, { ...updates, updatedAt: now });
      setDecks((prev) =>
        prev.map((d) => (d.id === deckId ? { ...d, ...updates, updatedAt: now } : d))
      );
    },
    []
  );

  const handleDeleteDeck = useCallback(
    async (deckId: string) => {
      const removedDeck = decks.find((d) => d.id === deckId);
      const removedCards = cards.filter((c) => c.deckId === deckId);
      await Promise.all([dbDeleteDeck(deckId), deleteCardsByDeck(deckId)]);
      setDecks((prev) => {
        const nextAll = prev.filter((d) => d.id !== deckId);
        if (selectedDeckId === deckId) {
          const nextInLang = nextAll.find((d) => d.languageId === activeLanguage.id);
          setSelectedDeckId(nextInLang?.id ?? '');
        }
        return nextAll;
      });
      setCards((prev) => prev.filter((c) => c.deckId !== deckId));
      // Clear active session if it references the deleted deck
      if (activeSession && activeSession.deckIds.includes(deckId)) {
        setActiveSession(null);
      }
      if (removedDeck) {
        notify(`Deleted "${removedDeck.name}"`, 'info', {
          label: 'Undo',
          onAction: () => {
            void Promise.all([addDeck(removedDeck), putCards(removedCards)])
              .then(() => {
                setDecks((prev) => [
                  removedDeck,
                  ...prev.filter((d) => d.id !== removedDeck.id),
                ]);
                setCards((prev) => [
                  ...removedCards,
                  ...prev.filter(
                    (c) => !removedCards.some((r) => r.id === c.id)
                  ),
                ]);
                if (removedDeck.languageId === activeLanguage.id) {
                  setSelectedDeckId(removedDeck.id);
                }
              })
              .catch(console.error);
          },
        });
      }
    },
    [selectedDeckId, activeLanguage.id, activeSession, decks, cards, notify]
  );

  // Card CRUD handlers
  const handleAddCard = useCallback(
    async (
      deckId: string,
      data: {
        word: string;
        translation: string;
        exampleSentence?: string;
        difficulty?: DifficultyLevel;
        mnemonic?: string;
      }
    ) => {
      const newCard: VocabCard = {
        id: createId('card'),
        deckId,
        word: data.word,
        translation: data.translation,
        exampleSentence: data.exampleSentence,
        mnemonic: data.mnemonic?.trim() || undefined,
        confidence: 'new',
        difficulty: data.difficulty ?? 'medium',
        reviewCount: 0,
        srsBox: 1,
        streak: 0,
        lapses: 0,
        createdAt: new Date().toISOString(),
      };
      await addCard(newCard);
      setCards((prev) => [newCard, ...prev]);
      bumpActivity({ cardsAdded: 1 });
    },
    [bumpActivity]
  );

  const handleBulkAddCards = useCallback(
    async (
      deckId: string,
      items: Array<{ word: string; translation: string; exampleSentence?: string }>,
      difficulty: DifficultyLevel = 'medium'
    ) => {
      const now = new Date().toISOString();
      const created: VocabCard[] = items.map((item) => ({
        id: createId('card'),
        deckId,
        word: item.word,
        translation: item.translation,
        exampleSentence: item.exampleSentence,
        confidence: 'new',
        difficulty,
        reviewCount: 0,
        srsBox: 1,
        streak: 0,
        lapses: 0,
        createdAt: now,
      }));
      await putCards(created);
      setCards((prev) => [...created, ...prev]);
      if (created.length > 0) bumpActivity({ cardsAdded: created.length });
    },
    [bumpActivity]
  );

  const handleUpdateCard = useCallback(
    async (
      cardId: string,
      updates: {
        word: string;
        translation: string;
        exampleSentence?: string;
        difficulty?: DifficultyLevel;
        mnemonic?: string;
      }
    ) => {
      await updateCard(cardId, updates);
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const removed = cards.find((c) => c.id === cardId);
    await dbDeleteCard(cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    // Clear active session if it's a smart review and the deleted card was in the pool
    if (activeSession?.smartReviewOnly && activeSession.smartCardIds?.includes(cardId)) {
      setActiveSession(null);
    }
    if (removed) {
      notify(`Removed "${removed.word}"`, 'info', {
        label: 'Undo',
        onAction: () => {
          void addCard(removed)
            .then(() => {
              setCards((prev) => [
                removed,
                ...prev.filter((c) => c.id !== removed.id),
              ]);
            })
            .catch(console.error);
        },
      });
    }
  }, [activeSession, cards, notify]);

  const handleToggleCardSuspended = useCallback(
    async (cardId: string, suspended: boolean) => {
      const updated = cards.map((c) =>
        c.id === cardId ? { ...c, suspended } : c
      );
      setCards(updated);
      await putCards(updated.filter((c) => c.id === cardId));
      if (suspended && activeSession?.smartReviewOnly && activeSession.smartCardIds?.includes(cardId)) {
        setActiveSession(null);
      }
    },
    [activeSession, cards]
  );

  const handleRateCard = useCallback(
    (cardId: string, confidence: ConfidenceLevel) => {
      const outcome: 'hard' | 'good' | 'easy' =
        confidence === 'hard' || confidence === 'good' || confidence === 'easy'
          ? confidence
          : 'good';
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const updated = applySrsOutcome(card, outcome);
      const withMiss =
        outcome === 'hard'
          ? { ...updated, wrongCount: (card.wrongCount ?? 0) + 1 }
          : updated;
      setCards((prev) => prev.map((c) => (c.id === cardId ? withMiss : c)));
      putCards([withMiss]).catch(console.error);
      setStudyStats((prev) => applyStudyActivity(prev));
      bumpActivity({ reviews: 1 });
      return withMiss;
    },
    [cards, bumpActivity]
  );

  const handleRecordQuizAnswer = useCallback(
    (cardId: string, isCorrect: boolean, isExact: boolean) => {
      setStudyStats((prev) => applyStudyActivity(prev, { isCorrect }));
      bumpActivity({ reviews: 1, correct: isCorrect ? 1 : 0 });
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const outcome =
        !isCorrect
          ? ('hard' as const)
          : card.confidence === 'good' && isExact
            ? ('easy' as const)
            : ('good' as const);
      const srsUpdated = applySrsOutcome(card, outcome);
      const updated =
        !isCorrect
          ? { ...srsUpdated, wrongCount: (card.wrongCount ?? 0) + 1 }
          : srsUpdated;
      setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
      putCards([updated]).catch(console.error);
    },
    [cards, bumpActivity]
  );

  const handleImportDeckJson = useCallback(
    async (payload: {
      deckName: string;
      description: string;
      cards: Array<{
        word: string;
        translation: string;
        exampleSentence?: string;
        confidence: ConfidenceLevel;
        difficulty?: DifficultyLevel;
        mnemonic?: string;
      }>;
    }) => {
      const now = new Date().toISOString();
      const newDeck: Deck = {
        id: createId('deck'),
        languageId: activeLanguage.id,
        name: payload.deckName,
        description: payload.description,
        createdAt: now,
        updatedAt: now,
      };
      const importedCards: VocabCard[] = payload.cards.map((item) => ({
        id: createId('card'),
        deckId: newDeck.id,
        word: item.word,
        translation: item.translation,
        exampleSentence: item.exampleSentence,
        confidence: item.confidence,
        difficulty: item.difficulty ?? 'medium',
        mnemonic: item.mnemonic?.trim() || undefined,
        reviewCount: 0,
        srsBox: 1,
        streak: 0,
        lapses: 0,
        createdAt: now,
      }));
      await Promise.all([addDeck(newDeck), putCards(importedCards)]);
      setDecks((prev) => [...prev, newDeck]);
      setCards((prev) => [...importedCards, ...prev]);
      setSelectedDeckId(newDeck.id);
      if (importedCards.length > 0) bumpActivity({ cardsAdded: importedCards.length });
    },
    [activeLanguage.id, bumpActivity]
  );

  const openQuizSetup = useCallback((deckId?: string) => {
    setSetupInitialDeckId(deckId);
    setQuizSetupOpen(true);
  }, []);

  const handleStartSession = useCallback((config: SessionConfig) => {
    setActiveSession(config);
    setQuizSetupOpen(false);
  }, []);

  // Persist a completed session into history (state + IndexedDB)
  const recordSession = useCallback(
    (summary: SessionCompletionSummary | QuizSessionSummary) => {
      const deckNameById = new Map(decks.map((d) => [d.id, d.name]));
      const record: SessionRecord = {
        id: createId('sess'),
        mode: summary.mode,
        deckIds: activeSession?.deckIds ?? [],
        deckNames: (activeSession?.deckIds ?? []).map(
          (id) => deckNameById.get(id) ?? 'Deck'
        ),
        total: summary.total,
        correct: summary.correct,
        durationMs: summary.durationMs,
        completedAt: new Date().toISOString(),
      };
      addSessionRecord(record).catch(console.error);
      setSessions((prev) => [record, ...prev].slice(0, 50));
    },
    [decks, activeSession]
  );

  const handleQuizComplete = useCallback(
    (summary: QuizSessionSummary) => {
      setStudyStats((prev) => ({
        ...prev,
        bestQuizStreak: Math.max(prev.bestQuizStreak ?? 0, summary.bestStreak),
      }));
      bumpActivity({ quizzes: 1 });
      recordSession(summary);
    },
    [bumpActivity, recordSession]
  );

  const handleFlashcardSessionComplete = useCallback(
    (summary: SessionCompletionSummary) => {
      recordSession(summary);
    },
    [recordSession]
  );

  // Launch a targeted quiz on the weakest words (Mistake Bank)
  const handlePracticeMistakes = useCallback(
    (cardIds: string[]) => {
      if (cardIds.length === 0) return;
      const target = new Set(cardIds);
      const pool = languageCards.filter((c) => target.has(c.id));
      if (pool.length === 0) return;
      setActiveSession({
        mode: 'multiple-choice',
        deckIds: Array.from(new Set(pool.map((c) => c.deckId))),
        direction: 'word-to-translation',
        questionCount: pool.length,
        timerSeconds: 0,
        smartReviewOnly: true,
        smartCardIds: cardIds,
      });
    },
    [languageCards]
  );

  const handleDailyGoalChange = useCallback((goal: number) => {
    setStudyStats((prev) => ({ ...prev, dailyGoal: goal }));
  }, []);

  // Leech Lab graduation: the passed card already includes the SRS outcome
  // applied by the rating moments earlier, so persisting it whole is safe.
  const handleGraduateLeech = useCallback(
    (card: VocabCard) => {
      if (!isLeechCard(card)) return;
      const graduated = graduateLeechCard(card);
      const cleared = !isLeechCard(graduated);
      setCards((prev) => prev.map((c) => (c.id === card.id ? graduated : c)));
      putCards([graduated]).catch(console.error);
      if (cleared) {
        notify(`"${card.word}" graduated from leech status`, 'success');
      }
    },
    [notify]
  );

  // Launch the guided Leech Lab: flashcards over leech cards only
  const handleStartLeechLab = useCallback(() => {
    const leeches = languageCards.filter((c) => !c.suspended && isLeechCard(c));
    if (leeches.length === 0) {
      notify('No leech cards right now — nice work', 'info');
      return;
    }
    setActiveSession({
      mode: 'flashcards',
      deckIds: Array.from(new Set(leeches.map((c) => c.deckId))),
      direction: 'word-to-translation',
      questionCount: leeches.length,
      timerSeconds: 0,
      leechFilter: 'only',
      leechLab: true,
    });
  }, [languageCards, notify]);

  // One-click "Review Now" from the due-today banner
  const handleStartDueReview = useCallback(() => {
    const due = languageCards.filter((c) => !c.suspended && isCardDue(c));
    if (due.length === 0) {
      notify('Nothing due for review right now', 'info');
      return;
    }
    setActiveSession({
      mode: 'multiple-choice',
      deckIds: Array.from(new Set(due.map((c) => c.deckId))),
      direction: 'word-to-translation',
      questionCount: Math.min(due.length, 20),
      timerSeconds: 0,
      dueOnly: true,
      smartReviewOnly: true,
      smartCardIds: due.map((c) => c.id),
    });
  }, [languageCards, notify]);

  // Smart decks: saved dynamic filters over the language's cards
  const handleCreateSmartDeck = useCallback(
    async (data: { name: string; description?: string; filter: SmartDeckFilter }) => {
      const smartDeck: SmartDeck = {
        id: createId('smart'),
        languageId: activeLanguage.id,
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        createdAt: new Date().toISOString(),
        filter: data.filter,
      };
      await addSmartDeck(smartDeck);
      setSmartDecks((prev) => [...prev, smartDeck]);
      notify(`Smart deck "${smartDeck.name}" created`, 'success');
    },
    [activeLanguage.id, notify]
  );

  const handleDeleteSmartDeck = useCallback(
    async (smartDeckId: string) => {
      const removed = smartDecks.find((s) => s.id === smartDeckId);
      await dbDeleteSmartDeck(smartDeckId);
      setSmartDecks((prev) => prev.filter((s) => s.id !== smartDeckId));
      if (removed) {
        notify(`Deleted smart deck "${removed.name}"`, 'info', {
          label: 'Undo',
          onAction: () => {
            void addSmartDeck(removed)
              .then(() => {
                setSmartDecks((prev) => [
                  removed,
                  ...prev.filter((s) => s.id !== removed.id),
                ]);
              })
              .catch(console.error);
          },
        });
      }
    },
    [smartDecks, notify]
  );

  // Study a smart deck: resolve its live membership into a quiz pool
  const handleStudySmartDeck = useCallback(
    (smartDeck: SmartDeck) => {
      const pool = getSmartDeckCards(languageCards, smartDeck.filter);
      if (pool.length === 0) {
        notify(`"${smartDeck.name}" has no matching words right now`, 'info');
        return;
      }
      setActiveSession({
        mode: 'multiple-choice',
        deckIds: Array.from(new Set(pool.map((c) => c.deckId))),
        direction: 'word-to-translation',
        questionCount: Math.min(pool.length, 20),
        timerSeconds: 0,
        smartReviewOnly: true,
        smartCardIds: pool.map((c) => c.id),
      });
    },
    [languageCards, notify]
  );

  // Bulk card operations from the deck word list (multi-select)
  const handleBulkDeleteCards = useCallback(
    async (cardIds: string[]) => {
      if (cardIds.length === 0) return;
      const idSet = new Set(cardIds);
      const removed = cards.filter((c) => idSet.has(c.id));
      await deleteCardsByIds(cardIds);
      setCards((prev) => prev.filter((c) => !idSet.has(c.id)));
      if (activeSession?.smartCardIds?.some((id) => idSet.has(id))) {
        setActiveSession(null);
      }
      notify(
        `Deleted ${removed.length} ${removed.length === 1 ? 'word' : 'words'}`,
        'info',
        {
          label: 'Undo',
          onAction: () => {
            void putCards(removed)
              .then(() => {
                setCards((prev) => [
                  ...removed,
                  ...prev.filter((c) => !removed.some((r) => r.id === c.id)),
                ]);
              })
              .catch(console.error);
          },
        }
      );
    },
    [cards, activeSession, notify]
  );

  const handleBulkUpdateCards = useCallback(
    async (
      cardIds: string[],
      updates: { deckId?: string; difficulty?: DifficultyLevel }
    ) => {
      if (cardIds.length === 0) return;
      const idSet = new Set(cardIds);
      const targets = cards.filter((c) => idSet.has(c.id));
      if (targets.length === 0) return;
      const updated = targets.map((c) => ({ ...c, ...updates }));
      const byId = new Map(updated.map((c) => [c.id, c]));
      await putCards(updated);
      setCards((prev) => prev.map((c) => byId.get(c.id) ?? c));

      const movedTo = updates.deckId
        ? decks.find((d) => d.id === updates.deckId)?.name
        : undefined;
      const what = movedTo
        ? `moved to "${movedTo}"`
        : updates.difficulty
          ? `marked ${updates.difficulty}`
          : 'updated';
      notify(
        `${updated.length} ${updated.length === 1 ? 'word' : 'words'} ${what}`,
        'success',
        {
          label: 'Undo',
          onAction: () => {
            void putCards(targets)
              .then(() => {
                const origById = new Map(targets.map((c) => [c.id, c]));
                setCards((prev) =>
                  prev.map((c) => origById.get(c.id) ?? c)
                );
              })
              .catch(console.error);
          },
        }
      );
    },
    [cards, decks, notify]
  );

  const handleReminderEnabledChange = useCallback(
    (enabled: boolean) => {
      setAppPrefs((prev) => ({ ...prev, reminderEnabled: enabled }));
      if (
        enabled &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'default'
      ) {
        Notification.requestPermission().catch(() => {});
      }
    },
    []
  );

  // Full workspace backup / restore
  const handleExportAllBackup = useCallback(() => {
    exportFullBackupJson(
      buildBackupPayload({
        languages,
        decks,
        cards,
        stats: studyStats,
        activity,
      })
    );
    notify('Backup exported as JSON', 'success');
  }, [languages, decks, cards, studyStats, activity, notify]);

  const handleImportBackup = useCallback(
    async (rawText: string, mode: 'merge' | 'replace') => {
      const payload = parseBackupJson(rawText); // throws on invalid input

      if (mode === 'replace') {
        await clearAllData();
        await Promise.all([
          ...payload.languages.map((l) => addLanguage(l)),
          ...payload.decks.map((d) => addDeck(d)),
          putCards(payload.cards),
        ]);
        if (payload.stats) await saveStats(payload.stats);
        for (const day of payload.activity ?? []) {
          await putActivityDay(day);
        }
        // Prevent preset seed data from resurrecting on next launch
        await markSeedCompleted();

        setLanguages(payload.languages);
        setDecks(payload.decks);
        setCards(payload.cards);
        if (payload.stats) {
          setStudyStats((prev) => ({ ...prev, ...payload.stats }));
        }
        setActivity(payload.activity ?? []);
        setActiveSession(null);
        setQuizSetupOpen(false);

        const firstLang = payload.languages[0];
        if (firstLang) {
          setActiveLanguageId((prev) =>
            payload.languages.some((l) => l.id === prev) ? prev : firstLang.id
          );
          setSelectedDeckId((prev) =>
            payload.decks.some((d) => d.id === prev) ? prev : payload.decks[0]?.id ?? ''
          );
        }
      } else {
        // Merge: upsert every record by id, keep unrelated data intact
        await Promise.all([
          ...payload.languages.map((l) => addLanguage(l)),
          ...payload.decks.map((d) => addDeck(d)),
          putCards(payload.cards),
        ]);
        for (const day of payload.activity ?? []) {
          await putActivityDay(day);
        }

        setLanguages((prev) => mergeById(prev, payload.languages));
        setDecks((prev) => mergeById(prev, payload.decks));
        setCards((prev) => mergeById(prev, payload.cards));
        setActivity((prev) => {
          const incoming = payload.activity ?? [];
          const incomingDates = new Set(incoming.map((d) => d.date));
          return [...incoming, ...prev.filter((d) => !incomingDates.has(d.date))];
        });
      }

      notify(
        `Backup ${mode === 'replace' ? 'restored' : 'merged'} — ${payload.languages.length} languages, ${payload.decks.length} decks, ${payload.cards.length} words`,
        'success'
      );
    },
    [notify]
  );

  // "?" toggles the keyboard shortcut cheat-sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const deckNameFor = useCallback(
    (deckId: string) =>
      decks.find((d) => d.id === deckId)?.name ?? 'Vocabulary',
    [decks]
  );

  const handleStartSmartReview = useCallback(() => {
    if (languageCards.length === 0) {
      notify('No words available for review', 'info');
      return;
    }
    const { pool, mode } = getSmartReviewCards(languageCards);
    if (pool.length === 0) {
      notify('No cards due for review', 'info');
      return;
    }

    const targetDeckIds = Array.from(new Set(pool.map((c) => c.deckId)));
    const quizMode: QuizMode =
      languageCards.length >= 2 ? 'multiple-choice' : 'typing';

    setActiveSession({
      mode: quizMode,
      deckIds: targetDeckIds,
      direction: 'word-to-translation',
      questionCount: Math.min(12, pool.length),
      timerSeconds: 0,
      smartReviewOnly: true,
      smartCardIds: pool.map((c) => c.id),
    });

    if (mode === 'weak') {
      notify(`Focusing on ${pool.length} weak ${pool.length === 1 ? 'word' : 'words'}`, 'info');
    }
  }, [languageCards, notify]);

  const handleTopAddWords = () => {
    setActiveSession(null);
    setAddWordsTrigger((n) => n + 1);
  };

  const handleConsumeAddWords = useCallback(() => {
    setAddWordsTrigger(0);
  }, []);

  // Loading state while IndexedDB initializes
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#121110]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-[#B45309] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#57534E] dark:text-[#A8A29E]">Loading Noor Language Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121110] text-[#1C1917] dark:text-[#F5F2EC] transition-colors">
      {/* Ultra-Minimal Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 bg-[#FAF8F5]/95 dark:bg-[#121110]/95 backdrop-blur-xs border-b border-slate-200 dark:border-[#2E2A25]">
        {stage !== 'workspace' ? (
          <div className="max-w-4xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStage('workspace')}
              className="font-display text-lg font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EC] whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              <img
                src="/icon.png"
                alt=""
                className="w-7 h-7 rounded-lg object-cover shrink-0"
              />
              Noor Language Studio
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleSfxMute}
                aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                title={sfxMuted ? 'Sound effects muted' : 'Sound effects on'}
                className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                {sfxMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleTtsMute}
                aria-label={ttsMuted ? 'Enable pronunciation audio' : 'Disable pronunciation audio'}
                title={ttsMuted ? 'Pronunciation audio off' : 'Pronunciation audio on'}
                className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                {ttsMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <AudioLines className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
                className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                <Keyboard className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
                className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === 'light'
                    ? 'Switch to dark mode'
                    : theme === 'dark'
                      ? 'Switch to system theme'
                      : 'Switch to light mode'
                }
                className="p-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-[#F59E0B]" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            {/* Left: "← Languages" + Current Language Title + Subtle Brand */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  setStage('languages');
                }}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Languages</span>
              </button>

              <span className="text-slate-300 dark:text-[#2E2A25]" aria-hidden="true">
                /
              </span>

              <button
                type="button"
                onClick={() => setActiveSession(null)}
                className="font-display text-base sm:text-lg font-semibold text-[#1C1917] dark:text-[#F5F2EC] truncate text-left"
              >
                {activeLanguage.name}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  setStage('languages');
                }}
                className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] whitespace-nowrap shrink-0 pl-2"
              >
                <img
                  src="/icon.png"
                  alt=""
                  className="w-4 h-4 rounded object-cover"
                />
                Noor Language Studio
              </button>
            </div>

            {/* Right: "+ Add Words" + Prominent "Start Quiz" + Subtle SFX Mute & Theme Icons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleTopAddWords}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] hover:border-[#B45309] text-xs sm:text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Words</span>
              </button>

              <button
                type="button"
                disabled={languageCards.length === 0}
                onClick={() => openQuizSetup(selectedDeckId || undefined)}
                className="px-4 py-1.5 sm:py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              >
                Start Quiz
              </button>

              <button
                type="button"
                onClick={toggleSfxMute}
                aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                title={sfxMuted ? 'Sound effects muted' : 'Sound effects on'}
                className="p-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                {sfxMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={toggleTtsMute}
                aria-label={ttsMuted ? 'Enable pronunciation audio' : 'Disable pronunciation audio'}
                title={ttsMuted ? 'Pronunciation audio off' : 'Pronunciation audio on'}
                className="p-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                {ttsMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <AudioLines className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
                className="p-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                <Keyboard className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
                className="p-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                className="p-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors shrink-0"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4 text-[#F59E0B]" />
                )}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Single Centered Container */}
      <div className="flex-1 w-full">
        <AnimatePresence mode="wait">
          {stage === 'languages' && (
            <motion.main
              key="stage-languages"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
            >
              <ErrorBoundary>
                <LanguageScreen
                  languages={languages}
                  decks={decks}
                  cards={cards}
                  onSelectLanguage={handleEnterLanguage}
                  onAddCustomLanguage={handleAddCustomLanguage}
                  onUpdateLanguage={handleUpdateLanguage}
                  onDeleteLanguage={handleDeleteLanguage}
                  onExportBackup={handleExportAllBackup}
                  onImportBackup={handleImportBackup}
                />
              </ErrorBoundary>
            </motion.main>
          )}

          {stage === 'workspace' && (
            <motion.main
              key={`stage-workspace-${activeLanguage.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
            >
              {!activeSession && (
                <div className="space-y-10">
                  {showDueBanner && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CalendarClock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                        <p className="text-sm text-amber-900 dark:text-amber-200 truncate">
                          <span className="font-semibold tabular-nums">{dueTodayCount}</span>{' '}
                          {dueTodayCount === 1 ? 'card is' : 'cards are'} due for review today
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleStartDueReview}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
                        >
                          Review Now
                        </button>
                        <button
                          type="button"
                          onClick={() => setDueBannerDismissedFor(getLocalDateString())}
                          aria-label="Dismiss due review reminder"
                          className="p-1.5 rounded-lg text-amber-700/70 dark:text-amber-400/70 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  <OverviewStrip
                    languageId={activeLanguage.id}
                    decks={languageDecks}
                    cards={languageCards}
                    stats={studyStats}
                    onStartSmartReview={handleStartSmartReview}
                    onboardingDismissed={appPrefs.onboardingDismissed ?? false}
                    onDismissOnboarding={() =>
                      setAppPrefs((prev) => ({ ...prev, onboardingDismissed: true }))
                    }
                  />
                  <ActivitySection
                    activity={activity}
                    dailyGoal={studyStats.dailyGoal ?? 20}
                    onDailyGoalChange={handleDailyGoalChange}
                    cards={languageCards}
                    deckNameFor={deckNameFor}
                    onPracticeMistakes={handlePracticeMistakes}
                    sessions={sessions}
                    onStartLeechLab={handleStartLeechLab}
                  />
                  <ErrorBoundary>
                    <DeckWorkspace
                      languageName={activeLanguage.name}
                      languageCode={activeLanguage.code}
                      decks={languageDecks}
                      cards={languageCards}
                      selectedDeckId={selectedDeckId}
                      addWordsTrigger={addWordsTrigger}
                      onConsumeAddWords={handleConsumeAddWords}
                      onSelectDeck={setSelectedDeckId}
                      onCreateDeck={handleCreateDeck}
                      onUpdateDeck={handleUpdateDeck}
                      onDeleteDeck={handleDeleteDeck}
                      onAddCard={handleAddCard}
                      onBulkAddCards={handleBulkAddCards}
                      onUpdateCard={handleUpdateCard}
                      onDeleteCard={handleDeleteCard}
                      onToggleCardSuspended={handleToggleCardSuspended}
                      onBulkDeleteCards={handleBulkDeleteCards}
                      onBulkUpdateCards={handleBulkUpdateCards}
                      onImportDeckJson={handleImportDeckJson}
                      onPracticeDeck={(deckId) => openQuizSetup(deckId)}
                      smartDecks={languageSmartDecks}
                      onCreateSmartDeck={handleCreateSmartDeck}
                      onDeleteSmartDeck={handleDeleteSmartDeck}
                      onStudySmartDeck={handleStudySmartDeck}
                      onNotify={notify}
                      ttsMuted={ttsMuted}
                      voice={activeVoice}
                    />
                  </ErrorBoundary>
                </div>
              )}

              {activeSession && activeSession.mode === 'flashcards' && (
                <ErrorBoundary>
                  <FlashcardStudy
                    decks={languageDecks}
                    cards={languageCards}
                    sessionConfig={activeSession}
                    sfxMuted={sfxMuted}
                    onRateCard={handleRateCard}
                    onOpenSetup={() => openQuizSetup(activeSession.deckIds[0])}
                    onBackToWorkspace={() => setActiveSession(null)}
                    ttsMuted={ttsMuted}
                    langCode={activeLanguage.code}
                    voice={activeVoice}
                    autoSpeakPrompt={appPrefs.autoSpeakPrompt}
                    autoSpeakAnswer={appPrefs.autoSpeakAnswer}
                    onSessionComplete={handleFlashcardSessionComplete}
                    onGraduateLeech={handleGraduateLeech}
                  />
                </ErrorBoundary>
              )}

              {activeSession && activeSession.mode !== 'flashcards' && (
                <ErrorBoundary>
                  <QuizCenter
                    languageCode={activeLanguage.code}
                    decks={languageDecks}
                    cards={languageCards}
                    sessionConfig={
                      activeSession as SessionConfig & { mode: QuizMode }
                    }
                    sfxMuted={sfxMuted}
                    onRecordAnswer={handleRecordQuizAnswer}
                    onQuizComplete={handleQuizComplete}
                    onOpenSetup={() => openQuizSetup(activeSession.deckIds[0])}
                    onBackToWorkspace={() => setActiveSession(null)}
                    ttsMuted={ttsMuted}
                    voice={activeVoice}
                    autoAdvance={appPrefs.autoAdvance}
                    autoSpeakPrompt={appPrefs.autoSpeakPrompt}
                    autoSpeakAnswer={appPrefs.autoSpeakAnswer}
                  />
                </ErrorBoundary>
              )}
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      <QuizSetupModal
        open={stage === 'workspace' && quizSetupOpen}
        languageName={activeLanguage.name}
        languageCode={activeLanguage.code}
        voice={activeVoice}
        decks={languageDecks}
        cards={languageCards}
        initialDeckId={setupInitialDeckId}
        initialMode={activeSession?.mode ?? 'multiple-choice'}
        defaultTimerSeconds={appPrefs.defaultTimerSeconds}
        onClose={() => setQuizSetupOpen(false)}
        onStartSession={handleStartSession}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        soundEffectsEnabled={!sfxMuted}
        onSoundEffectsChange={(enabled) => setSfxMuted(!enabled)}
        speechEnabled={!ttsMuted}
        onSpeechChange={(enabled) => {
          setTtsMuted(!enabled);
          if (!enabled) stopSpeaking();
        }}
        showToasts={appPrefs.showToasts}
        onShowToastsChange={(enabled) =>
          setAppPrefs((prev) => ({ ...prev, showToasts: enabled }))
        }
        autoAdvance={appPrefs.autoAdvance}
        onAutoAdvanceChange={(enabled) =>
          setAppPrefs((prev) => ({ ...prev, autoAdvance: enabled }))
        }
        defaultTimerSeconds={appPrefs.defaultTimerSeconds}
        onDefaultTimerChange={(seconds) =>
          setAppPrefs((prev) => ({ ...prev, defaultTimerSeconds: seconds }))
        }
        onResetDefaults={handleResetSettings}
        onResetStatistics={handleResetStatistics}
        autoSpeakPrompt={appPrefs.autoSpeakPrompt}
        onAutoSpeakPromptChange={(enabled) =>
          setAppPrefs((prev) => ({ ...prev, autoSpeakPrompt: enabled }))
        }
        autoSpeakAnswer={appPrefs.autoSpeakAnswer}
        onAutoSpeakAnswerChange={(enabled) =>
          setAppPrefs((prev) => ({ ...prev, autoSpeakAnswer: enabled }))
        }
        reminderEnabled={appPrefs.reminderEnabled}
        onReminderChange={handleReminderEnabledChange}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
    </ErrorBoundary>
  );
}
