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

The application uses hash routes (`/#/maths`, `/#/traps`, `/#/fallacies/round`) and does not need server rewrite rules. Publish `dist/` to a static host. The PWA worker pre-caches the application shell and all 50 supplied Rebus images after install; same-origin assets fetched later are cached as well. First install requires a successful online visit. There is no account and no secret key in the browser bundle. Server-side features include optional Deep Stash walkthroughs, the AI-assisted shared knowledge library, and cached topic Q&A. All seven bundled Knowledge Wing disciplines and the daily/random Stash Drop work without database setup; shared generation and shared Q&A need `docs/shared-library-setup.md`. For an existing database, run `db/ask-cache-migration.sql` after deploying the Ask feature.

## Deep Stash walkthroughs (optional, needs a deploy with a serverless host)

Each Deep Stash card can show an AI-written walkthrough (the idea in plain words, how to spot it, a fresh example, a common mistake), and a wrong quiz answer can show why it was tempting. These calls go through `api/teach.js`, a Vercel serverless function that holds the key. The browser never sees it.

Set three environment variables in the Vercel project (Settings, then Environment Variables), then redeploy:

| Variable | Value |
| --- | --- |
| `AI_API_KEY` | Your provider key |
| `AI_BASE_URL` | The provider's OpenAI-compatible base URL, for example `https://generativelanguage.googleapis.com/v1beta/openai/` for Gemini |
| `AI_MODELS` | Comma-separated model IDs, tried in order. For your Gemini setup, use `gemini-2.5-flash,gemini-2.5-flash-lite` |

You already have `AI_API_KEY` and `AI_BASE_URL`; add `AI_MODELS` with exactly this value: `gemini-2.5-flash,gemini-2.5-flash-lite` (comma-separated, no quotes). The first model is tried first, and the second is a fallback if the first errors or returns unusable output. `AI_MODEL` remains supported for an older one-model setup. Save the environment variable and push a commit (or redeploy in Vercel) so the new function configuration is picked up. Without valid configuration, or when the user is offline, the walkthrough buttons show a short message and the rest of the card works as before. Results are cached on the device, so each card costs one request per device. The function accepts only same-origin POSTs, validates and length-limits every field, builds its prompt on the server, and limits each IP to 20 requests per 10 minutes per server instance. `npm run dev` does not serve `/api`; test the live walkthrough on the Vercel deployment instead. You do not need to run `vercel dev` for your normal git-push deployment flow.

## Included content

- **Quick Maths:** 12 authored lesson guides backed by the supplied deterministic maths engine. Each round creates 10 questions. The engine is tested across its tier ranges, and each tier adds two seconds to the chosen base timer. A score of at least 80% advances the maths tier, up to Tier 5. The original five fixed example questions are retained as `src/content/mathQuestions-legacy.json` but are not the active round source.
- **Rebus:** the original 4 hand-built puzzles plus 50 supplied puzzles (54 total), with their supplied local images. Every puzzle has its own written explanation of how the picture spells the phrase, and the Rebus validator rejects missing, repeated, or placeholder explanations. Rebus resumes the current day's session when you leave and return, and each puzzle ID awards XP only once per local profile. Skipping moves to a fresh puzzle state without revealing the skipped answer. Answers up to 12 letters use selectable tiles; longer answers use typing. Hints enforce the XP cost and are disabled until the player can afford them. The threshold is controlled in `src/engine/rebusMatch.js`.
- **Deep Stash:** the original 6 cards plus the supplied 16-card bank (22 total). Tier 2 cards are withheld until every Tier 1 card has been completed. The daily card selection is stored for the day so it cannot change while a user is viewing/completing it.
- **Mind Traps:** the original 5 examples plus the supplied 10-question bank (15 total).
- **The Court:** 20 case files across five tiers, with two counsel arguments, four verdict options, deciding/acceptable/trap/irrelevant factors, and written rulings. The Court route is available from Play.
- **Fallacies:** a separate 10-question untimed route linked from the Mind Traps hub. Scenario/context is shown before the question in both reasoning modes.
- **Knowledge Wing:** seven starter disciplines (Psychology & Human Nature; Influence & Manipulation; Scale of Reality; Laws, Principles & Mental Models; Practical Intelligence; Hidden Systems; Money, Economics & Financial Psychology), with three authored starter discoveries each.
- **Stash Drops:** a daily discovery pop-up plus manual Surprise Me, saving to the user's local Collection, and a deeper article with a recall question.
- **Shared AI library:** Vercel API routes generate reviewed drafts for each Knowledge Wing discipline, enforce database-backed daily quotas, and run one scheduled candidate generation per day. Drafts require review before they are visible to everyone. Set up through `docs/shared-library-setup.md`.
- **Ask about this:** contextual Q&A is available on Knowledge Wing articles, Deep Stash principles, Quick Maths technique pages, solved Rebus puzzles, revealed Mind Trap/Fallacies questions, and Court cases after a verdict. Readers can ask up to two questions per topic per local day, with suggested follow-ups tailored to the discipline. Questions and answers are shared; matching normalized questions on the same topic reuse the cached answer. The server verifies topics against bundled or approved content before generating an answer.
- **Progress and settings:** local XP, levels, streaks, maths tier, saved cards and discoveries, daily selection/completion, sound feedback, reduced motion, custom maths timer, and text-based result sharing.

The new bank wording, explanations, attribution, and inferred-answer markers are preserved from the supplied files. Content fact-checking was not part of this integration. The Rebus entry mode is derived from the letter-count constant, rather than trusted from a static field in each puzzle.

## Structure

```text
src/
  app/          hash routes and connection between engine and screens
  engine/       math generator, timer, storage, Rebus matching, timer-state, stash progression and AI walkthrough client logic
  content/      local JSON banks for all modes
  components/   shared brand, icons, shell, and navigation
  screens/      home, play, quiz, archive, Court, Knowledge Wing, library review and settings screens
api/             optional serverless function for Deep Stash walkthroughs
server/          request validation and prompt building used by api/
public/
  rebus/        50 supplied JPEGs plus 4 original SVG puzzles
  sw.js         production offline cache
scripts/        content/asset/engine contract validation
 test/          maths engine, timer-race, stash-progression, AI endpoint and shared-library regression tests
```

All user progress and saved discoveries use guarded `localStorage` calls and remain on the current browser; approved AI content is stored in the shared database. In Vite development mode, Brain Stash unregisters an old app service worker and clears its prior caches so stale bundles do not mask code changes. Production mode registers the service worker.

## Validation

`npm test` runs:

1. A regression test for the stale-zero timer bug (new question must synchronously show its full timer).
2. The supplied maths engine checks: 14,400 generated questions and 178,752 assertions.
3. Deep Stash tier-progression tests (Tier 2 stays sealed until every Tier 1 card is complete) and a regression test that opening an archive or collection card resolves to the card itself.
4. Local content validation for lesson/skill links, answer IDs, four-option question banks, tier rules, Rebus answer lengths and pools, image paths, and generated tier timers.
5. AI walkthrough endpoint tests with a mocked provider: request validation and length limits, same-origin and rate-limit handling, missing configuration, malformed model output, and a check that the key never appears in a response.

Shared AI library setup: `docs/shared-library-setup.md`. Supabase recommends current `sb_secret_...` API keys for server-side access; the server code also accepts the legacy `service_role` JWT during migration. The full Vite production bundle should also be checked in an environment with npm dependencies installed using `npm run build`.
