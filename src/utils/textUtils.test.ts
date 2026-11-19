import { describe, expect, it } from 'vitest';
import {
  createBlankedSentence,
  evaluateTypedAnswer,
  getDiacriticsForLang,
  parseBulkLines,
} from './textUtils';

describe('parseBulkLines', () => {
  it('parses common separators and trims whitespace', () => {
    const { items, skippedLines } = parseBulkLines(
      [
        'labas - hello',
        'ačiū -> thank you',
        'duona ; bread',
        'vanduo\twater',
        'labas — hello',
        'kaip = how',
      ].join('\n')
    );

    expect(skippedLines).toEqual([]);
    expect(items).toHaveLength(6);
    expect(items[0]).toEqual({ word: 'labas', translation: 'hello', exampleSentence: undefined });
    expect(items[1].word).toBe('ačiū');
    expect(items[1].translation).toBe('thank you');
    expect(items[4].translation).toBe('hello');
    expect(items[5].translation).toBe('how');
  });

  it('captures example sentences after a pipe', () => {
    const { items } = parseBulkLines('labas - hello | Labas rytas!');
    expect(items[0]).toEqual({
      word: 'labas',
      translation: 'hello',
      exampleSentence: 'Labas rytas!',
    });
  });

  it('supports unspaced dashes via fallback and skips invalid lines', () => {
    const { items, skippedLines } = parseBulkLines(
      ['word-translation', 'justaword', '', '  ', 'ok-word'].join('\n')
    );
    expect(items.map((i) => i.word)).toEqual(['word', 'ok']);
    expect(skippedLines).toEqual([2]);
  });

  it('returns empty results for empty input', () => {
    expect(parseBulkLines('')).toEqual({ items: [], skippedLines: [] });
    expect(parseBulkLines('   \n\n')).toEqual({ items: [], skippedLines: [] });
  });
});

describe('evaluateTypedAnswer', () => {
  it('accepts exact matches case-insensitively and ignores punctuation', () => {
    expect(evaluateTypedAnswer('  HELLO! ', 'hello')).toEqual({
      isCorrect: true,
      status: 'exact',
      matchedTarget: 'hello',
    });
    expect(evaluateTypedAnswer('hello, world', 'hello world').status).toBe('exact');
  });

  it('supports slash-separated answer variants and extra accepted answers', () => {
    expect(evaluateTypedAnswer('sağ olun', 'hələlik / sağ olun').isCorrect).toBe(true);
    expect(
      evaluateTypedAnswer('cheers', 'thanks', ['cheers', 'thank you']).isCorrect
    ).toBe(true);
  });

  it('tolerates a single typo for words of length >= 3', () => {
    expect(evaluateTypedAnswer('helo', 'hello').status).toBe('typo');
    expect(evaluateTypedAnswer('hellp', 'hello').status).toBe('typo');
    expect(evaluateTypedAnswer('hlelo', 'hello').status).toBe('typo'); // transposition
    expect(evaluateTypedAnswer('hexlo', 'hello').status).toBe('typo'); // substitution
  });

  it('rejects answers two or more edits away', () => {
    const result = evaluateTypedAnswer('hxllx', 'hello');
    expect(result.isCorrect).toBe(false);
    expect(result.status).toBe('incorrect');
  });

  it('does not apply typo tolerance to very short targets', () => {
    expect(evaluateTypedAnswer('hz', 'hi').isCorrect).toBe(false);
    expect(evaluateTypedAnswer('hi', 'hi').isCorrect).toBe(true);
  });

  it('marks empty input as incorrect', () => {
    const result = evaluateTypedAnswer('   ', 'hello');
    expect(result.isCorrect).toBe(false);
    expect(result.status).toBe('incorrect');
  });
});

describe('createBlankedSentence', () => {
  it('blanks the exact target word case-insensitively', () => {
    const result = createBlankedSentence('Aš eisiu namo.', 'aš');
    expect(result).not.toBeNull();
    expect(result!.blanked).toBe('_____ eisiu namo.');
    expect(result!.matchedToken).toBe('Aš');
  });

  it('respects word boundaries and unicode letters', () => {
    const result = createBlankedSentence('Aš myliu širdį.', 'širdį');
    expect(result).not.toBeNull();
    expect(result!.blanked).toBe('Aš myliu _____.');
  });

  it('matches inflected forms via shared stem prefix', () => {
    const result = createBlankedSentence('Ji kalba lietuviškai.', 'kalbėti');
    expect(result).not.toBeNull();
    expect(result!.blanked).toBe('Ji _____ lietuviškai.');
    expect(result!.matchedToken).toBe('kalba');
  });

  it('returns null when the target does not appear', () => {
    expect(createBlankedSentence('Labas rytas', 'vanduo')).toBeNull();
    expect(createBlankedSentence('', 'labas')).toBeNull();
    expect(createBlankedSentence('Labas', '')).toBeNull();
  });
});

describe('getDiacriticsForLang', () => {
  it('returns the matching preset and falls back to Lithuanian', () => {
    expect(getDiacriticsForLang('lt-LT').id).toBe('lt-LT');
    expect(getDiacriticsForLang('de').id).toBe('de-DE');
    expect(getDiacriticsForLang('xx-XX').id).toBe('lt-LT');
  });
});
