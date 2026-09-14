-- ════════════════════════════════════════════════════════════════════════════
--  WEJI ويجي — database schema
--
--  HOW TO RUN THIS (once, takes about a minute):
--    1. Open your project at https://supabase.com/dashboard
--    2. Left sidebar → SQL Editor → New query
--    3. Paste this entire file, press Run
--
--  Safe to run more than once — every statement checks before it creates.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per account. Supabase keeps passwords in its own auth.users table;
-- this is only the part WEJI needs to show.
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz not null default now()
);

-- ── Collections (the boards a user saves into) ──────────────────────────────
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_idx on public.collections (user_id, created_at desc);

-- ── Saved pictures ──────────────────────────────────────────────────────────
-- The whole picture is stored as JSON alongside the reference. That means a
-- saved collection still renders years later even if the photo is removed from
-- Unsplash, and opening a collection costs no third-party API calls at all.
create table if not exists public.collection_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  image_id      text not null,
  image         jsonb not null,
  created_at    timestamptz not null default now(),
  unique (collection_id, image_id)
);

create index if not exists collection_items_collection_idx
  on public.collection_items (collection_id, created_at desc);

-- ── Likes ───────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  user_id    uuid not null references auth.users on delete cascade,
  image_id   text not null,
  image      jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, image_id)
);

-- ── Followed topics (phase 3 — the personalised feed) ───────────────────────
create table if not exists public.followed_topics (
  user_id    uuid not null references auth.users on delete cascade,
  topic      text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic)
);

-- ════════════════════════════════════════════════════════════════════════════
--  Row Level Security
--
--  This is the part that matters: without it, any signed-in user could read
--  everyone else's collections. These policies make every row private to the
--  user who created it, enforced by the database itself rather than by app
--  code — so a bug in the app can never leak another user's data.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles         enable row level security;
alter table public.collections      enable row level security;
alter table public.collection_items enable row level security;
alter table public.likes            enable row level security;
alter table public.followed_topics  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own collections" on public.collections;
create policy "own collections" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own collection items" on public.collection_items;
create policy "own collection items" on public.collection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own likes" on public.likes;
create policy "own likes" on public.likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own followed topics" on public.followed_topics;
create policy "own followed topics" on public.followed_topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
--  New-account setup
--
--  Runs automatically the moment someone confirms their email: creates their
--  profile and gives them a first collection, so the app is never empty.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.collections (user_id, name, is_default)
  values (new.id, 'My picks', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
