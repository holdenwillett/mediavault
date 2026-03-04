-- Run this in Supabase SQL editor.

create table if not exists public.collection_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv', 'game')),
  external_id text not null,
  source text not null,
  title text not null,
  poster_url text null,
  rating double precision null,
  status text not null check (status in ('wishlist', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, external_id)
);

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

alter table public.collection_entries enable row level security;

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
