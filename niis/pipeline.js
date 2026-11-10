// niis/pipeline.js: "Process new data". Raw rows in, indicator values ready for review out, through the six
// stages the program booklet promises (Validate, Clean, Integrate, Transform, Analyse, Enrich) and the twelve
// quality checks of the data-sharing MOU, Schedule 3 (Q01 to Q12). A pure function: it reads nothing and writes
// nothing, so the same rows always give the same result, and every value carries the checks it passed.
'use strict';

const CHECKS = {
  Q01: 'Completeness', Q02: 'Range', Q03: 'Internal consistency', Q04: 'Denominator agreement',
  Q05: 'Year-on-year movement', Q06: 'Cross-source agreement', Q07: 'Definition conformity', Q08: 'Timeliness',
  Q09: 'Confidentiality', Q10: 'Provider sign-off', Q11: 'Derived input readiness', Q12: 'Revision control',
  A1: 'County outlier',
};
// what the MOU says to do when a check fails, shown beside it
const CHECK_ACTION = {
  Q01: 'Return to provider.', Q02: 'Reject and query in writing.', Q03: 'Reject and reconcile.',
  Q04: 'Recompute. Do not accept provider-computed rates.', Q05: 'Flag. Publish only after written confirmation.',
  Q06: 'Investigate and record the chosen source.', Q07: 'Reject. It is not comparable.', Q08: 'Escalate to the focal point.',
  Q09: 'Suppress and mark.', Q10: 'Hold publication.', Q11: 'Do not compute or publish.', Q12: 'Block the change.',
  A1: 'Check with the provider before approving.',
};

const ADDITIVE = /^(persons|platforms|businesses|jobs|facilities|hubs|hotspots|sites|startups|services|racks|laboratories|databases|datasets|classrooms|vacancies|programmes|access points)$|^us\$ millions|per year$|\/ yr$/;
// what a unit allows: its range (Q02), whether county figures add up to the nation, and its scale for a ratio
function unitClass(unit) {
  const u = String(unit || '').toLowerCase().trim();
  if (/^% per year/.test(u)) return { kind: 'growth', min: -100, max: 1000 };
  if (/percentage points/.test(u)) return { kind: 'gap', min: -100, max: 100, points: true };
  if (/^% of (gni|household income)/.test(u)) return { kind: 'share', min: 0, max: Infinity, scale: 100, points: true };
  if (/^%/.test(u)) return { kind: 'share', min: 0, max: 100, scale: 100, points: true, popBase: /^% of (population|county population)$/.test(u) };
  if (/^per 100 (people|adults)$/.test(u)) return { kind: 'rate', min: 0, max: 300, scale: 100, popBase: u === 'per 100 people' };
  if (/per 100,000/.test(u)) return { kind: 'rate', min: 0, max: Infinity, scale: 100000 };
  if (/^index 0 to 100$|^index \(0-100\)$/.test(u)) return { kind: 'index', min: 0, max: 100, points: true };
  if (/^index 0 to 5$/.test(u)) return { kind: 'index', min: 0, max: 5 };
  if (/^hhi/.test(u)) return { kind: 'index', min: 0, max: 10000 };
  if (ADDITIVE.test(u) || /^incidents/.test(u)) return { kind: 'count', min: 0, max: Infinity, additive: true };
  return { kind: 'measure', min: 0, max: Infinity, scale: 1 };
}
const unitKey = (u) => String(u || '').toLowerCase().replace(/[^a-z0-9%$]/g, '');
const sameUnit = (a, b) => unitKey(a) === unitKey(b) || (unitKey(a) === '%' && /^%/.test(String(b).trim()));
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const fmtN = (v) => (v == null ? 'n/a' : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(round(v, 2)));
const WORST = { ok: 0, warn: 1, fail: 2 };
const sevOf = (checks) => {
  let s = 'ok';
  for (const c of checks) {
    const r = c.result === 'fail' ? 'fail' : c.result === 'warn' ? 'warn' : 'ok';
    if (WORST[r] > WORST[s]) s = r;
  }
  return s;
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * runPipeline(input) -> { staged, log, stats }
 * input.batches      [{ id, ref, method, provider, created_at, sha256, signoff_at, signoff_by }]
 * input.rows         raw rows of those batches (any status; only ok and flagged ones go on)
 * input.indicators   [{ code, name, unit }]
 * input.counties     [{ id, name }]
 * input.published    data_points for the indicators involved, years y and y-1: [{ indicator_code, county_id, year, value, source }]
 * input.denominators [{ county_id, year, kind, value, source }]
 * input.nowYear      the current year
 */
function runPipeline({ batches, rows, indicators, counties, published = [], denominators = [], nowYear = new Date().getFullYear() }) {
  const ind = new Map(indicators.map((i) => [i.code, i]));
  const batchById = new Map(batches.map((b) => [Number(b.id), b]));
  const countyName = new Map(counties.map((c) => [c.id, c.name]));
  const NC = counties.length;
  const pubMap = new Map(published.map((p) => [`${p.indicator_code}|${p.county_id ?? 'N'}|${p.year}`, p]));
  const pop = new Map(denominators.filter((d) => d.kind === 'population').map((d) => [`${d.county_id ?? 'N'}|${d.year}`, d]));
  const cellKey = (code, county, year) => `${code}|${county ?? 'N'}|${year}`;
  const where = (code, county, year) => `${(ind.get(code) || {}).name || code}, ${county == null ? 'Liberia' : countyName.get(county) || 'county ' + county}, ${year}`;
  const log = [];
  const tally = () => ({ pass: 0, warn: 0, fail: 0, na: 0 });
  const count = (t, r) => { t[r === 'n/a' ? 'na' : r] = (t[r === 'n/a' ? 'na' : r] || 0) + 1; };

  // ---------------- 1 VALIDATE: is each figure what the indicator says it is, and inside its range?
  const v = { Q02: tally(), Q04: tally(), Q07: tally() };
  const notes1 = [];
  const usable = rows.filter((r) => r.status === 'ok' || r.status === 'flagged');
  const rejectedAtIntake = rows.length - usable.length;
  const valid = [];
  let failed1 = 0;
  for (const r of usable) {
    const i = ind.get(r.indicator_code);
    const checks = [];
    if (!i) { failed1++; continue; }
    const uc = unitClass(i.unit);
    let value = r.value, method = 'reported';
    // Q07: the unit and the period match the catalogue's definition
    if (r.unit_text && !sameUnit(r.unit_text, i.unit)) checks.push({ q: 'Q07', result: 'fail', note: `Unit "${r.unit_text}" is not the catalogue unit "${i.unit}"` });
    else if (r.year > nowYear || r.year < 2000) checks.push({ q: 'Q07', result: 'fail', note: `Year ${r.year} is outside 2000 to ${nowYear}` });
    else checks.push({ q: 'Q07', result: 'pass', note: r.unit_text ? 'Unit matches the catalogue' : `Unit not stated; read as ${i.unit}` });
    // Q04: a rate is always computed by NIIS from its numerator and denominator
    if (r.numerator != null && r.denominator != null) {
      if (r.denominator <= 0) checks.push({ q: 'Q02', result: 'fail', note: 'Denominator is zero or below' });
      else {
        const computed = uc.additive ? r.numerator : (r.numerator / r.denominator) * (uc.scale || 1);
        if (r.value != null && Math.abs(r.value - computed) > Math.max(0.05, Math.abs(computed) * 0.005)) {
          checks.push({ q: 'Q04', result: 'warn', note: `The provider's figure ${fmtN(r.value)} was recomputed from its numerator and denominator as ${fmtN(computed)}` });
        } else checks.push({ q: 'Q04', result: 'pass', note: `Computed by NIIS from ${fmtN(r.numerator)} / ${fmtN(r.denominator)}` });
        value = round(computed, 6); method = 'computed';
      }
    }
    // Q02: the value sits inside the range its unit allows
    if (value != null && !checks.some((c) => c.q === 'Q02')) {
      if (value < uc.min || value > uc.max) checks.push({ q: 'Q02', result: 'fail', note: `${fmtN(value)} is outside the range for "${i.unit}" (${uc.min} to ${uc.max === Infinity ? 'no limit' : uc.max})` });
      else checks.push({ q: 'Q02', result: 'pass', note: `Within the range for "${i.unit}"` });
    }
    for (const c of checks) if (v[c.q]) count(v[c.q], c.result);
    if (checks.some((c) => c.result === 'fail')) { failed1++; if (notes1.length < 6) notes1.push(`${where(r.indicator_code, r.county_id, r.year)}: ${checks.find((c) => c.result === 'fail').note}`); }
    valid.push({ ...r, value, method, checks, unitClass: uc });
  }
  log.push({ stage: 'validate', title: 'Validate', checks: v, notes: notes1,
    summary: `${usable.length} rows read${rejectedAtIntake ? ` (${rejectedAtIntake} already set aside at intake)` : ''}; ${usable.length - failed1} passed, ${failed1} failed.` });

  // ---------------- 2 CLEAN: corrections recorded, duplicates in one batch resolved, originals kept (Q12)
  const corrections = valid.filter((r) => r.notes);
  const lastInBatch = new Map();
  for (const r of valid) {
    const k = r.batch_id + '|' + cellKey(r.indicator_code, r.county_id, r.year);
    const prev = lastInBatch.get(k);
    if (!prev || r.row_no > prev.row_no) lastInBatch.set(k, r);
  }
  const deduped = [...lastInBatch.values()];
  const dupes = valid.length - deduped.length;
  const q12 = tally();
  const noOriginal = new Set();
  for (const b of batches) { if (b.sha256) count(q12, 'pass'); else { count(q12, 'warn'); noOriginal.add(Number(b.id)); } }
  log.push({ stage: 'clean', title: 'Clean', checks: { Q12: q12 },
    notes: corrections.slice(0, 6).map((r) => `Row ${r.row_no} (${r.batch_ref || 'batch ' + r.batch_id}): ${r.notes}`),
    summary: `${corrections.length} corrections recorded (before and after kept)${dupes ? `; ${dupes} repeated rows in a batch replaced by the batch's last` : ''}; ${batches.length - noOriginal.size} of ${batches.length} original files kept with their fingerprint.` });

  // ---------------- 3 INTEGRATE: one value per indicator, place and year; sources compared (Q06), denominators (Q04)
  const byCell = new Map();
  for (const r of deduped) {
    const k = cellKey(r.indicator_code, r.county_id, r.year);
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(r);
  }
  const q6 = tally(), q4 = tally();
  const staged = [];
  for (const [k, list] of byCell) {
    const ordered = list.slice().sort((a, b) => String((batchById.get(Number(a.batch_id)) || {}).created_at).localeCompare(String((batchById.get(Number(b.batch_id)) || {}).created_at)) || a.id - b.id);
    const chosen = ordered[ordered.length - 1];
    const checks = chosen.checks.slice();
    const distinct = [...new Set(list.map((r) => Number(r.batch_id)))];
    const passing = list.filter((r) => !r.checks.some((c) => c.result === 'fail'));
    if (distinct.length > 1 && passing.length > 1) {
      const vals = passing.map((r) => r.value);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const agree = hi === 0 || (hi - lo) / Math.max(Math.abs(hi), 1e-9) <= 0.10;
      checks.push(agree
        ? { q: 'Q06', result: 'pass', note: `${distinct.length} sources agree within 10%` }
        : { q: 'Q06', result: 'warn', note: `Sources disagree: ${passing.map((r) => `${fmtN(r.value)} (${(batchById.get(Number(r.batch_id)) || {}).ref || r.batch_id})`).join(' and ')}. The latest batch is used; record the chosen source.` });
      count(q6, agree ? 'pass' : 'warn');
    }
    // Q04: a population denominator matches the agreed table
    const uc = chosen.unitClass;
    if (chosen.denominator != null && uc.popBase) {
      const agreed = pop.get(`${chosen.county_id ?? 'N'}|${chosen.year}`);
      if (agreed) {
        const off = Math.abs(chosen.denominator - agreed.value) / agreed.value;
        const c = off <= 0.02 ? { q: 'Q04', result: 'pass', note: `Denominator matches the agreed population (${agreed.source})` }
          : { q: 'Q04', result: 'warn', note: `Denominator ${fmtN(chosen.denominator)} differs by ${Math.round(off * 100)}% from the agreed population ${fmtN(agreed.value)} (${agreed.source})` };
        checks.push(c); count(q4, c.result);
      }
    }
    const b = chosen.batch_id;
    staged.push({
      indicator_code: chosen.indicator_code, county_id: chosen.county_id, year: chosen.year,
      value: chosen.value, numerator: chosen.numerator, denominator: chosen.denominator,
      method: chosen.method, batch_ids: distinct, raw_ids: list.map((r) => r.id),
      sources: [...new Set(list.map((r) => r.source || (batchById.get(Number(r.batch_id)) || {}).provider).filter(Boolean))].join('; ') || null,
      chosen_batch: b, checks, unitClass: uc,
    });
  }
  log.push({ stage: 'integrate', title: 'Integrate', checks: { Q06: q6, Q04: q4 },
    notes: staged.filter((s) => s.checks.some((c) => c.q === 'Q06' && c.result === 'warn')).slice(0, 6).map((s) => `${where(s.indicator_code, s.county_id, s.year)}: ${s.checks.find((c) => c.q === 'Q06').note}`),
    summary: `${deduped.length} rows matched to ${staged.length} indicator values (one per indicator, place and year)${q6.warn ? `; ${q6.warn} where sources disagree` : ''}.` });

  // ---------------- 4 TRANSFORM: national figures computed from the counties, never averaged (Q11)
  const groups = new Map();
  for (const s of staged) {
    const g = s.indicator_code + '|' + s.year;
    if (!groups.has(g)) groups.set(g, { code: s.indicator_code, year: s.year, counties: [], national: null });
    if (s.county_id == null) groups.get(g).national = s; else groups.get(g).counties.push(s);
  }
  const q11 = tally();
  const notes4 = [];
  let derived = 0;
  for (const g of groups.values()) {
    if (g.national || !g.counties.length) continue;
    const i = ind.get(g.code), uc = unitClass(i.unit);
    const label = `${i.name}, ${g.year}`;
    if (g.counties.length < NC) { notes4.push(`${label}: national not computed, ${g.counties.length} of ${NC} counties reported (Q01)`); continue; }
    if (g.counties.some((c) => sevOf(c.checks) === 'fail')) { count(q11, 'fail'); notes4.push(`${label}: national not computed, a county input failed its checks (Q11)`); continue; }
    let value = null, method = null, num = null, den = null;
    if (g.counties.every((c) => c.numerator != null && c.denominator != null) && !uc.additive) {
      num = g.counties.reduce((a, c) => a + c.numerator, 0); den = g.counties.reduce((a, c) => a + c.denominator, 0);
      value = (num / den) * (uc.scale || 1); method = 'ratio of county totals';
    } else if (uc.additive) {
      value = g.counties.reduce((a, c) => a + c.value, 0); method = `sum of ${NC} counties`;
    } else if (uc.popBase && g.counties.every((c) => pop.has(`${c.county_id}|${g.year}`))) {
      let w = 0, sw = 0;
      for (const c of g.counties) { const p = pop.get(`${c.county_id}|${g.year}`).value; w += c.value * p; sw += p; }
      value = w / sw; method = `population weighted (${pop.get(`${g.counties[0].county_id}|${g.year}`).source})`;
    } else {
      notes4.push(`${label}: national not computed; it needs numerators and denominators${uc.popBase ? ', or the agreed population table for ' + g.year : ''} (an average of county rates is never used)`);
      continue;
    }
    count(q11, 'pass'); derived++;
    g.national = {
      indicator_code: g.code, county_id: null, year: g.year, value: round(value, 6), numerator: num, denominator: den, method,
      batch_ids: [...new Set(g.counties.flatMap((c) => c.batch_ids))], raw_ids: g.counties.flatMap((c) => c.raw_ids),
      sources: [...new Set(g.counties.map((c) => c.sources).filter(Boolean))].join('; ') || null, derived: true, unitClass: uc,
      checks: [{ q: 'Q11', result: 'pass', note: `Computed from ${NC} county values that passed their checks: ${method}` }],
    };
    staged.push(g.national);
  }
  log.push({ stage: 'transform', title: 'Transform', checks: { Q11: q11 }, notes: notes4.slice(0, 8),
    summary: `${derived} national figures computed from county values${notes4.length ? `; ${notes4.length} not computed, with the reason recorded` : ''}. Missing values stay as no data.` });

  // ---------------- 5 ANALYSE: completeness (Q01), consistency (Q03), movement (Q05), outliers, small cells (Q09)
  const q1 = tally(), q3 = tally(), q5 = tally(), q9 = tally(), a1 = tally();
  const stagedMap = new Map(staged.map((s) => [cellKey(s.indicator_code, s.county_id, s.year), s]));
  for (const g of groups.values()) {
    const uc = unitClass(ind.get(g.code).unit);
    if (g.counties.length) {
      const all = g.counties.length >= NC;
      const c = all ? { q: 'Q01', result: 'pass', note: `All ${NC} counties present` }
        : { q: 'Q01', result: 'warn', note: `${g.counties.length} of ${NC} counties reporting; return to the provider for the others` };
      for (const s of g.counties.concat(g.national ? [g.national] : [])) { s.checks.push(c); count(q1, c.result); }
    }
    if (g.national && !g.national.derived && g.counties.length >= NC) {
      const vals = g.counties.map((c) => c.value);
      let c;
      if (uc.additive) {
        const sum = vals.reduce((a, x) => a + x, 0);
        c = Math.abs(g.national.value - sum) <= Math.max(1, Math.abs(sum) * 0.01) ? { q: 'Q03', result: 'pass', note: `National equals the sum of the counties (${fmtN(sum)})` }
          : { q: 'Q03', result: 'fail', note: `National ${fmtN(g.national.value)} is not the sum of the counties (${fmtN(sum)})` };
      } else if (uc.kind === 'share' || uc.kind === 'rate') {
        const lo = Math.min(...vals), hi = Math.max(...vals);
        c = g.national.value >= lo - 1e-9 && g.national.value <= hi + 1e-9 ? { q: 'Q03', result: 'pass', note: `National lies within the county range (${fmtN(lo)} to ${fmtN(hi)})` }
          : { q: 'Q03', result: 'fail', note: `National ${fmtN(g.national.value)} lies outside the county range (${fmtN(lo)} to ${fmtN(hi)})` };
      }
      if (c) { g.national.checks.push(c); count(q3, c.result); }
    }
    // a county far from the others (robust z-score on the median and its absolute deviation)
    if (g.counties.length >= 6) {
      const vals = g.counties.map((c) => c.value);
      const med = median(vals), mad = median(vals.map((x) => Math.abs(x - med)));
      if (mad > 0) for (const s of g.counties) {
        const z = 0.6745 * (s.value - med) / mad;
        if (Math.abs(z) > 3.5) { s.checks.push({ q: 'A1', result: 'warn', note: `Far ${z > 0 ? 'above' : 'below'} the other counties (median ${fmtN(med)})` }); count(a1, 'warn'); }
      }
    }
  }
  for (const s of staged) {
    const uc = s.unitClass;
    const prevStaged = stagedMap.get(cellKey(s.indicator_code, s.county_id, s.year - 1));
    const prevPub = pubMap.get(cellKey(s.indicator_code, s.county_id, s.year - 1));
    const prev = prevStaged ? prevStaged.value : prevPub ? prevPub.value : null;
    s.prev_year_value = prev;
    if (prev == null || s.value == null || uc.kind === 'growth') { s.checks.push({ q: 'Q05', result: 'n/a', note: uc.kind === 'growth' ? 'A growth rate: movement not tested' : `No figure for ${s.year - 1} to compare` }); count(q5, 'n/a'); }
    else {
      const d = s.value - prev, rel = prev !== 0 ? d / Math.abs(prev) : null;
      const big = uc.points ? (Math.abs(d) > 15 || (Math.abs(prev) >= 5 && rel != null && Math.abs(rel) > 0.5))
        : (rel == null ? d !== 0 : rel > 1 || rel < -0.5);
      const txt = `${d >= 0 ? '+' : ''}${fmtN(d)}${uc.points ? ' points' : ''}${rel != null ? ` (${rel >= 0 ? '+' : ''}${Math.round(rel * 100)}%)` : ''} from ${s.year - 1}`;
      const c = big ? { q: 'Q05', result: 'warn', note: `${txt}, beyond the threshold: publish only after written confirmation` } : { q: 'Q05', result: 'pass', note: `${txt}, within the threshold` };
      s.checks.push(c); count(q5, c.result);
    }
    if (s.denominator != null && s.denominator < 10 && !uc.additive) {
      s.checks.push({ q: 'Q09', result: 'warn', note: `Based on fewer than 10 (${fmtN(s.denominator)}): suppressed and marked` });
      s.suppressed = true; count(q9, 'warn');
    }
  }
  log.push({ stage: 'analyse', title: 'Analyse', checks: { Q01: q1, Q03: q3, Q05: q5, Q09: q9, A1: a1 },
    notes: staged.flatMap((s) => s.checks.filter((c) => (c.q === 'Q05' || c.q === 'Q03') && c.result !== 'pass' && c.result !== 'n/a').map((c) => `${where(s.indicator_code, s.county_id, s.year)}: ${c.note}`)).slice(0, 8),
    summary: `${q5.warn} large year-on-year movements, ${a1.warn} county outliers, ${q3.fail} consistency failures, ${q9.warn} small cells suppressed; ${q1.warn ? `${q1.warn} values come from incomplete county sets` : 'county sets complete'}.` });

  // ---------------- 6 ENRICH: coverage, source, method, provider sign-off (Q10), revision (Q12)
  const q10 = tally(), q12b = tally();
  for (const s of staged) {
    const g = groups.get(s.indicator_code + '|' + s.year);
    s.coverage = g && g.counties.length ? `${g.counties.length} of ${NC} counties reporting` : 'national figure only';
    const bs = s.batch_ids.map((id) => batchById.get(Number(id))).filter(Boolean);
    const needSign = bs.filter((b) => b.method !== 'open_data');
    let c10;
    if (!needSign.length) c10 = { q: 'Q10', result: 'n/a', note: 'An open, published source: no provider sign-off needed' };
    else if (needSign.every((b) => b.signoff_at)) c10 = { q: 'Q10', result: 'pass', note: `Signed off by ${[...new Set(needSign.map((b) => b.signoff_by || 'the provider'))].join(', ')}` };
    else c10 = { q: 'Q10', result: 'warn', note: 'Hold publication: the provider has not signed off this series yet' };
    s.checks.push(c10); count(q10, c10.result);
    const pub = pubMap.get(cellKey(s.indicator_code, s.county_id, s.year));
    s.published_value = pub ? pub.value : null;
    s.published_source = pub ? pub.source : null;
    if (pub && s.value != null && Math.abs(pub.value - s.value) > 1e-9) {
      const kept = bs.every((b) => b.sha256);
      const c = kept ? { q: 'Q12', result: 'pass', note: `Revises the published ${fmtN(pub.value)}; the revision is logged when released and the original file is kept` }
        : { q: 'Q12', result: 'fail', note: `Revises the published ${fmtN(pub.value)}, but the original file was not kept` };
      s.checks.push(c); count(q12b, c.result);
    }
    s.severity = sevOf(s.checks);
    s.status = s.suppressed ? 'suppressed' : 'draft';
    delete s.unitClass; delete s.chosen_batch; delete s.suppressed;
  }
  log.push({ stage: 'enrich', title: 'Enrich', checks: { Q10: q10, Q12: q12b },
    notes: [`Q08 Timeliness is not run yet: it needs data calls with deadlines.`],
    summary: `Coverage, source and method added to every value; ${q10.warn} wait for provider sign-off; ${q12b.pass + q12b.fail} revise a published figure.` });

  const sev = { ok: 0, warn: 0, fail: 0 };
  staged.forEach((s) => { sev[s.severity]++; });
  const stats = {
    batches: batches.length, rows: rows.length, rowsUsed: deduped.length, rowsRejected: rows.length - deduped.length,
    values: staged.length, derived, ok: sev.ok, warn: sev.warn, fail: sev.fail,
    indicators: new Set(staged.map((s) => s.indicator_code)).size,
    years: [...new Set(staged.map((s) => s.year))].sort(),
  };
  staged.sort((a, b) => a.indicator_code.localeCompare(b.indicator_code) || a.year - b.year || (a.county_id ?? -1) - (b.county_id ?? -1));
  return { staged, log, stats };
}

module.exports = { runPipeline, unitClass, CHECKS, CHECK_ACTION, sevOf };
