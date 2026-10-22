-- Write policies required by the authenticated upload/analysis route.
create policy "owners update own documents" on public.documents
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owners create processing runs" on public.processing_runs
  for insert with check (auth.uid() = owner_id);
create policy "owners update processing runs" on public.processing_runs
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owners create analysis results" on public.analysis_results
  for insert with check (auth.uid() = owner_id);
create policy "owners create processing events" on public.processing_events
  for insert with check (auth.uid() = owner_id);