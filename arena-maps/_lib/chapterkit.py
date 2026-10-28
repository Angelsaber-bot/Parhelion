"""Small editable authoring helpers for the three chapter arenas.

Uses the repository's glbkit, not Blender; all dimensions are metres. Collision and
visual source objects are emitted together, then hand-authored detail is batched.
"""
from pathlib import Path
import json, math
from glbkit import Mesh, write_glb


class Chapter:
    def __init__(self, root, id, name, width, depth, preset, palette):
        self.root, self.id = Path(root), id
        self.objects, self.anchors, self.routes = [], [], []
        self.palette = palette
        self.textures = {}
        self.data = dict(mapId=id, name=name, version='1.0.0', mode='arena', units='metres', upAxis='Y',
            supportedTeamLayouts=['1v1', '1v2', '2v2'], bounds=dict(min=[-width/2, 0, -depth/2], max=[width/2, 12, depth/2]),
            presentation=dict(preset=preset), player=dict(radius=.32, height=1.8, eyeHeight=1.65, walkSpeed=4.2, stepHeight=.28))
        self.detail = Mesh()

    def box(self, id, p, s, mat, role='cover', collision=True):
        self.objects.append(dict(id=id, type='box', position=p, size=s, material=mat, collision=collision, role=role))

    def ramp(self, id, p, s, axis, low, mat):
        self.objects.append(dict(id=id, type='ramp', position=p, size=s, material=mat, collision=True, role='ramp', axis=axis, lowAt=low))

    def anchor(self, id, kind, p, **kw):
        self.anchors.append(dict(id=id, kind=kind, position=p, **kw))

    def route(self, id, points):
        self.routes.append(dict(id=id, name=id.replace('_', ' '), points=points))

    def save(self, decorate_object=None, render_object=None):
        if self.textures:
            self.data['artPipeline'] = dict(embeddedMaterialTextures=True, projection='world-metre planar per face', channels=['baseColor','occlusionRoughnessMetallic','normal'])
        self.data.update(palette={k:v[0] for k,v in self.palette.items()}, objects=self.objects, anchors=self.anchors, routes=self.routes)
        (self.root/'runtime/map.json').write_text(json.dumps(self.data, indent=2, ensure_ascii=False)+'\n')
        nodes, cols, batches = [], [], {}
        for o in self.objects:
            v, c = Mesh(), Mesh()
            custom = render_object and render_object(v, o)
            if o['type'] == 'ramp':
                if not custom: v.wedge(o['material'], o)
                c.wedge('collision', o)
            else:
                if not custom: v.cbox(o['material'], o['position'], o['size'])
                c.cbox('collision', o['position'], o['size'])
            if decorate_object: decorate_object(self.detail, o)
            if o.get('batch'):
                # Batched source objects (2026-10-28 CAMLANN town): same per-object art rule
                # as a VIS_ node, enforced here, then merged so a town of walls costs one
                # draw per material instead of one per wall piece.
                lo, hi = mesh_bounds(v)
                (bx0, by0, bz0), (bx1, by1, bz1) = object_box(o)
                assert lo[0] >= bx0 - 1e-4 and lo[1] >= by0 - 1e-4 and lo[2] >= bz0 - 1e-4 and \
                    hi[0] <= bx1 + 1e-4 and hi[1] <= by1 + 1e-4 and hi[2] <= bz1 + 1e-4, f'{o["id"]} art outside its box {lo} {hi}'
                b = batches.setdefault(o['batch'], (Mesh(), []))
                merge(b[0], v); b[1].append(o['id'])
            else:
                nodes.append(('VIS_'+o['id'], v, dict(source_id=o['id'], role=o['role'], collision=o['collision'], decorative=False)))
            if o['collision']: cols.append(('COL_'+o['id'], c, dict(source_id=o['id'], role=o['role'], collision=True, decorative=False)))
        for name, (mesh, ids) in batches.items():
            nodes.append(('BATCH_'+name, mesh, dict(role='structure', collision=False, decorative=False, batched=ids)))
        nodes.append(('DETAIL_chapter_craft', self.detail, dict(role='detail_batch', collision=False, decorative=True)))
        mats={**self.palette, 'collision':('#adbbce', 0, 1, 0, 1)}
        vis=write_glb(self.root/f'assets/{self.id}_visual.glb', nodes, list(self.palette), mats, textures=self.textures)
        col=write_glb(self.root/f'assets/{self.id}_collision.glb', cols, ['collision'], mats)
        print(json.dumps(dict(id=self.id, visual=vis, collision=col)))


def object_box(o):
    (x, y, z), (w, h, d) = o['position'], o['size']
    y0 = y if o['type'] == 'ramp' else y - h / 2
    return (x - w / 2, y0, z - d / 2), (x + w / 2, y0 + h, z + d / 2)


def mesh_bounds(m):
    lo, hi = [1e9] * 3, [-1e9] * 3
    for P, _, _ in m.prims.values():
        for j in range(0, len(P), 3):
            for i in range(3):
                lo[i] = min(lo[i], P[j + i]); hi[i] = max(hi[i], P[j + i])
    return lo, hi


def merge(dst, src):
    """Append every triangle of src to dst (same materials, UVs kept)."""
    for mat_, (P, N, I) in src.prims.items():
        dP, dN, dI = dst.tri_list(mat_)
        base = len(dP) // 3
        dP.extend(P); dN.extend(N); dI.extend(i + base for i in I)
        if mat_ in src.uvs: dst.uvs.setdefault(mat_, []).extend(src.uvs[mat_])


def mat(hex, metal=0, rough=.9, emit=0):
    return (hex, metal, rough, emit, 1)


def beam(m, material, a, b, radius, sides=6):
    """A tapered-free cylinder along an arbitrary vector (spars, ropes, cannon)."""
    v=[b[i]-a[i] for i in range(3)]; length=math.sqrt(sum(x*x for x in v)); v=[x/length for x in v]
    up=[0,1,0] if abs(v[1]) < .95 else [1,0,0]
    u=[v[1]*up[2]-v[2]*up[1],v[2]*up[0]-v[0]*up[2],v[0]*up[1]-v[1]*up[0]]
    l=math.sqrt(sum(x*x for x in u)); u=[x/l for x in u]
    w=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]]
    def p(base,j):
        t=math.tau*j/sides
        return [base[i]+radius*(u[i]*math.cos(t)+w[i]*math.sin(t)) for i in range(3)]
    for j in range(sides):
        m.quad(material,p(a,j),p(a,j+1),p(b,j+1),p(b,j))
        m.tri(material,a,p(a,j+1),p(a,j)); m.tri(material,b,p(b,j),p(b,j+1))


def ring(m, material, x, y, z, radius, width, n=32):
    for i in range(n):
        a,b=math.tau*i/n,math.tau*(i+1)/n
        m.quad(material,(x+radius*math.cos(a),y,z+radius*math.sin(a)),(x+(radius+width)*math.cos(a),y,z+(radius+width)*math.sin(a)),
            (x+(radius+width)*math.cos(b),y,z+(radius+width)*math.sin(b)),(x+radius*math.cos(b),y,z+radius*math.sin(b)))


def flag(m, material, pole, direction=1, scale=1):
    x,y,z=pole
    beam(m,'timber',(x,y-3*scale,z),(x,y+.2*scale,z),.06*scale)
    m.quad(material,(x,y,z),(x+direction*1.5*scale,y-.12*scale,z+.16*scale),(x+direction*1.3*scale,y-.9*scale,z+.2*scale),(x,y-1.05*scale,z))


def mountain(m, material, x, z, w, h):
    m.tri(material,(x-w,-6,z),(x+w,-6,z),(x,h,z-8))
    m.tri(material,(x+w,-6,z),(x,-6,z-20),(x,h,z-8))


def box_edges(m, material, p, s, width=.06):
    x,y,z=p; w,h,d=s
    # Offset external bands beyond the base faces: exact coplanar tops produce black
    # z-fighting in both the CPU reference renderer and real-time depth buffers.
    for xx in (x-w/2+width/2-.012,x+w/2-width/2+.012):
        for zz in (z-d/2+width/2-.012,z+d/2-width/2+.012):
            m.cbox(material,[xx,y,zz],[width,h+.015,width])
    for yy in (y-h/2+width/2-.012,y+h/2-width/2+.012):
        m.cbox(material,[x,yy,z],[w+.03,width,d+.03])


def bevelbox(m, material, p, s, bevel=.12, top_material=None):
    """Eight-corner horizontal section and bevelled top/bottom; never exceeds proxy."""
    x,y,z=p; w,h,d=s; b=min(bevel,w*.16,h*.16,d*.16)
    def contour(inset,yy):
        x0,x1=x-w/2+inset,x+w/2-inset; z0,z1=z-d/2+inset,z+d/2-inset
        c=max(.005,b-inset/2)
        return [(x0+c,yy,z0),(x1-c,yy,z0),(x1,yy,z0+c),(x1,yy,z1-c),
                (x1-c,yy,z1),(x0+c,yy,z1),(x0,yy,z1-c),(x0,yy,z0+c)]
    rings=[contour(b*.6,y-h/2),contour(0,y-h/2+b),contour(0,y+h/2-b),contour(b*.6,y+h/2)]
    for a,bb in zip(rings,rings[1:]):
        for j in range(8): m.quad(material,a[j],a[(j+1)%8],bb[(j+1)%8],bb[j])
    for j in range(8):
        m.tri(material,(x,y-h/2,z),rings[0][(j+1)%8],rings[0][j])
        m.tri(top_material or material,(x,y+h/2,z),rings[-1][j],rings[-1][(j+1)%8])


def hiproof(m, material, x0,x1,z0,z1,eave,ridge):
    """Four clear roof planes; ridge runs along the longer footprint dimension."""
    if x1-x0 >= z1-z0:
        ra=(x0+(z1-z0)*.35,ridge,(z0+z1)/2); rb=(x1-(z1-z0)*.35,ridge,(z0+z1)/2)
        m.quad(material,(x0,eave,z0),(x1,eave,z0),rb,ra)
        m.quad(material,(x1,eave,z1),(x0,eave,z1),ra,rb)
        m.tri(material,(x0,eave,z1),(x0,eave,z0),ra); m.tri(material,(x1,eave,z0),(x1,eave,z1),rb)
    else:
        ra=((x0+x1)/2,ridge,z0+(x1-x0)*.35); rb=((x0+x1)/2,ridge,z1-(x1-x0)*.35)
        m.quad(material,(x1,eave,z0),(x1,eave,z1),rb,ra)
        m.quad(material,(x0,eave,z1),(x0,eave,z0),ra,rb)
        m.tri(material,(x0,eave,z0),(x1,eave,z0),ra); m.tri(material,(x1,eave,z1),(x0,eave,z1),rb)
    return ra,rb


# ---------------------------------------------------------------- light-dressing props
# Shared by the three chapter maps (2026-10-28 polish). Each returns the flame/lamp
# centre so the map can register the matching runtime glow in presentation.glows.

def cone(m, material, base, r, h, n=7, rot=0.0):
    """Closed upright cone (flame tongues, tent roofs, spires)."""
    x, y, z = base
    pts = [(x + r * math.cos(rot + math.tau * i / n), y, z + r * math.sin(rot + math.tau * i / n)) for i in range(n)]
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        m.tri(material, b, a, (x, y + h, z))
        m.tri(material, (x, y, z), a, b)


def frustum(m, material, base, r0, r1, h, n=8):
    """Tapered closed n-gon (bowls, tower bodies, posts)."""
    x, y, z = base
    lo = [(x + r0 * math.cos(math.tau * i / n), y, z + r0 * math.sin(math.tau * i / n)) for i in range(n)]
    hi = [(x + r1 * math.cos(math.tau * i / n), y + h, z + r1 * math.sin(math.tau * i / n)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        m.quad(material, lo[j], lo[i], hi[i], hi[j])
        m.tri(material, (x, y + h, z), hi[j], hi[i])
        m.tri(material, (x, y, z), lo[i], lo[j])


def flame(m, x, y, z, s=1.0, outer='flame', inner='flameCore'):
    """Three leaning tongues around a bright core; emissive, so bloom does the glow."""
    for k, (dx, dz, h) in enumerate([(.06, 0, .62), (-.05, .05, .5), (0, -.06, .44)]):
        cone(m, outer, (x + dx * s, y, z + dz * s), .14 * s, h * s, 5, k * .7)
    cone(m, inner, (x, y, z), .08 * s, .36 * s, 5)
    return (x, y + .28 * s, z)


def brazier(m, x, y, z, s=1.0, legs=True):
    """Iron fire basket with coals and flame. y is the surface it stands on."""
    top = y + (.62 if legs else .12) * s
    if legs:
        for i in range(3):
            a = math.tau * i / 3
            beam(m, 'iron', (x + math.cos(a) * .26 * s, y, z + math.sin(a) * .26 * s), (x + math.cos(a) * .17 * s, top, z + math.sin(a) * .17 * s), .025 * s, 4)
    frustum(m, 'iron', (x, top - .02 * s, z), .14 * s, .3 * s, .22 * s, 8)
    for i in range(8):
        a = math.tau * (i + .5) / 8
        beam(m, 'iron', (x + math.cos(a) * .3 * s, top + .2 * s, z + math.sin(a) * .3 * s), (x + math.cos(a) * .36 * s, top + .34 * s, z + math.sin(a) * .36 * s), .018 * s, 3)
    m.blob('coal', (x, top + .2 * s, z), .24 * s, .35)
    return flame(m, x, top + .22 * s, z, s)


def torch(m, x, y, z, s=1.0):
    """Short pole torch with a pitch-wrapped head."""
    beam(m, 'timber', (x, y, z), (x, y + .75 * s, z), .04 * s, 5)
    frustum(m, 'iron', (x, y + .7 * s, z), .05 * s, .09 * s, .14 * s, 6)
    m.blob('coal', (x, y + .86 * s, z), .08 * s, .6)
    return flame(m, x, y + .84 * s, z, .7 * s)


def lantern(m, x, y, z, s=1.0, glass='lampGlass', frame='iron'):
    """Hanging/standing four-pane lantern; returns the light centre."""
    m.cbox(frame, [x, y + .02 * s, z], [.26 * s, .04 * s, .26 * s])
    m.cbox(glass, [x, y + .2 * s, z], [.2 * s, .32 * s, .2 * s])
    for dx in (-.11, .11):
        for dz in (-.11, .11):
            m.cbox(frame, [x + dx * s, y + .2 * s, z + dz * s], [.03 * s, .34 * s, .03 * s])
    cone(m, frame, (x, y + .37 * s, z), .18 * s, .16 * s, 4, math.pi / 4)
    return (x, y + .2 * s, z)


def tent(m, x, y, z, w, d, h, cloth='canvas', shade='canvasShade', pole='timber'):
    """A-frame ridge tent along x with a dark open front."""
    a, b = (x - w / 2, y, z - d / 2), (x + w / 2, y, z - d / 2)
    c, e = (x + w / 2, y, z + d / 2), (x - w / 2, y, z + d / 2)
    r0, r1 = (x - w / 2, y + h, z), (x + w / 2, y + h, z)
    m.quad(cloth, a, r0, r1, b); m.quad(cloth, c, r1, r0, e)
    m.quad(cloth, b, r1, r0, a); m.quad(cloth, e, r0, r1, c)
    m.tri(shade, a, e, r0); m.tri(shade, c, b, r1)
    m.tri('grain', (x - w / 2 - .01, y, z - d * .22), (x - w / 2 - .01, y, z + d * .22), (x - w / 2 - .01, y + h * .7, z))
    beam(m, pole, (x - w / 2 - .1, y, z), (x - w / 2 - .1, y + h + .35, z), .04, 4)
    beam(m, pole, (x + w / 2 + .1, y, z), (x + w / 2 + .1, y + h + .35, z), .04, 4)
