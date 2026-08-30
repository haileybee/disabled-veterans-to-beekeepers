drop index if exists public.veterans_single_active_owner_idx;

insert into public.veterans_admins(email, role, active)
values
  ('donaldrschafer@gmail.com', 'owner', true),
  ('haileybee913@gmail.com', 'owner', true)
on conflict(email) do update
set role='owner', active=true, updated_at=now();
