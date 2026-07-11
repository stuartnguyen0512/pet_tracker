-- v2 cloud sync data layer: pets, health_records, entitlements
-- Mirrors the local SQLite schema (types.ts / db/database.ts) plus sync columns
-- (updated_at / deleted_at) per CLAUDE.md "Planned: cloud sync (v2)".

create table public.pets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  species     text not null,
  photo_url   text,
  birthdate   text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index pets_owner_id_idx on public.pets(owner_id);

create table public.health_records (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('Vaccine', 'Vet Visit', 'Medication', 'Weight', 'Note')),
  date        text not null,
  details     text not null,
  photo_url   text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index health_records_owner_id_idx on public.health_records(owner_id);
create index health_records_pet_id_idx on public.health_records(pet_id);

-- Trusted client flag, not a verified purchase/subscription entitlement
-- (see CLAUDE.md "Monetization constraint").
create table public.entitlements (
  owner_id     uuid primary key references auth.users(id) on delete cascade,
  unlocked     boolean not null default false,
  unlocked_at  timestamptz
);

alter table public.pets enable row level security;
alter table public.health_records enable row level security;
alter table public.entitlements enable row level security;

-- Personal-only accounts, no sharing: one owner-scoped policy per table.
create policy "pets_owner_access" on public.pets
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "health_records_owner_access" on public.health_records
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "entitlements_owner_access" on public.entitlements
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
