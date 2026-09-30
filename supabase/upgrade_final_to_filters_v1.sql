-- Pedro Momentos — upgrade da versão FINAL para FILTROS V1
-- Seguro para executar antes de publicar o novo frontend.
-- Preserva usuários, fotos, curtidas e conexão atual do Google Drive.

alter table public.photos add column if not exists published_drive_id text;
alter table public.photos add column if not exists published_name text;
alter table public.photos add column if not exists published_mime_type text;
alter table public.photos add column if not exists published_size_bytes bigint;
alter table public.photos add column if not exists effect_id text not null default 'original';
alter table public.photos add column if not exists effect_meta jsonb not null default '{}'::jsonb;

create unique index if not exists photos_published_drive_id_uidx
  on public.photos (published_drive_id)
  where published_drive_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'photos_published_size_bytes_check'
      and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint photos_published_size_bytes_check
      check (published_size_bytes is null or (published_size_bytes > 0 and published_size_bytes <= 15728640));
  end if;
end $$;
