# Brain Stash

A mobile-first, offline-friendly mind-training game built with React and Vite. The interface uses a restrained classical-archive design system: obsidian and charcoal surfaces, aged parchment typography, bronze detailing, and one controlled accent per practice mode.

## Run locally

```bash
npm install
npm run dev
```

Run the regression and content checks:

```bash
npm test
```

Build for static hosting:

```bash
npm run build
npm run preview
```

The application uses hash routes (`/#/maths`, `/#/traps`, `/#/fallacies/round`) and does not need server rewrite rules. Publish `dist/` to a static host. The PWA worker pre-caches the application shell and all 50 supplied Rebus images after install; same-origin assets fetched later are cached as well. First install requires a successful online visit. There is no account, backend, remote AI request, or browser-shipped secret key.

## Included content

- **Quick Maths:** 12 authored lesson guides backed by the supplied deterministic maths engine. Each round creates 10 questions. The engine is tested across its tier ranges, and each tier adds two seconds to the chosen base timer. A score of at least 80% advances the maths tier, up to Tier 5. The original five fixed example questions are retained as `src/content/mathQuestions-legacy.json` but are not the active round source.
- **Rebus:** the original 4 hand-built puzzles plus 50 supplied puzzles (54 total), with their supplied local images. Answers up to 12 letters use selectable tiles; longer answers use typing. Hints enforce the XP cost and are disabled until the player can afford them. The threshold is controlled in `src/engine/rebusMatch.js`.
- **Deep Stash:** the original 6 cards plus the supplied 16-card bank (22 total). Tier 2 cards are withheld until every Tier 1 card has been completed. The daily card selection is stored for the day so it cannot change while a user is viewing/completing it.
- **Mind Traps:** the original 5 examples plus the supplied 10-question bank (15 total).
- **Fallacies:** a separate 10-question untimed route linked from the Mind Traps hub. Scenario/context is shown before the question in both reasoning modes.
- **Progress and settings:** local XP, levels, streaks, maths tier, saved cards, daily selection/completion, sound feedback, reduced motion, custom maths timer, and text-based result sharing.

The new bank wording, explanations, attribution, and inferred-answer markers are preserved from the supplied files. Content fact-checking was not part of this integration. The Rebus entry mode is derived from the letter-count constant, rather than trusted from a static field in each puzzle.

## Structure

```text
src/
  app/          hash routes and connection between engine and screens
  engine/       math generator, timer, storage, Rebus matching, timer-state and stash progression logic
  content/      local JSON banks for all modes
  components/   shared brand, icons, shell, and navigation
  screens/      presentational home, lesson, quiz, puzzle, archive, result, profile, and settings screens
public/
  rebus/        50 supplied JPEGs plus 4 original SVG puzzles
  sw.js         production offline cache
scripts/        content/asset/engine contract validation
 test/          maths engine, timer-race, and stash-progression regression tests
```

All user progress uses guarded `localStorage` calls and remains on the current browser. In Vite development mode, Brain Stash unregisters an old app service worker and clears its prior caches so stale bundles do not mask code changes. Production mode registers the service worker.

## Validation

`npm test` runs:

1. A regression test for the stale-zero timer bug (new question must synchronously show its full timer).
2. The supplied maths engine checks: 14,400 generated questions and 178,752 assertions.
3. Deep Stash tier-progression tests (Tier 2 stays sealed until every Tier 1 card is complete).
4. Local content validation for lesson/skill links, answer IDs, four-option question banks, tier rules, Rebus answer lengths and pools, image paths, and generated tier timers.

The full Vite production bundle should also be checked in an environment with the npm dependencies installed using `npm run build`.
