# Noor Language Studio

A minimalist, privacy-first language learning studio. Build custom vocabulary decks, study them with spaced repetition (SRS), quizzes, and browser-native text-to-speech pronunciation — all stored locally in your browser's IndexedDB. No accounts, no backend, no cloud sync.

The interface is available in **English** and **Russian** (Русский), selectable under **Settings → Interface language**. The studied language (decks/words) is chosen separately and is not affected by the UI language.

## Features

### Study Modes
- **Flashcards** — flip cards with Space, navigate with arrow keys, and rate recall (Hard / Good / Easy) to drive SRS scheduling. In-session relearning re-queues cards rated Hard or answered wrong for another pass.
- **Quizzes** — multiple choice, true/false, listening, typing, and fill-in-the-blank. Optional per-question cooldown timer with smooth color progression and a flashing critical state.
- **Bidirectional direction** — word→translation (recognition), translation→word (production recall), or mixed, chosen per session in quiz setup.
- **Smart Review** — automatically prioritizes cards that are due or weak using Leitner-box SRS scheduling.
- **Session resume** — interrupted quiz/flashcard sessions are snapshotted to `sessionStorage` and offered for resume on return.

### Spaced Repetition (SRS)
- Per-card `srsBox`, `nextReviewAt`, `lapses`, `wrongCount`, confidence, difficulty, mnemonic, and tags fields.
- **Due Reviews Only** and **Leech Lab** filters for both flashcards and quizzes.
- **Review Forecast** — a 7-day due forecast strip plus weekly mastery snapshots per language drawn as a trendline in Statistics.
- Per-deck **mastery percentage** with New / Learning / Mastered breakdown and per-deck accuracy stats.
- **Leech detection** — stubborn cards (3+ lapses or 5+ wrong answers) get a badge, can be excluded or targeted in sessions, and can "graduate" out of leech status.

### Decks, Cards & Notes
- Multiple languages, decks, and smart decks (saved card filters: weak / due / leeches / new / hard / tag).
- Card **tags** with picker, chips, and filtering; bulk card operations (move, retag difficulty, delete).
- **Blacknotes** — multi-note sheets with pin/rename/autosave, card linking (`linkedNoteId`), "send card to notebook" prefilled with word/translation/example, print-friendly export, and jump-to-note from cards.
- JSON/CSV per-deck import/export and full-workspace backup with Merge/Replace restore.
- **Auto-backup nudges** — Statistics reminds you when `lastBackupAt` is older than 14 days, including inside the reset confirmation.

### Pronunciation & Speech
- Browser-native Web Speech API TTS with per-language voice selection, voice preview, and a global mute. `ru-RU` and other locales resolve automatically.
- Cyrillic quick-insert character bar for Russian (`ru-RU`) and other language-specific diacritic presets.
- Optional listening-comprehension quiz mode. (Speaking practice engine exists but is feature-flagged off.)

### Power-User QoL
- **Command palette** (`Ctrl/Cmd+K`) — fuzzy search across decks, cards, and notes, plus actions (new deck, add words, smart/due review, new note, export backup).
- **Global shortcuts** — `g w/q/s/n` view navigation, `c` for new word, `?` cheat sheet; all repeat-safe and input-aware.
- **Word of the Day** spotlight on the Words view.
- **PWA** — installable via `beforeinstallprompt` (Install button in Settings), manifest + offline service worker.
- Undo toasts (8s window) for deletions, toast notifications, sound effects, and speech toggles persisted in IndexedDB.

### UX & Accessibility
- Light/dark themes, consistent micro-animations, GPU-friendly transitions, and `prefers-reduced-motion` support.
- Shared modal system: backdrop-click and **Escape** close (topmost-layer aware), scroll-locked background, theme-aware thin scrollbars.
- Keyboard-first navigation; only vocabulary words and translations are selectable.

## Tech Stack

- **React 19 + TypeScript**
- **Vite 8**
- **Tailwind CSS 4** + Motion
- **IndexedDB** via `idb` (schema v8) — zero backend, all data stays on your device
- **Vitest + Testing Library** for unit tests
- Lightweight `t()` i18n layer (`src/i18n/`) with English source strings and a Russian dictionary; `pluralize()` handles Slavic plural rules

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

The dev server prints its URL on startup (Vite default `http://localhost:5173`). All data is stored in the browser's IndexedDB — no `.env` file or API keys are required.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Production build to `dist/`          |
| `npm run preview` | Preview the production build         |
| `npm run lint`    | TypeScript type-check (`tsc --noEmit`) |
| `npm run test`    | Run tests in watch mode              |
| `npm run test:run`| Run tests once                       |

## Project Structure

```
src/
├── App.tsx                  # State orchestration, persistence, routing, shortcuts
├── types.ts                 # Domain models (Language, Deck, Card, SRS, sessions)
├── i18n/                    # UI localization: t(), pluralize(), ru.ts dictionary
├── components/              # UI screens, modals, palette, study sessions
├── data/seedDecks.ts        # Preset languages and starter decks
└── utils/
    ├── indexedDB.ts         # IndexedDB schema (v8), migrations, preset sync, CRUD
    ├── storage.ts           # Serialization, import/export, backup/restore
    ├── sessionResume.ts     # sessionStorage snapshots for interrupted sessions
    ├── srs.ts               # Leitner scheduling, due/forecast/mastery/leech
    ├── speechUtils.ts       # Web Speech TTS voice resolution
    ├── textUtils.ts         # Answer normalization, diacritic presets, bulk parsing
    └── soundEffects.ts      # UI sound effects

scripts/
└── i18n-*.cjs               # Dictionary audit/dedup helpers for translators
```

## Data & Privacy

All languages, decks, cards, notes, study stats, and preferences live in **IndexedDB** on your device. Clearing browser site data will erase your progress — use **Data & Backup → Export backup** (or Settings) to keep a JSON backup. Statistics nudges you if the last backup is over 14 days old.

<img width="1919" height="980" alt="Screenshot 2026-11-24 094856" src="https://github.com/user-attachments/assets/0f704dc7-dbf9-4be9-a158-ffd92162225f" />
<img width="1919" height="979" alt="Screenshot 2026-11-24 094155" src="https://github.com/user-attachments/assets/d60a0fef-66dd-432f-83ee-e98cf4229da6" />
<img width="1919" height="978" alt="Screenshot 2026-11-24 090257" src="https://github.com/user-attachments/assets/446ffb3e-9985-46f4-820a-793489bc33d3" />
<img width="1919" height="981" alt="Screenshot 2026-11-24 090235" src="https://github.com/user-attachments/assets/6c22189d-fd1e-4eab-85f7-64b8367648ed" />
