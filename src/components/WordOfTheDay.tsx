import { useMemo, useState } from 'react';
import { CalendarDays, Eye, EyeOff } from 'lucide-react';
import { Deck, VocabCard } from '../types';
import { SpeakButton } from './SpeakButton';
import { VoiceSelection } from '../utils/speechUtils';

interface WordOfTheDayProps {
  cards: VocabCard[];
  decks: Deck[];
  langCode: string;
  ttsMuted?: boolean;
  voice?: VoiceSelection | null;
}

/**
 * A single deterministic vocabulary card per calendar day. Viewing it never
 * touches SRS state — it's a lightweight daily encounter, not a review.
 * Picks rotate through the deck in a stable order so every word gets a turn.
 */
export function WordOfTheDay({
  cards,
  decks,
  langCode,
  ttsMuted = false,
  voice,
}: WordOfTheDayProps) {
  const [revealed, setRevealed] = useState(false);

  const pick = useMemo(() => {
    const active = cards.filter((c) => !c.suspended);
    if (active.length === 0) return null;
    // Stable order (by id) + day-of-year index → deterministic daily pick
    const sorted = [...active].sort((a, b) => a.id.localeCompare(b.id));
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const card = sorted[dayOfYear % sorted.length];
    const deck = decks.find((d) => d.id === card.deckId);
    return { card, deckName: deck?.name ?? 'Deck' };
  }, [cards, decks]);

  // Reset the reveal state whenever the daily pick changes
  const pickKey = pick ? `${pick.card.id}:${new Date().toDateString()}` : '';
  const [lastKey, setLastKey] = useState(pickKey);
  if (pickKey !== lastKey) {
    setLastKey(pickKey);
    setRevealed(false);
  }

  if (!pick) return null;
  const { card, deckName } = pick;

  return (
    <section
      aria-label="Word of the day"
      className="bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-5 gap-y-3"
    >
      <div className="flex items-center gap-2 text-[#B45309] dark:text-[#F59E0B] shrink-0">
        <CalendarDays className="w-4 h-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          Word of the day
        </span>
      </div>

      <div className="flex items-baseline gap-3 min-w-0 flex-1">
        <span className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] truncate">
          {card.word}
        </span>
        <SpeakButton
          text={card.word}
          langCode={langCode}
          muted={ttsMuted}
          voice={voice}
          className="-my-1 shrink-0"
        />
        {revealed ? (
          <span className="text-sm text-[#57534E] dark:text-[#C4BEB4] truncate">
            {card.translation}
            {card.exampleSentence && (
              <span className="italic text-[#78716C] dark:text-[#A8A29E]">
                {' '}
                — “{card.exampleSentence}”
              </span>
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#78716C] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Reveal meaning
          </button>
        )}
      </div>

      <span className="text-[11px] text-[#A8A29E] dark:text-[#57534E] truncate max-w-[160px]">
        {deckName}
        {revealed && card.mnemonic ? ` · ${card.mnemonic}` : ''}
      </span>
      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          aria-label="Hide meaning"
          className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      )}
    </section>
  );
}
