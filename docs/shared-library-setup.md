# Brain Stash shared AI library setup

The seven bundled disciplines work without a database. To let everyone share newly generated items, deploy the `brain_stash_items` store in Supabase and configure the server-only Vercel variables below. Do not put a Supabase service-role key, AI key, admin token or cron secret in frontend code.

## 1. Create the shared database

1. Create a Supabase project.
2. Open **SQL Editor** in that project.
3. Paste and run the complete contents of `db/shared-library.sql`.
4. In your project's **Connect** dialog or **Settings → API Keys**, copy the project URL and create/copy a **Secret key** beginning with `sb_secret_`. Keep it private: it bypasses row-level security and belongs only on the Vercel server. The code also accepts the legacy `service_role` JWT during migration, but Supabase plans to deprecate legacy `service_role` keys by the end of 2026, so use a new Secret key for a fresh setup.

The SQL creates the shared content table, generation-usage table, and an atomic quota function. The browser has no direct database access.

## 2. Add Vercel environment variables

In **Vercel → Project → Settings → Environment Variables**, add these server-side variables for Production (and Preview if you want to test there):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL, such as `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_SECRET_KEY` | The private Supabase Secret key (`sb_secret_...`). Never expose this to the browser. |
| `CONTENT_ADMIN_TOKEN` | A long random secret used only to open the content review queue. |
| `CRON_SECRET` | A different long random secret for the daily scheduled generator. |
| `QUOTA_SALT` | Another random secret used to hash requester IPs before quota records are stored. |

Your existing `AI_API_KEY`, `AI_BASE_URL` and `AI_MODELS` remain in use. `AI_MODELS` should stay comma-separated, for example `gemini-2.5-flash,gemini-2.5-flash-lite`.

Use separate random values for `CONTENT_ADMIN_TOKEN`, `CRON_SECRET` and `QUOTA_SALT`. Do not reuse your Gemini key as an admin credential. After setting variables, redeploy through your normal Git push workflow.

## 3. How generation works

- The public app can read only `approved` entries from the server API.
- On-demand generation is limited to 3 requests per IP hash per UTC day and 20 generation requests globally per UTC day. The global quota is enforced in the database, not just in one serverless instance.
- The daily Vercel cron attempts to create one additional candidate. On Vercel Hobby, cron jobs can run once per day; the schedule is set to 08:00 UTC, with the platform's normal timing window.
- Every generated item is stored as `pending`. The requesting browser can preview and save its draft locally, but it does not appear as shared content until approved.
- If a candidate title already exists in that discipline, the API returns the existing item instead of duplicating it.
- The admin review screen is at `/#/library-review`. Enter `CONTENT_ADMIN_TOKEN`, load the queue, check claims and source links, then approve or reject each draft. The token is kept in screen memory and is not saved to local storage.
- AI-generated source links are suggestions, not proof. Open and verify sources before approving. Reject unsupported claims, made-up citations, unsafe instructions or personalised financial advice.

## 4. What if I have not configured Supabase yet?

The app still displays the bundled starter content and daily Stash Drops. The Generate button explains that shared storage needs setup. There is no hidden writable JSON file: Vercel deployments are immutable, so the app uses the database for new shared entries.

## 5. Privacy and limits

There are no user accounts in this milestone. The server hashes the request IP with `QUOTA_SALT` for best-effort per-IP daily quotas; users on the same network may share that quota, and IP-based limits are not an identity system. The database-wide quota is the hard backstop for generation spend. Saved items, the daily dismiss flag, and a generated draft preview remain in the user's browser unless the item is approved and published to the shared library.

The daily job produces a **pending draft**, not an automatically published fact. This moderation boundary is deliberate: the model can generate an error or fabricated source, and shared content should be reviewed first.


## 6. Ask about any topic (shared answers)

The Ask about this panel is available on Knowledge Wing articles, Deep Stash principles, Quick Maths techniques, solved Rebus puzzles, revealed Mind Trap and Fallacies questions, and Court cases after a verdict. Readers can ask up to two questions about a topic per local day. Suggested prompts count toward the same limit.

Answers are cached in `brain_stash_qa_cache` by discipline, topic and normalized question. If another reader asks the same normalized question about the same topic, Brain Stash reuses the stored answer without another Gemini call. The server also enforces a limit of two uncached answers per IP hash per topic per UTC day and 40 newly generated answers globally per UTC day. Requests that reuse an existing cached answer do not consume the AI generation quota.

**After updating the app:** open the Supabase project connected to Vercel, then SQL Editor, and run `db/ask-cache-migration.sql`. This adds the shared Q&A cache and quota function to an existing installation. Do not run it in a different Supabase project from the one used by Vercel. No extra environment variables are required.

Questions and AI-generated answers are shared. The interface tells readers not to include personal details, and the API rejects obvious email addresses, phone numbers and credential-like strings. The server also builds topic context from bundled or approved content, rather than trusting text submitted by a browser. These are safeguards, not a guarantee that every private detail can be detected.
