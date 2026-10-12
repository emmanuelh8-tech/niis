// imagestore.js — admin-managed site images.
// Every image slot on the site (hero slides, research-paper covers, ICT report covers,
// page header banners) is registered here. Uploads land in public/img/<collection>/ with a
// timestamped filename (so replacing one busts the browser cache) and are recorded in a
// manifest. If a slot has no upload, its built-in default is used.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sdb = require('./supadb');

const IMG_ROOT = path.join(__dirname, 'public', 'img');
const MANIFEST = path.join(__dirname, 'image-manifest.json');

// ---- slot registry: the single source of truth for what can be uploaded ----
const COLLECTIONS = {
  brand: {
    label: 'Site emblem',
    note: 'The national seal shown at the head of the footer on every page. SVG keeps it crisp at any size; a transparent PNG at 240px or larger also works.',
    slots: [
      { key: 'seal', label: 'Coat of Arms of Liberia', hint: 'Official seal — shown centred above the footer columns', def: '/img/brand/liberia-seal.png' },
    ],
  },
  hero: {
    label: 'Hero slider',
    note: 'Full-bleed slides on the home page, shown in order.',
    slots: [
      { key: 'slide-1', label: 'Slide 1', hint: 'President Joseph Boakai, Liberia', def: '/img/hero/slide-1.jpg' },
      { key: 'slide-2', label: 'Slide 2', hint: 'Liberia’s National ICT Database Project', def: '/img/hero/slide-2.png' },
      { key: 'slide-3', label: 'Slide 3', hint: 'Claver Gatete quote', def: '/img/hero/slide-3.jpg' },
      { key: 'slide-4', label: 'Slide 4', hint: 'President John Mahama, Ghana', def: '/img/hero/slide-4.jpg' },
      { key: 'slide-5', label: 'Slide 5', hint: 'President William Ruto, Kenya', def: '/img/hero/slide-5.jpg' },
      { key: 'slide-6', label: 'Slide 6', hint: 'Amb. Philip Thigo quote', def: '/img/hero/slide-6.png' },
    ],
  },
  papers: {
    label: 'Research paper covers',
    note: 'Featured images for the Featured Research Papers cards.',
    slots: [
      { key: 'connectivity', label: 'State of Connectivity in Liberia', def: '/img/papers/connectivity.jpg' },
      { key: 'national', label: 'National Digital Transformation Strategy', def: '/img/papers/national.jpg' },
      { key: 'governance', label: 'Digital Trust, National ID & E-Government', def: '/img/papers/governance.jpg' },
      { key: 'education', label: 'ICT in Education', def: '/img/papers/education.jpg' },
      { key: 'fintech', label: 'Mobile Money & Financial Inclusion', def: '/img/papers/fintech.jpg' },
      { key: 'broadband', label: 'The Urban-Rural Broadband Divide', def: '/img/papers/broadband.jpg' },
    ],
  },
  reports: {
    label: 'ICT report covers',
    note: 'Featured images for National ICT Reports. Kept separate from research papers.',
    slots: [
      { key: 'sector-performance', label: 'Liberia ICT Sector Performance Report', def: '/img/reports/sector-performance.jpg' },
      { key: 'broadband-coverage', label: 'National Broadband Coverage & Quality', def: '/img/reports/broadband-coverage.jpg' },
      { key: 'market-pricing', label: 'Telecom Market Competition & Pricing', def: '/img/reports/market-pricing.jpg' },
      { key: 'digital-inclusion', label: 'Digital Inclusion & Gender Access', def: '/img/reports/digital-inclusion.jpg' },
      { key: 'cybersecurity', label: 'Cybersecurity & Data Protection Readiness', def: '/img/reports/cybersecurity.jpg' },
    ],
  },
  news: {
    label: 'Latest News images',
    note: 'Pictures on the Latest News cards, used in order. Empty slots show a plain navy panel.',
    slots: [
      { key: 'news-1', label: 'News card 1', def: '' },
      { key: 'news-2', label: 'News card 2', def: '' },
      { key: 'news-3', label: 'News card 3', def: '' },
      { key: 'news-4', label: 'News card 4', def: '' },
      { key: 'news-5', label: 'News card 5', def: '' },
    ],
  },
  researchCircle: {
    label: 'Research promo circle',
    note: 'The two pictures that alternate inside the circle on the Research page, every 3 seconds.',
    slots: [
      { key: 'circle-1', label: 'Circle image 1', def: '/img/researchCircle/circle-1.jpg' },
      { key: 'circle-2', label: 'Circle image 2', def: '/img/researchCircle/circle-2.jpg' },
    ],
  },
  partnerLogos: {
    label: 'Partner logos',
    note: 'Official logo supplied by each partner institution. Empty slots fall back to a lettered monogram tile.',
    slots: [
      { key: 'mopt', label: 'Ministry of Posts and Telecommunications', def: '' },
      { key: 'lta', label: 'Liberia Telecommunications Authority', def: '' },
      { key: 'lisgis', label: 'LISGIS', def: '' },
      { key: 'cbl', label: 'Central Bank of Liberia', def: '' },
      { key: 'moe', label: 'Ministry of Education', def: '' },
      { key: 'moh', label: 'Ministry of Health', def: '' },
      { key: 'moa', label: 'Ministry of Agriculture', def: '' },
      { key: 'epa', label: 'Environmental Protection Agency', def: '' },
      { key: 'lra', label: 'Liberia Revenue Authority', def: '' },
      { key: 'nic', label: 'National Investment Commission', def: '' },
      { key: 'operators', label: 'Licensed mobile network operators', def: '' },
      { key: 'isps', label: 'Licensed Internet service providers', def: '' },
      { key: 'datacentres', label: 'IXP and data centre operators', def: '' },
      { key: 'universities', label: 'Universities and training institutions', def: '' },
      { key: 'nir', label: 'National identification authority', def: '' },
      { key: 'cert', label: 'National computer incident response team', def: '' },
      { key: 'hubs', label: 'Innovation hubs and incubators', def: '' },
      { key: 'orange', label: 'Orange Liberia', def: '' },
      { key: 'lonestar', label: 'Lonestar Cell MTN', def: '' },
      { key: 'moys', label: 'Ministry of Youth and Sports', def: '' },
      { key: 'undp', label: 'United Nations Development Programme', def: '' },
      { key: 'itu', label: 'International Telecommunication Union', def: '' },
      { key: 'sdg', label: 'UN Sustainable Development Goals', def: '' },
    ],
  },
  partnerFocals: {
    label: 'Partner focal point photos',
    note: 'Photograph of the named focal point, supplied by that partner. Empty slots show a neutral placeholder.',
    slots: [
      { key: 'mopt', label: 'Ministry of Posts and Telecommunications focal point', def: '' },
      { key: 'lta', label: 'Liberia Telecommunications Authority focal point', def: '' },
      { key: 'lisgis', label: 'LISGIS focal point', def: '' },
      { key: 'cbl', label: 'Central Bank of Liberia focal point', def: '' },
      { key: 'moe', label: 'Ministry of Education focal point', def: '' },
      { key: 'moh', label: 'Ministry of Health focal point', def: '' },
      { key: 'moa', label: 'Ministry of Agriculture focal point', def: '' },
      { key: 'epa', label: 'Environmental Protection Agency focal point', def: '' },
      { key: 'lra', label: 'Liberia Revenue Authority focal point', def: '' },
      { key: 'nic', label: 'National Investment Commission focal point', def: '' },
      { key: 'operators', label: 'Licensed mobile network operators focal point', def: '' },
      { key: 'isps', label: 'Licensed Internet service providers focal point', def: '' },
      { key: 'datacentres', label: 'IXP and data centre operators focal point', def: '' },
      { key: 'universities', label: 'Universities and training institutions focal point', def: '' },
      { key: 'nir', label: 'National identification authority focal point', def: '' },
      { key: 'cert', label: 'National computer incident response team focal point', def: '' },
      { key: 'hubs', label: 'Innovation hubs and incubators focal point', def: '' },
      { key: 'orange', label: 'Orange Liberia focal point', def: '' },
      { key: 'lonestar', label: 'Lonestar Cell MTN focal point', def: '' },
      { key: 'moys', label: 'Ministry of Youth and Sports focal point', def: '' },
      { key: 'undp', label: 'United Nations Development Programme focal point', def: '' },
      { key: 'itu', label: 'International Telecommunication Union focal point', def: '' },
      { key: 'sdg', label: 'UN Sustainable Development Goals focal point', def: '' },
    ],
  },
  headers: {
    label: 'Page header banners',
    note: 'The wide banner at the top of each page.',
    slots: [
      { key: 'data-explorer', label: 'Data Explorer', def: '/img/headers/header-5.jpeg' },
      { key: 'data-landscape', label: 'Data Landscape', def: '/img/about/hero.jpg' },
      { key: 'reports', label: 'ICT Reports', def: '/img/headers/header-2.jpeg' },
      { key: 'careers', label: 'Careers', def: '/img/headers/header-6.png' },
      { key: 'dashboards', label: 'Dashboards', def: '/img/headers/header-3.jpeg' },
      { key: 'research', label: 'Research Papers', def: '/img/headers/header-4.jpeg' },
      { key: 'about', label: 'About', def: '/img/headers/header-1.jpeg' },
      { key: 'team', label: 'Our Team', def: '/img/about/colleagues.jpg' },
      { key: 'programs', label: 'Programs', def: '/img/about/field.jpg' },
      { key: 'partners', label: 'Our Partners', def: '/img/headers/partners.jpg' },
      { key: 'login', label: 'Log In', def: '/img/headers/default.svg' },
    ],
  },
};

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
// 4 MB: a hosted function (Vercel) refuses request bodies over 4.5 MB, so the limit stays under it everywhere.
const MAX_BYTES = 4 * 1024 * 1024;
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// ---- manifest ----
let manifest = {};
function loadManifest() {
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) || {}; }
  catch { manifest = {}; }
  return manifest;
}
function saveManifest() {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}
loadManifest();

// ---- hosted mode (Vercel): uploads live in Supabase Storage, and their record in the settings table ----
// image-manifest.json (deployed with the code) stays the base; the overlay, kept as the settings row
// "image_manifest", maps collection -> key -> the upload's public URL, or null for "back to the
// built-in image". Each server instance re-reads it every 30 seconds, so an upload made through one
// instance reaches the others.
const REMOTE = sdb.remoteFiles;
const BUCKET = 'site-images';
let overlay = {};
let overlayAt = 0;
async function refresh() {
  if (!REMOTE) return;
  const rows = await sdb.sel('settings?key=eq.image_manifest&select=value');
  try { overlay = (rows[0] && JSON.parse(rows[0].value)) || {}; } catch { overlay = {}; }
  overlayAt = Date.now();
}
function refreshIfStale(maxAge = 30000) {
  if (REMOTE && Date.now() - overlayAt > maxAge) refresh().catch((e) => console.error('[imagestore] refresh failed:', e.message));
}
const saveOverlay = () => sdb.ups('settings', [{ key: 'image_manifest', value: JSON.stringify(overlay) }]);
const objectPathOf = (u) => String(u).split('/storage/v1/object/public/' + BUCKET + '/')[1] || '';
const entryOf = (collection, key) => (overlay[collection] && key in overlay[collection])
  ? overlay[collection][key]
  : manifest[collection] && manifest[collection][key];

const slotDef = (collection, key) =>
  (COLLECTIONS[collection] ? COLLECTIONS[collection].slots : []).filter((s) => s.key === key)[0] || null;

// Public URL for a slot: the uploaded file when one exists, otherwise the built-in default.
function url(collection, key) {
  const entry = entryOf(collection, key);
  if (entry) return /^https?:\/\//.test(entry) ? entry : '/img/' + collection + '/' + entry;
  const def = slotDef(collection, key);
  return def ? def.def : '';
}
const isCustom = (collection, key) => !!entryOf(collection, key);

// Whether a slot actually resolves to a file on disk. A slot's default is only a path — nothing
// guarantees the file was ever supplied — so anything optional on the page checks before drawing
// it, rather than emitting an <img> that 404s.
function exists(collection, key) {
  const u = url(collection, key);
  if (/^https?:\/\//.test(u)) return true;   // an upload in Supabase Storage
  return !!u && fs.existsSync(path.join(__dirname, 'public', u.replace(/^\//, '')));
}

// Slots plus their resolved URL, for the admin screen.
function listing() {
  return Object.keys(COLLECTIONS).map((c) => ({
    collection: c,
    label: COLLECTIONS[c].label,
    note: COLLECTIONS[c].note,
    slots: COLLECTIONS[c].slots.map((s) => ({ ...s, url: url(c, s.key), custom: isCustom(c, s.key) })),
  }));
}

// ---- multipart/form-data (binary safe, single pass over the buffer) ----
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return null;
  const boundary = Buffer.from('--' + (m[1] || m[2]).trim());
  const parts = [];
  let start = buf.indexOf(boundary);
  if (start === -1) return null;
  start += boundary.length;
  while (start < buf.length) {
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;          // closing "--"
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;     // CRLF after boundary
    const headEnd = buf.indexOf('\r\n\r\n', start);
    if (headEnd === -1) break;
    const head = buf.slice(start, headEnd).toString('utf8');
    const bodyStart = headEnd + 4;
    const next = buf.indexOf(boundary, bodyStart);
    if (next === -1) break;
    let bodyEnd = next;
    if (buf[bodyEnd - 2] === 0x0d && buf[bodyEnd - 1] === 0x0a) bodyEnd -= 2;
    const name = (/name="([^"]*)"/i.exec(head) || [])[1] || '';
    const filename = (/filename="([^"]*)"/i.exec(head) || [])[1];
    parts.push({ name, filename: filename === undefined ? null : filename, data: buf.slice(bodyStart, bodyEnd) });
    start = next + boundary.length;
  }
  return parts;
}

// Sniff real image bytes so a renamed file cannot slip through on extension alone.
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null;
}

// Save an upload into a slot, replacing whatever was there.
function save(collection, key, filename, data) {
  const def = slotDef(collection, key);
  if (!def) return { ok: false, error: 'Unknown image slot.' };
  if (!data || !data.length) return { ok: false, error: 'No file received.' };
  if (data.length > MAX_BYTES) return { ok: false, error: 'That file is larger than 4 MB.' };

  const ext = sniff(data);
  if (!ext) return { ok: false, error: 'That file is not a JPG, PNG or WebP image.' };
  const given = path.extname(String(filename || '')).toLowerCase();
  if (given && ALLOWED_EXT.indexOf(given) === -1) return { ok: false, error: 'Only JPG, PNG and WebP files are allowed.' };

  const name = key + '-' + Date.now().toString(36) + ext;
  if (REMOTE) return saveRemote(collection, key, name, ext, data);
  const dir = path.join(IMG_ROOT, collection);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), data);

  removeFile(collection, key);                    // drop the file this one replaces
  manifest[collection] = manifest[collection] || {};
  manifest[collection][key] = name;
  saveManifest();
  return { ok: true, url: '/img/' + collection + '/' + name };
}

// Hosted: upload to the bucket, record it, then drop the upload it replaces. Returns a promise,
// which the server awaits (it awaits the plain result on disk just the same).
async function saveRemote(collection, key, name, ext, data) {
  await refresh();   // start from the newest record, in case another instance changed it
  const objectPath = collection + '/' + name;
  await sdb.storagePut(BUCKET, objectPath, data, MIME[ext]);
  const prev = overlay[collection] && overlay[collection][key];
  overlay[collection] = overlay[collection] || {};
  overlay[collection][key] = sdb.storagePublicUrl(BUCKET, objectPath);
  await saveOverlay();
  if (prev && objectPathOf(prev)) await sdb.storageDel(BUCKET, objectPathOf(prev)).catch(() => {});
  return { ok: true, url: overlay[collection][key] };
}
async function removeRemote(collection, key) {
  await refresh();
  const prev = entryOf(collection, key);
  overlay[collection] = overlay[collection] || {};
  overlay[collection][key] = null;
  await saveOverlay();
  if (prev && objectPathOf(prev)) await sdb.storageDel(BUCKET, objectPathOf(prev)).catch(() => {});
  return { ok: true, reverted: !!prev };
}

// Delete only files we created (never the built-in defaults).
function removeFile(collection, key) {
  const prev = manifest[collection] && manifest[collection][key];
  if (!prev) return false;
  const p = path.join(IMG_ROOT, collection, prev);
  if (path.dirname(p) !== path.join(IMG_ROOT, collection)) return false;   // traversal guard
  try { fs.unlinkSync(p); } catch { /* already gone */ }
  return true;
}
function remove(collection, key) {
  if (!slotDef(collection, key)) return { ok: false, error: 'Unknown image slot.' };
  if (REMOTE) return removeRemote(collection, key);
  const had = removeFile(collection, key);
  if (manifest[collection]) delete manifest[collection][key];
  saveManifest();
  return { ok: true, reverted: had };
}

module.exports = { COLLECTIONS, url, isCustom, exists, listing, save, remove, parseMultipart, MAX_BYTES, refresh, refreshIfStale };
