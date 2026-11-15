// Read the feeds that the brand and platform publish for public display.
export const channels = {
  Sapphire: 'UCvMjM0BkK7SzlYnPTi5CBUQ',
  Khaadi: 'UCosHRi7jeBb0JGZfFlOHYUA',
  'Gul Ahmed': 'UCsAIxl3qvpy1DofpwDEx6Ow'
};
const xmlDecode = value => String(value || '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (s, n) => {
  if (!n.startsWith('#')) return ({amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"})[n] ?? s;
  const point = n.startsWith('#x') ? parseInt(n.slice(2), 16) : Number(n.slice(1));
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
});
function tag(xml, name) {
  return xmlDecode(xml.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'))?.[1]);
}
function nonnegative(value) {
  return value !== undefined && value !== null && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
function category(caption) {
  if (/\blawn\b|#\w*lawn/i.test(caption)) return 'Lawn';
  const unstitched = /\bunstitched\b|#\w*unstitched/i.test(caption), ready = /ready[\s-]*to[\s-]*wear/i.test(caption);
  if (unstitched && ready) return 'Unstitched & ready to wear';
  if (unstitched) return 'Unstitched';
  if (ready) return 'Ready to wear';
  return 'Unspecified';
}
function campaignTitle(caption, brand) {
  const season = caption.match(/\b(winter|spring|summer|autumn)\s*['’](\d\d)\b/i);
  if (season) return season[1][0].toUpperCase()+season[1].slice(1).toLowerCase()+' 20'+season[2];
  const year = caption.match(/\b(20\d{2})\b/)?.[1];
  const collections = [
    [/\bwinter charm\b/i,'Winter Charm',true],
    [/\bwhispers of the season\b/i,'Whispers of the Season',true],
    [/\bthe golden season\b/i,'The Golden Season'],
    [/\bcrafted in winter\b/i,'Crafted in Winter'],
    [/\bthe charm of winter\b/i,'The Charm of Winter'],
    [/\ba winter story\b/i,'A Winter Story'],
    [/\bsummer lawn\b/i,'Summer Lawn'],[/\bluxury lawn\b/i,'Luxury Lawn'],
    [/\beid collection\b/i,'Eid Collection'],[/\beid edit\b/i,'Eid Edit'],[/\beid\b/i,'Eid'],
    [/\b11\.11\b/,'11.11'],[/\b12\.12\b/,'12.12']
  ];
  for (const [pattern,name,usesYear] of collections) {
    if (pattern.test(caption)) return usesYear && year ? name+' '+year : name;
  }
  if (brand==='Khaadi' && /ready[\s-]*to[\s-]*wear/i.test(caption)) return 'Ready to Wear';
  return '';
}
export function parseFeed(xml, brand, observed_at) {
  const rows = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1], id = tag(entry,'yt:videoId'), channel = tag(entry,'yt:channelId');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || channel !== channels[brand]) continue;
    const title = tag(entry,'title'), published_at = tag(entry,'published'), desc = tag(entry,'media:description');
    if (!title || !Number.isFinite(Date.parse(published_at))) continue;
    const text = title+' '+desc;
    const venueAnnouncement = /\b(?:back at|store opening|new store|reopening)\b/i.test(title);
    const short = entry.includes('youtube.com/shorts/' + id);
    rows.push({post_id:'youtube:'+id, brand, platform:'YouTube', title, published_at, observed_at,
      source_url: short ? 'https://www.youtube.com/shorts/'+id : 'https://www.youtube.com/watch?v='+id,
      campaign:venueAnnouncement ? '' : campaignTitle(text,brand), product_category:venueAnnouncement ? 'Unspecified' : category(text), content_type:short ? 'Short' : 'Video',
      likes:null,comments_count:null,shares:null,views:nonnegative(entry.match(/<media:statistics\b[^>]*\bviews="(\d+)"/)?.[1]),
      evidence_url:'https://www.youtube.com/feeds/videos.xml?channel_id='+channels[brand],metric_as_of:observed_at,source:'YouTube public feed',provenance:'observed',permission:'Public channel feed. Factual metadata with a link to the publisher.',
      metric_notes:'Views as served by the Atom feed. The feed rating count is not used as a like count.'});
  }
  return rows;
}
// Read the literal JSON array while respecting escaped quotes and nested gallery items.
function jsonArrayEnd(text, start) {
  let depth=0, quoted=false, escaped=false;
  for (let i=start; i<text.length; i++) {
    const c=text[i];
    if (quoted) {
      if (escaped) escaped=false;
      else if (c==='\\') escaped=true;
      else if (c==='"') quoted=false;
      continue;
    }
    if (c==='"') quoted=true;
    else if (c==='[') depth++;
    else if (c===']' && --depth===0) return i+1;
  }
  return -1;
}
export function parseGallery(html, observed_at) {
  const rows = new Map();
  for (const match of html.matchAll(/\bconst\s+mf\s*=\s*(?=\[)/g)) {
    const start=match.index+match[0].length, end=jsonArrayEnd(html,start);
    if (end<0) continue;
    let items;
    try { items=JSON.parse(html.slice(start,end)); } catch { continue; }
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const link=String(item?.permalink||'').match(/^https:\/\/(?:www\.)?instagram\.com\/(p|reel)\/([\w-]+)\/?$/);
      if (!link || String(item.username).toLowerCase()!=='gulahmedfashion' || !Number.isFinite(Date.parse(item.timestamp))) continue;
      const caption=String(item.caption||'');
      const tags=[['#1111sale','11.11 Sale'],['#wintercharm2026','Winter Charm 2026'],['#whispersoftheseason2026','Whispers of the Season 2026']];
      const campaign=tags.find(([tag])=>caption.toLowerCase().includes(tag))?.[1]||'';
      const published_at=new Date(item.timestamp).toISOString();
      const format=link[1]==='reel'?'Reel':({VIDEO:'Video',IMAGE:'Photo',CAROUSEL_ALBUM:'Carousel'})[item.mediaType]||'Post';
      rows.set(link[2],{post_id:'instagram:'+link[2],brand:'Gul Ahmed',platform:'Instagram',campaign,content_type:format,
        product_category:category(caption),title:(campaign||'Gul Ahmed')+' · '+format.toLowerCase()+' · '+published_at.slice(0,10),
        published_at,observed_at,source_url:'https://www.instagram.com/'+link[1]+'/'+link[2]+'/',
        likes:nonnegative(item.likeCount),comments_count:nonnegative(item.commentsCount),shares:null,views:null,
        evidence_url:'https://www.gulahmedshop.com/',metric_as_of:'',source:'Gul Ahmed storefront',provenance:'observed',permission:'Factual metadata from the retailer’s public gallery. Media and captions are excluded.',
        metric_notes:'Counters as displayed by the retailer’s embedded gallery, which may lag Instagram.'});
    }
  }
  return [...rows.values()];
}
async function collect(url, parse, label) {
  const r=await fetch(url,{headers:{'Accept':'application/atom+xml, text/html;q=0.9, */*;q=0.5'},signal:AbortSignal.timeout(14000)});
  if (!r.ok) throw new Error(label+' returned HTTP '+r.status+'.');
  const text=await r.text();
  if (text.length > 8*1024*1024) throw new Error(label+' exceeded the response limit.');
  const checked=new Date().toISOString(), date=r.headers.get('date');
  const observed=date && Number.isFinite(Date.parse(date)) && Date.parse(date)<=Date.now()+60000 ? new Date(date).toISOString() : checked;
  const posts=parse(text,observed);
  if (!posts.length) throw new Error(label+' did not return any supported entries.');
  return {label,posts,checked};
}
export async function fetchPublic(){
  const jobs=Object.entries(channels).map(([brand,id])=>[brand+' · YouTube', 'https://www.youtube.com/feeds/videos.xml?channel_id='+id, (xml,at)=>parseFeed(xml,brand,at)]);
  jobs.push(['Gul Ahmed · Instagram gallery','https://www.gulahmedshop.com/',parseGallery]);
  const results=await Promise.allSettled(jobs.map(([label,url,parse])=>collect(url,parse,label)));
  return {posts:results.flatMap(r=>r.status==='fulfilled'?r.value.posts:[]),
    streams:results.map((r,i)=>({label:jobs[i][0],success:r.status==='fulfilled',records:r.status==='fulfilled'?r.value.posts.length:0,
      note:r.status==='fulfilled'?'Retrieved from source':(r.reason?.name==='TimeoutError'?'The publisher timed out.':r.reason?.message || 'The publisher could not be reached.')}))};
}
