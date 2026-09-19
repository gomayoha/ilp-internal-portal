import fs from 'node:fs/promises';
const c=JSON.parse(await fs.readFile('public/config.json','utf8'));
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl)||!c.supabasePublishableKey?.startsWith('sb_publishable_'))throw Error('Configure the Supabase project URL and public publishable key before releasing.');
const headers={apikey:c.supabasePublishableKey};
for(const table of ['portal_directory','portal_entries']){const r=await fetch(c.supabaseUrl+'/rest/v1/'+table+'?select=id&limit=1',{headers});if(!r.ok||!(await r.json()).length)throw Error('Supabase content is not ready: '+table);}
for(const name of ['private','runtime'])if(await fs.stat('public/'+name).catch(()=>null))throw Error('Source packs must not be included in the static deployment.');
console.log('Public content connection verified.');
