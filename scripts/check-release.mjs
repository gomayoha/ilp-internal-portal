import fs from 'node:fs/promises';
const config=JSON.parse(await fs.readFile('public/config.json','utf8'));
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)||!config.supabasePublishableKey?.startsWith('sb_publishable_'))throw Error('Configure the Supabase project URL and publishable key before releasing.');
const headers={apikey:config.supabasePublishableKey,'Content-Type':'application/json'};
const access=await fetch(config.supabaseUrl+'/rest/v1/rpc/can_view_portal',{method:'POST',headers,body:'{}'});
if(!access.ok)throw Error('The portal access check is unavailable. Apply the viewer preparation migration first.');
if(await access.json()!==false)throw Error('An anonymous visitor unexpectedly passed the portal access check.');
for(const table of ['portal_directory','portal_entries']){
 const response=await fetch(config.supabaseUrl+'/rest/v1/'+table+'?select=id&limit=1',{headers});
 if(!response.ok)throw Error('Supabase content is unavailable: '+table);
}
for(const name of ['private','runtime'])if(await fs.stat('public/'+name).catch(()=>null))throw Error('Source packs must not be included in the static deployment.');
console.log('Supabase access check and static release configuration verified.');
