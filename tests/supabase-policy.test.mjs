import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {entryPayload,filePayload} from '../src/content.js';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
test('PostgreSQL enforces public reading and only three assigned administrators',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to anon,authenticated;`);
 await db.exec(await fs.readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 for(const id of ids)await db.query('insert into auth.users values ($1)',[id]);
 for(let i=0;i<3;i++)await db.query('update public.portal_admin_slots set user_id=$1 where slot=$2',[ids[i],i+1]);
 await db.exec(`insert into portal_directory values(1,'[]','[]'); insert into portal_entries(id,type,title,country,body) values('seed','news','Company news','Vietnam','Update');`);
 async function as(role,id,fn){await db.exec('begin');try{await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);return await fn();}finally{await db.exec('rollback');}}
 await t.test('anonymous readers can see content but cannot write or enumerate admin identities',async()=>{
  await as('anon',null,async()=>assert.equal((await db.query('select * from portal_entries')).rows.length,1));
  for(const sql of ["insert into portal_entries(type,title,country) values('news','Intrusion','China')","update portal_entries set title='Intrusion'","delete from portal_entries","select * from portal_admin_slots","insert into storage.objects(bucket_id,name) values('portal-media','uploads/a.pdf')"]){await assert.rejects(as('anon',null,()=>db.exec(sql)));}
 });
 await t.test('authenticated but unassigned account cannot publish or grant itself a slot',async()=>{
  await as('authenticated',ids[3],async()=>{assert.equal((await db.query('select is_portal_admin() as ok')).rows[0].ok,false);assert.equal((await db.query("delete from portal_entries returning id")).rows.length,0);});
  await assert.rejects(as('authenticated',ids[3],()=>db.exec("insert into portal_entries(type,title,country) values('news','Intrusion','China')")));
  await assert.rejects(as('authenticated',ids[3],()=>db.query('update portal_admin_slots set user_id=$1 where slot=1',[ids[3]])));
  await assert.rejects(as('authenticated',ids[3],()=>db.exec("insert into storage.objects(bucket_id,name) values('portal-media','uploads/abc.pdf')")));
 });
 await t.test('all three assigned accounts can publish, edit and remove; upload restrictions still apply',async()=>{
  for(const id of ids.slice(0,3))await as('authenticated',id,async()=>{assert.equal((await db.query('select is_portal_admin() as ok')).rows[0].ok,true);await db.exec("insert into portal_entries(id,type,title,country) values('new','news','Published','UAE'); update portal_entries set title='Edited' where id='new'; delete from portal_entries where id='new'; insert into storage.objects(bucket_id,name) values('portal-media','uploads/abc.pdf'); delete from storage.objects;");});
  for(const name of ['uploads/abc.html','portraits/abc.png','uploads/../abc.pdf'])await assert.rejects(as('authenticated',ids[0],()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['portal-media',name])));
  await assert.rejects(as('authenticated',ids[0],()=>db.exec("update portal_admin_slots set user_id=null")));
  await assert.rejects(as('authenticated',ids[0],()=>db.exec("insert into portal_entries(type,title,country) values('news','x','Mars')")));
 });
 await t.test('fourth slot and duplicate accounts rejected; revoked slot loses access',async()=>{
  await assert.rejects(db.exec('insert into portal_admin_slots(slot) values(4)'));
  await assert.rejects(db.query('update portal_admin_slots set user_id=$1 where slot=2',[ids[0]]));
  await db.exec('update portal_admin_slots set user_id=null where slot=3');
  await as('authenticated',ids[2],async()=>assert.equal((await db.query('select is_portal_admin() as ok')).rows[0].ok,false));
  await assert.rejects(as('authenticated',ids[2],()=>db.exec("insert into portal_entries(type,title,country) values('news','x','China')")));
 });
 await db.close();
});
test('content payload rejects invalid files and untrusted author or role fields',()=>{
 const row=entryPayload('news',{title:' Hello ',body:'Update',country:'China',role:'admin',author:'forged'});assert.equal(row.title,'Hello');assert.equal(row.role,undefined);assert.equal(row.author,undefined);
 assert.throws(()=>entryPayload('documents',{title:'Doc',country:'China',category:'Bad'}));
 assert.throws(()=>filePayload('pictures',{filename:'bad.jpg',base64:btoa('not a JPEG')}));
 assert.throws(()=>filePayload('documents',{filename:'page.html',base64:btoa('<html>')}));
 assert.equal(filePayload('documents',{filename:'note.txt',base64:btoa('Hello')}).mime,'text/plain');
});
