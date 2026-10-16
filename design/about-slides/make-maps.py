"""Draws the outlines the slides set in their upper-left corner (maps.js), from world-atlas's countries-50m
TopoJSON (Natural Earth, public domain; https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json).

    python -I design/about-slides/make-maps.py path/to/countries-50m.json

Each map is a set of paths in its own box (the longest side 1000 units), every country flagged as the
subject (drawn stronger) or as context (fainter): one country; Senegal, Côte d'Ivoire and Togo among the
other ECOWAS states; Africa (the African Union); the twelve ECOWAS states among their neighbours.
"""
import json, math, os, sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'maps.js')
topo = json.load(open(SRC, encoding='utf-8'))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']

# the arcs, delta-decoded into longitude and latitude
arcs = []
for arc in topo['arcs']:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(ids):
    pts = []
    for i in ids:
        seg = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(seg if not pts else seg[1:])
    return pts

def polygons(geom):
    if geom['type'] == 'Polygon':
        return [[ring(r) for r in geom['arcs']]]
    if geom['type'] == 'MultiPolygon':
        return [[ring(r) for r in poly] for poly in geom['arcs']]
    return []

geoms = {g['properties']['name']: polygons(g) for g in topo['objects']['countries']['geometries']}

ECOWAS = ['Benin', 'Cabo Verde', "Côte d'Ivoire", 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Liberia', 'Nigeria', 'Senegal', 'Sierra Leone', 'Togo']
WEST_CONTEXT = ['Mali', 'Burkina Faso', 'Niger', 'Mauritania', 'Cameroon', 'Chad', 'Algeria', 'W. Sahara', 'Morocco', 'Eq. Guinea', 'Gabon', 'Central African Rep.']
NOT_AFRICA = {'Spain', 'Portugal', 'Italy', 'Greece', 'Malta', 'Cyprus', 'N. Cyprus', 'Turkey', 'Israel', 'Palestine', 'Jordan', 'Lebanon', 'Syria', 'Iraq',
              'Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Iran', 'France', 'Gibraltar', 'Monaco', 'San Marino', 'Vatican', 'India',
              'Maldives', 'Sri Lanka', 'Papua New Guinea', 'Fr. S. Antarctic Lands', 'Heard I. and McDonald Is.', 'Br. Indian Ocean Ter.', 'Albania', 'Macedonia', 'North Macedonia', 'Bulgaria',
              'Montenegro', 'Bosnia and Herz.', 'Croatia', 'Slovenia', 'Serbia', 'Kosovo', 'Georgia', 'Armenia', 'Azerbaijan', 'Pakistan', 'Afghanistan', 'Turkmenistan', 'Uzbekistan'}

def centroid(polys):
    pts = [p for poly in polys for p in poly[0]]
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)

AFRICA = sorted(n for n, polys in geoms.items() if polys and n not in NOT_AFRICA and (lambda c: -26 <= c[0] <= 58 and -36 <= c[1] <= 38)(centroid(polys)))

def build(subject, context=(), clip=None):
    """subject and context are lists of country names; clip drops tiny far islands (lon/lat box)."""
    items = [(n, True) for n in subject] + [(n, False) for n in context if n not in subject]
    shapes = []
    for name, hi in items:
        if name not in geoms:
            raise SystemExit('no country called %r' % name)
        for poly in geoms[name]:
            if clip and not all(clip[0] <= x <= clip[2] and clip[1] <= y <= clip[3] for x, y in poly[0]):
                continue
            shapes.append((poly, hi))
    lats = [y for poly, _ in shapes for r in poly for _, y in r]
    k = math.cos(math.radians((max(lats) + min(lats)) / 2))
    xs = [x * k for poly, _ in shapes for r in poly for x, _ in r]
    ys = [-y for poly, _ in shapes for r in poly for _, y in r]
    x0, y0, w, h = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
    s = 1000 / max(w, h)
    out = {'w': round(w * s), 'h': round(h * s), 'hi': [], 'lo': []}
    for poly, hi in shapes:
        d = ''
        for r in poly:
            pts, last = [], None
            for x, y in r:
                p = (round((x * k - x0) * s, 1), round((-y - y0) * s, 1))
                if p != last:
                    pts.append(p); last = p
            if len(pts) > 2:
                d += 'M' + 'L'.join('%g %g' % p for p in pts) + 'Z'
        (out['hi'] if hi else out['lo']).append(d)
    out['hi'] = ''.join(out['hi']); out['lo'] = ''.join(out['lo'])
    return out

MAPS = {
    'rw': build(['Rwanda']),
    'ke': build(['Kenya']),
    'ng': build(['Nigeria']),
    'gh': build(['Ghana']),
    'lr': build(['Liberia']),
    'trio': build(['Senegal', "Côte d'Ivoire", 'Togo'], [n for n in ECOWAS if n != 'Cabo Verde']),
    'africa': build(AFRICA, clip=(-26, -36, 52, 38)),
    'ecowas': build(ECOWAS, WEST_CONTEXT, clip=(-26, 3, 16, 24)),
}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Made by make-maps.py from world-atlas countries-50m (Natural Earth, public domain). Do not edit.\n')
    f.write('window.MAPS = ' + json.dumps(MAPS, separators=(',', ':')) + ';\n')
print('africa:', len(AFRICA), 'countries;', {k: (v['w'], v['h'], len(v['hi']) + len(v['lo'])) for k, v in MAPS.items()}, os.path.getsize(OUT) // 1024, 'KB')
