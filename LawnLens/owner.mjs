// Owner-authorized Instagram Graph API connector for the hosted Worker.
const SOURCE = 'Instagram Graph API'
const accounts = [
  ['Sapphire', 'SAPPHIRE', 'sapphirepakistan'],
  ['Khaadi', 'KHAADI', 'khaadi'],
  ['Gul Ahmed', 'GUL_AHMED', 'gulahmedfashion'],
]
const fields = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count'
const limits = { posts: 24, commentPosts: 6, comments: 25, requests: 14 }
const permission = 'Owner-authorized account access. Reuse is governed by the owner’s permissions and Meta terms.'

export function ownerStatus(env = {}) {
  const brands = accounts.filter(([, prefix]) => env[`IG_${prefix}_USER_ID`] && env[`IG_${prefix}_ACCESS_TOKEN`]).map(([brand]) => brand)
  return {name: 'Instagram', source: SOURCE, configured: brands.length > 0, brands,
    detail: 'Owner-authorized professional accounts via Facebook Login.'}
}

function counter(value) {
  if (value === undefined || value === null || typeof value === 'boolean' || !/^\d+$/.test(String(value))) return null
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : null
}

function campaign(caption) {
  for (const [pattern, label] of [[/(?<!\d)11\.11(?!\d)/, '11.11'], [/(?<!\d)12\.12(?!\d)/, '12.12'],
    [/\beid\b/i, 'Eid'], [/\bram(?:a[dz]an|zan)\b/i, 'Ramadan'], [/\bsale\b/i, 'Sale']]) {
    if (pattern.test(caption)) return label
  }
  return 'Unspecified'
}

async function collectAccount(env, account, fetcher) {
  const [brand, prefix, expectedUsername] = account
  const uid = String(env[`IG_${prefix}_USER_ID`]).trim()
  const token = String(env[`IG_${prefix}_ACCESS_TOKEN`]).trim()
  const version = env.META_GRAPH_VERSION || 'v26.0'
  if (!/^\d{1,32}$/.test(uid) || !/^v\d{1,2}\.\d$/.test(version)) throw new Error('Check the configured Instagram account ID and Graph version.')
  let calls = 0
  async function graph(edge, params) {
    if (++calls > limits.requests) throw new Error('Provider pagination exceeded the refresh request budget.')
    const url = new URL(`https://graph.facebook.com/${version}/${edge}`)
    url.search = new URLSearchParams(params).toString()
    let response
    try {
      response = await fetcher(url, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'},
        redirect: 'error', signal: AbortSignal.timeout(10000)})
    } catch {
      throw new Error('Instagram could not be reached.')
    }
    if (!response.ok) throw new Error(`Instagram declined the request (HTTP ${response.status}). Check permissions, token expiry and quota.`)
    try { return await response.json() }
    catch { throw new Error('Instagram returned unreadable data.') }
  }
  async function* pages(edge, requestedFields, limit) {
    let cursor
    const seen = new Set()
    let count = 0
    do {
      const params = {fields: requestedFields, limit: String(limit - count)}
      if (cursor) params.after = cursor
      const page = await graph(edge, params)
      if (!Array.isArray(page?.data)) throw new Error('Instagram returned an incomplete response.')
      const observed = new Date().toISOString()
      for (const item of page.data) {
        yield [item, observed]
        if (++count >= limit) return
      }
      cursor = page.paging?.next && page.paging?.cursors?.after
      if (cursor && seen.has(cursor)) throw new Error('Instagram repeated a page cursor.')
      seen.add(cursor)
    } while (cursor)
  }
  const identity = await graph(uid, {fields:'id,username'})
  if (String(identity?.id) !== uid || String(identity?.username).toLowerCase() !== expectedUsername)
    throw new Error('The authorized Instagram profile does not match this brand.')
  const posts = [], comments = [], mediaIds = []
  for await (const [item, observed] of pages(`${uid}/media`, fields, limits.posts)) {
    let url
    try { url = new URL(item.permalink) } catch { continue }
    const code = url.pathname.match(/^\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)\/?$/)
    if (url.protocol !== 'https:' || !['instagram.com','www.instagram.com'].includes(url.hostname)
      || !code || !/^\d{1,32}$/.test(item.id)) continue
    const title = String(item.caption ?? '').trim().replace(/\s+/g,' ')
    const type = item.media_product_type === 'REELS' ? 'Reel' :
      ({IMAGE:'Photo',VIDEO:'Video',CAROUSEL_ALBUM:'Carousel'}[item.media_type] ?? 'Unspecified')
    const post = {post_id:`instagram:${code[1]}`, brand, platform:'Instagram', title, published_at:item.timestamp || '',
      observed_at:observed, source_url:`https://www.instagram.com${url.pathname}`, campaign:campaign(title),
      content_type:type, product_category:/\blawn\b/i.test(title) ? 'Lawn' : 'Unspecified', likes:counter(item.like_count),
      comments_count:counter(item.comments_count), views:null, shares:null, source:SOURCE,
      provenance:'observed',permission,metric_as_of:observed,evidence_url:`https://www.instagram.com${url.pathname}`,
      metric_notes:'Counters as returned by the provider in this observation.'}
    posts.push(post)
    mediaIds.push(item.id)
  }
  for (const [index, post] of posts.slice(0,limits.commentPosts).entries()) {
    if (post.comments_count === 0) continue
    for await (const [item, observed] of pages(`${mediaIds[index]}/comments`, 'id,text,timestamp', limits.comments)) {
      if (!item.id || !item.text) continue
      comments.push({comment_id:`instagram:${item.id}`,post_id:post.post_id,comment_text:item.text,
        published_at:item.timestamp || '',observed_at:observed,source_url:post.source_url,source:SOURCE,
        provenance:'observed',permission})
    }
  }
  return { posts, comments }
}

export async function fetchOwner(env = {}, fetcher = fetch) {
  const {brands} = ownerStatus(env)
  const active = accounts.filter(([brand]) => brands.includes(brand))
  const settled = await Promise.allSettled(active.map(account => collectAccount(env, account, fetcher)))
  const posts = new Map(), comments = new Map(), warnings = [], completed_streams = []
  for (const [index, result] of settled.entries()) {
    const brand = active[index][0]
    if (result.status === 'rejected') {
      warnings.push(`${brand} · ${SOURCE}: ${result.reason?.message || 'Refresh failed.'}`)
      continue
    }
    for (const row of result.value.posts) posts.set(row.post_id, row)
    for (const row of result.value.comments) comments.set(row.comment_id, row)
    completed_streams.push({source:SOURCE,brand})
  }
  return {posts:[...posts.values()],comments:[...comments.values()],warnings,completed_streams,
    completed_providers:completed_streams.length ? [SOURCE] : []}
}
