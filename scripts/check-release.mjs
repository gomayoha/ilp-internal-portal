import fs from 'node:fs/promises';
const c=JSON.parse(await fs.readFile('public/config.json','utf8'));
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl)||!c.supabasePublishableKey?.startsWith('sb_publishable_'))throw Error('Configure the Supabase project URL and public publishable key before releasing.');
const headers={apikey:c.supabasePublishableKey},content={};
for(const table of ['portal_directory','portal_entries']){const r=await fetch(c.supabaseUrl+'/rest/v1/'+table+'?select=*',{headers});if(!r.ok)throw Error('Supabase content is not ready: '+table);content[table]=await r.json();if(!content[table].length)throw Error('Supabase content is empty: '+table);}
const media=new Set(content.portal_directory.flatMap(x=>x.people.map(p=>p.photo)).filter(Boolean));
for(const row of content.portal_entries)for(const field of ['url','image'])if(row[field])media.add(row[field]);
const missing=[];
for(const file of media){if(!/^\/media\/[a-zA-Z0-9_./-]+$/.test(file)||file.includes('..'))throw Error('Invalid published media path.');const r=await fetch(c.supabaseUrl+'/storage/v1/object/public/portal-media/'+file.slice(7),{method:'HEAD'});if(!r.ok)missing.push(file);}
if(missing.length)throw Error(`${missing.length} published media files are missing. Complete the Storage import before release. First missing: ${missing[0]}`);
for(const name of ['private','runtime'])if(await fs.stat('public/'+name).catch(()=>null))throw Error('Source packs must not be included in the static deployment.');
console.log(`Public content and ${media.size} file downloads verified.`);
