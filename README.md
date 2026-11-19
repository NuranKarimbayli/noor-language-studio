# Noor Language Studio

A minimalist, privacy-first language learning studio. Build custom vocabulary decks, study them with spaced repetition (SRS), quizzes, and browser-native text-to-speech pronunciation — all stored locally in your browser's IndexedDB. No accounts, no backend, no cloud sync.

## Features

### Study Modes
- **Flashcards** — flip cards with Space, navigate with arrow keys, and rate recall (Hard / Good / Easy) to drive SRS scheduling.
- **Quizzes** — multiple choice, fill-in-the-blank, true/false, and listening comprehension. Optional per-question cooldown timer with smooth color progression and a flashing critical state.
- **Smart Review** — automatically prioritizes cards that are due for review using Leitner-box SRS scheduling.

### Spaced Repetition (SRS)
- Per-card `srsBox`, `nextReviewAt`, `lapses`, and `wrongCount` fields.
- **Due Reviews Only** filter for both flashcards and quizzes.
- **Review Forecast** — see how many cards are due today, tomorrow, and this week.
- Per-deck **mastery percentage** with New / Learning / Mastered breakdown.
- **Leech detection** — stubborn cards (3+ lapses or 5+ wrong answers) get a badge and can be excluded or targeted in sessions.

### Pronunciation
- Browser-native Web Speech API TTS with per-language voice selection, voice preview, and a global mute.
- Refuses unrelated fallback voices so pronunciation is never misleading.
- Optional listening-comprehension quiz mode.

### Data & Backup
- **Full JSON export/import** with versioned backups, Merge and Replace restore modes.
- Safe parsing with malformed-record filtering and backward compatibility for older data.

### UX & Accessibility
- Keyboard-first: `?` opens a shortcut cheat sheet; all handlers are repeat-safe and ignore text inputs.
- Undo toasts (8s window) for card, deck, and language deletions.
- Consistent pointer cursors and restricted text selection — only vocabulary words and translations are selectable.
- Light/dark themes, toast notifications, sound effects, and speech toggles persisted in IndexedDB.
- Animated modals, toasts, and transitions via Motion.

## Tech Stack

- **React 19 + TypeScript**
- **Vite 8**
- **Tailwind CSS 4**
- **IndexedDB** via `idb` — zero backend, all data stays on your device
- **Vitest + Testing Library** for unit tests

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. All data is stored in the browser's IndexedDB — no `.env` file or API keys are required.

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
├── App.tsx                  # State orchestration, persistence, routing
├── types.ts                 # Domain models (Language, Deck, Card, SRS fields)
├── components/              # UI screens and modals
├── data/seedDecks.ts        # Preset starter decks
└── utils/
    ├── indexedDB.ts         # IndexedDB schema, migrations, CRUD
    ├── storage.ts           # Serialization, backup/restore helpers
    ├── srs.ts               # Leitner scheduling, due/forecast/mastery/leech
    ├── speechUtils.ts       # Web Speech TTS voice resolution
    └── soundEffects.ts      # UI sound effects
```

## Data & Privacy

All languages, decks, cards, study stats, and preferences live in **IndexedDB** on your device. Clearing browser site data will erase your progress — use **Data & Backup → Export All Data** in the app to keep a JSON backup.
