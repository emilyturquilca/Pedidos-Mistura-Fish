import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDemoHandler } from '../lib/demo.js';
const demo=process.argv.includes('--demo'),demoHandler=demo?createDemoHandler():null;
const root=new URL('../',import.meta.url);
const staticFiles={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/admin.html':['admin.html','text/html; charset=utf-8']};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/api/')){
      const route=url.pathname.slice(5);
      if(!['menu','customer','order','admin','config'].includes(route)){res.writeHead(404);res.end();return;}
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>16000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      let response;
      if(demo)response=await demoHandler(request);
      else{const handler=(await import(`../api/${route}.js`))[req.method];response=handler?await handler(request):Response.json({error:'Método no permitido.'},{status:405});}
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const file=staticFiles[url.pathname];if(!file){res.writeHead(404);res.end('No encontrado');return;}
    const data=await readFile(new URL(file[0],root));res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-store'});res.end(data);
  }catch(error){console.error('Local server',error.name);res.writeHead(500);res.end('Error del servidor local');}
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port} ${demo?'(demo explícita, sin servicios externos)':'(API real)'}`));

