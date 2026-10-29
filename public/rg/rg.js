/*
  Derived from the free "Hushkey" product landing page template by 8B
  https://8b.com/templates/hushkey/ · https://github.com/8bsite/product-landing-page-template (commit d232dae)
  MIT License, Copyright (c) 2026 8B (https://8b.com). Permission is hereby granted, free of charge, to any
  person obtaining a copy of this software and associated documentation files (the "Software"), to deal in
  the Software without restriction, including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following conditions: The above copyright notice and this
  permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS
  PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
  CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
  DEALINGS IN THE SOFTWARE.
  Fonts: Mozilla Headline and Mozilla Text (Google Fonts, SIL OFL 1.1). Libraries, self-hosted in
  public/vendor: GSAP 3.13.0 with ScrollTrigger and SplitText (GreenSock standard "no charge" license),
  Lenis 1.3.27 (MIT). The template's Unsplash photos are not used; the photos are NIIP's own slots.
*/
/* ---- section-script:nav ---- */
(() => {
  const nav = document.getElementById('nav');
  const openButton = nav.querySelector('.nav__open');
  const closeButton = nav.querySelector('.nav__close');
  const menu = document.getElementById('menu');
  const narrow = window.matchMedia('(max-width: 899px)');
  const setOpen = open => {
    if (open) nav.setAttribute('data-open', ''); else nav.removeAttribute('data-open');
    openButton.setAttribute('aria-expanded', String(open));
    if (open) { window.lenis?.stop(); closeButton.focus(); } else { window.lenis?.start(); }
  };
  openButton.addEventListener('click', () => setOpen(true));
  closeButton.addEventListener('click', () => { setOpen(false); openButton.focus(); });
  menu.addEventListener('click', event => { if (event.target.closest('a') && nav.hasAttribute('data-open')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (!nav.hasAttribute('data-open')) return;
    if (event.key === 'Escape') { setOpen(false); openButton.focus(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll('a, button')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  narrow.addEventListener('change', () => { if (!narrow.matches && nav.hasAttribute('data-open')) setOpen(false); });
})();
/* ---- section-script:hero ---- */
(() => {
  const hero = document.getElementById('hero');
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) hero.removeAttribute('data-idle'); else hero.setAttribute('data-idle', '');
  }).observe(hero);
})();
/* ---- section-script:states ---- */
(() => {
  // NIIP: the six area keys toggle; All six presses every one, Clear lifts them all, and the areas that
  // are down are written into the sign-up form's Research areas field at the foot of the page.
  const keys = [...document.querySelectorAll('#states .m-key-2')];
  const areas = keys.filter(key => key.hasAttribute('aria-pressed'));
  const field = document.getElementById('join-groups');
  const sync = () => { if (field) field.value = areas.filter(key => key.getAttribute('aria-pressed') === 'true').map(key => key.dataset.area).join(', '); };
  keys.forEach(key => key.addEventListener('click', () => {
    if (key.hasAttribute('data-all-off')) areas.forEach(area => area.setAttribute('aria-pressed', 'false'));
    else if (key.hasAttribute('data-all-on')) areas.forEach(area => area.setAttribute('aria-pressed', 'true'));
    else key.setAttribute('aria-pressed', String(key.getAttribute('aria-pressed') !== 'true'));
    sync();
  }));
})();
/* ---- section-script:contact ---- */
(() => {
  // NIIP: the site keeps no sign-up list yet, so a valid form is written out as an email to the program
  // (the address in data-to) and opens in the reader's own email app, to send from there.
  const form = document.querySelector('#contact .contact__form');
  const status = form.querySelector('.contact__status');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const valid = form.checkValidity();
    status.textContent = valid ? form.dataset.sent : form.dataset.invalid;
    if (!valid) { form.querySelector(':invalid')?.focus(); return; }
    const data = new FormData(form), value = name => String(data.get(name) || '').trim();
    const lines = ['Name: ' + value('name'), 'Email: ' + value('email')];
    if (value('org')) lines.push('Institution: ' + value('org'));
    lines.push('Research areas: ' + (value('groups') || 'not chosen yet'), '', value('message'));
    location.href = 'mailto:' + form.dataset.to + '?subject=' + encodeURIComponent(value('topic') + ' · NIIP Research Groups') + '&body=' + encodeURIComponent(lines.join('\n'));
  });
})();
/* ---- motion-queue ---- */
(() => {
  'use strict';
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const parsed = document.readyState === 'loading' ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  const ready = () => Promise.all([fonts, parsed]).then(() => firsts);
  const nextTask = () => window.scheduler?.yield?.() ?? new Promise(resolve => setTimeout(resolve));
  const refresh = () => {
    if (typeof window.refreshScroll === 'function') return window.refreshScroll();
    window.ScrollTrigger?.sort(); window.ScrollTrigger?.refresh();
  };
  const run = (setup, name) => {
    for (const trigger of window.ScrollTrigger?.getAll() || []) if (!trigger.end && window.ScrollTrigger.getAll().includes(trigger)) trigger.refresh(0, 1);
    const context = window.gsap.context(() => {});
    const log = new MutationObserver(() => {});
    log.observe(document.documentElement, { attributes: true, attributeOldValue: true, subtree: true });
    let failure = null, records;
    try { context.add(() => { try { setup(); } catch (error) { failure = error; } }); }
    finally { records = log.takeRecords(); log.disconnect(); }
    if (!failure) return true;
    try { context.revert(); } catch (error) { console.error(name, 'revert failed', error); }
    for (const { target, attributeName, oldValue } of records.reverse()) {
      const now = target.getAttribute(attributeName);
      if (oldValue == null) { if (now != null) target.removeAttribute(attributeName); }
      else if (now !== oldValue) target.setAttribute(attributeName, oldValue);
    }
    console.error(name, failure);
    return false;
  };
  let firsts = Promise.resolve(), tail = null, pending = 0, lazy = null, building = 0;
  window.queueMotion = (setup, { first = false, near, id } = {}) => {
    if (!window.gsap || typeof setup !== 'function') return;
    const name = id || document.currentScript?.getAttribute('data-8b-part') || 'motion';
    if (near instanceof Element && window.IntersectionObserver) {
      const watch = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        watch.disconnect();
        building++;
        lazy = (lazy || ready()).then(nextTask).then(() => run(setup, name)).finally(() => { if (!--building) refresh(); });
      }, { rootMargin: '100% 0px' });
      watch.observe(near);
      return;
    }
    if (first) firsts = firsts.then(() => fonts).then(() => { if (!run(setup, name)) refresh(); });
    else {
      pending++;
      tail = (tail || ready()).then(nextTask).then(() => run(setup, name))
        .finally(() => { if (!--pending) refresh(); });
    }
    window.motionReady = Promise.all([firsts, tail]);
  };
  window.adjacent = (a, b) => {
    const order = [...document.querySelectorAll('[data-8b-section]')].filter(section => section.getAttribute('data-8b-section') !== 'navigation').map(section => section.id);
    return order.indexOf(a) >= 0 && order[order.indexOf(a) + 1] === b;
  };
})();
/* ---- page-init ---- */
gsap.registerPlugin(ScrollTrigger, SplitText);
function refreshScroll() {
  const bar = document.querySelector('#nav .nav__bar');
  if (bar && window.lenis) window.lenis.options.anchors = { offset: -(bar.getBoundingClientRect().bottom + 16) };
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}
gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  const bar = document.querySelector('#nav .nav__bar');
  const lenis = window.lenis = new Lenis({ lerp: .085, wheelMultiplier: .9, anchors: { offset: -((bar ? bar.getBoundingClientRect().bottom : 80) + 16) } });
  const tick = time => lenis.raf(time * 1000);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => { gsap.ticker.remove(tick); gsap.ticker.lagSmoothing(500, 33); lenis.destroy(); window.lenis = null; };
});
/* ---- motion ---- */
const effects = {
  deboss(element, vars = {}) {
    const rest = getComputedStyle(element).textShadow;
    const timeline = gsap.timeline(vars);
    if (rest && rest !== 'none') timeline.fromTo(element, { textShadow: motionHelpers.flipShadow(rest) }, { textShadow: rest, duration: .9, ease: 'power2.inOut' }, 0);
    return timeline.fromTo(element, { y: -8 }, { y: 0, duration: .9, ease: 'power3.out' }, 0);
  },
  rise(element, vars = {}) {
    return gsap.timeline(vars).fromTo(element, { scale: .9, y: 26 }, { scale: 1, y: 0, duration: 1, ease: 'power3.out' });
  },
  contour(element, vars = {}) {
    const timeline = gsap.timeline(vars);
    const paths = element.matches('path, line, circle, rect') ? [element] : [...element.querySelectorAll('path, line')];
    paths.forEach(path => {
      const length = path.getTotalLength ? path.getTotalLength() : 0;
      if (length) timeline.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0);
    });
    element.querySelectorAll('.m-tick__line').forEach(line => timeline.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: .7, ease: 'power2.out' }, 0));
    return timeline;
  }
};
const motionHelpers = {
  press(key, on = true, duration = .3) {
    const dent = key.querySelector('[class$="__dent"]');
    const cap = key.querySelector('[class$="__cap"]');
    return gsap.timeline()
      .to(dent, { opacity: on ? 1 : 0, duration, ease: 'power1.inOut' }, 0)
      .to(cap, { scale: on ? .965 : 1, duration, ease: 'power1.inOut' }, 0);
  },
  flipShadow(value) {
    return value.split(/,(?![^(]*\))/).map(part => part.replace(/(-?[\d.]+)px\s+(-?[\d.]+)px/, (match, x, y) => `${x}px ${-parseFloat(y)}px`)).join(',');
  },
  contourPath(c1, r1, c2, r2, v = .5, handle = 2.4) {
    const f = n => Math.round(n * 100) / 100;
    const point = p => `${f(p[0])} ${f(p[1])}`;
    const circle = (c, r) => `M ${f(c[0] - r)} ${f(c[1])} a ${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0 Z`;
    if (r2 > r1) return motionHelpers.contourPath(c2, r2, c1, r1, v, handle);
    const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
    if (d <= r1 - r2 + .05) return circle(c1, r1);
    if (d > r1 + r2 * 2.5) return `${circle(c1, r1)} ${circle(c2, r2)}`;
    const clamp = n => Math.min(1, Math.max(-1, n));
    let u1 = 0, u2 = 0;
    if (d < r1 + r2) {
      u1 = Math.acos(clamp((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d)));
      u2 = Math.acos(clamp((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d)));
    }
    const angle = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
    const spread = Math.acos(clamp((r1 - r2) / d));
    const a1 = angle + u1 + (spread - u1) * v, a2 = angle - u1 - (spread - u1) * v;
    const a3 = angle + Math.PI - u2 - (Math.PI - u2 - spread) * v, a4 = angle - Math.PI + u2 + (Math.PI - u2 - spread) * v;
    const at = (c, a, r) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    const p1 = at(c1, a1, r1), p2 = at(c1, a2, r1), p3 = at(c2, a3, r2), p4 = at(c2, a4, r2);
    const k = Math.min(v * handle, Math.hypot(p1[0] - p3[0], p1[1] - p3[1]) / (r1 + r2)) * Math.min(1, d * 2 / (r1 + r2));
    const h1 = at(p1, a1 - Math.PI / 2, r1 * k), h2 = at(p2, a2 + Math.PI / 2, r1 * k);
    const h3 = at(p3, a3 + Math.PI / 2, r2 * k), h4 = at(p4, a4 - Math.PI / 2, r2 * k);
    return `M ${point(p1)} C ${point(h1)} ${point(h3)} ${point(p3)} A ${f(r2)} ${f(r2)} 0 ${d > r1 ? 1 : 0} 0 ${point(p4)} C ${point(h4)} ${point(h2)} ${point(p2)} A ${f(r1)} ${f(r1)} 0 1 0 ${point(p1)} Z`;
  }
};
['deboss', 'rise', 'contour'].forEach(name => {
  document.querySelectorAll('[data-8b-section]').forEach(section => {
    const elements = [...section.querySelectorAll(`[data-8b-motion~="${name}"]`)];
    if (!elements.length) return;
    const id = `effect:${name}:${section.id}`;
    queueMotion(() => gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      elements.forEach((element, index) => ScrollTrigger.create({
        id: `${id}:${index}`, trigger: element, start: 'top 88%', once: true,
        animation: effects[name](element, { delay: name === 'rise' ? (index % 3) * .08 : 0 })
      }));
    }), { first: section.getBoundingClientRect().top < innerHeight, id });
  });
});
/* ---- scene:hero ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    if (!adjacent('hero', 'states')) return;
    const hero = document.getElementById('hero');
    const stage = hero.querySelector('.hero__stage');
    const panel = hero.querySelector('.hero__panel');
    const ring = document.querySelector('#states .states__slot');
    const order = ['.hero__k-up', '.hero__k-left', '.hero__k-ok', '.hero__k-right', '.hero__k-down', '.hero__seg .m-key', '.hero__k-play', '.hero__k-pause', '.hero__steps .m-key:not(.is-on)'];
    const keys = order.flatMap(selector => [...hero.querySelectorAll(selector)]);
    const sink = () => {
      const most = innerHeight * .26;
      if (!ring) return most;
      const top = ring.getBoundingClientRect().top + (parseFloat(getComputedStyle(ring, '::before').top) || 0);
      return Math.max(0, Math.min(most, top - stage.getBoundingClientRect().bottom - 18));
    };
    gsap.set(panel, { willChange: 'transform' });
    const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      id: 'hero:exit', trigger: hero, start: 'bottom bottom', end: 'bottom 25%', scrub: true, invalidateOnRefresh: true
    } });
    timeline.fromTo(panel, { y: 0, scale: 1 }, { y: sink, scale: .82, transformOrigin: '50% 100%', duration: 1 }, 0);
    keys.forEach((key, index) => timeline.add(motionHelpers.press(key, true, .3), .04 + index * (.62 / keys.length)));
  });
}, { first: true, id: 'scene:hero' });
/* ---- scene:states ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    if (!adjacent('hero', 'states')) return;
    const states = document.getElementById('states');
    const keys = [...states.querySelectorAll('.states__keys .m-key-2')];
    const columns = () => getComputedStyle(states.querySelector('.states__keys')).gridTemplateColumns.split(' ').length;
    const layer = on => keys.forEach(key => { key.style.willChange = on ? 'transform' : ''; });
    const hint = self => layer(self.progress < 1);
    layer(true);
    const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      id: 'states:entry', trigger: states, start: 'top bottom', end: 'top 25%', scrub: true, invalidateOnRefresh: true,
      onEnter: hint, onLeave: hint, onEnterBack: hint, onLeaveBack: hint, onRefresh: hint
    } });
    const count = columns();
    keys.forEach((key, index) => {
      const wave = (index % count) + Math.floor(index / count);
      timeline.fromTo(key, { scale: .58, y: 34 }, { scale: 1, y: 0, duration: .5, ease: 'power2.out' }, .08 + wave * .09);
    });
    timeline.to({}, { duration: .01 }, 1);
    return () => layer(false);
  });
}, { first: true, id: 'scene:states' });
/* ---- scene:modes ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const modes = document.getElementById('modes');
    const track = modes.querySelector('.modes__track');
    const items = [...modes.querySelectorAll('.modes__item')];
    const keyFor = item => modes.querySelector(`.modes__k-${item.dataset.dir}`);
    const from = { up: 'inset(0% 0% 100% 0%)', right: 'inset(0% 0% 0% 100%)', down: 'inset(100% 0% 0% 0%)', left: 'inset(0% 100% 0% 0%)' };
    modes.setAttribute('data-stage', '');
    const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      id: 'modes', trigger: track, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true
    } });
    timeline.add(motionHelpers.press(keyFor(items[0]), true, .25), 0);
    items.slice(1).forEach((item, index) => {
      const at = .55 + index * 1.25;
      timeline.add(motionHelpers.press(keyFor(items[index]), false, .2), at)
        .add(motionHelpers.press(keyFor(item), true, .2), at + .08)
        .fromTo(item, { clipPath: from[item.dataset.dir] || from.right }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .85, ease: 'power2.inOut' }, at + .2)
        .fromTo(item.querySelector('img'), { scale: 1.14 }, { scale: 1, duration: .85, ease: 'power2.out' }, at + .2)
        .set(item, { clipPath: 'none' }, at + 1.06);
    });
    timeline.to({}, { duration: .35 });
    return () => modes.removeAttribute('data-stage');
  });
}, { id: 'scene:modes' });
/* ---- scene:dimmer ---- */
queueMotion(() => {
  gsap.matchMedia().add({
    wide: '(prefers-reduced-motion: no-preference) and (min-width: 900px)',
    narrow: '(prefers-reduced-motion: no-preference) and (max-width: 899px)'
  }, context => {
    const rig = document.querySelector('#dimmer .dimmer__rig');
    const img = rig.querySelector('.dimmer__photo img');
    const groove = rig.querySelector('.dimmer__groove');
    const thumb = rig.querySelector('.dimmer__thumb');
    const plus = rig.querySelector('.dimmer__plus');
    const wide = context.conditions.wide;
    const travel = () => wide ? groove.clientHeight - 16 - thumb.offsetHeight : -(groove.clientWidth - 16 - thumb.offsetWidth);
    const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      id: 'dimmer', trigger: rig, start: 'top 85%', end: 'top 14%', scrub: true, invalidateOnRefresh: true
    } });
    timeline.fromTo(img, { filter: 'grayscale(1) brightness(0.34)' }, { filter: 'grayscale(0) brightness(1)', duration: 1, ease: 'power1.in' }, 0)
      .fromTo(thumb, wide ? { y: travel } : { x: travel }, wide ? { y: 0, duration: 1 } : { x: 0, duration: 1 }, 0)
      .add(motionHelpers.press(plus, true, .08), 0)
      .add(motionHelpers.press(plus, false, .08), .92);
  });
}, { id: 'scene:dimmer' });
/* ---- scene:chords ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const chords = document.getElementById('chords');
    const track = chords.querySelector('.chords__track');
    const art = chords.querySelector('.chords__art');
    const a = art.querySelector('.chords__a');
    const b = art.querySelector('.chords__b');
    const path = art.querySelector('.chords__contour path');
    const result = chords.querySelector('.chords__result');
    const restPath = path.getAttribute('d');
    const A = { x: 20, y: 15, r: 10.2 };
    const B = { x: 12.35, y: 25.51, r: 6.1 };
    let em = parseFloat(getComputedStyle(art).fontSize) || 10;
    const spread = () => Math.min(17, innerWidth / em * .3);
    const draw = () => {
      const ax = A.x + gsap.getProperty(a, 'x') / em, ay = A.y + gsap.getProperty(a, 'y') / em;
      const bx = B.x + gsap.getProperty(b, 'x') / em, by = B.y + gsap.getProperty(b, 'y') / em;
      path.setAttribute('d', motionHelpers.contourPath([ax, ay], A.r, [bx, by], B.r));
    };
    chords.setAttribute('data-stage', '');
    const timeline = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: draw, scrollTrigger: {
      id: 'chords', trigger: track, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true,
      onRefreshInit: () => { em = parseFloat(getComputedStyle(art).fontSize) || em; }, onRefresh: draw
    } });
    timeline.fromTo(a, { x: () => spread() * em * .5, y: () => -3 * em }, { x: 0, y: 0, duration: .72, ease: 'power1.inOut' }, 0)
      .fromTo(b, { x: () => -spread() * em, y: () => -9 * em }, { x: 0, y: 0, duration: .72, ease: 'power2.inOut' }, 0)
      .fromTo([a, b].map(key => key.querySelector('.m-key__dent')), { opacity: 0 }, { opacity: 1, duration: .08 }, .78)
      .fromTo([a, b].map(key => key.querySelector('.m-key__cap')), { scale: 1 }, { scale: .965, duration: .08 }, .78)
      .fromTo(result, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .14, ease: 'power2.out' }, .82)
      .to({}, { duration: .04 }, .96);
    draw();
    return () => { chords.removeAttribute('data-stage'); path.setAttribute('d', restPath); };
  });
}, { id: 'scene:chords' });
/* ---- scene:editions ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const editions = document.getElementById('editions');
    editions.querySelectorAll('.editions__item').forEach((item, index) => {
      gsap.fromTo(item.querySelector('.editions__panel'), { rotateX: 66, y: 60, scale: .9 }, { rotateX: 0, y: 0, scale: 1, ease: 'none', scrollTrigger: {
        id: `editions:panel-${index}`, trigger: item, start: 'top 94%', end: 'top 40%', scrub: true
      } });
    });
    if (adjacent('editions', 'faq')) {
      const key = editions.querySelector('.editions__key');
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
        id: 'editions:exit', trigger: editions, start: 'bottom bottom', end: 'bottom 30%', scrub: true
      } })
        .add(motionHelpers.press(key, true, .16), 0)
        .fromTo(key, { y: 0 }, { y: 8, duration: .16, ease: 'power2.out' }, 0)
        .to({}, { duration: .84 }, .16);
    }
  });
}, { id: 'scene:editions' });
/* ---- scene:faq ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    if (!adjacent('editions', 'faq')) return;
    const faq = document.getElementById('faq');
    const flood = faq.querySelector('.faq__flood');
    const key = document.querySelector('#editions .editions__key');
    let geo = { x: 0, reach: 0, r0: 40, mid: 600, r1: 2000 };
    const measure = () => {
      const keyBox = key.getBoundingClientRect();
      const faqBox = faq.getBoundingClientRect();
      const x = keyBox.left + keyBox.width / 2 - faqBox.left;
      const reach = Math.max(0, faqBox.top - (keyBox.top + keyBox.height / 2 - gsap.getProperty(key, 'y')));
      geo = { x, reach, r0: keyBox.width * .42, mid: Math.max(x, faqBox.width - x) * 1.08, r1: Math.hypot(Math.max(x, faqBox.width - x), reach + faqBox.height) + 2 };
      faq.style.setProperty('--faq-reach', `${reach}px`);
    };
    faq.setAttribute('data-flood', '');
    measure();
    const clip = radius => `circle(${radius}px at ${geo.x}px 0px)`;
    const split = Math.min(.34, Math.max(.1, faq.clientWidth / 3600));
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      id: 'faq:entry', trigger: faq, start: 'top bottom', end: 'top 30%', scrub: true, invalidateOnRefresh: true, onRefreshInit: measure
    } })
      .fromTo(flood, { clipPath: () => clip(geo.r0) }, { clipPath: () => clip(geo.mid), duration: split, ease: 'sine.in' }, 0)
      .fromTo(flood, { clipPath: () => clip(geo.mid) }, { clipPath: () => clip(geo.r1), duration: 1 - split, ease: 'power2.out', immediateRender: false }, split)
      .set(flood, { clipPath: 'none' }, 1);
    return () => { faq.removeAttribute('data-flood'); faq.style.removeProperty('--faq-reach'); };
  });
}, { id: 'scene:faq' });
/* ---- scene:footer ---- */
queueMotion(() => {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const footer = document.getElementById('footer');
    const mark = footer.querySelector('.footer__mark');
    const split = SplitText.create(mark, { type: 'chars' });
    const rest = getComputedStyle(mark).textShadow;
    const raised = motionHelpers.flipShadow(rest);
    const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      id: 'footer', trigger: footer, start: 'top 85%', end: 'bottom bottom', scrub: true
    } });
    const restColor = getComputedStyle(mark).color;
    const liftColor = getComputedStyle(document.documentElement).getPropertyValue('--color-8').trim();
    split.chars.forEach((char, index) => timeline.fromTo(char, { y: '-0.16em', color: liftColor, textShadow: raised }, { y: 0, color: restColor, textShadow: rest, duration: .36, ease: 'power2.inOut' }, index * .1));
    return () => split.revert();
  });
}, { near: document.getElementById('footer'), id: 'scene:footer' });
