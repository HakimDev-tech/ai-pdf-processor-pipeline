-- Durable processing queue: leases, bounded retries, and atomic worker claims.
alter table public.processing_runs
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists lease_expires_at timestamptz,
  add column if not exists worker_id text,
  add column if not exists last_error_code text;

create index if not exists processing_runs_queue_idx
  on public.processing_runs(state, available_at, created_at)
  where state in ('queued','extracting','analyzing','validating');

create or replace function public.claim_next_processing_run(p_worker_id text)
returns table (
  run_id uuid,
  document_id uuid,
  owner_id uuid,
  storage_key text,
  display_name text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 8 or length(p_worker_id) > 120 then
    raise exception 'invalid worker id';
  end if;

  return query
  with candidate as (
    select r.id
    from public.processing_runs r
    where (
      (r.state = 'queued' and r.available_at <= now())
      or
      (r.state in ('extracting','analyzing','validating') and r.lease_expires_at < now())
    )
    and r.attempt_count < r.max_attempts
    order by r.available_at asc, r.created_at asc
    for update skip locked
    limit 1
  ),
  claimed as (
    update public.processing_runs r
    set state = 'extracting',
        attempt_count = r.attempt_count + 1,
        worker_id = p_worker_id,
        lease_expires_at = now() + interval '2 minutes',
        started_at = coalesce(r.started_at, now()),
        failure_code = null,
        last_error_code = null
    from candidate c
    where r.id = c.id
    returning r.id, r.document_id, r.owner_id, r.attempt_count
  )
  select c.id, c.document_id, c.owner_id, d.storage_key, d.display_name, c.attempt_count
  from claimed c
  join public.documents d on d.id = c.document_id and d.owner_id = c.owner_id;
end;
$$;

revoke all on function public.claim_next_processing_run(text) from public, anon, authenticated;
grant execute on function public.claim_next_processing_run(text) to service_role;

-- Reclaim exhausted jobs after their lease expires so they do not remain stuck forever.
create or replace function public.fail_exhausted_processing_runs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare affected integer;
begin
  update public.processing_runs
  set state = 'failed',
      failure_code = 'RETRY_LIMIT_EXCEEDED',
      last_error_code = coalesce(last_error_code, 'RETRY_LIMIT_EXCEEDED'),
      finished_at = now(),
      lease_expires_at = null,
      worker_id = null
  where state in ('queued','extracting','analyzing','validating')
    and attempt_count >= max_attempts
    and (state = 'queued' and available_at <= now()
         or state <> 'queued' and lease_expires_at < now());
  get diagnostics affected = row_count;

  update public.documents d
  set status = 'failed', updated_at = now()
  where d.status = 'processing'
    and exists (select 1 from public.processing_runs r
                where r.document_id = d.id and r.state = 'failed'
                  and r.failure_code = 'RETRY_LIMIT_EXCEEDED');

  return affected;
end;
$$;

revoke all on function public.fail_exhausted_processing_runs() from public, anon, authenticated;
grant execute on function public.fail_exhausted_processing_runs() to service_role;


-- Prevent a retry or accidental application write from mutating an already saved result.
create or replace function public.prevent_analysis_result_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'analysis_results rows are immutable';
end;
$$;

drop trigger if exists analysis_results_immutable_update on public.analysis_results;
create trigger analysis_results_immutable_update
before update on public.analysis_results
for each row execute function public.prevent_analysis_result_update();
