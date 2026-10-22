# Papertrail — AI PDF Processor Pipeline

A document-intelligence MVP focused on structured analysis and inspectable evidence rather than a generic PDF chatbot.

## Current capabilities

- Next.js App Router, TypeScript strict mode and a responsive document-workbench UI.
- Supabase email/password authentication and owner-scoped document history.
- Bounded PDF upload checks and private Supabase Storage.
- Durable database-backed processing queue with atomic worker claims, expiring leases, bounded retries, backoff and exhausted-job reconciliation.
- Gemini structured analysis with Zod validation and page-level evidence excerpt checks.
- Persisted results, processing events, idempotent request replay, JSON export and owner-scoped document deletion.
- GitHub Actions checks for lint, typecheck, tests and production build.

## Worker scheduling is required

The upload API stores a job and returns without running the AI analysis inline. A scheduler must invoke `GET /api/worker` to drain the queue. The worker checks the `CRON_SECRET` bearer token.

1. Apply every SQL migration in `supabase/migrations`, including `202610220003_durable_processing_queue.sql`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` and a strong random `CRON_SECRET` in the server deployment environment. Never expose either using a `NEXT_PUBLIC_*` variable.
3. The included `vercel.json` configures a five-minute Vercel Cron. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when that environment variable is configured. Confirm that the deployment plan supports the selected cron frequency; otherwise configure an external scheduler to call `/api/worker` with that header.
4. Ensure the deployment platform permits the worker function to run for up to 60 seconds. If scheduled invocations are delayed or disabled, jobs remain persisted and resume when the scheduler runs again.

The scheduler claims one job per invocation. Overlapping invocations are safe because PostgreSQL claims work atomically with `FOR UPDATE SKIP LOCKED`. Temporary provider/persistence failures receive bounded retries; expired leases and exhausted jobs are reconciled rather than remaining stuck forever.

## Requirements and local setup

- Node.js 20+
- npm
- Supabase project with email/password auth enabled
- Gemini API key

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and `CRON_SECRET` in the relevant server environment. The service-role key and cron secret must remain server-side.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

No live Supabase/Gemini integration test is claimed. CI success does not validate external credentials, queue scheduling, real PDFs or evidence quality. Commit a reviewed lockfile before treating dependency resolution as reproducible.

## Scope and safety

This is still an early MVP, not production-ready. Immutable reprocessing/version history, OCR, n8n callbacks, full end-to-end and adversarial authorization tests, monitoring/alerting, and robust cross-system deletion recovery remain incomplete. Page-level evidence depends on PDF extraction boundaries and must be tested against a representative fixture corpus. Do not upload confidential, regulated, or high-impact documents. Extracted text is sent to Google Gemini.
