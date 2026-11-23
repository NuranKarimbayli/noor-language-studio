import { FlashcardResumeState, QuizResumeState } from '../types';

/**
 * Session-resume persistence (sessionStorage).
 *
 * Quiz and flashcard sessions snapshot their in-memory progress so an
 * interrupted session (refresh, accidental navigation, PWA reload) can be
 * offered back on return. Snapshots are versioned, timestamped, and
 * validated on load; App clears them on deliberate exit or new sessions.
 */

const STORAGE_KEY = 'noor:active-sessions';
const SNAPSHOT_VERSION = 1;
// Sessions older than a day are almost certainly stale — discard them.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface SessionSnapshot {
  v: number;
  savedAt: number;
  quiz?: QuizResumeState;
  flashcards?: FlashcardResumeState;
}

function readSnapshot(): SessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (!parsed || parsed.v !== SNAPSHOT_VERSION) return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(patch: Partial<SessionSnapshot>): void {
  try {
    const current = readSnapshot() ?? { v: SNAPSHOT_VERSION, savedAt: Date.now() };
    const next: SessionSnapshot = { ...current, ...patch, v: SNAPSHOT_VERSION, savedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sessionStorage may be unavailable or full — resume is best-effort
  }
}

export function saveQuizResume(state: QuizResumeState): void {
  writeSnapshot({ quiz: state });
}

export function saveFlashcardResume(state: FlashcardResumeState): void {
  writeSnapshot({ flashcards: state });
}

export function loadQuizResume(): QuizResumeState | null {
  const snap = readSnapshot();
  const q = snap?.quiz;
  if (!q || !q.config || typeof q.config !== 'object') return null;
  if (!Array.isArray(q.questions) || q.questions.length === 0) return null;
  if (typeof q.currentIdx !== 'number' || q.currentIdx < 0 || q.currentIdx >= q.questions.length) {
    return null;
  }
  if (!Array.isArray(q.records)) return null;
  return q;
}

export function loadFlashcardResume(): FlashcardResumeState | null {
  const snap = readSnapshot();
  const f = snap?.flashcards;
  if (!f || !f.config || typeof f.config !== 'object') return null;
  if (!Array.isArray(f.queueIds) || f.queueIds.length === 0) return null;
  if (typeof f.currentIndex !== 'number' || f.currentIndex < 0 || f.currentIndex >= f.queueIds.length) {
    return null;
  }
  return f;
}

export function clearQuizResume(): void {
  try {
    const snap = readSnapshot();
    if (!snap) return;
    delete snap.quiz;
    if (!snap.flashcards) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* best-effort */
  }
}

export function clearFlashcardResume(): void {
  try {
    const snap = readSnapshot();
    if (!snap) return;
    delete snap.flashcards;
    if (!snap.quiz) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* best-effort */
  }
}

export function clearAllResumeSessions(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* best-effort */
  }
}
