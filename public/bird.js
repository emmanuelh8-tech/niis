// The site's robot turaco, on every public page, on phones and desktops. On the home page it starts
// on the "Featured Research Papers" heading; elsewhere it flies in to the first place it can sit.
// It keeps the reader company down the page and back up again: each time they scroll it flies to
// another perch on screen (a heading, or the top of a card, a panel or a button), every flight by a
// different route. When the footer comes into view it lands there and rests until the reader scrolls
// back up.
//
// Sitting, it looks about like a curious bird (a turn of the head, a hold, a tilt to one eye). When
// the reader stops scrolling for ten seconds it does something of its own, never the same thing twice
// running: a pass across the screen and back, a visit to another heading, a hop along the letters, a
// loop, a dive toward the reader, a stretch, a song, a preen, a turn. It watches the mouse and jumps
// away if the cursor comes too close. If no heading is in view it flies past now and then.
//
// And there is a worm. Now and then it pokes out of the top of a card (or under one of the home
// carousels); the bird spots it and goes for it, and always misses, a different way each time (just
// too late, too far, a fly-over with the claws out, an overshoot, a decoy, a standoff). Often the
// worm pops back up behind its back.
//
// Perches are found on the page: h1 to h3 headings (the bird stands on a flat-topped capital on the
// first line, so it never covers a line) and cards, panels and buttons (it stands on the top edge).
// data-perch="start" | "final" mark where it begins and ends; data-no-perch keeps it off a region;
// data-worm marks the ground under a carousel. Never on admin pages, never under reduced motion, and
// only with WebGL. On phones a tap near it sends it off; with a mouse it watches the pointer.

const SMALL = matchMedia('(max-width: 760px)');
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
if (!REDUCE.matches && webgl && innerWidth >= 320 && !location.pathname.startsWith('/admin')) start().catch((e) => console.warn('robo turaco:', e));

async function start() {
  const THREE = await import('three');
  const v = new URL(import.meta.url).search;
  const [{ createRoboTuraco, studioEnvironment }, { createWorm }] = await Promise.all([import('./robo-turaco.js' + v), import('./worm.js' + v)]);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---- stage: one transparent canvas over the page, under the nav bar
  const canvas = document.createElement('canvas');
  canvas.className = 'robo-bird'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100vh;height:100lvh;pointer-events:none;z-index:80';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL.matches ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;                 // the worm is cut off at the ground line
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(THREE, renderer);
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x40362c, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(1.2, 2.2, 1.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec4ff, 1.1); rim.position.set(-1.5, 1.2, -1.6); scene.add(rim);
  const FOV = 30, D = 10;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40); camera.position.set(0, 0, D);
  const bird = createRoboTuraco(THREE);
  const root = bird.object;
  scene.add(root);
  const worm = createWorm(THREE);
  worm.object.visible = false;
  scene.add(worm.object);
  const BIRD_H = 0.5;                                   // the perched bird, feet to crest, in model units

  let W = 1, H = 1, s = 0.01, birdPx = 80;
  function resize() {
    // the bird's size is fixed by the large viewport, so the phone's address bar coming and going
    // never rescales it; only a real change (rotation, a resized window) does
    const w = innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === W && Math.abs(h - H) < 2) { perches.forEach((p) => { p.letter = null; }); return; }
    W = w; H = h;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    s = (2 * D * Math.tan((FOV * Math.PI) / 360)) / H;  // world units per pixel at the page plane
    birdPx = SMALL.matches ? clamp(W * 0.135, 46, 58) : clamp(H * 0.095, 66, 92);
    root.scale.setScalar((birdPx * s) / BIRD_H);
    worm.object.scale.copy(root.scale).multiplyScalar(1.25);   // a touch larger than life, so it reads
    perches.forEach((p) => { p.letter = null; });
  }
  const toWorld = (x, y, z = 0) => new THREE.Vector3((x - W / 2) * s * (D - z) / D, (H / 2 - y) * s * (D - z) / D, z);
  const toScreen = (q) => ({ x: W / 2 + q.x / (s * (D - q.z) / D), y: H / 2 - q.y / (s * (D - q.z) / D), z: q.z });

  // ---- perches on headings
  const FLAT = 'TEFHIDPBRLNMKZ';
  const meas = document.createElement('canvas').getContext('2d');
  const HEADS = 'h1, h2, h3, [data-perch]';
  const ITEMS = '.panel, .card, [class$="-card"], [class*="-card "], .lsc-map, .vid-frame, .dx-stat, .sp2-sheet, .btn, .rp-btn, .cs-btn';
  const NO = '.gov-nav, .nav-sheet, [data-no-perch], .hero-slider, #sqTrends, #rcStage, [data-ring], .prv, .lsc-deck, .dx-fs, .xdd-panel, .sp2-bar, .to-top, .lsc-card, dialog, [hidden]';
  const known = new WeakMap();
  let perches = [];
  function scan() {
    const list = [], seen = new Set();
    const add = (el, role) => {
      if (seen.has(el) || (el.closest(NO) && !el.hasAttribute('data-perch'))) return;
      seen.add(el);
      let p = known.get(el);
      if (!p) { p = { el, role, aim: role === 'item' ? rnd(0.22, 0.78) : 0.66, flip: false }; known.set(el, p); }
      list.push(p);
    };
    document.querySelectorAll(HEADS).forEach((el) => add(el, el.dataset.perch || 'perch'));
    document.querySelectorAll(ITEMS).forEach((el) => add(el, 'item'));
    perches = list;
  }
  scan();
  setInterval(scan, 1500);
  // the flat-topped capital on the heading's first line nearest p.aim of the way along
  function chooseLetter(p) {
    const cs = getComputedStyle(p.el);
    const upper = cs.textTransform === 'uppercase';
    const chars = []; let firstTop = null;
    const walker = document.createTreeWalker(p.el, NodeFilter.SHOW_TEXT);
    outer: for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (let i = 0; i < n.length; i++) {
        if (!n.data[i].trim()) continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
        const rect = r.getClientRects()[0]; if (!rect) continue;
        if (firstTop === null) firstTop = rect.top;
        if (Math.abs(rect.top - firstTop) > 3) break outer;
        const ch = upper ? n.data[i].toUpperCase() : n.data[i];
        chars.push({ node: n, i, ch, x: rect.left + rect.width / 2 });
      }
    }
    if (!chars.length) { p.letter = null; return; }
    const left = chars[0].x, right = chars[chars.length - 1].x, aim = left + (right - left) * p.aim;
    const flat = chars.filter((c) => FLAT.includes(c.ch));
    const c = (flat.length ? flat : chars).reduce((a, b) => (Math.abs(b.x - aim) < Math.abs(a.x - aim) ? b : a));
    meas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = meas.measureText(c.ch);
    p.letter = { node: c.node, i: c.i, ascent: m.fontBoundingBoxAscent, cap: m.actualBoundingBoxAscent };
    p.flatCount = flat.length;
  }
  // where the bird's feet go, in viewport pixels (null while the spot has no layout)
  function perchPoint(p) {
    if (p.point) return p.point();
    if (p.role === 'item') {
      // on the top edge of a card, panel or button, a little way along it
      const r = p.el.getBoundingClientRect();
      if (r.width < 70 || r.height < 34) return null;
      return { x: r.left + r.width * p.aim, y: r.top + 1, z: 0 };
    }
    if (!p.letter) chooseLetter(p);
    const L = p.letter; if (!L) return null;
    const r = document.createRange(); r.setStart(L.node, L.i); r.setEnd(L.node, L.i + 1);
    const rect = r.getClientRects()[0];
    if (!rect) { p.letter = null; return null; }
    return { x: rect.left + rect.width / 2, y: rect.top + L.ascent - L.cap + birdPx * 0.045, z: 0 };
  }
  const nav = document.querySelector('.gov-nav');
  const navBottom = () => (nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0);
  // a heading the bird can land on: below the nav with room for the bird, and not at the very bottom
  const inZone = (pt) => !!pt && pt.y > navBottom() + birdPx * 1.15 && pt.y < H * 0.9 && pt.x > 30 && pt.x < W - 30;
  const groundOK = (pt) => !!pt && pt.y > navBottom() + birdPx * 1.25 && pt.y < H - 34 && pt.x > 50 && pt.x < W - 50;
  const zoneOK = (p, pt) => (p.role === 'ground' ? groundOK(pt) : inZone(pt));
  const onScreen = (pt) => !!pt && pt.y > navBottom() + birdPx * 0.6 && pt.y < H + birdPx && pt.x > -40 && pt.x < W + 40;

  // ---- the worm's ground: just under each carousel marked data-worm
  const wormSpots = () => [...document.querySelectorAll('[data-worm]')].map((el) => ({ el, edge: 'bottom' }))
    .concat(perches.filter((p) => p.role === 'item' && !p.el.matches('.btn, .rp-btn, .cs-btn')).map((p) => ({ el: p.el, edge: 'top' })));
  const holePoint = (h) => {
    const r = h.el.getBoundingClientRect(); if (!r.width) return null;
    return { x: r.left + r.width * h.fx, y: h.edge === 'top' ? r.top + 1 : r.bottom + 26, z: 0 };
  };
  // a place on the ground beside a hole, offset px from it (negative = left of it)
  const groundPerch = (hole, offset) => ({ role: 'ground', hole, offset, point() { const h = holePoint(hole); return h && { x: h.x + offset, y: h.y, z: 0 }; } });
  function pickHole(avoid) {
    const opts = [];
    for (const sp of wormSpots()) for (let k = 0; k < 3; k++) {
      const h = { el: sp.el, edge: sp.edge, fx: rnd(0.15, 0.85) }, pt = holePoint(h);
      if (groundOK(pt) && (!avoid || Math.abs(pt.x - holePoint(avoid).x) > birdPx * 1.6)) opts.push(h);
    }
    return opts.length ? pick(opts) : null;
  }

  // ---- flight paths: a Catmull-Rom spline through screen-space waypoints, each with a depth (z)
  function spline(pts) {
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    const seg = (i, t) => {
      const [a, b, c, d] = [P[i], P[i + 1], P[i + 2], P[i + 3]];
      const f = (k) => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t);
      return { x: f('x'), y: f('y'), z: f('z') };
    };
    const n = pts.length - 1, lut = [{ d: 0, i: 0, t: 0 }];
    let d = 0, prev = seg(0, 0);
    for (let i = 0; i < n; i++) for (let k = 1; k <= 30; k++) {
      const q = seg(i, k / 30); d += Math.hypot(q.x - prev.x, q.y - prev.y); lut.push({ d, i, t: k / 30 }); prev = q;
    }
    return {
      len: d,
      at(dist) { // position at an arc length
        dist = clamp(dist, 0, d);
        let lo = 0, hi = lut.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lut[mid].d < dist) lo = mid; else hi = mid; }
        const A = lut[lo], B = lut[hi], f = B.d > A.d ? (dist - A.d) / (B.d - A.d) : 0;
        if (A.i === B.i) return seg(A.i, lerp(A.t, B.t, f));
        return seg(B.i, lerp(0, B.t, f));
      },
    };
  }
  const OFF = 110; // how far beyond the edge the bird goes to vanish
  const SIDES = ['left', 'right', 'topLeft', 'topRight'];
  const OPPOSITE = { left: 'right', right: 'left', topLeft: 'right', topRight: 'left' };
  function edgePoint(side) {
    const top = navBottom();
    if (side === 'left') return { x: -OFF, y: rnd(top + 60, H * 0.6), z: 0 };
    if (side === 'right') return { x: W + OFF, y: rnd(top + 60, H * 0.6), z: 0 };
    if (side === 'topLeft') return { x: rnd(-OFF, W * 0.2), y: -OFF, z: 0 };
    return { x: rnd(W * 0.8, W + OFF), y: -OFF, z: 0 };             // topRight
  }
  const topY = () => navBottom() + 130;
  // the routes: each returns the waypoints between the start (a) and the end (b)
  const ROUTES = {
    arc: (a, b) => [{ x: lerp(a.x, b.x, 0.5) + rnd(-80, 80), y: Math.max(topY(), Math.min(a.y, b.y) - rnd(110, 230)), z: rnd(0.2, 1.2) }],
    swoop: (a, b) => [{ x: lerp(a.x, b.x, 0.35), y: Math.min(H - 60, Math.max(a.y, b.y) + rnd(60, 150)), z: rnd(0.4, 1.4) }, { x: lerp(a.x, b.x, 0.8) + rnd(-60, 60), y: b.y - rnd(90, 150), z: 0.4 }],
    wide: (a, b) => { const far = (a.x + b.x) / 2 < W / 2 ? W * rnd(0.78, 0.9) : W * rnd(0.1, 0.22); return [{ x: far, y: rnd(H * 0.3, H * 0.65), z: rnd(0.3, 1.5) }, { x: lerp(far, b.x, 0.55), y: b.y - rnd(100, 170), z: 0.3 }]; },
    loop: (a, b) => {
      const c = { x: clamp(lerp(a.x, b.x, 0.5) + rnd(-120, 120), 160, W - 160), y: clamp(Math.min(a.y, b.y) - rnd(40, 120), topY() + 40, H - 170) };
      const r = rnd(80, 120), dir = Math.random() < 0.5 ? 1 : -1, a0 = Math.atan2(a.y - c.y, a.x - c.x);
      return [0.25, 0.5, 0.75, 1].map((f) => ({ x: c.x + Math.cos(a0 + dir * f * Math.PI * 2) * r, y: c.y + Math.sin(a0 + dir * f * Math.PI * 2) * r * 0.8, z: Math.sin(f * Math.PI) * 1.2 }))
        .concat([{ x: lerp(c.x, b.x, 0.6), y: b.y - 120, z: 0.2 }]);
    },
    dive: (a, b) => [{ x: lerp(a.x, b.x, 0.4) + rnd(-100, 100), y: Math.max(topY(), lerp(a.y, b.y, 0.4) - rnd(60, 140)), z: rnd(2.4, 3.4) }, { x: lerp(a.x, b.x, 0.85), y: b.y - rnd(80, 130), z: 0.5 }],
    // the long one: across the whole screen and back
    tour: (a, b) => {
      const goRight = a.x < W / 2;
      const far = goRight ? W * rnd(0.84, 0.92) : W * rnd(0.08, 0.16), near = goRight ? W * rnd(0.12, 0.25) : W * rnd(0.75, 0.88);
      return [{ x: lerp(a.x, far, 0.5), y: Math.max(topY(), a.y - rnd(140, 220)), z: 0.6 },
        { x: far, y: rnd(H * 0.35, H * 0.55), z: rnd(0.8, 1.8) },
        { x: lerp(far, near, 0.5), y: rnd(H * 0.62, H * 0.78), z: rnd(-0.4, 0.6) },
        { x: near, y: rnd(H * 0.35, H * 0.5), z: 1 },
        { x: lerp(near, b.x, 0.6), y: b.y - rnd(110, 160), z: 0.3 }];
    },
    // a short flutter: along a word, or across the ground
    hop: (a, b) => [{ x: lerp(a.x, b.x, 0.5), y: Math.min(a.y, b.y) - 40 - Math.abs(b.x - a.x) * 0.18, z: 0.15 }],
    // a lunge: a low, quick jump
    lunge: (a, b) => [{ x: lerp(a.x, b.x, 0.5), y: Math.min(a.y, b.y) - 18, z: 0.1 }],
  };
  const RANDOM_ROUTES = ['arc', 'swoop', 'wide', 'loop', 'dive'];
  let lastRoute = '';
  function routeTo(from, to, opts = {}) {
    if (opts.via) return { pts: [from, ...opts.via(from, to), { x: to.x, y: to.y, z: 0 }], name: opts.name || 'custom' };
    let name = opts.route;
    if (!name) { name = pick(RANDOM_ROUTES.filter((n) => n !== lastRoute)); lastRoute = name; }
    return { pts: [from, ...ROUTES[name](from, to), { x: to.x, y: to.y, z: 0 }], name };
  }

  // ---- state
  const S = { PERCHED: 'perched', TAKEOFF: 'takeoff', FLY: 'flying', AWAY: 'away' };
  let perch = perches.find((p) => p.role === 'start') || null;
  let state = perch ? S.PERCHED : S.AWAY;
  let everSeen = false, seenFor = 0, scrolled = false, now = 0, lastScroll = 0, lastAct = 0, scrollDir = 1, lastY = scrollY;
  let flight = null, pending = null, awayT = 0, awayWait = 1.4, launchT = 0, roll = 0, modeHold = 0, busyT = 0, startleCool = 0;
  if (!perch) root.visible = false;
  let lastBehaviour = '', behaviours = 0, mYaw = 0, mLook = 0;
  let ep = null, epWait = null, epName = '', epStart = 0, nextWorm = Infinity, wormHole = null, lastMiss = '', misses = 0;
  const mouse = { x: -1e4, y: -1e4, t: -99 };
  let qFlight = new THREE.Quaternion(), qPerch = new THREE.Quaternion(), qLaunch = new THREE.Quaternion();

  // ---- a slip: soon after the bird lands on a heading, the letters under its feet give way. One
  // shakes, the one it stands on drops a little (and the bird, standing on it, sinks with it and tips
  // as if about to fall), then the letter springs back. Three seconds, then the heading's text is put
  // back exactly as it was. styles.css draws the letters' movement (.slip-shake, .slip-drop).
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ZAXIS = new THREE.Vector3(0, 0, 1);
  let slip = null, slipAt = Infinity, lastSlip = -99;
  // wrap one character of a text node in a span; the node keeps the text before it
  function wrapChar(node, i, cls) {
    const mid = node.splitText(i);
    mid.splitText(1);
    const span = document.createElement('span');
    span.className = 'slip-l ' + cls;
    mid.parentNode.insertBefore(span, mid);
    span.appendChild(mid);
    return span;
  }
  function startSlip(p) {
    const L = p.letter;
    if (!L || !L.node.parentNode || L.node.parentNode.closest('svg')) return;
    const text = L.node.data;
    // the neighbour under the other foot: the next letter if there is one, else the one before
    let j = L.i + 1 < text.length && text[L.i + 1].trim() ? L.i + 1 : (L.i > 0 && text[L.i - 1].trim() ? L.i - 1 : -1);
    let drop, shake = null;
    if (j > L.i) { shake = wrapChar(L.node, j, 'slip-shake'); drop = wrapChar(L.node, L.i, 'slip-drop'); }
    else if (j >= 0) { drop = wrapChar(L.node, L.i, 'slip-drop'); shake = wrapChar(L.node, j, 'slip-shake'); }
    else drop = wrapChar(L.node, L.i, 'slip-drop');
    // the bird keeps standing on the same letter, now inside its span, so it follows the drop
    p.letter = { node: drop.firstChild, i: 0, ascent: L.ascent, cap: L.cap };
    slip = { p, t: 0, t0: performance.now(), spans: shake ? [drop, shake] : [drop], dir: j > L.i || j < 0 ? 1 : -1, cried: false };
    lastSlip = now;
  }
  function endSlip() {
    if (!slip) return;
    const parents = new Set();
    slip.spans.forEach((sp) => {
      const par = sp.parentNode; if (!par) return;
      while (sp.firstChild) par.insertBefore(sp.firstChild, sp);
      par.removeChild(sp); parents.add(par);
    });
    parents.forEach((par) => par.normalize());
    slip.p.letter = null;                                   // found again on the next frame
    slip = null;
  }
  // how far the body tips: in as the letter drops, a small wobble while it hangs, back as it returns
  function slipTilt(t) {
    if (t < 0.62) return 0;
    const env = t < 1.0 ? smooth((t - 0.62) / 0.38) : t < 2.1 ? 1 : 1 - smooth(clamp((t - 2.1) / 0.5, 0, 1));
    return env * (0.2 + 0.06 * Math.sin((t - 0.62) * 15) * Math.exp(-(t - 0.62) * 1.6));
  }
  // perched on a heading it turns three-quarters to the reader, so the long tail goes back behind it;
  // on the ground it faces the hole, side-on, so a peck reads clearly
  function faceYaw(x, p) {
    if (p && p.role === 'ground') { const h = holePoint(p.hole); return (h && h.x < x ? -1 : 1) * 1.2; }
    return (x < W / 2 ? 1 : -1) * (p && p.flip ? -1 : 1) * 0.55;
  }
  const facing = (x, p) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, faceYaw(x, p), 0));
  addEventListener('scroll', () => {
    scrolled = true; lastScroll = now; lastAct = now;
    const y = scrollY; if (Math.abs(y - lastY) > 2) scrollDir = y > lastY ? 1 : -1; lastY = y;
  }, { passive: true });
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = now; } }, { passive: true });
  let tap = null;
  addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') tap = { x: e.clientX, y: e.clientY, t: now }; }, { passive: true });
  addEventListener('resize', resize);
  const idleFor = () => now - lastScroll;
  const birdAt = () => toScreen(root.position);
  const flightLeft = () => (state === S.FLY && flight ? flight.spl.len - flight.dist : state === S.TAKEOFF ? 1e4 : 0);

  // headings the bird could fly to; the footer wins while the reader is heading down to it
  function targets(exclude) {
    const list = perches.filter((p) => p !== exclude).map((p) => ({ p, pt: perchPoint(p) })).filter((o) => inZone(o.pt));
    const fin = list.find((o) => o.p.role === 'final');
    if (fin && scrollDir > 0) return [fin];
    return list.filter((o) => o.p.role !== 'final' || list.length === 1);
  }
  function takeOff(opts = {}) {
    state = S.TAKEOFF; bird.takeOff(); launchT = 0; qLaunch.copy(root.quaternion); pending = opts;
  }
  // a flight from a screen point: opts.target (a perch), opts.route / opts.via, or anywhere in view, or out of sight
  function launchFrom(from, opts = {}, midAir = false) {
    from = { x: from.x, y: from.y, z: from.z || 0 };
    let target = opts.target || null, pt = target ? perchPoint(target) : null;
    if (!target) {
      const t = targets(perch && perch.role !== 'ground' && (state === S.PERCHED || state === S.TAKEOFF) ? perch : null);
      if (t.length) { const o = pick(t); target = o.p; pt = o.pt; }
    }
    if (target && pt) {
      const r = routeTo(from, pt, opts);
      flight = { ...r, spl: spline(r.pts), dist: 0, target, t0: pt, landing: false, speed: opts.speed || (opts.route === 'hop' ? 0.55 : 1) };
    } else {
      const side = pick(SIDES), end = edgePoint(side);
      const mid = { x: lerp(from.x, end.x, 0.5) + rnd(-120, 120), y: Math.max(topY(), lerp(from.y, end.y, 0.5) - rnd(40, 160)), z: rnd(0.4, 1.6) };
      flight = { pts: [from, mid, end], spl: spline([from, mid, end]), dist: 0, target: null, landing: false, exitSide: side, name: 'exit', speed: 1 };
    }
    state = S.FLY; bird.fly(); launchT = midAir ? 1 : 0; root.visible = true;
  }
  // to a perch from wherever the bird is now
  function flyTo(p, opts = {}) {
    opts = { ...opts, target: p };
    if (state === S.PERCHED) takeOff(opts);
    else if (state === S.FLY || state === S.TAKEOFF) launchFrom(birdAt(), opts, state === S.FLY);
  }
  // back into view from an edge, to a heading
  function comeBack() {
    const t = targets(null); if (!t.length) return false;
    const o = pick(t);
    const side = flight && flight.exitSide ? pick(SIDES.filter((x) => x !== flight.exitSide)) : pick(['left', 'right']);
    const r = routeTo(edgePoint(side), o.pt);
    flight = { ...r, spl: spline(r.pts), dist: 0, target: o.p, t0: o.pt, landing: false, speed: 1 };
    state = S.FLY; bird.fly(); launchT = 1; root.visible = true;
    return true;
  }
  // nothing to land on: fly across the screen and out the other side, by one of the routes
  function passBy() {
    const a = pick(SIDES), A = edgePoint(a), B = edgePoint(OPPOSITE[a]);
    const r = routeTo(A, B);
    r.pts[r.pts.length - 1] = B;
    flight = { ...r, spl: spline(r.pts), dist: 0, target: null, landing: false, exitSide: OPPOSITE[a], speed: 0.9 };
    state = S.FLY; bird.fly(); launchT = 1; root.visible = true; lastAct = now;
  }
  // turn the head toward a point on the screen
  const eul = new THREE.Euler();
  function lookToward(x, y, hold = 1.2, tilt = 0) {
    const b = birdAt(); eul.setFromQuaternion(root.quaternion, 'YXZ');
    const dx = x - b.x, dy = y - (b.y - birdPx * 0.75);
    bird.lookAt(clamp(dx / 200, -1.4, 1.4) - eul.y, clamp(dy / 300, -0.35, 0.7), hold, tilt);
  }

  // ---- the things it does on its own when the reader stays put
  const BEHAVIOURS = {
    tour: () => takeOff({ target: perch, route: 'tour' }),
    visit: () => { if (targets(perch).length) takeOff({}); else BEHAVIOURS.loop(); },
    hop: () => {
      if (perch.role !== 'item' && (perch.flatCount || 0) < 2) return BEHAVIOURS.turn();
      perch.aim = pick([0.12, 0.35, 0.55, 0.85].filter((a) => Math.abs(a - perch.aim) > 0.15)); perch.letter = null;
      takeOff({ target: perch, route: 'hop' });
    },
    loop: () => takeOff({ target: perch, route: 'loop' }),
    dive: () => takeOff({ target: perch, route: 'dive' }),
    stretch: () => { bird.express('stretch'); busyT = 2.2; },
    sing: () => { bird.express('chirp'); bird.express('bob'); busyT = 1.8; },
    preen: () => { bird.express('preen'); busyT = 2; },
    turn: () => { perch.flip = !perch.flip; bird.express('hop'); busyT = 1.2; },
    shake: () => { bird.express('shake'); busyT = 1; },
  };
  function behave() {
    lastAct = now;
    // on the ground (after a worm hunt) it just goes back up to a heading
    if (perch.role === 'ground') { if (targets(null).length) takeOff({}); else { bird.express('preen'); busyT = 2; } return; }
    // the worm, when it can show itself, half the time
    if (behaviours > 0 && Math.random() < 0.5 && startWorm()) return;
    // the first time the reader stops, the bird makes a pass across the screen; after that, anything
    const name = behaviours === 0 ? 'tour' : pick(Object.keys(BEHAVIOURS).filter((n) => n !== lastBehaviour));
    behaviours++; lastBehaviour = name;
    BEHAVIOURS[name]();
  }

  // =============================== the worm game ===============================
  // Each hunt is a little script (a generator): it yields a number to wait that many seconds, or a
  // function to wait until it returns true. Scrolling ends a hunt at once: the worm drops out of sight.
  const landedOn = (p) => () => state === S.PERCHED && perch === p;
  const side = (hole) => { const h = holePoint(hole), b = birdAt(); return h && b.x < h.x ? -1 : 1; };   // which side the bird comes from
  function placeWorm(hole) { wormHole = hole; }
  function goUp() { if (targets(null).length) flyTo(null, {}); }
  function* tease(hole) {
    // the worm pops back up while the bird looks the other way, and is gone when it turns round
    const h = holePoint(hole), b = birdAt(); if (!h) return;
    lookToward(b.x - (h.x - b.x) * 2, b.y - birdPx, 1.1, 0.2);
    yield 0.5; worm.peek(); worm.wiggle(); yield 0.9;
    lookToward(h.x, h.y, 1, -0.3); bird.express('excited'); yield 0.22; worm.duck(); yield 0.5;
    bird.express('confused'); yield 0.8;
  }
  const MISSES = {
    // lands right beside the hole and pecks a fraction too late
    *close(hole) {
      const g = groundPerch(hole, side(hole) * birdPx * 0.42);
      flyTo(g, { route: pick(['arc', 'swoop']) });
      yield () => flightLeft() < 260; worm.wiggle();
      yield landedOn(g); yield 0.14;
      bird.express('peck'); yield 0.07; worm.duck(); yield 0.45;
      bird.express('confused'); yield 0.9;
      if (Math.random() < 0.65) yield* tease(hole);
    },
    // too far: lands short, the worm has seen it coming, it creeps in and pecks at an empty hole
    *far(hole) {
      const dir = side(hole);
      const g = groundPerch(hole, dir * birdPx * rnd(1.7, 2.2));
      flyTo(g, { route: pick(['arc', 'wide']) });
      yield () => flightLeft() < 230; worm.duck();
      yield landedOn(g); { const h = holePoint(hole); if (h) lookToward(h.x, h.y, 1.4, 0.3); } yield 0.8;
      const g2 = groundPerch(hole, dir * birdPx * 0.42);
      flyTo(g2, { route: 'hop' }); yield landedOn(g2);
      bird.express('peck'); yield 0.42; bird.express('peck'); yield 0.6; bird.express('confused'); yield 1;
    },
    // a low pass with the claws out, never landing; the worm drops just before
    *flyover(hole) {
      const dir = side(hole), h0 = holePoint(hole); if (!h0) return;
      const t = targets(null);
      const dest = t.length ? pick(t).p : groundPerch(hole, -dir * birdPx * 3.2);
      flyTo(dest, { name: 'flyover', speed: 1.15, via: () => { const h = holePoint(hole); return [
        { x: h.x + dir * 230, y: h.y - 150, z: 0.5 }, { x: h.x + dir * 70, y: h.y - birdPx * 0.75, z: 0.2 },
        { x: h.x - dir * 40, y: h.y - birdPx * 0.62, z: 0.15 }, { x: h.x - dir * 220, y: h.y - 190, z: 0.6 }]; } });
      yield () => { const h = holePoint(hole), b = birdAt(); return !h || Math.abs(b.x - h.x) < 170; };
      worm.duck();
      yield () => { const h = holePoint(hole), b = birdAt(); return !h || Math.abs(b.x - h.x) < 45; };
      bird.express('grab');
      yield () => state === S.PERCHED; yield 0.5;
      // the worm comes up again behind it, cheeky
      worm.emerge(0.2); worm.wiggle(); yield 1.2;
      { const h = holePoint(hole); if (h) lookToward(h.x, h.y, 1.2, 0.35); } bird.express('excited'); yield 0.6; worm.duck(); yield 0.4;
      bird.express('shake'); yield 0.6;
    },
    // too fast: dives at it and lands past the hole, then turns round to an empty hole
    *overshoot(hole) {
      const g = groundPerch(hole, -side(hole) * birdPx * 0.95);
      flyTo(g, { route: 'dive', speed: 1.3 });
      yield () => flightLeft() < 110; worm.duck();
      yield landedOn(g); bird.express('confused'); yield 0.7;
      bird.express('peck'); yield 0.8;
      if (Math.random() < 0.6) yield* tease(hole);
    },
    // it ducks at one hole and comes up at another
    *decoy(hole) {
      const g = groundPerch(hole, side(hole) * birdPx * 0.5);
      flyTo(g, { route: 'arc' });
      yield () => flightLeft() < 170; worm.duck();
      yield landedOn(g); yield 0.4;
      const hole2 = pickHole(hole); if (!hole2) { bird.express('confused'); yield 1; return; }
      placeWorm(hole2); yield 0.1; worm.emerge(0.17); worm.wiggle();
      yield 0.35; { const h = holePoint(hole2); if (h) lookToward(h.x, h.y, 1.4, 0.35); } bird.express('excited'); yield 0.7;
      const h2 = holePoint(hole2), b = birdAt();
      const g2 = groundPerch(hole2, (b.x < h2.x ? -1 : 1) * birdPx * 0.45);
      flyTo(g2, { route: Math.abs(b.x - h2.x) < 260 ? 'hop' : 'arc' });
      yield () => flightLeft() < 75; worm.duck();
      yield landedOn(g2); bird.express('peck'); yield 0.6; bird.express('confused'); yield 0.9;
    },
    // a staring contest, then a lunge
    *standoff(hole) {
      const dir = side(hole);
      const g = groundPerch(hole, dir * birdPx * 1.1);
      flyTo(g, { route: 'arc' });
      yield landedOn(g); worm.calm();
      { const h = holePoint(hole); if (h) lookToward(h.x, h.y, 2.6, 0.32); }
      yield 1.3; bird.express('excited'); yield 1.1;
      const g2 = groundPerch(hole, dir * birdPx * 0.4);
      flyTo(g2, { route: 'lunge', speed: 1.6 });
      yield () => flightLeft() < 45; worm.duck();
      yield landedOn(g2); bird.express('peck'); yield 0.5; bird.express('confused'); yield 0.8;
    },
  };
  function* hunt(hole) {
    placeWorm(hole);
    worm.emerge(rnd(0.13, 0.2));
    yield rnd(1, 1.6);
    // the bird spots it
    { const h = holePoint(hole); if (h) lookToward(h.x, h.y, 1.6, 0.3); }
    bird.express('excited');
    yield rnd(0.7, 1.2);
    const name = pick(Object.keys(MISSES).filter((n) => n !== lastMiss)); lastMiss = name; epName = name; misses++;
    yield* MISSES[name](hole);
    worm.duck(); worm.closeHole();
    yield rnd(0.5, 1);
    if (perch.role === 'ground') goUp();
  }
  function startWorm() {
    if (ep) return false;
    const hole = pickHole(); if (!hole) return false;
    ep = hunt(hole); epWait = null; lastAct = now; epStart = now; epName = '';
    nextWorm = Infinity;
    return true;
  }
  function stopWorm() {
    ep = null; epWait = null; worm.duck(); worm.closeHole(); nextWorm = now + rnd(14, 24);
  }
  function runHunt(dt) {
    if (!ep) return;
    // a hunt that has lost its way (the bird went off screen, say) is called off
    if (now - epStart > 30) { stopWorm(); if (state === S.PERCHED && perch.role === 'ground') goUp(); return; }
    if (typeof epWait === 'number') { epWait -= dt; if (epWait > 0) return; }
    else if (typeof epWait === 'function') { if (!epWait()) return; }
    const r = ep.next();
    if (r.done) { ep = null; epWait = null; nextWorm = now + rnd(14, 26); }
    else epWait = r.value;
  }

  const v3 = new THREE.Vector3(), mtx = new THREE.Matrix4(), ORIGIN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
  let prevHeading = 0;
  function orient(dx, dy, dz, dt) {
    const f = v3.set(dx * s, -dy * s, dz); if (f.lengthSq() < 1e-10) return;
    f.normalize(); f.y = clamp(f.y, -0.55, 0.55); f.normalize();
    mtx.lookAt(ORIGIN, f.clone().negate(), UP);
    qFlight.setFromRotationMatrix(mtx);
    // bank into the curve
    const heading = Math.atan2(dy, dx);
    let dh = heading - prevHeading; if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
    prevHeading = heading;
    roll += (clamp(-dh / Math.max(dt, 1e-3) * 0.12, -0.6, 0.6) - roll) * (1 - Math.exp(-4 * dt));
    qFlight.multiply(new THREE.Quaternion().setFromAxisAngle(FWD, roll));
  }

  let rendered = true, frameN = 0;
  function frame(dt) {
    now += dt;
    const covered = document.documentElement.classList.contains('nav-open') || document.documentElement.classList.contains('tree-open');
    canvas.style.visibility = covered ? 'hidden' : '';
    if (covered) { scrolled = false; return; }
    let draw = true;
    busyT -= dt; startleCool -= dt;
    // a scroll ends a worm hunt: the worm is gone in an instant and the bird gets on with its day
    if (scrolled && ep) {
      stopWorm();
      if (state === S.FLY && flight && flight.target && flight.target.role === 'ground') launchFrom(birdAt(), {}, true);
      else if (state === S.PERCHED && perch.role === 'ground') takeOff({});
    }

    // timed on the real clock, so the bird keeps step with the letters' CSS animation
    if (slip) { slip.t = (performance.now() - slip.t0) / 1000; if (slip.t >= 3) endSlip(); }
    if (state === S.PERCHED && !slip && now >= slipAt) {
      slipAt = Infinity;
      if (!ep && perch.role !== 'item' && perch.role !== 'ground') { if (!perch.letter) chooseLetter(perch); startSlip(perch); }
    }
    if (state !== S.PERCHED) slipAt = Infinity;
    if (state === S.PERCHED) {
      const pt = perchPoint(perch);
      const vis = onScreen(pt);
      if (pt) {
        root.position.copy(toWorld(pt.x, pt.y)); qPerch = facing(pt.x, perch);
        if (slip && slip.p === perch) {
          // the letter gives: the body tips toward the drop and the wings flare to catch the balance
          if (!slip.cried && slip.t > 0.6) { slip.cried = true; bird.express('slip'); lastAct = now; busyT = 2.6; }
          qPerch = new THREE.Quaternion().setFromAxisAngle(ZAXIS, -slipTilt(slip.t) * slip.dir).multiply(qPerch);
          root.quaternion.slerp(qPerch, 1 - Math.exp(-14 * dt));
        } else root.quaternion.slerp(qPerch, 1 - Math.exp(-6 * dt));
      }
      seenFor = vis ? seenFor + dt : 0;
      if (vis && !everSeen) { everSeen = true; nextWorm = now + rnd(7, 11); }
      if (!pt && everSeen) { state = S.AWAY; root.visible = false; awayT = 0; awayWait = rnd(0.5, 1); flight = null; }
      draw = vis;
      const resting = perch.role === 'final' && inZone(pt) && scrollDir > 0;  // the end of the page
      const footerAhead = scrollDir > 0 && perch.role !== 'final' && targets(perch).some((o) => o.p.role === 'final');
      if (vis && pt.y < navBottom() + birdPx * 0.9) takeOff();                                   // about to slide under the nav
      else if (vis && scrolled && !resting && (seenFor > 1.1 || footerAhead || perch.role === 'ground')) takeOff();
      else if (!vis && everSeen && now - lastScroll < 2) { state = S.AWAY; root.visible = false; awayT = 0; awayWait = rnd(0.5, 1.2); flight = null; }
      else if (vis && !ep) {
        // watches the mouse (smoothly); jumps away if the cursor comes too close
        const head = { x: pt.x, y: pt.y - birdPx * 0.75 };
        const dx = mouse.x - head.x, dy = mouse.y - head.y, dist = Math.hypot(dx, dy);
        const tapped = tap && now - tap.t < 0.4 && Math.hypot(tap.x - pt.x, tap.y - (pt.y - birdPx * 0.5)) < birdPx * 0.9;
        if (tapped) tap = null;
        if ((tapped || (dist < birdPx * 0.8 && now - mouse.t < 0.5)) && startleCool <= 0 && busyT <= 0) {
          startleCool = 5; lastAct = now;
          bird.express('hop');
          if (targets(perch).length && Math.random() < 0.6) takeOff({}); else takeOff({ target: perch, route: pick(['loop', 'arc', 'tour']) });
        } else if (dist < 520 && now - mouse.t < 3 && busyT <= 0) {
          mYaw += (clamp(dx / 260, -1.3, 1.3) - faceYaw(pt.x, perch) - mYaw) * (1 - Math.exp(-6 * dt));
          mLook += (clamp(dy / 380, -0.35, 0.5) - mLook) * (1 - Math.exp(-6 * dt));
          bird.lookAt(mYaw, mLook, 0.4);
        }
        if (state === S.PERCHED && idleFor() > 2.5 && now > nextWorm && busyT <= 0 && perch.role !== 'ground') startWorm();
        if (state === S.PERCHED && !ep && idleFor() > 10 && now - lastAct > 10 && busyT <= 0) behave();
      } else if (!vis && !everSeen && idleFor() > 10 && now - lastAct > 12) {
        passBy();                                                     // a glimpse while the reader is still up top
      }
    } else if (state === S.TAKEOFF) {
      const pt = perchPoint(perch);
      if (pt) root.position.copy(toWorld(pt.x, pt.y));
      launchT += dt;
      if (launchT >= bird.takeOffLaunch) launchFrom(pt || birdAt(), pending || {});
    } else if (state === S.FLY) {
      const F = flight;
      launchT += dt;
      const speed = 560 * clamp(H / 900, 0.8, 1.3) * clamp(launchT * 3 + 0.3, 0, 1) * (F.speed || 1);
      // keep tracking a moving target (the page may scroll under the bird); change course if it goes
      let live = null, shift = { x: 0, y: 0 };
      if (F.target) {
        live = perchPoint(F.target);
        const lost = !live || (!zoneOK(F.target, live) && F.dist / F.spl.len < 0.85);
        const footer = F.target.role !== 'final' && !ep && scrollDir > 0 && targets(null).some((o) => o.p.role === 'final');
        if (lost || footer) { if (ep) stopWorm(); launchFrom(birdAt(), {}, true); bird.update(dt); return void render(true); }
        shift = { x: live.x - F.t0.x, y: live.y - F.t0.y };
      }
      const left = F.spl.len - F.dist;
      const brake = F.target ? lerp(0.35, 1, clamp(left / 150, 0, 1)) : 1;
      const d0 = F.dist; F.dist = Math.min(F.spl.len, F.dist + dt * speed * brake);
      const u0 = F.spl.len ? d0 / F.spl.len : 1, u1 = F.spl.len ? F.dist / F.spl.len : 1;
      const w0 = smooth(clamp((u0 - 0.35) / 0.65, 0, 1)), w1 = smooth(clamp((u1 - 0.35) / 0.65, 0, 1));
      const a = F.spl.at(d0), b = F.spl.at(F.dist);
      const ax = a.x + shift.x * w0, ay = a.y + shift.y * w0, bx = b.x + shift.x * w1, by = b.y + shift.y * w1;
      root.position.copy(toWorld(bx, by, b.z));
      orient(bx - ax, by - ay, b.z - a.z, dt);
      // climbing beats hard, a long descent glides, landing flares
      modeHold -= dt;
      const short = F.name === 'hop' || F.name === 'lunge';
      const landSpan = short ? 55 : 140;
      if (F.target && left < landSpan && !F.landing) { F.landing = true; bird.flare(); }
      if (!F.landing && modeHold <= 0) {
        const vy = (by - ay) / Math.max(dt, 1e-3);
        if (vy > 140 && bird.mode === 'flying' && u1 > 0.15) { bird.fly({ glide: true }); modeHold = 0.5; }
        else if (vy < 60 && bird.mode === 'glide') { bird.fly(); modeHold = 0.4; }
      }
      // orientation: out of the perch pose at the start, into it at the end
      if (launchT < 0.35) root.quaternion.slerpQuaternions(qLaunch, qFlight, smooth(launchT / 0.35));
      else if (F.landing) { qPerch = facing(live ? live.x : bx, F.target); root.quaternion.slerpQuaternions(qFlight, qPerch, smooth(1 - clamp(left / landSpan, 0, 1))); }
      else root.quaternion.copy(qFlight);
      if (F.dist >= F.spl.len - 0.5) {
        if (F.target) {
          perch = F.target; state = S.PERCHED; seenFor = 0; bird.touchDown(); lastAct = now;
          if (!REDUCED && !slip && perch.role !== 'item' && perch.role !== 'ground' && now - lastSlip > 9) slipAt = now + 0.55;
        }
        else { state = S.AWAY; root.visible = false; awayT = 0; awayWait = rnd(0.6, 1.4); }
      }
    } else if (state === S.AWAY) {
      awayT += dt; draw = false;
      if (awayT > awayWait && now - lastScroll > 0.25) {
        if (!comeBack()) {
          awayWait = awayT + 0.5;
          if (idleFor() > 10 && now - lastAct > 12) passBy();          // nowhere to land: fly past now and then
        }
      }
    }

    runHunt(dt);
    scrolled = false;
    bird.update(dt);
    // the worm, at its hole (which moves with the page)
    worm.update(dt);
    const wh = wormHole && holePoint(wormHole);
    const wormOn = !!wh && (ep || worm.out || worm.object.children[0].material.opacity > 0.02);
    worm.object.visible = wormOn;
    if (wormOn) { worm.object.position.copy(toWorld(wh.x, wh.y)); worm.setGround(worm.object.position.y); }
    frameN++;
    render((draw && root.visible) || wormOn);
  }
  function render(draw) {
    if (draw) { renderer.render(scene, camera); rendered = true; }
    else if (rendered) { renderer.clear(); rendered = false; }
  }

  resize();
  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
    try { frame(dt); } catch (e) { console.warn('robo turaco frame:', e); }
  }
  requestAnimationFrame(loop);
  // read-only status for testing in the console
  window.__roboTuraco = {
    get state() { return state; }, get perch() { return perch && (perch.el ? perch.role + ': ' + perch.el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : perch.role); }, get route() { return flight && flight.name; },
    get perches() { return perches.length; },
    get behaviour() { return lastBehaviour; }, get behaviours() { return behaviours; }, get hunt() { return ep ? epName || 'spotting' : ''; },
    get misses() { return misses; }, get wormOut() { return worm.out; }, startWorm, root, get slipping() { return slip ? +slip.t.toFixed(2) : 0; },
  };
}
