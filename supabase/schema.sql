-- Pedro 18 — Momentos / Google Drive
-- Execute UMA VEZ em um projeto Supabase novo.
-- Antes: Authentication > Providers > Anonymous Sign-Ins = ON.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  upload_group_id uuid not null unique,
  original_drive_id text not null unique,
  preview_drive_id text not null unique,
  original_web_view_url text,
  original_web_content_url text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  preview_size_bytes bigint not null check (preview_size_bytes > 0 and preview_size_bytes <= 2097152),
  width integer,
  height integer,
  likes_count integer not null default 0 check (likes_count >= 0),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- Segredos da conexão com o Google Drive.
-- Esta tabela NÃO fica acessível ao frontend.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create index if not exists photos_created_at_idx on public.photos (created_at desc);
create index if not exists photos_user_created_idx on public.photos (user_id, created_at desc);
create index if not exists likes_user_idx on public.likes (user_id);

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_profile_updated_at();

create or replace function public.sync_photo_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.photos
      set likes_count = likes_count + 1
      where id = new.photo_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.photos
      set likes_count = greatest(likes_count - 1, 0)
      where id = old.photo_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_sync_count on public.likes;
create trigger likes_sync_count
after insert or delete on public.likes
for each row execute function public.sync_photo_like_count();

alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.likes enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.photos from anon, authenticated;
revoke all on public.likes from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select on public.photos to authenticated;
grant select, insert, delete on public.likes to authenticated;

grant all on public.profiles to service_role;
grant all on public.photos to service_role;
grant all on public.likes to service_role;
grant all on public.app_settings to service_role;

-- Perfil: cada convidado cuida somente do próprio nome.
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profile_insert_own" on public.profiles;
create policy "profile_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Feed: convidados autenticados enxergam apenas fotos publicadas.
drop policy if exists "photos_read_party" on public.photos;
create policy "photos_read_party"
on public.photos for select
to authenticated
using (published = true);

-- Curtidas: cada convidado vê e altera apenas as próprias curtidas.
drop policy if exists "likes_select_own" on public.likes;
create policy "likes_select_own"
on public.likes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own"
on public.likes for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own"
on public.likes for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Realtime apenas para novas publicações no feed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
end $$;
