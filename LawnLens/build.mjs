import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=(f)=>fs.readFileSync(path.join(dir,f));
const assets={};
function add(route,file,type,compressed=false){assets[route]={type,compressed,b64:read(file).toString('base64')};}
add('/','web/index.html','text/html;charset=utf-8');assets['/index.html']=assets['/'];
add('/style.css','web/style.css','text/css;charset=utf-8');
for(const name of ['app','csv'])add('/'+name+'.js','web/'+name+'.js','application/javascript;charset=utf-8');
const analysis=Buffer.concat([read('web/analytics.js'),Buffer.from('\n'),read('web/worker-bridge.js')]);
assets['/analysis-worker.js']={type:'application/javascript;charset=utf-8',b64:analysis.toString('base64')};
add('/mark.svg','web/mark.svg','image/svg+xml');add('/textile.jpg','web/textile.jpg','image/jpeg');
for(const name of ['observed','demo'])add('/api/'+name,'web/'+name+'.json.gz','application/json;charset=utf-8',true);
add('/docs/sources.md','data/sources.md','text/plain;charset=utf-8');
add('/docs/CONNECTORS.md','CONNECTORS.md','text/plain;charset=utf-8');
add('/docs/METHODS.md','docs/METHODS.md','text/plain;charset=utf-8');
const bundle=(file,exports)=>'(()=>{\n'+read(file).toString().replaceAll(/^export /gm,'')+'\nreturn {'+exports+'};\n})()';
const js='const ASSETS='+JSON.stringify(assets)+';\nconst {fetchPublic}='+bundle('public.mjs','fetchPublic')+';\nconst {fetchOwner,ownerStatus}='+bundle('owner.mjs','fetchOwner,ownerStatus')+';\n'+read('service.mjs');
fs.mkdirSync(path.join(dir,'dist','server'),{recursive:true});fs.writeFileSync(path.join(dir,'dist/server/index.js'),js);
const manifest=path.join(dir,'.openai/hosting.json');if(fs.existsSync(manifest)){fs.mkdirSync(path.join(dir,'dist/.openai'),{recursive:true});fs.copyFileSync(manifest,path.join(dir,'dist/.openai/hosting.json'));}
console.log('Built LawnLens ('+Math.round(Buffer.byteLength(js)/1024)+' KiB)');
