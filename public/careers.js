// careers.js: behaviour for /careers, /careers/apply/<role> and /about.
// The page arrives whole: headings, paragraphs, numbers and blocks are all in place from the start,
// with nothing waiting to be scrolled to. The hero film plays, the open role at the centre of the
// screen is marked, the FAQ opens with a measured height, the apply form checks itself before
// sending, and one chrome seal (Three.js, loaded from jsDelivr) travels the page.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- the careers hero film: fades in once it plays; held on its poster when motion is reduced ----------
const film = document.querySelector('.cs-film');
if (film) {
  const show = () => film.classList.add('is-playing');
  if (still) { film.removeAttribute('autoplay'); film.pause(); show(); }
  else {
    if (!film.paused && film.readyState > 2) show(); else film.addEventListener('playing', show, { once: true });
    const p = film.play && film.play();
    if (p && p.catch) p.catch(show);   // autoplay refused (a data saver, a low-power mode): show the poster instead
  }
}

// ---------- the open roles: the one at the centre of the screen is the lit one ----------
const roleEls = [...document.querySelectorAll('.cs-role')];
window.csRole = 0;
if (roleEls.length && 'IntersectionObserver' in window) {
  const light = (el) => {
    const i = +el.dataset.role;
    if (el.classList.contains('is-on') && el.dataset.seen) return;
    el.dataset.seen = '1';
    roleEls.forEach((r) => r.classList.toggle('is-on', r === el));
    window.csRole = i;
  };
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) light(e.target); });
  }, { rootMargin: '-46% 0px -46% 0px' });
  roleEls.forEach((r) => {
    spy.observe(r);
    r.addEventListener('focusin', () => light(r));
  });
}

// ---------- FAQ: open and close with a measured height ----------
document.querySelectorAll('.cs-q').forEach((d) => {
  const sum = d.querySelector('summary');
  const body = d.querySelector('.cs-q-a');
  sum.addEventListener('click', (e) => {
    if (still || !body.animate) return;
    e.preventDefault();
    if (d.dataset.busy) return;
    d.dataset.busy = '1';
    const ease = 'cubic-bezier(.16, 1, .3, 1)';
    if (d.open) {
      const h = body.offsetHeight;
      const a = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: ease });
      a.onfinish = () => { d.open = false; delete d.dataset.busy; };
    } else {
      d.open = true;
      const h = body.offsetHeight;
      const a = body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 420, easing: ease });
      a.onfinish = () => { delete d.dataset.busy; };
    }
  });
});

// ---------- the application form ----------
const form = document.getElementById('csForm');
if (form) {
  const drop = form.querySelector('[data-drop]');
  const input = drop.querySelector('input[type="file"]');
  const nameEl = drop.querySelector('[data-file-name]');
  const metaEl = drop.querySelector('[data-file-meta]');
  const clear = form.querySelector('[data-file-clear]');
  const MAX = 4 * 1024 * 1024;
  const fileProblem = (f) => (!f ? 'Attach your CV as a PDF or Word file.'
    : !/\.(pdf|docx?)$/i.test(f.name) ? 'The CV must be a PDF or Word document (.pdf, .doc or .docx).'
    : f.size > MAX ? 'That CV is larger than 4 MB. Please send a smaller file.' : '');
  const showFile = () => {
    const f = input.files && input.files[0];
    if (!f) {
      nameEl.textContent = 'Drop your CV here, or choose a file';
      metaEl.textContent = 'PDF or Word, up to 4 MB';
      drop.classList.remove('has-file', 'is-invalid');
      clear.hidden = true;
      return;
    }
    const mb = f.size / 1048576;
    nameEl.textContent = f.name;
    metaEl.textContent = (mb < 0.1 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : mb.toFixed(1) + ' MB') + (fileProblem(f) ? ' · ' + fileProblem(f) : '');
    drop.classList.toggle('has-file', !fileProblem(f));
    drop.classList.toggle('is-invalid', !!fileProblem(f));
    clear.hidden = false;
  };
  input.addEventListener('change', showFile);
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) { input.files = e.dataTransfer.files; showFile(); }
  });
  clear.addEventListener('click', () => { input.value = ''; showFile(); input.focus(); });

  const note = form.querySelector('[data-count]');
  const out = form.querySelector('[data-count-out]');
  if (note && out) note.addEventListener('input', () => { out.textContent = note.value.length; });

  // the same checks the server makes, before the file travels
  const setErr = (el, field, msg) => {
    let p = document.getElementById('cs-err-' + field);
    if (!msg) { if (p) p.remove(); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); if (field === 'cv') drop.classList.remove('is-invalid'); return false; }
    if (!p) {
      p = document.createElement('p');
      p.className = 'cs-err'; p.id = 'cs-err-' + field; p.dataset.client = '1';
      const after = field === 'cv' ? clear : field === 'consent' ? el.closest('.cs-consent') : el;
      after.insertAdjacentElement('afterend', p);
    }
    p.textContent = msg;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', p.id);
    if (field === 'cv') drop.classList.add('is-invalid');
    return true;
  };
  const checks = [
    ['full_name', (v) => (!v.trim() ? 'Your full name is required.' : '')],
    ['email', (v) => (!v.trim() ? 'An email address is required, so the Unit can reply.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? 'That email address does not look right.' : '')],
    ['phone', (v) => (v.trim() && !/^[0-9+()\-\s]{6,40}$/.test(v.trim()) ? 'Use digits, spaces and + only, or leave it empty.' : '')],
    ['county', (v) => (!v ? 'Choose your county.' : '')],
  ];
  checks.forEach(([name, test]) => {
    const el = form.elements[name];
    el.addEventListener('blur', () => { if (el.value || el.getAttribute('aria-invalid')) setErr(el, name, test(el.value)); });
  });
  form.addEventListener('submit', (e) => {
    let first = null;
    checks.forEach(([name, test]) => { const el = form.elements[name]; if (setErr(el, name, test(el.value)) && !first) first = el; });
    if (setErr(input, 'cv', fileProblem(input.files && input.files[0])) && !first) first = input;
    const consent = form.elements.consent;
    if (setErr(consent, 'consent', consent.checked ? '' : 'Please agree so the Unit can keep and assess your application.') && !first) first = consent;
    if (first) { e.preventDefault(); first.focus(); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.querySelector('[data-submit-label]').textContent = 'Sending';
  });
}

// ---------- the chrome star ----------
const canvas = document.getElementById('csStar');
const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
if (canvas && webgl) star(canvas).catch(() => canvas.remove());
else if (canvas) canvas.remove();

async function star(cv) {
  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  // chrome is black reflections against hard white light. The studio is near-black, lit only
  // by hard white bars (most of them in front, where the faces looking at the viewer reflect),
  // one soft grey horizon band for the mid-tones, and a faint blue bounce from below
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0d12, side: THREE.BackSide })));
  const bar = (w, h, x, y, z, power, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  bar(0.9, 16, -3.2, 0, 9, 9);      // front, tall, left of the viewer
  bar(0.6, 16, 4.4, 0, 8.5, 7);     // front, tall, right
  bar(16, 0.7, 0, 3.6, 8.5, 8);     // front, high crossbar
  bar(12, 0.5, 0, -4.2, 9, 4);      // front, low crossbar
  bar(0.5, 14, -9, 1, 2, 12);       // side bars for the bevels
  bar(0.5, 14, 9.5, -1, 1, 10);
  bar(16, 0.6, 0, 9, 1, 12);        // overhead
  bar(40, 4, 0, 0, -14, 0.35, 0xb8c2d2);   // soft horizon behind, for the mid-tones
  bar(26, 15, 0, 2.4, 12.5, 2.0, 0xc8d0dc);  // a soft grey panel in front: the silver mid-tone of faces turned toward the viewer
  bar(22, 7, 0, -6.5, 10.5, 0.75, 0xaeb8c8);  // a dimmer fill from below-front for faces tipped downward
  bar(8, 1.2, 0, -8.5, 3, 1.4, 0x2f66d8);  // the faint blue bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.035).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 13);
  const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(4, 5, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa2ff, 0.45); rim.position.set(-6, -3, 2); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa3c8, 0.55));
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-2, 1, 10); scene.add(fill);

  // The coat of arms of Liberia as a struck emblem, built from the artwork itself: its outline is
  // traced and extruded into a solid with gold bevelled sides and a navy back, and its face is
  // the arms in relief (the yellow border highest, the scrolls next, the ship, palm, dove, plough
  // and sun raised above sea and sky). The image comes from the page (the Image Library's seal,
  // or a larger copy at /img/brand/seal-large.png when one is there).
  const dash = (size = 0.075, gap = 0.06) => new THREE.LineDashedMaterial({ color: 0xdfe8ff, dashSize: size, gapSize: gap, transparent: true, opacity: 0, depthWrite: false });
  const rig = new THREE.Group();
  const tilt = new THREE.Group();
  const body = new THREE.Group();
  rig.add(tilt); tilt.add(body); scene.add(rig);
  const wireMat = dash();
  const solids = [];   // { mesh, mat, base } so the whole object fades together
  const wires = [];

  const art = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = cv.dataset.seal || '/img/brand/liberia-seal.png'; });
  const SC = 640 / Math.max(art.naturalWidth, art.naturalHeight);   // the analysis grid; the face texture keeps full resolution
  const W = Math.round(art.naturalWidth * SC), H = Math.round(art.naturalHeight * SC), N = W * H;
  const work = document.createElement('canvas'); work.width = W; work.height = H;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(art, 0, 0, W, H);
  const px = wctx.getImageData(0, 0, W, H);
  const d = px.data;
  const hue = new Float32Array(N), sat = new Float32Array(N), val = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    val[i] = mx; sat[i] = mx ? c / mx : 0;
    hue[i] = !c ? 0 : mx === r ? (60 * ((g - b) / c) + 360) % 360 : mx === g ? 60 * ((b - r) / c) + 120 : 60 * ((r - g) / c) + 240;
  }
  // flood fill over pixels that pass `ok`, from the given seeds (4-connected)
  const flood = (seeds, ok) => {
    const seen = new Uint8Array(N), q = new Int32Array(N); let h = 0, t = 0;
    for (const s of seeds) if (!seen[s] && ok(s)) { seen[s] = 1; q[t++] = s; }
    while (h < t) {
      const i = q[h++], x = i % W, y = (i / W) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) if (j >= 0 && !seen[j] && ok(j)) { seen[j] = 1; q[t++] = j; }
    }
    return seen;
  };
  const border = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
  // background: the transparent pixels; only an image with no transparency at all (a baked-in
  // checkerboard) falls back to the pale neutral pixels reached from its edge
  let clear = 0; for (let i = 0; i < N; i++) if (d[i * 4 + 3] < 110) clear++;
  const bg = clear > N * 0.02
    ? flood(border, (i) => d[i * 4 + 3] < 110)
    : flood(border, (i) => val[i] > 0.82 && sat[i] < 0.06);
  const inside = new Uint8Array(N);
  for (let i = 0; i < N; i++) inside[i] = bg[i] ? 0 : 1;
  for (let i = 0; i < N; i++) d[i * 4 + 3] = inside[i] ? 255 : 0;   // the face's alpha is the traced outline

  // regions of the arms, by colour
  const yellow = (i) => inside[i] && hue[i] > 38 && hue[i] < 72 && sat[i] > 0.42 && val[i] > 0.55;
  const light = (i) => inside[i] && sat[i] < 0.16 && val[i] > 0.7;
  const dark = (i) => inside[i] && val[i] < 0.3;
  const components = (test) => {   // label 8-connected components of `test`
    const lab = new Int32Array(N).fill(-1), sizes = [], q = new Int32Array(N);
    for (let s = 0; s < N; s++) {
      if (lab[s] >= 0 || !test(s)) continue;
      const id = sizes.length; let h = 0, t = 0, n = 0; lab[s] = id; q[t++] = s;
      while (h < t) {
        const i = q[h++], x = i % W, y = (i / W) | 0; n++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx; if (lab[j] < 0 && test(j)) { lab[j] = id; q[t++] = j; }
        }
      }
      sizes.push(n);
    }
    return { lab, sizes };
  };
  const yc = components(yellow);
  const rimId = yc.sizes.indexOf(Math.max(...yc.sizes));
  const isRim = (i) => yc.lab[i] === rimId;
  // the shield: everything within the border's span, row by row (the scrolls hide parts of the
  // border, so columns are not reliable)
  const rowMin = new Int32Array(H).fill(W), rowMax = new Int32Array(H).fill(-1);
  for (let i = 0; i < N; i++) if (isRim(i)) {
    const x = i % W, y = (i / W) | 0;
    if (x < rowMin[y]) rowMin[y] = x; if (x > rowMax[y]) rowMax[y] = x;
  }
  const shield = (i) => { const x = i % W, y = (i / W) | 0; return x > rowMin[y] && x < rowMax[y]; };
  // the scrolls: pale ribbon that reaches outside the shield, wherever it runs
  const lc = components(light);
  const isScroll = new Uint8Array(lc.sizes.length);
  for (let i = 0; i < N; i++) if (lc.lab[i] >= 0 && !shield(i)) isScroll[lc.lab[i]] = 1;
  const scroll = (i) => lc.lab[i] >= 0 && isScroll[lc.lab[i]] === 1;
  const near = (i, test, r = 2) => {
    const x = i % W, y = (i / W) | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (test(yy * W + xx)) return true;
    }
    return false;
  };
  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (!inside[i]) continue;
    let h;
    if (isRim(i)) h = 1;
    else if (scroll(i)) h = 0.82;
    else if (dark(i) && near(i, scroll)) h = 0.74;      // the lettering, set a little into the ribbon
    else if (dark(i) && near(i, isRim)) h = 0.9;          // the border's outline
    else if (!shield(i)) h = 0.78;                      // the ribbon's own outline and shading
    else if (yellow(i)) h = 0.55;                       // the sun
    else if (light(i)) h = 0.58;                        // sails, dove, plough, shovel
    else if (hue[i] > 70 && hue[i] < 170 && sat[i] > 0.25) h = 0.46;   // palm and grass
    else if (hue[i] > 15 && hue[i] < 45 && sat[i] > 0.3) h = 0.5;      // trunk and hull
    else if (dark(i)) h = 0.5;
    else h = 0.28;                                      // sky and sea
    height[i] = h + (val[i] - 0.5) * 0.06;
  }
  // soften the steps into bevels (two passes of a separable box blur)
  const blur = (src, r) => {
    const tmp = new Float32Array(N), out = new Float32Array(N);
    for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * r + 1); s += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = s / (2 * r + 1); s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
    return out;
  };
  const relief = blur(blur(height, 2), 1);
  wctx.putImageData(px, 0, 0);

  // trace a binary mask into closed outlines (marching squares, linked into loops)
  const trace = (on, minArea = 40) => {
    const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && on(y * W + x)) ? 1 : 0;
    const adj = new Map();
    const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
    const key = (x2, y2) => (x2 + 4) * 100000 + (y2 + 4);   // doubled coordinates (offset), so edge midpoints are integers
    for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;
      const T = key(2 * x + 1, 2 * y), R = key(2 * x + 2, 2 * y + 1), B = key(2 * x + 1, 2 * y + 2), L = key(2 * x, 2 * y + 1);
      switch (code) {
        case 1: case 14: link(L, B); break;
        case 2: case 13: link(B, R); break;
        case 4: case 11: link(T, R); break;
        case 8: case 7: link(T, L); break;
        case 3: case 12: link(L, R); break;
        case 6: case 9: link(T, B); break;
        case 5: link(T, R); link(L, B); break;
        case 10: link(T, L); link(R, B); break;
      }
    }
    const loops = [], used = new Set();
    for (const start of adj.keys()) {
      if (used.has(start)) continue;
      const loop = []; let prev = -1, cur = start;
      while (cur !== undefined && !used.has(cur)) {
        used.add(cur); loop.push([(Math.floor(cur / 100000) - 4) / 2, ((cur % 100000) - 4) / 2]);
        const nx = adj.get(cur).find((n) => n !== prev && !used.has(n)); prev = cur; cur = nx;
      }
      if (loop.length > 8) loops.push(loop);
    }
    const area = (l) => { let a = 0; for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
    return loops.filter((l) => Math.abs(area(l)) > minArea).map((l) => ({ pts: simplify(chaikin(chaikin(l)), 0.3), area: Math.abs(area(l)) }));
  };
  function chaikin(pts) {   // one pass of corner-cutting on a closed loop: pixel steps become smooth curves
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    return out;
  }
  function simplify(pts, eps) {   // Douglas-Peucker on a closed loop
    const dp = (a, b, out) => {
      let md = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      for (let i = a + 1; i < b; i++) { const dd = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len; if (dd > md) { md = dd; mi = i; } }
      if (md > eps) { dp(a, mi, out); dp(mi, b, out); } else out.push(pts[a]);
    };
    const out = []; const mid = pts.length >> 1;
    dp(0, mid, out); dp(mid, pts.length - 1, out); out.push(pts[pts.length - 1]);
    return out;
  }
  const UNIT = H / 3.05;   // the arms stand about 3 units tall, as the earlier objects did
  const toV2 = ([x, y]) => new THREE.Vector2((x - W / 2) / UNIT, -(y - H / 2) / UNIT);
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const outline = trace((i) => inside[i]);
  // nesting decides outlines and holes
  const shapes = [];
  outline.sort((a, b) => b.area - a.area);
  for (const lp of outline) {
    const depth = outline.filter((o) => o !== lp && o.area > lp.area && inPoly(lp.pts[0], o.pts)).length;
    if (depth % 2 === 0) shapes.push({ src: lp.pts, shape: new THREE.Shape(lp.pts.map(toV2)) });
    else { const host = shapes.find((s) => inPoly(lp.pts[0], s.src)); if (host) host.shape.holes.push(new THREE.Path(lp.pts.map(toV2))); }
  }

  // the solid: the extruded outline in gold, its bevel catching the light round the face
  const DEPTH = 0.14, BT = 0.05;
  const solidGeo = new THREE.ExtrudeGeometry(shapes.map((s) => s.shape), { depth: DEPTH, bevelEnabled: true, bevelThickness: BT, bevelSize: 0.035, bevelSegments: 5, curveSegments: 1 });
  solidGeo.translate(0, 0, -DEPTH / 2);
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xe9c21b, metalness: 0.75, roughness: 0.28, clearcoat: 0.6, envMapIntensity: 1, transparent: true });
  const solidMesh = new THREE.Mesh(solidGeo, goldMat);
  body.add(solidMesh);
  solids.push({ mesh: solidMesh, mat: goldMat, base: 1 });
  const solidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(solidGeo, 35), wireMat);
  solidEdges.computeLineDistances(); body.add(solidEdges); wires.push(solidEdges);

  // the face: the artwork on a grid lifted by the relief map, cut to the outline by its alpha
  const FACE_Z = DEPTH / 2 + BT + 0.002, LIFT = 0.11;
  const GX = Math.round(W / 2.5), GY = Math.round(H / 2.5);
  const faceGeo = new THREE.PlaneGeometry(W / UNIT, H / UNIT, GX, GY);
  const fp = faceGeo.attributes.position, fuv = faceGeo.attributes.uv;
  for (let k = 0; k < fp.count; k++) {
    const u = fuv.getX(k), v = fuv.getY(k);
    const x = Math.min(W - 1, Math.round(u * (W - 1))), y = Math.min(H - 1, Math.round((1 - v) * (H - 1)));
    fp.setZ(k, FACE_Z + relief[y * W + x] * LIFT);
  }
  faceGeo.computeVertexNormals();
  // the face texture at the artwork's full resolution (up to 2048 px); its edge is the art's own
  // antialiased alpha, or the traced outline, scaled up smoothly, when the art has none
  const TS = Math.min(1, 2048 / Math.max(art.naturalWidth, art.naturalHeight));
  const tex = document.createElement('canvas');
  tex.width = Math.round(art.naturalWidth * TS); tex.height = Math.round(art.naturalHeight * TS);
  const tctx = tex.getContext('2d');
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(art, 0, 0, tex.width, tex.height);
  if (clear <= N * 0.02) { tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(work, 0, 0, tex.width, tex.height); }
  const faceTex = new THREE.CanvasTexture(tex);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.42, metalness: 0.04, envMapIntensity: 0.25, toneMapped: false, transparent: true });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  body.add(faceMesh);
  solids.push({ mesh: faceMesh, mat: faceMat, base: 1, cut: 0.5 });

  // the black section's drawing: the outline and the shield's border
  const lineLoop = (pts, z) => {
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => { const v = toV2(p); return new THREE.Vector3(v.x, v.y, z); })), wireMat);
    l.computeLineDistances(); body.add(l); wires.push(l);
  };
  for (const lp of trace(isRim, 400)) lineLoop(lp.pts, FACE_Z + 0.1);   // the border, as a clean drawing over the outline


  // a distinct pose for each open role (a symmetric star looks the same after a fifth of a turn)
  const POSES = [
    { x: 0.10, y: -0.42, z: 0.00 },
    { x: -0.22, y: 0.46, z: 0.12 },
    { x: 0.14, y: -0.3, z: -0.16 },
    { x: 0.06, y: 0.56, z: 0.22 },
    { x: -0.26, y: -0.52, z: -0.08 },
  ];
  const K = {
    hero:    { x: 0.42, y: 0.02,  s: 1.25, chrome: 1, wire: 0, sway: 1 },
    mission: { x: 0.60, y: 1.70,  s: 1.0,  chrome: 0, wire: 0, sway: 1 },
    roles:   { x: 0.50, y: -0.02, s: 1.05, chrome: 1, wire: 0, sway: 0 },
    dark:    { x: 0.62, y: 0.0,   s: 1.0,  chrome: 0, wire: 1, sway: 1 },
    join:    { x: 0.8,  y: 0.02,  s: 1.3,  chrome: 1, wire: 0, sway: 0.3, px: 0 },   // a calm close-up
    faq:     { x: 0.95, y: 0.2,   s: 1.0,  chrome: 0, wire: 0, sway: 1 },
    outro:   { x: 0.95, y: 0.2,   s: 1.0,  chrome: 0, wire: 0, sway: 1 },
    // /about: beside the commitments (they keep the left half), then alone in the emblem band
    commit:  { x: 0.55, y: 0.0,   s: 1.0,  chrome: 1, wire: 0, sway: 1 },
    emblem:  { x: 0.0,  y: 0.02,  s: 0.85, chrome: 1, wire: 0, sway: 1 },
  };
  const KM = {
    hero:    { x: 0.12, y: -0.57, s: 0.45, chrome: 1, wire: 0, sway: 1 },
    mission: { x: 0.8,  y: 0.8,  s: 0.4,  chrome: 0, wire: 0, sway: 1 },
    roles:   { x: 0.6,  y: 0.36, s: 0.27, chrome: 1, wire: 0, sway: 0 },
    dark:    { x: 0.5,  y: 0.52, s: 0.55, chrome: 0, wire: 1, sway: 1 },
    join:    { x: 0.8,  y: 0.8,  s: 0.4,  chrome: 0, wire: 0, sway: 1 },
    faq:     { x: 0.8,  y: 0.8,  s: 0.4,  chrome: 0, wire: 0, sway: 1 },
    outro:   { x: 0.8,  y: 0.8,  s: 0.4,  chrome: 0, wire: 0, sway: 1 },
    commit:  { x: 0.8,  y: 0.8,  s: 0.4,  chrome: 0, wire: 0, sway: 1 },
    emblem:  { x: 0.0,  y: 0.04, s: 0.5,  chrome: 1, wire: 0, sway: 1 },
  };
  // narrower desktops: the hero seal moves right and shrinks, clear of the headline
  const KN = { ...K, hero: { ...K.hero, x: 0.6, y: -0.1, s: 0.92 }, commit: { ...K.commit, x: 0.66, s: 0.78 } };
  const PROPS = ['x', 'y', 's', 'chrome', 'wire', 'sway', 'exp', 'px'];
  const sections = [...document.querySelectorAll('[data-star]')];
  const cur = { x: 0.42, y: 0.02, s: 1.25, chrome: 0, wire: 0, sway: 1, exp: 1, px: 0, roles: 0 };
  let vw = 0, vh = 0, halfH = 1, halfW = 1;
  const size = () => {
    vw = innerWidth; vh = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    halfH = Math.tan((camera.fov / 2) * Math.PI / 180) * camera.position.z;
    halfW = halfH * camera.aspect;
  };
  size();
  addEventListener('resize', size);

  // where the page is: each section's share of the middle band of the screen
  const target = () => {
    const keys = vw < 860 ? KM : vw < 1200 ? KN : K;
    const top = vh * 0.3, bot = vh * 0.7;
    const t = { x: 0, y: 0, s: 0, chrome: 0, wire: 0, sway: 0, exp: 0, px: 0, roles: 0 };
    let sum = 0;
    for (const sec of sections) {
      const b = sec.getBoundingClientRect();
      const w = Math.max(0, Math.min(bot, b.bottom) - Math.max(top, b.top)) / (bot - top);
      if (w <= 0) continue;
      const k = keys[sec.dataset.star] || keys.faq;
      for (const p of PROPS) t[p] += (k[p] === undefined ? (p === 'px' ? 0 : 1) : k[p]) * w;
      if (sec.dataset.star === 'roles') t.roles += w;
      sum += w;
    }
    if (!sum) return { ...K.outro, exp: 1, px: 0, roles: 0 };
    for (const p in t) t[p] /= sum;
    return t;
  };

  let pointerX = 0, pointerY = 0;
  if (!still) addEventListener('pointermove', (e) => { pointerX = e.clientX / vw - 0.5; pointerY = e.clientY / vh - 0.5; }, { passive: true });

  const pose = { x: 0, y: 0, z: 0 };
  let clock = 0, last = performance.now(), idle = false;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still) clock += dt;
    const t = target();
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    for (const p in t) cur[p] += (t[p] - cur[p]) * k;

    rig.position.set(cur.x * halfW, cur.y * halfH, 0);
    rig.scale.setScalar(cur.s);
    // a bounded sway (about 32 degrees either side of face-on), so the star always reads as a
    // star; in the roles it settles into the active role's own pose
    const sway = { x: Math.sin(clock * 0.31) * 0.12, y: Math.sin(clock * 0.42) * 0.56, z: 0 };
    const role = POSES[(window.csRole || 0) % POSES.length];
    const kp = still ? 1 : 1 - Math.exp(-dt * 3.2);
    for (const a of ['x', 'y', 'z']) {
      const want = (sway[a] * cur.sway + (a === 'x' ? cur.px : 0)) * (1 - cur.roles) + role[a] * cur.roles;
      pose[a] += (want - pose[a]) * kp;
    }
    body.rotation.set(pose.x, pose.y, pose.z);
    renderer.toneMappingExposure = 1.05 * cur.exp * (1 + ((role.exp || 1) - 1) * cur.roles);
    tilt.rotation.x += ((still ? 0 : pointerY * 0.2) - tilt.rotation.x) * k;
    tilt.rotation.y += ((still ? 0 : pointerX * 0.28) - tilt.rotation.y) * k;

    // the object fades over a short band (half to near-full), never lingering half-transparent
    const solid = Math.min(1, Math.max(0, (cur.chrome - 0.5) / 0.4));
    for (const sp of solids) {
      sp.mat.opacity = sp.base * solid;
      const blend = sp.base < 1 || solid < 0.999;
      if (sp.mat.transparent !== blend) { sp.mat.transparent = blend; sp.mat.needsUpdate = true; }
      if (sp.cut) sp.mat.alphaTest = Math.max(0.001, sp.cut * solid);   // the outline stays crisp while it fades
      sp.mesh.visible = solid > 0.01;
    }
    wireMat.opacity = cur.wire * 0.75;
    for (const w of wires) w.visible = cur.wire > 0.01;

    const visible = cur.chrome + cur.wire > 0.004;
    if (visible || !idle) renderer.render(scene, camera);
    idle = !visible;
    if (!still) requestAnimationFrame(frame);
  };
  if (still) {
    // no movement: draw the settled frame whenever a section crosses the middle of the screen
    const redraw = () => requestAnimationFrame(frame);
    const so = new IntersectionObserver(redraw, { rootMargin: '-30% 0px -30% 0px' });
    sections.forEach((s) => so.observe(s));
    addEventListener('resize', redraw);
    redraw();
  } else {
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); } });
  }
  cv.classList.add('is-ready');
}
