-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.collection_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.collection_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv', 'game')),
  external_id text not null,
  source text not null,
  title text not null,
  poster_url text null,
  rating double precision null,
  user_rating double precision null,
  status text not null check (status in ('wishlist', 'in_progress', 'completed')),
  list_id uuid null references public.collection_lists(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, external_id)
);

alter table public.collection_entries add column if not exists user_rating double precision null;
alter table public.collection_entries add column if not exists list_id uuid null references public.collection_lists(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'collection_entries_user_rating_range'
  ) then
    alter table public.collection_entries
      add constraint collection_entries_user_rating_range
      check (user_rating is null or (user_rating >= 0 and user_rating <= 10));
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_collection_entries_updated_at on public.collection_entries;
create trigger trg_collection_entries_updated_at
before update on public.collection_entries
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_collection_lists_updated_at on public.collection_lists;
create trigger trg_collection_lists_updated_at
before update on public.collection_lists
for each row execute procedure public.set_updated_at();

alter table public.collection_entries enable row level security;
alter table public.collection_lists enable row level security;

drop policy if exists "Users can read own collection entries" on public.collection_entries;
create policy "Users can read own collection entries"
on public.collection_entries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own collection entries" on public.collection_entries;
create policy "Users can insert own collection entries"
on public.collection_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own collection entries" on public.collection_entries;
create policy "Users can update own collection entries"
on public.collection_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own collection entries" on public.collection_entries;
create policy "Users can delete own collection entries"
on public.collection_entries
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own collection lists" on public.collection_lists;
create policy "Users can read own collection lists"
on public.collection_lists
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own collection lists" on public.collection_lists;
create policy "Users can insert own collection lists"
on public.collection_lists
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own collection lists" on public.collection_lists;
create policy "Users can update own collection lists"
on public.collection_lists
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own collection lists" on public.collection_lists;
create policy "Users can delete own collection lists"
on public.collection_lists
for delete
using (auth.uid() = user_id);
