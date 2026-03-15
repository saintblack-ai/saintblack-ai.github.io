create extension if not exists pgcrypto;

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  task_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  priority int not null default 5,
  attempts int not null default 0,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  context jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_tasks_status_scheduled
  on public.agent_tasks(status, scheduled_at asc, priority asc);

create index if not exists idx_agent_tasks_agent_name
  on public.agent_tasks(agent_name, created_at desc);

create index if not exists idx_agent_memory_agent_name
  on public.agent_memory(agent_name, created_at desc);

alter table public.agent_tasks enable row level security;
alter table public.agent_memory enable row level security;

drop policy if exists agent_tasks_service_role_all on public.agent_tasks;
create policy agent_tasks_service_role_all
on public.agent_tasks
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists agent_memory_service_role_all on public.agent_memory;
create policy agent_memory_service_role_all
on public.agent_memory
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
