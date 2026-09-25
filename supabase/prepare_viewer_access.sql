begin;

-- This phase preserves existing public reads while the updated site is deployed.
do $$ begin
  if (select count(*) from auth.users where email='workplace-access@idea-l-pack.com' and email_confirmed_at is not null) <> 1 then
    raise exception 'Create and auto-confirm the workplace-access Auth account first';
  end if;
end $$;

create table public.portal_viewer_account (
  id integer primary key check (id=1),
  user_id uuid not null unique references auth.users(id) on delete restrict
);
alter table public.portal_viewer_account enable row level security;
revoke all on public.portal_viewer_account from anon, authenticated;
grant select, insert, update, delete on public.portal_viewer_account to service_role;
create policy viewer_account_owner_only on public.portal_viewer_account for all to anon, authenticated using (false) with check (false);
insert into public.portal_viewer_account(id,user_id)
select 1,id from auth.users where email='workplace-access@idea-l-pack.com' and email_confirmed_at is not null;

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

-- Temporary authenticated file-read policy for the deployment transition.
create policy portal_files_read_viewer on storage.objects for select to authenticated
using (bucket_id='portal-media' and (select public.can_view_portal()));

commit;
