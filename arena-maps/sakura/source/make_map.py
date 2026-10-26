"""Parhelion Arena map 3: SAKURA shrine at dusk 0.1.0.

Same data format as arena/runtime/map.json. Team A (west) and team B (east) are mirror images
across x = 0. This is the classic three-lane layout of mature tactical shooters, which neither
ASTER (open court + gallery) nor ZENITH (stacked tiers) uses:

  north  SANDO   long stone approach under torii gates: the long-range lane (DMR duels),
                 sightlines chopped by gate pillars and stone lanterns
  middle HAIDEN  a roofed shrine hall in the centre with four doors, pillars and an inner
                 sanctuary: close quarters (shotgun), the only roofed space in any Arena map
                 so far; a raised kagura stage on each side looks into the hall doors
  south  KOI     koi pond garden with a humped bridge, rocks and stepping stones: mid range,
                 a small height advantage on the bridge

    north (-Z)
    +---------------------------------------------------------------+
    |      [torii]   lantern   [torii]  SANDO  [torii]   [torii]      |
    |  ===== garden wall =====          =====  garden wall  =====     |
    | A spawn  |  [stage]   +------ HAIDEN ------+   [stage]  | B spawn|
    |  screen  |  ramps     |  door  [honden] door|   ramps   | screen |
    |          |            +---------------------+           |        |
    |  ===== garden wall =====          =====  garden wall  =====     |
    |        rocks    ~~~~~ KOI POND ~~~~ [bridge] ~~~~   rocks         |
    +---------------------------------------------------------------+

Run: python3 source/make_map.py  (writes runtime/map.json)
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
objects, anchors = [], []
palette = dict(floor='#d9c9ad', gravel='#cfc6b6', stone='#b9b2a6', wood='#a8573f', woodDark='#5a2f2a',
               plaster='#f3ead9', roof='#3f4a63', moss='#7fae6a', water='#5fa7c4', red='#d4483a',
               cyan='#5fd0d8', amber='#f2b25c', gold='#f0c46a', paper='#fff4e0')


def box(name, p, s, mat='wood', collision=True, role='structure'):
    objects.append(dict(id=name, type='box', position=[round(v, 4) for v in p], size=[round(v, 4) for v in s],
                        material=mat, collision=collision, role=role))


def ramp(name, x, y, z, w, h, d, axis, low_at, mat):
    objects.append(dict(id=name, type='ramp', position=[x, y, z], size=[w, h, d], material=mat,
                        collision=True, role='ramp', axis=axis, lowAt=low_at))


def anchor(name, kind, p, **extra):
    anchors.append(dict(id=name, kind=kind, position=[round(v, 4) for v in p], **extra))


def solid(lo, hi):
    return [(lo[i] + hi[i]) / 2 for i in range(3)], [hi[i] - lo[i] for i in range(3)]


def pair(name, p, s, mat='wood', collision=True, role='cover', mat_b=None):
    """Mirror pair across x = 0: `_a` on team A's (west) side as given, `_b` on the east."""
    box(name + '_a', p, s, mat, collision, role)
    box(name + '_b', [-p[0], p[1], p[2]], s, mat_b or mat, collision, role)


def pair_ramp(name, x, y, z, w, h, d, axis, low_at, mat='stone'):
    ramp(name + '_a', x, y, z, w, h, d, axis, low_at, mat)
    ramp(name + '_b', -x, y, z, w, h, d, axis, -low_at if axis == 'x' else low_at, mat)


def pair_anchor(name, kind, p, **extra):
    anchor(name + '_a', kind, p, **extra)
    anchor(name + '_b', kind, [-p[0], p[1], p[2]], **extra)


# ---- shell: 64 x 44 m precinct, 6 m outer wall (plaster wall + hedge in the art)
box('floor_precinct', [0, -.3, 0], [64, .6, 44], 'floor', role='floor')
box('wall_west', [-32, 3, 0], [.5, 6, 44], 'plaster'); box('wall_east', [32, 3, 0], [.5, 6, 44], 'plaster')
box('wall_north', [0, 3, -22], [64, 6, .5], 'plaster'); box('wall_south', [0, 3, 22], [64, 6, .5], 'plaster')

# ---- spawns: courtyards behind a screen wall, open to the north and south ends
pair('spawn_screen', [-24.5, 1.8, 0], [.6, 3.6, 14], 'plaster', role='structure')
pair('spawn_pad', [-28.5, .025, 0], [3.4, .05, 6], 'cyan', False, 'wayfinding', mat_b='amber')
for i, (x, z) in enumerate(((-29, -2), (-29.6, 2.2))):
    anchor(f'spawn_west_0{i + 1}', 'spawn', [x, 0, z], yaw=1.5708, team='west')
    anchor(f'spawn_east_0{i + 1}', 'spawn', [-x, 0, z], yaw=-1.5708, team='east')
pair('spawn_lantern_n', [-27, .8, -9.5], [.8, 1.6, .8], 'stone')
pair('spawn_lantern_s', [-27, .8, 9.5], [.8, 1.6, .8], 'stone')

# ---- lane walls: garden walls split the three lanes; the middle opens wide at the hall
for z in (-11, 11):
    tag = 'n' if z < 0 else 's'
    pair(f'lane_wall_{tag}', *solid([-21, 0, z - .3], [-9.5, 2.6, z + .3]), 'plaster', role='structure')

# ---- north lane: sando with torii gates (pillars collide, beams are art) and stone lanterns
for x in (-17, -6):
    for z in (-19.6, -14.4):
        pair(f'torii_{abs(x)}_{"n" if z < -17 else "s"}', [x, 2.1, z], [.7, 4.2, .7], 'red', role='cover')
for x in (-21, -11):
    for z in (-20.6, -13.4):
        pair(f'lantern_{abs(x)}_{"n" if z < -17 else "s"}', [x, .8, z], [.9, 1.6, .9], 'stone')
pair('sando_bench', [-1.6, .45, -17], [1, .9, 3], 'wood')
box('sando_shrine_box', [0, 1, -21], [3, 2, 1.4], 'wood', role='cover')

# ---- middle: haiden hall x[-8,8] z[-5,5], roof at 3.4 m, doors N/S (4 m) and W/E (3 m)
for z, tag in ((-5, 'n'), (5, 's')):
    pair(f'hall_wall_{tag}', *solid([-8.2, 0, z - .2], [-2, 3.4, z + .2]), 'plaster', role='structure')
pair('hall_wall_w_n', *solid([-8.2, 0, -5], [-7.8, 3.4, -1.5]), 'plaster', role='structure')
pair('hall_wall_w_s', *solid([-8.2, 0, 1.5], [-7.8, 3.4, 5]), 'plaster', role='structure')
box('hall_roof', [0, 3.6, 0], [17.4, .4, 11.4], 'roof', role='roof')
for x in (-4.5, 4.5):
    for z in (-2.4, 2.4):
        box(f'hall_pillar_{"w" if x < 0 else "e"}_{"n" if z < 0 else "s"}', [x, 1.7, z], [.5, 3.4, .5], 'wood', role='cover')
box('honden', [0, 1.5, 0], [2.6, 3.0, 2], 'woodDark', role='cover')
anchor('objective_hall', 'objective', [0, 0, -2.4], radius=2, interaction='future objective, no capture logic')
pair_anchor('cover_hall_pillar', 'cover', [-4.5, 0, -1.6], height=3.4)
pair_anchor('cover_honden', 'cover', [-1.9, 0, 0], height=3.0)

# ---- kagura stages (1.2 m) facing the west/east hall doors, ramps front and back
pair('stage', *solid([-19, 0, -4], [-13, 1.2, 4]), 'wood', role='floor')
pair_ramp('stage_ramp_front', -11.5, 0, 0, 3, 1.2, 3.4, 'x', 1)    # toward the hall, low end east
pair_ramp('stage_ramp_back', -21, 0, -2.4, 4, 1.2, 2.6, 'x', -1)   # from spawn, low end west
pair('stage_rail_n', [-16, 1.65, -3.75], [4, .9, .3], 'wood')
pair('stage_rail_s', [-16, 1.65, 3.75], [4, .9, .3], 'wood')
pair('stage_drum', [-17.8, 1.75, 2], [1, 1.1, 1], 'red')
pair_anchor('cover_stage', 'cover', [-16, 1.2, -3], height=.9)

# ---- courtyard cover between the stages, the hall and the lane walls
pair('court_planter_n', [-10.5, .5, -8], [2.6, 1, 1.2], 'stone')
pair('court_planter_s', [-10.5, .5, 8], [2.6, 1, 1.2], 'stone')
pair('court_crate', [-21.5, .55, 6.5], [1.4, 1.1, 1.4], 'wood')
pair('saisen_box', [-3, .45, -7], [1.6, .9, 1], 'wood')
for n, p, h in [('court_planter_n', [-10.5, 0, -6.9], 1), ('court_planter_s', [-10.5, 0, 6.9], 1),
                ('court_crate', [-21.5, 0, 5.3], 1.1), ('saisen_box', [-3, 0, -8], .9)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)

# ---- south lane: koi pond (shallow, walkable, art only), humped bridge, rocks
box('pond', [0, .01, 16.5], [24, .02, 7], 'water', False, 'water')
ramp('bridge_up', -3.5, 0, 16.5, 5, 1.2, 2.4, 'x', -1, 'wood')
box('bridge_top', [0, .6, 16.5], [2, 1.2, 2.4], 'wood', role='floor')
ramp('bridge_down', 3.5, 0, 16.5, 5, 1.2, 2.4, 'x', 1, 'wood')
pair('pond_rock_1', [-9, .6, 15], [2, 1.2, 1.6], 'stone')
pair('pond_rock_2', [-5, .8, 19.6], [1.6, 1.6, 1.4], 'stone')
pair('garden_rock', [-17, .7, 17], [2.2, 1.4, 2], 'stone')
pair('garden_lantern', [-21, 1, 14], [1, 2, 1], 'stone')
for n, p, h in [('pond_rock_1', [-9, 0, 13.6], 1.2), ('pond_rock_2', [-5, 0, 18.3], 1.6), ('garden_rock', [-17, 0, 15.4], 1.4)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)
pair_anchor('cover_torii', 'cover', [-17, 0, -15.6], height=4.2)
pair_anchor('cover_lantern', 'cover', [-11, 0, -14.4], height=1.6)
pair_anchor('shield_socket_door', 'reserved_shield', [-10, 0, 0], width=2.4, height=2)

routes = [
    dict(id='sando', name='North lane: A spawn / sando / B spawn', points=[
        [-29, 0, -2], [-26, 0, -9], [-24, 0, -12.5], [-22, 0, -16], [-12.5, 0, -17], [-8, 0, -12.4], [8, 0, -12.4],
        [12.5, 0, -17], [22, 0, -16], [24, 0, -12.5], [26, 0, -9], [29, 0, -2]]),
    dict(id='hall', name='Middle: stage / west door / hall / east door / stage', points=[
        [-23.5, 0, -2.4], [-19, 1.2, -2.4], [-14, 1.2, 0], [-10, 0, 0], [-7, 0, 0], [-6, 0, -3.6], [6, 0, -3.6],
        [7, 0, 0], [10, 0, 0], [14, 1.2, 0], [19, 1.2, -2.4], [23.5, 0, -2.4]]),
    dict(id='koi', name='South lane over the bridge', points=[
        [-26, 0, 9], [-22, 0, 12.5], [-12, 0, 17.5], [-6.5, 0, 16.5], [0, 1.2, 16.5], [6.5, 0, 16.5], [12, 0, 17.5],
        [22, 0, 12.5], [26, 0, 9]]),
    dict(id='north_door', name='Sando to the hall north door', points=[
        [0, 0, -17], [0, 0, -9], [0, 0, -3.6], [-3, 0, -3.6]]),
]

data = dict(
    mapId='sakura_shrine', name='SAKURA 樱庭', version='0.1.0', mode='arena',
    supportedTeamLayouts=['1v1', '1v2', '2v2'], units='metres', upAxis='Y',
    bounds=dict(min=[-32, 0, -22], max=[32, 7, 22]), symmetry='mirror x -> -x',
    presentation=dict(preset='dusk'),
    palette=palette, objects=objects, anchors=anchors, routes=routes,
    player=dict(radius=.32, height=1.8, eyeHeight=1.65, walkSpeed=4.2, stepHeight=.28),
    clearances=dict(hallDoorsNS=4, hallDoorsWE=3, laneWidth=9, roofHeight=3.4),
)
(ROOT / 'runtime').mkdir(exist_ok=True)
(ROOT / 'runtime/map.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(f'Wrote {len(objects)} objects, {len(anchors)} anchors; 64 x 44 m Arena, three lanes')
