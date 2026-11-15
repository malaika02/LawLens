import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ownerStatus, fetchOwner} from './owner.mjs'

const config = { IG_KHAADI_ACCESS_TOKEN:'test-token', IG_KHAADI_USER_ID:'111' }
const reply = body => new Response(JSON.stringify(body),{status:200})
test('unconfigured Worker never calls providers', async () => {
  const result = await fetchOwner({}, () => { throw new Error('Network should be unused') })
  assert.equal(ownerStatus({}).configured, false)
  assert.deepEqual(result.posts, [])
})
test('Instagram verifies the owner, follows cursors only, and distinguishes zero from missing', async () => {
  const paths = []
  const result = await fetchOwner(config, async (url, opts) => {
    assert.equal(url.hostname, 'graph.facebook.com')
    assert.equal(opts.headers.Authorization, 'Bearer test-token')
    assert.equal(url.searchParams.has('access_token'), false)
    const edge = url.pathname.split('/').slice(2).join('/')
    paths.push(edge)
    if (edge === '111') return reply({id:'111',username:'Khaadi'})
    if (edge === '111/media') return reply({data:[{id:'222',caption:'Eid lawn',media_product_type:'REELS',
      permalink:'https://www.instagram.com/reel/code/',timestamp:'2020-03-01T08:00:00Z',like_count:0,comments_count:2}]})
    if (edge === '222/comments' && !url.searchParams.has('after')) return reply({data:[{id:'333',text:'sample'}],
      paging:{next:'https://invalid.invalid/',cursors:{after:'cursor'}}})
    return reply({data:[{id:'334',text:'second sample'}]})
  })
  assert.equal(result.posts[0].likes, 0)
  assert.equal(result.posts[0].views, null)
  assert.equal(result.posts[0].post_id,'instagram:code')
  assert.equal(result.comments.length,2)
  assert.deepEqual(result.completed_streams,[{source:'Instagram Graph API',brand:'Khaadi'}])
})
test('failed accounts do not advance the observation window', async () => {
  const result = await fetchOwner(config, async () => reply({id:'111',username:'someone_else'}))
  assert.deepEqual(result.completed_streams,[])
  assert.equal(result.warnings.length,1)
  assert.doesNotMatch(result.warnings[0],/test-token/)
})
