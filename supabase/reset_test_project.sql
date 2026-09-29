-- SOMENTE para ambiente de TESTE.
-- Apaga as tabelas do Pedro Momentos para permitir rodar schema.sql do zero.
-- Não use se houver fotos/curtidas que você queira preservar.

drop table if exists public.likes cascade;
drop table if exists public.photos cascade;
drop table if exists public.profiles cascade;
drop table if exists public.app_settings cascade;
drop function if exists public.sync_photo_like_count() cascade;
drop function if exists public.touch_profile_updated_at() cascade;
