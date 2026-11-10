// niis/intake.js: how data gets into NIIS. Every way in (a file, a paste from a spreadsheet, a link, an open-data
// series, a provider's API push, a form, the provider portal) ends as the same thing: a batch of raw rows, each
// with what was received kept as text beside what NIIS recognised in it. Nothing here publishes anything: the
// rows wait for "Process new data" (niis/pipeline.js).
'use strict';
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');
const { readXlsx } = require('./xlsx');

const MAX_BYTES = 4 * 1024 * 1024;   // a hosted function takes at most 4.5 MB per request

// ---------------------------------------------------------------- reading a table
function sniffKind(name, buf) {
  const ext = (/\.([a-z0-9]+)$/i.exec(String(name || '')) || [])[1];
  const e = ext ? ext.toLowerCase() : '';
  if (buf && buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b) return 'xlsx';            // a zip: .xlsx/.xlsm
  if (buf && buf.length > 8 && buf.readUInt32BE(0) === 0xD0CF11E0) return 'xls';              // legacy binary Excel
  const head = buf ? buf.slice(0, 200).toString('utf8').replace(/^﻿/, '').trimStart() : '';
  if (e === 'json' || head.startsWith('[') || head.startsWith('{')) return 'json';
  if (['csv', 'tsv', 'txt', ''].includes(e) || /[,;\t|]/.test(head)) return 'csv';
  return 'unknown';
}

// split delimited text into rows, honouring quotes; the delimiter is the one that splits the first lines evenly
function parseDelimited(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const sample = src.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12);
  let delim = ',', best = -1;
  for (const d of ['\t', ',', ';', '|']) {
    const counts = sample.map((l) => l.split(d).length - 1);
    const min = counts.length ? Math.min(...counts) : 0;
    const score = min > 0 ? min * 10 + (counts.every((c) => c === counts[0]) ? 5 : 0) : 0;
    if (score > best) { best = score; delim = d; }
  }
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

// JSON: an array of objects, {data|rows|records: [...]}, or the World Bank's [meta, rows]
function jsonRows(text) {
  let j = JSON.parse(String(text).replace(/^﻿/, ''));
  if (Array.isArray(j) && j.length === 2 && j[0] && typeof j[0] === 'object' && 'page' in j[0] && Array.isArray(j[1])) {
    j = j[1].map((r) => ({ indicator: r.indicator && r.indicator.id, country: r.country && r.country.value, year: r.date, value: r.value }));
  }
  if (!Array.isArray(j)) j = j.data || j.rows || j.records || j.items || j.values || [];
  if (!Array.isArray(j)) throw new Error('no list of rows found in the JSON');
  const flat = j.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).map((o) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = v && typeof v === 'object' ? (v.value ?? v.name ?? v.id ?? JSON.stringify(v)) : v;
    return out;
  });
  const keys = [...new Set(flat.flatMap((o) => Object.keys(o)))];
  return [keys, ...flat.map((o) => keys.map((k) => (o[k] == null ? '' : String(o[k]))))];
}

// readTable(buffer, fileName) -> { kind, sheets: [{ name, rows }] }
function readTable(buf, name) {
  const kind = sniffKind(name, buf);
  if (kind === 'xls') throw new Error('This is an old-format Excel file (.xls). Open it in Excel and save it as .xlsx or CSV.');
  if (kind === 'xlsx') {
    let sheets;
    try { sheets = readXlsx(buf); } catch (e) { throw new Error('This Excel file could not be read (' + e.message + '). Save it again as .xlsx or CSV.'); }
    sheets = sheets.map((s) => ({ name: s.name, rows: s.rows.map((r) => r.map((c) => String(c == null ? '' : c).trim())) })).filter((s) => s.rows.some((r) => r.some((c) => c)));
    if (!sheets.length) throw new Error('Every sheet in this workbook is empty.');
    return { kind, sheets };
  }
  const text = buf.toString('utf8');
  if (kind === 'json') {
    try { return { kind, sheets: [{ name: 'JSON', rows: jsonRows(text) }] }; } catch (e) { throw new Error('The JSON could not be read: ' + e.message); }
  }
  if (kind === 'csv') return { kind, sheets: [{ name: 'Table', rows: parseDelimited(text) }] };
  throw new Error('NIIS reads Excel (.xlsx), CSV, tab-separated text and JSON. This file is none of those.');
}

// ---------------------------------------------------------------- recognising what the columns hold
const norm = (s) => String(s || '').toLowerCase().replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const ROLE_RE = {
  indicator: /^(indicator|indicators|indicator code|indicator id|indicator name|code|series|series code|series name|measure|variable|metric|kpi)$/,
  county: /^(county|counties|county name|region|location|area|geography|geo|place|admin1|admin 1|province|state|country|country name|country code)$/,
  year: /^(year|yr|period|time|date|reference year|ref year|time period|fiscal year|fy|reporting period|quarter)$/,
  value: /^(value|values|val|obs value|obsvalue|amount|figure|data|estimate|result|rate|percentage|percent|%|score)$/,
  numerator: /^(numerator|num|n)$/,
  denominator: /^(denominator|den|base|population|pop)$/,
  unit: /^(unit|units|unit of measure|uom)$/,
  source: /^(source|data source|provider|agency|reported by)$/,
  breakdown: /^(sex|gender|area type|urban rural|location type|age|age group|disaggregation|breakdown|dimension)$/,
};
// within a role, the header we prefer when several match (an indicator's code before its name)
const ROLE_PREF = { indicator: ['indicator code', 'series code', 'code', 'indicator id', 'indicator'] };
const YEAR_HEAD = /^((19|20)\d{2})(\s*\[yr\d{4}\])?$/i;
// columns that would carry a person: NIIS takes aggregates only (MOU Schedule 4, Q09)
const PERSONAL_RE = /\b(first name|last name|full name|surname|given name|respondent|phone|telephone|mobile number|msisdn|e ?mail|address|gps|latitude|longitude|lat|lng|national id|nin|passport|date of birth|dob|imei|household head)\b/;

function personalColumns(headers) {
  return headers.filter((h) => PERSONAL_RE.test(norm(h)) && !/^(indicator|series|country|county) /.test(norm(h)));
}

const COUNTY_ALIASES = {
  bomi: 'Bomi', bong: 'Bong', gbarpolu: 'Gbarpolu', gbapolu: 'Gbarpolu', gbarpolo: 'Gbarpolu',
  grandbassa: 'Grand Bassa', bassa: 'Grand Bassa', gbassa: 'Grand Bassa',
  grandcapemount: 'Grand Cape Mount', capemount: 'Grand Cape Mount', gcm: 'Grand Cape Mount', gcapemount: 'Grand Cape Mount',
  grandgedeh: 'Grand Gedeh', gedeh: 'Grand Gedeh', ggedeh: 'Grand Gedeh',
  grandkru: 'Grand Kru', kru: 'Grand Kru', gkru: 'Grand Kru',
  lofa: 'Lofa', margibi: 'Margibi', maryland: 'Maryland',
  montserrado: 'Montserrado', montserado: 'Montserrado', monteserrado: 'Montserrado',
  nimba: 'Nimba', rivercess: 'River Cess', rivergee: 'River Gee', sinoe: 'Sinoe', sino: 'Sinoe',
};
const NATIONAL_KEYS = new Set(['national', 'liberia', 'lbr', 'lr', 'total', 'allcounties', 'country', 'nationwide', 'nationaltotal', 'republicofliberia']);

// the open-data series whose definition is the same as an NIIS indicator's (Q07): offered as matches, never guessed
const WB_SUGGESTIONS = [
  { series: 'IT.NET.USER.ZS', code: 'internet_penetration', name: 'Individuals using the Internet (% of population)' },
  { series: 'IT.CEL.SETS.P2', code: 'mobile_subscriptions', name: 'Mobile cellular subscriptions (per 100 people)' },
  { series: 'IT.NET.BBND.P2', code: 'fixed_broadband_subs', name: 'Fixed broadband subscriptions (per 100 people)' },
];
const WB_TO_CODE = new Map(WB_SUGGESTIONS.map((s) => [s.series.toLowerCase(), s.code]));

// refs: { indicators: [{ code, name, unit }], counties: [{ id, name }] } -> lookup maps, built once per request
function makeRefs({ indicators, counties }) {
  const byCode = new Map(indicators.map((i) => [i.code.toLowerCase(), i]));
  const byName = new Map();
  indicators.forEach((i) => { byName.set(key(i.name), i); byName.set(key(i.code), i); });
  const countyByKey = new Map(counties.map((c) => [key(c.name), c]));
  for (const [k, n] of Object.entries(COUNTY_ALIASES)) { const c = counties.find((x) => x.name === n); if (c) countyByKey.set(k, c); }
  return { indicators, counties, byCode, byName, countyByKey };
}
function matchIndicator(text, refs) {
  const t = String(text || '').trim();
  if (!t) return null;
  const lc = t.toLowerCase();
  if (refs.byCode.has(lc)) return refs.byCode.get(lc).code;
  if (WB_TO_CODE.has(lc)) return WB_TO_CODE.get(lc);
  const k = key(t);
  if (refs.byName.has(k)) return refs.byName.get(k).code;
  return null;
}
function matchCounty(text, refs) {
  const k = key(String(text || '').replace(/\bcounty\b/i, ''));
  if (!k) return null;
  if (NATIONAL_KEYS.has(k)) return { level: 'national', county_id: null };
  const c = refs.countyByKey.get(k) || refs.countyByKey.get(k.replace(/county$/, ''));
  return c ? { level: 'county', county_id: c.id, name: c.name } : null;
}

// a header row: the row near the top with the most cells NIIS recognises
function findHeaderRow(rows, refs) {
  let best = -1, bestScore = 0;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r] || [];
    let score = 0;
    for (const c of cells) {
      const n = norm(c);
      if (!n) continue;
      if (Object.values(ROLE_RE).some((re) => re.test(n)) || YEAR_HEAD.test(String(c).trim())) score += 2;
      else if (matchCounty(c, refs) && matchCounty(c, refs).level === 'county') score += 1;
      else if (matchIndicator(c, refs)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = r; }
  }
  if (best < 0) best = rows.findIndex((r) => r.some((c) => c));
  return Math.max(0, best);
}

// detectMapping(rows, refs) -> { headerRow, headers, layout, cols, melt, missing }
function detectMapping(rows, refs) {
  const headerRow = findHeaderRow(rows, refs);
  const headers = (rows[headerRow] || []).map((h) => String(h || '').trim());
  const cols = {};
  for (const role of Object.keys(ROLE_RE)) {
    const hits = headers.map((h, i) => [norm(h), i]).filter(([h]) => ROLE_RE[role].test(h));
    if (!hits.length) continue;
    const pref = ROLE_PREF[role];
    hits.sort((a, b) => (pref ? (pref.indexOf(a[0]) + 1 || 99) - (pref.indexOf(b[0]) + 1 || 99) : 0));
    // a column already taken by an earlier role is not reused
    const free = hits.find(([, i]) => !Object.values(cols).includes(i));
    if (free) cols[role] = free[1];
  }
  const yearCols = headers.map((h, i) => (YEAR_HEAD.test(h) ? i : -1)).filter((i) => i >= 0);
  const countyCols = headers.map((h, i) => { const m = matchCounty(h, refs); return m && m.level === 'county' ? i : -1; }).filter((i) => i >= 0);
  const indCols = headers.map((h, i) => (i !== cols.indicator && matchIndicator(h, refs) && !YEAR_HEAD.test(h) ? i : -1)).filter((i) => i >= 0);
  let layout = 'long', melt = [];
  if (cols.value == null) {
    if (yearCols.length) { layout = 'wide_year'; melt = yearCols; }
    else if (countyCols.length >= 2) { layout = 'wide_county'; melt = countyCols; }
    else if (indCols.length) { layout = 'wide_indicator'; melt = indCols; }
  }
  return { headerRow, headers, layout, cols, melt, missing: missingRoles({ layout, cols }) };
}
function missingRoles({ layout, cols }, defaults = {}) {
  const miss = [];
  if (cols.indicator == null && layout !== 'wide_indicator' && !defaults.indicator) miss.push('indicator');
  if (cols.year == null && layout !== 'wide_year' && !defaults.year) miss.push('year');
  if (cols.value == null && layout === 'long' && (cols.numerator == null || cols.denominator == null)) miss.push('value');
  return miss;
}

// one record per figure in the table, as text, with its spreadsheet row number
function extractRecords(rows, m) {
  const out = [];
  const cell = (r, i) => (i == null ? '' : String(r[i] == null ? '' : r[i]).trim());
  for (let r = m.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some((c) => String(c || '').trim())) continue;
    const base = {
      row_no: r + 1,
      indicator_text: cell(row, m.cols.indicator), county_text: cell(row, m.cols.county), period_text: cell(row, m.cols.year),
      value_text: cell(row, m.cols.value), numerator_text: cell(row, m.cols.numerator), denominator_text: cell(row, m.cols.denominator),
      unit_text: cell(row, m.cols.unit), source: cell(row, m.cols.source), breakdown: cell(row, m.cols.breakdown),
    };
    if (m.layout === 'long' || !m.melt.length) { out.push(base); continue; }
    for (const i of m.melt) {
      const head = m.headers[i];
      const rec = { ...base, value_text: cell(row, i) };
      if (m.layout === 'wide_year') rec.period_text = (YEAR_HEAD.exec(head) || [])[1] || head;
      if (m.layout === 'wide_county') rec.county_text = head;
      if (m.layout === 'wide_indicator') rec.indicator_text = head;
      out.push(rec);
    }
  }
  return out;
}

// ---------------------------------------------------------------- reading one figure
const NO_DATA = /^(\.\.|\.|-|–|—|n\/?a|na|nd|n\.a\.|none|null|no data|x|\*|:|…)$/i;
function parseNumber(t) {
  if (t == null) return { value: null, blank: true };
  const raw = String(t).replace(/[  ]/g, ' ').trim();
  if (raw === '' || NO_DATA.test(raw)) return { value: null, blank: true };
  let s = raw, neg = false, note = '';
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/^(us\$|usd|l\$|lrd|\$)\s*/i, '').replace(/\s*(%|percent|pct)$/i, '').replace(/\s+/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d{1,2}$/.test(s)) { s = s.replace(',', '.'); note = 'decimal comma'; }
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return { value: null, bad: true };
  let v = Number(s);
  if (neg) v = -v;
  if (!Number.isFinite(v)) return { value: null, bad: true };
  if (raw !== String(v)) note = `"${raw}" read as ${v}` + (note ? ' (' + note + ')' : '');
  return { value: v, note };
}
function parseYear(t) {
  if (t == null) return {};
  const s = String(t).trim();
  if (!s) return {};
  let m;
  if ((m = /^(\d{4})(\.0+)?$/.exec(s))) return { year: Number(m[1]) };
  if ((m = /^(\d{4})\s*\[yr\d{4}\]$/i.exec(s))) return { year: Number(m[1]) };
  if ((m = /^(\d{4})\s*[-/ ]?\s*q([1-4])$/i.exec(s)) || (m = /^q([1-4])\s*[-/ ]?\s*(\d{4})$/i.exec(s))) {
    const y = Number(m[1].length === 4 ? m[1] : m[2]), q = Number(m[1].length === 4 ? m[2] : m[1]);
    return { year: y, quarter: q };
  }
  if ((m = /^(?:fy\s*)?(\d{4})\s*[/-]\s*(\d{2}|\d{4})$/i.exec(s))) {
    const a = Number(m[1]); const b = m[2].length === 2 ? Math.floor(a / 100) * 100 + Number(m[2]) : Number(m[2]);
    if (b === a + 1) return { year: b, note: `fiscal year ${s} read as ${b}` };
  }
  if ((m = /^fy\s*(\d{4})$/i.exec(s))) return { year: Number(m[1]), note: `${s} read as ${m[1]}` };
  if ((m = /^(\d{4})-(\d{2})(-\d{2})?/.exec(s))) return { year: Number(m[1]), note: `date ${s} read as the year ${m[1]}` };
  if ((m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s))) return { year: Number(m[3]), note: `date ${s} read as the year ${m[3]}` };
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const y = new Date(Math.round((n - 25569) * 86400000)).getUTCFullYear();
    return { year: y, note: `Excel date ${s} read as the year ${y}` };
  }
  return { bad: true };
}

// resolve(record, refs, defaults) -> a raw row, with what was recognised and why anything was not
function resolve(rec, refs, d = {}) {
  const notes = [];
  let status = 'ok';
  const reject = (n) => { notes.push(n); status = 'rejected'; };
  const flag = (n) => { notes.push(n); if (status === 'ok') status = 'flagged'; };

  const indText = rec.indicator_text || '';
  const code = indText ? matchIndicator(indText, refs) : (d.indicator || null);
  if (!code) reject(indText ? `Indicator "${indText}" is not in the NIIS catalogue` : 'No indicator given');

  let level = null, county_id = null;
  if (rec.county_text) {
    const c = matchCounty(rec.county_text, refs);
    if (!c) reject(`County "${rec.county_text}" not recognised`);
    else { level = c.level; county_id = c.county_id; if (c.level === 'county' && key(rec.county_text) !== key(c.name)) notes.push(`"${rec.county_text}" read as ${c.name}`); }
  } else if (d.county === 'national' || !d.county) { level = 'national'; }
  else { level = 'county'; county_id = Number(d.county) || null; }

  if (rec.breakdown && !/^(total|all|both|both sexes|national|overall|all ages|-)$/i.test(rec.breakdown)) {
    reject(`Breakdown "${rec.breakdown}": NIIS keeps totals only until breakdowns are added`);
  }

  const pText = rec.period_text || (d.year ? String(d.year) : '');
  const py = parseYear(pText);
  const year = py.year || null;
  if (py.bad) reject(`Period "${pText}" not read as a year`);
  else if (!year) reject('No year given');
  else if (py.quarter) reject(`Quarterly figure (Q${py.quarter} ${year}): NIIS publishes annual figures for now, so it is kept in raw data only`);
  else if (py.note) flag(py.note);

  const pv = parseNumber(rec.value_text);
  const pn = parseNumber(rec.numerator_text), pd = parseNumber(rec.denominator_text);
  if (pv.bad) reject(`Value "${rec.value_text}" is not a number`);
  if (pn.bad || pd.bad) reject('Numerator or denominator is not a number');
  const hasRatio = pn.value != null && pd.value != null;
  if (pv.value == null && !pv.bad && !hasRatio) reject('No data: left as no data, never estimated or set to zero');
  if (pv.note) flag(pv.note);

  return {
    row_no: rec.row_no,
    indicator_text: indText || null, indicator_code: code,
    county_text: rec.county_text || null, county_id, level,
    period_text: pText || null, year,
    value_text: rec.value_text || null, value: pv.value,
    numerator: pn.value, denominator: pd.value,
    unit_text: rec.unit_text || d.unit || null,
    source: rec.source || d.source || null,
    notes: notes.join('; ') || null,
    status,
  };
}

// ---------------------------------------------------------------- links: fetched with care
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.');
}
// a Google Sheets link opens as its CSV export (the sheet must be shared by link)
function feedUrl(u) {
  const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/[^#?]*)?(?:\?[^#]*)?(?:#gid=(\d+))?/.exec(u);
  if (m && !/\/export\b|output=csv/.test(u)) return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${m[2] ? '&gid=' + m[2] : ''}`;
  return u;
}
async function safeFetch(rawUrl, { headers = {} } = {}) {
  let url = feedUrl(String(rawUrl || '').trim());
  for (let hop = 0; hop < 4; hop++) {
    let u;
    try { u = new URL(url); } catch { throw new Error('That is not a web address.'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https links can be read.');
    if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new Error('That address is on a private network.');
    const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true }).catch(() => []);
    if (!addrs.length) throw new Error(`The address ${u.hostname} could not be found.`);
    if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error('That address is on a private network.');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    let res;
    try { res = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'NIIS-intake/1.0', ...headers } }); }
    catch (e) { clearTimeout(timer); throw new Error(e.name === 'AbortError' ? 'The link took too long to answer (20 s).' : 'The link could not be reached: ' + e.message); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { clearTimeout(timer); url = new URL(res.headers.get('location'), u).href; continue; }
    if (!res.ok) { clearTimeout(timer); throw new Error(`The link answered ${res.status}${res.status === 401 || res.status === 403 ? ' (it is not shared publicly)' : ''}.`); }
    const chunks = []; let size = 0;
    for await (const c of res.body) { size += c.length; if (size > MAX_BYTES) { ctl.abort(); clearTimeout(timer); throw new Error('The file at that link is larger than 4 MB.'); } chunks.push(c); }
    clearTimeout(timer);
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const name = decodeURIComponent(u.pathname.split('/').pop() || 'download') + (/csv/.test(res.headers.get('content-type') || '') && !/\.csv$/i.test(u.pathname) ? '.csv' : '');
    return { buf, name, contentType: res.headers.get('content-type') || '', finalUrl: u.href };
  }
  throw new Error('The link redirected too many times.');
}

// the World Bank's open data for Liberia: one series, as raw records (national figures)
async function worldBankSeries(series, from = 2000, to = new Date().getFullYear()) {
  const s = String(series || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._]{2,40}$/.test(s)) throw new Error('A World Bank series code looks like IT.NET.USER.ZS.');
  const { buf, finalUrl } = await safeFetch(`https://api.worldbank.org/v2/country/LBR/indicator/${s}?format=json&per_page=500&date=${Number(from)}:${Number(to)}`);
  let j;
  try { j = JSON.parse(buf.toString('utf8')); } catch { throw new Error('The World Bank answered with something that is not JSON.'); }
  if (!Array.isArray(j) || !Array.isArray(j[1])) {
    const msg = j && j[0] && j[0].message && j[0].message[0] && j[0].message[0].value;
    throw new Error(msg ? 'World Bank: ' + msg : 'The World Bank has no data for that series in Liberia.');
  }
  const name = (j[1][0] && j[1][0].indicator && j[1][0].indicator.value) || s;
  const updated = j[0] && j[0].lastupdated;
  const source = `World Bank WDI, ${s} (${name})${updated ? ', updated ' + updated : ''}`;
  const records = j[1].filter((r) => r.value != null).sort((a, b) => Number(a.date) - Number(b.date)).map((r, i) => ({
    row_no: i + 1, indicator_text: '', county_text: 'Liberia', period_text: String(r.date), value_text: String(r.value),
    numerator_text: '', denominator_text: '', unit_text: '', source, breakdown: '',
  }));
  const table = [['series', 'country', 'year', 'value'], ...j[1].map((r) => [s, 'Liberia', String(r.date), r.value == null ? '' : String(r.value)])];
  return { series: s, name, updated, source, records, table, url: finalUrl, raw: buf, empty: j[1].length - records.length };
}

// ---------------------------------------------------------------- small things
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const batchRef = () => 'B-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
const toCsv = (rows) => rows.map((r) => r.map((c) => { const s = String(c == null ? '' : c); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');

module.exports = {
  MAX_BYTES, readTable, parseDelimited, detectMapping, missingRoles, extractRecords, resolve, makeRefs,
  matchIndicator, matchCounty, parseNumber, parseYear, personalColumns, safeFetch, feedUrl, worldBankSeries,
  WB_SUGGESTIONS, sha256, batchRef, toCsv, key,
};
