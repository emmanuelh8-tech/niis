// The NIIS console's page behaviour (niis/console-views.js). Every form works without it; this adds the live
// process run, selection in the review table, drag and drop, the account filter and confirmations.
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // confirmation before anything that cannot be taken back
  $$('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault(); });
  });
  $$('[data-cx-autosubmit]').forEach(function (s) { s.addEventListener('change', function () { s.form.submit(); }); });
  $$('[data-cx-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  $$('[data-cx-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var src = $('[data-cx-copy-src]'); if (!src) return;
      navigator.clipboard.writeText(src.textContent.trim()).then(function () { b.textContent = 'Copied'; });
    });
  });

  // Process new data: the stages light up while the server runs, then their real results are filled in
  $$('form[data-cx-run]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var btn = $('.cx-go', form), list = $('[data-cx-stages]', form), out = $('[data-cx-out]', form);
      if (btn.disabled) return;
      btn.disabled = true; btn.classList.add('is-running');
      $('b', btn).textContent = 'Processing…';
      list.hidden = false; out.hidden = true;
      var items = $$('li', list), i = 0;
      items.forEach(function (li) { li.className = ''; $('.sum', li).textContent = ''; });
      var tick = setInterval(function () {
        if (i > 0) items[i - 1].className = 'done';
        if (i < items.length) items[i].className = 'on';
        i = Math.min(i + 1, items.length);
      }, 450);
      fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          clearInterval(tick);
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || 'Processing stopped.');
          var log = res.j.run.log || [];
          items.forEach(function (li, k) { li.className = 'done'; var l = log[k]; if (l) $('.sum', li).textContent = l.summary; });
          var s = res.j.run.stats || {};
          out.hidden = false;
          out.innerHTML = '<b>' + (s.values || 0) + ' values</b> ready: ' + (s.ok || 0) + ' clean, ' + (s.warn || 0) + ' flagged, ' + (s.fail || 0) + ' failed. ' +
            '<a href="/admin/process?run=' + res.j.run.id + '">Review them</a> · <a href="/admin/process/run/' + res.j.run.id + '">The full log</a>';
          btn.classList.remove('is-running'); $('b', btn).textContent = 'Done';
        })
        .catch(function (err) {
          clearInterval(tick);
          items.forEach(function (li) { li.className = ''; });
          list.hidden = true; out.hidden = false; out.textContent = err.message;
          btn.classList.remove('is-running'); btn.disabled = false; $('b', btn).textContent = 'Process new data';
        });
    });
  });

  // review: select all, select a group, count, and send the ticked ids
  $$('form[data-cx-review]').forEach(function (form) {
    var picks = function () { return $$('input[name="pick"]', form); };
    var counter = $('[data-cx-picked]', form);
    var update = function () {
      var n = picks().filter(function (c) { return c.checked; }).length;
      if (counter) counter.textContent = n ? n + ' selected' : 'None selected';
    };
    var all = $('[data-cx-all]', form);
    if (all) all.addEventListener('change', function () { picks().forEach(function (c) { c.checked = all.checked; }); $$('[data-cx-g]', form).forEach(function (g) { g.checked = all.checked; }); update(); });
    $$('[data-cx-g]', form).forEach(function (g) {
      g.addEventListener('change', function () { $$('input[name="pick"][data-g="' + g.getAttribute('data-cx-g') + '"]', form).forEach(function (c) { c.checked = g.checked; }); update(); });
    });
    picks().forEach(function (c) { c.addEventListener('change', update); });
    form.addEventListener('submit', function (e) {
      var ids = picks().filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
      var action = e.submitter ? e.submitter.value : '';
      if (!ids.length && action !== 'release') { e.preventDefault(); if (counter) counter.textContent = 'Tick the values first'; return; }
      if (!ids.length && action === 'release' && !window.confirm('Release every approved value?')) { e.preventDefault(); return; }
      $('input[name="ids"]', form).value = ids.join(',');
      $$('input[name="pick"]', form).forEach(function (c) { c.disabled = true; });
    });
    update();
  });

  // the drop zone: a file dropped on it goes into its chooser
  $$('[data-cx-drop]').forEach(function (zone) {
    var input = $('input[type="file"]', zone), name = $('[data-cx-drop-name]', zone);
    var show = function () { if (name) name.textContent = input.files && input.files[0] ? input.files[0].name + ' · ' + Math.max(1, Math.round(input.files[0].size / 1024)) + ' KB' : ''; };
    input.addEventListener('change', show);
    ['dragenter', 'dragover'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove('over'); }); });
    zone.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); } });
  });

  // mapping: a different sheet is read again from its own header
  $$('[data-cx-sheet]').forEach(function (s) {
    s.addEventListener('change', function () { var f = s.form; f.querySelector('[name="sheet_changed"]').value = '1'; var b = document.createElement('input'); b.type = 'hidden'; b.name = 'action'; b.value = 'preview'; f.appendChild(b); f.submit(); });
  });
  // open data: the matching NIIS indicator follows the series chosen
  $$('[data-cx-series]').forEach(function (s) {
    var ind = s.form.querySelector('[data-cx-series-ind]');
    s.addEventListener('change', function () { var o = s.options[s.selectedIndex]; if (o && o.getAttribute('data-ind') && ind) ind.value = o.getAttribute('data-ind'); });
  });

  // find an account: hide the rows that do not match
  $$('[data-cx-filter]').forEach(function (inp) {
    var scope = $(inp.getAttribute('data-cx-filter'));
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase();
      $$('tbody tr', scope).forEach(function (tr) { tr.hidden = q && tr.textContent.toLowerCase().indexOf(q) < 0; });
    });
  });
})();
