import { RU } from './ru';

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
