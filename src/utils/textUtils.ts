import { AnswerStatus } from '../types';

export interface ParsedBulkItem {
  word: string;
  translation: string;
  exampleSentence?: string;
}

export interface BulkParseResult {
  items: ParsedBulkItem[];
  skippedLines: number[];
}

/**
 * Parses bulk lines formatted like:
 * - labas - salam
 * - labas - salam | Labas rytas!
 * - ačiū -> thank you
 * - duona ; bread
 * - vanduo \t water
 */
export function parseBulkLines(raw: string): BulkParseResult {
  const lines = raw.split(/\r?\n/);
  const items: ParsedBulkItem[] = [];
  const skippedLines: number[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    let mainPart = trimmed;
    let exampleSentence: string | undefined;

    // Quoted CSV row (e.g. "word","translation","example") — split on ","
    // boundaries so commas inside fields are preserved.
    if (trimmed.startsWith('"')) {
      const fields = trimmed
        .replace(/^"|"$/g, '')
        .split('","')
        .map((f) => f.replace(/""/g, '"').trim());
      if (fields.length >= 2 && fields[0] && fields[1]) {
        if (!/^word$/i.test(fields[0]) || !/^translation$/i.test(fields[1])) {
          items.push({
            word: fields[0],
            translation: fields[1],
            exampleSentence: fields[2] || undefined,
          });
        }
        return;
      }
    }

    // Skip a bare header row like "word,translation,example"
    if (/^word\s*,\s*translation/i.test(trimmed)) return;

    const pipeIndex = trimmed.indexOf('|');
    if (pipeIndex !== -1) {
      mainPart = trimmed.slice(0, pipeIndex).trim();
      const ex = trimmed.slice(pipeIndex + 1).trim();
      if (ex) exampleSentence = ex;
    }

    const separators = [' -> ', ' — ', ' – ', ' - ', '\t', ';', '=', ','];
    let word = '';
    let translation = '';
    let matched = false;

    const unquote = (s: string) =>
      s.length > 1 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;

    for (const sep of separators) {
      const idx = mainPart.indexOf(sep);
      if (idx > 0) {
        word = unquote(mainPart.slice(0, idx).trim());
        translation = unquote(mainPart.slice(idx + sep.length).trim());
        if (word && translation) {
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      // Fallback: try unspaced dash only when flanked by non-empty segments
      const dashMatch = mainPart.match(/^(.+?)\s*-\s*(.+)$/);
      if (dashMatch && dashMatch[1].trim() && dashMatch[2].trim()) {
        word = dashMatch[1].trim();
        translation = dashMatch[2].trim();
        matched = true;
      }
    }

    if (matched) {
      items.push({ word, translation, exampleSentence });
    } else {
      skippedLines.push(index + 1);
    }
  });

  return { items, skippedLines };
}

function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()"'„“«»]/g, '')
    .replace(/\s+/g, ' ');
}

function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n];
}

/**
 * Evaluates a user's typed answer against an expected answer string.
 * Supports multi-variant answers separated by "/" (e.g., "sağ olun / hələlik")
 * and smart 1-character typo tolerance (for target tokens of length >= 3).
 */
export function evaluateTypedAnswer(
  userInput: string,
  expectedRaw: string,
  extraAccepted?: string[]
): { isCorrect: boolean; status: AnswerStatus; matchedTarget: string } {
  const cleanUser = normalizeAnswer(userInput);
  if (!cleanUser) {
    return { isCorrect: false, status: 'incorrect', matchedTarget: expectedRaw };
  }

  const candidates = [
    expectedRaw,
    ...expectedRaw.split('/').map((part) => part.trim()),
    ...(extraAccepted ?? []),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (cleanUser === normalizeAnswer(candidate)) {
      return { isCorrect: true, status: 'exact', matchedTarget: candidate };
    }
  }

  // Check 1-character typo tolerance
  for (const candidate of candidates) {
    const cleanCandidate = normalizeAnswer(candidate);
    if (cleanCandidate.length < 3) continue;
    const distance = damerauLevenshtein(cleanUser, cleanCandidate);
    if (distance <= 1) {
      return { isCorrect: true, status: 'typo', matchedTarget: candidate };
    }
  }

  return { isCorrect: false, status: 'incorrect', matchedTarget: expectedRaw };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Masks the target word inside an example sentence for Fill-in-the-Blanks quizzes.
 * Handles Unicode letters (e.g. Lithuanian diacritics) and basic inflection stems.
 */
export function createBlankedSentence(
  sentence: string,
  targetWord: string
): { blanked: string; matchedToken: string } | null {
  const cleanSentence = sentence.trim();
  const cleanWord = targetWord.trim();
  if (!cleanSentence || !cleanWord) return null;

  // 1. Exact phrase/word match (Unicode-aware boundaries)
  const escaped = escapeRegExp(cleanWord);
  const exactRegex = new RegExp(
    `(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`,
    'iu'
  );
  const exactMatch = cleanSentence.match(exactRegex);
  if (exactMatch && exactMatch[2]) {
    const matchedToken = exactMatch[2];
    const blanked = cleanSentence.replace(exactRegex, `$1_____`);
    return { blanked, matchedToken };
  }

  // 2. Stem-aware match for inflected words (e.g. "širdis" -> "širdį", "kalbėti" -> "kalbu")
  const tokens = [...cleanSentence.matchAll(/\p{L}+/gu)];
  const lowerWord = cleanWord.toLowerCase();
  if (lowerWord.length >= 4 && !lowerWord.includes(' ')) {
    const minPrefix = Math.max(3, Math.floor(lowerWord.length * 0.55));
    // Pick the strongest candidate — longest shared prefix, ties broken by
    // the shortest token — instead of the first token in sentence order,
    // which could blank a merely-similar word that appears earlier.
    let best: { token: string; index: number; common: number } | null = null;
    for (const match of tokens) {
      const token = match[0];
      const lowerToken = token.toLowerCase();
      let common = 0;
      const limit = Math.min(lowerWord.length, lowerToken.length);
      while (common < limit && lowerWord[common] === lowerToken[common]) {
        common++;
      }
      if (common < minPrefix || match.index === undefined) continue;
      if (
        !best ||
        common > best.common ||
        (common === best.common && token.length < best.token.length)
      ) {
        best = { token, index: match.index, common };
      }
    }
    if (best) {
      const before = cleanSentence.slice(0, best.index);
      const after = cleanSentence.slice(best.index + best.token.length);
      return { blanked: `${before}_____${after}`, matchedToken: best.token };
    }
  }

  return null;
}

export interface DiacriticPreset {
  id: string;
  label: string;
  chars: string[];
}

export const DIACRITIC_PRESETS: DiacriticPreset[] = [
  {
    id: 'lt-LT',
    label: 'Lithuanian',
    chars: ['ą', 'č', 'ę', 'ė', 'į', 'š', 'ų', 'ū', 'ž'],
  },
  {
    id: 'az-AZ',
    label: 'Azərbaycanca',
    chars: ['ə', 'ç', 'ğ', 'ı', 'ö', 'ş', 'ü'],
  },
  {
    id: 'de-DE',
    label: 'German',
    chars: ['ä', 'ö', 'ü', 'ß'],
  },
  {
    id: 'fr-FR',
    label: 'French',
    chars: ['é', 'è', 'ê', 'à', 'ç', 'ù', 'î', 'ô'],
  },
  {
    id: 'es-ES',
    label: 'Spanish',
    chars: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'],
  },
  {
    id: 'tr-TR',
    label: 'Turkish',
    chars: ['ç', 'ğ', 'ı', 'ö', 'ş', 'ü'],
  },
];

export function getDiacriticsForLang(speechLang: string): DiacriticPreset {
  const found = DIACRITIC_PRESETS.find(
    (p) => p.id.toLowerCase() === speechLang.toLowerCase() || p.id.slice(0, 2) === speechLang.slice(0, 2).toLowerCase()
  );
  return found ?? DIACRITIC_PRESETS[0];
}
