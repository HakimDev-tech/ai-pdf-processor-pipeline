-- Papertrail initial schema. Apply in Supabase SQL editor or with Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 240),
  storage_key text not null unique,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  byte_size bigint not null check (byte_size > 0),
  page_count integer,
  extracted_characters integer,
  status text not null default 'uploaded' check (status in ('uploaded','processing','completed','failed','needs_attention')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_number integer not null check (run_number > 0),
  state text not null check (state in ('queued','extracting','analyzing','validating','completed','failed','cancelled','needs_attention')),
  idempotency_key text not null,
  provider text,
  model text,
  failure_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, run_number),
  unique (owner_id, idempotency_key)
);

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.processing_runs(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  schema_version text not null default '1',
  prompt_version text not null default '1',
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.processing_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.processing_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  safe_code text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_owner_created_idx on public.documents(owner_id, created_at desc);
create index if not exists documents_owner_status_idx on public.documents(owner_id, status);
create index if not exists runs_document_created_idx on public.processing_runs(document_id, created_at desc);
create index if not exists events_run_created_idx on public.processing_events(run_id, created_at);

alter table public.documents enable row level security;
alter table public.processing_runs enable row level security;
alter table public.analysis_results enable row level security;
alter table public.processing_events enable row level security;

create policy "owners manage own documents" on public.documents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners read own processing runs" on public.processing_runs
  for select using (auth.uid() = owner_id);
create policy "owners read own analysis results" on public.analysis_results
  for select using (auth.uid() = owner_id);
create policy "owners read own processing events" on public.processing_events
  for select using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-pdfs', 'private-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

create policy "owners read own PDF objects" on storage.objects
  for select to authenticated using (bucket_id = 'private-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners upload own PDF objects" on storage.objects
  for insert to authenticated with check (bucket_id = 'private-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete own PDF objects" on storage.objects
  for delete to authenticated using (bucket_id = 'private-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);