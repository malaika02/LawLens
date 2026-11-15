// CSV interchange for the observed-data workspace. No external parser required.
(function () {
  'use strict';

  const fields = {
    posts: 'post_id brand platform campaign content_type product_category title published_at observed_at source_url likes comments_count shares views source provenance permission evidence_url metric_as_of metric_notes'.split(' '),
    comments: 'comment_id post_id comment_text published_at observed_at source_url source provenance permission'.split(' ')
  };
  const required = {
    posts: ['post_id','brand','platform','observed_at','source_url','source','permission'],
    comments: ['comment_id','post_id','comment_text','observed_at','source_url','source','permission']
  };
  const metrics = new Set(['likes','comments_count','shares','views']);
  const brands = new Map(Object.entries({sapphire:'Sapphire',sapphirepakistan:'Sapphire',khaadi:'Khaadi',
    gulahmed:'Gul Ahmed',gulahmad:'Gul Ahmed',ideasbygulahmed:'Gul Ahmed'}));
  const platforms = new Map(Object.entries({youtube:'YouTube',instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok'}));
  const isFormula = (s) => /^[\s\uFEFF]*[=+@\-]/u.test(s) || /^[\t\r\n]/.test(s);

  function readRecords(input) {
    const records = [];
    let cells = [], value = '', mode = 'plain', line = 1, rowLine = 1;
    function endCell() { cells.push(value); value = ''; mode = 'plain'; }
    function endRow() {
      endCell();
      if (cells.some(cell => cell.trim() !== '')) records.push({line:rowLine, cells});
      cells = [];
    }
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (mode === 'quoted') {
        if (c === '"') {
          if (input[i+1] === '"') { value += '"'; i++; } else { mode = 'closed'; }
        } else {
          value += c;
          if (c === '\n' || (c === '\r' && input[i+1] !== '\n')) line++;
        }
        continue;
      }
      if (c === ',') { endCell(); continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && input[i+1] === '\n') i++;
        endRow(); line++; rowLine = line;
        continue;
      }
      if (mode === 'closed') throw new Error(`Line ${line}: unexpected character after closing quote.`);
      if (c === '"') {
        if (value) throw new Error(`Line ${line}: quote inside an unquoted field.`);
        mode = 'quoted';
      } else { value += c; }
    }
    if (mode === 'quoted') throw new Error(`Line ${rowLine}: quoted field is missing its closing quote.`);
    endRow();
    return records;
  }

  function timeValue(value) {
    const match = /^(\d{4})-(\d\d)-(\d\d)(?:[Tt ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,9}))?)?(Z|[+-]\d\d:?\d\d))?$/i.exec(value);
    if (!match) return NaN;
    const [year,month,day] = match.slice(1,4).map(Number);
    const maxDay = new Date(Date.UTC(year,month,0)).getUTCDate();
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > maxDay) return NaN;
    if (match[4] && (+match[4]>23 || +match[5]>59 || +(match[6] || 0)>59)) return NaN;
    if (match[8] && match[8].toUpperCase() !== 'Z') {
      const offset = match[8].slice(1).replace(':','');
      if (+offset.slice(0,2)>23 || +offset.slice(2)>59) return NaN;
    }
    return Date.parse(value.replace(' ','T').replace(/([+-]\d\d)(\d\d)$/,'$1:$2'));
  }

  function validate(row,kind,line) {
    const fail = field => { throw new Error(`Line ${line}: ${field}`); };
    for (const f of required[kind]) if (!row[f]) fail(`${f} is required.`);
    for (const f of ['post_id', ...(kind === 'comments' ? ['comment_id'] : [])]) {
      if (row[f].length > 512 || /[\x00-\x1f\x7f]/.test(row[f])) fail(`${f} must be a short, single-line identifier.`);
    }
    const provenance = row.provenance.toLowerCase();
    if (provenance && provenance !== 'observed') fail('provenance must be observed for this workspace.');
    row.provenance = 'observed';
    for (const f of ['published_at','observed_at','metric_as_of']) {
      if (row[f] && !Number.isFinite(timeValue(row[f]))) fail(`${f} needs a valid ISO date or timestamp with timezone.`);
    }
    if (row.published_at && row.observed_at) {
      if (row.published_at.length > 10 && row.observed_at.length > 10) {
        if (timeValue(row.published_at)>timeValue(row.observed_at)) fail('published_at is later than observed_at.');
      } else {
        // A day-only observation can include all times on that date; timezone offsets may cross midnight.
        const publishedDay = Math.floor(timeValue(row.published_at)/86400000);
        const observedDay = Math.floor(timeValue(row.observed_at)/86400000);
        if (publishedDay>observedDay+1) fail('published_at is later than observed_at.');
      }
    }
    for (const name of ['source_url','evidence_url']) {
      const raw = row[name];
      if (!raw) continue;
      let url;
      try { url = new URL(raw); } catch { fail(`${name} must be an absolute HTTP or HTTPS URL.`); }
      if (!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
          !/^https?:\/\//i.test(raw) || /[\u0000-\u0020\\]/u.test(raw)) {
        fail(`${name} must be an absolute HTTP or HTTPS URL without embedded credentials.`);
      }
    }
    if (kind === 'posts') {
      const cleanKey = s => s.toLowerCase().replace(/[\s._-]+/g,'');
      row.brand = brands.get(cleanKey(row.brand)) || row.brand;
      row.platform = platforms.get(cleanKey(row.platform)) || row.platform;
      for (const f of metrics) {
        if (row[f] === '') { row[f] = null; continue; }
        const value = row[f];
        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) fail(`${f} must be a nonnegative whole number or empty.`);
        const n = Number(value.replace(/,/g,''));
        if (!Number.isSafeInteger(n)) fail(`${f} is outside the supported integer range.`);
        row[f] = n;
      }
    }
    return row;
  }

  function parse(text, kind) {
    if (kind !== 'posts' && kind !== 'comments') throw new Error('Choose a posts or comments CSV.');
    if (typeof text !== 'string') throw new Error('CSV input must be UTF-8 text.');
    const records = readRecords(text.replace(/^\uFEFF/,''));
    if (!records.length) throw new Error('The file has no CSV header.');
    const headers = records.shift().cells.map(h=>h.trim().toLowerCase());
    if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('Column headers must be nonempty and unique.');
    const index = new Map(headers.map((h,i)=>[h,i]));
    const missing = required[kind].filter(f=>!index.has(f));
    if (missing.length) throw new Error(`The ${kind} CSV needs columns: ${missing.join(', ')}.`);
    const rows = new Map();
    const id = kind==='posts'?'post_id':'comment_id';
    for (const {cells,line} of records) {
      if (cells.length !== headers.length) throw new Error(`Line ${line}: expected ${headers.length} columns and found ${cells.length}.`);
      const row = {};
      for (const f of fields[kind]) row[f] = (cells[index.get(f)] || '').trim();
      validate(row,kind,line);
      const previous = rows.get(row[id]);
      if (previous && fields[kind].some(f=>previous[f] !== row[f])) throw new Error(`Line ${line}: conflicting rows for ${id} ${row[id]}.`);
      rows.set(row[id],row);
    }
    return [...rows.values()];
  }

  function encode(rows,columns) {
    if (!Array.isArray(rows) || !Array.isArray(columns) || !columns.length) throw new Error('CSV export needs rows and columns.');
    function quote(v) {
      let text = v == null ? '' : String(v);
      if (typeof v === 'string' && isFormula(text)) text = "'" + text;
      return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g,'""') + '"' : text;
    }
    return [columns,...rows.map(row=>columns.map(f=>row[f]))].map(values=>values.map(quote).join(',')).join('\r\n')+'\r\n';
  }
  const api = {parse, encode, fields};
  globalThis.LawnCsv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
