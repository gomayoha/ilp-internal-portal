import {createClient} from '@supabase/supabase-js';
import {entryPayload, filePayload} from './content.js';
let client;
const bucket='portal-media';
const viewerEmail='workplace-access@idea-l-pack.com';
function check(result){if(result.error)throw Error(result.error.message);return result.data;}
async function admin(){if(!check(await client.rpc('is_portal_admin')))throw Error('Only the three assigned administrators can manage content.');}
async function session(){const {data,error}=await client.auth.getSession();if(error)throw error;const user=data.session?.user;if(!user)return {role:'locked'};const permitted=check(await client.rpc('can_view_portal'));if(!permitted)return {role:'locked'};const isAdministrator=check(await client.rpc('is_portal_admin'));return {role:isAdministrator?'admin':'viewer',email:user.email};}
async function content(){const {data:auth}=await client.auth.getSession();if(!auth.session)throw Error('Enter the workplace password to continue.');const [directory,entries]=await Promise.all([client.from('portal_directory').select('people,prizes').eq('id',1).single(),client.from('portal_entries').select('*').order('created_at',{ascending:false})]);const seed=check(directory),rows=check(entries);return {...seed,...Object.fromEntries(['news','notifications','documents','pictures'].map(type=>[type,rows.filter(r=>r.type===type).map(r=>({...r,originalFilename:r.original_filename}))]))};}
window.PortalAuth={
 async setup(config){client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});},
 async signInViewer(password){check(await client.auth.signInWithPassword({email:viewerEmail,password}));const result=await session();if(result.role!=='viewer'){await client.auth.signOut({scope:'local'});throw Error('This password does not grant workplace access.');}return result;},
 async signIn(email,password){check(await client.auth.signInWithPassword({email:email.trim(),password}));const result=await session();if(result.role!=='admin'){await client.auth.signOut();throw Error('This account has not been assigned an administrator slot.');}return result;},
 async signOut(){check(await client.auth.signOut({scope:'local'}));},
 async changePassword(password){await admin();check(await client.auth.updateUser({password}));},
 async session(){return session();}
};
window.PortalData={
 async mediaBlob(relative){if(!/^\/media\/[a-zA-Z0-9_./-]+$/.test(relative)||relative.includes('..'))throw Error('Invalid file link.');const {data:auth}=await client.auth.getSession();if(!auth.session)throw Error('Enter the workplace password to continue.');return check(await client.storage.from(bucket).download(relative.slice(7)));},
 async api(path,opts={}){
  if(path==='/api/session')return session();
  if(path==='/api/content')return content();
  if(path==='/api/logout'){await window.PortalAuth.signOut();return {ok:true};}
  const match=path.match(/^\/api\/content\/(news|notifications|documents|pictures)(?:\/([^/]+))?$/);
  if(!match)throw Error('Unknown request.');
  await admin();const [,type,id]=match;
  if(opts.method==='DELETE'&&id){
   const row=check(await client.from('portal_entries').select('*').eq('type',type).eq('id',decodeURIComponent(id)).single());
   check(await client.from('portal_entries').delete().eq('id',row.id));
   // Keep files still referenced by another published item (e.g. a featured photo).
   let warning;
   if(row.url){const references=await client.from('portal_entries').select('id').or(`url.eq.${row.url},image.eq.${row.url}`);if(references.error)warning='Item removed. File cleanup could not be checked.';else if(!references.data.length){const removed=await client.storage.from(bucket).remove([row.url.slice(7)]);if(removed.error)warning='Item removed. The stored file could not be deleted; ask the project owner to remove it from Storage.';}}
   return {ok:true,warning};
  }
  if(opts.method==='PATCH'&&id&&['news','notifications'].includes(type)){const row=entryPayload(type,JSON.parse(opts.body));delete row.date;return check(await client.from('portal_entries').update(row).eq('id',decodeURIComponent(id)).eq('type',type).select().single());}
  if(opts.method==='POST'&&!id){
   const input=JSON.parse(opts.body),entry=entryPayload(type,input);let uploaded;
   if(type==='documents'||type==='pictures'){
    const file=filePayload(type,input);uploaded='uploads/'+crypto.randomUUID()+file.extension;
    check(await client.storage.from(bucket).upload(uploaded,file.bytes,{contentType:file.mime,upsert:false,cacheControl:'60'}));
    Object.assign(entry,{url:'/media/'+uploaded,format:file.extension.slice(1).toUpperCase(),size:file.bytes.length,original_filename:input.filename});
   }
   const result=await client.from('portal_entries').insert(entry).select().single();
   if(result.error){if(uploaded)await client.storage.from(bucket).remove([uploaded]);throw Error(result.error.message);}
   return result.data;
  }
  throw Error('Unsupported request.');
 }
};
