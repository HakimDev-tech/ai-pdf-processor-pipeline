# Papertrail — AI PDF Processor Pipeline

A document-intelligence MVP focused on structured analysis and inspectable evidence rather than a generic PDF chatbot.

## Current implementation

- Next.js App Router, TypeScript strict mode, restrained document-workbench UI.
- PDF upload validation (extension, browser MIME when provided, PDF signature, size, page count and extracted text bounds).
- Server-side PDF text extraction and explicit rejection of empty/image-only documents.
- Gemini analysis adapter with bounded request timeout, JSON schema validation, safe client-facing errors, and evidence excerpt verification against extracted page text.
- JSON export of the validated analysis.
- Supabase schema migration for owner-scoped documents, processing runs, versioned results, redacted events, RLS and a private PDF bucket.
- Vitest schema tests and typecheck/lint/build scripts.

## Important scope limits

This is an early vertical slice, **not a production-ready complete application**. The current UI analysis endpoint does not yet persist uploads/results, authenticate users, use the database migration, implement durable background jobs/retries, support OCR, provide document history, or test live Supabase/n8n integrations. Do not upload confidential documents. Evidence page mapping depends on the PDF parser's text output and should be tested against a fixture corpus before relying on it.

## Requirements

- Node.js 20 or newer
- npm
- A Gemini API key for live analysis
- Supabase project only when implementing the persistence/authentication phase

## Local setup

```bash
npm ci
cp .env.example .env.local
```

Set `GEMINI_API_KEY` in `.env.local`. Set `GEMINI_MODEL` if using a different supported Gemini model. Start the app:

```bash
npm run dev
```

Open http://localhost:3000. Never commit `.env.local` or expose the Gemini key in a `NEXT_PUBLIC_*` variable.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

These commands are provided for reproducibility; their status must be verified in CI or a local environment before release.

## Supabase migration

Apply `supabase/migrations/202610220001_initial_schema.sql` using Supabase CLI or the SQL editor. The schema is preparatory and is not yet wired to the current upload route. Review policies against your project's existing policies before applying to a non-empty project.

## Privacy and limitations

The selected PDF is transmitted to the application server and extracted text is sent to Google Gemini for analysis. The current endpoint does not persist the source file, but request handling and third-party processing still occur. Do not use confidential or regulated data. Image-only/scanned PDFs, OCR, durable job orchestration, n8n callbacks, retry/reconciliation and persistent history are not implemented in this slice. No compliance certification is claimed.