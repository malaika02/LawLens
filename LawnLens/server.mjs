import http from 'node:http';
import {Readable} from 'node:stream';
import {existsSync} from 'node:fs';
if(!existsSync(new URL('./dist/server/index.js',import.meta.url)))await import('./build.mjs');
const {default:app}=await import('./dist/server/index.js');
const args=process.argv.slice(2);
function option(flag, fallback){const idx=args.indexOf(flag);return idx<0?fallback:args[idx+1];}
const port=Number(option('--port',process.env.PORT||8080)),host=option('--host',process.env.HOST||'127.0.0.1');
http.createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost');
  const response=await app.fetch(new Request(path,{method:req.method}),process.env);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
 }catch{if(!res.headersSent)res.writeHead(500);res.end('The workspace could not complete this request.');}
}).listen(port,host,()=>console.log('LawnLens is ready at http://'+host+':'+port));
