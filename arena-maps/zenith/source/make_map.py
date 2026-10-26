"""Parhelion Arena map 2: ZENITH sky amphitheatre 0.2.0.

Same data format as arena/runtime/map.json (ASTER): metre units, Y up, axis-aligned boxes and
ramps, anchors and routes. Team A (west) and team B (east) halves are point-symmetric about the
origin, (x, z) -> (-x, -z).

Where ASTER is one flat floor with a single gallery, ZENITH is built in three tiers:

    L2  4 m   spawn platforms (west/east ends) and two towers with prows over the pit
    L1  2 m   a ring of terraces around the pit, plus the corners beside the spawns
    L0  0 m   the sunken sundial pit in the middle, with the gnomon at its centre

Spawning is high; everyone fights downhill first. The pit is the shortest way across but every
tier above can shoot into it; four ramps climb out of it. Each tower has a ramp on both sides, so
whoever holds it can be pushed from the terrace below.

    north (-Z)
    +----------------------------------------------------------------+
    | corner L1 \\ramp  band L1  ramp=[tower A L2]=ramp     band L1    |
    |  spawn A  |                    [ prow ]                         |
    |  L2  [scr]| band W L1  +--------- PIT L0 ---------+  band E L1 | |
    |           |            | ramp     (gnomon)   ramp |       [scr]|B|
    |           |            +--------------------------+         L2 | |
    |                band L1             [ prow ]                 ramp/ |
    |    band L1            ramp=[tower B L2]=ramp           corner L1  |
    +----------------------------------------------------------------+

Run: python3 source/make_map.py  (writes runtime/map.json)
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
objects, anchors = [], []
palette = dict(floor='#e3d8c4', tile='#d2c6b0', wall='#b58b72', dark='#4a4872', cover='#f1e9da',
               stone='#cdbfa8', terrace='#e9dcc4', hedge='#79c48a', cyan='#5fd0d8', amber='#f2b25c',
               white='#f8f4ec', gold='#f3cd6b', coral='#ee8c7a', glass='#9fd6f0')
L1, L2 = 2.0, 4.0


def box(name, p, s, mat='wall', collision=True, role='structure'):
    objects.append(dict(id=name, type='box', position=[round(v, 4) for v in p], size=[round(v, 4) for v in s],
                        material=mat, collision=collision, role=role))


def ramp(name, x, y, z, w, h, d, axis, low_at, mat):
    objects.append(dict(id=name, type='ramp', position=[x, y, z], size=[w, h, d], material=mat,
                        collision=True, role='ramp', axis=axis, lowAt=low_at))


def anchor(name, kind, p, **extra):
    anchors.append(dict(id=name, kind=kind, position=[round(v, 4) for v in p], **extra))


def mirror(p):
    return [-p[0], p[1], -p[2]]


def pair(name, p, s, mat='cover', collision=True, role='cover', mat_b=None):
    """Point-symmetric pair: `_a` on team A's half as given, `_b` rotated 180 degrees."""
    box(name + '_a', p, s, mat, collision, role)
    box(name + '_b', mirror(p), s, mat_b or mat, collision, role)


def pair_ramp(name, x, y, z, w, h, d, axis, low_at):
    ramp(name + '_a', x, y, z, w, h, d, axis, low_at, 'cyan')
    ramp(name + '_b', -x, y, -z, w, h, d, axis, -low_at, 'amber')


def pair_anchor(name, kind, p, **extra):
    anchor(name + '_a', kind, p, **extra)
    anchor(name + '_b', kind, mirror(p), **extra)


def solid(lo, hi):
    """Centre and size from min/max corners."""
    return [(lo[i] + hi[i]) / 2 for i in range(3)], [hi[i] - lo[i] for i in range(3)]


# ---- shell: 60 x 48 m roof slab, 7 m windbreak (stone parapet + glass in the art)
box('floor_terrace', [0, -.3, 0], [60, .6, 48], 'floor', role='floor')
box('wall_west', [-30, 3.5, 0], [.5, 7, 48]); box('wall_east', [30, 3.5, 0], [.5, 7, 48])
box('wall_north', [0, 3.5, -24], [60, 7, .5]); box('wall_south', [0, 3.5, 24], [60, 7, .5])

# ---- L1 ring (top 2 m) around the pit x[-14,14] z[-10,10]
pair('band_n', *solid([-22, 0, -24], [22, L1, -10]), 'terrace', role='floor')
pair('band_w', *solid([-22, 0, -10], [-14, L1, 10]), 'terrace', role='floor')
pair('corner_n', *solid([-30, 0, -24], [-22, L1, -12]), 'terrace', role='floor')
pair('corner_s', *solid([-30, 0, 12], [-22, L1, 24]), 'terrace', role='floor')

# ---- L2 spawn platforms (top 4 m): screened at the front, ramps down to both corners
pair('spawn_platform', *solid([-30, 0, -12], [-22, L2, 12]), 'white', role='floor')
pair('spawn_screen', [-23.2, L2 + 1.3, 0], [.6, 2.6, 12], 'dark', role='structure')
pair_ramp('ramp_spawn_n', -26.5, L1, -15, 5, 2, 6, 'z', -1)
pair_ramp('ramp_spawn_s', -26.5, L1, 15, 5, 2, 6, 'z', 1)
pair('spawn_pad', [-27.2, L2 + .025, 0], [3.4, .05, 6], 'cyan', False, 'wayfinding', mat_b='amber')
for i, (x, z) in enumerate(((-27, -1.5), (-27.6, 1.8))):
    anchor(f'spawn_west_0{i + 1}', 'spawn', [x, L2, z], yaw=1.5708, team='west')
    anchor(f'spawn_east_0{i + 1}', 'spawn', [-x, L2, -z], yaw=-1.5708, team='east')

# ---- towers (L2) on the north (A) and south (B) terraces, with a prow over the pit
pair('tower', *solid([-12, L1, -22], [-4, L2, -15]), 'white', role='floor')
pair('tower_prow', *solid([-10, L1, -15], [-6, L2, -10]), 'white', role='floor')
pair_ramp('ramp_tower_home', -15, L1, -18.5, 6, 2, 4, 'x', -1)   # from A's side, low end west
pair_ramp('ramp_tower_far', -1, L1, -18.5, 6, 2, 4, 'x', 1)      # from the enemy side, low end east
pair('tower_parapet', [-8, L2 + .55, -10.3], [4, 1.1, .5], 'wall')
pair('tower_panel', [-10.8, L2 + .85, -21.2], [1.6, 1.7, .6], 'cover')
pair('tower_panel_e', [-5.4, L2 + .85, -21], [.6, 1.7, 1.6], 'cover')
pair_anchor('cover_tower_prow', 'cover', [-8, L2, -11.2], height=1.1, exposure='pit and far terrace')
pair_anchor('cover_tower_back', 'cover', [-10.8, L2, -20.2], height=1.7)

# ---- pit (L0): gnomon on its dais, four ramps up to the ring, low and tall cover
box('court_dais', [0, .12, 0], [7, .24, 7], 'tile', role='floor')
box('gnomon', [0, 3, 0], [3.2, 6, 3.2], 'white', role='cover')
box('gnomon_band', [0, 3.6, 0], [3.3, .22, 3.3], 'gold', False, 'landmark')
pair_ramp('ramp_pit_n', -2.5, 0, -7, 4, 2, 6, 'z', 1)    # against the north wall of the pit
pair_ramp('ramp_pit_w', -11, 0, 5, 6, 2, 4, 'x', 1)    # against the west wall of the pit
pair('pit_tall', [-8, 1.1, -6.5], [1.6, 2.2, 2.4], 'cover')
pair('pit_half', [-10.5, .55, -2.5], [1.4, 1.1, 3], 'cover')
pair('pit_mid', [5, .55, -4.5], [2.4, 1.1, 1.2], 'cover')
pair('pit_corner', [-12.2, 1.1, -8.2], [2, 2.2, 2], 'cover')
for n, p, h in [('pit_tall', [-8, 0, -4.9], 2.2), ('pit_half', [-9.3, 0, -2.5], 1.1), ('pit_mid', [5, 0, -3.4], 1.1),
                ('pit_corner', [-10.7, 0, -8.2], 2.2)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)
anchor('objective_dais_n', 'objective', [0, .24, -2.8], radius=1.5, interaction='future objective, no capture logic')
anchor('objective_dais_s', 'objective', [0, .24, 2.8], radius=1.5, interaction='future objective, no capture logic')

# ---- terrace (L1) cover: planters along the pit rim, hedges, corner crates
pair('rim_planter_n', [3, L1 + .55, -11.6], [3.2, 1.1, 1.2], 'stone')
pair('rim_planter_w', [-15.6, L1 + .55, -3], [1.2, 1.1, 3.2], 'stone')
pair('terrace_hedge', [12, L1 + 1.2, -19], [3, 2.4, 3], 'hedge')
pair('terrace_hedge_2', [-19, L1 + 1.2, 6], [2.2, 2.4, 2.2], 'hedge')
pair('corner_crate', [-25, L1 + .55, -21.5], [2.4, 1.1, 1.4], 'cover')
for n, p, h in [('rim_planter_n', [3, L1, -12.8], 1.1), ('rim_planter_w', [-16.8, L1, -3], 1.1),
                ('terrace_hedge', [10, L1, -19], 2.4), ('terrace_hedge_2', [-19, L1, 7.7], 2.4),
                ('corner_crate', [-25, L1, -20.2], 1.1)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)
pair_anchor('shield_socket_rim', 'reserved_shield', [-16, L1, 0], width=2.4, height=2)
pair_anchor('dash_lane_pit', 'reserved_dash', [0, 0, -8.5], length=8, width=4)

# Routes are walked by validation in both directions with the shared game physics.
routes = [
    dict(id='spawn_to_tower', name='A spawn / north corner / tower / prow', points=[
        [-27, L2, -1.5], [-26.5, L2, -10], [-26.5, L1, -19.5], [-21, L1, -22.6], [-18.6, L1, -18.5],
        [-12, L2, -18.5], [-8, L2, -16], [-8, L2, -11.2]]),
    dict(id='pit_crossing', name='Pit: A north ramp / round the gnomon / B north ramp', points=[
        [-2.5, L1, -12], [-2.5, 0, -4.3], [-4.6, 0, -2.5], [-4.6, 0, 2.5], [2.5, .24, 3.4], [2.5, L1, 12]]),
    dict(id='tower_far_side', name='Tower A from the east (enemy) ramp', points=[
        [8, L1, -14], [3.5, L1, -18.5], [-4, L2, -18.5], [-8, L2, -18.5]]),
    dict(id='pit_west_ramp', name='West pit ramp up to the west terrace', points=[
        [-4, 0, 7.5], [-7, 0, 5], [-14, L1, 5], [-18, L1, 2]]),
]

data = dict(
    mapId='zenith_sky_terrace', name='ZENITH 日冕天台', version='0.2.0-tiers', mode='arena',
    supportedTeamLayouts=['1v1', '1v2', '2v2'], units='metres', upAxis='Y',
    bounds=dict(min=[-30, 0, -24], max=[30, 8, 24]), symmetry='point (x, z) -> (-x, -z)',
    levels=dict(pit=0, terrace=L1, high=L2),
    palette=palette, objects=objects, anchors=anchors, routes=routes,
    player=dict(radius=.32, height=1.8, eyeHeight=1.65, walkSpeed=4.2, stepHeight=.28),
    clearances=dict(spawnRamps=5, pitRamps=4, towerRamps=4, pit=[28, 20]),
)
(ROOT / 'runtime/map.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(f'Wrote {len(objects)} objects, {len(anchors)} anchors; 60 x 48 m Arena, 3 tiers')
