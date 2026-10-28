"""Shared glTF toolkit for Parhelion Arena map art (pure Python 3, no Blender, no packages).

Mesh collects triangles per material; write_glb(path, nodes, materials, MATS) writes a static GLB.
The default remains byte-compatible factor-only PBR for existing maps. New chapters can pass
`textures={material: {baseColor: Path, orm: Path, normal: Path, scale: float}}` to embed original
surface channels with repeatable metre-projected UVs; no external image URIs are written.
MATS maps a material name to (sRGB hex, metallic, roughness, emissive, alpha): emissive <= 1 is a
soft self-lit lift, > 1 uses KHR_materials_emissive_strength; alpha < 1 blends.
"""
import json, math, struct


def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x < .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]


class Mesh:
    def __init__(self):
        self.prims = {}  # material -> [positions, normals, indices]
        # Optional export channel; legacy factor-only GLBs do not emit it. Coordinates
        # are projected in world metres per face, so independently authored batches
        # share the same surface scale without texture stretching on large walls.
        self.uvs = {}

    def surface_uv(self, mat, points, normal):
        axis = max(range(3), key=lambda i: abs(normal[i]))
        uv = self.uvs.setdefault(mat, [])
        for p in points:
            uv.extend((p[2], p[1]) if axis == 0 else (p[0], p[2]) if axis == 1 else (p[0], p[1]))

    def tri_list(self, mat):
        return self.prims.setdefault(mat, [[], [], []])

    def quad(self, mat, a, b, c, d):
        """Planar quad a-b-c-d counter-clockwise seen from the front."""
        P, N, I = self.tri_list(mat)
        u = [b[i] - a[i] for i in range(3)]; v = [d[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        L = math.sqrt(sum(x * x for x in n)) or 1
        n = [x / L for x in n]
        base = len(P) // 3
        for p in (a, b, c, d):
            P.extend(p); N.extend(n)
        self.surface_uv(mat, (a, b, c, d), n)
        I.extend([base, base + 1, base + 2, base, base + 2, base + 3])

    def tri(self, mat, a, b, c):
        P, N, I = self.tri_list(mat)
        u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        L = math.sqrt(sum(x * x for x in n)) or 1
        base = len(P) // 3
        for p in (a, b, c):
            P.extend(p); N.extend([x / L for x in n])
        self.surface_uv(mat, (a, b, c), n)
        I.extend([base, base + 1, base + 2])

    def box(self, mat, lo, hi, skip_bottom=False, top_mat=None):
        x0, y0, z0 = lo; x1, y1, z1 = hi
        q = self.quad
        q(top_mat or mat, (x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0))  # top
        if not skip_bottom:
            q(mat, (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1))
        q(mat, (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))  # +z
        q(mat, (x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0))  # -z
        q(mat, (x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1))  # +x
        q(mat, (x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0))  # -x

    def cbox(self, mat, c, s, **kw):
        self.box(mat, [c[i] - s[i] / 2 for i in range(3)], [c[i] + s[i] / 2 for i in range(3)], **kw)

    def wedge(self, mat, o):
        """Ramp solid exactly as the game's collision: box clipped by the slope."""
        x, y, z = o['position']; w, h, d = o['size']
        ax, la = o['axis'], o['lowAt']

        def top(px, pz):
            c, ctr, half = (px, x, w / 2) if ax == 'x' else (pz, z, d / 2)
            t = max(-1, min(1, (c - ctr) / half))
            return y + h * (1 - t * la) / 2
        xs, zs = (x - w / 2, x + w / 2), (z - d / 2, z + d / 2)
        c = {(i, k): (xs[i], top(xs[i], zs[k]), zs[k]) for i in (0, 1) for k in (0, 1)}
        b = {(i, k): (xs[i], y, zs[k]) for i in (0, 1) for k in (0, 1)}
        q = self.quad
        q(mat, c[0, 1], c[1, 1], c[1, 0], c[0, 0])
        for (i0, k0), (i1, k1) in [((0, 1), (1, 1)), ((1, 0), (0, 0)), ((1, 1), (1, 0)), ((0, 0), (0, 1))]:
            if abs(c[i0, k0][1] - y) < 1e-6 and abs(c[i1, k1][1] - y) < 1e-6:
                continue
            if abs(c[i0, k0][1] - y) < 1e-6:
                self.tri(mat, b[i0, k0], b[i1, k1], c[i1, k1])
            elif abs(c[i1, k1][1] - y) < 1e-6:
                self.tri(mat, b[i0, k0], b[i1, k1], c[i0, k0])
            else:
                q(mat, b[i0, k0], b[i1, k1], c[i1, k1], c[i0, k0])
        return top

    def prism(self, mat, c, r, h, n=12, y0=None, rot=0.0):
        """Vertical n-gon prism (columns, lantern posts, ring segments)."""
        cx, cy, cz = c
        y0 = cy if y0 is None else y0
        pts = [(cx + r * math.cos(rot + 2 * math.pi * i / n), cz + r * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]
        for i in range(n):
            (ax_, az), (bx, bz) = pts[i], pts[(i + 1) % n]
            self.quad(mat, (bx, y0, bz), (ax_, y0, az), (ax_, y0 + h, az), (bx, y0 + h, bz))
            self.tri(mat, (cx, y0 + h, cz), (bx, y0 + h, bz), (ax_, y0 + h, az))
            self.tri(mat, (cx, y0, cz), (ax_, y0, az), (bx, y0, bz))

    def blob(self, mat, c, r, squash=1.0):
        """Low-poly octahedral sphere (foliage, clouds): 32 faces."""
        def v(x, y, z):
            L = math.sqrt(x * x + y * y + z * z)
            return (c[0] + r * x / L, c[1] + r * squash * y / L, c[2] + r * z / L)
        oct_ = [((1, 0, 0), (0, 1, 0), (0, 0, 1)), ((0, 0, 1), (0, 1, 0), (-1, 0, 0)), ((-1, 0, 0), (0, 1, 0), (0, 0, -1)),
                ((0, 0, -1), (0, 1, 0), (1, 0, 0)), ((1, 0, 0), (0, 0, 1), (0, -1, 0)), ((0, 0, 1), (-1, 0, 0), (0, -1, 0)),
                ((-1, 0, 0), (0, 0, -1), (0, -1, 0)), ((0, 0, -1), (1, 0, 0), (0, -1, 0))]
        for a, b, cc in oct_:
            ab = [(a[i] + b[i]) / 2 for i in range(3)]; bc = [(b[i] + cc[i]) / 2 for i in range(3)]; ca = [(cc[i] + a[i]) / 2 for i in range(3)]
            for t in [(a, ab, ca), (ab, b, bc), (ca, bc, cc), (ab, bc, ca)]:
                self.tri(mat, v(*t[0]), v(*t[1]), v(*t[2]))



# ---------------------------------------------------------------- glTF writer
def write_glb(path, node_list, materials_used, MATS, generator='Parhelion arena-maps glbkit', textures=None):
    mat_index = {n: i for i, n in enumerate(materials_used)}
    gl = dict(asset=dict(version='2.0', generator=generator), scene=0, scenes=[dict(nodes=[])],
              nodes=[], meshes=[], materials=[], accessors=[], bufferViews=[], buffers=[])
    textures = textures or {}
    blob = bytearray()

    def view(raw, target=None):
        while len(blob) % 4:
            blob.append(0)
        v = dict(buffer=0, byteOffset=len(blob), byteLength=len(raw))
        if target is not None:
            v['target'] = target
        gl['bufferViews'].append(v)
        blob.extend(raw)
        return len(gl['bufferViews']) - 1

    image_cache = {}
    def texture_index(source):
        from pathlib import Path
        source = Path(source)
        key = str(source.resolve())
        if key in image_cache:
            return image_cache[key]
        gl.setdefault('samplers', [dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)])
        images = gl.setdefault('images', [])
        images.append(dict(name=source.name, bufferView=view(source.read_bytes()), mimeType='image/jpeg' if source.suffix.lower() in ('.jpg', '.jpeg') else 'image/png'))
        texs = gl.setdefault('textures', [])
        texs.append(dict(sampler=0, source=len(images)-1))
        image_cache[key] = len(texs)-1
        return len(texs)-1
    ext = set()
    for n in materials_used:
        hx, metal, rough, emit, alpha = MATS[n]
        rgb = lin(hx)
        m = dict(name=n, doubleSided=True, pbrMetallicRoughness=dict(baseColorFactor=[*rgb, alpha], metallicFactor=metal, roughnessFactor=rough))
        if emit:
            m['emissiveFactor'] = [c * min(1, emit) for c in rgb]  # <= 1: a soft self-lit lift (sails, clouds)
            if emit > 1:
                m['extensions'] = dict(KHR_materials_emissive_strength=dict(emissiveStrength=emit)); ext.add('KHR_materials_emissive_strength')
        if alpha < 1:
            m['alphaMode'] = 'BLEND'
        spec = textures.get(n, {})
        if spec.get('baseColor'):
            m['pbrMetallicRoughness']['baseColorTexture'] = dict(index=texture_index(spec['baseColor']))
        if spec.get('orm'):
            idx = texture_index(spec['orm'])
            m['pbrMetallicRoughness']['metallicRoughnessTexture'] = dict(index=idx)
            m['occlusionTexture'] = dict(index=idx, strength=spec.get('occlusionStrength', .45))
        if spec.get('normal'):
            m['normalTexture'] = dict(index=texture_index(spec['normal']), scale=spec.get('normalScale', .45))
        gl['materials'].append(m)
    if ext:
        gl['extensionsUsed'] = sorted(ext)
    tris = 0
    for name, mesh, extras in node_list:
        prims = []
        # split per material: a batch mesh holds one primitive per material, in palette order
        for mat in materials_used:
            if mat not in mesh.prims:
                continue
            P, N, I = mesh.prims[mat]
            if not I:
                continue
            nv = len(P) // 3
            pos = struct.pack(f'<{len(P)}f', *P); nor = struct.pack(f'<{len(N)}f', *N)
            idx = struct.pack(f'<{len(I)}I', *I)
            mn = [min(P[i::3]) for i in range(3)]; mx = [max(P[i::3]) for i in range(3)]
            a0 = len(gl['accessors'])
            gl['accessors'] += [dict(bufferView=view(pos, 34962), componentType=5126, count=nv, type='VEC3', min=mn, max=mx),
                                dict(bufferView=view(nor, 34962), componentType=5126, count=nv, type='VEC3'),
                                dict(bufferView=view(idx, 34963), componentType=5125, count=len(I), type='SCALAR')]
            attrs = dict(POSITION=a0, NORMAL=a0 + 1)
            if mat in textures:
                uv = mesh.uvs.get(mat, [])
                if len(uv) != nv * 2:
                    raise ValueError(f'{name}/{mat}: texture coordinates missing ({len(uv)} for {nv} vertices)')
                scale = textures[mat].get('scale', 1)
                raw_uv = struct.pack(f'<{len(uv)}f', *[v * scale for v in uv])
                attrs['TEXCOORD_0'] = len(gl['accessors'])
                gl['accessors'].append(dict(bufferView=view(raw_uv, 34962), componentType=5126, count=nv, type='VEC2'))
                # glTF occlusion uses TEXCOORD_0 by default; sharing the same UV set
                # keeps Blender, GLTFLoader and the runtime channels aligned.
            prims.append(dict(attributes=attrs, indices=a0 + 2, material=mat_index[mat]))
            tris += len(I) // 3
        if not prims:
            continue
        gl['meshes'].append(dict(name=name, primitives=prims))
        gl['nodes'].append(dict(name=name, mesh=len(gl['meshes']) - 1, extras=extras))
        gl['scenes'][0]['nodes'].append(len(gl['nodes']) - 1)
    while len(blob) % 4:
        blob.append(0)
    gl['buffers'].append(dict(byteLength=len(blob)))
    js = json.dumps(gl, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
    path.write_bytes(out)
    return dict(nodes=len(gl['nodes']), meshes=len(gl['meshes']), materials=len(gl['materials']), triangles=tris, bytes=len(out))


