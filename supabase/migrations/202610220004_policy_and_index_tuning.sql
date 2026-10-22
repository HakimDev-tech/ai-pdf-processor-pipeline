-- Remove overlapping RLS policies and keep auth.uid() evaluation initplan-friendly.
drop policy if exists "owners update own documents" on public.documents;
drop policy if exists "owners manage own documents" on public.documents;
create policy "owners manage own documents" on public.documents
  for all using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners read own processing runs" on public.processing_runs;
create policy "owners read own processing runs" on public.processing_runs
  for select using ((select auth.uid()) = owner_id);

drop policy if exists "owners update processing runs" on public.processing_runs;
create policy "owners update processing runs" on public.processing_runs
  for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners create processing runs" on public.processing_runs;
create policy "owners create processing runs" on public.processing_runs
  for insert with check ((select auth.uid()) = owner_id);

drop policy if exists "owners read own analysis results" on public.analysis_results;
create policy "owners read own analysis results" on public.analysis_results
  for select using ((select auth.uid()) = owner_id);

drop policy if exists "owners create analysis results" on public.analysis_results;
create policy "owners create analysis results" on public.analysis_results
  for insert with check ((select auth.uid()) = owner_id);

drop policy if exists "owners read own processing events" on public.processing_events;
create policy "owners read own processing events" on public.processing_events
  for select using ((select auth.uid()) = owner_id);

drop policy if exists "owners create processing events" on public.processing_events;
create policy "owners create processing events" on public.processing_events
  for insert with check ((select auth.uid()) = owner_id);

create index if not exists analysis_results_document_id_idx
  on public.analysis_results(document_id);
create index if not exists analysis_results_owner_id_idx
  on public.analysis_results(owner_id);
create index if not exists processing_events_owner_id_idx
  on public.processing_events(owner_id);
