export type ConfidenceLevel = 'new' | 'hard' | 'good' | 'easy';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type StudyDirection = 'word-to-translation' | 'translation-to-word' | 'random';

export type QuizMode =
  | 'true-false'
  | 'multiple-choice'
  | 'listening'
  | 'typing'
  | 'fill-blank';

export type SessionMode = 'flashcards' | QuizMode;

export type AppStage = 'categories' | 'languages' | 'workspace';

export type ThemeMode = 'light' | 'dark';

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
}

// Daily activity record persisted in IndexedDB, keyed by YYYY-MM-DD
export interface ActivityDay {
  date: string; // YYYY-MM-DD local date
  reviews: number; // words reviewed (flashcard ratings + quiz answers)
  quizzes: number; // completed quiz sessions
  correct: number; // correct quiz answers
}

export interface ToastMessage {
  id: string;
  text: string;
  variant: 'success' | 'info' | 'error';
  // Optional action button (e.g. Undo) shown inside the toast
  actionLabel?: string;
  onAction?: () => void;
}
