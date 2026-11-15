import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed, parseGallery, channels} from './public.mjs';

const at='2026-11-15T16:30:00Z';
function fixture(title,description,id=channels.Sapphire) {
  return '<entry><yt:videoId>abcdefGhI_0</yt:videoId><yt:channelId>'+id+'</yt:channelId>'
    +'<title>'+title+'</title><published>2026-11-13T10:00:00Z</published><link href="https://www.youtube.com/shorts/abcdefGhI_0"/>'
    +'<media:description>'+description+'</media:description><media:statistics views="0"/><media:starRating count="55"/></entry>';
}
test('Atom parser validates account, preserves reported zero, and ignores rating count',()=>{
  const xml=fixture('WINTER &#39;26 - UNSTITCHED &amp; READY TO WEAR','New collection')+fixture('Other channel','',channels.Khaadi);
  const [r,...other]=parseFeed(xml,'Sapphire',at);
  assert.equal(other.length,0);
  assert.equal(r.views,0);
  assert.equal(r.likes,null);
  assert.equal(r.campaign,'Winter 2026');
  assert.equal(r.product_category,'Unstitched & ready to wear');
  assert.equal(r.content_type,'Short');
  assert.equal(r.observed_at,at);
  assert.equal(r.post_id,'youtube:abcdefGhI_0');
});
test('store opening and product campaign tags retain their source context',()=>{
  let [p]=parseFeed(fixture('We are back at Centaurus Mall','The store brings together Ready-to-Wear, bags and fragrances.',channels.Khaadi),'Khaadi',at);
  assert.equal(p.campaign,'');
  assert.equal(p.product_category,'Unspecified');
  [p]=parseFeed(fixture('Crafted in Winter','New arrivals #WomensUnstitched',channels['Gul Ahmed']),'Gul Ahmed',at);
  assert.equal(p.product_category,'Unstitched');
  assert.equal(p.campaign,'Crafted in Winter');
});
test('gallery parser accepts nested items and delimiter text inside captions, validates owner and deduplicates',()=>{
  const item={username:'gulahmedfashion',permalink:'https://www.instagram.com/reel/abc123/',timestamp:'2026-11-05T16:08:55+0000',
    caption:'Quote with ]; and a "quoted" word #1111sale #WinterUnstitched',mediaType:'VIDEO',commentsCount:0,likeCount:50,
    children:[{caption:'nested [gallery]'}]};
  const html='const mf = '+JSON.stringify([item,{...item,username:'other',permalink:'https://www.instagram.com/p/wrong/'},item]);
  const [p,...rest]=parseGallery(html,at);
  assert.equal(rest.length,0);
  assert.equal(p.post_id,'instagram:abc123');
  assert.equal(p.comments_count,0);
  assert.equal(p.shares,null);
  assert.equal(p.campaign,'11.11 Sale');
  assert.equal(p.content_type,'Reel');
  assert.equal(p.product_category,'Unstitched');
  assert.equal(p.published_at,'2026-11-05T16:08:55.000Z');
  assert.ok(!Object.hasOwn(p,'caption'));
});
