// app.js · NIIS client: choropleth map, searchable dropdowns, charts, tables, query builder.
// Zero dependencies. Relies on window.LIBERIA_COUNTIES / window.LIBERIA_VIEWBOX (public/liberia-counties.js).
(function () {
  'use strict';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var COLORS = { navy: '#0B2C63', teal: '#1C5BB8', gold: '#C8102E', clay: '#7FA0CE', line: 'rgba(11,44,99,.14)', muted: '#5A6A85', green: '#1C5BB8', red: '#B23A3A' };

  function el(name, attrs, text) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtNum(v) {
    if (v == null || isNaN(v)) return 'n/a';
    var n = Number(v);
    return Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(Math.round(n * 10) / 10);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  // ---------- choropleth scale: light green (low) -> green (mid) -> deep LTA green (high) ----------
  function hexToRgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  function scaleColor(t) {
    t = Math.max(0, Math.min(1, t));
    var c1 = hexToRgb('#E1F1E4'), c2 = hexToRgb('#5DB377'), c3 = hexToRgb('#1A5C38');
    var a, b, tt;
    if (t < 0.5) { a = c1; b = c2; tt = t / 0.5; } else { a = c2; b = c3; tt = (t - 0.5) / 0.5; }
    return 'rgb(' + lerp(a[0], b[0], tt) + ',' + lerp(a[1], b[1], tt) + ',' + lerp(a[2], b[2], tt) + ')';
  }

  // ---------- searchable dropdown (.xdd) ----------
  // markup: <div class="xdd" data-name="x"><button class="xdd-trigger">...</button><div class="xdd-panel">...</div></div>
  function initDropdown(root, opts) {
    // opts: { items: [{value,label,group}], placeholder, onChange, selected }
    if (!root) return { setSelected: function () {}, getSelected: function () { return null; } };
    var trigger = qs('.xdd-trigger', root);
    var panel = qs('.xdd-panel', root);
    var labelSpan = qs('.xdd-trigger-label', root);
    var searchInput = qs('.xdd-search input', root);
    var list = qs('.xdd-list', root);
    var current = opts.selected || null;

    function renderList(filter) {
      var f = (filter || '').toLowerCase();
      var groups = {};
      opts.items.forEach(function (it) {
        if (f && it.label.toLowerCase().indexOf(f) === -1) return;
        var g = it.group || '';
        groups[g] = groups[g] || [];
        groups[g].push(it);
      });
      var html = '';
      Object.keys(groups).forEach(function (g) {
        if (g) html += '<div class="xdd-group-label">' + esc(g) + '</div>';
        groups[g].forEach(function (it) {
          html += '<div class="xdd-item' + (it.value === current ? ' selected' : '') + '" data-value="' + esc(it.value) + '">' + esc(it.label) + '</div>';
        });
      });
      list.innerHTML = html || '<div class="xdd-item muted">No matches</div>';
    }
    function setLabel() {
      var found = opts.items.filter(function (it) { return it.value === current; })[0];
      labelSpan.textContent = found ? found.label : opts.placeholder;
    }
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      qsa('.xdd.open').forEach(function (o) { if (o !== root) o.classList.remove('open'); });
      root.classList.toggle('open');
      if (root.classList.contains('open')) { renderList(''); if (searchInput) { searchInput.value = ''; searchInput.focus(); } }
    });
    if (searchInput) searchInput.addEventListener('input', function () { renderList(searchInput.value); });
    list.addEventListener('click', function (e) {
      var item = e.target.closest('.xdd-item');
      if (!item || item.dataset.value === undefined) return;
      current = item.dataset.value;
      setLabel();
      root.classList.remove('open');
      if (opts.onChange) opts.onChange(current);
    });
    document.addEventListener('click', function () { root.classList.remove('open'); });
    setLabel();
    return {
      setSelected: function (v) { current = v; setLabel(); },
      getSelected: function () { return current; },
      // The Category filter narrows the Indicator list, so its options are not fixed at init.
      setItems: function (items) {
        opts.items = items || [];
        setLabel();
        if (root.classList.contains('open')) renderList(searchInput ? searchInput.value : '');
      },
    };
  }

  // ---------- multi-select searchable dropdown (.xdd, checkbox items, stays open until "Done"/outside click) ----------
  function initMultiDropdown(root, opts) {
    // opts: { items: [{value,label,group}], placeholder, onChange(selectedValuesArray) }
    if (!root) return;
    var trigger = qs('.xdd-trigger', root);
    var panel = qs('.xdd-panel', root);
    var labelSpan = qs('.xdd-trigger-label', root);
    var searchInput = qs('.xdd-search input', root);
    var list = qs('.xdd-list', root);
    var doneBtn = qs('.xdd-done', root);
    var allCheckbox = qs('.xdd-all-check', root);
    var selected = {};

    function renderList(filter) {
      var f = (filter || '').toLowerCase();
      var groups = {};
      opts.items.forEach(function (it) {
        if (f && it.label.toLowerCase().indexOf(f) === -1) return;
        var g = it.group || '';
        groups[g] = groups[g] || [];
        groups[g].push(it);
      });
      var html = '';
      Object.keys(groups).forEach(function (g) {
        if (g) html += '<div class="xdd-group-label">' + esc(g) + '</div>';
        groups[g].forEach(function (it) {
          html += '<label class="xdd-item xdd-ms-item"><input type="checkbox" data-value="' + esc(it.value) + '"' + (selected[it.value] ? ' checked' : '') + '><span>' + esc(it.label) + '</span></label>';
        });
      });
      list.innerHTML = html || '<div class="xdd-item muted">No matches</div>';
    }
    function setLabel() {
      var n = Object.keys(selected).length;
      if (!n) labelSpan.textContent = opts.placeholder;
      else if (opts.items.length && n === opts.items.length) labelSpan.textContent = 'All ' + n + ' selected';
      else labelSpan.textContent = n + ' selected';
    }
    function emitChange() { if (opts.onChange) opts.onChange(Object.keys(selected)); }
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      qsa('.xdd.open').forEach(function (o) { if (o !== root) o.classList.remove('open'); });
      root.classList.toggle('open');
      if (root.classList.contains('open')) { renderList(''); if (searchInput) { searchInput.value = ''; searchInput.focus(); } }
    });
    if (searchInput) searchInput.addEventListener('input', function () { renderList(searchInput.value); });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    list.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.type !== 'checkbox') return;
      if (cb.checked) selected[cb.dataset.value] = true; else delete selected[cb.dataset.value];
      setLabel();
      if (allCheckbox) allCheckbox.checked = opts.items.length > 0 && Object.keys(selected).length === opts.items.length;
      emitChange();
    });
    if (allCheckbox) allCheckbox.addEventListener('change', function () {
      selected = {};
      if (allCheckbox.checked) opts.items.forEach(function (it) { selected[it.value] = true; });
      renderList(searchInput ? searchInput.value : '');
      setLabel();
      emitChange();
    });
    if (doneBtn) doneBtn.addEventListener('click', function () { root.classList.remove('open'); });
    document.addEventListener('click', function () { root.classList.remove('open'); });
    (opts.initial || []).forEach(function (v) { selected[v] = true; });
    if (allCheckbox) allCheckbox.checked = opts.items.length > 0 && Object.keys(selected).length === opts.items.length;
    setLabel();
    return {
      getSelected: function () { return Object.keys(selected); },
      set: function (vals) {
        selected = {};
        (vals || []).forEach(function (v) { selected[v] = true; });
        if (allCheckbox) allCheckbox.checked = opts.items.length > 0 && Object.keys(selected).length === opts.items.length;
        renderList(searchInput ? searchInput.value : '');
        setLabel(); emitChange();
      },
    };
  }

  // ---------- choropleth map ----------
  function renderChoropleth(container, valuesByCounty, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!window.LIBERIA_COUNTIES) { container.textContent = 'Map data unavailable.'; return; }
    var wrap = document.createElement('div'); wrap.className = 'choropleth-wrap';
    var svg = el('svg', { viewBox: window.LIBERIA_VIEWBOX, role: 'img', 'aria-label': 'Choropleth map of Liberia by county' });
    var vals = Object.keys(valuesByCounty).map(function (k) { return valuesByCounty[k]; }).filter(function (v) { return v != null && !isNaN(v); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var tooltip = document.createElement('div'); tooltip.className = 'map-tooltip';

    window.LIBERIA_COUNTIES.forEach(function (c) {
      var v = valuesByCounty[c.name];
      var t = (max > min) ? (v - min) / (max - min) : 0.5;
      var fill = v == null ? '#D8DEE2' : scaleColor(t);
      var cls = '';
      if (opts.focusCounty === c.name) cls += ' focus-county';
      if (opts.compareCounty === c.name) cls += ' compare-county';
      var path = el('path', { d: c.d, fill: fill, class: cls.trim() });
      path.addEventListener('mousemove', function (e) {
        var r = wrap.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - r.left) + 'px';
        tooltip.style.top = (e.clientY - r.top) + 'px';
        tooltip.innerHTML = '<strong>' + esc(c.name) + '</strong>' + (v == null ? 'No data' : fmtNum(v) + (opts.unit ? ' ' + esc(opts.unit) : ''));
      });
      path.addEventListener('mouseleave', function () { tooltip.style.display = 'none'; });
      path.addEventListener('click', function () { if (opts.onClick) opts.onClick(c.name); });
      svg.appendChild(path);
    });
    wrap.appendChild(svg);
    wrap.appendChild(tooltip);
    container.appendChild(wrap);
  }

  // ---------- line chart (with optional comparison series + year range) ----------
  function lineChart(container, series, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!series || !series.length) { container.textContent = 'No data.'; return; }
    var W = 640, H = 300, m = { t: 20, r: 20, b: 30, l: 50 };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var allSeries = [series].concat(opts.compareSeries ? [opts.compareSeries] : []);
    var xs = series.map(function (d) { return d.year; });
    var allYs = allSeries.reduce(function (acc, s) { return acc.concat(s.map(function (d) { return d.value; })); }, []);
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    var yMax = Math.max.apply(null, allYs) * 1.12 || 1;
    var X = function (x) { return m.l + (x - xMin) / (xMax - xMin || 1) * (W - m.l - m.r); };
    var Y = function (y) { return H - m.b - (y / yMax) * (H - m.t - m.b); };

    for (var g = 0; g <= 4; g++) {
      var yv = yMax * g / 4;
      svg.appendChild(el('line', { x1: m.l, y1: Y(yv), x2: W - m.r, y2: Y(yv), stroke: COLORS.line, 'stroke-width': g === 0 ? 1.4 : 0.7 }));
      svg.appendChild(el('text', { x: m.l - 8, y: Y(yv) + 4, 'text-anchor': 'end', 'font-size': 10.5, fill: COLORS.muted, 'font-family': 'var(--sans), sans-serif' }, fmtNum(yv)));
    }
    var step = xs.length > 10 ? Math.ceil(xs.length / 7) : 1;
    xs.forEach(function (x, i) {
      if (i % step !== 0 && i !== xs.length - 1) return;
      var label = series[i].label != null ? series[i].label : String(x);
      svg.appendChild(el('text', { x: X(x), y: H - m.b + 16, 'text-anchor': 'middle', 'font-size': 10.5, fill: COLORS.muted, 'font-family': 'var(--sans), sans-serif' }, label));
    });

    function drawSeries(s, color, dashed) {
      var d = '';
      s.forEach(function (pt, i) { d += (i ? ' L' : 'M') + X(pt.year) + ',' + Y(pt.value); });
      var attrs = { d: d, fill: 'none', stroke: color, 'stroke-width': 2.4, 'stroke-linejoin': 'round' };
      if (dashed) attrs['stroke-dasharray'] = '5 3';
      svg.appendChild(el('path', attrs));
      s.forEach(function (pt, i) {
        svg.appendChild(el('circle', { cx: X(pt.year), cy: Y(pt.value), r: i === s.length - 1 ? 4 : 2.4, fill: color }));
      });
      var last = s[s.length - 1];
      svg.appendChild(el('text', { x: X(last.year) - 6, y: Y(last.value) - 9, 'text-anchor': 'end', 'font-size': 11.5, 'font-weight': 700, fill: color, 'font-family': 'var(--sans), sans-serif' }, fmtNum(last.value)));
    }
    drawSeries(series, COLORS.teal, false);
    if (opts.compareSeries) drawSeries(opts.compareSeries, COLORS.clay, true);
    container.appendChild(svg);
  }

  function barChart(container, rows, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!rows || !rows.length) { container.textContent = 'No data.'; return; }
    var labelKey = opts.labelKey || 'county', valKey = opts.valKey || 'value';
    var W = 560, rowH = 24, m = { t: 6, r: 52, b: 6, l: 132 };
    var H = m.t + m.b + rows.length * rowH;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var max = Math.max.apply(null, rows.map(function (r) { return r[valKey]; })) || 1;
    rows.forEach(function (r, i) {
      var y = m.t + i * rowH;
      var w = (r[valKey] / max) * (W - m.l - m.r);
      var color = opts.color || (opts.low ? COLORS.clay : COLORS.teal);
      if (opts.colorFor) color = opts.colorFor(r, i);
      if (opts.highlightTop && i === 0) color = COLORS.gold;
      svg.appendChild(el('text', { x: m.l - 8, y: y + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': 11, fill: COLORS.navy }, String(r[labelKey]).slice(0, 20)));
      svg.appendChild(el('rect', { x: m.l, y: y + 4, width: Math.max(w, 1.5), height: rowH - 9, fill: color, rx: 3 }));
      svg.appendChild(el('text', { x: m.l + Math.max(w, 1.5) + 6, y: y + rowH / 2 + 4, 'font-size': 10.5, fill: COLORS.muted, 'font-family': 'var(--sans), sans-serif' }, fmtNum(r[valKey])));
    });
    container.appendChild(svg);
  }

  // ---------- sortable data table ----------
  function initSortableTable(table) {
    var tbody = qs('tbody', table);
    qsa('th.sortable', table).forEach(function (th, colIdx) {
      th.addEventListener('click', function () {
        var asc = th.dataset.dir !== 'asc';
        qsa('th.sortable', table).forEach(function (t) { delete t.dataset.dir; t.querySelector('.sort-arrow') && (t.querySelector('.sort-arrow').textContent = ''); });
        th.dataset.dir = asc ? 'asc' : 'desc';
        var arrow = th.querySelector('.sort-arrow'); if (arrow) arrow.textContent = asc ? '▲' : '▼';
        var idx = qsa('th', table).indexOf(th);
        var rows = qsa('tr', tbody);
        rows.sort(function (a, b) {
          var av = a.children[idx].dataset.sort != null ? Number(a.children[idx].dataset.sort) : a.children[idx].textContent.trim();
          var bv = b.children[idx].dataset.sort != null ? Number(b.children[idx].dataset.sort) : b.children[idx].textContent.trim();
          if (typeof av === 'number' && typeof bv === 'number') return asc ? av - bv : bv - av;
          return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  }

  // ---------- PNG export of an inline <svg> ----------
  function exportSvgToPng(svgEl, filename) {
    var xml = new XMLSerializer().serializeToString(svgEl);
    var svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();
    img.onload = function () {
      var vb = svgEl.viewBox.baseVal;
      var scale = 2;
      var canvas = document.createElement('canvas');
      canvas.width = (vb.width || svgEl.clientWidth) * scale;
      canvas.height = (vb.height || svgEl.clientHeight) * scale;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F5F7FB'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename || 'niis-export.png';
        document.body.appendChild(a); a.click(); a.remove();
      });
    };
    img.src = url;
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0B2C63;color:#fff;padding:.6rem 1.1rem;border-radius:8px;font-size:.85rem;z-index:999;box-shadow:0 6px 18px rgba(0,0,0,.2)';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); });
    else toast(text);
  }

  // ---------- generic UI: accordions ----------
  function initAccordions(selector, headSel) {
    qsa(selector).forEach(function (item) {
      qs(headSel, item).addEventListener('click', function () {
        var wasOpen = item.classList.contains('open');
        if (item.closest('.indicator-tree')) {
          // tree categories can be open independently; FAQ closes siblings
        }
        item.classList.toggle('open', !wasOpen);
      });
    });
  }

  // ============================================================
  // PAGE: Data Explorer
  // ============================================================
  // ---------- extra explorer visuals ----------
  // Vertical columns. Handles negative values (used for year-on-year growth), so the
  // baseline sits wherever zero falls rather than always at the bottom.
  function columnChart(container, rows, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!rows || !rows.length) { container.textContent = 'No data.'; return; }
    var labelKey = opts.labelKey || 'label', valKey = opts.valKey || 'value';
    var W = 620, H = 260, m = { t: 22, r: 10, b: opts.rotate ? 62 : 30, l: 44 };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var vals = rows.map(function (r) { return Number(r[valKey]) || 0; });
    var vMax = Math.max.apply(null, vals), vMin = Math.min.apply(null, vals);
    var hi = Math.max(vMax, 0) * 1.15 || 1, lo = Math.min(vMin, 0) * 1.15;
    var span = hi - lo || 1;
    var Y = function (v) { return H - m.b - ((v - lo) / span) * (H - m.t - m.b); };
    var zeroY = Y(0);

    for (var g = 0; g <= 3; g++) {
      var yv = lo + (span * g / 3);
      svg.appendChild(el('line', { x1: m.l, y1: Y(yv), x2: W - m.r, y2: Y(yv), stroke: COLORS.line, 'stroke-width': 0.7 }));
      svg.appendChild(el('text', { x: m.l - 7, y: Y(yv) + 4, 'text-anchor': 'end', 'font-size': 10,
        fill: COLORS.muted, 'font-family': 'var(--num), monospace' }, fmtNum(yv)));
    }
    if (lo < 0) svg.appendChild(el('line', { x1: m.l, y1: zeroY, x2: W - m.r, y2: zeroY, stroke: COLORS.muted, 'stroke-width': 1.1 }));

    var slot = (W - m.l - m.r) / rows.length;
    var bw = Math.max(4, Math.min(34, slot * 0.62));
    rows.forEach(function (r, i) {
      var v = Number(r[valKey]) || 0;
      var x = m.l + slot * i + (slot - bw) / 2;
      var y = v >= 0 ? Y(v) : zeroY;
      var h = Math.max(1.5, Math.abs(Y(v) - zeroY));
      var color = opts.colorFor ? opts.colorFor(v, i) : (v < 0 ? COLORS.gold : COLORS.teal);
      svg.appendChild(el('rect', { x: x, y: y, width: bw, height: h, fill: color, rx: 3 }));
      if (opts.showValues !== false) {
        svg.appendChild(el('text', { x: x + bw / 2, y: (v >= 0 ? y - 6 : y + h + 12), 'text-anchor': 'middle',
          'font-size': 9.5, 'font-weight': 700, fill: color, 'font-family': 'var(--num), monospace' },
          fmtNum(v) + (opts.suffix || '')));
      }
      var lbl = String(r[labelKey]);
      var t = el('text', { x: x + bw / 2, y: H - m.b + 13, 'font-size': 9.5, fill: COLORS.muted }, lbl);
      if (opts.rotate) {
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('transform', 'rotate(-45 ' + (x + bw / 2) + ' ' + (H - m.b + 13) + ')');
      } else {
        t.setAttribute('text-anchor', 'middle');
      }
      svg.appendChild(t);
    });
    container.appendChild(svg);
  }

  // Ring chart with a total in the middle.
  function donutChart(container, segs, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0);
    if (!total) { container.textContent = 'No data.'; return; }
    var W = 300, H = 210, cx = 105, cy = H / 2, R = 74, r = 46;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var a0 = -Math.PI / 2;
    segs.forEach(function (s) {
      if (!s.value) return;
      var a1 = a0 + (s.value / total) * Math.PI * 2;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var p = 'M' + (cx + R * Math.cos(a0)) + ',' + (cy + R * Math.sin(a0)) +
        ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + (cx + R * Math.cos(a1)) + ',' + (cy + R * Math.sin(a1)) +
        ' L' + (cx + r * Math.cos(a1)) + ',' + (cy + r * Math.sin(a1)) +
        ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + (cx + r * Math.cos(a0)) + ',' + (cy + r * Math.sin(a0)) + ' Z';
      svg.appendChild(el('path', { d: p, fill: s.color }));
      a0 = a1;
    });
    svg.appendChild(el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700,
      fill: COLORS.navy, 'font-family': 'var(--num), monospace' }, String(total)));
    svg.appendChild(el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': 10, fill: COLORS.muted },
      opts.centerLabel || 'counties'));
    segs.forEach(function (s, i) {
      var ly = 42 + i * 26;
      svg.appendChild(el('rect', { x: 200, y: ly - 9, width: 11, height: 11, rx: 3, fill: s.color }));
      svg.appendChild(el('text', { x: 218, y: ly, 'font-size': 11, fill: COLORS.navy }, s.label));
      svg.appendChild(el('text', { x: 218, y: ly + 13, 'font-size': 10, fill: COLORS.muted,
        'font-family': 'var(--num), monospace' }, s.value + ' · ' + Math.round(s.value / total * 100) + '%'));
    });
    container.appendChild(svg);
  }

  // County × year grid, shaded on the same ramp as the choropleth.
  function heatGrid(container, counties, years, lookup, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!counties.length || !years.length) { container.textContent = 'No data.'; return; }
    var cellW = 46, cellH = 23, m = { t: 22, l: 132, r: 10, b: 8 };
    var W = m.l + years.length * cellW + m.r, H = m.t + counties.length * cellH + m.b;
    // width/height are set so the grid renders at its natural size instead of being
    // stretched to the card, which blew the labels up out of proportion.
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' });
    var all = [];
    counties.forEach(function (c) { years.forEach(function (y) { var v = lookup(c, y); if (v != null) all.push(v); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    years.forEach(function (y, j) {
      svg.appendChild(el('text', { x: m.l + j * cellW + cellW / 2, y: m.t - 7, 'text-anchor': 'middle',
        'font-size': 9.5, fill: COLORS.muted, 'font-family': 'var(--num), monospace' }, String(y)));
    });
    counties.forEach(function (c, i) {
      svg.appendChild(el('text', { x: m.l - 8, y: m.t + i * cellH + cellH / 2 + 3.5, 'text-anchor': 'end',
        'font-size': 10, fill: COLORS.navy }, String(c).length > 17 ? String(c).slice(0, 16) + '…' : String(c)));
      years.forEach(function (y, j) {
        var v = lookup(c, y);
        var x = m.l + j * cellW, yy = m.t + i * cellH;
        if (v == null) {
          svg.appendChild(el('rect', { x: x + 1, y: yy + 1, width: cellW - 2, height: cellH - 2, rx: 2, fill: '#F1F4F9' }));
          return;
        }
        var t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
        var cell = el('rect', { x: x + 1, y: yy + 1, width: cellW - 2, height: cellH - 2, rx: 2, fill: scaleColor(t) });
        cell.appendChild(el('title', {}, c + ' · ' + y + ': ' + fmtNum(v)));
        svg.appendChild(cell);
      });
    });
    container.appendChild(svg);
  }

  // ============================================================
  // Shared by the catalogue, query, reports, team and log-in pages
  // ============================================================
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // a number that counts up to its value once it scrolls into view
  function tweenNumber(node, to, ms) {
    if (REDUCE) { node.textContent = to.toLocaleString('en-US'); return; }
    var from = Number(String(node.textContent).replace(/[^\d.-]/g, '')) || 0;
    if (from === to) { node.textContent = to.toLocaleString('en-US'); return; }
    var t0 = performance.now(); ms = ms || 520;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (to - from) * e).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  // numbers are written in full from the start: the page arrives whole, nothing counts up
  function initCounters() {}
  // sections that draw themselves (bars, wires, timelines) are drawn from the start, not as they scroll in
  function initInView(sel) {
    qsa(sel).forEach(function (e) { e.classList.add('is-in'); });
  }
  // a search box with a clear button
  function wireSearch(box, onInput) {
    var input = qs('input', box), x = qs('.ui-search-x', box);
    input.addEventListener('input', function () { x.hidden = !input.value; onInput(input.value); });
    x.addEventListener('click', function () { input.value = ''; x.hidden = true; onInput(''); input.focus(); });
    return input;
  }
  function pressOnly(buttons, attr, val) {
    buttons.forEach(function (b) { var on = b.getAttribute(attr) === val; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  // keeps Tab inside an open sheet or dialog
  function trapTab(e, box) {
    if (e.key !== 'Tab') return;
    var f = qsa('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ============================================================
  // PAGE: Indicator Catalogue
  // ============================================================
  function initCatalogue() {
    var state = window.__CATALOGUE_STATE__;
    var root = qs('.ic');
    if (!state || !root) return;
    var byCode = {};
    state.indicators.forEach(function (i) { byCode[i.code] = i; });
    var rows = qsa('.ic-row', root), groups = qsa('.ic-group', root);
    var cats = qsa('.ic-cat', root), pers = qsa('.ui-seg button', root);
    var empty = qs('.ui-empty', root), emptyQ = qs('#ic-empty-q'), shownEl = qs('#ic-shown');
    var domain = '', per = '';
    var params = new URLSearchParams(location.search);
    if (params.get('domain') && cats.some(function (c) { return c.dataset.domain === params.get('domain'); })) domain = params.get('domain');
    var search = wireSearch(qs('.ui-search', root), function () { apply(true); });

    function hl(name, w) {
      if (!w) return esc(name);
      var i = name.toLowerCase().indexOf(w);
      if (i < 0) return esc(name);
      return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + w.length)) + '</mark>' + esc(name.slice(i + w.length));
    }
    function apply(animate) {
      var raw = search.value.trim(), words = raw.toLowerCase().split(/\s+/).filter(Boolean);
      var n = 0, k = 0;
      rows.forEach(function (r) {
        var ok = (!domain || r.dataset.domain === domain) && (!per || r.dataset.per === per) &&
          words.every(function (w) { return r.dataset.search.indexOf(w) !== -1; });
        var was = !r.hidden;
        r.hidden = !ok;
        if (ok) {
          n++;
          if (animate && !REDUCE && (!was || words.length) && k < 14) {
            r.style.setProperty('--d', (k++ * 26) + 'ms');
            r.classList.remove('is-enter'); void r.offsetWidth; r.classList.add('is-enter');
          }
        }
        qs('.ic-row-t', r).innerHTML = hl(r.dataset.name, words[0] || '');
      });
      groups.forEach(function (g) {
        var c = qsa('.ic-row:not([hidden])', g).length;
        g.hidden = !c; qs('[data-gn]', g).textContent = c;
      });
      empty.hidden = n > 0;
      emptyQ.textContent = raw ? '“' + raw + '”' : 'these filters';
      tweenNumber(shownEl, n, 360);
      pressOnly(cats, 'data-domain', domain);
      pressOnly(pers, 'data-per', per);
      // keep the address shareable
      try {
        var u = new URL(location.href);
        if (raw) u.searchParams.set('q', raw); else u.searchParams.delete('q');
        if (domain) u.searchParams.set('domain', domain); else u.searchParams.delete('domain');
        history.replaceState(null, '', u);
      } catch (e) {}
    }
    function setDomain(d, fromBar) {
      domain = d; apply(true);
      var on = cats.filter(function (c) { return c.dataset.domain === d; })[0];
      if (on && on.scrollIntoView && getComputedStyle(on.parentNode).overflowX !== 'visible') on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: REDUCE ? 'auto' : 'smooth' });
      if (fromBar) qs('.ic-tools-band').scrollIntoView({ block: 'start', behavior: REDUCE ? 'auto' : 'smooth' });
    }
    cats.forEach(function (c) { c.addEventListener('click', function () { setDomain(c.dataset.domain); }); });
    qsa('.ic-spark-bar', root).forEach(function (b) { b.addEventListener('click', function () { setDomain(b.dataset.domain, true); }); });
    pers.forEach(function (b) { b.addEventListener('click', function () { per = b.dataset.per; apply(true); }); });
    qs('[data-reset]', root).addEventListener('click', function () {
      search.value = ''; qs('.ui-search-x', root).hidden = true; domain = ''; per = ''; apply(true);
    });
    apply(false);
    initCounters(root);
    initInView('.ic-spark');

    // ---- the record sheet
    var sheet = qs('#drawer-overlay'), panel = qs('.ic-sheet-panel', sheet), body = qs('#drawer-body'), catEl = qs('#drawer-cat');
    var current = null, lastRow = null;
    var LABELS = ['Computation', 'Collected by', 'Instrument', 'Reported at', 'Disaggregation', 'Quality tier'];
    function parseMethod(text) {
      var parts = String(text || '').split(new RegExp('(' + LABELS.join('|') + '):\\s*'));
      var out = { intro: parts[0].trim(), items: [], tier: '', note: '' };
      for (var i = 1; i < parts.length; i += 2) {
        var key = parts[i], val = (parts[i + 1] || '').trim();
        if (key === 'Quality tier') {
          var dot = val.indexOf('. ');
          if (dot > -1) { out.note = val.slice(dot + 2).trim(); val = val.slice(0, dot); }
          out.tier = val.replace(/\.$/, '');
        } else out.items.push([key, val.replace(/\.$/, '')]);
      }
      return out;
    }
    function fact(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; }
    function render(ind) {
      var m = parseMethod(ind.methodology), dots = '';
      for (var i = 0; i < 15; i++) dots += '<i' + (i < ind.coverage ? ' class="on"' : '') + ' style="--i:' + i + '"></i>';
      catEl.textContent = ind.domainLabel || '';
      body.innerHTML =
        '<h2 id="drawer-title">' + esc(ind.name) + '</h2>' +
        ((ind.headline || ind.is_mock) ? '<p class="ic-flags">' + (ind.headline ? '<span class="ic-flag">Headline indicator</span>' : '') + (ind.is_mock ? '<span class="ic-flag is-warn">Placeholder figures</span>' : '') + '</p>' : '') +
        '<p class="ic-sheet-desc">' + esc(ind.description || '') + '</p>' +
        '<dl class="ic-facts">' + fact('Unit', ind.unit) + fact('Collected', ind.periodicity || 'Not stated') + fact('Quality tier', m.tier || 'Not stated') +
          fact('Latest year', ind.last_year || ind.lastUpdated || 'n/a') + fact('Access', String(ind.access_level || '').replace(/^\w/, function (c) { return c.toUpperCase(); })) +
          '<div><dt>Code</dt><dd class="ic-code"><code>' + esc(ind.code) + '</code><button type="button" class="ic-copy" data-copy="' + esc(ind.code) + '" aria-label="Copy the indicator code"><svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></dd></div></dl>' +
        '<div class="ic-cov"><p><span>County coverage</span><b>' + esc(ind.coverage) + ' of 15</b></p><div class="ic-cov-dots" aria-hidden="true">' + dots + '</div></div>' +
        '<div class="ic-src"><span class="ui-k">Source agency</span><p>' + esc(ind.agency || 'Not stated') + '</p></div>' +
        '<div class="ic-method"><h3>Methodology</h3>' + (m.intro ? '<p>' + esc(m.intro) + '</p>' : '') +
          (m.items.length ? '<ol>' + m.items.map(function (it) { return '<li><span>' + esc(it[0]) + '</span><p>' + esc(it[1]) + '</p></li>'; }).join('') + '</ol>' : '') +
          (m.note ? '<p class="ic-method-note">' + esc(m.note) + '</p>' : '') + '</div>' +
        '<div class="ic-sheet-actions"><a class="ui-btn ui-btn-primary" href="/data?indicator=' + encodeURIComponent(ind.code) + '">Open in Data Explorer</a>' +
          '<a class="ui-btn" href="/query?indicators=' + encodeURIComponent(ind.code) + '">Add to a query</a></div>';
      var vis = rows.filter(function (r) { return !r.hidden; }), at = vis.map(function (r) { return r.dataset.code; }).indexOf(ind.code);
      qs('[data-step="-1"]', sheet).disabled = at <= 0;
      qs('[data-step="1"]', sheet).disabled = at < 0 || at >= vis.length - 1;
    }
    function open(code, row) {
      var ind = byCode[code];
      if (!ind) return;
      var swap = current !== null;
      current = code; lastRow = row || lastRow;
      render(ind);
      body.scrollTop = 0;
      if (swap) { if (!REDUCE) { body.classList.remove('is-swap'); void body.offsetWidth; body.classList.add('is-swap'); } return; }
      sheet.hidden = false;
      document.documentElement.classList.add('ui-locked');
      requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('open'); panel.focus(); }); });
    }
    function close() {
      if (current === null) return;
      current = null;
      sheet.classList.remove('open');
      document.documentElement.classList.remove('ui-locked');
      setTimeout(function () { if (current === null) sheet.hidden = true; }, REDUCE ? 0 : 280);
      if (lastRow) lastRow.focus({ preventScroll: true });
    }
    function step(d) {
      var vis = rows.filter(function (r) { return !r.hidden; });
      var at = vis.map(function (r) { return r.dataset.code; }).indexOf(current), nx = vis[at + d];
      if (nx) open(nx.dataset.code, nx);
    }
    rows.forEach(function (r) { r.addEventListener('click', function () { open(r.dataset.code, r); }); });
    qsa('[data-close]', sheet).forEach(function (b) { b.addEventListener('click', close); });
    qsa('[data-step]', sheet).forEach(function (b) { b.addEventListener('click', function () { step(Number(b.dataset.step)); }); });
    body.addEventListener('click', function (e) {
      var c = e.target.closest('.ic-copy');
      if (c) copyText(c.dataset.copy);
    });
    document.addEventListener('keydown', function (e) {
      if (current !== null) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
        else trapTab(e, panel);
        return;
      }
      var t = e.target.tagName;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t) && !e.target.isContentEditable) { e.preventDefault(); search.focus(); search.select(); }
    });
  }

  // ============================================================
  // PAGE: Data Query builder
  // ============================================================
  function initQueryBuilder() {
    var state = window.__QUERY_STATE__;
    var root = qs('.qb');
    if (!state || !root) return;
    var sel = { ind: [], cty: [] };
    var yf = qs('#year-from'), yt = qs('#year-to');
    var yearFrom = Number(yf.value), yearTo = Number(yt.value);
    var format = (qs('input[name=fmt]:checked') || { value: 'csv' }).value;
    var nameOf = {};
    state.indicators.forEach(function (i) { nameOf[i.value] = i.label; });
    // a link from the catalogue ("Add to a query") arrives with its indicators already chosen
    var params = new URLSearchParams(location.search);
    var known = function (list, v) { return list.some(function (x) { return x.value === v; }); };
    var preInd = (params.get('indicators') || '').split(',').filter(function (v) { return known(state.indicators, v); });
    var preCty = (params.get('counties') || '').split(',').filter(function (v) { return known(state.counties, v); });

    var ddInd = initMultiDropdown(qs('#dd-query-indicators'), {
      items: state.indicators, placeholder: 'Choose indicators', initial: preInd,
      onChange: function (v) { sel.ind = v; update(); },
    });
    var ddCty = initMultiDropdown(qs('#dd-query-counties'), {
      items: state.counties, placeholder: 'Choose counties', initial: preCty,
      onChange: function (v) { sel.cty = v; update(); },
    });
    sel.ind = preInd; sel.cty = preCty;

    function chips(key, values, all) {
      var box = qs('[data-chips="' + key + '"]', root);
      if (!values.length) { box.innerHTML = ''; return; }
      if (all && values.length === all) { box.innerHTML = ''; return; }
      var shown = values.slice(0, 8);
      box.innerHTML = shown.map(function (v) {
        var label = key === 'ind' ? (nameOf[v] || v) : v;
        return '<span class="qb-chip">' + esc(label) + '<button type="button" data-drop="' + esc(v) + '" aria-label="Remove ' + esc(label) + '"><svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span>';
      }).join('') + (values.length > shown.length ? '<span class="qb-chip is-more">+' + (values.length - shown.length) + ' more</span>' : '');
    }
    qsa('[data-chips]', root).forEach(function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-drop]');
        if (!b) return;
        var key = box.dataset.chips, dd = key === 'ind' ? ddInd : ddCty;
        dd.set(sel[key].filter(function (v) { return v !== b.dataset.drop; }));
      });
    });
    qs('[data-all-counties]', root).addEventListener('click', function () { ddCty.set(state.counties.map(function (c) { return c.value; })); });
    qs('[data-clear-counties]', root).addEventListener('click', function () { ddCty.set([]); });

    function stepState(key, done, text) {
      var s = qs('[data-step="' + key + '"]', root);
      s.classList.toggle('is-done', done);
      qs('[data-state]', s).textContent = text;
    }
    function track() {
      qsa('.qb-track span', root).forEach(function (c) {
        var y = Number(c.dataset.y);
        c.classList.toggle('on', y >= yearFrom && y <= yearTo);
        c.classList.toggle('edge', y === yearFrom || y === yearTo);
      });
    }
    function years() {
      yearFrom = Number(yf.value); yearTo = Number(yt.value);
      if (yearFrom > yearTo) { var t = yearFrom; yearFrom = yearTo; yearTo = t; yf.value = yearFrom; yt.value = yearTo; }
      update();
    }
    yf.addEventListener('change', years);
    yt.addEventListener('change', years);
    // the year cells move whichever end of the range is nearer
    qsa('.qb-track span', root).forEach(function (c) {
      c.addEventListener('click', function () {
        var y = Number(c.dataset.y);
        if (Math.abs(y - yearFrom) <= Math.abs(y - yearTo)) yf.value = y; else yt.value = y;
        years();
      });
    });
    qsa('input[name=fmt]', root).forEach(function (r) { r.addEventListener('change', function () { format = r.value; update(true); }); });

    var tbody = qs('#query-preview tbody'), empty = qs('#qb-empty'), table = qs('#query-preview');
    var countEl = qs('#query-count'), more = qs('#qb-more'), summary = qs('#qb-summary');
    var apiBox = qs('#api-call-box'), copyBtn = qs('#qb-copy');
    var dl = qs('#btn-generate-download'), saveBtn = qs('#btn-save-query'), saveForm = qs('#qb-save');
    var seq = 0, timer = null;
    function qp(withFormat) {
      var p = new URLSearchParams();
      p.set('indicators', sel.ind.join(',')); p.set('counties', sel.cty.join(','));
      p.set('year_from', yearFrom); p.set('year_to', yearTo);
      if (withFormat) p.set('format', format);
      return p.toString();
    }
    function ready() { return sel.ind.length && sel.cty.length; }
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    function update(formatOnly) {
      var allC = state.counties.length;
      chips('ind', sel.ind); chips('cty', sel.cty, allC);
      stepState('ind', sel.ind.length > 0, sel.ind.length ? sel.ind.length + ' chosen' : 'None yet');
      stepState('cty', sel.cty.length > 0, sel.cty.length ? (sel.cty.length === allC ? 'All ' + allC : sel.cty.length + ' chosen') : 'None yet');
      stepState('yrs', true, yearFrom === yearTo ? String(yearFrom) : yearFrom + ' to ' + yearTo);
      stepState('fmt', true, format === 'xlsx' ? 'Excel' : format.toUpperCase());
      qs('[data-clear-counties]', root).hidden = !sel.cty.length;
      qs('[data-all-counties]', root).hidden = sel.cty.length === allC;
      track();
      var ok = ready();
      dl.disabled = !ok; copyBtn.disabled = !ok; saveBtn.disabled = !ok || !state.signedIn;
      apiBox.textContent = ok ? 'GET ' + location.origin + '/api/v1/query?' + qp(true) : 'Choose indicators and counties to build the call.';
      apiBox.classList.toggle('is-idle', !ok);
      summary.textContent = ok ? plural(sel.ind.length, 'indicator') + ' · ' + (sel.cty.length === allC ? 'all ' + allC + ' counties' : plural(sel.cty.length, 'county').replace('countys', 'counties')) + ' · ' + (yearFrom === yearTo ? yearFrom : yearFrom + ' to ' + yearTo) : 'Nothing selected yet';
      if (formatOnly) return;
      clearTimeout(timer);
      if (!ok) { seq++; table.hidden = true; empty.hidden = false; more.hidden = true; countEl.textContent = ''; countEl.classList.remove('is-on'); return; }
      skeleton();
      timer = setTimeout(load, 220);
    }
    function skeleton() {
      empty.hidden = true; table.hidden = false; more.hidden = true;
      var r = '';
      for (var i = 0; i < 7; i++) r += '<tr class="qb-skel" style="--i:' + i + '"><td><i></i></td><td><i></i></td><td class="num"><i></i></td><td class="num"><i></i></td><td><i></i></td></tr>';
      tbody.innerHTML = r;
      root.classList.add('is-loading');
    }
    function load() {
      var my = ++seq;
      fetch('/api/v1/query/preview?' + qp(false)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
        if (my !== seq) return;
        root.classList.remove('is-loading');
        var rows = data.rows || [];
        if (!rows.length) {
          tbody.innerHTML = '<tr class="qb-none"><td colspan="5">No values recorded for this selection. Try a wider year range.</td></tr>';
        } else {
          tbody.innerHTML = rows.slice(0, 60).map(function (r, i) {
            return '<tr style="--i:' + Math.min(i, 14) + '"><td>' + esc(r.indicator) + '</td><td>' + esc(r.county) + '</td><td class="num">' + r.year + '</td><td class="num">' + fmtNum(r.value) + '</td><td class="qb-unit">' + esc(r.unit) + '</td></tr>';
          }).join('');
        }
        more.hidden = data.count <= 60;
        more.textContent = 'Showing the first 60 of ' + Number(data.count).toLocaleString('en-US') + ' rows. The download has them all.';
        countEl.classList.add('is-on');
        countEl.innerHTML = '<b>0</b> rows';
        tweenNumber(qs('b', countEl), Number(data.count) || 0, 500);
      }).catch(function () {
        if (my !== seq) return;
        root.classList.remove('is-loading');
        tbody.innerHTML = '<tr class="qb-none"><td colspan="5">The preview could not load. <button type="button" class="qb-retry">Try again</button></td></tr>';
        var b = qs('.qb-retry', tbody); if (b) b.addEventListener('click', function () { skeleton(); load(); });
      });
    }
    copyBtn.addEventListener('click', function () {
      copyText(location.origin + '/api/v1/query?' + qp(true));
      copyBtn.classList.add('is-done'); qs('span', copyBtn).textContent = 'Copied';
      setTimeout(function () { copyBtn.classList.remove('is-done'); qs('span', copyBtn).textContent = 'Copy'; }, 1600);
    });
    dl.addEventListener('click', function () {
      if (!ready()) return;
      dl.classList.add('is-busy'); setTimeout(function () { dl.classList.remove('is-busy'); }, 1400);
      window.location = '/api/v1/query?' + qp(true);
    });
    saveBtn.addEventListener('click', function () {
      saveForm.hidden = false; saveBtn.hidden = true;
      qs('#qb-save-name').focus();
    });
    qs('[data-cancel]', saveForm).addEventListener('click', function () { saveForm.hidden = true; saveBtn.hidden = false; saveBtn.focus(); });
    saveForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = qs('#qb-save-name').value.trim();
      if (!name) { qs('#qb-save-name').focus(); return; }
      fetch('/api/v1/query/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, indicators: sel.ind.join(','), counties: sel.cty.join(','), year_from: yearFrom, year_to: yearTo, format: format }),
      }).then(function (r) { return r.json(); }).then(function (res) {
        toast(res.ok ? 'Query saved' : (res.error || 'Could not save the query'));
        if (res.ok) { saveForm.hidden = true; saveBtn.hidden = false; qs('#qb-save-name').value = ''; }
      }).catch(function () { toast('Could not save the query'); });
    });
    update();
  }

  // ============================================================
  // PAGE: ICT Reports
  // ============================================================
  function initReports() {
    var data = window.__REPORTS__;
    var root = qs('.rx');
    if (!data || !root) return;
    var grid = qs('#rx-grid'), cards = qsa('[data-rp-item]', grid), chips = qsa('.rx-tags .ui-chip', root);
    var empty = qs('.rx-lib .ui-empty', root), tag = '';
    var search = wireSearch(qs('.rx-lib .ui-search', root), function () { apply(); });
    // filtering rearranges the cards with a FLIP: measure, change, then play each card from its old place
    function apply() {
      var words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      var before = new Map();
      cards.forEach(function (c) { if (!c.hidden) before.set(c, c.getBoundingClientRect()); });
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!tag || c.dataset.tag === tag) && words.every(function (w) { return c.dataset.search.indexOf(w) !== -1; });
        c.hidden = !ok; if (ok) n++;
      });
      empty.hidden = n > 0;
      grid.classList.toggle('is-all', !tag && !words.length);
      pressOnly(chips, 'data-tag', tag);
      if (REDUCE) return;
      cards.forEach(function (c) {
        if (c.hidden) return;
        var was = before.get(c), now = c.getBoundingClientRect();
        if (was) {
          var dx = was.left - now.left, dy = was.top - now.top;
          if (dx || dy) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
        } else {
          c.animate([{ opacity: 0, transform: 'scale(.96) translateY(8px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      });
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { tag = c.dataset.tag; apply(); }); });
    qs('[data-reset]', root).addEventListener('click', function () { tag = ''; search.value = ''; qs('.rx-lib .ui-search-x', root).hidden = true; apply(); });
    // a soft light follows the pointer across a card
    cards.forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    // the summary dialog
    var dlg = qs('#rx-modal'), lastBtn = null;
    function open(i, btn) {
      var r = data[i];
      if (!r || !dlg) return;
      lastBtn = btn;
      qs('#rx-m-img').setAttribute('style', r.bg);
      qs('#rx-m-tag').textContent = r.tag; qs('#rx-m-date').textContent = r.date;
      qs('#rx-m-title').textContent = r.title; qs('#rx-m-desc').textContent = r.desc;
      qs('#rx-m-rel').innerHTML = r.related.length ? '<p class="ui-k">The data behind it</p>' + r.related.map(function (x) {
        return '<div class="rx-m-cat"><a href="/indicators?domain=' + encodeURIComponent(x.d) + '"><span>' + esc(x.label) + '</span><b>' + x.n + ' indicators</b></a><p>' + x.names.map(esc).join(' · ') + (x.n > x.names.length ? ' and more' : '') + '</p></div>';
      }).join('') : '';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      document.documentElement.classList.add('ui-locked');
    }
    function close() {
      if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    }
    if (dlg) {
      dlg.addEventListener('close', function () { document.documentElement.classList.remove('ui-locked'); if (lastBtn) lastBtn.focus({ preventScroll: true }); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
    }
    qsa('[data-open]', root).forEach(function (b) { b.addEventListener('click', function () { open(Number(b.dataset.open), b); }); });
    initCounters(root);
    initInView('.rx-tl, .rx-feat');
  }

  // ============================================================
  // PAGE: Our Team
  // ============================================================
  // A scroll-snapping row of cards with skip buttons, a counter, a progress line and mouse drag;
  // fingers get the browser's own momentum and snapping. o: { item, at, total, bar, prev, next, onTap }
  function rowCarousel(track, o) {
    var all = qsa(o.item, track);
    function cards() { return all.filter(function (c) { return !c.hidden; }); }
    function pad(n) { return String(n).padStart(2, '0'); }
    // one column's width: the gap between the first two distinct column edges
    function stepW() {
      var xs = cards().map(function (c) { return c.offsetLeft; }).sort(function (a, b) { return a - b; });
      for (var i = 1; i < xs.length; i++) if (xs[i] > xs[0] + 1) return xs[i] - xs[0];
      return track.clientWidth;
    }
    function perView() { return Math.max(1, Math.round(track.clientWidth / stepW())); }
    // the counter shows how many have come into view (at least half of a card)
    function sync() {
      var max = track.scrollWidth - track.clientWidth, x = track.scrollLeft, view = Math.min(1, track.clientWidth / track.scrollWidth);
      var edge = track.getBoundingClientRect().right - 2, cs = cards();
      o.at.textContent = pad(cs.filter(function (c) { var r = c.getBoundingClientRect(); return r.left + r.width / 2 < edge; }).length);
      if (o.total) o.total.textContent = pad(cs.length);
      o.bar.style.width = (view * 100) + '%';
      o.bar.style.transform = 'translateX(' + (max > 0 ? (x / max) * (1 / view - 1) * 100 : 0) + '%)';
      o.prev.disabled = x <= 2; o.next.disabled = x >= max - 2;
    }
    var queued = false;
    track.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sync(); });
    }, { passive: true });
    addEventListener('resize', sync);
    [o.prev, o.next].forEach(function (b, k) {
      b.addEventListener('click', function () { track.scrollBy({ left: (k ? 1 : -1) * stepW() * perView(), behavior: REDUCE ? 'auto' : 'smooth' }); });
    });
    var drag = null, moved = false, unsnap = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button) return;
      drag = { x: e.clientX, s: track.scrollLeft }; moved = false;
    });
    addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; clearTimeout(unsnap); track.classList.add('is-drag'); }
      track.scrollLeft = drag.s - dx;
    });
    addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null;
      if (!moved) return;
      var w = stepW();
      track.scrollTo({ left: Math.round(track.scrollLeft / w) * w, behavior: REDUCE ? 'auto' : 'smooth' });
      unsnap = setTimeout(function () { track.classList.remove('is-drag'); }, 450);
    });
    // a drag is not a click, and a placeholder link goes nowhere (and opens nothing)
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
      if (e.target.closest('a[href="#"]')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // each card listens for itself, which every phone browser honours
    all.forEach(function (c) { c.addEventListener('click', function () { o.onTap(c); }); });
    // the keyboard walks the cards in reading order
    track.addEventListener('keydown', function (e) {
      var c = e.target.closest(o.item);
      if (!c) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onTap(c); return; }
      var by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!by) return;
      var cs = cards().sort(function (a, b) { return a.dataset.i - b.dataset.i; });
      var nx = cs[cs.indexOf(c) + by];
      if (!nx) return;
      e.preventDefault();
      nx.focus({ preventScroll: true });
      nx.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: REDUCE ? 'auto' : 'smooth' });
    });
    sync();
    return { sync: sync, reset: function () { track.scrollTo({ left: 0 }); sync(); } };
  }

  // ---- a person's profile: name, role, education, experience and links, with skip buttons to the
  // next. A layer of its own (not the browser's dialog element), so it opens the same on every phone.
  function initPeople() {
    var wrap = qs('#pmWrap'), pm = qs('#pm'), P = window.__PEOPLE__;
    if (!wrap || !pm || !P) return null;
    var tpl = qs('#pmSocial'), cur = null, from = null, hideT = 0;
    var KIND = {
      team: function () { return 'NIIS team'; },
      patron: function (p) { return 'National ICT Patron · ' + p.badge; },
      talent: function (p) { return 'ICT talent · ' + p.field + ' · ' + p.county; },
    };
    function li(text) { var l = document.createElement('li'); l.textContent = text; return l; }
    function fill(kind, i) {
      var list = P[kind], p = list[i];
      cur = { kind: kind, i: i };
      qs('.pm-photo img', pm).src = p.img;
      qs('.pm-kind', pm).textContent = KIND[kind](p);
      qs('#pm-name', pm).textContent = p.name;
      qs('.pm-role', pm).textContent = p.role;
      qs('.pm-bio', pm).textContent = p.bio || '';
      var edu = qs('.pm-edu', pm); edu.innerHTML = '';
      (p.edu || []).forEach(function (t) { edu.appendChild(li(t)); });
      var exp = qs('.pm-exp', pm); exp.innerHTML = '';
      (p.exp || []).forEach(function (x) {
        var l = document.createElement('li');
        l.innerHTML = '<b></b><span></span><em></em>';
        l.children[0].textContent = x[0]; l.children[1].textContent = x[1]; l.children[2].textContent = x[2];
        exp.appendChild(l);
      });
      var sk = qs('.pm-skills', pm); sk.innerHTML = '';
      (p.skills || []).forEach(function (t) { sk.appendChild(li(t)); });
      qs('[data-pm-skills]', pm).hidden = !(p.skills && p.skills.length);
      var soc = qs('.pm-social', pm);
      soc.innerHTML = tpl.innerHTML;
      qsa('a', soc).forEach(function (a) { a.setAttribute('aria-label', p.name + a.getAttribute('aria-label')); });
      qs('.pm-count', pm).textContent = (i + 1) + ' / ' + list.length;
      qs('.pm-body', pm).scrollTop = 0; qs('.pm-in', pm).scrollTop = 0;
      if (!REDUCE) { var b = qs('.pm-in', pm); b.classList.remove('is-swap'); void b.offsetWidth; b.classList.add('is-swap'); }
    }
    function open(kind, i, card) {
      from = card || null;
      fill(kind, i);
      if (wrap.classList.contains('is-open')) return;
      clearTimeout(hideT);
      wrap.hidden = false;
      void wrap.offsetWidth;
      wrap.classList.add('is-open');
      document.documentElement.classList.add('ui-locked');
      try { pm.focus({ preventScroll: true }); } catch (e) { pm.focus(); }
    }
    function close() {
      if (!wrap.classList.contains('is-open')) return;
      wrap.classList.remove('is-open');
      document.documentElement.classList.remove('ui-locked');
      hideT = setTimeout(function () { wrap.hidden = true; }, REDUCE ? 0 : 280);
      if (from) try { from.focus({ preventScroll: true }); } catch (e) {}
    }
    function step(d) { if (!cur) return; var n = P[cur.kind].length; fill(cur.kind, (cur.i + d + n) % n); }
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-pm-close]')) { close(); return; }
      if (e.target.closest('a[href="#"]')) { e.preventDefault(); return; }
      var s = e.target.closest('[data-pm-step]');
      if (s) step(Number(s.dataset.pmStep));
    });
    document.addEventListener('keydown', function (e) {
      if (!wrap.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else trapTab(e, pm);
    });
    return open;
  }

  // ---- Programs: films and photographs open in a viewer, with skip buttons between them
  function initPrograms() {
    var M = window.__PROGRAM_MEDIA__, wrap = qs('#lbWrap');
    if (!M || !wrap) return;
    initCounters(qs('.pg'));
    initInView('.pg-stages, .pg-events, .pg-train');
    var box = qs('.lb', wrap), stage = qs('.lb-stage', wrap), cap = qs('.lb-cap', wrap), cur = null, from = null, hideT = 0;
    function show(kind, i) {
      var list = M[kind], n = list.length; i = (i + n) % n; cur = { kind: kind, i: i };
      var it = list[i];
      stage.innerHTML = '';
      if (kind === 'film') {
        var v = document.createElement('video');
        v.src = it.src; v.poster = it.poster; v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'metadata';
        stage.appendChild(v);
        cap.textContent = it.title + ' · ' + it.body;
      } else {
        var im = document.createElement('img'); im.src = it.src; im.alt = it.alt; stage.appendChild(im);
        cap.textContent = it.alt;
      }
      if (!REDUCE) { stage.classList.remove('is-swap'); void stage.offsetWidth; stage.classList.add('is-swap'); }
    }
    function open(kind, i, btn) {
      from = btn; show(kind, i);
      clearTimeout(hideT); wrap.hidden = false; void wrap.offsetWidth; wrap.classList.add('is-open');
      document.documentElement.classList.add('ui-locked');
      try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
    }
    function close() {
      if (!wrap.classList.contains('is-open')) return;
      wrap.classList.remove('is-open'); document.documentElement.classList.remove('ui-locked');
      var v = qs('video', stage); if (v) v.pause();
      hideT = setTimeout(function () { wrap.hidden = true; stage.innerHTML = ''; }, REDUCE ? 0 : 280);
      if (from) try { from.focus({ preventScroll: true }); } catch (e) {}
    }
    qsa('[data-lb]').forEach(function (b) { b.addEventListener('click', function () { open(b.dataset.lb, Number(b.dataset.i), b); }); });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]')) { close(); return; }
      var s = e.target.closest('[data-lb-step]');
      if (s && cur) show(cur.kind, cur.i + Number(s.dataset.lbStep));
    });
    document.addEventListener('keydown', function (e) {
      if (!wrap.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight' && cur) { e.preventDefault(); show(cur.kind, cur.i + 1); }
      else if (e.key === 'ArrowLeft' && cur) { e.preventDefault(); show(cur.kind, cur.i - 1); }
      else trapTab(e, box);
    });
  }

  function initTeam() {
    var root = qs('.tm');
    if (!root) return;
    initInView('.tc-panel, .tp-panel');
    var openPerson = initPeople() || function () {};
    function openCard(c) { openPerson(c.dataset.person, Number(c.dataset.i), c); }

    // ---- the team and the patrons: studio cards, two rows of four, filled column by column
    qsa('.tc-track[data-row]').forEach(function (track) {
      var sec = track.closest('.tc');
      rowCarousel(track, {
        item: '.tc-card', at: qs('[data-row-at]', sec), bar: qs('.tc-progress i', sec),
        prev: qs('[data-row-step="-1"]', sec), next: qs('[data-row-step="1"]', sec), onTap: openCard,
      });
    });

    // ---- the talent pool: four rows of four in reading order, filtered by field
    var tTrack = qs('#tpTrack');
    if (tTrack) {
      var tCards = qsa('.tp-card', tTrack), chips = qsa('[data-tp-field]');
      // the first sixteen fill the view row by row; the rest follow a column at a time
      var lay = function () {
        tCards.filter(function (c) { return !c.hidden; }).sort(function (a, b) { return a.dataset.i - b.dataset.i; }).forEach(function (c, k) {
          var r = k < 16 ? Math.floor(k / 4) : (k - 16) % 4, col = k < 16 ? k % 4 : 4 + Math.floor((k - 16) / 4);
          c.style.gridRow = r + 1; c.style.gridColumn = col + 1;
        });
      };
      lay();
      var row = rowCarousel(tTrack, {
        item: '.tp-card', at: qs('[data-tp-at]'), total: qs('[data-tp-total]'), bar: qs('.tp-progress i'),
        prev: qs('[data-tp="-1"]'), next: qs('[data-tp="1"]'), onTap: openCard,
      });
      chips.forEach(function (b) {
        b.addEventListener('click', function () {
          var f = b.dataset.tpField, k = 0;
          pressOnly(chips, 'data-tp-field', f);
          tCards.forEach(function (c) {
            var show = !f || c.dataset.field === f;
            c.hidden = !show;
            if (show && !REDUCE) c.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: Math.min(k++, 8) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
          });
          lay();
          row.reset();
        });
      });
    }
  }

  // ============================================================
  // PAGE: Log in
  // ============================================================
  function initLogin() {
    var root = qs('.lg');
    if (!root) return;
    var form = qs('.lg-form', root), email = qs('#lg-email'), pass = qs('#lg-pass'), eye = qs('.lg-eye', root);
    var submit = qs('.lg-submit', root);
    eye.addEventListener('click', function () {
      var show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', show ? 'true' : 'false');
      eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      eye.classList.toggle('is-on', show);
      pass.focus();
    });
    function fieldError(input, on) {
      var f = input.closest('.lg-field');
      f.classList.toggle('is-invalid', on);
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      qs('.lg-err', f).hidden = !on;
    }
    [email, pass].forEach(function (i) { i.addEventListener('input', function () { if (i.value) fieldError(i, false); }); });
    form.addEventListener('submit', function (e) {
      var bad = null;
      if (!email.value.trim() || (email.validity && email.validity.typeMismatch)) { fieldError(email, true); bad = bad || email; }
      if (!pass.value) { fieldError(pass, true); bad = bad || pass; }
      if (bad) {
        e.preventDefault(); bad.focus();
        if (!REDUCE) { form.classList.remove('is-shake'); void form.offsetWidth; form.classList.add('is-shake'); }
        return;
      }
      submit.classList.add('is-busy'); submit.disabled = true;
      qs('.lg-submit-t', submit).textContent = 'Signing in';
    });
    // the demonstration accounts fill the form
    qsa('[data-fill-email]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        email.value = b.dataset.fillEmail; pass.value = b.dataset.fillPass;
        fieldError(email, false); fieldError(pass, false);
        [email, pass].forEach(function (i) { i.classList.remove('is-filled'); void i.offsetWidth; i.classList.add('is-filled'); });
        submit.focus();
      });
    });
    // the brand panel's grid: a few cells light and fade at a time
    var cells = qsa('.lg-cells i', root);
    if (REDUCE || !cells.length) return;
    setInterval(function () {
      if (document.hidden) return;
      var c = cells[Math.floor(Math.random() * cells.length)];
      c.classList.add('on');
      setTimeout(function () { c.classList.remove('on'); }, 1600 + Math.random() * 1400);
    }, 260);
  }

  // ============================================================
  // PAGE: Dashboard topic
  // ============================================================
  function initDashboardTopic() {
    var state = window.__DASHBOARD_STATE__;
    if (!state) return;
    var countyFilter = qs('#dash-county-filter');
    var topicSelect = qs('#dash-topic-select');
    var topic = state.topic;
    function applyMeta() {
      var meta = (state.meta || {})[topic];
      if (!meta) return;
      var desc = qs('#dash-description'); if (desc) desc.textContent = meta.description || '';
      var narr = qs('#dash-narrative'); if (narr) narr.textContent = meta.narrative || '';
      if (document.title && meta.label) document.title = meta.label + ' · NIIS';
    }
    function load() {
      var county = countyFilter ? countyFilter.value : '';
      fetch('/api/v1/dashboards/' + topic + (county ? '?county=' + encodeURIComponent(county) : ''))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var syncEl = qs('#dash-sync-text');
          if (syncEl) {
            var sync = new Date(d.last_etl_sync);
            syncEl.textContent = 'sync ' + sync.toISOString().slice(0, 16).replace('T', ' ') + ' UTC · data through ' + String(d.last_data_update).slice(0, 10);
          }
          var scope = qs('#dash-scope-label'); if (scope) scope.textContent = d.scope;
          var hero = qs('#dash-hero-stats');
          if (hero) hero.innerHTML = d.heroStats.map(function (k) {
            return '<div class="cell"><div class="val">' + fmtNum(k.value) + '</div><div class="lbl">' + esc(k.name) + ' · ' + esc(k.unit) + '</div></div>';
          }).join('');
          if (d.trend) {
            lineChart(qs('#dash-trend'), d.trend.series, {});
            var tt = qs('#dash-trend-title'); if (tt) tt.textContent = d.trend.name + ' ,  ' + d.scope;
          }
          if (d.ranking) { barChart(qs('#dash-ranking-top'), d.ranking.top, { highlightTop: true }); barChart(qs('#dash-ranking-bottom'), d.ranking.bottom, { low: true }); }
          renderDashViz(d, county);
          var dl = qs('#dash-download'); if (dl) dl.href = '/api/v1/download/data.csv?indicator=' + encodeURIComponent(d.trend ? d.trend.code : '');
          if (d.trend && d.trend.code) loadMap(d.trend.code, d.trend.name);
        })
        .catch(function () {});
    }
    // Same visual set as the Data Explorer. Year-on-year growth comes straight off the
    // trend series; the distribution, the change ring and the heat map need the full
    // county x year matrix, which is fetched once per indicator and cached.
    var dashMatrix = {};
    function renderDashViz(d, county) {
      var scope = qs('#dash-growth-scope');
      if (scope) scope.textContent = county || 'National';

      var ser = (d.trend && d.trend.series) || [];
      var growth = [];
      for (var i = 1; i < ser.length; i++) {
        var prev = ser[i - 1].value, cur = ser[i].value;
        if (prev == null || cur == null || prev === 0) continue;
        growth.push({ label: String(ser[i].year), value: Math.round(((cur - prev) / prev) * 1000) / 10 });
      }
      if (qs('#dash-growth')) columnChart(qs('#dash-growth'), growth, { suffix: '%' });

      var code = d.trend && d.trend.code;
      if (!code) return;
      if (dashMatrix[code]) { drawFromMatrix(dashMatrix[code]); return; }
      var heatBox = qs('#dash-heat');
      if (heatBox) heatBox.textContent = 'Loading…';
      fetch('/api/v1/download/data.json?indicator=' + encodeURIComponent(code))
        .then(function (r) { return r.json(); })
        .then(function (payload) {
          var m = { byKey: {}, counties: [], years: [] };
          var seenC = {}, seenY = {};
          (payload.data || []).forEach(function (row) {
            if (!seenY[row.year]) { seenY[row.year] = 1; m.years.push(row.year); }
            // National totals arrive with county: null - they are not a county row.
            if (row.county == null || row.county === '') return;
            m.byKey[row.county + '|' + row.year] = row.value;
            if (!seenC[row.county]) { seenC[row.county] = 1; m.counties.push(row.county); }
          });
          m.counties.sort();
          m.years.sort(function (a, b) { return a - b; });
          dashMatrix[code] = m;
          drawFromMatrix(m);
        })
        .catch(function () { if (heatBox) heatBox.textContent = 'Heat map unavailable.'; });
    }

    function drawFromMatrix(m) {
      var latest = m.years[m.years.length - 1], prev = m.years[m.years.length - 2];
      var yl = qs('#dash-dist-year'); if (yl) yl.textContent = String(latest);

      var rows = m.counties.map(function (c) { return { label: c, value: m.byKey[c + '|' + latest] }; })
        .filter(function (r) { return r.value != null; })
        .sort(function (a, b) { return b.value - a.value; });
      if (qs('#dash-distribution')) {
        columnChart(qs('#dash-distribution'), rows, {
          rotate: true, showValues: false,
          colorFor: function (v, i) { return i === 0 ? COLORS.gold : COLORS.teal; },
        });
      }

      var up = 0, down = 0, flat = 0;
      m.counties.forEach(function (c) {
        var a = m.byKey[c + '|' + prev], b = m.byKey[c + '|' + latest];
        if (a == null || b == null || b === a) flat++;
        else if (b > a) up++; else down++;
      });
      if (qs('#dash-change')) {
        donutChart(qs('#dash-change'), [
          { label: 'Increased', value: up, color: COLORS.teal },
          { label: 'Decreased', value: down, color: COLORS.gold },
          { label: 'No change', value: flat, color: COLORS.clay },
        ], { centerLabel: 'counties' });
      }

      if (qs('#dash-heat')) {
        heatGrid(qs('#dash-heat'), m.counties, m.years, function (c, y) {
          var v = m.byKey[c + '|' + y];
          return v == null ? null : v;
        });
      }
    }

    // County choropleth + map-size control, same as the Data Explorer
    var mapZoomPct = 100;
    var mapZoom = qs('#map-zoom');
    function applyMapZoom() {
      var wrap = qs('#choropleth .choropleth-wrap');
      if (wrap) wrap.style.maxWidth = mapZoomPct + '%';
    }
    if (mapZoom) mapZoom.addEventListener('input', function () {
      mapZoomPct = Number(mapZoom.value);
      var lbl = qs('#map-zoom-val'); if (lbl) lbl.textContent = mapZoomPct + '%';
      applyMapZoom();
    });
    function loadMap(code, label) {
      var host = qs('#choropleth');
      if (!host || !code) return;
      fetch('/api/v1/explorer?indicator=' + encodeURIComponent(code))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var values = {};
          (d.table || []).forEach(function (r) { values[r.county] = r.value; });
          renderChoropleth(host, values, { unit: d.indicator ? d.indicator.unit : '' });
          applyMapZoom();
          var t = qs('#dash-map-title'); if (t) t.textContent = (d.indicator && d.indicator.name) || label || '';
          var dsc = qs('#dash-map-desc');
          if (dsc && d.indicator) dsc.textContent = (d.indicator.description || '') + ' Unit: ' + (d.indicator.unit || '') + '.';
          var yr = qs('#dash-map-year'); if (yr && d.year) yr.textContent = d.year;
          var tag = qs('#dash-map-tag'); if (tag && d.indicator && d.indicator.domainLabel) tag.textContent = d.indicator.domainLabel;
        })
        .catch(function () {});
    }
    if (countyFilter) countyFilter.addEventListener('change', load);
    if (topicSelect) topicSelect.addEventListener('change', function () {
      topic = topicSelect.value;
      applyMeta();
      if (history.replaceState) history.replaceState(null, '', '/dashboards?topic=' + encodeURIComponent(topic));
      load();
    });
    applyMeta();
    load();
  }

  // ============================================================
  // PAGE: Home (global selector + dashboard live status not required)
  // ============================================================
  function initHome() {
    var state = window.__HOME_STATE__;
    if (!state) return;
    var items = state.indicators.map(function (i) { return { value: '/data?indicator=' + i.code, label: i.name, group: i.domainLabel }; })
      .concat(state.dashboards.map(function (d) { return { value: '/dashboards/' + d.slug, label: d.label, group: 'Dashboards' }; }));
    initDropdown(qs('#dd-home-indicator'), { items: items, placeholder: 'Search indicators or dashboards…', onChange: function (v) { window.location = v; } });
    var countyItems = [{ value: '/dashboards/connectivity', label: 'National (Liberia)', group: '' }].concat(state.counties.map(function (c) { return { value: '/data?focus=' + encodeURIComponent(c.name), label: c.name, group: '' }; }));
    initDropdown(qs('#dd-home-focus'), { items: countyItems, placeholder: 'Focus county', onChange: function (v) { window.location = v; } });
    initDropdown(qs('#dd-home-compare'), { items: state.counties.map(function (c) { return { value: '/data?compare=' + encodeURIComponent(c.name), label: c.name, group: '' }; }), placeholder: 'Comparison county', onChange: function (v) { window.location = v; } });
  }

  function initAnalyticsLegacy() {
    var an = window.__ANALYTICS__;
    if (!an) return;
    lineChart(qs('#analytics-daily'), an.daily.map(function (d, i) { return { year: i, value: d.n, label: d.day.slice(5) }; }), { });
    barChart(qs('#analytics-paths'), an.topPaths, { labelKey: 'path', valKey: 'n', color: COLORS.navy });
  }

  // Shared toolkit for page bundles loaded alongside this file (public/explorer.js).
  window.NICTD = { el: el, esc: esc, qs: qs, qsa: qsa, fmtNum: fmtNum, scaleColor: scaleColor,
    initDropdown: initDropdown, initSortableTable: initSortableTable, exportSvgToPng: exportSvgToPng,
    toast: toast, copyText: copyText, COLORS: COLORS, SVG_NS: SVG_NS };

  // ---------- boot ----------
  var page = window.__NICTD_PAGE__;
  document.addEventListener('DOMContentLoaded', function () {
    initAccordions('.faq-item', '.faq-q');
    if (page === 'home') { initHome(); if (window.__DASHBOARD_STATE__) initDashboardTopic(); }
    // the Data Explorer runs on its own engine, public/explorer.js
    if (page === 'catalogue') initCatalogue();
    if (page === 'query') initQueryBuilder();
    if (page === 'reports') initReports();
    if (page === 'team') initTeam();
    if (page === 'programs') initPrograms();
    if (page === 'login') initLogin();
    if (page === 'dashboard-topic') initDashboardTopic();
    if (page === 'analytics-legacy') initAnalyticsLegacy();
  });
})();

// ---------- the nav dock: icons swell toward the pointer, as the macOS dock's do ----------
// Ported from a shadcn Dock (framer-motion) to plain JS: the same falloff (an icon is full size at the
// pointer and back to rest 150px away) and the same spring (mass .1, stiffness 150, damping 12, which
// settles without bouncing). Each icon's scale is integrated toward its target every frame and set as
// --dock-s (a transform, so nothing reflows and the names hold still); the loop stops once everything
// is at rest. Only for a real pointer, and never with reduced motion.
(function () {
  var dock = document.querySelector('.gov-navlinks.dock');
  if (!dock || !window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var items = [].slice.call(dock.querySelectorAll('.dock-item'));
  var BASE = 1, MAG = 1.32, DIST = 150, K = 150, C = 12, M = 0.1;
  var st = items.map(function () { return { x: BASE, v: 0 }; });
  var pointer = null, raf = 0, last = 0;
  var wide = matchMedia('(min-width: 861px)');
  function target(el) {
    if (pointer === null) return BASE;
    var r = el.getBoundingClientRect();
    var d = Math.abs(pointer - (r.left + r.width / 2));
    return d >= DIST ? BASE : BASE + (MAG - BASE) * (1 - d / DIST);
  }
  function frame(t) {
    var dt = last ? Math.min(0.032, (t - last) / 1000) : 0.016; last = t;
    var moving = false;
    items.forEach(function (el, i) {
      var s = st[i], goal = target(el), h = dt / 4;
      for (var k = 0; k < 4; k++) { s.v += ((-K * (s.x - goal) - C * s.v) / M) * h; s.x += s.v * h; }
      if (Math.abs(s.x - goal) > 0.001 || Math.abs(s.v) > 0.01) moving = true; else { s.x = goal; s.v = 0; }
      el.style.setProperty('--dock-s', s.x.toFixed(4));
    });
    raf = moving ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  dock.addEventListener('pointermove', function (e) { if (!wide.matches) return; pointer = e.clientX; kick(); });
  dock.addEventListener('pointerleave', function () { pointer = null; kick(); });
  // a keyboard user gets the same swell on the focused tile
  dock.addEventListener('focusin', function (e) {
    if (!wide.matches || !e.target.matches('.dock .nav-link:focus-visible')) return;
    var r = e.target.getBoundingClientRect(); pointer = r.left + r.width / 2; kick();
  });
  dock.addEventListener('focusout', function () { if (!dock.matches(':hover')) { pointer = null; kick(); } });
  wide.addEventListener('change', function () { items.forEach(function (el) { el.style.removeProperty('--dock-s'); }); st.forEach(function (s) { s.x = BASE; s.v = 0; }); });
})();

// ---------- the phone menu: the burger (or the search button) opens a sheet under the app bar ----------
// The sheet holds every section and its pages, the search field and Log In. The page behind it is held
// still while it is open; Escape, the burger again or choosing a link closes it, and focus returns to
// the burger. Opening from the search button puts the cursor straight into the search field.
(function () {
  var burger = document.querySelector('.nav-burger');
  var sheet = document.getElementById('navSheet');
  if (!burger || !sheet) return;
  var finder = document.querySelector('[data-sheet-search]');
  var nav = document.querySelector('.gov-nav');
  var root = document.documentElement;
  var closeT = 0;
  function open(focusSearch) {
    clearTimeout(closeT);
    sheet.hidden = false;
    root.classList.add('nav-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    requestAnimationFrame(function () { sheet.classList.add('is-open'); });
    // focus goes to the drawer itself (no ring), so no link wears a focus box after the menu opens
    var target = focusSearch ? sheet.querySelector('input') : sheet.querySelector('.nav-drawer');
    if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, focusSearch ? 60 : 0);
  }
  function close(returnFocus) {
    if (sheet.hidden) return;
    sheet.classList.remove('is-open');
    root.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    closeT = setTimeout(function () { sheet.hidden = true; }, 320);
    if (returnFocus) burger.focus({ preventScroll: true });
  }
  burger.addEventListener('click', function () { sheet.hidden ? open(false) : close(true); });
  if (finder) finder.addEventListener('click', function () { sheet.hidden ? open(true) : sheet.querySelector('input').focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(true); });
  sheet.addEventListener('click', function (e) {
    if (e.target.closest('[data-sheet-close]')) { close(true); return; }
    var plus = e.target.closest('.sheet-plus');
    if (plus) {
      var sub = document.getElementById(plus.getAttribute('aria-controls'));
      var on = plus.getAttribute('aria-expanded') !== 'true';
      plus.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (sub) sub.hidden = !on;
      return;
    }
    if (e.target.closest('a')) close(false);
  });
  // turning a tablet or widening the window back to the desktop bar closes the sheet
  var phone = window.matchMedia('(max-width: 860px)');
  phone.addEventListener('change', function () { if (!phone.matches) close(false); });
  // back from the bfcache with the sheet open: start closed
  window.addEventListener('pageshow', function () { if (!sheet.hidden) { sheet.classList.remove('is-open'); sheet.hidden = true; root.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); } });
})();

// Back to the top (phones; CSS hides it on desktop): a round button in the lower left that appears once the reader is a screen down.
// The ring around it fills as the page scrolls, so it also says how far through the page they are.
(function () {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'to-top';
  b.setAttribute('aria-label', 'Back to the top of the page');
  b.innerHTML = '<svg class="to-top-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="26" pathLength="100"/>' +
    '<circle class="to-top-fill" cx="28" cy="28" r="26" pathLength="100"/></svg>' +
    '<svg class="to-top-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
  document.body.appendChild(b);
  var fill = b.querySelector('.to-top-fill');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var queued = false;
  function update() {
    queued = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.scrollY || document.documentElement.scrollTop;
    var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    fill.style.strokeDashoffset = String(100 - p * 100);
    b.classList.toggle('is-on', y > window.innerHeight * 0.8);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  b.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    var home = document.querySelector('.gov-wordmark');
    if (home) home.focus({ preventScroll: true });
  });
  update();
})();

// The nav search: the clear button shows once something is typed and empties the box.
(function () {
  document.querySelectorAll('.nav-search').forEach(function (f) {
    var input = f.querySelector('input'), x = f.querySelector('.nav-search-x');
    if (!input || !x) return;
    function sync() { x.hidden = !input.value; }
    input.addEventListener('input', sync);
    x.addEventListener('click', function () { input.value = ''; sync(); input.focus(); });
    sync();
  });
})();

// The red rule under each section heading: five segments that read as one line. When the heading
// first comes into view, and every quarter minute or so after while it stays in view (or on hover),
// they round into dots and run a loading wave for three seconds (styles.css .hx-rule). Headings and
// the blocks under them are simply there: nothing waits to be scrolled to.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  var rules = [];
  [].slice.call(document.querySelectorAll('.sec-head-dh h2, [data-rise-head]')).forEach(function (h) {
    var head = h.closest('.sec-head-dh');
    if (!head) return;
    h.classList.add('hx', 'is-in');
    head.classList.add('hx-head', 'is-in');
    var r = document.createElement('span'); r.className = 'hx-rule'; r.setAttribute('aria-hidden', 'true');
    for (var k = 0; k < 5; k++) { var d = document.createElement('i'); d.style.setProperty('--d', k); r.appendChild(d); }
    h.appendChild(r);
    var o = { h: h, r: r, seen: false, next: 0, on: false };
    rules.push(o);
    h.addEventListener('mouseenter', function () { dots(o); });
  });
  function dots(o) {
    if (o.r.classList.contains('is-dots')) return;
    o.r.classList.add('is-dots');
    o.next = Date.now() + 15000 + Math.random() * 6000;
    setTimeout(function () { o.r.classList.remove('is-dots'); }, 3100);
  }
  if (!rules.length) return;
  var seenIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var o = rules.filter(function (x) { return x.h === e.target; })[0];
      o.on = e.isIntersecting;
      if (o.on && !o.seen) { o.seen = true; setTimeout(function () { dots(o); }, 1500); }
    });
  }, { threshold: 0.6 });
  rules.forEach(function (o) { seenIO.observe(o.h); });
  setInterval(function () {
    if (document.hidden) return;
    var t = Date.now();
    rules.forEach(function (o) { if (o.on && o.seen && t > o.next) dots(o); });
  }, 1000);
})();

// ---------- range sliders: the filled share of the track follows the value ----------
// styles.css draws the track from --p (the filled share) and, for a slider with a dozen or fewer
// steps (the years), --seg cuts it into one segment per step. Values set by script (the year
// animation) are picked up too.
(function () {
  function sync(r) {
    var min = Number(r.min) || 0, max = r.max === '' ? 100 : Number(r.max), v = Number(r.value);
    var p = max > min ? ((v - min) / (max - min)) * 100 : 0;
    r.style.setProperty('--p', p + '%');
    var steps = (max - min) / (Number(r.step) || 1);
    if (steps >= 2 && steps <= 12) { r.classList.add('has-steps'); r.style.setProperty('--seg', (100 / steps) + '%'); }
  }
  function all() { [].forEach.call(document.querySelectorAll('input[type=range]'), sync); }
  document.addEventListener('input', function (e) { if (e.target.type === 'range') sync(e.target); });
  document.addEventListener('change', function (e) { if (e.target.type === 'range') sync(e.target); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
  setInterval(function () { if (!document.hidden) all(); }, 300);
})();
