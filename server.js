// server.js, the NIIP site (National ICT Intelligence Program of Liberia) and its data system, NIIS: HTTP server, auth,
// role-based access, public API.
// Data layer: Supabase Postgres via PostgREST (supadb.js). Zero npm dependencies. Run: node server.js
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sdb = require('./supadb');
const seedance = require('./seedance');
const imagestore = require('./imagestore');
const views = require('./views');

const PORT = process.env.PORT || 4310;
const SESSION_HOURS = 12;
// The shared review preview (NICTD_REVIEW=1, set on Vercel): public pages only, nobody signs in,
// nothing is written. supadb.js refuses any write as well, so this holds even if a route is missed.
const REVIEW = process.env.NICTD_REVIEW === '1';

// ---------- password hashing (scrypt, salt:hash hex) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// ---------- catalogue taxonomy ----------
// The 17 categories of the national indicator framework (170 indicators).
const DOMAIN_LABELS = {
  connectivity: 'Connectivity',
  access: 'Access & Digital Infrastructure',
  affordability: 'Affordability',
  inclusion: 'Digital Inclusion',
  skills: 'Digital Skills & Human Capital',
  education: 'ICT & Education',
  market: 'Digital Economy & Market Structure',
  finance: 'Digital Finance',
  government: 'Digital Government',
  trust: 'Cybersecurity, Trust & Data Governance',
  health: 'ICT & Health',
  agriculture: 'ICT & Agriculture',
  innovation: 'Innovation & Emerging Technology',
  workforce: 'ICT Employment & Workforce',
  business: 'ICT & Business Digitalization',
  sustainability: 'ICT & Sustainability',
  impact: 'ICT & National Development Impact',
};
const DOMAIN_ORDER = ['connectivity', 'access', 'affordability', 'inclusion', 'skills', 'education',
  'market', 'finance', 'government', 'trust', 'health', 'agriculture', 'innovation', 'workforce',
  'business', 'sustainability', 'impact'];
const DASHBOARDS = [
  { slug: 'connectivity', label: 'Connectivity', description: 'Internet and mobile penetration, urban/rural and gender gaps across counties.', primary: 'internet_penetration', hero: ['internet_penetration', 'mobile_subscriptions', 'fixed_broadband_subs', 'urban_connectivity'], narrative: 'Internet penetration nearly tripled between 2018 and 2025, but growth has been concentrated in Montserrado, Margibi and Grand Bassa. Rural connectivity and the gender access gap remain the two indicators furthest from national targets, and are tracked here alongside the underlying subscription series.' },
  { slug: 'mobile-broadband', label: 'Mobile & Broadband Markets', description: 'Network coverage, infrastructure rollout and the ICT business sector.', primary: 'mobile_network_coverage', hero: ['mobile_network_coverage', 'fiber_coverage', 'ict_businesses', 'mobile_money_accounts'], narrative: '4G population coverage has expanded fastest along the fiber backbone corridor. Registered ICT businesses and mobile money accounts, both market-structure indicators, have grown in step with network rollout, suggesting infrastructure investment is translating into commercial activity.' },
  { slug: 'affordability', label: 'Affordability', description: 'The cost of connecting, relative to income, and device ownership.', primary: 'mobile_basket_price', hero: ['mobile_basket_price', 'broadband_basket_price', 'smartphone_ownership', 'data_consumption'], narrative: 'The mobile data-and-voice basket has fallen from roughly 10% to around 3% of GNI per capita since 2018, the single largest affordability gain in the dataset, while fixed-broadband pricing remains comparatively high outside Montserrado.' },
  { slug: 'trust-governance', label: 'Digital Trust & Governance', description: 'Data protection, digital ID, e-government services and cybersecurity.', primary: 'data_protection_index', hero: ['data_protection_index', 'digital_id_coverage', 'egov_services_index', 'cyber_incidents_reported'], narrative: 'The data-protection framework score nearly tripled as legal instruments and institutional capacity were established. Reported cybersecurity incidents have also risen, consistent with both greater connectivity and improved incident-reporting capacity rather than a decline in security.' },
  { slug: 'sustainability', label: 'Sustainability / E-Waste', description: 'Electronic waste generation, collection and renewable energy use in the ICT sector.', primary: 'ewaste_generated', hero: ['ewaste_generated', 'ewaste_collection_rate', 'ict_renewable_energy'], narrative: 'E-waste generation per capita has risen alongside device ownership, but formal collection and recycling rates have grown faster in percentage terms, starting from a very low base in 2018.' },
  { slug: 'education', label: 'ICT in Education', description: 'School connectivity and the availability of learning devices.', primary: 'school_connectivity', hero: ['school_connectivity', 'student_device_ratio'], narrative: 'School connectivity remains the least-covered indicator in the catalogue (registered-tier access), reflecting the early stage of the Ministry of Education’s connectivity rollout. The student-to-device ratio has improved but stays far from a 1:1 target.' },
];
const dashboardBySlug = (slug) => DASHBOARDS.filter((d) => d.slug === slug)[0];

// ---------- in-memory caches over Supabase reference data ----------
const cache = {
  ready: false,
  counties: [], countyByName: new Map(), countyById: new Map(),
  indicators: [], indicatorByCode: new Map(),
  permsByRole: new Map(),   // role -> Set(permission)
  settings: new Map(),
  siteContent: new Map(),
  years: [],
  sessions: new Map(),      // token -> { user, expiresAt }
};

async function refreshCounties() {
  cache.counties = await sdb.sel('counties?select=*&order=name');
  cache.countyByName = new Map(cache.counties.map((c) => [c.name, c]));
  cache.countyById = new Map(cache.counties.map((c) => [c.id, c]));
}
async function refreshIndicators() {
  const rows = await sdb.sel('indicator_catalog?select=*&order=domain,name');
  // Every figure is credited to NIIS until the data-sharing agreements with the agencies are signed
  // (the owner's call). The database keeps each indicator's own agency (agencyOriginal here, never
  // sent out) for when they are.
  cache.indicators = rows.map((r) => ({ ...r, agency: SOURCE_NIIS, agencyOriginal: r.agency, domainLabel: DOMAIN_LABELS[r.domain] || r.domain, lastUpdated: r.last_year ? String(r.last_year) : 'n/a' }));
  cache.indicatorByCode = new Map(cache.indicators.map((i) => [i.code, i]));
}
const SOURCE_NIIS = 'National ICT Intelligence System (NIIS)';
async function refreshPerms() {
  const rows = await sdb.sel('role_permissions?select=*');
  cache.permsByRole = new Map();
  for (const r of rows) {
    if (!cache.permsByRole.has(r.role)) cache.permsByRole.set(r.role, new Set());
    cache.permsByRole.get(r.role).add(r.permission);
  }
  cache.rolePermRows = rows;
}
async function refreshSettings() {
  const rows = await sdb.sel('settings?select=*');
  cache.settings = new Map(rows.map((r) => [r.key, r.value]));
}
async function refreshSiteContent() {
  const rows = await sdb.sel('site_content?select=*');
  cache.siteContent = new Map(rows.map((r) => [r.key, r.value]));
}
async function refreshYears() {
  cache.years = await sdb.rpc('all_years');
}
async function loadCaches() {
  await Promise.all([refreshCounties(), refreshIndicators(), refreshPerms(), refreshSettings(), refreshSiteContent(), refreshYears(), imagestore.refresh()]);
  cache.ready = true;
  console.log(`Caches loaded: ${cache.counties.length} counties, ${cache.indicators.length} indicators, ${cache.years.length} years`);
}

// ---------- helpers ----------
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}
// Binary safe body reader, for image uploads. readBody() concatenates onto a string,
// which would corrupt the bytes.
function readBodyBuffer(req, limit = 10e6) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { req.destroy(); reject(new Error('Upload is too large.')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// Careers applications: CVs live outside /public and are never served by the static handler.
// The demonstration papers and updates the database was first seeded with. The public pages leave them
// out (the owner asked for no more placeholders) until they are deleted in the admin screens, where
// they still show; anything else entered there is published as usual.
const SEEDED = {
  papers: new Set(['State of Connectivity in Liberia 2025', 'The Urban-Rural Connectivity Gap: County Evidence',
    'Mobile Money and Financial Inclusion in Liberia', 'Digital Trust and Governance: A Baseline']),
  updates: new Set(['2025 annual indicator refresh published', 'Internet penetration passes one third of the population',
    'Digital Trust & Governance dashboard launched', 'Operator data-sharing feeds onboarded', 'Data Query builder and public API v1 released']),
};
// Partners the owner added (2026-10-20) ahead of their entry in the database. Each shows on Our Partners
// once its logo is supplied (Image Library, Partner logos); an entry with the same slug in the database wins.
const ADDED_PARTNERS = [
  { slug: 'prinstine', name: 'Prinstine Group' },
  { slug: 'dw-consultancy', name: 'D & W Consultancy' },
  { slug: 'afriktech', name: 'Afriktech Solutions' },
  { slug: 'gonet', name: 'Gonet Academy' },
  { slug: 'ul', name: 'University of Liberia' },
];
const notSeeded = (kind, rows) => (rows || []).filter((r) => !SEEDED[kind].has(String(r.title || '').trim()));
const APPLY_DIR = path.join(__dirname, 'data', 'applications');
const CV_MAX = 4 * 1024 * 1024;   // under the 4.5 MB request limit of a hosted function (Vercel)
const CV_TYPES = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const applyLog = new Map();   // ip -> recent submission times, a light brake on repeat sends
const APPLY_LOG = path.join(APPLY_DIR, 'applications.jsonl');
// The reference an applicant keeps: the date sent and four random hex digits, e.g. NIIP-261003-7F3A
const applicationRef = () => 'NIIP-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
// The CV's real kind from its first bytes, so a renamed file is caught: PDF, legacy Word (OLE)
// or .docx (a zip). Returns the extension to store it under, or null.
function cvKind(name, buf) {
  const ext = (/\.([a-z0-9]+)$/i.exec(String(name || '')) || [])[1];
  const lower = ext ? ext.toLowerCase() : '';
  if (!buf || buf.length < 8) return null;
  if (lower === 'pdf' && buf.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (lower === 'doc' && buf.readUInt32BE(0) === 0xD0CF11E0) return 'doc';
  if (lower === 'docx' && buf[0] === 0x50 && buf[1] === 0x4B) return 'docx';
  return null;
}
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s.replace(/%[0-9A-Fa-f]{2}/g, (m) => { try { return decodeURIComponent(m); } catch { return '�'; } }); }
}
function parseForm(body) {
  const out = {};
  for (const pair of body.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = safeDecode(pair.slice(0, i).replace(/\+/g, ' '));
    out[k] = safeDecode(pair.slice(i + 1).replace(/\+/g, ' '));
  }
  return out;
}
const getSetting = (key) => cache.settings.get(key) || null;
async function setSetting(key, value) {
  await sdb.ups('settings', [{ key, value }]);
  cache.settings.set(key, value);
}
const getContent = (key, fallback = '') => cache.siteContent.get(key) || fallback;
async function setContent(key, value) {
  await sdb.ups('site_content', [{ key, value, updated_at: new Date().toISOString() }]);
  cache.siteContent.set(key, value);
}

async function currentUser(req) {
  const token = parseCookies(req).nictd_session;
  if (!token || REVIEW) return null;
  const hit = cache.sessions.get(token);
  if (hit) {
    if (hit.expiresAt > Date.now()) return hit.user;
    cache.sessions.delete(token);
  }
  const rows = await sdb.rpc('auth_session', { p_token: token });
  const user = rows && rows[0];
  if (!user) return null;
  cache.sessions.set(token, { user, expiresAt: Date.now() + 60 * 1000 }); // 60s local cache; hard expiry enforced in SQL
  return user;
}
function hasPerm(user, perm) {
  if (!user) return false;
  const set = cache.permsByRole.get(user.role);
  return !!(set && set.has(perm));
}
function accessLevels(user) {
  const levels = ['public'];
  if (hasPerm(user, 'view_registered_data')) levels.push('registered');
  if (hasPerm(user, 'view_stakeholder_data')) levels.push('stakeholder');
  return levels;
}
function logEvent(kind, p, user) {
  sdb.ins('events', [{ kind, path: p, role: user ? user.role : null }]).catch(() => {});
}
// Pages may not be framed by other sites. The Embed button is gone from the Data Explorer;
// this is what actually stops someone iframing our pages into theirs.
const FRAME_GUARD = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Content-Type-Options': 'nosniff',
};
// The project is NIIS, the National ICT Intelligence System. Records written under the old name
// (NICTD, the National ICT Database) still sit in the database; every page shows them under the
// current one. Only whole words change: NICTD inside an identifier (__NICTD_PAGE__) is left alone.
function currentName(html) {
  return html.replace(/National ICT Database(?: of Liberia)?(?: Project)?/g, 'National ICT Intelligence System').replace(/\bNICTD\b/g, 'NIIS');
}
function send(res, status, body, headers = {}) {
  const type = headers['Content-Type'] || 'text/html; charset=utf-8';
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...FRAME_GUARD, ...headers });
  res.end(typeof body === 'string' && type.startsWith('text/html') ? currentName(body) : body);
}
function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj, null, 1));
}
function redirect(res, to, extraHeaders = {}) {
  res.writeHead(302, { Location: to, ...extraHeaders });
  res.end();
}
function sessionCookie(token, maxAgeSec) {
  return `nictd_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

// ---------- data access ----------
function listIndicators(user) {
  const levels = new Set(accessLevels(user));
  return cache.indicators.filter((i) => levels.has(i.access_level));
}
function indicatorsByDomainMap(indicators) {
  const map = {};
  indicators.forEach((i) => { (map[i.domain] = map[i.domain] || []).push(i); });
  return map;
}
async function nationalSeries(code) {
  return sdb.sel(`data_points?select=year,value&indicator_code=eq.${sdb.enc(code)}&county_id=is.null&order=year`);
}
async function countySeriesByName(code, countyName) {
  const c = cache.countyByName.get(countyName);
  if (!c) return [];
  return sdb.sel(`data_points?select=year,value&indicator_code=eq.${sdb.enc(code)}&county_id=eq.${c.id}&order=year`);
}
async function countyValuesForYear(code, year) {
  const rows = await sdb.rpc('explorer_table', { p_indicator: code, p_year: year });
  return rows.map((r) => ({ county: r.county, value: r.value, yoy: r.yoy }));
}
async function latestNational(code) {
  const rows = await sdb.sel(`data_points?select=year,value&indicator_code=eq.${sdb.enc(code)}&county_id=is.null&order=year.desc&limit=1`);
  return rows[0] || null;
}
async function lastUpdated() {
  const rows = await sdb.sel('data_points?select=updated_at&order=updated_at.desc&limit=1');
  return rows[0] ? rows[0].updated_at : null;
}

function toCSV(rows, cols) {
  const escv = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => escv(r[c])).join(','))].join('\n');
}
async function openDataRows(user, indicatorFilter, countyFilter, yearFilter) {
  let q = `data_export?select=indicator_code,indicator,domain,unit,county,year,value,source&access_level=${sdb.inList(accessLevels(user))}`;
  if (indicatorFilter) q += `&indicator_code=eq.${sdb.enc(indicatorFilter)}`;
  if (countyFilter) q += `&county=eq.${sdb.enc(countyFilter)}`;
  if (yearFilter) q += `&year=eq.${Number(yearFilter)}`;
  q += '&order=indicator_code,year,county&limit=20000';
  return creditNIIS(await sdb.sel(q));
}
// Downloads credit NIIS as the source of every row too, until the data-sharing agreements are signed;
// demonstration figures keep saying so.
function creditNIIS(rows) {
  return rows.map((r) => ({ ...r, source: SOURCE_NIIS + (/demonstration/i.test(String(r.source || '')) ? ' (demonstration data)' : '') }));
}
function validateSubmission(code, value) {
  const ind = cache.indicatorByCode.get(code);
  if (!ind) return { ok: false, note: 'Unknown indicator.' };
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return { ok: false, note: 'FLAG: value is not a non-negative number.' };
  if (ind.unit.startsWith('%') && v > 100) return { ok: false, note: 'FLAG: percentage above 100, held for review.' };
  if (ind.code === 'mobile_subscriptions' && v > 160) return { ok: false, note: 'FLAG: value exceeds plausible range for per-100 indicator, held for review.' };
  return { ok: true, note: 'Automated validation passed (within expected range).' };
}
// CSV bulk upload parser: indicator_code,county(name or blank/National),year,value[,source]
function parseBulkCsv(text) {
  const rows = [];
  const errors = [];
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let li = 0; li < lines.length; li++) {
    if (li === 0 && /indicator/i.test(lines[li]) && /year/i.test(lines[li])) continue; // header row
    const parts = lines[li].split(',').map((s) => s.trim());
    if (parts.length < 4) { errors.push(`line ${li + 1}: expected indicator,county,year,value`); continue; }
    const [code, countyName, yearS, valueS, source] = parts;
    const ind = cache.indicatorByCode.get(code);
    if (!ind) { errors.push(`line ${li + 1}: unknown indicator "${code}"`); continue; }
    let county_id = null;
    if (countyName && countyName.toLowerCase() !== 'national') {
      const c = cache.countyByName.get(countyName);
      if (!c) { errors.push(`line ${li + 1}: unknown county "${countyName}"`); continue; }
      county_id = c.id;
    }
    const year = Number(yearS), value = Number(valueS);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) { errors.push(`line ${li + 1}: bad year "${yearS}"`); continue; }
    if (!Number.isFinite(value)) { errors.push(`line ${li + 1}: bad value "${valueS}"`); continue; }
    rows.push({ indicator: code, county_id, year, value, source: source || 'Content Studio bulk upload' });
  }
  return { rows, errors };
}

// ---------- ETL heartbeat (simulated scheduled sync) ----------
if (!REVIEW) setInterval(() => { setSetting('last_etl_sync', new Date().toISOString()).catch(() => {}); }, 5 * 60 * 1000).unref();

// ---------- static files ----------
const MIME = { '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.otf': 'font/otf', '.ttf': 'font/ttf', '.mjs': 'text/javascript', '.pdf': 'application/pdf' };
function serveStatic(res, relPath) {
  const full = path.join(__dirname, 'public', path.normalize(relPath).replace(/^([.][.][\\/])+/, ''));
  if (!full.startsWith(path.join(__dirname, 'public'))) return send(res, 403, 'Forbidden');
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, views.notFound(null));
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'max-age=300' });
  });
}

// ---------- router ----------
// One handler serves both ways the site runs: `node server.js` listens with it (below), and on
// Vercel api/index.js hands every non-static request to it.
async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  try {
    // ----- static -----
    if (p.startsWith('/assets/')) return serveStatic(res, p.slice('/assets/'.length));
    if (p.startsWith('/media/generated/') && p.endsWith('.mp4')) return serveStatic(res, p.slice(1));
    if (p.startsWith('/media/') && /\.(svg|mp4|webm|jpe?g|png)$/.test(p)) return serveStatic(res, p.slice(1));
    if (p.startsWith('/img/') && /\.(png|webp|jpe?g|svg)$/.test(p)) return serveStatic(res, p.slice(1));

    if (REVIEW) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 403, views.errorPage(null, 'This is a review preview of NIIP: signing in and sending forms are turned off.'));
      }
    }
    // a fresh serverless instance waits for its first load instead of turning the visitor away
    if (!cache.ready) {
      try { await ready; } catch { return send(res, 503, '<h1>NIIP is starting up…</h1><p>Connecting to the database. Refresh in a moment.</p>'); }
    }
    imagestore.refreshIfStale();

    const user = await currentUser(req);
    const ctx = { user, perms: user ? [...(cache.permsByRole.get(user.role) || [])] : [],
      // the site's own address, for share links (Vercel says https in x-forwarded-proto)
      origin: `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers.host || 'localhost'}` };
    if (user && (hasPerm(user, 'messaging') || hasPerm(user, 'admin_inbox'))) {
      const badges = await sdb.rpc('user_badges', { p_user_id: user.id, p_is_admin: hasPerm(user, 'admin_inbox') });
      ctx.unreadMsgs = badges.unreadMsgs || 0;
      ctx.unreadInbox = badges.unreadInbox || 0;
    }
    // badge: papers awaiting review (admins only)
    if (user && hasPerm(user, 'manage_content')) {
      const pend = await sdb.sel('papers?select=id&status=eq.submitted&deleted=eq.false');
      ctx.paperReview = pend.length;
    }

    // ================= PUBLIC API v1 =================
    if (p.startsWith('/api/v1/')) {
      logEvent(p.includes('/download/') ? 'download' : 'api_call', p, user);

      if (p === '/api/v1/indicators') {
        return json(res, 200, { data: listIndicators(user).map(({ code, name, domain, domainLabel, dashboard, unit, description, methodology, agency, periodicity, access_level, coverage, lastUpdated }) => ({ code, name, domain, domainLabel, dashboard, unit, description, methodology, agency, periodicity, access_level, coverage, lastUpdated })) });
      }
      if (p === '/api/v1/counties') {
        return json(res, 200, { data: cache.counties.map(({ id, name, capital, population, area_km2 }) => ({ id, name, capital, population, area_km2 })) });
      }
      if (p === '/api/v1/data') {
        const ind = url.searchParams.get('indicator');
        if (ind) {
          const meta = cache.indicatorByCode.get(ind);
          if (!meta) return json(res, 404, { error: 'unknown_indicator' });
          if (!accessLevels(user).includes(meta.access_level)) return json(res, 403, { error: 'access_restricted', detail: `Indicator requires ${meta.access_level} access. Authenticate with an authorized account.` });
        }
        const rows = await openDataRows(user, ind, url.searchParams.get('county'), url.searchParams.get('year'));
        return json(res, 200, { count: rows.length, note: 'county=null rows are national aggregates', data: rows });
      }
      if (p === '/api/v1/explorer') {
        const code = url.searchParams.get('indicator');
        const meta = cache.indicatorByCode.get(code);
        if (!meta) return json(res, 404, { error: 'unknown_indicator' });
        if (!accessLevels(user).includes(meta.access_level)) return json(res, 403, { error: 'access_restricted' });
        const years = cache.years;
        const year = Number(url.searchParams.get('year')) || years[years.length - 1];
        const focus = url.searchParams.get('focus') || '';
        const compare = url.searchParams.get('compare') || '';
        const [table, trendSeries, compareSeries] = await Promise.all([
          countyValuesForYear(code, year),
          focus ? countySeriesByName(code, focus) : nationalSeries(code),
          compare ? countySeriesByName(code, compare) : Promise.resolve(null),
        ]);
        return json(res, 200, {
          indicator: { code: meta.code, name: meta.name, unit: meta.unit, domain: meta.domain, domainLabel: meta.domainLabel, description: meta.description, agency: meta.agency, methodology: meta.methodology, is_mock: !!meta.is_mock, is_part_mock: !!meta.is_part_mock },
          year, years, table,
          trend: { series: trendSeries },
          compareTrend: compareSeries ? { series: compareSeries } : null,
        });
      }
      const dashM = p.match(/^\/api\/v1\/dashboards\/([a-z-]+)$/);
      if (dashM) {
        const dash = dashboardBySlug(dashM[1]);
        if (!dash) return json(res, 404, { error: 'unknown_dashboard' });
        const county = url.searchParams.get('county') || '';
        const levels = accessLevels(user);
        const heroCodes = dash.hero.filter((code) => {
          const meta = cache.indicatorByCode.get(code);
          return meta && levels.includes(meta.access_level);
        });
        const latestYear = cache.years[cache.years.length - 1];
        const [heroSeries, trendSeries, allCounty, lastUpd] = await Promise.all([
          Promise.all(heroCodes.map((code) => (county ? countySeriesByName(code, county) : nationalSeries(code)))),
          county ? countySeriesByName(dash.primary, county) : nationalSeries(dash.primary),
          countyValuesForYear(dash.primary, latestYear),
          lastUpdated(),
        ]);
        const heroStats = heroCodes.map((code, i) => {
          const meta = cache.indicatorByCode.get(code);
          const series = heroSeries[i];
          const latest = series[series.length - 1];
          return { code, name: meta.name, unit: meta.unit, value: latest ? latest.value : null };
        });
        const primaryMeta = cache.indicatorByCode.get(dash.primary);
        const ranking = { top: allCounty.slice(0, 5), bottom: allCounty.slice(-5).reverse() };
        return json(res, 200, {
          topic: dash.slug, scope: county || 'National', last_etl_sync: getSetting('last_etl_sync'), last_data_update: lastUpd,
          heroStats, trend: { code: dash.primary, name: primaryMeta.name, unit: primaryMeta.unit, series: trendSeries }, ranking,
        });
      }
      if (p === '/api/v1/query/preview' || p === '/api/v1/query') {
        const isPreview = p.endsWith('/preview');
        const codes = (url.searchParams.get('indicators') || '').split(',').filter(Boolean);
        let countyNames = (url.searchParams.get('counties') || '').split(',').filter(Boolean);
        if (countyNames.length === 1 && countyNames[0] === 'all') countyNames = cache.counties.map((c) => c.name);
        const yf = Number(url.searchParams.get('year_from')) || 2018;
        const yt = Number(url.searchParams.get('year_to')) || 2100;
        if (!codes.length || !countyNames.length) {
          return isPreview ? json(res, 200, { count: 0, rows: [] }) : json(res, 400, { error: 'indicators and counties are required' });
        }
        const q = `data_export?select=indicator_code,indicator,unit,county,year,value,source&access_level=${sdb.inList(accessLevels(user))}` +
          `&indicator_code=${sdb.inList(codes)}&county=${sdb.inList(countyNames)}&year=gte.${yf}&year=lte.${yt}&order=indicator,county,year&limit=20000`;
        const rows = creditNIIS(await sdb.sel(q));
        if (isPreview) return json(res, 200, { count: rows.length, rows: rows.slice(0, 500) });
        const format = url.searchParams.get('format') || 'csv';
        if (format === 'json') return json(res, 200, { dataset: 'niis-query', count: rows.length, data: rows });
        const csv = toCSV(rows, ['indicator_code', 'indicator', 'unit', 'county', 'year', 'value', 'source']);
        const ext = format === 'xlsx' ? 'xls' : 'csv';
        const ctype = format === 'xlsx' ? 'application/vnd.ms-excel' : 'text/csv; charset=utf-8';
        return send(res, 200, csv, { 'Content-Type': ctype, 'Content-Disposition': `attachment; filename="niis-query.${ext}"` });
      }
      if (req.method === 'POST' && p === '/api/v1/query/save') {
        if (!user) return json(res, 401, { error: 'login required' });
        const body = JSON.parse(await readBody(req) || '{}');
        await sdb.ins('saved_queries', [{
          user_id: user.id, name: String(body.name || 'Untitled query').slice(0, 120),
          indicators: body.indicators || '', counties: body.counties || '',
          year_from: Number(body.year_from) || 2018, year_to: Number(body.year_to) || 2025,
          format: ['csv', 'json', 'xlsx'].includes(body.format) ? body.format : 'csv',
        }]);
        return json(res, 200, { ok: true });
      }
      if (p === '/api/v1/download/data.csv' || p === '/api/v1/download/data.json') {
        const rows = await openDataRows(user, url.searchParams.get('indicator'), url.searchParams.get('county'), url.searchParams.get('year'));
        if (p.endsWith('.json')) return json(res, 200, { dataset: 'niis-open-data', license: 'Open license (demonstration)', count: rows.length, data: rows });
        const csv = toCSV(rows, ['indicator_code', 'indicator', 'domain', 'unit', 'county', 'year', 'value', 'source']);
        return send(res, 200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="niis-open-data.csv"' });
      }
      return json(res, 404, { error: 'not_found', docs: '/api/docs' });
    }

    // ================= PUBLIC PAGES =================
    if (req.method === 'GET') {
      if (p === '/') {
        logEvent('page_view', p, user);
        const keyCodes = getContent('key_numbers', 'mobile_subscriptions,internet_penetration,fixed_broadband_subs,mobile_money_accounts')
          .split(',').map((s) => s.trim()).filter((c) => cache.indicatorByCode.has(c)).slice(0, 4);
        const [headlines, papers, keyLatest, lastUpd] = await Promise.all([
          sdb.sel('updates?select=*&order=published_on.desc').then((r) => notSeeded('updates', r)),
          sdb.sel('papers?select=*&status=eq.published&visible=eq.true&deleted=eq.false&order=published_on.desc&limit=4').then((r) => notSeeded('papers', r)),
          Promise.all(keyCodes.map((c) => latestNational(c))),
          lastUpdated(),
        ]);
        const keyStats = keyCodes.map((code, i) => {
          const meta = cache.indicatorByCode.get(code);
          return { code, name: meta.name, unit: meta.unit, agency: meta.agency,
            value: keyLatest[i] ? keyLatest[i].value : null, year: keyLatest[i] ? keyLatest[i].year : null };
        });
        // Featured county map: one public headline indicator, latest year, all 15 counties.
        let mapData = null;
        const mapCode = [getContent('home_map_indicator', 'internet_penetration'), ...keyCodes]
          .find((c) => cache.indicatorByCode.has(c) && cache.indicatorByCode.get(c).access_level === 'public');
        if (mapCode) {
          const meta = cache.indicatorByCode.get(mapCode);
          const nat = keyStats.find((k) => k.code === mapCode) || { value: null, year: null };
          const year = nat.year || (await latestNational(mapCode) || {}).year;
          const rows = year ? await countyValuesForYear(mapCode, year).catch(() => []) : [];
          if (rows.length) {
            mapData = { code: mapCode, name: meta.name, unit: meta.unit, definition: meta.description,
              agency: meta.agency, year, national: nat.value, rows };
          }
        }
        const indicatorsForSearch = listIndicators(user).map(({ code, name, domainLabel }) => ({ code, name, domainLabel }));
        const dashboards = DASHBOARDS.map(({ slug, label, description }) => ({ slug, label, description }));
        return send(res, 200, views.home(ctx, {
          headlines, papers, keyStats, dashboards, indicatorsForSearch, mapData,
          counties: cache.counties.map((c) => ({ name: c.name })),
          lastUpdated: lastUpd,
          heroTitle: getContent('hero_title', 'The definitive source of ICT statistics and digital-development data for Liberia.'),
          heroSub: getContent('hero_sub', ''),
          homeVideo: getContent('home_video', '/media/generated/hero.mp4'),
          homeVideoTitle: getContent('home_video_title', 'About the National ICT Intelligence Program'),
          homeVideoCaption: getContent('home_video_caption', ''),
          homeVideoPlaylist: getContent('home_video_playlist', ''),
        }));
      }
      if (p === '/about/team') {
        logEvent('page_view', p, user);
        return send(res, 200, views.team(ctx, { indicators: listIndicators(user) }));
      }
      if (p === '/about') {
        logEvent('page_view', p, user);
        return send(res, 200, views.about(ctx, { mission: getContent('about_mission', ''),
          indicatorCount: cache.indicators.length, domainCount: new Set(cache.indicators.map((x) => x.domain)).size }));
      }
      // Public paper-submission form. Open to everyone, no account required.
      if (p === '/research/submit' && req.method === 'GET') {
        logEvent('page_view', p, user);
        return send(res, 200, views.submitPaper(ctx, {
          done: url.searchParams.get('done') === '1',
          values: user ? { sub_name: user.name, sub_email: user.email, sub_org: user.organization || '' } : {},
        }));
      }
      // The research groups: a page of its own in the 8B template's design (views.researchGroup)
      if (p === '/research/group') {
        logEvent('page_view', p, user);
        return send(res, 200, views.researchGroup());
      }
      // the Research Group's other pages (How it works, Program, Join), then an area's own page: its
      // groups, their questions and members, the standards it works to
      const rgM = /^\/research\/group\/([a-z-]+)$/.exec(p);
      if (rgM) {
        const html = views.researchGroupPage(rgM[1], url.searchParams.get('area') || '') || views.researchArea(rgM[1]);
        if (!html) return send(res, 404, views.notFound(ctx));
        logEvent('page_view', p, user);
        return send(res, 200, html);
      }
      if (p === '/research') {
        logEvent('page_view', p, user);
        const canManage = hasPerm(user, 'manage_content');
        const papers = canManage
          ? await sdb.sel('papers?select=*&order=created_at.desc,published_on.desc')
          : notSeeded('papers', await sdb.sel('papers?select=*&status=eq.published&visible=eq.true&deleted=eq.false&order=published_on.desc'));
        return send(res, 200, views.research(ctx, { papers, canManage, canSubmit: !!user, notice: url.searchParams.get('notice') || '' }));
      }
      // a paper published in a journal, with its page here (views.LIBERIA_RESEARCH)
      const jpM = /^\/research\/p\/([a-z0-9-]+)$/.exec(p);
      if (jpM) {
        const jp = views.LIBERIA_RESEARCH.find((x) => x.slug === jpM[1]);
        if (!jp) return send(res, 404, views.notFound(ctx));
        logEvent('page_view', p, user);
        return send(res, 200, views.journalPaper(ctx, jp));
      }
      const paperM = p.match(/^\/research\/(\d+)$/);
      if (paperM) {
        const canManage = hasPerm(user, 'manage_content');
        const rows = await sdb.sel(`papers?select=*&id=eq.${Number(paperM[1])}`);
        const paper = rows[0];
        // non-admins may only open a live, non-deleted paper
        if (!paper || (!canManage && (paper.status !== 'published' || !paper.visible || paper.deleted || !notSeeded('papers', [paper]).length))) return send(res, 404, views.notFound(ctx));
        logEvent('page_view', p, user);
        return send(res, 200, views.paper(ctx, paper, canManage));
      }
      const dlM = p.match(/^\/papers\/(\d+)\/download$/);
      if (dlM) {
        const canManage = hasPerm(user, 'manage_content');
        const rows = await sdb.sel(`papers?select=*&id=eq.${Number(dlM[1])}`);
        const paper = rows[0];
        if (!paper) return send(res, 404, views.notFound(ctx));
        // gate downloads: must be downloadable & live (admins may always fetch)
        if (!canManage && (!paper.downloadable || paper.status !== 'published' || !paper.visible || paper.deleted)) return send(res, 403, views.forbidden(ctx));
        logEvent('download', p, user);
        const md = `# ${paper.title}\n\n**Authors:** ${paper.authors}\n**Published:** ${paper.published_on}\n\n## Abstract\n\n${paper.abstract}\n\n## Report\n\n${paper.body || ''}\n\n---\nNIIP, National ICT Intelligence Program of Liberia (demonstration document)\n`;
        return send(res, 200, md, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="paper-${paper.id}.md"` });
      }
      if (p === '/updates') {
        logEvent('page_view', p, user);
        return send(res, 200, views.updates(ctx, notSeeded('updates', await sdb.sel('updates?select=*&order=published_on.desc'))));
      }
      // one update on its own page; the slug is the title, as the homepage carousel links it. A story
      // reported elsewhere (views EXT_NEWS) has its page at the same kind of address.
      const updMatch = /^\/updates\/([a-z0-9-]+)$/.exec(p);
      if (updMatch) {
        const rows = notSeeded('updates', await sdb.sel('updates?select=*&order=published_on.desc'));
        const index = rows.findIndex((u) => views.updateSlug(u) === updMatch[1]);
        if (index < 0) {
          const story = views.extNewsIndex(updMatch[1]);
          if (story < 0) return send(res, 404, views.notFound(ctx));
          logEvent('page_view', p, user);
          return send(res, 200, views.newsStory(ctx, story));
        }
        logEvent('page_view', p, user);
        return send(res, 200, views.updatePage(ctx, { items: rows, index }));
      }

      if (p === '/data') {
        logEvent('page_view', p, user);
        const indicators = listIndicators(user);
        // the nav search lands here: the first indicator whose name or code holds the words
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        const hit = q ? indicators.find((i) => String(i.name || '').toLowerCase().includes(q) || String(i.code).includes(q.replace(/\s+/g, '_'))) : null;
        const code = url.searchParams.get('indicator') || (hit && hit.code) || indicators.find((i) => i.headline)?.code || indicators[0].code;
        const meta = indicators.find((i) => i.code === code) || indicators[0];
        const years = cache.years;
        const year = Number(url.searchParams.get('year')) || years[years.length - 1];
        return send(res, 200, views.dataExplorer(ctx, {
          indicators, indicatorsByDomain: indicatorsByDomainMap(indicators), domainOrder: DOMAIN_ORDER, domainLabels: DOMAIN_LABELS,
          meta: { ...meta, year }, counties: cache.counties,
          focus: url.searchParams.get('focus') || '', compare: url.searchParams.get('compare') || '',
        }));
      }
      if (p === '/landscape') {
        logEvent('page_view', p, user);
        const indicators = listIndicators(user);
        const code = url.searchParams.get('indicator') || indicators.find((i) => i.headline)?.code || indicators[0].code;
        const meta = indicators.find((i) => i.code === code) || indicators[0];
        const years = cache.years;
        const year = Number(url.searchParams.get('year')) || years[years.length - 1];
        return send(res, 200, views.landscape(ctx, { indicators, meta, year, years, counties: cache.counties }));
      }
      if (p === '/reports') {
        logEvent('page_view', p, user);
        return send(res, 200, views.reports(ctx, { indicators: listIndicators(user), domainLabels: DOMAIN_LABELS }));
      }
      // one report on its own page, with its PDF
      const repM = /^\/reports\/([a-z0-9-]+)$/.exec(p);
      if (repM) {
        const html = views.reportPage(ctx, { slug: repM[1], indicators: listIndicators(user), domainLabels: DOMAIN_LABELS });
        if (!html) return send(res, 404, views.notFound(ctx));
        logEvent('page_view', p, user);
        return send(res, 200, html);
      }
      if (p === '/careers/programs') {
        logEvent('page_view', p, user);
        return send(res, 200, views.programs(ctx));
      }
      if (p === '/careers') {
        logEvent('page_view', p, user);
        return send(res, 200, views.careers(ctx));
      }
      // each role's own application page
      const applyMatch = /^\/careers\/apply\/([a-z0-9-]+)$/.exec(p);
      if (applyMatch) {
        const role = views.CAREER_ROLES.find((r) => views.careerSlug(r) === applyMatch[1]);
        if (!role) return send(res, 404, views.notFound(ctx));
        logEvent('page_view', p, user);
        const ref = /^(?:NIIP|NIIS|NICTD)-\d{6}-[0-9A-F]{4}$/.test(url.searchParams.get('ref') || '') ? url.searchParams.get('ref') : '';
        return send(res, 200, views.careerApply(ctx, { role, counties: cache.counties.map((c) => c.name), sent: url.searchParams.get('sent') === '1', reference: ref }));
      }
      // The Indicator Catalogue and the Data Query pages are gone: their links land on the Data
      // Explorer, a search carried over to it.
      if (p === '/indicators' || p === '/query') {
        const q = (url.searchParams.get('q') || '').trim();
        return redirect(res, '/data' + (q ? '?q=' + encodeURIComponent(q) : ''));
      }
      // Sponsors was folded into Our Partners. Keep the old link working.
      if (p === '/sponsors') return redirect(res, '/partners');
      if (p === '/partners') {
        logEvent('page_view', p, user);
        const listed = await sdb.sel('partners?select=*&visible=eq.true&order=sort_order,name');
        const partners = listed.concat(ADDED_PARTNERS.filter((a) => !listed.some((p) => p.slug === a.slug)));
        return send(res, 200, views.partners(ctx, { partners }));
      }
      // Dashboards was replaced by Our Partners in the navigation. The page itself is kept
      // below and still reachable at /dashboards-legacy, so nothing built for it is lost.
      if (p === '/dashboards' || /^\/dashboards\/[a-z-]+$/.test(p)) {
        return redirect(res, '/partners');
      }
      // one dashboards page, the title dropdown switches between them in place
      if (p === '/dashboards-legacy' || /^\/dashboards-legacy\/[a-z-]+$/.test(p)) {
        const slugFromPath = (p.match(/^\/dashboards\/([a-z-]+)$/) || [])[1];
        const initial = slugFromPath || url.searchParams.get('topic') || DASHBOARDS[0].slug;
        if (slugFromPath && !dashboardBySlug(slugFromPath)) return send(res, 404, views.notFound(ctx));
        logEvent('page_view', p, user);
        return send(res, 200, views.dashboardsIndex(ctx, {
          dashboards: DASHBOARDS.map(({ slug, label, description, narrative }) => ({ slug, label, description, narrative })),
          counties: cache.counties, initial,
        }));
      }

      if (p === '/api/docs') { logEvent('page_view', p, user); return send(res, 200, views.apiDocs(ctx)); }
      if (p === '/login') return send(res, 200, views.login(ctx, {}));
      if (p === '/register') return send(res, 200, views.register(ctx, {}));
    }

    // ----- auth actions -----
    if (req.method === 'POST' && p === '/login') {
      const f = parseForm(await readBody(req));
      const rows = await sdb.sel(`users?select=*&email=eq.${sdb.enc((f.email || '').trim().toLowerCase())}`);
      const u = rows[0];
      if (!u || !verifyPassword(f.password || '', u.password_hash)) {
        return send(res, 401, views.login(ctx, { error: 'Invalid email or password.' }));
      }
      if (u.status === 'pending') return send(res, 403, views.login(ctx, { error: 'Your account is awaiting verification by an administrator.' }));
      if (u.status === 'suspended') return send(res, 403, views.login(ctx, { error: 'This account is suspended. Contact the ICT Statistics & Policy Unit.' }));
      const token = crypto.randomBytes(32).toString('hex');
      await sdb.ins('sessions', [{ token, user_id: u.id, expires_at: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString() }]);
      cache.sessions.set(token, { user: u, expiresAt: Date.now() + 60 * 1000 });
      return redirect(res, '/portal', { 'Set-Cookie': sessionCookie(token, SESSION_HOURS * 3600) });
    }
    // "Request Access": public applicants submit the data needed for credentials; admin reviews in the portal
    if (req.method === 'POST' && p === '/register') {
      const f = parseForm(await readBody(req));
      const email = (f.email || '').trim().toLowerCase();
      if (!f.name || !email || !/.+@.+\..+/.test(email) || !(f.organization || '').trim()) {
        return send(res, 400, views.register(ctx, { error: 'Full name, a valid email and your organization are required.', form: f }));
      }
      const existing = await sdb.sel(`users?select=id&email=eq.${sdb.enc(email)}`);
      if (existing.length) return send(res, 400, views.register(ctx, { error: 'An account with this email already exists, try logging in instead.', form: f }));
      const dupe = await sdb.sel(`access_requests?select=id&email=eq.${sdb.enc(email)}&status=eq.pending`);
      if (dupe.length) return send(res, 400, views.register(ctx, { error: 'A request for this email is already awaiting review.', form: f }));
      await sdb.ins('access_requests', [{
        name: f.name.trim().slice(0, 120), email, organization: (f.organization || '').trim().slice(0, 160),
        phone: (f.phone || '').trim().slice(0, 40),
        role_requested: f.role_requested === 'stakeholder' ? 'stakeholder' : 'public',
        purpose: (f.purpose || '').trim().slice(0, 1000),
      }]);
      logEvent('page_view', '/register/submitted', user);
      return send(res, 200, views.register(ctx, { success: 'Request received. The administration team will review it and create your account, you will receive your credentials from them directly.' }));
    }
    if (req.method === 'POST' && p === '/logout') {
      const token = parseCookies(req).nictd_session;
      if (token) {
        cache.sessions.delete(token);
        await sdb.del('sessions', `token=eq.${sdb.enc(token)}`);
      }
      return redirect(res, '/', { 'Set-Cookie': 'nictd_session=; Path=/; Max-Age=0' });
    }

    // Public paper submission: submitter bio data + contact email, then the paper.
    // Lands in `papers` with status 'submitted' so it joins the existing admin review queue.
    if (p === '/research/submit' && req.method === 'POST') {
      const f = parseForm(await readBody(req));
      const t = (k, n) => (f[k] || '').trim().slice(0, n);
      const errors = [];
      // The form is short: name, email, institution, a summary and the paper itself (pasted). The
      // paper's first line becomes its title and the submitter its author, for the review queue.
      const name = t('sub_name', 120);
      const email = t('sub_email', 180);
      const abstract = t('abstract', 1200);
      const body = (f.body || '').trim().slice(0, 20000);
      const title = (body.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || abstract).slice(0, 240);
      const authors = name.slice(0, 200);

      if (!name) errors.push({ field: 'sub_name', message: 'Your full name is required.' });
      if (!email) errors.push({ field: 'sub_email', message: 'An email address is required.' });
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push({ field: 'sub_email', message: 'That email address does not look valid.' });
      if (!abstract) errors.push({ field: 'abstract', message: 'A short summary of the paper is required.' });
      if (!body) errors.push({ field: 'body', message: 'Paste your paper.' });

      if (errors.length) {
        return send(res, 400, views.submitPaper(ctx, { errors, values: f }));
      }

      await sdb.ins('papers', [{
        title, authors, abstract, body,
        tag: 'Report',
        published_on: new Date().toISOString().slice(0, 10),
        status: 'submitted', visible: false, deleted: false, downloadable: true,
        submitted_by: user ? user.id : null, submitter_name: name,
        submitter_email: email,
        submitter_org: t('sub_org', 160) || null,
      }]);
      logEvent('paper_submitted', p, user);
      return redirect(res, '/research/submit?done=1');
    }

    // Careers application: the form fields plus a CV. The CV is written to data/applications/
    // (outside /public, never served) and only its stored name goes into job_applications,
    // a table the public API may insert into but not read (docs/sql/job-applications.sql).
    if (p === '/careers/apply' && req.method === 'POST') {
      const counties = cache.counties.map((c) => c.name);
      const bySlug = (slug) => views.CAREER_ROLES.find((r) => views.careerSlug(r) === slug);
      // the role's own page comes back with the errors; before the body is read, the referring page names the role
      const refRole = bySlug((/\/careers\/apply\/([a-z0-9-]+)/.exec(String(req.headers.referer || '')) || [])[1]);
      const back = (status, role, opts) => (role
        ? send(res, status, views.careerApply(ctx, { role, counties, ...opts }))
        : redirect(res, '/careers#csRoles'));
      let parts;
      const tooBig = () => back(413, refRole, { errors: [{ field: 'cv', message: 'That CV is larger than 4 MB. Please send a smaller file.' }], values: { cv_lost: true } });
      // answer an oversized upload from its declared length, before reading it, so the reply arrives
      if ((+req.headers['content-length'] || 0) > CV_MAX + 64 * 1024) { req.resume(); return tooBig(); }
      try {
        parts = imagestore.parseMultipart(await readBodyBuffer(req, CV_MAX + 64 * 1024), req.headers['content-type']) || [];
      } catch (e) {
        return tooBig();
      }
      const field = (n, max) => { const q = parts.find((x) => x.name === n && x.filename == null); return q ? q.data.toString('utf8').trim().slice(0, max) : ''; };
      const file = parts.find((x) => x.name === 'cv' && x.filename != null && x.data.length);
      const f = {
        role: field('role', 120), full_name: field('full_name', 120), email: field('email', 180), phone: field('phone', 40),
        county: field('county', 60), cover_note: field('cover_note', 2000), consent: field('consent', 10),
      };
      const role = views.CAREER_ROLES.find((r) => r.title === f.role);
      if (!role) return back(400, null);
      // a bot that fills the hidden field is told it worked, and nothing is kept
      if (field('website', 200)) return redirect(res, '/careers/apply/' + views.careerSlug(role) + '?sent=1&ref=' + applicationRef());

      const errors = [];
      if (!f.full_name) errors.push({ field: 'full_name', message: 'Your full name is required.' });
      if (!f.email) errors.push({ field: 'email', message: 'An email address is required, so the Unit can reply.' });
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) errors.push({ field: 'email', message: 'That email address does not look right.' });
      if (f.phone && !/^[0-9+()\-\s]{6,40}$/.test(f.phone)) errors.push({ field: 'phone', message: 'Use digits, spaces and + only, or leave it empty.' });
      if (!counties.includes(f.county)) errors.push({ field: 'county', message: 'Choose your county.' });
      const cv = file && cvKind(file.filename, file.data);
      if (!file) errors.push({ field: 'cv', message: 'Attach your CV as a PDF or Word file.' });
      else if (file.data.length > CV_MAX) errors.push({ field: 'cv', message: 'That CV is larger than 4 MB. Please send a smaller file.' });
      else if (!cv) errors.push({ field: 'cv', message: 'The CV must be a PDF or Word document (.pdf, .doc or .docx).' });
      if (!f.consent) errors.push({ field: 'consent', message: 'Please agree so the Unit can keep and assess your application.' });
      if (errors.length) return back(400, role, { errors, values: { ...f, cv_lost: !!file } });

      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const now = Date.now();
      const recent = (applyLog.get(ip) || []).filter((t) => now - t < 3600e3);
      if (recent.length >= 5) return back(429, role, { notice: 'Several applications were just sent from this connection. Please wait an hour and try again.', values: { ...f, cv_lost: true } });

      const stored = crypto.randomBytes(16).toString('hex') + '.' + cv;
      const dest = path.join(APPLY_DIR, stored);
      const reference = applicationRef();
      const record = {
        reference, role_title: role.title, full_name: f.full_name, email: f.email.toLowerCase(), phone: f.phone || null,
        county: f.county, cover_note: f.cover_note || null, cv_file: stored,
        cv_original_name: path.basename(String(file.filename)).slice(0, 200) || null,
      };
      try {
        if (sdb.remoteFiles) await sdb.storagePut('applications', 'cv/' + stored, file.data, CV_TYPES[cv]);
        else {
          fs.mkdirSync(APPLY_DIR, { recursive: true });
          fs.writeFileSync(dest, file.data, { flag: 'wx' });
        }
      } catch (e) {
        console.error('[careers] CV not stored:', e.message);
        return back(503, role, { failed: true, values: { ...f, cv_lost: true } });
      }
      // The application goes to job_applications. If the table is not there yet (or the database
      // cannot be reached), it is kept in a private file beside the CVs instead, so no applicant
      // is ever turned away: data/applications/applications.jsonl, one application per line.
      try {
        await sdb.ins('job_applications', [record]);
      } catch (e) {
        if (sdb.remoteFiles) {
          // hosted: there is no private disk to fall back to, so the database is the only record
          await sdb.storageDel('applications', 'cv/' + stored).catch(() => {});
          console.error('[careers] application not stored:', e.message);
          return back(503, role, { failed: true, values: { ...f, cv_lost: true } });
        }
        try {
          fs.appendFileSync(APPLY_LOG, JSON.stringify({ ...record, created_at: new Date().toISOString() }) + '\n');
          console.warn(`[careers] ${reference} kept in ${path.relative(__dirname, APPLY_LOG)} (database: ${e.message.slice(0, 120)})`);
        } catch (e2) {
          try { fs.unlinkSync(dest); } catch {}
          console.error('[careers] application not stored:', e2.message);
          return back(503, role, { failed: true, values: { ...f, cv_lost: true } });
        }
      }
      recent.push(now); applyLog.set(ip, recent);
      logEvent('application_submitted', p, user);
      return redirect(res, '/careers/apply/' + views.careerSlug(role) + '?sent=1&ref=' + reference);
    }

    // ================= AUTHENTICATED WORKSPACE =================
    if (!user) {
      if (['/portal', '/media', '/analytics', '/messages', '/admin'].some((s) => p === s || p.startsWith(s + '/'))) {
        return redirect(res, '/login');
      }
      return send(res, 404, views.notFound(ctx));
    }

    if (p === '/portal') {
      logEvent('page_view', p, user);
      const s = await sdb.rpc('portal_stats');
      const stats = {
        dataPoints: s.dataPoints, indicators: s.indicators, lastUpdated: s.lastUpdated, unread: ctx.unreadMsgs || 0,
      };
      if (hasPerm(user, 'manage_users')) { stats.pendingRequests = s.pendingRequests; stats.pendingSubs = s.pendingSubs; }
      return send(res, 200, views.portal(ctx, stats));
    }

    if (p === '/media' && req.method === 'GET') {
      logEvent('page_view', p, user);
      const items = await sdb.sel(`media?select=*&access_level=${sdb.inList(accessLevels(user))}&order=kind,id`);
      return send(res, 200, views.media(ctx, items));
    }

    if (p === '/analytics' && req.method === 'GET') {
      if (!hasPerm(user, 'analytics')) return send(res, 403, views.forbidden(ctx));
      logEvent('page_view', p, user);
      const [summary, gg] = await Promise.all([sdb.rpc('analytics_summary'), sdb.rpc('growth_gaps')]);
      return send(res, 200, views.analytics(ctx, { daily: summary.daily, byKind: summary.byKind, topPaths: summary.topPaths, growth: gg.growth, gaps: gg.gaps }));
    }

    if (p === '/messages') {
      if (!hasPerm(user, 'messaging')) return send(res, 403, views.forbidden(ctx));
      let convs = await sdb.sel(`conversations?select=*&user_id=eq.${user.id}`);
      let conv = convs[0];
      if (req.method === 'POST') {
        const f = parseForm(await readBody(req));
        if ((f.body || '').trim()) {
          if (!conv) {
            [conv] = await sdb.ins('conversations', [{ user_id: user.id, subject: (f.subject || 'General enquiry').slice(0, 120) }], true);
          }
          await sdb.ins('messages', [{ conversation_id: conv.id, sender_id: user.id, from_admin_team: 0, body: f.body.trim().slice(0, 4000), read_by_user: 1 }]);
          await sdb.upd('conversations', `id=eq.${conv.id}`, { updated_at: new Date().toISOString() });
        }
        return redirect(res, '/messages');
      }
      logEvent('page_view', p, user);
      const msgs = conv ? await sdb.sel(`messages_view?select=*&conversation_id=eq.${conv.id}&order=created_at`) : [];
      if (conv) await sdb.upd('messages', `conversation_id=eq.${conv.id}&from_admin_team=eq.1&read_by_user=eq.0`, { read_by_user: 1 }).catch(() => {});
      return send(res, 200, views.messages(ctx, { conv, msgs }));
    }

    // ----- admin area -----
    if (p.startsWith('/admin')) {
      if (!hasPerm(user, 'manage_users')) return send(res, 403, views.forbidden(ctx));

      if (p === '/admin/images' && req.method === 'GET') {
        if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
        logEvent('page_view', p, user);
        return send(res, 200, views.adminImages(ctx, {
          groups: imagestore.listing(),
          notice: url.searchParams.get('notice') || '',
        }));
      }
      if (p === '/admin/inbox' && req.method === 'GET') {
        logEvent('page_view', p, user);
        const convs = await sdb.sel('admin_inbox?select=*&order=updated_at.desc');
        return send(res, 200, views.adminInbox(ctx, convs));
      }
      const convM = p.match(/^\/admin\/inbox\/(\d+)$/);
      if (convM) {
        const rows = await sdb.sel(`admin_inbox?select=*&id=eq.${Number(convM[1])}`);
        const conv = rows[0];
        if (!conv) return send(res, 404, views.notFound(ctx));
        if (req.method === 'POST') {
          const f = parseForm(await readBody(req));
          if ((f.body || '').trim()) {
            await sdb.ins('messages', [{ conversation_id: conv.id, sender_id: user.id, from_admin_team: 1, body: f.body.trim().slice(0, 4000), read_by_admin: 1 }]);
            await sdb.upd('conversations', `id=eq.${conv.id}`, { updated_at: new Date().toISOString() });
          }
          return redirect(res, p);
        }
        await sdb.upd('messages', `conversation_id=eq.${conv.id}&read_by_admin=eq.0`, { read_by_admin: 1 }).catch(() => {});
        const msgs = await sdb.sel(`messages_view?select=*&conversation_id=eq.${conv.id}&order=created_at`);
        return send(res, 200, views.adminConversation(ctx, { conv: { ...conv, user_name: conv.user_name, email: conv.email }, msgs }));
      }

      // ---- Seedance AI video generation: poll a job's status (called by the Content Studio) ----
      if (p === '/admin/media/gen-status' && req.method === 'GET') {
        const id = Number(url.searchParams.get('id'));
        const rows = await sdb.sel(`media_generations?select=*&id=eq.${id}`);
        const g = rows[0];
        if (!g) return json(res, 404, { ok: false, error: 'Generation not found' });
        // Terminal states: nothing more to poll.
        if (['completed', 'published', 'failed'].includes(g.status)) {
          return json(res, 200, { ok: true, status: g.status, video_url: g.local_path || g.video_url, error: g.error });
        }
        try {
          const task = await seedance.getTask(g.task_id);
          const st = String(task.status || task.state || '').toLowerCase();
          const remoteUrl = task.video_url || (task.result && (task.result.video_url || task.result.url))
            || (task.output && (task.output.video_url || task.output.url)) || (Array.isArray(task.videos) && task.videos[0]);
          if ((st === 'succeeded' || st === 'completed' || st === 'success') && remoteUrl) {
            const local = await seedance.downloadVideo(remoteUrl, `gen-${g.id}`);
            const credits = task.credits_used || task.cost || (task.usage && task.usage.credits) || null;
            await sdb.upd('media_generations', `id=eq.${g.id}`, { status: 'completed', video_url: remoteUrl, local_path: local, credits_used: credits, updated_at: new Date().toISOString() });
            return json(res, 200, { ok: true, status: 'completed', video_url: local, credits_used: credits });
          }
          if (st === 'failed' || st === 'error' || st === 'canceled') {
            const emsg = (task.error && (task.error.message || task.error)) || 'Generation failed at Seedance.';
            await sdb.upd('media_generations', `id=eq.${g.id}`, { status: 'failed', error: String(emsg).slice(0, 500), updated_at: new Date().toISOString() });
            return json(res, 200, { ok: true, status: 'failed', error: emsg });
          }
          return json(res, 200, { ok: true, status: 'processing', raw_status: st || 'processing' });
        } catch (e) {
          return json(res, 200, { ok: true, status: 'processing', note: seedance.friendlyError(e) });
        }
      }

      if (req.method === 'POST') {
        // ---- Image Library: multipart upload. Handled before parseForm, which reads the
        //      body as text and would corrupt the file bytes. ----
        if (p === '/admin/images/upload') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          let notice;
          try {
            const raw = await readBodyBuffer(req);
            const parts = imagestore.parseMultipart(raw, req.headers['content-type']) || [];
            const field = (n) => { const q = parts.filter((x) => x.name === n && x.filename == null)[0]; return q ? q.data.toString('utf8') : ''; };
            const file = parts.filter((x) => x.name === 'file' && x.filename != null)[0];
            const r = await imagestore.save(field('collection'), field('key'), file && file.filename, file && file.data);
            notice = r.ok ? 'Image saved and live on the site.' : r.error;
          } catch (e) {
            if (!/too large/i.test(e.message)) console.error('[imagestore] upload failed:', e.message);
            notice = /too large/i.test(e.message) ? 'That file is larger than 4 MB.' : 'Upload failed. Please try again.';
          }
          return redirect(res, '/admin/images?notice=' + encodeURIComponent(notice));
        }

        const f = parseForm(await readBody(req));
        if (p === '/admin/images/delete') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          const r = await imagestore.remove(f.collection, f.key);
          const notice = !r.ok ? r.error
            : (r.reverted ? 'Upload deleted. That slot is back to its built-in image.' : 'That slot was already using its built-in image.');
          return redirect(res, '/admin/images?notice=' + encodeURIComponent(notice));
        }
        // ---- Seedance AI video generation: submit a new job ----
        if (p === '/admin/media/generate') {
          if (!hasPerm(user, 'manage_content')) return json(res, 403, { ok: false, error: 'Not permitted' });
          if (!seedance.isConfigured()) return json(res, 400, { ok: false, error: 'Seedance API key not configured on the server (seedance-key.txt).' });
          const prompt = (f.prompt || '').trim();
          if (prompt.length < 6) return json(res, 400, { ok: false, error: 'Enter a prompt of at least 6 characters.' });
          const model = f.model === 'seedance25' ? 'seedance25' : 'seedance2';
          const opts = {
            mode: f.image_url ? 'image-to-video' : 'text-to-video',
            quality_tier: ['mini', 'standard', 'pro'].includes(f.quality_tier) ? f.quality_tier : 'mini',
            prompt,
            aspect_ratio: ['16:9', '9:16', '1:1'].includes(f.aspect_ratio) ? f.aspect_ratio : '16:9',
            duration: ['5', '10'].includes(String(f.duration)) ? String(f.duration) : '5',
            resolution: ['480p', '720p', '1080p'].includes(f.resolution) ? f.resolution : '720p',
            image_url: (f.image_url || '').trim() || undefined,
          };
          try {
            const resp = model === 'seedance25' ? await seedance.submitVideo25(opts) : await seedance.submitVideo2(opts);
            const taskId = resp.task_id || resp.id || (resp.data && (resp.data.task_id || resp.data.id));
            if (!taskId) return json(res, 502, { ok: false, error: 'Seedance did not return a task id.' });
            const ins = await sdb.ins('media_generations', [{
              prompt, mode: opts.mode, model, quality_tier: opts.quality_tier,
              aspect_ratio: opts.aspect_ratio, duration: opts.duration, resolution: opts.resolution,
              task_id: String(taskId), status: 'processing', requested_by: user.id,
            }]);
            const row = Array.isArray(ins) ? ins[0] : ins;
            return json(res, 200, { ok: true, id: row.id, task_id: taskId });
          } catch (e) {
            console.error('seedance submit', e.code, e.message);
            return json(res, 200, { ok: false, error: seedance.friendlyError(e), code: e.code });
          }
        }
        // ---- Set a finished AI video as the scroll-video homepage hero ----
        if (p === '/admin/media/set-hero') {
          if (!hasPerm(user, 'manage_content')) return json(res, 403, { ok: false, error: 'Not permitted' });
          const g = (await sdb.sel(`media_generations?select=*&id=eq.${Number(f.id)}`))[0];
          if (!g || g.status !== 'completed' || !g.local_path) return json(res, 400, { ok: false, error: 'This generation is not ready.' });
          const src = path.join(__dirname, 'public', g.local_path.replace(/^\//, ''));
          const dest = path.join(__dirname, 'public', 'media', 'generated', 'hero.mp4');
          try { fs.copyFileSync(src, dest); } catch (e) { return json(res, 500, { ok: false, error: 'Could not copy the video: ' + e.message }); }
          return json(res, 200, { ok: true });
        }
        // ---- Publish a finished AI video into the Media Library ----
        if (p === '/admin/media/gen-publish') {
          if (!hasPerm(user, 'manage_content')) return json(res, 403, { ok: false, error: 'Not permitted' });
          const g = (await sdb.sel(`media_generations?select=*&id=eq.${Number(f.id)}`))[0];
          if (!g || g.status !== 'completed' || !g.local_path) return json(res, 400, { ok: false, error: 'This generation is not ready to publish.' });
          const title = (f.title || '').trim() || ('AI video · ' + g.prompt.slice(0, 60));
          await sdb.ins('media', [{
            kind: 'video', title, description: g.prompt,
            file_path: g.local_path, video_provider: 'NICTD AI (Seedance)', video_embed_id: null,
            access_level: ['public', 'registered', 'stakeholder'].includes(f.access_level) ? f.access_level : 'public',
          }]);
          await sdb.upd('media_generations', `id=eq.${g.id}`, { status: 'published', updated_at: new Date().toISOString() });
          return json(res, 200, { ok: true });
        }
        if (p === '/admin/users/status') {
          await sdb.upd('users', `id=eq.${Number(f.id)}&role=neq.admin`, { status: ['active', 'suspended'].includes(f.status) ? f.status : 'active' });
          cache.sessions.clear();
          return redirect(res, '/admin#users');
        }
        if (p === '/admin/users/role') {
          if (['public', 'stakeholder', 'admin'].includes(f.role)) await sdb.upd('users', `id=eq.${Number(f.id)}`, { role: f.role });
          cache.sessions.clear();
          return redirect(res, '/admin#users');
        }
        if (p === '/admin/users/create') {
          const email = (f.email || '').trim().toLowerCase();
          if (email && f.name && f.password && f.password.length >= 8) {
            const existing = await sdb.sel(`users?select=id&email=eq.${sdb.enc(email)}`);
            if (!existing.length) {
              await sdb.ins('users', [{ email, name: f.name.trim(), organization: (f.organization || '').trim(), password_hash: hashPassword(f.password), role: ['public', 'stakeholder', 'admin'].includes(f.role) ? f.role : 'stakeholder', status: 'active' }]);
            }
          }
          return redirect(res, '/admin#users');
        }
        // access requests: approve -> create account; reject -> close
        if (p === '/admin/requests/action') {
          const reqs = await sdb.sel(`access_requests?select=*&id=eq.${Number(f.id)}&status=eq.pending`);
          const ar = reqs[0];
          if (ar) {
            if (f.action === 'approve') {
              if (!f.password || f.password.length < 8) return redirect(res, '/admin?notice=' + encodeURIComponent('Temporary password must be at least 8 characters.') + '#requests');
              const existing = await sdb.sel(`users?select=id&email=eq.${sdb.enc(ar.email)}`);
              if (existing.length) return redirect(res, '/admin?notice=' + encodeURIComponent('A user with that email already exists.') + '#requests');
              const role = ['public', 'stakeholder'].includes(f.role) ? f.role : ar.role_requested;
              await sdb.ins('users', [{ email: ar.email, name: ar.name, organization: ar.organization, password_hash: hashPassword(f.password), role, status: 'active' }]);
              await sdb.upd('access_requests', `id=eq.${ar.id}`, { status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() });
              return redirect(res, '/admin?notice=' + encodeURIComponent(`Account created for ${ar.email} (${role}). Share the temporary password with the applicant.`) + '#requests');
            }
            await sdb.upd('access_requests', `id=eq.${ar.id}`, { status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() });
          }
          return redirect(res, '/admin#requests');
        }
        if (p === '/admin/review') {
          const subs = await sdb.sel(`data_submissions?select=*&id=eq.${Number(f.id)}&status=eq.pending`);
          const sub = subs[0];
          if (sub) {
            if (f.action === 'approve') {
              await sdb.rpc('publish_data_point', { p_indicator: sub.indicator_code, p_county: sub.county_id, p_year: sub.year, p_value: sub.value, p_source: sub.source });
              await Promise.all([refreshIndicators(), refreshYears()]);
            }
            await sdb.upd('data_submissions', `id=eq.${sub.id}`, { status: f.action === 'approve' ? 'approved' : 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() });
          }
          return redirect(res, '/admin#review');
        }
        if (p === '/admin/submissions/create') {
          const v = validateSubmission(f.indicator_code, f.value);
          await sdb.ins('data_submissions', [{
            indicator_code: f.indicator_code, county_id: f.county_id ? Number(f.county_id) : null,
            year: Number(f.year), value: Number(f.value), source: f.source || 'Manual upload template',
            submitted_by: user.id, channel: 'manual', status: 'pending', validation_note: v.note,
          }]);
          return redirect(res, '/admin#review');
        }
        // Content Studio: bulk CSV publish (goes straight to published data_points)
        if (p === '/admin/data/bulk') {
          const { rows, errors } = parseBulkCsv(f.csv);
          let published = 0;
          if (rows.length) {
            published = await sdb.rpc('bulk_publish', { p_rows: rows });
            await Promise.all([refreshIndicators(), refreshYears()]);
          }
          const notice = `Published ${published} data point(s).` + (errors.length ? ` Skipped ${errors.length}: ${errors.slice(0, 3).join(' · ')}${errors.length > 3 ? ' …' : ''}` : '');
          return redirect(res, '/admin?notice=' + encodeURIComponent(notice) + '#studio');
        }
        // Content Studio: front-end text blocks + key numbers
        if (p === '/admin/content') {
          if (f.hero_title != null) await setContent('hero_title', f.hero_title.trim().slice(0, 300));
          if (f.hero_sub != null) await setContent('hero_sub', f.hero_sub.trim().slice(0, 1000));
          if (f.about_mission != null) await setContent('about_mission', f.about_mission.trim().slice(0, 2000));
          if (f.key_numbers != null) {
            const codes = f.key_numbers.split(',').map((s) => s.trim()).filter((c) => cache.indicatorByCode.has(c)).slice(0, 4);
            if (codes.length === 4) await setContent('key_numbers', codes.join(','));
          }
          // homepage video: a YouTube link/ID or an on-platform path (/media/... /img/...)
          if (f.home_video != null) {
            const v = f.home_video.trim().slice(0, 400);
            if (v === '' || /^https?:\/\//i.test(v) || v.startsWith('/') || /^[A-Za-z0-9_-]{8,}$/.test(v)) await setContent('home_video', v);
          }
          if (f.home_video_title != null) await setContent('home_video_title', f.home_video_title.trim().slice(0, 140));
          if (f.home_video_caption != null) await setContent('home_video_caption', f.home_video_caption.trim().slice(0, 600));
          if (f.home_video_playlist != null) await setContent('home_video_playlist', f.home_video_playlist.trim().slice(0, 2000));
          return redirect(res, '/admin?notice=' + encodeURIComponent('Front-end content saved and live.') + '#studio');
        }
        if (p === '/admin/updates/create') {
          if (f.title && f.body) await sdb.ins('updates', [{ title: f.title.trim(), category: ['news', 'data_refresh', 'announcement'].includes(f.category) ? f.category : 'news', body: f.body.trim(), published_on: new Date().toISOString().slice(0, 10) }]);
          return redirect(res, '/admin#studio');
        }
        if (p === '/admin/updates/delete') {
          await sdb.del('updates', `id=eq.${Number(f.id)}`);
          return redirect(res, '/admin#studio');
        }
        // paper management, usable from the Content Studio and the Research Papers tab
        const paperBack = (req.headers.referer || '').includes('/research') ? '/research' : '/admin#studio';
        if (p === '/admin/papers/create') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          if (f.title && f.abstract) await sdb.ins('papers', [{
            title: f.title.trim(), authors: (f.authors || 'ICT Statistics & Policy Unit').trim(), abstract: f.abstract.trim(),
            published_on: new Date().toISOString().slice(0, 10), tag: f.tag || 'Report', body: f.body || '',
            status: 'published', visible: true, deleted: false, downloadable: f.downloadable !== '0',
          }]);
          return redirect(res, paperBack === '/research' ? '/research?notice=' + encodeURIComponent('Paper published.') : '/admin#studio');
        }
        if (p === '/admin/papers/review') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          const approve = f.action === 'approve';
          await sdb.upd('papers', `id=eq.${Number(f.id)}`, {
            status: approve ? 'published' : 'rejected', visible: approve,
            reviewed_by: user.id, reviewed_at: new Date().toISOString(),
          });
          return redirect(res, '/research?notice=' + encodeURIComponent(approve ? 'Paper approved and published.' : 'Submission rejected.'));
        }
        if (p === '/admin/papers/visibility') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          const patch = {};
          if (f.action === 'hide') patch.visible = false;
          else if (f.action === 'show') patch.visible = true;
          else if (f.action === 'lock') patch.downloadable = false;
          else if (f.action === 'unlock') patch.downloadable = true;
          if (Object.keys(patch).length) await sdb.upd('papers', `id=eq.${Number(f.id)}`, patch);
          return redirect(res, '/research?notice=' + encodeURIComponent('Paper updated.'));
        }
        if (p === '/admin/papers/delete') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          // soft delete so it can be recovered
          await sdb.upd('papers', `id=eq.${Number(f.id)}`, { deleted: true });
          return redirect(res, paperBack === '/research' ? '/research?notice=' + encodeURIComponent('Paper moved to Deleted, recoverable.') : '/admin#studio');
        }
        if (p === '/admin/papers/recover') {
          if (!hasPerm(user, 'manage_content')) return send(res, 403, views.forbidden(ctx));
          await sdb.upd('papers', `id=eq.${Number(f.id)}`, { deleted: false });
          return redirect(res, '/research?notice=' + encodeURIComponent('Paper recovered.'));
        }
        if (p === '/admin/media/create') {
          if (f.title && ['image', 'paper', 'video'].includes(f.kind)) {
            await sdb.ins('media', [{
              kind: f.kind, title: f.title.trim(), description: f.description || '',
              file_path: f.kind === 'video' ? null : (f.file_path || null),
              video_provider: f.kind === 'video' ? (f.video_provider || 'YouTube') : null,
              video_embed_id: f.kind === 'video' ? (f.video_embed_id || 'CONFIGURE_EMBED_ID') : null,
              access_level: ['public', 'registered', 'stakeholder'].includes(f.access_level) ? f.access_level : 'public',
            }]);
          }
          return redirect(res, '/admin#studio');
        }
        if (p === '/admin/media/delete') {
          await sdb.del('media', `id=eq.${Number(f.id)}`);
          return redirect(res, '/admin#studio');
        }
        if (p === '/admin/settings') {
          if (!hasPerm(user, 'manage_settings')) return send(res, 403, views.forbidden(ctx));
          if (['verified', 'open', 'closed'].includes(f.registration_mode)) await setSetting('registration_mode', f.registration_mode);
          if (['admin_only', 'request'].includes(f.stakeholder_provisioning)) await setSetting('stakeholder_provisioning', f.stakeholder_provisioning);
          if (['inbox', 'realtime'].includes(f.messaging_model)) await setSetting('messaging_model', f.messaging_model);
          return redirect(res, '/admin#settings');
        }
        if (p === '/admin/permissions') {
          if (!hasPerm(user, 'manage_settings')) return send(res, 403, views.forbidden(ctx));
          const roles = ['public', 'stakeholder'];
          const allPerms = ['view_registered_data', 'view_stakeholder_data', 'analytics', 'messaging', 'download_open_data'];
          for (const role of roles) {
            for (const perm of allPerms) {
              const on = f[`perm_${role}_${perm}`] === 'on';
              if (on) await sdb.ups('role_permissions', [{ role, permission: perm }]);
              else await sdb.del('role_permissions', `role=eq.${role}&permission=eq.${perm}`);
            }
          }
          await refreshPerms();
          return redirect(res, '/admin#settings');
        }
      }

      if (p === '/admin' && req.method === 'GET') {
        logEvent('page_view', p, user);
        const [users, pending, reviewed, accessRequests, papersList, updatesList, mediaList, unreadRow, generations] = await Promise.all([
          sdb.sel('users?select=id,email,name,organization,role,status,created_at&order=status.desc,created_at.desc'),
          sdb.sel("submissions_view?select=*&status=eq.pending&order=created_at"),
          sdb.sel("submissions_view?select=*&status=neq.pending&order=reviewed_at.desc&limit=5"),
          sdb.sel("access_requests?select=*&status=eq.pending&order=created_at"),
          sdb.sel('papers?select=id,title,published_on,tag&order=published_on.desc'),
          sdb.sel('updates?select=id,title,category,published_on&order=published_on.desc'),
          sdb.sel('media?select=id,title,kind,access_level&order=kind,id'),
          sdb.rpc('user_badges', { p_user_id: user.id, p_is_admin: true }),
          sdb.sel('media_generations?select=id,prompt,model,quality_tier,status,local_path,created_at&order=created_at.desc&limit=8'),
        ]);
        const settings = { registration_mode: getSetting('registration_mode'), stakeholder_provisioning: getSetting('stakeholder_provisioning'), messaging_model: getSetting('messaging_model') };
        const siteContent = {
          hero_title: getContent('hero_title'), hero_sub: getContent('hero_sub'),
          about_mission: getContent('about_mission'), key_numbers: getContent('key_numbers'),
          home_video: getContent('home_video'), home_video_title: getContent('home_video_title'),
          home_video_caption: getContent('home_video_caption'),
          home_video_playlist: getContent('home_video_playlist'),
        };
        return send(res, 200, views.admin(ctx, {
          users, pending, reviewed, accessRequests, papersList, updatesList, mediaList, siteContent,
          indicators: cache.indicators.map(({ code, name, unit }) => ({ code, name, unit })),
          counties: cache.counties.map(({ id, name }) => ({ id, name })),
          settings, rolePerms: cache.rolePermRows || [], unreadInbox: unreadRow.unreadInbox || 0,
          generations, seedanceReady: seedance.isConfigured(),
          notice: url.searchParams.get('notice') || '',
        }));
      }
    }

    return send(res, 404, views.notFound(ctx));
  } catch (err) {
    console.error(err);
    return send(res, 500, views.errorPage(null, 'An unexpected error occurred.'));
  }
}

const ready = (async function boot() {
  for (let i = 0; i < 20; i++) {
    try { await loadCaches(); if (!REVIEW) await setSetting('last_etl_sync', new Date().toISOString()); return; }
    catch (e) { console.error('Cache load failed, retrying in 5s:', e.message); await new Promise((r) => setTimeout(r, 5000)); }
  }
  throw new Error('Could not reach Supabase after 20 attempts.');
})();
ready.catch((e) => console.error(e.message));

module.exports = handler;
if (require.main === module) {
  http.createServer(handler).listen(PORT, () => console.log(`NIIP site running at http://localhost:${PORT} (data: Supabase${REVIEW ? ', review mode: read-only' : ''})`));
}
