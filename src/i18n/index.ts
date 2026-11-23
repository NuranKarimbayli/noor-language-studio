import { RU, RU_PLURALS } from './ru';

export type UiLanguage = 'en' | 'ru';

export const UI_LANGUAGES: { id: UiLanguage; label: string; nativeLabel: string }[] = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'ru', label: 'Russian', nativeLabel: 'Русский' },
];

// Module-level current UI language. Set synchronously during App render so
// every t() call in the same render pass already sees the active language —
// no context/provider plumbing needed across ~20 components.
let currentLang: UiLanguage = 'en';

export function setUiLanguage(lang: UiLanguage): void {
  currentLang = lang;
}

export function getUiLanguage(): UiLanguage {
  return currentLang;
}

/**
 * Translate an English source string. Untranslated strings fall back to the
 * source text, so coverage can grow incrementally. `{name}` placeholders are
 * interpolated from `vars`.
 */
export function t(
  text: string,
  vars?: Record<string, string | number>
): string {
  let out = currentLang === 'ru' ? (RU[text] ?? text) : text;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      out = out.split(`{${key}}`).join(String(value));
    }
  }
  return out;
}

/**
 * Localized plural noun form. English picks singular/plural; Russian uses
 * the one/few/many rule (1 слово, 3 слова, 5 слов, 11 слов, 21 слово).
 * `plural` is the English plural form (defaults to singular + 's').
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  const enPlural = plural ?? `${singular}s`;
  if (currentLang !== 'ru') {
    return count === 1 ? singular : enPlural;
  }
  const forms = RU_PLURALS[singular];
  if (!forms) return count === 1 ? singular : enPlural;
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}
