# Expert Rebuild Prompt — AI PDF Processor Pipeline

> Usage: give this entire prompt to a coding agent with access to the repository, terminal, GitHub, and deployment/test tools. The goal is a working product, not a proposal or a documentation-only rewrite.

---

## ROLE

Act as a senior product engineer and a coordinated team comprising a staff full-stack engineer, AI/document-processing engineer, application-security engineer, UX designer, QA/SRE engineer, and technical product lead. You are responsible for making the repository **AI PDF Processor Pipeline** a complete, coherent, testable, deployable application.

Repository: https://github.com/HakimDev-tech/ai-pdf-processor-pipeline  
Default branch: `main`  
Working branch: create a new descriptive branch; never commit directly to `main`.

## 1. MANDATORY OPERATING RULES

1. **Audit privately first.** Inspect repository metadata, every tracked file, Git history, dependency and runtime assumptions, secrets hygiene, architecture, and all implemented behavior. Build a private internal assessment of gaps, risks, and reusable assets. Do not publish a separate audit report, expose private chain-of-thought, or dump sensitive findings into the README. Use the assessment to drive implementation.
2. **Verify, do not assume.** Inspect the actual repository before deciding what exists. Treat README claims as claims until supported by code and tests. Check current official documentation and supported versions for frameworks, SDKs, providers, deployment targets, and database APIs. Do not invent APIs, successful tests, deployments, or capabilities.
3. **Rebuild for completeness.** If the repository is only a specification or documentation skeleton, create the actual application and all required source/configuration/schema/test files. Do not merely improve the README, produce mockups, or write another plan. If existing code exists, preserve useful behavior and migrate deliberately; do not delete useful work without a reason.
4. **Work end-to-end.** Continue through implementation, database migrations, tests, lint/type checks, build, documentation, and CI. Do not stop after scaffolding. If blocked by missing credentials or unavailable external services, finish every testable part and provide exact, reproducible setup instructions; never pretend external integration passed.
5. **No fake functionality.** No decorative controls, simulated successful uploads, hard-coded result screens, fake progress, fabricated document data, TODO-driven critical paths, empty handlers, placeholder API responses, or unconnected buttons. Every visible action must work or be explicitly disabled with a clear explanation.
6. **Safe repository workflow.** Use a feature branch and small, coherent commits. Do not force-push, rewrite history, expose secrets, or alter unrelated repositories. Do not merge the PR unless explicitly authorized. Do not change repository visibility or licensing.
7. **Keep the work economical.** Design for a solo developer, low/zero initial budget, and deployment with free-tier-compatible services where possible. Avoid unnecessary microservices, Kubernetes, paid OCR, a vector database, and mandatory paid observability. Prefer a small, well-separated modular monolith and provider adapters.
8. **Report only verified outcomes.** State what was implemented, which checks actually ran, their real results, what remains blocked, and the exact PR/branch. Do not claim “production-ready” without evidence.

## 2. PRODUCT GOAL

Build a polished document-intelligence workspace for users who upload text-based PDFs and need reliable, traceable, structured understanding—not just a generic chatbot that summarizes text.

Core user journey:

1. Sign up/sign in.
2. Upload a PDF with clear constraints and privacy information.
3. Validate the file safely before expensive processing.
4. See a persistent processing job with honest states and recoverable errors.
5. Extract text, preserve page boundaries, and calculate document metadata.
6. Generate structured analysis with an LLM using bounded, cost-aware prompts.
7. Validate the AI response against a strict schema and source-grounding rules.
8. Save the source document, processing state, versioned result, and audit events under the authenticated owner.
9. Inspect a result with page-linked evidence, navigate to source pages, and copy/export it.
10. Search, filter, reopen, reprocess, rename, and delete documents.
11. Recover cleanly from retries, timeouts, duplicate webhook deliveries, provider failures, and partial database/storage failures.

Product principles: evidence over confident invention; explicit uncertainty; transparent processing state; privacy by default; low operating cost; accessible, restrained, professional UI.

## 3. REQUIRED DISCOVERY BEFORE IMPLEMENTATION

Inspect the repository tree, branch, commit history, current README, existing source, configuration, and CI. Check whether any code, workflow export, schema, prompt, screenshot, or deployment exists outside the visible root. Determine the actual runtime constraints and current framework compatibility. Check for accidentally committed credentials without printing their values. Never include secret values in logs, output, commits, screenshots, or documentation.

Create an internal implementation checklist and proceed. Ask the user only if a decision genuinely blocks safe implementation; otherwise choose the simplest reversible option and document it.

## 4. TARGET ARCHITECTURE

Use a **modular monolith** with clear boundaries. Confirm current stable versions and compatibility before selecting exact dependencies.

### Suggested baseline

- Next.js App Router, React, TypeScript strict mode.
- Tailwind CSS and an accessible component system; use a consistent design token layer.
- Supabase Auth, PostgreSQL, and private Supabase Storage.
- Zod (or equivalent maintained schema validator) for runtime validation.
- A maintained PDF text extraction library compatible with the chosen runtime. Keep extraction behind an adapter so it can be replaced.
- Gemini and Groq behind a common provider interface; do not couple domain logic to either SDK.
- n8n as an **optional orchestration/integration adapter**, not a hidden single point of failure. The application must have a clearly documented execution path and secure callback contract. If n8n is unavailable, local development and core tests must still work through a deterministic test adapter; do not silently pretend the test adapter is a real provider.
- Vitest (or a suitable test runner), Testing Library, and Playwright for the highest-value paths.
- GitHub Actions for repeatable CI.

Avoid introducing a separate backend service unless a verified deployment/runtime limitation makes it necessary. PDF parsing and AI calls must respect the hosting platform's execution limits. If a task cannot safely complete in one serverless request, use persisted jobs and a documented asynchronous worker/orchestrator design.

### Required domain modules

Keep modules cohesive, testable, and independent of UI components:

- `auth`: session and ownership helpers.
- `documents`: metadata, upload lifecycle, listing, rename, delete.
- `pdf`: signature/type validation, extraction, page-aware text, extraction metadata.
- `processing`: job state machine, orchestration, retries, idempotency, cancellation where feasible.
- `ai`: provider interface, provider adapters, prompt templates, structured output validation, token/cost metadata when available.
- `analysis`: normalized analysis schema, confidence/limitations, evidence references, versioning.
- `storage`: private object operations and signed URL policy.
- `security`: validation, rate limits, request validation, webhook signature/authentication, safe error mapping.
- `observability`: structured redacted events and correlation IDs.
- `exports`: JSON and Markdown at minimum; CSV only where semantically appropriate.
- `ui`: accessible pages, components, loading/empty/error states.

Use server-only modules for privileged keys. Never expose service-role credentials or AI provider keys through client bundles or `NEXT_PUBLIC_*` variables.

## 5. CORE FEATURES — IMPLEMENT, DO NOT JUST DOCUMENT

### A. Authentication and tenant isolation
- Supabase Auth with a complete sign-in/sign-up/sign-out/session flow and clear validation/error states.
- Enforce ownership server-side on every document, result, job, export, and storage operation.
- Add PostgreSQL Row Level Security (RLS) policies for user-owned records. Test cross-user access denial.
- Do not rely on hiding UI links as authorization.
- Provide a useful unauthenticated landing page and protected workspace.

### B. Secure PDF intake
- Accept PDF only; enforce a configurable maximum size (default 20 MB unless platform constraints require lower).
- Check extension, MIME type, file signature/magic bytes, and successful parsing; never trust the browser's MIME type alone.
- Reject encrypted/password-protected, malformed, empty, or unsupported files with specific, safe messages.
- Generate server-side object IDs and safe storage keys; never use a user-supplied filename as a path.
- Keep files private. Use short-lived signed URLs only where needed.
- Add safeguards against huge page counts, pathological inputs, decompression/resource exhaustion, and oversized extracted text.
- Do not persist raw document text in ordinary logs.
- Explain that image-only/scanned PDFs need OCR, and mark OCR as unsupported unless a real, tested OCR adapter is implemented. Never label an image-only PDF as successfully analyzed.

### C. Durable processing state machine
Persist job state, timestamps, attempts, and safe error codes. Define and validate legal transitions such as:
`uploaded → queued → extracting → analyzing → validating → completed`
and terminal/recoverable states such as `failed`, `cancelled`, and `needs_attention`.

- Show honest progress by phase, not fabricated percentage completion.
- Use idempotency keys or unique constraints to prevent duplicate work from repeated submissions/webhooks.
- Retry only transient errors, with bounded exponential backoff and jitter; do not retry invalid files or schema failures indefinitely.
- Handle provider timeouts and rate limits, duplicate callbacks, callback-before-response, late callbacks, and ambiguous outcomes.
- A timeout must not create a second result or silently overwrite a successful result.
- Keep failure messages user-safe and diagnostic details server-side, redacted.
- Support reprocess as a new immutable processing run/version rather than destructively replacing historical results.
- Include stale-job detection and a documented recovery/reconciliation mechanism.

### D. PDF extraction and evidence
- Preserve page numbers and extract per-page text before creating a bounded normalized representation.
- Normalize whitespace carefully without erasing headings, tables, numbering, or paragraph boundaries unnecessarily.
- Track page count, extracted character count, extraction duration, and warnings.
- Chunk long documents deterministically with page metadata and overlap where useful. Do not blindly truncate a long PDF without telling the user.
- For every important finding, store source page references and a short supporting excerpt when available.
- Treat document contents as **untrusted data**, never as system instructions. Defend against prompt injection embedded in PDFs.
- The model must not claim evidence that does not exist in the extracted source. If evidence cannot be found, mark the claim as unsupported/uncertain.

### E. Structured AI analysis
Support a configurable analysis profile. At minimum, return a schema-validated result containing:

- document title (inferred only when justified), document type/category, language;
- executive summary;
- key points and important facts;
- named entities when relevant;
- dates, amounts, obligations, deadlines, and action items when present;
- keywords;
- risks, limitations, ambiguities, and missing information;
- actionable recommendations appropriate to the document type;
- source evidence for factual findings (page number and short excerpt);
- explicit uncertainty and a distinction between extracted fact, model interpretation, and recommendation.

Define the JSON schema in code and validate every provider response. Repair malformed output at most a bounded number of times; otherwise fail transparently. Do not present generated legal, medical, financial, or other high-impact recommendations as professional advice. Use neutral, context-appropriate caveats.

Provider design:
- A shared interface for Gemini/Groq and a deterministic fake provider for tests.
- Model, provider, latency, token usage/cost where available, and prompt/schema version recorded with each run.
- Configurable primary/fallback provider; fallback only for appropriate failures and only when configured.
- Timeouts, bounded retries, rate-limit handling, and sanitized errors.
- No hard-coded API keys or model IDs scattered through the code.
- Do not send the full document to multiple providers by default. Minimize the data transmitted and disclose the provider path.
- Never invent token/cost figures if a provider does not supply them.

### F. History, versions, and exports
- Document list with search, sort, pagination or bounded loading, category/status filters, and empty states.
- Detail view with source metadata, job timeline, latest result, and previous runs.
- Reprocessing creates a versioned run; users can compare versions at least by timestamps and summary/result fields.
- Rename and delete operations with confirmation and safe handling of related objects/results.
- Export result as JSON and readable Markdown. Exports must use the saved validated result, not regenerate it.
- Deletion must follow a defined policy across DB rows, storage objects, logs, and related runs. Avoid orphaned files; if cross-system atomic deletion is impossible, record and retry cleanup.
- Do not build semantic search/RAG/vector storage into the first release unless core reliability is complete and a demonstrated requirement justifies it.

### G. UX and visual direction
Build a coherent product interface, not an AI-generated template. Use a distinctive, restrained **document workbench** visual language: editorial typography, clear hierarchy, quiet neutral surfaces, disciplined accent color, precise spacing, useful data density, and purposeful motion. Avoid gratuitous gradients, neon glows, generic AI illustrations, oversized empty hero sections, and excessive rounded cards.

Required screens:
1. Landing page explaining the workflow, limits, privacy posture, and actual capabilities.
2. Authentication screens.
3. Workspace/dashboard with recent documents and processing status.
4. Upload/dropzone with progress, validation feedback, and limits.
5. Document detail with page-aware extraction/evidence and analysis sections.
6. Processing/run history and version comparison.
7. Settings for provider-independent preferences and data deletion where appropriate.
8. Useful not-found and error states.

UX requirements:
- Responsive from mobile to desktop.
- Semantic HTML, keyboard navigation, visible focus, accessible labels, contrast, and screen-reader status updates.
- Complete loading, empty, success, validation, and failure states.
- Avoid fake metrics and fake activity.
- Keep core flows understandable without a tutorial.
- No phone-call, voice, or face-camera requirement.

### H. Admin and observability
No broad admin dashboard is required for the MVP. Provide structured, redacted server logs with request/job correlation IDs, phase, duration, provider, and safe error codes. Never log access tokens, signed URLs, raw PDFs, full extracted text, or secret values. Include a health endpoint that reports application availability without leaking infrastructure secrets.

## 6. DATA MODEL AND DATABASE SAFETY

Design migrations for at least:

- `profiles` (only fields actually needed);
- `documents` (owner, safe storage key, display name, content metadata, status, timestamps);
- `processing_runs` (document, owner or validated ownership relationship, idempotency key, state, attempt, provider/model, version, timings, safe failure code);
- `analysis_results` (validated structured result, schema/prompt version, references to run, creation time);
- `processing_events` (bounded, redacted timeline events).

Add foreign keys, indexes, unique constraints, timestamps, and appropriate delete behavior. Avoid storing the same large extracted text/result redundantly without justification. Decide whether extracted text belongs in a private storage object or protected database column based on the actual query/use needs, and document retention. Apply RLS to every user-facing table and test it.

If using n8n:
- Export a real, importable workflow file and document node setup, credentials, webhook methods, authentication/signature checks, and environment variables.
- Use a versioned request/response contract with a correlation/job ID.
- Authenticate callbacks with a high-entropy secret or HMAC signature, validate timestamps/replay where appropriate, and reject unauthorized callbacks.
- Make callbacks idempotent and verify that the job/document belongs to the expected user before storing results.
- Do not put provider credentials or Supabase service-role keys in exported workflow JSON.
- Do not make n8n the only source of truth: PostgreSQL job state is authoritative.
- If n8n workflow cannot be tested against a real instance, clearly distinguish structural validation from a live integration test.

## 7. SECURITY AND PRIVACY CHECKLIST

Implement and test, not just mention:
- strict server-side input validation;
- per-user authorization on every object operation;
- RLS policies and cross-user denial tests;
- private storage and short-lived signed URLs;
- CSRF/origin protections where relevant to the chosen auth/API pattern;
- upload size and request body limits;
- rate limiting or a documented, practical deployment-compatible limiter;
- secure headers and safe error messages;
- SSRF avoidance: do not accept arbitrary remote URLs for PDF fetching;
- prompt-injection resistance and clear untrusted-source boundaries;
- secret hygiene and an accurate `.env.example`;
- no sensitive data in logs;
- dependency and lockfile hygiene;
- documented data deletion and retention behavior.

Do not claim compliance with GDPR, SOC 2, HIPAA, or any certification. Describe implemented privacy controls factually.

## 8. TEST STRATEGY — GATES BEFORE COMPLETION

Create meaningful tests for:
- PDF signature, size, malformed, encrypted, empty, and image-only inputs;
- extraction page mapping and long-document chunk boundaries;
- valid, malformed, incomplete, and unsupported AI JSON;
- unsupported claims/evidence references;
- provider timeout, rate limit, fallback, and permanent errors;
- state-machine legal/illegal transitions;
- duplicate submissions and webhook callbacks;
- retry and recovery logic;
- document ownership, RLS, unauthorized access, and deletion cleanup;
- API input/output validation;
- upload → processing → results critical path;
- responsive/accessibility checks for key screens where practical.

Use fake providers and fixture PDFs for deterministic CI; never require real API keys for the default test suite. Add a small set of integration tests that run only when explicit test credentials are configured. Do not put real personal or sensitive documents in fixtures.

Run and report actual results for:
1. install from lockfile;
2. lint;
3. TypeScript/type check;
4. unit tests;
5. integration tests available in the environment;
6. production build;
7. end-to-end smoke tests available in the environment;
8. migration/schema and RLS validation where possible.

Fix failures introduced by the work. Do not hide failing tests, loosen checks merely to get green, or claim a command ran when it did not.

## 9. DOCUMENTATION AND DEVELOPER EXPERIENCE

Deliver:
- a truthful README with product scope, architecture diagram, real capabilities and limitations;
- exact prerequisites and local setup;
- Supabase setup and migration instructions;
- accurate `.env.example` with descriptions and no real values;
- how to configure at least one AI provider and optionally the second;
- how to configure n8n if enabled, including a sanitized workflow export;
- how to run lint, typecheck, tests, and build;
- deployment instructions and known hosting/runtime limits;
- troubleshooting for common upload, auth, provider, callback, and database failures;
- privacy/data retention/deletion explanation;
- architecture decision notes for non-obvious tradeoffs;
- screenshots only if captured from the real running application; never fabricate them.

Remove outdated scaffolding, dead code, unused dependencies, duplicate abstractions, and misleading claims. Keep the root tree discoverable. Do not include large generated artifacts or local secrets.

## 10. IMPLEMENTATION ORDER

Work in this order, but continue through all feasible phases in the same task:

**Phase 1 — Private audit and design**
- Inspect all repository contents and history.
- Identify actual gaps and constraints privately.
- Decide the smallest robust architecture and record key decisions.

**Phase 2 — Foundation**
- Establish app structure, strict TypeScript, lint/test/build scripts, environment validation, design tokens, and CI.
- Add database migrations, RLS, and private storage policy.

**Phase 3 — Core document lifecycle**
- Implement auth, upload, validation, secure storage, document list/detail, ownership checks, and deletion.

**Phase 4 — Processing engine**
- Implement extraction, page-aware representation, persistent state machine, idempotency, retries, events, and recovery.

**Phase 5 — AI intelligence**
- Implement provider interface/adapters, prompts, schema validation, evidence mapping, failure behavior, and run versioning.

**Phase 6 — Full UI**
- Complete all required screens and states; wire every control to real behavior.

**Phase 7 — Integration and hardening**
- Add n8n workflow only as a real, documented optional integration; secure callbacks; verify privacy, limits, failure recovery, and deletion cleanup.

**Phase 8 — Verification and delivery**
- Run all feasible gates; fix defects; update docs; inspect the final diff; create a pull request against `main`.
- Do not merge the PR unless explicitly asked.

## 11. ACCEPTANCE CRITERIA

The task is not complete unless all applicable criteria are satisfied:

- The repository contains a real application, not just a README/specification.
- A developer can install it using documented steps and run the app locally with configured services.
- An authenticated user can upload a valid PDF, see persisted processing state, obtain a validated structured analysis, open it later, and export it.
- Invalid, empty, encrypted, image-only, oversized, and malformed PDFs fail clearly and safely.
- AI output is schema-validated, versioned, and includes evidence references where applicable; unsupported claims are not presented as verified facts.
- Repeated submissions/callbacks do not create duplicate results.
- Cross-user document access is denied by server checks and database policies.
- Provider and database failures produce recoverable, truthful states.
- Reprocessing preserves prior run history.
- Tests cover core behavior and critical failure paths without requiring paid API keys.
- Lint, type check, tests, and production build pass, or any environmental blocker is reported precisely.
- Secrets are absent from tracked files and logs; environment documentation is accurate.
- The interface is responsive, accessible, visually coherent, and free of inert controls.
- README and deployment instructions match the implementation.
- A feature branch and PR are created; no unrequested merge occurs.

## 12. FINAL RESPONSE FORMAT

When the implementation task is finished, respond concisely in French with:

1. **Livré** — actual application features implemented.
2. **Architecture** — brief explanation of the real final design and important tradeoffs.
3. **Vérifications** — each command/test and its actual pass/fail/not-run status.
4. **Configuration requise** — only credentials or external setup genuinely required.
5. **Limites restantes** — exact, non-speculative blockers.
6. **GitHub** — branch name, PR link, and confirmation that `main` was not modified or merged.

Never publish the internal audit or private reasoning. Summarize only implementation decisions and verified outcomes.