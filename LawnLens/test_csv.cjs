const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./web/csv.js');
const {parse,encode,fields} = globalThis.LawnCsv;
const base = {post_id:'1',brand:' GULAHMED ',platform:'You Tube',observed_at:'2026-09-03',source_url:'https://example.org/p/1',
  source:'Owner export',permission:'Owner authorized',likes:null,views:0,provenance:'observed'};
const C = fields.posts;
const build = (...rows)=>encode(rows,C);
test('round trips UTF-8, multiline, commas and quotes, validates duplicate IDs, and keeps missing counts distinct',()=>{
  const raw = {...base,title:'معیار, "لawn"\nNew line'};
  const p = parse('\uFEFF'+build(raw,raw),'posts');
  assert.equal(p.length,1); assert.equal(p[0].brand,'Gul Ahmed'); assert.equal(p[0].platform,'YouTube');
  assert.equal(p[0].title,raw.title); assert.equal(p[0].likes,null); assert.equal(p[0].views,0);
  assert.throws(()=>parse(build(raw,{...raw,title:'different'}),'posts'),/conflicting/);
});
test('validates dates, identifiers, required columns, URLs, nonnegative integer counts and provenance',()=>{
  for (const [field,val] of [['observed_at','2025-02-29'],['observed_at','2026-04-31'],['observed_at','2026-06-11T12:00:00'],
    ['observed_at','2025-01-01T25:00:00Z'],['source_url','javascript:alert(1)'],['source_url','https://secret@example.org/x'],
    ['published_at','2026-09-06'],['views','10.1'],['views','-1'],['likes','2k'],['views','999999999999999999999'],
    ['provenance','simulated'],['post_id',''],['source',''],['permission','']]) {
      assert.throws(()=>parse(build({...base,[field]:val}),'posts'),null,field);
  }
  assert.throws(()=>parse('post_id,brand\n1,A','posts'),/needs columns/);
  assert.throws(()=>parse('post_id,post_id','posts'),/unique/);
  assert.equal(parse(build({...base,views:'1,124',published_at:'2024-02-29T12:00:00+0500'}),'posts')[0].views,1124);
});
test('validates malformed CSV and preserves empty but structural header-only files',()=>{
  assert.deepEqual(parse(encode([],fields.comments),'comments'),[]);
  assert.throws(()=>parse('comment_id,"unterminated','comments'),/closing quote/);
  assert.throws(()=>parse('comment_id,"closed"x','comments'),/closing quote/);
  assert.throws(()=>parse(build(base)+'too,few\r\n','posts'),/expected/);
});
test('spreadsheet formulas are neutralized only on export and actual numeric cells remain numeric',()=>{
  const row={a:'  =X()',b:'+123',c:'@sapphire',d:'-cmd',e:-4,f:'normal text', g:null, h:'\ttext'};
  const out=encode([row],Object.keys(row));
  assert.equal(out,"a,b,c,d,e,f,g,h\r\n'  =X(),'+123,'@sapphire,'-cmd,-4,normal text,,'\ttext\r\n");
  const incoming=build({...base,title:'safe'}).replace(',safe,',',=SUM(1),');
  assert.equal(parse(incoming,'posts')[0].title,'=SUM(1)');
});
test('reads full currently bundled observations',()=>{
  for(const [k,f] of [['posts','observed_posts.csv'],['comments','observed_comments.csv']]) {
    const txt = fs.readFileSync(path.join(__dirname,'data',f),'utf8');
    const rows = parse(txt,k);
    assert.ok(rows.length>0);
  }
});
