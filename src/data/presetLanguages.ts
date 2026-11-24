import { LanguageItem } from '../types';

const nowIso = '2026-11-17T08:00:00.000Z';

export const PRESET_LANGUAGES: LanguageItem[] = [
  {
    id: 'lang-lt',
    name: 'Lithuanian',
    nativeLabel: 'Lietuvių kalba',
    code: 'LT',
    createdAt: nowIso,
  },
  {
    id: 'lang-en',
    name: 'English',
    nativeLabel: 'English',
    code: 'EN',
    createdAt: nowIso,
  },
  {
    id: 'lang-de',
    name: 'German',
    nativeLabel: 'Deutsch',
    code: 'DE',
    createdAt: nowIso,
  },
  {
    id: 'lang-ru',
    name: 'Russian',
    nativeLabel: 'Русский',
    code: 'RU',
    createdAt: nowIso,
  },
  {
    id: 'lang-es',
    name: 'Spanish',
    nativeLabel: 'Español',
    code: 'ES',
    createdAt: nowIso,
  },
  {
    id: 'lang-tr',
    name: 'Turkish',
    nativeLabel: 'Türkçe',
    code: 'TR',
    createdAt: nowIso,
  },
];
