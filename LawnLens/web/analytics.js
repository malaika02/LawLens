/* LawnLens campaign analytics. Browser worker and Node compatible. All functions
   operate on the supplied records. Missing metric values stay unknown. */
(() => {
'use strict';
const TOPIC_RULES = {
  "Customer service": "customer (?:care|services?|support)|(?:improve|poor|bad) (?:ur|your|the) services?|helpline|support team|کسٹمر سروس",
  "Site access": "website (?:crash(?:ed)?|down|slow)|checkout error|site (?:crash(?:ed)?|down)|website (?:nahi|band)|ویب سائٹ بند",
  "Delivery": "deliver(?:y|ies|ed)?|ship(?:ping|ment|ped)?|courier|track(?:ing)?|parcel|dispatch|cash on delivery|cod|wait(?:ing|ed)|ترسیل|ڈیلیوری|پارسل|کورئیر|ڈلیوری",
  "Availability": "stock|restock(?:ed|ing)?|availab(?:le|ility)|in store|branch|dast[iy]ab|mil(?:ey|e) ga|out of stock|sold out|khatam|برانچ|موجود ہے|اسٹاک|سٹاک|دستیاب|ملے گا",
  "Sizing": "size[s]?|sizing|fit(?:ting)?|measurements?|sleeves?|length|width|chest|waist|small|medium|large|xl|xxl|lambai|فٹنگ|سائز|ناپ|لمبائی",
  "Fabric & quality": "fabrics?|quality|material|cloth|cotton|linen|silk|texture|shrink(?:age)?|transparent|see through|kapr[ae]y?|kapd[ae]|کپڑا|کپڑے|کوالٹی|معیار|سوتی",
  "Discounts": "discount(?:ed|s)?|promo(?:tion)?|coupons?|vouchers?|واؤچر|sale|offers?|riayat|r[aie]ayat|ڈسکاؤنٹ|سیل|رعایت",
  "Price": "prices?|pricing|costs?|rates?|expensive|afford(?:able)?|meh[ae]ng[ai]|q[iy]mat|qeemat|keemat|kitn[aeiy]+ (?:ka|ki|ke|rupay)|rupees|روپے|ریٹ|(?:rs|pkr)\\s*\\d+|قیمت|مہنگا|مہنگی|کتنے کا|کتنے کی|کتنی قیمت",
  "Purchase interest": "buy|purchase|checkout|place an order|order (?:link|kar|kr|kaise|kese)|how (?:can|do|to) (?:i )?order|reserve|book (?:it|one)|want (?:it|one|to order)|(?:need|want) (?:a |the )?(?:kurtis?|suits?|dresses)\\b|khareed(?:na)?|kharid(?:na)?|خرید(?:نا|نے)?|آرڈر کیسے|بک کر(?:یں)?",
  "Product appreciation": "beautiful|gorgeous|lovely|stunning|love (?:it|this|the)|pretty|pasand|p(?:i?y|i)ar[ai]|khoobsoorat|khoobsurat|khubsurat|پسند|خوبصورت|پیارا|پیاری"
};
const POSITIVE = "beautiful|lovely|gorgeous|excellent|amazing|stunning|great|good|love|perfect|pretty|khubsurat|khoobsoorat|p(?:i?y|i)ar[ai]|پسند|خوبصورت|بہترین|عمدہ|اچھا|اچھی";
const NEGATIVE = "awful|terrible|damaged|bad|disappointed|poor|horrible|defective|expensive|late|overpriced|bakwa[a]?s|kharab|meh[ae]ng[ai]|خراب|مہنگی|مہنگا|بیکار|ناقص";
const NEGATED_POS = "(?:not|never)\\s+(?:very\\s+)?(?:good|great|beautiful|happy|satisfied)|pasand nahi[n]?|پسند نہیں|اچھا نہیں|اچھی نہیں";
const NEGATED_NEG = "not\\s+(?:too\\s+)?(?:bad|expensive|terrible)|meh[ae]ng[ai] nahi[n]?|مہنگا نہیں|مہنگی نہیں";
const NEGATED_INTENT = "(?:do not|don t|dont|never|won t|wont|not going to|cannot|can t|cant)\\s+(?:want to\\s+)?(?:buy|order|purchase)|(?:order|buy)\\s+nahi[n]?|نہیں خرید|خریدنا نہیں";
const ROMAN = "hai[n]?|hain|kiya|kya|kia|kitn[aeiy]|boh[au]t|b[ao]hat|zyada|chahiye|karein|kahan|kese|kaise|dein|mujhe|kapr[ae]y?|pasand|pyar[ai]|nahi[n]?|qeemat|meh[ae]ng[ai]|sakta|wala|wali";
const CANON = {
  "قیمت": "price",
  "ریٹ": "price",
  "qeemat": "price",
  "qimat": "price",
  "rate": "price",
  "cost": "price",
  "رعایت": "discount",
  "ڈسکاؤنٹ": "discount",
  "riayat": "discount",
  "سیل": "sale",
  "واؤچر": "voucher",
  "سائز": "size",
  "فٹنگ": "fitting",
  "لمبائی": "length",
  "lambai": "length",
  "ڈیلیوری": "delivery",
  "ڈلیوری": "delivery",
  "پارسل": "parcel",
  "کورئیر": "courier",
  "ٹریکنگ": "tracking",
  "کوالٹی": "quality",
  "کپڑے": "fabric",
  "کپڑا": "fabric",
  "kapra": "fabric",
  "cloth": "fabric",
  "اسٹاک": "stock",
  "سٹاک": "stock",
  "دستیاب": "available",
  "خوبصورت": "beautiful",
  "پیارا": "lovely",
  "پسند": "like",
  "khoobsurat": "beautiful",
  "pyara": "lovely",
  "خریدنا": "buy",
  "khareedna": "buy",
  "آرڈر": "order",
  "مہنگا": "expensive",
  "mehnga": "expensive"
};
const ACTIONS = {
  'Customer service': ['Review the customer-service feedback','Check the cited feedback for a specific issue and test a clearer support or escalation route.'],
  'Site access': ['Investigate store access during the campaign','Check storefront incidents around the post and compare reported issues with support logs.'],
  "Price": [
    "Publish the PKR price on the product card",
    "Test a visible PKR price and compare price-question share on similar posts."
  ],
  "Discounts": [
    "Make offer terms easy to find",
    "Test a caption with the discount, eligible products and end date. Track repeated offer questions."
  ],
  "Delivery": [
    "Answer delivery and tracking questions",
    "Test a pinned delivery estimate and tracking guide. Compare delivery-question share on similar posts."
  ],
  "Sizing": [
    "Put measurements beside the size options",
    "Test a measurement chart in the post and track the share of follow-up size questions."
  ],
  "Availability": [
    "Clarify how to check stock",
    "Test a caption with a stock-check link and branch availability instructions. Track repeated stock questions."
  ],
  "Fabric & quality": [
    "Show the fabric in detail",
    "Test a close-up of texture and opacity with a fabric description. Track repeated material questions."
  ],
  "Purchase interest": [
    "Make the order route visible",
    "Test a direct product link or order instructions. Review order-route questions on comparable posts."
  ],
  "Product appreciation": [
    "Identify which product detail draws praise",
    "Review the cited comments, then test that detail in a creative variant."
  ]
};
const STOP = new Set("a aap acha achha an and any ap are as at aur be before bhi bohat by can collection come comes could dein do does ek for from ha hai hain have hello hi how i in is iska it its ka kab kar ke ki kia kindly kitne kitni know ko koi kya lag lawn let lmk main me mein mil my of on one or par piece please pls plz question s sakta salam sawal se still suit suits t tak tell that the there these this thora three to two us wala wali was what when will with would ye yeh you your آپ اس اور ایک بتائیں بتایں براہ بھی بہت تک جوڑا جوڑے دیں سوال سے مجھے میں پر کا کب کرم کریں کو کی کیا کے ہیں ہے یہ".split(' '));
const ENGLISH = "the|this|what|how|why|when|where|please|is|are|can|does|do|your|my|beautiful|love|price|delivery|discount|stock|shipping|size|quality|fabric|gorgeous";

const METRICS = ['views', 'likes', 'comments_count', 'shares'];
const DISPLAY = {views: 'views', likes: 'likes', comments_count: 'reported comments', shares: 'shares'};
const MIN_DIFF = {views: 50, likes: 5, comments_count: 3, shares: 3};
const lexicalPattern = (source, flags = 'iu') =>
  new RegExp('(?<![\\p{L}\\p{N}_])(?:' + source + ')(?![\\p{L}\\p{N}_])', flags);
const patterns = Object.entries(TOPIC_RULES).map(([label, source]) => [label, lexicalPattern(source)]);
const positive = lexicalPattern(POSITIVE), negative = lexicalPattern(NEGATIVE);
const negPos = lexicalPattern(NEGATED_POS, 'giu'), negNeg = lexicalPattern(NEGATED_NEG, 'giu');
const notBuy = lexicalPattern(NEGATED_INTENT), roman = lexicalPattern(ROMAN), english = lexicalPattern(ENGLISH);
const byNumber = (a, b) => a - b;
const byText = (a, b) => a === b ? 0 : a < b ? -1 : 1;
const unknown = value => !value || /^(?:unknown|unspecified|unclassified)$/i.test(String(value));
const tally = (map, key, value = 1) => map.set(key, (map.get(key) || 0) + value);
function group(map, key, initial = () => []) {
  if (!map.has(key)) map.set(key, initial());
  return map.get(key);
}
function numeric(value) {
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value.trim())) return null;
    value = Number(value);
  }
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function normalize(text) {
  return text.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+|www\.\S+|(?<!\w)@[\w.]+/giu, ' ')
    .replace(/[\u064b-\u065f\u0670\u0640]/gu,'').replace(/ك/gu, 'ک').replace(/[يى]/gu, 'ی')
    .replace(/['’‐–-]/gu, ' ').replace(/\s+/gu, ' ').trim();
}
function tokenize(norm) {
  return (norm.match(/\p{L}+/gu) || []).filter(term => term.length > 1 && !STOP.has(term))
    .map(term => Object.hasOwn(CANON,term) ? CANON[term] : term);
}
const arabicScript = /\p{Script=Arabic}/u;
function annotate(norm) {
  const topics = patterns.map(([label, pat]) => [label, norm.search(pat)])
    .filter(pair => pair[1] >= 0).sort((a,b) => a[1] - b[1]).map(pair => pair[0]);
  let language = 'Unclear';
  if (arabicScript.test(norm)) language = /[a-z]/.test(norm) ? 'Mixed Urdu / Latin script' : 'Urdu-script candidate';
  else if (roman.test(norm)) language = 'Roman Urdu candidate';
  else if (english.test(norm)) language = 'English candidate';
  else if (/[a-z]/.test(norm)) language = 'Latin script / unconfirmed';
  const clean = norm.replace(negPos, ' ').replace(negNeg, ' ');
  const pos = positive.test(clean) || norm.search(negNeg) >= 0;
  const neg = negative.test(clean) || norm.search(negPos) >= 0;
  const sentiment = pos && neg ? 'Mixed signals' : pos ? 'Positive cue' : neg ? 'Negative cue' : 'No clear cue';
  const declined = notBuy.test(norm);
  if (declined) {
    const index = topics.indexOf('Purchase interest');
    if (index >= 0) topics.splice(index, 1);
  }
  let intent = 'Unclear';
  if (declined) intent = 'Declined or negated';
  else if (topics.includes('Purchase interest')) intent = 'Explicit purchase cue';
  else if (topics.some(t => ['Price','Discounts','Sizing','Availability','Fabric & quality'].includes(t))) intent = 'Product inquiry cue';
  return {topic: topics[0] || 'Other / unclear', topics, language, sentiment, purchase_intent: intent};
}

function unit(weights) {
  let squared = 0;
  for (const weight of weights.values()) squared += weight * weight;
  const norm = Math.sqrt(squared);
  if (norm) for (const [term, weight] of weights) weights.set(term, weight / norm);
  return weights;
}
function dot(doc, centroid) {
  let score = 0;
  for (const [term, weight] of doc) score += weight * (centroid.get(term) || 0);
  return score;
}
function bestMatch(doc, centers) {
  let best = -1, score = 0;
  for (let i = 0; i < centers.length; i++) {
    const match = dot(doc, centers[i]);
    if (match > score) { score = match; best = i; }
  }
  return [best, score];
}
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function fit(docs, k) {
  const centers = [docs[0]];
  const nearest = new Float64Array(docs.length);
  while (centers.length < k) {
    let farthest = 0;
    for (let i = 0; i < docs.length; i++) {
      nearest[i] = Math.max(nearest[i], dot(docs[i], centers[centers.length - 1]));
      if (nearest[i] < nearest[farthest]) farthest = i;
    }
    if (nearest[farthest] >= 1 - 1e-9) break;
    centers.push(docs[farthest]);
  }
  const previous = new Int16Array(docs.length).fill(-2);
  for (let step = 0; step < 20; step++) {
    const sums = centers.map(() => new Map());
    let changed = false;
    for (let i = 0; i < docs.length; i++) {
      const [best] = bestMatch(docs[i], centers);
      if (previous[i] !== best) changed = true;
      previous[i] = best;
      if (best >= 0) for (const [term, weight] of docs[i]) tally(sums[best], term, weight);
    }
    if (!changed) break;
    for (let i = 0; i < centers.length; i++) if (sums[i].size) centers[i] = unit(sums[i]);
  }
  return centers;
}
function repeatedWording(docRows, annotations, total, reason) {
  const groups=[...docRows].filter(([,rows])=>rows.length>=3)
    .sort((a,b)=>b[1].length-a[1].length||byText(a[0],b[0])).slice(0,8);
  const clusters=groups.map(([key,rows],index)=>{
    const id='r'+(index+1);
    const counts=new Map();
    for (const row of rows) {
      const entry=annotations[String(row.comment_id)];
      entry.cluster_id=id;
      for (const t of entry.topics) tally(counts,t);
    }
    const terms=key.split(' ').slice(0,5);
    const top=[...counts].sort((a,b)=>b[1]-a[1]||byText(a[0],b[0]))[0];
    const label=top && top[1]/rows.length>=0.5 ? top[0] : terms.slice(0,2).join(' / ');
    const examples=rows.slice().sort((a,b)=>byText(String(a.comment_id),String(b.comment_id))).slice(0,3)
      .map(r=>({comment_id:String(r.comment_id),post_id:String(r.post_id),text:r.comment_text}));
    return {id,label,count:rows.length,share:rows.length/total,terms,examples,cohesion:1,distinct_texts:1,
      basis:'Repeated normalized wording'};
  });
  const status=reason+(clusters.length?' Showing repeated normalized wording that occurs at least three times.':'');
  return [clusters,status,docRows.size];
}
function segments(docRows, annotations, nComments) {
  const distinct = docRows.size;
  if (distinct < 4) return repeatedWording(docRows,annotations,nComments,'At least four distinct tokenized comments are needed for k-means.');
  const freq = new Map();
  for (const key of docRows.keys()) for (const term of new Set(key.split(' '))) tally(freq, term);
  const idf = new Map();
  for (const [term, n] of freq) if (n >= 2) idf.set(term, 1 + Math.log((1 + distinct) / (1 + n)));
  const vectors = [];
  for (const key of docRows.keys()) {
    const weights = new Map();
    for (const term of key.split(' ')) if (idf.has(term)) tally(weights, term);
    for (const [term,n] of weights) weights.set(term, (1 + Math.log(n)) * idf.get(term));
    if (weights.size) vectors.push({key, seed: hash(key), weights: unit(weights)});
  }
  if (vectors.length < 4 || idf.size < 2) return repeatedWording(docRows,annotations,nComments,'Too little shared vocabulary to fit k-means groups.');
  vectors.sort((a,b) => a.seed - b.seed || byText(a.key, b.key));
  const sample = vectors.slice(0,1500).map(row => row.weights);
  const k = Math.min(8, Math.max(2, Math.round(Math.sqrt(sample.length / 3))));
  const centers = fit(sample, k);
  const assigned = new Map();
  for (const row of vectors) {
    const [best, score] = bestMatch(row.weights, centers);
    if (score >= 0.12) group(assigned, best).push({key: row.key, score});
  }
  const groups = [...assigned].filter(([, members]) => members.length >= 2).map(([i, members]) =>
      ({i, members, count: members.reduce((n, member) => n + docRows.get(member.key).length, 0)}))
    .sort((a,b) => b.count - a.count || a.i - b.i);
  if (groups.length < 2) return repeatedWording(docRows,annotations,nComments,'Shared terms did not produce two supported k-means groups.');
  const clusters = groups.map(({i,members,count}, index) => {
    const id = 'c' + (index+1), cues = new Map(), examples = [];
    let cohesion = 0;
    members.sort((a,b) => b.score - a.score || byText(a.key, b.key));
    for (const member of members) {
      const rows = docRows.get(member.key);
      cohesion += member.score * rows.length;
      for (const row of rows) {
        const annotation = annotations[row.comment_id];
        annotation.cluster_id = id;
        for (const topic of annotation.topics) tally(cues, topic);
      }
      if (examples.length < 3) {
        const row = rows.reduce((best,r) => String(r.comment_id) < String(best.comment_id) ? r : best);
        examples.push({comment_id:String(row.comment_id), post_id:String(row.post_id), text: row.comment_text});
      }
    }
    const terms = [...centers[i]].sort((a,b) => b[1] - a[1] || byText(a[0],b[0])).slice(0,5).map(pair=>pair[0]);
    const top = [...cues].sort((a,b) => b[1]-a[1] || byText(a[0],b[0]))[0];
    const label = top && top[1]/count >= 0.5 ? top[0] : terms.slice(0,2).join(' / ');
    return {id,label,count,share:count/nComments,terms,examples,cohesion:Number(Math.min(1,cohesion/count).toFixed(3)),distinct_texts:members.length,basis:'TF-IDF spherical k-means'};
  });
  return [clusters,`${clusters.length} groups found in shared vocabulary. Centroids fitted on ${sample.length.toLocaleString('en')} distinct texts.`,distinct];
}

function dateDay(raw) {
  if (!raw || !/^\d{4}-\d\d-\d\d(?:$|[T ])/u.test(String(raw))) return null;
  let iso = String(raw).trim().replace(' ','T');
  if (iso.length > 10 && !/(?:z|[+-]\d\d:?\d\d)$/iu.test(iso)) iso += 'Z';
  const calendar = iso.slice(0,10), day = new Date(calendar+'T00:00:00Z');
  if (!Number.isFinite(day.valueOf()) || day.toISOString().slice(0,10) !== calendar) return null;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? Math.floor(time/86400000) : null;
}
const exactArchiveSources = new Set(['Archived YouTube public feed','Archived Gul Ahmed storefront']);
const exactInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;
function ageBand(row) {
  const archive = /archive|screenshot/i.test(String(row.source || ''));
  let observation = dateDay(row.observed_at);
  if (archive) {
    // Age an archived counter at display capture, never at archive consultation.
    if (!exactArchiveSources.has(row.source) || !exactInstant.test(row.metric_as_of || '')) return null;
    const capture = dateDay(row.metric_as_of);
    if (capture === null || (observation !== null && capture > observation)) return null;
    if (exactInstant.test(row.published_at || '') && Date.parse(row.metric_as_of) < Date.parse(row.published_at)) return null;
    observation = capture;
  }
  const publication = dateDay(row.published_at);
  const age = observation !== null && publication !== null ? observation - publication
    : row.provenance === 'simulated' ? numeric(row.days_since_post) : null;
  if (age === null || age < 0) return null;
  if (age <= 7) return '0–7 days';
  if (age <= 30) return '8–30 days';
  if (age <= 90) return '31–90 days';
  if (age <= 365) return '91–365 days';
  return '366+ days';
}
function measured(rows, metric) {
  return rows.map(row => numeric(row[metric])).filter(value => value !== null);
}
function median(values) {
  if (!values.length) return null;
  const ordered = values.slice().sort(byNumber);
  const half = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[half] : (ordered[half-1] + ordered[half])/2;
}
function contentGroups(posts) {
  const groups = new Map();
  for (const p of posts) group(groups, JSON.stringify([p.platform || 'Unknown',p.content_type || 'Unknown'])).push(p);
  return [...groups].sort((a,b) => byText(a[0], b[0])).map(([key, rows]) => {
    const [platform,content_type] = JSON.parse(key);
    const bucket = {platform,content_type,posts:rows.length};
    for (const metric of METRICS) {
      const col = metric === 'comments_count' ? 'comments' : metric;
      const values = measured(rows, metric);
      bucket[col+'_n'] = values.length;
      bucket['median_'+col] = median(values);
    }
    return bucket;
  });
}
function quartileWithout(ordered, skip, quantile) {
  // Quantile with this post excluded, calculated in a single sorted peer array.
  const pos = (ordered.length - 2) * quantile, lo = Math.floor(pos), hi = Math.ceil(pos);
  const a = ordered[lo + (lo >= skip)], b = ordered[hi + (hi >= skip)];
  return a + (b-a)*(pos-lo);
}
function flagMetric(rows, key, band, rate, getter, eligible) {
  const observed = [];
  for (const row of rows) {
    const value = getter(row);
    if (value !== null) observed.push({row,value});
  }
  if (observed.length < 6) return [];
  observed.sort((a,b) => a.value-b.value || byText(String(a.row.post_id),String(b.row.post_id)));
  const ordered = observed.map(x => x.value);
  const flags = [];
  for (let i=0; i<observed.length; i++) {
    const {row,value} = observed[i];
    eligible.add(row.post_id);
    const [lower,mid,upper] = [0.25,0.5,0.75].map(q=>quartileWithout(ordered,i,q));
    if (rate) {
      const gap = Math.max(0.25,3*(upper-lower));
      if (!(value > upper+gap || value < lower-gap)) continue;
    } else {
      const [x,q1,q3] = [value,lower,upper].map(Math.log1p);
      const gap = Math.max(Math.log(2),3*(q3-q1));
      if (Math.abs(value-mid) < MIN_DIFF[key] || !(x>q3+gap || x<q1-gap)) continue;
    }
    const format = n => rate ? (100*n).toFixed(0)+'%' : n.toLocaleString('en',{maximumFractionDigits:1});
    const metric = rate ? key+' share' : DISPLAY[key];
    const peers = observed.length-1, direction = value > mid ? 'High' : 'Low';
    flags.push({post_id:String(row.post_id),brand:row.brand,platform:row.platform,title:row.title||String(row.post_id),source:row.source||'',metric_as_of:row.metric_as_of||null,
      content_type:row.content_type,metric,value,peer_median:mid,unit:rate?'fraction':'count',peers,direction,age_band:band,
      reason:`${format(value)} ${metric} versus a median of ${format(mid)} across ${peers} comparable posts.`});
  }
  return flags;
}
function anomalies(posts,sampled,postTopics) {
  const cohorts = new Map(), eligible = new Set(), flags = [];
  for (const p of posts) {
    const age = ageBand(p);
    if (age && ![p.brand,p.platform,p.content_type].some(unknown))
      group(cohorts,JSON.stringify([p.brand,p.platform,p.content_type,age,p.provenance||'',p.source||''])).push(p);
  }
  for (const [key,rows] of cohorts) {
    if (rows.length < 6) continue;
    const band = JSON.parse(key)[3];
    for (const metric of METRICS) flags.push(...flagMetric(rows,metric,band,false,p=>numeric(p[metric]),eligible));
    const rates = rows.filter(p=>(sampled.get(String(p.post_id))||0)>=8);
    if (rates.length >= 6) for (const topic of Object.keys(TOPIC_RULES)) {
      flags.push(...flagMetric(rates,topic,band,true,p=>(postTopics.get(String(p.post_id))?.get(topic)||0)/sampled.get(String(p.post_id)),eligible));
    }
  }
  flags.sort((a,b)=>b.peers-a.peers||byText(a.post_id,b.post_id)||byText(a.metric,b.metric));
  return [flags,eligible.size];
}
function creativeTest(posts) {
  const strata = new Map();
  for (const p of posts) {
    const age = ageBand(p);
    if (!age || [p.brand,p.platform,p.content_type].some(unknown)) continue;
    const stratum = group(strata,JSON.stringify([p.brand,p.platform,age,p.provenance||'',p.source||'']),()=>new Map());
    group(stratum,p.content_type).push(p);
  }
  let best = null;
  for (const [key,formats] of [...strata].sort((a,b)=>byText(a[0],b[0]))) {
    if (formats.size < 2) continue;
    for (const metric of METRICS) {
      const summaries = [];
      for (const [name,rows] of formats) {
        const entries = rows.filter(p=>numeric(p[metric])!==null)
          .sort((a,b)=>numeric(a[metric])-numeric(b[metric]) || byText(String(a.post_id),String(b.post_id)));
        if (entries.length >= 3) summaries.push({name,rows:entries,median:median(measured(entries,metric))});
      }
      summaries.sort((a,b)=>a.median-b.median||byText(a.name,b.name));
      if (summaries.length<2) continue;
      const low=summaries[0], high=summaries[summaries.length-1];
      if (low.median===high.median) continue;
      const support=Math.min(low.rows.length,high.rows.length);
      if (!best || support>best.support) best={key,low,high,support,metric};
      break;
    }
  }
  if (!best) return null;
  const {key,low,high,metric}=best, [brand,platform,age,,source]=JSON.parse(key);
  return {category:'Content test',title:`Test ${high.name} against ${low.name}`,
    action:'Keep audience, offer and posting window comparable. Judge the test on the same metric.',
    evidence:`${brand} on ${platform}${source?' ('+source+')':''}, observed at ${age}: median ${DISPLAY[metric]} was ${high.median.toLocaleString('en')} for ${high.name} (n=${high.rows.length}) and ${low.median.toLocaleString('en')} for ${low.name} (n=${low.rows.length}).`,
    post_ids:[high,low].map(x=>String(x.rows[Math.floor(x.rows.length/2)].post_id)),comment_ids:[]};
}
function recommendations(posts,comments,topics,flags,clusters) {
  const result=[], commentsById=new Map(comments.map(row=>[String(row.comment_id),row]));
  for (const t of topics.filter(t=>Object.hasOwn(ACTIONS,t.topic)&&t.count>=2).slice(0,3)) {
    const ids=t.example_ids;
    const [title,action]=ACTIONS[t.topic];
    const archiveOnly=comments.filter(c=>ids.includes(String(c.comment_id))).every(c=>/screenshot|archive/i.test(c.source||''));
    const context=archiveOnly?' The cited examples come from historical archives. Validate against current comments.':'';
    result.push({category:'Audience needs',title,action,
      evidence:`${t.count.toLocaleString('en')} of ${comments.length.toLocaleString('en')} collected comments matched cues for ${t.topic.toLowerCase()} (${(100*t.share).toFixed(1)}%).${context}`,
      post_ids:[...new Set(ids.map(id=>String(commentsById.get(id).post_id)))],comment_ids:ids});
  }
  const cohort=clusters.find(c=>c.count>=3 && c.cohesion>=0.25);
  if (cohort) result.push({
    category:'Audience segment',
    title:'Review the “'+cohort.label+'” comment group',
    action:'Check the representative comments for a shared need. Test a tailored post or pinned reply if the examples support one.',
    evidence:`${cohort.basis}. ${cohort.count.toLocaleString('en')} comments (${(100*cohort.share).toFixed(1)}% of this sample) fall in the group. Recurring terms include ${cohort.terms.slice(0,3).join(', ')}.`,
    post_ids:[...new Set(cohort.examples.map(e=>e.post_id))],comment_ids:cohort.examples.map(e=>e.comment_id)
  });
  const test=creativeTest(posts);
  if (test) result.push(test);
  if (flags.length) result.push({category:'Investigation',title:'Review an unusual post',
    action:'Check timing, paid exposure, product availability and moderation before attributing a cause.',
    evidence:flags[0].reason,post_ids:[flags[0].post_id],comment_ids:[]});
  if (!result.length && posts.length) result.push({category:'Evidence quality',title:'Collect a comparable sample',
    action:'Collect more dated posts for the same brand and format, with permitted comments and comparable metrics.',
    evidence:`${posts.length.toLocaleString('en')} posts and ${comments.length.toLocaleString('en')} collected comments in this selection. Evidence is insufficient for a campaign-specific test.`,
    post_ids:posts.slice(0,3).map(p=>String(p.post_id)),comment_ids:[]});
  return result;
}

// Inputs must have stable, unique IDs. Parent filters are enforced before processing comments.
function analyze(posts, comments) {
  const postIds = new Set(posts.map(p=>String(p.post_id)));
  comments = comments.filter(c=>postIds.has(String(c.post_id)));
  const annotations = Object.create(null), documents=new Map(), cached=new Map(), counts=new Map();
  const examples=new Map(), samples=new Map(), postTopics=new Map();
  for (const c of comments) {
    const cid=String(c.comment_id),pid=String(c.post_id),text=String(c.comment_text||'').trim();
    let feature=cached.get(text);
    if (!feature) {
      const norm=normalize(text);
      feature={annotation:annotate(norm),key:tokenize(norm).join(' ')};
      cached.set(text,feature);
    }
    const entry={...feature.annotation,cluster_id:null};
    annotations[cid]=entry;
    if (feature.key) group(documents,feature.key).push(c);
    tally(samples,pid);
    const local=group(postTopics,pid,()=>new Map());
    for (const topic of entry.topics.length?entry.topics:[entry.topic]) {
      tally(counts,topic); tally(local,topic);
      const list=group(examples,topic);
      if (list.length<4) list.push(cid);
    }
  }
  const topics=[...counts].sort((a,b)=>b[1]-a[1]||byText(a[0],b[0]))
    .map(([topic,count])=>({topic,count,share:count/comments.length,example_ids:examples.get(topic)}));
  const [clusters,status,distinct]=segments(documents,annotations,comments.length);
  const [flags,eligible]=anomalies(posts,samples,postTopics);
  const summary={posts:posts.length,comments:comments.length,brands:new Set(posts.map(p=>p.brand).filter(Boolean)).size,
    clustered_comments:clusters.reduce((n,c)=>n+c.count,0),flagged_posts:new Set(flags.map(f=>f.post_id)).size};
  for (const metric of METRICS) {
    const values=measured(posts,metric),name=metric==='comments_count'?'reported_comments':metric;
    summary[name]=values.length?values.reduce((sum,n)=>sum+n,0):null;
    summary[name+'_n']=values.length;
  }
  return {summary,content:contentGroups(posts),topics,clusters,anomalies:flags,
    recommendations:recommendations(posts,comments,topics,flags,clusters),annotations,
    method:{cluster_method:'Deterministic spherical k-means on normalized unigram TF-IDF vectors with Urdu/Roman Urdu spelling aliases. Distinct texts train the model. Repeated comments retain their counts. With too little shared vocabulary for k-means, groups of at least three identical normalized texts can still identify repeated wording. Topic, language, sentiment and intent cues are separate heuristics.',
      cluster_status:status,distinct_texts:distinct,
      anomaly_method:'Compare posts with the same brand, platform, format, source, provenance and observed age band. Archived official feeds and retailer galleries use exact display-capture timestamps and are compared within their own source. Other archives are excluded. Retailer displays can lag the platform. Require five other measured posts. Flag counts outside three interquartile ranges on a log scale, with at least a twofold gap on count + 1 and a minimum absolute difference. Topic-share tests require eight sampled comments per post and a gap of more than 25 percentage points beyond the peer quartiles.',
      eligible_posts:eligible}};
}
globalThis.analyze=analyze;
})();
