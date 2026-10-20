// pdfviewer.js: the document viewer on every research paper's and report's page, after the owner's
// pdf-viewer component (react-pdf), in plain JavaScript on PDF.js (served from /assets/vendor/pdfjs, so
// its worker runs on this origin). Page thumbnails in a sidebar that folds away; "Page n of N"; rotate
// either way; zoom in steps, from a list or to the width of the frame; and a search that marks its
// matches on the pages and steps from one page with a match to the next. Pages, and their thumbnails,
// are drawn as they come near the view, at the screen's own sharpness.
const BASE = '/assets/vendor/pdfjs/';
const ZOOMS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 4, 8];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

document.querySelectorAll('[data-pdf]').forEach((el) => {
  view(el).catch((err) => {
    console.error('[pdfviewer]', err);
    el.classList.add('is-failed');
    el.querySelector('.pv-load').hidden = true;
    el.querySelector('.pv-msg').hidden = false;
  });
});

async function view(el) {
  const v = el.dataset.v || '';
  const lib = await import(`${BASE}pdf.min.mjs?v=${v}`);
  lib.GlobalWorkerOptions.workerSrc = `${BASE}pdf.worker.min.mjs?v=${v}`;
  const doc = await lib.getDocument({ url: el.dataset.pdf, standardFontDataUrl: `${BASE}standard_fonts/`, isEvalSupported: false }).promise;
  const N = doc.numPages;
  const pages = await Promise.all(Array.from({ length: N }, (_, i) => doc.getPage(i + 1)));

  const $ = (s) => el.querySelector(s);
  const scroll = $('.pv-scroll'), box = $('.pv-pages'), thumbs = $('.pv-thumbs');
  const atEl = $('[data-pv-at]'), zoomSel = $('[data-pv-zoom]'), findIn = $('[data-pv-find]'), hitsEl = $('[data-pv-hits]');
  $('[data-pv-n]').textContent = N;
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  const pad = () => parseFloat(getComputedStyle(box).paddingLeft) || 0;   // the space round the pages (CSS)
  const bar = $('.pv-bar');
  const barH = () => el.style.setProperty('--pv-bar-h', `${bar.offsetHeight}px`);   // where the page list opens on a phone

  let rot = 0, zoom = 'fit', cur = 0, query = '', texts = null;
  const turn = (p) => (p.rotate + rot) % 360;
  const base = (p) => p.getViewport({ scale: 1, rotation: turn(p) });
  // the width that fills the frame, from the widest page as it is turned
  const fit = () => Math.max(.1, (scroll.clientWidth - pad() * 2) / Math.max(...pages.map((p) => base(p).width)));
  const scale = () => (zoom === 'fit' ? fit() : zoom);
  const key = () => `${scale().toFixed(4)}/${rot}`;

  // a slot for each page, sized before it is drawn, so the scroll length is right from the start
  const slots = pages.map((p, i) => {
    const s = document.createElement('div');
    s.className = 'pv-page'; s.dataset.pageNumber = i + 1;
    s.setAttribute('role', 'img'); s.setAttribute('aria-label', `Page ${i + 1} of ${N}`);
    box.appendChild(s);
    return { el: s, page: p, key: '', busy: '', task: null, text: null, spans: null, strs: null };
  });
  function size() {
    const k = scale();
    slots.forEach((s) => { const vp = base(s.page); s.el.style.width = `${vp.width * k}px`; s.el.style.height = `${vp.height * k}px`; });
  }

  async function draw(s) {
    const want = key();
    if (s.key === want || s.busy === want) return;
    s.busy = want;
    if (s.task) s.task.cancel();
    const vp = s.page.getViewport({ scale: scale(), rotation: turn(s.page) }), r = dpr();
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * r); canvas.height = Math.floor(vp.height * r);
    canvas.style.width = `${vp.width}px`; canvas.style.height = `${vp.height}px`;
    s.task = s.page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: r !== 1 ? [r, 0, 0, r, 0, 0] : null });
    try { await s.task.promise; } catch (err) { if (err instanceof lib.RenderingCancelledException) return; throw err; }
    if (s.busy !== want) return;
    // the text over the picture, for selecting and for the search
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    s.el.style.setProperty('--scale-factor', vp.scale);
    s.el.style.setProperty('--total-scale-factor', vp.scale);
    s.text = s.text || await s.page.getTextContent();
    const tl = new lib.TextLayer({ textContentSource: s.text, container: layer, viewport: vp });
    await tl.render();
    if (s.busy !== want) return;
    s.spans = tl.textDivs; s.strs = tl.textContentItemsStr;
    s.el.replaceChildren(canvas, layer);
    s.key = want; s.busy = '';
    mark(s);
  }
  const near = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) draw(slots[+e.target.dataset.pageNumber - 1]); }),
    { root: scroll, rootMargin: '600px 0px' });
  slots.forEach((s) => near.observe(s.el));
  // a change of zoom or turn redraws what is in view (the rest when it comes near)
  function redraw() {
    const s = slots[cur], into = s.el.offsetHeight ? (scroll.scrollTop - s.el.offsetTop) / s.el.offsetHeight : 0;
    size();
    scroll.scrollTop = s.el.offsetTop + into * s.el.offsetHeight;
    slots.forEach((x) => { x.key = ''; near.unobserve(x.el); near.observe(x.el); });
    sizeThumbs(); thumbSlots.forEach((t) => { t.key = ''; seen.unobserve(t.el); seen.observe(t.el); });
    showZoom();
  }

  // thumbnails: each a small drawing of its page, and a way to it
  const TW = 150;
  const thumbSlots = pages.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pv-thumb'; b.setAttribute('aria-label', `Go to page ${i + 1}`);
    b.innerHTML = `<span class="pv-thumb-img"></span><span class="pv-thumb-n">${i + 1}</span>`;
    b.addEventListener('click', () => { go(i); if (matchMedia('(max-width: 760px)').matches) side(false); });
    thumbs.appendChild(b);
    return { el: b, img: b.firstChild, page: p, key: '' };
  });
  function sizeThumbs() { thumbSlots.forEach((t) => { const vp = base(t.page); t.img.style.height = `${TW * vp.height / vp.width}px`; }); }
  async function drawThumb(t) {
    if (t.key === String(rot)) return;
    t.key = String(rot);
    const vp0 = base(t.page), vp = t.page.getViewport({ scale: TW / vp0.width, rotation: turn(t.page) }), r = dpr();
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width * r); c.height = Math.floor(vp.height * r);
    await t.page.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: r !== 1 ? [r, 0, 0, r, 0, 0] : null }).promise;
    t.img.replaceChildren(c);
  }
  const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) drawThumb(thumbSlots.find((t) => t.el === e.target)); }),
    { root: thumbs, rootMargin: '300px 0px' });
  thumbSlots.forEach((t) => seen.observe(t.el));

  // the page at the middle of the frame is the current one
  function go(i) { scroll.scrollTo({ top: slots[i].el.offsetTop - pad() / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  function track() {
    const mid = scroll.scrollTop + scroll.clientHeight * .4;
    let i = slots.findIndex((s) => s.el.offsetTop + s.el.offsetHeight > mid);
    if (i < 0) i = N - 1;
    if (i === cur && atEl.textContent === String(i + 1)) return;
    cur = i; atEl.textContent = i + 1;
    thumbSlots.forEach((t, k) => t.el.classList.toggle('is-on', k === i));
    const t = thumbSlots[i].el;
    if (!el.classList.contains('is-side-off') && (t.offsetTop < thumbs.scrollTop || t.offsetTop + t.offsetHeight > thumbs.scrollTop + thumbs.clientHeight)) {
      thumbs.scrollTop = t.offsetTop - thumbs.clientHeight / 3;
    }
  }
  let ticking = 0;
  scroll.addEventListener('scroll', () => { if (!ticking) ticking = requestAnimationFrame(() => { ticking = 0; track(); }); }, { passive: true });

  // the toolbar
  // (a change in the frame's width redraws the pages on its own, below; on a phone the list lies over them)
  function side(on) {
    el.classList.toggle('is-side-off', !on);
    $('[data-pv="side"]').setAttribute('aria-pressed', String(on));
  }
  $('[data-pv="side"]').addEventListener('click', () => side(el.classList.contains('is-side-off')));
  $('[data-pv="ccw"]').addEventListener('click', () => { rot = (rot + 270) % 360; redraw(); });
  $('[data-pv="cw"]').addEventListener('click', () => { rot = (rot + 90) % 360; redraw(); });
  $('[data-pv="out"]').addEventListener('click', () => { const k = scale(); const z = [...ZOOMS].reverse().find((x) => x < k - .001); if (z) { zoom = z; redraw(); } });
  $('[data-pv="in"]').addEventListener('click', () => { const k = scale(); const z = ZOOMS.find((x) => x > k + .001); if (z) { zoom = z; redraw(); } });
  zoomSel.addEventListener('change', () => { zoom = zoomSel.value === 'fit' ? 'fit' : Number(zoomSel.value); redraw(); });
  function showZoom() {
    const k = scale();
    zoomSel.value = zoom === 'fit' ? 'fit' : String(zoom);
    zoomSel.querySelector('option[value="fit"]').textContent = `Fit width (${Math.round(k * 100)}%)`;
    $('[data-pv="out"]').disabled = k <= ZOOMS[0] + .001;
    $('[data-pv="in"]').disabled = k >= ZOOMS[ZOOMS.length - 1] - .001;
  }

  // the search: the matches are marked in the text over the pages; Enter goes to the next page with one
  const findBtn = $('[data-pv="find"]'), pop = $('.pv-find');
  function openFind(on) {
    pop.hidden = !on; findBtn.setAttribute('aria-expanded', String(on));
    if (on) findIn.focus();
  }
  findBtn.addEventListener('click', () => openFind(pop.hidden));
  findIn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { openFind(false); findBtn.focus(); }
    if (e.key === 'Enter') { e.preventDefault(); next(e.shiftKey ? -1 : 1); }
  });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !findBtn.contains(e.target)) openFind(false); });
  let wait = 0;
  findIn.addEventListener('input', () => { clearTimeout(wait); wait = setTimeout(search, 180); });
  const pattern = () => new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  function mark(s) {
    if (!s.spans) return;
    const re = query ? pattern() : null;
    s.spans.forEach((span, k) => {
      const str = s.strs[k] || '';
      if (re && re.test(str)) { re.lastIndex = 0; span.innerHTML = esc(str).replace(pattern(), (m) => `<mark>${m}</mark>`); span.dataset.hit = '1'; }
      else if (span.dataset.hit) { span.textContent = str; delete span.dataset.hit; }
      if (re) re.lastIndex = 0;
    });
  }
  let found = [];
  async function search() {
    query = findIn.value.trim();
    if (!query) { found = []; hitsEl.textContent = ''; slots.forEach(mark); return; }
    texts = texts || await Promise.all(pages.map((p, i) => Promise.resolve(slots[i].text || p.getTextContent()).then((t) => { slots[i].text = t; return t.items.map((x) => x.str).join(' '); })));
    const re = pattern();
    found = texts.map((t, i) => [i, (t.match(re) || []).length]).filter(([, n]) => n);
    const total = found.reduce((a, [, n]) => a + n, 0);
    hitsEl.textContent = total ? `${total} match${total === 1 ? '' : 'es'} on ${found.length} page${found.length === 1 ? '' : 's'}` : 'No matches';
    slots.forEach(mark);
    if (found.length && !found.some(([i]) => i === cur)) go(found[0][0]);
  }
  function next(dir) {
    if (!found.length) return;
    const after = dir > 0 ? found.find(([i]) => i > cur) || found[0] : [...found].reverse().find(([i]) => i < cur) || found[found.length - 1];
    go(after[0]);
  }

  // on a narrow screen the sidebar starts folded away and opens over the pages
  if (matchMedia('(max-width: 760px)').matches) el.classList.add('is-side-off'), $('[data-pv="side"]').setAttribute('aria-pressed', 'false');
  size(); sizeThumbs(); showZoom(); track();
  let lastW = scroll.clientWidth;
  new ResizeObserver(() => { barH(); if (scroll.clientWidth !== lastW) { lastW = scroll.clientWidth; if (zoom === 'fit') redraw(); } }).observe(scroll);
  barH();
  el.classList.add('is-ready');
  $('.pv-load').hidden = true;
}
