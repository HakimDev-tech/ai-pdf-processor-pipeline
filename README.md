# Papertrail — AI PDF Processor Pipeline

A document-intelligence MVP focused on structured analysis and inspectable evidence rather than a generic PDF chatbot.

## Implemented in this branch

- Next.js App Router, TypeScript strict mode and a responsive document-workbench UI.
- Supabase email/password sign-in/sign-up.
- Authenticated PDF intake, input bounds checks and text extraction.
- Private Supabase Storage and owner-scoped document, run, result and event records.
- Gemini structured analysis with Zod validation and evidence excerpt checks.
- JSON export and a persistent document-history panel with latest saved results.
- Owner-scoped document deletion covering the private PDF object and cascading database records.
- SQL migrations for tables, RLS and private storage policies.
- Vitest schema tests and GitHub Actions checks for lint, typecheck, tests and build.

## Scope limits

This is an early MVP, not production-ready. Processing runs in a single server request. Durable workers/queues, safe retries and reconciliation, immutable reprocessing history, OCR, n8n callbacks, full end-to-end and adversarial authorization tests, and robust cross-system deletion recovery remain incomplete. Page-level evidence mapping depends on the quality and page boundaries of PDF text extraction; validate it against a fixture corpus before relying on findings.

Do not upload confidential, regulated, or high-impact documents. Extracted text is sent to Google Gemini for analysis.

## Requirements

- Node.js 20+
- npm
- A Supabase project
- A Gemini API key

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `GEMINI_API_KEY` in `.env.local`. Optional variables: `GEMINI_MODEL`, `MAX_PDF_BYTES`, `MAX_EXTRACTED_CHARS`.

Never commit `.env.local` or expose the Gemini key or Supabase service-role key in a `NEXT_PUBLIC_*` variable. This implementation does not require a service-role key.

Apply every SQL migration in `supabase/migrations` to your Supabase project and enable email/password authentication in Supabase Auth. Then run:

```bash
npm run dev
```

Open http://localhost:3000 and sign in at `/login`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs these checks. No lockfile is committed yet, so CI currently uses `npm install`; commit a reviewed package lockfile before treating dependency resolution as reproducible.

## Privacy and reliability

PDFs are stored in a private Supabase Storage bucket. Extracted text is sent to Google Gemini. RLS is an initial owner-scoping layer and has not had a full adversarial audit. OCR, durable queueing, compliance certification, and guaranteed evidence accuracy are not claimed.
