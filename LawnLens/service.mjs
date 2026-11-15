// ASSETS holds immutable versioned bytes supplied at build time.
const WINDOW=15*60*1000;
let last, lastKey='', pending;
const csp="default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'self'; form-action 'none'";
async function liveResponse(env) {
 const owner=ownerStatus(env), key=owner.brands.join(',');
 if(last && lastKey===key && Date.now()-Date.parse(last.checked_at) < last.cache_ms)return last;
 if(pending && pending.key===key)return pending.task;
 const task=(async()=>{
  const [pub,auth]=await Promise.all([fetchPublic(),fetchOwner(env)]);
  const streams=[...pub.streams];
  for(const brand of owner.brands){
    const ok=auth.completed_streams.some(s=>s.brand===brand);
    streams.push({label:brand+' · Instagram owner',success:ok,records:auth.posts.filter(p=>p.brand===brand).length,
      note:ok?'Owner-authorised API':auth.warnings.find(w=>w.startsWith(brand))||'Owner connection unavailable.'});
  }
  const response={posts:[...pub.posts,...auth.posts],comments:auth.comments,completed_streams:auth.completed_streams,streams,owner,
    checked_at:new Date().toISOString(),cache_ms:streams.some(s=>!s.success)?60000:WINDOW};
  last=response;lastKey=key;return response;
 })();
 pending={task,key};try{return await task;}finally{if(pending?.task===task)pending=null;}
}
function bytes(text){
 const raw=atob(text),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
export default {async fetch(request,env={}){
 const path=new URL(request.url).pathname;
 const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':csp,'Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'};
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 if(path==='/api/live'){
  try{return Response.json(await liveResponse(env),{headers});}
  catch{return Response.json({error:'Live sources could not be refreshed.'},{status:503,headers});}
 }
 const asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404,headers});
 headers['Content-Type']=asset.type;
 let body=bytes(asset.b64);
 if(asset.compressed)body=new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'));
 return new Response(request.method==='HEAD'?null:body,{headers});
}};
