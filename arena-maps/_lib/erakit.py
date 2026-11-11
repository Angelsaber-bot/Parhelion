"""Authoring kit for the three era arenas (LISHAN, SUNTEMPLE, ORLEANS), 2026-11.

Builds on chapterkit: the same map.json objects are both the authoritative collision
and the frame the art is modelled inside. This kit adds
  * extent-based object helpers with an art tag per object (`Era.B`, `Era.R`),
  * placement of a modelled template many times (`place`), so a rank of statues or a
    colonnade is one carefully built form repeated, not a box per figure,
  * sculpted forms shared by the three maps (lathes, stairs, arches, roofs, figures),
  * deterministic material synthesis with coursed masonry, rammed earth, timber,
    plaster, tile and metal surfaces (Pillow; no outside imagery).
All dimensions are metres. Nothing here is used by the older maps.
"""
from pathlib import Path
import json, math, random, hashlib
from glbkit import Mesh
from chapterkit import Chapter, mat, beam, cone, frustum, merge


# ------------------------------------------------------------------ objects
class Era(Chapter):
    def __init__(self, root, id, name, width, depth, preset, palette, height=12, lowest=0.0):
        super().__init__(root, id, name, width, depth, preset, palette)
        # `lowest` is the lowest walkable level: the rules treat anything far below it as fallen out.
        self.data['bounds']['max'][1] = height; self.data['bounds']['min'][1] = lowest
        self.art = {}

    def B(self, id, x0, x1, y0, y1, z0, z1, material, role='cover', art=None, collision=True, batch='main'):
        o = dict(id=id, type='box', position=[round((x0 + x1) / 2, 3), round((y0 + y1) / 2, 3), round((z0 + z1) / 2, 3)],
                 size=[round(abs(x1 - x0), 3), round(y1 - y0, 3), round(abs(z1 - z0), 3)], material=material, collision=collision, role=role)
        if batch and role not in ('floor', 'wayfinding'): o['batch'] = batch
        self.objects.append(o); self.art[id] = art or {}
        return o

    def R(self, id, x0, x1, y0, y1, z0, z1, axis, low, material, art=None, batch='main'):
        """Ramp whose low edge is at `low` (+1/-1) along `axis`; y0 is its base, y1 its top."""
        o = dict(id=id, type='ramp', position=[round((x0 + x1) / 2, 3), round(y0, 3), round((z0 + z1) / 2, 3)],
                 size=[round(abs(x1 - x0), 3), round(y1 - y0, 3), round(abs(z1 - z0), 3)], material=material, collision=True, role='ramp', axis=axis, lowAt=low)
        if batch: o['batch'] = batch
        self.objects.append(o); self.art[id] = art or dict(kind='steps')
        return o

    def renderer(self, kinds):
        """render_object callback: dispatch on the object's art kind."""
        def render(m, o):
            a = self.art.get(o['id'], {})
            fn = kinds.get(a.get('kind'))
            return bool(fn and fn(m, o, a) is not False)
        return render


def ext(o):
    (x, y, z), (w, h, d) = o['position'], o['size']
    y0 = y if o['type'] == 'ramp' else y - h / 2
    return x - w / 2, x + w / 2, y0, y0 + h, z - d / 2, z + d / 2


# ------------------------------------------------------------------ transforms
def place(dst, src, x=0, y=0, z=0, yaw=0.0, s=1.0, sy=None, remap=None):
    """Append template `src` turned about Y, scaled and moved. `remap` renames materials."""
    c, n = math.cos(yaw), math.sin(yaw); sy = s if sy is None else sy
    for mat_, (P, N, I) in src.prims.items():
        name = (remap or {}).get(mat_, mat_)
        dP, dN, dI = dst.tri_list(name); base = len(dP) // 3
        for j in range(0, len(P), 3):
            px, py, pz = P[j] * s, P[j + 1] * sy, P[j + 2] * s
            dP.extend((x + px * c + pz * n, y + py, z - px * n + pz * c))
            nx, ny, nz = N[j], N[j + 1], N[j + 2]
            dN.extend((nx * c + nz * n, ny, -nx * n + nz * c))
        dI.extend(i + base for i in I)
        if mat_ in src.uvs: dst.uvs.setdefault(name, []).extend(src.uvs[mat_])


def lathe(m, material, x, z, profile, n=16, rot=0.0, cap=True):
    """Surface of revolution from (radius, y) pairs, bottom to top."""
    for (r0, y0), (r1, y1) in zip(profile, profile[1:]):
        for i in range(n):
            a, b = rot + math.tau * i / n, rot + math.tau * (i + 1) / n
            m.quad(material, (x + r0 * math.cos(b), y0, z + r0 * math.sin(b)), (x + r0 * math.cos(a), y0, z + r0 * math.sin(a)),
                   (x + r1 * math.cos(a), y1, z + r1 * math.sin(a)), (x + r1 * math.cos(b), y1, z + r1 * math.sin(b)))
    if cap:
        r, yy = profile[-1]
        if r > 1e-4:
            for i in range(n):
                a, b = rot + math.tau * i / n, rot + math.tau * (i + 1) / n
                m.tri(material, (x, yy, z), (x + r * math.cos(b), yy, z + r * math.sin(b)), (x + r * math.cos(a), yy, z + r * math.sin(a)))


def loft(m, material, sections, close=True):
    """Skin between equal-length closed point loops (bottom to top)."""
    for a, b in zip(sections, sections[1:]):
        k = len(a)
        for j in range(k):
            m.quad(material, a[(j + 1) % k], a[j], b[j], b[(j + 1) % k])
    if close:
        for sec, flip in ((sections[0], True), (sections[-1], False)):
            cx = sum(p[0] for p in sec) / len(sec); cy = sum(p[1] for p in sec) / len(sec); cz = sum(p[2] for p in sec) / len(sec)
            for j in range(len(sec)):
                p, q = sec[j], sec[(j + 1) % len(sec)]
                m.tri(material, (cx, cy, cz), *((p, q) if flip else (q, p)))


def rect(x0, x1, y, z0, z1):
    return [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]


def tbox(m, material, x0, x1, z0, z1, y0, y1, inset=0.0, top_material=None):
    """Battered block: the top is `inset` smaller on every side (pylons, plinths, embankments)."""
    lo, hi = rect(x0, x1, y0, z0, z1), rect(x0 + inset, x1 - inset, y1, z0 + inset, z1 - inset)
    for j in range(4): m.quad(material, lo[(j + 1) % 4], lo[j], hi[j], hi[(j + 1) % 4])
    m.quad(top_material or material, hi[3], hi[2], hi[1], hi[0])


# ------------------------------------------------------------------ building forms
def steps(m, o, tread='stone', riser=None, cheek=None, rise=.2):
    """Stair flight filling a ramp's box: treads, risers and solid cheeks to the ground."""
    x0, x1, y0, y1, z0, z1 = ext(o); ax, low = o['axis'], o['lowAt']
    n = max(2, round((y1 - y0) / rise)); riser = riser or tread
    length = (x1 - x0) if ax == 'x' else (z1 - z0)
    for i in range(n):
        a, b = i / n, (i + 1) / n; top = y0 + (y1 - y0) * (i + 1) / n
        if ax == 'x':
            xa, xb = (x1 - length * a, x1 - length * b) if low > 0 else (x0 + length * a, x0 + length * b)
            m.box(riser, (min(xa, xb), y0, z0), (max(xa, xb), top, z1), skip_bottom=True, top_mat=tread)
        else:
            za, zb = (z1 - length * a, z1 - length * b) if low > 0 else (z0 + length * a, z0 + length * b)
            m.box(riser, (x0, y0, min(za, zb)), (x1, top, max(za, zb)), skip_bottom=True, top_mat=tread)
    if cheek:
        t = .16
        for s in (0, 1):
            if ax == 'x':
                zz = z0 if s == 0 else z1 - t
                hi_x, lo_x = (x0, x1) if low > 0 else (x1, x0)
                m.quad(cheek, (lo_x, y0, zz), (hi_x, y0, zz), (hi_x, y1, zz), (lo_x, y0 + rise, zz))
                m.quad(cheek, (hi_x, y0, zz + t), (lo_x, y0, zz + t), (lo_x, y0 + rise, zz + t), (hi_x, y1, zz + t))
            else:
                xx = x0 if s == 0 else x1 - t
                hi_z, lo_z = (z0, z1) if low > 0 else (z1, z0)
                m.quad(cheek, (xx, y0, hi_z), (xx, y0, lo_z), (xx, y0 + rise, lo_z), (xx, y1, hi_z))
                m.quad(cheek, (xx + t, y0, lo_z), (xx + t, y0, hi_z), (xx + t, y1, hi_z), (xx + t, y0 + rise, lo_z))


def arch(m, material, c, span, rise, depth, thick=.3, axis='x', n=12, pointed=False, key=None):
    """Voussoir ring standing on its springing line. axis is the direction the opening spans."""
    cx, cy, cz = c
    def pt(t, r_add, off):
        if pointed:
            # two arcs struck from the opposite springers, meeting at the crown
            tt = t if t <= .5 else 1 - t; th = math.pi - (math.pi / 3) * (tt / .5); r = span + r_add
            u = span / 2 + r * math.cos(th); v = r * math.sin(th) * rise / (span * math.sin(2 * math.pi / 3))
            if t > .5: u = -u
        else:
            a = math.pi * (1 - t); u, v = (span / 2 + r_add) * math.cos(a), (rise + r_add) * math.sin(a)
        return (cx + u, cy + v, cz + off) if axis == 'x' else (cx + off, cy + v, cz + u)
    for i in range(n):
        a, b = i / n + .004, (i + 1) / n - .004
        mm = key if key and i in (n // 2 - 1, n // 2) else material
        f, k = -depth / 2, depth / 2
        m.quad(mm, pt(a, 0, f), pt(b, 0, f), pt(b, thick, f), pt(a, thick, f))
        m.quad(mm, pt(b, 0, k), pt(a, 0, k), pt(a, thick, k), pt(b, thick, k))
        m.quad(mm, pt(a, 0, k), pt(b, 0, k), pt(b, 0, f), pt(a, 0, f))
        m.quad(mm, pt(a, thick, f), pt(b, thick, f), pt(b, thick, k), pt(a, thick, k))


def gable(m, roof, wall, x0, x1, z0, z1, eave, ridge, axis='x', over=.3, thick=.14, rows=0, row_mat=None):
    """Pitched roof with real thickness, eave overhang and closed gable triangles. Ridge runs along `axis`."""
    if axis == 'x':
        zc = (z0 + z1) / 2
        for sgn, ze in ((-1, z0 - over), (1, z1 + over)):
            a, b = (x0 - over, eave - over * .5, ze), (x1 + over, eave - over * .5, ze)
            ra, rb = (x0 - over, ridge, zc), (x1 + over, ridge, zc)
            pts = (a, b, rb, ra) if sgn < 0 else (b, a, ra, rb)
            m.quad(roof, *pts)
            up = [(p[0], p[1] + thick, p[2]) for p in pts]
            m.quad(roof, *up)
            m.quad(row_mat or roof, a, b, (b[0], b[1] + thick, b[2]), (a[0], a[1] + thick, a[2]))
            for k in range(1, rows + 1):
                t = k / (rows + 1); yy = a[1] + (ridge - a[1]) * t + thick + .012; zz = ze + (zc - ze) * t
                m.quad(row_mat or roof, (a[0], yy, zz), (b[0], yy, zz), (b[0], yy + .05, zz + sgn * -.0 + (zc - ze) * .02), (a[0], yy + .05, zz + (zc - ze) * .02))
        for xx in (x0, x1):
            m.tri(wall, (xx, eave, z0), (xx, eave, z1), (xx, ridge - .05, zc))
        beam(m, row_mat or roof, (x0 - over, ridge + thick, zc), (x1 + over, ridge + thick, zc), .09, 5)
    else:
        xc = (x0 + x1) / 2
        for sgn, xe in ((-1, x0 - over), (1, x1 + over)):
            a, b = (xe, eave - over * .5, z0 - over), (xe, eave - over * .5, z1 + over)
            ra, rb = (xc, ridge, z0 - over), (xc, ridge, z1 + over)
            pts = (b, a, ra, rb) if sgn < 0 else (a, b, rb, ra)
            m.quad(roof, *pts)
            m.quad(roof, *[(p[0], p[1] + thick, p[2]) for p in pts])
            m.quad(row_mat or roof, a, b, (b[0], b[1] + thick, b[2]), (a[0], a[1] + thick, a[2]))
            for k in range(1, rows + 1):
                t = k / (rows + 1); yy = a[1] + (ridge - a[1]) * t + thick + .012; xx = xe + (xc - xe) * t
                m.quad(row_mat or roof, (xx, yy, a[2]), (xx, yy, b[2]), (xx + (xc - xe) * .02, yy + .05, b[2]), (xx + (xc - xe) * .02, yy + .05, a[2]))
        for zz in (z0, z1):
            m.tri(wall, (x0, eave, zz), (x1, eave, zz), (xc, ridge - .05, zz))
        beam(m, row_mat or roof, (xc, ridge + thick, z0 - over), (xc, ridge + thick, z1 + over), .09, 5)


def courses(m, material, x0, x1, y0, y1, z0, z1, every=.5, depth=.012, width=.02):
    """Thin recessed-joint lines on the four faces of a wall (kept inside the box)."""
    y = y0 + every
    while y < y1 - .05:
        for a, b in (((x0, y, z0 + depth), (x1, y, z0 + depth)), ((x1, y, z1 - depth), (x0, y, z1 - depth))):
            m.quad(material, a, b, (b[0], b[1] + width, b[2]), (a[0], a[1] + width, a[2]))
        for a, b in (((x0 + depth, y, z1), (x0 + depth, y, z0)), ((x1 - depth, y, z0), (x1 - depth, y, z1))):
            m.quad(material, a, b, (b[0], b[1] + width, b[2]), (a[0], a[1] + width, a[2]))
        y += every


def rope(m, material, a, b, sag=.3, r=.025, n=6):
    pts = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t) for t in [i / n for i in range(n + 1)]]
    for p, q in zip(pts, pts[1:]): beam(m, material, p, q, r, 4)


def scatter(rng, n, x0, x1, z0, z1, keep=lambda x, z: True, gap=0.0, tries=40):
    out = []
    for _ in range(n * tries):
        if len(out) >= n: break
        x, z = rng.uniform(x0, x1), rng.uniform(z0, z1)
        if keep(x, z) and all((x - a) ** 2 + (z - b) ** 2 >= gap * gap for a, b in out): out.append((x, z))
    return out


# ------------------------------------------------------------------ material synthesis
def synth_materials(out, kinds, seed, size=128):
    """Write <kind>_{basecolor,orm,normal}.png for each (name, recipe) and a provenance manifest.
    Base colours are near-white relative multipliers of the palette colour."""
    from PIL import Image
    out = Path(out); out.mkdir(parents=True, exist_ok=True); N = size

    def noise(sd, f):
        r = random.Random(sd); g = [[r.uniform(-1, 1) for _ in range(f)] for _ in range(f)]; res = []
        for y in range(N):
            yy = y / N * f; iy = int(yy); fy = yy - iy; fy = fy * fy * (3 - 2 * fy); row = []
            for x in range(N):
                xx = x / N * f; ix = int(xx); fx = xx - ix; fx = fx * fx * (3 - 2 * fx)
                a = g[iy % f][ix % f] * (1 - fx) + g[iy % f][(ix + 1) % f] * fx
                b = g[(iy + 1) % f][ix % f] * (1 - fx) + g[(iy + 1) % f][(ix + 1) % f] * fx
                row.append(a * (1 - fy) + b * fy)
            res.append(row)
        return res

    for index, (name, r) in enumerate(kinds.items()):
        sd = seed + index * 97
        a, b, c = noise(sd, 5), noise(sd + 11, 19), noise(sd + 23, 43)
        kind = r['kind']; rows = r.get('rows', 4); cols = r.get('cols', 2)
        rr = random.Random(sd + 5); tint = [[rr.uniform(-1, 1) for _ in range(cols * 2)] for _ in range(rows)]
        height = [[0.0] * N for _ in range(N)]; shade = [[0.0] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                u, v = x / N, y / N; n = .5 * a[y][x] + .3 * b[y][x] + .2 * c[y][x]; h = n * .35; s = n * r.get('grain', .5)
                if kind in ('blocks', 'brick'):
                    row = int(v * rows); off = (row % 2) * .5 / cols; col = int(((u + off) % 1) * cols)
                    fu, fv = ((u + off) % 1) * cols % 1, v * rows % 1
                    jw = r.get('joint', .045); edge = min(fu, 1 - fu) * (rows / cols) if rows > cols else min(fu, 1 - fu)
                    j = min(edge / (jw * cols / rows if rows > cols else jw), min(fv, 1 - fv) / jw)
                    j = max(0, min(1, j)); h = (j ** .5) * .9 + n * .22; s = n * r.get('grain', .45) + tint[row][col] * r.get('vary', .5) - (1 - j) * r.get('dark', 1.5)
                elif kind == 'rammed':
                    band = math.sin(v * math.tau * rows + a[y][x] * .9); lay = max(0, 1 - abs(band) * 3)
                    h = n * .4 - lay * .5; s = n * .55 + .35 * math.sin(v * math.tau * rows * .5 + 1.3) - lay * .9
                elif kind == 'wood':
                    g = math.sin((u * rows + .25 * a[y][x] + .08 * b[y][x]) * math.tau); plank = min(u * cols % 1, 1 - u * cols % 1)
                    pj = max(0, min(1, plank / .03)); h = g * .35 + pj * .5; s = g * .5 + c[y][x] * .3 - (1 - pj) * 1.4 + tint[0][int(u * cols) % (cols * 2)] * .4
                elif kind == 'plaster':
                    h = n * .25 + b[y][x] * .1; s = a[y][x] * .7 + c[y][x] * .15
                elif kind == 'tile':
                    fv = v * rows % 1; row = int(v * rows); fu = ((u + (row % 2) * .5 / cols) * cols) % 1
                    lip = max(0, 1 - fv / .14); gap_ = max(0, 1 - min(fu, 1 - fu) / .05)
                    h = fv * .8 - lip * .4 - gap_ * .5 + n * .1; s = n * .4 + tint[row % rows][int(u * cols) % (cols * 2)] * .55 - lip * 1.1 - gap_ * .9
                elif kind == 'metal':
                    h = n * .18 + c[y][x] * .1; s = a[y][x] * .9 + b[y][x] * .35
                elif kind == 'sand':
                    rip = math.sin((v * rows + .35 * a[y][x]) * math.tau); h = rip * .3 + n * .15; s = rip * .35 + n * .4
                elif kind == 'paving':
                    row = int(v * rows); fu, fv = ((u + (row % 2) * .37) * cols) % 1, v * rows % 1
                    j = max(0, min(1, min(min(fu, 1 - fu) * rows / cols, min(fv, 1 - fv)) / .05))
                    h = (j ** .6) * .7 + n * .3; s = n * .5 + tint[row][int(((u + (row % 2) * .37) % 1) * cols)] * .6 - (1 - j) * 1.6
                elif kind == 'cloth':
                    w = .5 * (math.sin(u * math.tau * 40) + math.sin(v * math.tau * 40)); h = w * .2 + a[y][x] * .2; s = w * .25 + a[y][x] * .5
                height[y][x] = h; shade[y][x] = s
        strength = r.get('contrast', 16); rough0 = r.get('rough', 236); metal = r.get('metal', 0)
        base, orm, nor = [], [], []
        for y in range(N):
            for x in range(N):
                v_ = max(120, min(255, round(238 + shade[y][x] * strength)))
                w = r.get('warm', 0) * shade[y][x]
                base.append((max(0, min(255, round(v_ + w * 6))), v_, max(0, min(255, round(v_ - w * 8)))))
                ao = max(150, min(255, round(250 + min(0, shade[y][x]) * 26)))
                orm.append((ao, max(60, min(255, round(rough0 - shade[y][x] * r.get('roughVary', 10)))), metal))
                dx = (height[y][(x + 1) % N] - height[y][(x - 1) % N]) * r.get('bump', 1.0)
                dy = (height[(y + 1) % N][x] - height[(y - 1) % N][x]) * r.get('bump', 1.0)
                le = math.sqrt(dx * dx + dy * dy + 1)
                nor.append((int((-dx / le * .5 + .5) * 255), int((dy / le * .5 + .5) * 255), int((1 / le * .5 + .5) * 255)))
        for channel, px in (('basecolor', base), ('orm', orm), ('normal', nor)):
            im = Image.new('RGB', (N, N)); im.putdata(px); im.save(out / f'{name}_{channel}.png', optimize=True)
    files = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.glob('*.png'))}
    (out / 'provenance.json').write_text(json.dumps(dict(
        provenance='Original deterministic mathematical material synthesis (erakit.synth_materials); no external imagery, scans, textures or AI image inputs.',
        seed=seed, size=[N, N], colour='basecolor sRGB relative multiplier; ORM and normal linear data', recipes=kinds, files=files), indent=2) + '\n')


def bind_textures(c, root, groups):
    """groups: {texture name: (scale, normalScale, [palette materials])}."""
    tex = Path(root) / 'assets/materials'
    for name, (scale, nscale, names) in groups.items():
        for n in names:
            c.textures[n] = dict(baseColor=tex / f'{name}_basecolor.png', orm=tex / f'{name}_orm.png', normal=tex / f'{name}_normal.png', scale=scale, normalScale=nscale)
