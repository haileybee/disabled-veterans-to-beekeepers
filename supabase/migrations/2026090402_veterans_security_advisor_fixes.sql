create schema if not exists veterans_private;
revoke all on schema veterans_private from public;
grant usage on schema veterans_private to anon, authenticated, service_role;

alter function public.veterans_is_active_admin() set schema veterans_private;
alter function public.veterans_is_owner() set schema veterans_private;

alter function veterans_private.veterans_is_active_admin() set search_path = pg_catalog;
alter function veterans_private.veterans_is_owner() set search_path = pg_catalog;

revoke execute on function veterans_private.veterans_is_active_admin() from public;
revoke execute on function veterans_private.veterans_is_owner() from public;
grant execute on function veterans_private.veterans_is_active_admin() to anon, authenticated, service_role;
grant execute on function veterans_private.veterans_is_owner() to anon, authenticated, service_role;

drop policy if exists veterans_hive_story_images_public_read on storage.objects;
create policy veterans_hive_story_images_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'veterans-hive-story-images'
  and veterans_private.veterans_is_active_admin()
);
