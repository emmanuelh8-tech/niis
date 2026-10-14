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
  // PAGE: ICT Reports
  // ============================================================
  // ICT Reports: a report's headline opens its summary in the dialog
  function initReports() {
    var data = window.__REPORTS__, dlg = qs('#rx-modal'), lastBtn = null;
    if (!data || !dlg) return;
    function open(i, btn) {
      var r = data[i];
      if (!r) return;
      lastBtn = btn;
      qs('#rx-m-img').setAttribute('style', r.bg);
      qs('#rx-m-tag').textContent = r.tag; qs('#rx-m-date').textContent = r.date;
      qs('#rx-m-title').textContent = r.title; qs('#rx-m-desc').textContent = r.desc;
      qs('#rx-m-rel').innerHTML = r.related.length ? '<p class="ui-k">The data behind it</p>' + r.related.map(function (x) {
        return '<div class="rx-m-cat"><a href="/data"><span>' + esc(x.label) + '</span><b>' + x.n + ' indicators</b></a><p>' + x.names.map(esc).join(' · ') + (x.n > x.names.length ? ' and more' : '') + '</p></div>';
      }).join('') : '';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      document.documentElement.classList.add('ui-locked');
    }
    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('ui-locked'); if (lastBtn) lastBtn.focus({ preventScroll: true }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
    qsa('[data-open]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); open(Number(b.dataset.open), b); }); });
    // a link to one report (/reports#report-3) opens its summary
    var m = /^#report-(\d+)$/.exec(location.hash);
    if (m) open(Number(m[1]), null);
  }

  // ============================================================
  // Research: the paper library's filter bar (search, year, type), with the Explorer's dropdowns
  // ============================================================
  function initResearchLib() {
    var lib = qs('#rsLib'), S = window.__RS__ || { years: [], types: [] };
    var items = qsa('[data-rs-item]', lib), q = qs('#rs-q'), n = qs('[data-rs-n]'), empty = qs('.rs-empty');
    var adRows = qsa('.bbc-adrow', lib), year = '', type = '';
    function opts(all, list) { return [{ value: '', label: all }].concat(list.map(function (x) { return { value: String(x), label: String(x) }; })); }
    var dY = initDropdown(qs('#dd-rs-year'), { items: opts('All years', S.years), placeholder: 'All years', selected: '', onChange: function (v) { year = v; apply(); } });
    var dT = initDropdown(qs('#dd-rs-type'), { items: opts('All types', S.types), placeholder: 'All types', selected: '', onChange: function (v) { type = v; apply(); } });
    function apply() {
      var words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      items.forEach(function (it) {
        var ok = (!year || it.dataset.year === year) && (!type || it.dataset.tag === type) &&
          words.every(function (w) { return it.dataset.search.indexOf(w) !== -1; });
        it.hidden = !ok; if (ok) shown++;
      });
      // while a filter narrows the list, the adverts between its rows step aside
      adRows.forEach(function (r) { r.classList.toggle('is-filtered', !!(year || type || words.length)); });
      n.textContent = shown;
      empty.hidden = shown > 0;
    }
    q.addEventListener('input', apply);
    qs('[data-rs-reset]').addEventListener('click', function () { year = ''; type = ''; q.value = ''; dY.setSelected(''); dT.setSelected(''); apply(); q.focus(); });
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
      patron: function () { return 'National ICT System Patron'; },
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
      edu.closest('.pm-sec').hidden = !(p.edu && p.edu.length);
      exp.closest('.pm-sec').hidden = !(p.exp && p.exp.length);
      var sk = qs('.pm-skills', pm); sk.innerHTML = '';
      (p.skills || []).forEach(function (t) { sk.appendChild(li(t)); });
      qs('[data-pm-skills]', pm).hidden = !(p.skills && p.skills.length);
      var soc = qs('.pm-social', pm);
      soc.innerHTML = p.real ? '' : tpl.innerHTML;
      soc.hidden = !!p.real;
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
    initInView('.pg-train');
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

  // ---- Our Team: the members ride a bicycle tyre. It turns slowly to the left on its own; each card
  // pops up on the right as it comes over the top and sinks away on the left. A drag or a swipe spins
  // it either way and it coasts back into its slow turn; the arrow keys step it a card at a time, and
  // a card reached with the keyboard turns to the top. The geometry lives in the CSS (.tw-stage).
  function teamWheel(stage, onTap) {
    var cards = qsa('.tw-card', stage), N = cards.length, spin = qs('.tw-spin', stage);
    if (!N || !spin) return;
    var CRUISE = 0.16;                       // cards a second: a new face every six seconds or so
    var G = {}, off = 0, vel = 0, hover = false, drag = null, dragged = false, target = null, wheelT = -1e4;
    var raf = 0, last = 0, seen = false;
    // per card: >0 shown since that time, <0 gone since; the server laid out the first five
    var state = cards.map(function (c) { return c.classList.contains('is-off') ? -1 : 1; });
    function geo() {
      var cs = getComputedStyle(stage), n = function (k) { return parseFloat(cs.getPropertyValue(k)) || 0; };
      G = { W: stage.clientWidth, rc: n('--tw-rc'), lift: n('--tw-lift'), step: n('--tw-step') || 27, cy: n('--tw-cy') };
    }
    function slotOf(i) { var s = ((i - off) % N + N) % N; return s >= N / 2 ? s - N : s; }
    function backOut(p) { var c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
    function locked() { return document.documentElement.classList.contains('ui-locked'); }
    function place(now) {
      spin.style.transform = 'rotate(' + (-off * G.step).toFixed(3) + 'deg)';
      for (var i = 0; i < N; i++) {
        var c = cards[i], s = slotOf(i), a = Math.abs(s), st = state[i];
        var on = st > 0 ? a < 2.56 : a < 2.44;       // a little slack, so a card at the edge doesn't flicker
        if (on && st < 0) st = state[i] = REDUCE ? 1 : now;
        else if (!on && st > 0) st = state[i] = REDUCE ? -1 : -now;
        // the card at the top is the largest and stands a little proud; the outer ones are smaller
        var k = a <= 1 ? 1 - .1 * a : a <= 2 ? .9 - .04 * (a - 1) : .86;
        var f = Math.max(0, 1 - a), up = G.lift * f * f * (3 - 2 * f), o, p;
        if (st > 0) {                                   // popping up from the tyre, with a little overshoot
          p = Math.min(1, (now - st) / 640);
          k *= .5 + .5 * backOut(p); up -= .05 * Math.pow(1 - p, 3); o = Math.min(1, p * 2.6);
          c._g = 0;
        } else {                                        // sinking away
          p = Math.min(1, (now + st) / 420);
          if (p >= 1 && c._g) continue;                 // long gone: nothing to redraw
          c._g = p >= 1 ? 1 : 0;
          k *= 1 - .35 * p; up -= .04 * p * p; o = 1 - p;
        }
        c.style.setProperty('--s', s.toFixed(4));
        c.style.setProperty('--k', k.toFixed(4));
        c.style.setProperty('--up', up.toFixed(4));
        c.style.opacity = o.toFixed(3);
        c.style.zIndex = 10 - Math.round(a);
        c.classList.toggle('is-off', o < .3);
      }
    }
    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      if (!drag) {
        if (target !== null) {                          // a critically damped spring onto the chosen card
          var w = 9, d = target - off;
          vel += (w * w * d - 2 * w * vel) * dt;
          if (REDUCE || (Math.abs(d) < .0015 && Math.abs(vel) < .02)) { off = target; vel = 0; target = null; }
        } else {
          // a spin coasts down; the slow turn to the left eases back in. It holds still under the
          // mouse, while a profile is open, and for a moment after a trackpad swipe.
          var goal = REDUCE || hover || locked() || now - wheelT < 900 ? 0 : CRUISE;
          var tau = Math.abs(vel) > Math.abs(goal) + .02 ? .85 : 1.4;
          vel += (goal - vel) * (1 - Math.exp(-dt / tau));
        }
        off += vel * dt;
      }
      place(now);
      if (seen && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    }
    function run() { if (!raf && seen && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
    // the pointer's angle round the hub, in degrees clockwise from the top
    function ang(e) {
      var b = stage.getBoundingClientRect();
      return Math.atan2(e.clientX - b.left - G.W / 2, b.top + G.cy * G.W - e.clientY) * 180 / Math.PI;
    }
    stage.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      geo();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, live: false, touch: e.pointerType !== 'mouse' };
      dragged = false;
    });
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') hover = !drag && !!e.target.closest('.tw-card');
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.live) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (dx * dx + dy * dy < 36) return;
        if (drag.touch && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // that one scrolls the page
        drag.live = dragged = true; target = null;
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        stage.classList.add('is-drag');
        drag.a = ang(e); drag.off = off; drag.hist = [];
      }
      // the wheel follows the pointer round its hub, so the card under it stays under it
      var da = ang(e) - drag.a;
      off = drag.off - da / G.step;
      drag.hist.push([e.timeStamp, off]);
      while (drag.hist.length > 2 && e.timeStamp - drag.hist[0][0] > 90) drag.hist.shift();
      run();
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.live) {
        var h = drag.hist, v = 0, z = h[h.length - 1];
        if (h.length > 1 && e.timeStamp - z[0] < 70) v = (z[1] - h[0][1]) / Math.max(16, z[0] - h[0][0]) * 1000;
        vel = Math.max(-9, Math.min(9, v));             // let go mid-swing and it spins on
        stage.classList.remove('is-drag');
        setTimeout(function () { dragged = false; }, 0);
      }
      drag = null;
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = false; });
    stage.addEventListener('click', function (e) {
      var c = e.target.closest('.tw-card');
      if (!c || dragged) return;
      onTap(c);
    });
    // a sideways trackpad swipe turns it too; an up-and-down one still scrolls the page
    stage.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      geo();
      var px = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      off += px / (G.rc * G.W * G.step * Math.PI / 180);
      vel = 0; target = null; wheelT = performance.now();
      run();
    }, { passive: false });
    stage.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      target = (target !== null ? target : Math.round(off)) + (e.key === 'ArrowRight' ? 1 : -1);
      var c = cards[((target % N) + N) % N];
      try { c.focus({ preventScroll: true }); } catch (_) { c.focus(); }
      run();
    });
    stage.addEventListener('focusin', function (e) {
      var c = e.target.closest('.tw-card');
      if (!c || drag || !c.matches(':focus-visible')) return;
      var s = slotOf(Number(c.dataset.i));
      if (Math.abs(s) > .01) { target = off + s; run(); }
    });
    geo();
    window.addEventListener('resize', geo);
    document.addEventListener('visibilitychange', run);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; run(); }).observe(stage);
    else { seen = true; run(); }
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

    var wheel = qs('[data-wheel]');
    if (wheel) teamWheel(wheel, openCard);

    // ---- the talent pool: a league table in white columns, filtered by field. The rows still shown
    // are shared out evenly across the columns, in order, and numbered from one.
    var tlBox = qs('#tlCols');
    if (tlBox) {
      var cols = qsa('.tl-col', tlBox), items = qsa('.tl-item', tlBox), chips = qsa('[data-tp-field]');
      var lay = function () {
        var shown = items.filter(function (it) { return !it.hidden; }).sort(function (a, b) { return a.dataset.i - b.dataset.i; });
        // a short list fills fewer columns (about four rows each) rather than one row per column
        var c = Math.max(1, Math.min(cols.length, Math.ceil(shown.length / 4))), base = Math.floor(shown.length / c), extra = shown.length % c, k = 0;
        cols.forEach(function (col, ci) {
          var take = ci < c ? base + (ci < extra ? 1 : 0) : 0;
          shown.slice(k, k + take).forEach(function (it, j) { col.appendChild(it); qs('.tl-n', it).textContent = k + j + 1; });
          col.hidden = !take;
          k += take;
        });
        items.filter(function (it) { return it.hidden; }).forEach(function (it) { cols[cols.length - 1].appendChild(it); });
      };
      qsa('.tl-row', tlBox).forEach(function (b) { b.addEventListener('click', function () { openCard(b); }); });
      chips.forEach(function (b) {
        b.addEventListener('click', function () {
          var f = b.dataset.tpField, k = 0;
          pressOnly(chips, 'data-tp-field', f);
          items.forEach(function (it) { it.hidden = !!f && it.dataset.field !== f; });
          lay();
          if (!REDUCE) items.forEach(function (it) {
            if (!it.hidden) it.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: Math.min(k++, 10) * 30, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
          });
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

  // ---- About: the mission, the problem and the answer as kinetic type, after the reference film:
  // heavy near-black words, a few in neon green, on light grey. Each text is dealt into lines of
  // varied length, every line sized to the same width, now and then one word on end beside the lines
  // it spans; the lines are set on two walls that meet at a corner. The camera flies through them two
  // or three words at a time, turning in 3D to read each one, then pulls back to show the whole
  // paragraph locked into its corner, holds it to be read, and cuts to the next.
  function initKinetic() {
    var stage = qs('[data-kt]'), src = qs('.kt-src');
    if (!stage || !src) return;
    var blurEl = qs('.kt-blur', stage), cam = qs('.kt-cam', stage);
    // world units: each wall is W wide; lines are sized to fill it; FOLD is the angle of the left wall
    var FAMILY = 'Montserrat', FONT = '800 100px ' + FAMILY, W = 1600, G = 40, LH = .86, GAP = .07, FOLD = 46, CAP = .3 * W;
    var GREEN = /^(official|counties|trustworthy|somewhere|else|observed|local|sovereignty|missing|layer|asset)$/i;
    var RHYTHM = [14, 30, 40, 22, 46, 26, 16, 36, 44, 20, 32, 50, 18, 38];
    var texts = qsa('.cs-row', src).map(function (row) {
      return { label: qs('dt', row).textContent.trim().toLowerCase(), text: qs('dd', row).textContent.trim() };
    });
    if (!texts.length) return;
    var ctx = document.createElement('canvas').getContext('2d');
    function w1(str) { ctx.font = FONT; return ctx.measureText(str).width / 100; }   // width at 1px
    var bare = function (w) { return w.replace(/[^A-Za-z0-9'’-]/g, ''); };
    var scenes = [], cur = 0, seg = 0, segT = 0, Ws = 0, Hs = 0, raf = 0, last = 0, seen = false, built = false;
    var blurOn = true, blurN = 0, blurDt = 0;   // the blur is dropped on a machine too slow to draw it smoothly

    // deal a text into lines: the label first, then lines of varied length; every fifth line one long
    // word stands on end, beside three short lines that it spans
    function deal(tx) {
      var words = tx.text.split(/\s+/).filter(Boolean), lines = [{ words: tx.label.split(' '), label: true }];
      var i = 0, k = 0, short = 0;
      while (i < words.length) {
        if (k % 5 === 3 && !short && bare(words[i]).length >= 5 && words.length - i > 8) { lines.push({ words: [words[i++]], vert: true }); short = 3; k++; continue; }
        var target = short ? [11, 14, 12][3 - short] : RHYTHM[k % RHYTHM.length], ln = [words[i++]], len = ln[0].length;
        while (i < words.length && len + 1 + words[i].length <= target) { len += 1 + words[i].length; ln.push(words[i++]); }
        lines.push({ words: ln, beside: !!short });
        if (short) short--;
        k++;
      }
      var tail = lines[lines.length - 1], prev = lines[lines.length - 2];
      if (lines.length > 2 && tail.words.join(' ').length < 7 && !prev.vert && !prev.label && !tail.beside) { prev.words = prev.words.concat(tail.words); lines.pop(); }
      lines.forEach(function (l) { l.str = l.words.join(' '); l.w1 = w1(l.str); });
      return lines;
    }
    // size the lines into blocks: a plain line, or a word on end with the lines beside it
    function blocks(lines) {
      var out = [];
      for (var n = 0; n < lines.length; n++) {
        var L = lines[n];
        if (!L.vert) { var f = Math.min(W / L.w1, CAP); out.push({ lines: [L], fs: [f], adv: f * (LH + GAP) }); continue; }
        var comp = [];
        for (var m = n + 1; m < lines.length && comp.length < 3 && lines[m].beside; m++) comp.push(lines[m]);
        if (!comp.length) { L.vert = false; n--; continue; }
        var T = .15 * W, g = .02 * W, fs = [], H = 0, fv = 0;
        for (var it = 0; it < 5; it++) {
          fs = comp.map(function (c) { return Math.min((W - T - g) / c.w1, CAP); });
          H = fs.reduce(function (a, f) { return a + f * (LH + GAP); }, 0) - fs[fs.length - 1] * GAP;
          T = Math.min(LH * H / L.w1, .34 * W);
        }
        fv = T / LH;
        out.push({ vert: L, fv: fv, T: T, g: g, Lv: L.w1 * fv, lines: comp, fs: fs, adv: Math.max(H, L.w1 * fv) + fs[fs.length - 1] * GAP });
        n += comp.length;
      }
      return out;
    }
    // build one text's world: the blocks split across two walls that meet at a corner, the left wall
    // turned back; and the camera's stops, two or three words at a time, in reading order
    function build(tx) {
      var bl = blocks(deal(tx)), total = bl.reduce(function (a, b) { return a + b.adv; }, 0), acc = 0, split = bl.length;
      for (var q = 0; q < bl.length; q++) { if (acc + bl[q].adv / 2 > total / 2) { split = Math.max(1, q); break; } acc += bl[q].adv; }
      var world = document.createElement('div');
      world.className = 'kt-world'; world.hidden = true;
      var stops = [], heights = [0, 0];
      function put(l, f, tf, vert, line) {
        var e = document.createElement('span');
        e.className = 'kt-w' + (l.label ? ' is-label' : '');
        l.words.forEach(function (w, j) {
          if (j) e.appendChild(document.createTextNode(' '));
          if (!l.label && GREEN.test(bare(w))) { var b = document.createElement('b'); b.textContent = w; e.appendChild(b); }
          else e.appendChild(document.createTextNode(w));
        });
        e.style.fontSize = f.toFixed(2) + 'px';
        e.style.transform = tf;
        world.appendChild(e);
        var m = new DOMMatrix(tf), h = LH * f, at = function (x) { return m.transformPoint(new DOMPoint(x, h / 2, 0)); };
        var wall = tf.indexOf('rotateY') === 0 ? FOLD : 0;
        if (vert) { var c = at(l.w1 * f / 2); stops.push({ x: c.x, y: c.y, z: c.z, w: l.w1 * f, h: h, n: l.str.length, yaw: wall, roll: 90, line: line }); return; }
        // the line's words, gathered into runs of about twelve letters
        var j = 0;
        while (j < l.words.length) {
          var run = [l.words[j++]];
          while (j < l.words.length && (run.join(' ') + ' ' + l.words[j]).length <= 12) run.push(l.words[j++]);
          var before = l.words.slice(0, j - run.length).join(' '), x0 = before ? w1(before + ' ') * f : 0, x1 = w1(l.words.slice(0, j).join(' ')) * f;
          var p = at((x0 + x1) / 2);
          stops.push({ x: p.x, y: p.y, z: p.z, w: x1 - x0, h: h, n: run.join(' ').length, yaw: wall, roll: 0, line: line });
        }
      }
      var line = 0;
      bl.forEach(function (b, q) {
        var side = q < split ? 0 : 1, y = heights[side];
        var wallTf = side ? '' : 'rotateY(' + (-FOLD) + 'deg) ';
        var x = side ? G : -(W + G);
        if (b.vert) {
          put(b.vert, b.fv, wallTf + 'translate(' + x.toFixed(1) + 'px,' + (y + b.Lv).toFixed(1) + 'px) rotate(-90deg)', true, line++);
          var yc = y;
          b.lines.forEach(function (l, j) { put(l, b.fs[j], wallTf + 'translate(' + (x + b.T + b.g).toFixed(1) + 'px,' + yc.toFixed(1) + 'px)', false, line++); yc += b.fs[j] * (LH + GAP); });
        } else {
          put(b.lines[0], b.fs[0], wallTf + 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)', false, line++);
        }
        heights[side] = y + b.adv;
      });
      cam.appendChild(world);
      return { world: world, stops: stops, H: Math.max(heights[0], heights[1]) };
    }

    // the camera: where it looks, how close and how it is turned; and its path through one text
    function rnd(j) { var a = Math.sin(j * 12.9898 + 78.233) * 43758.5453; return a - Math.floor(a); }
    function track(sc) {
      var t = [], prev = null;
      sc.stops.forEach(function (st) {
        var j = st.line;       // the same turn all along one line, a new one on the next
        var c = { x: st.x, y: st.y, z: st.z, s: Math.min(.6 * Ws / st.w, .38 * Hs / st.h),
          yaw: st.yaw + (rnd(j) - .5) * 28, pitch: (rnd(j + 7) - .5) * 18, roll: st.roll + (rnd(j + 3) - .5) * 9, b: 0 };
        if (!prev) t.push({ c: Object.assign({}, c, { s: c.s * 2.4, b: 12 }), move: 0, hold: 0 });   // the cut in
        t.push({ c: c, move: prev ? .27 : .5, hold: .06 + .019 * st.n });
        prev = c;
      });
      // the pull back: the corner seen from the front, a little to the left
      var cs = Math.cos(FOLD * Math.PI / 180), span = (W + G) * (1 + cs);
      var fit = Math.min(.9 * Ws / span, .86 * Hs / sc.H);
      t.push({ c: { x: ((W + G) - (W + G) * cs) / 2, y: sc.H / 2, z: 0, s: fit, yaw: 0, pitch: 5, roll: 0, b: 0 }, move: 1.2, hold: 6 });
      return t;
    }
    function measure() {
      Ws = stage.clientWidth; Hs = stage.clientHeight;
      cam.style.perspective = Math.round(Ws * 1.4) + 'px';
      scenes.forEach(function (sc) { sc.t = track(sc); });
    }
    function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
    function show(c, blur) {
      var s = c.s.toFixed(4);
      scenes[cur].world.style.transform = 'translate(' + (Ws / 2).toFixed(1) + 'px,' + (Hs / 2).toFixed(1) + 'px) scale3d(' + s + ',' + s + ',' + s + ') rotateX(' + c.pitch.toFixed(2) + 'deg) rotateZ(' + c.roll.toFixed(2) + 'deg) rotateY(' + c.yaw.toFixed(2) + 'deg) translate3d(' + (-c.x).toFixed(1) + 'px,' + (-c.y).toFixed(1) + 'px,' + (-c.z).toFixed(1) + 'px)';
      blurEl.style.filter = blurOn && blur > .4 ? 'blur(' + blur.toFixed(1) + 'px)' : '';
      return blurOn && blur > .4;
    }
    function cut(k) {
      scenes[cur].world.hidden = true;
      cur = k; seg = 0; segT = 0;
      scenes[cur].world.hidden = false;
    }
    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      var t = scenes[cur].t;
      segT += dt;
      if (REDUCE) {                                   // no flight: each block still, one after another
        if (segT > 9) cut((cur + 1) % scenes.length);
        show(scenes[cur].t[scenes[cur].t.length - 1].c, 0);
      } else {
        while (segT > t[seg].move + t[seg].hold) {
          segT -= t[seg].move + t[seg].hold;
          if (++seg >= t.length) { cut((cur + 1) % scenes.length); t = scenes[cur].t; }
        }
        var A = t[Math.max(0, seg - 1)].c, B = t[seg].c, p = t[seg].move ? Math.min(1, segT / t[seg].move) : 1, e = ease(p);
        var c = {
          x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e, z: A.z + (B.z - A.z) * e,
          s: Math.exp(Math.log(A.s) + (Math.log(B.s) - Math.log(A.s)) * e),
          yaw: A.yaw + (B.yaw - A.yaw) * e, pitch: A.pitch + (B.pitch - A.pitch) * e, roll: A.roll + (B.roll - A.roll) * e,
        };
        // a blur while the camera moves, as a fast move blurs on film
        var travel = Math.hypot(B.x - A.x, B.y - A.y) * Math.max(A.s, B.s) + Math.abs(Math.log(B.s / A.s)) * 260 + Math.abs(B.roll - A.roll) * 4 + Math.abs(B.yaw - A.yaw) * 3;
        if (show(c, (A.b + (B.b - A.b) * e) + (p < 1 ? Math.min(6, travel / 90) * Math.sin(Math.PI * p) : 0)) && dt) {
          blurDt += dt;
          if (++blurN === 45) { if (blurDt / blurN > .026) blurOn = false; blurN = 0; blurDt = 0; }
        }
      }
      if (seen && !document.hidden) raf = requestAnimationFrame(frame);
      else last = 0;
    }
    function run() { if (built && !raf && seen && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
    function start() {
      if (built) return;
      built = true;
      scenes = texts.map(build);
      measure();
      cut(0);
      run();
    }
    var fonts = document.fonts;
    if (fonts && fonts.load) Promise.race([fonts.load(FONT), new Promise(function (r) { setTimeout(r, 2500); })]).then(start, start);
    else start();
    window.addEventListener('resize', function () { if (built) measure(); });
    document.addEventListener('visibilitychange', run);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; run(); }).observe(stage);
    else { seen = true; run(); }
  }

  // ---------- boot ----------
  var page = window.__NICTD_PAGE__;
  document.addEventListener('DOMContentLoaded', function () {
    initAccordions('.faq-item', '.faq-q');
    if (page === 'home') { initHome(); if (window.__DASHBOARD_STATE__) initDashboardTopic(); }
    // the Data Explorer runs on its own engine, public/explorer.js
    if (page === 'reports') initReports();
    if (page === 'team') initTeam();
    if (qs('#rsLib')) initResearchLib();
    if (qs('[data-kt]')) initKinetic();
    if (page === 'programs') initPrograms();
    if (page === 'login') initLogin();
    if (page === 'dashboard-topic') initDashboardTopic();
    if (page === 'analytics-legacy') initAnalyticsLegacy();
  });
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

// ---------- the navy panel's grid (Request Access, Submit a Paper): a few cells light and fade at a time ----------
// Log In runs its own (initLogin).
(function () {
  if (window.__NICTD_PAGE__ === 'login' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cells = [].slice.call(document.querySelectorAll('.lg-cells i'));
  if (!cells.length) return;
  setInterval(function () {
    if (document.hidden) return;
    var c = cells[Math.floor(Math.random() * cells.length)];
    c.classList.add('on');
    setTimeout(function () { c.classList.remove('on'); }, 1600 + Math.random() * 1400);
  }, 260);
})();

// ---------- adverts: the close button hides that advert (and its copy elsewhere on the page) for the visit ----------
(function () {
  var KEY = 'niis-ads-closed';
  function closed() { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function hide(k) {
    [].forEach.call(document.querySelectorAll('.ad-slot[data-ad="' + k + '"]'), function (s) { s.hidden = true; });
    [].forEach.call(document.querySelectorAll('.bbc-adrow'), function (r) { r.hidden = !r.querySelector('.ad-slot:not([hidden])'); });
  }
  if (!document.querySelector('.ad-slot')) return;
  closed().forEach(hide);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ad-x]');
    if (!b) return;
    e.preventDefault();
    var k = b.getAttribute('data-ad-x'), c = closed();
    hide(k);
    if (c.indexOf(k) < 0) c.push(k);
    try { sessionStorage.setItem(KEY, JSON.stringify(c)); } catch (e2) {}
  });
})();

// ---------- a source note under every chart, as journals and the statistical press set them ----------
// "Source:" names the agency the figures come from and NIIS, which compiles and publishes them; a
// "Copy citation" button copies a full data-set reference. The page's own indicator heading, unit,
// source and years are the record (.cite-cfg points at them), so every note follows the reader's
// choice of indicator and year.
(function () {
  var cfg = document.querySelector('.cite-cfg');
  var figs = [].slice.call(document.querySelectorAll('[data-fig-src]'));
  if (!cfg || !figs.length) return;
  function el(sel) { return sel ? document.querySelector(sel) : null; }
  function txt(sel) { var e = el(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function period(kind) {
    if (kind === 'year' && cfg.dataset.year) return txt(cfg.dataset.year);
    if (cfg.dataset.span) return txt(cfg.dataset.span);
    var r = el(cfg.dataset.range);
    return r && r.min && r.max ? (r.min === r.max ? r.min : r.min + '–' + r.max) : '';
  }
  var COPY = '<svg class="icn" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  function render() {
    var name = txt(cfg.dataset.title), unit = txt(cfg.dataset.unit), agency = txt(cfg.dataset.agency);
    var mockEl = el(cfg.dataset.mock), mock = !!(mockEl && !mockEl.hidden);
    // the agency is named beside NIIS only when it is someone else
    if (!agency || agency === 'n/a' || /NIIS/.test(agency)) agency = '';
    var year = new Date().getFullYear();
    var today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var href = location.href.split('#')[0];
    var src = (agency ? agency + '; ' : '') + 'National ICT Intelligence System (NIIS), Liberia, ' + year + '.';
    figs.forEach(function (f) {
      var p = period(f.getAttribute('data-fig-src'));
      if (p === 'n/a') p = '';
      var cite = 'National ICT Intelligence System (NIIS). (' + year + '). ' + name + (unit ? ' (' + unit + ')' : '') + ', Liberia' + (p ? ', ' + p : '') +
        ' [Data set]. ' + (agency ? 'Data from ' + agency + '. ' : '') + (mock ? 'Demonstration figures. ' : '') + 'Retrieved ' + today + ', from ' + href;
      f.innerHTML = '<p class="fig-src-l"><b>Source:</b> ' + esc(src) + '</p>' +
        '<button type="button" class="fig-cite" data-cite="' + esc(cite) + '">' + COPY + '<span>Copy citation</span></button>';
    });
  }
  render();
  var t = 0;
  var mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(render, 80); });
  [cfg.dataset.title, cfg.dataset.unit, cfg.dataset.agency, cfg.dataset.mock, cfg.dataset.span, cfg.dataset.year].forEach(function (sel) {
    var e = el(sel); if (e) mo.observe(e, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
  window.addEventListener('popstate', render);
})();

// ---------- copy to the clipboard (citations, share links), with a word to say it worked ----------
(function () {
  function copy(text, done) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.fig-cite');
    if (c) {
      copy(c.getAttribute('data-cite'), function (ok) {
        var s = c.querySelector('span'); if (!s) return;
        s.textContent = ok ? 'Citation copied' : 'Copy failed';
        c.classList.toggle('is-done', ok);
        setTimeout(function () { s.textContent = 'Copy citation'; c.classList.remove('is-done'); }, 2200);
      });
      return;
    }
    var b = e.target.closest && e.target.closest('[data-share-copy]');
    if (b) {
      copy(b.getAttribute('data-share-copy'), function (ok) {
        var bar = b.closest('.share'), out = bar && bar.querySelector('.share-done');
        if (out) { out.textContent = ok ? 'Link copied' : 'Copy failed'; setTimeout(function () { out.textContent = ''; }, 2200); }
        b.classList.toggle('is-done', ok); setTimeout(function () { b.classList.remove('is-done'); }, 2200);
      });
      return;
    }
    var n = e.target.closest && e.target.closest('[data-share-native]');
    if (n && navigator.share) navigator.share({ title: n.getAttribute('data-share-title'), url: n.getAttribute('data-share-url') }).catch(function () {});
  });
  // the phone's own share sheet, where the browser has one
  if (navigator.share) [].forEach.call(document.querySelectorAll('[data-share-native]'), function (n) { n.hidden = false; });
})();
