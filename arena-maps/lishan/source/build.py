"""LISHAN 骊山地宫: the First Emperor's buried army, an anime fiction of the pits under Mount Li.
Run: python3 arena-maps/lishan/source/build.py        (add --materials to re-synthesise surfaces)

Play idea (unlike the five earlier arenas): three sunken corridors full of terracotta
ranks, two rammed-earth baulks whose tops are bare catwalks, and a raised brick gallery
round the pit. Low ground has cover everywhere and no view; high ground has the view
and nothing to hide behind. The decision is when to drop into the pit and where to come
back up.

Revised 2026-11 from the arena map design report (L01-L05):
  * a mid-pit return ramp on each side climbs from the centre corridor to a screened landing
    on a baulk (west ramp to the south baulk, east ramp to the north baulk), so a baulk top
    overlooks one return, never both, and the ramp head itself is not the firing spot;
  * the long north and south corridor lines are cut by landmark blocks: war drums in the
    north corridor (the ranks, 军阵), the bronze chariot in the centre (战车), vermilion gates
    in the south corridor (朱门);
  * every rank stands on a continuous earthen base, so the solid you collide with reads solid.
Collision is mirrored in x except the two return ramps, which are point-symmetric; the
west ranks are infantry, the east ranks cavalry.
"""
from pathlib import Path
import sys, math, random
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT.parent / '_lib'))
from glbkit import Mesh
from chapterkit import mat, beam, cone, frustum, flame, bevelbox, hiproof
from erakit import Era, ext, place, lathe, loft, rect, tbox, steps, courses, rope, synth_materials, bind_textures

P = dict(
    rammed=mat('#b89468'), rammedDark=mat('#97754f'), rammedLight=mat('#cfae80'), earthFloor=mat('#7f6a54'), earthDark=mat('#5f4f40'),
    brick=mat('#8b8e92'), brickDark=mat('#6c7076'), brickLight=mat('#a3a7aa'),
    terracotta=mat('#b98a62'), terracottaDark=mat('#96694a'), terracottaPale=mat('#cfa582'), pigmentRed=mat('#a2473a'), pigmentGreen=mat('#5d7f6a'), pigmentBlue=mat('#56658f'),
    lacquer=mat('#7e2a22', .1, .5), lacquerDark=mat('#2a1c1c', .1, .45), timber=mat('#5d4634'), timberLight=mat('#8a6b4c'),
    tile=mat('#4b5258'), tileLight=mat('#687078'), bronze=mat('#4f7466', .65, .5), bronzeDark=mat('#35544c', .6, .55), gold=mat('#c9a65a', .7, .38),
    jade=mat('#7fb7a0', .1, .35), rope=mat('#9a8463'), bannerBlack=mat('#22222a'), bannerRed=mat('#8f2f2a'),
    mercury=mat('#b9d6ff', .9, .12, .85), star=mat('#fff3c9', 0, 1, 3.2), nightLacquer=mat('#141a33', .2, .4),
    flame=mat('#ff9a3c', 0, 1, 3.2), flameCore=mat('#ffe6a0', 0, 1, 4.5), coal=mat('#c2461e', 0, .9, 1.6), iron=mat('#3a3d42', .5, .55),
    rock=mat('#3d4250'), rockLight=mat('#555b6c'))
PIT = -2.2
c = Era(ROOT, 'lishan', 'LISHAN 骊山地宫', 60, 44, 'tomb', P, height=12, lowest=PIT); D = c.detail
rng = random.Random(221)

# ------------------------------------------------------------------ collision layout
c.B('pit_floor', -30, 30, PIT - 1, PIT, -22, 22, 'earthFloor', 'floor')
for sx in (-1, 1):
    c.B(f'wall_x_{sx}', sx * 30, sx * 29.4, PIT, 7, -22, 22, 'rammed', 'structure', dict(kind='wall'))
for sz in (-1, 1):
    c.B(f'wall_z_{sz}', -29.4, 29.4, PIT, 7, sz * 22, sz * 21.4, 'rammed', 'structure', dict(kind='wall'))
    c.B(f'gallery_{sz}', -21, 21, PIT, 0, sz * 21.4, sz * 16, 'brick', 'floor', dict(kind='gallery'))
    # Baulk tops are the catwalks; each is cut by two cross passages spanned by planks.
    for k, (x0, x1) in enumerate(((-21, -9.5), (-6.5, 6.5), (9.5, 21))):
        c.B(f'baulk_{sz}_{k}', x0, x1, PIT, 0, sz * 6.5, sz * 4.5, 'rammed', 'floor', dict(kind='baulk'))
    for sx in (-1, 1):
        c.B(f'plank_bridge_{sz}_{sx}', sx * 9.5, sx * 6.5, -.25, 0, sz * 6.5, sz * 4.5, 'timber', 'floor', dict(kind='planks'))
    # Gallery stair down into the outer corridor.
    c.R(f'gallery_stair_{sz}', -1.5, 1.5, PIT, 0, sz * 16, sz * 10.5, 'z', -sz, 'rammed')
    for i, x in enumerate((-18, -12, -6, 6, 12, 18)):
        c.B(f'gallery_column_{sz}_{i}', x - .35, x + .35, 0, 4.3, sz * 16.95, sz * 16.25, 'lacquer', 'structure', dict(kind='column'))
    for i, (x0, x1) in enumerate(((-17.65, -12.35), (-11.65, -6.35), (6.35, 11.65), (12.35, 17.65))):
        c.B(f'gallery_rail_{sz}_{i}', x0, x1, 0, 1.0, sz * 16.75, sz * 16.45, 'timber', 'cover', dict(kind='rail', axis='x'))
    for sx in (-1, 1):
        c.B(f'ding_{sz}_{sx}', sx * 9 - .7, sx * 9 + .7, 0, 1.35, sz * 20.7, sz * 19.3, 'bronze', 'cover', dict(kind='ding'))
        c.B(f'chimes_{sz}_{sx}', sx * 15 - 1.5, sx * 15 + 1.5, 0, 1.75, sz * 20.6, sz * 20.0, 'timber', 'cover', dict(kind='chimes'))
    c.B(f'gallery_roof_{sz}', -21, 21, 4.35, 5.7, sz * 21.4, sz * 15.4, 'tile', 'roof', dict(kind='leanroof', sz=sz), collision=False)
for sx in (-1, 1):
    team = 'west' if sx < 0 else 'east'
    c.B(f'platform_{team}', sx * 29.4, sx * 21, PIT, 0, -21.4, 21.4, 'brick', 'floor', dict(kind='gallery'))
    c.B(f'spirit_screen_{team}', sx * 24.2, sx * 23.6, 0, 3.4, -5, 5, 'rammed', 'structure', dict(kind='screen', sx=sx))
    for sz in (-1, 1):
        c.B(f'que_tower_{team}_{sz}', sx * 24.2, sx * 21.8, 0, 5.6, sz * 8.3, sz * 10.7, 'rammed', 'structure', dict(kind='que'))
        c.B(f'weapon_rack_{team}_{sz}', sx * 29.4, sx * 28.2, 0, 1.3, sz * 13.6, sz * 16.4, 'timber', 'cover', dict(kind='rack'))
        for i, (z0, z1) in enumerate(((1.8, 4.2), (6.8, 8.2), (13.3, 16))):
            c.B(f'platform_rail_{team}_{sz}_{i}', sx * 21.3, sx * 21, 0, 1.0, sz * z0, sz * z1, 'timber', 'cover', dict(kind='rail', axis='z'))
    # Three earth ramps: one into each corridor.
    for name, z in (('north', -11.5), ('centre', 0), ('south', 11.5)):
        c.R(f'ramp_{team}_{name}', sx * 21, sx * 15.5, PIT, 0, z - 1.5, z + 1.5, 'x', -sx, 'rammed')
    # three pockets (G01): behind the spirit screen, and behind each que tower
    for i, (x, z) in enumerate(((27.5, -2), (27.5, 2), (27.4, -9.8), (27.4, 9.8))):
        c.anchor(f'spawn_{team}_{i}', 'spawn', [sx * x, 0, z], yaw=-sx * 1.5708, team=team)
    c.B(f'spawn_mark_{team}', sx * 28.6, sx * 27.4, 0, .04, -2.6, 2.6, 'bannerBlack' if sx < 0 else 'bannerRed', 'wayfinding', collision=False)
    for sz in (-1, 1):
        c.B(f'spawn_mark_{team}_{sz}', sx * 28.4, sx * 26.4, 0, .04, sz * 9.2, sz * 10.4, 'bannerBlack' if sx < 0 else 'bannerRed', 'wayfinding', collision=False)
    c.anchor(f'cover_screen_{team}', 'cover', [sx * 25.4, 0, 0], height=3.4)
    c.anchor(f'cover_que_{team}', 'cover', [sx * 25.2, 0, 9.5], height=5.6)
    c.B(f'end_roof_{team}', sx * 29.4, sx * 14, 6.7, 7.0, -21.4, 21.4, 'timber', 'roof', dict(kind='endroof', sx=sx), collision=False)

# Terracotta ranks: (x centre, z0, z1) for the west half; a rank is a file of figures facing the foe.
RANKS = [(-12.6, -9.6, -6.5), (-12.6, -16, -13.4), (-4.4, -14.9, -11.9), (-3.4, -9.3, -6.5),            # north corridor
         (-13, -4.5, -1.9), (-13, 1.9, 4.5), (-4.8, -1.6, 1.6),                                    # centre corridor
         (-12.2, 6.5, 9.4), (-11.6, 13.6, 16), (-4.2, 12.6, 16), (-3.2, 6.5, 9.2)]                 # south corridor
# Each file either meets a baulk or gallery face flush or leaves a full metre: no pockets a player cannot leave.
RETURN_RANKS = {(5, 1), (4, -1)}   # (rank, sx) the return ramps replace: x<0 south side, x>0 north side (sx mirrors RANKS' negative x)
for i, (x, z0, z1) in enumerate(RANKS):
    for sx in (-1, 1):
        if (i, sx) in RETURN_RANKS: continue
        c.B(f'rank_{i}_{"w" if sx < 0 else "e"}', sx * x - .5, sx * x + .5, PIT, PIT + 2.0, z0, z1, 'terracotta', 'cover', dict(kind='rank', sx=sx, n=i))
        c.anchor(f'cover_rank_{i}_{"w" if sx < 0 else "e"}', 'cover', [sx * (x - 1.05), PIT, (z0 + z1) / 2], height=2.0)
# L01: return ramps. Each climbs 2.2 m over 4.2 m along a baulk's inner face to a landing on the
# baulk, screened toward the centre corridor; the landing sits beside, not on, the plank underpass.
for sx in (-1, 1):
    side = 'w' if sx < 0 else 'e'; sz = -sx          # west ramp to the south baulk, east to the north
    za, zb = sorted((sz * 2.1, sz * 4.5)); zs = sorted((sz * 2.1, sz * 2.5))
    c.R(f'return_ramp_{side}', sx * 15.2, sx * 11.0, PIT, 0, za, zb, 'x', sx, 'rammed', dict(kind='steps'))
    c.B(f'return_landing_{side}', sx * 11.0, sx * 9.5, PIT, 0, za, zb, 'rammed', 'floor', dict(kind='baulk'))
    # The landing is an alcove: an L of wall on its pit sides (reaching over the ramp head) hides
    # whoever stands there from the centre corridor and from the far baulk; the fight starts once
    # they step onto their own baulk.
    c.B(f'return_screen_{side}', sx * 11.8, sx * 9.5, -.45, 1.9, *zs, 'rammed', 'cover', dict(kind='lowwall', axis='z'))
    ze = sorted((sz * 2.5, sz * 4.5))
    c.B(f'return_screen_{side}_end', sx * 9.9, sx * 9.5, 0, 1.9, *ze, 'rammed', 'cover', dict(kind='lowwall', axis='x'))
    c.anchor(f'cover_return_{side}', 'cover', [sx * 10.45, 0, sz * 3.7], height=1.9)
# L02/L05: landmark blocks cut the 40 m lines along the outer corridors: war drums in the north
# corridor, vermilion gates in the south one. Both stop below the baulk tops (no new perch).
for sx in (-1, 1):
    side = 'w' if sx < 0 else 'e'
    c.B(f'war_drum_{side}', sx * 8.0, sx * 6.2, PIT, PIT + 1.9, -12.6, -9.5, 'lacquer', 'cover', dict(kind='wardrum'))
    c.B(f'vermilion_gate_{side}', sx * 7.6, sx * 6.6, PIT, PIT + 1.9, 9.3, 12.7, 'lacquer', 'cover', dict(kind='redgate'))
    c.anchor(f'cover_drum_{side}', 'cover', [sx * 7.1, PIT, -13.2], height=1.9)
    c.anchor(f'cover_gate_{side}', 'cover', [sx * 8.2, PIT, 11.3], height=1.9)
# The emperor's bronze chariot on its plinth, the four-horse team in front of it.
c.B('chariot_plinth', -2.4, 2.4, PIT, PIT + .45, -1.5, 1.5, 'brick', 'cover', dict(kind='plinth'))
c.B('chariot', -1.7, 1.7, PIT + .45, PIT + 2.25, -1.0, 1.5, 'bronze', 'cover', dict(kind='chariot'))
c.B('chariot_team', -1.5, 1.5, PIT, PIT + 1.8, 1.5, 3.6, 'bronze', 'cover', dict(kind='team'))
c.anchor('objective_chariot', 'objective', [0, PIT, -3.2], radius=2)
c.anchor('objective_north', 'objective', [0, 0, -18.6], radius=2)
c.anchor('objective_south', 'objective', [0, 0, 18.6], radius=2)
c.anchor('cover_chariot', 'cover', [3.2, PIT, 0], height=1.8)
for sz in (-1, 1):
    c.anchor(f'cover_ding_{sz}', 'cover', [9, 0, sz * 18.6], height=1.35)
    c.anchor(f'cover_rail_{sz}', 'cover', [-15, 0, sz * 17.4], height=1.0)
# Mercury runnels along the baulk feet and round the plinth (surface marks, no collision).
for sz in (-1, 1):
    for k, (x0, x1) in enumerate(((-21, -9.5), (-6.5, 6.5), (9.5, 21))):
        c.B(f'mercury_{sz}_{k}', x0 + .3, x1 - .3, PIT, PIT + .03, sz * 4.42, sz * 4.2, 'mercury', 'wayfinding', collision=False)

c.route('north_gallery', [[-27.5, 0, -2], [-27.5, 0, -18], [27.5, 0, -18], [27.5, 0, -2]])
c.route('south_gallery', [[-27.5, 0, 2], [-27.5, 0, 18], [27.5, 0, 18], [27.5, 0, 2]])
c.route('baulk_catwalk', [[-25.4, 0, 6.6], [-22.4, 0, 5.5], [22.4, 0, 5.5], [25.4, 0, 6.6]])
c.route('centre_corridor', [[-25.4, 0, 6.6], [-22.4, 0, 6.6], [-22.4, 0, 0], [-15, PIT, 0], [-8, PIT, 0], [-8, PIT, -3.2], [0, PIT, -3.2], [8, PIT, -3.2], [8, PIT, 0], [15, PIT, 0], [22.4, 0, 0]])
c.route('south_corridor', [[-22.4, 0, 11.5], [-15, PIT, 11.5], [-10.4, PIT, 11.5], [-10.4, PIT, 8.2], [-5.2, PIT, 8.2], [-5.2, PIT, 10.0], [5.2, PIT, 10.0], [5.2, PIT, 8.2], [10.4, PIT, 8.2], [10.4, PIT, 11.5], [15, PIT, 11.5], [22.4, 0, 11.5]])
c.route('gallery_stair', [[0, 0, -18.6], [0, 0, -16.2], [0, PIT, -10.3], [-5, PIT, -10.3], [-5, PIT, -8.4], [-8, PIT, -7.6], [-8, PIT, 0]])
c.route('return_west', [[-14.5, PIT, .3], [-16, PIT, 3.3], [-11.0, 0, 3.3], [-10.45, 0, 3.6], [-10.45, 0, 5.5], [-14, 0, 5.5]])
c.route('return_east', [[14.5, PIT, -.3], [16, PIT, -3.3], [11.0, 0, -3.3], [10.45, 0, -3.6], [10.45, 0, -5.5], [14, 0, -5.5]])

# ------------------------------------------------------------------ figures (modelled once, placed many times)
def warrior(kind=0):
    """Standing terracotta soldier facing +x, 1.86 m with its base slab. kind 1 is an armoured officer."""
    m = Mesh(); T, TD, TP = 'terracotta', 'terracottaDark', 'terracottaPale'
    m.box(TD, (-.21, 0, -.2), (.21, .05, .2))
    for s in (-1, 1):
        z = s * .1
        loft(m, T, [rect(-.09, .09, .05, z - .075, z + .075), rect(-.085, .1, .5, z - .085, z + .085), rect(-.1, .11, .92, z - .095, z + .095)])
        m.box(TD, (-.07, .05, z - .07), (.17, .13, z + .07))
        m.box(TD, (-.095, .36, z - .09), (.105, .5, z + .09))          # shin wrap
    # tunic: flared hem, belted waist, broad shoulders
    hem = [(.25, .78), (.235, .9), (.2, 1.08), (.205, 1.16)]
    lathe(m, T, 0, 0, hem, 8, math.pi / 8, cap=False)
    loft(m, TP if kind else T, [rect(-.13, .14, 1.12, -.2, .2), rect(-.14, .15, 1.36, -.225, .225), rect(-.125, .135, 1.5, -.27, .27), rect(-.09, .1, 1.56, -.17, .17)])
    m.box(TD, (-.145, 1.1, -.215), (.155, 1.16, .215))                  # belt
    if kind:
        for yy in (1.2, 1.28, 1.36, 1.44):                              # lamellar rows
            m.box(TD, (.142, yy, -.2), (.156, yy + .015, .2)); m.box(TD, (-.146, yy, -.2), (-.132, yy + .015, .2))
        for s in (-1, 1): m.box(TP, (-.1, 1.4, s * .22), (.11, 1.56, s * .33))   # shoulder guards
    else:
        m.box('pigmentRed' if kind == 0 else TD, (.141, 1.2, -.05), (.153, 1.5, .05))  # trace of painted lapel
    # arms: left hangs, right is bent forward for the lost spear
    beam(m, T, (0, 1.5, -.27), (.02, 1.16, -.29), .055, 5); beam(m, T, (.02, 1.16, -.29), (.05, .9, -.27), .05, 5)
    beam(m, T, (0, 1.5, .27), (.06, 1.2, .3), .055, 5); beam(m, T, (.06, 1.2, .3), (.3, 1.14, .24), .05, 5)
    m.blob(TP, (.34, 1.14, .23), .055, 1); m.blob(TP, (.05, .86, -.27), .05, 1.2)
    lathe(m, TP, 0, 0, [(.085, 1.55), (.07, 1.6), (.075, 1.66)], 6, cap=False)
    m.box(TD, (-.09, 1.56, -.1), (.11, 1.6, .1))                         # scarf
    m.blob(TP, (.01, 1.74, 0), .115, 1.18)
    m.box(TP, (.1, 1.72, -.02), (.135, 1.76, .02))                       # nose
    if kind:
        m.box(TD, (-.1, 1.84, -.08), (.07, 1.9, .08)); m.box(TD, (-.12, 1.86, -.05), (-.04, 1.98, .05))   # officer's cap
    else:
        m.blob(TD, (-.05, 1.87, .06), .055, 1.1)                         # side topknot
    return m


def horse():
    """Saddled terracotta war horse facing +x, 1.7 m at the ears, with its base slab."""
    m = Mesh(); T, TD, TP = 'terracotta', 'terracottaDark', 'terracottaPale'
    m.box(TD, (-1.0, 0, -.27), (1.0, .05, .27))
    def ring(x, y, w, h, n=8):
        return [(x, y + h / 2 * math.sin(math.tau * i / n), w / 2 * math.cos(math.tau * i / n)) for i in range(n)]
    loft(m, T, [ring(-.78, 1.16, .34, .42), ring(-.6, 1.2, .5, .58), ring(-.1, 1.15, .52, .6), ring(.42, 1.2, .5, .62), ring(.66, 1.26, .36, .5)])
    loft(m, T, [ring(.6, 1.3, .3, .44), ring(.78, 1.52, .22, .34), ring(.9, 1.68, .17, .26)], close=False)   # neck
    loft(m, TP, [ring(.86, 1.7, .2, .26), ring(1.06, 1.6, .15, .2), ring(1.2, 1.5, .11, .13)])                # head
    for s in (-1, 1):
        m.tri(TD, (.84, 1.8, s * .06), (.9, 1.8, s * .09), (.86, 1.93, s * .08))                               # ears
        for x, back in ((.5, 0), (-.62, 1)):
            beam(m, T, (x, 1.0, s * .15), (x + (.05 if back else -.02), .52, s * .15), .075, 5)
            beam(m, T, (x + (.05 if back else -.02), .52, s * .15), (x, .1, s * .15), .052, 5)
            m.box(TD, (x - .07, .05, s * .15 - .06), (x + .08, .13, s * .15 + .06))
    for i in range(5): m.box(TD, (.62 + i * .055, 1.5 + i * .045, -.02), (.66 + i * .055, 1.62 + i * .045, .02))   # cropped mane
    beam(m, TD, (-.8, 1.3, 0), (-1.0, .82, 0), .05, 5)                                                         # bound tail
    m.box(TP, (-.3, 1.44, -.3), (.16, 1.5, .3)); m.box('pigmentRed', (-.25, 1.5, -.27), (.11, 1.52, .27))      # saddle and cloth
    return m


WARRIORS = [warrior(0), warrior(1)]; HORSE = horse()

def rank(m, o, a):
    """A file of figures shoulder to shoulder. West: red-sashed infantry led by an officer; east: the blue guard."""
    x0, x1, y0, y1, z0, z1 = ext(o); sx = a['sx']; face = 0 if sx < 0 else math.pi; r = random.Random(900 + a['n'] * 2 + (sx > 0))
    cx = (x0 + x1) / 2; n = max(2, int((z1 - z0 - .76) / .58) + 1)
    # L04: the file stands on a continuous earthen base with a timber kerb, so the whole box reads as one solid
    BASE = .24; fit = (y1 - y0 - BASE) / 1.98
    tbox(m, 'rammedDark', x0, x1, z0, z1, y0, y0 + BASE, .03, top_material='earthDark')
    for xx in (x0 + .03, x1 - .09): m.box('timber', (xx, y0 + BASE - .08, z0 + .03), (xx + .06, y0 + BASE, z1 - .03))
    for k in range(n):
        officer = (k == 0 and a['n'] % 2 == 0) if sx < 0 else k % 2 == 0
        place(m, WARRIORS[1 if officer else 0], cx + r.uniform(-.02, .02), y0 + BASE, z0 + .38 + (z1 - z0 - .76) * k / (n - 1),
              face + r.uniform(-.06, .06), 1.0, fit * (.98 if officer else r.uniform(.97, 1.0)), remap=None if sx < 0 else dict(pigmentRed='pigmentBlue'))
    return True


def wheel(m, x, y, z, r, axis='z', spokes=14, mat_='bronze', hub='gold'):
    """Spoked wheel standing in the plane across `axis`."""
    def P(a, rr, off):
        u, v = rr * math.cos(a), rr * math.sin(a)
        return (x + u, y + v, z + off) if axis == 'z' else (x + off, y + v, z + u)
    n = 20
    for i in range(n):
        a, b = math.tau * i / n, math.tau * (i + 1) / n
        for off, flip in ((-.045, 0), (.045, 1)):
            q = (P(a, r - .09, off), P(b, r - .09, off), P(b, r, off), P(a, r, off))
            m.quad(mat_, *(q if flip else q[::-1]))
        m.quad(mat_, P(a, r, -.045), P(b, r, -.045), P(b, r, .045), P(a, r, .045))
        m.quad(mat_, P(b, r - .09, -.045), P(a, r - .09, -.045), P(a, r - .09, .045), P(b, r - .09, .045))
    for i in range(spokes):
        a = math.tau * i / spokes
        beam(m, mat_, P(a, .1, 0), P(a, r - .08, 0), .018, 4)
    beam(m, hub, P(0, 0, -.1), P(0, 0, .1), .1, 8)


def chariot(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)   # the car faces +z, toward its team
    B_, G = 'bronze', 'gold'
    for sx in (-1, 1): wheel(m, sx * 1.52, y0 + .68, -.1, .68, 'x')
    beam(m, 'bronzeDark', (-1.5, y0 + .68, -.1), (1.5, y0 + .68, -.1), .05, 6)                     # axle
    m.box('bronzeDark', (-1.18, y0 + .62, -.82), (1.18, y0 + .72, .62))                             # floor frame
    for sx in (-1, 1):
        loft(m, B_, [rect(sx * 1.18 - .04, sx * 1.18 + .04, y0 + .72, -.82, .62), rect(sx * 1.2 - .04, sx * 1.2 + .04, y0 + 1.22, -.84, .5)])
        m.box(G, (sx * 1.2 - .05, y0 + 1.2, -.84), (sx * 1.2 + .05, y0 + 1.26, .5))
        for zz in (-.5, -.1, .3): m.box(G, (sx * 1.2 - .052, y0 + .8, zz - .02), (sx * 1.2 + .052, y0 + 1.2, zz + .02))
    loft(m, B_, [rect(-1.18, 1.18, y0 + .72, -.86, -.78), rect(-1.2, 1.2, y0 + 1.36, -.9, -.82)])     # back board
    m.box(G, (-1.2, y0 + 1.34, -.91), (1.2, y0 + 1.4, -.81))
    m.box(B_, (-1.18, y0 + .72, .56), (1.18, y0 + 1.02, .62)); m.box(G, (-1.18, y0 + 1.0, .55), (1.18, y0 + 1.05, .63))
    for i in range(7): m.box('bronzeDark', (-1.0 + i * .33, y0 + .8, -.905), (-.94 + i * .33, y0 + 1.3, -.895))
    # round canopy on its staff: the mark of the emperor's standing chariot
    beam(m, G, (0, y0 + .72, -.3), (0, y1 - .22, -.3), .035, 6)
    lathe(m, B_, 0, -.3, [(.68, y1 - .3), (.66, y1 - .24), (.42, y1 - .1), (.1, y1 - .02), (0, y1)], 16, cap=False)
    lathe(m, G, 0, -.3, [(.685, y1 - .33), (.685, y1 - .3)], 16, cap=False)
    for i in range(16):
        t = math.tau * i / 16; beam(m, 'bronzeDark', (0, y1 - .22, -.3), (.65 * math.cos(t), y1 - .27, -.3 + .65 * math.sin(t)), .012, 3)
    beam(m, 'bronzeDark', (0, y0 + .68, .6), (0, y0 + .95, z1 - .08), .04, 5)                        # draught pole
    return True


def team(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    for x in (-1.08, -.36, .36, 1.08):
        place(m, HORSE, x, y0, (z0 + z1) / 2 - .07, -math.pi / 2, .92, .92, remap=dict(terracotta='bronze', terracottaDark='bronzeDark', terracottaPale='bronze', pigmentRed='gold'))
    beam(m, 'gold', (-1.3, y0 + 1.38, z0 + .5), (1.3, y0 + 1.38, z0 + .5), .03, 5)                     # yoke bar
    return True


def plinth(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    tbox(m, 'brick', x0, x1, z0, z1, y0, y0 + .3, .12); tbox(m, 'brickLight', x0 + .12, x1 - .12, z0 + .12, z1 - .12, y0 + .3, y1, .1)
    return True


def wall(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('rammed', (x0, y0, z0), (x1, y1, z1))
    return True


def baulk(m, o, a):
    """Rammed-earth partition: battered faces, eroded shoulder, rafter sockets and a trodden plank top."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    tbox(m, 'rammed', x0, x1, z0, z1, y0, y1 - .5, .12)
    tbox(m, 'rammedDark', x0 + .12, x1 - .12, z0 + .12, z1 - .12, y1 - .5, y1 - .06, .1)
    m.box('timberLight', (x0 + .22, y1 - .06, z0 + .5), (x1 - .22, y1, z1 - .5))
    x = x0 + .6
    while x < x1 - .5:
        for zz in (z0 + .13, z1 - .13): m.box('earthDark', (x - .1, y1 - .4, zz - .02), (x + .1, y1 - .22, zz + .02)); m.box('timber', (x - .07, y1 - .37, zz - .03), (x + .07, y1 - .25, zz + .03))
        m.box('timber', (x - .06, y1 - .005, z0 + .5), (x - .04, y1 + .0, z1 - .5))
        x += 1.15
    return True


def planks(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o); x = x0
    i = 0
    while x < x1 - .01:
        w = min(.3, x1 - x); m.box('timberLight' if i % 2 else 'timber', (x + .012, y0 + .09, z0 + .04), (x + w - .012, y1, z1 - .04)); x += .3; i += 1
    for zz in (z0 + .12, z1 - .3): m.box('timber', (x0, y0, zz), (x1, y0 + .1, zz + .18))
    return True


def gallery(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('rammed', (x0, y0, z0), (x1, y1 - .22, z1), top_mat='brick')
    m.box('brickDark', (x0, y1 - .22, z0), (x1, y1 - .06, z1)); m.box('brick', (x0 + .06, y1 - .06, z0 + .06), (x1 - .06, y1, z1 - .06))
    return True


def column(m, o, a):
    """Lacquered timber column on a drum base with a bronze collar and a bracket block."""
    x0, x1, y0, y1, z0, z1 = ext(o); x, z = (x0 + x1) / 2, (z0 + z1) / 2
    lathe(m, 'brickLight', x, z, [(.35, y0), (.35, y0 + .1), (.3, y0 + .22), (.26, y0 + .26)], 12)
    lathe(m, 'lacquer', x, z, [(.24, y0 + .26), (.245, y0 + 1.6), (.22, y1 - .5)], 12, cap=False)
    lathe(m, 'gold', x, z, [(.255, y0 + .26), (.255, y0 + .4)], 12, cap=False); lathe(m, 'bronze', x, z, [(.235, y1 - .62), (.235, y1 - .5)], 12, cap=False)
    m.box('lacquerDark', (x - .3, y1 - .5, z - .3), (x + .3, y1 - .34, z + .3)); m.box('lacquer', (x - .35, y1 - .34, z - .2), (x + .35, y1 - .18, z + .2))
    m.box('lacquerDark', (x - .2, y1 - .34, z - .35), (x + .2, y1 - .18, z + .35)); m.box('lacquerDark', (x - .35, y1 - .18, z - .35), (x + .35, y1, z + .35))
    return True


def rail(m, o, a):
    x0, x1, y0, y1, z0, z1 = ext(o)
    if a['axis'] == 'x':
        zc = (z0 + z1) / 2; n = max(1, round((x1 - x0) / 1.3)); step = (x1 - x0) / n
        m.box('lacquerDark', (x0, y1 - .1, z0), (x1, y1, z1)); m.box('lacquer', (x0, y0, z0 + .05), (x1, y0 + .12, z1 - .05)); m.box('lacquer', (x0, y0 + .52, zc - .04), (x1, y0 + .6, zc + .04))
        for i in range(n + 1):
            x = x0 + step * i; x = min(max(x, x0 + .07), x1 - .07); m.box('lacquerDark', (x - .07, y0, z0), (x + .07, y1 - .1, z1))
        for i in range(n):
            xa, xb = x0 + step * i + .1, x0 + step * (i + 1) - .1
            for u, v in (((xa, y0 + .14), (xb, y0 + .5)), ((xa, y0 + .5), (xb, y0 + .14))):
                beam(m, 'timberLight', (u[0], u[1], zc), (v[0], v[1], zc), .022, 4)
            for u, v in (((xa, y0 + .62), ((xa + xb) / 2, y1 - .12)), (((xa + xb) / 2, y1 - .12), (xb, y0 + .62))):
                beam(m, 'timberLight', (u[0], u[1], zc), (v[0], v[1], zc), .02, 4)
    else:
        xc = (x0 + x1) / 2; n = max(1, round((z1 - z0) / 1.3)); step = (z1 - z0) / n
        m.box('lacquerDark', (x0, y1 - .1, z0), (x1, y1, z1)); m.box('lacquer', (x0 + .05, y0, z0), (x1 - .05, y0 + .12, z1)); m.box('lacquer', (xc - .04, y0 + .52, z0), (xc + .04, y0 + .6, z1))
        for i in range(n + 1):
            z = z0 + step * i; z = min(max(z, z0 + .07), z1 - .07); m.box('lacquerDark', (x0, y0, z - .07), (x1, y1 - .1, z + .07))
        for i in range(n):
            za, zb = z0 + step * i + .1, z0 + step * (i + 1) - .1
            for u, v in (((za, y0 + .14), (zb, y0 + .5)), ((za, y0 + .5), (zb, y0 + .14))):
                beam(m, 'timberLight', (xc, u[1], u[0]), (xc, v[1], v[0]), .022, 4)
    return True


def ding(m, o, a):
    """Bronze ritual cauldron: three legs, banded belly, upright ears; coals glow inside."""
    x0, x1, y0, y1, z0, z1 = ext(o); x, z = (x0 + x1) / 2, (z0 + z1) / 2
    for i in range(3):
        t = math.tau * i / 3 + .5; beam(m, 'bronzeDark', (x + .45 * math.cos(t), y0 + .03, z + .45 * math.sin(t)), (x + .36 * math.cos(t), y0 + .5, z + .36 * math.sin(t)), .075, 6)
    lathe(m, 'bronze', x, z, [(.3, y0 + .42), (.56, y0 + .52), (.66, y0 + .78), (.66, y0 + 1.0), (.69, y0 + 1.06), (.6, y0 + 1.06), (.56, y0 + .8)], 16, cap=False)
    lathe(m, 'gold', x, z, [(.668, y0 + .84), (.668, y0 + .94)], 16, cap=False)
    lathe(m, 'coal', x, z, [(.56, y0 + .96), (0, y0 + 1.0)], 10, cap=False)
    for s in (-1, 1):
        m.box('bronze', (x + s * .62 - .05, y0 + 1.04, z - .14), (x + s * .62 + .05, y1, z - .09)); m.box('bronze', (x + s * .62 - .05, y0 + 1.04, z + .09), (x + s * .62 + .05, y1, z + .14))
        m.box('bronze', (x + s * .62 - .05, y1 - .06, z - .14), (x + s * .62 + .05, y1, z + .14))
    return True


def chimes(m, o, a):
    """Bianzhong: a lacquered frame with two tiers of bronze bells."""
    x0, x1, y0, y1, z0, z1 = ext(o); zc = (z0 + z1) / 2
    for x in (x0 + .11, x1 - .11):
        m.box('lacquer', (x - .09, y0, zc - .12), (x + .09, y1, zc + .12)); m.box('gold', (x - .1, y0, zc - .2), (x + .1, y0 + .1, zc + .2))
    for yy in (y0 + .9, y1 - .1): m.box('lacquerDark', (x0, yy, zc - .07), (x1, yy + .1, zc + .07))
    for tier, (yy, n, s) in enumerate(((y0 + .9, 5, 1.0), (y1 - .1, 7, .68))):
        for i in range(n):
            x = x0 + .35 + (x1 - x0 - .7) * i / (n - 1); h = .44 * s * (1 - .06 * i)
            lathe(m, 'bronze', x, zc, [(.15 * s, yy - .06 - h), (.13 * s, yy - .06 - h * .5), (.09 * s, yy - .08), (.03, yy - .04)], 8, cap=True)
            beam(m, 'gold', (x, yy - .04, zc), (x, yy, zc), .012, 3)
    return True


def rack(m, o, a):
    """Weapon stand: halberds and spears leaning in a lacquered frame, shields at its foot."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc = (x0 + x1) / 2
    for z in (z0 + .07, z1 - .07): m.box('lacquer', (xc - .3, y0, z - .07), (xc + .3, y0 + .1, z + .07)); m.box('lacquerDark', (xc - .06, y0, z - .06), (xc + .06, y1, z + .06))
    for yy in (y0 + .45, y1 - .1): m.box('lacquerDark', (xc - .05, yy, z0), (xc + .05, yy + .09, z1))
    n = 6
    for i in range(n):
        z = z0 + .3 + (z1 - z0 - .6) * i / (n - 1)
        beam(m, 'timberLight', (xc + .22, y0 + .05, z), (xc - .2, y1 - .08, z), .022, 4)
        m.tri('bronze', (xc - .2, y1 - .3, z - .07), (xc - .2, y1 - .3, z + .07), (xc - .26, y1, z))
    for i in range(3):
        z = z0 + .5 + i * (z1 - z0 - 1) / 2
        loft(m, 'lacquer', [rect(x0 + .02, x0 + .08, y0 + .02, z - .28, z + .28), rect(x0 + .16, x0 + .22, y0 + .78, z - .22, z + .22)])
        m.box('gold', (x0 + .1, y0 + .36, z - .06), (x0 + .16, y0 + .48, z + .06))
    return True


def screen(m, o, a):
    """Spirit screen: tiled coping over a rammed panel with a bronze mask roundel on both faces."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc = (x0 + x1) / 2
    m.box('brickDark', (x0, y0, z0), (x1, y0 + .35, z1)); m.box('rammedLight', (x0 + .06, y0 + .35, z0 + .25), (x1 - .06, y1 - .5, z1 - .25))
    for z in (z0, z1 - .25): m.box('brick', (x0, y0 + .35, z), (x1, y1 - .5, z + .25))
    m.box('lacquerDark', (x0, y1 - .5, z0), (x1, y1 - .38, z1))
    for sgn in (-1, 1):
        loft(m, 'tile', [[(xc, y1 - .38, z0), (xc + sgn * .3, y1 - .38, z0), (xc + sgn * .3, y1 - .38, z1), (xc, y1 - .38, z1)],
                         [(xc, y1 - .02, z0), (xc + sgn * .02, y1 - .02, z0), (xc + sgn * .02, y1 - .02, z1), (xc, y1 - .02, z1)]])
    for sgn in (-1, 1):
        for r_, mm, off in ((1.25, 'bronzeDark', .262), (1.05, 'bronze', .274)):
            xf = xc + sgn * off
            for i in range(20):
                t0, t1 = math.tau * i / 20, math.tau * (i + 1) / 20
                m.tri(mm, (xf, y0 + 1.75, 0), (xf, y0 + 1.75 + r_ * math.sin(t1), r_ * math.cos(t1)), (xf, y0 + 1.75 + r_ * math.sin(t0), r_ * math.cos(t0)))
        # mask in gold relief: brows, eyes, nose bar, fangs (abstract, no script)
        xg = xc + sgn * .287
        def g(ya, yb, za, zb): m.box('gold', (xg - .009, y0 + ya, min(za, zb)), (xg + .009, y0 + yb, max(za, zb)))
        for s_ in (-1, 1):
            g(2.1, 2.22, s_ * .18, s_ * .82); g(1.82, 2.0, s_ * .3, s_ * .6); g(1.18, 1.5, s_ * .22, s_ * .34); g(1.4, 1.52, s_ * .62, s_ * .9)
        g(1.42, 2.06, -.07, .07); g(1.3, 1.42, -.2, .2)
    return True


def que(m, o, a):
    """Gate tower in miniature: battered earth body, timber belt and a hipped tile cap, all within its box."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    tbox(m, 'rammed', x0, x1, z0, z1, y0, y0 + 3.6, .28)
    m.box('brickDark', (x0, y0, z0), (x1, y0 + .3, z1))
    m.box('lacquerDark', (x0 + .2, y0 + 3.6, z0 + .2), (x1 - .2, y0 + 3.85, z1 - .2)); m.box('rammedLight', (x0 + .42, y0 + 3.85, z0 + .42), (x1 - .42, y0 + 4.5, z1 - .42))
    for i in range(4):
        zz = z0 + .6 + i * (z1 - z0 - 1.2) / 3
        for xx in (x0 + .41, x1 - .43): m.box('lacquer', (xx, y0 + 3.9, zz - .08), (xx + .02, y0 + 4.4, zz + .08))
    m.box('lacquerDark', (x0 + .1, y0 + 4.5, z0 + .1), (x1 - .1, y0 + 4.62, z1 - .1))
    hiproof(m, 'tile', x0, x1, z0, z1, y0 + 4.62, y1 - .05)
    m.box('tileLight', ((x0 + x1) / 2 - .08, y1 - .12, (z0 + z1) / 2 - .5), ((x0 + x1) / 2 + .08, y1, (z0 + z1) / 2 + .5))
    return True


def leanroof(m, o, a):
    """Gallery roof: one tiled pitch falling toward the pit, round-tile ribs and eave discs."""
    x0, x1, y0, y1, z0, z1 = ext(o); sz = a['sz']; zb, zf = (z0, z1) if sz < 0 else (z1, z0)   # back wall, front eave
    m.quad('tile', (x0, y1 - .12, zb), (x1, y1 - .12, zb), (x1, y0 + .14, zf), (x0, y0 + .14, zf))
    m.quad('lacquerDark', (x0, y0, zf), (x1, y0, zf), (x1, y1 - .26, zb), (x0, y1 - .26, zb))
    m.quad('lacquer', (x0, y0, zf), (x0, y0 + .14, zf), (x1, y0 + .14, zf), (x1, y0, zf))
    inward = -sz * -1  # +1 when the eave faces +z
    zfi, zbi = zf - (.09 if sz < 0 else -.09), zb + (.05 if sz < 0 else -.05)
    x = x0 + .3
    while x < x1 - .2:
        beam(m, 'tileLight', (x, y1 - .1, zbi), (x, y0 + .2, zfi), .045, 5)
        m.blob('tileLight', (x, y0 + .2, zfi), .07, 1)
        x += .6
    x = x0 + .5
    while x < x1:
        beam(m, 'lacquer', (x, y1 - .34, zbi), (x, y0 + .07, zfi), .04, 4); x += 1.5
    m.box('lacquerDark', (x0, y1 - .12, min(zb, zb - sz * .09)), (x1, y1, max(zb, zb - sz * .09)))
    return True


def endroof(m, o, a):
    """Roof timbers over the spawn end: tie beams and close-set rafters, seen from below."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('lacquerDark', (x0, y0 + .2, z0), (x1, y1, z1))
    x = x0 + .4
    while x < x1:
        m.box('timber', (x - .11, y0, z0), (x + .11, y0 + .2, z1)); x += 1.9
    for z in (z0 + .3, -11.5, 0, 11.5, z1 - .3): m.box('lacquer', (x0, y0, z - .16), (x1, y0 + .14, z + .16))
    return True


def lowwall(m, o, a):
    """Short rammed-earth wall with a brick foot and a tiled coping."""
    x0, x1, y0, y1, z0, z1 = ext(o)
    m.box('brickDark', (x0, y0, z0), (x1, y0 + .3, z1)); m.box('rammed', (x0 + .02, y0 + .3, z0 + .02), (x1 - .02, y1 - .22, z1 - .02))
    m.box('lacquerDark', (x0, y1 - .22, z0), (x1, y1 - .14, z1)); m.box('tile', (x0, y1 - .14, z0), (x1, y1, z1))
    return True


def wardrum(m, o, a):
    """A great war drum of the host on its lacquered stand: bronze-studded skin, gilt hoops."""
    x0, x1, y0, y1, z0, z1 = ext(o); xc, zc = (x0 + x1) / 2, (z0 + z1) / 2
    tbox(m, 'brick', x0, x1, z0, z1, y0, y0 + .25, .05)
    m.box('lacquerDark', (x0 + .08, y0 + .25, z0 + .08), (x1 - .08, y0 + .55, z1 - .08))
    r = min(x1 - x0, z1 - z0) / 2 - .05
    lathe(m, 'lacquer', xc, zc, [(r * .9, y0 + .55), (r, y0 + .85), (r, y1 - .35), (r * .9, y1 - .06)], 20, cap=False)
    lathe(m, 'gold', xc, zc, [(r * .905, y1 - .1), (r * .905, y1 - .06)], 20, cap=False)
    lathe(m, 'gold', xc, zc, [(r + .005, y0 + 1.0), (r + .005, y0 + 1.06)], 20, cap=False)
    lathe(m, 'rammedLight', xc, zc, [(r * .9, y1 - .06), (0, y1 - .06)], 20, cap=False)         # the skin
    for i in range(16):
        t = math.tau * i / 16; m.blob('bronze', (xc + r * .86 * math.cos(t), y1 - .1, zc + r * .86 * math.sin(t)), .035, 1)
    return True


def redgate(m, o, a):
    """Vermilion gate (朱门): two lacquered leaves with rows of bronze studs in a black frame under a tiled hood."""
    x0, x1, y0, y1, z0, z1 = ext(o); zc = (z0 + z1) / 2
    m.box('lacquerDark', (x0, y0, z0), (x1, y1 - .25, z1))
    m.box('lacquer', (x0 + .06, y0 + .1, z0 + .1), (x1 - .06, y1 - .35, z1 - .1))
    for xf, sg in ((x0 + .06, -1), (x1 - .06, 1)):
        m.box('lacquerDark', (min(xf, xf + sg * .02), y0 + .1, zc - .03), (max(xf, xf + sg * .02), y1 - .35, zc + .03))   # the meeting of the leaves
        for row in range(4):
            for col in range(4):
                for half in (-1, 1):
                    zz = zc + half * (.18 + col * .2); yy = y0 + .35 + row * .32
                    m.box('bronze', (min(xf, xf + sg * .035), yy - .03, zz - .03), (max(xf, xf + sg * .035), yy + .03, zz + .03))
        for half in (-1, 1):
            m.box('gold', (min(xf, xf + sg * .05), y0 + .8, zc + half * .1 - .05), (max(xf, xf + sg * .05), y0 + .95, zc + half * .1 + .05))
    m.box('tile', (x0, y1 - .25, z0), (x1, y1 - .1, z1)); m.box('tileLight', (x0 + .1, y1 - .1, z0), (x1 - .1, y1, z1))
    return True


KINDS = dict(lowwall=lowwall, wardrum=wardrum, redgate=redgate, rank=rank, chariot=chariot, team=team, plinth=plinth, wall=wall, baulk=baulk,
             planks=planks, gallery=gallery, column=column, rail=rail, ding=ding, chimes=chimes, rack=rack, screen=screen, que=que,
             leanroof=leanroof, endroof=endroof, steps=lambda m, o, a: steps(m, o, 'timberLight', 'rammed', 'rammedDark', .22))

# ------------------------------------------------------------------ decorative craft (no collision)
# Trodden pit floor: brick paving strips down each corridor, wheel ruts and fallen shards.
D.box('brickDark', (-21, PIT, -3.4), (21, PIT + .012, 3.4))
for z0, z1 in ((-16, -6.5), (-4.5, 4.5), (6.5, 16)):
    for x in range(-20, 21, 2): D.box('earthDark', (x - .03, PIT, z0 + .2), (x + .03, PIT + .016, z1 - .2))
for i in range(60):
    x, z = rng.uniform(-20, 20), rng.uniform(-15.5, 15.5)
    if abs(abs(z) - 5.5) < 1.6: continue
    s_ = rng.uniform(.06, .14); D.blob('terracottaDark' if i % 2 else 'terracotta', (x, PIT + s_ * .35, z), s_, .55)
# Broken figures: legs still standing on their slab, the head rolled a pace away.
for (x, z) in ((-9.8, -13.2), (10.4, 14.2), (6.2, -12.4), (-17.4, 2.9)):
    D.box('terracottaDark', (x - .21, PIT, z - .2), (x + .21, PIT + .05, z + .2))
    for s_ in (-1, 1): loft(D, 'terracotta', [rect(x - .09, x + .09, PIT + .05, z + s_ * .1 - .075, z + s_ * .1 + .075), rect(x - .1, x + .11, PIT + .3, z + s_ * .1 - .09, z + s_ * .1 + .09)])
    D.blob('terracottaPale', (x + .5, PIT + .1, z + .34), .115, 1.1); D.blob('terracotta', (x - .42, PIT + .09, z - .3), .2, .5)
# Roof timbers over the open centre: lacquered tie beams with rafters; the dome hangs above them.
for x in (-12, -8, -4, 4, 8, 12):
    D.box('lacquerDark', (x - .22, 6.72, -21.4), (x + .22, 7.05, 21.4))
    for z in (-11.5, 0, 11.5): D.box('gold', (x - .24, 6.7, z - .3), (x + .24, 7.07, z + .3))
for z in (-16, -6.5, -4.5, 4.5, 6.5, 16):
    D.box('lacquer', (-14, 6.55, z - .12), (14, 6.75, z + .12))
# Star-map dome: night-blue coffers ringed with bronze, constellations of pearl; an oculus lets the moon in.
def dome_point(r, t, R=13.5, top=11.6, base=7.3):
    return (r * math.cos(t), base + (top - base) * math.sqrt(max(0, 1 - (r / R) ** 2)) , r * math.sin(t))
for i in range(28):
    t0, t1 = math.tau * i / 28, math.tau * (i + 1) / 28
    for k, (ra, rb) in enumerate(((13.5, 10.5), (10.5, 7.2), (7.2, 3.4))):
        D.quad('nightLacquer' if (i + k) % 2 else 'rock', dome_point(ra, t1), dome_point(ra, t0), dome_point(rb, t0), dome_point(rb, t1))
    for r_ in (13.5, 10.5, 7.2, 3.4):
        a_, b_ = dome_point(r_, t0), dome_point(r_, t1); beam(D, 'bronze' if r_ > 4 else 'gold', (a_[0], a_[1] - .04, a_[2]), (b_[0], b_[1] - .04, b_[2]), .07, 4)
    if i % 2 == 0: beam(D, 'bronzeDark', dome_point(13.5, t0), dome_point(3.4, t0), .05, 4)
for i in range(120):
    r_, t = rng.uniform(3.8, 13), rng.uniform(0, math.tau); p = dome_point(r_, t); s = rng.choice((.05, .05, .07, .1))
    D.blob('star', (p[0], p[1] - .12, p[2]), s, 1)
for pts in ([(5, .3), (6.4, .7), (7.6, .55), (8.9, .9), (10.2, .8), (11.2, 1.2), (12.2, 1.1)], [(6, 3.3), (7.2, 3.6), (8.8, 3.5), (9.4, 4.0)], [(5.2, 5.0), (6.6, 5.3), (7.1, 5.9), (8.6, 5.7), (9.9, 6.1)]):
    for (ra, ta), (rb, tb) in zip(pts, pts[1:]):
        a_, b_ = dome_point(ra, ta), dome_point(rb, tb); beam(D, 'star', (a_[0], a_[1] - .12, a_[2]), (b_[0], b_[1] - .12, b_[2]), .012, 3)
def ceiling_ring(y=7.3, R=13.5, hx=14, hz=21.4, n=56):
    def hit(t):
        dx, dz = math.cos(t), math.sin(t); k = min(hx / abs(dx) if abs(dx) > 1e-9 else 1e9, hz / abs(dz) if abs(dz) > 1e-9 else 1e9)
        return (dx * k, y, dz * k)
    for i in range(n):
        t0, t1 = math.tau * i / n, math.tau * (i + 1) / n
        a, b = (R * math.cos(t0), y, R * math.sin(t0)), (R * math.cos(t1), y, R * math.sin(t1)); A, Bp = hit(t0), hit(t1)
        corner = None
        for cx_, cz_ in ((hx, hz), (-hx, hz), (-hx, -hz), (hx, -hz)):
            tc = math.atan2(cz_, cx_) % math.tau
            if t0 < tc <= t1: corner = (cx_, y, cz_)
        poly = [a, A] + ([corner] if corner else []) + [Bp, b]
        for k in range(1, len(poly) - 1):
            D.tri('rock', poly[0], poly[k], poly[k + 1]); D.tri('nightLacquer', poly[0], poly[k + 1], poly[k])
ceiling_ring()
for sz in (-1, 1):  # coffer beams on the ceiling between the dome and the gallery roofs
    for x in (-10, -5, 0, 5, 10):
        D.box('lacquerDark', (x - .14, 7.0, min(sz * 13.4, sz * 21.4)), (x + .14, 7.29, max(sz * 13.4, sz * 21.4)))
# Lamp trees on the galleries and platforms: branching bronze with a flame in every cup.
GLOWS, POOLS, EMBERS = [], [], []
def lamp_tree(x, y, z, h=2.3):
    lathe(D, 'bronzeDark', x, z, [(.26, y), (.22, y + .08), (.07, y + .22), (.05, y + h)], 8)
    for tier, (yy, r_, n) in enumerate(((y + h * .5, .5, 4), (y + h * .76, .38, 4), (y + h, .0, 1))):
        for i in range(n):
            t = math.tau * i / n + tier * .78; cx, cz = x + r_ * math.cos(t), z + r_ * math.sin(t)
            if r_: beam(D, 'bronze', (x, yy - .16, z), (cx, yy, cz), .022, 4)
            lathe(D, 'gold', cx, cz, [(.03, yy), (.1, yy + .05), (.1, yy + .07)], 6)
            flame(D, cx, yy + .06, cz, .42)
    GLOWS.append([x, round(y + h * .8, 2), z, 1.5, '#ffb86a', .5]); POOLS.append([x, y + .03, z, 4.6, '#ffb060', .5])
for sz in (-1, 1):
    for x in (-19.6, -3.2, 3.2, 19.6): lamp_tree(x, 0, sz * 20.6)
for sx in (-1, 1):
    for z in (-19.6, -6.2, 6.2, 19.6): lamp_tree(sx * 28.2, 0, z)
for sz in (-1, 1):
    for sx in (-1, 1):
        GLOWS.append([sx * 9, 1.15, sz * 20, 1.1, '#ff8a3a', .6]); EMBERS.append([sx * 9, 1.1, sz * 20, .3])
# Wall dressing: lacquer dado with cloud scrolls, black-and-red banners between pilasters.
for sz in (-1, 1):
    zw = sz * 21.38
    D.box('lacquerDark', (-21, .0, min(zw, zw - sz * .03)), (21, 1.0, max(zw, zw - sz * .03)))
    D.box('lacquer', (-21, 1.0, min(zw, zw - sz * .05)), (21, 1.14, max(zw, zw - sz * .05)))
    for i in range(21):
        x = -20 + i * 2
        for k in range(3):   # cloud scroll: three stepped curls
            D.box('gold', (x + k * .26, .34 + k * .14, min(zw - sz * .03, zw - sz * .05)), (x + k * .26 + .34, .4 + k * .14, max(zw - sz * .03, zw - sz * .05)))
        D.box('gold', (x + .78, .34, min(zw - sz * .03, zw - sz * .05)), (x + .84, .68, max(zw - sz * .03, zw - sz * .05)))
    for i, x in enumerate((-15, -9, -3, 3, 9, 15)):
        zz = zw - sz * .08
        D.quad('bannerBlack' if i % 2 else 'bannerRed', (x - .55, 4.1, zz), (x + .55, 4.1, zz), (x + .55, 1.6, zz), (x - .55, 1.6, zz))
        D.box('gold', (x - .62, 4.1, min(zz, zz - sz * .04)), (x + .62, 4.18, max(zz, zz - sz * .04)))
        zg = zz - sz * .015
        for k in range(16):
            t0, t1 = math.tau * k / 16, math.tau * (k + 1) / 16
            q = [(x, 3.25, zg), (x + .3 * math.cos(t0), 3.25 + .3 * math.sin(t0), zg), (x + .3 * math.cos(t1), 3.25 + .3 * math.sin(t1), zg)]
            D.tri('gold', *(q if sz < 0 else q[::-1]))
        for k, (w, yy) in enumerate(((.8, 2.6), (.56, 2.35), (.8, 2.1))):
            D.box('gold', (x - w / 2 + (k - 1) * .06, yy, min(zg, zz - sz * .025)), (x + w / 2 + (k - 1) * .06, yy + .07, max(zg, zz - sz * .025)))
c.data['presentation'].update(glows=GLOWS, pools=POOLS, embers=EMBERS,
    field=dict(kind='glitter', count=160, color='#cfe2ff', size=.07, min=[-20, PIT + .05, -16], max=[20, PIT + .9, 16]))

if '--materials' in sys.argv or not (ROOT / 'assets/materials/rammed_basecolor.png').exists():
    synth_materials(ROOT / 'assets/materials', dict(
        rammed=dict(kind='rammed', rows=9, contrast=14, bump=1.1), earth=dict(kind='plaster', contrast=13, bump=1.2),
        brick=dict(kind='blocks', rows=8, cols=4, joint=.07, contrast=13, vary=.6, bump=1.2), terracotta=dict(kind='plaster', contrast=11, bump=.8, warm=.5),
        lacquer=dict(kind='wood', rows=3, cols=1, contrast=6, bump=.4, rough=150), timber=dict(kind='wood', rows=7, cols=3, contrast=20, bump=1.1),
        tile=dict(kind='tile', rows=6, cols=6, contrast=14, bump=1.3), bronze=dict(kind='metal', contrast=14, bump=.6, rough=150, metal=190, roughVary=30)), seed=221)
bind_textures(c, ROOT, dict(rammed=(.85, .45, ['rammed', 'rammedDark', 'rammedLight']), earth=(.6, .45, ['earthFloor', 'earthDark']),
    brick=(.5, .5, ['brick', 'brickDark', 'brickLight']), terracotta=(1.4, .3, ['terracotta', 'terracottaDark', 'terracottaPale']),
    lacquer=(1, .25, ['lacquer', 'lacquerDark']), timber=(.8, .45, ['timber', 'timberLight']), tile=(1, .5, ['tile', 'tileLight']),
    bronze=(1.2, .3, ['bronze', 'bronzeDark'])))
c.save(render_object=c.renderer(KINDS))
