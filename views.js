// views.js, HTML templates for NIIS (National ICT Intelligence System).
// Original design system; not a copy of any real organization's branding.
'use strict';

const imgs = require('./imagestore');

// Background for an admin-managed image slot. Written inline rather than in the stylesheet so a
// new upload shows up straight away, and so every collection stays visually separate.
const WASH = 'linear-gradient(180deg, rgba(11,44,99,.05), rgba(11,44,99,.35))';
function slotBg(collection, key, wash = false) {
  const u = imgs.url(collection, key);
  if (!u) return 'background-image:linear-gradient(150deg, #0B2C63, #1C4C9E 55%, #7c0a1c)';
  return `background-image:${wash ? WASH + ',' : ''}url('${u}')`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt = (v) => (v == null ? 'n/a' : Number(v).toLocaleString('en-US'));
const fmtTs = (s) => String(s || '').replace('T', ' ').slice(0, 16);

const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  briefcase: '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/><path d="M2.5 13h19"/>',
  gauge: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17v-9"/><path d="M18 17V6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  tower: '<path d="M12 12v10"/><path d="M8 22h8"/><circle cx="12" cy="9" r="2"/><path d="M16.24 4.76a7 7 0 0 1 0 9.9"/><path d="M7.76 14.66a7 7 0 0 1 0-9.9"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 15.61a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5"/>',
  gavel: '<path d="M14 13l-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="M16 16l6 6"/><path d="M8 8l6-6 6 6-6 6z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-11 15-11 0 8-5 15-11 15z"/><path d="M4 13c0 3.5 2 6 5 7"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  call: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  bars: '<path d="M5 21v-8"/><path d="M12 21V9"/><path d="M19 21V5"/><circle cx="5" cy="10.4" r="1.3"/><circle cx="12" cy="6.4" r="1.3"/><circle cx="19" cy="2.6" r="1.3"/>',
  bookopen: '<path d="M12 6.5C10.4 5.1 7.7 4.5 3 4.5V18c4.7 0 7.4.6 9 2 1.6-1.4 4.3-2 9-2V4.5c-4.7 0-7.4.6-9 2z"/><path d="M12 6.5V20"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11.5"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  cloudup: '<path d="M12 13v8"/><path d="M8 17l4-4 4 4"/><path d="M20 16.6A5 5 0 0017 8h-1.3A8 8 0 104 15.9"/>',
  seal: '<path d="M7 3h10v11l-5 3-5-3z"/><circle cx="12" cy="8" r="2.6"/><path d="M9.5 15.5L8 21l4-2 4 2-1.5-5.5"/>',
  docsearch: '<path d="M14 3H6v18h9"/><path d="M14 3l5 5v3"/><circle cx="17" cy="17" r="3.2"/><path d="M19.4 19.4L22 22"/>',
  funnel: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
  check: '<polyline points="4.5 12.5 9.5 17.5 19.5 7"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  chevrons: '<polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  upload: '<path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
};
function icon(name, cls = 'icn') { return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }

const DASH_ICON = { connectivity: 'tower', 'mobile-broadband': 'wifi', affordability: 'coin', 'trust-governance': 'gavel', sustainability: 'leaf', education: 'book' };
const DASH_COLOR = { connectivity: '', 'mobile-broadband': 'teal', affordability: '', 'trust-governance': 'clay', sustainability: 'teal', education: '' };

// generic report-cover graphic + PDF badge, hand-authored, varies slightly per id for visual rhythm across a list
const COVER_ACCENTS = ['#1C5BB8', '#C8102E', '#1C4C9E', '#7FA0CE'];
function paperCover(seed = 0) {
  const accent = COVER_ACCENTS[seed % COVER_ACCENTS.length];
  const lines = [64, 78, 52, 70, 44];
  return `<svg class="paper-cover" viewBox="0 0 160 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="160" height="200" fill="#fff"/>
    <rect width="160" height="46" fill="#0B2C63"/>
    <rect y="46" width="160" height="4" fill="${accent}"/>
    <path d="M136 0 L160 0 L160 24 Z" fill="rgba(255,255,255,.14)"/>
    <g fill="#DCE2DA">${lines.map((w, i) => `<rect x="16" y="${72 + i * 20}" width="${w}" height="6" rx="3"/>`).join('')}</g>
    <circle cx="128" cy="168" r="20" fill="${accent}" opacity=".12"/>
    <path d="M40 24 L52 24 L52 36" stroke="#fff" stroke-width="2.4" fill="none" opacity=".55"/>
  </svg>
  <span class="pdf-badge">PDF</span>`;
}

// original "network node" mark, a center point with satellite nodes (not any real org's logo)
function nodeMark(size = 30, cls = '') {
  return `<svg class="nodemark ${cls}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
    <g stroke="currentColor" stroke-width="1.6" fill="none" opacity="0.85">
      <line x1="20" y1="20" x2="20" y2="5"/><line x1="20" y1="20" x2="33" y2="12"/>
      <line x1="20" y1="20" x2="34" y2="27"/><line x1="20" y1="20" x2="22" y2="35"/>
      <line x1="20" y1="20" x2="8" y2="31"/><line x1="20" y1="20" x2="6" y2="14"/>
    </g>
    <circle cx="20" cy="20" r="4.2" fill="currentColor"/>
    <g fill="currentColor"><circle cx="20" cy="5" r="2.4"/><circle cx="33" cy="12" r="2"/><circle cx="34" cy="27" r="2.4"/>
    <circle cx="22" cy="35" r="2"/><circle cx="8" cy="31" r="2.4"/><circle cx="6" cy="14" r="2"/></g>
  </svg>`;
}

// ---------- official seal logo: circular badge, real Liberia national outline + circuit-node overlay ----------
// Path traced from geoBoundaries' open Liberia ADM0 dataset (CC BY 3.0 IGO), simplified, not a real government seal.
const LIBERIA_EMBLEM_PATH = 'M-6.87,-45.84L-8.89,-44.47L-10.48,-44.82L-13.44,-43.23L-13.36,-44.88L-14.91,-45.61L-16.78,-44.42L-18.3,-44.68L-18.61,-41.3L-19.28,-40.13L-18.87,-38.21L-19.95,-37.18L-23.19,-37.09L-25.49,-34.79L-25.5,-28.97L-27.5,-28.16L-30.68,-24.03L-36.31,-20.56L-38.17,-17.72L-40.07,-17.24L-40.39,-16.32L-40.85,-16.61L-41.75,-15.09L-41.36,-13.69L-42.29,-13.55L-42.18,-12.4L-43.48,-11.37L-43.23,-10.7L-44.98,-10.37L-42.84,-8.72L-42.03,-6.7L-39.09,-7.21L-38.05,-5.58L-38.45,-4.82L-39.64,-5.14L-42.16,-6.88L-42.48,-6.26L-41.87,-5.48L-35.57,-2.62L-34.96,-2.87L-33.24,-1.79L-33.03,-2.18L-33.14,-1.5L-29.76,1.57L-28.46,0.94L-29.25,1.43L-29.12,2.03L-29.18,1.33L-29.69,1.62L-29.83,2.86L-28.18,3.02L-27.85,3.78L-29.55,3.38L-29.87,2.67L-29.61,3.49L-27.46,4.8L-20.93,6.73L-20.23,7.63L-17.23,8.97L-16.19,10.42L-13.74,11.87L-12.74,13.89L-3.44,21.46L-3.5,22.34L-1.53,23.39L0.01,25.74L3.18,28.09L2.95,28.54L8.5,31.61L8.64,32.26L12.25,33.39L15.64,36.06L19.98,37.65L25.79,41.23L32.3,42.58L34.89,43.75L34.97,44.57L37.13,45.76L41.58,45.86L40.66,44.98L41.26,44.22L40.68,43.75L40.52,40.95L41.06,40.35L40.47,39.41L40.79,36.6L40.08,36.19L39.99,34.05L41.53,33.64L40.82,32.4L41.23,31.85L40.81,30.01L42.42,29.15L42.63,25.78L43.93,25.27L43.82,26.17L44.98,24.56L44.81,23.34L44.27,23.81L43.23,22.39L43.85,22.41L44.64,18.92L42.87,13.55L42.32,13.94L41.71,13.05L41.09,13.56L40.47,12.2L38.71,11.82L38.62,11.02L38.11,12.13L36.47,10.98L35.77,10.19L36.22,9.18L35.71,8.11L34.5,8.21L34.64,5.73L35.09,5.61L33.35,3.68L32.12,3.69L31.11,2.91L27.43,3.83L23.77,1.7L22.63,2.2L22.19,1.85L22.8,1.56L22.54,0.17L21.59,-0.7L20.92,-0.11L17.98,-1.04L19.02,-2.55L19.5,-2.36L19.63,-3.51L20.02,-3.15L21.4,-4.14L23.77,-6.78L24.52,-8.98L23.91,-9.44L24.56,-10.07L24.14,-11.34L25.24,-12.11L24.57,-13.88L25.15,-16L23.21,-17.42L22.37,-22.21L19.94,-23.35L20.26,-24.78L19.09,-25.68L19.23,-27.35L16.55,-27.32L15.71,-25.98L15.82,-23.21L12.66,-19.61L13.03,-18.32L12.37,-17.62L11.55,-17.6L11.29,-18.47L7.15,-16.35L6.77,-17.98L5.16,-18.85L5.02,-20.47L3.29,-20.21L3.1,-21.26L1.86,-21.5L0.73,-20.48L0.28,-21.32L-1.04,-20.01L1.65,-25.52L1.19,-26.42L1.91,-28.47L0.06,-31.65L0.67,-34.99L-0.54,-34.91L-0.57,-37.74L-1.75,-38.03L-1.15,-39.8L-1.87,-40.86L-1.02,-41.71L-3.44,-43.22L-4.65,-42.59L-4.05,-43.85L-4.97,-44.82L-6.33,-43.57L-6.87,-45.84Z';
function ringArcPoint(cx, cy, r, bearingDeg) {
  const t = (bearingDeg * Math.PI) / 180;
  return [Math.round((cx + r * Math.sin(t)) * 100) / 100, Math.round((cy - r * Math.cos(t)) * 100) / 100];
}
function ringArcPath(cx, cy, r, fromDeg, toDeg, sweep) {
  const [x1, y1] = ringArcPoint(cx, cy, r, fromDeg);
  const [x2, y2] = ringArcPoint(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M${x1},${y1} A${r},${r} 0 ${large},${sweep} ${x2},${y2}`;
}
function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = Math.round((cx + rad * Math.cos(a)) * 100) / 100, y = Math.round((cy + rad * Math.sin(a)) * 100) / 100;
    d += (i === 0 ? 'M' : 'L') + x + ',' + y;
  }
  return d + 'Z';
}
function sealLogo(size = 40, cls = '') {
  const cx = 100, cy = 100, ringR = 84;
  const topArc = ringArcPath(cx, cy, ringR, -100, 100, 1);       // navy, over the top
  const rightGap = ringArcPath(cx, cy, ringR, 100, 125, 1);      // white, star
  const bottomArc = ringArcPath(cx, cy, ringR, 235, 125, 0);     // red, under the bottom (left->right, upright text)
  const leftGap = ringArcPath(cx, cy, ringR, 235, 260, 1);       // white, star
  const [rgx, rgy] = ringArcPoint(cx, cy, ringR, 112.5);
  const [lgx, lgy] = ringArcPoint(cx, cy, ringR, 247.5);
  return `<svg class="seal-logo ${cls}" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="96" fill="#fff" stroke="#0B2C63" stroke-width="1.4"/>
    <circle cx="${cx}" cy="${cy}" r="72" fill="none" stroke="#0B2C63" stroke-width="1"/>
    <path id="sealRingTop" d="${topArc}" fill="none" stroke="#0B2C63" stroke-width="18"/>
    <path d="${rightGap}" fill="none" stroke="#fff" stroke-width="18"/>
    <path id="sealRingBottom" d="${bottomArc}" fill="none" stroke="#C8102E" stroke-width="18"/>
    <path d="${leftGap}" fill="none" stroke="#fff" stroke-width="18"/>
    <path d="${starPath(rgx, rgy, 8)}" fill="#0B2C63"/>
    <path d="${starPath(lgx, lgy, 8)}" fill="#0B2C63"/>
    <text font-family="Public Sans,Arial,sans-serif" font-size="13" font-weight="700" fill="#fff" letter-spacing="1.6">
      <textPath href="#sealRingTop" startOffset="50%" text-anchor="middle">NATIONAL ICT DATABASE</textPath>
    </text>
    <text font-family="Public Sans,Arial,sans-serif" font-size="13" font-weight="700" fill="#fff" letter-spacing="2">
      <textPath href="#sealRingBottom" startOffset="50%" text-anchor="middle">OF LIBERIA</textPath>
    </text>
    <circle cx="${cx}" cy="${cy}" r="66" fill="#fff"/>
    <g transform="translate(100,100) scale(1.28)">
      <path d="${LIBERIA_EMBLEM_PATH}" fill="#0B2C63"/>
      <g stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round">
        <path d="M-4,-2 L10,-14 M10,-14 L22,-8 M10,-14 L14,-28 M-4,-2 L-2,14 M-2,14 L10,24"/>
      </g>
      <g fill="#fff">
        <circle cx="-4" cy="-2" r="3.2"/><circle cx="10" cy="-14" r="2.6"/><circle cx="22" cy="-8" r="2.6"/>
        <circle cx="14" cy="-28" r="2.2"/><circle cx="-2" cy="14" r="2.6"/><circle cx="10" cy="24" r="2.6"/>
      </g>
    </g>
  </svg>`;
}

// Category labels are set in Marvin Visions and bylines in Kazimir, both licensed faces: drop the
// licensed files into public/fonts as marvin-visions.(woff2|woff|otf|ttf) and kazimir.(woff2|woff|otf|ttf)
// and they are used at once. Until then the free stand-ins in the font stacks (Righteous, Spectral) show.
const LOCAL_FONTS = (() => {
  const fs = require('node:fs'), path = require('node:path');
  const css = [['Marvin Visions', 'marvin-visions'], ['Kazimir', 'kazimir']].map(([family, base]) => {
    const file = ['woff2', 'woff', 'otf', 'ttf'].map((e) => `${base}.${e}`).find((f) => fs.existsSync(path.join(__dirname, 'public', 'fonts', f)));
    return file ? `@font-face{font-family:'${family}';src:url('/assets/fonts/${file}');font-display:swap}` : '';
  }).join('');
  return css ? `<style>${css}</style>` : '';
})();
const FONT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Besley:ital,wght@0,400..900;1,400..700&family=Public+Sans:ital,wght@0,300..900;1,400..700&family=Righteous&family=Source+Serif+4:opsz,wght@8..60,400..700&family=Spectral:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">${LOCAL_FONTS}`;
const FAVICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(sealLogo(32))}">`;

// ---------- shared shell pieces ----------
// Liberia map silhouette lit up with a live ICT network (glowing, pulsing nodes + flowing links).
function liberiaMapMark(size = 48) {
  const nodes = [[-24, -16], [-6, -8], [13, -12], [27, 9], [6, 13], [31, 30], [-14, 17], [-31, -25], [18, -2]];
  const links = [[7, 0], [0, 1], [1, 2], [2, 8], [8, 3], [3, 5], [1, 4], [4, 5], [4, 6], [6, 0], [1, 6], [2, 4]];
  const lines = links.map(([a, b]) => `<line class="lmk-link" x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}"/>`).join('');
  const dots = nodes.map((n, i) => `<circle class="lmk-node" cx="${n[0]}" cy="${n[1]}" r="1.8" style="animation-delay:${(i * 0.26).toFixed(2)}s"/>`).join('');
  return `<svg class="liberia-map" viewBox="-52 -52 104 104" width="${size}" height="${size}" aria-hidden="true">
    <defs><clipPath id="lmkClip"><path d="${LIBERIA_EMBLEM_PATH}"/></clipPath></defs>
    <path class="lmk-land" d="${LIBERIA_EMBLEM_PATH}"/>
    <g clip-path="url(#lmkClip)">${lines}${dots}</g>
    <path class="lmk-outline" d="${LIBERIA_EMBLEM_PATH}"/>
  </svg>`;
}
// Flag of Liberia, drawn to the official 10:19 ratio: eleven stripes (six red, five white)
// for the eleven signatories of the Declaration of Independence, and a blue canton five
// stripes square carrying one white star.
function liberiaFlag(size = 46) {
  const RED = '#BF0A30', BLUE = '#002868', H = 10, W = 19;
  const stripe = H / 11;
  const stripes = [];
  for (let i = 0; i < 11; i++) {
    if (i % 2 === 0) stripes.push(`<rect x="0" y="${(i * stripe).toFixed(4)}" width="${W}" height="${stripe.toFixed(4)}" fill="${RED}"/>`);
  }
  const canton = 5 * stripe;                       // the canton is five stripes square
  const cx = canton / 2, cy = canton / 2, R = canton * 0.36, r = R * 0.382;
  let star = '';
  for (let i = 0; i < 10; i++) {
    const rad = (i % 2 === 0 ? R : r);
    const a = (Math.PI / 5) * i - Math.PI / 2;     // first point straight up
    star += `${(cx + rad * Math.cos(a)).toFixed(4)},${(cy + rad * Math.sin(a)).toFixed(4)} `;
  }
  return `<svg class="liberia-flag" viewBox="0 0 ${W} ${H}" width="${size}" height="${(size * H / W).toFixed(1)}"
    role="img" aria-label="Flag of Liberia">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>
    ${stripes.join('')}
    <rect x="0" y="0" width="${canton.toFixed(4)}" height="${canton.toFixed(4)}" fill="${BLUE}"/>
    <polygon points="${star.trim()}" fill="#FFFFFF"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width=".18"/>
  </svg>`;
}
// The section links are a dock (after the macOS dock, ported from a shadcn Dock component to plain
// CSS and app.js, since the site runs no React): each section is a round icon over its name, on the
// bar's own white; on desktop the icons swell toward the pointer while the names hold still, and the
// current page is a filled icon. On phones the dock sits at the foot of the screen with short names,
// the way a tab bar does.
function mainNav(active, q) {
  // [href, label, icon, submenu?, short label for the phone dock]
  const links = [
    ['/', 'Home', 'home', null, 'Home'],
    ['/data', 'Data Explorer', 'bars', [['/landscape', 'Data Landscape', 'layers']], 'Data'],
    ['/reports', 'ICT Reports', 'chart', null, 'Reports'],
    ['/research', 'Research', 'doc', [['/research/submit', 'Submit Paper', 'plus']], 'Research'],
    ['/partners', 'Our Partners', 'globe', null, 'Partners'],
    ['/careers', 'Careers', 'briefcase', [['/careers/programs', 'Programs', 'calendar']], 'Careers'],
    ['/about', 'About', 'info', [['/about/team', 'Our Team', 'users'], ['/about/team#patrons', 'ICT Patrons', 'sparkle'], ['/about/team#talent', 'ICT Talent Pool', 'code']], 'About'],
  ];
  const isActive = (href, sub) => active === href || (sub || []).some(([h]) => active === h);
  const navItem = ([href, label, ic, sub, short]) => {
    const on = isActive(href, sub);
    const link = `<a href="${href}" class="nav-link${on ? ' active' : ''}"${on ? ' aria-current="page"' : ''}><span class="dock-ic"><i class="dock-water" aria-hidden="true"></i>${icon(ic)}</span><span class="nav-label"><span class="nav-full">${esc(label)}</span><span class="nav-short">${esc(short)}</span>${sub ? `<i class="nav-caret" aria-hidden="true">${icon('chevron')}</i>` : ''}</span></a>`;
    if (!sub) return `<div class="dock-item">${link}</div>`;
    // a menu's first row is its own section, so the name is always written out
    return `<div class="dock-item nav-has-sub">${link}
      <div class="nav-submenu">
        <a href="${href}" class="nav-subitem nav-subhead ${active === href ? 'active' : ''}"><span>${esc(label)}</span></a>
        ${sub.map(([h, l]) => `<a href="${h}" class="nav-subitem ${active === h ? 'active' : ''}"><span>${l}</span></a>`).join('')}
      </div>
    </div>`;
  };
  // the phone menu (app.js opens it): a drawer from the left with the national seal at its head,
  // every section (a + opens a section's own pages), the search, and Log In
  const sheetRow = ([href, label, ic, sub]) => {
    const subId = 'sheet-sub-' + (href.replace(/\W+/g, '') || 'home');
    const open = sub && isActive(href, sub);
    return `<li${sub ? ' class="has-sub"' : ''}>
          <div class="sheet-row"><a href="${href}" class="sheet-link${isActive(href, sub) ? ' active' : ''}"${active === href ? ' aria-current="page"' : ''}>${esc(label)}</a>${sub
            ? `<button type="button" class="sheet-plus" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${subId}" aria-label="${esc(label)} pages"><i aria-hidden="true"></i></button>` : ''}</div>
          ${sub ? `<ul class="sheet-sub" id="${subId}"${open ? '' : ' hidden'}>${sub.map(([h, l]) => `<li><a href="${h}" class="${active === h ? 'active' : ''}"${active === h ? ' aria-current="page"' : ''}>${esc(l)}</a></li>`).join('')}</ul>` : ''}
        </li>`;
  };
  return `<nav class="gov-nav" aria-label="Main"><div class="nav-shell">
    <a class="gov-wordmark nav-mapblock" href="/" aria-label="NIIS home"><img class="nav-logo" src="/img/brand/niis-mark.webp?v=${ASSET_V}" alt="" width="852" height="341" decoding="async"></a>
    <form class="nav-search" action="/data" method="get" role="search">
      <input type="search" name="q" aria-label="Search indicators" autocomplete="off" value="${esc(q || '')}">
      <button type="button" class="nav-search-x" aria-label="Clear the search"${q ? '' : ' hidden'}>${icon('x')}</button>
      <span class="nav-search-rule" aria-hidden="true"></span>
      <button type="submit" class="nav-search-go" aria-label="Search">${icon('search')}</button>
    </form>
    <div class="gov-navlinks dock">
      ${links.map(navItem).join('')}
    </div>
    <a class="nav-cta pearl" href="/login"><span class="pearl-wrap"><span class="pearl-p">Get Started</span></span></a>
    <button class="nav-icon-btn nav-find" type="button" aria-label="Search indicators" aria-controls="navSheet" data-sheet-search>${icon('search')}</button>
    <button class="nav-icon-btn nav-burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="navSheet"><span></span><span></span><span></span></button>
  </div>
  <div class="nav-sheet" id="navSheet" hidden>
    <div class="nav-scrim" data-sheet-close></div>
    <div class="nav-drawer" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
      <button type="button" class="nav-drawer-x" aria-label="Close menu" data-sheet-close>${icon('x')}</button>
      <div class="nav-sheet-in">
        <div class="nav-drawer-head"><img src="${esc(sealArt())}" alt="Coat of Arms of the Republic of Liberia" width="220" height="233" decoding="async"></div>
        <form class="sheet-search" action="/data" method="get" role="search">
          ${icon('search')}
          <input type="search" name="q" placeholder="Search" aria-label="Search indicators" value="${esc(q || '')}">
        </form>
        <ul class="sheet-list">
          ${links.map(sheetRow).join('')}
        </ul>
        <a class="sheet-cta" href="/login"><span>Get Started</span>${icon('arrow')}</a>
      </div>
    </div>
  </div></nav>`;
}
function footerDh() {
  // Drawn only when a seal has actually been supplied, so the footer never shows a broken image.
  const seal = imgs.exists('brand', 'seal')
    ? `<img class="footer-seal" src="${imgs.url('brand', 'seal')}" width="58" height="62"
        alt="Coat of Arms of the Republic of Liberia" loading="lazy" decoding="async">`
    : '';
  return `<footer class="footer-dh">${seal}
    <div class="footer-grid">
      <div>
        <h4 data-perch="final">About NIIS</h4>
        <p>The National ICT Intelligence System (NIIS) is the official source of ICT statistics and digital-development data for Liberia, tracking connectivity, affordability, market structure and digital governance across all 15 counties.</p>
        <!-- brand icons: Font Awesome Free 6.5.2 (CC BY 4.0), each on its own brand colour -->
        <div class="footer-social"><a class="s-fb" href="#" aria-label="Facebook"><svg viewBox="0 0 320 512" aria-hidden="true"><path d="M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z"/></svg></a><a class="s-x" href="#" aria-label="X"><svg viewBox="0 0 512 512" aria-hidden="true"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"/></svg></a><a class="s-li" href="#" aria-label="LinkedIn"><svg viewBox="0 0 448 512" aria-hidden="true"><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></svg></a><a class="s-ig" href="#" aria-label="Instagram"><svg viewBox="0 0 448 512" aria-hidden="true"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg></a></div>
      </div>
      <div><h4>Links</h4>
        <a href="/about">Liberia Telecommunications Authority</a>
        <a href="/about">Ministry of Posts &amp; Telecommunications</a>
        <a href="/about">Harris &amp; Associates LLC</a>
        <a href="/research">Research Papers</a>
        <a href="/updates">Updates</a>
      </div>
    </div>
    <div class="footer-bottom-strip"><div class="footer-bottom-inner">
      <nav><a href="/about">Contact</a><a href="/about">Privacy Notice</a><a href="/about">Accessibility</a></nav>
      <span class="mono" style="font-size:.72rem;color:#6E8194">© 2026 NIIS</span>
    </div></div>
  </footer>`;
}
// Cache-buster stamped at server start so edited CSS/JS is never served stale from the browser cache.
const ASSET_V = Date.now().toString(36);
// On every page: one import map for three.js (one per document, so pages never add their own), and
// the robot turaco, which decides for itself whether this page and this screen get it.
const SITE_HEAD = `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module" src="/assets/bird.js?v=${ASSET_V}"></script>`;
// The close that Careers and About end on (their cs-outro), for every other public page: the name,
// large, rising out of the page into the footer's navy. app.js lifts it in when it comes into view.
const SITE_OUTRO = `<section class="site-outro" aria-hidden="true"><div class="site-word">NIIS</div></section>`;
function publicLayout(ctx, { title, active = '', body, extraHead = '', q = '' }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#ffffff">
<title>${esc(title)} · NIIS</title>
${FONT_HEAD}
<link rel="stylesheet" href="/assets/styles.css?v=${ASSET_V}">
${FAVICON}
<script src="/assets/liberia-counties.js?v=${ASSET_V}" defer></script>
${SITE_HEAD}
${extraHead}
</head><body>
${mainNav(active, q)}
<main>${body}</main>
${/cs-outro|lg-brand/.test(body) ? '' : SITE_OUTRO}
${footerDh()}
<script src="/assets/app.js?v=${ASSET_V}" defer></script></body></html>`;
}

// ---------- signed-in workspace shell ----------
function appLayout(ctx, { title, active = '', body, extraHead = '' }) {
  const u = ctx.user;
  const has = (p) => ctx.perms.includes(p);
  const item = (href, key, icn, label, badge = 0) =>
    `<a class="sb-item ${active === key ? 'active' : ''}" href="${href}">${icon(icn)}<span class="sb-label">${label}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</a>`;
  const roleLabel = { public: 'Public User', stakeholder: 'Stakeholder', admin: 'Administrator' }[u.role];
  const initials = u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#ffffff">
<title>${esc(title)} · NIIS</title>
${FONT_HEAD}
<link rel="stylesheet" href="/assets/styles.css?v=${ASSET_V}">
${FAVICON}
<script src="/assets/liberia-counties.js?v=${ASSET_V}" defer></script>
${SITE_HEAD}
${extraHead}
</head><body>
<div class="app">
  <aside class="sidebar">
    <a class="sb-brand" href="/portal">${sealLogo(38)}
      <span class="sb-brand-text"><strong>NIIS</strong><span>Liberia ICT Intelligence</span></span>
    </a>
    <nav class="sb-nav">
      <span class="sb-section-label">Workspace</span>
      ${item('/portal', 'portal', 'home', 'Overview')}
      ${item('/data', 'data', 'database', 'Data Explorer')}
      ${item('/partners', 'partners', 'users', 'Our Partners')}
      ${item('/research', 'research', 'doc', 'Research Papers', ctx.paperReview || 0)}
      ${item('/media', 'media', 'image', 'Media Library')}
      ${has('analytics') ? `<span class="sb-section-label">Insights</span>${item('/analytics', 'analytics', 'chart', 'Platform Analytics')}` : ''}
      <span class="sb-section-label">Communication</span>
      ${has('messaging') ? item('/messages', 'messages', 'chat', 'Messages', ctx.unreadMsgs || 0) : ''}
      ${has('admin_inbox') ? item('/admin/inbox', 'inbox', 'inbox', 'Team Inbox', ctx.unreadInbox || 0) : ''}
      ${has('manage_users') ? `<span class="sb-section-label">Administration</span>${item('/admin', 'admin', 'shield', 'Admin Panel')}` : ''}
      ${has('manage_content') ? item('/admin/images', 'images', 'image', 'Image Library') : ''}
      <span class="sb-section-label">Resources</span>
      ${item('/', 'site', 'globe', 'Public Website')}
      ${item('/api/docs', 'apidocs', 'doc', 'API Documentation')}
    </nav>
    <div class="sb-user">
      <span class="sb-avatar">${esc(initials)}</span>
      <span class="sb-user-info"><strong>${esc(u.name)}</strong><span>${esc(roleLabel)}</span></span>
      <form method="post" action="/logout" class="inline-form"><button class="sb-logout" type="submit" title="Log out">${icon('logout')}</button></form>
    </div>
  </aside>
  <div class="content">
    <div class="content-topbar">
      <span class="crumb">NIIS<strong>${esc(title)}</strong></span>
      <span class="topbar-actions"><span class="role-chip ${u.role === 'admin' ? 'admin' : ''}">${esc(roleLabel)}</span></span>
    </div>
    <div class="page-body">${body}</div>
  </div>
</div>
<script src="/assets/app.js?v=${ASSET_V}" defer></script></body></html>`;
}

// small helper: wrap public vs. workspace shell depending on session
function shell(ctx, opts) {
  return ctx.user ? appLayout(ctx, { ...opts, active: opts.workspaceActive || opts.active }) : publicLayout(ctx, opts);
}

// ---------- reusable dropdown markup ----------
function xdd(id, label) {
  return `<div class="xdd" id="${id}">
    <button type="button" class="xdd-trigger"><span class="xdd-trigger-label">${esc(label)}</span>${icon('chevron', 'icn')}</button>
    <div class="xdd-panel"><div class="xdd-search"><input type="text" placeholder="Search…"></div><div class="xdd-list"></div></div>
  </div>`;
}
function xddMulti(id, placeholder, selectAllLabel) {
  return `<div class="xdd" id="${id}">
    <button type="button" class="xdd-trigger"><span class="xdd-trigger-label">${esc(placeholder)}</span>${icon('chevron', 'icn')}</button>
    <div class="xdd-panel">
      <div class="xdd-search"><input type="text" placeholder="Search…"></div>
      ${selectAllLabel ? `<label class="xdd-select-all"><input type="checkbox" class="xdd-all-check"><span>${esc(selectAllLabel)}</span></label>` : ''}
      <div class="xdd-list"></div>
      <div class="xdd-footer"><button type="button" class="btn btn-teal btn-sm xdd-done">Done</button></div>
    </div>
  </div>`;
}
function selectorRow(idPrefix = '') {
  return `<div class="selector-card">
    <div class="selector-field"><label>Indicator or Dashboard</label>${xdd(idPrefix + 'dd-home-indicator', 'Search indicators or dashboards…')}</div>
    <div class="selector-field"><label>Focus Location</label>${xdd(idPrefix + 'dd-home-focus', 'National (Liberia)')}</div>
    <div class="selector-field"><label>Comparison Area</label>${xdd(idPrefix + 'dd-home-compare', 'None')}</div>
    <a class="btn btn-teal" href="/data">${icon('database')} Open Explorer</a>
  </div>`;
}

// ============ HOME ============
exports.home = (ctx, { headlines, papers, keyStats, dashboards, indicatorsForSearch, counties, lastUpdated, heroTitle, heroSub,
  homeVideo = '', homeVideoTitle = 'About the National ICT Intelligence System', homeVideoCaption = '', homeVideoPlaylist = '' }) => {
  return shell(ctx, {
    title: 'Home', active: '/', body: `
  ${heroSlider()}

  ${featuredPapers()}

  ${nationalReports()}

  ${homeVideoSection(homeVideo, homeVideoTitle, homeVideoCaption, homeVideoPlaylist)}

  ${latestUpdates(headlines)}

  <script>window.__NICTD_PAGE__='home';window.__HOME_STATE__=${JSON.stringify({ indicators: indicatorsForSearch, dashboards, counties })};
</script>
  <script>${heroSliderScript}</script>
  <script>${featuredPapersScript}</script>
  <script>${nationalReportsScript}</script>
  <script>${latestUpdatesScript}</script>
  <script>${homeVideoScript}</script>`,
  });
};

// Scroll-triggered image slider hero. Six slides cross-fade as the visitor scrolls through a tall
// sticky band, opening with the President and closing with Kenya. Each carries either the NIIS intro
// or one verified quotation. Images live at /img/hero/slide-{1..6}, numbered in display order, and are
// overridable per slot from the image admin screen. The search selector stays persistent below.
const HERO_SLIDES = [
  // His infrastructure pledge at the Liberia Technology Summit. The Executive Mansion release
  // reports it rather than quoting it, so it carries no quotation marks.
  { img: 'slide-1', reported: true,
    quote: 'Liberia is investing in digital infrastructure, connectivity and cybersecurity — to modernize governance and expand economic opportunity.',
    pos: 'center 22%',
    who: 'H.E. Joseph Nyuma Boakai, Sr.', role: 'President of the Republic of Liberia',
    meta: 'Liberia Technology Summit 2026, 21 July · emansion.gov.lr' },
  { img: 'slide-2', title: 'National ICT\nIntelligence System', sub: 'Liberia’s Data, owned by Liberia.' },
  { img: 'slide-3', quote: 'If we cannot measure the contribution of technology to GDP, we cannot monetize it.',
    pos: 'center 20%',
    who: 'Mr. Claver Gatete', role: 'UN Under-Secretary-General · Executive Secretary, UNECA',
    meta: 'UN Economic Commission for Africa · uneca.org' },
  // Verified against the Ghana News Agency report of the National AI Strategy launch.
  { img: 'slide-4',
    quote: 'Ghana cannot build a meaningful AI future using systems that do not understand our Ghanaian realities.',
    pos: 'center 18%',
    who: 'H.E. John Dramani Mahama', role: 'President of the Republic of Ghana',
    meta: 'National AI Strategy launch, April 2026 · Accra' },
  // Verified against president.go.ke, 11th Huawei ICT Competition. Trimmed between his two
  // sentences; the ellipsis marks the cut.
  { img: 'slide-5',
    quote: 'The future … will belong to those who imagine, invent and build the technologies that the world has not yet conceived.',
    pos: 'center 32%',
    who: 'H.E. William Ruto', role: 'President of the Republic of Kenya',
    meta: 'State House, Nairobi · president.go.ke' },
  { img: 'slide-6', quote: 'Africa must prioritize local data processing and systems that reflect its realities.',
    who: 'Ambassador Philip Thigo', role: 'Kenya’s Special Envoy on Technology', meta: 'April 2026 · Tangier, Morocco' },
];
// Each built-in slide also has a 5-6 s shot cut from it (public/media/home/<slot>.mp4, plus -720 for
// phones), longer than a slide stays, so the cross-fades always move. The leaders' shots are camera moves over the original photo, so nobody in them is
// animated; the Ministry is a drone shot and the laptop scene has natural motion. The shot plays as
// its slide arrives and holds on its last frame; the still stays underneath as its poster. A slide
// whose image was replaced in the Image Library keeps its still, so footage never sits under a
// different picture or quote.
function heroFilm(s, i) {
  const fs = require('node:fs'), path = require('node:path');
  const has = fs.existsSync(path.join(__dirname, 'public', 'media', 'home', s.img + '.mp4'));
  if (!has || imgs.isCustom('hero', s.img)) return '';
  return `<video class="hs-film" muted playsinline preload="${i === 0 ? 'auto' : 'none'}" aria-hidden="true"${s.pos ? ` style="object-position:${s.pos}"` : ''}>
        <source src="/media/home/${s.img}-720.mp4" type="video/mp4" media="(max-width: 760px)">
        <source src="/media/home/${s.img}.mp4" type="video/mp4">
      </video>`;
}
function heroSlider() {
  const slides = HERO_SLIDES.map((s, i) => `<div class="hs-slide ${i === 0 ? 'active' : ''}" data-i="${i}" style="${slotBg('hero', s.img)}${s.pos ? ';background-position:' + s.pos : ''}">${heroFilm(s, i)}</div>`).join('');
  const texts = HERO_SLIDES.map((s, i) => `<div class="hs-text ${s.quote ? 'is-quote' : ''} ${i === 0 ? 'active' : ''}" data-i="${i}">
      ${s.quote ? `<blockquote class="hs-quote${s.reported ? ' is-reported' : ''}">
        ${s.reported ? '' : '<span class="hs-qmark" aria-hidden="true">&ldquo;</span>'}
        <p>${esc(s.quote)}</p>
        <footer>
          <span class="hs-who">${esc(s.who)}</span>
          <span class="hs-role">${esc(s.role)}</span>
          ${s.meta ? `<span class="hs-qmeta mono">${esc(s.meta)}</span>` : ''}
        </footer>
      </blockquote>`
      : `${s.kicker ? `<p class="kicker">${esc(s.kicker)}</p>` : ''}
      <h1>${s.title.split('\n').map(esc).join('<br>')}</h1>
      ${s.sub ? `<p class="hs-sub">${esc(s.sub)}</p>` : ''}`}
    </div>`).join('');
  return `<section class="hero-slider" id="heroSlider">
    <div class="hs-sticky">
      <div class="hs-stage">${slides}<div class="hs-scrim"></div></div>
      <div class="hs-content wrap">
        <div class="hs-texts">${texts}</div>
      </div>
      <div class="hv-cue" aria-hidden="true"><span>Scroll to explore</span><i></i></div>
    </div>
  </section>`;
}
const heroSliderScript = `
(function(){
  var sec=document.getElementById('heroSlider'); if(!sec) return;
  var slides=[].slice.call(sec.querySelectorAll('.hs-slide'));
  var texts=[].slice.call(sec.querySelectorAll('.hs-text'));
  var cue=sec.querySelector('.hv-cue'), n=slides.length, cur=-1, running=false, raf=0, inView=true;
  var lastScrollIdx=-1, autoT=null;
  var reduceHero=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function restartAuto(){ if(reduceHero||n<2) return; clearInterval(autoT);
    autoT=setInterval(function(){ setActive((cur+1)%n); }, 4000); }
  function progress(){ var total=sec.offsetHeight-window.innerHeight; if(total<=0) return 0;
    return Math.min(1,Math.max(0,-sec.getBoundingClientRect().top/total)); }
  // each slide's shot (5-6 s, longer than the 4 s a slide stays) plays from its start as the slide
  // arrives, so the camera is still moving through the cross-fade; the outgoing shot keeps playing
  // until the fade is done. The next shot is fetched ahead and shown as soon as its first frame is
  // ready, so a fade never lands on the still. With reduced motion the stills stay.
  var films=slides.map(function(el){ return el.querySelector('.hs-film'); });
  films.forEach(function(f){ if(!f) return;
    var on=function(){ f.classList.add('is-on'); };
    f.addEventListener('loadeddata',on); f.addEventListener('playing',on); if(f.readyState>=2) on(); });
  function film(i){
    if(reduceHero) return;
    films.forEach(function(f,k){ if(!f) return;
      if(k===i){ try{ f.currentTime=0; }catch(e){} var p=f.play(); if(p&&p.catch) p.catch(function(){}); }
      else if(!f.paused){ setTimeout(function(){ if(cur!==k) f.pause(); },1500); } });
    var nx=films[(i+1)%n]; if(nx&&nx.preload!=='auto'){ nx.preload='auto'; nx.load(); }
  }
  function setActive(i){ if(i===cur) return; cur=i;
    film(i);
    slides.forEach(function(el,k){ el.classList.toggle('active',k===i); });
    texts.forEach(function(el,k){ el.classList.toggle('active',k===i); }); }
  function update(){
    var p=progress();
    // map scroll progress across n slides, with a little dwell at each
    var idx=Math.min(n-1, Math.floor(p*n*0.999));
    if(idx!==lastScrollIdx){ lastScrollIdx=idx; setActive(idx); restartAuto(); }
    // fade the scroll cue (no image transform, the photo must stay fully visible)
    if(cue) cue.style.opacity=String(Math.max(0,1-p*4));
  }
  function tick(){ update(); if(running&&inView) raf=requestAnimationFrame(tick); }
  function start(){ if(running) return; running=true; raf=requestAnimationFrame(tick); }
  function stop(){ running=false; if(raf) cancelAnimationFrame(raf); update(); }
  window.addEventListener('scroll',update,{capture:true,passive:true});
  document.addEventListener('scroll',update,{capture:true,passive:true});
  window.addEventListener('resize',update);
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ es.forEach(function(e){ inView=e.isIntersecting; inView?start():stop(); }); },{threshold:0}).observe(sec);
  } else { start(); }
  update();
  restartAuto();
  sec.addEventListener('mouseenter', function(){ clearInterval(autoT); });
  sec.addEventListener('mouseleave', restartAuto);
})();
`;

// Featured research papers, a "Latest News"-style card carousel with prev/next arrows.
// Featured images live at /img/papers/<img>.jpg (real photos where available, themed gradient fallback otherwise).
const FEATURED_PAPERS = [
  { id: 1, tag: 'Flagship Report', img: 'connectivity', title: 'State of Connectivity in Liberia 2025', author: 'ICT Statistics & Policy Unit', date: 'Aug 2025' },
  { id: 4, tag: 'National Baseline', img: 'national', title: 'National Digital Transformation Strategy: Progress Review', author: 'Ministry of Posts & Telecommunications', date: 'Jul 2025' },
  { id: 3, tag: 'Report', img: 'governance', title: 'Digital Trust, National ID & E-Government Baseline', author: 'Governance & Data Protection Desk', date: 'Jun 2025' },
  { id: 2, tag: 'Joint Study', img: 'education', title: 'ICT in Education: School Connectivity & Device Access', author: 'Ministry of Education · NIIS', date: 'May 2025' },
  { id: 3, tag: 'Working Paper', img: 'fintech', title: 'Mobile Money & Financial Inclusion Across the 15 Counties', author: 'Digital Economy Working Group', date: 'Apr 2025' },
  { id: 1, tag: 'Policy Brief', img: 'broadband', title: 'The Urban-Rural Broadband Divide: County Evidence', author: 'NIIS Research', date: 'Mar 2025' },
];
function featuredPapers() {
  const card = (p) => `<a class="fp-card" href="/research/${p.id}">
    <div class="fp-thumb" style="${slotBg('papers', p.img, true)}"></div>
    <div class="fp-body">
      <span class="tag">${esc(p.tag)}</span>
      <h4>${esc(p.title)}</h4>
      <div class="fp-meta">by ${esc(p.author)} &nbsp;·&nbsp; ${esc(p.date)}</div>
    </div>
  </a>`;
  return `<section class="wrap section reveal" id="featuredPapers">
    <div class="sec-head-dh">
      <h2 data-perch="start">Featured Research Papers</h2>
      <div class="fp-nav">
        <a class="more" href="/research" style="margin-right:.8rem">All papers ${icon('arrow')}</a>
        <button class="fp-arrow skip" data-dir="-1" aria-label="Previous">${icon('chevrons', 'icn ui-flip')}</button>
        <button class="fp-arrow skip" data-dir="1" aria-label="Next">${icon('chevrons')}</button>
      </div>
    </div>
    <div class="fp-track" id="fpTrack" data-worm>${FEATURED_PAPERS.map(card).join('')}${FEATURED_PAPERS.map(card).join('')}</div>
  </section>`;
}
const featuredPapersScript = `
(function(){
  // Continuous slow left-drift for the card rows. Hover pauses; leaving resumes.
  // Each row renders its cards twice, so we can wrap at the halfway point seamlessly.
  function marquee(track, speed){
    if(!track) return null;
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var paused=false, raf=0, last=0;
    // keep the position as a float: scrollLeft is rounded by the browser, so
    // sub-pixel per-frame increments would otherwise be discarded and never move.
    var pos=track.scrollLeft;
    function half(){ return track.scrollWidth/2; }
    function step(ts){
      if(!last) last=ts;
      var dt=Math.min(64, ts-last); last=ts;
      if(!paused){
        var h=half();
        pos += speed*(dt/1000);
        if(h>0 && pos>=h) pos-=h;
        track.scrollLeft = pos;
      } else {
        pos = track.scrollLeft;   // stay in sync if the user scrolls while paused
      }
      raf=requestAnimationFrame(step);
    }
    track.addEventListener('mouseenter', function(){ paused=true; });
    track.addEventListener('mouseleave', function(){ paused=false; });
    track.addEventListener('focusin', function(){ paused=true; });
    track.addEventListener('focusout', function(){ paused=false; });
    // a finger takes over: the drift stops, the swipe flows on with the phone's own momentum, and
    // the drift picks up again from wherever the row came to rest. Before a swipe starts, the row
    // is moved onto its second copy (which looks identical), so it can be swiped either way
    var resumeT=0;
    track.addEventListener('touchstart', function(){
      paused=true; clearTimeout(resumeT);
      var h=half(); if(h>0 && track.scrollLeft<h*0.25){ track.scrollLeft+=h; pos=track.scrollLeft; }
    }, {passive:true});
    function letGo(){
      clearTimeout(resumeT);
      resumeT=setTimeout(function(){ var h=half(); pos=track.scrollLeft; if(h>0 && pos>=h) pos-=h; track.scrollLeft=pos; paused=false; }, 2600);
    }
    track.addEventListener('touchend', letGo, {passive:true});
    track.addEventListener('touchcancel', letGo, {passive:true});
    if(!reduce) raf=requestAnimationFrame(step);
    return {
      nudge: function(dir){
        var c=track.querySelector(':scope > *');
        var w=c ? c.getBoundingClientRect().width+24 : 320;
        var h=half();
        pos = track.scrollLeft + dir*w*1.5;
        if(h>0 && pos>=h) pos-=h;
        if(pos<0) pos += h;
        track.scrollLeft = pos;
      },
      pause: function(){ paused=true; }, resume: function(){ paused=false; }
    };
  }
  window.__nictdMarquee = marquee;

  // the card rows are in place from the start (no reveal on scroll)
  document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });

  var fp = marquee(document.getElementById('fpTrack'), 26);
  document.querySelectorAll('#featuredPapers .fp-arrow').forEach(function(b){
    b.addEventListener('click', function(){ if(fp) fp.nudge(Number(b.dataset.dir)); });
  });
})();
`;

// National ICT Reports, a "facing" coverflow carousel: the centre report faces the viewer while
// its neighbours angle away in 3D. Auto-advances, pauses on hover, arrows, and a See more link.
// img keys point at the "reports" image collection, which is kept separate from the research
// papers and the hero slider so no picture appears twice on the site.
const NATIONAL_REPORTS = [
  { img: 'sector-performance', year: 2025, domains: ['market', 'access'],
    tag: 'Sector Report', title: 'Liberia ICT Sector Performance Report 2025', date: 'Q3 2025',
    desc: 'Subscriptions, traffic, revenue and infrastructure rollout across the national telecom sector.' },
  { img: 'broadband-coverage', year: 2025, domains: ['connectivity', 'access'],
    tag: 'Assessment', title: 'National Broadband Coverage & Quality Assessment', date: 'Aug 2025',
    desc: 'Measured coverage, speed and reliability by county, with the verified connectivity-gap index.' },
  { img: 'market-pricing', year: 2025, domains: ['affordability', 'market'],
    tag: 'Market Review', title: 'Telecom Market Competition & Pricing Review', date: 'Jul 2025',
    desc: 'Tariff baskets, market share and affordability of voice and data relative to household income.' },
  { img: 'digital-inclusion', year: 2025, domains: ['inclusion', 'skills'],
    tag: 'Inclusion', title: 'Digital Inclusion & Gender Access Report', date: 'Jun 2025',
    desc: 'Who is online and who is not, device ownership, skills and the gender access gap.' },
  { img: 'cybersecurity', year: 2025, domains: ['trust'],
    tag: 'Governance', title: 'Cybersecurity & Data Protection Readiness', date: 'May 2025',
    desc: 'National cyber posture, incident response capacity and data-protection compliance.' },
];

// ---------------------------------------------------------------------------
// Filter bar. One component used everywhere the app filters a list: ICT Reports,
// Research Papers, Careers and Our Partners.
//
// Row one is the controls, row two shows what is currently applied and how much of
// the list survives it. Items opt in with data-lib-item plus data-lib-search and,
// where a dropdown is present, data-lib-facet.
// ---------------------------------------------------------------------------
function filterBar({ placeholder, facetLabel, facetAll, options = [], total = 0, noun = 'shown', variant = '' }) {
  // The pill variant (Research): one large live search, the facet as a row of pills, a live count,
  // and Clear only while something is applied. Typing already filters, so it has no Search button;
  // the pills show what is applied, so it has no chip row. "/" jumps to the search.
  if (variant === 'pills') {
    return `<div class="fbar fbar--pills" data-library role="search">
    <div class="fbar-row">
      <div class="fbar-search">
        ${icon('search')}
        <input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">
        <kbd class="fbar-kbd" aria-hidden="true">/</kbd>
      </div>
      <p class="fbar-count" aria-live="polite"><b>${total}</b> of ${total} ${esc(noun)}</p>
    </div>
    ${options.length ? `<div class="fbar-pills" role="radiogroup" aria-label="${esc(facetLabel)}">
      <button type="button" class="fbar-pill is-on" data-val="" role="radio" aria-checked="true">${esc(facetAll)}</button>
      ${options.map((o) => `<button type="button" class="fbar-pill" data-val="${esc(o.value)}" role="radio" aria-checked="false">${esc(o.label)}</button>`).join('')}
      <button type="button" class="fbar-clear" hidden>${icon('rotate')} Clear</button>
    </div>` : ''}
  </div>`;
  }
  return `<div class="fbar" data-library>
    <div class="fbar-controls">
      <div class="fbar-search">
        ${icon('search')}
        <input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}">
      </div>
      ${options.length ? `<label class="fbar-facet">
        <span class="fbar-facet-label">${esc(facetLabel)}</span>
        <span class="fbar-select">
          <select class="lib-year" aria-label="${esc(facetLabel)}">
            <option value="">${esc(facetAll)}</option>
            ${options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
          </select>
          ${icon('chevron', 'icn fbar-caret')}
        </span>
      </label>` : ''}
      <button type="button" class="fbar-go">${icon('search')} Search</button>
      <button type="button" class="fbar-clear" hidden>${icon('rotate')} Clear all</button>
    </div>
    <div class="fbar-foot">
      <div class="fbar-active" hidden>
        ${icon('funnel', 'icn fbar-funnel')}
        <span class="fbar-active-label">Active filters:</span>
        <span class="fbar-chips"></span>
      </div>
      <span class="fbar-count"><b>${total}</b> of ${total} ${esc(noun)}</span>
    </div>
  </div>`;
}

// Drives every .fbar on the page. Kept dependency free and tolerant of a missing
// dropdown, so the same script serves a search-only bar and a search-plus-facet bar.
const libraryFilterScript = `
(function(){
  var bars=[].slice.call(document.querySelectorAll('[data-library]'));
  if(!bars.length) return;
  bars.forEach(function(root){
    var input=root.querySelector('.fbar-search input');
    var go=root.querySelector('.fbar-go');
    var clear=root.querySelector('.fbar-clear');
    var facet=root.querySelector('.lib-year');
    var count=root.querySelector('.fbar-count b');
    var countWrap=root.querySelector('.fbar-count');
    var active=root.querySelector('.fbar-active');
    var chips=root.querySelector('.fbar-chips');
    var empty=document.querySelector('[data-lib-empty]');
    var scope=root.closest('[data-lib-scope]')||document;
    var items=[].slice.call(scope.querySelectorAll('[data-lib-item]'));
    var facetLabel=root.querySelector('.fbar-facet-label');
    var facetName=facetLabel?facetLabel.textContent.trim():'Filter';
    // the pill variant keeps its facet in a row of pills instead of a select
    var pills=[].slice.call(root.querySelectorAll('.fbar-pill'));
    function facetVal(){ if(facet) return facet.value; var on=root.querySelector('.fbar-pill.is-on'); return on?on.getAttribute('data-val'):''; }
    function setPill(val){ pills.forEach(function(p){ var on=p.getAttribute('data-val')===val; p.classList.toggle('is-on',on); p.setAttribute('aria-checked',on?'true':'false'); }); }
    pills.forEach(function(p){ p.addEventListener('click',function(){ setPill(p.getAttribute('data-val')); apply(); }); });

    function chip(label,onClear){
      var b=document.createElement('button');
      b.type='button'; b.className='fbar-chip';
      b.innerHTML='<span></span><i aria-hidden="true">&times;</i>';
      b.querySelector('span').textContent=label;
      b.setAttribute('aria-label','Remove filter: '+label);
      b.addEventListener('click',function(){ onClear(); apply(); });
      return b;
    }

    function apply(){
      var q=(input.value||'').trim().toLowerCase();
      var f=facetVal();
      var n=0;
      items.forEach(function(it){
        var hay=(it.getAttribute('data-lib-search')||'').toLowerCase();
        var val=it.getAttribute('data-lib-facet');
        if(val===null) val=it.getAttribute('data-lib-year');
        var okQ=!q||hay.indexOf(q)>-1;
        var okF=!f||val===f;
        var show=okQ&&okF;
        it.hidden=!show;
        if(show) n++;
      });
      if(count) count.textContent=n;
      if(countWrap) countWrap.classList.toggle('is-empty',n===0);
      if(empty) empty.hidden=n!==0;

      // reflect what is applied, so a filter is never silently on (the pill variant shows it in
      // the pills and the search itself, so it has no chip row)
      if(chips){
        chips.innerHTML='';
        if(q) chips.appendChild(chip('"'+input.value.trim()+'"',function(){ input.value=''; }));
        if(f&&facet){
          var opt=facet.options[facet.selectedIndex];
          chips.appendChild(chip(facetName+': '+opt.text,function(){ facet.value=''; }));
        }
      }
      var any=!!(q||f);
      if(active) active.hidden=!any;
      if(clear) clear.hidden=!any;
    }

    input.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); apply(); } });
    input.addEventListener('input',apply);
    if(go) go.addEventListener('click',apply);
    if(facet) facet.addEventListener('change',apply);
    if(clear) clear.addEventListener('click',function(){
      input.value=''; if(facet) facet.value=''; if(pills.length) setPill(''); apply(); input.focus();
    });
    apply();
  });
  // "/" jumps to the pill variant's search, unless the visitor is already typing somewhere
  document.addEventListener('keydown',function(e){
    if(e.key!=='/'||e.metaKey||e.ctrlKey||e.altKey) return;
    var t=e.target; if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var i=document.querySelector('.fbar--pills .fbar-search input'); if(!i) return;
    e.preventDefault(); i.focus();
  });
})();
`;

// Back-compat shim: the older call signature is still used in a few places.
function libraryFilter(placeholder, years, total, facetLabel = 'Year', facetAll = 'All years') {
  return filterBar({
    placeholder,
    facetLabel,
    facetAll,
    options: years.map((y) => ({ value: String(y), label: String(y) })),
    total,
  });
}

function nationalReports() {
  const cards = NATIONAL_REPORTS.map((r, i) => `<article class="rc-card" data-i="${i}">
    <div class="rc-thumb" style="${slotBg('reports', r.img, true)}"></div>
    <div class="rc-body">
      <span class="tag">${esc(r.tag)}</span>
      <h3>${esc(r.title)}</h3>
      <p>${esc(r.desc)}</p>
      <div class="rc-meta">${esc(r.date)}</div>
    </div>
  </article>`).join('');
  return `<section class="wrap section reveal" id="natReports" style="padding-top:0">
    <div class="sec-head-dh">
      <h2 data-perch>National ICT Reports</h2>
      <div class="rc-nav">
        <a class="more" href="/reports" style="margin-right:.8rem">See more ${icon('arrow')}</a>
        <button class="rc-arrow skip" data-dir="-1" aria-label="Previous report">${icon('chevrons', 'icn ui-flip')}</button>
        <button class="rc-arrow skip" data-dir="1" aria-label="Next report">${icon('chevrons')}</button>
      </div>
    </div>
    <div class="rc-stage" id="rcStage" data-worm>${cards}</div>
  </section>`;
}
const nationalReportsScript = `
(function(){
  var stage=document.getElementById('rcStage'); if(!stage) return;
  var cards=[].slice.call(stage.querySelectorAll('.rc-card'));
  var n=cards.length, cur=0, timer=null, reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // off = how far a finger has dragged the row, in cards (0 at rest)
  function layout(off){
    off=off||0;
    cards.forEach(function(c,i){
      var d=i-cur-off; while(d>n/2) d-=n; while(d<-n/2) d+=n;   // shortest way round
      var abs=Math.abs(d);
      c.classList.toggle('is-active', abs<0.5);
      if(abs>2.5){ c.style.opacity='0'; c.style.pointerEvents='none'; c.style.transform='translateX('+(d>0?200:-200)+'%) scale(.6)'; c.style.zIndex=0; return; }
      c.style.pointerEvents='auto';   // side cards stay hoverable so they can slide themselves in
      c.style.opacity=String(abs<=1?1-0.38*abs:abs<=2?0.62-0.34*(abs-1):0.28*Math.max(0,1-(abs-2)*2));
      c.style.zIndex=String(10-Math.round(abs));
      var x=d*54, s=1-Math.min(abs,2.5)*0.14, ry=d*-20;
      c.style.transform='translateX('+x+'%) scale('+s+') rotateY('+ry+'deg)';
    });
  }
  function go(dir){ cur=(cur+dir+n)%n; layout(); }
  function play(){ if(reduce) return; stop(); timer=setInterval(function(){ go(1); }, 4200); }
  function stop(){ if(timer) clearInterval(timer); timer=null; }
  document.querySelectorAll('#natReports .rc-arrow').forEach(function(b){
    b.addEventListener('click', function(){ go(Number(b.dataset.dir)); play(); });
  });
  // Hover a side card to slide it into the centre. Re-arms only after the cursor actually MOVES,
  // so a resting cursor never re-triggers when the cards shift underneath it.
  // One hover = exactly one step. A time lock rides out the re-entry events that fire
  // while the cards are still sliding; real cursor movement then re-arms the next step.
  var armed=true, lockUntil=0, lastX=null, lastY=null;
  stage.addEventListener('mousemove', function(e){
    if(Date.now() < lockUntil) return;
    if(lastX!==null && Math.abs(e.clientX-lastX)<8 && Math.abs(e.clientY-lastY)<8) return;
    lastX=e.clientX; lastY=e.clientY; armed=true;
  });
  function stepTo(i){
    cur=i; layout();
    armed=false;
    lockUntil=Date.now()+700;
    lastX=null; lastY=null;
  }
  cards.forEach(function(c,i){
    c.addEventListener('mouseenter', function(){
      if(i===cur || !armed || Date.now()<lockUntil) return;
      stepTo(i);
    });
    c.addEventListener('click', function(){ if(i!==cur) stepTo(i); });
  });
  stage.addEventListener('mouseenter', stop); stage.addEventListener('mouseleave', play);
  // a finger drags the cards round with it; let go and they flow on to the nearest card, a quick
  // flick going one further. Upright swipes still scroll the page
  var drag=null, dragged=false;
  stage.addEventListener('pointerdown', function(e){
    if(e.pointerType==='mouse') return;
    drag={ x:e.clientX, y:e.clientY, off:0, v:0, lx:e.clientX, lt:performance.now(), horiz:null, id:e.pointerId };
    dragged=false;
  });
  stage.addEventListener('pointermove', function(e){
    if(!drag) return;
    var dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(drag.horiz===null){
      if(Math.abs(dx)<8 && Math.abs(dy)<8) return;
      drag.horiz=Math.abs(dx)>Math.abs(dy);
      if(!drag.horiz){ drag=null; return; }
      stop(); stage.classList.add('is-dragging');
      try{ stage.setPointerCapture(drag.id); }catch(err){}
    }
    dragged=true;
    var w=(cards[0].getBoundingClientRect().width||300)*0.54, t=performance.now();
    drag.v=(e.clientX-drag.lx)/Math.max(1,t-drag.lt); drag.lx=e.clientX; drag.lt=t;
    drag.off=-dx/w;
    layout(drag.off);
  });
  function letGo(){
    if(!drag) return;
    var d=drag; drag=null;
    stage.classList.remove('is-dragging');
    if(d.horiz){
      var w=(cards[0].getBoundingClientRect().width||300)*0.54;
      var steps=Math.round(d.off - d.v*260/w);
      if(!steps && Math.abs(d.off)>0.15) steps=d.off>0?1:-1;
      steps=Math.max(-2,Math.min(2,steps));
      cur=((cur+steps)%n+n)%n;
      layout(0);
    }
    play();
  }
  stage.addEventListener('pointerup', letGo); stage.addEventListener('pointercancel', letGo);
  // a drag is not a tap: it does not open a card
  stage.addEventListener('click', function(e){ if(dragged){ e.preventDefault(); e.stopPropagation(); dragged=false; } }, true);
  layout(); play();
})();
`;

// A live dashboard embedded on the home page (same element ids the dashboard JS populates).
function homeDashboard(label) {
  return `<section class="wrap section" id="homeDash" style="padding-top:0">
    <div class="sec-head-dh">
      <h2>Live Dashboard <span class="hd-chip">${esc(label)}</span></h2>
      <a class="more" href="/dashboards">See more ${icon('arrow')}</a>
    </div>
    <div class="dash-hero-dh">
      <div class="sync"><span class="pulse"></span><span class="mono" id="dash-sync-text" style="color:#B9C7D3;font-size:.8rem">connecting…</span></div>
      <div class="dash-hero-stats" id="dash-hero-stats"><div class="cell"><div class="val">…</div><div class="lbl">Loading</div></div></div>
    </div>
    <div class="chart-panel" style="margin-top:1.1rem">
      <h3 id="dash-trend-title">Trend</h3>
      <div id="dash-trend" class="chart-dh"></div>
    </div>
    <div class="two-col" style="margin-top:1.1rem">
      <div class="panel"><h3>Top 5 counties</h3><div id="dash-ranking-top" class="chart-dh"></div></div>
      <div class="panel"><h3>Bottom 5 counties</h3><div id="dash-ranking-bottom" class="chart-dh"></div></div>
    </div>

    <p style="margin-top:1.3rem;text-align:center"><a class="btn btn-gold" href="/dashboards">${icon('pie')} See more dashboards</a></p>
  </section>`;
}

// Home video, accepts a YouTube link/ID (embedded player) or a local/uploaded file (native player).
function youTubeId(s) {
  if (!s) return '';
  const m = String(s).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|v\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{8,}$/.test(String(s).trim())) return String(s).trim();
  return '';
}
function playerFor(src, title) {
  const yt = youTubeId(src);
  return yt
    ? `<iframe id="hvPlayer" src="https://www.youtube-nocookie.com/embed/${esc(yt)}?rel=0&modestbranding=1" title="${esc(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
    : `<video id="hvPlayer" src="${esc(src)}" controls preload="metadata" playsinline></video>`;
}
// Parses the admin playlist, one item per line. Two forms are accepted:
//   Title | source                    -> queue sub-label falls back to "YouTube"/"On-platform"
//   Title | Channel or credit | source -> the middle field is shown as the sub-label
// The credit form matters for embedded third-party video: .vq-title clamps to two lines,
// so appending the channel to the title would push the title itself out of view.
function parsePlaylist(raw, fallbackTitle, fallbackSrc) {
  const items = String(raw || '').split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length >= 3) {
      return { title: parts.slice(0, -2).join(' | '), source: parts[parts.length - 2], src: parts[parts.length - 1] };
    }
    if (parts.length === 2) return { title: parts[0], source: '', src: parts[1] };
    return { title: line, source: '', src: '' };
  }).filter((it) => it.src);
  if (!items.length && fallbackSrc) items.push({ title: fallbackTitle, source: '', src: fallbackSrc });
  return items;
}
// YouTube-style: main player left, "Up next" list on the right.
function homeVideoSection(src, title, caption, playlistRaw) {
  const list = parsePlaylist(playlistRaw, title, src);
  if (!list.length) return '';
  const main = list[0];
  const thumb = (it) => (youTubeId(it.src)
    ? `background-image:url('https://i.ytimg.com/vi/${esc(youTubeId(it.src))}/mqdefault.jpg')`
    : `background-image:linear-gradient(135deg,rgba(11,44,99,.35),rgba(200,16,46,.3)),url('/img/papers/connectivity.jpg')`);
  return `<section class="wrap section reveal" id="homeVideo">
    <div class="sec-head-dh"><h2 data-perch>${esc(title)}</h2></div>
    <div class="vid-layout">
      <div class="vid-frame">${playerFor(main.src, main.title)}</div>
      <aside class="vid-queue">
        <div class="vq-head">Up next</div>
        <ol class="vq-list">
          ${list.map((it, i) => `<li>
            <button class="vq-item ${i === 0 ? 'active' : ''}" data-src="${esc(it.src)}" data-title="${esc(it.title)}" type="button">
              <span class="vq-thumb" style="${thumb(it)}"></span>
              <span class="vq-meta">
                <span class="vq-title">${esc(it.title)}</span>
                <span class="vq-sub">${esc(it.source || (youTubeId(it.src) ? 'YouTube' : 'On-platform'))}</span>
              </span>
            </button>
          </li>`).join('')}
        </ol>
      </aside>
      <div class="vid-meta">
        <h3 class="vid-now" id="hvNowTitle">${esc(main.title)}</h3>
        ${caption ? `<p class="muted" style="margin:.5rem 0 0;max-width:62em">${esc(caption)}</p>` : ''}
      </div>
    </div>
  </section>`;
}
const homeVideoScript = `
(function(){
  var frame=document.querySelector('#homeVideo .vid-frame'); if(!frame) return;
  var now=document.getElementById('hvNowTitle');
  var items=[].slice.call(document.querySelectorAll('#homeVideo .vq-item'));
  function ytId(s){
    s=String(s||'').trim();
    var keys=['youtu.be/','/embed/','watch?v=','/v/','/shorts/'];
    for(var i=0;i<keys.length;i++){
      var k=s.indexOf(keys[i]);
      if(k>-1){
        var r=s.slice(k+keys[i].length), id='';
        for(var j=0;j<r.length;j++){ var c=r.charAt(j);
          if((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c==='_'||c==='-') id+=c; else break; }
        return id.length>=6 ? id : '';
      }
    }
    if(s.length>=8 && s.indexOf('/')===-1 && s.indexOf('.')===-1) return s;
    return '';
  }
  items.forEach(function(btn){
    btn.addEventListener('click', function(){
      var src=btn.dataset.src, title=btn.dataset.title, id=ytId(src);
      frame.innerHTML = id
        ? '<iframe id="hvPlayer" src="https://www.youtube-nocookie.com/embed/'+id+'?rel=0&modestbranding=1&autoplay=1" title="'+title.replace(/"/g,'&quot;')+'" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
        : '<video id="hvPlayer" src="'+src+'" controls autoplay playsinline></video>';
      if(now) now.textContent=title;
      items.forEach(function(b){ b.classList.toggle('active', b===btn); });
    });
  });

  // Start the first video as the section scrolls into view. It has to be muted,
  // every current browser blocks autoplay with sound until the visitor interacts,
  // so the player is loaded with mute=1 and the viewer unmutes from the controls.
  // Skipped if the visitor already picked something, or asked for reduced motion.
  var sec=document.getElementById('homeVideo');
  var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touched=false, started=false;
  items.forEach(function(b){ b.addEventListener('click', function(){ touched=true; }); });
  if(sec && !reduce && 'IntersectionObserver' in window){
    var vio=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting || started || touched) return;
        var f=frame.querySelector('iframe');
        if(!f || f.src.indexOf('autoplay=1')>-1) return;
        started=true; vio.disconnect();
        f.src = f.src + (f.src.indexOf('?')>-1 ? '&' : '?') + 'autoplay=1&mute=1&playsinline=1';
      });
    }, { threshold: 0.55 });
    vio.observe(sec);
  }
})();
`;

// ICT News & Updates: a squeeze carousel. One update holds the open panel and the rest narrow
// into slats down the right; opening one widens it and slides the strip along, while the copy
// and button underneath cross-fade to match. Rendered complete on the server (first panel
// open, its copy showing), then latestUpdatesScript below takes over the motion.
// News cards draw on their own image collection, so nothing here repeats a paper or report cover.
const LU_SLOTS = ['news-1', 'news-2', 'news-3', 'news-4', 'news-5'];
const UPD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const updateSlug = (u) => String((u && u.title) || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const updateAnchor = (u) => 'update-' + updateSlug(u);
exports.updateSlug = updateSlug;
// Each update keeps one photo wherever it appears (carousel, list, its own page). The photos were
// first dealt newest-first to the five updates there were; counting from the oldest keeps every
// update's photo fixed as new ones are published. Expects the updates newest first.
function updPhoto(items, i) {
  const n = LU_SLOTS.length, fromOldest = items.length - 1 - i;
  return imgs.url('news', LU_SLOTS[(((n - 1 - fromOldest) % n) + n) % n]);
}
function updDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${+m[3]} ${UPD_MONTHS[+m[2] - 1]} ${m[1]}` : '';
}
function updCategory(c) {
  const t = String(c || 'news').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
// The update's opening sentence, so title and sentence read as one short paragraph.
// A full stop only ends the sentence when a space follows it, so "33.6%" stays whole.
function firstSentence(text, max = 200) {
  const t = String(text || '').trim();
  const m = /^.+?[.!?](?=\s|$)/.exec(t);
  let out = m ? m[0] : t;
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return out;
}
const SQ_BACK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M9.6 2.6 5.1 7.1h9.1v1.8H5.1l4.5 4.5-1.2 1.2-6-6L1.8 8l.6-.6 6-6 1.2 1.2Z"/></svg>';
const SQ_NEXT = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.4 2.6l4.5 4.5H1.8v1.8h9.1l-4.5 4.5 1.2 1.2 6-6 .6-.6-.6-.6-6-6-1.2 1.2Z"/></svg>';
const SQ_GO = '<svg width="6" height="9" viewBox="0 0 6 9" fill="none" aria-hidden="true"><path d="M1.2 1 4.7 4.5 1.2 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// col: 0 is the open panel, 1-3 the narrowing panels, above 3 the tail of slats, below 0 a
// slat on its way out of the left edge. The script keeps the same markup in step.
const sqKind = (col) => (col === 0 ? 'open' : col < 0 ? 'out' : col > 3 ? 'tail' : 'panel');
function sqCard(s, i, col, place = col) {
  return `<button type="button" class="sq-card" role="tab" id="sqTab-${place}" data-slide="${i}" data-col="${col}" data-kind="${sqKind(col)}" aria-selected="${col === 0}" aria-controls="sqPanel" aria-label="${esc(s.title)}" tabindex="${col === 0 ? 0 : -1}"><img class="sq-pic" src="${esc(s.img)}" alt="" decoding="async" draggable="false"><span class="sq-over" aria-hidden="true"><span class="sq-cap"><span class="sq-title" data-go>${esc(s.title)}</span><span class="sq-over-in">${esc(s.cat)} · ${esc(s.date)}</span></span></span><span class="sq-spine" aria-hidden="true"><span class="sq-spine-in" data-go>${esc(s.title)}</span></span></button>`;
}
function latestUpdates(headlines) {
  if (!headlines || !headlines.length) return '';
  // every update comes in (so each keeps its photo); the carousel shows the latest eight
  const slides = headlines.slice(0, 8).map((h, i) => {
    const title = String(h.title || '').trim();
    return {
      title, desc: firstSentence(h.body),
      img: updPhoto(headlines, i),
      cat: updCategory(h.category), date: updDate(h.published_on), href: '/updates/' + updateSlug(h),
    };
  });
  const n = slides.length;
  const slats = Math.max(1, Math.min(3, n - 4));
  const visible = 4 + slats;
  const strip = n > 1
    ? Array.from({ length: visible }, (_, place) => sqCard(slides[place % n], place % n, place)).join('')
    : sqCard(slides[0], 0, 0);
  const copy = slides.map((s, i) => `<div class="sq-slide${i === 0 ? ' is-open' : ''}" aria-hidden="${i !== 0}">
        <p>${esc(s.desc)}</p>
        <a class="sq-go" href="${esc(s.href)}" tabindex="${i === 0 ? 0 : -1}">Read update ${SQ_GO}</a>
      </div>`).join('');
  const data = JSON.stringify(slides.map(({ title, img, cat, date, href }) => ({ title, img, cat, date, href }))).replace(/</g, '\\u003c');
  return `<section class="wrap section reveal" id="latestUpdates" style="padding-top:0">
    <div class="sec-head-dh">
      <h2 id="sqTrendsTitle" data-perch>ICT News &amp; Updates</h2>
      <div class="sq-nav">
        <a class="more" href="/updates">All updates ${icon('arrow')}</a>
        ${n > 1 ? `<button type="button" class="sq-arrow skip" data-sq-step="-1" aria-label="Previous update">${icon('chevrons', 'icn ui-flip')}</button><button type="button" class="sq-arrow skip" data-sq-step="1" aria-label="Next update">${icon('chevrons')}</button>` : ''}
      </div>
    </div>
    <div class="sq" id="sqTrends" data-worm><div class="sq-body" style="--sq-slats:${slats}">
      <div class="sq-window"><div class="sq-strip" role="tablist" aria-labelledby="sqTrendsTitle">${strip}</div></div>
      <div class="sq-copy" id="sqPanel" role="tabpanel" aria-labelledby="sqTab-0" aria-live="polite">${copy}</div>
    </div></div>
    <script type="application/json" id="sqTrendsData">${data}</script>
  </section>`;
}
// The strip is a row that slides, not a ring that turns. Stepping on appends a card to the tail,
// shifts every card one column left (the open one narrows to a slat and leaves the left edge)
// and slides the row by one slat plus gap; when the movement ends, the off-screen card is cut
// and the numbers reset with transitions off, so the picture never jumps. Stepping back is the
// mirror. Widths come from CSS shares of the row, so nothing is measured.
const latestUpdatesScript = `
(function(){
  var section=document.getElementById('latestUpdates');
  var root=document.getElementById('sqTrends');
  var src=document.getElementById('sqTrendsData');
  if(!section||!root||!src) return;
  var data; try{ data=JSON.parse(src.textContent); }catch(e){ return; }
  var n=data.length; if(n<2) return;
  var strip=root.querySelector('.sq-strip');
  var copies=[].slice.call(root.querySelectorAll('.sq-slide'));
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  var slats=Math.max(1,Math.min(3,n-4)), visible=4+slats;
  var wrap=function(i){ return ((i%n)+n)%n; };
  var cards=[].slice.call(strip.children).map(function(el){ return { el:el, slide:+el.getAttribute('data-slide') }; });
  var column=0, slid=0, pending=null, uid=cards.length;
  var panel=document.getElementById('sqPanel');

  function make(i){
    var s=data[i], b=document.createElement('button');
    b.type='button'; b.className='sq-card'; b.setAttribute('role','tab'); b.id='sqTab-'+(uid++);
    b.setAttribute('data-slide',i); b.setAttribute('aria-controls','sqPanel'); b.setAttribute('aria-label',s.title);
    var img=document.createElement('img'); img.className='sq-pic'; img.src=s.img; img.alt=''; img.decoding='async'; img.draggable=false;
    var over=document.createElement('span'); over.className='sq-over'; over.setAttribute('aria-hidden','true');
    var label=document.createElement('span'); label.className='sq-over-in'; label.textContent=s.cat+' \\u00b7 '+s.date;
    var cap=document.createElement('span'); cap.className='sq-cap';
    var title=document.createElement('span'); title.className='sq-title'; title.setAttribute('data-go',''); title.textContent=s.title;
    cap.appendChild(title); cap.appendChild(label); over.appendChild(cap);
    var spine=document.createElement('span'); spine.className='sq-spine'; spine.setAttribute('aria-hidden','true');
    var spineIn=document.createElement('span'); spineIn.className='sq-spine-in'; spineIn.setAttribute('data-go',''); spineIn.textContent=s.title;
    spine.appendChild(spineIn); b.appendChild(img); b.appendChild(over); b.appendChild(spine);
    return b;
  }
  function kind(col){ return col===0?'open':col<0?'out':col>3?'tail':'panel'; }
  function paint(){
    cards.forEach(function(c,place){
      var col=place+column;
      c.el.setAttribute('data-col',col); c.el.setAttribute('data-kind',kind(col));
      c.el.setAttribute('aria-selected',col===0?'true':'false'); c.el.tabIndex=col===0?0:-1;
    });
    strip.style.setProperty('--sq-slid',slid);
  }
  // apply a change with every transition off, flushing styles either side so the next change animates from it
  function instant(fn){ root.classList.add('is-still'); fn(); void strip.offsetWidth; root.classList.remove('is-still'); void strip.offsetWidth; }
  function front(){ var c=cards[-column]; return c?c.slide:0; }
  function syncCopy(){
    var open=front(), f=cards[-column];
    if(f&&panel) panel.setAttribute('aria-labelledby',f.el.id);
    copies.forEach(function(el,i){
      var on=i===open; el.classList.toggle('is-open',on); el.setAttribute('aria-hidden',on?'false':'true');
      var go=el.querySelector('.sq-go'); if(go) go.tabIndex=on?0:-1;
    });
  }
  function settle(){
    if(!pending) return;
    clearTimeout(pending.t); var fwd=pending.forward; pending=null;
    instant(function(){
      var keep=fwd?cards.slice(-visible):cards.slice(0,visible);
      cards.forEach(function(c){ if(keep.indexOf(c)<0) c.el.remove(); });
      cards=keep; column=0; slid=0; paint();
    });
  }
  // the finger's offset while it drags the strip (px); released together with the step it commits
  function setDrag(px){ strip.style.setProperty('--sq-drag',px+'px'); }
  function release(){ root.classList.remove('is-dragging'); setDrag(0); }
  // quick: a swipe plays out in about half the time the autoplay takes
  function step(by,auto,quick){
    if(!by) return;
    settle();
    if(panel) panel.setAttribute('aria-live',auto?'off':'polite');
    root.classList.toggle('is-quick',!!quick);
    var ms=reduce.matches?0:quick?560:1000, k;
    if(by>0){
      instant(function(){
        for(k=0;k<by;k++){ var s=wrap(cards[cards.length-1].slide+1), el=make(s); strip.appendChild(el); cards.push({el:el,slide:s}); }
        paint();
      });
      release(); column-=by; slid-=by; paint();
    }else{
      instant(function(){
        for(k=0;k<-by;k++){ var s=wrap(cards[0].slide-1), el=make(s); strip.insertBefore(el,strip.firstChild); cards.unshift({el:el,slide:s}); }
        column=by; slid=by; paint();
      });
      release(); column=0; slid=0; paint();
    }
    syncCopy();
    pending={ forward:by>0, t:setTimeout(settle, ms+40) };
    if(!ms) settle();
    arm();
  }

  strip.addEventListener('click',function(e){
    var b=e.target.closest('.sq-card'); if(!b) return;
    var col=+b.getAttribute('data-col');
    if(col===0||(col>0&&col<=3&&e.target.closest('[data-go]'))){ var d=data[+b.getAttribute('data-slide')]; if(d&&d.href) location.href=d.href; return; }
    if(col>0) step(col);
  });
  strip.addEventListener('mousemove',function(e){
    var b=e.target.closest('.sq-card'); if(!b) return;
    var col=+b.getAttribute('data-col');
    if(col>=0&&col<=3) root.setAttribute('data-hover',col); else root.removeAttribute('data-hover');
  });
  strip.addEventListener('mouseleave',function(){ root.removeAttribute('data-hover'); });
  strip.addEventListener('keydown',function(e){
    var by=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0; if(!by) return;
    e.preventDefault(); step(by);
    var f=cards[-column]; if(f) f.el.focus({preventScroll:true});
  });
  section.querySelectorAll('[data-sq-step]').forEach(function(btn){
    btn.addEventListener('click',function(){ step(+btn.getAttribute('data-sq-step')); });
  });

  // keeps moving: each card slides over in 1 s, rests 1 s, and the next one goes. It holds while
  // the pointer is on the carousel, while it has focus, off screen, or in a hidden tab
  var timer=0, hovering=false, focused=false, seen=true;
  function arm(){
    clearTimeout(timer);
    if(reduce.matches||hovering||focused||!seen||document.hidden) return;
    timer=setTimeout(function(){ step(1,true); },2000);
  }
  // a finger swipes it: left for the next update, right for the one before. The strip follows the
  // finger while it drags; a short drag or a flick is enough to send it on, and anything less
  // springs back. A mostly vertical move is left to the page, so scrolling past still works.
  var sx=null, sy=0, swiping=false, eatClick=false, trail=[];
  root.addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse'||e.button) return;
    sx=e.clientX; sy=e.clientY; swiping=false; trail=[[e.clientX,e.timeStamp]];
  });
  root.addEventListener('pointermove',function(e){
    if(sx===null) return;
    var dx=e.clientX-sx, dy=e.clientY-sy;
    if(!swiping){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){ sx=null; return; }
      if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy)) return;
      swiping=true; clearTimeout(timer); settle(); root.classList.add('is-dragging');
      try{ root.setPointerCapture(e.pointerId); }catch(err){}
    }
    trail.push([e.clientX,e.timeStamp]); if(trail.length>6) trail.shift();
    // close to the finger at first, then a little give the further it goes
    var w=root.clientWidth*.5, a=Math.abs(dx), d=a<w?a:w+(a-w)*.35;
    setDrag((dx<0?-1:1)*d*.92);
  });
  function endSwipe(e,cancelled){
    if(sx===null) return;
    var dx=e.clientX-sx; sx=null;
    if(!swiping){ arm(); return; }
    eatClick=true;
    var a=trail[0], b=trail[trail.length-1], v=b&&a&&b[1]>a[1]?(b[0]-a[0])/(b[1]-a[1]):0;
    if(!cancelled&&(Math.abs(dx)>22||Math.abs(v)>.3)) step((Math.abs(v)>.3?v:dx)<0?1:-1,false,true);
    else { release(); arm(); }
  }
  root.addEventListener('pointerup',function(e){ endSwipe(e,false); });
  root.addEventListener('pointercancel',function(e){ endSwipe(e,true); });
  root.addEventListener('click',function(e){ if(eatClick){ e.preventDefault(); e.stopPropagation(); eatClick=false; } },true);
  root.addEventListener('mouseenter',function(){ hovering=true; arm(); });
  root.addEventListener('mouseleave',function(){ hovering=false; arm(); });
  section.addEventListener('focusin',function(){ focused=true; arm(); });
  section.addEventListener('focusout',function(e){ if(!section.contains(e.relatedTarget)){ focused=false; arm(); } });
  document.addEventListener('visibilitychange',arm);
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ seen=es[0].isIntersecting; arm(); },{threshold:0.35}).observe(root);
  }
  arm();
})();
`;

// ============ DATA EXPLORER ============
exports.dataExplorer = (ctx, { indicators, indicatorsByDomain, domainOrder, domainLabels, meta, counties, focus, compare }) => shell(ctx, {
  title: 'Data Explorer', active: '/data', workspaceActive: 'data',
  extraHead: `<script src="/assets/explorer.js?v=${ASSET_V}" defer></script>`,
  body: `
  <!-- Pre-loader. It is the first thing in the body so it paints before anything behind it,
       and the script that dismisses it sits immediately after, so the hard timeout is armed
       before any other script on the page can fail. Without JS the noscript rule removes it
       outright: the curtain must never be able to strand the page behind it. -->
  <div class="dxload" id="dxLoad" role="status" aria-label="Loading the Data Explorer">
    <div class="dxload-inner">
      <video class="dxload-vid" src="/media/explorer-loader.mp4" poster="/media/explorer-loader-poster.jpg"
             autoplay muted playsinline preload="auto" aria-hidden="true" tabindex="-1"></video>
      <img class="dxload-still" src="/media/explorer-loader-poster.jpg" alt="" aria-hidden="true">
    </div>
    <p class="dxload-line" aria-hidden="true">
      <span class="dxload-lead">Loading</span>
      <span class="dxload-roll">
        <!-- Sizes the window to the longest subject so the word before it never shifts. -->
        <span class="dxload-sizer">Data Explorer<i class="dxload-dots"><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span></i></span>
        <span class="dxload-msg" data-step="0">Data Explorer<i class="dxload-dots"><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span></i></span>
        <span class="dxload-msg" data-step="1">Databases<i class="dxload-dots"><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span></i></span>
        <span class="dxload-msg" data-step="2">Indicators<i class="dxload-dots"><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span></i></span>
      </span>
    </p>
    <div class="dxload-bar" aria-hidden="true"><i></i></div>
    <span class="sr-only">Loading the Data Explorer, please wait.</span>
  </div>
  <noscript><style>.dxload{display:none!important}</style></noscript>
  <script>
  (function(){
    var el = document.getElementById('dxLoad');
    if (!el) return;
    // Four seconds, three subjects. The slots are chained rather than scheduled up front:
    // this page's own script is heavy, and three independent timers can all come due at
    // once while the main thread is blocked, firing the last two in a burst too fast to
    // read. Chaining means each subject is measured from the moment the previous one
    // actually appeared, so every one of them gets its time on screen.
    var SLOT = 1333, HARD = 9000;
    var msgs = el.querySelectorAll('.dxload-msg');
    var done = false, loaded = false, elapsed = false, i = 0;

    function show(n){
      for (var k = 0; k < msgs.length; k++) {
        msgs[k].classList.toggle('is-live', k === n);
        msgs[k].classList.toggle('is-past', k < n);
      }
    }
    function step(){
      show(i);
      i++;
      setTimeout(i < msgs.length ? step : function(){ elapsed = true; maybe(); }, SLOT);
    }
    step();
    // next frame, so the first subject has a from-state to rise out of
    setTimeout(function(){ el.classList.add('is-go'); }, 30);

    function hide(){
      if (done) return;
      done = true;
      el.classList.add('is-out');
      var vid = el.querySelector('video');
      if (vid) { try { vid.pause(); } catch (e) {} }
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 620);
    }
    function maybe(){ if (loaded && elapsed) hide(); }

    // Armed first: whatever else fails, the page is never left behind the curtain.
    setTimeout(hide, HARD);
    function onLoad(){ loaded = true; maybe(); }
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    // A back/forward restore must not show a stale curtain over a rendered page.
    window.addEventListener('pageshow', function(e){ if (e.persisted) hide(); });
  })();
  </script>

  ${pageHeader('data-explorer', 'Data Explorer', 'Map, trend and county comparison for every indicator you are authorized to see.')}

  <div class="sticky-selector dx-cmd dx-black"><div class="wrap">
    <div class="selector-field"><label>Category</label>${xdd('dd-category', 'All categories')}</div>
    <div class="selector-field"><label>Indicator</label>${xdd('dd-indicator', meta.name)}</div>
    <div class="selector-field"><label>Focus Location</label>${xdd('dd-focus', focus || 'National (Liberia)')}</div>
    <div class="selector-field"><label>Comparison Area</label>${xdd('dd-compare', compare || 'None')}</div>
    <div class="selector-field dx-cmd-year">
      <label for="year-slider">Year <b id="year-slider-val">${meta.year || 2025}</b></label>
      <input type="range" id="year-slider" min="2018" max="2025" value="${meta.year || 2025}" aria-label="Year">
    </div>
    <div class="selector-field dx-cmd-play">
      <label>Animate</label>
      <button type="button" class="dx-play" id="dx-play" aria-label="Play through the years">${icon('rotate')}<span>Play years</span></button>
    </div>
    <button type="button" class="dx-cmd-browse" id="dx-cmd-browse" aria-controls="indicator-tree" aria-expanded="false">${icon('layers')}<span>Browse indicators</span></button>
    <button type="button" class="dx-cmd-pin" id="dx-cmd-pin" aria-label="Hide the filters" aria-expanded="true">${icon('chevron')}</button>
    <button type="button" class="dx-cmd-peek" id="dx-cmd-peek" aria-hidden="true" tabindex="-1"></button>
  </div></div>

  <nav class="dx-rail" id="dx-rail" aria-label="Jump to section"></nav>

  <div class="explorer-shell dx-black">
    <aside class="indicator-tree" id="indicator-tree">
      <button type="button" class="tree-toggle" id="tree-toggle" aria-expanded="false">${icon('layers')}<span>Browse indicators</span></button>
      <div class="tree-sheet-head"><p>Browse indicators</p><button type="button" class="tree-close" id="tree-close" aria-label="Close the indicator list">${icon('x')}</button></div>
      <div class="tree-body">
        <p class="tree-title">Indicators</p>
        ${domainOrder.map((d) => `<div class="tree-cat ${meta.domain === d ? 'open' : ''}">
          <div class="tree-cat-header" role="button" tabindex="0"><span>${esc(domainLabels[d])}</span><em class="tree-count">${(indicatorsByDomain[d] || []).length}</em>${icon('chevron')}</div>
          <div class="tree-items"><div class="tree-items-inner">
            ${(indicatorsByDomain[d] || []).map((i) => `<div class="tree-item ${i.code === meta.code ? 'selected' : ''}" data-code="${esc(i.code)}" role="button" tabindex="0"><span>${esc(i.name)}</span></div>`).join('')}
          </div></div>
        </div>`).join('')}
      </div>
    </aside>

    <main class="dx-main" id="dx-main">
      <section class="dx-sec dx-intro" id="dx-intro">
        <p class="dx-eyebrow" id="explorer-domain-tag">${esc(domainLabels[meta.domain])}</p>
        <h1 class="dx-title" id="explorer-title">${esc(meta.name)}</h1>
        <p class="dx-statement" id="explorer-desc">${esc(meta.description || '')}</p>
        <p class="dx-source">
          <span class="dx-mock" id="dx-mock" hidden title="These figures are placeholders for demonstration. They are not official statistics.">Mock data</span>
          <span class="dx-fact dx-fact-unit"><i>Unit</i><b id="dx-unit">${esc(meta.unit)}</b></span>
          <span class="dx-fact dx-fact-source"><i>Source</i><b id="dx-agency">${esc(meta.agency || 'n/a')}</b></span>
          <span class="dx-fact dx-fact-coverage"><i>Coverage</i><b id="dx-coverage">${counties.length} counties</b></span>
          <span class="dx-fact dx-fact-years"><i>Years</i><b id="dx-years-span">&nbsp;</b></span>
        </p>
      </section>

      <section class="dx-sec dx-snapshot" id="dx-snapshot" aria-label="Data snapshot">
        <div class="dx-stat"><span class="dx-stat-lbl">Current value</span><span class="dx-stat-val" id="snap-value">0</span><span class="dx-stat-sub" id="snap-value-sub">&nbsp;</span><span class="dx-stat-cmp" id="snap-value-cmp" hidden></span></div>
        <div class="dx-stat"><span class="dx-stat-lbl" id="snap-rank-lbl">National position</span><span class="dx-stat-val" id="snap-rank">&nbsp;</span><span class="dx-stat-sub" id="snap-rank-sub">&nbsp;</span><span class="dx-stat-cmp" id="snap-rank-cmp" hidden></span></div>
        <div class="dx-stat"><span class="dx-stat-lbl">Change</span><span class="dx-stat-val" id="snap-change">&nbsp;</span><span class="dx-stat-sub" id="snap-change-sub">&nbsp;</span><span class="dx-stat-cmp" id="snap-change-cmp" hidden></span></div>
        <div class="dx-stat"><span class="dx-stat-lbl">Locations</span><span class="dx-stat-val" id="snap-locations">0</span><span class="dx-stat-sub" id="snap-locations-sub">counties reporting</span><span class="dx-stat-cmp" id="snap-locations-cmp" hidden></span></div>
      </section>

      <section class="dx-sec dx-view" id="dx-geo">
        <!-- The stage pins for the length of its three readings: the map holds still and stays
             wholly in view while 01, 02 and 03 change in place, then the page carries on. -->
        <div class="dx-geo-pin" id="dx-geo-pin">
        <div class="dx-geo-sticky">
        <header class="dx-view-head">
          <span class="dx-view-num">View 01 &middot; Geography</span>
          <h2>Where does it stand across the country?</h2>
          <p class="dx-view-sub" id="geo-sub">&nbsp;</p>
        </header>
        <div class="dx-map-stage">
          <div class="dx-steps-col">
          <div class="dx-steps" id="map-steps">
            <article class="dx-step" data-step="national"><span class="dx-step-n">01</span><h3 id="step1-h">&nbsp;</h3><p id="step1-p">&nbsp;</p></article>
            <article class="dx-step" data-step="top"><span class="dx-step-n">02</span><h3 id="step2-h">&nbsp;</h3><p id="step2-p">&nbsp;</p></article>
            <article class="dx-step" data-step="bottom"><span class="dx-step-n">03</span><h3 id="step3-h">&nbsp;</h3><p id="step3-p">&nbsp;</p></article>
          </div>
          <div class="dx-step-dots" id="map-step-dots" aria-hidden="true"><i></i><i></i><i></i></div>
          </div>
          <div class="dx-map-sticky">
            <div class="dx-map-frame">
              <div id="choropleth" class="dx-map"></div>
              <div class="dx-map-foot">
                <div class="map-legend"><span>Lower</span><span class="map-legend-bar"></span><span>Higher</span></div>
                <div class="dx-readout"><span class="dx-readout-lbl">Reading</span><b id="readout-name">National</b><span class="dx-readout-val" id="readout-val"></span></div>
                <div class="dx-size">
                  <label for="size-choropleth">Size</label>
                  <input type="range" id="size-choropleth" class="dx-size-range" data-viz="choropleth" min="45" max="100" value="100" step="5">
                  <span class="dx-size-val" id="size-choropleth-val">100%</span>
                </div>
                <button type="button" class="dx-expand" data-expand="choropleth" title="View full screen" aria-label="View full screen">${icon('expand')}</button>
              </div>
            </div>
          </div>
        </div>
        </div>
        </div>
      </section>

      <section class="dx-sec dx-view" id="dx-rank-sec">
        <header class="dx-view-head">
          <span class="dx-view-num">View 02 &middot; Ranking</span>
          <h2>Which counties lead?</h2>
          <p class="dx-view-sub" id="rank-sub">&nbsp;</p>
        </header>
        ${vizSize('viz-ranking')}
        <div id="viz-ranking" class="dx-viz"></div>
      </section>

      <section class="dx-sec dx-view" id="dx-trend">
        <header class="dx-view-head">
          <span class="dx-view-num">View 03 &middot; Trend</span>
          <h2>How has it changed over time?</h2>
          <p class="dx-view-sub" id="trend-sub">&nbsp;</p>
        </header>
        ${vizSize('explorer-trend')}
        <div id="explorer-trend" class="dx-viz dx-viz-tall"></div>
        <div class="dx-legend" id="trend-legend"></div>
      </section>

      <section class="dx-sec dx-view" id="dx-change">
        <header class="dx-view-head">
          <span class="dx-view-num">View 04 &middot; Change</span>
          <h2>Where is it rising, and where is it slipping?</h2>
          <p class="dx-view-sub" id="change-sub">&nbsp;</p>
        </header>
        ${vizSize('viz-change')}
        <div id="viz-change" class="dx-viz"></div>
      </section>

      <section class="dx-sec dx-view" id="dx-compare">
        <header class="dx-view-head">
          <span class="dx-view-num">View 05 &middot; Comparison</span>
          <h2 id="cmp-title">How does it compare?</h2>
          <p class="dx-view-sub" id="cmp-sub">&nbsp;</p>
        </header>
        ${vizSize('viz-compare')}
        <div id="viz-compare" class="dx-viz"></div>
        <div class="compare-stat-row" id="compare-stats"></div>
      </section>

      <section class="dx-sec dx-view" id="dx-heat">
        <header class="dx-view-head">
          <span class="dx-view-num">View 06 &middot; Matrix</span>
          <h2>Every county, every year</h2>
          <p class="dx-view-sub">Darker cells carry higher values. Click any cell to move the page to that county and year.</p>
        </header>
        ${vizSize('viz-heat')}
        <div id="viz-heat" class="dx-viz viz-heat-wrap"></div>
      </section>

      <section class="dx-sec dx-view dx-data" id="dx-data">
        <header class="dx-view-head">
          <span class="dx-view-num">Data &middot; Analyze</span>
          <h2>Explore the complete dataset</h2>
          <p class="dx-view-sub" id="data-sub">&nbsp;</p>
        </header>
        <div class="table-toolbar">
          <div class="toolbar-actions">
            <a class="btn btn-ghost btn-sm" id="dl-csv" href="#">${icon('download')} CSV</a>
            <a class="btn btn-ghost btn-sm" id="dl-json" href="#">${icon('download')} JSON</a>
            <button class="btn btn-ghost btn-sm" id="btn-png" type="button">${icon('camera')} PNG</button>
            <button class="btn btn-ghost btn-sm" id="btn-share" type="button">${icon('share')} Share link</button>
          </div>
        </div>
        <div class="dx-table-wrap">
          <table class="data-table" id="explorer-table">
            <thead><tr><th class="sortable" data-key="county">County<span class="sort-arrow"></span></th><th class="num sortable" data-key="value">Value<span class="sort-arrow"></span></th><th class="num sortable" data-key="yoy">YoY change<span class="sort-arrow"></span></th><th class="num sortable" data-key="rank">Rank<span class="sort-arrow"></span></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

    </main>
  </div>
  <!-- Full screen stage. The visual is moved in here and moved back on close, so it keeps
       its listeners and its drawn state rather than being rebuilt from a copy. -->
  <div class="dx-fs" id="dx-fs" hidden>
    <div class="dx-fs-bar">
      <span class="dx-fs-title" id="dx-fs-title"></span>
      <button type="button" class="dx-fs-close" id="dx-fs-close" aria-label="Close full screen">${icon('x')}</button>
    </div>
    <div class="dx-fs-body" id="dx-fs-body"></div>
  </div>
  <script>window.__NICTD_PAGE__='explorer';window.__EXPLORER_STATE__=${JSON.stringify({ indicator: meta.code, year: meta.year || 2025, focus: focus || '', compare: compare || '', indicators, counties: counties.map((c) => ({ name: c.name })) })};</script>`,
});


// ============ DATA LANDSCAPE ============
// Liberia's 15 counties as a floor, one tower per county sized by the selected indicator.
// The engine is public/landscape.js; the geometry is public/liberia-counties.js, the same
// file the Data Explorer's map draws from.
exports.landscape = (ctx, { indicators, meta, year, years, counties }) => shell(ctx, {
  title: 'Data Landscape', active: '/landscape', workspaceActive: 'data',
  extraHead: `<script src="/assets/lsc-charts.js?v=${ASSET_V}" defer></script>
    <script src="/assets/landscape.js?v=${ASSET_V}" defer></script>`,
  body: `
  ${pageHeader('data-landscape', 'Data Landscape', 'Every county as a tower. Height is the value, so you can see which counties lead and which are behind national, in one look.')}

  <div class="sticky-selector dx-cmd dx-black lsc-cmd"><div class="wrap">
    <div class="selector-field"><label>Category</label>${xdd('dd-lsc-category', 'All categories')}</div>
    <div class="selector-field"><label>Indicator</label>${xdd('dd-lsc-indicator', meta.name)}</div>
    <div class="selector-field lsc-cmd-year">
      <label for="lsc-year">Year <b id="lsc-year-val">${year}</b></label>
      <input type="range" id="lsc-year" min="${years[0]}" max="${years[years.length - 1]}" value="${year}" aria-label="Year">
    </div>
    <div class="selector-field lsc-cmd-play">
      <label>Animate</label>
      <button type="button" class="lsc-play" id="lsc-play" aria-label="Play through the years">${icon('rotate')}<span>Play years</span></button>
    </div>
  </div></div>

  <div class="wrap section lsc-wrap">
    <div class="lsc-head">
      <p class="dx-eyebrow" id="lsc-domain">${esc(meta.domainLabel || '')}</p>
      <h1 class="dx-title" id="lsc-title">${esc(meta.name)}</h1>
      <p class="dx-statement" id="lsc-desc">${esc(meta.description || '')}</p>
      <p class="dx-source">
        <span class="dx-mock" id="lsc-mock" ${meta.is_mock ? '' : 'hidden'} title="These figures are placeholders for demonstration. They are not official statistics.">Mock data</span>
        <span class="dx-fact"><i>Unit</i><b id="lsc-unit">${esc(meta.unit || '')}</b></span>
        <span class="dx-fact dx-fact-source"><i>Source</i><b id="lsc-agency">${esc(meta.agency || 'n/a')}</b></span>
      </p>
    </div>

    <div class="lsc-stage">
      <div class="lsc-map" id="lsc-map">
        <button type="button" class="lsc-fs" id="lsc-fs" aria-label="Expand the landscape to full screen">
          <i class="lsc-ico lsc-ico-in">${icon('expand')}</i><i class="lsc-ico lsc-ico-out">${icon('x')}</i>
        </button>
        <div class="lsc-nat" id="lsc-nat" hidden><i>National</i><b id="lsc-nat-val"></b></div>
        <div class="lsc-card" id="lsc-card" hidden></div>
        <p class="lsc-status" id="lsc-status" role="status"></p>
      </div>
      <aside class="lsc-side">
        <div class="lsc-side-head">
          <h2>All 15 counties</h2>
          <p>Hover or tap a county here or on the map. Select one to carry it through.</p>
          <p class="lsc-natnote" id="lsc-natnote" hidden></p>
        </div>
        <div class="lsc-rank" id="lsc-rank"></div>
        <a class="lsc-go" id="lsc-go" href="/data">Open in Data Explorer</a>
      </aside>
    </div>

    <section class="lsc-analysis" id="lsc-analysis">
      <div class="lsc-an-head">
        <div>
          <p class="dx-eyebrow">Analysis</p>
          <h2>Five ways to interrogate this indicator</h2>
          <p class="lsc-an-sub">Every panel is computed from the same figures as the landscape above.
            Hover any mark for the county and value behind it.</p>
        </div>
        <div class="lsc-an-pair">
          <label>Plot against</label>
          ${xdd('dd-lsc-pair', 'Choose a second indicator')}
        </div>
      </div>
      <div class="lsc-an-grid">
        ${[
          ['motion', 'Motion scatter', 'Where is each county, and which way is it moving?'],
          ['bump', 'Rank trajectories', 'Who overtook whom, across every year at once?'],
          ['cartogram', 'Population cartogram', 'Weighted by people, not by land area.'],
          ['gap', 'Gap to the leader', 'How far is each county from the best performer?'],
          ['readiness', 'Readiness board', 'Which domains are defined, and what is still placeholder?'],
        ].map(([id, t, q], i) => `<figure class="lsc-an-card" id="lsc-card-${id}" data-chart="${id}">
          <figcaption>
            <span class="lsc-an-n">${String(i + 1).padStart(2, '0')}</span>
            <span><b>${t}</b><em>${q}</em></span>
            <button type="button" class="lsc-an-fs" data-fs="${id}" aria-label="Expand ${t} to full screen">
              <i class="lsc-ico lsc-ico-in">${icon('expand')}</i><i class="lsc-ico lsc-ico-out">${icon('x')}</i>
            </button>
          </figcaption>
          <div class="lsc-an-plot" id="lsc-an-${id}"></div>
        </figure>`).join('')}
      </div>
    </section>

    <div class="lsc-legend">
      <h2>How to read this</h2>
      <div class="lsc-legend-grid">
        <div><b>Tower height is the value.</b> The taller the tower, the higher the figure for that county. The scale is fixed across every year of an indicator, so when you scrub the years you are watching real change, not a rescaled picture.</div>
        <div><b>Colour says the same thing again.</b> Pale to deep on the national scale, so rank still reads where a tall tower stands in front of a short one. The county you point at turns red.</div>
        <div><b>The floor is the map.</b> Each county tile carries a faint wash of its own value and uses the exact county boundaries, so the landscape still works as a map of Liberia.</div>
        <div><b>The floating outline is the national figure.</b> Towers breaking through it are above the national level; towers under it are below. Counties with no recorded value show a grey tile and no tower.</div>
      </div>
    </div>
  </div>

  <div class="lsc-deck" id="lsc-deck" hidden role="dialog" aria-modal="true" aria-label="Visualization deck">
    <div class="lsc-deck-bar">
      <span class="lsc-deck-n" id="lsc-deck-n"></span>
      <span class="lsc-deck-title" id="lsc-deck-title"></span>
      <span class="lsc-deck-tools">
        <button type="button" class="lsc-deck-play" id="lsc-deck-play" aria-label="Play through every visual">${icon('rotate')}<span>Play all</span></button>
        <button type="button" class="lsc-deck-x" id="lsc-deck-close" aria-label="Close full screen">${icon('x')}</button>
      </span>
    </div>
    <div class="lsc-deck-stage">
      <button type="button" class="lsc-deck-nav is-prev" id="lsc-deck-prev" aria-label="Previous visual">${icon('chevron')}</button>
      <div class="lsc-deck-body" id="lsc-deck-body"></div>
      <button type="button" class="lsc-deck-nav is-next" id="lsc-deck-next" aria-label="Next visual">${icon('chevron')}</button>
    </div>
  </div>

  <script>window.__NICTD_PAGE__='landscape';window.__LANDSCAPE_STATE__=${JSON.stringify({
    indicator: meta.code,
    year,
    indicators: indicators.map((i) => ({ code: i.code, name: i.name, unit: i.unit, domain: i.domain, domainLabel: i.domainLabel, description: i.description, agency: i.agency, is_mock: !!i.is_mock })),
    counties: (counties || []).map((c) => ({ name: c.name, population: c.population })),
    domains: Object.values(indicators.reduce((acc, i) => {
      const d = acc[i.domain] || (acc[i.domain] = { domain: i.domain, label: i.domainLabel || i.domain, n: 0, mock: 0 });
      d.n++; if (i.is_mock) d.mock++;
      return acc;
    }, {})),
  })};</script>`,
});

// A small label above a page title, shared by the reports, team and other pages
const eyebrow = (text) => `<p class="ui-eyebrow"><i aria-hidden="true"></i>${esc(text)}</p>`;

// ============ DASHBOARDS ============
// One dashboards page: the title itself is the filter, pick a dashboard and it loads in place.
exports.dashboardsIndex = (ctx, { dashboards, counties = [], initial }) => {
  const cur = dashboards.find((d) => d.slug === initial) || dashboards[0];
  const meta = {};
  dashboards.forEach((d) => { meta[d.slug] = { label: d.label, description: d.description, narrative: d.narrative || '' }; });
  return shell(ctx, {
    title: 'Dashboards', active: '/dashboards', workspaceActive: 'dashboards', body: `
  ${pageHeader('dashboards', 'Dashboards', 'Curated single-page views combining hero stats, trends and county rankings.')}
  <div class="wrap section">
    <div class="dash-title-row">
      <label class="dash-title-select">
        <select id="dash-topic-select" aria-label="Choose a dashboard">
          ${dashboards.map((d) => `<option value="${esc(d.slug)}" ${d.slug === cur.slug ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}
        </select>
        ${icon('chevron')}
      </label>
      <span class="scope-chip" id="dash-scope-label">National</span>
    </div>
    <p class="lede-sm" id="dash-description">${esc(cur.description)}</p>

    <div class="dash-hero-dh">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
        <div class="sync"><span class="pulse"></span><span class="mono" id="dash-sync-text" style="color:#B9C7D3;font-size:.8rem">connecting…</span></div>
        <select id="dash-county-filter" style="width:auto;background:var(--navy-600);color:#fff;border-color:rgba(255,255,255,.2)">
          <option value="">National (all counties)</option>
          ${counties.map((c) => `<option>${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="dash-hero-stats" id="dash-hero-stats"><div class="cell"><div class="val">…</div><div class="lbl">Loading</div></div></div>
    </div>

    <div class="narrative-block"><p class="muted" id="dash-narrative">${esc(cur.narrative || '')}</p></div>

    <div class="map-panel dash-map">
      <div class="map-panel-head">
        <div><p class="kicker" id="dash-map-tag">County map</p><h3 id="dash-map-title" style="margin:0">Connectivity</h3></div>
        <div class="map-head-right">
          <span class="mono muted" style="font-size:.8rem">Year <strong id="dash-map-year" style="color:var(--navy)">2025</strong></span>
          <div class="map-legend"><span>Lower</span><span class="map-legend-bar"></span><span>Higher</span></div>
        </div>
      </div>
      <p class="muted" id="dash-map-desc" style="font-size:.86rem"></p>
      <div class="map-size-row">
        <label for="map-zoom">Map size</label>
        <input type="range" id="map-zoom" min="40" max="100" value="100" step="5">
        <span class="mono muted" id="map-zoom-val">100%</span>
      </div>
      <div id="choropleth"></div>
    </div>

    <div class="chart-panel" style="margin-top:1.1rem">
      <h3 id="dash-trend-title">Trend</h3>
      <div id="dash-trend" class="chart-dh"></div>
    </div>

    <div class="two-col" style="margin-top:1.1rem">
      <div class="panel"><h3>Top 5 counties</h3><div id="dash-ranking-top" class="chart-dh"></div></div>
      <div class="panel"><h3>Bottom 5 counties</h3><div id="dash-ranking-bottom" class="chart-dh"></div></div>
    </div>

    <div class="viz-grid">
      <div class="chart-card">
        <div class="chart-panel-head"><h3>Distribution by county <span class="mono" id="dash-dist-year" style="font-size:.8rem"></span></h3></div>
        <div id="dash-distribution" class="chart-dh"></div>
      </div>
      <div class="chart-card">
        <div class="chart-panel-head"><h3>Change vs previous year</h3></div>
        <div id="dash-change" class="chart-dh"></div>
      </div>
    </div>

    <div class="chart-card" style="margin-top:1.1rem">
      <div class="chart-panel-head"><h3>Year-on-year growth <span class="mono" id="dash-growth-scope" style="font-size:.8rem"></span></h3></div>
      <div id="dash-growth" class="chart-dh"></div>
    </div>

    <div class="chart-card" style="margin-top:1.1rem">
      <div class="chart-panel-head">
        <h3>Heat map, county × year</h3>
        <span class="mono" style="font-size:.78rem">Darker = higher</span>
      </div>
      <div id="dash-heat" class="viz-heat-wrap"></div>
    </div>

    <p style="margin-top:1.2rem"><a class="btn btn-gold" id="dash-download" href="/api/v1/download/data.csv">${icon('download')} Download full dataset</a></p>
  </div>
  <script>window.__NICTD_PAGE__='dashboard-topic';window.__DASHBOARD_STATE__=${JSON.stringify({ topic: cur.slug, meta })};</script>`,
  });
};

exports.dashboardTopic = (ctx, { slug, label, description, counties, narrative }) => shell(ctx, {
  title: label, active: '/dashboards', workspaceActive: 'dashboards', body: `
  <div class="wrap section">
    <p class="kicker"><a href="/dashboards">← Dashboards</a></p>
    <div class="dash-hero-dh">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
        <div><h1>${esc(label)} <span class="scope-chip" id="dash-scope-label" style="margin-left:.5rem">National</span></h1><p>${esc(description)}</p></div>
        <div style="text-align:right">
          <div class="sync" style="justify-content:flex-end"><span class="pulse"></span><span class="mono" id="dash-sync-text" style="color:#B9C7D3;font-size:.8rem">connecting…</span></div>
          <select id="dash-county-filter" style="margin-top:.5rem;width:auto;background:var(--navy-600);color:#fff;border-color:rgba(255,255,255,.2)">
            <option value="">National (all counties)</option>
            ${counties.map((c) => `<option>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="dash-hero-stats" id="dash-hero-stats"><div class="cell"><div class="val">…</div><div class="lbl">Loading</div></div></div>
    </div>

    <div class="narrative-block"><p class="muted">${esc(narrative)}</p></div>

    <div class="chart-panel">
      <h3 id="dash-trend-title">Trend</h3>
      <div id="dash-trend" class="chart-dh"></div>
    </div>

    <div class="two-col" style="margin-top:1.1rem">
      <div class="panel"><h3>Top 5 counties</h3><div id="dash-ranking-top" class="chart-dh"></div></div>
      <div class="panel"><h3>Bottom 5 counties</h3><div id="dash-ranking-bottom" class="chart-dh"></div></div>
    </div>

    <div class="viz-grid">
      <div class="chart-card">
        <div class="chart-panel-head"><h3>Distribution by county <span class="mono" id="dash-dist-year" style="font-size:.8rem"></span></h3></div>
        <div id="dash-distribution" class="chart-dh"></div>
      </div>
      <div class="chart-card">
        <div class="chart-panel-head"><h3>Change vs previous year</h3></div>
        <div id="dash-change" class="chart-dh"></div>
      </div>
    </div>

    <div class="chart-card" style="margin-top:1.1rem">
      <div class="chart-panel-head"><h3>Year-on-year growth <span class="mono" id="dash-growth-scope" style="font-size:.8rem"></span></h3></div>
      <div id="dash-growth" class="chart-dh"></div>
    </div>

    <div class="chart-card" style="margin-top:1.1rem">
      <div class="chart-panel-head">
        <h3>Heat map, county × year</h3>
        <span class="mono" style="font-size:.78rem">Darker = higher</span>
      </div>
      <div id="dash-heat" class="viz-heat-wrap"></div>
    </div>

    <p style="margin-top:1.2rem"><a class="btn btn-gold" id="dash-download" href="/api/v1/download/data.csv">${icon('download')} Download full dataset</a></p>
  </div>
  <script>window.__NICTD_PAGE__='dashboard-topic';window.__DASHBOARD_STATE__=${JSON.stringify({ topic: slug })};</script>`,
});

// ============ ABOUT ============
// Editorial studio treatment: oversized uppercase display type, parenthesised section
// markers, a white ground with one red accent, and scroll-driven reveals. All styling is
// scoped under .m in styles.css.

// The mark shown against each policy commitment. Liberia's own flag for the national
// instruments and the UN's published SDG mark for the goal; the African Union and ECOWAS
// emblems are not in the asset library, so those carry a typographic abbreviation rather
// than an approximation of an official emblem.
// Flags for the peer table. Drawn as plain geometry rather than pulled from an icon set,
// so they carry no dependency; each is the flag's actual construction and colours.
const FLAGS = {
  rw: '<rect width="30" height="20" fill="#00A1DE"/><rect y="10" width="30" height="4" fill="#FAD201"/><rect y="14" width="30" height="6" fill="#20603D"/><circle cx="22" cy="5" r="2.6" fill="#E5BE01"/>',
  ke: '<rect width="30" height="20" fill="#fff"/><rect width="30" height="6" fill="#000"/><rect y="7" width="30" height="6" fill="#BB0000"/><rect y="14" width="30" height="6" fill="#006600"/><ellipse cx="15" cy="10" rx="3" ry="6" fill="#BB0000" stroke="#fff" stroke-width="1"/>',
  ng: '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#008751"/><rect x="20" width="10" height="20" fill="#008751"/>',
  gh: '<rect width="30" height="20" fill="#FCD116"/><rect width="30" height="6.67" fill="#CE1126"/><rect y="13.33" width="30" height="6.67" fill="#006B3F"/><polygon points="15,7 16.2,10.4 19.8,10.4 16.9,12.5 18,16 15,13.8 12,16 13.1,12.5 10.2,10.4 13.8,10.4" fill="#000"/>',
  sn: '<rect width="30" height="20" fill="#FDEF42"/><rect width="10" height="20" fill="#00853F"/><rect x="20" width="10" height="20" fill="#E31B23"/><polygon points="15,7 16.2,10.4 19.8,10.4 16.9,12.5 18,16 15,13.8 12,16 13.1,12.5 10.2,10.4 13.8,10.4" fill="#00853F"/>',
};
function peerFlag(code) {
  if (code === 'lr') return liberiaFlag(30);
  const g = FLAGS[code];
  if (!g) return '';
  return `<svg class="m-peer-flag" viewBox="0 0 30 20" role="img" aria-hidden="true">${g}</svg>`;
}

function policyEmblem(kind) {
  if (kind === 'lr') return liberiaFlag(72);
  if (kind === 'sdg') {
    const u = imgs.url('partnerLogos', 'sdg');
    return u ? `<img src="${esc(u)}" alt="United Nations Sustainable Development Goals">` : '';
  }
  if (kind === 'au') return `<img src="/img/partnerLogos/au.png" alt="African Union">`;
  return `<span class="m-pol-mono">ECOWAS</span>`;
}

// ============ ABOUT (/about) ============
// Built on the Careers page's system (reference: Sharplink's about page, pinned by the user): the
// hero is a film of telecom towers and field work (public/media/about-hero*.mp4), and the chrome seal
// (careers.js) stands beside the commitments, as a wireframe in the black capacity band, and alone
// above the closing line. Every figure is live from the catalogue or the
// programme; every photo is one of the site's own.
exports.about = (ctx, { mission, indicatorCount = 0, domainCount = 0 } = {}) => {
  const DEFAULT_MISSION = "The National ICT Intelligence System (NIIS) is a private-sector-led national initiative advancing Liberia's data sovereignty, and the country's official, continuously maintained source of ICT statistics, infrastructure, usage, affordability, market structure, digital trust and governance, and sustainability, disaggregated across all 15 counties. NIIS exists to give researchers, policymakers, donors and the public a single, trustworthy place to find and compare Liberia's digital-development data.";
  const statement = String(mission || DEFAULT_MISSION).trim();

  // live from the catalogue where the database has it; programme figures from the programme
  const stats = [
    [15, 'Counties measured', 'Every indicator, nationwide'],
    [indicatorCount, 'Indicators in the catalogue', 'Published and documented'],
    [domainCount, 'Indicator domains', 'From connectivity to sustainability'],
    [174, 'Programme positions', 'Created for Liberian staff'],
  ].filter(([n]) => n > 0);

  const story = [
    ['The mission', statement],
    ['The problem', 'For two decades Liberia’s digital-development story has been told with numbers produced somewhere else: estimated rather than observed, national rather than local, and always a reporting cycle behind the decisions they are meant to inform.'],
    ['The answer', 'The law is already in place: a Data Protection Act in 2026, and data sovereignty among the eight priorities of the National Digital Strategy. What has not moved is the infrastructure. NIIS is that missing layer: the database, the collection pipeline and the platform that turn a commitment on paper into a working national asset.'],
  ];

  const agencies = [
    ['mopt', 'Ministry of Posts & Telecommunications', 'Policy lead'],
    ['lta', 'Liberia Telecommunications Authority', 'Sector regulator'],
    ['lisgis', 'LISGIS', 'National statistics'],
    ['moe', 'Ministry of Education', 'Education data'],
    ['epa', 'Environmental Protection Agency', 'E-waste & sustainability'],
    ['cbl', 'Central Bank of Liberia', 'Digital finance'],
  ];

  const alignment = [
    ['ARREST Agenda for Inclusive Development', '2025-2029',
      'ICT modernization sits in the Infrastructure pillar. NIIS is the measurement layer it is judged against.', 'lr'],
    ['National Digital Strategy', '2025-2029',
      'Cybersecurity and data sovereignty is one of its eight priorities. This is that pillar, made operational.', 'lr'],
    ['Data Protection Act', 'Enacted 2026',
      'Built to Liberia’s first personal-data law: aggregate, anonymized statistics only.', 'lr'],
    ['AU Data Policy Framework', 'Adopted 2022',
      'Continental policy since 2022: member states are expected to hold and govern their own data.', 'au'],
    ['SDG Target 17.18', 'Global goal',
      'Data “disaggregated by … geographic location.” County-level is the target, verbatim.', 'sdg'],
    ['Regional Digital Integration', 'ECOWAS · WARDIP',
      'You cannot negotiate on indicators you cannot produce, or benchmark against neighbours without them.', 'ecowas'],
  ];

  const bench = [
    ['Rwanda', 'Data-residency rules enforced; hosts the UN Big Data hub in Kigali; national AI agency.', 'Ahead', 'rw'],
    ['Kenya', 'Government data held in-territory by policy; sovereign-hosted cloud launched 2026.', 'Ahead', 'ke'],
    ['Nigeria', 'Domestic storage of all payment data mandated from January 2027.', 'Ahead', 'ng'],
    ['Ghana', 'Malabo Convention ratified; national data portal published and maintained.', 'Ahead', 'gh'],
    ['Senegal, Côte d’Ivoire, Togo', 'Malabo ratified; national data-centre programmes in delivery.', 'Ahead', 'sn'],
    ['Liberia', 'Law and strategy in place. No national ICT statistics platform in operation.', 'The gap', 'lr'],
  ];

  const faqs = [
    ['How is NIIS data licensed?', 'All open data published through NIIS is available under an open licence for research, journalism and policy use, with attribution to the ICT Statistics & Policy Unit, Ministry of Posts and Telecommunications. Open by default is a design principle, not a concession.'],
    ['How often is the data updated?', 'Most indicators refresh annually following the national survey wave; a subset fed by operator data-sharing agreements refreshes biennially. Each indicator’s periodicity is shown in the Indicator Catalogue.'],
    ['How is this different from the data international agencies already publish on Liberia?', 'International datasets are indispensable and we use them. But where national returns are incomplete they are modelled or trend-projected, and they report Liberia as one national figure. NIIS collects observed values, disaggregates them to all 15 counties, and publishes the method alongside the number.'],
    ['Is NIIS a government body or a private initiative?', 'NIIS is a private-sector-led initiative delivering a national public good, working with the Ministry of Posts and Telecommunications and contributing agencies under data-sharing cooperation. The platform is built to be handed to, and sustained by, Liberian institutions.'],
    ['What happens when donor funding ends?', 'The programme is designed for transition, not dependency: infrastructure hosted in-country, methodology documented and published, staff recruited and trained locally, and a services and licensing model intended to carry recurring costs after the establishment phase.'],
    ['How do you protect personal data?', 'NIIS publishes aggregate, anonymized statistics only. It collects no individual-level personal data beyond what is required to produce those aggregates, in line with Liberia’s Data Protection Act.'],
    ['How do I request a new indicator?', 'Registered users can reach the ICT Statistics & Policy Unit directly through the platform’s messaging system once logged in.'],
    ['Can I use this data in a publication?', 'Yes, cite NIIS and the ICT Statistics & Policy Unit. Values are demonstration data pending production feeds; check the methodology note on each indicator before publication.'],
  ];

  const sdg = imgs.url('partnerLogos', 'sdg');
  const rise = (i = 0) => ` data-rise style="--i:${i}"`;
  // the reference's quote marks, drawn as dashed outlines
  const qmark = `<svg class="ab-qmark" viewBox="0 0 120 84" aria-hidden="true"><path d="M4 4h44v40L30 80H12l10-36H4z"/><path d="M68 4h44v40L94 80H76l10-36H68z"/></svg>`;

  return shell(ctx, {
    title: 'About', active: '/about', workspaceActive: 'about', extraHead: CAREERS_HEAD, body: `
  <div class="cs ab" id="abPage">
    <canvas class="cs-star" id="csStar" aria-hidden="true" data-seal="${esc(sealArt())}"></canvas>
    <section class="cs-hero cs-hero--film ab-hero" data-star="film" aria-labelledby="abTitle">
      <video class="cs-film" autoplay muted loop playsinline preload="auto" poster="/media/about-hero-poster.jpg" aria-hidden="true">
        <source src="/media/about-hero-720.mp4" type="video/mp4" media="(max-width: 760px)">
        <source src="/media/about-hero.mp4" type="video/mp4">
      </video>
      <div class="cs-film-scrim" aria-hidden="true"></div>
      <div class="cs-wrap cs-hero-in">
        <h1 id="abTitle" class="cs-h1" aria-label="Liberia’s ICT data, collected and managed by Liberians.">${csDecode('Liberia’s ICT data,')}${csDecode('collected and managed by Liberians.', 'cs-dim')}</h1>
        <div class="cs-ctas">
          ${csBtn('/data', 'Explore the data')}
          <a class="cs-btn cs-btn-dark" href="/research"><span>Read the research</span></a>
        </div>
        <p class="cs-hero-sub">The official, continuously maintained source of Liberia’s ICT statistics, disaggregated across all 15 counties.</p>
      </div>
    </section>

    <section class="cs-mission ab-story" data-star="mission" aria-labelledby="abStoryTitle">
      <div class="cs-wrap">
        <span class="cs-mark" aria-hidden="true"></span>
        <h2 id="abStoryTitle" class="cs-h2" aria-label="Data sovereignty, made operational.">${csDecode('Data sovereignty, made operational.')}</h2>
        ${stats.length ? `<div class="ab-stats" role="list" aria-label="NIIS in numbers">${stats.map(([n, l, s], i) => `
          <div class="ab-stat" role="listitem"${rise(i)}>
            <p class="ab-stat-n" data-count="${n}">${n}</p>
            <p class="ab-stat-l">${esc(l)}</p>
            <p class="ab-stat-s">${esc(s)}</p>
          </div>`).join('')}
        </div>` : ''}
        <dl class="cs-rows">${story.map(([tag, text]) => `
          <div class="cs-row"><dt><span class="cs-tag">${esc(tag)}</span></dt><dd data-fill>${esc(text)}</dd></div>`).join('')}
        </dl>
      </div>
    </section>

    <section class="ab-quote" data-star="quiet" aria-label="The global target">
      <div class="cs-wrap ab-quote-in">
        ${qmark}
        <figure class="ab-quote-fig">
          <blockquote><p>…increase significantly the availability of high-quality, timely and reliable data disaggregated by income, gender, age, race, ethnicity, migratory status, disability, geographic location and other characteristics relevant in national contexts.</p></blockquote>
          <figcaption><b>United Nations Sustainable Development Goals</b><span>Target 17.18</span></figcaption>
        </figure>
        ${sdg ? `<div class="ab-frame ab-frame--white ab-quote-frame"><img src="${esc(sdg)}" alt="Sustainable Development Goal 17: Partnerships for the goals" loading="lazy" decoding="async"></div>` : ''}
      </div>
    </section>

    <section class="ab-team" data-star="quiet">
      <div class="cs-wrap">
        <span class="cs-mark" aria-hidden="true"></span>
        <h2 class="ab-lead" aria-label="Providing Liberia ICT data in real time. We collect, validate and publish Liberia’s ICT statistics for all 15 counties, and we build the infrastructure that keeps them at home.">${csDecode('Providing Liberia ICT data in real time.')}${csDecode('We collect, validate and publish Liberia’s ICT statistics for all 15 counties, and we build the infrastructure that keeps them at home.', 'cs-dim')}</h2>
      </div>
    </section>

    <section class="cs-dark ab-dark" data-star="dark" aria-labelledby="abCapTitle">
      <div class="cs-wrap cs-dark-in">
        <span class="cs-frame" aria-hidden="true"></span>
        <h2 id="abCapTitle" class="cs-h2 cs-h2-lg" aria-label="A dataset is also a workforce. 174 positions across eight role types.">${csDecode('A dataset is also a workforce.')}${csDecode('174 positions across eight role types.', 'cs-dim')}</h2>
        <p class="ab-dark-p">Enumerators and supervisors in every county, research leads, data engineers, GIS and sampling specialists, quality analysts and developers, recruited from Liberian STEM graduates and researchers. Hosted in-country, methodology published, staff trained locally: the measure of this programme is whether Liberia can run it without us.</p>
        <div class="cs-ctas">${csBtn('/careers', 'See open roles')}</div>
      </div>
    </section>

    <section class="ab-partners" data-star="quiet" aria-labelledby="abPartTitle">
      <div class="cs-wrap ab-grid">
        <header class="ab-grid-head">
          <h2 id="abPartTitle">Partner institutions</h2>
          <p class="cs-count">${agencies.length}</p>
          <p class="ab-grid-note">These institutions contribute data, validation or domain review. Partnership is confirmed institution by institution.</p>
          ${csBtn('/partners', 'All partners', 'cs-btn-sm cs-btn-dark ab-grid-btn')}
        </header>
        <ul class="ab-cards">${agencies.map(([slug, name, role], i) => {
          const src = imgs.url('partnerLogos', slug);
          return `
          <li class="ab-card"${rise(i % 3)}>
            <div class="ab-frame ab-frame--white">${src ? `<img src="${esc(src)}" alt="${esc(name)} logo" loading="lazy" decoding="async">` : ''}</div>
            <h3>${esc(name)}</h3>
            <p class="ab-card-l">${esc(role)}</p>
          </li>`;
        }).join('')}
        </ul>
      </div>
    </section>

    <section class="ab-commit" data-star="commit" aria-labelledby="abPolTitle">
      <div class="cs-wrap">
        <div class="ab-commit-in">
          <span class="cs-mark" aria-hidden="true"></span>
          <h2 id="abPolTitle" class="cs-h2" aria-label="Commitments already made.">${csDecode('Commitments already made.')}</h2>
          <p class="ab-sub">Not a new agenda. This is the measurement capability six existing commitments already assume Liberia has.</p>
          <ol class="ab-pols">${alignment.map(([t, y, b, kind], i) => `
            <li class="ab-pol"${rise(i % 2)}>
              <span class="ab-pol-mark" aria-hidden="true">${policyEmblem(kind)}</span>
              <div>
                <p class="ab-pol-y">${esc(y)}</p>
                <h3>${esc(t)}</h3>
                <p class="ab-pol-b">${esc(b)}</p>
              </div>
            </li>`).join('')}
          </ol>
        </div>
      </div>
    </section>

    <section class="ab-bench" data-star="quiet" aria-labelledby="abBenchTitle">
      <div class="cs-wrap">
        <span class="cs-mark" aria-hidden="true"></span>
        <h2 id="abBenchTitle" class="cs-h2" aria-label="Where Liberia stands in the region.">${csDecode('Where Liberia stands in the region.')}</h2>
        <p class="ab-sub">Peers have moved their data infrastructure home. Liberia has the law and the strategy, and not yet the platform.</p>
        <div class="ab-brows" role="table" aria-label="Regional data-governance benchmark">${bench.map(([c, w, st, code], i) => `
          <div class="ab-brow${st === 'The gap' ? ' is-gap' : ''}" role="row"${rise(i)}>
            <span class="ab-bc" role="cell"><i class="ab-flag">${peerFlag(code)}</i>${esc(c)}</span>
            <span class="ab-bw" role="cell">${esc(w)}</span>
            <span class="ab-bs" role="cell">${esc(st)}</span>
          </div>`).join('')}
        </div>
        <p class="ab-note">Based on publicly documented data-governance infrastructure. Sources in the policy annex, on request.</p>
      </div>
    </section>

    <section class="cs-faq ab-faq" data-star="quiet" aria-labelledby="abFaqTitle">
      <div class="cs-wrap cs-faq-in">
        <div class="cs-faq-head">
          <span class="cs-mark" aria-hidden="true"></span>
          <h2 id="abFaqTitle" class="cs-h2 cs-h2-xl">FAQ</h2>
          <p class="cs-faq-more"><span>Got more questions?</span> ${csBtn('/register', 'Request an account', 'cs-btn-light')}</p>
        </div>
        <div class="cs-faq-list">${faqs.map(([q, a], i) => `<details class="cs-q"><summary><span class="cs-q-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="cs-q-t">${esc(q)}</span><span class="cs-q-x" aria-hidden="true"></span></summary><div class="cs-q-a"><p>${esc(a)}</p></div></details>`).join('')}</div>
      </div>
    </section>

    <div class="ab-emblem" data-star="emblem" aria-hidden="true"></div>

    <section class="ab-close" data-star="outro" aria-labelledby="abCloseTitle">
      <div class="cs-wrap ab-close-in">
        <h2 id="abCloseTitle" class="cs-h2 cs-h2-lg" aria-label="Liberia’s ICT statistics, research and reports, all in one place.">${csDecode('Liberia’s ICT statistics, research and reports,')}${csDecode('all in one place.', 'cs-dim')}</h2>
        <div class="cs-ctas">
          ${csBtn('/data', 'Explore the data')}
          <a class="cs-btn cs-btn-dark" href="/research"><span>Read the research</span></a>
        </div>
      </div>
    </section>

    <section class="cs-outro ab-outro" data-star="outro" aria-hidden="true"><div class="cs-word">NIIS</div></section>
  </div>`,
  });
};

// ============ SUBMIT A PAPER (public) ============
// Open submission form: submitter bio data + contact email, then the paper itself.
// Everything lands in the papers table with status 'submitted' for admin review.
exports.submitPaper = (ctx, { errors = [], values = {}, done = false } = {}) => {
  const v = (k) => esc(values[k] || '');
  const bad = (k) => (errors.some((e) => e.field === k) ? ' has-error' : '');
  const COUNTRIES = ['Liberia', 'Sierra Leone', 'Guinea', "Côte d'Ivoire", 'Ghana', 'Nigeria', 'Senegal', 'Other'];
  const ROLES = ['Researcher / Academic', 'Student', 'Government / Public sector', 'Regulator', 'Development partner / NGO',
    'Private sector', 'Journalist', 'Independent consultant', 'Other'];
  const TAGS = ['Report', 'Working Paper', 'Policy Brief', 'Dataset Note', 'Article'];

  if (done) {
    return shell(ctx, {
      title: 'Submission received', active: '/research', workspaceActive: 'research', body: `
    ${pageHeader('research', 'Submission received', 'Thank you, your paper is now with the ICT Statistics & Policy Unit.')}
    <div class="wrap section narrow">
      <div class="panel sp-done">
        <h2>${icon('shield')} Your paper has been submitted for review</h2>
        <p>The ICT Statistics &amp; Policy Unit reviews every submission before publication. We will contact you at the
           email address you provided with the outcome. Review normally takes ten working days.</p>
        <p class="muted">Nothing is published until a reviewer approves it, and your contact details are never published
           alongside the paper, they are used only to reach you about this submission.</p>
        <p style="margin-top:1.2rem">
          <a class="btn btn-teal" href="/research">${icon('doc')} Browse published research</a>
          <a class="btn btn-outline" href="/research/submit" style="margin-left:.5rem">${icon('plus')} Submit another paper</a>
        </p>
      </div>
    </div>`,
    });
  }

  // one field: label above, the control, a help line, and an error line that shows when it is wrong
  const field = (id, label, control, { req = false, help = '', err = '', wide = false, count = 0, name = '' } = {}) => {
    const has = name && errors.find((e) => e.field === name);
    return `<div class="sp2-field${wide ? ' is-wide' : ''}${has ? ' is-invalid is-touched' : ''}" data-field${req ? ' data-req' : ''}>
          <label for="${id}">${label}${req ? ' <span class="sp2-req" aria-hidden="true">*</span><span class="sr-only">(required)</span>' : ''}</label>
          <div class="sp2-control">${control}<span class="sp2-ok" aria-hidden="true">${icon('check')}</span></div>
          <div class="sp2-under">
            ${help ? `<p class="sp2-help" id="${id}-help">${help}</p>` : '<span></span>'}
            ${count ? `<span class="sp2-count" data-count="${id}" aria-live="off">0 / ${count.toLocaleString('en')}</span>` : ''}
          </div>
          ${err ? `<p class="sp2-err" id="${id}-err">${has ? esc(has.message) : err}</p>` : ''}
        </div>`;
  };
  const ctl = (id, attrs, extra = '') => `<input id="${id}" ${attrs} aria-describedby="${id}-help ${id}-err"${extra}>`;
  const tag0 = TAGS.includes(values.tag) ? values.tag : TAGS[0];

  return shell(ctx, {
    title: 'Submit a Paper', active: '/research', workspaceActive: 'research', body: `
  <div class="sp2-wrap sp-page">
  <section class="lg sp-lg">
    <div class="lg-brand sp-brand">
      <div class="lg-cells" aria-hidden="true">${'<i></i>'.repeat(96)}</div>
      <div class="lg-brand-in sp-brand-in">
        <a class="lg-seal" href="/">
          ${imgs.exists('brand', 'seal') ? `<img src="${esc(imgs.url('brand', 'seal'))}" alt="" width="54" height="58" decoding="async">` : sealLogo(54)}
          <span><strong>NIIS</strong><span>National ICT Intelligence System</span></span>
        </a>
        <h2>Send your research to the NIIS library</h2>
      </div>
    </div>
    <div class="lg-side sp-side">
      <div class="lg-card sp-card">
        <h1>Submit a Paper</h1>
        <p class="lg-sub">Anyone can submit, no account needed. A reviewer reads every paper before it goes into the NIIS research library.</p>

        ${errors.length ? `<div class="sp2-alert" role="alert"><b>A few things need fixing before this can be sent.</b>
          <ul>${errors.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul></div>` : ''}

        <form method="post" action="/research/submit" class="sp2" id="sp2" novalidate>
          <div class="sp2-sheet">
            <section class="sp2-sec" data-sec="all" aria-label="Your paper">
              <div class="sp2-grid">
                ${field('sp-name', 'Full name', ctl('sp-name', `name="sub_name" required maxlength="120" autocomplete="name" value="${v('sub_name')}"`), { req: true, err: 'Enter your full name.', name: 'sub_name' })}
                ${field('sp-email', 'Email address', ctl('sp-email', `type="email" name="sub_email" required maxlength="180" autocomplete="email" inputmode="email" value="${v('sub_email')}"`), { req: true, help: 'Where the review outcome is sent.', err: 'Enter an email address like name@domain.org.', name: 'sub_email' })}
                ${field('sp-org', 'Institution', ctl('sp-org', `name="sub_org" maxlength="160" autocomplete="organization" value="${v('sub_org')}"`), { help: 'Optional.' })}
                ${field('sp-abstract', 'Paper summary', `<textarea id="sp-abstract" name="abstract" rows="4" required maxlength="1200" data-grow aria-describedby="sp-abstract-help sp-abstract-err">${v('abstract')}</textarea>`, { req: true, wide: true, count: 1200, help: 'A short summary of what the paper covers.', err: 'Add a short summary.', name: 'abstract' })}
                ${field('sp-body', 'Your paper', `<textarea id="sp-body" name="body" rows="8" required maxlength="20000" data-grow aria-describedby="sp-body-help sp-body-err">${v('body')}</textarea>`, { req: true, wide: true, count: 20000, help: 'Paste the full paper here. Its first line is taken as the title.', err: 'Paste your paper.', name: 'body' })}
              </div>
            </section>
            <div class="sp2-actions">
              <button class="sp2-send pearl" type="submit"><span class="pearl-wrap"><span class="pearl-p"><span class="sp2-send-t">Submit</span><span class="sp2-spin" aria-hidden="true"></span></span></span></button>
              <p class="sp2-fine">By submitting, you confirm the paper is your own work or that you may share it. Your contact details are used only for this review, in line with Liberia’s Data Protection Act.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  </section>
  </div>
  <script>${submitPaperScript}</script>`,
  });
};

// The submit form, alive: each field says when it is complete (a check) or wrong (a line under it,
// shown once the reader has left the field), counters count, text boxes grow, the step rail and the
// phone's bottom bar fill as the required fields are done, sections rise in as they arrive, and a
// send shows that it is sending. With reduced motion nothing moves; it all still works.
const submitPaperScript = `
(function(){
  var f=document.getElementById('sp2'); if(!f) return;
  f.classList.add('is-live');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EMAIL=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
  var fields=[].slice.call(f.querySelectorAll('[data-field]'));
  function ctrl(fd){ return fd.querySelector('input:not([type=radio]),textarea,select'); }
  function ok(fd){
    var c=ctrl(fd); if(!c) return true;
    if(c.type==='checkbox') return c.checked;
    var val=c.value.trim();
    if(c.type==='email') return fd.hasAttribute('data-req') ? EMAIL.test(val) : (!val || EMAIL.test(val));
    return fd.hasAttribute('data-req') ? val.length>0 : true;
  }
  function paint(fd){
    var c=ctrl(fd); if(!c) return;
    var good=ok(fd), filled=c.type==='checkbox'?c.checked:c.value.trim().length>0;
    fd.classList.toggle('is-valid', good && filled);
    fd.classList.toggle('is-invalid', !good && fd.classList.contains('is-touched'));
    c.setAttribute('aria-invalid', String(!good && fd.classList.contains('is-touched')));
  }
  var req=fields.filter(function(fd){ return fd.hasAttribute('data-req'); });
  function progress(){
    var done=req.filter(ok).length, left=req.length-done;
    f.closest('.sp2-wrap').style.setProperty('--sp2-p', String(done/req.length));
    [].forEach.call(document.querySelectorAll('[data-left]'), function(el){ el.textContent = left ? (left+' required field'+(left>1?'s':'')+' to go') : 'Ready to send'; });
  }
  function count(c){
    var el=f.querySelector('[data-count="'+c.id+'"]'); if(!el) return;
    var n=c.value.length, max=+c.getAttribute('maxlength');
    el.textContent=n.toLocaleString('en')+' / '+max.toLocaleString('en');
    el.classList.toggle('is-near', n>max*0.9);
  }
  function grow(c){ if(!c.hasAttribute('data-grow')) return; c.style.height='auto'; c.style.height=Math.min(c.scrollHeight+2, 560)+'px'; }
  fields.forEach(function(fd){
    var c=ctrl(fd); if(!c) return;
    c.addEventListener('input',function(){ paint(fd); progress(); count(c); grow(c); });
    c.addEventListener('change',function(){ fd.classList.add('is-touched'); paint(fd); progress(); });
    c.addEventListener('blur',function(){ if(c.value || c.type==='checkbox' || fd.classList.contains('is-touched')) fd.classList.add('is-touched'); paint(fd); });
    paint(fd); count(c); grow(c);
  });
  progress();
  // the step you are on is the one in view
  if('IntersectionObserver' in window){
    var steps={};
    [].forEach.call(document.querySelectorAll('[data-step]'),function(li){ steps[li.getAttribute('data-step')]=li; });
    var io=new IntersectionObserver(function(es){ es.forEach(function(e){
      var k=e.target.getAttribute('data-sec');
      if(e.isIntersecting){ e.target.classList.add('is-in'); Object.keys(steps).forEach(function(s){ steps[s].classList.toggle('is-here', s===k); }); }
    }); },{ rootMargin:'-35% 0px -45% 0px' });
    [].forEach.call(f.querySelectorAll('[data-sec]'),function(sec){ io.observe(sec); });
  }
  // the phone's bottom bar shows once the form is on screen
  var bar=document.querySelector('.sp2-bar');
  if(bar && 'IntersectionObserver' in window){
    new IntersectionObserver(function(es){ bar.classList.toggle('is-on', es[0].isIntersecting); },{ threshold:0 }).observe(f);
  }
  var sending=false;
  f.addEventListener('submit',function(e){
    if(sending){ e.preventDefault(); return; }
    var bad=req.filter(function(fd){ return !ok(fd); });
    if(bad.length){
      e.preventDefault();
      bad.forEach(function(fd){ fd.classList.add('is-touched'); paint(fd); });
      var first=ctrl(bad[0]); bad[0].scrollIntoView({ behavior: reduce?'auto':'smooth', block:'center' });
      setTimeout(function(){ first.focus({ preventScroll:true }); }, reduce?0:350);
      if(!reduce){ f.classList.remove('is-shaking'); void f.offsetWidth; f.classList.add('is-shaking'); }
      return;
    }
    sending=true;
    [].forEach.call(document.querySelectorAll('.sp2-send'),function(b){ b.classList.add('is-sending'); b.setAttribute('aria-busy','true'); });
    [].forEach.call(document.querySelectorAll('.sp2-send .sp2-send-t'),function(t){ t.textContent='Sending'; });
  });
})();
`;

// Scroll-scrubbed video hero. The clip autoplays on arrival; once the reader starts
// scrolling, their scroll position drives the playhead instead, so scrolling down runs the
// footage forward and scrolling back runs it in reverse. The section is tall and the frame
// inside it is sticky, which is what gives the scroll something to scrub against.
function videoHero({ src, poster, kicker = '', title, sub = '' }) {
  return `<section class="vhero" id="vhero">
    <div class="vhero-sticky">
      <video class="vhero-video" id="vheroVideo"
             src="${esc(src)}" poster="${esc(poster)}"
             muted playsinline preload="auto" aria-hidden="true"></video>
      <div class="vhero-scrim"></div>
      <div class="vhero-inner wrap">
        ${kicker ? `<p class="vhero-kicker">${esc(kicker)}</p>` : ''}
        <h1 class="vhero-title">${esc(title)}</h1>
        ${sub ? `<p class="vhero-sub">${esc(sub)}</p>` : ''}
      </div>
      <div class="vhero-progress"><i id="vheroBar"></i></div>
    </div>
  </section>`;
}

const videoHeroScript = `
(function(){
  var sec=document.getElementById('vhero');
  var vid=document.getElementById('vheroVideo');
  var bar=document.getElementById('vheroBar');
  if(!sec||!vid) return;
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // phones show the hero as a short box with no scroll distance to scrub: the clip just loops
  if(window.matchMedia&&window.matchMedia('(max-width: 760px)').matches){
    if(!reduced){ vid.loop=true; var pp=vid.play(); if(pp&&pp.catch) pp.catch(function(){}); }
    return;
  }

  // Autoplay on arrival. Muted playback is allowed without a gesture; if a browser still
  // refuses, the poster frame stands in and scrubbing takes over on the first scroll.
  var autoplaying=false;
  if(!reduced){
    var p=vid.play();
    if(p&&p.catch) p.catch(function(){ autoplaying=false; });
    autoplaying=true;
  }

  var target=0, current=0, raf=null, duration=0;
  var lastFrame=0, fallbackT=null;
  function dur(){
    if(duration) return duration;
    if(vid.duration&&isFinite(vid.duration)) duration=vid.duration;
    return duration||0;
  }
  vid.addEventListener('loadedmetadata',function(){ duration=vid.duration; });

  function progress(){
    var r=sec.getBoundingClientRect();
    var travel=sec.offsetHeight-window.innerHeight;
    if(travel<=0) return 0;
    return Math.min(1,Math.max(0,-r.top/travel));
  }

  // Seeking past the buffered range makes the browser abandon the seek and snap back to the
  // start, which reads as the hero resetting itself mid scroll. Clamp to what has actually
  // loaded: on a slow link the scrub simply stops short and extends as more arrives.
  function loadedTo(){
    try{ if(vid.buffered.length) return vid.buffered.end(vid.buffered.length-1); }catch(e){}
    return 0;
  }
  function seek(pos){
    var d=dur();
    if(!d) return;
    var want=Math.min(d-0.05,Math.max(0,pos*d));
    var cap=loadedTo();
    if(cap>0.25) want=Math.min(want,cap-0.12);
    try{ vid.currentTime=Math.max(0,want); }catch(e){}
  }

  function tick(){
    lastFrame=Date.now();
    clearTimeout(fallbackT);
    var d=dur();
    if(!d){ raf=null; return; }
    // ease toward the target so a fast flick does not snap the playhead
    current+=(target-current)*0.12;
    if(Math.abs(target-current)<0.004) current=target;
    seek(current);
    if(bar) bar.style.transform='scaleX('+target+')';
    if(Math.abs(target-current)>0.001){ raf=requestAnimationFrame(tick); } else { raf=null; }
  }

  function onScroll(){
    var p=progress();
    // While the reader is still at the very top, let the clip autoplay. Control passes to the
    // scrub only once they have actually moved, otherwise the init call would pause it at once.
    if(autoplaying && p<=0.002){
      target=p;
      if(bar) bar.style.transform='scaleX('+p+')';
      return;
    }
    if(autoplaying){ vid.pause(); autoplaying=false; current=vid.currentTime/(dur()||1); }
    target=p;
    if(bar) bar.style.transform='scaleX('+target+')';
    if(!raf) raf=requestAnimationFrame(tick);
    // Some embedded contexts throttle requestAnimationFrame to nothing. If no frame has run
    // shortly after a scroll, drive the playhead directly so the scrub still tracks, losing
    // only the easing.
    clearTimeout(fallbackT);
    fallbackT=setTimeout(function(){
      // recency, not a latch: a frame that ran once at load must not disable the fallback
      // forever if the browser then stops delivering frames.
      if(Date.now()-lastFrame < 100) return;
      current=target;
      seek(current);
    }, 120);
  }

  if(reduced){
    // no scrubbing: hold a representative frame
    vid.addEventListener('loadedmetadata',function(){ try{ vid.currentTime=vid.duration*0.35; }catch(e){} });
  } else {
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll);
    onScroll();
  }
})();
`;

// Promo band under the research video hero. The circle alternates between two pictures
// every three seconds; the three chips name the three things the page is for.

function researchPromo() {
  const img1 = imgs.url('researchCircle', 'circle-1');
  const img2 = imgs.url('researchCircle', 'circle-2');
  const chip = (cls, ic, a, b) => `<span class="rp-chip ${cls}">
      ${icon(ic, 'icn rp-chip-ico')}
      <b>${esc(a)}<br>${esc(b)}</b>
    </span>`;
  return `<section class="rp">
    <div class="wrap rp-grid">
      <div class="rp-left">
        <h2 class="rp-title">
          Search Papers,<br>
          <em><span class="rp-mark">Submit Papers<svg class="rp-mark-ring" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
            <path d="M70 14C150 4 300 4 360 14c32 6 38 38 30 62-10 30-70 38-190 38C90 114 22 108 10 80 2 56 8 26 50 16c40-8 100-10 160-8"/>
            <path class="rp-mark-2" d="M64 20C150 10 300 10 356 20c30 6 36 34 28 56-10 26-68 32-184 32C92 108 28 102 18 78 10 56 16 30 54 22"/>
          </svg></span>,</em><br>
          Become Published,<br>
          all in one place.
        </h2>
        <p class="rp-sub">Discover relevant research, submit your own work and get it published.
          Faster, easier and more connected than ever before.</p>
        <div class="rp-cta">
          <a class="rp-btn rp-btn-primary" href="#paper-search">
            ${icon('search', 'icn rp-btn-ico')} Search Papers ${icon('arrow', 'icn rp-btn-go')}
          </a>
          <a class="rp-btn rp-btn-ghost" href="/research/submit">
            ${icon('cloudup', 'icn rp-btn-ico')} Submit Paper ${icon('arrow', 'icn rp-btn-go')}
          </a>
        </div>
      </div>

      <div class="rp-right">
        <div class="rp-circle" id="rpCircle">
          <svg class="rp-ring" viewBox="0 0 320 320" aria-hidden="true">
            <defs>
              <linearGradient id="rpg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0B2C63"/>
                <stop offset="100%" stop-color="#1C4C9E"/>
              </linearGradient>
            </defs>
            <circle class="rp-ring-track" cx="160" cy="160" r="150"/>
            <circle class="rp-ring-arc" cx="160" cy="160" r="150" stroke="url(#rpg)"/>
            <circle class="rp-ring-dot" cx="160" cy="10" r="5.5" fill="#0B2C63"/>
            <circle class="rp-ring-dot" cx="160" cy="310" r="5.5" fill="#1C4C9E"/>
          </svg>
          <div class="rp-photo">
            <img src="${esc(img1)}" alt="" class="is-on" data-rp-slide>
            <img src="${esc(img2)}" alt="" data-rp-slide>
          </div>
          ${chip('rp-chip-a', 'docsearch', 'Search', 'Papers')}
          ${chip('rp-chip-b', 'cloudup', 'Submit', 'Papers')}
          ${chip('rp-chip-c', 'seal', 'Get', 'Published')}
        </div>
      </div>
    </div>
  </section>`;
}

const researchPromoScript = `
(function(){
  var slides=[].slice.call(document.querySelectorAll('[data-rp-slide]'));
  if(slides.length<2) return;
  var i=0, timer=null;
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(n){
    slides.forEach(function(s,k){ s.classList.toggle('is-on', k===n); });
  }
  function start(){
    if(reduced||timer) return;
    timer=setInterval(function(){ i=(i+1)%slides.length; show(i); }, 3000);
  }
  function stop(){ if(timer){ clearInterval(timer); timer=null; } }
  // only run while the section is on screen
  var host=document.getElementById('rpCircle');
  if(host && 'IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      es.forEach(function(e){ e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.15 }).observe(host);
    setTimeout(start, 2500);   // fail-safe if the observer never reports
  } else { start(); }
  document.addEventListener('visibilitychange', function(){
    document.hidden ? stop() : start();
  });
})();
`;

// ============ PARTNER BOOK (hero on Our Partners) ============
// A book on a desk whose pages turn as the reader scrolls, one spread per group of partners.
// Built from the live partner list, so it never drifts from the cards below it. Only partners
// with a supplied logo appear here; the rest are on the cards.
function partnerBook(partners) {
  const withLogo = partners.filter((p) => imgs.url('partnerLogos', p.slug));
  const PER_SPREAD = 6;
  const spreads = [];
  for (let i = 0; i < withLogo.length; i += PER_SPREAD) spreads.push(withLogo.slice(i, i + PER_SPREAD));
  if (!spreads.length) return '';

  const plate = (p) => `<figure class="bk-plate">
      <div class="bk-plate-img"><img src="${esc(imgs.url('partnerLogos', p.slug))}" alt="${esc(p.name)}" loading="lazy"></div>
      <figcaption>${esc(p.name)}</figcaption>
    </figure>`;

  const leaf = (group, i) => {
    const half = Math.ceil(group.length / 2);
    return `<div class="bk-leaf" data-leaf="${i}">
      <div class="bk-page bk-page-l">
        <p class="bk-page-label">${esc(i === 0 ? 'Our partners' : 'Our partners, continued')}</p>
        <div class="bk-plates">${group.slice(0, half).map(plate).join('')}</div>
      </div>
      <div class="bk-page bk-page-r">
        <p class="bk-page-label" aria-hidden="true"></p>
        <div class="bk-plates">${group.slice(half).map(plate).join('')}</div>
        <p class="bk-page-no">${i + 1} of ${spreads.length}</p>
      </div>
    </div>`;
  };

  return `<section class="bk" id="bk" style="--bk-turns:${Math.max(1, spreads.length - 1)}">
    <div class="bk-sticky">
      <div class="bk-desk" style="background-image:url('/img/sponsors/desk.jpg')"></div>
      <div class="bk-scrim"></div>
      <div class="bk-stage">
        <div class="bk-book" id="bkBook">${spreads.map(leaf).join('')}</div>
      </div>
      <div class="bk-copy wrap">
        <p class="bk-kicker">Partnership</p>
        <h1 class="bk-title">Our Partners</h1>
        <p class="bk-sub">The institutions that build, supply and govern the National ICT Intelligence System.</p>
      </div>
      <div class="bk-hint" id="bkHint">Scroll to turn the page</div>
      <div class="bk-progress"><i id="bkBar"></i></div>
    </div>
  </section>`;
}

const partnerBookScript = `
(function(){
  var sec=document.getElementById('bk');
  var book=document.getElementById('bkBook');
  var bar=document.getElementById('bkBar');
  var hint=document.getElementById('bkHint');
  if(!sec||!book) return;
  var leaves=[].slice.call(book.querySelectorAll('.bk-leaf'));
  var turns=Math.max(1,leaves.length-1);

  // --nav-h is 3.75rem but the bar renders taller than that, and it grows again on narrow
  // screens. Measuring it keeps the sticky frame exactly one viewport tall, so the book
  // clears the nav at the top and the progress bar stays on screen at the bottom.
  var nav=document.querySelector('.gov-nav');
  function fitNav(){
    if(!nav) return;
    sec.style.setProperty('--bk-nav', Math.round(nav.getBoundingClientRect().height)+'px');
  }
  fitNav();
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function progress(){
    var travel=sec.offsetHeight-window.innerHeight;
    if(travel<=0) return 0;
    return Math.min(1,Math.max(0,-sec.getBoundingClientRect().top/travel));
  }

  function paint(p){
    // p across the whole section maps onto the page turns
    var pos=p*turns;
    leaves.forEach(function(leaf,i){
      // how far this leaf has turned, 0 flat, 1 fully over
      var t=Math.min(1,Math.max(0,pos-i));
      var last=i===leaves.length-1;
      var lift=(leaves.length-i)*2;
      leaf.style.zIndex=String(leaves.length-i);
      if(last){ leaf.style.transform='translateZ('+lift+'px) rotateY(0deg)'; return; }
      leaf.style.transform='translateZ('+lift+'px) rotateY('+(-180*t)+'deg)';
      leaf.style.opacity=t>0.98?'0':'1';
    });
    if(bar) bar.style.transform='scaleX('+p+')';
    if(hint) hint.style.opacity=p>0.06?'0':'1';
  }

  var target=0,current=0,raf=null,lastFrame=0,fallbackT=null;
  function tick(){
    lastFrame=Date.now(); clearTimeout(fallbackT);
    current+=(target-current)*0.14;
    if(Math.abs(target-current)<0.002) current=target;
    paint(current);
    if(Math.abs(target-current)>0.001){ raf=requestAnimationFrame(tick); } else { raf=null; }
  }
  function onScroll(){
    target=progress();
    if(reduced){ paint(target); return; }
    if(!raf) raf=requestAnimationFrame(tick);
    clearTimeout(fallbackT);
    // recency, not a latch, so a stalled frame clock cannot freeze the page turn
    fallbackT=setTimeout(function(){
      if(Date.now()-lastFrame < 100) return;
      current=target; paint(current);
    },120);
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  onScroll();
})();
`;

// ============ RESEARCH / UPDATES (retained; reachable from footer &amp; homepage) ============
// Public / all-account browse view + (for admins) a full management console.
// A paper's cover, set from its own title like a published report: a coloured board in the
// series colour for its category, the title in Besley, the authors and year at the foot, and
// a band of the flag's stripes down the spine.
const RP_SERIES = { 'Flagship Report': 'navy', 'Working Paper': 'blue', 'Brief': 'red', 'Policy Brief': 'red', 'Report': 'ink', 'Dataset Note': 'blue', 'Article': 'ink' };
function rpCover(p) {
  const year = String(p.published_on || '').slice(0, 4);
  return `<div class="rp-cover rp-cover--${RP_SERIES[p.tag] || 'navy'}" aria-hidden="true">
      <span class="rp-cover-spine"></span>
      <span class="rp-cover-top"><b>NIIS</b><span>${esc(p.tag)}</span></span>
      <span class="rp-cover-title">${esc(p.title)}</span>
      <span class="rp-cover-foot"><span>${esc(p.authors)}</span><span>${esc(year)}</span></span>
    </div>`;
}
exports.research = (ctx, { papers = [], canManage = false, canSubmit = false, notice = '' }) => {
  const paperYear = (p) => String(p.published_on || '').slice(0, 4);
  // The newest paper leads at full width; the rest sit on the shelf beneath it.
  const paperCard = (p, i) => `<article class="rp-item${i === 0 ? ' rp-item--lead' : ''}" data-lib-item style="--i:${i}"
    data-lib-year="${esc(paperYear(p))}"
    data-lib-search="${esc((p.title + ' ' + p.authors + ' ' + p.abstract + ' ' + p.tag).toLowerCase())}">
    <a class="rp-cover-link" href="/research/${p.id}" tabindex="-1" aria-hidden="true">${rpCover(p)}</a>
    <div class="rp-body">
      <p class="rp-meta"><span class="rp-tag">${esc(p.tag)}</span><time datetime="${esc(String(p.published_on || '').slice(0, 10))}">${esc(updDate(p.published_on))}</time></p>
      <h3 class="rp-title"><a href="/research/${p.id}">${esc(p.title)}</a></h3>
      <p class="rp-authors">${esc(p.authors)}</p>
      <p class="rp-abstract">${esc(p.abstract)}</p>
      <div class="rp-actions">
        <a class="rp-read" href="/research/${p.id}">Read the paper ${icon('arrow')}</a>
        ${p.downloadable ? `<a class="rp-dl" href="/papers/${p.id}/download">${icon('download')} Download</a>` : '<span class="rp-nodl">Read online only</span>'}
      </div>
    </div>
  </article>`;

  if (canManage) return shell(ctx, { title: 'Research Papers', workspaceActive: 'research', body: researchAdminBody(papers, notice) });

  return shell(ctx, {
    title: 'Research Papers', active: '/research', workspaceActive: 'research', body: `
  ${videoHero({ src: '/media/research-hero.mp4', poster: '/media/research-hero-poster.jpg',
    kicker: 'Research', title: 'Liberia ICT Research Hub',
    sub: 'Published research and reports drawing on the National ICT Intelligence System.' })}
  ${researchPromo()}
  <div class="wrap section page-black">
    ${notice ? `<div class="alert alert-ok">${esc(notice)}</div>` : ''}
    ${papers.length ? `<div class="rp-shelf" id="rpShelf">${papers.map(paperCard)[0]}
      <div class="rp-search-row" id="paper-search">${filterBar({ variant: 'pills', placeholder: 'Search papers by title, author or abstract', facetLabel: 'Year', facetAll: 'All years',
        options: [...new Set(papers.map(paperYear).filter(Boolean))].sort((a, b) => b.localeCompare(a)).map((y) => ({ value: String(y), label: String(y) })),
        total: papers.length, noun: 'papers' })}</div>
      ${papers.map(paperCard).slice(1).join('')}</div>
    <div class="rp-empty" data-lib-empty hidden>
      <p class="rp-empty-t">No papers match that search.</p>
      <p>Clear the search box or choose a different year to see the full library.</p>
    </div>` : '<div class="rp-empty"><p class="rp-empty-t">No research papers are published yet.</p><p>New papers appear here as soon as the Unit publishes them.</p></div>'}
    ${canSubmit ? `<div class="panel" style="margin-top:2rem">
      <h2>Submit your research</h2>
      <p class="muted">Submit a paper or report for the ICT Statistics &amp; Policy Unit to review. Approved submissions are published to this library.</p>
      <form method="post" action="/research/submit" class="grid-form">
        <label>Title *<input name="title" required maxlength="240"></label>
        <label>Author(s) *<input name="authors" required maxlength="200" placeholder="Your name / institution"></label>
        <label>Category<select name="tag"><option>Report</option><option>Working Paper</option><option>Policy Brief</option><option>Dataset Note</option><option>Article</option></select></label>
        <label style="grid-column:1/-1">Abstract *<textarea name="abstract" rows="3" required maxlength="1200"></textarea></label>
        <label style="grid-column:1/-1">Full text (optional)<textarea name="body" rows="5" maxlength="20000"></textarea></label>
        <button class="btn btn-teal">Submit for review</button>
      </form>
    </div>` : ''}
  </div>
  <script>${videoHeroScript}${researchPromoScript}${libraryFilterScript}${rpScript}</script>`,
  });
};

// The shelf is in place from the start: nothing waits to be scrolled to.
const rpScript = '';

function statusPill(p) {
  if (p.deleted) return '<span class="tag" style="background:#F0DADA;color:#8a1f2f">Deleted</span>';
  if (p.status === 'submitted') return '<span class="tag" style="background:#FBE7DD;color:#C2410C">Awaiting review</span>';
  if (p.status === 'rejected') return '<span class="tag" style="background:#EAE6E0;color:#5A6A85">Rejected</span>';
  if (!p.visible) return '<span class="tag" style="background:#EAE6E0;color:#5A6A85">Hidden</span>';
  return '<span class="tag" style="background:#E4ECF8;color:#14448A">Published · Live</span>';
}
function paperRow(p) {
  const acts = [];
  if (p.deleted) {
    acts.push(`<button formaction="/admin/papers/recover" class="btn btn-teal btn-sm">Recover</button>`);
  } else {
    if (p.status === 'submitted') {
      acts.push(`<button formaction="/admin/papers/review" name="action" value="approve" class="btn btn-teal btn-sm">Approve &amp; publish</button>`);
      acts.push(`<button formaction="/admin/papers/review" name="action" value="reject" class="btn btn-ghost btn-sm">Reject</button>`);
    } else if (p.status === 'published') {
      acts.push(`<button formaction="/admin/papers/visibility" name="action" value="${p.visible ? 'hide' : 'show'}" class="btn btn-ghost btn-sm">${p.visible ? 'Turn off display' : 'Turn on display'}</button>`);
      acts.push(`<button formaction="/admin/papers/visibility" name="action" value="${p.downloadable ? 'lock' : 'unlock'}" class="btn btn-ghost btn-sm">${p.downloadable ? 'Disable download' : 'Enable download'}</button>`);
    } else if (p.status === 'rejected') {
      acts.push(`<button formaction="/admin/papers/review" name="action" value="approve" class="btn btn-teal btn-sm">Approve &amp; publish</button>`);
    }
    acts.push(`<button formaction="/admin/papers/delete" class="btn btn-ghost btn-sm">Delete</button>`);
  }
  return `<tr>
    <td><a href="/research/${p.id}">${esc(p.title)}</a><br><span class="mono muted" style="font-size:.72rem">${esc(p.authors)}${p.submitter_name ? ' · submitted by ' + esc(p.submitter_name) : ''} · ${esc(p.published_on)}</span>
      ${p.submitter_email ? `<br><span class="mono muted" style="font-size:.72rem">${icon('mail')} <a href="mailto:${esc(p.submitter_email)}">${esc(p.submitter_email)}</a>${p.submitter_org ? ' · ' + esc(p.submitter_org) : ''}${p.submitter_role ? ' · ' + esc(p.submitter_role) : ''}${p.submitter_country ? ' · ' + esc(p.submitter_country) : ''}</span>` : ''}
      ${p.submitter_bio ? `<br><span class="muted" style="font-size:.74rem;display:block;max-width:52ch;margin-top:.2rem">${esc(p.submitter_bio)}</span>` : ''}</td>
    <td><span class="tag">${esc(p.tag)}</span></td>
    <td>${statusPill(p)}${!p.deleted && p.status === 'published' && p.visible ? (p.downloadable ? ' <span class="mono muted" style="font-size:.68rem">DL on</span>' : ' <span class="mono muted" style="font-size:.68rem">DL off</span>') : ''}</td>
    <td><form method="post" class="inline-form" style="display:flex;gap:.35rem;flex-wrap:wrap"><input type="hidden" name="id" value="${p.id}">${acts.join('')}</form></td>
  </tr>`;
}
function researchAdminBody(papers, notice) {
  const submitted = papers.filter((p) => !p.deleted && p.status === 'submitted');
  const live = papers.filter((p) => !p.deleted && p.status === 'published' && p.visible);
  const hidden = papers.filter((p) => !p.deleted && p.status === 'published' && !p.visible);
  const rejected = papers.filter((p) => !p.deleted && p.status === 'rejected');
  const trash = papers.filter((p) => p.deleted);
  const section = (title, list, note) => list.length ? `<h2 style="margin-top:1.6rem">${title} <span class="muted" style="font-size:.7em;font-weight:400">${list.length}</span></h2>
    ${note ? `<p class="muted" style="margin-top:-.3rem">${note}</p>` : ''}
    <table class="data-table"><thead><tr><th>Paper</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${list.map(paperRow).join('')}</tbody></table>` : '';
  return `
  <div class="wrap section">
    <p class="kicker">Research management</p>
    <h1>Research papers</h1>
    <p class="lede-sm">Upload papers, review submissions from users, control what is displayed and downloadable, and manage deletions, all in one place.</p>
    ${notice ? `<div class="alert alert-ok">${esc(notice)}</div>` : ''}

    <div class="panel">
      <h2>Upload a paper</h2>
      <form method="post" action="/admin/papers/create" class="grid-form">
        <label>Title *<input name="title" required maxlength="240"></label>
        <label>Author(s)<input name="authors" maxlength="200" placeholder="ICT Statistics &amp; Policy Unit"></label>
        <label>Category<select name="tag"><option>Report</option><option>Working Paper</option><option>Policy Brief</option><option>Dataset Note</option><option>Article</option></select></label>
        <label>Downloadable<select name="downloadable"><option value="1">Yes, users can download</option><option value="0">No, read only</option></select></label>
        <label style="grid-column:1/-1">Abstract *<textarea name="abstract" rows="3" required maxlength="1200"></textarea></label>
        <label style="grid-column:1/-1">Full text (optional)<textarea name="body" rows="5" maxlength="20000"></textarea></label>
        <button class="btn btn-teal">Publish paper</button>
      </form>
    </div>

    ${submitted.length ? `<div class="alert" style="background:#FBE7DD;color:#7a2e0c;border:1px solid #f0c9b4">${submitted.length} submission(s) awaiting your review.</div>` : ''}
    ${section('Awaiting review', submitted, 'Papers submitted by users. Approve to publish, or reject.')}
    ${section('Published &amp; live', live, 'Visible on the public library and downloadable where enabled.')}
    ${section('Hidden', hidden, 'Approved but display is turned off. Turn display back on to show them.')}
    ${section('Rejected', rejected)}
    ${section('Deleted, recoverable', trash, 'Soft-deleted. Recover to restore, in the state it was before deletion.')}
    ${papers.length === 0 ? '<p class="muted">No papers yet. Upload one above.</p>' : ''}
  </div>`;
}

exports.paper = (ctx, p, canManage = false) => shell(ctx, {
  title: p.title, workspaceActive: 'research', body: `
  <div class="wrap section narrow paper-page">
    <p class="kicker"><a href="/research">← Research papers</a></p>
    ${canManage ? `<div class="alert">${statusPill(p)} <span class="muted">Admin preview, this is how the paper reads. Manage it from the Research Papers list.</span></div>` : ''}
    <div class="paper-detail-head">
      <div class="paper-cover-wrap paper-cover-lg">${paperCover(p.id)}</div>
      <div>
        <h1>${esc(p.title)}</h1>
        <p class="authors">${esc(p.authors)} · <span class="mono">${esc(p.published_on)}</span></p>
        ${p.downloadable ? `<a class="btn btn-teal" href="/papers/${p.id}/download">${icon('download')} Download</a>` : '<span class="muted">This paper is read-only, download is not available.</span>'}
      </div>
    </div>
    <h2>Abstract</h2><p class="muted">${esc(p.abstract)}</p>
    ${p.body ? `<h2>Report</h2><p class="muted">${esc(p.body)}</p>` : ''}
  </div>`,
});
// Words that rise through a mask, each in its own clip. 'rw-in' rises on load (CSS only, so it
// never hides the words); 'nw-in' waits for its entry to scroll in. A heading set this way keeps
// its plain text as its accessible name.
function riseWords(text, inner = 'rw-in') {
  return String(text || '').split(/\s+/).filter(Boolean)
    .map((w, i) => `<span class="rw"><span class="${inner}" style="--i:${i}">${esc(w)}</span></span>`).join(' ');
}

// ============ NEWS & UPDATES (/updates) ============
// In the format of the BBC News front page (the owner's reference): the newest update leads, a
// full-width photograph over a large serif headline (a red "Latest" marker in front) and its
// summary; under a rule, every other update is a row, a thumbnail beside a serif headline with
// "3 days ago | Category" beneath. Updates carry a date, not a time, so the age is told in days.
function updAgo(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return '';
  const day = Date.UTC(+m[1], +m[2] - 1, +m[3]), now = new Date();
  const n = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - day) / 864e5);
  if (n <= 0) return 'Today';
  if (n === 1) return '1 day ago';
  if (n < 7) return `${n} days ago`;
  // within the year the day and month say it; older updates carry the year too
  return `${+m[3]} ${UPD_MONTHS[+m[2] - 1]}${+m[1] === now.getUTCFullYear() ? '' : ' ' + m[1]}`;
}
// The advertisers in the news page's side rails. Each runs its own campaign artwork from its own site
// (public/img/ads, downloaded with the owner's approval) and only words those campaigns or sites use.
const NEWS_ADS = {
  orange: { name: 'Orange Liberia', href: 'https://www.orange.com.lr/', site: 'orange.com.lr',
    h: 'Get access to AI without data', p: 'Just call Lorpu on 2026 or text LAD to 2026 to subscribe.' },
  lonestar: { name: 'Lonestar Cell MTN', href: 'https://lonestarcell.com/', site: 'lonestarcell.com',
    h: 'Y’ello to the MTN Nation', p: 'Yor thank you plenty. Here’s to you, the people who make 300 million possible.' },
  arcelormittal: { name: 'ArcelorMittal Liberia', href: 'https://liberia.arcelormittal.com/', site: 'liberia.arcelormittal.com',
    h: 'Smarter steels for people and planet', p: 'Our mining operations in Liberia prioritize safety.' },
  globalpharm: { name: 'Global Pharm', href: 'https://gpmlafrica.com/', site: 'gpmlafrica.com',
    h: 'Better Medicines for Better Healthcare.', p: 'Quality pharmaceutical products, made in Liberia.' },
};
function newsAd(key, k) {
  const a = NEWS_ADS[key];
  return `<div class="ad-slot">
      <p class="ad-tag">Advertisement</p>
      <a class="ad ad--${key}" style="--d:${k}" href="${a.href}" target="_blank" rel="sponsored noopener noreferrer" aria-label="Advertisement: ${esc(a.name)}, ${esc(a.h)}. Opens ${esc(a.site)}">
        <span class="ad-brand"><i aria-hidden="true"></i>${esc(a.name)}</span>
        <span class="ad-media"><img src="/img/ads/${key}.webp?v=${ASSET_V}" alt="" loading="lazy" decoding="async"></span>
        <span class="ad-copy"><b class="ad-h">${esc(a.h)}</b><span class="ad-p">${esc(a.p)}</span></span>
        <span class="ad-cta"><span>${esc(a.site)}</span>${icon('arrow')}</span>
        <span class="ad-timer" aria-hidden="true"></span>
      </a>
    </div>`;
}
exports.updates = (ctx, items) => {
  const meta = (u) => {
    const demo = STAT_FIGURE.test(String(u.title || '') + ' ' + String(u.body || ''));
    const iso = (/^(\d{4}-\d{2}-\d{2})/.exec(String(u.published_on || '')) || [])[1] || '';
    return `<span class="bbc-meta"><time datetime="${iso}">${esc(updAgo(u.published_on))}</time><span class="bbc-sep" aria-hidden="true"></span><span>${esc(updCategory(u.category))}</span>${demo ? `<span class="bbc-sep" aria-hidden="true"></span><span title="Demonstration figures">Demo data</span>` : ''}</span>`;
  };
  const lead = items[0];
  const leadHtml = lead ? `<article class="bbc-lead" aria-labelledby="bbc-lead-h">
      <a class="bbc-lead-img" href="/updates/${esc(updateSlug(lead))}" tabindex="-1" aria-hidden="true"><img src="${esc(updPhoto(items, 0))}" alt="" width="1200" height="675" decoding="async"></a>
      <div class="bbc-lead-in">
        <h2 class="bbc-lead-h" id="bbc-lead-h"><a href="/updates/${esc(updateSlug(lead))}"><span class="bbc-flag"><i aria-hidden="true"></i>Latest</span> ${esc(String(lead.title || ''))}</a></h2>
        <p class="bbc-lead-p">${esc(String(lead.body || ''))}</p>
        ${STAT_FIGURE.test(String(lead.title || '') + ' ' + String(lead.body || '')) ? meta(lead) : ''}
      </div>
    </article>` : '';
  const rows = items.slice(1).map((u, k) => `<li class="bbc-item" id="${updateAnchor(u)}">
        <a class="bbc-row" href="/updates/${esc(updateSlug(u))}">
          <span class="bbc-thumb"><img src="${esc(updPhoto(items, k + 1))}" alt="" width="480" height="270" loading="${k < 4 ? 'eager' : 'lazy'}" decoding="async"></span>
          <span class="bbc-txt"><span class="bbc-h">${esc(String(u.title || ''))}</span>${meta(u)}</span>
        </a>
      </li>`).join('');
  return shell(ctx, {
    title: 'News & Updates', body: `
  <div class="bbc-page">
  <aside class="bbc-rail is-left" aria-label="Advertisements">${newsAd('orange', 0)}${newsAd('arcelormittal', 2)}</aside>
  <div class="bbc" id="newsNotices">
    <h1 class="sr-only">News &amp; Updates</h1>
    ${items.length ? `${leadHtml}
    ${rows ? `<ol class="bbc-list">${rows}</ol>` : ''}` : '<p class="bbc-empty">No updates have been published yet.</p>'}
  </div>
  <aside class="bbc-rail is-right" aria-label="Advertisements">${newsAd('lonestar', 1)}${newsAd('globalpharm', 3)}</aside>
  </div>`,
  });
};
// ============ ONE UPDATE ============
// The page an ICT News & Updates entry opens: a dated entry in NIIS's record, read like a changelog.
// The date holds a rail of its own beside the entry; the record underneath lists every update
// with this one's place marked. Text and photo only, by the user's choice.
// A stated statistic: a percentage, a currency amount, a decimal, or a count in millions or
// thousands. Bare years and small counts ("30 indicators", "15 counties") are not figures.
const STAT_FIGURE = /\d(?:[\d,]*\d)?(?:\.\d+)?\s?%|(?:US\$|L\$|\$)\s?\d|\b\d+(?:[.,]\d+)?\s?(?:million|billion|thousand)\b|\b\d+\.\d+\b/i;
exports.updatePage = (ctx, { items, index }) => {
  const u = items[index];
  const title = String(u.title || '').trim();
  const body = String(u.body || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(u.published_on || ''));
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  const day = m ? String(+m[3]) : '';
  const monthYear = m ? `${UPD_MONTHS[+m[2] - 1]} ${m[1]}` : '';
  const category = updCategory(u.category);
  const photo = updPhoto(items, index);
  const demo = STAT_FIGURE.test(title + ' ' + body);
  // items run newest first, so the earlier update is the next row and the later one the row before
  const step = (x, dir, rel) => x ? `<a href="/updates/${esc(updateSlug(x))}" rel="${rel}"><span class="upd-step-dir">${dir}</span><span class="upd-step-title">${esc(String(x.title || ''))}</span></a>` : '';
  const steps = step(items[index + 1], 'Earlier', 'prev') + step(items[index - 1], 'Later', 'next');
  const record = items.map((x, i) => {
    const here = i === index;
    const row = `<time datetime="${esc(String(x.published_on || '').slice(0, 10))}">${esc(updDate(x.published_on))}</time>
          <span class="upd-row-title">${esc(String(x.title || ''))}</span>
          <span class="upd-row-cat">${here ? 'You are reading this' : esc(updCategory(x.category))}</span>`;
    return here
      ? `<li class="is-here" aria-current="page"><div class="upd-row">${row}</div></li>`
      : `<li><a class="upd-row" href="/updates/${esc(updateSlug(x))}">${row}</a></li>`;
  }).join('');
  return shell(ctx, {
    title,
    body: `
  <article class="upd wrap" aria-labelledby="updTitle">
    <nav class="upd-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a><span aria-hidden="true">/</span><a href="/updates">News &amp; notices</a><span aria-hidden="true">/</span><span aria-current="page">${esc(title)}</span>
    </nav>
    <div class="upd-grid">
      <aside class="upd-rail" aria-label="About this update">
        <time class="upd-date" datetime="${esc(iso)}"><span class="upd-day">${esc(day)}</span> <span class="upd-my">${esc(monthYear)}</span></time>
        <dl class="upd-facts">
          <div><dt>Category</dt><dd>${esc(category)}</dd></div>
        </dl>
        ${steps ? `<nav class="upd-step" aria-label="Neighbouring updates">${steps}</nav>` : ''}
      </aside>
      <div class="upd-main">
        <h1 id="updTitle" aria-label="${esc(title)}"><span aria-hidden="true">${riseWords(title)}</span></h1>
        <p class="upd-lead">${esc(body)}</p>
        ${demo ? `<p class="upd-demo" role="note">${icon('info')}<span><strong>Demonstration data.</strong> The figures in this update come from NIIS's demonstration dataset. Live Ministry feeds are not public yet, so they are not official statistics.</span></p>` : ''}
        <figure class="upd-figure">
          <img src="${esc(photo)}" alt="" width="1200" height="675" decoding="async">
          <figcaption>Illustrative photo from the NIIS image library.</figcaption>
        </figure>
        <section class="upd-record" aria-labelledby="updRecordTitle">
          <h2 id="updRecordTitle">The record</h2>
          <ol class="upd-list">${record}</ol>
          <a class="upd-all" href="/updates">All updates ${icon('arrow')}</a>
        </section>
      </div>
    </div>
  </article>`,
  });
};

// Size control shown above each visualization so a reader can scale it to fit their screen.
function vizSize(target, label = 'Size') {
  return `<div class="dx-viz-bar">
    <div class="dx-size">
      <label for="size-${target}">${esc(label)}</label>
      <input type="range" id="size-${target}" class="dx-size-range" data-viz="${target}" min="45" max="100" value="100" step="5">
      <span class="dx-size-val" id="size-${target}-val">100%</span>
    </div>
    <button type="button" class="dx-expand" data-expand="${target}" title="View full screen" aria-label="View full screen">${icon('expand')}</button>
  </div>`;
}

// Full-bleed page header banner. Each page has its own slot in the Image Library, so admins can
// swap them one at a time. An uploaded banner is centred rather than using the built-in framing.
function pageHeader(slug, title, sub = '') {
  const style = slotBg('headers', slug) + (imgs.isCustom('headers', slug) ? ';background-position:center center' : '');
  return `<section class="page-header ph-${slug}" style="${style}">
    <div class="ph-scrim"></div>
    <div class="wrap ph-inner">
      <h1>${esc(title)}</h1>
      ${sub ? `<p>${esc(sub)}</p>` : ''}
    </div>
  </section>`;
}

// ============ OUR PARTNERS ============
// Logo on the left, the institution and its role in the middle, the focal point on the right.
// Logos and focal-point photographs are supplied by each partner through the Image Library.
// Where one is absent the card falls back to a lettered monogram or a neutral avatar: the page
// never invents an institution's branding, and never shows an invented face beside a real name.
const PARTNER_CATS = ['Government', 'Regulator', 'Statistics', 'Financial', 'Private sector', 'Academic', 'Development partner'];

function monogram(p) {
  // A real acronym stands in for a missing logo far better than three sliced characters, so use
  // the short name whole when it already is one (MoPT, LTA, LISGIS). Otherwise build initials.
  const short = (p.short_name || '').trim();
  if (/^[A-Za-z]{2,6}$/.test(short)) return short.toUpperCase();
  const src = (short || p.name || '').replace(/[^A-Za-z ]/g, ' ').trim();
  const words = src.split(/\s+/).filter(Boolean);
  const letters = (words.length > 1
    ? words.slice(0, 3).map((w) => (/^[A-Z]{2,3}$/.test(w) ? w : w[0]))
    : src.slice(0, 3).split('')).join('').toUpperCase().slice(0, 5);
  return letters || '?';
}

function partnerCard(p) {
  const logo = imgs.url('partnerLogos', p.slug);
  const face = imgs.url('partnerFocals', p.slug);
  const st = { proposed: 'Engagement proposed', engaged: 'In discussion', signed: 'Agreement signed' }[p.status] || p.status;
  return `<article class="pt-card" data-lib-item data-lib-facet="${esc(p.category)}" data-lib-search="${esc((p.name + ' ' + (p.short_name || '') + ' ' + p.category + ' ' + p.role).toLowerCase())}">
    <div class="pt-logo">
      ${logo
        ? `<img src="${esc(logo)}" alt="${esc(p.name)} logo" loading="lazy">`
        : `<span class="pt-monogram" data-len="${monogram(p).length}" aria-hidden="true">${esc(monogram(p))}</span>
           <span class="pt-logo-note">Logo to be supplied</span>`}
    </div>

    <div class="pt-body">
      <div class="pt-head">
        <span class="pt-cat">${esc(p.category)}</span>
        <span class="pt-status is-${esc(p.status)}">${esc(st)}</span>
      </div>
      <h3>${esc(p.name)}</h3>
      ${p.short_name && p.short_name !== p.name ? `<p class="pt-abbr">${esc(p.short_name)}</p>` : ''}
      <p class="pt-role">${esc(p.role)}</p>
      ${p.contributes ? `<p class="pt-contrib"><span>Contributes</span>${esc(p.contributes)}</p>` : ''}
      ${p.website ? `<a class="pt-link" href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">Visit website ${icon('arrow')}</a>` : ''}
    </div>

    <aside class="pt-focal">
      <p class="pt-focal-label">Focal point</p>
      <div class="pt-face">
        ${face
          ? `<img src="${esc(face)}" loading="lazy" alt="${p.focal_name
            ? esc(p.focal_name)
            : 'Placeholder portrait. No focal point has been nominated for this institution yet.'}">`
          : `<svg viewBox="0 0 48 48" class="pt-avatar" aria-hidden="true">
               <circle cx="24" cy="17" r="9"></circle>
               <path d="M6 46c0-9.4 8.1-15 18-15s18 5.6 18 15"></path>
             </svg>`}
      </div>
      ${p.focal_name
        ? `<p class="pt-focal-name">${esc(p.focal_name)}</p>
           ${p.focal_title ? `<p class="pt-focal-title">${esc(p.focal_title)}</p>` : ''}
           ${p.focal_unit ? `<p class="pt-focal-unit">${esc(p.focal_unit)}</p>` : ''}
           ${p.focal_email ? `<a class="pt-focal-mail" href="mailto:${esc(p.focal_email)}">${esc(p.focal_email)}</a>` : ''}`
        : `<p class="pt-focal-tbc">To be nominated</p>
           <p class="pt-focal-hint">Each partner names one focal point who submits and signs off that institution's data.</p>`}
    </aside>
  </article>`;
}

exports.partners = (ctx, { partners = [] }) => {
  const counts = PARTNER_CATS.map((c) => ({ cat: c, n: partners.filter((p) => p.category === c).length }))
    .filter((x) => x.n > 0);
  return shell(ctx, {
    title: 'Our Partners', active: '/partners', workspaceActive: 'partners', body: `
  ${partnerBook(partners)}

  <div class="wrap section page-black">
    ${filterBar({
      placeholder: 'Search partners by name, sector or role…',
      facetLabel: 'Sector',
      facetAll: 'All sectors',
      options: counts.map((c) => ({ value: c.cat, label: c.cat + ' (' + c.n + ')' })),
      total: partners.length,
      noun: 'shown',
    })}

    <div class="pt-list">
      ${partners.map(partnerCard).join('')}
    </div>

    <section class="pt-join">
      <h3>Becoming a partner</h3>
      <p>Institutions that hold ICT related data and wish to contribute to the national database are welcome to
        approach the ICT Statistics and Policy Unit. Partnership means supplying an agreed set of indicators on a
        published schedule, under a written data sharing agreement, with a named focal point on each side.</p>
      <a class="btn btn-teal" href="/about">${icon('mail')} Contact the ICT Statistics and Policy Unit</a>
    </section>

    <p class="pt-note">Logos are the property of their respective organisations and are shown to identify
      them. Partnership is at various stages of discussion and is confirmed institution by institution.
      Focal point portraits are placeholders until each institution nominates its own.</p>
  </div>
  <script>
  ${partnerBookScript}
  ${libraryFilterScript}
  </script>`,
  });
};

// ============ ICT REPORTS ============
// Under the banner: the latest release as a feature, the counts, the library (type chips and a
// search, cards that rearrange as they filter), and a publication timeline. Each report opens a
// summary with the catalogue categories its subject draws on. There are no report files on the
// platform yet, so the page offers no download. Logic: app.js, initReports.
const REPORT_MONTH = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12, Q1: 3, Q2: 6, Q3: 9, Q4: 12 };
const reportOrder = (r) => r.year * 100 + (REPORT_MONTH[String(r.date).split(' ')[0]] || 0);
exports.reports = (ctx, { indicators = [], domainLabels = {} } = {}) => {
  const byDomain = {};
  indicators.forEach((i) => (byDomain[i.domain] = byDomain[i.domain] || []).push(i));
  const list = NATIONAL_REPORTS.map((r, i) => ({ ...r, i, bg: slotBg('reports', r.img, true) }));
  const latest = list.slice().sort((a, b) => reportOrder(b) - reportOrder(a))[0];
  const tags = [...new Set(list.map((r) => r.tag))];
  const covered = [...new Set(list.flatMap((r) => r.domains || []))].filter((d) => byDomain[d]);
  const related = (r) => (r.domains || []).filter((d) => byDomain[d]).map((d) => ({ d, label: domainLabels[d] || d, n: byDomain[d].length, names: byDomain[d].slice(0, 5).map((x) => x.name) }));
  const chipsFor = (r) => related(r).map((x) => `<a class="ui-chip" href="/data">${esc(x.label)} <b>${x.n}</b></a>`).join('');
  const card = (r) => `<article class="rx-card" data-rp-item data-tag="${esc(r.tag)}" data-search="${esc((r.title + ' ' + r.tag + ' ' + r.desc + ' ' + r.date).toLowerCase())}">
        <button type="button" class="rx-card-hit" data-open="${r.i}" aria-label="Read the summary: ${esc(r.title)}"></button>
        <div class="rx-card-img" style="${r.bg}"><span class="rx-card-n">${String(r.i + 1).padStart(2, '0')}</span></div>
        <div class="rx-card-body">
          <p class="rx-card-meta"><span class="rx-tag">${esc(r.tag)}</span><span>${esc(r.date)}</span></p>
          <h3>${esc(r.title)}</h3>
          <p>${esc(r.desc)}</p>
          <span class="rx-card-go">Read the summary ${icon('arrow')}</span>
        </div>
      </article>`;
  const timeline = list.slice().sort((a, b) => reportOrder(a) - reportOrder(b));
  const state = list.map((r) => ({ title: r.title, tag: r.tag, date: r.date, desc: r.desc, bg: r.bg, related: related(r) }));
  return shell(ctx, {
    title: 'ICT Reports', active: '/reports', workspaceActive: 'reports', body: `
  ${pageHeader('reports', 'ICT Reports', 'Official statistical and sector reports from the ICT Statistics & Policy Unit.')}
  <div class="rx">
    <section class="rx-feature wrap">
      ${eyebrow('Latest release')}
      <article class="rx-feat" data-rise-block>
        <div class="rx-feat-img" style="${latest.bg}"><span class="rx-feat-date">${esc(latest.date)}</span></div>
        <div class="rx-feat-body">
          <span class="rx-tag">${esc(latest.tag)}</span>
          <h2 data-rise-head>${esc(latest.title)}</h2>
          <p class="rx-feat-desc">${esc(latest.desc)}</p>
          ${related(latest).length ? `<div class="rx-related"><p class="ui-k">The data behind it</p><div class="rx-chips">${chipsFor(latest)}</div></div>` : ''}
          <div class="rx-actions">
            <button type="button" class="ui-btn ui-btn-primary" data-open="${latest.i}">Read the summary ${icon('arrow')}</button>
            <a class="ui-btn" href="/data">Explore the data</a>
          </div>
        </div>
      </article>
    </section>

    <section class="rx-stats-band wrap">
      <dl class="ui-stats">
        <div><dt>Reports published</dt><dd data-count="${list.length}">${list.length}</dd></div>
        <div><dt>Report types</dt><dd data-count="${tags.length}">${tags.length}</dd></div>
        <div><dt>Latest release</dt><dd>${esc(latest.date)}</dd></div>
        <div><dt>Indicator categories drawn on</dt><dd data-count="${covered.length}">${covered.length}</dd></div>
      </dl>
    </section>

    <section class="rx-lib wrap" aria-labelledby="rx-lib-h">
      <div class="rx-lib-head">
        <h2 id="rx-lib-h" data-rise-head>All reports</h2>
        <div class="ui-search" role="search">
          ${icon('search')}
          <input id="rx-q" type="search" placeholder="Search reports" aria-label="Search reports" autocomplete="off">
          <button type="button" class="ui-search-x" aria-label="Clear the search" hidden>${icon('x')}</button>
        </div>
      </div>
      <div class="rx-tags" role="group" aria-label="Report type">
        <button type="button" class="ui-chip is-on" data-tag="" aria-pressed="true">All <b>${list.length}</b></button>
        ${tags.map((t) => `<button type="button" class="ui-chip" data-tag="${esc(t)}" aria-pressed="false">${esc(t)} <b>${list.filter((r) => r.tag === t).length}</b></button>`).join('')}
      </div>
      <div class="rx-grid is-all" id="rx-grid">${list.map(card).join('')}</div>
      <div class="ui-empty" hidden>
        <div class="ui-empty-art" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
        <h3>No report matches that search</h3>
        <p>Clear the box or pick a different report type.</p>
        <button type="button" class="ui-btn" data-reset>Show all reports</button>
      </div>
    </section>

    <section class="rx-time wrap" aria-labelledby="rx-time-h">
      <h2 id="rx-time-h" data-rise-head>Publication timeline</h2>
      <ol class="rx-tl">
        ${timeline.map((r, k) => `<li style="--k:${k}">
          <span class="rx-tl-date">${esc(r.date)}</span>
          <span class="rx-tl-dot" aria-hidden="true"></span>
          <button type="button" class="rx-tl-t" data-open="${r.i}">${esc(r.title)}</button>
          <span class="rx-tl-tag">${esc(r.tag)}</span>
        </li>`).join('')}
      </ol>
    </section>
  </div>
  <dialog class="rx-modal" id="rx-modal" aria-labelledby="rx-m-title">
    <div class="rx-m-img" id="rx-m-img"></div>
    <button type="button" class="rx-m-x" data-close aria-label="Close">${icon('x')}</button>
    <div class="rx-m-body">
      <p class="rx-card-meta"><span class="rx-tag" id="rx-m-tag"></span><span id="rx-m-date"></span></p>
      <h2 id="rx-m-title"></h2>
      <p id="rx-m-desc"></p>
      <div id="rx-m-rel"></div>
      <div class="rx-actions"><a class="ui-btn ui-btn-primary" href="/data">Explore the data ${icon('arrow')}</a><button type="button" class="ui-btn" data-close>Close</button></div>
    </div>
  </dialog>
  <script>window.__NICTD_PAGE__='reports';window.__REPORTS__=${JSON.stringify(state)};</script>`,
  });
};

// ============ OUR TEAM ============
// A carousel of team members, the National ICT Patrons, then the National ICT Talent Pool. The members are sample
// profiles (the owner asked for twelve mock Liberian staff until real appointments, names and
// photographs are supplied). Their photographs in public/img/team are AI-generated portraits of
// people who do not exist, never photographs of real people, and the page says so.
// sample members; img is the slug of their photograph in public/img/team
const TEAM_MEMBERS = [
  { name: 'Musu Kollie', img: 'musu-kollie', role: 'Survey / Project Director', bio: 'Leads the data mining phase from the first county wave to the national release, and answers for the whole programme.' },
  { name: 'Emmanuel Kpadeh', img: 'emmanuel-kpadeh', role: 'Data Team Lead', bio: 'Runs the processing pipeline and signs off every dataset before it is published in NIIS.' },
  { name: 'Comfort Wesseh', img: 'comfort-wesseh', role: 'Sampling Statistician', bio: 'Designs the samples and the weights that turn field interviews into county estimates.' },
  { name: 'Prince Flomo', img: 'prince-flomo', role: 'Database / CAPI Engineer', bio: 'Builds the tablet questionnaires and the sync service that carries uploads in from the field.' },
  { name: 'Siafa Kamara', img: 'siafa-kamara', role: 'Database / CAPI Engineer', bio: 'Keeps the upload pipeline quick and the database in order, wave after wave.' },
  { name: 'Hawa Kromah', img: 'hawa-kromah', role: 'GIS / Mapping Analyst', bio: 'Draws the enumeration areas and turns county figures into the maps on this site.' },
  { name: 'Jartu Dolo', img: 'jartu-dolo', role: 'Data Quality Analyst', bio: 'Writes the validation rules that catch an outlier before anyone else sees it.' },
  { name: 'Saye Zuo', img: 'saye-zuo', role: 'Data Quality Analyst', bio: 'Reviews every flagged record with the field teams until the numbers hold.' },
  { name: 'Korto Nyumah', img: 'korto-nyumah', role: 'Data Processing Clerk', bio: 'Codes the open answers and reconciles records, so nothing collected in the field is lost.' },
  { name: 'Momo Konneh', img: 'momo-konneh', role: 'County Research Lead, Bong', bio: 'Owns sampling and data quality in Bong County, and leads its key-informant interviews.' },
  { name: 'Decontee Tarpeh', img: 'decontee-tarpeh', role: 'Field Supervisor, Nimba', bio: 'Leads an enumerator team in Nimba, running spot checks and clearing the daily uploads.' },
  { name: 'Varney Kanneh', img: 'varney-kanneh', role: 'Field Enumerator, Montserrado', bio: 'Collects household ICT data on a tablet across his enumeration areas in Montserrado.' },
];
// The National ICT Talent Pool: young Liberians the programme has found building, designing and
// securing the country's digital future. Sample profiles (the owner asked for mock talents until
// real ones are announced); the photographs in public/img/talent are AI-generated portraits of
// people who do not exist, and the page says so.
const TALENTS = [
  { name: 'Blessing Gbessay', img: 'blessing-gbessay', role: 'Software developer', field: 'Software', county: 'Montserrado',
    note: 'Built a voice assistant in Liberian English that reads market prices aloud to farmers.', skills: ['Flutter', 'Firebase', 'Python'] },
  { name: 'Abraham Tamba', img: 'abraham-tamba', role: 'Data analyst', field: 'Data & AI', county: 'Margibi',
    note: 'Mapped the gaps in mobile-money agent coverage across 120 communities from open data.', skills: ['Python', 'QGIS', 'SQL'] },
  { name: 'Patience Sumo', img: 'patience-sumo', role: 'UX designer', field: 'Design', county: 'Bong',
    note: 'Designed a sign-language learning app together with deaf students in Gbarnga.', skills: ['Figma', 'User research', 'Prototyping'] },
  { name: 'Joseph Wolobah', img: 'joseph-wolobah', role: 'Cybersecurity specialist', field: 'Cybersecurity', county: 'Nimba',
    note: 'Runs free phishing-awareness clinics for small businesses in Ganta.', skills: ['Network security', 'Linux', 'Incident response'] },
  { name: 'Mercy Toe', img: 'mercy-toe', role: 'Hardware & IoT maker', field: 'Hardware', county: 'Grand Bassa',
    note: 'Built a solar-powered rain-gauge network that reports its readings by SMS.', skills: ['Arduino', 'Solar power', 'C'] },
  { name: 'Augustine Karmo', img: 'augustine-karmo', role: 'Mobile developer', field: 'Software', county: 'Lofa',
    note: 'Built an offline-first school attendance app that syncs when the signal returns.', skills: ['Kotlin', 'Android', 'SQLite'] },
  { name: 'Esther Gonleh', img: 'esther-gonleh', role: 'AI student', field: 'Data & AI', county: 'Montserrado',
    note: 'Gathers and cleans Kpelle and Bassa text to train small language models.', skills: ['PyTorch', 'NLP', 'Data labelling'] },
  { name: 'Mohammed Fofana', img: 'mohammed-fofana', role: 'Network engineer', field: 'Networks', county: 'Grand Cape Mount',
    note: 'Keeps a community Wi-Fi mesh online across Robertsport.', skills: ['Linux', 'Wireless networks', 'Docker'] },
  { name: 'Princess Teah', img: 'princess-teah', role: 'Web developer', field: 'Software', county: 'Maryland',
    note: 'Built a booking site for guesthouses in Harper that takes mobile-money payments.', skills: ['JavaScript', 'React', 'Node.js'] },
  { name: 'Isaac Saygbe', img: 'isaac-saygbe', role: 'Robotics maker', field: 'Hardware', county: 'Bomi',
    note: 'Designed a low-cost robot kit that teaches coding in rural schools.', skills: ['Raspberry Pi', 'Python', '3D printing'] },
  { name: 'Victoria Wreh', img: 'victoria-wreh', role: 'Fintech builder', field: 'Fintech', county: 'Grand Gedeh',
    note: 'Built a ledger app that keeps the books for susu savings groups in Zwedru.', skills: ['Kotlin', 'USSD', 'Product design'] },
  { name: 'Samuel Kpaan', img: 'samuel-kpaan', role: 'Data scientist', field: 'Data & AI', county: 'Nimba',
    note: 'Uses satellite images to estimate cocoa farm sizes for local cooperatives.', skills: ['Python', 'Remote sensing', 'TensorFlow'] },
  { name: 'Cecilia Jallah', img: 'cecilia-jallah', role: 'Cybersecurity student', field: 'Cybersecurity', county: 'Montserrado',
    note: 'Leads a women-in-cybersecurity study group at a Monrovia university.', skills: ['Ethical hacking', 'Python', 'Wireshark'] },
  { name: 'Moses Gaye', img: 'moses-gaye', role: 'Network technician', field: 'Networks', county: 'River Gee',
    note: 'Installed solar-powered Wi-Fi points at three clinics around Fish Town.', skills: ['Networking', 'Solar power', 'Wireless links'] },
  { name: 'Grace Sackie', img: 'grace-sackie', role: 'Digital media producer', field: 'Digital media', county: 'Grand Kru',
    note: 'Runs a radio and WhatsApp channel that explains digital services in Kru.', skills: ['Audio production', 'Storytelling', 'Social media'] },
  { name: 'Daniel Saah', img: 'daniel-saah', role: 'App developer', field: 'Software', county: 'Sinoe',
    note: 'Built a catch-logging app for fishing crews in Greenville.', skills: ['React Native', 'Firebase', 'GPS'] },
  { name: 'Rebecca Kpoto', img: 'rebecca-kpoto', role: 'Interface designer', field: 'Design', county: 'Margibi',
    note: 'Designs clear, low-data screens for government e-services.', skills: ['Figma', 'Accessibility', 'Design systems'] },
  { name: 'Alfred Zinnah', img: 'alfred-zinnah', role: 'Electronics technician', field: 'Hardware', county: 'Lofa',
    note: 'Repairs and refurbishes donated laptops for schools in Voinjama.', skills: ['Electronics repair', 'Linux', 'Soldering'] },
  { name: 'Mariama Sesay', img: 'mariama-sesay', role: 'Fintech analyst', field: 'Fintech', county: 'Grand Cape Mount',
    note: 'Built a tracker that compares the fees on money transfers into Liberia.', skills: ['Python', 'Web scraping', 'Data visualisation'] },
  { name: 'Peter Nagbe', img: 'peter-nagbe', role: 'Data engineer', field: 'Data & AI', county: 'Bong',
    note: 'Turns handwritten clinic registers into a searchable database.', skills: ['Python', 'OCR', 'PostgreSQL'] },
  { name: 'Hannah Weefur', img: 'hannah-weefur', role: 'Mobile service developer', field: 'Software', county: 'River Cess',
    note: 'Built a USSD service that gives farmers the weather forecast in Bassa.', skills: ['USSD', 'PHP', 'MySQL'] },
  { name: 'Joshua Tokpah', img: 'joshua-tokpah', role: 'IT security officer', field: 'Cybersecurity', county: 'Gbarpolu',
    note: 'Secured a county hospital’s records system after a ransomware scare.', skills: ['Backups', 'Windows Server', 'Security audits'] },
  { name: 'Ruth Kerkula', img: 'ruth-kerkula', role: 'Video creator', field: 'Digital media', county: 'Montserrado',
    note: 'Makes short videos that teach digital safety to first-time phone users.', skills: ['Video editing', 'Animation', 'Scriptwriting'] },
  { name: 'Kpana Fallah', img: 'kpana-fallah', role: 'Network engineer', field: 'Networks', county: 'Grand Bassa',
    note: 'Keeps the network and backup power running at a co-working space in Buchanan.', skills: ['Fibre splicing', 'MikroTik', 'Power backup'] },
  { name: 'Yassah Morris', img: 'yassah-morris', role: 'Data analyst', field: 'Data & AI', county: 'Bomi',
    note: 'Built a dashboard that tracks school enrolment across Bomi County.', skills: ['Power BI', 'Excel', 'SQL'] },
];
// Education and experience behind each sample profile (mock, as the profiles are), shown in the
// details window that opens from a card. experience: [role, where, when]
const PERSON_MORE = {
  'Musu Kollie': { edu: ['MSc Development Statistics, University of Liberia', 'BSc Economics, Cuttington University'], exp: [['Survey / Project Director', 'NIIS data mining phase', '2026 to now'], ['Survey manager', 'National household survey programme', '2019 to 2025'], ['Statistician', 'County planning office, Bong', '2014 to 2019']] },
  'Emmanuel Kpadeh': { edu: ['BSc Computer Science, University of Liberia', 'Certificate in Data Engineering'], exp: [['Data Team Lead', 'NIIS', '2026 to now'], ['Database administrator', 'Ministry IT unit', '2018 to 2025']] },
  'Comfort Wesseh': { edu: ['MSc Applied Statistics, University of Ghana', 'BSc Mathematics, University of Liberia'], exp: [['Sampling Statistician', 'NIIS', '2026 to now'], ['Research statistician', 'Health survey programme', '2021 to 2025']] },
  'Prince Flomo': { edu: ['BSc Software Engineering, Stella Maris Polytechnic'], exp: [['Database / CAPI Engineer', 'NIIS', '2026 to now'], ['Mobile developer', 'Software studio, Monrovia', '2022 to 2025']] },
  'Siafa Kamara': { edu: ['BSc Information Technology, African Methodist Episcopal University'], exp: [['Database / CAPI Engineer', 'NIIS', '2026 to now'], ['Systems administrator', 'Bank IT department', '2020 to 2025']] },
  'Hawa Kromah': { edu: ['BSc Geography, University of Liberia', 'Diploma in GIS'], exp: [['GIS / Mapping Analyst', 'NIIS', '2026 to now'], ['GIS officer', 'County land-use mapping project', '2019 to 2025']] },
  'Jartu Dolo': { edu: ['BSc Statistics, University of Liberia'], exp: [['Data Quality Analyst', 'NIIS', '2026 to now'], ['Monitoring and evaluation officer', 'Education programme', '2018 to 2025']] },
  'Saye Zuo': { edu: ['BA Economics, Cuttington University'], exp: [['Data Quality Analyst', 'NIIS', '2026 to now'], ['Field data supervisor', 'Agriculture census', '2016 to 2025']] },
  'Korto Nyumah': { edu: ['Associate Degree in Computer Science, Grand Bassa Community College'], exp: [['Data Processing Clerk', 'NIIS', '2026 to now'], ['Data entry officer', 'County health office', '2023 to 2025']] },
  'Momo Konneh': { edu: ['MA Sociology, University of Liberia', 'BA Sociology, Cuttington University'], exp: [['County Research Lead, Bong', 'NIIS', '2026 to now'], ['Researcher', 'Community research programme, Bong', '2017 to 2025']] },
  'Decontee Tarpeh': { edu: ['BSc Public Health, Mother Patern College of Health Sciences'], exp: [['Field Supervisor, Nimba', 'NIIS', '2026 to now'], ['Enumerator team lead', 'Demographic survey', '2021 to 2025']] },
  'Varney Kanneh': { edu: ['Certificate in Information Technology, Booker Washington Institute'], exp: [['Field Enumerator, Montserrado', 'NIIS', '2026 to now'], ['Mobile money agent', 'Paynesville', '2022 to 2025']] },
  'Blessing Gbessay': { edu: ['BSc Computer Science (in progress), Stella Maris Polytechnic'], exp: [['Flutter developer, freelance', 'Monrovia', '2024 to now'], ['Volunteer coding coach', 'Community tech hub', '2023 to now']] },
  'Abraham Tamba': { edu: ['BSc Statistics, University of Liberia'], exp: [['Data analyst', 'Development research programme', '2023 to now'], ['Research intern', 'Margibi County planning office', '2022']] },
  'Patience Sumo': { edu: ['BA Mass Communication, Cuttington University'], exp: [['UX designer, freelance', 'Gbarnga', '2024 to now'], ['Design fellow', 'Inclusive tech programme', '2023']] },
  'Joseph Wolobah': { edu: ['BSc Information Technology, United Methodist University'], exp: [['Security analyst', 'Business network, Ganta', '2022 to now'], ['IT support officer', 'Nimba County school', '2020 to 2022']] },
  'Mercy Toe': { edu: ['Diploma in Electrical Engineering, Booker Washington Institute'], exp: [['IoT maker', 'Maker space, Buchanan', '2023 to now'], ['Solar installer', 'Rural energy cooperative', '2021 to 2023']] },
  'Augustine Karmo': { edu: ['BSc Computer Science, Cuttington University'], exp: [['Android developer', 'Schools project, Voinjama', '2024 to now'], ['ICT teacher', 'Lofa County high school', '2022 to 2024']] },
  'Esther Gonleh': { edu: ['BSc Computer Science (in progress), University of Liberia'], exp: [['Language data volunteer', 'Local-language AI project', '2024 to now'], ['Research assistant', 'University computing lab', '2023 to now']] },
  'Mohammed Fofana': { edu: ['Certificate in Networking, BlueCrest University College'], exp: [['Network engineer', 'Community Wi-Fi, Robertsport', '2022 to now'], ['Field technician', 'Internet service provider', '2020 to 2022']] },
  'Princess Teah': { edu: ['BSc Information Technology, William V.S. Tubman University'], exp: [['Web developer, freelance', 'Harper', '2023 to now'], ['IT assistant', 'Tourism office, Maryland', '2022']] },
  'Isaac Saygbe': { edu: ['Diploma in Electronics, Booker Washington Institute'], exp: [['Robotics instructor', 'Schools STEM club, Bomi', '2023 to now'], ['Electronics technician', 'Repair shop, Tubmanburg', '2020 to 2023']] },
  'Victoria Wreh': { edu: ['BBA Accounting, University of Liberia'], exp: [['Fintech product builder', 'Zwedru', '2024 to now'], ['Savings group officer', 'Women’s microfinance programme', '2021 to 2024']] },
  'Samuel Kpaan': { edu: ['BSc Agriculture, Cuttington University', 'Certificate in Remote Sensing'], exp: [['Data scientist', 'Cocoa cooperative, Nimba', '2023 to now'], ['Extension officer', 'Agriculture programme', '2020 to 2023']] },
  'Cecilia Jallah': { edu: ['BSc Computer Science (in progress), African Methodist Episcopal University'], exp: [['Study group lead', 'Women in cybersecurity', '2024 to now'], ['IT intern', 'Bank IT department, Monrovia', '2024']] },
  'Moses Gaye': { edu: ['Certificate in Networking, Stella Maris Polytechnic'], exp: [['Network technician', 'Clinics connectivity project, River Gee', '2023 to now'], ['Electrician', 'Fish Town', '2019 to 2023']] },
  'Grace Sackie': { edu: ['BA Mass Communication, University of Liberia'], exp: [['Digital media producer', 'Community radio, Grand Kru', '2022 to now'], ['Reporter', 'Radio station, Barclayville', '2020 to 2022']] },
  'Daniel Saah': { edu: ['BSc Computer Science, Stella Maris Polytechnic'], exp: [['App developer', 'Fishing cooperative, Greenville', '2024 to now'], ['Computer lab assistant', 'Sinoe high school', '2022 to 2024']] },
  'Rebecca Kpoto': { edu: ['BA Fine Arts, University of Liberia', 'Certificate in UX Design'], exp: [['Interface designer', 'E-services design team', '2023 to now'], ['Graphic designer', 'Print shop, Kakata', '2020 to 2023']] },
  'Alfred Zinnah': { edu: ['Diploma in Electronics, Booker Washington Institute'], exp: [['Electronics technician', 'Laptop refurbishment, Voinjama', '2022 to now'], ['Phone repair technician', 'Voinjama market', '2019 to 2022']] },
  'Mariama Sesay': { edu: ['BSc Economics, University of Liberia'], exp: [['Fintech analyst', 'Remittance research project', '2024 to now'], ['Bank teller', 'Robertsport branch', '2021 to 2024']] },
  'Peter Nagbe': { edu: ['BSc Computer Science, Cuttington University'], exp: [['Data engineer', 'Clinic records project, Bong', '2023 to now'], ['Health information officer', 'County health team', '2020 to 2023']] },
  'Hannah Weefur': { edu: ['BSc Information Technology, BlueCrest University College'], exp: [['Mobile service developer', 'Farmers’ weather service, River Cess', '2024 to now'], ['Teacher', 'School in Cestos City', '2021 to 2024']] },
  'Joshua Tokpah': { edu: ['BSc Information Technology, United Methodist University'], exp: [['IT security officer', 'County hospital, Gbarpolu', '2022 to now'], ['IT technician', 'District office, Bopolu', '2019 to 2022']] },
  'Ruth Kerkula': { edu: ['BA Communications, African Methodist Episcopal University'], exp: [['Video creator', 'Digital safety channel', '2023 to now'], ['Social media assistant', 'Agency, Monrovia', '2021 to 2023']] },
  'Kpana Fallah': { edu: ['Certificate in Networking, Grand Bassa Community College'], exp: [['Network engineer', 'Co-working space, Buchanan', '2022 to now'], ['Fibre technician', 'Telecom contractor', '2019 to 2022']] },
  'Yassah Morris': { edu: ['BSc Statistics, University of Liberia'], exp: [['Data analyst', 'County education office, Bomi', '2023 to now'], ['Data clerk', 'School census', '2021 to 2023']] },
};
// brand marks for the social links: GitHub (from the team-card component the owner supplied),
// Instagram and Facebook (Font Awesome Free, as in the footer), LinkedIn and X
const SOCIAL = {
  gh: { vb: '0 0 24 24', d: 'M5.88401 18.6533C5.58404 18.4526 5.32587 18.1975 5.0239 17.8369C4.91473 17.7065 4.47283 17.1524 4.55811 17.2583C4.09533 16.6833 3.80296 16.417 3.50156 16.3089C2.9817 16.1225 2.7114 15.5499 2.89784 15.0301C3.08428 14.5102 3.65685 14.2399 4.17672 14.4263C4.92936 14.6963 5.43847 15.1611 6.12425 16.0143C6.03025 15.8974 6.46364 16.441 6.55731 16.5529C6.74784 16.7804 6.88732 16.9182 6.99629 16.9911C7.20118 17.1283 7.58451 17.1874 8.14709 17.1311C8.17065 16.7489 8.24136 16.3783 8.34919 16.0358C5.38097 15.3104 3.70116 13.3952 3.70116 9.63971C3.70116 8.40085 4.0704 7.28393 4.75917 6.3478C4.5415 5.45392 4.57433 4.37284 5.06092 3.15636C5.1725 2.87739 5.40361 2.66338 5.69031 2.57352C5.77242 2.54973 5.81791 2.53915 5.89878 2.52673C6.70167 2.40343 7.83573 2.69705 9.31449 3.62336C10.181 3.41879 11.0885 3.315 12.0012 3.315C12.9129 3.315 13.8196 3.4186 14.6854 3.62277C16.1619 2.69 17.2986 2.39649 18.1072 2.52651C18.1919 2.54013 18.2645 2.55783 18.3249 2.57766C18.6059 2.66991 18.8316 2.88179 18.9414 3.15636C19.4279 4.37256 19.4608 5.45344 19.2433 6.3472C19.9342 7.28337 20.3012 8.39208 20.3012 9.63971C20.3012 13.3968 18.627 15.3048 15.6588 16.032C15.7837 16.447 15.8496 16.9105 15.8496 17.4121C15.8496 18.0765 15.8471 18.711 15.8424 19.4225C15.8412 19.6127 15.8397 19.8159 15.8375 20.1281C16.2129 20.2109 16.5229 20.5077 16.6031 20.9089C16.7114 21.4504 16.3602 21.9773 15.8186 22.0856C14.6794 22.3134 13.8353 21.5538 13.8353 20.5611C13.8353 20.4708 13.836 20.3417 13.8375 20.1145C13.8398 19.8015 13.8412 19.599 13.8425 19.4094C13.8471 18.7019 13.8496 18.0716 13.8496 17.4121C13.8496 16.7148 13.6664 16.2602 13.4237 16.051C12.7627 15.4812 13.0977 14.3973 13.965 14.2999C16.9314 13.9666 18.3012 12.8177 18.3012 9.63971C18.3012 8.68508 17.9893 7.89571 17.3881 7.23559C17.1301 6.95233 17.0567 6.54659 17.199 6.19087C17.3647 5.77663 17.4354 5.23384 17.2941 4.57702L17.2847 4.57968C16.7928 4.71886 16.1744 5.0198 15.4261 5.5285C15.182 5.69438 14.8772 5.74401 14.5932 5.66413C13.7729 5.43343 12.8913 5.315 12.0012 5.315C11.111 5.315 10.2294 5.43343 9.40916 5.66413C9.12662 5.74359 8.82344 5.69492 8.57997 5.53101C7.8274 5.02439 7.2056 4.72379 6.71079 4.58376C6.56735 5.23696 6.63814 5.77782 6.80336 6.19087C6.94565 6.54659 6.87219 6.95233 6.61423 7.23559C6.01715 7.8912 5.70116 8.69376 5.70116 9.63971C5.70116 12.8116 7.07225 13.9683 10.023 14.2999C10.8883 14.3971 11.2246 15.4769 10.5675 16.0482C10.3751 16.2156 10.1384 16.7802 10.1384 17.4121V20.5611C10.1384 21.5474 9.30356 22.2869 8.17878 22.09C7.63476 21.9948 7.27093 21.4766 7.36613 20.9326C7.43827 20.5204 7.75331 20.2116 8.13841 20.1276V19.1381C7.22829 19.1994 6.47656 19.0498 5.88401 18.6533Z', label: 'GitHub' },
  ig: { vb: '0 0 448 512', d: 'M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z', label: 'Instagram' },
  fb: { vb: '0 0 320 512', d: 'M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z', label: 'Facebook' },
  in: { vb: '0 0 24 24', d: 'M6.94 5a2 2 0 1 1-4-.002 2 2 0 0 1 4 .002zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68z', label: 'LinkedIn' },
  x: { vb: '0 0 24 24', d: 'M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.2h1.7L7.4 4.72H5.58L16.67 19.2z', label: 'X' },
};
const SOCIAL_ORDER = ['gh', 'ig', 'fb', 'in', 'x'];
// the sample profiles have no accounts yet, so every link is a placeholder
const socialLinks = (name, focusable) => SOCIAL_ORDER.map((k) => `<a href="#" aria-label="${esc(name)} on ${SOCIAL[k].label}"${focusable ? '' : ' tabindex="-1"'}><svg viewBox="${SOCIAL[k].vb}" aria-hidden="true"><path d="${SOCIAL[k].d}"/></svg></a>`).join('');
// a laptop in its own colours: silver body, dark bezel, a lit blue screen
const LAPTOP = `<svg class="tc-laptop" viewBox="0 0 48 34" aria-hidden="true">
  <defs>
    <linearGradient id="lpBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF0F3"/><stop offset="1" stop-color="#A3A9B1"/></linearGradient>
    <linearGradient id="lpScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B9BF5"/><stop offset=".55" stop-color="#1F52B4"/><stop offset="1" stop-color="#0C2766"/></linearGradient>
  </defs>
  <rect x="7" y="2" width="34" height="23.5" rx="2.4" fill="#2A2D33"/>
  <rect x="9.2" y="4.2" width="29.6" height="19" rx=".9" fill="url(#lpScreen)"/>
  <path d="M9.2 4.2h12.5L12.6 23.2H9.2z" fill="#fff" opacity=".13"/>
  <circle cx="24" cy="3.1" r=".55" fill="#5C6068"/>
  <path d="M1.5 26.2h45l-2.4 4.9c-.4.8-1.1 1.2-2 1.2H5.9c-.9 0-1.6-.4-2-1.2z" fill="url(#lpBody)"/>
  <rect x="1.5" y="25.3" width="45" height="1.7" rx=".85" fill="#C7CCD3"/>
  <path d="M19.5 26.2h9l-.7 1.3h-7.6z" fill="#8A9099"/>
</svg>`;
// National ICT System Patrons: people who support ICT in Liberia. The first four are real (below);
// the rest are sample profiles (the owner asked for mock patrons), with AI-generated portraits in
// public/img/patrons of people who do not exist; the page says so.
// The first four are the patrons the owner has named, with what the Executive Mansion, the Ministry
// of Foreign Affairs and the press record, or (Director Burphy) what the owner gave: no social links,
// nothing that sources disagree on. The rest are sample profiles. Photographs: the President's from
// the Executive Mansion (the home slider); the others as the owner sent them.
const PATRONS = [
  { name: 'H.E. Joseph Nyuma Boakai, Sr.', img: 'joseph-boakai', role: 'President of the Republic of Liberia', real: true,
    bio: 'President of Liberia since 22 January 2024, and Vice President from 2006 to 2018. At the Liberia Technology Summit 2026 he set out investment in digital infrastructure, connectivity and cybersecurity.',
    edu: ['University of Liberia', 'Kansas State University, 1976'],
    exp: [['President of the Republic of Liberia', 'Government of Liberia', '2024 to now'], ['Vice President of Liberia', 'Government of Liberia', '2006 to 2018'], ['Minister of Agriculture', 'Government of Liberia', 'From 1983'], ['Managing Director', 'Liberia Produce Marketing Corporation', 'From 1980']] },
  { name: 'H.E. Jeremiah Kpan Koung', img: 'jeremiah-koung', role: 'Vice President of the Republic of Liberia', real: true,
    bio: 'Vice President of Liberia since 22 January 2024, and President of the Senate. Earlier a Senator and a Representative for Nimba County.',
    edu: ['BA Business Administration, Cuttington University'],
    exp: [['Vice President of Liberia', 'Government of Liberia', '2024 to now'], ['Senator, Nimba County', 'Senate of Liberia', '2021 to 2024'], ['Representative, Nimba County District 1', 'House of Representatives', 'From 2012']] },
  { name: 'Lahoucine Rahmouni', img: 'lahoucine-rahmouni', role: 'Chargé d’Affaires, Embassy of the Kingdom of Morocco in Liberia', real: true,
    bio: 'Leads the Embassy of the Kingdom of Morocco in Monrovia as Chargé d’Affaires.',
    edu: [],
    exp: [['Chargé d’Affaires', 'Embassy of the Kingdom of Morocco, Monrovia', 'Now']] },
  { name: 'Director Jarsea Burphy', img: 'jarsea-burphy', role: 'Communications Pioneer', real: true,
    bio: 'Director, and a pioneer in communications.',
    edu: [], exp: [] },
  { name: 'Dr. Fatumata Jalloh', img: 'fatumata-jalloh', role: 'Patron, Digital Health',
    bio: 'Advocates for digital patient records in county hospitals.',
    edu: ['MD, A.M. Dogliotti College of Medicine', 'MPH, University of Liberia'],
    exp: [['Patron, Digital Health', 'NIIS', '2026 to now'], ['Physician', 'County referral hospital', '2008 to now']] },
  { name: 'Thomas Gweh', img: 'thomas-gweh', role: 'Patron, Coding Clubs',
    bio: 'Sponsors after-school coding clubs in Montserrado and Bong.',
    edu: ['BSc Electrical Engineering, University of Liberia'],
    exp: [['Patron, Coding Clubs', 'NIIS', '2026 to now'], ['Chief executive', 'Engineering services company', '2005 to now']] },
  { name: 'Christiana Nimely', img: 'christiana-nimely', role: 'Patron, Women in Tech',
    bio: 'Mentors young women starting careers in ICT.',
    edu: ['BSc Computer Science, Cuttington University', 'Certificate in Entrepreneurship'],
    exp: [['Patron, Women in Tech', 'NIIS', '2026 to now'], ['Founder', 'Software studio, Monrovia', '2016 to now']] },
  { name: 'Joseph Gbeh', img: 'joseph-gbeh', role: 'Patron, Open Data',
    bio: 'Supports open public access to Liberia’s ICT statistics.',
    edu: ['MA Public Administration, University of Liberia'],
    exp: [['Patron, Open Data', 'NIIS', '2026 to now'], ['Civil servant', 'Public administration', '1985 to 2022']] },
];
// a medal in its own colours: gold, on a ribbon in the flag's red and blue
const MEDAL = `<svg class="tc-laptop" viewBox="0 0 40 40" aria-hidden="true">
  <defs><radialGradient id="mdGold" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFE9A3"/><stop offset=".55" stop-color="#E2AE2F"/><stop offset="1" stop-color="#A9761A"/></radialGradient></defs>
  <path d="M12 2h7l-2 14h-6z" fill="#C8102E"/><path d="M21 2h7l-3 14h-6z" fill="#1C4C9E"/>
  <circle cx="20" cy="26" r="11" fill="url(#mdGold)" stroke="#9A6A14" stroke-width="1"/>
  <circle cx="20" cy="26" r="7.4" fill="none" stroke="#FFF3C4" stroke-opacity=".7" stroke-width="1"/>
  <path d="M20 20.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#FFF6D6"/>
</svg>`;
exports.team = (ctx) => {
  const pad = (v) => String(v).padStart(2, '0');
  // two rows filled column by column, so the first eight are laid in reading order
  const interleave = (list) => {
    const first = list.slice(0, 8), top = first.slice(0, 4), low = first.slice(4);
    return top.flatMap((m, c) => (low[c] ? [m, low[c]] : [m])).concat(list.slice(8));
  };
  // a studio card: the portrait, the name and role; on hover the person and their links; a click opens the profile
  const card = (kind, list, folder) => (m) => {
    const i = list.indexOf(m), src = `/img/${folder}/${m.img}.jpg?v=${ASSET_V}`;
    return `<article class="tc-card" data-person="${kind}" data-i="${i}" style="--k:${Math.min(i, 7)};--o:${i}" tabindex="0" role="button" aria-label="${esc(m.name)}, ${esc(m.role)}. Open profile">
          <div class="tc-media"><img class="tc-photo" src="${src}" alt="" width="600" height="600" loading="lazy" decoding="async"></div>
          <div class="tc-info">
            <span class="tc-name">${esc(m.name)}</span>
            <span class="tc-role">${esc(m.role)}</span>
          </div>
          <div class="tc-bio">
            <div class="tc-bio-head">
              <img class="tc-avatar" src="${src}" alt="" width="600" height="600" loading="lazy" decoding="async">
              <span><b>${esc(m.name)}</b><em>${esc(m.role)}</em></span>
            </div>
            <p>${esc(m.bio)}</p>
            ${m.real ? '' : `<div class="tc-social">${socialLinks(m.name)}</div>`}
          </div>
        </article>`;
  };
  // a row of studio cards in a panel: the team, and the patrons
  const studio = ({ id, kind, list, folder, mark, words, title, note, label, extra = '', anchor = '' }) => `<section class="tc ${extra} wrap"${anchor ? ` id="${anchor}"` : ''} aria-labelledby="${id}-h">
      <div class="tc-panel">
        <div class="tc-head">
          <div>
            <p class="tc-eyebrow">${mark}${words.map((w) => `<b>${esc(w)}</b>`).join('')}</p>
            <h2 id="${id}-h" class="tc-title">${title}</h2>
          </div>
          <div class="tc-ctrl">
            <span class="tc-count" aria-hidden="true"><b data-row-at>${pad(Math.min(8, list.length))}</b> / ${pad(list.length)}</span>
            <button type="button" class="tc-arrow skip" data-row-step="-1" aria-label="Previous ${esc(label)}">${icon('chevrons', 'icn ui-flip')}</button>
            <button type="button" class="tc-arrow skip" data-row-step="1" aria-label="Next ${esc(label)}">${icon('chevrons')}</button>
          </div>
        </div>
        <div class="tc-track" data-row="${kind}" role="region" aria-label="${esc(label)}, ${list.length} in all" tabindex="-1">
          ${interleave(list).map(card(kind, list, folder)).join('')}
        </div>
        <div class="tc-foot">
          <div class="tc-progress" aria-hidden="true"><i></i></div>
          <p class="tc-note">${esc(note)}</p>
        </div>
      </div>
    </section>`;
  // the talent pool as a league table: three white columns of rows (number, photo, name, and the field's
  // mark beside the profession); a row opens the profile window
  const FIELD_MARK = { Software: ['code', '#1C5BB8'], 'Data & AI': ['chart', '#12A57E'], Cybersecurity: ['shield', '#C8102E'], Hardware: ['gauge', '#D9730D'],
    Networks: ['wifi', '#0B2C63'], Design: ['image', '#8E44AD'], Fintech: ['coin', '#1A5C38'], 'Digital media': ['camera', '#D6336C'] };
  const tRow = (t, i) => {
    const [ic, col] = FIELD_MARK[t.field] || ['sparkle', '#4A5160'];
    return `<li class="tl-item" data-i="${i}" data-field="${esc(t.field)}">
              <button type="button" class="tl-row" data-person="talent" data-i="${i}" style="--c:${col}" aria-label="${esc(t.name)}, ${esc(t.role)}, ${esc(t.county)}. Open profile">
                <span class="tl-n">${i + 1}</span>
                <span class="tl-ph"><img src="/img/talent/${t.img}.jpg?v=${ASSET_V}" alt="" width="600" height="800" loading="lazy" decoding="async"></span>
                <span class="tl-who"><span class="tl-name">${esc(t.name)}</span><span class="tl-role">${icon(ic)}<span>${esc(t.role)}</span></span></span>
                <span class="tl-go" aria-hidden="true">${icon('arrow')}</span>
              </button>
            </li>`;
  };
  const TL_COLS = 3;
  const tlCols = Array.from({ length: TL_COLS }, (_, c) => {
    const base = Math.floor(TALENTS.length / TL_COLS), extra = TALENTS.length % TL_COLS;
    const start = c * base + Math.min(c, extra), take = base + (c < extra ? 1 : 0);
    return TALENTS.slice(start, start + take).map((t, j) => tRow(t, start + j)).join('');
  });
  // what the profile window shows
  const people = {
    team: TEAM_MEMBERS.map((m) => ({ name: m.name, role: m.role, img: `/img/team/${m.img}.jpg?v=${ASSET_V}`, bio: m.bio, ...(PERSON_MORE[m.name] || {}) })),
    patron: PATRONS.map((m) => ({ name: m.name, role: m.role, real: !!m.real, img: `/img/patrons/${m.img}.jpg?v=${ASSET_V}`, bio: m.bio, edu: m.edu, exp: m.exp })),
    talent: TALENTS.map((t) => ({ name: t.name, role: t.role, img: `/img/talent/${t.img}.jpg?v=${ASSET_V}`, bio: t.note, county: t.county, field: t.field, skills: t.skills, ...(PERSON_MORE[t.name] || {}) })),
  };
  return shell(ctx, {
    title: 'Our Team', active: '/about/team', workspaceActive: 'about', body: `
  ${pageHeader('team', 'Our Team', 'The people who collect, check and publish Liberia’s ICT data.')}
  <div class="tm">
    ${studio({ id: 'pc', kind: 'patron', list: PATRONS, folder: 'patrons', mark: MEDAL, words: [], extra: 'is-patrons', anchor: 'patrons',
      title: 'National ICT System<br>Patrons', label: 'Patrons', note: 'The first four are the patrons named so far; the others are sample profiles with AI-generated placeholder photos.' })}

    ${studio({ id: 'tc', kind: 'team', list: TEAM_MEMBERS, folder: 'team', mark: LAPTOP, words: ['Who', 'we', 'are'],
      title: 'The people<br>behind NIIS.', label: 'Team members', note: 'Sample profiles with AI-generated placeholder photos, shown until appointments are confirmed.' })}

    <section class="tp wrap" id="talent" aria-labelledby="tp-h">
      <div class="tp-panel">
        <div class="tp-head">
          <div>
            <h2 id="tp-h" class="tp-title">National ICT <em>Talent Pool</em></h2>
            <p class="tp-lede">Young Liberians we have found building, designing and securing the country’s digital future.</p>
          </div>
        </div>
        <div class="tp-orbs" role="group" aria-label="Filter by field">
          ${[['', 'All', 'layers', TALENTS.length], ...[...new Set(TALENTS.map((t) => t.field))].map((f) => [f, f, (FIELD_MARK[f] || ['sparkle'])[0], TALENTS.filter((t) => t.field === f).length])]
            .map(([f, label, ic, n], k) => `<button type="button" class="tp-orb${k ? '' : ' is-on'}" data-tp-field="${esc(f)}" aria-pressed="${k ? 'false' : 'true'}"><span class="dock-ic"><i class="dock-water" aria-hidden="true"></i>${icon(ic)}</span><span class="tp-orb-l">${esc(label)} <b>${n}</b></span></button>`).join('')}
        </div>
        <div class="tl-cols" id="tlCols" role="region" aria-label="ICT talents">
          ${tlCols.map((rows) => `<ol class="tl-col">${rows}</ol>`).join('')}
        </div>
        <p class="tl-swipe" aria-hidden="true">Swipe for more ${icon('chevrons')}</p>
        <p class="tp-note-s tl-note">Sample profiles with AI-generated placeholder photos.</p>
      </div>
    </section>
  </div>
  <div class="pm-wrap" id="pmWrap" hidden>
    <div class="pm-scrim" data-pm-close></div>
    <div class="pm" id="pm" role="dialog" aria-modal="true" aria-labelledby="pm-name" tabindex="-1">
      <button type="button" class="pm-x" data-pm-close aria-label="Close">${icon('x')}</button>
      <div class="pm-in">
        <div class="pm-photo"><img alt="" width="600" height="600"></div>
        <div class="pm-body">
          <p class="pm-kind"></p>
          <h2 id="pm-name"></h2>
          <p class="pm-role"></p>
          <p class="pm-bio"></p>
          <div class="pm-sec"><h3>Education</h3><ul class="pm-edu"></ul></div>
          <div class="pm-sec"><h3>Experience</h3><ol class="pm-exp"></ol></div>
          <div class="pm-sec" data-pm-skills><h3>Skills</h3><ul class="pm-skills"></ul></div>
          <div class="pm-social"></div>
        </div>
      </div>
      <div class="pm-nav">
        <button type="button" class="skip" data-pm-step="-1" aria-label="Previous profile">${icon('chevrons', 'icn ui-flip')}</button>
        <span class="pm-count" aria-hidden="true"></span>
        <button type="button" class="skip" data-pm-step="1" aria-label="Next profile">${icon('chevrons')}</button>
      </div>
    </div>
  </div>
  <template id="pmSocial">${socialLinks('', true)}</template>
  <script>window.__NICTD_PAGE__='team';window.__PEOPLE__=${JSON.stringify(people).replace(/</g, '\\u003c')};</script>`,
  });
};

// ============ PROGRAMS (/careers/programs) ============
// What is coming up, as event tickets: a sample schedule (the owner asked for the page before the
// calendar exists) and the page says so. The trainings and bootcamps, the films and the photographs
// are off the page for now (the owner's call); their lists below are kept for when they return.
const PROGRAM_EVENTS = [
  { d: 22, m: 'Oct', y: 2026, kind: 'Webinar', title: 'NIIS Data Explorer walkthrough', place: 'Online', time: '10:00 GMT', img: '/img/about/analysts.jpg',
    body: 'A live tour of the Data Explorer, the Indicator Catalogue and the API, for researchers and journalists.' },
  { d: 5, m: 'Nov', y: 2026, kind: 'Training', title: 'Enumerator training, Bong County wave', place: 'Gbarnga', time: 'Five days', img: '/img/about/field-tall.jpg',
    body: 'Paid training on the tablet questionnaire for the Bong field team, before the county wave opens.' },
  { d: 18, m: 'Nov', y: 2026, kind: 'Workshop', title: 'Data journalism workshop', place: 'Monrovia', time: 'Two days', img: '/img/about/man-phone.jpg',
    body: 'Finding, checking and telling stories with Liberia’s ICT figures, with the people who collect them.' },
  { d: 3, m: 'Dec', y: 2026, kind: 'Bootcamp', title: 'Girls in ICT coding day', place: 'Kakata', time: '09:00 to 16:00', img: '/img/about/analyst-sq.jpg',
    body: 'A first day of coding for secondary-school girls, with mentors from the NIIS team and its patrons.' },
  { d: 14, m: 'Jan', y: 2027, kind: 'Forum', title: 'County data validation forum', place: 'Ganta', time: 'One day', img: '/img/about/colleagues.jpg',
    body: 'County officials review the first estimates for their counties before they are published.' },
  { d: 6, m: 'Mar', y: 2027, kind: 'Community', title: 'Open Data Day Monrovia', place: 'Monrovia', time: 'All day', img: '/img/programs/coding-class.jpg',
    body: 'Open talks and a hands-on hack session on Liberia’s public ICT data.' },
];
const PROGRAM_TRAININGS = [
  { title: 'Field enumerator training', kind: 'Training', len: 1, unit: 'week', where: 'In each county, before its wave', who: 'New field enumerators', status: 'Open', href: '/careers',
    body: 'Paid training on the tablet questionnaire, sampling and interview practice. No survey experience needed.' },
  { title: 'Field supervisor training', kind: 'Training', len: 1, unit: 'week', where: 'In each county, before its wave', who: 'Field supervisors', status: 'Open', href: '/careers',
    body: 'Leading an enumerator team: spot checks, back-checks and clearing the daily uploads.' },
  { title: 'Data quality bootcamp', kind: 'Bootcamp', len: 2, unit: 'weeks', where: 'Monrovia', who: 'Graduates in statistics or IT', status: 'Opening soon',
    body: 'Validation rules, cleaning and outlier review on real survey data, alongside the NIIS data team.' },
  { title: 'GIS and mapping bootcamp', kind: 'Bootcamp', len: 1, unit: 'week', where: 'Monrovia', who: 'Geography and IT students', status: 'Opening soon',
    body: 'Enumeration-area frames, geocoding and county maps with open tools.' },
  { title: 'Data journalism workshop', kind: 'Workshop', len: 2, unit: 'days', where: 'Monrovia', who: 'Reporters and editors', status: 'By invitation',
    body: 'Using the Data Explorer and the API to find and check stories.' },
  { title: 'Young coders bootcamp', kind: 'Bootcamp', len: 3, unit: 'weeks', where: 'Kakata and Gbarnga', who: 'School leavers', status: 'Opening soon',
    body: 'Web basics, data and a first app, in three weeks of evenings and Saturdays.' },
];
const PROGRAM_FILMS = [
  { src: '/media/about-hero-720.mp4', poster: '/media/about-hero-poster.jpg', title: 'Towers, field and classroom', body: 'The masts that carry the network, the field teams, and children learning on laptops.' },
  { src: '/media/careers-hero-720.mp4', poster: '/media/careers-hero-poster.jpg', title: 'The network at dusk', body: 'The masts that carry Liberia’s connections, as the city lights up.' },
  { src: '/media/mission.mp4', poster: '/media/mission-poster.jpg', title: 'Monrovia from above', body: 'The capital’s streets, where the first data waves begin.' },
  { src: '/media/research-hero.mp4', poster: '/media/research-hero-poster.jpg', title: 'Where research happens', body: 'A university campus from the air.' },
];
const PROGRAM_PHOTOS = [
  ['/img/about/field-tall.jpg', 'A field enumerator recording survey answers on a tablet in a village.'],
  ['/img/about/analysts.jpg', 'Analysts working at computers in an office.'],
  ['/img/about/field.jpg', 'Two survey workers walking a dirt road toward a village.'],
  ['/img/about/colleagues.jpg', 'Two young colleagues talking on the steps outside an office.'],
  ['/img/about/sovereignty.jpg', 'A corridor of server racks in a data centre.'],
  ['/img/about/man-phone.jpg', 'A man checking his phone on a busy Monrovia street.'],
  ['/img/about/wwd-junction.jpg', 'A Monrovia roundabout from the air.'],
  ['/img/about/analyst-sq.jpg', 'An analyst reviewing charts at her desk.'],
  ['/img/about/wwd-cruiser.jpg', 'A field vehicle being loaded for the road.'],
  ['/img/about/hero.jpg', 'A telecom mast against the evening sky.'],
];
// A real Code 39 barcode (it scans) for a ticket number, as SVG bars: across, or down the stub.
const CODE39 = {
  0: '000110100', 1: '100100001', 2: '001100001', 3: '101100000', 4: '000110001', 5: '100110000', 6: '001110000', 7: '000100101', 8: '100100100', 9: '001100100',
  A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
  K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
  U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000', Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
};
function code39(text, down) {
  const N = 2, W = 5;
  let at = 0, bars = '';
  for (const ch of `*${String(text).toUpperCase()}*`) {
    const p = CODE39[ch];
    if (!p) continue;
    for (let k = 0; k < 9; k++) {
      const w = p[k] === '1' ? W : N;
      if (k % 2 === 0) bars += down ? `<rect y="${at}" width="40" height="${w}"/>` : `<rect x="${at}" width="${w}" height="40"/>`;
      at += w;
    }
    at += N;
  }
  at -= N;
  return `<svg class="tk-bars ${down ? 'is-down' : 'is-across'}" viewBox="0 0 ${down ? 40 : at} ${down ? at : 40}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// An event as a ticket: the main part (photo, kind, title, date, venue and time) and a stub torn
// along a perforation (admit one, the day, the ticket number and its barcode). Three ticket styles
// take turns: paper, the blue-to-green pass and the navy pass with a red stub.
function eventTicket(e, i) {
  const dd = String(e.d).padStart(2, '0'), mm = String(MONTHS.indexOf(e.m) + 1).padStart(2, '0');
  const no = `${String(e.y).slice(2)}${mm}${dd}`;
  const style = ['paper', 'vip', 'pass'][i % 3];
  return `<li class="tk is-${style}">
          <div class="tk-main">
            <span class="tk-photo" style="background-image:url('${e.img}?v=${ASSET_V}')" aria-hidden="true"></span>
            <div class="tk-content">
              <p class="tk-top"><span class="tk-org">NIIS Programmes</span><span class="tk-kind">${esc(e.kind)}</span></p>
              <h3 class="tk-title">${esc(e.title)}</h3>
              <p class="tk-body">${esc(e.body)}</p>
              <dl class="tk-info">
                <div><dt>Date</dt><dd>${dd} ${esc(e.m)} ${e.y}</dd></div>
                <div><dt>Venue</dt><dd>${esc(e.place)}</dd></div>
                <div><dt>Time</dt><dd>${esc(e.time)}</dd></div>
              </dl>
            </div>
          </div>
          <div class="tk-stub" aria-hidden="true">
            <span class="tk-admit">Admit one</span>
            <span class="tk-day">${dd}</span>
            <span class="tk-mon">${esc(e.m)} ${e.y}</span>
            <span class="tk-no">No. ${no}</span>
            <span class="tk-code">${code39(no, true)}${code39(no, false)}</span>
          </div>
        </li>`;
}
exports.programs = (ctx) => {
  return publicLayout(ctx, {
    title: 'Programs', active: '/careers/programs', body: `
  ${pageHeader('programs', 'Programs', 'Trainings, workshops and open days coming up across the counties.')}
  <div class="pg">
    <section class="pg-sec wrap" aria-labelledby="pg-ev-h">
      <div class="pg-head is-center">
        <h2 id="pg-ev-h">Upcoming Events</h2>
        <p>Trainings, workshops and open days across the counties.</p>
      </div>
      <ol class="pg-tickets">
        ${PROGRAM_EVENTS.map(eventTicket).join('')}
      </ol>
      <p class="pg-note">Sample schedule: the events and their dates are placeholders until the programme calendar is confirmed.</p>
    </section>

  </div>
  <script>window.__NICTD_PAGE__='programs';</script>`,
  });
};

// ============ CAREERS ============
const CAREER_ROLES = [
  { title: 'Field Enumerator (CAPI)', unit: 'Data Collection', type: 'Contract', place: 'Nationwide', year: '2026',
    desc: 'Collect household and facility ICT data on tablets across assigned enumeration areas. Full training provided, no prior survey experience needed.' },
  { title: 'Field Supervisor', unit: 'Data Collection', type: 'Contract', place: 'County-based', year: '2026',
    desc: 'Lead an enumerator team, run spot checks and back-checks, and clear daily uploads from the field.' },
  { title: 'County Research Lead', unit: 'Research', type: 'Contract', place: '15 counties', year: '2026',
    desc: 'Own sampling, stakeholder liaison and data quality for one county, and conduct key-informant interviews.' },
  { title: 'Data Engineer', unit: 'Data Team', type: 'Full-time', place: 'Monrovia', year: '2026',
    desc: 'Build the collection-to-database pipeline, sync services and the publishing path into NIIS.' },
  { title: 'GIS / Mapping Analyst', unit: 'Data Team', type: 'Full-time', place: 'Monrovia', year: '2026',
    desc: 'Maintain enumeration-area frames, geocode incoming records and prepare county map layers.' },
];
const CAREER_TEAMS = ['Data Collection', 'Research', 'Data Team'];
const careerSlug = (r) => String(r.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
exports.CAREER_ROLES = CAREER_ROLES;
exports.careerSlug = careerSlug;
// Three.js comes from jsDelivr, as in niip-3d; careers.js draws the star only when it loads.
// Careers and About: their chrome star (three.js comes from the site-wide import map)
const CAREERS_HEAD = `<script type="module" src="/assets/careers.js?v=${ASSET_V}"></script>`;
const csBtn = (href, label, cls = '') => `<a class="cs-btn${cls ? ' ' + cls : ''}" href="${esc(href)}"><span>${esc(label)}</span><i aria-hidden="true">${icon('arrow')}</i></a>`;
// A line whose letters arrive in random order (careers.js); the parent heading carries the words.
const csDecode = (text, cls = '') => `<span class="cs-line${cls ? ' ' + cls : ''}" data-decode aria-hidden="true">${esc(text)}</span>`;

// ============ CAREERS PAGE ============
// The art the 3D seal is built from: a larger copy saved as public/img/brand/seal-large.webp (or .png) when
// there is one, otherwise the Image Library's seal (the footer's).
const sealArt = () => {
  const has = (f) => require('node:fs').existsSync(require('node:path').join(__dirname, 'public', 'img', 'brand', f));
  return has('seal-large.webp') ? '/img/brand/seal-large.webp' : has('seal-large.png') ? '/img/brand/seal-large.png' : imgs.url('brand', 'seal');
};
// The hero is a film of the work (public/media/careers-hero*.mp4: Monrovia from the air, then
// field interviews and the team), under a navy scrim. The chrome seal (careers.js, WebGL) stays
// out of the hero and first arrives with the roles, then travels the page as the sections pass
// from blue to black to ice. The roles are a scroll-pinned list: the role at the centre brightens
// and turns the seal to its own pose. Applying happens on each role's own page.
exports.careers = (ctx) => {
  const n = CAREER_ROLES.length;
  const monrovia = CAREER_ROLES.filter((r) => r.place === 'Monrovia').map((r) => r.title);
  const roles = CAREER_ROLES.map((r, i) => `<li class="cs-role${i === 0 ? ' is-on' : ''}" data-role="${i}">
          <div class="cs-role-l">
            <h3 class="cs-role-t" aria-label="${esc(r.title)}">${csDecode(r.title)}</h3>
            <p class="cs-role-m"><span>${esc(r.unit)}</span><span>${esc(r.type)}</span><span>${esc(r.place)}</span></p>
          </div>
          <div class="cs-role-r">
            <p>${esc(r.desc)}</p>
            ${csBtn('/careers/apply/' + careerSlug(r), 'Apply for this role', 'cs-btn-sm')}
          </div>
        </li>`).join('');
  const faq = [
    ['Do I need survey experience to become a Field Enumerator?', 'No. Full training is provided, and no prior survey experience is needed.'],
    ['Is the training paid?', 'Yes. Field roles begin with paid training before a county wave opens.'],
    ['When are field roles open?', 'Field roles are recruited county by county as each data-collection wave opens, so check back if nothing fits today.'],
    ['What happens after I apply?', 'Shortlisted applicants are contacted for a short interview, plus a practical exercise for data and platform roles.'],
    monrovia.length ? ['Where are the data roles based?', `${monrovia.join(' and ')} ${monrovia.length > 1 ? 'are full-time roles' : 'is a full-time role'} in Monrovia.`] : null,
    ['What do I need to apply?', 'Your CV as a PDF or Word file, up to 4 MB, and your county. A cover note is optional.'],
    ['Who handles applications?', 'The ICT Statistics & Policy Unit at the Ministry of Posts & Telecommunications.'],
  ].filter(Boolean);
  const steps = [
    ['search', 'Find a role', 'Read the open roles above and pick the one that fits your team, type and place.'],
    ['doc', 'Apply online', 'Open the role’s application page and send it with your CV and your county.'],
    ['chat', 'Screening', 'Shortlisted applicants are contacted for a short interview, plus a practical exercise for data and platform roles.'],
    ['book', 'Training', 'Field roles begin with paid training before a county wave opens.'],
  ];
  return shell(ctx, {
    title: 'Careers', active: '/careers', workspaceActive: 'careers', extraHead: CAREERS_HEAD, body: `
  <div class="cs" id="csPage">
    <canvas class="cs-star" id="csStar" aria-hidden="true" data-seal="${esc(sealArt())}"></canvas>

    <section class="cs-hero cs-hero--film" data-star="film" aria-labelledby="csTitle">
      <video class="cs-film" autoplay muted loop playsinline preload="auto" poster="/media/careers-hero-poster.jpg" aria-hidden="true">
        <source src="/media/careers-hero-720.mp4" type="video/mp4" media="(max-width: 760px)">
        <source src="/media/careers-hero.mp4" type="video/mp4">
      </video>
      <div class="cs-film-scrim" aria-hidden="true"></div>
      <div class="cs-wrap cs-hero-in">
        <h1 id="csTitle" class="cs-h1" aria-label="Careers at NIIS. Built and run by Liberians.">${csDecode('Careers at NIIS.')}${csDecode('Built and run by Liberians.', 'cs-dim')}</h1>
        <div class="cs-ctas">
          ${csBtn('#csRoles', 'See open roles')}
          <a class="cs-btn cs-btn-dark" href="#csJoin"><span>How to join</span></a>
        </div>
        <p class="cs-hero-sub">${n} open roles across field collection, research and the data team, with paid training for field roles.</p>
      </div>
    </section>

    <section class="cs-mission" data-star="mission" aria-labelledby="csMissionTitle">
      <div class="cs-wrap">
        <span class="cs-mark" aria-hidden="true"></span>
        <h2 id="csMissionTitle" class="cs-h2" aria-label="Every phase staffed and skilled locally">${csDecode('Every phase staffed and skilled locally')}</h2>
        <figure class="cs-people">
          <img src="${esc(imgs.url('headers', 'careers'))}" alt="A group of young professionals celebrating together" loading="lazy" decoding="async">
        </figure>
        <dl class="cs-rows">
          <div class="cs-row"><dt><span class="cs-tag">The mission</span></dt><dd data-fill>Creating jobs and opportunities for young Liberians is part of what this programme is for.</dd></div>
          <div class="cs-row"><dt><span class="cs-tag">The work</span></dt><dd data-fill>The National ICT Intelligence System is built and run by Liberians. Every phase, from field collection to data engineering and the platform itself, is staffed and skilled locally.</dd></div>
          <div class="cs-row"><dt><span class="cs-tag">The path</span></dt><dd data-fill>Training is provided for field roles, and the experience carries forward into ICT research, statistics and data careers well beyond this programme.</dd></div>
        </dl>
      </div>
    </section>

    <section class="cs-roles" id="csRoles" data-star="roles" aria-labelledby="csRolesTitle">
      <div class="cs-wrap">
        <header class="cs-roles-head">
          <h2 id="csRolesTitle" class="cs-h2">Open roles</h2>
          <p class="cs-count">${n}<span class="sr-only"> roles open</span></p>
        </header>
        <ol class="cs-list">${roles}</ol>
      </div>
    </section>

    <section class="cs-dark" data-star="dark" aria-labelledby="csDarkTitle">
      <div class="cs-wrap cs-dark-in">
        <span class="cs-frame" aria-hidden="true"></span>
        <h2 id="csDarkTitle" class="cs-h2 cs-h2-lg" aria-label="Recruited county by county, as each data-collection wave opens.">${csDecode('Recruited county by county,')}${csDecode('as each data-collection wave opens.', 'cs-dim')}</h2>
        <div class="cs-ctas">${csBtn('/about', 'Contact the Unit')}</div>
      </div>
    </section>

    <section class="cs-join" id="csJoin" data-star="join" aria-labelledby="csJoinTitle">
      <div class="cs-wrap">
        <span class="cs-mark" aria-hidden="true"></span>
        <h2 id="csJoinTitle" class="cs-h2" aria-label="How joining works">${csDecode('How joining works')}</h2>
        <ol class="cs-steps">${steps.map(([ic, t, d]) => `<li><span class="cs-step-ic" aria-hidden="true">${icon(ic)}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ol>
      </div>
    </section>

    <section class="cs-faq" data-star="faq" aria-labelledby="csFaqTitle">
      <div class="cs-wrap cs-faq-in">
        <div class="cs-faq-head">
          <span class="cs-mark" aria-hidden="true"></span>
          <h2 id="csFaqTitle" class="cs-h2 cs-h2-xl">FAQ</h2>
          <p class="cs-faq-more"><span>Got more questions?</span> ${csBtn('/about', 'Contact the Unit', 'cs-btn-light')}</p>
        </div>
        <div class="cs-faq-list">${faq.map(([q, a], i) => `<details class="cs-q"><summary><span class="cs-q-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="cs-q-t">${esc(q)}</span><span class="cs-q-x" aria-hidden="true"></span></summary><div class="cs-q-a"><p>${esc(a)}</p></div></details>`).join('')}</div>
      </div>
    </section>

    <section class="cs-outro" data-star="outro" aria-hidden="true"><div class="cs-word">NIIS</div></section>
  </div>`,
  });
};

// ============ APPLICATION SENT ============
// The end of the process: a drawn check, a burst of the page's blue squares, the headline, and
// the reference the applicant keeps. The reference carries the date it was sent (NIIS-YYMMDD-XXXX).
function careerSent(ctx, role, reference) {
  const m = /^(?:NIIS|NICTD)-(\d{2})(\d{2})(\d{2})-/.exec(reference || '');
  const sentOn = m ? `${+m[3]} ${UPD_MONTHS[+m[2] - 1]} 20${m[1]}` : '';
  const field = role.unit === 'Data Collection';
  const burst = Array.from({ length: 14 }, (_, i) => `<i style="--a:${Math.round(i * (360 / 14) + (i % 2) * 9)}deg;--d:${i % 3 === 0 ? 7.4 : i % 3 === 1 ? 5.6 : 6.4}rem;--s:${i % 2 ? 5 : 7}px;--t:${(i % 4) * 40}ms"></i>`).join('');
  return shell(ctx, {
    title: 'Application sent: ' + role.title, active: '/careers', workspaceActive: 'careers', extraHead: CAREERS_HEAD, body: `
  <div class="cs cs-ap cs-sent" id="csApply">
    <section class="cs-ok" aria-labelledby="csOkTitle">
      <div class="cs-wrap cs-ok-in">
        <div class="cs-ok-mark" aria-hidden="true">
          <span class="cs-ok-burst">${burst}</span>
          <svg viewBox="0 0 48 48" class="cs-ok-check"><polyline points="13 25 21 33 36 16"/></svg>
        </div>
        <h1 id="csOkTitle" class="cs-h1 cs-ok-h" aria-label="Congratulations! Application sent.">${csDecode('Congratulations!')}${csDecode('Application sent.', 'cs-dim')}</h1>
        <p class="cs-ok-sub" role="status">Your application for <strong>${esc(role.title)}</strong> is with the ICT Statistics &amp; Policy Unit.</p>
        <dl class="cs-ap-meta cs-ok-meta">
          ${reference ? `<div><dt>Your reference</dt><dd class="cs-ok-ref">${esc(reference)}</dd></div>` : ''}
          <div><dt>Role</dt><dd>${esc(role.title)}</dd></div>
          <div><dt>Team</dt><dd>${esc(role.unit)}</dd></div>
          ${sentOn ? `<div><dt>Sent</dt><dd>${esc(sentOn)}</dd></div>` : ''}
        </dl>
        ${reference ? '<p class="cs-ok-keep">Keep this reference. Quote it if you contact the Unit about your application.</p>' : ''}
      </div>
    </section>
    <section class="cs-ap-body cs-ok-body" aria-labelledby="csNextTitle">
      <div class="cs-wrap">
        <span class="cs-mark" aria-hidden="true"></span>
        <h2 id="csNextTitle" class="cs-h2">What happens next</h2>
        <ol class="cs-ok-steps">
          <li><span aria-hidden="true">${icon('check')}</span><div><h3>Application sent</h3><p>Your details and CV have reached the Unit.</p></div></li>
          <li><span aria-hidden="true">${icon('chat')}</span><div><h3>Screening</h3><p>Shortlisted applicants are contacted for a short interview${role.unit === 'Data Team' ? ', plus a practical exercise' : ''}.</p></div></li>
          ${field ? `<li><span aria-hidden="true">${icon('book')}</span><div><h3>Training</h3><p>Field roles begin with paid training before a county wave opens.</p></div></li>` : ''}
        </ol>
        <div class="cs-ctas">
          ${csBtn('/careers#csRoles', 'See other roles', 'cs-btn-ink')}
          <a class="cs-btn cs-btn-light" href="/"><span>Back to home</span></a>
        </div>
      </div>
    </section>
  </div>`,
  });
}

// ============ APPLY FOR A ROLE (/careers/apply/<role>) ============
// The role's own application page: the role on the left, kept in view; the application on the
// right, in three short parts. A returned form keeps what was typed (except the file).
exports.careerApply = (ctx, { role, counties = [], errors = [], values = {}, failed = false, sent = false, notice = '', reference = '' }) => {
  if (sent) return careerSent(ctx, role, reference);
  const errOf = (f) => errors.find((e) => e.field === f);
  const errText = (f) => (errOf(f) ? `<p class="cs-err" id="cs-err-${f}">${esc(errOf(f).message)}</p>` : '');
  const invalid = (f) => (errOf(f) ? ` aria-invalid="true" aria-describedby="cs-err-${f}"` : '');
  const val = (k) => esc(values[k] || '');
  const others = CAREER_ROLES.filter((r) => r !== role);
  const field = role.unit === 'Data Collection';
  const panel = `
        ${notice ? `<p class="cs-alert" role="alert">${esc(notice)}</p>` : ''}
        ${failed ? `<p class="cs-alert" role="alert">We could not receive applications online just now, so nothing was sent. Please try again later, or <a href="/about">contact the Unit</a>.</p>` : ''}
        ${errors.length ? `<p class="cs-alert" role="alert">Please check the highlighted fields.${values.cv_lost ? ' Choose your CV again: a file is never kept when the form comes back.' : ''}</p>` : ''}
        <form class="cs-form" id="csForm" method="post" action="/careers/apply" enctype="multipart/form-data" novalidate>
          <input type="hidden" name="role" value="${esc(role.title)}">
          <fieldset class="cs-part">
            <legend>About you</legend>
            <div class="cs-two">
              <label class="cs-field"><span class="cs-label">Full name</span>
                <input name="full_name" autocomplete="name" maxlength="120" required value="${val('full_name')}"${invalid('full_name')}>${errText('full_name')}</label>
              <label class="cs-field"><span class="cs-label">Email</span>
                <input name="email" type="email" autocomplete="email" maxlength="180" required value="${val('email')}"${invalid('email')}>${errText('email')}</label>
            </div>
            <div class="cs-two">
              <label class="cs-field"><span class="cs-label">Phone <em>optional</em></span>
                <input name="phone" type="tel" autocomplete="tel" maxlength="40" value="${val('phone')}"${invalid('phone')}>${errText('phone')}</label>
              <label class="cs-field"><span class="cs-label">County</span>
                <select name="county" required${invalid('county')}><option value="">Choose your county</option>${counties.map((c) => `<option${values.county === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>${errText('county')}</label>
            </div>
          </fieldset>
          <fieldset class="cs-part">
            <legend>Your CV</legend>
            <label class="cs-drop${errOf('cv') ? ' is-invalid' : ''}" data-drop>
              <input class="sr-only" type="file" name="cv" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"${invalid('cv')}>
              <span class="cs-drop-ic" aria-hidden="true">${icon('upload')}</span>
              <span class="cs-drop-t"><strong data-file-name>Drop your CV here, or choose a file</strong><span data-file-meta>PDF or Word, up to 4 MB</span></span>
            </label>
            <button type="button" class="cs-drop-clear" data-file-clear hidden>Remove file</button>
            ${errText('cv')}
          </fieldset>
          <fieldset class="cs-part">
            <legend>A note <em>optional</em></legend>
            <label class="cs-field"><span class="sr-only">Cover note</span>
              <textarea name="cover_note" rows="4" maxlength="2000" data-count${invalid('cover_note')}>${val('cover_note')}</textarea>
              <span class="cs-hint"><span data-count-out>${(values.cover_note || '').length}</span> of 2000 characters</span>${errText('cover_note')}</label>
            <label class="cs-consent"><input type="checkbox" name="consent" value="yes" required${values.consent ? ' checked' : ''}${invalid('consent')}>
              <span>NIIS may keep my application and CV to assess me for this role.</span></label>${errText('consent')}
          </fieldset>
          <div class="cs-hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>
          <button type="submit" class="cs-btn cs-btn-submit"><span data-submit-label>Send application</span><i aria-hidden="true">${icon('arrow')}</i></button>
        </form>`;
  return shell(ctx, {
    title: 'Apply: ' + role.title, active: '/careers', workspaceActive: 'careers', extraHead: CAREERS_HEAD, body: `
  <div class="cs cs-ap" id="csApply">
    <section class="cs-ap-hero" aria-labelledby="csApTitle">
      <div class="cs-wrap">
        <a class="cs-back" href="/careers#csRoles">${icon('arrow')}<span>All open roles</span></a>
        <h1 id="csApTitle" class="cs-h1 cs-h1-ap" aria-label="${esc(role.title)}">${csDecode(role.title)}</h1>
        <dl class="cs-ap-meta">
          <div><dt>Team</dt><dd>${esc(role.unit)}</dd></div>
          <div><dt>Type</dt><dd>${esc(role.type)}</dd></div>
          <div><dt>Place</dt><dd>${esc(role.place)}</dd></div>
        </dl>
      </div>
    </section>
    <section class="cs-ap-body">
      <div class="cs-wrap cs-ap-grid">
        <aside class="cs-ap-role" aria-label="About this role">
          <h2>The role</h2>
          <p>${esc(role.desc)}</p>
          <h2>What happens next</h2>
          <ol class="cs-ap-next">
            <li><strong>Screening.</strong> Shortlisted applicants are contacted for a short interview${role.unit === 'Data Team' ? ', plus a practical exercise' : ''}.</li>
            ${field ? '<li><strong>Training.</strong> Field roles begin with paid training before a county wave opens.</li>' : ''}
          </ol>
          ${field ? '<p class="cs-ap-note">Field roles are recruited county by county as each data-collection wave opens.</p>' : ''}
          ${others.length ? `<p class="cs-ap-other">Not quite right? <a href="/careers#csRoles">See the ${others.length} other open roles</a>.</p>` : ''}
        </aside>
        <div class="cs-ap-panel" id="apply">${panel}
        </div>
      </div>
    </section>
  </div>`,
  });
};

// ============ AUTH ============
// Log in: the President's photo, the national seal and one line on a navy panel (its grid cells
// light up one by one) that runs into the footer; the form, centred, on the right.
// Logic: app.js, initLogin.
exports.login = (ctx, { error }) => publicLayout(ctx, {
  title: 'Log In', body: `
  <section class="lg">
    <div class="lg-brand">
      <div class="lg-cells" aria-hidden="true">${'<i></i>'.repeat(96)}</div>
      <div class="lg-brand-in">
        <a class="lg-seal" href="/">
          ${imgs.exists('brand', 'seal') ? `<img src="${esc(imgs.url('brand', 'seal'))}" alt="" width="54" height="58" decoding="async">` : sealLogo(54)}
          <span><strong>NIIS</strong><span>National ICT Intelligence System</span></span>
        </a>
        <h2>A secured system for Liberia’s ICT Data</h2>
      </div>
    </div>
    <div class="lg-side">
      <div class="lg-card">
        <h1>Welcome back</h1>
        <p class="lg-sub">Use the email your account was created with.</p>
        <div class="lg-alert" role="alert"${error ? '' : ' hidden'}>${icon('info')}<span>${esc(error || '')}</span></div>
        <form method="post" action="/login" class="lg-form" novalidate>
          <div class="lg-field">
            <label for="lg-email">Email</label>
            <input id="lg-email" name="email" type="email" autocomplete="username" required autofocus placeholder="name@organisation.org">
            <p class="lg-err" data-for="lg-email" hidden>Enter the email for your account.</p>
          </div>
          <div class="lg-field">
            <label for="lg-pass">Password</label>
            <div class="lg-pass">
              <input id="lg-pass" name="password" type="password" autocomplete="current-password" required>
              <button type="button" class="lg-eye" aria-label="Show password" aria-pressed="false">${icon('eye', 'icn lg-eye-on')}${icon('eyeoff', 'icn lg-eye-off')}</button>
            </div>
            <p class="lg-err" data-for="lg-pass" hidden>Enter your password.</p>
          </div>
          <button class="lg-submit pearl" type="submit"><span class="pearl-wrap"><span class="pearl-p"><span class="lg-submit-t">Log in</span><span class="lg-spin" aria-hidden="true"></span></span></span></button>
        </form>
        <p class="lg-alt">No account yet? <a href="/register">Request access</a></p>
      </div>
    </div>
  </section>
  <script>window.__NICTD_PAGE__='login';</script>`,
});
// Request Access: Log In's two halves. The national seal and one line on the navy panel (the
// President's photograph, its grid cells lighting one by one), the request form centred on white.
exports.register = (ctx, { error, success, form = {} }) => publicLayout(ctx, {
  title: 'Request Access', body: `
  <section class="lg rg-lg">
    <div class="lg-brand">
      <div class="lg-cells" aria-hidden="true">${'<i></i>'.repeat(96)}</div>
      <div class="lg-brand-in">
        <a class="lg-seal" href="/">
          ${imgs.exists('brand', 'seal') ? `<img src="${esc(imgs.url('brand', 'seal'))}" alt="" width="54" height="58" decoding="async">` : sealLogo(54)}
          <span><strong>NIIS</strong><span>National ICT Intelligence System</span></span>
        </a>
        <h2>Request access to Liberia’s ICT Data</h2>
      </div>
    </div>
    <div class="lg-side">
      <div class="lg-card rg-card">
        <h1>Request Access</h1>
        <p class="lg-sub">Your request goes to the administration team, who review it and create your account. They send your login details to you directly.</p>
        ${error ? `<div class="lg-alert" role="alert">${icon('info')}<span>${esc(error)}</span></div>` : ''}
        ${success ? `<div class="rg-done" role="status">${icon('check')}<p>${esc(success)}</p></div>
        <a class="lg-submit pearl rg-home" href="/"><span class="pearl-wrap"><span class="pearl-p">Back to Home</span></span></a>` : `
        <form method="post" action="/register" class="lg-form rg-form">
          <div class="lg-field"><label for="rg-name">Full name</label><input id="rg-name" name="name" required maxlength="120" autocomplete="name" value="${esc(form.name || '')}"></div>
          <div class="lg-field"><label for="rg-email">Email</label><input id="rg-email" name="email" type="email" required maxlength="160" autocomplete="email" placeholder="name@organisation.org" value="${esc(form.email || '')}"></div>
          <div class="lg-field"><label for="rg-org">Organization</label><input id="rg-org" name="organization" required maxlength="160" autocomplete="organization" placeholder="University, newsroom, ministry, NGO…" value="${esc(form.organization || '')}"></div>
          <div class="lg-field"><label for="rg-phone">Phone (optional)</label><input id="rg-phone" name="phone" maxlength="40" autocomplete="tel" placeholder="+231 …" value="${esc(form.phone || '')}"></div>
          <div class="lg-field"><label for="rg-level">Access level</label>
            <select id="rg-level" name="role_requested">
              <option value="public" ${form.role_requested !== 'stakeholder' ? 'selected' : ''}>Public user, researcher, journalist, citizen</option>
              <option value="stakeholder" ${form.role_requested === 'stakeholder' ? 'selected' : ''}>Stakeholder, government, donor, institutional partner</option>
            </select></div>
          <div class="lg-field"><label for="rg-why">What data do you need? (optional)</label><textarea id="rg-why" name="purpose" rows="3" maxlength="1000" placeholder="e.g. county-level connectivity series for a reporting project…">${esc(form.purpose || '')}</textarea></div>
          <button class="lg-submit pearl" type="submit"><span class="pearl-wrap"><span class="pearl-p"><span class="lg-submit-t">Submit request</span></span></span></button>
        </form>
        <p class="lg-alt">Already have an account? <a href="/login">Log in</a></p>`}
      </div>
    </div>
  </section>`,
});

// ============ WORKSPACE (signed-in) ============
exports.portal = (ctx, stats) => {
  const u = ctx.user; const has = (p) => ctx.perms.includes(p);
  const cards = [
    ['/data', 'database', 'Data Explorer', 'Map, trend and county table for every indicator you are authorized to see.', true],
    ['/dashboards', 'gauge', 'Dashboards', 'Six curated topic dashboards with live sync status.', true],
    ['/media', 'image', 'Media Library', 'Images, research papers and embedded video from the project.', true],
    ['/analytics', 'chart', 'Platform Analytics', 'Usage and trend analysis across the stored data.', has('analytics')],
    ['/messages', 'chat', 'Messages', 'Your direct line to the ICT Statistics & Policy Unit.', has('messaging')],
    ['/admin', 'shield', 'Admin Panel', 'Users, quality review queue, content and platform settings.', has('manage_users')],
    ['/admin/inbox', 'inbox', 'Team Inbox', 'All user conversations, shared across the admin team.', has('admin_inbox')],
  ];
  const stat = (label, val, accent) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value" ${accent ? 'style="color:var(--clay)"' : ''}>${val}</div></div>`;
  return appLayout(ctx, {
    title: 'Overview', active: 'portal', body: `
    <p class="kicker">Workspace</p>
    <h1>Welcome back, ${esc(u.name.split(' ')[0])}</h1>
    <p class="lede-sm">Here is the current state of NIIS.</p>
    <div class="kpi-grid">
      ${stat('Data points published', fmt(stats.dataPoints))}
      ${stat('Indicators tracked', fmt(stats.indicators))}
      ${stat('Counties covered', '15')}
      ${stat('Series updated', `<span style="font-size:1.1rem">${esc(String(stats.lastUpdated).slice(0, 10))}</span>`)}
      ${stats.pendingRequests != null ? stat('Pending access requests', fmt(stats.pendingRequests), stats.pendingRequests > 0) : ''}
      ${stats.pendingSubs != null ? stat('Submissions in review queue', fmt(stats.pendingSubs), stats.pendingSubs > 0) : ''}
      ${stats.unread ? stat('Unread messages', fmt(stats.unread), true) : ''}
    </div>
    <h2>Your workspace</h2>
    <div class="card-grid">
      ${cards.filter((c) => c[4]).map(([href, icn, t, d]) => `<a class="portal-card" href="${href}"><h3>${icon(icn)} ${esc(t)}</h3><p>${esc(d)}</p></a>`).join('')}
    </div>`,
  });
};

exports.media = (ctx, items) => {
  const section = (kind, title, note) => {
    const list = items.filter((m) => m.kind === kind);
    if (!list.length) return '';
    return `<h2>${title} <span class="muted" style="font-size:.75em;font-weight:400">${note}</span></h2>
    <div class="card-grid">${list.map((m) => `<div class="media-card">
      ${kind === 'image' ? `<div class="media-thumb"><img src="${esc(m.file_path)}" alt="${esc(m.title)}"></div>` : ''}
      ${kind === 'video' ? (m.file_path && m.file_path.endsWith('.mp4')
        ? `<div class="media-thumb video"><video src="${esc(m.file_path)}" controls preload="metadata" playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video></div>`
        : (m.video_embed_id && m.video_embed_id !== 'CONFIGURE_EMBED_ID'
          ? `<div class="media-thumb video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(m.video_embed_id)}" title="${esc(m.title)}" allowfullscreen loading="lazy"></iframe></div>`
          : `<div class="media-thumb video-placeholder"><div>${nodeMark(28)}<p>Hosted on ${esc(m.video_provider || 'external service')}</p><p class="mono muted">Embed ID pending admin configuration</p></div></div>`)) : ''}
      <h3>${esc(m.title)}</h3><p>${esc(m.description || '')}</p>
      <div class="media-meta"><span class="tag">${esc(m.access_level)}</span>
      ${m.video_provider === 'NICTD AI (Seedance)' ? '<span class="tag" style="background:#1C5BB8;color:#fff">AI-generated</span>' : ''}
      ${m.file_path && !m.file_path.endsWith('.mp4') ? `<a href="${esc(m.file_path)}">${kind === 'paper' ? 'Download' : 'Open'}</a>` : ''}</div>
    </div>`).join('')}</div>`;
  };
  return appLayout(ctx, {
    title: 'Media Library', active: 'media', body: `
    <p class="kicker">Media library</p>
    <h1>Media library</h1>
    <p class="lede-sm">Images and research papers are stored on the platform. Video is hosted through a dedicated video service and embedded here, not stored in the primary database, for cost and performance.</p>
    ${section('image', 'Images', 'stored on-platform')}
    ${section('paper', 'Research papers', 'stored on-platform')}
    ${section('video', 'Video', 'externally hosted, embedded')}`,
  });
};

exports.analytics = (ctx, { daily, byKind, topPaths, growth, gaps }) => appLayout(ctx, {
  title: 'Platform Analytics', active: 'analytics', body: `
  <p class="kicker">Analytics, administrators &amp; stakeholders</p>
  <h1>Usage &amp; trend analytics</h1>
  <div class="kpi-grid">
    ${byKind.map((k) => `<div class="kpi"><div class="kpi-label">${esc(k.kind.replace('_', ' '))}s · 30 days</div><div class="kpi-value">${fmt(k.n)}</div></div>`).join('')}
  </div>
  <div class="two-col">
    <div class="chart-card"><h3>Platform activity · last 60 days</h3><div id="analytics-daily" class="chart-dh"></div></div>
    <div class="chart-card"><h3>Most viewed pages · 30 days</h3><div id="analytics-paths" class="chart-dh"></div></div>
  </div>
  <div class="two-col" style="margin-top:1.1rem">
    <div class="panel"><h3>Fastest-growing counties, internet penetration (pp, 2018→2025)</h3>
      <table class="data-table"><thead><tr><th>County</th><th class="num">2018</th><th class="num">2025</th><th class="num">Growth</th></tr></thead>
      <tbody>${growth.slice(0, 8).map((g) => `<tr><td>${esc(g.county)}</td><td class="num mono">${fmt(g.v2018)}</td><td class="num mono">${fmt(g.v2025)}</td><td class="num mono up">▲ ${fmt(g.growth_pp)}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="panel"><h3>Widest urban-rural gaps · 2025 (pp)</h3>
      <table class="data-table"><thead><tr><th>County</th><th class="num">Urban</th><th class="num">Rural</th><th class="num">Gap</th></tr></thead>
      <tbody>${gaps.slice(0, 8).map((g) => `<tr><td>${esc(g.county)}</td><td class="num mono">${fmt(g.urban)}</td><td class="num mono">${fmt(g.rural)}</td><td class="num mono down">${fmt(g.gap)}</td></tr>`).join('')}</tbody></table>
    </div>
  </div>
  <script>window.__NICTD_PAGE__='analytics-legacy';window.__ANALYTICS__=${JSON.stringify({ daily, topPaths })};</script>`,
});

function messageThread(msgs) {
  if (!msgs.length) return '<p class="muted">No messages yet. Start the conversation below.</p>';
  return `<div class="thread">${msgs.map((m) => `
    <div class="msg ${m.from_admin_team ? 'msg-admin' : 'msg-user'}">
      <div class="msg-head mono">${m.from_admin_team ? 'ICT Statistics & Policy Unit' : esc(m.sender_name)} · ${esc(fmtTs(m.created_at))}</div>
      <div class="msg-body">${esc(m.body)}</div>
    </div>`).join('')}</div>`;
}
exports.messages = (ctx, { conv, msgs }) => appLayout(ctx, {
  title: 'Messages', active: 'messages', body: `
  <p class="kicker">Messaging</p>
  <h1>Message box</h1>
  <p class="lede-sm">A direct line between your account and the ICT Statistics &amp; Policy Unit, no outside email needed. Messages are answered from a shared team inbox (checked regularly, not real-time chat).</p>
  ${conv && conv.subject ? `<p class="mono muted">Subject: ${esc(conv.subject)}</p>` : ''}
  ${messageThread(msgs)}
  <form method="post" action="/messages" class="msg-form">
    ${!conv ? '<label>Subject<input name="subject" maxlength="120" placeholder="What is this about?"></label>' : ''}
    <label>Message<textarea name="body" rows="4" required maxlength="4000" placeholder="Write to the team…"></textarea></label>
    <button class="btn btn-teal" type="submit" style="margin-top:.8rem">Send</button>
  </form>`,
});
exports.adminInbox = (ctx, convs) => appLayout(ctx, {
  title: 'Team Inbox', active: 'inbox', body: `
  <p class="kicker">Administration · shared team inbox</p>
  <h1>Team inbox</h1>
  <p class="lede-sm">Every conversation is visible to the whole administration team for accountability and continuity.</p>
  ${convs.length ? `<table class="data-table"><thead><tr><th>User</th><th>Role</th><th>Subject</th><th>Updated</th><th></th></tr></thead>
  <tbody>${convs.map((c) => `<tr class="${c.unread ? 'unread' : ''}">
    <td>${esc(c.user_name)}<br><span class="mono muted">${esc(c.email)}</span></td>
    <td><span class="tag">${esc(c.role)}</span></td>
    <td>${esc(c.subject || ', ')} ${c.unread ? `<span class="badge">${c.unread} new</span>` : ''}</td>
    <td class="mono muted">${esc(fmtTs(c.updated_at))}</td>
    <td><a href="/admin/inbox/${c.id}">Open →</a></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No conversations yet.</p>'}`,
});
exports.adminConversation = (ctx, { conv, msgs }) => appLayout(ctx, {
  title: `Conversation, ${conv.user_name}`, active: 'inbox', body: `
  <p class="kicker"><a href="/admin/inbox">← Team inbox</a></p>
  <h1>${esc(conv.user_name)} <span class="mono muted" style="font-size:.5em">${esc(conv.email)}</span></h1>
  ${conv.subject ? `<p class="mono muted">Subject: ${esc(conv.subject)}</p>` : ''}
  ${messageThread(msgs)}
  <form method="post" action="/admin/inbox/${conv.id}" class="msg-form">
    <label>Reply as ICT Statistics &amp; Policy Unit<textarea name="body" rows="4" required maxlength="4000"></textarea></label>
    <button class="btn btn-teal" type="submit" style="margin-top:.8rem">Send reply</button>
  </form>`,
});

exports.admin = (ctx, { users, pending, reviewed, indicators, counties, settings, rolePerms, unreadInbox, accessRequests = [], papersList = [], updatesList = [], mediaList = [], siteContent = {}, notice = '', generations = [], seedanceReady = false }) => {
  const permHas = (role, perm) => rolePerms.some((r) => r.role === role && r.permission === perm);
  const editablePerms = ['view_registered_data', 'view_stakeholder_data', 'analytics', 'messaging', 'download_open_data'];
  return appLayout(ctx, {
    title: 'Admin Panel', active: 'admin', body: `
  <p class="kicker">Administration</p>
  <h1>Platform administration</h1>
  <p class="lede-sm"><a href="/admin/inbox">Team inbox${unreadInbox ? ` <span class="badge">${unreadInbox} new</span>` : ''}</a> · jump to
    <a href="#requests">access requests${accessRequests.length ? ` <span class="badge">${accessRequests.length}</span>` : ''}</a> ·
    <a href="#users">users</a> · <a href="#review">quality review</a> · <a href="#studio">content studio</a> · <a href="#ai-video">AI video</a> · <a href="#settings">settings</a></p>
  ${notice ? `<div class="alert alert-ok">${esc(notice)}</div>` : ''}

  <h2 id="requests">Access requests</h2>
  <p class="muted">Submitted through “Request Access” under the login form. Review the applicant's details, set a temporary password, and create the account, then share the credentials with the applicant.</p>
  ${accessRequests.length ? accessRequests.map((r) => `<div class="panel">
    <div class="two-col" style="grid-template-columns:1.4fr 1fr">
      <div>
        <h3 style="margin-bottom:.2rem">${esc(r.name)} <span class="tag">${esc(r.role_requested)}</span></h3>
        <p class="mono muted" style="margin-bottom:.3rem">${esc(r.email)}${r.phone ? ' · ' + esc(r.phone) : ''}</p>
        <p class="muted" style="margin-bottom:.3rem"><strong>Organization:</strong> ${esc(r.organization || ', ')}</p>
        ${r.purpose ? `<p class="muted" style="margin-bottom:.3rem"><strong>Purpose:</strong> ${esc(r.purpose)}</p>` : ''}
        <p class="mono muted" style="font-size:.75rem">Requested ${esc(fmtTs(r.created_at))}</p>
      </div>
      <div>
        <form method="post" action="/admin/requests/action" class="grid-form">
          <input type="hidden" name="id" value="${r.id}"><input type="hidden" name="action" value="approve">
          <label>Role<select name="role"><option ${r.role_requested === 'public' ? 'selected' : ''}>public</option><option ${r.role_requested === 'stakeholder' ? 'selected' : ''}>stakeholder</option></select></label>
          <label>Temporary password<input name="password" required minlength="8" placeholder="min. 8 characters"></label>
          <button class="btn btn-teal">Create account</button>
        </form>
        <form method="post" action="/admin/requests/action" class="inline-form" style="margin-top:.5rem">
          <input type="hidden" name="id" value="${r.id}"><input type="hidden" name="action" value="reject">
          <button class="btn btn-ghost btn-sm">Reject request</button>
        </form>
      </div>
    </div>
  </div>`).join('') : '<p class="muted">No pending requests.</p>'}

  <h2 id="users">User accounts</h2>
  <table class="data-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${users.map((u) => `<tr>
      <td>${esc(u.name)}<br><span class="mono muted">${esc(u.email)}</span>${u.organization ? `<br><span class="muted">${esc(u.organization)}</span>` : ''}</td>
      <td><form method="post" action="/admin/users/role" class="inline-form"><input type="hidden" name="id" value="${u.id}">
        <select name="role" onchange="this.form.submit()">${['public', 'stakeholder', 'admin'].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></form></td>
      <td><span class="tag tag-${esc(u.status)}">${esc(u.status)}</span></td>
      <td>${u.status === 'pending' ? `<form method="post" action="/admin/users/status" class="inline-form"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="status" value="active"><button class="btn btn-sm btn-teal">Verify &amp; activate</button></form>` : ''}
        ${u.status === 'active' && u.role !== 'admin' ? `<form method="post" action="/admin/users/status" class="inline-form"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="status" value="suspended"><button class="btn btn-sm btn-ghost">Suspend</button></form>` : ''}
        ${u.status === 'suspended' ? `<form method="post" action="/admin/users/status" class="inline-form"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="status" value="active"><button class="btn btn-sm btn-ghost">Reinstate</button></form>` : ''}</td>
    </tr>`).join('')}
  </tbody></table>
  <div class="panel">
    <h3>Provision an account <span class="muted" style="font-weight:400;font-size:.8em">(stakeholders are provisioned here, per policy)</span></h3>
    <form method="post" action="/admin/users/create" class="grid-form">
      <label>Name<input name="name" required></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Organization<input name="organization"></label>
      <label>Role<select name="role"><option>stakeholder</option><option>public</option><option>admin</option></select></label>
      <label>Temporary password<input name="password" required minlength="8"></label>
      <button class="btn btn-teal">Create account</button>
    </form>
  </div>

  <h2 id="review">Data quality review queue</h2>
  <p class="muted">Submissions from survey tools, operator feeds and manual templates pass automated validation, then await human review here before publication into the database.</p>
  ${pending.length ? `<table class="data-table"><thead><tr><th>Indicator</th><th>County</th><th class="num">Year</th><th class="num">Value</th><th>Channel</th><th>Validation</th><th>Actions</th></tr></thead><tbody>
    ${pending.map((s) => `<tr>
      <td>${esc(s.indicator_name)}</td><td>${esc(s.county_name || 'National')}</td><td class="num mono">${s.year}</td><td class="num mono">${fmt(s.value)}</td>
      <td><span class="tag">${esc(s.channel)}</span></td>
      <td class="${String(s.validation_note).startsWith('FLAG') ? 'flag' : 'muted'}">${esc(s.validation_note)}</td>
      <td><form method="post" action="/admin/review" class="inline-form"><input type="hidden" name="id" value="${s.id}"><input type="hidden" name="action" value="approve"><button class="btn btn-sm btn-teal">Approve</button></form>
      <form method="post" action="/admin/review" class="inline-form"><input type="hidden" name="id" value="${s.id}"><input type="hidden" name="action" value="reject"><button class="btn btn-sm btn-ghost">Reject</button></form></td></tr>`).join('')}
  </tbody></table>` : '<p class="muted">Queue is clear, no pending submissions.</p>'}
  ${reviewed.length ? `<p class="mono muted">Recently reviewed: ${reviewed.map((r) => `${esc(r.indicator_name)} (${esc(r.status)})`).join(' · ')}</p>` : ''}
  <div class="panel">
    <h3>Manual upload template (new submission)</h3>
    <form method="post" action="/admin/submissions/create" class="grid-form">
      <label>Indicator<select name="indicator_code">${indicators.map((i) => `<option value="${i.code}">${esc(i.name)}</option>`).join('')}</select></label>
      <label>County<select name="county_id"><option value="">National</option>${counties.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
      <label>Year<input name="year" type="number" min="2018" max="2030" value="2026" required></label>
      <label>Value<input name="value" type="number" step="0.1" required></label>
      <label>Source<input name="source" placeholder="e.g. 2026 survey wave 1"></label>
      <button class="btn btn-teal">Submit for validation &amp; review</button>
    </form>
  </div>

  <h2 id="studio">Content Studio, front-end data</h2>
  <p class="muted">Everything the public front end shows is controlled here: hero text, key numbers, datasets, publications, updates and media. Changes go live immediately for all visitors and users.</p>

  <div class="panel"><h3>Site text &amp; key numbers</h3>
    <form method="post" action="/admin/content" class="grid-form">
      <label>Homepage hero title<input name="hero_title" maxlength="300" value="${esc(siteContent.hero_title || '')}"></label>
      <label>Homepage hero subtitle<textarea name="hero_sub" rows="2" maxlength="1000">${esc(siteContent.hero_sub || '')}</textarea></label>
      <label>About, mission paragraph<textarea name="about_mission" rows="3" maxlength="2000">${esc(siteContent.about_mission || '')}</textarea></label>
      <label>Key numbers strip, exactly 4 indicator codes, comma-separated<input name="key_numbers" class="mono" value="${esc(siteContent.key_numbers || '')}" placeholder="mobile_subscriptions,internet_penetration,…"></label>
      <label>Homepage video, YouTube link/ID, or an on-platform path
        <input name="home_video" class="mono" value="${esc(siteContent.home_video || '')}" placeholder="https://youtu.be/XXXXXXXX  ·  or  /media/generated/hero.mp4"></label>
      <label>Video section title<input name="home_video_title" maxlength="140" value="${esc(siteContent.home_video_title || '')}" placeholder="About the National ICT Intelligence System"></label>
      <label>Video caption (optional)<textarea name="home_video_caption" rows="2" maxlength="600">${esc(siteContent.home_video_caption || '')}</textarea></label>
      <label>Video playlist, one per line as <code>Title | YouTube link or /path.mp4</code>, or
        <code>Title | Channel | link</code> to credit a third-party channel (first line is the main player)
        <textarea name="home_video_playlist" class="mono" rows="6" maxlength="2000" placeholder="Launch briefing | https://youtu.be/XXXXXXXX&#10;What Is Data Sovereignty? | TechRound | https://youtu.be/XXXXXXXX">${esc(siteContent.home_video_playlist || '')}</textarea></label>
      <button class="btn btn-teal">Save &amp; publish</button>
    </form>
    <p class="muted mono" style="font-size:.75rem">Available codes: ${indicators.map((i) => esc(i.code)).join(' · ')}</p>
  </div>

  <div class="panel"><h3>Bulk data upload (CSV → published immediately)</h3>
    <form method="post" action="/admin/data/bulk" class="grid-form">
      <label>Rows, one per line: <span class="mono">indicator_code, county (or National), year, value[, source]</span>
        <textarea name="csv" rows="6" class="mono" placeholder="internet_penetration, Nimba, 2026, 32.5, 2026 survey wave 2&#10;internet_penetration, National, 2026, 36.9"></textarea></label>
      <button class="btn btn-gold">Publish rows</button>
    </form>
    <p class="muted">Rows upsert into the published dataset (existing indicator/county/year values are overwritten). Use the quality-review queue below for submissions that need human sign-off instead.</p>
  </div>

  <div class="two-col">
    <div class="panel"><h3>New update</h3>
      <form method="post" action="/admin/updates/create" class="grid-form">
        <label>Title<input name="title" required></label>
        <label>Category<select name="category"><option>news</option><option>data_refresh</option><option>announcement</option></select></label>
        <label>Body<textarea name="body" rows="3" required></textarea></label>
        <button class="btn btn-teal">Publish update</button>
      </form>
      ${updatesList.length ? `<table class="data-table" style="margin-top:.8rem"><thead><tr><th>Published updates</th><th></th></tr></thead><tbody>
        ${updatesList.map((u) => `<tr><td>${esc(u.title)} <span class="tag tag-${esc(u.category)}">${esc(u.category.replace('_', ' '))}</span><br><span class="mono muted">${esc(u.published_on)}</span></td>
        <td><form method="post" action="/admin/updates/delete" class="inline-form"><input type="hidden" name="id" value="${u.id}"><button class="btn btn-ghost btn-sm">Delete</button></form></td></tr>`).join('')}
      </tbody></table>` : ''}
    </div>
    <div class="panel"><h3>New research paper</h3>
      <form method="post" action="/admin/papers/create" class="grid-form">
        <label>Title<input name="title" required></label>
        <label>Authors<input name="authors"></label>
        <label>Tag<select name="tag"><option>Report</option><option>Flagship Report</option><option>Working Paper</option><option>Brief</option></select></label>
        <label>Abstract<textarea name="abstract" rows="3" required></textarea></label>
        <button class="btn btn-teal">Publish paper</button>
      </form>
      ${papersList.length ? `<table class="data-table" style="margin-top:.8rem"><thead><tr><th>Published papers</th><th></th></tr></thead><tbody>
        ${papersList.map((pp) => `<tr><td>${esc(pp.title)} <span class="tag">${esc(pp.tag)}</span><br><span class="mono muted">${esc(pp.published_on)}</span></td>
        <td><form method="post" action="/admin/papers/delete" class="inline-form"><input type="hidden" name="id" value="${pp.id}"><button class="btn btn-ghost btn-sm">Delete</button></form></td></tr>`).join('')}
      </tbody></table>` : ''}
    </div>
  </div>
  <div class="panel"><h3>Add media item</h3>
    <form method="post" action="/admin/media/create" class="grid-form">
      <label>Kind<select name="kind"><option>image</option><option>paper</option><option>video</option></select></label>
      <label>Title<input name="title" required></label>
      <label>Description<input name="description"></label>
      <label>File path (image/paper)<input name="file_path" placeholder="/media/example.svg"></label>
      <label>Video embed ID (video)<input name="video_embed_id" placeholder="hosted-service video ID"></label>
      <label>Access level<select name="access_level"><option>public</option><option>registered</option><option>stakeholder</option></select></label>
      <button class="btn btn-teal">Add to library</button>
    </form>
    <p class="muted">Video is embedded from the dedicated hosting service, only the embed reference is stored here.</p>
    ${mediaList.length ? `<table class="data-table" style="margin-top:.8rem"><thead><tr><th>Library</th><th>Kind</th><th>Access</th><th></th></tr></thead><tbody>
      ${mediaList.map((m) => `<tr><td>${esc(m.title)}</td><td><span class="tag">${esc(m.kind)}</span></td><td>${esc(m.access_level)}</td>
      <td><form method="post" action="/admin/media/delete" class="inline-form"><input type="hidden" name="id" value="${m.id}"><button class="btn btn-ghost btn-sm">Delete</button></form></td></tr>`).join('')}
    </tbody></table>` : ''}
  </div>

  <div class="panel" id="ai-video">
    <h3>AI video generation <span class="tag" style="background:#1C5BB8;color:#fff">Seedance</span></h3>
    ${seedanceReady
      ? `<p class="muted">Generate a short video from a text prompt, preview it, then publish it into the Media Library. The <strong>mini</strong> tier is the free default, higher tiers spend real Seedance credits.</p>
    <div class="grid-form">
      <label style="grid-column:1/-1">Prompt<textarea id="sd-prompt" rows="3" placeholder="e.g. Aerial drone shot over Monrovia at sunrise, fibre-optic light trails connecting all 15 counties, cinematic, hopeful"></textarea></label>
      <label>Model<select id="sd-model"><option value="seedance2">Seedance 2 (tiered)</option><option value="seedance25">Seedance 2.5</option></select></label>
      <label>Quality tier<select id="sd-tier"><option value="mini">mini, free</option><option value="standard">standard, paid</option><option value="pro">pro, paid</option></select></label>
      <label>Aspect ratio<select id="sd-aspect"><option>16:9</option><option>9:16</option><option>1:1</option></select></label>
      <label>Duration (s)<select id="sd-duration"><option>5</option><option>10</option></select></label>
      <label>Resolution<select id="sd-res"><option>480p</option><option selected>720p</option><option>1080p</option></select></label>
      <label>Reference image URL (optional, image→video)<input id="sd-image" placeholder="https://… public https image"></label>
    </div>
    <button class="btn btn-teal" id="sd-generate" style="margin-top:.6rem">Generate video</button>
    <div id="sd-status" class="mono" style="margin-top:.8rem;display:none;padding:.7rem .9rem;border-radius:8px;background:#F7F4EE;border:1px solid #e3ddd0"></div>
    <div id="sd-result" style="margin-top:.8rem;display:none">
      <video id="sd-video" controls playsinline style="width:100%;max-width:520px;border-radius:10px;background:#000"></video>
      <div class="grid-form" style="margin-top:.6rem">
        <label>Library title<input id="sd-title" placeholder="AI video · Monrovia connectivity"></label>
        <label>Access level<select id="sd-access"><option>public</option><option>registered</option><option>stakeholder</option></select></label>
      </div>
      <div style="margin-top:.4rem;display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-teal" id="sd-publish">Publish to Media Library</button>
        <button class="btn btn-ghost" id="sd-sethero">Set as homepage hero</button>
      </div>
    </div>`
      : `<p class="muted">Video generation is not configured on the server. Add your Seedance API key to <code>seedance-key.txt</code> in the project root and restart the app.</p>`}
    ${generations.length ? `<table class="data-table" style="margin-top:1rem"><thead><tr><th>Recent generations</th><th>Model</th><th>Status</th><th></th></tr></thead><tbody>
      ${generations.map((g) => `<tr><td>${esc(g.prompt.slice(0, 60))}${g.prompt.length > 60 ? '…' : ''}<br><span class="mono muted">${esc(String(g.created_at).slice(0, 16).replace('T', ' '))}</span></td>
      <td><span class="tag">${esc(g.model)}${g.quality_tier ? ' · ' + esc(g.quality_tier) : ''}</span></td>
      <td><span class="tag" style="background:${g.status === 'completed' || g.status === 'published' ? '#1C5BB8' : g.status === 'failed' ? '#C8102E' : '#5A6A85'};color:#fff">${esc(g.status)}</span></td>
      <td>${g.local_path ? `<a href="${esc(g.local_path)}" target="_blank">view</a>${g.status === 'completed' || g.status === 'published' ? ` · <a href="#" data-sethero="${g.id}">set as hero</a>` : ''}` : ''}</td></tr>`).join('')}
    </tbody></table>` : ''}
  </div>

  <h2 id="settings">Platform settings</h2>
  <div class="two-col">
    <div class="panel"><h3>Access policies <span class="muted" style="font-weight:400;font-size:.8em">(configurable, not hard-coded)</span></h3>
      <form method="post" action="/admin/settings" class="grid-form">
        <label>Public registration
          <select name="registration_mode">
            <option value="verified" ${settings.registration_mode === 'verified' ? 'selected' : ''}>Verified, admin approves each account</option>
            <option value="open" ${settings.registration_mode === 'open' ? 'selected' : ''}>Open, immediate activation</option>
            <option value="closed" ${settings.registration_mode === 'closed' ? 'selected' : ''}>Closed, no self-service sign-up</option>
          </select></label>
        <label>Stakeholder provisioning
          <select name="stakeholder_provisioning">
            <option value="admin_only" ${settings.stakeholder_provisioning === 'admin_only' ? 'selected' : ''}>Admin-provisioned only</option>
            <option value="request" ${settings.stakeholder_provisioning === 'request' ? 'selected' : ''}>Users may request upgrade</option>
          </select></label>
        <label>Messaging model
          <select name="messaging_model">
            <option value="inbox" ${settings.messaging_model === 'inbox' ? 'selected' : ''}>Inbox (checked &amp; answered)</option>
            <option value="realtime" ${settings.messaging_model === 'realtime' ? 'selected' : ''}>Real-time (future)</option>
          </select></label>
        <button class="btn btn-teal">Save policies</button>
      </form>
    </div>
    <div class="panel"><h3>Role permissions</h3>
      <form method="post" action="/admin/permissions">
        <table class="data-table"><thead><tr><th>Permission</th><th>Public</th><th>Stakeholder</th></tr></thead><tbody>
          ${editablePerms.map((perm) => `<tr><td class="mono">${esc(perm)}</td>
            <td><input type="checkbox" name="perm_public_${perm}" ${permHas('public', perm) ? 'checked' : ''}></td>
            <td><input type="checkbox" name="perm_stakeholder_${perm}" ${permHas('stakeholder', perm) ? 'checked' : ''}></td></tr>`).join('')}
        </tbody></table>
        <button class="btn btn-teal" style="margin-top:.7rem">Save permissions</button>
      </form>
      <p class="muted">Administrator permissions are fixed. Changes take effect immediately for all sessions.</p>
    </div>
  </div>
  <script>${adminVideoScript}</script>`,
  });
};

// Client-side driver for the Seedance AI video panel: submit → poll → preview → publish.
const adminVideoScript = `
(function(){
  var gen=document.getElementById('sd-generate'); if(!gen) return;
  var statusEl=document.getElementById('sd-status'), resultEl=document.getElementById('sd-result'), video=document.getElementById('sd-video');
  var pub=document.getElementById('sd-publish'); var curId=null, timer=null;
  function show(msg,kind){ statusEl.style.display='block'; statusEl.textContent=msg; statusEl.style.borderColor=(kind==='err'?'#C8102E':kind==='ok'?'#1C5BB8':'#e3ddd0'); }
  function val(id){ var e=document.getElementById(id); return e?e.value:''; }
  gen.addEventListener('click', function(){
    var prompt=val('sd-prompt').trim(); if(prompt.length<6){ show('Enter a prompt of at least 6 characters.','err'); return; }
    gen.disabled=true; resultEl.style.display='none'; show('Submitting to Seedance…');
    var body=new URLSearchParams({prompt:prompt,model:val('sd-model'),quality_tier:val('sd-tier'),aspect_ratio:val('sd-aspect'),duration:val('sd-duration'),resolution:val('sd-res'),image_url:val('sd-image').trim()});
    fetch('/admin/media/generate',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body}).then(function(r){return r.json();}).then(function(d){
      if(!d.ok){ show(d.error||'Generation failed.','err'); gen.disabled=false; return; }
      curId=d.id; show('Generating… this can take 1-3 minutes. Task '+d.task_id); poll();
    }).catch(function(){ show('Network error submitting the job.','err'); gen.disabled=false; });
  });
  function poll(){
    if(timer) clearTimeout(timer);
    fetch('/admin/media/gen-status?id='+curId).then(function(r){return r.json();}).then(function(d){
      if(!d.ok){ show(d.error||'Status check failed.','err'); gen.disabled=false; return; }
      if(d.status==='completed'||d.status==='published'){
        show('Video ready.'+(d.credits_used?(' Credits used: '+d.credits_used):''),'ok');
        video.src=d.video_url; resultEl.style.display='block'; gen.disabled=false;
        var t=document.getElementById('sd-title'); if(t&&!t.value) t.value='AI video · '+val('sd-prompt').trim().slice(0,50);
        return;
      }
      if(d.status==='failed'){ show('Generation failed: '+(d.error||'unknown error'),'err'); gen.disabled=false; return; }
      show('Generating… '+(d.note||d.raw_status||'processing')+' (auto-refreshing)');
      timer=setTimeout(poll,6000);
    }).catch(function(){ timer=setTimeout(poll,8000); });
  }
  if(pub) pub.addEventListener('click', function(){
    if(!curId) return; pub.disabled=true;
    var body=new URLSearchParams({id:curId,title:val('sd-title'),access_level:val('sd-access')});
    fetch('/admin/media/gen-publish',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body}).then(function(r){return r.json();}).then(function(d){
      if(d.ok){ show('Published to the Media Library. Reloading…','ok'); setTimeout(function(){location.reload();},900); }
      else { show(d.error||'Publish failed.','err'); pub.disabled=false; }
    }).catch(function(){ show('Network error publishing.','err'); pub.disabled=false; });
  });
  function setHero(id, cb){
    fetch('/admin/media/set-hero',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id:id})}).then(function(r){return r.json();}).then(function(d){ cb(d); }).catch(function(){ cb({ok:false,error:'Network error.'}); });
  }
  var sh=document.getElementById('sd-sethero');
  if(sh) sh.addEventListener('click', function(){ if(!curId) return; sh.disabled=true;
    setHero(curId, function(d){ if(d.ok){ show('This clip is now the homepage hero video.','ok'); } else { show(d.error||'Could not set hero.','err'); } sh.disabled=false; }); });
  document.querySelectorAll('[data-sethero]').forEach(function(a){ a.addEventListener('click', function(e){ e.preventDefault();
    setHero(a.getAttribute('data-sethero'), function(d){ alert(d.ok?'Homepage hero updated. Open the home page to see it.':(d.error||'Failed.')); }); }); });
})();
`;

const apiDocsBody = `
  <p class="kicker">Open data programme</p>
  <h1>Public API · v1</h1>
  <p class="lede-sm">Free JSON API over NIIS. No key required for public series; authenticated sessions automatically unlock deeper series permitted by their role.</p>
  ${[
    ['GET /api/v1/indicators', 'List indicators visible at your access level, with catalogue metadata.', '{ "data": [ { "code": "internet_penetration", "name": "Internet penetration", "domain": "connectivity", "unit": "% of population", ... } ] }'],
    ['GET /api/v1/counties', 'List the 15 counties with population and area.', '{ "data": [ { "id": 11, "name": "Montserrado", "capital": "Bensonville", ... } ] }'],
    ['GET /api/v1/data', 'Query data points. Filters: indicator, county (name), year. Rows with county=null are national aggregates.', 'GET /api/v1/data?indicator=internet_penetration&county=Nimba\n{ "count": 8, "data": [ { "indicator_code": "internet_penetration", "county": "Nimba", "year": 2018, "value": 8.3, ... } ] }'],
    ['GET /api/v1/explorer', 'The payload behind the Data Explorer: map values, national/focus trend, comparison trend, YoY table. Params: indicator, year, focus, compare.', '{ "indicator": {...}, "trend": {...}, "table": [ { "county": "Bomi", "value": 27.4, "yoy": 2.1 } ] }'],
    ['GET /api/v1/dashboards/:topic', 'The aggregated payload behind a topic dashboard. Optional: county.', '{ "topic": "connectivity", "heroStats": [...], "trend": {...}, "ranking": { "top": [...], "bottom": [...] } }'],
    ['GET /api/v1/query', 'Run a Data Query builder extract. Params: indicators (comma list), counties (comma list or "all"), year_from, year_to, format (csv|json|xlsx).', 'GET /api/v1/query?indicators=internet_penetration,mobile_subscriptions&counties=all&year_from=2020&year_to=2025&format=csv'],
    ['GET /api/v1/download/data.csv', 'Full open dataset as CSV (same filters as /data). Also available as data.json.', 'indicator_code,indicator,domain,unit,county,year,value,source'],
  ].map(([sig, desc, ex]) => `<div class="api-block">
    <h3 class="mono">${esc(sig)}</h3><p class="muted">${esc(desc)}</p><pre class="mono">${esc(ex)}</pre>
  </div>`).join('')}
  <h2>Errors</h2>
  <p class="muted"><span class="mono">403 access_restricted</span>, the indicator requires a registered or stakeholder account. <span class="mono">404 unknown_indicator</span>, check <span class="mono">/api/v1/indicators</span>.</p>
  <h2>Schema</h2>
  <p class="muted">The full relational schema is documented in the project's <span class="mono">docs/SCHEMA.md</span>.</p>`;
// ============ IMAGE LIBRARY (admin) ============
// One card per image slot on the site. Upload replaces whatever is in the slot; Delete puts the
// slot back to the image the platform ships with. Collections are kept apart on purpose so the
// hero slider, research papers, ICT reports and news never share a picture.
exports.adminImages = (ctx, { groups = [], notice = '' }) => {
  const card = (collection, s) => `<div class="imglib-card">
    <div class="imglib-thumb" style="${slotBg(collection, s.key, false)}"></div>
    <div class="imglib-info">
      <strong>${esc(s.label)}</strong>
      ${s.hint ? `<span class="imglib-hint">${esc(s.hint)}</span>` : ''}
      <span class="imglib-state ${s.custom ? 'is-custom' : ''}">${s.custom ? 'Uploaded' : (s.url ? 'Built-in image' : 'Empty slot')}</span>
    </div>
    <form class="imglib-form" method="post" action="/admin/images/upload" enctype="multipart/form-data">
      <input type="hidden" name="collection" value="${esc(collection)}">
      <input type="hidden" name="key" value="${esc(s.key)}">
      <label class="imglib-pick">
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
        <span class="imglib-pick-label">Choose image…</span>
      </label>
      <div class="imglib-actions">
        <button class="btn btn-teal btn-sm" type="submit">${s.custom ? 'Replace' : 'Upload'}</button>
      </div>
    </form>
    ${s.custom ? `<form method="post" action="/admin/images/delete" class="imglib-del"
        onsubmit="return confirm('Delete this upload and go back to the built-in image?')">
      <input type="hidden" name="collection" value="${esc(collection)}">
      <input type="hidden" name="key" value="${esc(s.key)}">
      <button class="btn btn-ghost btn-sm" type="submit">Delete upload</button>
    </form>` : '<div class="imglib-del imglib-del-empty">Nothing uploaded yet</div>'}
  </div>`;

  const sections = groups.map((g) => `<section class="card imglib-group">
    <div class="imglib-head">
      <h3>${esc(g.label)}</h3>
      <p>${esc(g.note)}</p>
    </div>
    <div class="imglib-grid">${g.slots.map((s) => card(g.collection, s)).join('')}</div>
  </section>`).join('');

  return shell(ctx, { title: 'Image Library', workspaceActive: 'images', body: `
  <div class="pad">
    <div class="page-head">
      <div>
        <h1>Image Library</h1>
        <p class="lede-sm">Every picture on the public site, in one place. Each collection is separate, so an
          image used on a report never turns up on a research paper or in the hero slider.
          JPG, PNG or WebP, up to 4 MB. Changes go live immediately.</p>
      </div>
    </div>
    ${notice ? `<div class="alert alert-ok">${esc(notice)}</div>` : ''}
    ${sections}
  </div>
  <script>
  (function(){
    document.querySelectorAll('.imglib-pick input[type=file]').forEach(function(inp){
      inp.addEventListener('change', function(){
        var lbl = inp.parentNode.querySelector('.imglib-pick-label');
        var f = inp.files && inp.files[0];
        lbl.textContent = f ? f.name : 'Choose image…';
        inp.parentNode.classList.toggle('has-file', !!f);
      });
    });
  })();
  </script>` });
};

exports.apiDocs = (ctx) => shell(ctx, { title: 'API Documentation', workspaceActive: 'apidocs', body: `<div class="wrap section narrow">${apiDocsBody}</div>` });

// ============ misc ============
const wrapMisc = (ctx, title, inner) => shell(ctx || { user: null, perms: [] }, { title, body: `<div class="wrap section narrow">${inner}</div>` });
exports.forbidden = (ctx) => wrapMisc(ctx, 'Access restricted', `<h1>Access restricted</h1><p class="muted">Your role does not include permission for this area. Contact the ICT Statistics &amp; Policy Unit via <a href="/messages">messaging</a> if you believe this is an error.</p>`);
exports.notFound = (ctx) => wrapMisc(ctx, 'Not found', `<h1>Page not found</h1><p class="muted">The page you requested does not exist. <a href="/">Return home</a>.</p>`);
exports.errorPage = (ctx, msg) => wrapMisc(ctx, 'Error', `<h1>Something went wrong</h1><p class="muted">${esc(msg)}</p>`);
