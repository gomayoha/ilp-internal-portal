// Local preview only. Production runs on GitHub Pages + Supabase.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {entryPayload,filePayload} from './src/content.js';
if(!process.argv.includes('--preview'))throw Error('Use pnpm preview locally. Production is hosted by GitHub Pages and Supabase.');
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4173),origin=`http://127.0.0.1:${port}`;
const storage=path.resolve(process.env.DATA_DIR||path.join(root,'runtime')),source=path.resolve(process.env.PRIVATE_DIR||path.join(root,'private'));
fs.mkdirSync(path.join(storage,'uploads'),{recursive:true});const content=path.join(storage,'supabase-preview-content.json');if(!fs.existsSync(content))fs.copyFileSync(path.join(source,'content.json'),content);
const sessions=new Map(),random=()=>randomBytes(32).toString('hex');
const read=()=>JSON.parse(fs.readFileSync(content,'utf8')),save=data=>{fs.writeFileSync(content+'.tmp',JSON.stringify(data));fs.renameSync(content+'.tmp',content)};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.ttf':'font/ttf'};
function fail(status,message){return Object.assign(Error(message),{status})}
async function body(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>30*1024*1024)throw fail(413,'File too large.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString());}
const server=http.createServer(async(req,res)=>{const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};try{
 if(req.headers.host!==`127.0.0.1:${port}`)throw fail(403,'Invalid host.');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
 const url=new URL(req.url,origin),p=decodeURIComponent(url.pathname),get=['GET','HEAD'].includes(req.method);
 const sid=(req.headers.cookie||'').split('; ').find(x=>x.startsWith('ilp_preview='))?.slice(12);let session=sessions.get(sid);if(session?.expires<Date.now()){sessions.delete(sid);session=null;}
 if(p==='/api/session'&&get)return json(200,session||{role:'viewer',email:'visitor',preview:true});
 if(p==='/config.json'&&get)return json(200,{});
 if(!get&&req.headers.origin!==origin)throw fail(403,'Origin not allowed.');
 if(p==='/api/preview-admin'&&req.method==='POST'){const id=random();session={role:'admin',email:'preview-administrator@localhost',csrf:random(),preview:true,expires:Date.now()+3600000};sessions.set(id,session);res.setHeader('Set-Cookie',`ilp_preview=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`);return json(200,session);}
 if(!get&&(!session||req.headers['x-csrf-token']!==session.csrf))throw fail(403,'Administrator access required.');
 if(p==='/api/logout'&&req.method==='POST'){sessions.delete(sid);res.setHeader('Set-Cookie','ilp_preview=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{ok:true});}
 if(p==='/api/content'&&get)return json(200,read());
 const match=p.match(/^\/api\/content\/(news|notifications|documents|pictures)(?:\/([^/]+))?$/);
 if(match){const [,type,id]=match;if(req.method==='PATCH'&&id&&['news','notifications'].includes(type)){const payload=entryPayload(type,await body(req));delete payload.date;const data=read(),entry=data[type].find(x=>x.id===id);if(!entry)throw fail(404,'Item not found.');Object.assign(entry,payload);save(data);return json(200,entry);}if(req.method==='DELETE'&&id){const data=read();data[type]=data[type].filter(x=>x.id!==id);save(data);return json(200,{ok:true});}if(req.method==='POST'&&!id){const input=await body(req),entry={...entryPayload(type,input),id:randomUUID()};if(['documents','pictures'].includes(type)){const file=filePayload(type,input),name=entry.id+file.extension;fs.writeFileSync(path.join(storage,'uploads',name),file.bytes);Object.assign(entry,{url:'/media/uploads/'+name,format:file.extension.slice(1).toUpperCase(),size:file.bytes.length});}const data=read();data[type].unshift(entry);save(data);return json(201,entry);}throw fail(405,'Method not allowed.');}
 if(get){const media=p.startsWith('/media/'),base=media?(p.startsWith('/media/uploads/')?storage:source):path.join(root,'public'),relative=media?p.slice(7):p==='/'?'index.html':p.slice(1),file=path.resolve(base,relative);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())throw fail(404,'Not found.');if(media&&!/^(portraits\/[a-z-]+\.png|documents\/[a-z0-9-]+\.pdf|photos\/(?:img_[0-9]+|ilp-seminar-hero)\.jpg|products\/[a-z-]+\.jpg|uploads\/[a-f0-9-]+\.[a-z0-9]+)$/.test(relative))throw fail(404,'Not found.');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});return req.method==='HEAD'?res.end():fs.createReadStream(file).pipe(res);}
 throw fail(404,'Not found.');
 }catch(e){if(!res.headersSent)json(e.status||400,{error:e.message});else res.destroy();}});
setInterval(()=>{for(const [id,s]of sessions)if(s.expires<Date.now())sessions.delete(id)},60000).unref();
server.listen(port,'127.0.0.1',()=>console.log('LOCAL PREVIEW '+origin));
