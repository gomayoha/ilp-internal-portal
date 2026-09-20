// Run locally with a Supabase secret key in the environment, never in public/config.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {seedRows,mediaFiles} from './seed-data.mjs';
const root=path.resolve(process.env.SOURCE_DIR||'private');
const seed=JSON.parse(await fs.readFile(path.join(root,'content.json'),'utf8'));
const rows=seedRows(seed),files=mediaFiles(seed);
if(process.argv.includes('--check')){for(const file of files)await fs.access(path.join(root,file));console.log(`Ready: ${seed.people.length} colleagues, ${rows.length} entries, ${files.length} media files.`);process.exit(0);}
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY locally. Never put a secret key in GitHub or chat.');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
function check(r){if(r.error)throw Error(r.error.message);return r.data;}
const mime={'.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf'};
for(const file of files){const bytes=await fs.readFile(path.join(root,file));if(bytes.length>20971520)throw Error('A source file exceeds the 20 MB limit.');const {error}=await client.storage.from('portal-media').upload(file,bytes,{contentType:mime[path.extname(file)],upsert:false,cacheControl:'60'});if(error&&String(error.statusCode)!=='409')throw Error(error.message);}
check(await client.from('portal_directory').upsert({id:1,people:seed.people,prizes:seed.prizes},{onConflict:'id',ignoreDuplicates:true}));
check(await client.from('portal_entries').upsert(rows,{onConflict:'id',ignoreDuplicates:true}));
console.log(`Imported ${rows.length} content entries and ${files.length} files. Existing entries were preserved.`);
