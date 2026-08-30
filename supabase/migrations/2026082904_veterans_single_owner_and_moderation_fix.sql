alter table public.veterans_chat_messages drop constraint if exists veterans_chat_content_present;
alter table public.veterans_chat_messages add constraint veterans_chat_content_present check (deleted_at is not null or char_length(trim(body)) > 0 or image_path is not null);
create unique index if not exists veterans_single_active_owner_idx on public.veterans_admins ((role)) where role='owner' and active=true;
