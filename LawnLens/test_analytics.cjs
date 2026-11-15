'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
require('./web/analytics.js');

const post = (id, extras={})=>({post_id:String(id),brand:'Test brand',platform:'Instagram',content_type:'Reel',
  observed_at:'2026-04-20T08:00:00Z',published_at:'2026-04-15T07:00:00Z',provenance:'observed',...extras});
const comment = (id,pid,text)=>({comment_id:String(id),post_id:String(pid),comment_text:text});
test('missing counts, true zeros and joined comment denominators remain distinct',()=>{
  const a=analyze([post(1,{views:'0',comments_count:7}),post(2,{views:'32',shares:''}),post(3,{views:null,shares:-1,likes:'1K'})],
    [comment(1,1,'Price please?'),comment(2,99,'Missing parent')]);
  assert.equal(a.summary.views,32);
  assert.equal(a.summary.views_n,2);
  assert.equal(a.summary.likes,null);
  assert.equal(a.summary.shares,null);
  assert.equal(a.summary.comments,1);
  assert.equal(a.summary.reported_comments,7);
  assert.equal(a.content[0].median_views,16);
  assert.equal(a.annotations['2'],undefined);
});
test('heuristic annotations support mixed and Urdu-script posts with conservative intent',()=>{
  const a=analyze([post(1)],[comment(1,1,'Delivery aur price kya hai?'),comment(2,1,'قیمت اور سائز؟'),
    comment(3,1,'I don’t want to buy it.'),comment(4,1,'😞'),comment(5,1,'Is this not good?'),comment(6,1,'This is not bad.')]);
  assert.deepEqual(a.annotations['1'].topics,['Delivery','Price']);
  assert.equal(a.annotations['1'].language,'Roman Urdu candidate');
  assert.equal(a.annotations['2'].language,'Urdu-script candidate');
  assert.deepEqual(a.annotations['2'].topics,['Price','Sizing']);
  assert.equal(a.annotations['3'].purchase_intent,'Declined or negated');
  assert.equal(a.annotations['3'].topics.includes('Purchase interest'),false);
  assert.equal(a.annotations['4'].language,'Unclear');
  assert.equal(a.annotations['5'].sentiment,'Negative cue');
  assert.equal(a.annotations['6'].sentiment,'Positive cue');
  assert.equal(a.topics.find(t=>t.topic==='Price').share,2/6);
});
test('zero and sparse data return qualified evidence rather than invented segments',()=>{
  let a=analyze([],[]);
  assert.equal(a.content.length,0);
  assert.equal(a.recommendations.length,0);
  assert.equal(a.summary.views,null);
  a=analyze([post(1)],[comment(1,1,'😀'),comment(2,1,'hello')]);
  assert.equal(a.clusters.length,0);
  assert.equal(a.recommendations[0].category,'Evidence quality');
  assert.equal(a.method.eligible_posts,0);
});
test('unsupervised clusters can discover groups outside the supplied topic dictionary',()=>{
  const raw=['needle thread','needle yarn','needle thread yarn','needle thread weave',
    'orchard apples','orchard pear','orchard apples pears','orchard apples fruit','???','needle thread'];
  const rows=raw.map((text,i)=>comment(i,1,text));
  const a=analyze([post(1)],rows);
  assert.equal(a.clusters.length,2);
  assert.equal(a.annotations['0'].cluster_id,a.annotations['9'].cluster_id);
  assert.notEqual(a.annotations['0'].cluster_id,a.annotations['4'].cluster_id);
  assert.ok(a.annotations['0'].cluster_id && a.annotations['4'].cluster_id);
  assert.equal(a.annotations['8'].cluster_id,null);
  assert.equal(a.summary.clustered_comments,9);
  assert.equal(a.clusters.reduce((n,c)=>n+c.count,0),9);
  assert.ok(a.recommendations.some(r=>r.category==='Audience segment'));
  const reversed=analyze([post(1)],rows.slice().reverse());
  assert.deepEqual(a.clusters,reversed.clusters);
  for (const r of a.recommendations) for (const id of r.comment_ids) assert.ok(a.annotations[id]);
});
test('anomaly peers are leave-one-out and matched on platform, age, brand, format, and provenance',()=>{
  const rows=Array.from({length:6},(_,i)=>post(i,{likes:i===5?240:15,views:null}));
  const noise=[{platform:'TikTok'},{content_type:'Photo'},{brand:'Other'},{provenance:'simulated'},{source:'Separate reporting channel'},
    {published_at:'2025-04-01'},{published_at:'2026-02-30'},{published_at:'2026-05-01'},{published_at:null}];
  for (const [i,v] of noise.entries()) rows.push(post(10+i,{likes:40000,...v}));
  const a=analyze(rows,[]);
  assert.equal(a.method.eligible_posts,6);
  assert.equal(a.anomalies.length,1);
  assert.equal(a.anomalies[0].post_id,'5');
  assert.equal(a.anomalies[0].peers,5);
  assert.equal(a.anomalies[0].peer_median,15);
  assert.equal(a.anomalies[0].direction,'High');
  assert.equal(analyze(rows.slice(0,5),[]).anomalies.length,0);
});
test('sampled topic-share outliers require at least 8 per post and six posts',()=>{
  const posts=Array.from({length:6},(_,i)=>post(i)),comments=[];
  for(let i=0;i<48;i++) comments.push(comment(i,Math.floor(i/8),i<40?'Beautiful fabric':'Delivery tracking?'));
  const a=analyze(posts,comments), delivery=a.anomalies.find(f=>f.metric==='Delivery share');
  assert.ok(delivery);
  assert.equal(delivery.post_id,'5');
  assert.equal(delivery.value,1);
  assert.equal(delivery.unit,'fraction');
  assert.equal(delivery.peers,5);
  assert.equal(analyze(posts,comments.slice(0,-1)).method.eligible_posts,0);
});
test('content test requires comparable age and brand and links back to observed records',()=>{
  const p=Array.from({length:6},(_,i)=>post(i,{content_type:i<3?'Reel':'Photo',likes:i<3?30:10}));
  let a=analyze(p,[]), r=a.recommendations.find(x=>x.category==='Content test');
  assert.ok(r);
  assert.equal(r.post_ids.length,2);
  for(const id of r.post_ids) assert.ok(p.some(row=>row.post_id===id));
  p[0].published_at=null;
  a=analyze(p,[]);
  assert.equal(a.recommendations.some(x=>x.category==='Content test'),false);
});
test('arbitrary import identifiers and tokens are handled as data',()=>{
  const a=analyze([post('__proto__')],[comment('constructor','__proto__','constructor prototype'),comment('__proto__','__proto__','Price please?')]);
  assert.equal(a.annotations['__proto__'].topic,'Price');
  assert.equal(a.annotations['constructor'].topic,'Other / unclear');
  assert.doesNotThrow(()=>JSON.stringify(a));
});
test('sparse archive records surface independently repeated wording with explicit basis',()=>{
  const posts=[post(1)];
  const comments=['Price','Price??','Price pls','improve ur services','I need kurtis'].map((t,i)=>comment(i,1,t));
  const r=analyze(posts,comments);
  assert.equal(r.clusters[0].count,3);
  assert.equal(r.clusters[0].basis,'Repeated normalized wording');
  assert.equal(r.clusters[0].label,'Price');
  assert.match(r.method.cluster_status,/repeated normalized wording/i);
  assert.equal(r.annotations['3'].topic,'Customer service');
  assert.equal(r.annotations['4'].topic,'Purchase interest');
});
test('archive consultation dates never stand in for metric capture dates',()=>{
  const posts=Array.from({length:6},(_,i)=>post(i,{source:'Indexed YouTube archive',views:i===5?100000:3}));
  const r=analyze(posts,[]);
  assert.equal(r.method.eligible_posts,0);
  assert.equal(r.summary.views_n,6);
});
test('verified archives use exact display capture time and stay in source-specific peer cohorts',()=>{
  for(const source of ['Archived YouTube public feed','Archived Gul Ahmed storefront']) {
    const make=(i,extra={})=>post(i,{source,published_at:'2026-04-15T10:00:00Z',
      observed_at:'2026-11-15',metric_as_of:'2026-04-16T09:00:00Z',views:i===5?10000:30,...extra});
    const valid=Array.from({length:6},(_,i)=>make(i));
    const rows=[...valid,make(6,{metric_as_of:''}),make(7,{metric_as_of:'2026-04-16'}),
      make(8,{metric_as_of:'2026-04-15T09:59:00Z'}),make(9,{metric_as_of:'2026-02-30T08:00:00Z'}),
      make(10,{observed_at:'2026-04-14'}),make(11,{source:'Indexed YouTube archive'}),make(12,{source:'Live feed'})];
    const a=analyze(rows,[]),flag=a.anomalies.find(x=>x.post_id==='5');
    assert.equal(a.method.eligible_posts,6);
    assert.equal(flag.age_band,'0–7 days');
    assert.equal(flag.peers,5);
    assert.equal(flag.source,source);
    assert.equal(flag.metric_as_of,valid[5].metric_as_of);
    assert.equal(analyze(valid.slice(0,5).concat(make(6,{source:'YouTube public feed'})),[]).method.eligible_posts,0);
  }
});
