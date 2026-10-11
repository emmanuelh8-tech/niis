// explorer.js · NIIS Data Explorer.
// A visualization engine plus the controller that drives the exploration journey:
// intro -> snapshot -> geography -> ranking -> trend -> change -> comparison -> matrix -> data.
//
// Every figure rendered here is derived from /api/v1/explorer and /api/v1/download/data.json.
// Nothing is fabricated: if the payload has no value, the view says so.
// Shared helpers come from window.NICTD (public/app.js).
(function () {
  'use strict';
  if (window.__NICTD_PAGE__ !== 'explorer') return;

  // Shared toolkit from app.js. This file is deferred from <head> while app.js sits at the
  // end of <body>, so deferred execution order runs THIS file first. The handles are bound
  // in start(), by which point app.js has run and window.NICTD exists.
  var N, el, esc, qs, qsa, fmtNum, scaleColor, C;
  function bindToolkit() {
    N = window.NICTD;
    if (!N) return false;
    el = N.el; esc = N.esc; qs = N.qs; qsa = N.qsa; fmtNum = N.fmtNum; scaleColor = N.scaleColor;
    C = N.COLORS;
    return true;
  }
  // Marks that the engine is alive, so the stylesheet may hide sections before their
  // entrance animation. Without this class every section renders fully visible.
  document.documentElement.classList.add('dx-js');

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // Sections and charts are in place from the start: nothing waits to be
  // scrolled to. (A re-render after a filter change still redraws its chart.)
  // ============================================================
  var revealer = function watch(node) {
    if (!node) return;
    node.__shown = true;
    node.classList.add('is-in');
  };

  // Re-arm a container so a re-render replays its entrance.
  function replay(node) {
    if (!node) return;
    node.classList.remove('is-in');
    node.__shown = false;
    void node.offsetWidth;                              // force reflow so the animation restarts
    revealer(node);
  }

  // ---------- animated counter ----------
  function countUp(node, target, opts) {
    if (!node) return;
    opts = opts || {};
    var dp = opts.decimals == null ? 1 : opts.decimals;
    var prefix = opts.prefix || '', suffix = opts.suffix || '';
    function paint(v) { node.textContent = prefix + (target == null ? 'n/a' : v.toFixed(dp).replace(/\.0+$/, '')) + suffix; }
    if (target == null) { node.textContent = 'n/a'; return; }
    if (REDUCED) { paint(target); return; }
    var dur = 900, t0 = null, done = false;
    function finish() { if (!done) { done = true; paint(target); } }
    function step(ts) {
      if (t0 == null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      paint(target * (1 - Math.pow(1 - k, 3)));         // ease-out cubic
      if (k < 1) requestAnimationFrame(step); else finish();
    }
    requestAnimationFrame(step);
    setTimeout(finish, dur + 250);                      // fail-safe if rAF never ticks
  }

  // ---------- shared tooltip ----------
  function makeTooltip(host) {
    var tip = document.createElement('div');
    tip.className = 'dx-tip';
    tip.setAttribute('role', 'status');
    host.appendChild(tip);
    return {
      show: function (html, clientX, clientY) {
        var r = host.getBoundingClientRect();
        tip.innerHTML = html;
        tip.style.display = 'block';
        tip.style.left = Math.max(8, Math.min(r.width - 8, clientX - r.left)) + 'px';
        tip.style.top = (clientY - r.top) + 'px';
      },
      hide: function () { tip.style.display = 'none'; },
      node: tip,
    };
  }

  function svgRoot(container, w, h, label) {
    container.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': label || '', preserveAspectRatio: 'xMidYMid meet' });
    svg.classList.add('dx-svg');
    return svg;
  }
  function empty(container, msg) {
    container.innerHTML = '<p class="dx-empty">' + esc(msg || 'No data available for this selection.') + '</p>';
  }
  // Charts size their viewBox to the container so 1 SVG unit == 1 CSS pixel. Without this a
  // fixed 1000-unit viewBox shrinks 14px labels to ~5px on a phone.
  function vizWidth(container, min) {
    // Measure the FULL column, not the container, which the size slider may have narrowed.
    // Keeping the viewBox tied to the column makes the slider a pure scale control: the
    // drawing shrinks as a whole instead of snapping back to full-size text on re-render.
    var host = container.parentNode && container.parentNode.clientWidth ? container.parentNode : container;
    var w = host.clientWidth || host.getBoundingClientRect().width || 960;
    return Math.max(min || 320, Math.round(w));
  }

  // stagger index -> CSS custom property the stylesheet turns into animation-delay
  function stagger(node, i) { node.style.setProperty('--i', i); }

  // ============================================================
  // AnimatedMap — the hero visualization
  // ============================================================
  function animatedMap(container, rows, opts) {
    opts = opts || {};
    if (!window.LIBERIA_COUNTIES) { empty(container, 'Map geometry unavailable.'); return; }
    var byName = {};
    rows.forEach(function (r) { byName[r.county] = r; });
    var vals = rows.map(function (r) { return r.value; }).filter(function (v) { return v != null && !isNaN(v); });
    if (!vals.length) { empty(container, 'No county values recorded for this year.'); return; }
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);

    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'dx-map-wrap';
    var svg = el('svg', { viewBox: window.LIBERIA_VIEWBOX, role: 'img', 'aria-label': 'Map of Liberia shaded by ' + (opts.indicatorName || 'indicator') });
    var tip = null;

    window.LIBERIA_COUNTIES.forEach(function (c, i) {
      var row = byName[c.name];
      var v = row ? row.value : null;
      var t = (max > min) ? (v - min) / (max - min) : 0.5;
      var path = el('path', { d: c.d, fill: v == null ? '#E3E8EF' : scaleColor(t), tabindex: '0', role: 'button' });
      path.setAttribute('aria-label', c.name + ': ' + (v == null ? 'no data' : fmtNum(v)));
      var cls = 'dx-county';
      if (opts.focus === c.name) cls += ' is-focus';
      if (opts.compare === c.name) cls += ' is-compare';
      if (opts.highlight && opts.highlight.indexOf(c.name) !== -1) cls += ' is-lit';
      if (opts.dim && opts.highlight && opts.highlight.indexOf(c.name) === -1) cls += ' is-dim';
      path.setAttribute('class', cls);
      stagger(path, i);

      function body(e) {
        var rank = row && row.rank ? '<span class="dx-tip-rank">#' + row.rank + ' of ' + rows.length + '</span>' : '';
        var yoy = '';
        if (row && row.yoy != null && row.yoy !== 0) {
          yoy = '<span class="dx-tip-yoy ' + (row.yoy > 0 ? 'up' : 'down') + '">' +
            (row.yoy > 0 ? '▲' : '▼') + ' ' + fmtNum(Math.abs(row.yoy)) + ' vs ' + (opts.year - 1) + '</span>';
        }
        tip.show('<strong>' + esc(c.name) + '</strong>' + rank +
          '<span class="dx-tip-val">' + (v == null ? 'No data' : fmtNum(v) + ' <i>' + esc(opts.unit || '') + '</i>') + '</span>' + yoy,
          e.clientX, e.clientY);
      }
      path.addEventListener('mousemove', body);
      path.addEventListener('mouseenter', function () { if (opts.onHover) opts.onHover(c.name, v); });
      path.addEventListener('mouseleave', function () { tip.hide(); if (opts.onHover) opts.onHover(null); });
      path.addEventListener('click', function () { if (opts.onSelect) opts.onSelect(c.name); });
      path.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (opts.onSelect) opts.onSelect(c.name); }
      });
      svg.appendChild(path);
    });

    wrap.appendChild(svg);
    container.appendChild(wrap);

    // The shipped viewBox (0 0 760 900) pads Liberia with ~17% dead vertical space.
    // Refit it to the real geometry so the map fills the frame instead of floating in it.
    try {
      var bb = svg.getBBox();
      if (bb && bb.width > 0 && bb.height > 0) {
        var pad = Math.max(bb.width, bb.height) * 0.015;
        svg.setAttribute('viewBox', (bb.x - pad) + ' ' + (bb.y - pad) + ' ' + (bb.width + pad * 2) + ' ' + (bb.height + pad * 2));
      }
    } catch (e) { /* getBBox unavailable; the declared viewBox still renders correctly */ }

    tip = makeTooltip(wrap);
    replay(wrap);
    return wrap;
  }

  // ============================================================
  // AnimatedRanking — large horizontal bars
  // ============================================================
  function rankingBars(container, rows, opts) {
    opts = opts || {};
    rows = rows.filter(function (r) { return r.value != null; });
    if (!rows.length) { empty(container); container.__race = null; return; }
    var W = vizWidth(container, 320);
    var rowH = W < 560 ? 38 : 46;
    // The scale is held across every year whenever the caller knows the all-year maximum, so
    // racing the chart shows real growth instead of rescaling on every frame. Without that
    // figure it falls back to this year's own maximum.
    var max = opts.scaleMax || Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    // Right padding is sized from the widest label that could be drawn at this scale, not just
    // the widest one in this year, so a larger number later in the race cannot run off the edge.
    var widest = fmtNum(max).length;
    rows.forEach(function (r) { widest = Math.max(widest, fmtNum(r.value).length); });
    var pad = { t: 8, r: Math.min(W * 0.24, Math.max(52, widest * 8.6 + 20)), b: 8, l: Math.min(176, W * 0.34) };
    var track = W - pad.l - pad.r;
    var nameRoom = pad.l - 40;                       // space left of the bars, minus the rank number
    var key = rows.map(function (r) { return r.county; }).slice().sort().join('|');

    // Everything that changes between years lives here, so a build and an update cannot drift.
    function place(r, i, node) {
      if (!node) return;
      var w = Math.max(2, (r.value / max) * track);
      var txt = fmtNum(r.value);
      var outsideX = pad.l + w + 10;
      var fitsOutside = outsideX + txt.length * 8.6 <= W - 4;
      var isFocus = opts.focus && r.county === opts.focus;
      var isCompare = opts.compare && r.county === opts.compare;
      node.slot.style.transform = 'translateY(' + (pad.t + i * rowH) + 'px)';
      node.row.setAttribute('class', 'dx-rank-row' + (isFocus ? ' is-focus' : '') + (isCompare ? ' is-compare' : ''));
      node.bar.setAttribute('width', w);
      node.bar.style.width = w + 'px';
      node.bar.style.setProperty('--w', w);
      node.bar.setAttribute('fill', isFocus ? C.gold : (isCompare ? C.clay : scaleColor(r.value / max)));
      // Keep the value inside the plot: past the bar when there is room, tucked into the bar's
      // end when there is not. Either way it stays within the viewBox.
      node.val.textContent = txt;
      // The label travels in a wrapper so it slides with the bar it belongs to. Setting x on
      // the text directly would teleport it while the bar was still moving.
      node.vwrap.style.transform = 'translateX(' + (fitsOutside ? outsideX : pad.l + w - 10) + 'px)';
      node.val.setAttribute('text-anchor', fitsOutside ? 'start' : 'end');
      node.val.setAttribute('class', 'dx-rank-val' + (fitsOutside ? '' : ' is-inside'));
      node.num.textContent = String(i + 1).padStart(2, '0');
    }

    // Same counties, same width, same chart still on screen: update it rather than rebuild.
    var st = container.__race;
    if (st && st.W === W && st.key === key && st.svg.parentNode === container) {
      rows.forEach(function (r, i) { place(r, i, st.nodes[r.county]); });
      return;
    }

    var H = pad.t + pad.b + rows.length * rowH;
    var svg = svgRoot(container, W, H, 'Counties ranked by value');
    var nodes = {};
    rows.forEach(function (r, i) {
      // Outer slot carries the rank position, inner row keeps the entrance animation and the
      // hover styling. Separating them means neither transform fights the other.
      var slot = el('g', { class: 'dx-rank-slot' });
      var row = el('g', { class: 'dx-rank-row' });
      stagger(row, i);

      var nm = r.county;
      if (nm.length * 7.6 > nameRoom) nm = nm.slice(0, Math.max(4, Math.floor(nameRoom / 7.6) - 1)) + '…';
      var nameEl = el('text', { x: pad.l - 14, y: rowH / 2 + 5, 'text-anchor': 'end', class: 'dx-rank-name' }, nm);
      if (nm !== r.county) nameEl.appendChild(el('title', {}, r.county));
      row.appendChild(nameEl);
      row.appendChild(el('rect', { x: pad.l, y: 7, width: track, height: rowH - 18, rx: 4, class: 'dx-rank-track' }));
      var bar = el('rect', { x: pad.l, y: 7, height: rowH - 18, rx: 4, class: 'dx-rank-bar' });
      row.appendChild(bar);
      var vwrap = el('g', { class: 'dx-rank-vwrap' });
      var valEl = el('text', { x: 0, y: rowH / 2 + 5, class: 'dx-rank-val' }, '');
      vwrap.appendChild(valEl);
      row.appendChild(vwrap);
      // rank number pinned to the far left so long county names cannot collide with it
      var numEl = el('text', { x: 2, y: rowH / 2 + 5, class: 'dx-rank-num' }, '');
      row.appendChild(numEl);

      row.style.cursor = 'pointer';
      row.addEventListener('click', function () { if (opts.onSelect) opts.onSelect(r.county); });
      slot.appendChild(row);
      svg.appendChild(slot);
      nodes[r.county] = { slot: slot, row: row, bar: bar, val: valEl, vwrap: vwrap, num: numEl };
    });
    container.appendChild(svg);
    container.__race = { W: W, key: key, nodes: nodes, svg: svg };
    rows.forEach(function (r, i) { place(r, i, nodes[r.county]); });
    replay(container);
  }

  // ============================================================
  // AnimatedLine — trend, with progressive draw and a hover crosshair
  // ============================================================
  var AREA_ID = 0;
  function trendLine(container, series, opts) {
    opts = opts || {};
    if (!series || !series.length) { empty(container, 'No time series recorded for this selection.'); return; }
    var sets = [{ pts: series, color: C.teal, label: opts.label || 'National', dash: false }];
    if (opts.compareSeries && opts.compareSeries.length) {
      sets.push({ pts: opts.compareSeries, color: C.gold, label: opts.compareLabel || 'Comparison', dash: true });
    }
    if (opts.nationalSeries && opts.nationalSeries.length) {
      sets.push({ pts: opts.nationalSeries, color: C.clay, label: 'National average', dash: true, thin: true });
    }

    var W = vizWidth(container, 320);
    var H = Math.round(Math.max(280, Math.min(460, W * 0.44)));
    var m = { t: 34, r: Math.min(116, W * 0.16), b: 52, l: Math.min(74, W * 0.15) };
    var svg = svgRoot(container, W, H, 'Trend over time');
    var ends = [];
    var years = series.map(function (d) { return d.year; });
    var xMin = Math.min.apply(null, years), xMax = Math.max.apply(null, years);
    var allY = sets.reduce(function (a, s) { return a.concat(s.pts.map(function (d) { return d.value; })); }, [])
      .filter(function (v) { return v != null; });
    var yMax = (Math.max.apply(null, allY) || 1) * 1.16;
    var X = function (x) { return m.l + (x - xMin) / (xMax - xMin || 1) * (W - m.l - m.r); };
    var Y = function (y) { return H - m.b - (y / yMax) * (H - m.t - m.b); };

    for (var g = 0; g <= 4; g++) {
      var yv = yMax * g / 4;
      svg.appendChild(el('line', { x1: m.l, y1: Y(yv), x2: W - m.r, y2: Y(yv), class: 'dx-grid' + (g === 0 ? ' is-base' : '') }));
      svg.appendChild(el('text', { x: m.l - 12, y: Y(yv) + 5, 'text-anchor': 'end', class: 'dx-axis' }, fmtNum(yv)));
    }
    years.forEach(function (x) {
      svg.appendChild(el('text', { x: X(x), y: H - m.b + 26, 'text-anchor': 'middle', class: 'dx-axis' }, String(x)));
    });

    sets.forEach(function (s, si) {
      var pts = s.pts.filter(function (p) { return p.value != null; });
      if (!pts.length) return;
      if (opts.area && si === 0) {
        var ad = 'M' + X(pts[0].year) + ',' + Y(0);
        pts.forEach(function (p) { ad += ' L' + X(p.year) + ',' + Y(p.value); });
        ad += ' L' + X(pts[pts.length - 1].year) + ',' + Y(0) + ' Z';
        // A vertical gradient rather than one flat colour: the band reads as depth under the
        // line instead of a solid block competing with it.
        var gid = 'dxArea' + (++AREA_ID);
        var defs = el('defs', {});
        var lg = el('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' });
        lg.appendChild(el('stop', { offset: '0', 'stop-color': s.color, 'stop-opacity': '.34' }));
        lg.appendChild(el('stop', { offset: '.55', 'stop-color': s.color, 'stop-opacity': '.13' }));
        lg.appendChild(el('stop', { offset: '1', 'stop-color': s.color, 'stop-opacity': '.02' }));
        defs.appendChild(lg);
        svg.appendChild(defs);
        svg.appendChild(el('path', { d: ad, class: 'dx-area', fill: 'url(#' + gid + ')' }));
      }
      var d = '';
      pts.forEach(function (p, i) { d += (i ? ' L' : 'M') + X(p.year) + ',' + Y(p.value); });
      var line = el('path', { d: d, fill: 'none', stroke: s.color, class: 'dx-line' + (s.thin ? ' is-thin' : '') });
      if (s.dash) line.classList.add('is-dashed');
      svg.appendChild(line);
      // progressive draw needs the real path length
      try {
        var L = line.getTotalLength();
        if (L > 0 && !REDUCED && !s.dash) { line.style.setProperty('--len', L); line.classList.add('dx-draw'); }
      } catch (e) { /* getTotalLength unavailable; line renders complete */ }

      pts.forEach(function (p, i) {
        var dot = el('circle', { cx: X(p.year), cy: Y(p.value), r: i === pts.length - 1 ? 7 : 4.5, fill: s.color, class: 'dx-dot' });
        stagger(dot, i);
        svg.appendChild(dot);
      });
      var last = pts[pts.length - 1];
      ends.push({ x: X(last.year), y: Y(last.value), at: Y(last.value), color: s.color,
        value: fmtNum(last.value), label: s.label });
    });

    // Two series that finish on nearly the same value used to stack their labels on top of
    // one another, which is what made the figures unreadable while the years played. Space
    // them out here, then run a leader line back to the point each one belongs to.
    var GAPY = 34;
    ends.sort(function (a, b) { return a.y - b.y; });
    var iE;
    for (iE = 1; iE < ends.length; iE++) {
      if (ends[iE].y - ends[iE - 1].y < GAPY) ends[iE].y = ends[iE - 1].y + GAPY;
    }
    var floorY = H - m.b - 10;
    for (iE = ends.length - 1; iE >= 0; iE--) {
      if (ends[iE].y > floorY) ends[iE].y = floorY;
      floorY = ends[iE].y - GAPY;
    }
    ends.forEach(function (e) {
      if (Math.abs(e.y - e.at) > 2) {
        svg.appendChild(el('path', {
          d: 'M' + (e.x + 5) + ',' + e.at + ' L' + (e.x + 11) + ',' + e.y,
          fill: 'none', stroke: e.color, 'stroke-width': 1, 'stroke-opacity': .5,
        }));
      }
      svg.appendChild(el('text', {
        x: e.x + 14, y: e.y + 4, class: 'dx-line-label', fill: e.color,
      }, e.value));
      svg.appendChild(el('text', {
        x: e.x + 14, y: e.y + 19, class: 'dx-line-sub', fill: e.color,
      }, e.label));
    });

    container.appendChild(svg);

    // hover crosshair
    var tip = makeTooltip(container);
    var cross = el('line', { x1: 0, y1: m.t - 10, x2: 0, y2: H - m.b, class: 'dx-cross' });
    cross.style.display = 'none';
    svg.appendChild(cross);
    svg.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect();
      var vx = ((e.clientX - r.left) / r.width) * W;
      var yr = Math.round(xMin + ((vx - m.l) / (W - m.l - m.r)) * (xMax - xMin));
      yr = Math.max(xMin, Math.min(xMax, yr));
      cross.setAttribute('x1', X(yr)); cross.setAttribute('x2', X(yr));
      cross.style.display = 'block';
      var html = '<strong>' + yr + '</strong>';
      sets.forEach(function (s) {
        var p = s.pts.filter(function (q) { return q.year === yr; })[0];
        if (p && p.value != null) {
          html += '<span class="dx-tip-line"><i style="background:' + s.color + '"></i>' +
            esc(s.label) + '<b>' + fmtNum(p.value) + '</b></span>';
        }
      });
      tip.show(html, e.clientX, e.clientY);
    });
    svg.addEventListener('mouseleave', function () { cross.style.display = 'none'; tip.hide(); });
    replay(container);
  }

  // ============================================================
  // ChangeChart — diverging bars, gains right / losses left
  // ============================================================
  function changeChart(container, rows, opts) {
    opts = opts || {};
    var data = rows.filter(function (r) { return r.yoy != null; })
      .slice().sort(function (a, b) { return b.yoy - a.yoy; });
    if (!data.length) { empty(container, 'No year-on-year change recorded for this year.'); return; }

    var W = vizWidth(container, 320);
    var rowH = W < 560 ? 34 : 40;
    var m = { t: 40, r: Math.min(40, W * 0.05), b: 12, l: Math.min(176, W * 0.3) };
    var H = m.t + m.b + data.length * rowH;
    var svg = svgRoot(container, W, H, 'Year on year change by county');
    var span = Math.max.apply(null, data.map(function (r) { return Math.abs(r.yoy); })) || 1;
    var mid = m.l + (W - m.l - m.r) / 2;
    var halfTrack = (W - m.l - m.r) / 2 - 60;

    svg.appendChild(el('line', { x1: mid, y1: m.t - 16, x2: mid, y2: H - m.b, class: 'dx-zero' }));
    svg.appendChild(el('text', { x: mid - 12, y: m.t - 22, 'text-anchor': 'end', class: 'dx-axis' }, 'declining'));
    svg.appendChild(el('text', { x: mid + 12, y: m.t - 22, class: 'dx-axis' }, 'improving'));

    data.forEach(function (r, i) {
      var y = m.t + i * rowH;
      var w = Math.max(2, (Math.abs(r.yoy) / span) * halfTrack);
      var up = r.yoy > 0, flat = r.yoy === 0;
      var g = el('g', { class: 'dx-change-row' + (opts.focus === r.county ? ' is-focus' : '') +
        (opts.compare && opts.compare === r.county ? ' is-compare' : '') });
      stagger(g, i);
      g.appendChild(el('text', { x: m.l - 14, y: y + rowH / 2 + 5, 'text-anchor': 'end', class: 'dx-rank-name' }, r.county));
      var bar = el('rect', {
        x: up ? mid : mid - w, y: y + 8, width: w, height: rowH - 18, rx: 3,
        fill: flat ? C.clay : (up ? C.teal : C.gold), class: 'dx-change-bar ' + (up ? 'is-up' : 'is-down'),
      });
      bar.style.setProperty('--w', w);
      g.appendChild(bar);
      g.appendChild(el('text', {
        x: up ? mid + w + 10 : mid - w - 10, 'text-anchor': up ? 'start' : 'end',
        y: y + rowH / 2 + 5, class: 'dx-change-val', fill: flat ? C.muted : (up ? C.teal : C.gold),
      }, (up ? '+' : (flat ? '' : '−')) + fmtNum(Math.abs(r.yoy))));
      g.style.cursor = 'pointer';
      g.addEventListener('click', function () { if (opts.onSelect) opts.onSelect(r.county); });
      svg.appendChild(g);
    });
    container.appendChild(svg);
    replay(container);
  }

  // ============================================================
  // ComparisonChart — focus vs comparison vs national, per year
  // ============================================================
  function comparisonChart(container, sets, opts) {
    opts = opts || {};
    var live = sets.filter(function (s) { return s.pts && s.pts.length; });
    if (!live.length) { empty(container); return; }
    var years = live[0].pts.map(function (p) { return p.year; });
    var W = vizWidth(container, 320);
    var H = Math.round(Math.max(280, Math.min(420, W * 0.4)));
    var m = { t: 46, r: Math.min(30, W * 0.04), b: 54, l: Math.min(74, W * 0.15) };
    var svg = svgRoot(container, W, H, 'Comparison by year');
    var allY = live.reduce(function (a, s) { return a.concat(s.pts.map(function (p) { return p.value; })); }, [])
      .filter(function (v) { return v != null; });
    var yMax = (Math.max.apply(null, allY) || 1) * 1.16;
    var Y = function (v) { return H - m.b - (v / yMax) * (H - m.t - m.b); };
    var slot = (W - m.l - m.r) / years.length;
    var bw = Math.min(30, (slot - 14) / live.length);

    for (var g = 0; g <= 4; g++) {
      var yv = yMax * g / 4;
      svg.appendChild(el('line', { x1: m.l, y1: Y(yv), x2: W - m.r, y2: Y(yv), class: 'dx-grid' + (g === 0 ? ' is-base' : '') }));
      svg.appendChild(el('text', { x: m.l - 12, y: Y(yv) + 5, 'text-anchor': 'end', class: 'dx-axis' }, fmtNum(yv)));
    }

    years.forEach(function (yr, yi) {
      var groupX = m.l + slot * yi + (slot - bw * live.length) / 2;
      svg.appendChild(el('text', { x: m.l + slot * yi + slot / 2, y: H - m.b + 26, 'text-anchor': 'middle', class: 'dx-axis' }, String(yr)));
      live.forEach(function (s, si) {
        var p = s.pts.filter(function (q) { return q.year === yr; })[0];
        if (!p || p.value == null) return;
        var h = Math.max(1.5, (H - m.b) - Y(p.value));
        var bar = el('rect', { x: groupX + si * bw, y: Y(p.value), width: bw - 3, height: h, rx: 3, fill: s.color, class: 'dx-cmp-bar' });
        bar.style.setProperty('--h', h);
        stagger(bar, yi * live.length + si);
        bar.appendChild(el('title', {}, s.label + ' · ' + yr + ': ' + fmtNum(p.value)));
        svg.appendChild(bar);
      });
    });

    live.forEach(function (s, si) {
      var lx = m.l + si * Math.min(220, (W - m.l) / live.length);
      svg.appendChild(el('rect', { x: lx, y: 10, width: 13, height: 13, rx: 3, fill: s.color }));
      svg.appendChild(el('text', { x: lx + 20, y: 21, class: 'dx-cmp-legend' }, s.label));
    });
    container.appendChild(svg);
    replay(container);
  }

  // ============================================================
  // HeatMatrix — county x year
  // ============================================================
  function heatMatrix(container, counties, years, lookup, opts) {
    opts = opts || {};
    if (!counties.length || !years.length) { empty(container); return; }
    var cellW = 74, cellH = 34, m = { t: 34, l: 176, r: 16, b: 10 };
    var W = m.l + years.length * cellW + m.r, H = m.t + counties.length * cellH + m.b;
    var svg = svgRoot(container, W, H, 'County by year matrix');
    var all = [];
    counties.forEach(function (c) { years.forEach(function (y) { var v = lookup(c, y); if (v != null) all.push(v); }); });
    if (!all.length) { empty(container); return; }
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var tip = makeTooltip(container);

    years.forEach(function (y, j) {
      svg.appendChild(el('text', { x: m.l + j * cellW + cellW / 2, y: m.t - 12, 'text-anchor': 'middle', class: 'dx-axis' }, String(y)));
    });
    counties.forEach(function (c, i) {
      var isFocus = opts.focus && opts.focus === c;
      var isCompare = opts.compare && opts.compare === c;
      if (isFocus || isCompare) {
        svg.appendChild(el('rect', {
          x: 2, y: m.t + i * cellH, width: W - 4, height: cellH, rx: 4,
          class: 'dx-heat-row ' + (isFocus ? 'is-focus' : 'is-compare'),
        }));
      }
      svg.appendChild(el('text', {
        x: m.l - 14, y: m.t + i * cellH + cellH / 2 + 5, 'text-anchor': 'end',
        class: 'dx-rank-name' + (isFocus ? ' is-focus' : '') + (isCompare ? ' is-compare' : ''),
      }, c));
      years.forEach(function (y, j) {
        var v = lookup(c, y);
        var x = m.l + j * cellW, yy = m.t + i * cellH;
        var t = (hi === lo) ? 0.5 : (v - lo) / (hi - lo);
        var cell = el('rect', {
          x: x + 2, y: yy + 2, width: cellW - 4, height: cellH - 4, rx: 3,
          fill: v == null ? '#F1F4F9' : scaleColor(t), class: 'dx-cell' + (v == null ? ' is-empty' : ''),
        });
        stagger(cell, i + j);
        if (v != null) {
          cell.style.cursor = 'pointer';
          cell.addEventListener('mousemove', function (e) {
            tip.show('<strong>' + esc(c) + '</strong><span class="dx-tip-val">' + fmtNum(v) +
              ' <i>' + esc(opts.unit || '') + '</i></span><span class="dx-tip-rank">' + y + '</span>', e.clientX, e.clientY);
          });
          cell.addEventListener('mouseleave', tip.hide);
          cell.addEventListener('click', function () { if (opts.onPick) opts.onPick(c, y); });
        }
        svg.appendChild(cell);
      });
    });
    container.appendChild(svg);
    replay(container);
  }

  // ============================================================
  // Controller
  // ============================================================
  function boot() {
    var state = window.__EXPLORER_STATE__;
    if (!state) return;
    var code = state.indicator, year = state.year;
    var focus = state.focus || '', compare = state.compare || '';
    var payload = null, matrixCache = {}, nationalCache = {};

    var countyNames = state.counties.map(function (c) { return c.name; });
    var indicatorItems = state.indicators.map(function (i) { return { value: i.code, label: i.name, group: i.domainLabel }; });
    var countyItems = [{ value: '', label: 'National (Liberia)', group: '' }]
      .concat(countyNames.map(function (n) { return { value: n, label: n, group: '' }; }));

    var indDD = N.initDropdown(qs('#dd-indicator'), {
      items: indicatorItems, placeholder: 'Select an indicator', selected: code,
      onChange: function (v) { code = v; stopPlay(); syncTree(); syncCategory(); load(); },
    });
    var focusDD = N.initDropdown(qs('#dd-focus'), {
      items: countyItems, placeholder: 'National (Liberia)', selected: focus,
      onChange: function (v) { focus = v; load(); },
    });
    var compareDD = N.initDropdown(qs('#dd-compare'), {
      items: [{ value: '', label: 'None', group: '' }].concat(countyNames.map(function (n) { return { value: n, label: n, group: '' }; })),
      placeholder: 'None', selected: compare,
      onChange: function (v) { compare = v; load(); },
    });

    // ---- category: narrows what the Indicator field offers ----
    // The two fields stay in step in both directions. Picking a category moves the indicator
    // to the first one inside it if the current one falls outside; picking an indicator from
    // anywhere else on the page (the sidebar tree, the map) moves the category to match.
    var catNames = [];
    indicatorItems.forEach(function (it) {
      if (it.group && catNames.indexOf(it.group) === -1) catNames.push(it.group);
    });
    catNames.sort();
    function categoryOf(c) {
      var hit = indicatorItems.filter(function (it) { return it.value === c; })[0];
      return hit ? (hit.group || '') : '';
    }
    function indicatorsIn(cat) {
      return cat ? indicatorItems.filter(function (it) { return it.group === cat; }) : indicatorItems;
    }
    var category = categoryOf(code);
    var catDD = N.initDropdown(qs('#dd-category'), {
      items: [{ value: '', label: 'All categories', group: '' }]
        .concat(catNames.map(function (n) { return { value: n, label: n, group: '' }; })),
      placeholder: 'All categories', selected: category,
      onChange: function (val) {
        category = val;
        var list = indicatorsIn(category);
        indDD.setItems(list);
        var stillThere = list.some(function (it) { return it.value === code; });
        if (!stillThere && list.length) {
          code = list[0].value;
          indDD.setSelected(code);
          syncTree();
          load();
        }
      },
    });
    // keep the category honest when the indicator is changed from somewhere else
    function syncCategory() {
      var cat = categoryOf(code);
      if (cat === category) return;
      category = cat;
      catDD.setSelected(category);
      indDD.setItems(indicatorsIn(category));
    }
    indDD.setItems(indicatorsIn(category));

    function pushUrl() {
      var p = new URLSearchParams();
      p.set('indicator', code); p.set('year', year);
      if (focus) p.set('focus', focus);
      if (compare) p.set('compare', compare);
      history.replaceState(null, '', '/data?' + p.toString());
    }
    function syncTree() {
      qsa('.tree-item').forEach(function (it) { it.classList.toggle('selected', it.dataset.code === code); });
      var open = qs('.tree-item.selected');
      if (open) { var cat = open.closest('.tree-cat'); if (cat) cat.classList.add('open'); }
    }

    // ---- sidebar ----
    qsa('.tree-cat-header').forEach(function (h) {
      function tog() { h.closest('.tree-cat').classList.toggle('open'); }
      h.addEventListener('click', tog);
      h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
    });
    qsa('.tree-item').forEach(function (it) {
      function pick() { code = it.dataset.code; indDD.setSelected(code); syncTree(); load(); scrollToTop(); }
      it.addEventListener('click', pick);
      it.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    var treeToggle = qs('#tree-toggle');
    if (treeToggle) treeToggle.addEventListener('click', function () {
      var t = qs('#indicator-tree');
      var open = t.classList.toggle('is-open');
      treeToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // phones: Browse indicators sits in the filter drop-down and opens the list as a full sheet
    var browseBtn = qs('#dx-cmd-browse'), treeClose = qs('#tree-close');
    function treeSheet(on) {
      var t = qs('#indicator-tree');
      if (!t) return;
      t.classList.toggle('is-sheet', on);
      document.documentElement.classList.toggle('tree-open', on);
      if (browseBtn) browseBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) { var first = t.querySelector('.tree-item.selected') || t.querySelector('.tree-item'); if (first) first.focus({ preventScroll: false }); }
      else if (browseBtn) browseBtn.focus({ preventScroll: true });
    }
    if (browseBtn) browseBtn.addEventListener('click', function () { treeSheet(true); });
    if (treeClose) treeClose.addEventListener('click', function () { treeSheet(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.documentElement.classList.contains('tree-open')) treeSheet(false); });
    qsa('.tree-item').forEach(function (it) {
      it.addEventListener('click', function () { if (document.documentElement.classList.contains('tree-open')) treeSheet(false); });
    });
    function scrollToTop() {
      var target = qs('#dx-intro');
      if (target) target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    }

    // ---- year slider ----
    var yearSlider = qs('#year-slider');
    if (yearSlider) yearSlider.addEventListener('input', function () {
      year = Number(yearSlider.value);
      qs('#year-slider-val').textContent = year;
      stopPlay();
      load();
    });

    // ---- pin: fold the filter bar away to give the visualization the screen ----
    // The choice is remembered, because someone who folds it away is usually reading one
    // indicator across many years and does not want it back on every page load.
    var cmd = qs('.dx-cmd'), pinBtn = qs('#dx-cmd-pin'), peek = qs('#dx-cmd-peek');
    function peekText() {
      if (!peek) return;
      var ind = payload && payload.indicator ? payload.indicator.name : '';
      peek.textContent = [catDD && catDD.getSelected(), ind, focus || 'National', year]
        .filter(Boolean).join('  ·  ');
    }
    function setFold(on) {
      if (!cmd) return;
      cmd.classList.toggle('is-folded', on);
      if (pinBtn) pinBtn.setAttribute('aria-label', on ? 'Show the filters' : 'Hide the filters');
      if (pinBtn) pinBtn.setAttribute('aria-expanded', on ? 'false' : 'true');
      peekText();
      try { localStorage.setItem('nictd.dx.fold', on ? '1' : '0'); } catch (e) { /* private mode */ }
      // the charts measure their column, which just changed height
      setTimeout(function () { Object.keys(redraw).forEach(function (k) { redraw[k](); }); }, 260);
    }
    if (pinBtn) pinBtn.addEventListener('click', function () {
      setFold(!cmd.classList.contains('is-folded'));
    });
    if (peek) peek.addEventListener('click', function () { setFold(false); });
    try {
      if (localStorage.getItem('nictd.dx.fold') === '1') setFold(true);
    } catch (e) { /* private mode */ }

    // ---- play the years ----
    // One clock for the whole page: the map recolours, the ranking bars reorder and slide
    // past one another, the change chart and the readouts follow. Each step waits for the
    // previous one to be on screen rather than firing on a fixed interval, so a slow
    // connection stretches the playback instead of queueing up requests.
    var playing = false, playTimer = 0;
    var playBtn = qs('#dx-play');
    function playLabel(on) {
      if (!playBtn) return;
      playBtn.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-label', on ? 'Stop playing the years' : 'Play through the years');
      var s = playBtn.querySelector('span');
      if (s) s.textContent = on ? 'Stop' : 'Play years';
      document.documentElement.classList.toggle('dx-playing', on);
    }
    function stopPlay() {
      if (!playing) return;
      playing = false;
      clearTimeout(playTimer); playTimer = 0;
      playLabel(false);
    }
    function playYears() {
      var ys = (payload && payload.years) || [];
      if (ys.length < 2) { stopPlay(); return; }
      // Runs until it is stopped: past the last year it wraps to the first and laps again.
      var i = ys.indexOf(year);
      var next = (i + 1) % ys.length;
      var lapped = next === 0;
      year = ys[next];
      if (yearSlider) { yearSlider.value = year; qs('#year-slider-val').textContent = year; }
      load().then(function () {
        // A longer beat on the wrap, so the end of a lap reads as an ending rather than a glitch.
        if (playing) playTimer = setTimeout(playYears, lapped ? 1700 : 1050);
      });
    }
    function startPlay() {
      var ys = (payload && payload.years) || [];
      if (ys.length < 2) return;
      playing = true;
      playLabel(true);
      playTimer = setTimeout(playYears, 250);
    }
    if (playBtn) playBtn.addEventListener('click', function () {
      if (playing) stopPlay(); else startPlay();
    });
    // a hidden tab should not keep stepping through years in the background
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopPlay(); });

    // ---- size controls: one per visualization ----
    // Scaling is pure CSS on the container. The SVG keeps its viewBox, so the whole drawing
    // shrinks proportionally and stays complete: no clipping at any setting.
    var sizePct = {};
    function applySize(target) {
      var pct = sizePct[target] == null ? 100 : sizePct[target];
      var box = target === 'choropleth' ? qs('#choropleth .dx-map-wrap') : qs('#' + target);
      // width, not max-width: both containers already carry an explicit width rule, and
      // setting width is what actually re-lays-out the SVG inside them.
      if (box) box.style.width = pct + '%';
    }
    function applyZoom() { applySize('choropleth'); }
    qsa('.dx-size-range').forEach(function (r) {
      var target = r.dataset.viz;
      sizePct[target] = Number(r.value) || 100;
      r.addEventListener('input', function () {
        sizePct[target] = Number(r.value);
        var out = qs('#size-' + target + '-val');
        if (out) out.textContent = sizePct[target] + '%';
        applySize(target);
      });
    });
    function applyAllSizes() { Object.keys(sizePct).forEach(applySize); }

    // ---- full screen ----
    // Each visual registers how to redraw itself. Expanding moves the real node onto the stage
    // rather than copying it, so listeners and tooltips survive, then asks it to redraw at the
    // size it now has; closing puts it back in exactly the slot it came from and redraws again.
    var redraw = {};
    var fsStage = qs('#dx-fs'), fsBody = qs('#dx-fs-body'),
        fsTitle = qs('#dx-fs-title'), fsCloseBtn = qs('#dx-fs-close');
    var fsTarget = null, fsNode = null, fsHome = null, fsNext = null, fsTrigger = null;

    function vizNode(target) { return target === 'choropleth' ? qs('#choropleth') : qs('#' + target); }

    // The command bar is MOVED into the full-screen stage rather than copied, so the
    // dropdowns keep the handlers bound to them and stay in step with the page underneath.
    var cmdBar = qs('.dx-cmd'), cmdHome = null, cmdNext = null;
    function dockCmd() {
      if (!cmdBar || !fsStage || cmdHome) return;
      cmdHome = cmdBar.parentNode;
      cmdNext = cmdBar.nextSibling;
      cmdBar.classList.add('is-docked');
      fsStage.insertBefore(cmdBar, fsBody);
    }
    function undockCmd() {
      if (!cmdBar || !cmdHome) return;
      cmdBar.classList.remove('is-docked');
      cmdHome.insertBefore(cmdBar, cmdNext);
      cmdHome = null; cmdNext = null;
    }

    function openFs(target, trigger) {
      if (fsTarget || !fsStage) return;
      var node = vizNode(target);
      if (!node) return;
      fsTarget = target; fsNode = node;
      fsHome = node.parentNode; fsNext = node.nextSibling; fsTrigger = trigger || null;
      var sec = node.closest('.dx-sec');
      var h2 = sec ? sec.querySelector('h2') : null;
      fsTitle.textContent = h2 ? h2.textContent.trim() : 'Visualization';
      node.dataset.fsw = node.style.width || '';
      node.style.width = '';
      fsBody.appendChild(node);
      dockCmd();
      fsStage.hidden = false;
      document.body.classList.add('dx-fs-open');
      // The stage is opacity:0 until .is-open lands, so this must not depend on a frame that
      // may never come: a background tab pauses rAF, which would leave an invisible overlay
      // sitting over the page swallowing clicks. The timeout is the backstop.
      var armed = false;
      function armStage() { if (armed) return; armed = true; fsStage.classList.add('is-open'); }
      requestAnimationFrame(armStage);
      setTimeout(armStage, 80);
      if (redraw[target]) redraw[target]();
      // measured again once the docked bar has taken its height, so the chart sizes to what
      // is actually left rather than to the stage before the bar arrived
      setTimeout(function () { if (fsTarget === target && redraw[target]) redraw[target](); }, 90);
      if (fsCloseBtn) fsCloseBtn.focus();
    }

    function closeFs() {
      if (!fsTarget) return;
      var target = fsTarget, node = fsNode, home = fsHome, next = fsNext, trigger = fsTrigger;
      fsTarget = null; fsNode = null; fsHome = null; fsNext = null; fsTrigger = null;
      fsStage.classList.remove('is-open');
      document.body.classList.remove('dx-fs-open');
      undockCmd();
      if (home) home.insertBefore(node, next);      // back into the exact slot it left
      node.style.width = node.dataset.fsw || '';
      delete node.dataset.fsw;
      if (redraw[target]) redraw[target]();
      applySize(target);
      if (trigger) trigger.focus();
      setTimeout(function () { if (!fsTarget) fsStage.hidden = true; }, 300);
    }

    qsa('.dx-expand').forEach(function (b) {
      b.addEventListener('click', function () { openFs(b.dataset.expand, b); });
    });
    if (fsCloseBtn) fsCloseBtn.addEventListener('click', closeFs);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && fsTarget) { ev.preventDefault(); closeFs(); }
    });

    // ---- fetching ----
    // Payloads are kept per indicator / year / focus / comparison. Playing the years or
    // dragging the slider back and forth then costs nothing after the first pass, which is
    // what lets the race run smoothly instead of stuttering on the network.
    var payloadCache = {};
    function applyPayload(d) {
      payload = d;
      year = d.year;
      if (typeof peekText === 'function') peekText();
      if (yearSlider) {
        yearSlider.min = d.years[0];
        yearSlider.max = d.years[d.years.length - 1];
        yearSlider.value = d.year;
        qs('#year-slider-val').textContent = d.year;
      }
      render(d);
    }
    function load() {
      pushUrl();
      var ck = code + '|' + year + '|' + focus + '|' + compare;
      if (payloadCache[ck]) { applyPayload(payloadCache[ck]); return Promise.resolve(payloadCache[ck]); }
      var main = qs('#dx-main');
      // While playing, the panels are already on screen; flashing the loading state on every
      // step would strobe the page.
      if (main && !playing) main.classList.add('is-loading');
      var u = '/api/v1/explorer?indicator=' + encodeURIComponent(code) + '&year=' + year +
        (focus ? '&focus=' + encodeURIComponent(focus) : '') +
        (compare ? '&compare=' + encodeURIComponent(compare) : '');
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error('request failed');
        return r.json();
      }).then(function (d) {
        var keys = Object.keys(payloadCache);
        if (keys.length > 80) delete payloadCache[keys[0]];
        payloadCache[ck] = d;
        applyPayload(d);
        if (main) main.classList.remove('is-loading');
        return d;
      }).catch(function () {
        if (main) main.classList.remove('is-loading');
        N.toast('Could not load that indicator. Please try again.');
      });
    }

    // National series is needed as a comparison baseline whenever a county is in focus.
    function nationalSeries() {
      if (nationalCache[code]) return Promise.resolve(nationalCache[code]);
      return fetch('/api/v1/explorer?indicator=' + encodeURIComponent(code) + '&year=' + year)
        .then(function (r) { return r.json(); })
        .then(function (d) { nationalCache[code] = d.trend.series; return nationalCache[code]; })
        .catch(function () { return []; });
    }

    // The tallest county value across every year of this indicator. rankingBars uses it so
    // the bars keep one scale for the whole race. Derived from the matrix request the heat
    // map already makes, so it costs no extra round trip.
    var rankScale = {};
    function ensureRankScale() {
      if (rankScale[code] != null) return Promise.resolve(rankScale[code]);
      var forCode = code;
      return matrix().then(function (m) {
        var mx = 0, k;
        if (m) for (k in m) if (m[k] > mx) mx = m[k];
        rankScale[forCode] = mx || 0;
        return rankScale[forCode];
      });
    }

    function matrix() {
      if (matrixCache[code]) return Promise.resolve(matrixCache[code]);
      return fetch('/api/v1/download/data.json?indicator=' + encodeURIComponent(code))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var m = {};
          (d.data || []).forEach(function (row) { if (row.county) m[row.county + '|' + row.year] = row.value; });
          matrixCache[code] = m;
          return m;
        }).catch(function () { return null; });
    }

    // ---- rendering ----
    function render(d) {
      var ind = d.indicator;
      var unit = ind.unit || '';
      var rows = (d.table || []).filter(function (r) { return r.value != null; })
        .slice().sort(function (a, b) { return b.value - a.value; });
      rows.forEach(function (r, i) { r.rank = i + 1; });

      var top = rows[0], bottom = rows[rows.length - 1];
      var series = d.trend.series || [];
      var latest = series.length ? series[series.length - 1] : null;
      var prev = series.length > 1 ? series[series.length - 2] : null;
      var scopeName = focus || 'National';

      // -- intro --
      qs('#explorer-title').textContent = ind.name;
      qs('#explorer-domain-tag').textContent = ind.domainLabel;
      qs('#explorer-desc').textContent = ind.description || '';
      qs('#dx-unit').textContent = unit;
      var agencyEl = qs('#dx-agency');
      agencyEl.textContent = ind.agency || 'n/a';
      agencyEl.title = ind.agency || '';   // the source name may be shortened to keep the bar on one line
      // Placeholder series are labelled on the bar under the definition, so nobody mistakes a
      // demonstration figure for an official statistic.
      var mockEl = qs('#dx-mock');
      if (mockEl) {
        var partial = !!ind.is_part_mock;
        mockEl.hidden = !(ind.is_mock || partial);
        mockEl.textContent = partial ? 'Partly mock data' : 'Mock data';
        mockEl.classList.toggle('is-partial', partial);
      }
      qs('#dx-coverage').textContent = rows.length + ' of ' + countyNames.length + ' counties';
      qs('#dx-years-span').textContent = d.years.length ? d.years[0] + '–' + d.years[d.years.length - 1] : 'n/a';

      // -- snapshot (all figures derived from the payload) --
      var focusRow = focus ? rows.filter(function (r) { return r.county === focus; })[0] : null;
      var headline = focusRow ? focusRow.value : (latest ? latest.value : null);
      countUp(qs('#snap-value'), headline);
      qs('#snap-value-sub').textContent = unit + (focus ? ' · ' + focus : ' · national');

      // With a comparison area set, every card carries the second place as well, so the two
      // are readable together rather than only inside the comparison view.
      var cmpRow = compare ? rows.filter(function (r) { return r.county === compare; })[0] : null;
      function setCmp(id, html) {
        var node = qs(id);
        if (!node) return;
        node.innerHTML = html || '';
        node.hidden = !html;
      }
      setCmp('#snap-value-cmp', cmpRow
        ? esc(compare) + ': <b>' + fmtNum(cmpRow.value) + '</b> ' + esc(unit)
        : (compare ? esc(compare) + ': <b>no data</b>' : ''));

      var rankEl = qs('#snap-rank');
      if (focusRow) {
        qs('#snap-rank-lbl').textContent = 'National position';
        rankEl.textContent = '#' + focusRow.rank;
        qs('#snap-rank-sub').textContent = 'of ' + rows.length + ' counties';
      } else if (top && bottom) {
        qs('#snap-rank-lbl').textContent = 'Spread';
        rankEl.textContent = fmtNum(top.value - bottom.value);
        qs('#snap-rank-sub').textContent = 'highest minus lowest';
      } else {
        qs('#snap-rank-lbl').textContent = 'Spread';
        rankEl.textContent = 'n/a';
        qs('#snap-rank-sub').textContent = '';
      }
      setCmp('#snap-rank-cmp', cmpRow
        ? esc(compare) + ': <b>#' + cmpRow.rank + '</b> of ' + rows.length
        : '');

      var chEl = qs('#snap-change');
      if (latest && prev && prev.value != null && prev.value !== 0 && latest.value != null) {
        var pct = ((latest.value - prev.value) / Math.abs(prev.value)) * 100;
        chEl.textContent = (pct > 0 ? '+' : '') + (Math.round(pct * 10) / 10) + '%';
        chEl.className = 'dx-stat-val ' + (pct > 0 ? 'is-up' : (pct < 0 ? 'is-down' : ''));
        qs('#snap-change-sub').textContent = prev.year + ' to ' + latest.year + (focus ? ' · ' + focus : ' · national');
      } else {
        chEl.textContent = 'n/a';
        chEl.className = 'dx-stat-val';
        qs('#snap-change-sub').textContent = 'no prior year';
      }
      setCmp('#snap-change-cmp', (cmpRow && cmpRow.yoy != null)
        ? esc(compare) + ': <b>' + (cmpRow.yoy > 0 ? '+' : (cmpRow.yoy < 0 ? '−' : '')) +
          fmtNum(Math.abs(cmpRow.yoy)) + '</b> ' + esc(unit)
        : (compare ? esc(compare) + ': <b>n/a</b>' : ''));

      countUp(qs('#snap-locations'), rows.length, { decimals: 0 });
      // The fourth card turns into the gap between the two places, which is the number a
      // reader actually wants once a comparison is on.
      var gapBase = focusRow ? focusRow.value : (latest ? latest.value : null);
      setCmp('#snap-locations-cmp', (cmpRow && gapBase != null && cmpRow.value != null)
        ? 'Gap: <b>' + fmtNum(Math.abs(gapBase - cmpRow.value)) + '</b> ' + esc(unit) +
          ' · ' + esc(focus || 'national') + ' vs ' + esc(compare)
        : '');

      // -- 01 geography --
      var bothLabel = compare ? (focus || 'National') + ' and ' + compare : (focus || '');
      qs('#geo-sub').textContent = ind.name + ' by county, ' + d.year + '. Measured in ' + unit +
        (compare ? '. ' + bothLabel + ' are outlined on the map.' : '.') +
        ' Click any county to make it the focus location.';
      if (top && bottom) {
        // trend.series is the FOCUS county series when a focus is set, so this line must name
        // the scope it is actually reporting rather than always saying "across Liberia".
        var scopeLead = focus || 'national';
        qs('#step1-h').textContent = cmpRow
          ? (focus || 'Liberia') + ' vs ' + compare
          : (focus ? 'Where ' + focus + ' stands' : 'The national picture');
        if (cmpRow && gapBase != null && cmpRow.value != null) {
          var lead = gapBase >= cmpRow.value ? (focus || 'the national figure') : compare;
          var behind = gapBase >= cmpRow.value ? compare : (focus || 'the national figure');
          qs('#step1-p').textContent = 'In ' + d.year + ', ' + (focus || 'Liberia') + ' records ' +
            fmtNum(gapBase) + ' ' + unit + ' and ' + compare + ' records ' + fmtNum(cmpRow.value) +
            ' ' + unit + '. ' + lead + ' is ahead of ' + behind + ' by ' +
            fmtNum(Math.abs(gapBase - cmpRow.value)) + ' ' + unit + '.';
        } else {
          qs('#step1-p').textContent = latest
            ? (focus ? 'In ' + focus + ' the ' : 'Across Liberia the ') + d.year + ' figure is ' +
              fmtNum(latest.value) + ' ' + unit + '. ' +
              rows.length + ' of ' + countyNames.length + ' counties reported a value.'
            : rows.length + ' of ' + countyNames.length + ' counties reported a value for ' + d.year + '.';
        }
        qs('#step2-h').textContent = 'Where it is highest';
        qs('#step2-p').textContent = top.county + ' leads at ' + fmtNum(top.value) + ' ' + unit + '.' +
          (cmpRow ? ' ' + compare + ' sits at #' + cmpRow.rank + ' of ' + rows.length + '.' : '') +
          (focusRow ? ' ' + focus + ' sits at #' + focusRow.rank + '.' : '');
        qs('#step3-h').textContent = 'Where it is lowest';
        var ratio = (bottom.value > 0) ? Math.round((top.value / bottom.value) * 10) / 10 : null;
        qs('#step3-p').textContent = bottom.county + ' records ' + fmtNum(bottom.value) + ' ' + unit +
          (ratio ? ', which is ' + ratio + '× below ' + top.county + '.' : '.') +
          (cmpRow ? ' Both ' + (focus || 'the national figure') + ' and ' + compare +
            ' are marked on every view below.' : '');
      }
      redraw['choropleth'] = function () { drawMap(rows, ind, d.year, null); };
      redraw['choropleth']();

      // -- 02 ranking --
      qs('#rank-sub').textContent = top && bottom
        ? 'All ' + rows.length + ' reporting counties for ' + d.year + ', highest to lowest, measured in ' + unit +
          (cmpRow ? '. ' + (focus || 'National') + ' and ' + compare + ' are highlighted' : '') +
          '. Click a bar to focus that county.'
        : 'No county values for ' + d.year + '.';
      redraw['viz-ranking'] = function () {
        rankingBars(qs('#viz-ranking'), rows, {
          unit: unit, focus: focus, compare: compare, scaleMax: rankScale[code] || 0,
          onSelect: function (n) { focus = n; focusDD.setSelected(n); load(); },
        });
      };
      redraw['viz-ranking']();
      // The first paint of a new indicator uses this year's own maximum; once the all-year
      // figure lands the chart settles onto the fixed scale and stays there.
      (function (forCode) {
        ensureRankScale().then(function (mx) {
          if (mx && code === forCode && redraw['viz-ranking']) redraw['viz-ranking']();
        });
      })(code);

      // -- 03 trend --
      qs('#trend-sub').textContent = scopeName + ', ' +
        (d.years.length ? d.years[0] + ' to ' + d.years[d.years.length - 1] : 'no years') + '. Hover for exact values.';
      var lastNat = null;
      var drawTrend = function (natSeries) {
        lastNat = natSeries;
        trendLine(qs('#explorer-trend'), series, {
          label: scopeName, area: true,
          compareSeries: d.compareTrend ? d.compareTrend.series : null,
          compareLabel: compare,
          nationalSeries: focus ? natSeries : null,
        });
        var lg = qs('#trend-legend');
        var items = '<span class="dx-key"><i style="background:' + C.teal + '"></i>' + esc(scopeName) + '</span>';
        if (compare) items += '<span class="dx-key"><i style="background:' + C.gold + '"></i>' + esc(compare) + '</span>';
        if (focus && natSeries && natSeries.length) items += '<span class="dx-key"><i style="background:' + C.clay + '"></i>National average</span>';
        lg.innerHTML = items;
      };
      redraw['explorer-trend'] = function () { drawTrend(lastNat); };
      if (focus) nationalSeries().then(drawTrend); else drawTrend(null);

      // -- 04 change --
      var withYoy = rows.filter(function (r) { return r.yoy != null; });
      var ups = withYoy.filter(function (r) { return r.yoy > 0; }).length;
      var downs = withYoy.filter(function (r) { return r.yoy < 0; }).length;
      var flats = withYoy.length - ups - downs;
      function moveWord(r) {
        if (!r || r.yoy == null) return null;
        return r.yoy > 0 ? 'improved by ' + fmtNum(r.yoy) : (r.yoy < 0 ? 'declined by ' + fmtNum(Math.abs(r.yoy)) : 'held level');
      }
      var fMove = moveWord(focusRow), cMove = moveWord(cmpRow);
      qs('#change-sub').textContent = withYoy.length
        ? ups + ' counties improved, ' + downs + ' declined and ' + flats + ' held level between ' + (d.year - 1) + ' and ' + d.year + '.' +
          (fMove ? ' ' + focus + ' ' + fMove + '.' : '') +
          (cMove ? ' ' + compare + ' ' + cMove + '.' : '')
        : 'No year-on-year change recorded for ' + d.year + '.';
      redraw['viz-change'] = function () {
        changeChart(qs('#viz-change'), rows, {
          focus: focus, compare: compare,
          onSelect: function (n) { focus = n; focusDD.setSelected(n); load(); },
        });
      };
      redraw['viz-change']();

      // -- 05 comparison --
      var cmpTitle = qs('#cmp-title'), cmpSub = qs('#cmp-sub');
      var lastNatCmp = null;
      var buildCompare = function (natSeries) {
        lastNatCmp = natSeries;
        var sets = [];
        if (focus) sets.push({ pts: series, color: C.teal, label: focus });
        else sets.push({ pts: series, color: C.teal, label: 'National' });
        if (compare && d.compareTrend) sets.push({ pts: d.compareTrend.series, color: C.gold, label: compare });
        if (focus && natSeries && natSeries.length) sets.push({ pts: natSeries, color: C.clay, label: 'National average' });

        if (sets.length < 2) {
          cmpTitle.textContent = 'How does it compare?';
          cmpSub.textContent = 'Pick a Comparison Area in the bar above, or a Focus Location, to put two places side by side.';
          empty(qs('#viz-compare'), 'Choose a comparison area to see two places side by side.');
        } else {
          cmpTitle.textContent = sets.map(function (s) { return s.label; }).join(' vs ');
          cmpSub.textContent = 'Values for each year, ' + d.years[0] + ' to ' + d.years[d.years.length - 1] + '.';
          comparisonChart(qs('#viz-compare'), sets, {});
        }

        var statRow = qs('#compare-stats');
        var html = '';
        sets.forEach(function (s, i) {
          var lastPt = s.pts.filter(function (p) { return p.value != null; }).pop();
          if (!lastPt) return;
          html += '<div class="compare-stat-card ' + (i === 0 ? 'focus' : (i === 1 ? 'compare' : '')) + '">' +
            '<div class="lbl">' + esc(s.label) + '</div>' +
            '<div class="val mono">' + fmtNum(lastPt.value) + '</div>' +
            '<div class="sub">' + esc(unit) + ' · ' + lastPt.year + '</div></div>';
        });
        if (sets.length >= 2) {
          var a = sets[0].pts.filter(function (p) { return p.value != null; }).pop();
          var b = sets[1].pts.filter(function (p) { return p.value != null; }).pop();
          if (a && b) {
            var diff = a.value - b.value;
            html += '<div class="compare-stat-card gap"><div class="lbl">Difference</div>' +
              '<div class="val mono ' + (diff > 0 ? 'is-up' : (diff < 0 ? 'is-down' : '')) + '">' +
              (diff > 0 ? '+' : (diff < 0 ? '−' : '')) + fmtNum(Math.abs(diff)) + '</div>' +
              '<div class="sub">' + esc(sets[0].label) + ' vs ' + esc(sets[1].label) + '</div></div>';
          }
        }
        statRow.innerHTML = html;
      };
      redraw['viz-compare'] = function () { buildCompare(lastNatCmp); };
      if (focus) nationalSeries().then(buildCompare); else buildCompare(null);

      // -- 06 matrix --
      var heatBox = qs('#viz-heat');
      heatBox.innerHTML = '<p class="dx-empty">Loading the full matrix…</p>';
      matrix().then(function (m) {
        if (!m) { empty(heatBox, 'Matrix unavailable.'); return; }
        redraw['viz-heat'] = function () {
          heatMatrix(heatBox, countyNames, d.years, function (c, y) {
            var v = m[c + '|' + y];
            return v == null ? null : v;
          }, {
            unit: unit, focus: focus, compare: compare,
            onPick: function (c, y) {
              focus = c; year = y;
              focusDD.setSelected(c);
              if (yearSlider) { yearSlider.value = y; qs('#year-slider-val').textContent = y; }
              load();
            },
          });
        };
        redraw['viz-heat']();
      });

      // -- 07 table --
      qs('#data-sub').textContent = 'Every reporting county for ' + d.year + ', with year-on-year change and rank. Sort any column.';
      var tbody = qs('#explorer-table tbody');
      tbody.innerHTML = (d.table || []).map(function (r) {
        var rk = rows.filter(function (x) { return x.county === r.county; })[0];
        var cls = r.yoy == null ? 'yoy-flat' : (r.yoy > 0 ? 'yoy-up' : (r.yoy < 0 ? 'yoy-down' : 'yoy-flat'));
        var arrow = r.yoy == null ? '·' : (r.yoy > 0 ? '▲' : (r.yoy < 0 ? '▼' : '·'));
        return '<tr' + (r.county === focus ? ' class="is-focus"'
          : (compare && r.county === compare ? ' class="is-compare"' : '')) + '>' +
          '<td data-sort="' + esc(r.county) + '">' + esc(r.county) + '</td>' +
          '<td class="num mono" data-sort="' + (r.value == null ? '' : r.value) + '">' + fmtNum(r.value) + '</td>' +
          '<td class="num mono ' + cls + '" data-sort="' + (r.yoy == null ? 0 : r.yoy) + '">' + arrow + ' ' +
            (r.yoy == null ? '' : fmtNum(Math.abs(r.yoy))) + '</td>' +
          '<td class="num mono" data-sort="' + (rk ? rk.rank : 99) + '">' + (rk ? rk.rank : 'n/a') + '</td></tr>';
      }).join('');
      N.initSortableTable(qs('#explorer-table'));

      // downloads
      var q = '?indicator=' + encodeURIComponent(code) + '&year=' + d.year;
      qs('#dl-csv').href = '/api/v1/download/data.csv' + q;
      qs('#dl-json').href = '/api/v1/download/data.json' + q;

      applyAllSizes();
      qsa('.dx-sec').forEach(revealer);
    }

    // ---- map drawing + scrollytelling steps ----
    function drawMap(rows, ind, yr, highlight) {
      animatedMap(qs('#choropleth'), rows, {
        unit: ind.unit, indicatorName: ind.name, year: yr,
        focus: focus, compare: compare,
        highlight: highlight, dim: !!highlight,
        onHover: function (name, v) {
          var nm = qs('#readout-name'), vv = qs('#readout-val');
          if (!nm) return;
          if (name) { nm.textContent = name; vv.textContent = v == null ? 'no data' : fmtNum(v) + ' ' + ind.unit; }
          else { nm.textContent = focus || 'National'; vv.textContent = defaultReadout(rows, ind); }
        },
        onSelect: function (n) { focus = n; focusDD.setSelected(n); load(); },
      });
      applyZoom();
      var nm = qs('#readout-name'), vv = qs('#readout-val');
      if (nm) { nm.textContent = focus || 'National'; vv.textContent = defaultReadout(rows, ind); }
      wireSteps(rows, ind, yr);
    }
    function defaultReadout(rows, ind) {
      if (focus) {
        var r = rows.filter(function (x) { return x.county === focus; })[0];
        return r ? fmtNum(r.value) + ' ' + ind.unit : 'no data';
      }
      if (!payload || !payload.trend.series.length) return '';
      var last = payload.trend.series[payload.trend.series.length - 1];
      return fmtNum(last.value) + ' ' + ind.unit;
    }

    // The stage is pinned, so which reading is showing is a function of how far the reader has
    // scrolled through the pin rather than which step happens to be crossing the middle of the
    // screen. One listener, re-pointed at the current data on every render.
    var stepData = null, stepIdx = -1, stepBound = false;

    // The bar renders taller than --nav-h says, and taller again on narrow screens; the pin has
    // to reserve exactly the space below it or the map lands short of the viewport.
    function fitGeoNav() {
      var nav = document.querySelector('.gov-nav');
      if (nav) document.documentElement.style.setProperty('--dx-nav', Math.round(nav.getBoundingClientRect().height) + 'px');
    }

    function unpinned() {
      return REDUCED ||
        (window.matchMedia && (window.matchMedia('(max-width: 1000px)').matches ||
                               window.matchMedia('(max-height: 620px)').matches));
    }

    function paintStep(i) {
      if (!stepData) return;
      if (i === stepIdx) return;
      stepIdx = i;
      stepData.steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      stepData.dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      drawMapHighlight(stepData.rows, stepData.ind, stepData.yr,
        stepData.sets[stepData.steps[i].dataset.step]);
    }

    function onStepScroll() {
      if (!stepData) return;
      var pin = qs('#dx-geo-pin');
      if (!pin || unpinned()) { stepData.steps.forEach(function (s) { s.classList.add('is-active'); }); return; }
      var sticky = pin.firstElementChild;
      var travel = pin.offsetHeight - (sticky ? sticky.offsetHeight : 0);
      if (travel <= 0) return;
      var p = Math.min(1, Math.max(0, -pin.getBoundingClientRect().top / travel));
      var n = stepData.steps.length;
      // the last reading holds to the end of the pin rather than flashing past at p === 1
      paintStep(Math.min(n - 1, Math.floor(p * n)));
    }

    function wireSteps(rows, ind, yr) {
      var steps = qsa('#map-steps .dx-step');
      if (!steps.length) return;
      var sorted = rows.slice();
      stepData = {
        rows: rows, ind: ind, yr: yr, steps: steps,
        dots: qsa('#map-step-dots i'),
        sets: {
          national: null,
          top: sorted.slice(0, 3).map(function (r) { return r.county; }),
          bottom: sorted.slice(-3).map(function (r) { return r.county; }),
        },
      };
      fitGeoNav();
      if (unpinned()) {
        steps.forEach(function (s) { s.classList.add('is-active'); });
        return;
      }
      stepIdx = -1;
      if (!stepBound) {
        stepBound = true;
        window.addEventListener('scroll', onStepScroll, { passive: true });
        window.addEventListener('resize', function () { fitGeoNav(); stepIdx = -1; onStepScroll(); });
      }
      onStepScroll();
    }
    var lastHighlight = 'init';
    function drawMapHighlight(rows, ind, yr, names) {
      var key = names ? names.join(',') : 'national';
      if (key === lastHighlight) return;
      lastHighlight = key;
      animatedMap(qs('#choropleth'), rows, {
        unit: ind.unit, indicatorName: ind.name, year: yr,
        focus: focus, compare: compare, highlight: names, dim: !!names,
        onHover: function (name, v) {
          var nm = qs('#readout-name'), vv = qs('#readout-val');
          if (!nm) return;
          if (name) { nm.textContent = name; vv.textContent = v == null ? 'no data' : fmtNum(v) + ' ' + ind.unit; }
          else { nm.textContent = focus || 'National'; vv.textContent = defaultReadout(rows, ind); }
        },
        onSelect: function (n) { focus = n; focusDD.setSelected(n); load(); },
      });
      applyZoom();
    }

    // ---- toolbar ----
    var png = qs('#btn-png');
    if (png) png.addEventListener('click', function () {
      var svg = qs('#choropleth svg');
      if (svg) N.exportSvgToPng(svg, code + '-' + year + '-map.png');
    });
    var share = qs('#btn-share');
    if (share) share.addEventListener('click', function () { N.copyText(location.href); });

    // ---- section progress rail ----
    (function progressRail() {
      var rail = qs('#dx-rail');
      if (!rail) return;
      var secs = qsa('.dx-view');
      rail.innerHTML = secs.map(function (s) {
        var label = s.querySelector('.dx-view-num');
        return '<a class="dx-rail-dot" href="#' + s.id + '" title="' + esc(label ? label.textContent : s.id) + '"><i></i></a>';
      }).join('');
      var dots = qsa('.dx-rail-dot', rail);
      qsa('.dx-rail-dot', rail).forEach(function (a, i) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          secs[i].scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        });
      });
      if (!('IntersectionObserver' in window)) return;
      var ob = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var idx = secs.indexOf(e.target);
          dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      secs.forEach(function (s) { ob.observe(s); });
    })();

    // Chart viewBoxes are tied to container width, so a resize past a meaningful threshold
    // needs a redraw. Debounced, and ignored for the small jitters a mobile URL bar causes.
    var lastW = window.innerWidth, rzT = null;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 40) return;
      lastW = window.innerWidth;
      clearTimeout(rzT);
      rzT = setTimeout(function () { if (payload) render(payload); }, 220);
    });

    syncTree();
    load();
  }

  // app.js may still be parsing; poll briefly rather than failing silently.
  var tries = 0;
  function start() {
    if (bindToolkit()) { boot(); return; }
    if (++tries > 60) { console.error('NICTD: shared toolkit (app.js) never loaded; Data Explorer disabled.'); return; }
    setTimeout(start, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
