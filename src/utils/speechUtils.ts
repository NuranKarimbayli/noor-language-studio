/**
 * Voice Language Mapping & Strict Native-Only Playback.
 *
 * Browsers (especially Chrome/Edge) populate `speechSynthesis.getVoices()`
 * asynchronously via `voiceschanged`, and many languages simply have no
 * installed voice pack (e.g. Lithuanian lt-LT on stock Windows). Falling
 * back to an unrelated voice (usually English) produces badly mispronounced
 * words — worse than silence for a language learner. This module therefore:
 *
 *  - caches the browser voice list and notifies React subscribers,
 *  - treats a language as voice-supported ONLY when a genuine matching
 *    native voice exists (or the user explicitly bound one in settings),
 *  - never speaks through an unrelated-language voice.
 */

import { useSyncExternalStore } from 'react';

// ISO 639-1 code -> preferred BCP-47 locale for known languages
const LOCALE_MAP: Record<string, string> = {
  LT: 'lt-LT',
  EN: 'en-US',
  DE: 'de-DE',
  RU: 'ru-RU',
  ES: 'es-ES',
  TR: 'tr-TR',
  AZ: 'az-AZ',
  FR: 'fr-FR',
  IT: 'it-IT',
  PT: 'pt-PT',
  NL: 'nl-NL',
  PL: 'pl-PL',
  UK: 'uk-UA',
  JA: 'ja-JP',
  ZH: 'zh-CN',
  AR: 'ar-SA',
  HI: 'hi-IN',
  BE: 'be-BY',
  CS: 'cs-CZ',
  DA: 'da-DK',
  EL: 'el-GR',
  FI: 'fi-FI',
  HE: 'he-IL',
  ID: 'id-ID',
  KO: 'ko-KR',
  NO: 'nb-NO',
  RO: 'ro-RO',
  SV: 'sv-SE',
  TH: 'th-TH',
  VI: 'vi-VN',
};

/** Per-language voice binding stored on LanguageItem. */
export interface VoiceSelection {
  name?: string;
  lang?: string; // BCP-47 tag of the selected voice
  disabled?: boolean; // user explicitly turned pronunciation off
}

export function resolveLocale(langCode: string): string {
  const normalized = langCode.trim();
  if (!normalized) return 'en-US';
  const upper = normalized.toUpperCase();
  if (LOCALE_MAP[upper]) return LOCALE_MAP[upper];
  // Already a full locale tag (e.g. "az-AZ") or a bare code
  if (normalized.includes('-')) return normalized;
  return `${normalized.toLowerCase()}-${upper}`;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

// ---------------------------------------------------------------------------
// Voice registry: cached list + subscription for React
// ---------------------------------------------------------------------------

let voicesCache: SpeechSynthesisVoice[] = [];
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
const voiceListeners = new Set<() => void>();

function notifyVoiceListeners(): void {
  for (const listener of voiceListeners) listener();
}

function setVoicesCache(voices: SpeechSynthesisVoice[]): void {
  voicesCache = voices;
  notifyVoiceListeners();
}

/**
 * Resolve the available voices, waiting for the async `voiceschanged`
 * event when the list is still empty. Polls as a fallback for browsers
 * that don't fire the event reliably, and always resolves so callers are
 * never blocked indefinitely.
 */
function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth();
  if (!synth) return Promise.resolve([]);

  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    if (voicesCache.length === 0) setVoicesCache(immediate);
    return Promise.resolve(immediate);
  }

  if (!voicesPromise) {
    voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let settled = false;
      let pollId: number | null = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (pollId !== null) window.clearInterval(pollId);
        try {
          synth.removeEventListener('voiceschanged', finish);
        } catch {
          // ignore
        }
        synth.onvoiceschanged = null;
        const voices = synth.getVoices();
        setVoicesCache(voices);
        resolve(voices);
      };

      try {
        synth.addEventListener('voiceschanged', finish);
        synth.onvoiceschanged = finish;
      } catch {
        // Older implementations only support onvoiceschanged
      }

      pollId = window.setInterval(() => {
        if (synth.getVoices().length > 0) finish();
      }, 200);

      // Never hang: resolve with whatever is available after ~2.5s
      window.setTimeout(finish, 2500);
    });
  }
  return voicesPromise;
}

/** Synchronously return the last-known voice list (may be empty early on). */
export function getVoicesSync(): SpeechSynthesisVoice[] {
  return voicesCache;
}

function subscribeVoices(listener: () => void): () => void {
  voiceListeners.add(listener);
  return () => voiceListeners.delete(listener);
}

/** React hook: live list of browser TTS voices (updates when they load). */
export function useBrowserVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribeVoices, getVoicesSync, () => []);
}

/** Pre-warm the voice list (e.g. on app init) so the first utterance is instant. */
export function preloadVoices(): void {
  void getVoicesAsync();
}

// ---------------------------------------------------------------------------
// Voice matching
// ---------------------------------------------------------------------------

/**
 * Score a voice for `locale`/`langCode`. Lower is better.
 * 0 = exact locale match, 1 = same language (any region), Infinity = no match.
 */
function voiceScore(
  voice: SpeechSynthesisVoice,
  locale: string,
  langCode: string
): number {
  const vLang = voice.lang.toLowerCase();
  const loc = locale.toLowerCase();
  const primary = langCode.toLowerCase().split(/[-_]/)[0];

  if (vLang === loc) return 0;
  if (vLang === primary) return 1;
  if (vLang.startsWith(`${primary}-`) || vLang.startsWith(`${primary}_`)) return 2;
  if (loc.startsWith(`${vLang}-`) || loc.startsWith(`${vLang}_`)) return 3;
  return Infinity;
}

function pickVoiceFromList(
  voices: SpeechSynthesisVoice[],
  locale: string,
  langCode: string
): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = Infinity;
  for (const voice of voices) {
    const score = voiceScore(voice, locale, langCode);
    if (score < bestScore) {
      bestScore = score;
      best = voice;
      if (score === 0) break;
    }
  }
  return bestScore === Infinity ? null : best;
}

/** Best native voice for a language code, or null when none exists. */
export function findVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  langCode: string
): SpeechSynthesisVoice | null {
  return pickVoiceFromList(voices, resolveLocale(langCode), langCode);
}

/** Find an explicitly-bound voice by name + BCP-47 tag. */
export function findVoiceByRef(
  voices: SpeechSynthesisVoice[],
  ref: { name: string; lang?: string }
): SpeechSynthesisVoice | null {
  const nameLower = ref.name.toLowerCase();
  const langLower = ref.lang?.toLowerCase();
  return (
    voices.find(
      (v) =>
        v.name.toLowerCase() === nameLower &&
        (!langLower || v.lang.toLowerCase() === langLower)
    ) ?? null
  );
}

/**
 * A language is voice-supported iff the user did not disable it AND either
 * an explicit voice binding resolves to a real browser voice, or a genuine
 * native voice matching the language code exists.
 */
export function isVoiceSupported(
  langCode: string,
  voice?: VoiceSelection | null,
  voices: SpeechSynthesisVoice[] = voicesCache
): boolean {
  if (voice?.disabled) return false;
  if (voice?.name) {
    return findVoiceByRef(voices, { name: voice.name, lang: voice.lang }) !== null;
  }
  return findVoiceForLanguage(voices, langCode) !== null;
}

// ---------------------------------------------------------------------------
// Playback (strict: never speaks through an unrelated voice)
// ---------------------------------------------------------------------------

/**
 * Speak `text` in the given language. Cancels any in-flight utterance
 * immediately so playback never overlaps, then waits (asynchronously) for
 * the voice list and speaks ONLY through a matching native voice — or an
 * explicitly bound voice — silently doing nothing when unsupported.
 */
export function speakText(
  text: string,
  langCode: string,
  voice?: VoiceSelection | null
): void {
  const synth = getSynth();
  const trimmed = text.trim();
  if (!synth || !trimmed || voice?.disabled) return;

  try {
    synth.cancel();
    // Chrome can leave the synthesizer paused after cancel()
    synth.resume();
  } catch {
    // ignore
  }

  void getVoicesAsync().then((voices) => {
    let resolved: SpeechSynthesisVoice | null = null;
    if (voice?.name) {
      resolved = findVoiceByRef(voices, { name: voice.name, lang: voice.lang });
    } else {
      resolved = findVoiceForLanguage(voices, langCode);
    }
    // Strict native-only: no unrelated-language fallback
    if (!resolved) return;

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = resolved.lang;
    utterance.voice = resolved;
    utterance.rate = 0.92;
    utterance.pitch = 1;

    try {
      synth.speak(utterance);
    } catch {
      // Some browsers throw if speak() is called while the engine resets
    }
  });
}

/** Stop any ongoing speech immediately. Safe to call anywhere. */
export function stopSpeaking(): void {
  const synth = getSynth();
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Speech recognition (speaking practice) — Chrome/Edge only, degrades safely
// ---------------------------------------------------------------------------

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

export interface SpeechRecognitionSession {
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * True when the browser exposes the Web Speech SpeechRecognition API
 * (Chrome/Edge). Firefox/Safari return false and speaking practice is hidden.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.SpeechRecognition === 'function' || typeof w.webkitSpeechRecognition === 'function';
}

/**
 * Start a one-shot recognition session for `langCode`. `onTranscript` fires
 * with the latest transcript (interim and final); `onFinal` fires once with
 * the final transcript when recognition completes with speech. `onEnd` fires
 * when the session terminates (with or without results).
 */
export function startSpeechRecognition(
  langCode: string,
  handlers: {
    onTranscript?: (text: string, isFinal: boolean) => void;
    onFinal?: (text: string) => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): SpeechRecognitionSession | null {
  if (typeof window === 'undefined' || !isSpeechRecognitionSupported()) return null;
  const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  let rec: SpeechRecognitionLike;
  try {
    rec = new Ctor();
  } catch {
    return null;
  }

  rec.lang = resolveLocale(langCode);
  rec.continuous = false;
  rec.interimResults = true;

  let finalText = '';
  let ended = false;

  rec.onresult = (event) => {
    const results = event.results;
    let interim = '';
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const text = r[0]?.transcript ?? '';
      if (r.isFinal) {
        finalText = text.trim();
      } else {
        interim += text;
      }
    }
    const latest = finalText || interim.trim();
    if (latest) handlers.onTranscript?.(latest, Boolean(finalText));
  };

  rec.onend = () => {
    if (ended) return;
    ended = true;
    if (finalText) handlers.onFinal?.(finalText);
    handlers.onEnd?.();
  };

  rec.onerror = () => {
    handlers.onError?.();
    // onend typically follows onerror; guard against double-finalize
    if (!ended) {
      ended = true;
      handlers.onEnd?.();
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    },
    abort: () => {
      ended = true;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
    },
  };
}
