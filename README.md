# Papertrail — AI PDF Processor Pipeline

A document-intelligence MVP focused on structured analysis and inspectable evidence rather than a generic PDF chatbot.

## Implemented in this branch

- Next.js App Router, TypeScript strict mode and a responsive document-workbench UI.
- Supabase email/password sign-in and sign-up screen.
- Authenticated PDF intake with extension, MIME type (when provided), signature, size, page-count, parse-failure and extracted-text bounds checks.
- Private Supabase Storage upload and owner-scoped document, processing-run, result and event records.
- Gemini analysis adapter with bounded request timeout, JSON schema validation, safe client-facing errors, and evidence excerpt checks against extracted text.
- JSON export of the validated analysis.
- Supabase SQL migrations for owner-scoped tables, RLS policies and a private PDF bucket.
- Vitest schema tests and GitHub Actions checks for lint, typecheck, tests and production build.

## Important scope limits

This is an early MVP slice, **not a production-ready complete application**. The current request performs analysis in a single server request; durable background jobs, bounded retry/reconciliation, immutable reprocessing history, document search/list/detail/history UI, n8n callbacks, OCR, full end-to-end/access-control tests and reliable cross-system cleanup remain incomplete. Page-level evidence mapping is only as reliable as the extracted text's page separators; validate against a fixture corpus before relying on it.

Do not upload confidential, regulated, or high-impact documents. The application sends extracted document text to Google Gemini for analysis.

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project
- A Gemini API key

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set these variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- Optional: `GEMINI_MODEL`, `MAX_PDF_BYTES`, `MAX_EXTRACTED_CHARS`

Never commit `.env.local` or expose the Gemini key or Supabase service-role key in a `NEXT_PUBLIC_*` variable. The service-role key is not required by this implementation.

Apply the SQL migrations in `supabase/migrations` to your Supabase project, then enable email/password authentication in Supabase Auth. Start the application:

```bash
npm run dev
```

Open http://localhost:3000. Sign in or create an account at `/login` before uploading.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions is configured to run these checks. Confirm the workflow result before treating the branch as verified. This repository currently has no committed lockfile; `npm install` will resolve and create one locally. Commit the resulting lockfile before relying on reproducible CI installs.

## Processing and privacy

PDFs are uploaded to a private Supabase Storage bucket. The extracted text is sent to Google Gemini. Owner-based RLS policies are included in the migrations. These controls are an initial implementation and have not yet received a full adversarial authorization audit. No OCR, durable queue, n8n integration, compliance certification, or guarantee of evidence accuracy is claimed.
