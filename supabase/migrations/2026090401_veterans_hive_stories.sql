create table if not exists public.veterans_hive_stories(
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(trim(title)) between 1 and 140),
  hive_name text not null default '' check(char_length(hive_name)<=120),
  location text not null default '' check(char_length(location)<=160),
  story_date date,
  excerpt text not null default '' check(char_length(excerpt)<=320),
  body text not null check(char_length(trim(body)) between 1 and 12000),
  image_path text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.veterans_hive_stories enable row level security;

create policy veterans_hive_stories_public_read
on public.veterans_hive_stories for select to anon,authenticated
using(published=true or public.veterans_is_active_admin());

create policy veterans_hive_stories_admin_insert
on public.veterans_hive_stories for insert to authenticated
with check(public.veterans_is_active_admin());

create policy veterans_hive_stories_admin_update
on public.veterans_hive_stories for update to authenticated
using(public.veterans_is_active_admin())
with check(public.veterans_is_active_admin());

create policy veterans_hive_stories_admin_delete
on public.veterans_hive_stories for delete to authenticated
using(public.veterans_is_active_admin());

grant select on public.veterans_hive_stories to anon,authenticated;
grant insert,update,delete on public.veterans_hive_stories to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('veterans-hive-story-images','veterans-hive-story-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy veterans_hive_story_images_public_read
on storage.objects for select to anon,authenticated
using(bucket_id='veterans-hive-story-images');

create policy veterans_hive_story_images_admin_insert
on storage.objects for insert to authenticated
with check(bucket_id='veterans-hive-story-images' and public.veterans_is_active_admin());

create policy veterans_hive_story_images_admin_update
on storage.objects for update to authenticated
using(bucket_id='veterans-hive-story-images' and public.veterans_is_active_admin())
with check(bucket_id='veterans-hive-story-images' and public.veterans_is_active_admin());

create policy veterans_hive_story_images_admin_delete
on storage.objects for delete to authenticated
using(bucket_id='veterans-hive-story-images' and public.veterans_is_active_admin());
