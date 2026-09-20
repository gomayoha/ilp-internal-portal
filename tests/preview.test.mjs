import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
test('local visitor and admin flows, persistence and CSRF protection',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ilp-preview-')),source=path.join(dir,'private');await fs.mkdir(path.join(source,'documents'),{recursive:true});
 await fs.writeFile(path.join(source,'documents','sample.pdf'),'%PDF-1.7 synthetic');
 await fs.writeFile(path.join(source,'content.json'),JSON.stringify({people:[],prizes:[],news:[],notifications:[],pictures:[],documents:[{id:'doc',title:'Sample',url:'/media/documents/sample.pdf'}]}));
 const port=19201+Math.floor(Math.random()*1000),origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.mjs','--preview'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:path.join(dir,'runtime'),PRIVATE_DIR:source},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Preview server failed');}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Startup timed out')),8000).unref())]);
  assert.equal((await fetch(origin+'/api/session').then(r=>r.json())).role,'viewer');
  assert.equal((await fetch(origin+'/api/content')).status,200);assert.equal((await fetch(origin+'/media/documents/sample.pdf')).status,200);
  assert.equal((await fetch(origin+'/api/content/news',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(origin+'/api/preview-admin',{method:'POST',headers:{Origin:'https://attacker.example'},body:'{}'})).status,403);
  const response=await fetch(origin+'/api/preview-admin',{method:'POST',headers:{Origin:origin},body:'{}'}),cookie=response.headers.get('set-cookie').split(';')[0],admin=await response.json();
  const headers={Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':admin.csrf};
  const created=await fetch(origin+'/api/content/notifications',{method:'POST',headers,body:JSON.stringify({title:'Test notice',country:'Vietnam',body:'Initial'})});assert.equal(created.status,201);const item=await created.json();
  const edit=await fetch(origin+'/api/content/notifications/'+item.id,{method:'PATCH',headers,body:JSON.stringify({title:'Updated',country:'Vietnam',body:'Revised'})});assert.equal(edit.status,200);
  assert.equal((await fetch(origin+'/api/content').then(r=>r.json())).notifications[0].title,'Updated');
  assert.equal((await fetch(origin+'/api/logout',{method:'POST',headers:{...headers,'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal((await fetch(origin+'/api/logout',{method:'POST',headers})).status,200);
  assert.equal((await fetch(origin+'/api/content/notifications/'+item.id,{method:'DELETE',headers})).status,403);
 }finally{child.kill();await once(child,'exit');await fs.rm(dir,{recursive:true,force:true});}
});
