// niis/console-views.js: the NIIS console's pages, in the workspace's Hushkey design (public/rg/ws.css) with its
// own parts in public/rg/console.css. Operate mode: every page answers "what is waiting, and what do I do next".
'use strict';
const K = require('../views')._kit;
const A = require('./analytics');
const { CHECK_ACTION } = require('./pipeline');

const { esc, icon, fmt, fmtTs } = K;
const V = () => K.ASSET_V();
const HEAD = () => `<link rel="stylesheet" href="/assets/rg/console.css?v=${V()}"><link rel="stylesheet" href="/assets/rg/report.css?v=${V()}"><script src="/assets/console.js?v=${V()}" defer></script>`;
const shell = (ctx, { title, active, body }) => K.appLayout(ctx, { title, active, body, extraHead: HEAD() });
const head = ({ kicker = 'NIIS System', title, lede = '', actions = '' }) => `${K.wsSeal}
  <div class="cx-head"><div><p class="kicker">${esc(kicker)}</p><h1>${esc(title)}</h1>${lede ? `<p class="lede-sm">${lede}</p>` : ''}</div>${actions ? `<div class="cx-actions">${actions}</div>` : ''}</div>`;
const ERR = /^(Choose|Give|Say|Name|Paste|Tick|That |This |There is no|Nothing|Only|Hide|A processed|The link|The World Bank|The file|Processing stopped|No rows|Not released|.*could not|.*not valid|.*larger than)/;
const noticeHtml = (n) => (n ? `<div class="alert ${ERR.test(n) ? 'alert-error' : 'alert-ok'}" role="status">${esc(n)}</div>` : '');
const tabs = (items, on) => `<nav class="cx-tabs" aria-label="Sections">${items.map(([key, href, label, n]) => `<a class="cx-tab${key === on ? ' on' : ''}" href="${esc(href)}"${key === on ? ' aria-current="page"' : ''}>${esc(label)}${n != null ? `<span class="n">${fmt(n)}</span>` : ''}</a>`).join('')}</nav>`;
const empty = (text, action = '') => `<div class="cx-empty"><p>${text}</p>${action}</div>`;
const pill = (cls, text) => `<span class="cx-pill cx-${cls}">${esc(text)}</span>`;
const kv = (pairs) => `<dl class="cx-meta">${pairs.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const kpis = (items) => `<div class="kpi-grid">${items.map((k) => `<${k.href ? `a href="${esc(k.href)}"` : 'div'} class="kpi${k.href ? ' cx-kpi-link' : ''}"><span class="kpi-label">${esc(k.label)}</span><p class="kpi-value"${k.hot ? ' style="color:var(--hk-7)"' : ''}>${k.value}</p>${k.note ? `<span class="cx-kpi-note">${esc(k.note)}</span>` : ''}</${k.href ? 'a' : 'div'}>`).join('')}</div>`;
const METHOD = { file: 'File upload', paste: 'Pasted cells', url: 'Link', open_data: 'Open data', api: 'Provider API', form: 'Form entry', portal: 'Provider portal' };
const BATCH_STATUS = { mapping: ['warn', 'Columns to confirm'], received: ['info', 'Waiting to process'], processed: ['ok', 'Processed'], failed: ['fail', 'Failed'], archived: ['mute', 'Archived'] };
const VALUE_STATUS = { draft: ['info', 'Draft'], approved: ['ok', 'Approved'], released: ['ok', 'Released'], rejected: ['fail', 'Rejected'], suppressed: ['mute', 'Suppressed'], superseded: ['mute', 'Superseded'] };
const SEV = { ok: ['ok', 'Clean'], warn: ['warn', 'Flagged'], fail: ['fail', 'Failed'] };
const ROW_STATUS = { ok: ['ok', 'Read'], flagged: ['warn', 'Read, corrected'], rejected: ['fail', 'Set aside'], used: ['ok', 'Published'], new: ['info', 'New'] };
const bpill = (s) => pill(...(BATCH_STATUS[s] || ['mute', s]));
const vpill = (s) => pill(...(VALUE_STATUS[s] || ['mute', s]));
const placeOf = (ctxCounties, id) => (id == null ? 'Liberia' : (ctxCounties.find((c) => c.id === Number(id)) || {}).name || 'County ' + id);
const kb = (n) => (n == null ? '' : n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const indOptions = (indicators, domainLabels, domainOrder, sel = '', blank = '') => {
  const by = {};
  indicators.forEach((i) => (by[i.domain] = by[i.domain] || []).push(i));
  return (blank ? `<option value="">${esc(blank)}</option>` : '') + domainOrder.filter((d) => by[d]).map((d) => `<optgroup label="${esc(domainLabels[d] || d)}">${by[d].slice().sort((a, b) => a.name.localeCompare(b.name)).map((i) => `<option value="${esc(i.code)}"${i.code === sel ? ' selected' : ''}>${esc(i.name)}</option>`).join('')}</optgroup>`).join('');
};
const countyOptions = (counties, sel = 'national', national = 'National (Liberia)') => `<option value="national"${sel === 'national' ? ' selected' : ''}>${esc(national)}</option>${counties.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}"${String(c.id) === String(sel) ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`;
const yearNow = new Date().getFullYear();

// ---------------------------------------------------------------- shared parts
function flow(c, total) {
  const steps = [
    ['Columns to confirm', c.mapping, '/admin/intake/batches?status=mapping', 'files'],
    ['New data', c.batches, '/admin/intake/batches?status=received', `${fmt(c.waitingRows)} rows${c.pendingSubs ? ` + ${fmt(c.pendingSubs)} portal` : ''}`],
    ['To review', c.drafts, '/admin/process', c.flagged ? `${fmt(c.flagged)} flagged` : 'values'],
    ['Approved', c.approved, '/admin/process?status=approved', 'to release'],
    ['Published', total, '/admin/analytics', 'values'],
  ];
  return `<ol class="cx-flow" aria-label="Where the data is">${steps.map(([l, n, href, s], i) => `<li><a class="cx-step${n && i < 4 ? ' hot' : ''}" href="${href}">
    <span class="cx-step-key">${n == null ? '…' : n > 9999 ? Math.round(n / 1000) + 'k' : fmt(n)}</span><span class="cx-step-l">${esc(l)}</span><span class="cx-step-s">${esc(s)}</span></a></li>`).join('')}</ol>`;
}
const STAGES = [['Validate', 'Q02 · Q04 · Q07'], ['Clean', 'Q12'], ['Integrate', 'Q04 · Q06'], ['Transform', 'Q11'], ['Analyse', 'Q01 · Q03 · Q05 · Q09'], ['Enrich', 'Q10 · Q12']];
function processButton(c) {
  const waiting = c.batches + (c.pendingSubs ? 1 : 0);
  return `<form method="post" action="/admin/process/run" class="cx-go-form" data-cx-run>
    <button class="cx-go" type="submit"${waiting ? '' : ' disabled'}>
      <b>Process new data</b>
      <span>${waiting ? `${fmt(c.batches)} batch${c.batches === 1 ? '' : 'es'} · ${fmt(c.waitingRows)} rows${c.pendingSubs ? ` · ${fmt(c.pendingSubs)} portal rows` : ''}` : 'Nothing new to process'}</span>
    </button>
    <ol class="cx-stages" data-cx-stages hidden>${STAGES.map(([t, q], i) => `<li data-stage="${t.toLowerCase()}"><span class="dot">${i + 1}</span><span><b>${t}</b> <em>${q}</em><span class="sum"></span></span></li>`).join('')}</ol>
    <p class="cx-run-out" data-cx-out hidden></p>
  </form>`;
}
function checkChips(checks, checkNames) {
  const list = (checks || []).filter((c) => c.result !== 'n/a' || c.q === 'Q10');
  const chips = list.map((c) => `<span class="cx-q cx-q-${c.result === 'n/a' ? 'na' : c.result}" title="${esc((checkNames[c.q] || c.q) + ': ' + c.note)}">${esc(c.q)}</span>`).join('');
  const notes = (checks || []).filter((c) => c.result !== 'pass').map((c) => `<li><b>${esc(c.q)} ${esc(checkNames[c.q] || '')}</b> ${esc(c.note)}${c.result === 'warn' || c.result === 'fail' ? ` <em>${esc(CHECK_ACTION[c.q] || '')}</em>` : ''}</li>`).join('');
  return notes ? `<details class="cx-why"><summary>${chips}</summary><ul>${notes}</ul></details>` : `<span class="cx-why-ok">${chips}</span>`;
}
function demoBanner(total, demo) {
  return `<div class="cx-demo" role="note"><b>Demonstration data in the published store.</b> ${fmt(demo)} of the ${fmt(total)} published values (${total ? Math.round((demo / total) * 100) : 0}%) are demonstration figures. Each real figure you release replaces one; analytics and reports say so wherever they use them.</div>`;
}
const ACTION_LABEL = {
  'intake.file': 'uploaded a file as', 'intake.paste': 'pasted cells as', 'intake.url': 'pulled a link into', 'intake.open_data': 'imported open data as',
  'intake.form': 'entered a value as', 'intake.api': 'pushed data by API as', 'intake.portal': 'gathered portal rows into', 'intake.commit': 'added to raw data:',
  'process.run': 'processed new data,', 'review.approve': 'approved', 'review.reject': 'rejected', 'review.reopen': 'reopened', release: 'released',
  'batch.signoff': 'recorded provider sign-off on', 'batch.archive': 'archived', 'batch.discard': 'discarded', 'batch.download': 'downloaded the original of',
  'report.generate': 'generated', 'report.upload': 'uploaded', 'report.publish': 'published', 'report.hide': 'hid', 'report.delete': 'deleted', 'report.update': 'edited',
  'apikey.create': 'created the API key', 'apikey.revoke': 'revoked API key', 'settings.release_rule': 'set the release rule to', 'denominators.load': 'loaded denominators from',
  'denominator.delete': 'removed denominator row', 'source.delete': 'removed the linked source', 'application.status': 'updated application', 'application.cv': 'downloaded the CV for',
};
const feed = (rows) => (rows.length ? `<ul class="cx-feed">${rows.map((r) => `<li><span><b>${esc(r.user_name || 'System')}</b> ${esc(ACTION_LABEL[r.action] || r.action)} <span class="cx-target">${esc(r.target || '')}</span></span><time class="mono muted">${esc(fmtTs(r.created_at))}</time></li>`).join('')}</ul>` : empty('No activity yet.'));
const batchTable = (batches) => (batches.length ? `<table class="data-table cx-table"><thead><tr><th>Batch</th><th>How it came in</th><th>Provider</th><th class="num">Rows</th><th>Status</th><th>Received</th></tr></thead><tbody>
  ${batches.map((b) => `<tr><td><a href="/admin/intake/batch/${b.id}"><b class="mono">${esc(b.ref)}</b></a><br><span class="muted">${esc(b.title)}</span></td><td>${esc(METHOD[b.method] || b.method)}</td>
  <td>${esc(b.provider || '')}${b.signoff_at ? `<br>${pill('ok', 'Signed off')}` : ''}</td><td class="num">${fmt(b.row_count)}</td><td>${bpill(b.status)}</td><td class="mono muted">${esc(fmtTs(b.created_at))}</td></tr>`).join('')}
  </tbody></table>` : empty('No batches yet. <a href="/admin/intake">Add data</a> to start.'));

// ---------------------------------------------------------------- Console (overview)
exports.overview = (ctx, { c, batches, auditRows, total, demo, real, indicators, lastRun, notice }) => {
  const todo = [
    [c.mapping, 'Files waiting for their columns to be confirmed', '/admin/intake/batches?status=mapping'],
    [c.batches + (c.pendingSubs ? 1 : 0), 'Batches ready to process', '/admin/process'],
    [c.flagged, 'Values flagged by the quality checks', '/admin/process?sev=warn'],
    [c.drafts - c.flagged, 'Clean values waiting for approval', '/admin/process?sev=ok'],
    [c.approved, 'Approved values waiting for release', '/admin/process?status=approved'],
    [c.papers, 'Research papers waiting for review', '/admin/papers?tab=submitted'],
    [c.requests, 'Access requests to answer', '/admin/users#requests'],
  ].filter(([n]) => n > 0);
  return shell(ctx, { title: 'NIIS Console', active: 'admin', body: `
  ${head({ title: 'NIIS Console', lede: 'The system behind the data. Collect it, run it through the twelve quality checks, analyse it, and publish only what passes.',
    actions: `<a class="btn btn-ghost" href="/admin/intake">${icon('cloudup')} Add data</a><a class="btn btn-ghost" href="/admin/reports">${icon('chart')} New report</a>` })}
  ${noticeHtml(notice)}
  ${demo ? demoBanner(total, demo) : ''}
  <section class="panel cx-run">
    <div class="cx-run-text">
      <h3>Where the data is</h3>
      <p class="muted">Every batch runs through Validate, Clean, Integrate, Transform, Analyse and Enrich. The results wait for review: nothing reaches the public site until a value is approved and released.</p>
      ${flow(c, total)}
      ${lastRun ? `<p class="muted cx-last">Last run <a href="/admin/process/run/${lastRun.id}">#${lastRun.id}</a> on ${esc(fmtTs(lastRun.started_at))}${lastRun.stats ? `: ${fmt(lastRun.stats.values)} values, ${fmt(lastRun.stats.warn)} flagged, ${fmt(lastRun.stats.fail)} failed` : ''}.</p>` : ''}
    </div>
    ${processButton(c)}
  </section>
  ${kpis([
    { label: 'Published values', value: fmt(total), href: '/admin/analytics' },
    { label: 'Indicators with real data', value: `${fmt(real)}<span style="font-size:.45em"> of ${fmt(indicators)}</span>`, href: '/admin/analytics' },
    { label: 'Values to review', value: fmt(c.drafts), href: '/admin/process', hot: c.drafts > 0 },
    { label: 'Approved, to release', value: fmt(c.approved), href: '/admin/process?status=approved', hot: c.approved > 0 },
  ])}
  <div class="two-col">
    <section class="panel"><h3>Needs your attention</h3>
      ${todo.length ? `<ul class="cx-todo">${todo.map(([n, l, href]) => `<li><a class="hot" href="${href}"><span class="n">${fmt(n)}</span><span>${esc(l)}</span>${icon('arrow')}</a></li>`).join('')}</ul>` : empty('Nothing is waiting. New data, papers and requests appear here.')}
    </section>
    <section class="panel"><h3>Recent activity</h3>${feed(auditRows)}<p class="cx-more"><a href="/admin/audit">The full audit log</a></p></section>
  </div>
  <h2>Latest batches</h2>
  ${batchTable(batches)}
  <p class="cx-more"><a href="/admin/intake/batches">Every batch</a></p>` });
};

// ---------------------------------------------------------------- Data Intake
const signoffFields = () => `
  <label>Provider<input name="provider" maxlength="120" placeholder="e.g. Liberia Telecommunications Authority"></label>
  <label class="check wide"><input type="checkbox" name="signed"> The provider has already signed off this series (Q10)</label>
  <label>Signed off by<input name="signoff_by" maxlength="120" placeholder="Name and position"></label>`;
exports.intake = (ctx, { batches, sources, c, keyCount, indicators, counties, domainLabels, domainOrder, wb, notice, tab, origin }) => {
  const M = [
    ['file', 'upload', 'Upload a file', 'Excel, CSV or JSON, up to 4 MB'],
    ['paste', 'copy', 'Paste cells', 'Straight from Excel or Google Sheets'],
    ['link', 'globe', 'Pull a link', 'Google Sheets, KoboToolbox, ODK, any CSV'],
    ['open', 'database', 'Open data', 'World Bank series for Liberia'],
    ['form', 'plus', 'Enter a value', 'One figure, typed in'],
    ['api', 'code', 'Provider API', 'Machines push rows with a key'],
    ['portal', 'users', 'Provider portal', 'Focal points submit from their workspace'],
    ['sources', 'rotate', 'Linked sources', 'Saved links, pulled again on demand'],
  ];
  const t = M.some((m) => m[0] === tab) ? tab : 'file';
  const panels = {
    file: `<form method="post" action="/admin/intake/upload" enctype="multipart/form-data" class="cx-form">
      <label class="cx-drop wide" data-cx-drop>${icon('cloudup')}<b>Drop a file here, or choose one</b><span class="muted">.xlsx, .csv, .tsv, .txt or .json · up to 4 MB · aggregate figures only</span>
        <input type="file" name="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.json" required><span class="cx-drop-name" data-cx-drop-name></span></label>
      <label>Title<input name="title" maxlength="160" placeholder="e.g. LTA subscriptions return, Q4"></label>
      ${signoffFields()}
      <div class="wide"><button class="btn btn-teal">${icon('upload')} Upload and read the columns</button></div>
    </form>`,
    paste: `<form method="post" action="/admin/intake/paste" class="cx-form">
      <label class="wide">Cells, with their header row<textarea name="text" rows="10" class="mono" placeholder="Indicator&#9;County&#9;Year&#9;Value&#10;internet_penetration&#9;Bong&#9;2025&#9;24.1" required></textarea></label>
      <label>Title<input name="title" maxlength="160" placeholder="What these figures are"></label>
      ${signoffFields()}
      <div class="wide"><button class="btn btn-teal">Read the cells</button></div>
    </form>`,
    link: `<form method="post" action="/admin/intake/link" class="cx-form">
      <label class="wide">Link<input name="url" type="url" required placeholder="https://docs.google.com/spreadsheets/d/…  ·  a KoboToolbox or ODK Central CSV export  ·  any CSV or JSON"></label>
      <label>Title<input name="title" maxlength="160"></label>
      ${signoffFields()}
      <label class="check wide"><input type="checkbox" name="keep" checked> Keep it as a linked source, so it can be pulled again (only a changed file makes a new batch)</label>
      <div class="wide"><button class="btn btn-teal">Fetch and read</button></div>
      <p class="muted wide">Google Sheets must be shared as "Anyone with the link". Private and local network addresses are refused.</p>
    </form>`,
    open: `<form method="post" action="/admin/intake/opendata" class="cx-form">
      <label>World Bank series<select name="series" data-cx-series>${wb.map((s) => `<option value="${esc(s.series)}" data-ind="${esc(s.code)}">${esc(s.series)} · ${esc(s.name)}</option>`).join('')}<option value="other">Another series…</option></select></label>
      <label>Other series code<input name="series_other" class="mono" placeholder="e.g. EG.ELC.ACCS.ZS"></label>
      <label>Feeds the NIIS indicator<select name="indicator" data-cx-series-ind required>${indOptions(indicators, domainLabels, domainOrder, wb[0] ? wb[0].code : '')}</select></label>
      <label>From<input name="from" type="number" min="1990" max="${yearNow}" value="2015"></label>
      <label>To<input name="to" type="number" min="1990" max="${yearNow}" value="${yearNow}"></label>
      <label class="check wide"><input type="checkbox" name="keep" checked> Keep it as a linked source</label>
      <div class="wide"><button class="btn btn-teal">Import for Liberia</button></div>
      <p class="muted wide">Only a series with the same definition as the NIIS indicator may feed it (Q07). The three listed match exactly; for any other, check the definition first. Figures come in as national values, credited to the World Bank and its source.</p>
    </form>`,
    form: `<form method="post" action="/admin/intake/form" class="cx-form">
      <label>Indicator<select name="indicator" required>${indOptions(indicators, domainLabels, domainOrder, '', 'Choose…')}</select></label>
      <label>Place<select name="county">${countyOptions(counties)}</select></label>
      <label>Year<input name="year" type="number" min="2000" max="${yearNow}" value="${yearNow - 1}" required></label>
      <label>Value<input name="value" inputmode="decimal" placeholder="or give the two below"></label>
      <label>Numerator<input name="numerator" inputmode="decimal" placeholder="e.g. users counted"></label>
      <label>Denominator<input name="denominator" inputmode="decimal" placeholder="e.g. population"></label>
      <label class="wide">Source<input name="source" maxlength="200" placeholder="Document, table and page the figure comes from"></label>
      ${signoffFields()}
      <div class="wide"><button class="btn btn-teal">Add to raw data</button></div>
      <p class="muted wide">With a numerator and denominator, NIIS computes the rate itself (Q04).</p>
    </form>`,
    api: `<div class="cx-api">
      <p>Providers' systems send rows to NIIS with a key of their own. Each push becomes a batch, checked like any other. ${keyCount ? `${fmt(keyCount)} active key${keyCount === 1 ? '' : 's'}.` : 'No key has been issued yet.'} <a href="/admin/settings#api">Issue or revoke keys</a>.</p>
      <h3>Send rows</h3>
      <code class="cx-code">curl -X POST ${esc(origin)}/api/v1/intake \\
  -H "Authorization: Bearer niis_…" -H "Content-Type: application/json" \\
  -d '{"title": "Monthly return", "rows": [
        {"indicator": "mobile_subscriptions", "county": "National", "year": 2025, "value": 32.1},
        {"indicator": "internet_penetration", "county": "Bong", "year": 2025, "numerator": 112000, "denominator": 467000}
      ]}'</code>
      <p class="muted">A CSV body (Content-Type: text/csv) works too. The answer gives the batch reference, how many rows were accepted and why any were set aside. <span class="mono">GET /api/v1/intake/batch/&lt;reference&gt;</span> reports where a batch has got to.</p>
    </div>`,
    portal: `<div><p>Data focal points (stakeholder accounts) send one value or a CSV file from <b>Submit data</b> in their workspace. Their rows join the next run of <b>Process new data</b> as one batch per provider, and their status goes back to them when a value is released or rejected.</p>
      <p>${c.pendingSubs ? `<b>${fmt(c.pendingSubs)}</b> portal rows are waiting for the next run.` : 'No portal rows are waiting.'} <a href="/admin/submissions">See every submission</a>.</p></div>`,
    sources: sources.length ? `<table class="data-table cx-table"><thead><tr><th>Source</th><th>Kind</th><th>Last pull</th><th></th></tr></thead><tbody>
      ${sources.map((s) => `<tr><td><b>${esc(s.name)}</b><br><span class="muted mono cx-url">${esc(s.kind === 'world_bank' ? `${s.config.series} → ${s.config.indicator}` : s.url)}</span></td>
      <td>${esc(s.kind === 'world_bank' ? 'World Bank' : 'Link')}${s.active ? '' : ` ${pill('mute', 'Paused')}`}</td>
      <td class="muted">${s.last_pulled_at ? esc(fmtTs(s.last_pulled_at)) + '<br>' : ''}${esc(s.last_status || '')}</td>
      <td class="cx-row-actions"><form method="post" action="/admin/intake/source/${s.id}/pull" class="inline-form"><button class="btn btn-sm btn-teal"${s.active ? '' : ' disabled'}>Pull now</button></form>
      <form method="post" action="/admin/intake/source/${s.id}/toggle" class="inline-form"><button class="btn btn-sm btn-ghost">${s.active ? 'Pause' : 'Resume'}</button></form>
      <form method="post" action="/admin/intake/source/${s.id}/delete" class="inline-form" data-confirm="Remove this linked source? Its batches stay on record."><button class="btn btn-sm btn-ghost">Remove</button></form></td></tr>`).join('')}
      </tbody></table>` : empty('No linked sources yet. Pull a link or import open data with "Keep it as a linked source" ticked.'),
  };
  return shell(ctx, { title: 'Data Intake', active: 'intake', body: `
  ${head({ title: 'Data Intake', lede: 'Eight ways in. Every one ends as a batch of raw rows, kept with its original file and its fingerprint, waiting to be processed.',
    actions: `<a class="btn btn-ghost" href="/admin/intake/denominators">${icon('layers')} Denominators</a><a class="btn btn-ghost" href="/admin/intake/batches">${icon('database')} Every batch</a>` })}
  ${noticeHtml(notice)}
  <nav class="cx-methods" aria-label="Ways to add data">${M.map(([key, ic, label, sub]) => `<a class="cx-method${key === t ? ' on' : ''}" href="/admin/intake?tab=${key}"${key === t ? ' aria-current="page"' : ''}>${icon(ic)}<b>${esc(label)}</b><span>${esc(sub)}</span></a>`).join('')}</nav>
  <section class="panel">${panels[t]}</section>
  <h2>Recent batches</h2>
  ${batchTable(batches)}` });
};

exports.batches = (ctx, { batches, status, notice }) => shell(ctx, { title: 'Batches', active: 'intake', body: `
  ${head({ kicker: 'NIIS System · Data Intake', title: 'Every batch', lede: 'Everything that has come in, newest first. A batch is never deleted: its file and rows stay on record.' })}
  ${noticeHtml(notice)}
  ${tabs([['', '/admin/intake/batches', 'All'], ['mapping', '?status=mapping', 'Columns to confirm'], ['received', '?status=received', 'Waiting'], ['processed', '?status=processed', 'Processed'], ['archived', '?status=archived', 'Archived']], status)}
  ${batchTable(batches)}` });

exports.batch = (ctx, { b, preview, err, rows, tally, rowFilter, creator, indicators, counties, domainLabels, domainOrder, notice }) => {
  const m = b.mapping || {};
  const roleSel = (role, headers, cur) => `<label>${esc({ indicator: 'Indicator', county: 'County or place', year: 'Year or period', value: 'Value', numerator: 'Numerator', denominator: 'Denominator', unit: 'Unit', source: 'Source', breakdown: 'Breakdown (sex, area…)' }[role])}
    <select name="col_${role}"><option value="">Not in the file</option>${headers.map((h, i) => `<option value="${i}"${cur === i ? ' selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('')}</select></label>`;
  let mapHtml = '';
  if (b.status === 'mapping') {
    if (err) mapHtml = `<div class="alert alert-error">${esc(err)}</div>`;
    else if (preview) {
      const pm = preview.mapping, d = m.defaults || {};
      const t = preview.rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
      mapHtml = `<section class="panel" id="map"><h3>Confirm the columns</h3>
      <p class="muted">NIIS read the file and recognised what it could. Check each column, give anything missing for the whole batch, preview, then add it to raw data.</p>
      <form method="post" action="/admin/intake/batch/${b.id}/map" class="cx-form" data-cx-map>
        <input type="hidden" name="sheet_changed" value="0">
        ${(m.sheets || []).length > 1 ? `<label>Sheet<select name="sheet" data-cx-sheet>${m.sheets.map((s, i) => `<option value="${i}"${i === pm.sheet ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` : `<input type="hidden" name="sheet" value="${pm.sheet || 0}">`}
        <label>Header row<input name="header_row" type="number" min="1" value="${(pm.headerRow || 0) + 1}"></label>
        <label>Layout<select name="layout">
          <option value="long"${pm.layout === 'long' ? ' selected' : ''}>One figure per row</option>
          <option value="wide_year"${pm.layout === 'wide_year' ? ' selected' : ''}>Years across the columns</option>
          <option value="wide_county"${pm.layout === 'wide_county' ? ' selected' : ''}>Counties across the columns</option>
          <option value="wide_indicator"${pm.layout === 'wide_indicator' ? ' selected' : ''}>Indicators across the columns</option></select></label>
        <p class="wide cx-sub">Columns</p>
        ${['indicator', 'county', 'year', 'value', 'numerator', 'denominator', 'unit', 'source', 'breakdown'].map((r) => roleSel(r, preview.headers, pm.cols[r])).join('')}
        <p class="wide cx-sub">For the whole batch, where the file does not say</p>
        <label>Indicator<select name="def_indicator">${indOptions(indicators, domainLabels, domainOrder, d.indicator || '', 'From the file')}</select></label>
        <label>Year<input name="def_year" type="number" min="2000" max="${yearNow}" value="${esc(d.year || '')}" placeholder="From the file"></label>
        <label>Place<select name="def_county">${countyOptions(counties, d.county || 'national')}</select></label>
        <label>Unit<input name="def_unit" value="${esc(d.unit || '')}" placeholder="From the file, or the catalogue's"></label>
        <label class="wide">Source<input name="def_source" maxlength="200" value="${esc(d.source || '')}" placeholder="e.g. LTA quarterly return, table 3"></label>
        ${preview.missing.length ? `<div class="alert alert-error wide">Still missing: ${esc(preview.missing.join(', '))}. Pick its column or give it for the whole batch.</div>` : ''}
        <div class="wide cx-btns"><button class="btn btn-ghost" name="action" value="preview">Preview again</button><button class="btn btn-teal" name="action" value="commit"${preview.missing.length ? ' disabled' : ''}>Add ${fmt(preview.rows.length)} rows to raw data</button></div>
      </form></section>
      <section id="preview"><h2>Preview</h2>
      <p class="muted">${fmt(preview.rows.length)} figures found${preview.truncated ? ' (the first 20,000)' : ''}: ${pill('ok', `${fmt(t.ok || 0)} read`)} ${pill('warn', `${fmt(t.flagged || 0)} corrected`)} ${pill('fail', `${fmt(t.rejected || 0)} set aside`)}. Rows set aside stay in raw data with the reason, and are never processed.</p>
      ${rowTable(preview.rows.slice(0, 40), counties, indicators)}
      ${preview.rows.length > 40 ? `<p class="muted">The first 40 of ${fmt(preview.rows.length)}.</p>` : ''}</section>`;
    }
  }
  const needSign = b.method !== 'open_data' && !b.signoff_at && b.status !== 'archived';
  return shell(ctx, { title: 'Batch ' + b.ref, active: 'intake', body: `
  ${head({ kicker: 'NIIS System · Data Intake · Batch', title: b.ref, lede: esc(b.title),
    actions: `${b.file_path ? `<a class="btn btn-ghost" href="/admin/intake/batch/${b.id}/file">${icon('download')} Original file</a>` : ''}
      ${b.status === 'mapping' ? `<form method="post" action="/admin/intake/batch/${b.id}/discard" class="inline-form" data-confirm="Discard this batch? Its record and file are kept, but it will never be processed."><button class="btn btn-ghost">Discard</button></form>` : ''}
      ${b.status === 'received' ? `<form method="post" action="/admin/intake/batch/${b.id}/archive" class="inline-form" data-confirm="Archive this batch? It stays on record but is never processed."><button class="btn btn-ghost">Archive</button></form>` : ''}
      ${b.status === 'received' ? `<a class="btn btn-teal" href="/admin/process">Process it</a>` : ''}` })}
  ${noticeHtml(notice)}
  ${kv([
    ['Status', bpill(b.status)], ['Came in by', esc(METHOD[b.method] || b.method)], ['Provider', esc(b.provider || 'Not given')],
    ['Rows', fmt(b.row_count)], b.file_name ? ['Original file', `${esc(b.file_name)} · ${kb(b.byte_size)}`] : null,
    b.sha256 ? ['Fingerprint (SHA-256)', `<span class="mono" title="${esc(b.sha256)}">${esc(b.sha256.slice(0, 16))}…</span>`] : null,
    ['Received', `${esc(fmtTs(b.created_at))}${creator ? ' by ' + esc(creator) : ''}`],
    ['Provider sign-off (Q10)', b.method === 'open_data' ? 'Not needed: an open, published source' : b.signoff_at ? `${esc(b.signoff_by)} · ${esc(fmtTs(b.signoff_at))}` : pill('warn', 'Not recorded')],
    b.source_url ? ['Source link', `<a href="${esc(b.source_url)}" rel="noopener noreferrer" target="_blank" class="cx-url">${esc(b.source_url.slice(0, 80))}</a>`] : null,
    b.run_id ? ['Processed in', `<a href="/admin/process/run/${b.run_id}">Run #${b.run_id}</a>`] : null,
  ])}
  ${needSign ? `<section class="panel"><h3>Record the provider's sign-off</h3><p class="muted">Q10: values from this batch are held from release until the provider has reviewed its series (at the validation clinic, or in writing).</p>
    <form method="post" action="/admin/intake/batch/${b.id}/signoff" class="cx-form"><label>Signed off by<input name="by" required maxlength="120" placeholder="Name and position"></label>
    <label>How<input name="note" maxlength="500" placeholder="e.g. Validation clinic, 12 Nov 2026; letter ref."></label><div><button class="btn btn-teal">Record sign-off</button></div></form></section>` : ''}
  ${mapHtml}
  ${b.status !== 'mapping' ? `<h2>Rows</h2>
    ${tabs([['', `/admin/intake/batch/${b.id}`, 'All', Object.values(tally).reduce((a, x) => a + x, 0)], ['ok', `?rows=ok`, 'Read', tally.ok || 0], ['flagged', `?rows=flagged`, 'Corrected', tally.flagged || 0], ['rejected', `?rows=rejected`, 'Set aside', tally.rejected || 0], ['used', `?rows=used`, 'Published', tally.used || 0]], rowFilter)}
    ${rows.length ? rowTable(rows, counties, indicators) : empty('No rows here.')}
    ${rows.length >= 500 ? '<p class="muted">The first 500 rows.</p>' : ''}` : ''}` });
};
function rowTable(rows, counties, indicators) {
  const name = (code) => (indicators.find((i) => i.code === code) || {}).name;
  return `<table class="data-table cx-table cx-rows"><thead><tr><th class="num">Row</th><th>Indicator</th><th>Place</th><th class="num">Year</th><th class="num">Value</th><th>Read as</th><th>Notes</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td class="num mono muted">${r.row_no}</td>
    <td>${r.indicator_code ? esc(name(r.indicator_code) || r.indicator_code) : `<span class="muted">${esc(r.indicator_text || '')}</span>`}</td>
    <td>${r.level ? esc(placeOf(counties, r.county_id)) : `<span class="muted">${esc(r.county_text || '')}</span>`}</td>
    <td class="num mono">${r.year || `<span class="muted">${esc(r.period_text || '')}</span>`}</td>
    <td class="num mono">${r.value != null ? esc(String(r.value)) : r.numerator != null ? `${esc(String(r.numerator))} / ${esc(String(r.denominator))}` : `<span class="muted">${esc(r.value_text || '')}</span>`}</td>
    <td>${pill(...(ROW_STATUS[r.status] || ['mute', r.status]))}</td><td class="muted cx-notes">${esc(r.notes || '')}</td></tr>`).join('')}
  </tbody></table>`;
}

exports.denominators = (ctx, { rows, counties, notice }) => shell(ctx, { title: 'Denominators', active: 'intake', body: `
  ${head({ kicker: 'NIIS System · Data Intake', title: 'Denominators', lede: 'The population table rates are computed against (Q04). National rates are weighted by it, never averaged from county rates. Load only a table agreed with LISGIS, and name it.' })}
  ${noticeHtml(notice)}
  <section class="panel"><h3>Load or replace rows</h3>
    <form method="post" action="/admin/intake/denominators" class="cx-form">
      <label>Kind<select name="kind"><option value="population">Population</option><option value="adults">Adults (15 and over)</option><option value="households">Households</option></select></label>
      <label>Source<input name="source" required maxlength="200" placeholder="e.g. LISGIS, 2022 Census, Table 2.1"></label>
      <label>Agreed on<input name="agreed_on" type="date"></label>
      <label class="wide">Rows: County, Year, Value (use "Liberia" for the national total)<textarea name="csv" rows="8" class="mono" placeholder="County, Year, Value&#10;Bomi, 2022, …&#10;Liberia, 2022, …" required></textarea></label>
      <div class="wide"><button class="btn btn-teal">Save rows</button></div>
    </form></section>
  ${rows.length ? `<table class="data-table cx-table"><thead><tr><th>Place</th><th class="num">Year</th><th>Kind</th><th class="num">Value</th><th>Source</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(placeOf(counties, r.county_id))}</td><td class="num mono">${r.year}</td><td>${esc(r.kind)}</td><td class="num mono">${fmt(r.value)}</td><td class="muted">${esc(r.source)}${r.agreed_on ? ' · agreed ' + esc(r.agreed_on) : ''}</td>
    <td><form method="post" action="/admin/intake/denominators" class="inline-form" data-confirm="Remove this row?"><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="${r.id}"><button class="btn btn-sm btn-ghost">Remove</button></form></td></tr>`).join('')}
  </tbody></table>` : empty('No agreed table is loaded yet. Until one is, national rates are computed only from numerators and denominators the providers send.')}` });

// ---------------------------------------------------------------- Process & Publish
exports.process = (ctx, { values, c, runs, tabCounts, status, sev, q, run, rule, approvers, checks, notice }) => {
  const groups = [];
  const gmap = new Map();
  for (const v of values) {
    const k = v.indicator_code + '|' + v.year;
    if (!gmap.has(k)) { const g = { k, code: v.indicator_code, year: v.year, rows: [] }; gmap.set(k, g); groups.push(g); }
    gmap.get(k).rows.push(v);
  }
  const indName = (code) => { const i = ctx._indicators.get(code); return i ? i.name : code; };
  const unitOf = (code) => { const i = ctx._indicators.get(code); return i ? i.unit : ''; };
  const qs = (o) => '?' + Object.entries({ status, sev, q, run, ...o }).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const actions = {
    draft: `<button class="btn btn-teal" name="action" value="approve">Approve</button><button class="btn btn-ghost" name="action" value="reject">Reject</button>`,
    approved: `<button class="btn btn-teal" name="action" value="release">Release to the public data</button><button class="btn btn-ghost" name="action" value="reopen">Back to draft</button>`,
    rejected: `<button class="btn btn-ghost" name="action" value="reopen">Back to draft</button>`,
    suppressed: `<button class="btn btn-ghost" name="action" value="reject">Reject</button>`,
  }[status] || '';
  return shell(ctx, { title: 'Process & Publish', active: 'process', body: `
  ${head({ title: 'Process & Publish', lede: 'Run new data through the checks, review what comes out, approve it, and release it to the public data. Every release is logged, and a revised figure keeps its old value on record.' })}
  ${noticeHtml(notice)}
  <section class="panel cx-run">
    <div class="cx-run-text"><h3>Where the data is</h3>${flow(c, c.published)}
    <p class="muted">Release rule: <b>${rule === 'two_person' ? 'two people' : 'one person'}</b>. ${rule === 'two_person' ? 'A value approved by one administrator is released by another, as the System Plan sets out.' : 'The administrator who approves may also release.'} <a href="/admin/settings">Change</a></p></div>
    ${processButton(c)}
  </section>
  <h2 id="review">Review</h2>
  ${tabs([['draft', qs({ status: 'draft', sev: '' }), 'To review', tabCounts.draft], ['approved', qs({ status: 'approved', sev: '' }), 'Approved', tabCounts.approved], ['released', qs({ status: 'released', sev: '' }), 'Released', tabCounts.released], ['rejected', qs({ status: 'rejected', sev: '' }), 'Rejected', tabCounts.rejected], ['suppressed', qs({ status: 'suppressed', sev: '' }), 'Suppressed', tabCounts.suppressed]], status)}
  <form method="get" action="/admin/process" class="cx-filter"><input type="hidden" name="status" value="${esc(status)}">${run ? `<input type="hidden" name="run" value="${run}">` : ''}
    <label>Indicator<input name="q" value="${esc(q)}" placeholder="Search by name"></label>
    <label>Checks<select name="sev"><option value="">All</option><option value="ok"${sev === 'ok' ? ' selected' : ''}>Clean</option><option value="warn"${sev === 'warn' ? ' selected' : ''}>Flagged</option><option value="fail"${sev === 'fail' ? ' selected' : ''}>Failed</option></select></label>
    <button class="btn btn-ghost">Filter</button>${run ? ` <a href="${qs({ run: '' })}">Clear run #${run}</a>` : ''}</form>
  ${values.length ? `<form method="post" action="/admin/process/decide" data-cx-review>
    <input type="hidden" name="ids" value=""><input type="hidden" name="back" value="/admin/process${esc(qs({}))}">
    <table class="data-table cx-table cx-review"><thead><tr><th class="cx-cb"><input type="checkbox" data-cx-all aria-label="Select all"></th><th>Place</th><th class="num">Value</th><th class="num">Published now</th><th class="num">Last year</th><th>How</th><th>Checks</th><th>${status === 'draft' ? 'Result' : 'Decision'}</th></tr></thead>
    ${groups.map((g, gi) => `<tbody data-group="${gi}"><tr class="cx-group"><td class="cx-cb"><input type="checkbox" data-cx-g="${gi}" aria-label="Select ${esc(indName(g.code))} ${g.year}"></td>
      <td colspan="7"><b>${esc(indName(g.code))}</b> · ${g.year} <span class="muted">· ${esc(unitOf(g.code))} · ${esc(g.rows[0].coverage || '')}</span> <a class="cx-tiny" href="/admin/analytics?ind=${encodeURIComponent(g.code)}&year=${g.year}&drafts=1">Analyse</a></td></tr>
      ${g.rows.map((v) => `<tr><td class="cx-cb"><input type="checkbox" name="pick" value="${v.id}" data-g="${gi}" aria-label="Select ${esc(placeOf(ctx._counties, v.county_id))}"></td>
        <td>${v.county_id == null ? '<b>Liberia</b>' : esc(placeOf(ctx._counties, v.county_id))}</td>
        <td class="num mono"><b>${v.status === 'suppressed' ? '<span class="muted">suppressed</span>' : esc(A.fmtVal(v.value, unitOf(v.code || g.code)))}</b></td>
        <td class="num mono muted">${v.published_value != null ? esc(A.fmtVal(v.published_value, unitOf(g.code))) + (/mock data|demonstration/i.test(v.published_source || '') ? '<sup title="Demonstration figure">d</sup>' : '') : ''}</td>
        <td class="num mono muted">${v.prev_year_value != null ? esc(A.fmtVal(v.prev_year_value, unitOf(g.code))) : ''}</td>
        <td class="muted cx-how">${esc(v.method)}</td>
        <td>${checkChips(v.checks, checks)}</td>
        <td>${status === 'draft' ? pill(...SEV[v.severity]) : `${vpill(v.status)}${v.approved_by ? `<br><span class="muted cx-notes"${v.decision_note ? ` title="${esc(v.decision_note)}"` : ''}>${esc(approvers.get(v.approved_by) || '')}${v.released_by ? ' → ' + esc(approvers.get(v.released_by) || '') : ''}${v.decision_note ? ' · note' : ''}</span>` : ''}`}</td></tr>`).join('')}</tbody>`).join('')}
    </table>
    ${actions ? `<div class="cx-sticky"><span class="cx-picked" data-cx-picked>None selected</span>
      ${status === 'draft' || status === 'suppressed' ? '<label class="cx-note">Note<input name="note" maxlength="1000" placeholder="Required to approve flagged values: the written confirmation"></label>' : ''}
      ${actions}</div>` : ''}
  </form>${values.length >= 600 ? '<p class="muted">The first 600 values. Filter to see the rest.</p>' : ''}` : empty(status === 'draft' ? 'Nothing to review. Process new data, and its values appear here.' : 'Nothing here.')}
  <h2>Runs</h2>
  ${runs.length ? `<table class="data-table cx-table"><thead><tr><th>Run</th><th>When</th><th class="num">Values</th><th class="num">Clean</th><th class="num">Flagged</th><th class="num">Failed</th><th>Status</th></tr></thead><tbody>
    ${runs.map((r) => `<tr><td><a href="/admin/process/run/${r.id}"><b>#${r.id}</b></a></td><td class="mono muted">${esc(fmtTs(r.started_at))}</td><td class="num">${r.stats ? fmt(r.stats.values) : ''}</td><td class="num">${r.stats ? fmt(r.stats.ok) : ''}</td><td class="num">${r.stats ? fmt(r.stats.warn) : ''}</td><td class="num">${r.stats ? fmt(r.stats.fail) : ''}</td><td>${pill(r.status === 'done' ? 'ok' : r.status === 'failed' ? 'fail' : 'info', r.status === 'done' ? 'Done' : r.status === 'failed' ? 'Failed' : 'Running')}</td></tr>`).join('')}
  </tbody></table>` : empty('No runs yet.')}` });
};

exports.run = (ctx, { run, batches, by, checks }) => {
  const s = run.stats || {};
  const dur = run.finished_at ? Math.max(0, (new Date(run.finished_at) - new Date(run.started_at)) / 1000) : null;
  const tallyChips = (t) => Object.entries(t || {}).map(([q, x]) => `<span class="cx-tally"><b class="cx-q cx-q-${x.fail ? 'fail' : x.warn ? 'warn' : x.pass ? 'pass' : 'na'}" title="${esc(checks[q] || q)}">${esc(q)}</b> ${esc(checks[q] || '')}: ${[x.pass ? `${x.pass} passed` : '', x.warn ? `${x.warn} flagged` : '', x.fail ? `${x.fail} failed` : '', x.na ? `${x.na} not applicable` : ''].filter(Boolean).join(', ') || 'not run'}</span>`).join('');
  return shell(ctx, { title: 'Run #' + run.id, active: 'process', body: `
  ${head({ kicker: 'NIIS System · Process & Publish', title: `Run #${run.id}`, lede: `${esc(fmtTs(run.started_at))}${by ? ' · started by ' + esc(by) : ''}${dur != null ? ` · ${dur < 1 ? 'under a second' : Math.round(dur) + ' seconds'}` : ''}`,
    actions: `<a class="btn btn-teal" href="/admin/process?run=${run.id}">Review its values</a>` })}
  ${run.status === 'failed' ? `<div class="alert alert-error">This run stopped: ${esc(run.error || 'unknown error')}. Nothing from it was published.</div>` : ''}
  ${kpis([{ label: 'Values produced', value: fmt(s.values) }, { label: 'Clean', value: fmt(s.ok) }, { label: 'Flagged', value: fmt(s.warn), hot: s.warn > 0 }, { label: 'Failed', value: fmt(s.fail), hot: s.fail > 0 }, { label: 'National figures computed', value: fmt(s.derived) }, { label: 'Earlier drafts replaced', value: fmt(s.superseded) }])}
  <ol class="cx-log">${(run.log || []).map((l, i) => `<li class="panel"><h3><span class="cx-log-n">${i + 1}</span> ${esc(l.title)}</h3><p>${esc(l.summary)}</p>
    <div class="cx-tallies">${tallyChips(l.checks)}</div>${l.notes && l.notes.length ? `<ul class="cx-log-notes">${l.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>
  <h2>Batches in this run</h2>
  ${batches.length ? `<ul class="cx-plain">${batches.map((b) => `<li><a href="/admin/intake/batch/${b.id}" class="mono"><b>${esc(b.ref)}</b></a> ${esc(b.title)} · ${esc(METHOD[b.method] || b.method)} · ${fmt(b.row_count)} rows</li>`).join('')}</ul>` : empty('None.')}` });
};

// ---------------------------------------------------------------- Data Analytics
exports.analytics = (ctx, { ind, year, years, drafts, series, counties, cov, quality, runs, revisions, checks, indicators, domainLabels, domainOrder, overlayCount }) => {
  const total = cov.reduce((a, x) => a + Number(x.total), 0), demo = cov.reduce((a, x) => a + Number(x.demo), 0);
  const withData = new Set(cov.map((x) => x.indicator_code)).size;
  const latest = years[years.length - 1];
  const covLatest = cov.filter((x) => x.year === latest && Number(x.counties) > 0);
  const avgCounties = covLatest.length ? covLatest.reduce((a, x) => a + Number(x.counties), 0) / covLatest.length : 0;
  const nat = series.find((s) => s.year === year);
  const st = A.seriesStats(series.filter((s) => s.year <= year));
  const ds = A.distStats(counties, nat ? nat.value : null);
  const isDemo = series.some((s) => /mock data|demonstration data/i.test(String(s.source || ''))) || counties.some((s) => /mock data|demonstration data/i.test(String(s.source || '')));
  const f = A.findings({ ind, series: series.filter((s) => s.year <= year), counties, year, demo: isDemo });
  // coverage by domain and year: the share of the domain's indicators with a national figure
  const byInd = new Map(indicators.map((i) => [i.code, i]));
  const heat = domainOrder.map((dm) => {
    const inds = indicators.filter((i) => i.domain === dm);
    return { dm, n: inds.length, cells: years.map((y) => {
      const rows = cov.filter((x) => x.year === y && byInd.get(x.indicator_code) && byInd.get(x.indicator_code).domain === dm);
      const nat = rows.filter((x) => x.has_national).length;
      const cty = rows.length ? rows.reduce((a, x) => a + Number(x.counties), 0) / rows.length : 0;
      const dem = rows.reduce((a, x) => a + Number(x.demo), 0), tot = rows.reduce((a, x) => a + Number(x.total), 0);
      return { y, share: inds.length ? nat / inds.length : 0, nat, cty, real: tot > dem };
    }) };
  }).filter((r) => r.n);
  // quality: every check's results across the values processed so far
  const qt = {};
  quality.forEach((v) => (v.checks || []).forEach((c) => { const t = (qt[c.q] = qt[c.q] || { pass: 0, warn: 0, fail: 0, 'n/a': 0 }); t[c.result] = (t[c.result] || 0) + 1; }));
  const sevT = quality.reduce((a, v) => { a[v.severity] = (a[v.severity] || 0) + 1; return a; }, {});
  return shell(ctx, { title: 'Data Analytics', active: 'niisanalytics', body: `
  ${head({ title: 'Data Analytics', lede: 'Measure and analyse what the data shows: trends, county gaps, coverage and quality. Every sentence below is computed from the figures, and any analysis can become a report.',
    actions: `<a class="btn btn-ghost" href="/analytics">${icon('chart')} Site visits</a>` })}
  ${demo ? demoBanner(total, demo) : ''}
  ${kpis([
    { label: 'Published values', value: fmt(total) },
    { label: 'Indicators with figures', value: `${fmt(withData)}<span style="font-size:.45em"> of ${fmt(indicators.length)}</span>` },
    { label: `Counties per indicator, ${latest || ''}`, value: avgCounties ? A.fmtVal(avgCounties) : '0' },
    { label: 'Real (not demonstration)', value: total ? Math.round(((total - demo) / total) * 100) + '%' : '0%', hot: total > demo },
  ])}
  <section class="panel" id="analyse">
    <h3>Analyse an indicator</h3>
    <form method="get" action="/admin/analytics#analyse" class="cx-form">
      <label class="cx-span2">Indicator<select name="ind">${indOptions(indicators, domainLabels, domainOrder, ind.code)}</select></label>
      <label>Year<select name="year">${years.slice().reverse().map((y) => `<option${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="drafts" value="1"${drafts ? ' checked' : ''}> Include values waiting for release</label>
      <div><button class="btn btn-teal">Analyse</button></div>
    </form>
    ${drafts ? `<div class="cx-demo cx-draftview" role="note"><b>Draft view.</b> ${overlayCount ? `${fmt(overlayCount)} values waiting for release are shown in place of the published ones, as the public would see them after release.` : 'No values are waiting for this indicator, so this is the published data.'}</div>` : ''}
    <div class="cx-an-head"><h2>${esc(ind.name)}, ${year}</h2><p class="muted">${esc(ind.unit)} · ${esc(domainLabels[ind.domain] || ind.domain)}${ind.description ? ' · ' + esc(ind.description) : ''}</p></div>
    <ul class="cx-find">${f.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="two-col cx-charts">
      <figure><figcaption>Liberia, ${series.length ? series[0].year : ''} to ${year}</figcaption>${A.svgLine(series.filter((s) => s.year <= year), { unit: ind.unit, label: ind.name, w: 520, h: 300 })}</figure>
      <figure><figcaption>By county, ${year}</figcaption>${A.svgBars(counties, { unit: ind.unit, national: nat ? nat.value : null, label: ind.name + ' by county', w: 470 })}</figure>
    </div>
    ${kv([
      ['Liberia', nat ? esc(A.fmtVal(nat.value, ind.unit)) : 'no data'],
      st && st.prev ? ['On the year', esc(A.fmtChange(st.yoy, ind.unit))] : null,
      st && st.n > 1 ? [`Since ${st.first.year}`, esc(A.fmtChange(st.change, ind.unit))] : null,
      st && st.cagr != null && Math.abs(st.cagr) < 1000 ? ['Compound change a year', (Math.round(st.cagr * 10) / 10) + '%'] : null,
      ds ? ['County median', esc(A.fmtVal(ds.median, ind.unit))] : null,
      ds ? ['Highest to lowest', `${esc(ds.best.county)} to ${esc(ds.worst.county)}`] : null,
      ds ? ['Gap', esc(A.fmtChange(ds.gap, ind.unit).replace(/^\+/, ''))] : null,
      ds && ds.cv != null ? ['Spread (CV)', Math.round(ds.cv) + '%'] : null,
      ds ? ['Counties with a figure', `${ds.n} of 15`] : null,
    ])}
    <div class="cx-btns">
      <form method="post" action="/admin/reports/generate" class="inline-form"><input type="hidden" name="kind" value="indicator"><input type="hidden" name="indicator" value="${esc(ind.code)}"><input type="hidden" name="year" value="${year}"><button class="btn btn-teal">${icon('doc')} Turn this into an indicator brief</button></form>
      <a class="btn btn-ghost" href="/data">${icon('database')} Open the Data Explorer</a>
    </div>
  </section>
  <h2>Coverage</h2>
  <p class="muted">The share of each domain's indicators with a national figure, by year. Darker is fuller; hover a cell for the counts. A ring marks a cell holding real (released, not demonstration) figures.</p>
  <div class="cx-heat-wrap"><table class="cx-heat"><thead><tr><th>Domain</th>${years.map((y) => `<th class="num">${y}</th>`).join('')}</tr></thead><tbody>
    ${heat.map((r) => `<tr><th>${esc(domainLabels[r.dm] || r.dm)} <span class="muted">${r.n}</span></th>${r.cells.map((c) => `<td style="--a:${(0.08 + c.share * 0.92).toFixed(2)}" class="${c.share > 0.55 ? 'dark' : ''}${c.real ? ' real' : ''}" title="${esc(`${domainLabels[r.dm]}, ${c.y}: ${c.nat} of ${r.n} indicators with a national figure; ${Math.round(c.cty * 10) / 10} counties on average`)}">${Math.round(c.share * 100)}%</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>
  <h2>Data quality</h2>
  ${quality.length ? `<p class="muted">Across the last ${fmt(quality.length)} values processed: ${pill('ok', `${fmt(sevT.ok || 0)} clean`)} ${pill('warn', `${fmt(sevT.warn || 0)} flagged`)} ${pill('fail', `${fmt(sevT.fail || 0)} failed`)}</p>
  <table class="data-table cx-table"><thead><tr><th>Check</th><th class="num">Passed</th><th class="num">Flagged</th><th class="num">Failed</th><th class="num">Not applicable</th><th>When it fails</th></tr></thead><tbody>
    ${Object.keys(checks).filter((q) => qt[q]).map((q) => `<tr><td><span class="cx-q cx-q-${qt[q].fail ? 'fail' : qt[q].warn ? 'warn' : 'pass'}">${q}</span> ${esc(checks[q])}</td><td class="num">${fmt(qt[q].pass)}</td><td class="num">${fmt(qt[q].warn)}</td><td class="num">${fmt(qt[q].fail)}</td><td class="num">${fmt(qt[q]['n/a'])}</td><td class="muted">${esc(CHECK_ACTION[q] || '')}</td></tr>`).join('')}
  </tbody></table>` : empty('No data has been processed yet. Quality results appear after the first run.')}
  <h2>Revisions</h2>
  ${revisions.length ? `<table class="data-table cx-table"><thead><tr><th>Figure</th><th class="num">Was</th><th class="num">Now</th><th>Why</th><th>When</th></tr></thead><tbody>
    ${revisions.map((r) => `<tr><td>${esc((byInd.get(r.indicator_code) || {}).name || r.indicator_code)}, ${esc(placeOf(ctx._counties, r.county_id))}, ${r.year}</td><td class="num mono">${fmt(r.old_value)}</td><td class="num mono">${fmt(r.new_value)}</td><td class="muted">${esc(r.reason || '')}</td><td class="mono muted">${esc(fmtTs(r.created_at))}</td></tr>`).join('')}
  </tbody></table>` : empty('No published figure has been revised yet. Every revision is listed here, with its old value (Q12).')}` });
};

// ---------------------------------------------------------------- ICT Reports
exports.reports = (ctx, { list, builtIn, indicators, counties, domainLabels, domainOrder, years, kinds, pre, notice }) => {
  const yearSel = (sel) => `<label>Year<select name="year">${years.map((y) => `<option${String(y) === String(sel) ? ' selected' : ''}>${y}</option>`).join('')}</select></label>`;
  const gen = {
    indicator: `<label>Indicator<select name="indicator" required>${indOptions(indicators, domainLabels, domainOrder, pre.indicator, 'Choose…')}</select></label>`,
    county: `<label>County<select name="county_id" required><option value="">Choose…</option>${counties.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>`,
    domain: `<label>Domain<select name="domain" required><option value="">Choose…</option>${domainOrder.map((d) => `<option value="${d}">${esc(domainLabels[d])}</option>`).join('')}</select></label>`,
    annual: '',
  };
  const ST = { draft: ['info', 'Draft'], published: ['ok', 'Published'], hidden: ['mute', 'Hidden'] };
  return shell(ctx, { title: 'ICT Reports', active: 'adminreports', body: `
  ${head({ title: 'ICT Reports', lede: 'Write reports from the published figures in one step, or upload a finished PDF. Each starts as a draft; publishing puts it on the public ICT Reports page.',
    actions: `<a class="btn btn-ghost" href="/reports">${icon('globe')} The public page</a>` })}
  ${noticeHtml(notice)}
  <h2>Generate from the data</h2>
  <div class="cx-gen">${Object.entries(kinds).map(([k, v]) => `<form method="post" action="/admin/reports/generate" class="panel cx-gen-card${pre.kind === k ? ' on' : ''}">
    <input type="hidden" name="kind" value="${k}"><h3>${esc(v.label)}</h3><p class="muted">${esc(v.hint)}</p>
    <div class="cx-form">${gen[k]}${yearSel(pre.year || years[0])}</div><button class="btn btn-teal">Generate</button></form>`).join('')}</div>
  <section class="panel"><h3>Upload a finished report (PDF)</h3>
    <form method="post" action="/admin/reports/upload" enctype="multipart/form-data" class="cx-form">
      <label class="wide">PDF, up to 4 MB<input type="file" name="file" accept="application/pdf,.pdf" required></label>
      <label class="cx-span2">Title<input name="title" required maxlength="200"></label>
      <label>Kind<input name="tag" value="Report" maxlength="60" placeholder="e.g. Sector Report"></label>
      <label>Period<input name="period" maxlength="40" placeholder="e.g. Q3 2026"></label>
      <label class="wide">Summary<textarea name="summary" rows="3" maxlength="1200"></textarea></label>
      <div class="wide"><button class="btn btn-teal">${icon('upload')} Upload as a draft</button></div>
    </form></section>
  <h2>All reports</h2>
  ${list.length ? `<table class="data-table cx-table"><thead><tr><th>Report</th><th>Kind</th><th>Period</th><th>Made by</th><th>Status</th><th>Updated</th></tr></thead><tbody>
    ${list.map((r) => `<tr><td><a href="/admin/reports/${r.id}"><b>${esc(r.title)}</b></a>${r.status === 'published' ? `<br><a class="cx-tiny" href="/reports/${esc(r.slug)}">On the site</a>` : ''}</td><td>${esc(r.tag)}</td><td>${esc(r.period || '')}</td><td>${r.generated ? 'NIIS, from the data' : 'Uploaded PDF'}</td><td>${pill(...(ST[r.status] || ['mute', r.status]))}</td><td class="mono muted">${esc(fmtTs(r.updated_at))}</td></tr>`).join('')}
  </tbody></table>` : empty('No reports yet. Generate one above, or upload a PDF.')}
  ${builtIn.length ? `<h3 class="cx-h3">Written into the site</h3><p class="muted">These ${builtIn.length} reports are part of the site's code. Their PDFs are not on the platform yet; upload each one above when it is ready.</p>
    <ul class="cx-plain">${builtIn.map((r) => `<li><b>${esc(r.title)}</b> · ${esc(r.tag)} · ${esc(r.date)}</li>`).join('')}</ul>` : ''}` });
};

exports.report = (ctx, { r, notice }) => {
  const ST = { draft: ['info', 'Draft'], published: ['ok', 'Published'], hidden: ['mute', 'Hidden'] };
  return shell(ctx, { title: r.title, active: 'adminreports', body: `
  ${head({ kicker: 'NIIS System · ICT Reports', title: r.title, lede: `${esc(r.tag)}${r.period ? ' · ' + esc(r.period) : ''} · ${r.generated ? 'Generated by NIIS from the published figures' : 'Uploaded PDF'}`,
    actions: `${pill(...(ST[r.status] || ['mute', r.status]))}
      ${r.status !== 'published' ? `<form method="post" action="/admin/reports/${r.id}/publish" class="inline-form"><button class="btn btn-teal">Publish</button></form>` : `<a class="btn btn-ghost" href="/reports/${esc(r.slug)}">${icon('globe')} On the site</a><form method="post" action="/admin/reports/${r.id}/hide" class="inline-form"><button class="btn btn-ghost">Hide</button></form>`}
      ${r.generated ? `<button class="btn btn-ghost" type="button" data-cx-print>${icon('download')} Print or save as PDF</button>` : ''}
      ${r.status !== 'published' ? `<form method="post" action="/admin/reports/${r.id}/delete" class="inline-form" data-confirm="Delete this report? This cannot be undone."><button class="btn btn-ghost">Delete</button></form>` : ''}` })}
  ${noticeHtml(notice)}
  ${r.params && r.params.demo ? '<div class="cx-demo" role="note"><b>Built on demonstration data.</b> The report says so on its cover. Generate it again once real figures are released.</div>' : ''}
  <details class="panel cx-edit"><summary><b>Edit the title, kind, period and summary</b></summary>
    <form method="post" action="/admin/reports/${r.id}/update" class="cx-form">
      <label class="cx-span2">Title<input name="title" value="${esc(r.title)}" maxlength="200" required></label>
      <label>Kind<input name="tag" value="${esc(r.tag)}" maxlength="60"></label><label>Period<input name="period" value="${esc(r.period || '')}" maxlength="40"></label>
      <label class="wide">Summary (shown on the ICT Reports page)<textarea name="summary" rows="3" maxlength="1200">${esc(r.summary || '')}</textarea></label>
      <div class="wide"><button class="btn btn-teal">Save</button></div></form></details>
  <div class="rpt-frame">${r.generated ? r.body || '' : `<object class="cx-pdf" data="${esc(r.file_path)}" type="application/pdf"><p><a href="${esc(r.file_path)}">Open the PDF</a></p></object>`}</div>` });
};

// ---------------------------------------------------------------- Research Papers
exports.papers = (ctx, { papers, tab, notice }) => {
  const by = {
    submitted: papers.filter((p) => p.status === 'submitted' && !p.deleted), published: papers.filter((p) => p.status === 'published' && p.visible && !p.deleted),
    hidden: papers.filter((p) => p.status === 'published' && !p.visible && !p.deleted), rejected: papers.filter((p) => p.status === 'rejected' && !p.deleted), deleted: papers.filter((p) => p.deleted),
  };
  const t = by[tab] ? tab : (by.submitted.length ? 'submitted' : 'published');
  const act = (pp, action, label, ghost = true, path = 'visibility') => `<form method="post" action="/admin/papers/${path}" class="inline-form"><input type="hidden" name="id" value="${pp.id}"><input type="hidden" name="action" value="${action}"><button class="btn btn-sm ${ghost ? 'btn-ghost' : 'btn-teal'}">${label}</button></form>`;
  return shell(ctx, { title: 'Research Papers', active: 'adminpapers', body: `
  ${head({ title: 'Research Papers', lede: 'Review what researchers submit, and manage what the Research Hub shows: publish, hide, lock downloads, delete and recover.', actions: `<a class="btn btn-ghost" href="/research">${icon('globe')} The Research Hub</a>` })}
  ${noticeHtml(notice)}
  ${tabs([['submitted', '?tab=submitted', 'To review', by.submitted.length], ['published', '?tab=published', 'Published', by.published.length], ['hidden', '?tab=hidden', 'Hidden', by.hidden.length], ['rejected', '?tab=rejected', 'Rejected', by.rejected.length], ['deleted', '?tab=deleted', 'Deleted', by.deleted.length]], t)}
  ${by[t].length ? `<table class="data-table cx-table"><thead><tr><th>Paper</th><th>Kind</th><th>Date</th><th></th></tr></thead><tbody>
    ${by[t].map((pp) => `<tr><td><b>${esc(pp.title)}</b><br><span class="muted">${esc(pp.authors || '')}</span>
      ${pp.status === 'submitted' ? `<br><span class="muted">Sent by ${esc(pp.submitter_name || 'a user')}${pp.submitter_org ? ', ' + esc(pp.submitter_org) : ''}${pp.submitter_email ? ` · <a href="mailto:${esc(pp.submitter_email)}">${esc(pp.submitter_email)}</a>` : ''}</span><details class="cx-abs"><summary>Abstract</summary><p>${esc(pp.abstract || '')}</p></details>` : ''}
      ${!pp.downloadable ? `<br>${pill('mute', 'Download locked')}` : ''}</td>
      <td>${esc(pp.tag || '')}</td><td class="mono muted">${esc(pp.published_on || String(pp.created_at || '').slice(0, 10))}</td>
      <td class="cx-row-actions">${t === 'submitted' ? act(pp, 'approve', 'Approve and publish', false, 'review') + act(pp, 'reject', 'Reject', true, 'review') : ''}
        ${t === 'published' ? act(pp, 'hide', 'Hide') : ''}${t === 'hidden' ? act(pp, 'show', 'Show') : ''}
        ${t === 'published' || t === 'hidden' ? (pp.downloadable ? act(pp, 'lock', 'Lock download') : act(pp, 'unlock', 'Unlock download')) : ''}
        ${t !== 'deleted' ? `<form method="post" action="/admin/papers/delete" class="inline-form" data-confirm="Move this paper to Deleted? It can be recovered."><input type="hidden" name="id" value="${pp.id}"><button class="btn btn-sm btn-ghost">Delete</button></form>` : act(pp, 'recover', 'Recover', false, 'recover')}</td></tr>`).join('')}
  </tbody></table>` : empty('No papers here.')}
  <section class="panel"><h3>Publish a paper</h3>
    <form method="post" action="/admin/papers/create" class="cx-form">
      <label class="cx-span2">Title<input name="title" required></label><label>Authors<input name="authors"></label>
      <label>Kind<select name="tag"><option>Report</option><option>Flagship Report</option><option>Working Paper</option><option>Brief</option></select></label>
      <label class="wide">Abstract<textarea name="abstract" rows="4" required></textarea></label>
      <div class="wide"><button class="btn btn-teal">Publish paper</button></div></form></section>` });
};

// ---------------------------------------------------------------- Submissions
exports.submissions = (ctx, { tab, data, batchRef, papers, requests, apps, inbox, notice }) => {
  const pendingReq = requests.filter((r) => r.status === 'pending');
  const unread = inbox.filter((c) => c.unread).length;
  const newApps = apps ? apps.filter((a) => a.status === 'new').length : 0;
  const t = ['data', 'papers', 'access', 'jobs', 'messages'].includes(tab) ? tab : 'data';
  const AST = { new: ['info', 'New'], reviewing: ['info', 'Reviewing'], shortlisted: ['ok', 'Shortlisted'], declined: ['mute', 'Declined'], hired: ['ok', 'Hired'] };
  const body = {
    data: data.length ? `<p class="muted">Rows that data focal points sent from the provider portal. Waiting rows join the next run of Process new data; the provider sees the result when each value is released or rejected.</p>
      <table class="data-table cx-table"><thead><tr><th>Indicator</th><th>Place</th><th class="num">Year</th><th class="num">Value</th><th>From</th><th>Status</th><th>Sent</th></tr></thead><tbody>
      ${data.map((s) => `<tr><td>${esc(s.indicator_name)}</td><td>${esc(s.county_name)}</td><td class="num mono">${s.year}</td><td class="num mono">${fmt(s.value)}</td><td class="muted">${esc(String(s.source || '').replace(/^Focal point: /, ''))}</td>
        <td>${s.status === 'pending' ? (s.batch_id && batchRef.get(s.batch_id) ? `${pill('info', 'In processing')}<br><a class="mono cx-tiny" href="/admin/intake/batch/${s.batch_id}">${esc(batchRef.get(s.batch_id).ref)}</a>` : pill('warn', 'Waiting for the next run')) : pill(s.status === 'approved' ? 'ok' : 'fail', s.status === 'approved' ? 'Released' : 'Rejected')}</td>
        <td class="mono muted">${esc(fmtTs(s.created_at))}</td></tr>`).join('')}</tbody></table>` : empty('No data has been sent from the provider portal yet.'),
    papers: papers.length ? `<ul class="cx-plain">${papers.map((pp) => `<li><b>${esc(pp.title)}</b> · ${esc(pp.submitter_name || pp.authors || '')}${pp.submitter_org ? ', ' + esc(pp.submitter_org) : ''} · <span class="mono muted">${esc(fmtTs(pp.created_at))}</span></li>`).join('')}</ul>
      <p><a class="btn btn-teal" href="/admin/papers?tab=submitted">Review them in Research Papers</a></p>` : empty('No research papers are waiting for review.'),
    access: `${pendingReq.length ? require('../views').adminParts.requests(ctx, pendingReq) : empty('No access requests are waiting.')}
      ${requests.filter((r) => r.status !== 'pending').length ? `<h3 class="cx-h3">Answered</h3><table class="data-table cx-table"><thead><tr><th>Applicant</th><th>Asked for</th><th>Decision</th><th>When</th></tr></thead><tbody>
      ${requests.filter((r) => r.status !== 'pending').map((r) => `<tr><td>${esc(r.name)}<br><span class="muted mono">${esc(r.email)}</span></td><td>${esc(r.role_requested)}</td><td>${pill(r.status === 'approved' ? 'ok' : 'mute', r.status === 'approved' ? 'Account created' : 'Declined')}</td><td class="mono muted">${esc(fmtTs(r.reviewed_at || r.created_at))}</td></tr>`).join('')}</tbody></table>` : ''}`,
    jobs: apps == null ? empty('The job applications table is not available.') : apps.length ? `<table class="data-table cx-table"><thead><tr><th>Applicant</th><th>Position</th><th>County</th><th>Sent</th><th>CV</th><th>Status</th></tr></thead><tbody>
      ${apps.map((a) => `<tr><td><b>${esc(a.full_name)}</b><br><span class="muted mono">${esc(a.email)}${a.phone ? ' · ' + esc(a.phone) : ''}</span><br><span class="mono cx-tiny">${esc(a.reference)}</span>${a.cover_note ? `<details class="cx-abs"><summary>Cover note</summary><p>${esc(a.cover_note)}</p></details>` : ''}</td>
        <td>${esc(a.role_title)}</td><td>${esc(a.county)}</td><td class="mono muted">${esc(fmtTs(a.created_at))}</td>
        <td><a class="btn btn-sm btn-ghost" href="/admin/applications/${a.id}/cv">${icon('download')} CV</a></td>
        <td><form method="post" action="/admin/applications/${a.id}/status" class="inline-form"><select name="status" data-cx-autosubmit aria-label="Status of ${esc(a.full_name)}">${Object.entries(AST).map(([k, v]) => `<option value="${k}"${a.status === k ? ' selected' : ''}>${v[1]}</option>`).join('')}</select></form></td></tr>`).join('')}
      </tbody></table>` : empty('No applications yet.'),
    messages: inbox.length ? `<table class="data-table cx-table"><thead><tr><th>From</th><th>Subject</th><th>Updated</th><th></th></tr></thead><tbody>
      ${inbox.map((c) => `<tr class="${c.unread ? 'unread' : ''}"><td>${esc(c.user_name)}<br><span class="mono muted">${esc(c.email)}</span></td><td>${esc(c.subject || '')}${c.unread ? ` <span class="badge">${c.unread} new</span>` : ''}${/^Indicator request/i.test(c.subject || '') ? `<br>${pill('info', 'Indicator request')}` : ''}</td><td class="mono muted">${esc(fmtTs(c.updated_at))}</td><td><a href="/admin/inbox/${c.id}">Open</a></td></tr>`).join('')}
      </tbody></table>` : empty('No messages yet.'),
  };
  return shell(ctx, { title: 'Submissions', active: 'submissions', body: `
  ${head({ title: 'Submissions', lede: 'Everything people send in, in one place: data from providers, research papers, requests for access, job applications and messages.' })}
  ${noticeHtml(notice)}
  ${tabs([['data', '?tab=data', 'Provider data', data.filter((s) => s.status === 'pending').length], ['papers', '?tab=papers', 'Research papers', papers.length], ['access', '?tab=access', 'Access requests', pendingReq.length], ['jobs', '?tab=jobs', 'Job applications', newApps], ['messages', '?tab=messages', 'Messages', unread]], t)}
  ${body[t]}` });
};

// ---------------------------------------------------------------- Users
exports.users = (ctx, { users, requests, parts, notice }) => {
  const roles = users.reduce((a, u) => { a[u.role] = (a[u.role] || 0) + 1; return a; }, {});
  return shell(ctx, { title: 'Users', active: 'users', body: `
  ${head({ title: 'Users', lede: 'Every account, its role and its status. Provision accounts for data focal points, answer access requests, and suspend or reinstate.' })}
  ${noticeHtml(notice)}
  ${kpis([{ label: 'Accounts', value: fmt(users.length) }, { label: 'Administrators', value: fmt(roles.admin || 0) }, { label: 'Stakeholders', value: fmt(roles.stakeholder || 0) }, { label: 'Public users', value: fmt(roles.public || 0) }])}
  <h2 id="requests">Access requests</h2>
  ${requests.length ? parts.requests(ctx, requests) : empty('No access requests are waiting.')}
  <h2>Accounts</h2>
  <label class="cx-search">Find an account<input type="search" data-cx-filter="#cx-users" placeholder="Name, email, organisation or role"></label>
  <div id="cx-users">${parts.users(ctx, users)}</div>` });
};

// ---------------------------------------------------------------- Content Studio, Settings, Audit
exports.studio = (ctx, { parts, data, notice }) => shell(ctx, { title: 'Content Studio', active: 'studio', body: `
  ${head({ title: 'Content Studio', lede: 'The public site\'s own words and media: the homepage text and video, news updates, the media library and AI video.', actions: `<a class="btn btn-ghost" href="/admin/images">${icon('image')} Image Library</a>` })}
  ${noticeHtml(notice)}
  ${parts.studio(ctx, data)}` });

exports.settings = (ctx, { parts, settings, rolePerms, rule, keys, newKey, notice }) => shell(ctx, { title: 'Settings & Audit', active: 'settings', body: `
  ${head({ title: 'Settings & Audit', lede: 'How publishing works, who may push data by API, who may register, and what each role may do.', actions: `<a class="btn btn-ghost" href="/admin/audit">${icon('eye')} Audit log</a>` })}
  ${noticeHtml(notice)}
  <div class="two-col">
    <section class="panel"><h3>Release rule</h3>
      <form method="post" action="/admin/settings/niis" class="cx-radios">
        <label class="check"><input type="radio" name="release_rule" value="two_person"${rule === 'two_person' ? ' checked' : ''}> <span><b>Two people</b> (the System Plan): one administrator approves a value, a different one releases it.</span></label>
        <label class="check"><input type="radio" name="release_rule" value="one_person"${rule === 'one_person' ? ' checked' : ''}> <span><b>One person</b>: the administrator who approves may also release. For a pilot only.</span></label>
        <button class="btn btn-teal">Save</button></form></section>
    <section class="panel" id="api"><h3>Provider API keys</h3>
      ${newKey ? `<div class="cx-newkey" role="alert"><p><b>The key for ${esc(newKey.label)} (${esc(newKey.provider)}).</b> Copy it now: it is shown only this once, and NIIS keeps only its fingerprint.</p>
        <code class="cx-code" data-cx-copy-src>${esc(newKey.key)}</code><button class="btn btn-sm btn-ghost" type="button" data-cx-copy>${icon('copy')} Copy</button></div>` : ''}
      <form method="post" action="/admin/settings/apikey" class="cx-form"><label>Label<input name="label" maxlength="80" required placeholder="e.g. LTA data system"></label>
        <label>Provider<input name="provider" maxlength="120" required placeholder="Liberia Telecommunications Authority"></label><div><button class="btn btn-teal">Issue a key</button></div></form>
      ${keys.length ? `<table class="data-table cx-table"><thead><tr><th>Key</th><th>Provider</th><th>Last used</th><th></th></tr></thead><tbody>
        ${keys.map((k) => `<tr><td><b>${esc(k.label)}</b><br><span class="mono muted">${esc(k.key_prefix)}…</span></td><td>${esc(k.provider)}</td><td class="mono muted">${k.revoked_at ? 'Revoked ' + esc(fmtTs(k.revoked_at)) : esc(fmtTs(k.last_used_at) || 'Never')}</td>
        <td>${k.revoked_at ? '' : `<form method="post" action="/admin/settings/apikey" class="inline-form" data-confirm="Revoke this key? Anything using it will be refused."><input type="hidden" name="action" value="revoke"><input type="hidden" name="id" value="${k.id}"><button class="btn btn-sm btn-ghost">Revoke</button></form>`}</td></tr>`).join('')}
      </tbody></table>` : ''}</section>
  </div>
  <h2>Access</h2>
  ${parts.settings(ctx, { settings, rolePerms })}` });

exports.audit = (ctx, { rows }) => shell(ctx, { title: 'Audit log', active: 'settings', body: `
  ${head({ kicker: 'NIIS System · Settings & Audit', title: 'Audit log', lede: 'Every action in the console: who, what, on which record, and when. The newest 400.' })}
  ${rows.length ? `<table class="data-table cx-table"><thead><tr><th>When</th><th>Who</th><th>Did</th><th>Detail</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td class="mono muted">${esc(fmtTs(r.created_at))}</td><td>${esc(r.user_name || 'System')}</td><td>${esc(ACTION_LABEL[r.action] || r.action)} <b>${esc(r.target || '')}</b></td>
    <td class="muted cx-notes">${r.detail ? esc(Object.entries(r.detail).filter(([k]) => k !== 'ids').map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : v}`).join(' · ').slice(0, 300)) : ''}</td></tr>`).join('')}
  </tbody></table>` : empty('No actions recorded yet.')}` });
