import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {createIdentityVerifier} from './identity.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PREVIEW=process.argv.includes('--preview');
const PORT=Number(process.env.PORT||4173),HOST=PREVIEW?'127.0.0.1':(process.env.HOST||'127.0.0.1');
const ORIGIN=process.env.APP_ORIGIN||`http://127.0.0.1:${PORT}`;
const FRONTEND=new URL(process.env.FRONTEND_URL||ORIGIN).origin;
const allowedOrigins=new Set([ORIGIN,FRONTEND]);
const identityConfig={tenantId:process.env.MS_TENANT_ID,clientId:process.env.MS_SPA_CLIENT_ID,audience:process.env.MS_API_CLIENT_ID,adminIds:(process.env.ADMIN_OBJECT_IDS||'').split(',').map(x=>x.trim()).filter(Boolean)};
const configured=identityConfig.tenantId&&identityConfig.clientId&&identityConfig.audience&&identityConfig.adminIds.length;
if(!PREVIEW&&process.env.NODE_ENV==='production'&&(!process.env.APP_ORIGIN?.startsWith('https://')||!configured))throw Error('Production requires an HTTPS APP_ORIGIN, Microsoft tenant/app IDs, and administrator object IDs.');
const verifyIdentity=configured?createIdentityVerifier(identityConfig):null;
const STORAGE=path.resolve(process.env.DATA_DIR||path.join(ROOT,'runtime')),PRIVATE=path.resolve(process.env.PRIVATE_DIR||path.join(ROOT,'private'));
fs.mkdirSync(STORAGE,{recursive:true});fs.mkdirSync(path.join(STORAGE,'uploads'),{recursive:true});
const CONTENT=path.join(STORAGE,PREVIEW?'preview-content.json':'content.json');
if(!fs.existsSync(CONTENT)){if(!fs.existsSync(path.join(PRIVATE,'content.json')))throw Error('Private source data is missing. See README.md.');fs.copyFileSync(path.join(PRIVATE,'content.json'),CONTENT);}
const sessions=new Map();
const categories=['Company & Policies','HR & Leave','Production & Planning','Prepress & Artwork','Quality & Compliance','Health & Safety','Purchasing & Logistics','Events & Announcements'];
const locations=['All locations','China','Vietnam','UAE'];
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.zip':'application/zip'};
const types=['news','notifications','documents','pictures'];
const random=()=>randomBytes(32).toString('base64url');
const cookieName=ORIGIN.startsWith('https://')?'__Host-ilp_session':'ilp_session';
const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${ORIGIN.startsWith('https://')?'; Secure':''}`;
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
const read=()=>JSON.parse(fs.readFileSync(CONTENT,'utf8'));
const save=data=>{const temp=CONTENT+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(temp,CONTENT)};
const fail=(status,message)=>Object.assign(Error(message),{status});
function json(res,status,value,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(value))}
function originCheck(req){if(!allowedOrigins.has(req.headers.origin))throw fail(403,'Request origin is not allowed.')}
function same(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b))}
async function current(req){
 if(PREVIEW){const sid=cookies(req)[cookieName],s=sessions.get(sid);if(!s||s.expires<Date.now()){sessions.delete(sid);return null}return s}
 const auth=req.headers.authorization;if(!auth?.startsWith('Bearer '))return null;
 if(!verifyIdentity)throw fail(503,'Microsoft employee sign-in has not been connected.');
 try{return await verifyIdentity(auth.slice(7))}catch(e){throw fail(e.status||401,e.status?e.message:'Your Microsoft sign-in could not be verified. Please sign in again.')}
}
async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'Send JSON content.');let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>15*1024*1024)throw fail(413,'File is too large.');chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw fail(400,'Invalid request body.')}}
function text(value,max,label){if(typeof value!=='string'||!value.trim()||value.length>max)throw fail(400,`${label} is required and must be under ${max} characters.`);return value.trim()}
function serveFile(req,res,file,download=false){if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw fail(404,'File not found.');const headers={'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Content-Length':fs.statSync(file).size,'Cache-Control':req.url.startsWith('/media/')?'private, no-store':'no-cache'};if(download)headers['Content-Disposition']=`attachment; filename="${path.basename(file).replace(/[^a-zA-Z0-9._-]/g,'_')}"`;res.writeHead(200,headers);if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res)}
function safeFile(root,part){const f=path.resolve(root,part);if(!f.startsWith(root+path.sep))throw fail(404,'Not found.');return f}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");if(ORIGIN.startsWith('https://'))res.setHeader('Strict-Transport-Security','max-age=31536000');try{
if(req.headers.host!==new URL(ORIGIN).host)throw fail(403,'Request host is not allowed.');
const requestOrigin=req.headers.origin;
if(requestOrigin){if(!allowedOrigins.has(requestOrigin))throw fail(403,'Request origin is not allowed.');res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-CSRF-Token');res.setHeader('Access-Control-Allow-Methods','GET, HEAD, POST, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Credentials','true');}
if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
const url=new URL(req.url,ORIGIN),p=decodeURIComponent(url.pathname),get=req.method==='GET'||req.method==='HEAD';
if(p==='/api/auth-config'&&get)return json(res,200,{provider:'microsoft',configured:!!configured,tenantId:identityConfig.tenantId||null,clientId:identityConfig.clientId||null,scope:identityConfig.audience?'api://'+identityConfig.audience+'/Portal.Access':null,redirectUri:process.env.FRONTEND_URL||ORIGIN+'/'});
let user=await current(req);
if(PREVIEW&&!user&&p==='/api/session'&&get){const id=random();user={email:'local-preview@localhost',role:process.argv.includes('--employee')?'employee':'admin',csrf:random(),preview:true,expires:Date.now()+8*3600000};sessions.set(id,user);res.setHeader('Set-Cookie',cookie(cookieName,id,28800))}
if(p==='/api/session'&&get){if(!user)throw fail(401,'Sign-in required.');return json(res,200,{email:user.email,role:user.role,csrf:user.csrf||null,preview:!!user.preview})}
if(p.startsWith('/api/')||p.startsWith('/media/')){if(!user)throw fail(401,'Sign-in required.');if(!get){originCheck(req);if(PREVIEW&&!same(req.headers['x-csrf-token'],user.csrf))throw fail(403,'Request verification failed. Please reload the page.')}}
if(p==='/api/logout'&&req.method==='POST'){sessions.delete(cookies(req)[cookieName]);return json(res,200,{ok:true},{'Set-Cookie':cookie(cookieName,'',0)})}
if(p==='/api/content'&&get)return json(res,200,read());
if(p.startsWith('/api/content/')){if(user.role!=='admin')throw fail(403,'Only portal administrators can publish or remove content.');const [, , ,type,id]=p.split('/');if(!types.includes(type))throw fail(404,'Content type not found.');let state=read();
if(req.method==='DELETE'&&id){const entry=state[type].find(x=>x.id===id);if(!entry)throw fail(404,'Item not found.');state[type]=state[type].filter(x=>x.id!==id);save(state);return json(res,200,{ok:true})}
if(req.method==='POST'&&!id){const b=await body(req),entry={id:randomUUID(),title:text(b.title,160,'Title'),country:b.country,date:new Date().toISOString(),author:user.email};if(!locations.includes(entry.country))throw fail(400,'Choose a supported location.');
if(type==='news'||type==='notifications')entry.body=text(b.body,10000,'Message');else{const ext=path.extname(b.filename||'').toLowerCase(),allowed=type==='pictures'?['.jpg','.jpeg','.png','.webp']:['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.csv','.txt','.zip'];if(!allowed.includes(ext))throw fail(400,'This file type is not supported.');if(typeof b.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))throw fail(400,'Invalid file.');const buffer=Buffer.from(b.base64,'base64');if(!buffer.length||buffer.length>10*1024*1024)throw fail(413,'Choose a file between 1 byte and 10 MB.');if(type==='pictures'){const valid=ext==='.png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):ext==='.webp'?buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP':buffer[0]===255&&buffer[1]===216&&buffer[2]===255;if(!valid)throw fail(400,'The picture is not a valid JPG, PNG or WebP file.')}if(type==='documents'){if(!categories.includes(b.category))throw fail(400,'Choose a document category.');entry.category=b.category}const filename=entry.id+ext;fs.writeFileSync(path.join(STORAGE,'uploads',filename),buffer,{mode:0o600});entry.url='/media/uploads/'+filename;entry.format=ext.slice(1).toUpperCase();entry.originalFilename=path.basename(b.filename);entry.size=buffer.length}state=read();state[type].unshift(entry);save(state);return json(res,201,entry)}throw fail(405,'Method not allowed.')}
if(p.startsWith('/media/')&&get){const part=p.slice(7);if(part.startsWith('uploads/')){const state=read(),relative='/media/'+part;if(![...state.documents,...state.pictures].some(x=>x.url===relative))throw fail(404,'File not found.');const f=safeFile(STORAGE,part);return serveFile(req,res,f,!mime[path.extname(f)]?.startsWith('image/'))}if(!/^(portraits\/[a-z-]+\.png|documents\/[a-z0-9-]+\.pdf|photos\/img_[0-9]+\.jpg)$/.test(part))throw fail(404,'File not found.');const state=read(),url='/media/'+part;const visible=part.startsWith('portraits/')?state.people.some(x=>x.photo===url):part.startsWith('documents/')?state.documents.some(x=>x.url===url):state.pictures.some(x=>x.url===url)||state.news.some(x=>x.image===url);if(!visible)throw fail(404,'File not found.');return serveFile(req,res,safeFile(PRIVATE,part),part.startsWith('documents/'))}
if(get){const f=safeFile(path.join(ROOT,'public'),p==='/'?'index.html':p.slice(1));return serveFile(req,res,f)}throw fail(404,'Not found.');
}catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'The request could not be completed. Please try again.'});else res.destroy()}});
setInterval(()=>{for(const [id,s]of sessions)if(s.expires<Date.now())sessions.delete(id)},60000).unref();
server.listen(PORT,HOST,()=>console.log(`${PREVIEW?'LOCAL PREVIEW':'PORTAL'} ${ORIGIN}`));
