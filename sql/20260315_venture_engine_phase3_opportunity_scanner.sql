create extension if not exists pgcrypto;

alter table public.venture_offers
  add column if not exists problem text,
  add column if not exists solution text,
  add column if not exists confidence_score numeric;

create table if not exists public.trend_signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  topic text not null,
  momentum_score integer not null default 0,
  audience_size integer not null default 0,
  problem_detected text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.venture_experiments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.venture_offers(id) on delete cascade,
  traffic_source text not null,
  launch_channel text not null,
  pricing_model text not null,
  test_duration integer not null,
  success_metric text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trend_signals_created_at_desc
  on public.trend_signals(created_at desc);

create index if not exists idx_trend_signals_momentum_score_desc
  on public.trend_signals(momentum_score desc);

create index if not exists idx_venture_experiments_offer_id
  on public.venture_experiments(offer_id);

alter table public.trend_signals enable row level security;
alter table public.venture_experiments enable row level security;

drop policy if exists trend_signals_service_role_all on public.trend_signals;
create policy trend_signals_service_role_all
on public.trend_signals
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists trend_signals_anon_read_public on public.trend_signals;
create policy trend_signals_anon_read_public
on public.trend_signals
for select
using (true);

drop policy if exists venture_experiments_service_role_all on public.venture_experiments;
create policy venture_experiments_service_role_all
on public.venture_experiments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists venture_experiments_anon_read_public on public.venture_experiments;
create policy venture_experiments_anon_read_public
on public.venture_experiments
for select
using (
  exists (
    select 1
    from public.venture_offers
    where public.venture_offers.id = offer_id
      and public.venture_offers.status in ('approved', 'launched', 'pending_approval')
  )
);
