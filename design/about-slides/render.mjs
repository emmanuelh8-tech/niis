// Renders the About page's slides from deck.html with headless Chrome:
//   - the stacking slides (slide-NN, and flyer-NN for phones) from the page's own copy, and
//   - the African Regional Report (country-slide-NN, country-flyer-NN).
// Full-size PNGs go to about-slides/ (git-ignored); then export.py makes the site's WebP copies in
// public/img/about/slides and public/img/about/region.
//
//   node design/about-slides/render.mjs            all slides, 2x
//   node design/about-slides/render.mjs 0.5 prev   quick previews at half size, into prev/
//
// The licensed typefaces are read from public/fonts (delphin.*, sully-jonquieres.*); without them the
// free stand-ins (Fondamento, Marcellus) are drawn. Chrome and puppeteer-core come from this machine
// (Chrome's default path, puppeteer-core from niip-3d).
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const require = createRequire(join(root, 'niip-3d', 'package.json'));
const puppeteer = require('puppeteer-core');
const DPR = +(process.argv[2] || 2), OUT = process.argv[3] ? join(here, process.argv[3]) : join(root, 'about-slides');
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-first-run', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.setViewport({ width: 1700, height: 1450, deviceScaleFactor: DPR });
await page.goto(pathToFileURL(join(here, 'deck.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const licensed = await page.evaluate(() => ['Delphin', 'Sully-Jonquieres'].map((f) => f + ': ' + (document.fonts.check(`40px '${f}'`) && [...document.fonts].some((x) => x.family.replace(/'/g, '') === f && x.status === 'loaded') ? 'licensed file' : 'stand-in')));
console.log(licensed.join(', '));
let n = 0;
for (const set of ['', 'c']) {
  const count = await page.evaluate((s) => (s === 'c' ? window.DC : window.D).length, set);
  for (const fmt of ['slide', 'flyer']) {
    for (let i = 0; i < count; i++) {
      await page.evaluate((i, fmt, s) => window.render(i, fmt, s), i, fmt, set);
      await page.evaluate(() => Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })))));
      await page.evaluate(() => document.fonts.ready);
      await (await page.$('.s')).screenshot({ path: join(OUT, `${set ? 'country-' : ''}${fmt}-${String(i + 1).padStart(2, '0')}.png`) });
      n++;
    }
  }
}
console.log('rendered', n, 'into', OUT, errs.length ? errs : '');
await browser.close();
