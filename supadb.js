// supadb.js — minimal PostgREST client for the NIIS server (zero npm dependencies, Node >= 18 fetch).
// The key stays server-side: supabase-config.json is at the project root, outside the /public static dir.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Settings come from the environment first (how a host such as Vercel supplies them), then from
// supabase-config.json, which only exists on a development machine (it is gitignored).
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'supabase-config.json'), 'utf8')); } catch { /* none on a host */ }
const BASE = process.env.SUPABASE_URL || CFG.url;

// Server credential. With RLS enabled the server must use a secret key (it bypasses RLS);
// the publishable key only works while RLS is off. Prefer the environment so the secret
// never sits in a file: SUPABASE_SECRET_KEY, else "secretKey" in supabase-config.json, and only
// then a publishable key (SUPABASE_KEY, else "key" in the file).
const KEY = process.env.SUPABASE_SECRET_KEY || CFG.secretKey || process.env.SUPABASE_KEY || CFG.key;
if (!BASE || !KEY) {
  throw new Error('[supadb] Supabase is not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY, or add supabase-config.json.');
}

// Review mode (NICTD_REVIEW=1, the shared preview deployment) only ever reads. Selects are GETs;
// the read-only functions are POSTs by protocol, so they are named here (all are STABLE in the
// database, which Postgres will not let write). Every other call is refused before it is sent.
const REVIEW = process.env.NICTD_REVIEW === '1';
const READ_RPCS = new Set(['all_years', 'analytics_summary', 'explorer_table', 'growth_gaps', 'portal_stats']);
const readOnlyCall = (method, pathq) => method === 'GET'
  || (method === 'POST' && READ_RPCS.has((/^rpc\/([a-z_]+)/.exec(pathq) || [])[1]));
const KEY_KIND = KEY.startsWith('sb_secret_') ? 'secret'
  : KEY.startsWith('sb_publishable_') ? 'publishable' : 'legacy-jwt';
if (KEY_KIND === 'publishable') {
  console.warn('[supadb] Using the publishable key. Set SUPABASE_SECRET_KEY before enabling RLS '
    + '(docs/sql/rls-lockdown.sql), or every query will return nothing.');
}
// New sb_ keys go on the apikey header only; the gateway derives Authorization from it.
// Legacy JWT keys are also sent as a Bearer token.
const AUTH_HEADERS = KEY_KIND === 'legacy-jwt'
  ? { apikey: KEY, Authorization: `Bearer ${KEY}` }
  : { apikey: KEY };

// A dropped connection should not take a page down with it. Connect timeouts and resets are
// common on a metered or mobile link, and they are transient: the same call succeeds moments
// later. Read requests are safe to repeat, so they are retried with a short backoff. Writes are
// only retried when the connection failed before the request could be sent, so a row is never
// inserted twice.
const TRANSIENT = new Set([
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'ECONNRESET', 'ETIMEDOUT',
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_HEADERS_TIMEOUT',
]);
const isTransient = (e) => {
  const code = (e && (e.code || (e.cause && e.cause.code))) || '';
  return TRANSIENT.has(code) || /fetch failed/i.test(e && e.message || '');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(method, pathq, body, extraHeaders = {}, attempt = 0) {
  if (REVIEW && !readOnlyCall(method, pathq)) {
    throw new Error(`review mode: ${method} ${pathq.split('?')[0]} refused (this deployment only reads)`);
  }
  const RETRIES = 3;
  let res;
  try {
    res = await fetch(`${BASE}/rest/v1/${pathq}`, {
      method,
      headers: {
        ...AUTH_HEADERS,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    // The request never reached the server, so repeating it cannot duplicate anything.
    if (attempt < RETRIES && isTransient(e)) {
      await sleep(250 * Math.pow(2, attempt));
      return request(method, pathq, body, extraHeaders, attempt + 1);
    }
    const err = new Error(`supabase ${method} ${pathq.split('?')[0]} unreachable after `
      + `${attempt + 1} attempt(s): ${e.message}`);
    err.code = (e.cause && e.cause.code) || e.code || 'NETWORK';
    err.transient = true;
    throw err;
  }
  if (!res.ok) {
    // 5xx from PostgREST or the gateway is worth one more try on a read.
    if (attempt < RETRIES && res.status >= 500 && method === 'GET') {
      await sleep(250 * Math.pow(2, attempt));
      return request(method, pathq, body, extraHeaders, attempt + 1);
    }
    const text = await res.text().catch(() => '');
    const err = new Error(`supabase ${method} ${pathq.split('?')[0]} -> ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// GET rows: sel('data_points?select=year,value&indicator_code=eq.x&order=year')
const sel = (q) => request('GET', q, undefined, { Prefer: 'count=none' });
// INSERT rows; pass ret=true to get inserted rows back
const ins = (table, rows, ret) => request('POST', table, rows, { Prefer: ret ? 'return=representation' : 'return=minimal' });
// UPSERT on primary key / unique constraint
const ups = (table, rows) => request('POST', table, rows, { Prefer: 'resolution=merge-duplicates,return=minimal' });
// UPDATE with a PostgREST filter string, e.g. upd('users', 'id=eq.4', { status: 'active' })
const upd = (table, filter, patch) => request('PATCH', `${table}?${filter}`, patch, { Prefer: 'return=minimal' });
// DELETE with a filter string
const del = (table, filter) => request('DELETE', `${table}?${filter}`, undefined, { Prefer: 'return=minimal' });
// Call a Postgres function: rpc('explorer_table', { p_indicator: 'x', p_year: 2025 })
const rpc = (name, args) => request('POST', `rpc/${name}`, args || {});

// value encoder for filter strings (handles spaces, commas, quotes in county names etc.)
const enc = (v) => encodeURIComponent(String(v));
// quoted in-list: inList(['Grand Bassa','Bomi']) -> in.("Grand Bassa","Bomi") url-encoded
const inList = (values) => 'in.' + encodeURIComponent('(' + values.map((v) => `"${String(v).replace(/"/g, '')}"`).join(',') + ')');

// ---- Supabase Storage, for files a host's disk cannot keep ----
// On a development machine uploads stay on disk, as before. On Vercel (whose disk is read-only), or
// with NICTD_FILES=supabase, they go to two buckets instead: "applications" (private: CVs) and
// "site-images" (public: Image Library uploads). Writing needs the secret key, which bypasses
// the buckets' row-level security.
const REMOTE_FILES = !!process.env.VERCEL || process.env.NICTD_FILES === 'supabase';
const objectUrl = (bucket, objectPath) => `${BASE}/storage/v1/object/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
async function storagePut(bucket, objectPath, data, contentType) {
  if (REVIEW) throw new Error('review mode: storage upload refused (this deployment only reads)');
  const res = await fetch(objectUrl(bucket, objectPath), {
    method: 'POST',
    headers: { ...AUTH_HEADERS, 'Content-Type': contentType, 'cache-control': 'max-age=31536000', 'x-upsert': 'false' },
    body: data,
  });
  if (!res.ok) throw new Error(`storage upload ${bucket}/${objectPath} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}
async function storageDel(bucket, objectPath) {
  if (REVIEW) throw new Error('review mode: storage delete refused (this deployment only reads)');
  const res = await fetch(objectUrl(bucket, objectPath), { method: 'DELETE', headers: AUTH_HEADERS });
  if (!res.ok && res.status !== 404) throw new Error(`storage delete ${bucket}/${objectPath} failed: ${res.status}`);
}
const storagePublicUrl = (bucket, objectPath) => `${BASE}/storage/v1/object/public/${bucket}/${objectPath}`;
// read a private object back (an original data file, a CV): the secret key reads past the bucket's policies
async function storageGet(bucket, objectPath) {
  const res = await fetch(objectUrl(bucket, objectPath), { headers: AUTH_HEADERS });
  if (!res.ok) throw new Error(`storage read ${bucket}/${objectPath} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { sel, ins, ups, upd, del, rpc, enc, inList, CFG, remoteFiles: REMOTE_FILES, storagePut, storageDel, storageGet, storagePublicUrl };
