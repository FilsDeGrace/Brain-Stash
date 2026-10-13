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
