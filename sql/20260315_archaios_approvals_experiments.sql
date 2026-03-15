create extension if not exists pgcrypto;

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.agent_logs
  add column if not exists category text,
  add column if not exists status text,
  add column if not exists trigger text,
  add column if not exists output jsonb,
  add column if not exists result jsonb;

create index if not exists idx_agent_logs_created_at_desc
  on public.agent_logs(created_at desc);

create index if not exists idx_agent_logs_agent_name
  on public.agent_logs(agent_name);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  risk_score numeric not null default 0.0,
  reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz
);

create index if not exists idx_agent_approvals_created_at_desc
  on public.agent_approvals(created_at desc);

create index if not exists idx_agent_approvals_status
  on public.agent_approvals(status, created_at desc);

alter table public.agent_logs enable row level security;
alter table public.agent_approvals enable row level security;

drop policy if exists agent_logs_service_role_all on public.agent_logs;
create policy agent_logs_service_role_all
on public.agent_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists agent_logs_anon_read on public.agent_logs;
create policy agent_logs_anon_read
on public.agent_logs
for select
using (true);

drop policy if exists agent_approvals_service_role_all on public.agent_approvals;
create policy agent_approvals_service_role_all
on public.agent_approvals
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists agent_approvals_anon_read on public.agent_approvals;
create policy agent_approvals_anon_read
on public.agent_approvals
for select
using (true);
