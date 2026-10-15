"""Makes the site's WebP copies of the About slides from the full-size PNGs in about-slides/ (render.mjs):
public/img/about/slides (slide-NN 2400x1350, flyer-NN 1440x1800) and public/img/about/region (the same,
plus thumb-NN 816x459 for the folder's files). Needs Pillow.

    python design/about-slides/export.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SRC = os.path.join(ROOT, 'about-slides')
DST = os.path.join(ROOT, 'public', 'img', 'about')

n = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    im = Image.open(os.path.join(SRC, f)).convert('RGB')
    im = im.resize((2400, 1350) if 'slide' in f else (1440, 1800), Image.LANCZOS)
    if f.startswith('country-'):
        name, out = f[len('country-'):], os.path.join(DST, 'region')
        if 'slide' in f:
            im.resize((816, 459), Image.LANCZOS).save(os.path.join(out, name.replace('slide-', 'thumb-').replace('.png', '.webp')), 'WEBP', quality=82, method=6)
    else:
        name, out = f, os.path.join(DST, 'slides')
    im.save(os.path.join(out, name.replace('.png', '.webp')), 'WEBP', quality=84, method=6)
    n += 1
print('exported', n)
