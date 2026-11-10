// niis/console.js: the NIIS console's routes, the system behind the site. Collect (Data Intake), Calculate
// (Process & Publish), Store (batches, raw rows, revisions, audit), Keep (reports and papers) and Output
// (release to the published store, generated reports). server.js hands every /admin/... request here first.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const intake = require('./intake');
const { runPipeline, CHECKS } = require('./pipeline');
const R = require('./report');
const V = require('./console-views');

class UserError extends Error {}
const chunk = (xs, n) => { const out = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };
const MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', json: 'application/json' };
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'report';
const nowIso = () => new Date().toISOString();

module.exports = function createConsole(d) {
  const { sdb, cache, views, send, json, redirect, parseForm, readBody, readBodyBuffer, hasPerm, refreshIndicators, refreshYears,
    getSetting, setSetting, parseMultipart, DOMAIN_LABELS, DOMAIN_ORDER, ROOT } = d;
  const RAW_DIR = path.join(ROOT, 'data', 'niis-raw');
  const REP_DIR = path.join(ROOT, 'data', 'niis-reports');
  const refs = () => intake.makeRefs({ indicators: cache.indicators, counties: cache.counties });
  const indName = (code) => (cache.indicatorByCode.get(code) || {}).name || code;
  const countyName = (id) => (id == null ? 'Liberia' : (cache.countyById.get(Number(id)) || {}).name || 'County ' + id);
  const page = (res, status, html) => send(res, status, html);
  const back = (res, to, notice) => redirect(res, to + (notice ? (to.includes('?') ? '&' : '?') + 'notice=' + encodeURIComponent(notice) : ''));

  // ---------------------------------------------------------------- the record of who did what
  const audit = (user, action, target, detail) => sdb.ins('niis_audit', [{
    user_id: user && user.id ? user.id : null, user_name: user ? user.name : null, action,
    target: target == null ? null : String(target).slice(0, 200), detail: detail || null,
  }]).catch((e) => console.error('[niis audit]', e.message));

  // ---------------------------------------------------------------- original files, kept unchanged
  const safeName = (n) => String(n || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '').slice(-80) || 'file';
  async function keepRaw(ref, name, buf, type) {
    const p = `${ref}/${safeName(name)}`;
    if (sdb.remoteFiles) { await sdb.storagePut('niis-raw', p, buf, type || 'application/octet-stream'); return 'storage:' + p; }
    fs.mkdirSync(path.join(RAW_DIR, ref), { recursive: true });
    fs.writeFileSync(path.join(RAW_DIR, p), buf, { flag: 'wx' });
    return 'disk:' + p;
  }
  async function readRaw(fp) {
    const i = String(fp || '').indexOf(':');
    if (i < 0) throw new Error('This batch has no original file.');
    const kind = fp.slice(0, i), p = fp.slice(i + 1);
    if (kind === 'storage') return sdb.storageGet('niis-raw', p);
    const full = path.resolve(RAW_DIR, p);
    if (!full.startsWith(RAW_DIR)) throw new Error('bad file path');
    return fs.readFileSync(full);
  }

  // ---------------------------------------------------------------- batches
  async function insertRows(batchId, rows) {
    for (const part of chunk(rows, 500)) await sdb.ins('niis_raw_rows', part.map((r) => ({ batch_id: batchId, ...r })));
  }
  const tallyRows = (rows) => rows.reduce((t, r) => { t[r.status] = (t[r.status] || 0) + 1; return t; }, {});
  async function dupOf(sha) {
    const hit = await sdb.sel(`niis_batches?select=id,ref&sha256=eq.${sha}&status=neq.archived&limit=1`);
    return hit[0] || null;
  }
  // the sheet NIIS can read best: fewest missing columns, then the most rows
  function pickSheet(sheets, r) {
    let best = 0, bestScore = -Infinity;
    sheets.forEach((s, i) => {
      const m = intake.detectMapping(s.rows, r);
      const score = -m.missing.length * 1000 + Math.min(s.rows.length, 999);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  function meltFor(layout, headers, cols, r) {
    const YEAR = /^((19|20)\d{2})(\s*\[yr\d{4}\])?$/i;
    if (layout === 'wide_year') return headers.map((h, i) => (YEAR.test(h) ? i : -1)).filter((i) => i >= 0);
    if (layout === 'wide_county') return headers.map((h, i) => { const m = intake.matchCounty(h, r); return m && m.level === 'county' ? i : -1; }).filter((i) => i >= 0);
    if (layout === 'wide_indicator') return headers.map((h, i) => (i !== cols.indicator && intake.matchIndicator(h, r) ? i : -1)).filter((i) => i >= 0);
    return [];
  }
  // a file, a paste or a link: kept, read, its columns recognised; it waits on its page for the mapping to be confirmed
  async function batchFromBuffer(user, { method, buf, fileName, title, provider, sourceUrl, signoffBy, sourceId }) {
    if (!buf || !buf.length) throw new UserError('There is nothing in that file.');
    if (buf.length > intake.MAX_BYTES) throw new UserError('That file is larger than 4 MB. Split it and send each part.');
    let table;
    try { table = intake.readTable(buf, fileName); } catch (e) { throw new UserError(e.message); }
    const r = refs();
    const si = pickSheet(table.sheets, r);
    const sheet = table.sheets[si];
    const m = intake.detectMapping(sheet.rows, r);
    const personal = [...new Set(table.sheets.flatMap((s) => intake.personalColumns((s.rows[intake.detectMapping(s.rows, r).headerRow] || []).map(String))))];
    if (personal.length) throw new UserError(`This file holds personal data (columns: ${personal.join(', ')}). NIIS takes aggregate figures only, never records about people (MOU Schedule 4, Q09). Remove those columns, or send the totals, and upload it again.`);
    const sha = intake.sha256(buf);
    const dup = await dupOf(sha);
    if (dup) throw new UserError(`This exact file was already received as batch ${dup.ref}. It was not added twice.`);
    const ref = intake.batchRef();
    const file_path = await keepRaw(ref, fileName, buf, MIME[table.kind]);
    const mapping = { sheet: si, sheets: table.sheets.map((s) => s.name), headerRow: m.headerRow, layout: m.layout, cols: m.cols, melt: m.melt, defaults: {}, source_id: sourceId || null };
    const [b] = await sdb.ins('niis_batches', [{
      ref, method, title: String(title || fileName || 'Untitled batch').slice(0, 160), provider: provider || null, source_url: sourceUrl || null,
      file_name: String(fileName || '').slice(0, 160), file_type: table.kind, file_path, sha256: sha, byte_size: buf.length, mapping, status: 'mapping',
      created_by: user && user.id ? user.id : null,
      ...(signoffBy ? { signoff_by: signoffBy.slice(0, 120), signoff_at: nowIso(), signoff_note: 'Recorded at intake' } : {}),
    }], true);
    audit(user, 'intake.' + method, b.ref, { title: b.title, file: b.file_name, bytes: buf.length, sha256: sha });
    return b;
  }
  // read the batch's file again with a mapping: the records and their resolution (for the preview and the commit)
  async function mapBatch(b, mapping) {
    const buf = await readRaw(b.file_path);
    const table = intake.readTable(buf, b.file_name);
    const sheet = table.sheets[mapping.sheet] || table.sheets[0];
    const headers = (sheet.rows[mapping.headerRow] || []).map((h) => String(h || '').trim());
    const r = refs();
    const m = { ...mapping, headers, melt: meltFor(mapping.layout, headers, mapping.cols, r) };
    const recs = intake.extractRecords(sheet.rows, m);
    const rows = recs.slice(0, 20000).map((x) => intake.resolve(x, r, mapping.defaults || {}));
    return { table, sheet, headers, mapping: m, rows, truncated: recs.length > 20000, missing: intake.missingRoles(m, mapping.defaults || {}) };
  }
  async function commitBatch(user, b, mapping) {
    const mb = await mapBatch(b, mapping);
    if (mb.missing.length) throw new UserError(`Say which column holds the ${mb.missing.join(' and the ')}, or give one for the whole batch.`);
    if (!mb.rows.length) throw new UserError('No rows were found under the header row.');
    await sdb.del('niis_raw_rows', `batch_id=eq.${b.id}`);
    await insertRows(b.id, mb.rows);
    const keep = { ...mapping, melt: mb.mapping.melt };
    await sdb.upd('niis_batches', `id=eq.${b.id}`, { status: 'received', row_count: mb.rows.length, mapping: keep });
    if (mapping.source_id) {
      const [src] = await sdb.sel(`niis_sources?select=id,config&id=eq.${Number(mapping.source_id)}`);
      if (src) await sdb.upd('niis_sources', `id=eq.${src.id}`, { config: { ...(src.config || {}), mapping: { ...keep, headers: mb.headers } } });
    }
    audit(user, 'intake.commit', b.ref, { rows: mb.rows.length, ...tallyRows(mb.rows) });
    return mb;
  }
  // structured rows (open data, a form, an API push, the portal): straight into raw data
  async function batchFromRecords(user, { method, title, provider, sourceUrl, records, defaults, original, originalName, signoffBy, mapping }) {
    const sha = intake.sha256(original);
    if (method !== 'form') { const dup = await dupOf(sha); if (dup) throw new UserError(`The same data was already received as batch ${dup.ref}.`); }
    const ref = intake.batchRef();
    const file_path = await keepRaw(ref, originalName, original, /\.json$/.test(originalName) ? MIME.json : MIME.csv);
    const r = refs();
    const rows = records.map((x) => intake.resolve(x, r, defaults || {}));
    const [b] = await sdb.ins('niis_batches', [{
      ref, method, title: String(title).slice(0, 160), provider: provider || null, source_url: sourceUrl || null, file_name: originalName,
      file_type: /\.json$/.test(originalName) ? 'json' : 'csv', file_path, sha256: sha, byte_size: original.length, mapping: mapping || { defaults },
      row_count: rows.length, status: 'received', created_by: user && user.id ? user.id : null,
      ...(signoffBy ? { signoff_by: signoffBy.slice(0, 120), signoff_at: nowIso(), signoff_note: 'Recorded at intake' } : {}),
    }], true);
    await insertRows(b.id, rows);
    audit(user, 'intake.' + method, b.ref, { title: b.title, rows: rows.length, ...tallyRows(rows) });
    return { batch: b, rows };
  }

  // the provider portal: pending submissions join the next run as one batch per submitter
  async function gatherPortal(user) {
    const subs = await sdb.sel('data_submissions?select=*&status=eq.pending&batch_id=is.null&order=id&limit=5000');
    const made = [];
    const bySubmitter = new Map();
    for (const s of subs) { const k = s.submitted_by || 0; if (!bySubmitter.has(k)) bySubmitter.set(k, []); bySubmitter.get(k).push(s); }
    for (const [, list] of bySubmitter) {
      const src = String(list[0].source || '');
      const provider = (/^Focal point: ([^·]+)/.exec(src) || [])[1] ? (/^Focal point: ([^·]+)/.exec(src) || [])[1].trim() : (src || 'Provider portal').slice(0, 80);
      const original = Buffer.from(JSON.stringify(list.map((s) => ({ submission: s.id, indicator: s.indicator_code, county_id: s.county_id, year: s.year, value: s.value, source: s.source, created_at: s.created_at })), null, 1));
      const ref = intake.batchRef();
      const file_path = await keepRaw(ref, 'portal-submissions.json', original, MIME.json);
      const [b] = await sdb.ins('niis_batches', [{ ref, method: 'portal', title: `Provider portal: ${provider}`, provider, file_name: 'portal-submissions.json', file_type: 'json',
        file_path, sha256: intake.sha256(original), byte_size: original.length, mapping: { portal: true }, row_count: list.length, status: 'received', created_by: user ? user.id : null }], true);
      await insertRows(b.id, list.map((s, i) => ({
        row_no: i + 1, indicator_text: s.indicator_code, indicator_code: cache.indicatorByCode.has(s.indicator_code) ? s.indicator_code : null,
        county_text: s.county_id ? countyName(s.county_id) : 'National', county_id: s.county_id || null, level: s.county_id ? 'county' : 'national',
        period_text: String(s.year), year: s.year, value_text: String(s.value), value: s.value, source: s.source, submission_id: s.id,
        status: cache.indicatorByCode.has(s.indicator_code) ? 'ok' : 'rejected', notes: cache.indicatorByCode.has(s.indicator_code) ? null : 'Indicator not in the catalogue',
      })));
      for (const ids of chunk(list.map((s) => s.id), 200)) await sdb.upd('data_submissions', `id=in.(${ids.join(',')})`, { batch_id: b.id, validation_note: `In NIIS batch ${b.ref}` });
      made.push(b);
    }
    return made;
  }

  // ---------------------------------------------------------------- Process new data
  async function processNew(user) {
    const portal = await gatherPortal(user);
    const batches = await sdb.sel('niis_batches?select=id,ref,method,provider,created_at,sha256,signoff_at,signoff_by&status=eq.received&order=created_at&limit=60');
    if (!batches.length) throw new UserError('There is no new data to process. Add data in Data Intake first.');
    const ids = batches.map((b) => b.id);
    let rows = [];
    for (const part of chunk(ids, 20)) {
      for (let off = 0; ; off += 10000) {
        const got = await sdb.sel(`niis_raw_rows?select=id,batch_id,row_no,indicator_code,county_id,level,year,value,numerator,denominator,unit_text,source,notes,status&batch_id=in.(${part.join(',')})&order=id&offset=${off}&limit=10000`);
        rows = rows.concat(got);
        if (got.length < 10000) break;
      }
    }
    const refById = new Map(batches.map((b) => [b.id, b.ref]));
    rows.forEach((r) => { r.batch_ref = refById.get(r.batch_id); });
    const codes = [...new Set(rows.filter((r) => r.indicator_code).map((r) => r.indicator_code))];
    const years = [...new Set(rows.filter((r) => r.year).flatMap((r) => [r.year, r.year - 1]))];
    let published = [];
    for (const part of chunk(codes, 30)) {
      if (!years.length) break;
      published = published.concat(await sdb.sel(`data_points?select=indicator_code,county_id,year,value,source&indicator_code=in.(${part.map(sdb.enc).join(',')})&year=in.(${years.join(',')})&limit=50000`));
    }
    const denominators = await sdb.sel('niis_denominators?select=county_id,year,kind,value,source');
    const [run] = await sdb.ins('niis_runs', [{ started_by: user ? user.id : null, batch_ids: ids, status: 'running' }], true);
    try {
      const out = runPipeline({ batches, rows, indicators: cache.indicators, counties: cache.counties, published, denominators });
      // a new value replaces any earlier one for the same cell still waiting (draft, approved or suppressed)
      const cells = new Set(out.staged.map((s) => `${s.indicator_code}|${s.county_id ?? 'N'}|${s.year}`));
      const supersede = [];
      for (const part of chunk(codes, 30)) {
        const open = await sdb.sel(`niis_staged?select=id,indicator_code,county_id,year&status=in.(draft,approved,suppressed)&indicator_code=in.(${part.map(sdb.enc).join(',')})&limit=50000`);
        open.forEach((o) => { if (cells.has(`${o.indicator_code}|${o.county_id ?? 'N'}|${o.year}`)) supersede.push(o.id); });
      }
      for (const part of chunk(supersede, 200)) await sdb.upd('niis_staged', `id=in.(${part.join(',')})`, { status: 'superseded' });
      for (const part of chunk(out.staged, 400)) {
        await sdb.ins('niis_staged', part.map((s) => ({
          run_id: run.id, indicator_code: s.indicator_code, county_id: s.county_id, year: s.year, value: s.value, numerator: s.numerator ?? null,
          denominator: s.denominator ?? null, published_value: s.published_value, published_source: s.published_source, prev_year_value: s.prev_year_value ?? null,
          method: s.method, coverage: s.coverage, sources: s.sources ? String(s.sources).slice(0, 500) : null, batch_ids: s.batch_ids, raw_ids: s.raw_ids,
          checks: s.checks, severity: s.severity, status: s.status,
        })));
      }
      for (const part of chunk(ids, 100)) await sdb.upd('niis_batches', `id=in.(${part.join(',')})`, { status: 'processed', processed_at: nowIso(), run_id: run.id });
      const stats = { ...out.stats, superseded: supersede.length, portalBatches: portal.length };
      await sdb.upd('niis_runs', `id=eq.${run.id}`, { status: 'done', finished_at: nowIso(), stats, log: out.log });
      audit(user, 'process.run', 'run ' + run.id, stats);
      return { run: { ...run, stats, log: out.log, status: 'done' } };
    } catch (e) {
      await sdb.upd('niis_runs', `id=eq.${run.id}`, { status: 'failed', finished_at: nowIso(), error: String(e.message).slice(0, 500) }).catch(() => {});
      throw e;
    }
  }

  // ---------------------------------------------------------------- approve, reject, release
  async function decide(user, ids, action, note) {
    if (!ids.length) throw new UserError('Tick the values first.');
    const rows = await sdb.sel(`niis_staged?select=id,severity,status,raw_ids,checks&id=in.(${ids.join(',')})`);
    const open = rows.filter((r) => ['draft', 'approved', 'suppressed'].includes(r.status));
    let done = 0, skipped = [];
    if (action === 'approve') {
      for (const r of open) {
        if (r.status === 'suppressed') { skipped.push('a suppressed cell stays unpublished'); continue; }
        if (r.severity === 'fail') { skipped.push('a value that failed a check can only be rejected'); continue; }
        if (r.severity === 'warn' && !note) { skipped.push('flagged values need a note (the written confirmation)'); continue; }
        await sdb.upd('niis_staged', `id=eq.${r.id}`, { status: 'approved', approved_by: user.id, approved_at: nowIso(), decision_note: note || null });
        done++;
      }
    } else if (action === 'reject') {
      const rej = open.map((r) => r.id);
      for (const part of chunk(rej, 200)) await sdb.upd('niis_staged', `id=in.(${part.join(',')})`, { status: 'rejected', decision_note: note || null, approved_by: user.id, approved_at: nowIso() });
      done = rej.length;
      const rawIds = open.flatMap((r) => r.raw_ids || []);
      await closeSubmissions(user, rawIds, 'rejected');
    } else if (action === 'reopen') {
      const re = rows.filter((r) => r.status === 'approved' || r.status === 'rejected').map((r) => r.id);
      for (const part of chunk(re, 200)) await sdb.upd('niis_staged', `id=in.(${part.join(',')})`, { status: 'draft', approved_by: null, approved_at: null });
      done = re.length;
    }
    audit(user, 'review.' + action, `${done} values`, { ids: ids.slice(0, 200), note: note || null });
    return { done, skipped: [...new Set(skipped)] };
  }
  async function closeSubmissions(user, rawIds, status) {
    const subIds = [];
    for (const part of chunk(rawIds, 200)) {
      const got = await sdb.sel(`niis_raw_rows?select=submission_id&id=in.(${part.join(',')})&submission_id=not.is.null`);
      got.forEach((g) => subIds.push(g.submission_id));
    }
    for (const part of chunk([...new Set(subIds)], 200)) await sdb.upd('data_submissions', `id=in.(${part.join(',')})`, { status, reviewed_by: user.id, reviewed_at: nowIso() });
  }
  async function release(user, ids) {
    const rule = getSetting('niis_release_rule') || 'two_person';
    let rows = await sdb.sel(`niis_staged?select=*&status=eq.approved${ids.length ? `&id=in.(${ids.join(',')})` : ''}&limit=5000`);
    if (!rows.length) throw new UserError('There are no approved values to release.');
    const skipped = [];
    if (rule === 'two_person') {
      const mine = rows.filter((r) => r.approved_by === user.id);
      if (mine.length) skipped.push(`${mine.length} you approved yourself: a second administrator must release them (two-person rule)`);
      rows = rows.filter((r) => r.approved_by !== user.id);
    }
    // Q10, checked again now: a sign-off recorded since the run counts
    const bIds = [...new Set(rows.flatMap((r) => r.batch_ids || []))];
    const bs = bIds.length ? await sdb.sel(`niis_batches?select=id,ref,method,signoff_at,provider&id=in.(${bIds.join(',')})`) : [];
    const bMap = new Map(bs.map((b) => [Number(b.id), b]));
    const held = rows.filter((r) => (r.batch_ids || []).some((id) => { const b = bMap.get(Number(id)); return b && b.method !== 'open_data' && !b.signoff_at; }));
    if (held.length) skipped.push(`${held.length} held until the provider signs off (Q10)`);
    rows = rows.filter((r) => !held.includes(r));
    if (!rows.length) throw new UserError('Nothing could be released: ' + skipped.join('; ') + '.');
    // what is published now, for the revision record (Q12)
    const codes = [...new Set(rows.map((r) => r.indicator_code))];
    const years = [...new Set(rows.map((r) => r.year))];
    let cur = [];
    for (const part of chunk(codes, 30)) cur = cur.concat(await sdb.sel(`data_points?select=indicator_code,county_id,year,value,source&indicator_code=in.(${part.map(sdb.enc).join(',')})&year=in.(${years.join(',')})&limit=50000`));
    const curMap = new Map(cur.map((c) => [`${c.indicator_code}|${c.county_id ?? 'N'}|${c.year}`, c]));
    const sourceOf = (r) => {
      const refsTxt = (r.batch_ids || []).map((id) => (bMap.get(Number(id)) || {}).ref).filter(Boolean).join(', ');
      return `NIIS release ${new Date().toISOString().slice(0, 10)} (${refsTxt})${r.sources ? ' · ' + r.sources : ''}`.slice(0, 300);
    };
    const payload = rows.map((r) => ({ indicator: r.indicator_code, county_id: r.county_id == null ? '' : r.county_id, year: r.year, value: r.value, source: sourceOf(r) }));
    for (const part of chunk(payload, 500)) await sdb.rpc('bulk_publish', { p_rows: part });
    const revisions = rows.map((r) => ({ r, c: curMap.get(`${r.indicator_code}|${r.county_id ?? 'N'}|${r.year}`) }))
      .filter(({ r, c }) => c && Math.abs(c.value - r.value) > 1e-9)
      .map(({ r, c }) => ({ indicator_code: r.indicator_code, county_id: r.county_id, year: r.year, old_value: c.value, new_value: r.value, old_source: c.source, new_source: sourceOf(r),
        staged_id: r.id, reason: r.decision_note || `Released from run ${r.run_id}`, released_by: user.id }));
    for (const part of chunk(revisions, 400)) await sdb.ins('niis_revisions', part);
    const rel = rows.map((r) => r.id);
    for (const part of chunk(rel, 200)) await sdb.upd('niis_staged', `id=in.(${part.join(',')})`, { status: 'released', released_by: user.id, released_at: nowIso() });
    const rawIds = rows.flatMap((r) => r.raw_ids || []);
    for (const part of chunk(rawIds, 200)) await sdb.upd('niis_raw_rows', `id=in.(${part.join(',')})`, { status: 'used' });
    await closeSubmissions(user, rawIds, 'approved');
    await Promise.all([refreshIndicators(), refreshYears()]);
    audit(user, 'release', `${rows.length} values`, { revisions: revisions.length, skipped });
    return { released: rows.length, revisions: revisions.length, skipped };
  }

  // ---------------------------------------------------------------- data for analytics and reports
  async function natSeries(code) { return sdb.sel(`data_points?select=year,value,source&indicator_code=eq.${sdb.enc(code)}&county_id=is.null&order=year`); }
  async function countyYear(code, year) {
    const rows = await sdb.sel(`data_points?select=county_id,value,source&indicator_code=eq.${sdb.enc(code)}&year=eq.${Number(year)}&county_id=not.is.null`);
    return rows.map((r) => ({ county: countyName(r.county_id), county_id: r.county_id, value: r.value, source: r.source }));
  }
  // the console's draft view: what the public would see if the waiting values were released
  async function draftOverlay(code) {
    return sdb.sel(`niis_staged?select=county_id,year,value,status&indicator_code=eq.${sdb.enc(code)}&status=in.(draft,approved)&order=id`);
  }
  // one row per indicator and year, read in pages: the API answers at most 1,000 rows at a time (the store has 1,344)
  async function coverage() {
    let out = [];
    try {
      for (let off = 0; off < 20000; off += 1000) {
        const got = await sdb.rpc(`niis_coverage?order=indicator_code,year&offset=${off}&limit=1000`);
        out = out.concat(got);
        if (got.length < 1000) break;
      }
    } catch (e) { console.error('[niis coverage]', e.message); }
    return out;
  }

  async function buildReport(kind, f) {
    const year = Number(f.year) || Math.max(...cache.years.map(Number).filter(Boolean));
    if (kind === 'indicator') {
      const ind = cache.indicatorByCode.get(f.indicator);
      if (!ind) throw new UserError('Choose an indicator.');
      return R.indicatorBrief({ ind, year, series: await natSeries(ind.code), counties: await countyYear(ind.code, year), domainLabel: DOMAIN_LABELS[ind.domain] });
    }
    if (kind === 'county') {
      const c = cache.countyById.get(Number(f.county_id));
      if (!c) throw new UserError('Choose a county.');
      const [mine, nat] = await Promise.all([
        sdb.sel(`data_points?select=indicator_code,year,value,source&county_id=eq.${c.id}&year=in.(${year},${year - 1})&limit=5000`),
        sdb.sel(`data_points?select=indicator_code,value,source&county_id=is.null&year=eq.${year}&limit=5000`),
      ]);
      const natMap = new Map(nat.map((n) => [n.indicator_code, n.value]));
      const cur = new Map(mine.filter((m) => m.year === year).map((m) => [m.indicator_code, m]));
      const prev = new Map(mine.filter((m) => m.year === year - 1).map((m) => [m.indicator_code, m.value]));
      const rows = cache.indicators.map((ind) => ({ ind, value: cur.has(ind.code) ? cur.get(ind.code).value : null, source: cur.has(ind.code) ? cur.get(ind.code).source : null,
        national: natMap.has(ind.code) ? natMap.get(ind.code) : null, prev: prev.has(ind.code) ? prev.get(ind.code) : null }));
      return R.countyProfile({ county: c.name, year, rows, domainLabels: DOMAIN_LABELS, domainOrder: DOMAIN_ORDER });
    }
    if (kind === 'domain') {
      const inds = cache.indicators.filter((i) => i.domain === f.domain);
      if (!inds.length) throw new UserError('Choose a domain.');
      const nat = await sdb.sel(`data_points?select=indicator_code,year,value,source&county_id=is.null&indicator_code=in.(${inds.map((i) => sdb.enc(i.code)).join(',')})&order=year&limit=5000`);
      const cov = await coverage();
      const items = inds.map((ind) => ({ ind, series: nat.filter((n) => n.indicator_code === ind.code), counties: Number((cov.find((c) => c.indicator_code === ind.code && c.year === year) || {}).counties || 0) }));
      return R.domainReport({ domain: f.domain, label: DOMAIN_LABELS[f.domain] || f.domain, year, items });
    }
    if (kind === 'annual') {
      const nat = await sdb.sel(`data_points?select=indicator_code,year,value,source&county_id=is.null&year=in.(${year},${year - 1})&limit=5000`);
      const cur = new Map(nat.filter((n) => n.year === year).map((n) => [n.indicator_code, n]));
      const prev = new Map(nat.filter((n) => n.year === year - 1).map((n) => [n.indicator_code, n.value]));
      const cov = await coverage();
      const counties = Math.max(0, ...cov.filter((c) => c.year === year).map((c) => Number(c.counties)));
      const domains = DOMAIN_ORDER.map((dm) => ({ label: DOMAIN_LABELS[dm], items: cache.indicators.filter((i) => i.domain === dm).map((ind) => ({
        ind, cur: cur.has(ind.code) ? cur.get(ind.code).value : null, source: cur.has(ind.code) ? cur.get(ind.code).source : null, prev: prev.has(ind.code) ? prev.get(ind.code) : null })) }))
        .filter((x) => x.items.length);
      return R.annualSummary({ year, domains, coverage: { counties } });
    }
    throw new UserError('Choose the kind of report.');
  }
  async function uniqueSlug(title) {
    const base = slugify(title);
    const taken = new Set((await sdb.sel(`niis_reports?select=slug&slug=like.${sdb.enc(base)}*`)).map((r) => r.slug));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }

  // published reports for the public ICT Reports page (cached for a minute)
  let pubCache = { at: 0, rows: [] };
  async function publishedReports() {
    if (Date.now() - pubCache.at < 60000) return pubCache.rows;
    try {
      const rows = await sdb.sel('niis_reports?select=id,slug,title,tag,period,summary,file_path,generated,published_on,created_at&status=eq.published&order=published_on.desc,id.desc');
      pubCache = { at: Date.now(), rows };
    } catch { pubCache = { at: Date.now(), rows: [] }; }
    return pubCache.rows;
  }
  async function reportBySlug(slug) {
    const rows = await sdb.sel(`niis_reports?select=*&slug=eq.${sdb.enc(slug)}&status=eq.published`).catch(() => []);
    return rows[0] || null;
  }
  function serveReportFile(res, name) {
    const full = path.resolve(REP_DIR, String(name || ''));
    if (!full.startsWith(REP_DIR) || !/\.pdf$/i.test(full) || !fs.existsSync(full)) return false;
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=3600' });
    res.end(fs.readFileSync(full));
    return true;
  }

  // ---------------------------------------------------------------- the provider API: POST /api/v1/intake
  const keyHash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
  async function apiIntake(req, res, p) {
    if (p !== '/api/v1/intake' && !p.startsWith('/api/v1/intake/')) return false;
    const auth = String(req.headers.authorization || '');
    const key = (/^Bearer\s+(niis_[a-f0-9]{40})$/i.exec(auth) || [])[1];
    const fail = (status, error) => { json(res, status, { ok: false, error }); return true; };
    if (!key) return fail(401, 'Send your NIIS key as: Authorization: Bearer niis_...');
    const [k] = await sdb.sel(`niis_api_keys?select=id,label,provider,revoked_at&key_hash=eq.${keyHash(key)}`);
    if (!k || k.revoked_at) return fail(401, 'This key is not valid or has been revoked.');
    sdb.upd('niis_api_keys', `id=eq.${k.id}`, { last_used_at: nowIso() }).catch(() => {});
    const actor = { id: null, name: 'API: ' + k.label };
    const st = /^\/api\/v1\/intake\/batch\/(B-\d{6}-[0-9A-F]{4})$/.exec(p);
    if (st && req.method === 'GET') {
      const [b] = await sdb.sel(`niis_batches?select=ref,status,row_count,created_at,processed_at,provider&ref=eq.${st[1]}`);
      if (!b || b.provider !== k.provider) return fail(404, 'No batch with that reference for this key.');
      const rows = await sdb.sel(`niis_raw_rows?select=status&batch_id=eq.${(await sdb.sel(`niis_batches?select=id&ref=eq.${b.ref}`))[0].id}`);
      json(res, 200, { ok: true, batch: b.ref, status: b.status, received: b.created_at, processed: b.processed_at, rows: tallyRows(rows) });
      return true;
    }
    if (p !== '/api/v1/intake' || req.method !== 'POST') return fail(405, 'POST rows to /api/v1/intake, or GET /api/v1/intake/batch/<reference>.');
    let buf;
    try { buf = await readBodyBuffer(req, intake.MAX_BYTES); } catch { return fail(413, 'The body is larger than 4 MB.'); }
    const ctype = String(req.headers['content-type'] || '');
    try {
      if (/json/.test(ctype)) {
        let body;
        try { body = JSON.parse(buf.toString('utf8')); } catch { return fail(400, 'The body is not valid JSON.'); }
        const list = Array.isArray(body) ? body : body.rows;
        if (!Array.isArray(list) || !list.length) return fail(400, 'Send {"title": "...", "rows": [{"indicator": "...", "county": "...", "year": 2025, "value": 12.3}]}');
        if (list.length > 20000) return fail(413, 'At most 20,000 rows per request.');
        const records = list.map((x, i) => ({
          row_no: i + 1, indicator_text: String(x.indicator ?? x.indicator_code ?? ''), county_text: String(x.county ?? x.location ?? 'National'),
          period_text: String(x.year ?? x.period ?? ''), value_text: x.value == null ? '' : String(x.value),
          numerator_text: x.numerator == null ? '' : String(x.numerator), denominator_text: x.denominator == null ? '' : String(x.denominator),
          unit_text: x.unit ? String(x.unit) : '', source: x.source ? String(x.source).slice(0, 200) : '', breakdown: x.breakdown ? String(x.breakdown) : '',
        }));
        const { batch, rows } = await batchFromRecords(actor, { method: 'api', title: String(body.title || `API push: ${k.provider}`), provider: k.provider, records, defaults: {}, original: buf, originalName: 'api-push.json' });
        const t = tallyRows(rows);
        json(res, 201, { ok: true, batch: batch.ref, status: 'received', rows: rows.length, accepted: (t.ok || 0) + (t.flagged || 0), rejected: t.rejected || 0,
          issues: rows.filter((r) => r.notes).slice(0, 100).map((r) => ({ row: r.row_no, status: r.status, notes: r.notes })) });
        return true;
      }
      const b = await batchFromBuffer(actor, { method: 'api', buf, fileName: 'api-push.csv', title: `API push: ${k.provider}`, provider: k.provider });
      const m = b.mapping;
      if (!intake.missingRoles(m).length) {
        const mb = await commitBatch(actor, b, m);
        const t = tallyRows(mb.rows);
        json(res, 201, { ok: true, batch: b.ref, status: 'received', rows: mb.rows.length, accepted: (t.ok || 0) + (t.flagged || 0), rejected: t.rejected || 0,
          issues: mb.rows.filter((r) => r.notes).slice(0, 100).map((r) => ({ row: r.row_no, status: r.status, notes: r.notes })) });
      } else json(res, 202, { ok: true, batch: b.ref, status: 'needs_mapping', missing: intake.missingRoles(m), note: 'The NIIS team will map the columns in the console.' });
      return true;
    } catch (e) {
      if (e instanceof UserError) return fail(422, e.message);
      console.error('[niis api]', e);
      return fail(500, 'The data could not be stored. Try again.');
    }
  }

  // ---------------------------------------------------------------- pages and actions
  async function counts() {
    const q = async (path) => { try { return (await sdb.sel(path)).length; } catch { return 0; } };
    const [batches, mapping, drafts, flagged, approved, pendingSubs, papers, requests] = await Promise.all([
      q('niis_batches?select=id&status=eq.received'), q('niis_batches?select=id&status=eq.mapping'),
      q('niis_staged?select=id&status=eq.draft'), q('niis_staged?select=id&status=eq.draft&severity=neq.ok'),
      q('niis_staged?select=id&status=eq.approved'), q('data_submissions?select=id&status=eq.pending&batch_id=is.null'),
      q('papers?select=id&status=eq.submitted&deleted=eq.false'), q('access_requests?select=id&status=eq.pending'),
    ]);
    let waitingRows = 0;
    try { const r = await sdb.sel('niis_batches?select=row_count&status=eq.received'); waitingRows = r.reduce((a, x) => a + (x.row_count || 0), 0); } catch {}
    const published = (await coverage()).reduce((a, x) => a + Number(x.total), 0);
    return { batches, mapping, drafts, flagged, approved, pendingSubs, papers, requests, waitingRows, published };
  }
  const intParam = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const idsFrom = (f) => String(f.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);

  async function handle(req, res, ctx, p, url) {
    const user = ctx.user;
    const notice = url.searchParams.get('notice') || '';
    const isPost = req.method === 'POST';
    const want = (path) => p === path;
    try {
      // ===== overview
      if (want('/admin') && !isPost) {
        const [c, batches, auditRows, cov, runs] = await Promise.all([
          counts(), sdb.sel('niis_batches?select=id,ref,title,method,provider,status,row_count,created_at&order=created_at.desc&limit=6'),
          sdb.sel('niis_audit?select=*&order=created_at.desc&limit=8'), coverage(),
          sdb.sel('niis_runs?select=id,started_at,status,stats&order=id.desc&limit=1'),
        ]);
        const total = cov.reduce((a, x) => a + Number(x.total), 0), demo = cov.reduce((a, x) => a + Number(x.demo), 0);
        const real = new Set(cov.filter((x) => Number(x.total) > Number(x.demo)).map((x) => x.indicator_code)).size;
        return page(res, 200, V.overview(ctx, { c, batches, auditRows, total, demo, real, indicators: cache.indicators.length, lastRun: runs[0], notice }));
      }

      // ===== Data Intake
      if (want('/admin/intake') && !isPost) {
        const [batches, sources, c, keys] = await Promise.all([
          sdb.sel('niis_batches?select=id,ref,title,method,provider,status,row_count,created_at,signoff_at&order=created_at.desc&limit=25'),
          sdb.sel('niis_sources?select=*&order=created_at.desc'), counts(), sdb.sel('niis_api_keys?select=id&revoked_at=is.null'),
        ]);
        return page(res, 200, V.intake(ctx, { batches, sources, c, keyCount: keys.length, indicators: cache.indicators, counties: cache.counties,
          domainLabels: DOMAIN_LABELS, domainOrder: DOMAIN_ORDER, wb: intake.WB_SUGGESTIONS, notice, tab: url.searchParams.get('tab') || 'file', origin: ctx.origin }));
      }
      if (want('/admin/intake/batches') && !isPost) {
        const st = url.searchParams.get('status') || '';
        const batches = await sdb.sel(`niis_batches?select=id,ref,title,method,provider,status,row_count,created_at,signoff_at,run_id&order=created_at.desc&limit=300${['mapping', 'received', 'processed', 'archived', 'failed'].includes(st) ? '&status=eq.' + st : ''}`);
        return page(res, 200, V.batches(ctx, { batches, status: st, notice }));
      }
      if (isPost && ['/admin/intake/upload', '/admin/intake/paste', '/admin/intake/link'].includes(p)) {
        let f = {}, buf = null, fileName = '';
        if (p === '/admin/intake/upload') {
          if ((+req.headers['content-length'] || 0) > intake.MAX_BYTES + 200000) { req.resume(); return back(res, '/admin/intake', 'That file is larger than 4 MB. Split it and send each part.'); }
          const parts = parseMultipart(await readBodyBuffer(req, intake.MAX_BYTES + 200000), req.headers['content-type']) || [];
          for (const q of parts) { if (q.filename == null) f[q.name] = q.data.toString('utf8'); else if (q.name === 'file' && q.data.length) { buf = q.data; fileName = String(q.filename).slice(0, 160); } }
          if (!buf) return back(res, '/admin/intake', 'Choose a file to upload.');
        } else f = parseForm(await readBody(req));
        const provider = String(f.provider || '').trim().slice(0, 120), signoffBy = f.signed === 'on' ? String(f.signoff_by || provider || 'the provider').trim() : '';
        let b;
        if (p === '/admin/intake/paste') {
          const text = String(f.text || '');
          if (!text.trim()) return back(res, '/admin/intake?tab=paste', 'Paste the cells first.');
          b = await batchFromBuffer(user, { method: 'paste', buf: Buffer.from(text, 'utf8'), fileName: 'pasted-cells.tsv', title: f.title || 'Pasted cells', provider, signoffBy });
        } else if (p === '/admin/intake/link') {
          const u = String(f.url || '').trim();
          if (!u) return back(res, '/admin/intake?tab=link', 'Give the link.');
          let got;
          try { got = await intake.safeFetch(u); } catch (e) { return back(res, '/admin/intake?tab=link', e.message); }
          let sourceId = null;
          if (f.keep === 'on') {
            const [src] = await sdb.ins('niis_sources', [{ name: String(f.title || got.name).slice(0, 120), kind: 'url', url: u, provider: provider || null, created_by: user.id }], true);
            sourceId = src.id;
          }
          b = await batchFromBuffer(user, { method: 'url', buf: got.buf, fileName: got.name, title: f.title || got.name, provider, sourceUrl: u, signoffBy, sourceId });
          if (sourceId) await sdb.upd('niis_sources', `id=eq.${sourceId}`, { last_pulled_at: nowIso(), last_sha256: b.sha256, last_status: 'Pulled into ' + b.ref });
        } else {
          b = await batchFromBuffer(user, { method: 'file', buf, fileName, title: f.title || fileName, provider, signoffBy });
        }
        return redirect(res, `/admin/intake/batch/${b.id}`);
      }
      if (isPost && want('/admin/intake/opendata')) {
        const f = parseForm(await readBody(req));
        const ind = cache.indicatorByCode.get(f.indicator);
        if (!ind) return back(res, '/admin/intake?tab=open', 'Choose the NIIS indicator the series feeds.');
        const series = String(f.series === 'other' ? f.series_other : f.series || '').trim();
        let wb;
        try { wb = await intake.worldBankSeries(series, Number(f.from) || 2010, Number(f.to) || new Date().getFullYear()); } catch (e) { return back(res, '/admin/intake?tab=open', e.message); }
        if (!wb.records.length) return back(res, '/admin/intake?tab=open', `The World Bank has no figures for ${wb.series} in Liberia for those years.`);
        const { batch } = await batchFromRecords(user, { method: 'open_data', title: `World Bank ${wb.series}: ${wb.name}`.slice(0, 160), provider: 'World Bank (WDI)', sourceUrl: wb.url,
          records: wb.records, defaults: { indicator: ind.code }, original: wb.raw, originalName: `worldbank-${wb.series}.json`, mapping: { series: wb.series, indicator: ind.code } });
        if (f.keep === 'on') await sdb.ins('niis_sources', [{ name: `World Bank ${wb.series} → ${ind.name}`.slice(0, 120), kind: 'world_bank', config: { series: wb.series, indicator: ind.code, from: Number(f.from) || 2010 },
          provider: 'World Bank (WDI)', last_pulled_at: nowIso(), last_sha256: batch.sha256, last_status: 'Pulled into ' + batch.ref, created_by: user.id }]);
        return redirect(res, `/admin/intake/batch/${batch.id}`);
      }
      if (isPost && want('/admin/intake/form')) {
        const f = parseForm(await readBody(req));
        if (!cache.indicatorByCode.get(f.indicator)) return back(res, '/admin/intake?tab=form', 'Choose an indicator.');
        const rec = { row_no: 1, indicator_text: f.indicator, county_text: f.county === 'national' || !f.county ? 'National' : countyName(f.county), period_text: String(f.year || ''),
          value_text: String(f.value || ''), numerator_text: String(f.numerator || ''), denominator_text: String(f.denominator || ''), unit_text: '', source: String(f.source || '').slice(0, 200), breakdown: '' };
        const original = Buffer.from(JSON.stringify({ entered_by: user.name, at: nowIso(), ...rec }, null, 1));
        const provider = String(f.provider || '').trim().slice(0, 120);
        const { batch, rows } = await batchFromRecords(user, { method: 'form', title: `Form entry: ${indName(f.indicator)}, ${rec.county_text} ${rec.period_text}`, provider,
          records: [rec], defaults: {}, original, originalName: 'form-entry.json', signoffBy: f.signed === 'on' ? String(f.signoff_by || provider || 'the provider') : '' });
        return back(res, '/admin/intake?tab=form', rows[0].status === 'rejected' ? `Added as ${batch.ref}, but the row was set aside: ${rows[0].notes}` : `Added as ${batch.ref}. It joins the next run.`);
      }
      const bm = /^\/admin\/intake\/batch\/(\d+)(?:\/(map|signoff|archive|discard|file))?$/.exec(p);
      if (bm) {
        const [b] = await sdb.sel(`niis_batches?select=*&id=eq.${Number(bm[1])}`);
        if (!b) return page(res, 404, views.notFound(ctx));
        const act = bm[2];
        if (act === 'file' && !isPost) {
          const buf = await readRaw(b.file_path);
          res.writeHead(200, { 'Content-Type': MIME[b.file_type] || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${safeName(b.file_name || b.ref)}"`, 'X-Content-Type-Options': 'nosniff' });
          res.end(buf);
          audit(user, 'batch.download', b.ref);
          return true;
        }
        if (isPost && act === 'map') {
          if (b.status !== 'mapping') return back(res, `/admin/intake/batch/${b.id}`, 'This batch is already in raw data.');
          const f = parseForm(await readBody(req));
          const col = (k) => (f['col_' + k] === '' || f['col_' + k] == null ? undefined : Number(f['col_' + k]));
          const mapping = {
            ...b.mapping, sheet: Number(f.sheet) || 0, headerRow: Math.max(0, (Number(f.header_row) || 1) - 1),
            layout: ['long', 'wide_year', 'wide_county', 'wide_indicator'].includes(f.layout) ? f.layout : 'long',
            cols: Object.fromEntries(['indicator', 'county', 'year', 'value', 'numerator', 'denominator', 'unit', 'source', 'breakdown'].map((k) => [k, col(k)]).filter(([, v]) => v != null)),
            defaults: { indicator: cache.indicatorByCode.has(f.def_indicator) ? f.def_indicator : undefined, year: intParam(f.def_year) || undefined,
              county: f.def_county === 'national' || !f.def_county ? 'national' : String(Number(f.def_county)), unit: f.def_unit || undefined, source: f.def_source || undefined },
          };
          if (f.sheet_changed === '1') {   // a different sheet: detect again from its own header
            const buf = await readRaw(b.file_path); const t = intake.readTable(buf, b.file_name); const s = t.sheets[mapping.sheet] || t.sheets[0];
            const m = intake.detectMapping(s.rows, refs());
            Object.assign(mapping, { headerRow: m.headerRow, layout: m.layout, cols: m.cols });
          }
          if (f.action === 'commit') {
            try { await commitBatch(user, b, mapping); } catch (e) {
              if (!(e instanceof UserError)) throw e;
              await sdb.upd('niis_batches', `id=eq.${b.id}`, { mapping });
              return back(res, `/admin/intake/batch/${b.id}`, e.message);
            }
            return back(res, `/admin/intake/batch/${b.id}`, 'Added to raw data. It joins the next run of Process new data.');
          }
          await sdb.upd('niis_batches', `id=eq.${b.id}`, { mapping });
          return redirect(res, `/admin/intake/batch/${b.id}#preview`);
        }
        if (isPost && act === 'signoff') {
          const f = parseForm(await readBody(req));
          const by = String(f.by || '').trim().slice(0, 120);
          if (!by) return back(res, `/admin/intake/batch/${b.id}`, 'Say who signed off the series.');
          await sdb.upd('niis_batches', `id=eq.${b.id}`, { signoff_by: by, signoff_at: nowIso(), signoff_note: String(f.note || '').slice(0, 500) || null });
          audit(user, 'batch.signoff', b.ref, { by, note: f.note || null });
          return back(res, `/admin/intake/batch/${b.id}`, 'Provider sign-off recorded (Q10). Its approved values can now be released.');
        }
        if (isPost && act === 'archive') {
          if (b.status === 'processed') return back(res, `/admin/intake/batch/${b.id}`, 'A processed batch stays on record. Reject its values in Process & Publish instead.');
          await sdb.upd('niis_batches', `id=eq.${b.id}`, { status: 'archived' });
          audit(user, 'batch.archive', b.ref);
          return back(res, '/admin/intake', `Batch ${b.ref} archived: kept on record, never processed.`);
        }
        if (isPost && act === 'discard') {
          if (b.status !== 'mapping') return back(res, `/admin/intake/batch/${b.id}`, 'Only a batch still being mapped can be discarded. Archive it instead.');
          await sdb.upd('niis_batches', `id=eq.${b.id}`, { status: 'archived', note: 'Discarded before mapping' });
          audit(user, 'batch.discard', b.ref);
          return back(res, '/admin/intake', `Batch ${b.ref} discarded before it entered raw data (its record and file are kept).`);
        }
        if (!isPost) {
          let preview = null, err = '';
          if (b.status === 'mapping') {
            try { preview = await mapBatch(b, b.mapping); } catch (e) { err = e.message; }
          }
          const st = url.searchParams.get('rows') || '';
          const rows = b.status === 'mapping' ? [] : await sdb.sel(`niis_raw_rows?select=*&batch_id=eq.${b.id}${['ok', 'flagged', 'rejected', 'used'].includes(st) ? '&status=eq.' + st : ''}&order=row_no&limit=500`);
          const all = b.status === 'mapping' ? [] : await sdb.sel(`niis_raw_rows?select=status&batch_id=eq.${b.id}`);
          const [creator] = b.created_by ? await sdb.sel(`users?select=name&id=eq.${b.created_by}`) : [];
          return page(res, 200, V.batch(ctx, { b, preview, err, rows, tally: tallyRows(all), rowFilter: st, creator: creator ? creator.name : null,
            indicators: cache.indicators, counties: cache.counties, domainLabels: DOMAIN_LABELS, domainOrder: DOMAIN_ORDER, notice }));
        }
      }
      const sm = /^\/admin\/intake\/source\/(\d+)\/(pull|toggle|delete)$/.exec(p);
      if (sm && isPost) {
        const [src] = await sdb.sel(`niis_sources?select=*&id=eq.${Number(sm[1])}`);
        if (!src) return page(res, 404, views.notFound(ctx));
        if (sm[2] === 'toggle') { await sdb.upd('niis_sources', `id=eq.${src.id}`, { active: !src.active }); return back(res, '/admin/intake?tab=sources', src.active ? 'Linked source paused.' : 'Linked source resumed.'); }
        if (sm[2] === 'delete') { await sdb.del('niis_sources', `id=eq.${src.id}`); audit(user, 'source.delete', src.name); return back(res, '/admin/intake?tab=sources', 'Linked source removed. Its batches stay on record.'); }
        try {
          let b;
          if (src.kind === 'world_bank') {
            const wb = await intake.worldBankSeries(src.config.series, src.config.from || 2010);
            if (intake.sha256(wb.raw) === src.last_sha256) { await sdb.upd('niis_sources', `id=eq.${src.id}`, { last_pulled_at: nowIso(), last_status: 'No change since the last pull' }); return back(res, '/admin/intake?tab=sources', `${src.name}: no change since the last pull.`); }
            ({ batch: b } = await batchFromRecords(user, { method: 'open_data', title: `World Bank ${wb.series}: ${wb.name}`.slice(0, 160), provider: src.provider, sourceUrl: wb.url, records: wb.records,
              defaults: { indicator: src.config.indicator }, original: wb.raw, originalName: `worldbank-${wb.series}.json`, mapping: { series: wb.series, indicator: src.config.indicator } }));
          } else {
            const got = await intake.safeFetch(src.url);
            if (intake.sha256(got.buf) === src.last_sha256) { await sdb.upd('niis_sources', `id=eq.${src.id}`, { last_pulled_at: nowIso(), last_status: 'No change since the last pull' }); return back(res, '/admin/intake?tab=sources', `${src.name}: no change since the last pull.`); }
            b = await batchFromBuffer(user, { method: 'url', buf: got.buf, fileName: got.name, title: src.name, provider: src.provider, sourceUrl: src.url, sourceId: src.id });
            // the mapping confirmed last time is used again when the columns are the same
            const saved = src.config && src.config.mapping;
            if (saved) {
              const t = intake.readTable(got.buf, got.name); const s = t.sheets[saved.sheet] || t.sheets[0];
              const heads = (s.rows[saved.headerRow] || []).map((h) => String(h || '').trim());
              if (JSON.stringify(heads) === JSON.stringify(saved.headers)) { try { await commitBatch(user, b, { ...saved, source_id: src.id }); } catch {} }
            }
          }
          await sdb.upd('niis_sources', `id=eq.${src.id}`, { last_pulled_at: nowIso(), last_sha256: b.sha256, last_status: 'Pulled into ' + b.ref });
          return redirect(res, `/admin/intake/batch/${b.id}`);
        } catch (e) {
          await sdb.upd('niis_sources', `id=eq.${src.id}`, { last_pulled_at: nowIso(), last_status: 'Failed: ' + String(e.message).slice(0, 160) });
          if (e instanceof UserError) return back(res, '/admin/intake?tab=sources', e.message);
          return back(res, '/admin/intake?tab=sources', `${src.name}: ${e.message}`);
        }
      }
      if (want('/admin/intake/denominators')) {
        if (isPost) {
          const f = parseForm(await readBody(req));
          if (f.action === 'delete') { await sdb.del('niis_denominators', `id=eq.${Number(f.id)}`); audit(user, 'denominator.delete', f.id); return back(res, '/admin/intake/denominators', 'Row removed.'); }
          const source = String(f.source || '').trim().slice(0, 200);
          if (!source) return back(res, '/admin/intake/denominators', 'Name the source of the table (for example the LISGIS census and its year).');
          const rows = intake.parseDelimited(f.csv || '').filter((r) => r.some((c) => c));
          const r = refs(); const ok = [], bad = [];
          for (const row of rows) {
            if (/county/i.test(row[0] || '') && /year/i.test(row[1] || '')) continue;
            const c = intake.matchCounty(row[0], r); const y = intake.parseYear(row[1]).year; const v = intake.parseNumber(row[2]).value;
            if (!c || !y || v == null || v <= 0) { bad.push(row.join(', ')); continue; }
            ok.push({ county_id: c.county_id, year: y, kind: ['population', 'adults', 'households'].includes(f.kind) ? f.kind : 'population', value: v, source, agreed_on: f.agreed_on || null, updated_at: nowIso() });
          }
          for (const x of ok) {
            await sdb.del('niis_denominators', `${x.county_id == null ? 'county_id=is.null' : 'county_id=eq.' + x.county_id}&year=eq.${x.year}&kind=eq.${x.kind}`);
          }
          if (ok.length) await sdb.ins('niis_denominators', ok);
          audit(user, 'denominators.load', source, { rows: ok.length, skipped: bad.length });
          return back(res, '/admin/intake/denominators', `${ok.length} rows saved${bad.length ? `; ${bad.length} not read: ${bad.slice(0, 3).join(' | ')}` : ''}.`);
        }
        const rows = await sdb.sel('niis_denominators?select=*&order=year.desc,county_id');
        return page(res, 200, V.denominators(ctx, { rows, counties: cache.counties, notice }));
      }

      // ===== Process & Publish
      if (want('/admin/process/run') && isPost) {
        const wantsJson = /json/.test(String(req.headers.accept || ''));
        try {
          const { run } = await processNew(user);
          if (wantsJson) { json(res, 200, { ok: true, run: { id: run.id, stats: run.stats, log: run.log } }); return true; }
          return redirect(res, `/admin/process/run/${run.id}`);
        } catch (e) {
          const msg = e instanceof UserError ? e.message : 'Processing stopped: ' + e.message;
          if (!(e instanceof UserError)) console.error('[niis process]', e);
          if (wantsJson) { json(res, e instanceof UserError ? 400 : 500, { ok: false, error: msg }); return true; }
          return back(res, '/admin/process', msg);
        }
      }
      if (want('/admin/process/decide') && isPost) {
        const f = parseForm(await readBody(req));
        const ret = String(f.back || '/admin/process').startsWith('/admin/process') ? f.back || '/admin/process' : '/admin/process';
        try {
          if (f.action === 'release') {
            const r = await release(user, idsFrom(f));
            return back(res, ret, `Released ${r.released} values to the published data${r.revisions ? `, ${r.revisions} of them revisions (logged)` : ''}.${r.skipped.length ? ' Not released: ' + r.skipped.join('; ') + '.' : ''}`);
          }
          const r = await decide(user, idsFrom(f), f.action, String(f.note || '').trim().slice(0, 1000));
          const verb = { approve: 'Approved', reject: 'Rejected', reopen: 'Reopened' }[f.action] || 'Updated';
          return back(res, ret, `${verb} ${r.done} values.${r.skipped.length ? ' Skipped: ' + r.skipped.join('; ') + '.' : ''}`);
        } catch (e) {
          if (e instanceof UserError) return back(res, ret, e.message);
          throw e;
        }
      }
      const rm = /^\/admin\/process\/run\/(\d+)$/.exec(p);
      if (rm && !isPost) {
        const [run] = await sdb.sel(`niis_runs?select=*&id=eq.${Number(rm[1])}`);
        if (!run) return page(res, 404, views.notFound(ctx));
        const batches = run.batch_ids && run.batch_ids.length ? await sdb.sel(`niis_batches?select=id,ref,title,method,row_count&id=in.(${run.batch_ids.join(',')})`) : [];
        const [by] = run.started_by ? await sdb.sel(`users?select=name&id=eq.${run.started_by}`) : [];
        return page(res, 200, V.run(ctx, { run, batches, by: by ? by.name : null, checks: CHECKS }));
      }
      if (want('/admin/process') && !isPost) {
        const status = ['draft', 'approved', 'released', 'rejected', 'suppressed', 'superseded'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'draft';
        const sev = ['ok', 'warn', 'fail'].includes(url.searchParams.get('sev')) ? url.searchParams.get('sev') : '';
        const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
        const run = intParam(url.searchParams.get('run'));
        const codes = q ? cache.indicators.filter((i) => i.name.toLowerCase().includes(q) || i.code.includes(q)).map((i) => i.code).slice(0, 60) : null;
        const filter = `status=eq.${status}${sev ? '&severity=eq.' + sev : ''}${run ? '&run_id=eq.' + run : ''}${codes ? (codes.length ? `&indicator_code=in.(${codes.map(sdb.enc).join(',')})` : '&indicator_code=eq.__none__') : ''}`;
        const [values, c, runs, tabCounts, approvers] = await Promise.all([
          sdb.sel(`niis_staged?select=*&${filter}&order=indicator_code,year,county_id.nullsfirst&limit=600`),
          counts(), sdb.sel('niis_runs?select=id,started_at,finished_at,status,stats,started_by&order=id.desc&limit=8'),
          Promise.all(['draft', 'approved', 'released', 'rejected', 'suppressed'].map(async (s) => [s, (await sdb.sel(`niis_staged?select=id&status=eq.${s}&limit=10000`)).length])),
          sdb.sel('users?select=id,name&role=eq.admin'),
        ]);
        return page(res, 200, V.process(ctx, { values, c, runs, tabCounts: Object.fromEntries(tabCounts), status, sev, q: url.searchParams.get('q') || '', run,
          rule: getSetting('niis_release_rule') || 'two_person', approvers: new Map(approvers.map((a) => [a.id, a.name])), checks: CHECKS, notice }));
      }

      // ===== Data Analytics
      if (want('/admin/analytics') && !isPost) {
        const years = cache.years.map(Number).filter(Boolean).sort((a, b) => a - b);
        const code = cache.indicatorByCode.has(url.searchParams.get('ind')) ? url.searchParams.get('ind') : (cache.indicators.find((i) => i.code === 'internet_penetration') || cache.indicators[0]).code;
        const year = years.includes(Number(url.searchParams.get('year'))) ? Number(url.searchParams.get('year')) : years[years.length - 1];
        const drafts = url.searchParams.get('drafts') === '1';
        const [cov, series0, counties0, overlay, quality, runs, revisions] = await Promise.all([
          coverage(), natSeries(code), countyYear(code, year), drafts ? draftOverlay(code) : [],
          sdb.sel('niis_staged?select=severity,status,checks&order=id.desc&limit=3000').catch(() => []),
          sdb.sel('niis_runs?select=id,started_at,stats&status=eq.done&order=id.desc&limit=12').catch(() => []),
          sdb.sel('niis_revisions?select=*&order=id.desc&limit=8').catch(() => []),
        ]);
        let series = series0, counties = counties0;
        if (drafts && overlay.length) {
          const ns = new Map(series.map((s) => [s.year, { ...s }]));
          overlay.filter((o) => o.county_id == null).forEach((o) => ns.set(o.year, { year: o.year, value: o.value, draft: true }));
          series = [...ns.values()].sort((a, b) => a.year - b.year);
          const cm = new Map(counties.map((x) => [x.county_id, { ...x }]));
          overlay.filter((o) => o.county_id != null && o.year === year).forEach((o) => cm.set(o.county_id, { county: countyName(o.county_id), county_id: o.county_id, value: o.value, draft: true }));
          counties = [...cm.values()];
        }
        return page(res, 200, V.analytics(ctx, { ind: cache.indicatorByCode.get(code), year, years, drafts, series, counties, cov, quality, runs, revisions, checks: CHECKS,
          indicators: cache.indicators, domainLabels: DOMAIN_LABELS, domainOrder: DOMAIN_ORDER, overlayCount: overlay.length }));
      }

      // ===== ICT Reports
      if (want('/admin/reports') && !isPost) {
        const list = await sdb.sel('niis_reports?select=id,slug,title,tag,period,status,generated,file_path,updated_at,published_on&order=updated_at.desc');
        return page(res, 200, V.reports(ctx, { list, builtIn: views.builtInReports ? views.builtInReports() : [], indicators: cache.indicators, counties: cache.counties,
          domainLabels: DOMAIN_LABELS, domainOrder: DOMAIN_ORDER, years: cache.years.map(Number).filter(Boolean).sort((a, b) => b - a), kinds: R.KINDS,
          pre: { kind: url.searchParams.get('kind') || '', indicator: url.searchParams.get('ind') || '', year: url.searchParams.get('year') || '' }, notice }));
      }
      if (want('/admin/reports/generate') && isPost) {
        const f = parseForm(await readBody(req));
        let r;
        try { r = await buildReport(f.kind, f); } catch (e) { if (e instanceof UserError) return back(res, '/admin/reports', e.message); throw e; }
        const slug = await uniqueSlug(r.title);
        const [row] = await sdb.ins('niis_reports', [{ slug, title: r.title, tag: r.tag, period: r.period, summary: r.summary.slice(0, 1200), body: r.body, generated: true,
          params: { kind: f.kind, indicator: f.indicator || null, county_id: f.county_id || null, domain: f.domain || null, year: f.year || null, demo: r.demo }, status: 'draft', created_by: user.id }], true);
        audit(user, 'report.generate', row.title, { kind: f.kind });
        return back(res, `/admin/reports/${row.id}`, 'Report generated as a draft. Read it through, then publish it.');
      }
      if (want('/admin/reports/upload') && isPost) {
        if ((+req.headers['content-length'] || 0) > intake.MAX_BYTES + 200000) { req.resume(); return back(res, '/admin/reports', 'That PDF is larger than 4 MB.'); }
        const parts = parseMultipart(await readBodyBuffer(req, intake.MAX_BYTES + 200000), req.headers['content-type']) || [];
        const f = {}; let file = null;
        for (const q of parts) { if (q.filename == null) f[q.name] = q.data.toString('utf8'); else if (q.name === 'file' && q.data.length) file = q; }
        if (!file || file.data.slice(0, 5).toString('latin1') !== '%PDF-') return back(res, '/admin/reports', 'Choose a PDF file.');
        const title = String(f.title || '').trim();
        if (!title) return back(res, '/admin/reports', 'Give the report a title.');
        const slug = await uniqueSlug(title);
        const name = `${slug}-${crypto.randomBytes(3).toString('hex')}.pdf`;
        let file_path;
        if (sdb.remoteFiles) { await sdb.storagePut('niis-reports', name, file.data, 'application/pdf'); file_path = sdb.storagePublicUrl('niis-reports', name); }
        else { fs.mkdirSync(REP_DIR, { recursive: true }); fs.writeFileSync(path.join(REP_DIR, name), file.data); file_path = '/reports/file/' + name; }
        const [row] = await sdb.ins('niis_reports', [{ slug, title: title.slice(0, 200), tag: String(f.tag || 'Report').slice(0, 60), period: String(f.period || '').slice(0, 40) || null,
          summary: String(f.summary || '').slice(0, 1200) || null, file_path, generated: false, status: 'draft', created_by: user.id, params: { file: file.filename, sha256: intake.sha256(file.data) } }], true);
        audit(user, 'report.upload', row.title, { bytes: file.data.length });
        return back(res, `/admin/reports/${row.id}`, 'PDF uploaded as a draft. Publish it when ready.');
      }
      const rpm = /^\/admin\/reports\/(\d+)(?:\/(update|publish|hide|delete))?$/.exec(p);
      if (rpm) {
        const [r] = await sdb.sel(`niis_reports?select=*&id=eq.${Number(rpm[1])}`);
        if (!r) return page(res, 404, views.notFound(ctx));
        const act = rpm[2];
        if (isPost) {
          const f = parseForm(await readBody(req));
          if (act === 'update') {
            await sdb.upd('niis_reports', `id=eq.${r.id}`, { title: String(f.title || r.title).trim().slice(0, 200), tag: String(f.tag || r.tag).slice(0, 60), period: String(f.period || '').slice(0, 40) || null,
              summary: String(f.summary || '').slice(0, 1200) || null, updated_at: nowIso() });
            audit(user, 'report.update', r.title);
            return back(res, `/admin/reports/${r.id}`, 'Saved.');
          }
          if (act === 'publish') { await sdb.upd('niis_reports', `id=eq.${r.id}`, { status: 'published', published_on: r.published_on || nowIso().slice(0, 10), updated_at: nowIso() }); pubCache.at = 0; audit(user, 'report.publish', r.title); return back(res, `/admin/reports/${r.id}`, 'Published on the ICT Reports page.'); }
          if (act === 'hide') { await sdb.upd('niis_reports', `id=eq.${r.id}`, { status: 'hidden', updated_at: nowIso() }); pubCache.at = 0; audit(user, 'report.hide', r.title); return back(res, `/admin/reports/${r.id}`, 'Hidden from the public site.'); }
          if (act === 'delete') {
            if (r.status === 'published') return back(res, `/admin/reports/${r.id}`, 'Hide the report before deleting it.');
            await sdb.del('niis_reports', `id=eq.${r.id}`); pubCache.at = 0; audit(user, 'report.delete', r.title);
            return back(res, '/admin/reports', 'Report deleted.');
          }
        } else return page(res, 200, V.report(ctx, { r, notice }));
      }

      // ===== Research Papers
      if (want('/admin/papers') && !isPost) {
        const papers = await sdb.sel('papers?select=id,title,authors,tag,published_on,status,visible,deleted,downloadable,submitter_name,submitter_email,submitter_org,created_at,abstract&order=created_at.desc');
        return page(res, 200, V.papers(ctx, { papers, tab: url.searchParams.get('tab') || '', notice }));
      }

      // ===== Submissions
      if (want('/admin/submissions') && !isPost) {
        const tab = url.searchParams.get('tab') || 'data';
        const [data0, papers, requests, apps, inbox] = await Promise.all([
          sdb.sel('data_submissions?select=*&order=created_at.desc&limit=300').catch(() => []),
          sdb.sel('papers?select=id,title,authors,submitter_name,submitter_email,submitter_org,created_at,status&status=eq.submitted&deleted=eq.false&order=created_at.desc'),
          sdb.sel('access_requests?select=*&order=created_at.desc&limit=200'),
          sdb.sel('job_applications?select=id,created_at,reference,role_title,full_name,email,phone,county,cover_note,cv_original_name,status&order=created_at.desc&limit=300').catch(() => null),
          sdb.sel('admin_inbox?select=*&order=updated_at.desc&limit=200').catch(() => []),
        ]);
        const data = data0.map((s) => ({ ...s, indicator_name: indName(s.indicator_code), county_name: s.county_id ? countyName(s.county_id) : 'National' }));
        const batchIds = [...new Set(data.map((s) => s.batch_id).filter(Boolean))];
        const bRefs = batchIds.length ? await sdb.sel(`niis_batches?select=id,ref&id=in.(${batchIds.join(',')})`) : [];
        return page(res, 200, V.submissions(ctx, { tab, data, batchRef: new Map(bRefs.map((b) => [b.id, b])), papers, requests, apps, inbox, notice }));
      }
      const am = /^\/admin\/applications\/([0-9a-f-]{36})\/(status|cv)$/.exec(p);
      if (am) {
        const [a] = await sdb.sel(`job_applications?select=*&id=eq.${am[1]}`);
        if (!a) return page(res, 404, views.notFound(ctx));
        if (am[2] === 'status' && isPost) {
          const f = parseForm(await readBody(req));
          if (['new', 'reviewing', 'shortlisted', 'declined', 'hired'].includes(f.status)) await sdb.upd('job_applications', `id=eq.${a.id}`, { status: f.status });
          audit(user, 'application.status', a.reference, { status: f.status });
          return back(res, '/admin/submissions?tab=jobs', `${a.reference}: ${f.status}.`);
        }
        if (am[2] === 'cv' && !isPost) {
          let buf;
          try { buf = sdb.remoteFiles ? await sdb.storageGet('applications', 'cv/' + a.cv_file) : fs.readFileSync(path.join(ROOT, 'data', 'applications', path.basename(a.cv_file))); }
          catch { return back(res, '/admin/submissions?tab=jobs', 'That CV file could not be found.'); }
          const ext = (/\.([a-z]+)$/.exec(a.cv_file) || [])[1] || 'pdf';
          const type = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${safeName((a.full_name || 'cv') + '-' + a.reference + '.' + ext)}"`, 'X-Content-Type-Options': 'nosniff' });
          res.end(buf);
          audit(user, 'application.cv', a.reference);
          return true;
        }
      }

      // ===== Users
      if (want('/admin/users') && !isPost) {
        const [users, requests] = await Promise.all([
          sdb.sel('users?select=id,email,name,organization,role,status,created_at&order=status.desc,created_at.desc'),
          sdb.sel('access_requests?select=*&status=eq.pending&order=created_at'),
        ]);
        return page(res, 200, V.users(ctx, { users, requests, parts: views.adminParts, notice }));
      }

      // ===== Content Studio
      if (want('/admin/studio') && !isPost) {
        const [papersList, updatesList, mediaList, generations] = await Promise.all([
          sdb.sel('papers?select=id,title,published_on,tag&order=published_on.desc'),
          sdb.sel('updates?select=id,title,category,published_on&order=published_on.desc'),
          sdb.sel('media?select=id,title,kind,access_level&order=kind,id'),
          sdb.sel('media_generations?select=id,prompt,model,quality_tier,status,local_path,created_at&order=created_at.desc&limit=8'),
        ]);
        return page(res, 200, V.studio(ctx, { parts: views.adminParts, data: { indicators: cache.indicators.map(({ code, name, unit }) => ({ code, name, unit })), siteContent: d.siteContent(),
          updatesList, papersList, mediaList, generations, seedanceReady: d.seedanceReady() }, notice }));
      }

      // ===== Settings & Audit
      if (want('/admin/settings') && !isPost) {
        const keys = await sdb.sel('niis_api_keys?select=*&order=created_at.desc');
        return page(res, 200, V.settings(ctx, { parts: views.adminParts, settings: d.policySettings(), rolePerms: cache.rolePermRows || [], rule: getSetting('niis_release_rule') || 'two_person', keys, notice }));
      }
      if (want('/admin/settings/niis') && isPost) {
        if (!hasPerm(user, 'manage_settings')) return page(res, 403, views.forbidden(ctx));
        const f = parseForm(await readBody(req));
        if (['two_person', 'one_person'].includes(f.release_rule)) { await setSetting('niis_release_rule', f.release_rule); audit(user, 'settings.release_rule', f.release_rule); }
        return back(res, '/admin/settings', 'Release rule saved.');
      }
      if (want('/admin/settings/apikey') && isPost) {
        if (!hasPerm(user, 'manage_settings')) return page(res, 403, views.forbidden(ctx));
        const f = parseForm(await readBody(req));
        if (f.action === 'revoke') {
          await sdb.upd('niis_api_keys', `id=eq.${Number(f.id)}`, { revoked_at: nowIso() });
          audit(user, 'apikey.revoke', f.id);
          return back(res, '/admin/settings#api', 'Key revoked. Anything using it is now refused.');
        }
        const label = String(f.label || '').trim().slice(0, 80), provider = String(f.provider || '').trim().slice(0, 120);
        if (!label || !provider) return back(res, '/admin/settings#api', 'Give the key a label and the provider it is for.');
        const key = 'niis_' + crypto.randomBytes(20).toString('hex');
        await sdb.ins('niis_api_keys', [{ label, provider, key_prefix: key.slice(0, 11), key_hash: keyHash(key), created_by: user.id }]);
        audit(user, 'apikey.create', label, { provider });
        const keys = await sdb.sel('niis_api_keys?select=*&order=created_at.desc');
        // shown once, in this response only: never in a link, never stored
        return page(res, 200, V.settings(ctx, { parts: views.adminParts, settings: d.policySettings(), rolePerms: cache.rolePermRows || [], rule: getSetting('niis_release_rule') || 'two_person', keys,
          newKey: { key, label, provider }, notice: '' }));
      }
      if (want('/admin/audit') && !isPost) {
        const who = intParam(url.searchParams.get('user'));
        const rows = await sdb.sel(`niis_audit?select=*${who ? '&user_id=eq.' + who : ''}&order=created_at.desc&limit=400`);
        return page(res, 200, V.audit(ctx, { rows }));
      }
    } catch (e) {
      if (e instanceof UserError) {
        const to = p.startsWith('/admin/intake') ? '/admin/intake' + (p.includes('paste') ? '?tab=paste' : p.includes('link') ? '?tab=link' : '') : '/admin';
        return back(res, to, e.message);
      }
      throw e;
    }
    return false;
  }

  return { handle, apiIntake, publishedReports, reportBySlug, serveReportFile, audit, counts };
};
