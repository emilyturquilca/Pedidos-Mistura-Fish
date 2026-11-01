import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for(const dir of ['api','lib','scripts','tests']){
  for(const file of await readdir(new URL('../'+dir+'/',import.meta.url))){
    if(/\.(js|mjs)$/.test(file))execFileSync(process.execPath,['--check',fileURLToPath(new URL('../'+dir+'/'+file,import.meta.url))],{stdio:'inherit'});
  }
}
execFileSync(process.execPath,['--check','app.js'],{stdio:'inherit'});
for (const file of ['admin.html']) {
  const html=await readFile(file,'utf8');
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) execFileSync(process.execPath,['--input-type=module','--check'],{input:match[1],stdio:['pipe','inherit','inherit']});
}
JSON.parse(await readFile('vercel.json','utf8'));console.log('JavaScript y configuración: OK');

