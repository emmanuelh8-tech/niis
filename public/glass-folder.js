/* Glass Folder: a folder you can actually use, drawn as an object. A port, to plain JavaScript, of the
   owner's React component (glass-folder-cards.tsx); the site has no React, so the same layers, geometry,
   artwork and motion are built here with the DOM. Three layers, back to front: a back panel holding a
   generated artwork, the files the folder holds, and a frosted-glass front panel that blurs whatever sits
   behind it. Hover or focus leans the glass toward you on its bottom hinge; a click (Enter, Space) opens
   it and the files rise out and fan, each a button. Escape or a press outside closes it.
   (The React version's "add a file" key and its menu are not ported: the site does not use them.)

   window.GlassFolder.mount(element, {
     label, meta, tone: 'light' | 'dark', art: preset name | recipe | 'none', seed, image,
     files: [{ name, meta, image, art }], labelPlacement: 'bottom-left' | 'top-left' | 'top-right',
     width (px; everything scales with it), maxVisible, sheetHeight (px, of 272 wide), appear, appearDelay,
     keepOpenWhile() (true while something above the folder, a viewer, has taken over),
     onFileSelect(file, index, element), onOpenChange(open)
   }) -> { setWidth(px), setOpen(bool), root } */
(function () {
  'use strict';

  // ---- the artwork: domain-warped noise shaded as a liquid surface --------------------------------
  var ART_PRESETS = {
    aurora: { style: 'streak', colors: ['#f4efe9', '#e9c2b8', '#c2433f', '#2a1e2a', '#22395e', '#6f97c2', '#e5edf4'], scale: 0.7, warp: 1.4, angle: -0.62, gloss: 0.18, veins: 0 },
    ember: { style: 'marble', colors: ['#07090c', '#16252c', '#3d5f68', '#1a1416', '#a3201a', '#ef4a2b', '#ff8a5c'], scale: 0.62, warp: 3.2, angle: -0.5, gloss: 0.55, veins: 0.6 },
    dusk: { style: 'marble', colors: ['#120c18', '#3e2850', '#8f6c9c', '#2b1a24', '#b3502f', '#eab08a', '#fbe7d2'], scale: 0.75, warp: 3.6, angle: 0.8, gloss: 0.5, veins: 0.5 },
    glacier: { style: 'streak', colors: ['#f7f8fa', '#d9e2ea', '#9fb4c7', '#e8edf2', '#bccbd8', '#ffffff'], scale: 0.7, warp: 1.6, angle: 0.35, gloss: 0.25, veins: 0 },
    verdant: { style: 'marble', colors: ['#070b08', '#173024', '#4f7a5a', '#141812', '#a7843a', '#e9cf87', '#fbf3d6'], scale: 0.7, warp: 3.4, angle: 2.1, gloss: 0.5, veins: 0.5 },
  };
  function hexToRgb(hex) {
    var h = String(hex).trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : 0x808080;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  // seeded gradient noise, summed into fractal octaves with a rotation between each
  function makeFbm(seed) {
    var r = rng(seed), perm = new Uint8Array(512), grad = new Float32Array(512), p = [], i;
    for (i = 0; i < 256; i++) p.push(i);
    for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
    for (i = 0; i < 256; i++) { var a = r() * Math.PI * 2; grad[i * 2] = Math.cos(a); grad[i * 2 + 1] = Math.sin(a); }
    function noise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
      var h00 = perm[X + perm[Y]] * 2, h10 = perm[X + 1 + perm[Y]] * 2, h01 = perm[X + perm[Y + 1]] * 2, h11 = perm[X + 1 + perm[Y + 1]] * 2;
      var d00 = grad[h00] * xf + grad[h00 + 1] * yf, d10 = grad[h10] * (xf - 1) + grad[h10 + 1] * yf;
      var d01 = grad[h01] * xf + grad[h01 + 1] * (yf - 1), d11 = grad[h11] * (xf - 1) + grad[h11 + 1] * (yf - 1);
      var u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      return d00 + u * (d10 - d00) + v * (d01 - d00 + u * (d11 - d01 - d10 + d00));
    }
    return function (x, y, octaves) {
      var sum = 0, amp = 0.5;
      for (var k = 0; k < octaves; k++) { sum += amp * noise(x, y); var nx = 1.6 * x + 1.2 * y + 7.1; y = -1.2 * x + 1.6 * y + 3.3; x = nx; amp *= 0.5; }
      return sum;
    };
  }
  // the artwork as a job spread over frames: a field warped twice, normalised by its own percentiles,
  // then lit as the height of a liquid surface (slope -> normal -> diffuse light and a tight specular)
  function createArtJob(width, height, recipe, seed) {
    var w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
    var colors = recipe.colors.length >= 2 ? recipe.colors : ['#111111', '#eeeeee'];
    var stops = colors.map(function (c, i) { return { t: i / (colors.length - 1), c: hexToRgb(c) }; });
    var scale = recipe.scale == null ? 0.7 : recipe.scale, warp = recipe.warp == null ? 3 : recipe.warp;
    var gloss = recipe.gloss == null ? 0.4 : recipe.gloss, veins = recipe.veins || 0, streak = recipe.style === 'streak';
    var fbm = makeFbm(seed * 977 + 13), r = rng(seed + 1), ox = r() * 50, oy = r() * 50;
    var angle = (recipe.angle || 0) + (r() - 0.5) * 0.5, ca = Math.cos(angle), sa = Math.sin(angle), m = Math.min(w, h);
    var gw = Math.ceil(w / 2) + 3, gh = Math.ceil(h / 2) + 3;
    var G = new Float32Array(gw * gh), GQ = new Float32Array(gw * gh), F = new Float32Array(w * h), Q = new Float32Array(w * h);
    var pixels = new Uint8ClampedArray(w * h * 4), row = 0;
    function field(gy) {
      for (var gx = 0; gx < gw; gx++) {
        var u = ((gx - 1) * 2 - w / 2) / m, v = ((gy - 1) * 2 - h / 2) / m;
        var px = (u * ca - v * sa) * scale, py = (u * sa + v * ca) * scale;
        if (streak) { px *= 0.14; py *= 2.2; }
        px += ox; py += oy;
        var qx = fbm(px, py, 3), qy = fbm(px + 5.2, py + 1.3, 3);
        var rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2, 3), ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8, 3);
        G[gy * gw + gx] = fbm(px + warp * rx, py + warp * ry, 4);
        GQ[gy * gw + gx] = Math.sqrt(qx * qx + qy * qy);
      }
    }
    function upsample() {
      var cr = function (a, b, c, d) { return (-a + 9 * b + 9 * c - d) / 16; }, T = new Float32Array(w * gh), x, y;
      for (var gy = 0; gy < gh; gy++) {
        var rr = gy * gw;
        for (x = 0; x < w; x++) { var c = (x >> 1) + 1; T[gy * w + x] = x & 1 ? cr(G[rr + c - 1], G[rr + c], G[rr + c + 1], G[rr + c + 2]) : G[rr + c]; }
      }
      for (y = 0; y < h; y++) {
        var cy = (y >> 1) + 1;
        for (x = 0; x < w; x++) {
          F[y * w + x] = y & 1 ? cr(T[(cy - 1) * w + x], T[cy * w + x], T[(cy + 1) * w + x], T[(cy + 2) * w + x]) : T[cy * w + x];
          var gx = (x >> 1) + 1, q0 = GQ[cy * gw + gx], qxv = x & 1 ? (q0 + GQ[cy * gw + gx + 1]) / 2 : q0;
          var q1 = y & 1 ? (x & 1 ? (GQ[(cy + 1) * gw + gx] + GQ[(cy + 1) * gw + gx + 1]) / 2 : GQ[(cy + 1) * gw + gx]) : qxv;
          Q[y * w + x] = (qxv + q1) / 2;
        }
      }
    }
    function colorize() {
      var sample = [], stride = Math.max(1, Math.floor(F.length / 4096)), i;
      for (i = 0; i < F.length; i += stride) sample.push(F[i]);
      sample.sort(function (a, b) { return a - b; });
      var lo = sample[Math.floor(sample.length * 0.02)], hi = sample[Math.floor(sample.length * 0.98)], k = 1 / (hi - lo || 1);
      var lx = -0.55, ly = -0.65, lz = 0.52, slope = k * m * 0.012;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          i = y * w + x;
          var t = (F[i] - lo) * k; t = t < 0 ? 0 : t > 1 ? 1 : t;
          var j = 1;
          while (j < stops.length - 1 && stops[j].t < t) j++;
          var a = stops[j - 1], b = stops[j], f = (t - a.t) / (b.t - a.t || 1);
          f = f < 0 ? 0 : f > 1 ? 1 : f; f = f * f * (3 - 2 * f);
          var gx = (F[x < w - 1 ? i + 1 : i] - F[x > 0 ? i - 1 : i]) * slope, gy = (F[y < h - 1 ? i + w : i] - F[y > 0 ? i - w : i]) * slope;
          var nd = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1);
          var spec = Math.pow(nd > 0 ? nd : 0, 24) * gloss * 255, silk = 1 + 0.035 * Math.sin(t * 150 + Q[i] * 24);
          var vein = veins * Math.max(0, 1 - Math.abs(Q[i] - 0.42) * 14) * 0.6, lit = (0.82 + 0.28 * nd) * silk * (1 - vein);
          pixels[i * 4] = (a.c[0] + (b.c[0] - a.c[0]) * f) * lit + spec;
          pixels[i * 4 + 1] = (a.c[1] + (b.c[1] - a.c[1]) * f) * lit + spec;
          pixels[i * 4 + 2] = (a.c[2] + (b.c[2] - a.c[2]) * f) * lit + spec;
          pixels[i * 4 + 3] = 255;
        }
      }
    }
    return {
      width: w, height: h, pixels: pixels,
      step: function (rows) {
        if (row >= gh) return true;
        var end = Math.min(gh, row + Math.max(1, rows));
        while (row < end) field(row++);
        if (row < gh) return false;
        upsample(); colorize();
        return true;
      },
    };
  }
  // one shared painter: every folder queues its art here, and the queue spends a few ms a frame
  var artCache = {}, queue = [], pumping = false;
  function pump() {
    if (pumping) return;
    pumping = true;
    function tick() {
      var until = performance.now() + 7;
      while (queue.length && performance.now() < until) {
        var head = queue[0];
        if (head.job.step(4)) {
          queue.shift();
          var c = document.createElement('canvas');
          c.width = head.job.width; c.height = head.job.height;
          var cx = c.getContext('2d');
          if (cx) cx.putImageData(new ImageData(head.job.pixels, c.width, c.height), 0, 0);
          head.done(c);
        }
      }
      if (queue.length) requestAnimationFrame(tick); else pumping = false;
    }
    requestAnimationFrame(tick);
  }
  function paint(recipe, seed, w, h) {
    var key = JSON.stringify([recipe, seed, w, h]);
    if (!artCache[key]) artCache[key] = new Promise(function (done) { queue.push({ job: createArtJob(w, h, recipe, seed), done: done }); pump(); });
    return artCache[key];
  }
  function artCanvas(art, seed, w, h, density, cls) {
    var recipe = typeof art === 'string' ? ART_PRESETS[art] : art, c = document.createElement('canvas');
    c.className = cls; c.setAttribute('aria-hidden', 'true');
    c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.maxWidth = 'none';
    paint(recipe, seed, Math.round(w * density), Math.round(h * density)).then(function (src) {
      c.width = src.width; c.height = src.height;
      var cx = c.getContext('2d');
      if (cx) cx.drawImage(src, 0, 0);
      c.setAttribute('data-ready', '');
    });
    return c;
  }

  // ---- geometry, in the folder's own units: drawn at 340 x 272 and scaled to the width ------------
  var W = 340, H = 272, HEADROOM = 54, FRONT_TOP = 74, FRONT_H = H - FRONT_TOP;
  var BACK_PATH = 'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
  var FRONT_PATH = 'M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 ' + (FRONT_H - 22) +
    'A22 22 0 0 1 318 ' + FRONT_H + 'L22 ' + FRONT_H + 'A22 22 0 0 1 0 ' + (FRONT_H - 22) + 'Z';
  var SVGNS = 'http://www.w3.org/2000/svg', uidN = 0;
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    return e;
  }
  function fanSlot(index, count) { return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1; }

  function mount(host, o) {
    o = o || {};
    if (!document.getElementById('gf-css')) { var st = el('style', '', { id: 'gf-css' }); st.textContent = GF_CSS; document.head.appendChild(st); }
    var label = o.label || 'My Files', files = (o.files || []).slice(), count = files.length, uid = 'gf' + (++uidN);
    var tone = o.tone || 'light', art = o.art == null ? 'aurora' : o.art, seed = o.seed == null ? 3 : o.seed;
    var width = o.width || 340, maxVisible = o.maxVisible || 4, open = false;
    var k = width / W, density = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)) * k;

    var root = el('div', 'gf-root', { 'data-tone': tone, 'data-place': o.labelPlacement || 'bottom-left' });
    var stage = el('div', 'gf-stage'), tilt = el('div', 'gf-tilt');
    stage.appendChild(tilt); root.appendChild(stage);
    tilt.appendChild(el('div', 'gf-shadow', { 'aria-hidden': 'true' }));

    // the back panel and its artwork
    var back = el('div', 'gf-back', { 'aria-hidden': 'true' });
    back.style.clipPath = "path('" + BACK_PATH + "')";
    if (o.image) { var bi = el('img', 'gf-art', { src: o.image, alt: '', width: W + 24, height: H + 24, draggable: 'false' }); back.appendChild(bi); }
    else if (art !== 'none') back.appendChild(artCanvas(art, seed, W + 24, H + 24, density, 'gf-art'));
    back.appendChild(el('div', 'gf-back-sheen'));
    tilt.appendChild(back);
    var backRim = document.createElementNS(SVGNS, 'svg');
    backRim.setAttribute('class', 'gf-rim gf-back-rim'); backRim.setAttribute('viewBox', '0 0 ' + W + ' ' + H); backRim.setAttribute('aria-hidden', 'true');
    backRim.innerHTML = '<path d="' + BACK_PATH + '"/>';
    tilt.appendChild(backRim);

    // the frosted front panel, hinged on its bottom edge
    var front = el('div', 'gf-front');
    front.style.clipPath = "path('" + FRONT_PATH + "')";
    front.appendChild(el('div', 'gf-tint', { 'aria-hidden': 'true' }));
    front.appendChild(el('div', 'gf-spec', { 'aria-hidden': 'true' }));
    var frontRim = document.createElementNS(SVGNS, 'svg');
    frontRim.setAttribute('class', 'gf-rim gf-front-rim'); frontRim.setAttribute('viewBox', '0 0 ' + W + ' ' + FRONT_H); frontRim.setAttribute('aria-hidden', 'true');
    frontRim.innerHTML = '<defs><linearGradient id="' + uid + '-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/>' +
      '<stop offset="0.35" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0.12"/></linearGradient></defs>' +
      '<path d="' + FRONT_PATH + '" stroke="url(#' + uid + '-rim)"/>';
    front.appendChild(frontRim);
    var hit = el('button', 'gf-hit', { type: 'button', 'aria-expanded': 'false' });
    front.appendChild(hit);
    var lab = el('div', 'gf-label'), title = el('span', 'gf-title'), meta = el('span', 'gf-meta');
    title.textContent = label;
    meta.textContent = o.meta || count + (count === 1 ? ' item' : ' items');
    lab.appendChild(title); lab.appendChild(meta); front.appendChild(lab);
    tilt.appendChild(front);

    // the contents: after the glass in tab order, beneath it on screen
    var filesEl = el('div', 'gf-files', { role: 'list', 'aria-label': label + ' contents' });
    var start = Math.max(0, files.length - maxVisible), visible = files.slice(start);
    // a long stack rises no higher than four would
    if (o.sheetHeight) root.style.setProperty('--gf-sheet-h', o.sheetHeight + 'px');
    root.style.setProperty('--gf-dk', Math.min(1, 3 / Math.max(1, visible.length - 1)).toFixed(3));
    visible.forEach(function (file, v) {
      var slot = el('div', 'gf-sheet-slot', { role: 'listitem' });
      var jitter = rng(hashString(file.name) + start + v), picture = !!(file.art || file.image);
      var sheet = el(file.href ? 'a' : 'button', 'gf-sheet' + (picture ? ' gf-sheet--art' : ''), file.href ? { href: file.href } : { type: 'button' });
      sheet.style.setProperty('--gf-slot', fanSlot(v, visible.length));
      sheet.style.setProperty('--gf-depth', visible.length - 1 - v);
      sheet.style.setProperty('--gf-jx', ((jitter() - 0.5) * 10).toFixed(2) + 'px');
      sheet.style.setProperty('--gf-jr', ((jitter() - 0.5) * 3.2).toFixed(2) + 'deg');
      sheet.style.zIndex = v + 1;
      if (file.image) sheet.appendChild(el('img', 'gf-sheet-art', { src: file.image, alt: '', width: 272, height: 184, draggable: 'false', loading: 'lazy', decoding: 'async' }));
      else if (file.art) sheet.appendChild(artCanvas(file.art, hashString(file.name) % 997, 272, 184, Math.min(density, 1.25), 'gf-sheet-art'));
      else {
        var lines = el('span', 'gf-lines', { 'aria-hidden': 'true' });
        ['86%', '92%', '64%', '88%', '42%'].forEach(function (wd) { var i = el('i'); i.style.width = wd; lines.appendChild(i); });
        sheet.appendChild(lines);
      }
      var head = el('span', 'gf-sheet-head'), nm = el('span', 'gf-sheet-name');
      nm.textContent = file.name; head.appendChild(nm);
      if (file.meta) { var mt = el('span', 'gf-sheet-meta'); mt.textContent = file.meta; head.appendChild(mt); }
      sheet.appendChild(head);
      if (file.label) sheet.setAttribute('aria-label', file.label);
      sheet.addEventListener('click', function (e) { if (o.onFileSelect) { if (!file.href) e.preventDefault(); o.onFileSelect(file, start + v, sheet); } });
      slot.appendChild(sheet); filesEl.appendChild(slot);
    });
    tilt.appendChild(filesEl);

    function setOpen(next) {
      open = !!next;
      if (open) root.setAttribute('data-open', ''); else root.removeAttribute('data-open');
      hit.setAttribute('aria-expanded', String(open));
      hit.setAttribute('aria-label', (open ? 'Close ' : 'Open ') + label + ', ' + count + (count === 1 ? ' item' : ' items'));
      if (open) filesEl.removeAttribute('inert'); else filesEl.setAttribute('inert', '');
      if (o.onOpenChange) o.onOpenChange(open);
    }
    function setWidth(px) {
      width = px; k = width / W;
      root.style.width = width + 'px';
      root.style.height = (H + HEADROOM) * k + 'px';
      stage.style.transform = 'translateY(' + HEADROOM * k + 'px) scale(' + k + ')';
    }
    setWidth(width);
    setOpen(false);
    hit.addEventListener('click', function () { setOpen(!open); });

    // Escape and a press outside close it (unless something above it, a viewer, has taken over)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !open || e.defaultPrevented || (o.keepOpenWhile && o.keepOpenWhile())) return;
      setOpen(false); hit.focus();
    });
    document.addEventListener('pointerdown', function (e) {
      if (open && !root.contains(e.target) && !(o.keepOpenWhile && o.keepOpenWhile())) setOpen(false);
    });

    // light and parallax follow the pointer, through custom properties (no re-layout)
    var raf = 0, px = 0, py = 0;
    function write() { raf = 0; root.style.setProperty('--gf-px', px.toFixed(3)); root.style.setProperty('--gf-py', py.toFixed(3)); }
    root.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = root.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(write);
    });
    root.addEventListener('pointerleave', function () { px = 0; py = 0; if (!raf) raf = requestAnimationFrame(write); });

    // it assembles itself the first time it is on screen
    if (o.appear === false || !('IntersectionObserver' in window)) root.setAttribute('data-entered', '');
    else {
      var io = new IntersectionObserver(function (es) {
        if (!es.some(function (x) { return x.isIntersecting; })) return;
        io.disconnect();
        setTimeout(function () { root.setAttribute('data-entered', ''); }, o.appearDelay || 0);
      }, { threshold: 0.25 });
      io.observe(root);
    }
    host.appendChild(root);
    return { root: root, setWidth: setWidth, setOpen: setOpen, isOpen: function () { return open; } };
  }

  // the component's own styles, as in the React version (--gf-dk keeps a long stack from rising too high)
  var GF_CSS = [
    '.gf-root{--gf-px:0;--gf-py:0;--gf-dk:1;--gf-ease:cubic-bezier(.2,.8,.2,1);--gf-spring:cubic-bezier(.34,1.36,.5,1);--gf-hinge:0deg;--gf-lift:42px;--gf-spread:0px;--gf-fan:0deg;--gf-stack:15px;--gf-ink:#141416;--gf-ink-soft:rgba(20,20,22,.55);position:relative;display:inline-block;flex:none;vertical-align:top;font-family:var(--sans,ui-sans-serif),ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;isolation:isolate}',
    '.gf-root[data-tone="dark"]{--gf-ink:#f5f5f7;--gf-ink-soft:rgba(245,245,247,.58)}',
    '.gf-root:hover,.gf-root:focus-within{--gf-hinge:-11deg;--gf-lift:-34px;--gf-spread:8px;--gf-fan:1.4deg;--gf-stack:10px}',
    '.gf-root[data-open]{--gf-hinge:-24deg;--gf-lift:-96px;--gf-spread:40px;--gf-fan:5deg;--gf-stack:30px}',
    '.gf-stage{position:absolute;left:0;top:0;width:340px;height:272px;transform-origin:0 0}',
    '.gf-tilt{position:absolute;inset:0;transform:perspective(1400px) rotateX(calc(var(--gf-py) * -3deg)) rotateY(calc(var(--gf-px) * 4deg));transition:transform .9s var(--gf-ease)}',
    '.gf-shadow{position:absolute;left:18px;right:18px;bottom:-6px;height:60px;border-radius:40px;background:rgba(16,18,24,.34);filter:blur(22px);transform:translateX(calc(var(--gf-px) * -8px));transition:transform .9s var(--gf-ease),opacity .9s var(--gf-ease)}',
    '.gf-root[data-tone="dark"] .gf-shadow{background:rgba(0,0,0,.62)}',
    '.gf-back{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#f3f3f4 0%,#e3e3e6 100%)}',
    '.gf-root[data-tone="dark"] .gf-back{background:linear-gradient(180deg,#2a2a2e 0%,#121214 100%)}',
    '.gf-art{position:absolute;left:-12px;top:-12px;max-width:none;object-fit:cover;transform:translate(calc(var(--gf-px) * -7px),calc(var(--gf-py) * -6px)) scale(1.02);transition:transform 1.1s var(--gf-ease),opacity 1.2s var(--gf-ease),filter 1.2s var(--gf-ease)}',
    'canvas.gf-art{opacity:0;filter:blur(14px) saturate(.6)}canvas.gf-art[data-ready]{opacity:1;filter:none}',
    '.gf-back-sheen{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,0) 22%),radial-gradient(120% 80% at 80% 0%,rgba(255,255,255,.16),rgba(255,255,255,0) 60%);pointer-events:none}',
    '.gf-rim{position:absolute;left:0;top:0;max-width:none;overflow:visible;pointer-events:none;fill:none}',
    '.gf-back-rim{width:340px;height:272px}.gf-back-rim path{stroke:rgba(255,255,255,.45);stroke-width:1}.gf-root[data-tone="dark"] .gf-back-rim path{stroke:rgba(255,255,255,.16)}',
    '.gf-files{position:absolute;inset:0;z-index:5;pointer-events:none;clip-path:inset(-400px -400px 10px -400px)}',
    '.gf-sheet-slot{display:contents}',
    '.gf-sheet{all:unset;box-sizing:border-box;position:absolute;left:34px;top:96px;width:272px;height:var(--gf-sheet-h,184px);border-radius:16px;overflow:hidden;cursor:pointer;pointer-events:auto;background:linear-gradient(180deg,#fff 0%,#f2f2f0 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(0,0,0,.1),0 10px 26px -8px rgba(10,12,20,.28);transform-origin:50% 100%;transform:translate(calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)),calc(var(--gf-lift) + var(--gf-depth) * var(--gf-dk) * var(--gf-stack) * -1)) rotate(calc(var(--gf-jr) + var(--gf-slot) * var(--gf-fan)));transition:transform .75s var(--gf-spring) calc(var(--gf-depth) * 40ms),box-shadow .4s var(--gf-ease),translate .9s var(--gf-ease),opacity .9s var(--gf-ease)}',
    '.gf-root[data-tone="dark"] .gf-sheet{background:linear-gradient(180deg,#2c2c30 0%,#1c1c1f 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 0 .5px rgba(255,255,255,.08),0 12px 28px -8px rgba(0,0,0,.7)}',
    '.gf-sheet--art{background:#1a1a1d}',
    '.gf-root[data-open] .gf-sheet:hover,.gf-root[data-open] .gf-sheet:focus-visible{transform:translate(calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)),calc(var(--gf-lift) + var(--gf-depth) * var(--gf-dk) * var(--gf-stack) * -1 - 18px)) rotate(calc(var(--gf-slot) * var(--gf-fan) * .6));box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(0,0,0,.1),0 22px 40px -12px rgba(10,12,20,.42);transition-delay:0s}',
    '.gf-sheet:focus-visible{outline:2px solid #4c8dff;outline-offset:2px}',
    '.gf-sheet-art{position:absolute;left:0;top:0;width:100%;height:100%;max-width:none;object-fit:cover;transition:opacity .9s var(--gf-ease),filter .9s var(--gf-ease)}',
    'canvas.gf-sheet-art{opacity:0;filter:blur(10px)}canvas.gf-sheet-art[data-ready]{opacity:1;filter:none}',
    '.gf-sheet--art::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,0) 34%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);pointer-events:none}',
    '.gf-sheet-head{position:absolute;left:14px;right:14px;top:11px;z-index:1;display:flex;align-items:baseline;justify-content:space-between;gap:10px;white-space:nowrap}',
    '.gf-sheet-name{overflow:hidden;text-overflow:ellipsis;font-size:12.5px;font-weight:560;letter-spacing:-.005em;color:#18181b}',
    '.gf-sheet-meta{flex:none;font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;letter-spacing:.02em;color:rgba(24,24,27,.5)}',
    '.gf-root[data-tone="dark"] .gf-sheet-name,.gf-sheet--art .gf-sheet-name{color:#fafafa}',
    '.gf-root[data-tone="dark"] .gf-sheet-meta,.gf-sheet--art .gf-sheet-meta{color:rgba(250,250,250,.66)}',
    '.gf-lines{position:absolute;left:14px;right:14px;top:40px;display:flex;flex-direction:column;gap:9px}',
    '.gf-lines i{display:block;height:5px;border-radius:3px;background:rgba(24,24,27,.08)}.gf-lines i:first-child{height:9px;margin-bottom:4px;background:rgba(24,24,27,.14)}',
    '.gf-front{position:absolute;left:0;top:74px;width:340px;height:198px;z-index:10;-webkit-backdrop-filter:blur(22px) saturate(1.5);backdrop-filter:blur(22px) saturate(1.5);transform-origin:50% 100%;transform:perspective(760px) rotateX(var(--gf-hinge));transition:transform .8s var(--gf-spring),translate 1s var(--gf-ease),opacity 1s var(--gf-ease)}',
    '.gf-tint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.5) 42%,rgba(252,252,252,.93) 100%)}',
    '.gf-root[data-tone="dark"] .gf-tint{background:linear-gradient(180deg,rgba(18,18,20,.18) 0%,rgba(14,14,16,.62) 46%,rgba(8,8,10,.94) 100%)}',
    '.gf-spec{position:absolute;inset:0;background:radial-gradient(260px 200px at calc(50% + var(--gf-px) * 46%) calc(30% + var(--gf-py) * 40%),rgba(255,255,255,.5),rgba(255,255,255,0) 70%);mix-blend-mode:soft-light;opacity:.9;pointer-events:none}',
    '.gf-root[data-tone="dark"] .gf-spec{mix-blend-mode:screen;opacity:.16}',
    '.gf-front-rim{width:340px;height:198px}.gf-front-rim path{stroke-width:2.4;transition:stroke-width .3s var(--gf-ease)}.gf-root[data-tone="dark"] .gf-front-rim{opacity:.55}',
    '.gf-hit{all:unset;position:absolute;inset:0;z-index:1;cursor:pointer}',
    '.gf-hit:focus-visible~.gf-label .gf-title{text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:4px}',
    '.gf-front:has(.gf-hit:focus-visible) .gf-front-rim path{stroke-width:5}',
    '.gf-label{position:absolute;z-index:2;display:flex;flex-direction:column;gap:4px;max-width:240px;pointer-events:none;color:var(--gf-ink)}',
    '.gf-root[data-place="bottom-left"] .gf-label{left:28px;bottom:32px}.gf-root[data-place="top-left"] .gf-label{left:28px;top:34px}.gf-root[data-place="top-right"] .gf-label{right:32px;top:52px;align-items:flex-start}',
    '.gf-title{font-size:18px;font-weight:500;line-height:1.15;letter-spacing:-.012em}',
    '.gf-meta{font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;letter-spacing:.03em;color:var(--gf-ink-soft);white-space:nowrap}',
    '.gf-root:not([data-entered]) .gf-back,.gf-root:not([data-entered]) .gf-back-rim{translate:0 22px;opacity:0}',
    '.gf-root:not([data-entered]) .gf-sheet{translate:0 -120px;opacity:0}',
    '.gf-root:not([data-entered]) .gf-front{translate:0 46px;opacity:0}',
    '.gf-root:not([data-entered]) .gf-shadow{opacity:0}',
    '.gf-back,.gf-back-rim{transition:translate 1s var(--gf-ease),opacity .9s var(--gf-ease)}',
    '.gf-root[data-entered] .gf-sheet{transition-delay:calc(var(--gf-depth) * 40ms),0s,calc(.18s + var(--gf-depth) * 90ms),calc(.18s + var(--gf-depth) * 90ms)}',
    '.gf-root[data-entered] .gf-front{transition-delay:0s,.42s,.42s}',
    '@media (prefers-reduced-motion: reduce){.gf-root *,.gf-root *::before,.gf-root *::after{transition-duration:0s!important;transition-delay:0s!important;animation:none!important}.gf-tilt{transform:none}}',
  ].join('\n');

  window.GlassFolder = { mount: mount, presets: ART_PRESETS, createArtJob: createArtJob };
})();
