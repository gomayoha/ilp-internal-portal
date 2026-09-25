-- Run once in the SQL editor of a dedicated Supabase project.
begin;
create table public.portal_admin_slots (
  slot smallint primary key check (slot between 1 and 3),
  user_id uuid unique references auth.users(id) on delete set null
);
insert into public.portal_admin_slots(slot) values (1),(2),(3);
alter table public.portal_admin_slots enable row level security;
revoke all on public.portal_admin_slots from anon, authenticated;
create policy admin_assignments_owner_only on public.portal_admin_slots for all to anon, authenticated using (false) with check (false);

create schema if not exists portal_private;
revoke all on schema portal_private from public;
grant usage on schema portal_private to anon, authenticated;
create function portal_private.is_portal_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and exists(select 1 from public.portal_admin_slots where user_id = (select auth.uid())) $$;
revoke all on function portal_private.is_portal_admin() from public;
grant execute on function portal_private.is_portal_admin() to anon, authenticated;
create function public.is_portal_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select portal_private.is_portal_admin() $$;
revoke all on function public.is_portal_admin() from public;
grant execute on function public.is_portal_admin() to anon, authenticated;

create table public.portal_viewer_account (
  id integer primary key check (id=1),
  user_id uuid not null unique references auth.users(id) on delete restrict
);
alter table public.portal_viewer_account enable row level security;
revoke all on public.portal_viewer_account from anon, authenticated;
grant select, insert, update, delete on public.portal_viewer_account to service_role;
create policy viewer_account_owner_only on public.portal_viewer_account for all to anon, authenticated using (false) with check (false);
create function portal_private.can_view_portal() returns boolean
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) is not null and (
  portal_private.is_portal_admin() or exists(select 1 from public.portal_viewer_account where user_id=(select auth.uid()))
) $$;
revoke all on function portal_private.can_view_portal() from public;
grant execute on function portal_private.can_view_portal() to anon, authenticated;
create function public.can_view_portal() returns boolean
language sql stable security invoker set search_path = ''
as $$ select portal_private.can_view_portal() $$;
revoke all on function public.can_view_portal() from public;
grant execute on function public.can_view_portal() to anon, authenticated;

create table public.portal_directory (
  id integer primary key check (id=1),
  people jsonb not null check (jsonb_typeof(people)='array'),
  prizes jsonb not null check (jsonb_typeof(prizes)='array')
);
create table public.portal_entries (
  id text primary key default gen_random_uuid()::text,
  type text not null check (type in ('news','notifications','documents','pictures')),
  title text not null check (length(btrim(title)) between 1 and 160),
  country text not null check (country in ('All locations','China','Vietnam','UAE')),
  body text check (length(body)<=10000),
  category text check (category in ('Leadership','Sales','Merchandising','Warehouse','Production','Product Development','Purchasing','Quality Control','Finance','Human Resources & Administration','Projects')),
  url text check (url ~ '^/media/[a-zA-Z0-9_./-]+$' and url !~ '\.\.'),
  image text check (image ~ '^/media/[a-zA-Z0-9_./-]+$' and image !~ '\.\.'),
  format text,
  size bigint check (size between 1 and 20971520),
  original_filename text,
  kind text,
  subtitle text,
  link text check (link in ('team','activity','notifications','documents','pictures')),
  date timestamptz,
  created_at timestamptz not null default now(),
  check (type not in ('documents','pictures') or url is not null),
  check (type <> 'documents' or category is not null)
);
alter table public.portal_directory enable row level security;
alter table public.portal_entries enable row level security;
revoke all on public.portal_directory, public.portal_entries from anon, authenticated;
grant select on public.portal_directory, public.portal_entries to anon, authenticated;
grant insert, update, delete on public.portal_entries to authenticated;
grant select, insert, update, delete on public.portal_admin_slots, public.portal_directory, public.portal_entries to service_role;
create policy directory_read on public.portal_directory for select to authenticated using ((select public.can_view_portal()));
create policy entries_read on public.portal_entries for select to authenticated using ((select public.can_view_portal()));
create policy entries_insert on public.portal_entries for insert to authenticated with check ((select public.is_portal_admin()));
create policy entries_update on public.portal_entries for update to authenticated using ((select public.is_portal_admin())) with check ((select public.is_portal_admin()));
create policy entries_delete on public.portal_entries for delete to authenticated using ((select public.is_portal_admin()));

-- A private bucket keeps portraits, photos and documents behind the shared-password account.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('portal-media','portal-media',false,20971520,array[
 'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/zip',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
create policy portal_files_read on storage.objects for select to authenticated
using (bucket_id='portal-media' and (select public.can_view_portal()));
create policy portal_files_upload on storage.objects for insert to authenticated
with check (bucket_id='portal-media' and name ~ '^uploads/[a-f0-9-]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|zip|jpg|jpeg|png|webp)$' and (select public.is_portal_admin()));
create policy portal_files_remove on storage.objects for delete to authenticated
using (bucket_id='portal-media' and (select public.is_portal_admin()));
commit;
