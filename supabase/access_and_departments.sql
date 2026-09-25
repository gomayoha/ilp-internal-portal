begin;

-- Apply only after prepare_viewer_access.sql and after the updated site is live.
do $$ begin
  if not exists (select 1 from public.portal_viewer_account where id=1) then
    raise exception 'Run prepare_viewer_access.sql before locking portal reads';
  end if;
end $$;

-- Assign the two existing documents to the corresponding department filters.
alter table public.portal_entries drop constraint portal_entries_category_check;
update public.portal_entries set category='Leadership' where type='documents' and id='organisation';
update public.portal_entries set category='Human Resources & Administration' where type='documents' and id='prizes';
alter table public.portal_entries add constraint portal_entries_category_check
check (category in ('Leadership','Sales','Merchandising','Warehouse','Production','Product Development','Purchasing','Quality Control','Finance','Human Resources & Administration','Projects'));
update public.portal_entries set body=replace(body,'in Pictures.','in the Photo Gallery.')
where type='news' and id='prize-presentations' and body like '%in Pictures.%';

drop policy directory_read on public.portal_directory;
drop policy entries_read on public.portal_entries;
revoke select on public.portal_directory, public.portal_entries from anon;
create policy directory_read on public.portal_directory for select to authenticated using ((select public.can_view_portal()));
create policy entries_read on public.portal_entries for select to authenticated using ((select public.can_view_portal()));

drop policy portal_files_read_admin on storage.objects;
drop policy portal_files_read_viewer on storage.objects;
create policy portal_files_read on storage.objects for select to authenticated
using (bucket_id='portal-media' and (select public.can_view_portal()));
update storage.buckets set public=false where id='portal-media';

commit;
