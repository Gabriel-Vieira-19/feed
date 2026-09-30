-- Execute no SQL Editor SOMENTE se você já está usando a versão 2.2.
-- Preserva usuários, fotos e curtidas existentes.

alter table public.photos add column if not exists original_name text;

-- As URLs públicas do Drive não são mais necessárias na versão final.
alter table public.photos drop column if exists original_web_view_url;
alter table public.photos drop column if exists original_web_content_url;

create index if not exists photos_likes_created_idx on public.photos (likes_count desc, created_at desc);
create index if not exists photos_display_name_created_idx on public.photos (display_name, created_at desc);
