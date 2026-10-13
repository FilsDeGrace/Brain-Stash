# Brain Stash (working title): Component Contract

Stack: React (Vite) in JSX with JSDoc types, any styling approach (Tailwind recommended, driven by the CSS-variable tokens in section 2).

Purpose: split the app into a **logic layer** (hooks, content, scoring, storage) and a **presentation layer** (screens and components). The design layer can be restyled freely as long as it respects the props below. Client-side, plus one optional serverless function (`api/teach.js`) that holds the AI key. No API keys in the bundle.

## 1. Ground rules

1. **Presentational components are dumb.** They render props and call callbacks. They never own timers, scoring, storage, or fetches.
2. **All user-facing text comes from props or content JSON.** No hardcoded strings that explain implementation or history. Every string is written for a first-time stranger.
3. **Routing:** hash router (`/#/maths`) so it deploys to any static host with no rewrite rules.
4. **Mode accent:** each screen's root gets `data-mode="maths|rebus|stash|traps|court"`. The design layer defines one accent colour per mode via CSS variables.
5. **Input safety:** after an answer is chosen, `locked` is `true`. Components must ignore further taps while locked (no double-submit).
6. **Accessibility baseline:** tap targets at least 44px, visible focus states, buttons not divs, timer exposed via `aria-live="polite"` at coarse intervals only (not every tick), respect `prefers-reduced-motion`.
7. **Tab hidden = timer paused** (handled in the logic layer; the UI just receives `paused`).

## 2. Design tokens (design layer owns the values)

`--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`, `--radius`, `--shadow`, `--color-correct`, `--color-wrong`, `--color-warn`, `--color-maths`, `--color-rebus`, `--color-stash`, `--color-traps`, `--font-display`, `--font-body`.

With Tailwind, map these variables in the theme config so utility classes read from them. Restyling the app then means changing token values only.

## 3. Folder layout

```
src/
  engine/      hooks and pure logic (logic layer)
  content/     JSON banks: lessons, rebus, traps, fallacies, stash
  screens/     presentational screens (design layer)
  components/  shared presentational pieces (design layer)
  app/         router and wiring: connects engine hooks to screens
```

`app/` is the only place that imports from both `engine/` and `screens/`.

## 4. Shared types (JSDoc)

```js
/** @typedef {{ id: string, label: string }} Option */

/** @typedef {'idle'|'running'|'revealed'|'finished'} RoundStatus */

/** @typedef {{ selectedId: string|null, correctId: string, timedOut: boolean }} Reveal */

/** @typedef {{ timeLeftMs: number, totalMs: number, paused: boolean }} TimerState */

/** @typedef {{ streak: number, xp: number, level: number, xpToNext: number }} Progress */
```

## 5. Screens and props

### HomeScreen
```js
{
  progress: Progress,
  daily: { done: { maths: boolean, rebus: boolean, stash: boolean }, onStart: () => void },
  modes: Array<{ id: 'maths'|'rebus'|'stash'|'traps'|'court', title: string, blurb: string, badge?: string }>,
  onSelectMode: (id: string) => void,
  onOpenCollection: () => void,
  onOpenSettings: () => void,
}
```

### LessonScreen (maths trick lesson)
```js
{
  title: string,                       // e.g. "Multiply by 11"
  steps: Array<{ heading: string, body: string, example?: string }>,
  stepIndex: number,
  onNext: () => void, onBack: () => void,
  onStartRound: () => void,            // shown on the last step
}
```

### QuizRoundScreen (maths timed round; also reused by Mind Traps)
```js
{
  mode: 'maths'|'traps',
  prompt: string,                      // "45 × 123"
  context?: string,                    // fallacy/trap scenario text
  options: Option[],                   // 4 options
  status: RoundStatus,
  locked: boolean,
  reveal: Reveal | null,               // set when status === 'revealed'
  explanation?: string,                // shown on reveal (trick or reasoning)
  timer: TimerState | null,            // null for untimed rounds
  questionNumber: number, totalQuestions: number,
  onSelect: (optionId: string) => void,
  onNext: () => void,                  // enabled only when revealed
  onQuit: () => void,
}
```
The timer is passed as `timeLeftMs` and `totalMs` so any visual (ring, bar) can be drawn from the ratio.

### RebusScreen
Two entry modes, chosen by the logic layer per puzzle: `tiles` for short answers (12 letters or fewer, adjustable) and `typing` for long ones. The screen renders whichever `entryMode` it is given.
```js
{
  imageSrc: string, imageAlt: string,  // alt: "Rebus puzzle, number N"
  entryMode: 'tiles' | 'typing',
  wordLengths: number[],               // e.g. [4, 5] shown as "(4, 5)" in both modes
  status: RoundStatus,
  locked: boolean,
  attempt: 'none' | 'wrong',           // 'wrong' triggers a gentle shake and message, input is kept
  hintsLeft: number, hintCost: number,
  timer: TimerState | null,
  puzzleNumber: number, totalPuzzles: number,
  answerText?: string,                 // shown on reveal
  onHint: () => void, onSkip: () => void, onNext: () => void, onQuit: () => void,

  // entryMode === 'tiles'
  slots?: Array<
    | { kind: 'letter', char: string|null, locked: boolean }
    | { kind: 'fixed', char: string }  // space, hyphen, apostrophe, slash: shown, not typed
  >,
  pool?: Array<{ id: string, char: string, used: boolean }>,
  onPlaceTile?: (tileId: string) => void,
  onClearSlot?: (slotIndex: number) => void,

  // entryMode === 'typing'
  inputValue?: string,
  onInputChange?: (value: string) => void,
  onSubmit?: () => void,               // Enter key and a visible Submit button
}
```
Answer matching is done in the logic layer (case, punctuation and spacing ignored, plus an `accepts[]` list per puzzle), so the UI never judges correctness. A hint reveals the next unrevealed letter (tiles) or the first letter of the next word (typing).

### StashCardScreen (Deep Stash)
```js
{
  card: {
    id: string, title: string, category: string,
    summary: string, example: string, whyItMatters: string,
  },
  saved: boolean,
  quiz: { prompt: string, options: Option[] } | null,
  quizReveal: Reveal | null,
  locked: boolean,
  onSave: () => void,
  onSelectQuizOption: (optionId: string) => void,
  onDone: () => void,
}
```

### CollectionScreen
```js
{
  cards: Array<{ id: string, title: string, category: string, savedAt: number }>,
  categories: string[], activeCategory: string|null,
  onFilter: (category: string|null) => void,
  onOpenCard: (id: string) => void,
  onBack: () => void,
}
```
Needs an empty state ("Nothing saved yet") written for a new user.

### ResultScreen
```js
{
  mode: string,
  score: number, total: number,
  xpGained: number, newLevel: number|null,
  streak: number,
  shareText: string,
  onShare: () => void,                 // navigator.share, falling back to clipboard
  onRetry: () => void, onHome: () => void,
}
```

### SettingsScreen
```js
{
  timerLength: 10 | 15, soundOn: boolean, reducedMotion: boolean,
  geminiKeyPresent: boolean,           // optional bring-your-own-key feature
  onChange: (patch: object) => void,
  onSaveKey: (key: string) => void, onClearKey: () => void,
  onResetProgress: () => void,         // needs a confirm step in the UI
}
```

## 6. Engine hooks (logic layer, for reference)

| Hook | Returns |
|---|---|
| `useCountdown(totalMs)` | `{ timeLeftMs, totalMs, paused, start, stop, reset }` |
| `useQuizRound(questions, opts)` | props for `QuizRoundScreen` |
| `useRebusRound(puzzles, opts)` | props for `RebusScreen` |
| `useStashSession()` | props for `StashCardScreen` and `CollectionScreen` |
| `useProgress()` | `Progress` plus `award(xp)` and `bumpStreak()` |
| `useDaily()` | seeded daily picks and completion flags |
| `useSettings()` | settings plus `update(patch)` |

All persistence goes through one storage module with try/catch and an empty-state fallback.

## 7. States every screen must handle

- Loading content (skeleton, no layout shift)
- Content failed to load (plain message and a retry button)
- Empty (no saved cards, no daily picks)
- Round: idle, running, revealed, finished
- Timed out (treated as wrong, `reveal.timedOut === true`)
- Offline (the game must still work; nothing blocks on network)
- Refresh mid-round (the engine restores or restarts cleanly; the UI never shows a half-state)

## 8. Decisions

1. **Language:** JSX with JSDoc types (no TypeScript).
2. **Styling:** open to the design layer; Tailwind recommended, wired to the tokens in section 2.
3. **Rebus entry:** letter tiles for short answers, free typing with a word-length pattern for long ones (threshold 12 letters, adjustable in one constant).
