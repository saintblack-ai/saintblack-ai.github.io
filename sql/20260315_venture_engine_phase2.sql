create extension if not exists pgcrypto;

create table if not exists public.venture_metrics (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.venture_offers(id) on delete cascade,
  views integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  revenue_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_venture_metrics_offer_id
  on public.venture_metrics(offer_id);

create index if not exists idx_venture_metrics_created_at_desc
  on public.venture_metrics(created_at desc);

alter table public.venture_metrics enable row level security;

drop policy if exists venture_metrics_service_role_all on public.venture_metrics;
create policy venture_metrics_service_role_all
on public.venture_metrics
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists venture_metrics_anon_read_public on public.venture_metrics;
create policy venture_metrics_anon_read_public
on public.venture_metrics
for select
using (
  exists (
    select 1
    from public.venture_offers
    where public.venture_offers.id = offer_id
      and public.venture_offers.status in ('approved', 'launched')
  )
);
