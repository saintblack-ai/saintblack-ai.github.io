create extension if not exists pgcrypto;

create table if not exists public.venture_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  promise text not null,
  audience text not null,
  price_cents integer not null,
  billing_type text not null,
  trial_enabled boolean not null default false,
  cta text not null,
  status text not null default 'draft',
  source_agent text,
  approval_id uuid,
  stripe_product_id text,
  stripe_price_id text,
  metadata jsonb not null default '{}'::jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_launch_assets (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.venture_offers(id) on delete cascade,
  asset_type text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_venture_offers_status
  on public.venture_offers(status);

create index if not exists idx_venture_offers_created_at_desc
  on public.venture_offers(created_at desc);

create index if not exists idx_venture_launch_assets_offer_id
  on public.venture_launch_assets(offer_id);

alter table public.venture_offers enable row level security;
alter table public.venture_launch_assets enable row level security;

drop policy if exists venture_offers_service_role_all on public.venture_offers;
create policy venture_offers_service_role_all
on public.venture_offers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists venture_offers_anon_read_public on public.venture_offers;
create policy venture_offers_anon_read_public
on public.venture_offers
for select
using (status in ('approved', 'launched'));

drop policy if exists venture_launch_assets_service_role_all on public.venture_launch_assets;
create policy venture_launch_assets_service_role_all
on public.venture_launch_assets
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists venture_launch_assets_anon_read_public on public.venture_launch_assets;
create policy venture_launch_assets_anon_read_public
on public.venture_launch_assets
for select
using (
  exists (
    select 1
    from public.venture_offers
    where public.venture_offers.id = offer_id
      and public.venture_offers.status in ('approved', 'launched')
  )
);
