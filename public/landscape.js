// landscape.js · NIIS Data Landscape.
// Liberia's 15 counties laid out as a floor, each county carrying a tower as tall as the
// selected indicator's value there. The geometry is the same county file the Data Explorer
// map uses (public/liberia-counties.js); the values come from /api/v1/data. Nothing here is
// fabricated: a county with no value for a year gets no tower and is drawn as "no data".
// Shared helpers come from window.NICTD (public/app.js).
(function () {
  'use strict';
  if (window.__NICTD_PAGE__ !== 'landscape') return;

  // Shared toolkit from app.js. This file is deferred from <head> while app.js sits at the
  // end of <body>, so deferred execution order runs THIS file first. Handles are bound in
  // start(), by which point app.js has run and window.NICTD exists.
  var N, el, esc, qs, fmtNum;
  function bindToolkit() {
    N = window.NICTD;
    if (!N) return false;
    el = N.el; esc = N.esc; qs = N.qs; fmtNum = N.fmtNum;
    return true;
  }

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // ============================================================
  // Camera
  // The plane is tilted back and turned a little. This is deliberately NOT a full isometric
  // rotation: at 13 degrees the country's outline stays immediately recognisable as Liberia,
  // which is the whole reason for using the real boundary file.
  // ============================================================
  var TH = -13 * Math.PI / 180, K = 0.56, S = 19, SLAB = 13;
  var CO = Math.cos(TH), SI = Math.sin(TH);
  function T(x, y) { return [x * CO - y * SI, (x * SI + y * CO) * K]; }

  // ---------- colour, matching the app's own scale ----------
  var STOP1 = [221, 231, 247], STOP2 = [74, 130, 200], STOP3 = [11, 44, 99];
  var GOLD = [200, 16, 46];
  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)];
  }
  function rampRgb(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? mix(STOP1, STOP2, t / 0.5) : mix(STOP2, STOP3, (t - 0.5) / 0.5);
  }
  function shade(c, f) {
    return 'rgb(' + c.map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v * f)));
    }).join(',') + ')';
  }
  function paler(c, t) { return mix(c, [255, 255, 255], t); }

  // ============================================================
  // Geometry, projected once
  // ============================================================
  var GEO = [], VB = null, HMAX = 0, PLANE = null;

  function projectPath(d) {
    return d.replace(/(-?[\d.]+),(-?[\d.]+)/g, function (m, x, y) {
      var p = T(parseFloat(x), parseFloat(y));
      return p[0].toFixed(1) + ',' + p[1].toFixed(1);
    });
  }

  function buildGeometry() {
    var src = window.LIBERIA_COUNTIES;
    if (!src || !src.length) return false;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    GEO = src.map(function (c) {
      var d = projectPath(c.d);
      d.replace(/(-?[\d.]+),(-?[\d.]+)/g, function (m, x, y) {
        x = +x; y = +y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        return m;
      });
      // the tower's footprint: four projected corners, plus which one faces the viewer
      var b = [[c.cx - S, c.cy - S], [c.cx + S, c.cy - S], [c.cx + S, c.cy + S], [c.cx - S, c.cy + S]]
        .map(function (p) { return T(p[0], p[1]); });
      var fi = 0;
      b.forEach(function (p, i) { if (p[1] > b[fi][1]) fi = i; });
      return { name: c.name, d: d, base: b, fi: fi, p: T(c.cx, c.cy) };
    });
    var PW = maxX - minX, PH = maxY - minY;
    HMAX = PH * 0.52;
    PLANE = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
    VB = { x: minX - 44, y: minY - HMAX - 80, w: PW + 162, h: PH + HMAX + 122 };
    // draw order: far counties first, so nearer towers overlap them correctly
    GEO.sort(function (a, b) { return a.p[1] - b.p[1]; });
    return true;
  }

  function towerFaces(g, hh) {
    var b = g.base, fi = g.fi, t = [], i;
    for (i = 0; i < 4; i++) t.push([b[i][0], b[i][1] - hh]);
    var l = (fi + 3) % 4, r = (fi + 1) % 4;
    return {
      faceL: [b[l], b[fi], t[fi], t[l]],
      faceR: [b[fi], b[r], t[r], t[fi]],
      top: t,
      apex: t[fi],
    };
  }
  function pts(a) {
    return a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  }

  // ============================================================
  // Boot
  // ============================================================
  function boot() {
    var state = window.__LANDSCAPE_STATE__;
    if (!state) return;
    var stage = qs('#lsc-map');
    if (!stage) return;
    if (!buildGeometry()) {
      stage.innerHTML = '<p class="lsc-empty">County geometry unavailable, so the landscape cannot be drawn. '
        + 'The same figures are available in the <a href="/data">Data Explorer</a>.</p>';
      return;
    }

    var code = state.indicator;
    var meta = null;          // indicator metadata for the loaded code
    var byYear = {};          // year -> { county: value }
    var natByYear = {};       // year -> national value
    var years = [];           // years this indicator actually holds
    var year = state.year;
    var scaleBase = 0, scaleMax = 1;   // fixed across years, see setData()
    var natIsLevel = true;             // false when the national row is a total, see setData()
    var hoverName = '', pinnedName = '';

    // ---------- the SVG, built once and then mutated ----------
    var svg = el('svg', {
      viewBox: VB.x.toFixed(1) + ' ' + VB.y.toFixed(1) + ' ' + VB.w.toFixed(1) + ' ' + VB.h.toFixed(1),
      class: 'lsc-svg', role: 'img',
      'aria-label': 'Liberia, fifteen counties, each shown as a tower whose height is the selected indicator value.',
    });
    var defs = el('defs');
    var soft = el('filter', { id: 'lscSoft', x: '-25%', y: '-25%', width: '150%', height: '150%' });
    soft.appendChild(el('feDropShadow', {
      dx: '0', dy: '11', stdDeviation: '10', 'flood-color': '#0B2C63', 'flood-opacity': '.20',
    }));
    defs.appendChild(soft);
    var landG = el('g', { id: 'lscLand' });
    GEO.forEach(function (g) { landG.appendChild(el('path', { d: g.d })); });
    defs.appendChild(landG);
    svg.appendChild(defs);

    // the landmass has thickness: the outline stacked below the tiles reads as a slab edge
    var slabG = el('g', {});
    for (var k = SLAB; k >= 1; k--) {
      var u = el('use', { transform: 'translate(0 ' + k + ')', fill: shade([120, 148, 180], 0.55 + (1 - k / SLAB) * 0.30) });
      u.setAttribute('href', '#lscLand');
      slabG.appendChild(u);
    }
    svg.appendChild(slabG);

    // one tile and one tower per county, kept as live nodes and mutated per frame
    var tiles = {}, towers = {};
    var tileG = el('g', { class: 'lsc-tiles' });
    GEO.forEach(function (g) {
      var p = el('path', { d: g.d, class: 'lsc-tile', 'stroke-width': '1.6', stroke: '#fff',
        'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
      tiles[g.name] = p;
      tileG.appendChild(p);
    });
    svg.appendChild(tileG);
    var edgeG = el('g', { class: 'lsc-edges', fill: 'none', stroke: '#2F5468', 'stroke-opacity': '.38',
      'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' });
    GEO.forEach(function (g) { edgeG.appendChild(el('path', { d: g.d, 'vector-effect': 'non-scaling-stroke' })); });
    svg.appendChild(edgeG);

    var towerG = el('g', { class: 'lsc-towers' });
    GEO.forEach(function (g) {
      var grp = el('g', { class: 'lsc-tower', tabindex: '0', role: 'button' });
      var fl = el('polygon', { class: 'lsc-f-l' });
      var fr = el('polygon', { class: 'lsc-f-r' });
      var tp = el('polygon', { class: 'lsc-f-t', stroke: '#fff', 'stroke-opacity': '.6',
        'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' });
      var hit = el('polygon', { class: 'lsc-hit', fill: 'transparent' });
      grp.appendChild(fl); grp.appendChild(fr); grp.appendChild(tp); grp.appendChild(hit);
      towers[g.name] = { grp: grp, fl: fl, fr: fr, tp: tp, hit: hit };
      towerG.appendChild(grp);
    });
    svg.appendChild(towerG);

    // the national reference sheet: a ghost of the country floating at the national figure,
    // drawn over the towers so it reads as a level rather than as a selection box
    var natFill = el('use', { fill: '#1C5BB8', 'fill-opacity': '.17', class: 'lsc-nat-sheet' });
    natFill.setAttribute('href', '#lscLand');
    var natEdge = el('use', { fill: 'none', stroke: '#1C5BB8', 'stroke-opacity': '.26', 'stroke-width': '1',
      'stroke-dasharray': '5 5', 'vector-effect': 'non-scaling-stroke', class: 'lsc-nat-sheet' });
    natEdge.setAttribute('href', '#lscLand');
    svg.appendChild(natFill);
    svg.appendChild(natEdge);

    var dropG = el('g', { class: 'lsc-drop' });
    var dropLine = el('line', { 'stroke-width': '1.4', 'stroke-dasharray': '5 4',
      'vector-effect': 'non-scaling-stroke' });
    var dropDot = el('circle', { r: '4.5' });
    dropG.appendChild(dropLine);
    dropG.appendChild(dropDot);
    dropG.style.display = 'none';
    svg.appendChild(dropG);

    // The SVG and the things that float over it share one box, so the percentage positions
    // used by the hover card and the national tag always resolve against the drawing itself
    // and not against whatever else is sitting in the map panel.
    var canvas = document.createElement('div');
    canvas.className = 'lsc-canvas';
    stage.insertBefore(canvas, stage.firstChild);
    canvas.appendChild(svg);
    ['#lsc-nat', '#lsc-card', '#lsc-status'].forEach(function (sel) {
      var n = qs(sel);
      if (n) canvas.appendChild(n);
    });

    // ---------- the pieces of chrome around it ----------
    var natTag = qs('#lsc-nat'), natVal = qs('#lsc-nat-val');
    var card = qs('#lsc-card');
    var rankBox = qs('#lsc-rank');
    var yearInput = qs('#lsc-year'), yearVal = qs('#lsc-year-val');
    var playBtn = qs('#lsc-play');
    var fsBtn = qs('#lsc-fs'), natNote = qs('#lsc-natnote');
    var titleEl = qs('#lsc-title'), domainEl = qs('#lsc-domain'), unitEl = qs('#lsc-unit');
    var agencyEl = qs('#lsc-agency'), mockEl = qs('#lsc-mock'), descEl = qs('#lsc-desc');
    var goLink = qs('#lsc-go'), statusEl = qs('#lsc-status');

    // ============================================================
    // Motion
    // Every county has a displayed height that eases toward its target. The scale is fixed
    // across all years of an indicator, so scrubbing the years shows real change rather than
    // a rescaled picture each frame.
    // ============================================================
    var anim = {};   // county -> { from, to, t0, dur, cur, lift, liftTo }
    GEO.forEach(function (g) { anim[g.name] = { from: 0, to: 0, t0: 0, dur: 0, cur: 0, lift: 0, liftTo: 0 }; });
    var raf = 0, natCur = 0, natTo = 0, settleTimer = 0;

    // requestAnimationFrame does not fire in every embedding context (a background tab, an
    // embedded preview). The animation is decoration; the resting state is the content. So
    // every state change paints immediately, and a timer guarantees the final state even if
    // not a single frame is ever delivered.
    function settle() {
      GEO.forEach(function (g) {
        var a = anim[g.name];
        a.cur = a.to; a.lift = a.liftTo; a.dur = 0;
      });
      natCur = natTo;
      paint();
    }

    function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }

    function setTargets(dur, stagger) {
      var now = performance.now();
      if (REDUCED) { dur = 0; stagger = 0; }
      GEO.forEach(function (g, i) {
        var a = anim[g.name];
        var v = byYear[year] ? byYear[year][g.name] : undefined;
        a.from = a.cur;
        a.to = (v == null) ? 0 : heightOf(v);
        a.t0 = now + (stagger || 0) * i;
        a.dur = dur;
      });
      var nv = natByYear[year];
      natTo = (nv == null || !natIsLevel) ? 0 : heightOf(nv);
      paint();
      tick();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, (dur || 0) + (stagger || 0) * GEO.length + 420);
    }

    function heightOf(v) {
      if (scaleMax <= scaleBase) return 0;
      var t = (v - scaleBase) / (scaleMax - scaleBase);
      return Math.max(0, Math.min(1, t)) * HMAX;
    }

    function tick() {
      if (raf) return;
      raf = requestAnimationFrame(function step(now) {
        raf = 0;
        var busy = false;
        GEO.forEach(function (g) {
          var a = anim[g.name];
          if (a.dur > 0) {
            var t = (now - a.t0) / a.dur;
            if (t < 1) busy = true;
            a.cur = a.from + (a.to - a.from) * ease(t);
          } else {
            a.cur = a.to;
          }
          // the hover lift rides in the same loop
          if (Math.abs(a.lift - a.liftTo) > 0.2) { a.lift += (a.liftTo - a.lift) * 0.25; busy = true; }
          else a.lift = a.liftTo;
        });
        if (Math.abs(natCur - natTo) > 0.2) { natCur += (natTo - natCur) * 0.22; busy = true; }
        else natCur = natTo;
        paint();
        if (busy) tick();
      });
    }

    function paint() {
      var vals = byYear[year] || {};
      var active = hoverName || pinnedName;
      GEO.forEach(function (g) {
        var a = anim[g.name];
        var v = vals[g.name];
        var known = v != null;
        var t = known && scaleMax > scaleBase ? (v - scaleBase) / (scaleMax - scaleBase) : 0;
        var isSel = (g.name === hoverName || g.name === pinnedName);
        var col = isSel ? GOLD : rampRgb(t);

        // floor tile: a pale wash of the same value, so the map still works as a map when a
        // tall tower stands in front of a short one
        var tile = tiles[g.name];
        tile.setAttribute('fill', known ? shade(paler(col, 0.72), 1) : '#E8E6E1');
        tile.setAttribute('class', 'lsc-tile' + (known ? '' : ' is-nodata')
          + (isSel ? ' is-on' : (active ? ' is-dim' : '')));

        var tw = towers[g.name];
        if (!known || a.cur < 0.4) {
          tw.grp.setAttribute('hidden', 'hidden');
          tw.grp.setAttribute('aria-label', g.name + ': no value for ' + year + '.');
          return;
        }
        tw.grp.removeAttribute('hidden');
        var f = towerFaces(g, a.cur + a.lift);
        tw.fl.setAttribute('points', pts(f.faceL));
        tw.fr.setAttribute('points', pts(f.faceR));
        tw.tp.setAttribute('points', pts(f.top));
        // a fatter invisible quad so short towers are still easy to hit
        tw.hit.setAttribute('points', pts([
          [f.faceL[0][0] - 6, f.faceL[0][1] + 6], [f.faceR[1][0] + 6, f.faceR[1][1] + 6],
          [f.faceR[2][0] + 6, f.faceR[2][1] - 6], [f.faceL[3][0] - 6, f.faceL[3][1] - 6],
        ]));
        tw.fl.setAttribute('fill', shade(col, 0.70));
        tw.fr.setAttribute('fill', shade(col, 0.88));
        tw.tp.setAttribute('fill', shade(col, 1.15));
        tw.grp.setAttribute('class', 'lsc-tower' + (isSel ? ' is-on' : (active ? ' is-dim' : '')));
        tw.grp.setAttribute('aria-label', g.name + ': ' + fmtNum(v) + ' ' + (meta ? meta.unit : '') + ', ' + year + '.');
      });

      var y = -natCur;
      natFill.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')');
      natEdge.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')');
      var nv = natByYear[year];
      var showSheet = natIsLevel && nv != null;
      natFill.style.display = showSheet ? '' : 'none';
      natEdge.style.display = showSheet ? '' : 'none';
      if (!showSheet) { natTag.hidden = true; } else {
        natTag.hidden = false;
        natVal.textContent = fmtNum(nv) + (meta && meta.unit && meta.unit.indexOf('%') === 0 ? '%' : '');
        natTag.style.left = pctX(PLANE.maxX + 8) + '%';
        natTag.style.top = pctY(PLANE.maxY - natCur) + '%';
      }
      paintDrop(active, vals);
      placeCard();
    }

    // A dashed plumb line from the apex to the floor. It reads as depth, and it says which
    // tile the tower actually belongs to when towers overlap.
    function paintDrop(active, vals) {
      if (!active || vals[active] == null) { dropG.style.display = 'none'; return; }
      var g = null;
      for (var i = 0; i < GEO.length; i++) if (GEO[i].name === active) { g = GEO[i]; break; }
      if (!g) { dropG.style.display = 'none'; return; }
      var a = anim[active];
      var fc = towerFaces(g, a.cur + a.lift);
      dropG.style.display = '';
      dropLine.setAttribute('x1', fc.apex[0].toFixed(1));
      dropLine.setAttribute('y1', fc.apex[1].toFixed(1));
      dropLine.setAttribute('x2', g.base[g.fi][0].toFixed(1));
      dropLine.setAttribute('y2', (g.base[g.fi][1] + 13).toFixed(1));
      dropDot.setAttribute('cx', fc.apex[0].toFixed(1));
      dropDot.setAttribute('cy', fc.apex[1].toFixed(1));
    }

    // Tighten the frame to the tallest thing this indicator actually draws, so the country
    // fills the panel instead of floating under a band of empty sky.
    function fitView() {
      var top = PLANE.minY;
      GEO.forEach(function (g) {
        var tallest = 0;
        years.forEach(function (y) {
          var v = (byYear[y] || {})[g.name];
          if (v != null) tallest = Math.max(tallest, heightOf(v));
        });
        top = Math.min(top, g.base[g.fi][1] - tallest);
      });
      if (natIsLevel) {
        var nh = 0;
        years.forEach(function (y) {
          if (natByYear[y] != null) nh = Math.max(nh, heightOf(natByYear[y]));
        });
        top = Math.min(top, PLANE.minY - nh);
      }
      top -= 30;                                   // room for the apex dot and the lift
      var bottom = PLANE.maxY + SLAB + 30;
      VB.y = top;
      VB.h = bottom - top;
      svg.setAttribute('viewBox',
        VB.x.toFixed(1) + ' ' + VB.y.toFixed(1) + ' ' + VB.w.toFixed(1) + ' ' + VB.h.toFixed(1));
    }

    // ============================================================
    // Analysis charts
    // They read the same byYear/natByYear the landscape draws from, so there is never a
    // version of the numbers on this page that disagrees with another.
    // ============================================================
    var POP = {};
    (state.counties || []).forEach(function (c) { POP[c.name] = c.population || 0; });
    var pairCode = '', pairData = null, pairMeta = null;

    function bundle() {
      return {
        names: GEO.map(function (g) { return g.name; }),
        byYear: byYear, natByYear: natByYear, years: years, year: year,
        pop: POP, unit: meta ? meta.unit : '', label: meta ? meta.name : '',
        focus: hoverName || pinnedName, natIsLevel: natIsLevel,
        domains: state.domains || [],
        x: pairData,
        onPick: function (n) { setPinned(n === pinnedName ? '' : n); },
      };
    }

    var CHART_IDS = ['motion', 'bump', 'cartogram', 'gap', 'readiness'];
    var drawTimer = 0;
    function drawCharts() {
      var C = window.LSC_CHARTS;
      if (!C) return;
      var d = bundle();
      CHART_IDS.forEach(function (id) {
        var host = qs('#lsc-an-' + id);
        if (!host || !C[id]) return;
        try {
          C[id](host, d);
        } catch (err) {
          host.innerHTML = '<p class="lsc-c-empty">This view could not be drawn for the current selection.</p>';
          if (window.console) console.error('NICTD chart ' + id + ':', err);
        }
      });
    }
    // The year scrubber and the play control fire fast; coalesce so a long run does not
    // redraw nine charts more often than a frame could show.
    function queueCharts() {
      clearTimeout(drawTimer);
      drawTimer = setTimeout(function () {
        if (typeof deckOpen !== 'undefined' && deckOpen) { deckDraw(); return; }
        drawCharts();
      }, 90);
    }

    function loadPair(c) {
      pairCode = c || '';
      if (!pairCode) { pairData = null; pairMeta = null; queueCharts(); return; }
      for (var i = 0; i < state.indicators.length; i++) {
        if (state.indicators[i].code === pairCode) { pairMeta = state.indicators[i]; break; }
      }
      fetch('/api/v1/data?indicator=' + encodeURIComponent(pairCode), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { data: [] }; })
        .then(function (payload) {
          if (pairCode !== (pairMeta && pairMeta.code)) return;
          var by = {};
          (payload.data || []).forEach(function (r) {
            var q = Number(r.value);
            if (!isFinite(q) || !r.county) return;
            (by[r.year] = by[r.year] || {})[r.county] = q;
          });
          pairData = {
            byYear: by, unit: pairMeta ? pairMeta.unit : '',
            label: pairMeta ? pairMeta.name : pairCode,
          };
          queueCharts();
        })
        .catch(function () { pairData = null; queueCharts(); });
    }

    function pctX(x) { return ((x - VB.x) / VB.w * 100).toFixed(2); }
    function pctY(y) { return ((y - VB.y) / VB.h * 100).toFixed(2); }

    // ============================================================
    // The hover / selected card
    // ============================================================
    function placeCard() {
      var name = hoverName || pinnedName;
      if (!name) { card.hidden = true; return; }
      var vals = byYear[year] || {};
      var v = vals[name];
      var g = GEO.filter(function (x) { return x.name === name; })[0];
      if (!g) { card.hidden = true; return; }
      var a = anim[name];
      var f = towerFaces(g, a.cur + a.lift);
      card.hidden = false;
      var left = parseFloat(pctX(f.apex[0])), top = parseFloat(pctY(f.apex[1]));
      card.classList.toggle('flip', left > 62);
      card.classList.toggle('flip-y', top < 30);
      card.style.left = left + '%';
      card.style.top = top + '%';
      var nv = natByYear[year];
      var cmp = '';
      if (v != null && nv != null && natIsLevel) {
        var d = v - nv;
        cmp = '<span class="lsc-card-cmp ' + (d >= 0 ? 'up' : 'down') + '">'
          + (d >= 0 ? '+' : '−') + fmtNum(Math.abs(d)) + ' vs national</span>';
      }
      card.innerHTML = '<h4>' + esc(name) + '</h4>'
        + (v == null
          ? '<p class="lsc-card-none">No value recorded for ' + year + '.</p>'
          : '<div class="lsc-card-v">' + fmtNum(v) + '</div>'
            + '<div class="lsc-card-u">' + esc(meta ? meta.unit : '') + ' &middot; ' + year + '</div>' + cmp);
    }

    function setHover(name) {
      if (hoverName === name) return;
      if (hoverName && anim[hoverName]) anim[hoverName].liftTo = 0;
      hoverName = name;
      if (name && anim[name]) anim[name].liftTo = 12;
      markRank();
      paint();
      tick();
      queueCharts();
    }
    function setPinned(name) {
      pinnedName = name;
      markRank();
      updateGo();
      paint();
      tick();
    }

    // ---------- pointer + keyboard on every tower and its tile ----------
    GEO.forEach(function (g) {
      var nodes = [towers[g.name].grp, tiles[g.name]];
      nodes.forEach(function (n) {
        n.addEventListener('pointerenter', function () { setHover(g.name); });
        n.addEventListener('pointerleave', function () { setHover(''); });
        n.addEventListener('click', function () { setPinned(g.name === pinnedName ? '' : g.name); });
      });
      var grp = towers[g.name].grp;
      grp.addEventListener('focus', function () { setHover(g.name); });
      grp.addEventListener('blur', function () { setHover(''); });
      grp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned(g.name); }
      });
    });

    // ============================================================
    // The ranked column beside the map
    // ============================================================
    function drawRank() {
      var vals = byYear[year] || {};
      var rows = GEO.map(function (g) { return { name: g.name, v: vals[g.name] }; })
        .sort(function (a, b) {
          if (a.v == null) return 1;
          if (b.v == null) return -1;
          return b.v - a.v;
        });
      rankBox.innerHTML = rows.map(function (r) {
        return '<div class="lsc-rank-row" data-county="' + esc(r.name) + '">'
          + '<span>' + esc(r.name) + '</span>'
          + '<span class="lsc-rank-v">' + (r.v == null ? '&mdash;' : fmtNum(r.v)) + '</span></div>';
      }).join('');
      Array.prototype.forEach.call(rankBox.children, function (row) {
        var nm = row.getAttribute('data-county');
        row.addEventListener('pointerenter', function () { setHover(nm); });
        row.addEventListener('pointerleave', function () { setHover(''); });
        row.addEventListener('click', function () { setPinned(nm === pinnedName ? '' : nm); });
      });
      markRank();
    }
    function markRank() {
      Array.prototype.forEach.call(rankBox.children, function (row) {
        var nm = row.getAttribute('data-county');
        row.classList.toggle('is-on', nm === hoverName || nm === pinnedName);
      });
    }
    function updateGo() {
      var qp = '/data?indicator=' + encodeURIComponent(code) + '&year=' + year
        + (pinnedName ? '&focus=' + encodeURIComponent(pinnedName) : '');
      goLink.setAttribute('href', qp);
      goLink.textContent = pinnedName
        ? 'Open ' + pinnedName + ' in Data Explorer'
        : 'Open in Data Explorer';
    }

    // ============================================================
    // Loading an indicator
    // ============================================================
    function setData(payload) {
      byYear = {}; natByYear = {}; years = [];
      var lo = Infinity, hi = -Infinity;
      (payload.data || []).forEach(function (r) {
        var v = Number(r.value);
        if (!isFinite(v)) return;
        if (r.county) {
          if (!byYear[r.year]) byYear[r.year] = {};
          byYear[r.year][r.county] = v;
          // Only county values set the height scale. For count indicators (persons, jobs,
          // towers) the national row is a TOTAL, larger than any single county; letting it
          // into the scale flattens every tower to a stub and parks the reference sheet at
          // the ceiling, which is what it used to do.
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        } else {
          natByYear[r.year] = v;
        }
        if (years.indexOf(r.year) === -1) years.push(r.year);
      });
      years.sort(function (a, b) { return a - b; });
      // The height scale is fixed across every year of this indicator. If it were recomputed
      // per year the towers would rescale as you scrub and the motion would be a lie.
      scaleBase = Math.min(0, lo === Infinity ? 0 : lo);
      scaleMax = hi === -Infinity ? 1 : hi;
      if (scaleMax <= scaleBase) scaleMax = scaleBase + 1;
      // A national figure can be drawn as a level only when it behaves like one. A weighted
      // average never exceeds its largest county; a total always does. Where it is a total,
      // a reference sheet would be a height no county could reach and a "vs national"
      // comparison would be meaningless, so neither is offered.
      natIsLevel = years.every(function (y) {
        var n = natByYear[y];
        if (n == null) return true;
        var vals = byYear[y] || {}, mx = -Infinity, k;
        for (k in vals) if (vals[k] > mx) mx = vals[k];
        return mx === -Infinity || n <= mx;
      });
    }

    function paintNatNote() {
      if (!natNote) return;
      var nv = natByYear[year];
      if (nv == null) { natNote.hidden = true; return; }
      natNote.hidden = false;
      var unit = meta && meta.unit ? meta.unit : '';
      natNote.innerHTML = '<i>' + (natIsLevel ? 'National figure' : 'National total') + '</i>'
        + '<b>' + esc(fmtNum(nv)) + '</b><span>' + esc(unit) + '</span>';
    }

    function applyMeta(m) {
      meta = m;
      titleEl.textContent = m.name;
      domainEl.textContent = m.domainLabel || m.domain || '';
      unitEl.textContent = m.unit || '';
      agencyEl.textContent = m.agency || 'n/a';
      descEl.textContent = m.description || '';
      mockEl.hidden = !m.is_mock;
      document.title = m.name + ' · Data Landscape · NIIP';
    }

    function syncYearInput() {
      if (!years.length) return;
      yearInput.min = String(years[0]);
      yearInput.max = String(years[years.length - 1]);
      if (years.indexOf(year) === -1) year = years[years.length - 1];
      yearInput.value = String(year);
      yearVal.textContent = String(year);
    }

    var loadToken = 0;
    function load(opts) {
      opts = opts || {};
      var mine = ++loadToken;
      statusEl.textContent = 'Loading…';
      stage.classList.add('is-loading');
      var m = null;
      for (var i = 0; i < state.indicators.length; i++) {
        if (state.indicators[i].code === code) { m = state.indicators[i]; break; }
      }
      if (m) applyMeta(m);
      fetch('/api/v1/data?indicator=' + encodeURIComponent(code), { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (payload) {
          if (mine !== loadToken) return;
          setData(payload);
          if (!years.length) {
            statusEl.textContent = 'No figures are recorded for this indicator yet.';
            stage.classList.remove('is-loading');
            byYear = {}; natByYear = {};
            setTargets(0, 0); drawRank();
            return;
          }
          syncYearInput();
          fitView();
          stage.classList.remove('is-loading');
          statusEl.textContent = '';
          drawRank();
          paintNatNote();
          updateGo();
          queueCharts();
          setTargets(opts.quick ? 260 : 760, opts.quick ? 0 : 42);
          pushUrl();
        })
        .catch(function (err) {
          if (mine !== loadToken) return;
          stage.classList.remove('is-loading');
          statusEl.textContent = 'Could not load this indicator (' + err.message
            + '). The same figures are in the Data Explorer.';
        });
    }

    function pushUrl() {
      if (!window.history || !history.replaceState) return;
      var u = '/landscape?indicator=' + encodeURIComponent(code) + '&year=' + year;
      history.replaceState(null, '', u);
    }

    // ============================================================
    // Controls
    // ============================================================
    var indicatorItems = state.indicators.map(function (i) {
      return { value: i.code, label: i.name, group: i.domainLabel };
    });
    var indDD = N.initDropdown(qs('#dd-lsc-indicator'), {
      items: indicatorItems, placeholder: 'Select an indicator', selected: code,
      onChange: function (v) { code = v; pinnedName = ''; syncCategory(); load({}); },
    });

    // Category narrows what the Indicator field offers, the same relationship the Data
    // Explorer uses, so the two pages behave identically.
    var catNames = [];
    indicatorItems.forEach(function (it) {
      if (it.group && catNames.indexOf(it.group) === -1) catNames.push(it.group);
    });
    catNames.sort();
    var ALL = '';
    var catDD = N.initDropdown(qs('#dd-lsc-category'), {
      items: [{ value: ALL, label: 'All categories', group: '' }]
        .concat(catNames.map(function (c) { return { value: c, label: c, group: '' }; })),
      placeholder: 'All categories', selected: ALL,
      onChange: function (v) {
        var list = v ? indicatorItems.filter(function (it) { return it.group === v; }) : indicatorItems;
        indDD.setItems(list);
        if (v && list.length && !list.some(function (it) { return it.value === code; })) {
          code = list[0].value;
          indDD.setSelected(code);
          pinnedName = '';
          load({});
        }
      },
    });
    function syncCategory() {
      var m = null;
      for (var i = 0; i < indicatorItems.length; i++) {
        if (indicatorItems[i].value === code) { m = indicatorItems[i]; break; }
      }
      if (!m) return;
      catDD.setSelected(m.group);
      indDD.setItems(indicatorItems.filter(function (it) { return it.group === m.group; }));
    }

    yearInput.addEventListener('input', function () {
      year = Number(yearInput.value);
      yearVal.textContent = String(year);
      stopPlay();
      drawRank();
      paintNatNote();
      updateGo();
      queueCharts();
      setTargets(220, 0);
      pushUrl();
    });

    // ---------- play through the years ----------
    var playTimer = 0;
    function stopPlay() {
      if (!playTimer) return;
      clearInterval(playTimer); playTimer = 0;
      playBtn.classList.remove('is-playing');
      playBtn.setAttribute('aria-label', 'Play through the years');
      playBtn.querySelector('span').textContent = 'Play years';
    }
    function startPlay() {
      if (!years.length) return;
      playBtn.classList.add('is-playing');
      playBtn.setAttribute('aria-label', 'Stop playing through the years');
      playBtn.querySelector('span').textContent = 'Stop';
      var i = years.indexOf(year);
      playTimer = setInterval(function () {
        i = (i + 1) % years.length;
        year = years[i];
        yearInput.value = String(year);
        yearVal.textContent = String(year);
        drawRank();
        paintNatNote();
        updateGo();
        queueCharts();
        setTargets(560, 0);
      }, 900);
    }
    playBtn.addEventListener('click', function () {
      if (playTimer) stopPlay(); else startPlay();
    });
    // a background tab should not keep stepping
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopPlay(); });

    // ============================================================
    // The deck: one full-screen surface holding every visual on the page. The map is the
    // first slide and the nine charts follow, so you can finish with the map and keep going
    // rather than closing and reopening something else.
    //
    // Slides are MOVED into the deck and put back afterwards, never copied: the map carries
    // live listeners and the charts are redrawn against the same data, so a copy would go
    // stale the moment the year changed.
    // ============================================================
    var deck = qs('#lsc-deck'), deckBody = qs('#lsc-deck-body');
    var deckTitle = qs('#lsc-deck-title'), deckN = qs('#lsc-deck-n');
    var deckDots = qs('#lsc-deck-dots'), deckPlay = qs('#lsc-deck-play');
    var cmdBar = qs('.lsc-cmd'), cmdHome = null, cmdNext = null;

    function dockCmd(on) {
      if (!cmdBar || !deck) return;
      if (on) {
        if (cmdHome) return;
        cmdHome = cmdBar.parentNode;
        cmdNext = cmdBar.nextSibling;
        cmdBar.classList.add('is-docked');
        deck.insertBefore(cmdBar, deck.firstChild);
      } else if (cmdHome) {
        cmdBar.classList.remove('is-docked');
        cmdHome.insertBefore(cmdBar, cmdNext);
        cmdHome = null; cmdNext = null;
      }
    }

    var SLIDES = [{ id: 'map', node: canvas }];
    CHART_IDS.forEach(function (id) {
      var h = qs('#lsc-an-' + id);
      if (h) SLIDES.push({ id: id, node: h });
    });
    function slideTitle(s) {
      if (s.id === 'map') return (meta ? meta.name : 'Data Landscape') + ' · the landscape';
      var b = qs('#lsc-card-' + s.id + ' figcaption b');
      return b ? b.textContent : s.id;
    }

    var deckOpen = false, deckIdx = 0, slNode = null, slHome = null, slNext = null;
    function returnSlide() {
      if (slNode && slHome) slHome.insertBefore(slNode, slNext);
      slNode = null; slHome = null; slNext = null;
    }
    function deckDraw() {
      var s = SLIDES[deckIdx];
      if (!s || !deckOpen) return;
      if (s.id === 'map') { paint(); return; }
      var C = window.LSC_CHARTS;
      if (C && C[s.id]) {
        try { C[s.id](s.node, bundle()); }
        catch (err) { s.node.innerHTML = '<p class="lsc-c-empty">This view could not be drawn.</p>'; }
      }
    }
    function deckGo(i) {
      if (!SLIDES.length || !deck) return;
      returnSlide();
      deckIdx = ((i % SLIDES.length) + SLIDES.length) % SLIDES.length;
      var s = SLIDES[deckIdx];
      slNode = s.node; slHome = s.node.parentNode; slNext = s.node.nextSibling;
      deckBody.appendChild(s.node);
      if (deckTitle) deckTitle.textContent = slideTitle(s);
      if (deckN) deckN.textContent = (deckIdx + 1) + ' / ' + SLIDES.length;
      if (deckDots) {
        Array.prototype.forEach.call(deckDots.children, function (dot, k) {
          dot.classList.toggle('is-on', k === deckIdx);
          dot.setAttribute('aria-current', k === deckIdx ? 'true' : 'false');
        });
      }
      // let the slide take its new size before the chart measures it
      setTimeout(deckDraw, 60);
    }

    var deckTimer = 0;
    function deckStopPlay() {
      clearTimeout(deckTimer); deckTimer = 0;
      if (!deckPlay) return;
      deckPlay.classList.remove('is-playing');
      var s = deckPlay.querySelector('span');
      if (s) s.textContent = 'Play all';
    }
    function deckStartPlay() {
      if (!deckPlay) return;
      deckPlay.classList.add('is-playing');
      var sp = deckPlay.querySelector('span');
      if (sp) sp.textContent = 'Stop';
      (function step() {
        deckTimer = setTimeout(function () {
          if (!deckOpen) { deckStopPlay(); return; }
          deckGo(deckIdx + 1);
          step();
        }, 6500);
      })();
    }

    function deckSet(on, i) {
      if (!deck) return;
      deckOpen = on;
      deck.hidden = !on;
      document.body.classList.toggle('lsc-locked', on);
      dockCmd(on);
      if (on) { deckGo(i || 0); }
      else { deckStopPlay(); returnSlide(); paint(); queueCharts(); }
    }

    if (deckDots) {
      SLIDES.forEach(function (s, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'lsc-deck-dot';
        dot.setAttribute('aria-label', 'Go to ' + slideTitle(s));
        dot.addEventListener('click', function () { deckStopPlay(); deckGo(i); });
        deckDots.appendChild(dot);
      });
    }
    var prevBtn = qs('#lsc-deck-prev'), nextBtn = qs('#lsc-deck-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { deckStopPlay(); deckGo(deckIdx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { deckStopPlay(); deckGo(deckIdx + 1); });
    var closeBtn = qs('#lsc-deck-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { deckSet(false); });
    if (deckPlay) deckPlay.addEventListener('click', function () {
      if (deckTimer) deckStopPlay(); else deckStartPlay();
    });
    if (fsBtn) fsBtn.addEventListener('click', function () { deckSet(true, 0); });

    document.addEventListener('keydown', function (e) {
      if (!deckOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); deckSet(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); deckStopPlay(); deckGo(deckIdx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); deckStopPlay(); deckGo(deckIdx - 1); }
    });
    // a hidden tab should not keep walking the deck
    document.addEventListener('visibilitychange', function () { if (document.hidden) deckStopPlay(); });

    // ---------- the second indicator for the motion scatter ----------
    var pairDD = N.initDropdown(qs('#dd-lsc-pair'), {
      items: [{ value: '', label: 'None', group: '' }].concat(indicatorItems),
      placeholder: 'Choose a second indicator', selected: '',
      onChange: function (val) { loadPair(val); },
    });
    // A sensible default: the first indicator from a different domain, so the scatter opens
    // showing a real relationship rather than an empty panel.
    (function () {
      var mine = null, i;
      for (i = 0; i < indicatorItems.length; i++) {
        if (indicatorItems[i].value === code) { mine = indicatorItems[i].group; break; }
      }
      for (i = 0; i < indicatorItems.length; i++) {
        if (indicatorItems[i].group !== mine) {
          pairDD.setSelected(indicatorItems[i].value);
          loadPair(indicatorItems[i].value);
          return;
        }
      }
    })();

    var rsTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rsTimer);
      rsTimer = setTimeout(drawCharts, 220);
    });

    // Every card's expand opens the same deck, at that card's slide.
    Array.prototype.forEach.call(document.querySelectorAll('.lsc-an-fs'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-fs'), i = 0;
        SLIDES.forEach(function (s, k) { if (s.id === id) i = k; });
        deckSet(true, i);
      });
    });

    syncCategory();
    load({});
  }

  // app.js may still be parsing; poll briefly rather than failing silently.
  var tries = 0;
  function start() {
    if (bindToolkit()) { boot(); return; }
    if (++tries > 60) { console.error('NICTD: shared toolkit (app.js) never loaded; Data Landscape disabled.'); return; }
    setTimeout(start, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
