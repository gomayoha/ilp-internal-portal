import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({entryPoints:['src/auth.js'],bundle:true,minify:true,format:'iife',outfile:'public/auth.js',legalComments:'linked',target:['es2022']});
const fontPath='public/assets/montserrat.ttf';
const expected='0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7';
let font=await fs.readFile(fontPath).catch(()=>null);
if(!font||createHash('sha256').update(font).digest('hex')!==expected){
 const response=await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf');
 if(!response.ok)throw Error('Unable to obtain the official Montserrat font.');
 font=Buffer.from(await response.arrayBuffer());
 if(createHash('sha256').update(font).digest('hex')!==expected)throw Error('The upstream font changed. Review it before updating the pinned checksum.');
 await fs.writeFile(fontPath,font);
}
