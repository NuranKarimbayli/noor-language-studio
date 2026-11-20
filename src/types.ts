export type ConfidenceLevel = 'new' | 'hard' | 'good' | 'easy';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type StudyDirection = 'word-to-translation' | 'translation-to-word' | 'random';

export type QuizMode =
  | 'true-false'
  | 'multiple-choice'
  | 'listening'
  | 'typing'
  | 'fill-blank'
  | 'speaking';

export type SessionMode = 'flashcards' | QuizMode;

export type AppStage = 'languages' | 'workspace';

// Focused workspace views behind the sidebar navigation
export type WorkspaceView = 'words' | 'quiz' | 'stats' | 'notes';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface LanguageItem {
  id: string;
  name: string;
  nativeLabel: string;
  code: string;
  isCustom?: boolean;
  createdAt: string;
  // Optional explicit TTS voice binding. When unset, the best matching
  // native browser voice is auto-detected. voiceDisabled turns TTS off.
  voiceName?: string;
  voiceLang?: string; // BCP-47 tag of the selected voice (e.g. "lt-LT")
  voiceDisabled?: boolean;
  // Pinned languages always sort to the top of the language picker
  pinned?: boolean;
}

export interface VocabCard {
  id: string;
  deckId: string;
  word: string;
  translation: string;
  exampleSentence?: string;
  confidence: ConfidenceLevel;
  // Self-assigned difficulty (independent of SRS confidence)
  difficulty?: DifficultyLevel;
  // Optional personal memory tip / association shown on flashcards & quiz hints
  mnemonic?: string;
  // Cumulative count of incorrect quiz answers / "Hard" flashcard ratings
  wrongCount?: number;
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
  // Leitner / Spaced Repetition fields
  srsBox?: number;
  nextReviewAt?: string;
  streak?: number;
  lapses?: number;
  // Archived cards stay in the deck but are hidden from study sessions and
  // (by default) the word list until restored.
  suspended?: boolean;
}

export interface Deck {
  id: string;
  languageId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionConfig {
  mode: SessionMode;
  deckIds: string[];
  direction: StudyDirection;
  questionCount: number;
  timerSeconds: number; // 0 = off
  smartReviewOnly?: boolean;
  smartCardIds?: string[];
  difficultyFilter?: DifficultyLevel[]; // empty/undefined = all difficulties
  // When true (default), quiz distractors come from the question's own deck
  // first, falling back to other decks only when needed.
  isolateDistractorsByDeck?: boolean;
  // When true, restrict the session pool to cards currently due for review
  // (nextReviewAt <= now, or never scheduled).
  dueOnly?: boolean;
  // Leech-card filter: 'exclude' drops repeatedly-missed cards from the pool,
  // 'only' restricts the session to leech cards for targeted review.
  leechFilter?: 'all' | 'exclude' | 'only';
  // Guided Leech Lab remediation: consecutive non-hard ratings on a leech card
  // gradually clear its lapse/wrong counters until it graduates.
  leechLab?: boolean;
}

export interface QuizQuestion {
  id: string;
  card: VocabCard;
  deckName: string;
  langCode: string;
  direction: 'word-to-translation' | 'translation-to-word';
  promptText: string;
  expectedAnswer: string;
  hintText?: string;
  blankedSentence?: string;
  options?: string[];
  proposedMatch?: string;
  isTrueStatement?: boolean;
}

export type AnswerStatus = 'exact' | 'typo' | 'incorrect' | 'timeout';

export interface QuizAnswerRecord {
  question: QuizQuestion;
  userAnswer: string;
  status: AnswerStatus;
  isCorrect: boolean;
}

export interface StudyStats {
  streakDays: number;
  lastStudyDate: string | null; // YYYY-MM-DD local date
  totalQuizAnswered: number;
  totalQuizCorrect: number;
  bestQuizStreak?: number; // longest consecutive-correct run in any quiz
  dailyGoal?: number; // daily word-review goal (default 20)
}

// Non-critical app preferences persisted as a single record in the `meta`
// IndexedDB store. Theme / sound / speech keep their dedicated stores.
export interface AppPrefs {
  showToasts: boolean; // show non-critical toast notifications (default true)
  autoAdvance: boolean; // auto-advance to the next quiz question after answering
  defaultTimerSeconds: number; // quiz setup default timer, 0 = off
  autoSpeakPrompt: boolean; // speak the target word when a card/question appears
  autoSpeakAnswer: boolean; // speak the word/example again when the answer is revealed
  reminderEnabled: boolean; // browser Notification when reviews are due
  onboardingDismissed?: boolean; // first-run checklist hidden
  notesAutoSave?: boolean; // auto-save the notepad while typing (default true)
  notesAutoSaveSeconds?: number; // debounce interval for auto-save (1|2|5|10)
}

// Freeform study notes ("note sheets"), persisted in IndexedDB and included
// in backups. Multiple notes are supported; pinned notes sort to the top.
export interface Note {
  id: string;
  title?: string;
  content: string;
  pinned?: boolean;
  updatedAt: string; // ISO timestamp
}

// Completed study session persisted in IndexedDB (session history)
export interface SessionRecord {
  id: string;
  mode: SessionMode;
  deckIds: string[];
  deckNames: string[]; // snapshot for display even if decks are later renamed
  total: number; // cards/questions attempted
  correct: number;
  durationMs: number;
  completedAt: string; // ISO timestamp
}

// Summary passed up by study components when a session completes
export interface SessionCompletionSummary {
  mode: SessionMode;
  total: number;
  correct: number;
  durationMs: number;
}

export interface QuizSessionSummary extends SessionCompletionSummary {
  bestStreak: number;
}

// Daily activity record persisted in IndexedDB, keyed by YYYY-MM-DD
export interface ActivityDay {
  date: string; // YYYY-MM-DD local date
  reviews: number; // words reviewed (flashcard ratings + quiz answers)
  quizzes: number; // completed quiz sessions
  correct: number; // correct quiz answers
  cardsAdded?: number; // new vocabulary cards created that day
}

// Saved dynamic deck: membership is computed from a card predicate at
// study/display time rather than stored card references.
export interface SmartDeckFilter {
  weak?: boolean; // isWeakCard (hard confidence, low box, or lapsed)
  due?: boolean; // isCardDue (nextReviewAt <= now or never scheduled)
  leeches?: boolean; // isLeechCard
  newOnly?: boolean; // confidence === 'new'
  hardOnly?: boolean; // confidence === 'hard'
}

export interface SmartDeck {
  id: string;
  languageId: string;
  name: string;
  description?: string;
  createdAt: string;
  filter: SmartDeckFilter;
}

export interface ToastMessage {
  id: string;
  text: string;
  variant: 'success' | 'info' | 'error';
  // Optional action button (e.g. Undo) shown inside the toast
  actionLabel?: string;
  onAction?: () => void;
}
