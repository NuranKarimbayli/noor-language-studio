import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AudioLines, CalendarClock, Keyboard, Menu, MicOff, Monitor, Moon, PanelLeft, Plus, Search, Settings2, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { CommandPalette, type PaletteActionId } from './components/CommandPalette';
import { DeckWorkspace } from './components/DeckWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FlashcardStudy } from './components/FlashcardStudy';
import { LanguageScreen } from './components/LanguageScreen';
import { NotesPanel } from './components/NotesPanel';
import { OnboardingChecklist } from './components/OnboardingChecklist';
import { OverviewStrip } from './components/OverviewStrip';
import { ActivitySection } from './components/ActivitySection';
import { QuizCenter } from './components/QuizCenter';
import { QuizLauncher } from './components/QuizLauncher';
import { QuizSetupModal } from './components/QuizSetupModal';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/Toast';
import { WordOfTheDay } from './components/WordOfTheDay';
import { PRESET_LANGUAGES, SEED_CARDS, SEED_DECKS } from './data/seedDecks';
import {
  ActivityDay,
  AppPrefs,
  AppStage,
  ConfidenceLevel,
  Deck,
  DifficultyLevel,
  LanguageItem,
  MasterySnapshot,
  Note,
  QuizMode,
  QuizResumeState,
  QuizSessionSummary,
  SessionCompletionSummary,
  SessionConfig,
  SessionMode,
  FlashcardResumeState,
  SessionRecord,
  SmartDeck,
  SmartDeckFilter,
  StudyStats,
  ThemeMode,
  ToastMessage,
  VocabCard,
  WorkspaceView,
} from './types';
import { cleanupAudioContext } from './utils/soundEffects';
import { preloadVoices, stopSpeaking } from './utils/speechUtils';
import {
  applySrsOutcome,
  getDeckMastery,
  getReviewForecast,
  getSmartDeckCards,
  getSmartReviewCards,
  graduateLeechCard,
  isCardDue,
  isLeechCard,
} from './utils/srs';
import {
  clearAllResumeSessions,
  clearFlashcardResume,
  clearQuizResume,
  loadFlashcardResume,
  loadQuizResume,
} from './utils/sessionResume';
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
  deleteCard as dbDeleteCard,
  deleteCardsByIds,
  deleteDeck as dbDeleteDeck,
  deleteCardsByDeck,
  deleteCardsByDecks,
  deleteDecksByLanguage,
  deleteLanguage as dbDeleteLanguage,
  deleteSmartDeck as dbDeleteSmartDeck,
  deleteSmartDecksByLanguage,
  deleteNote as dbDeleteNote,
  getActivityHistory,
  getAllCards,
  getMasterySnapshots,
  putMasterySnapshot,
  getAllDecks,
  getAllLanguages,
  getAllNotes,
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
  putNote,
  putSessionRecords,
  resetStudyProgress,
  restoreBackupData,
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

// Minimal typing for the PWA install prompt event (not in lib.dom yet)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** ISO-8601 week key (e.g. "2026-W47") for weekly mastery snapshots. */
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftd + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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
  const [createDeckTrigger, setCreateDeckTrigger] = useState(0);

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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('words');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizSetupMode, setQuizSetupMode] = useState<SessionMode | undefined>(
    undefined
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notesFocusId, setNotesFocusId] = useState<string | null>(null);
  const [quizResumeState, setQuizResumeState] = useState<QuizResumeState | null>(null);
  const [flashResumeState, setFlashResumeState] = useState<FlashcardResumeState | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [masterySnapshots, setMasterySnapshots] = useState<MasterySnapshot[]>([]);
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
          loadedNotes,
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
          getAllNotes(),
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
        setNotes(loadedNotes);
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

  // Listening mode requires a usable native voice for this language
  const voiceReady = useMemo(
    () => !!activeVoice.name && activeVoice.disabled !== true,
    [activeVoice]
  );

  const leechCount = useMemo(
    () => languageCards.filter((c) => !c.suspended && isLeechCard(c)).length,
    [languageCards]
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

  // Starting any study session discards stale resume snapshots — the new
  // session's own progress is what should be resumable from now on.
  const beginSession = useCallback((config: SessionConfig) => {
    clearAllResumeSessions();
    setQuizResumeState(null);
    setFlashResumeState(null);
    setActiveSession(config);
  }, []);

  // Leaving a session deliberately (back button, language switch, new
  // session) clears its resume snapshot so no stale prompt appears later.
  const exitSession = useCallback(() => {
    clearAllResumeSessions();
    setQuizResumeState(null);
    setFlashResumeState(null);
    setActiveSession(null);
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
      exitSession();
      setQuizSetupOpen(false);
      setQuizSetupMode(undefined);
      setWorkspaceView('words');
      setStage('workspace');
    },
    [decks, exitSession]
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
      const nextAll = decks.filter((d) => d.id !== deckId);
      // Compute the fallback selection outside the state updater — updaters
      // must stay pure (StrictMode may invoke them twice).
      const nextSelectedDeckId =
        selectedDeckId === deckId
          ? (nextAll.find((d) => d.languageId === activeLanguage.id)?.id ?? '')
          : selectedDeckId;
      setDecks(nextAll);
      setSelectedDeckId(nextSelectedDeckId);
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
        tags?: string[];
      }
    ) => {
      const newCard: VocabCard = {
        id: createId('card'),
        deckId,
        word: data.word,
        translation: data.translation,
        exampleSentence: data.exampleSentence,
        mnemonic: data.mnemonic?.trim() || undefined,
        tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
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
        tags?: string[];
      }
    ) => {
      // An empty tag array means "clear all tags" — normalize to undefined
      // so the stored card doesn't carry a meaningless empty list.
      const normalized = { ...updates };
      if (Array.isArray(normalized.tags) && normalized.tags.length === 0) {
        normalized.tags = undefined;
      }
      await updateCard(cardId, normalized);
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, ...normalized } : c))
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
        tags?: string[];
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
        tags: item.tags && item.tags.length > 0 ? item.tags : undefined,
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

  const openQuizSetup = useCallback((deckId?: string, mode?: SessionMode) => {
    setSetupInitialDeckId(deckId);
    setQuizSetupMode(mode);
    setQuizSetupOpen(true);
  }, []);

  const handleStartSession = useCallback((config: SessionConfig) => {
    beginSession(config);
    setQuizSetupOpen(false);
    setQuizSetupMode(undefined);
  }, [beginSession]);

  // Notes CRUD — each sheet is its own persisted record
  const handlePersistNote = useCallback(
    async (noteId: string, content: string) => {
      const existing = notes.find((n) => n.id === noteId);
      // A pending autosave/unmount flush can fire after the note was deleted —
      // persisting then would resurrect it as an orphaned record in IndexedDB.
      if (!existing) return;
      const updated: Note = {
        id: noteId,
        title: existing?.title,
        pinned: existing?.pinned,
        content,
        updatedAt: new Date().toISOString(),
      };
      await putNote(updated);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
    },
    [notes]
  );

  const handleCreateNote = useCallback(async () => {
    const note: Note = {
      id: createId('note'),
      title: 'Untitled note',
      content: '',
      updatedAt: new Date().toISOString(),
    };
    await putNote(note);
    setNotes((prev) => [...prev, note]);
  }, []);

  const patchNote = useCallback(
    async (noteId: string, patch: Partial<Note>) => {
      const existing = notes.find((n) => n.id === noteId);
      if (!existing) return;
      const updated: Note = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await putNote(updated);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
    },
    [notes]
  );

  const handleRenameNote = useCallback(
    (noteId: string, title: string) => {
      void patchNote(noteId, { title: title || undefined });
    },
    [patchNote]
  );

  const handleTogglePinNote = useCallback(
    (noteId: string) => {
      const existing = notes.find((n) => n.id === noteId);
      if (existing) void patchNote(noteId, { pinned: !existing.pinned });
    },
    [notes, patchNote]
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const removed = notes.find((n) => n.id === noteId);
      await dbDeleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      // Clear card → note links so no card points at a deleted sheet
      const clearedCards = cards
        .filter((c) => c.linkedNoteId === noteId)
        .map((c) => ({ ...c, linkedNoteId: undefined }));
      if (clearedCards.length > 0) {
        const clearedIds = new Set(clearedCards.map((c) => c.id));
        setCards((prev) =>
          prev.map((c) => (clearedIds.has(c.id) ? { ...c, linkedNoteId: undefined } : c))
        );
        void putCards(clearedCards).catch(console.error);
      }
      if (removed) {
        notify(`Deleted "${removed.title?.trim() || 'Untitled note'}"`, 'info', {
          label: 'Undo',
          onAction: () => {
            void putNote(removed)
              .then(() => setNotes((prev) => [...prev, removed]))
              .catch(console.error);
          },
        });
      }
    },
    [notes, cards, notify]
  );

  // Card → Blacknotes "grammar margin": reuse the linked note when present,
  // otherwise create a prefilled sheet and link the card to it.
  const handleSendCardToNote = useCallback(
    async (card: VocabCard) => {
      if (card.linkedNoteId) {
        const linked = notes.find((n) => n.id === card.linkedNoteId);
        if (linked) {
          setWorkspaceView('notes');
          setNotesFocusId(linked.id);
          return;
        }
      }
      const lines = [`${card.word} — ${card.translation}`];
      if (card.exampleSentence) {
        lines.push('', `Example: “${card.exampleSentence}”`);
      }
      if (card.mnemonic) {
        lines.push('', `Memory tip: ${card.mnemonic}`);
      }
      const note: Note = {
        id: createId('note'),
        title: card.word,
        content: lines.join('\n'),
        updatedAt: new Date().toISOString(),
      };
      try {
        await Promise.all([
          putNote(note),
          updateCard(card.id, { linkedNoteId: note.id }),
        ]);
        setNotes((prev) => [...prev, note]);
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, linkedNoteId: note.id } : c))
        );
        setWorkspaceView('notes');
        setNotesFocusId(note.id);
        notify(`Sent "${card.word}" to Blacknotes`, 'success');
      } catch {
        notify('Could not create the note. Please try again.', 'error');
      }
    },
    [notes, notify]
  );

  const handleOpenLinkedNote = useCallback((noteId: string) => {
    setWorkspaceView('notes');
    setNotesFocusId(noteId);
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
      beginSession({
        mode: 'multiple-choice',
        deckIds: Array.from(new Set(pool.map((c) => c.deckId))),
        direction: 'word-to-translation',
        questionCount: pool.length,
        timerSeconds: 0,
        smartReviewOnly: true,
        smartCardIds: cardIds,
      });
    },
    [languageCards, beginSession]
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
    beginSession({
      mode: 'flashcards',
      deckIds: Array.from(new Set(leeches.map((c) => c.deckId))),
      direction: 'word-to-translation',
      questionCount: leeches.length,
      timerSeconds: 0,
      leechFilter: 'only',
      leechLab: true,
    });
  }, [languageCards, notify, beginSession]);

  // One-click "Review Now" from the due-today banner
  const handleStartDueReview = useCallback(() => {
    const due = languageCards.filter((c) => !c.suspended && isCardDue(c));
    if (due.length === 0) {
      notify('Nothing due for review right now', 'info');
      return;
    }
    beginSession({
      mode: 'multiple-choice',
      deckIds: Array.from(new Set(due.map((c) => c.deckId))),
      direction: 'word-to-translation',
      questionCount: Math.min(due.length, 20),
      timerSeconds: 0,
      dueOnly: true,
      smartReviewOnly: true,
      smartCardIds: due.map((c) => c.id),
    });
  }, [languageCards, notify, beginSession]);

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
    void (async () => {
      try {
        // Fetch the complete session history — the `sessions` state only
        // holds the most recent 50 records for the stats UI.
        const allSessions = await getSessionHistory(500).catch(() => sessions);
        exportFullBackupJson(
          buildBackupPayload({
            languages,
            decks,
            cards,
            stats: studyStats,
            activity,
            notes,
            smartDecks,
            sessions: allSessions,
          })
        );
        // Stamp the backup time only after a successful export so the
        // stale-backup reminder reflects reality.
        setAppPrefs((prev) => ({
          ...prev,
          lastBackupAt: new Date().toISOString(),
        }));
        notify('Backup exported as JSON', 'success');
      } catch {
        notify('Could not export the backup. Please try again.', 'error');
      }
    })();
  }, [languages, decks, cards, studyStats, activity, notes, smartDecks, sessions, notify]);

  const handleImportBackup = useCallback(
    async (rawText: string, mode: 'merge' | 'replace') => {
      const payload = parseBackupJson(rawText); // throws on invalid input

      // Referential integrity: drop decks whose language is absent and cards
      // whose deck is absent so a malformed/partial backup can't leave
      // orphaned records behind. In merge mode, references to records that
      // already exist locally are also valid.
      const localDeckIds = new Set(decks.map((d) => d.id));
      const localLanguageIds = new Set(languages.map((l) => l.id));
      const validLanguageIds = new Set([
        ...payload.languages.map((l) => l.id),
        ...(mode === 'merge' ? localLanguageIds : []),
      ]);
      const validDecks = payload.decks.filter((d) =>
        validLanguageIds.has(d.languageId)
      );
      const validDeckIds = new Set([
        ...validDecks.map((d) => d.id),
        ...(mode === 'merge' ? localDeckIds : []),
      ]);
      const validCards = payload.cards.filter((c) => validDeckIds.has(c.deckId));
      const validSmartDecks = (payload.smartDecks ?? []).filter((s) =>
        validLanguageIds.has(s.languageId)
      );
      const backupNotes = payload.notes ?? [];
      const backupSessions = payload.sessions ?? [];

      if (mode === 'replace') {
        // Single transaction: the workspace is either fully restored or
        // untouched — never a half-imported database.
        await restoreBackupData({
          languages: payload.languages,
          decks: validDecks,
          cards: validCards,
          notes: backupNotes,
          smartDecks: validSmartDecks,
          sessions: backupSessions,
          stats: payload.stats,
          activity: payload.activity ?? [],
        });
        // Prevent preset seed data from resurrecting on next launch
        await markSeedCompleted();

        setLanguages(payload.languages);
        setDecks(validDecks);
        setCards(validCards);
        setNotes(backupNotes);
        setSmartDecks(validSmartDecks);
        setSessions(backupSessions.slice(0, 50));
        setActivity(payload.activity ?? []);
        if (payload.stats) {
          setStudyStats((prev) => ({ ...prev, ...payload.stats }));
        }
        clearAllResumeSessions();
        setQuizResumeState(null);
        setFlashResumeState(null);
        setActiveSession(null);
        setQuizSetupOpen(false);

        const firstLang = payload.languages[0];
        if (firstLang) {
          setActiveLanguageId((prev) =>
            payload.languages.some((l) => l.id === prev) ? prev : firstLang.id
          );
          setSelectedDeckId((prev) =>
            validDecks.some((d) => d.id === prev) ? prev : validDecks[0]?.id ?? ''
          );
        } else {
          setActiveLanguageId('');
          setSelectedDeckId('');
        }
      } else {
        // Merge: upsert every record by id, keep unrelated data intact
        await Promise.all([
          ...payload.languages.map((l) => addLanguage(l)),
          ...validDecks.map((d) => addDeck(d)),
          putCards(validCards),
          ...backupNotes.map((n) => putNote(n)),
          ...validSmartDecks.map((s) => addSmartDeck(s)),
        ]);
        await putSessionRecords(backupSessions);
        for (const day of payload.activity ?? []) {
          await putActivityDay(day);
        }

        setLanguages((prev) => mergeById(prev, payload.languages));
        setDecks((prev) => mergeById(prev, validDecks));
        setCards((prev) => mergeById(prev, validCards));
        if (payload.notes) {
          setNotes((prev) => mergeById(prev, backupNotes));
        }
        if (payload.smartDecks) {
          setSmartDecks((prev) => mergeById(prev, validSmartDecks));
        }
        if (payload.sessions) {
          setSessions((prev) =>
            mergeById(prev, backupSessions).slice(0, 50)
          );
        }
        setActivity((prev) => {
          const incoming = payload.activity ?? [];
          const incomingDates = new Set(incoming.map((d) => d.date));
          return [...incoming, ...prev.filter((d) => !incomingDates.has(d.date))];
        });
      }

      notify(
        `Backup ${mode === 'replace' ? 'restored' : 'merged'} — ${payload.languages.length} languages, ${validDecks.length} decks, ${validCards.length} words`,
        'success'
      );
    },
    [notify, decks, languages]
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

  // Offer to resume an interrupted quiz/flashcard session (sessionStorage
  // snapshot). Snapshots whose decks/cards no longer exist are discarded.
  const resumeCheckedRef = useRef(false);
  useEffect(() => {
    if (isLoading || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;

    const deckIds = new Set(decks.map((d) => d.id));
    const cardIds = new Set(cards.map((c) => c.id));
    const langDeckIds = new Set(languageDecks.map((d) => d.id));

    const quiz = loadQuizResume();
    let validQuiz: QuizResumeState | null = null;
    if (quiz) {
      const decksExist = quiz.config.deckIds.some((id) => deckIds.has(id));
      const cardsExist = quiz.questions.some((q) => cardIds.has(q.card.id));
      const inLanguage =
        quiz.config.smartReviewOnly ||
        quiz.config.deckIds.some((id) => langDeckIds.has(id));
      if (decksExist && cardsExist && inLanguage) {
        validQuiz = quiz;
      } else {
        clearQuizResume();
      }
    }

    const flash = loadFlashcardResume();
    let validFlash: FlashcardResumeState | null = null;
    if (flash) {
      const decksExist = flash.config.deckIds.some((id) => deckIds.has(id));
      const cardsExist = flash.queueIds.some((id) => cardIds.has(id));
      const inLanguage =
        flash.config.smartReviewOnly ||
        flash.config.deckIds.some((id) => langDeckIds.has(id));
      if (decksExist && cardsExist && inLanguage) {
        validFlash = flash;
      } else {
        clearFlashcardResume();
      }
    }

    if (!validQuiz && !validFlash) return;

    const kind = validQuiz ? 'quiz' : 'flashcards';
    const count = validQuiz ? validQuiz.questions.length : validFlash!.queueIds.length;
    notify(
      `Interrupted ${kind === 'quiz' ? 'quiz' : 'flashcard'} session found (${count} ${count === 1 ? 'item' : 'items'})`,
      'info',
      {
        label: 'Resume',
        onAction: () => {
          clearAllResumeSessions();
          if (validQuiz) {
            setActiveSession(validQuiz.config);
            setQuizResumeState(validQuiz);
          } else if (validFlash) {
            setActiveSession(validFlash.config);
            setFlashResumeState(validFlash);
          }
        },
      }
    );
  }, [isLoading, decks, cards, languageDecks, notify]);

  // Global shortcuts: Ctrl/Cmd+K palette, "g w/q/s/n" view chords, "c" new card.
  // Suppressed while typing, in sessions, or when a modal/palette is open.
  useEffect(() => {
    let chordTimer: number | null = null;
    let chord: string | null = null;
    const VIEW_KEYS: Record<string, WorkspaceView> = {
      w: 'words',
      q: 'quiz',
      s: 'stats',
      n: 'notes',
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (stage === 'workspace') {
          e.preventDefault();
          setPaletteOpen((v) => !v);
        }
        return;
      }

      const uiOpen =
        quizSetupOpen || settingsOpen || shortcutsOpen || paletteOpen;
      if (
        typing ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        stage !== 'workspace' ||
        activeSession !== null ||
        uiOpen
      ) {
        chord = null;
        return;
      }

      if (chord === 'g') {
        chord = null;
        const view = VIEW_KEYS[e.key.toLowerCase()];
        if (view) {
          e.preventDefault();
          setWorkspaceView(view);
          setMobileNavOpen(false);
        }
        return;
      }

      if (e.key.toLowerCase() === 'g' && !e.repeat) {
        chord = 'g';
        if (chordTimer !== null) window.clearTimeout(chordTimer);
        chordTimer = window.setTimeout(() => {
          chord = null;
        }, 900);
        return;
      }

      if (e.key.toLowerCase() === 'c' && !e.repeat) {
        e.preventDefault();
        setWorkspaceView('words');
        setAddWordsTrigger((n) => n + 1);
        return;
      }

      chord = null;
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (chordTimer !== null) window.clearTimeout(chordTimer);
    };
  }, [
    stage,
    activeSession,
    quizSetupOpen,
    settingsOpen,
    shortcutsOpen,
    paletteOpen,
  ]);

  // PWA install prompt — Chrome/Edge fire beforeinstallprompt once eligible;
  // we defer it and surface a one-click install in Settings.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  }, [installPrompt]);

  // Weekly mastery snapshot — written lazily the first time Statistics is
  // viewed each ISO week, then read back for the trend chart.
  useEffect(() => {
    if (isLoading || stage !== 'workspace' || workspaceView !== 'stats') return;
    const langId = activeLanguage.id;
    let cancelled = false;
    void (async () => {
      try {
        const existing = await getMasterySnapshots(langId);
        const key = isoWeekKey(new Date());
        if (!existing.some((s) => s.weekKey === key)) {
          const m = getDeckMastery(languageCards);
          const snap: MasterySnapshot = {
            id: `${langId}:${key}`,
            languageId: langId,
            weekKey: key,
            capturedAt: new Date().toISOString(),
            total: m.total,
            mastered: m.mastered,
            learning: m.learning,
            fresh: m.fresh,
            masteryPct: m.masteryPct,
          };
          await putMasterySnapshot(snap);
          existing.push(snap);
        }
        if (!cancelled) setMasterySnapshots(existing);
      } catch {
        /* IndexedDB unavailable — trend simply stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, stage, workspaceView, activeLanguage.id, languageCards]);

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

    beginSession({
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
  }, [languageCards, notify, beginSession]);

  const handleTopAddWords = () => {
    exitSession();
    setAddWordsTrigger((n) => n + 1);
  };

  const handleConsumeAddWords = useCallback(() => {
    setAddWordsTrigger(0);
  }, []);

  const handleConsumeCreateDeck = useCallback(() => {
    setCreateDeckTrigger(0);
  }, []);

  // Command palette actions
  const handlePaletteAction = useCallback(
    (id: PaletteActionId) => {
      switch (id) {
        case 'new-deck':
          setWorkspaceView('words');
          setCreateDeckTrigger((n) => n + 1);
          break;
        case 'add-words':
          setWorkspaceView('words');
          setAddWordsTrigger((n) => n + 1);
          break;
        case 'smart-review':
          handleStartSmartReview();
          break;
        case 'due-review':
          handleStartDueReview();
          break;
        case 'new-note':
          setWorkspaceView('notes');
          void handleCreateNote();
          break;
        case 'export-backup':
          handleExportAllBackup();
          break;
      }
    },
    [handleStartSmartReview, handleStartDueReview, handleCreateNote, handleExportAllBackup]
  );

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
                className={`p-2 rounded-lg border transition-colors shrink-0 ${
                  sfxMuted
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20'
                    : 'bg-white dark:bg-[#1C1A17] border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                }`}
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
                className={`p-2 rounded-lg border transition-colors shrink-0 ${
                  ttsMuted
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20'
                    : 'bg-white dark:bg-[#1C1A17] border-slate-200 dark:border-[#2E2A25] text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                }`}
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
          <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            {/* Left: nav toggle + current language (switch via sidebar/languages) */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 -ml-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden lg:inline-flex p-2 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors shrink-0"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  setStage('languages');
                }}
                className="font-display text-base sm:text-lg font-semibold text-[#1C1917] dark:text-[#F5F2EC] truncate text-left"
              >
                {activeLanguage.name}
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
                onClick={() => {
                  setActiveSession(null);
                  setWorkspaceView('quiz');
                }}
                className="px-4 py-1.5 sm:py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              >
                Start Quiz
              </button>

              <button
                type="button"
                onClick={toggleSfxMute}
                aria-label={sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                title={sfxMuted ? 'Sound effects muted' : 'Sound effects on'}
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  sfxMuted
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                }`}
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
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  ttsMuted
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
                }`}
              >
                {ttsMuted ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <AudioLines className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Command palette"
                title="Command palette (Ctrl+K)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors text-xs font-medium"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden md:inline font-mono text-[10px] px-1 py-0.5 rounded bg-[#F3EFE8] dark:bg-[#25221E] text-[#78716C] dark:text-[#A8A29E]">
                  ⌘K
                </kbd>
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
              className="w-full"
            >
              {!activeSession && (
                <div className="flex">
                  <Sidebar
                    view={workspaceView}
                    onViewChange={(v) => {
                      setWorkspaceView(v);
                      setMobileNavOpen(false);
                    }}
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
                    languageName={activeLanguage.name}
                    onOpenLanguages={() => {
                      setActiveSession(null);
                      setStage('languages');
                    }}
                    dueCount={dueTodayCount}
                  />
                  <Sidebar
                    mobile
                    mobileOpen={mobileNavOpen}
                    onCloseMobile={() => setMobileNavOpen(false)}
                    view={workspaceView}
                    onViewChange={(v) => {
                      setWorkspaceView(v);
                      setMobileNavOpen(false);
                    }}
                    collapsed={false}
                    onToggleCollapse={() => {}}
                    languageName={activeLanguage.name}
                    onOpenLanguages={() => {
                      setActiveSession(null);
                      setStage('languages');
                    }}
                    dueCount={dueTodayCount}
                  />
                  <div className="flex-1 min-w-0 px-4 sm:px-6 py-8 sm:py-12">
                    <div className="max-w-4xl mx-auto space-y-10">
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
                  <OnboardingChecklist
                    decks={languageDecks}
                    cards={languageCards}
                    stats={studyStats}
                    dismissed={appPrefs.onboardingDismissed ?? false}
                    onDismiss={() =>
                      setAppPrefs((prev) => ({ ...prev, onboardingDismissed: true }))
                    }
                  />

                  {workspaceView === 'words' && (
                    <div className="space-y-6">
                    <WordOfTheDay
                      cards={languageCards}
                      decks={languageDecks}
                      langCode={activeLanguage.code}
                      ttsMuted={ttsMuted}
                      voice={activeVoice}
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
                      notes={notes}
                      onSendCardToNote={handleSendCardToNote}
                      onOpenLinkedNote={handleOpenLinkedNote}
                      createDeckTrigger={createDeckTrigger}
                      onConsumeCreateDeck={handleConsumeCreateDeck}
                    />
                    </ErrorBoundary>
                    </div>
                  )}

                  {workspaceView === 'quiz' && (
                    <QuizLauncher
                      hasCards={languageCards.length > 0}
                      dueCount={dueTodayCount}
                      leechCount={leechCount}
                      voiceReady={voiceReady}
                      onSmartReview={handleStartSmartReview}
                      onDueReview={handleStartDueReview}
                      onLeechLab={handleStartLeechLab}
                      onOpenSetup={(mode) => openQuizSetup(undefined, mode)}
                    />
                  )}

                  {workspaceView === 'stats' && (
                    <>
                      <OverviewStrip
                        languageId={activeLanguage.id}
                        decks={languageDecks}
                        cards={languageCards}
                        stats={studyStats}
                        onStartSmartReview={handleStartSmartReview}
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
                        snapshots={masterySnapshots}
                        lastBackupAt={appPrefs.lastBackupAt}
                        onExportBackup={handleExportAllBackup}
                      />
                    </>
                  )}

                  {workspaceView === 'notes' && (
                    <NotesPanel
                      notes={notes}
                      autoSave={appPrefs.notesAutoSave ?? true}
                      intervalSeconds={appPrefs.notesAutoSaveSeconds ?? 2}
                      onCreateNote={handleCreateNote}
                      onRenameNote={handleRenameNote}
                      onTogglePin={handleTogglePinNote}
                      onDeleteNote={handleDeleteNote}
                      onPersist={handlePersistNote}
                      focusNoteId={notesFocusId}
                      onConsumeFocusNote={() => setNotesFocusId(null)}
                    />
                  )}
                    </div>
                  </div>
                </div>
              )}

              {activeSession && (
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
              {activeSession.mode === 'flashcards' && (
                <ErrorBoundary>
                  <FlashcardStudy
                    decks={languageDecks}
                    cards={languageCards}
                    sessionConfig={activeSession}
                    sfxMuted={sfxMuted}
                    onRateCard={handleRateCard}
                    onOpenSetup={() => openQuizSetup(activeSession.deckIds[0])}
                    onBackToWorkspace={exitSession}
                    ttsMuted={ttsMuted}
                    langCode={activeLanguage.code}
                    voice={activeVoice}
                    autoSpeakPrompt={appPrefs.autoSpeakPrompt}
                    autoSpeakAnswer={appPrefs.autoSpeakAnswer}
                    onSessionComplete={handleFlashcardSessionComplete}
                    onGraduateLeech={handleGraduateLeech}
                    resumeState={flashResumeState}
                  />
                </ErrorBoundary>
              )}

              {activeSession.mode !== 'flashcards' && (
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
                    onBackToWorkspace={exitSession}
                    ttsMuted={ttsMuted}
                    voice={activeVoice}
                    autoAdvance={appPrefs.autoAdvance}
                    autoSpeakPrompt={appPrefs.autoSpeakPrompt}
                    autoSpeakAnswer={appPrefs.autoSpeakAnswer}
                    resumeState={quizResumeState}
                  />
                </ErrorBoundary>
              )}
                </div>
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
        initialMode={quizSetupMode ?? activeSession?.mode ?? 'multiple-choice'}
        defaultTimerSeconds={appPrefs.defaultTimerSeconds}
        onClose={() => {
          setQuizSetupOpen(false);
          setQuizSetupMode(undefined);
        }}
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
        notesAutoSave={appPrefs.notesAutoSave ?? true}
        onNotesAutoSaveChange={(enabled) =>
          setAppPrefs((prev) => ({ ...prev, notesAutoSave: enabled }))
        }
        notesAutoSaveSeconds={appPrefs.notesAutoSaveSeconds ?? 2}
        onNotesAutoSaveSecondsChange={(seconds) =>
          setAppPrefs((prev) => ({ ...prev, notesAutoSaveSeconds: seconds }))
        }
        canInstallApp={installPrompt !== null}
        onInstallApp={handleInstallApp}
        lastBackupAt={appPrefs.lastBackupAt}
        languages={languages}
        activeLanguageId={activeLanguage.id}
        onSelectLanguage={(languageId) => {
          if (languageId === activeLanguage.id) return;
          handleEnterLanguage(languageId);
          setSettingsOpen(false);
        }}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        decks={languageDecks}
        cards={languageCards}
        notes={notes}
        onOpenDeck={(deckId) => {
          setSelectedDeckId(deckId);
          setWorkspaceView('words');
          setMobileNavOpen(false);
        }}
        onOpenCard={(card) => {
          setSelectedDeckId(card.deckId);
          setWorkspaceView('words');
          setMobileNavOpen(false);
        }}
        onOpenNote={(noteId) => {
          setWorkspaceView('notes');
          setNotesFocusId(noteId);
        }}
        onAction={handlePaletteAction}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
    </ErrorBoundary>
  );
}
