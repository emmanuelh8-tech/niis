// niis/analytics.js: NIIS Data Analytics. Measures a series and a county distribution, states what they show
// in plain sentences (every number in a sentence is computed here, never written by hand), and draws the
// charts as SVG so the same picture works on screen, in a report and on paper.
'use strict';
const { unitClass } = require('./pipeline');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
// a value in its unit, short: 32.2%, 32.1 per 100, US$ 12.3m, 1,234
function fmtVal(v, unit) {
  if (v == null || !Number.isFinite(v)) return 'no data';
  const u = String(unit || '');
  const n = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : Math.abs(v) >= 100 ? String(Math.round(v)) : String(r1(v));
  if (/^%/.test(u)) return n + '%';
  if (/^us\$ millions/i.test(u)) return 'US$ ' + n + 'm';
  if (/^us\$/i.test(u)) return 'US$ ' + n;
  return n;
}
const unitTail = (unit) => (/^%/.test(unit) || /^us\$/i.test(unit) ? '' : ' ' + unit);
function fmtChange(d, unit) {
  const uc = unitClass(unit);
  const s = (d > 0 ? '+' : d < 0 ? '−' : '±') + (Math.abs(d) >= 1000 ? Math.round(Math.abs(d)).toLocaleString('en-US') : r1(Math.abs(d)));
  return s + (uc.points ? ' points' : unitTail(unit));
}

// ---- measures
function seriesStats(series) {
  const s = (series || []).filter((x) => x.value != null).sort((a, b) => a.year - b.year);
  if (!s.length) return null;
  const first = s[0], last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
  const span = last.year - first.year;
  const cagr = span > 0 && first.value > 0 && last.value > 0 ? (Math.pow(last.value / first.value, 1 / span) - 1) * 100 : null;
  const peak = s.reduce((a, x) => (x.value > a.value ? x : a), s[0]);
  return { n: s.length, first, last, prev, change: last.value - first.value, changePct: first.value ? ((last.value - first.value) / Math.abs(first.value)) * 100 : null,
    yoy: prev ? last.value - prev.value : null, cagr, peak, span };
}
function distStats(items, national) {
  const v = (items || []).filter((x) => x.value != null);
  if (!v.length) return null;
  const sorted = v.slice().sort((a, b) => b.value - a.value);
  const vals = sorted.map((x) => x.value);
  const mean = vals.reduce((a, x) => a + x, 0) / vals.length;
  const mid = vals.length >> 1;
  const asc = vals.slice().sort((a, b) => a - b);
  const median = asc.length % 2 ? asc[mid] : (asc[mid - 1] + asc[mid]) / 2;
  const sd = Math.sqrt(vals.reduce((a, x) => a + (x - mean) ** 2, 0) / vals.length);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  return { n: v.length, best, worst, gap: best.value - worst.value, ratio: worst.value > 0 ? best.value / worst.value : null, mean, median,
    cv: mean ? (sd / Math.abs(mean)) * 100 : null, above: national != null ? v.filter((x) => x.value > national).length : null, sorted };
}

// ---- findings, in plain sentences
function findings({ ind, series = [], counties = [], year, totalCounties = 15, demo = false }) {
  const out = [];
  const unit = ind.unit, name = ind.name;
  const st = seriesStats(series);
  const nat = series.find((x) => x.year === year);
  const ds = distStats(counties, nat ? nat.value : null);
  if (nat) out.push(`Nationally, ${name.toLowerCase().startsWith('the ') ? name : name.charAt(0).toLowerCase() + name.slice(1)} stood at ${fmtVal(nat.value, unit)}${unitTail(unit)} in ${year}.`);
  if (st && st.n > 1 && st.last.year === year) {
    out.push(`That is ${fmtChange(st.change, unit)} since ${st.first.year} (${fmtVal(st.first.value, unit)})${st.cagr != null && Math.abs(st.cagr) < 1000 ? `, a compound change of ${r1(st.cagr)}% a year` : ''}.`);
    if (st.prev) out.push(`Over the last year it moved ${fmtChange(st.yoy, unit)}, from ${fmtVal(st.prev.value, unit)} in ${st.prev.year}.`);
    if (st.peak.year !== st.last.year) out.push(`The highest figure on record is ${fmtVal(st.peak.value, unit)} in ${st.peak.year}, above the latest.`);
  }
  if (ds && ds.n > 1) {
    out.push(`${ds.best.county} leads the counties at ${fmtVal(ds.best.value, unit)}; ${ds.worst.county} is lowest at ${fmtVal(ds.worst.value, unit)}, a gap of ${fmtChange(ds.gap, unit).replace(/^\+/, '')}${ds.ratio && ds.ratio >= 1.5 && ds.ratio < 100 ? ` (${r1(ds.ratio)} times as high)` : ''}.`);
    if (ds.above != null) out.push(`${ds.above} of ${ds.n} counties are above the national figure; the county median is ${fmtVal(ds.median, unit)}.`);
    if (ds.cv != null && ds.cv > 40) out.push(`Counties differ widely: the spread (coefficient of variation) is ${Math.round(ds.cv)}% of the average.`);
  }
  if (counties.length && counties.length < totalCounties) out.push(`Only ${counties.length} of ${totalCounties} counties have a figure for ${year}; the others have no data.`);
  if (!out.length) out.push(`There is no published figure for ${name} in ${year}.`);
  if (demo) out.push('These are demonstration figures, not official statistics: they show how the analysis will read once real data is released.');
  return out;
}

// ---- charts: SVG with fixed colours, so they print the same as they show
const C = { ink: '#0c2236', muted: '#4a5d70', grid: '#c9d3dc', line: '#00608f', bar: '#009edb', barHi: '#00608f', nat: '#c8102e' };
function niceTicks(lo, hi, n = 4) {
  if (lo === hi) { hi = lo + 1; }
  const step0 = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), f = step0 / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const t = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.5; v += step) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}
const tickLabel = (v) => (Math.abs(v) >= 1e6 ? r1(v / 1e6) + 'm' : Math.abs(v) >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(r1(v)));

// a line over the years, labelled at its ends (the Our World in Data way: no legend, the line says what it is)
function svgLine(series, { unit = '', w = 640, h = 260, label = '' } = {}) {
  const s = (series || []).filter((x) => x.value != null).sort((a, b) => a.year - b.year);
  if (!s.length) return '<p class="an-empty">No figures to chart.</p>';
  const pad = { l: 48, r: 64, t: 18, b: 30 };
  const ys = s.map((x) => x.value);
  const lo0 = Math.min(...ys), hi0 = Math.max(...ys);
  const ticks = niceTicks(Math.min(0, lo0), hi0);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x0 = s[0].year, x1 = s[s.length - 1].year === x0 ? x0 + 1 : s[s.length - 1].year;
  const X = (yr) => pad.l + ((yr - x0) / (x1 - x0)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const path = s.map((p, i) => `${i ? 'L' : 'M'}${X(p.year).toFixed(1)},${Y(p.value).toFixed(1)}`).join('');
  const last = s[s.length - 1], first = s[0];
  return `<svg class="an-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || 'Trend')}: ${esc(fmtVal(first.value, unit))} in ${first.year} to ${esc(fmtVal(last.value, unit))} in ${last.year}">
  ${ticks.map((t) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="${C.grid}" stroke-width="1" ${t === lo ? '' : 'stroke-dasharray="2 4"'}/><text x="${pad.l - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${C.muted}">${tickLabel(t)}</text>`).join('')}
  ${s.map((p) => `<text x="${X(p.year).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="11" fill="${C.muted}">${p.year}</text>`).join('')}
  <path d="${path}" fill="none" stroke="${C.line}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
  ${s.map((p) => `<circle cx="${X(p.year).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="3.4" fill="#fff" stroke="${C.line}" stroke-width="2"><title>${p.year}: ${esc(fmtVal(p.value, unit))}</title></circle>`).join('')}
  <text x="${(X(last.year) + 8).toFixed(1)}" y="${(Y(last.value) + 4).toFixed(1)}" font-size="12.5" font-weight="700" fill="${C.ink}">${esc(fmtVal(last.value, unit))}</text>
  ${s.length > 1 ? `<text x="${(X(first.year)).toFixed(1)}" y="${(Y(first.value) - 9).toFixed(1)}" text-anchor="middle" font-size="11.5" fill="${C.muted}">${esc(fmtVal(first.value, unit))}</text>` : ''}
</svg>`;
}

// counties as horizontal bars, highest first, the national figure as a red rule
function svgBars(items, { unit = '', national = null, w = 640, label = '' } = {}) {
  const v = (items || []).filter((x) => x.value != null).sort((a, b) => b.value - a.value);
  if (!v.length) return '<p class="an-empty">No county figures for this year.</p>';
  const rowH = 22, pad = { l: 132, r: 70, t: 8, b: 22 };
  const h = pad.t + pad.b + v.length * rowH;
  const max = Math.max(...v.map((x) => x.value), national || 0) || 1;
  const min = Math.min(0, ...v.map((x) => x.value));
  const X = (val) => pad.l + ((val - min) / (max - min || 1)) * (w - pad.l - pad.r);
  // the national rule goes in first, so the bars and their labels sit over it
  return `<svg class="an-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || 'Counties')}: ${esc(v[0].county)} highest at ${esc(fmtVal(v[0].value, unit))}, ${esc(v[v.length - 1].county)} lowest at ${esc(fmtVal(v[v.length - 1].value, unit))}">
  ${national != null ? `<line x1="${X(national).toFixed(1)}" x2="${X(national).toFixed(1)}" y1="${pad.t}" y2="${h - pad.b + 4}" stroke="${C.nat}" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="${X(national).toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="${C.nat}">Liberia ${esc(fmtVal(national, unit))}</text>` : ''}
  ${v.map((x, i) => {
    const y = pad.t + i * rowH;
    return `<text x="${pad.l - 10}" y="${y + 15}" text-anchor="end" font-size="12" fill="${C.ink}">${esc(x.county)}</text>
    <rect x="${X(Math.min(0, x.value)).toFixed(1)}" y="${y + 4}" width="${Math.max(1, Math.abs(X(x.value) - X(0))).toFixed(1)}" height="${rowH - 8}" rx="3" fill="${i === 0 ? C.barHi : C.bar}"><title>${esc(x.county)}: ${esc(fmtVal(x.value, unit))}</title></rect>
    <text x="${(X(Math.max(0, x.value)) + 6).toFixed(1)}" y="${y + 15}" font-size="11.5" fill="${C.muted}" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(fmtVal(x.value, unit))}</text>`;
  }).join('')}
</svg>`;
}

// a small trend line for a table cell
function svgSpark(series, { w = 96, h = 26 } = {}) {
  const s = (series || []).filter((x) => x.value != null).sort((a, b) => a.year - b.year);
  if (s.length < 2) return '';
  const ys = s.map((x) => x.value), lo = Math.min(...ys), hi = Math.max(...ys);
  const X = (i) => 2 + (i / (s.length - 1)) * (w - 4), Y = (v) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (h - 6);
  return `<svg class="an-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${s.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join('')}" fill="none" stroke="${C.line}" stroke-width="1.8"/><circle cx="${X(s.length - 1).toFixed(1)}" cy="${Y(s[s.length - 1].value).toFixed(1)}" r="2.4" fill="${C.line}"/></svg>`;
}

module.exports = { fmtVal, fmtChange, seriesStats, distStats, findings, svgLine, svgBars, svgSpark, unitTail };
