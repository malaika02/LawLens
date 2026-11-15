'use strict';
const $ = s => document.querySelector(s);
const e = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
const num = v => v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-PK',{maximumFractionDigits:1});
const short = v => Number(v) >= 1000000 ? (v/1000000).toFixed(1)+'m' : Number(v) >= 10000 ? (v/1000).toFixed(1)+'k' : num(v);
const pct = n => (n*100).toFixed(1)+'%';
const fmt = v => !v || isNaN(Date.parse(v)) ? 'Unknown' : new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Karachi'}).format(new Date(v));
const time = v => !v ? '—' : new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Karachi'}).format(new Date(v))+' PKT';
const paths={overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',posts:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 10v10"/>',audience:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/>',signals:'<path d="M2 12h5l3-7 4 14 3-7h5"/>',actions:'<path d="m13 3-9 11h7l-1 7 10-12h-8z"/>',sources:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',down:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',refresh:'<path d="M20 7a8 8 0 1 0 0 10M20 3v5h-5"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>',chat:'<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 0 1 7-13h2a8 8 0 0 1 8 8Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',ext:'<path d="M14 3h7v7m0-7L10 14m0-9H5v14h14v-5"/>',spark:'<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"/>'};
const ico = k => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+(paths[k]||'')+'</svg>';
const config={overview:['Overview','Campaign overview','Social performance across Pakistani fashion brands.'],posts:['Content explorer','Content explorer','Compare formats and inspect the source behind each post.'],audience:['Audience segments','Audience segments','Explore recurring language, shopper needs and the comments behind each group.'],signals:['Unusual patterns','Unusual patterns','Investigate posts that differ from comparable content.'],actions:['Recommendations','Campaign actions','Prioritise content tests and customer replies using the evidence in this selection.'],sources:['Data & sources','Data & sources','Check coverage, refresh public feeds, or bring in an authorised brand export.']};
const colors=['#346a53','#bb7059','#8c9a49','#587e9a','#8779a4'];
const swatch = b => colors[({'Gul Ahmed':0,Khaadi:1,Sapphire:2,'Mehr Loom':0,'Neel Courtyard':1,'Aab Studio':2})[b]??3];
const postCols=[...LawnCsv.fields.posts,'days_since_post'];
const comCols=LawnCsv.fields.comments;
const metrics=['views','likes','comments_count','shares'];
const metricName={views:'Views',likes:'Likes',comments_count:'Reported comments',shares:'Shares'};
const dbNames={observed:'Brand observations',demo:'Classroom simulation',imported:'My imported data'};
let modeRequest=0;
let mode='observed',view='overview',all={posts:[],comments:[]},ps=[],cs=[],A=null,seed=null,demo=null,imported={posts:[],comments:[]};
let filters={},metric='views',sort='recent',search='',page=0,commentPage=0,clusterFilter='',topicFilter='',analysisId=0,loading=true,worker;
let live={streams:[],posts:[],comments:[],checked_at:null},syncing=false,timer,noticeTimer,cancelWorker;
const indexed = new Promise(resolve=>{
  try{const r=indexedDB.open('lawnlens-research-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);}catch{resolve(null);}
});
async function readCache(key){const db=await indexed;if(!db)return null;return new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});}
async function saveCache(key,value){const db=await indexed;if(!db)throw Error('Browser storage is unavailable. Download an export to keep this session.');return new Promise((res,rej)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=res;tx.onerror=()=>rej(Error('Browser could not save the data. Download an export to keep this session.'));});}
function toast(message){$('#toast').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#toast').textContent='',6000);}
function safeURL(s){try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
const aLink=(url,label)=>safeURL(url)?'<a class="links" target="_blank" rel="noopener noreferrer" href="'+e(safeURL(url))+'">'+e(label)+' ↗</a>':'';
const tag=v=>'<span class="tag">'+e(v)+'</span>';
const btag=v=>'<span class="brandtag" style="--swatch:'+swatch(v)+'">'+e(v)+'</span>';
const button=(label,action,id='')=>'<button class="textbtn" data-do="'+action+'" data-id="'+e(id)+'">'+e(label)+' '+ico('arrow')+'</button>';
const empty=t=>'<div class="empty">'+e(t)+'</div>';
const panel=(title,caption,body,aside='')=>'<section class="panel"><div class="panelhead"><div><h2>'+e(title)+'</h2>'+(caption?'<p>'+e(caption)+'</p>':'')+'</div>'+aside+'</div>'+body+'</section>';
const dbutton=p=>'<button class="rowlink" data-do="post" data-id="'+e(p.post_id)+'">'+e(p.title||p.campaign||p.post_id)+'</button>';
const selectOptions=(values,current)=>values.map(x=>{const [val,txt]=Array.isArray(x)?x:[x,x];return '<option value="'+e(val)+'" '+(val===current?'selected':'')+'>'+e(txt)+'</option>';}).join('');
function showDialog(title,html){$('#dtitle').textContent=title;$('#dbody').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();}
function setStatus(){const issues=live.streams.filter(s=>!s.success).length;let text=mode==='demo'?'Simulated data':mode==='imported'?'Imported data':syncing?'Checking sources…':!live.checked_at?'Saved snapshot':issues===live.streams.length&&issues?'Sources unavailable':issues?'Partial refresh':'Sources checked';$('#status').textContent=text;$('#status').classList.toggle('issue',!!issues&&mode==='observed');$('#refresh').disabled=syncing;$('#refresh').title='Refresh public sources';}
async function getJSON(url){const r=await fetch(url);if(!r.ok)throw Error('Request failed (HTTP '+r.status+').');return r.json();}
function iso(v){return Date.parse(v)||0;}
function buildObserved(){
 const byId=new Map(seed.posts.map(p=>[p.post_id,p]));
 for(const p of live.posts||[]){
  const previous=byId.get(p.post_id);
  if(previous && p.source===previous.source && iso(p.observed_at)<iso(previous.observed_at)) continue;
  const next={...p};
  if(previous&&previous.title===p.title&&previous.source==='YouTube public feed'){
    next.campaign=previous.campaign||p.campaign; next.product_category=previous.product_category||p.product_category;
  }
  byId.set(p.post_id,next);
 }
 return {posts:[...byId.values()],comments:[...new Map([...seed.comments,...(live.comments||[])].map(c=>[c.comment_id,c])).values()]};
}
async function refresh(explicit){
 if(syncing)return;syncing=true;setStatus();
 try{
  const data=await getJSON('/api/live');
  if(!Array.isArray(data.streams)||!Array.isArray(data.posts))throw Error('The source response was incomplete.');
  // Keep the last complete window for a source that failed. Replace successful owner-account samples.
  const now=Date.now(), ttl=30*864e5;
  const successfulOwner=new Set((data.completed_streams||[]).map(s=>s.source+'|'+s.brand));
  const prior=(live.posts||[]).filter(p=>now-iso(p.observed_at)<ttl && !successfulOwner.has(p.source+'|'+p.brand) && (p.source!=='Instagram Graph API'||(data.owner?.brands||[]).includes(p.brand)));
  const byId=new Map(prior.map(p=>[p.post_id,p]));
  for(const p of data.posts){
    const old=byId.get(p.post_id);
    if(old?.source==='Instagram Graph API'&&p.source==='Gul Ahmed storefront')continue;
    if(!old || old.source!==p.source || iso(p.observed_at)>=iso(old.observed_at))byId.set(p.post_id,p);
  }
  const oldIds=new Set(prior.map(p=>p.post_id));
  const comments=[...(live.comments||[]).filter(c=>oldIds.has(c.post_id)&&now-iso(c.observed_at)<ttl),...(data.comments||[])];
  live={...data,posts:[...byId.values()],comments:[...new Map(comments.map(c=>[c.comment_id,c])).values()]};
  try{await saveCache('live',live);}catch(err){if(explicit)toast(err.message);}
  if(mode==='observed'){all=buildObserved();await runAnalysis();}
  if(explicit)toast(data.streams.filter(s=>s.success).length+' of '+data.streams.length+' sources checked. See Data & sources for details.');
 }catch(err){live={...live,streams:[{label:'Refresh service',success:false,note:err.message}],checked_at:new Date().toISOString()};if(explicit)toast('Refresh failed. Your previous observations are still available.');}
 finally{syncing=false;setStatus();if(view==='sources'&&A)render();}
}
function renderFilters(){
 const defs=[['brand','Brand','All brands'],['platform','Platform','All platforms'],['product_category','Category','All categories'],['campaign','Campaign','All campaigns']];
 $('#filters').innerHTML='<label class="filterlabel">Dataset<select id="mode">'+selectOptions(Object.entries(dbNames),mode)+'</select></label>'+defs.map(([k,label,any])=>{
 const vals=[...new Set(all.posts.map(p=>p[k]||'Unspecified'))].sort();return '<label class="filterlabel">'+label+'<select data-filter="'+k+'">'+selectOptions([['',any],...vals],filters[k]||'')+'</select></label>';
 }).join('')+(Object.values(filters).some(Boolean)?'<button class="smallbtn" data-do="reset">Reset filters</button>':'');
}
async function runAnalysis(){
 const id=++analysisId;loading=true;$('#export').disabled=true;renderFilters();page=0;commentPage=0;topicFilter='';clusterFilter='';
 const posts=all.posts.filter(p=>Object.entries(filters).every(([k,v])=>!v||(p[k]||'Unspecified')===v));
 const ids=new Set(posts.map(p=>p.post_id)), comments=all.comments.filter(c=>ids.has(c.post_id));
 if(!A)$('#content').innerHTML='<p class="loading">Analysing posts and linked comments…</p>';
 if(cancelWorker)cancelWorker();
 return new Promise(resolve=>{
  const w=new Worker('/analysis-worker.js');worker=w;cancelWorker=()=>{w.terminate();resolve();};
  w.onmessage=({data})=>{if(id===analysisId){if(data.error){$('#content').innerHTML=empty('Analysis failed. Reload the workspace to try again.');}else{A=data.result;ps=posts;cs=comments;loading=false;$('#export').disabled=false;render();}}w.terminate();resolve();};
  w.onerror=()=>{if(id===analysisId){loading=false;$('#content').innerHTML=empty('The analysis worker could not start. Reload to retry.');}resolve();};
  w.postMessage({posts,comments});
 });
}
async function setMode(next){
 if(!Object.hasOwn(dbNames,next))return;
 const token=++modeRequest;mode=next;filters={};search='';page=0;setStatus();
 try{if(mode==='demo'&&!demo)demo=await getJSON('/api/demo');if(token!==modeRequest)return;all=mode==='demo'?demo:mode==='imported'?imported:buildObserved();A=null;await runAnalysis();}
 catch(err){$('#content').innerHTML=empty(err.message);}
}
function goto(name){
 view=Object.hasOwn(config,name)?name:'overview';
 $('#title').textContent=config[view][1];$('#subtitle').textContent=config[view][2];$('#breadcrumb').textContent=config[view][0];
 $('#nav').innerHTML=Object.entries(config).map(([id,[label]])=>'<a href="#'+id+'" '+(id===view?'aria-current="page"':'')+'>'+ico(id)+label+'</a>').join('');
 if(A)render();
}
function stat(title,value,foot,icon){return '<article class="stat"><h3>'+e(title)+ico(icon)+'</h3><b>'+e(value)+'</b><small>'+e(foot)+'</small></article>';}
function bars(items, brandColors=false){
 const max=Math.max(1,...items.map(x=>x[1]));return items.map(([title,v,display])=>'<div class="barrow"><span>'+e(title)+'</span><div class="track"><i style="'+(brandColors?'background:'+swatch(title)+';':'')+'width:'+Math.max(0,100*v/max)+'%"></i></div><b>'+e(display??num(v))+'</b></div>').join('');
}
function plotted(posts){
 // Six adjacent seven-day bins ending at the most recent included publication date.
 const dates=posts.filter(p=>p.published_at&&iso(p.published_at)>0);if(!dates.length)return empty('A publication date is needed to plot activity.');
 const day=864e5,end=Math.floor(dates.reduce((latest,p)=>Math.max(latest,iso(p.published_at)),0)/day)*day+day,start=end-42*day;
 const brands=[...new Set(dates.map(p=>p.brand))].sort(), bins=new Map(brands.map(b=>[b,[0,0,0,0,0,0]]));
 let used=0;for(const p of dates){const i=Math.floor((iso(p.published_at)-start)/(7*day));if(i>=0&&i<6){bins.get(p.brand)[i]++;used++;}}
 const maximum=Math.max(2,...[...bins.values()].flat()),top=Math.ceil(maximum/2)*2;
 let svg='<svg class="chart" viewBox="0 0 400 130" role="img" aria-label="Posts published by week; weekly counts available in the table below.">';
 const x=i=>32+i*71,y=v=>96-v/top*77;
 for(const n of [0,top/2,top])svg+='<line x1="32" x2="387" y1="'+y(n)+'" y2="'+y(n)+'" stroke="#dce1d9" stroke-dasharray="3 4"/><text x="23" y="'+(y(n)+3)+'" text-anchor="end">'+n+'</text>';
 const labels=Array.from({length:6},(_,i)=>new Date(start+i*7*day).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}));
 labels.forEach((l,i)=>svg+='<text x="'+x(i)+'" y="117" text-anchor="middle">'+e(l)+'</text>');
 for(const [b,values] of bins){const pts=values.map((v,i)=>x(i)+','+y(v)).join(' ');svg+='<polyline points="'+pts+'" fill="none" stroke="'+swatch(b)+'" stroke-width="2.5"/>'+values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="'+swatch(b)+'"><title>'+e(b+' · '+labels[i]+' · '+v+' posts')+'</title></circle>').join('');}
 svg+='</svg><div class="legend">'+brands.map(b=>'<span><i style="background:'+swatch(b)+'"></i>'+e(b)+'</span>').join('')+'</div>';
 return svg+'<details class="small" style="margin-top:10px"><summary>Weekly counts · '+num(used)+' posts</summary><div class="scroller"><table><thead><tr><th>Brand</th>'+labels.map(l=>'<th>'+e(l)+'</th>').join('')+'</tr></thead><tbody>'+[...bins].map(([b,v])=>'<tr><td>'+e(b)+'</td>'+v.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
}
function postTable(posts){
 if(!posts.length)return empty('No posts match this selection.');
 return '<div class="scroller"><table class="tablewide"><thead><tr><th>Post</th><th>Brand</th><th>Format</th><th>Published</th><th>Views</th><th>Likes</th></tr></thead><tbody>'+posts.map(p=>'<tr><td>'+dbutton(p)+'</td><td>'+btag(p.brand)+'</td><td>'+e(p.content_type||'Unspecified')+'</td><td>'+e(fmt(p.published_at))+'</td><td class="num">'+num(p.views)+'</td><td class="num">'+num(p.likes)+'</td></tr>').join('')+'</tbody></table></div>';
}
function overview(){
 const s=A.summary,sorted=[...ps].sort((a,b)=>iso(b.published_at)-iso(a.published_at)),p=sorted[0];
 const focus=p?'<div class="focus"><div class="focusbody"><div class="eyebrow">'+ico('spark')+' '+(mode==='demo'?'Classroom campaign':'Latest post in selection')+'</div><h2>'+e(p.campaign&&p.campaign!=='Unspecified'?p.brand+' · '+p.campaign:(p.title||p.brand))+'</h2><p>'+e([p.platform,p.content_type,fmt(p.published_at),p.views!=null&&p.views!==''?num(p.views)+' observed views':null].filter(Boolean).join('  ·  '))+'</p><button class="textbtn" style="color:#d8eaa5" data-do="post" data-id="'+e(p.post_id)+'">Inspect post '+ico('arrow')+'</button></div><div class="fabric" aria-hidden="true"></div></div>':'';
 const groups=Object.entries(ps.reduce((o,p)=>(o[p.brand]=(o[p.brand]||0)+1,o),Object.create(null))).sort((a,b)=>b[1]-a[1]); 
 return focus+'<div class="cards4">'+stat('Posts in scope',num(s.posts),s.brands+' brands in selection','posts')+stat('Reported views',short(s.views),num(s.views_n)+' posts with a count','eye')+stat('Collected comments',num(s.comments),'Text available for analysis','chat')+stat('Audience clusters',num(A.clusters.length),num(s.clustered_comments)+' grouped comments','audience')+'</div><div class="pair">'+panel('Publishing activity','Weekly post counts through the latest dated post.',plotted(ps))+panel('Brand coverage','Number of posts in the selected dataset.',groups.length?bars(groups,true)+button('Explore content','go','posts'):empty('No brand observations in this selection.'))+'</div>'+panel('Recent posts','Open a record to inspect its metrics, capture date and original source.',postTable(sorted.slice(0,5)),button('View all','go','posts'));
}
function comparison(){
 const col=metric==='comments_count'?'comments':metric;
 const rows=[...A.content].sort((a,b)=>a.platform.localeCompare(b.platform)||(b['median_'+col]??-1)-(a['median_'+col]??-1));
 const body=rows.length?'<div class="scroller"><table><thead><tr><th>Platform</th><th>Content format</th><th>Posts</th><th>With metric</th><th>Median '+e(metricName[metric].toLowerCase())+'</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+e(r.platform)+'</td><td>'+e(r.content_type)+'</td><td>'+num(r.posts)+'</td><td>'+num(r[col+'_n'])+'</td><td><strong>'+num(r['median_'+col])+'</strong></td></tr>').join('')+'</tbody></table></div>':empty('There are no comparable records.');
 return panel('Content performance','Medians use only posts reporting the selected metric. Compare formats within a platform.',body,'<label class="small">Metric <select id="metric">'+selectOptions(metrics.map(k=>[k,metricName[k]]),metric)+'</select></label>');
}
function explorer(){
 const q=search.trim().toLowerCase();let rows=ps.filter(p=>!q||[p.post_id,p.title,p.campaign,p.brand,p.content_type].some(x=>String(x||'').toLowerCase().includes(q)));
 rows.sort(sort==='recent'?(a,b)=>iso(b.published_at)-iso(a.published_at):(a,b)=>(b[sort]??-1)-(a[sort]??-1));
 const pageSize=15;page=Math.min(page,Math.max(0,Math.ceil(rows.length/pageSize)-1));
 return comparison()+panel('Post library',num(rows.length)+' records. A dash marks an unavailable measurement.',
 '<div class="inline"><input id="search" class="field" type="search" value="'+e(search)+'" placeholder="Search posts or campaigns" aria-label="Search posts or campaigns"><label class="small">Sort <select id="sort">'+selectOptions([['recent','Latest published'],['views','Most views'],['likes','Most likes'],['comments_count','Most comments']],sort)+'</select></label></div>'+postTable(rows.slice(page*pageSize,(page+1)*pageSize))+pager('p',page,rows.length,pageSize));
}
function pager(prefix,index,count,size){
 return '<div class="pages"><button class="btn" data-do="'+prefix+'prev" '+(index===0?'disabled':'')+'>Previous</button><span>Page '+(index+1)+' of '+Math.max(1,Math.ceil(count/size))+'</span><button class="btn" data-do="'+prefix+'next" '+((index+1)*size>=count?'disabled':'')+'>Next</button></div>';
}
function audience(){
 let crows=cs.filter(c=>(!clusterFilter||A.annotations[c.comment_id]?.cluster_id===clusterFilter)&&(!topicFilter||A.annotations[c.comment_id]?.topics?.includes(topicFilter)||A.annotations[c.comment_id]?.topic===topicFilter));
 const cm=A.method, clusters=A.clusters.map(c=>'<article class="cluster"><span class="eyebrow">'+e(c.basis||'Comment group')+'</span><h3>'+e(c.label)+'</h3><p>'+num(c.count)+' comments · '+pct(c.share)+' of sample</p><div class="tiles">'+c.terms.slice(0,4).map(tag).join('')+'</div>'+c.examples.slice(0,1).map(x=>'<blockquote dir="auto">'+e(x.text)+'</blockquote>').join('')+button('View group comments','cluster',c.id)+'</article>').join('');
 const related= new Set(cs.map(c=>c.post_id));
 const coverage= mode==='observed' && cs.length && cs.every(c=>/screenshot/i.test(c.source))? 'These are historical excerpts from '+related.size+' archived threads. They support thread-level interpretation only.' : 'One record represents one comment. A person may have written more than one.';
 return '<div class="notice">'+e(coverage)+'</div><div class="pair">'+panel('Audience needs','A comment can contain several topic cues.',A.topics.length?bars(A.topics.slice(0,9).map(t=>[t.topic,t.count,num(t.count)+' · '+pct(t.share)])):empty('Import authorised comment text or connect an owner account to identify needs.'))+panel('Clustering evidence',cm.cluster_status,'<dl class="detailslist"><dt>Comment texts</dt><dd>'+num(cs.length)+'</dd><dt>Distinct normalised texts</dt><dd>'+num(cm.distinct_texts)+'</dd><dt>Post threads</dt><dd>'+related.size+'</dd><dt>Grouped</dt><dd>'+num(A.summary.clustered_comments)+'</dd></dl><p class="small">'+e(cm.cluster_method)+'</p>')+'</div>'+(clusters?'<div class="cardgrid">'+clusters+'</div>':'')+
 panel('Comment evidence','Topic, language, sentiment and purchase intent are machine-assigned cues. Inspect the wording before acting.',
 '<div class="inline"><label class="small">Group <select id="clusterFilter">'+selectOptions([['','All groups'],...A.clusters.map(c=>[c.id,c.label])],clusterFilter)+'</select></label><label class="small">Topic <select id="topicFilter">'+selectOptions([['','All topics'],...A.topics.map(t=>[t.topic,t.topic])],topicFilter)+'</select></label></div>'+
 (crows.length?'<div class="scroller"><table class="tablewide"><thead><tr><th>Comment / evidence</th><th>Topic</th><th>Language</th><th>Sentiment</th><th>Purchase intent</th></tr></thead><tbody>'+crows.slice(commentPage*12,(commentPage+1)*12).map(c=>{const x=A.annotations[c.comment_id];return '<tr><td><button class="rowlink" data-do="comment" data-id="'+e(c.comment_id)+'" dir="auto">'+e(c.comment_text)+'</button></td><td>'+e(x.topics?.join(', ')||x.topic)+'</td><td>'+e(x.language)+'</td><td>'+e(x.sentiment)+'</td><td>'+e(x.purchase_intent)+'</td></tr>';}).join('')+'</tbody></table></div>'+pager('c',commentPage,crows.length,12):empty('No comment texts match the selection.')));
}
function signals(){return '<div class="cards4">'+stat('Flagged posts',num(A.summary.flagged_posts),'Distinct posts to investigate','signals')+stat('Eligible posts',num(A.method.eligible_posts),'With sufficient peers','posts')+stat('Signals',num(A.anomalies.length),'Metric-level deviations','eye')+stat('Minimum peers','5','Other comparable posts','audience')+'</div>'+panel('Investigation queue','Each signal includes the comparison used to flag it.',A.anomalies.length?'<div class="scroller"><table class="tablewide"><thead><tr><th>Post / metric</th><th>Evidence</th><th>Peer window</th></tr></thead><tbody>'+A.anomalies.map(a=>'<tr><td>'+dbutton(a)+'<br>'+tag(a.direction+' · '+a.metric)+'</td><td>'+e(a.reason)+'</td><td>'+e(a.age_band)+'</td></tr>').join('')+'</tbody></table></div>':empty(A.method.eligible_posts?'No eligible post crossed the investigation threshold.':'This selection has too few dated, measured peer posts to score.'))+panel('How flags are calculated','', '<p>'+e(A.method.anomaly_method)+'</p><p class="small">Paid promotion, publication timing and changes in platform visibility can affect counts. Review the original post before deciding on a cause.</p>');}
function actions(){return (mode==='observed'&&cs.length&&cs.every(c=>/screenshot/i.test(c.source))?'<p class="notice">Comment-based actions draw on archived threads. Check recent owner-authorised comments before applying them to a current campaign.</p>':'')+(A.recommendations.length?'<div class="cardgrid">'+A.recommendations.map((a,i)=>'<article class="actioncard"><span class="eyebrow">'+e(a.category)+'</span><h3>'+e(a.title)+'</h3><p>'+e(a.action)+'</p><p class="evidence">'+e(a.evidence)+'</p>'+button('Inspect evidence','rec',i)+'</article>').join('')+'</div>':empty('Select or import posts to generate evidence-backed actions.'));}
function sources(){
 const bySource=Object.entries(all.posts.reduce((a,p)=>(a[p.source]=(a[p.source]||0)+1,a),Object.create(null))).sort((a,b)=>b[1]-a[1]);
 const report=live.streams.length?live.streams.map(s=>'<div class="checkrow"><span>'+e(s.label)+'</span><span title="'+e(s.note)+'">'+(s.success?num(s.records)+' posts':e(s.note))+'</span></div>').join(''):'<p class="small">Public sources have not been checked in this browser session.</p>';
 return '<div class="pair">'+panel('Source monitor','Four public sources refresh every 15 minutes while the workspace is open.', '<div class="checks">'+report+'</div><p class="info">Last check: '+e(time(live.checked_at))+'. The provider may cache its response. A failed source retains its last available observations.</p><button class="btn" data-do="refresh" '+(syncing?'disabled':'')+'>'+ico('refresh')+' Check public sources</button>')+
 panel('Dataset coverage',dbNames[mode],'<div class="progress"><strong>'+num(all.posts.length)+' post records</strong><div class="meter"><i style="width:'+Math.min(100,all.posts.length/2000*100)+'%"></i></div><small>Project demonstration target · 2,000–5,000 posts</small></div><p class="small">'+num(all.comments.length)+' comment texts. The original classroom corpus is in its own simulated workspace. TikTok and Facebook support owner exports. The included collector supports larger authorised histories.</p><div class="tiles"><a class="links" href="/docs/sources.md" target="_blank" rel="noopener">Source notes ↗</a><a class="links" href="/docs/METHODS.md" target="_blank" rel="noopener">Methods ↗</a><a class="links" href="/docs/CONNECTORS.md" target="_blank" rel="noopener">Connection guide ↗</a></div>')+'</div>'+
 panel('Import brand records','Choose one or both UTF-8 CSV files. Valid rows merge by ID into My imported data on this browser.',
 '<div class="twoforms"><label class="filelab">Posts CSV<input id="postsFile" class="file" type="file" accept=".csv,text/csv"></label><label class="filelab">Comments CSV<input id="commentsFile" class="file" type="file" accept=".csv,text/csv"></label></div><div class="inline"><button class="btn" data-do="import">Import & analyse</button><button class="textbtn" data-do="templateposts">Posts template ↓</button><button class="textbtn" data-do="templatecomments">Comments template ↓</button></div><p id="importMessage" role="status" class="info">Every comment needs a matching post ID. Upload data you are authorised to process.</p>')+
 '<div class="pair">'+panel('Provenance in this workspace','Sources represented in the chosen dataset.',bySource.length?bars(bySource):empty('Import a file to see its sources.'))+
 panel('How to read the data','', '<p>Reported comment totals count platform activity. Collected comments are the texts available to the clustering engine. Source records keep both numbers independent.</p><p>Archive consultation dates and historical capture dates can differ. Keywords, clusters and anomaly flags are estimates. Original posts and excerpts are linked in Content explorer.</p><p class="info">The overview textile is a public-domain palampore fragment from Cooper Hewitt, Smithsonian Design Museum. '+aLink('https://www.si.edu/object/textile:chndm_1973-51-37','Image credit')+'</p>')+'</div>';
}
function render(){
 if(!A)return;$('#content').innerHTML=({overview,posts:explorer,audience,signals,actions,sources})[view]();
}
function postDetail(id){
 const p=all.posts.find(p=>p.post_id===id);if(!p)return;
 const linked=all.comments.filter(c=>c.post_id===p.post_id);
 const fields=[['Platform',p.platform],['Format',p.content_type],['Category',p.product_category],['Campaign',p.campaign],['Published',p.published_at],['Source consulted',p.observed_at],['Metric capture',p.metric_as_of||'Not supplied'],['Source',p.source],['Views',num(p.views)],['Likes',num(p.likes)],['Reported comments',num(p.comments_count)],['Collected texts',num(linked.length)],['Shares',num(p.shares)],['Record ID',p.post_id]];
 showDialog(p.title||p.campaign||p.post_id,'<div class="tiles">'+btag(p.brand)+tag(dbNames[mode])+'</div><dl class="detailslist">'+fields.map(([k,v])=>'<dt>'+e(k)+'</dt><dd>'+e(v||'Unknown')+'</dd>').join('')+'</dl>'+(p.metric_notes?'<p class="evidence">'+e(p.metric_notes)+'</p>':'')+(/archive|screenshot/i.test(p.source)?'<p class="notice warn">Historical record. The source consultation date may be later than the original counter capture. Interpret this measurement in its original context.</p>':'')+'<p>'+aLink(p.source_url,'Open source evidence')+(p.evidence_url&&p.evidence_url!==p.source_url?' · '+aLink(p.evidence_url,'Measurement evidence'):'')+'</p><p class="info">'+e(p.permission)+'</p>'+(linked.length?'<hr class="separator"><h3>Comment evidence</h3>'+linked.slice(0,8).map(c=>'<blockquote dir="auto">'+e(c.comment_text)+'<br>'+button('Inspect text','comment',c.comment_id)+'</blockquote>').join(''):''));
}
function commentDetail(id){
 const c=all.comments.find(c=>c.comment_id===id);if(!c)return;const a=A.annotations[id]||{};
 showDialog('Comment evidence','<blockquote dir="auto">'+e(c.comment_text)+'</blockquote><dl class="detailslist">'+Object.entries({'Topic':a.topics?.join(', ')||a.topic,'Language':a.language,'Sentiment':a.sentiment,'Purchase intent':a.purchase_intent,'Source':c.source,'Consulted':c.observed_at,'Permission':c.permission}).map(([k,v])=>'<dt>'+e(k)+'</dt><dd>'+e(v||'Unknown')+'</dd>').join('')+'</dl><p>'+aLink(c.source_url,'Open source evidence')+'</p>'+button('Inspect parent post','post',c.post_id));
}
function recommendationDetail(i){
 const r=A.recommendations[i];if(!r)return;
 showDialog(r.title,'<p>'+e(r.action)+'</p><p class="evidence">'+e(r.evidence)+'</p><h3>Linked evidence</h3><div class="stack">'+r.comment_ids.map(id=>{const c=all.comments.find(x=>x.comment_id===id);return c?'<button class="btn" data-do="comment" data-id="'+e(id)+'" dir="auto">'+e(c.comment_text)+'</button>':'';}).join('')+r.post_ids.map(id=>{const p=all.posts.find(x=>x.post_id===id);return p?'<button class="btn" data-do="post" data-id="'+e(id)+'">'+e(p.title||p.post_id)+'</button>':'';}).join('')+'</div>');
}
function download(filename,body,mime='text/csv;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([body],{type:mime})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportDialog(){
 showDialog('Export selection','<p>'+e(dbNames[mode])+' · '+num(ps.length)+' posts · '+num(cs.length)+' collected comments. Active filters apply.</p><div class="stack"><button class="btn" data-do="csvposts">'+ico('down')+' Post records (CSV)</button><button class="btn" data-do="csvcomments">'+ico('down')+' Comment records (CSV)</button><button class="btn" data-do="csvlabels">'+ico('down')+' Comment annotations (CSV)</button><button class="btn" data-do="json">'+ico('down')+' Analysis results (JSON)</button></div>');
}
async function importPair(){
 const pf=$('#postsFile').files[0],cf=$('#commentsFile').files[0],msg=$('#importMessage');
 if(!pf&&!cf){msg.textContent='Choose a posts or comments CSV first.';return;}
 try{
  if((pf?.size||0)+(cf?.size||0)>32*1024*1024)throw Error('Choose CSVs smaller than 32 MB in total.');
  const [incomingP,incomingC]=await Promise.all([pf?pf.text().then(t=>LawnCsv.parse(t,'posts')):[],cf?cf.text().then(t=>LawnCsv.parse(t,'comments')):[]]);
  if(!incomingP.length&&!incomingC.length)throw Error('The selected CSVs contain no data rows.');
  const pp=new Map(imported.posts.map(p=>[p.post_id,p])),cc=new Map(imported.comments.map(c=>[c.comment_id,c]));
  for(const p of incomingP){const old=pp.get(p.post_id);if(old&&(old.brand!==p.brand||old.platform!==p.platform))throw Error('Post '+p.post_id+' already belongs to another brand or platform.');if(!old||iso(p.observed_at)>=iso(old.observed_at))pp.set(p.post_id,p);}
  for(const c of incomingC){if(!pp.has(c.post_id))throw Error('Missing parent post '+c.post_id+'. Include its post CSV with this import.');
    const old=cc.get(c.comment_id);if(old&&old.post_id!==c.post_id)throw Error('Comment '+c.comment_id+' already belongs to a different post.');if(!old||iso(c.observed_at)>=iso(old.observed_at))cc.set(c.comment_id,c);}
  const next={posts:[...pp.values()],comments:[...cc.values()]};
  await saveCache('import',next);imported=next;await setMode('imported');toast('Imported workspace saved · '+num(imported.posts.length)+' posts and '+num(imported.comments.length)+' comments.');
 }catch(err){msg.textContent=err.message;msg.style.color='#94452f';}
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-do]');if(!b)return;const key=b.dataset.do,id=b.dataset.id;
 if(key==='go'){location.hash=id;return;}
 if(key==='post')return postDetail(id);if(key==='comment')return commentDetail(id);if(key==='rec')return recommendationDetail(id);
 if(key==='refresh')return refresh(true);if(key==='reset'){filters={};return runAnalysis();}
 if(key==='cluster'){clusterFilter=id;commentPage=0;render();$('#clusterFilter').scrollIntoView({block:'center'});return;}
 if(['pprev','pnext','cprev','cnext'].includes(key)){const sign=key.endsWith('next')?1:-1;if(key[0]==='p')page+=sign;else commentPage+=sign;render();return;}
 if(key==='import')return importPair();
 if(key==='templateposts'||key==='templatecomments'){const kind=key.slice(8);download(kind+'_template.csv',LawnCsv.encode([],kind==='posts'?postCols:comCols));return;}
 if(key.startsWith('csv')){const annotated=key==='csvlabels', cols=annotated?[...comCols,'topic','language','sentiment','purchase_intent','cluster_id']:key==='csvposts'?postCols:comCols;
  const rows=key==='csvposts'?ps:annotated?cs.map(c=>({...c,...A.annotations[c.comment_id]})):cs;
  download('LawnLens_'+mode+'_'+key.slice(3)+'.csv',LawnCsv.encode(rows,cols));return;}
 if(key==='json'){const {annotations,...analysis}=A;download('LawnLens_'+mode+'_analysis.json',JSON.stringify({dataset:dbNames[mode],filters,exported_at:new Date().toISOString(),...analysis},null,2),'application/json');}
});
document.addEventListener('change',ev=>{const el=ev.target;if(el.id==='mode')return setMode(el.value);if(el.dataset.filter){filters[el.dataset.filter]=el.value;return runAnalysis();}
 if(el.id==='sort')sort=el.value;else if(el.id==='metric')metric=el.value;else if(el.id==='clusterFilter'){clusterFilter=el.value;commentPage=0;}else if(el.id==='topicFilter'){topicFilter=el.value;commentPage=0;}else return;render();});
document.addEventListener('input',ev=>{if(ev.target.id==='search'){search=ev.target.value;page=0;render();const field=$('#search');field.focus();field.setSelectionRange(search.length,search.length);}});
$('#close').onclick=()=>$('#dialog').close();$('#dialog').addEventListener('click',ev=>{if(ev.target===$('#dialog')&&ev.clientX>0){const r=ev.target.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)ev.target.close();}});
$('#refresh').innerHTML=ico('refresh');$('#refresh').onclick=()=>refresh(true);$('#export').innerHTML=ico('down')+'Export data';$('#export').onclick=()=>A&&exportDialog();
window.addEventListener('hashchange',()=>goto(location.hash.slice(1)));
async function boot(){
 goto(location.hash.slice(1));try{
  const [baseline,cached,uploaded]=await Promise.all([getJSON('/api/observed'),readCache('live'),readCache('import')]);seed=baseline;if(cached)live=cached;if(uploaded)imported=uploaded;
  await setMode('observed');if(!live.checked_at||Date.now()-iso(live.checked_at)>900000)refresh(false);
  timer=setInterval(()=>{if(!document.hidden)refresh(false);},900000);
 }catch(err){$('#status').textContent='Load failed';$('#content').innerHTML=empty('The workspace could not load. '+err.message+' Reload to try again.');}
}
boot();
