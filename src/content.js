export const categories=['Company & Policies','HR & Leave','Production & Planning','Prepress & Artwork','Quality & Compliance','Health & Safety','Purchasing & Logistics','Events & Announcements'];
const types=['news','notifications','documents','pictures'];
const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf','.txt':'text/plain','.csv':'text/csv','.zip':'application/zip','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function entryPayload(type,input){
 if(!types.includes(type))throw Error('Choose a supported content type.');
 if(typeof input.title!=='string'||!input.title.trim()||input.title.length>160)throw Error('Enter a title of up to 160 characters.');
 if(!['All locations','China','Vietnam','UAE'].includes(input.country))throw Error('Choose a supported location.');
 const row={type,title:input.title.trim(),country:input.country,date:new Date().toISOString()};
 if(type==='news'||type==='notifications'){if(typeof input.body!=='string'||!input.body.trim()||input.body.length>10000)throw Error('Enter a message of up to 10,000 characters.');row.body=input.body.trim();}
 if(type==='documents'){if(!categories.includes(input.category))throw Error('Choose a document category.');row.category=input.category;}
 return row;
}
export function filePayload(type,input){
 const extension=String(input.filename||'').match(/\.[^.]+$/)?.[0].toLowerCase();
 if(!mime[extension]||(type==='pictures'&&!['.jpg','.jpeg','.png','.webp'].includes(extension)))throw Error('This file type is not supported.');
 if(typeof input.base64!=='string'||input.base64.length>27962028||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw Error('Invalid file.');
 const bytes=Uint8Array.from(atob(input.base64),c=>c.charCodeAt(0));
 if(!bytes.length||bytes.length>20971520)throw Error('Choose a file between 1 byte and 20 MB.');
 if(type==='pictures'){const starts=a=>a.every((v,i)=>bytes[i]===v);const valid=extension==='.png'?starts([137,80,78,71,13,10,26,10]):extension==='.webp'?starts([82,73,70,70])&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':starts([255,216,255]);if(!valid)throw Error('Choose a valid JPG, PNG or WebP picture.');}
 return {extension,mime:mime[extension],bytes};
}
