create extension if not exists pgcrypto;

alter table if exists public.agent_tasks
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists backoff_until timestamptz;

create index if not exists idx_agent_tasks_status
  on public.agent_tasks(status);

create index if not exists idx_agent_tasks_priority
  on public.agent_tasks(priority);

create index if not exists idx_agent_tasks_backoff_until
  on public.agent_tasks(backoff_until);

create index if not exists idx_agent_tasks_claimed_at
  on public.agent_tasks(claimed_at);

create table if not exists public.worker_heartbeat (
  worker_id text primary key,
  last_seen timestamptz not null default now(),
  stats jsonb not null default '{}'::jsonb
);

alter table public.worker_heartbeat enable row level security;

drop policy if exists worker_heartbeat_service_role_all on public.worker_heartbeat;
create policy worker_heartbeat_service_role_all
on public.worker_heartbeat
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists worker_heartbeat_anon_read on public.worker_heartbeat;
create policy worker_heartbeat_anon_read
on public.worker_heartbeat
for select
using (true);
