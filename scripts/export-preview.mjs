import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const target=path.resolve(process.argv[2]||'../../outputs/Mistura-Fish-prototipo.html');
const html=await readFile('index.html','utf8'),css=await readFile('styles.css','utf8'),app=await readFile('app.js','utf8');
const validation=(await readFile('lib/validation.js','utf8')).replaceAll('export ','');
const demo=(await readFile('lib/demo.js','utf8')).replace(/^import .*;\r?\n/,'').replaceAll('export ','');
const setup=`${validation}\n${demo}\nconst demoFetch=createDemoHandler();\nwindow.fetch=async (url,options={})=>{if(typeof url==='string'&&url.startsWith('/api/'))return demoFetch(new Request('https://demo.local'+url,options));throw new Error('La vista de prueba no usa servicios externos.');};`;
await mkdir(path.dirname(target),{recursive:true});
await writeFile(target,html.replace('<link rel="stylesheet" href="/styles.css">',`<style>${css}</style>`).replace('<script src="/app.js" type="module"></script>',`<script type="module">${setup}\n${app}</script>`));
console.log('Vista autónoma exportada:',target);

