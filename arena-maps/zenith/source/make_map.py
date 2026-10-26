"""Parhelion Arena map 2: ZENITH sky terrace 0.1.0.

Same data format as arena/runtime/map.json (ASTER): metre units, Y up, axis-aligned boxes and
ramps, anchors and routes. Team A (west) and team B (east) halves are point-symmetric about the
origin, (x, z) -> (-x, -z), so each team owns one diagonal high terrace and one ground flank.

Layout (top view, north is -Z):

    +------------------------------------------------------------+
    |  A1 ramp ==[ A TERRACE 3 m ]=+   . G3 .  G1      G4         |  north: A high ground
    |  (from A spawn)     parapets  A2   G2   [screen]            |         + B garden flank
    | [A spawn]   front      P1  ramp   P3        P2     [B spawn]|
    |  screen               [  gnomon on dais  ]           screen |  middle: open court
    | [       ]     P2        P3   B2      P1       front  [     ]|
    |            [screen]   G2   ramp  parapets                   |  south: A garden flank
    |    G4       G1   G3 .   +=[ B TERRACE 3 m ]== B1 ramp       |         + B high ground
    +------------------------------------------------------------+

Run: python3 source/make_map.py  (writes runtime/map.json)
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
objects, anchors = [], []
palette = dict(floor='#e3d8c4', tile='#d2c6b0', wall='#b58b72', dark='#3d3a58', cover='#f1e9da',
               stone='#cdbfa8', hedge='#79c48a', cyan='#5fd0d8', amber='#f2b25c', white='#f8f4ec',
               gold='#f3cd6b', coral='#ee8c7a', glass='#9fd6f0')


def box(name, p, s, mat='wall', collision=True, role='structure'):
    objects.append(dict(id=name, type='box', position=[round(v, 4) for v in p], size=s, material=mat,
                        collision=collision, role=role))


def ramp(name, x, z, w, d, axis, low_at, mat):
    objects.append(dict(id=name, type='ramp', position=[x, 0, z], size=[w, 3, d], material=mat,
                        collision=True, role='ramp', axis=axis, lowAt=low_at))


def anchor(name, kind, p, **extra):
    anchors.append(dict(id=name, kind=kind, position=[round(v, 4) for v in p], **extra))


def mirror(p):
    return [-p[0], p[1], -p[2]]


def pair(name, p, s, mat='cover', collision=True, role='cover', mat_b=None):
    """Point-symmetric pair: `_a` on team A's half as given, `_b` rotated 180 degrees."""
    box(name + '_a', p, s, mat, collision, role)
    box(name + '_b', mirror(p), s, mat_b or mat, collision, role)


def pair_anchor(name, kind, p, **extra):
    anchor(name + '_a', kind, p, **extra)
    anchor(name + '_b', kind, mirror(p), **extra)


# ---- shell: 60 x 44 m roof slab with a 5 m windbreak (glass above a stone parapet in the art)
box('floor_terrace', [0, -.3, 0], [60, .6, 44], 'floor', role='floor')
box('wall_west', [-30, 2.5, 0], [.5, 5, 44]); box('wall_east', [30, 2.5, 0], [.5, 5, 44])
box('wall_north', [0, 2.5, -22], [60, 5, .5]); box('wall_south', [0, 2.5, 22], [60, 5, .5])

# ---- spawns: screened alcoves, two diagonal doors each (north and south)
for side, label, team_mat in ((-1, 'west', 'cyan'), (1, 'east', 'amber')):
    box(f'{label}_spawn_screen', [side * 21.5, 2.2, 0], [.6, 4.4, 12], 'dark')
    for sign in (-1, 1):
        box(f'{label}_pocket_{"n" if sign < 0 else "s"}', [side * 27.5, 2.2, sign * 7], [5, 4.4, .5])
        box(f'{label}_door_trim_{"n" if sign < 0 else "s"}', [side * 23.5, .04, sign * 7], [3, .08, 2.4], team_mat, False, 'wayfinding')
    box(f'{label}_spawn_pad', [side * 27.5, .025, 0], [3.4, .05, 5.4], team_mat, False, 'wayfinding')
    yaw = 1.5708 if side < 0 else -1.5708
    anchor(f'spawn_{label}_01', 'spawn', [side * 27, 0, side * 1.5], yaw=yaw, team=label)
    anchor(f'spawn_{label}_02', 'spawn', [side * 27.8, 0, -side * 1.5], yaw=yaw, team=label)

# ---- diagonal terraces: deck at 3 m, home ramp from the spawn, counter ramp from the court.
# A's terrace sits north-west, B's (point mirror) south-east.
pair('terrace_deck', [-9.5, 2.8, -16], [17, .4, 6], 'white', role='floor')
ramp('ramp_home_a', -23, -16, 10, 6, 'x', -1, 'cyan')      # low end at the west wall, beside A spawn
ramp('ramp_home_b', 23, 16, 10, 6, 'x', 1, 'amber')
ramp('ramp_counter_a', -4, -8.5, 4, 9, 'z', 1, 'cyan')     # low end in the court: the enemy's way up
ramp('ramp_counter_b', 4, 8.5, 4, 9, 'z', -1, 'amber')
# Court-facing parapets are half cover (1.1 m); a tall panel guards the counter-ramp landing.
pair('terrace_parapet_w', [-15, 3.55, -13.25], [4, 1.1, .5], 'wall')
pair('terrace_parapet_m', [-9.5, 3.55, -13.25], [3, 1.1, .5], 'wall')
pair('terrace_panel', [-6.5, 3.85, -17.5], [1.2, 1.7, .6], 'cover')
pair('terrace_panel_back', [-14, 3.85, -18.2], [1.8, 1.7, .6], 'cover')
# Columns under the deck: real collision, so the covered walkway beneath has pillars to fight around.
for i, x in enumerate((-17.4, -9.5, -2)):
    for j, z in enumerate((-18.6, -13.4)):
        pair(f'terrace_column_{i}{j}', [x, 1.3, z], [.5, 2.6, .5], 'white', role='structure')
pair('terrace_strip', [-9.5, 3.025, -16], [15, .05, .14], 'cyan', False, 'wayfinding', mat_b='amber')
pair_anchor('cover_terrace_w', 'cover', [-15, 3, -14.4], height=1.1, exposure='court and enemy terrace')
pair_anchor('cover_terrace_m', 'cover', [-9.5, 3, -14.4], height=1.1, exposure='court and enemy terrace')
pair_anchor('cover_terrace_panel', 'cover', [-6.5, 3, -16.4], height=1.7, exposure='counter ramp and garden')

# ---- court: dais and gnomon break the spawn-to-spawn and terrace-to-terrace diagonals
box('court_dais', [0, .12, 0], [7, .24, 7], 'tile', role='floor')
box('gnomon', [0, 2.5, 0], [3.2, 5, 3.2], 'white', role='cover')
box('gnomon_band', [0, 3.6, 0], [3.3, .22, 3.3], 'gold', False, 'landmark')
pair('court_half', [-9, .55, -3], [3, 1.1, 1.4], 'cover')
pair('court_tall', [-12, 1.1, 4], [1.6, 2.2, 3], 'cover')
pair('court_mid', [5, .55, -5], [2.4, 1.1, 1.2], 'cover')
pair('spawn_front_n', [-17, .55, -6.5], [2.6, 1.1, 1.2], 'cover')
pair('spawn_front_s', [-17, .55, 6.5], [2.6, 1.1, 1.2], 'cover')
for n, p, h in [('court_half', [-9, 0, -1.7], 1.1), ('court_tall', [-13.2, 0, 4], 2.2), ('court_mid', [5, 0, -3.8], 1.1),
                ('spawn_front_n', [-17, 0, -5.3], 1.1), ('spawn_front_s', [-17, 0, 5.3], 1.1)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)
anchor('objective_dais_n', 'objective', [0, .24, -2.8], radius=1.5, interaction='future objective, no capture logic')
anchor('objective_dais_s', 'objective', [0, .24, 2.8], radius=1.5, interaction='future objective, no capture logic')
pair_anchor('shield_socket_court', 'reserved_shield', [-9, 0, -5.5], width=2.4, height=2)
pair_anchor('dash_lane_spawn', 'reserved_dash', [-19, 0, -9], length=8, width=4)

# ---- gardens: each team's ground flank runs through the garden on the ENEMY terrace's side.
# North garden (east half) is B's flank toward A's terrace; the south garden mirrors it for A.
pair('garden_screen', [11.5, 1.8, -9], [7, 3.6, .45], 'wall', role='structure')
pair('planter_tall_1', [13, 1.2, -15.5], [3, 2.4, 3], 'hedge')
pair('planter_tall_2', [5, 1.2, -17.5], [2.2, 2.4, 4], 'hedge')
pair('planter_low_1', [7, .55, -12], [2.4, 1.1, 2.4], 'stone')
pair('planter_low_2', [20, .55, -14], [2.4, 1.1, 2.4], 'stone')
for n, p, h in [('planter_tall_1', [10.9, 0, -15.5], 2.4), ('planter_tall_2', [6.8, 0, -17.5], 2.4),
                ('planter_low_1', [7, 0, -10.2], 1.1), ('planter_low_2', [18.2, 0, -14], 1.1)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)
pair('garden_path', [10, .03, -20.2], [20, .06, .16], 'gold', False, 'wayfinding')

# Routes are walked by validation in both directions with the shared game physics.
routes = [
    dict(id='mid_lane', name='Spawn A / court / spawn B', points=[
        [-27, 0, -1.5], [-24, 0, -2], [-23.5, 0, -8], [-12, 0, -8.5], [-7, 0, -5.5], [-7, 0, -2], [-4, 0, 2.6],
        [0, .24, 2.8], [4, 0, 2.6], [7, 0, 2], [7, 0, -2], [12.5, 0, -0.5], [14.5, 0, 8.5], [23.5, 0, 8], [24, 0, 2], [27, 0, 1.5]]),
    dict(id='terrace_a', name='A home ramp / terrace / counter ramp', points=[
        [-27, 0, -1.5], [-24, 0, -2], [-23.5, 0, -8], [-28.8, 0, -10.5], [-28.8, 0, -16], [-18, 3, -16],
        [-4, 3, -16], [-4, 3, -13], [-4, 0, -4], [-7, 0, -2]]),
    dict(id='garden_flank_b', name='B north exit / garden / under terrace A', points=[
        [27, 0, 1.5], [24, 0, 2], [23.5, 0, -8], [16.5, 0, -12], [9.5, 0, -14], [3, 0, -14], [-1, 0, -11],
        [-1, 0, -16], [-16, 0, -16], [-16, 0, -11], [-12, 0, -8.5]]),
    dict(id='counter_climb_b', name='B garden to A terrace via counter ramp', points=[
        [9.5, 0, -14], [3, 0, -13], [0, 0, -9], [-1.2, 0, -3.6], [-4, 0, -3.6], [-4, 3, -13], [-4, 3, -16], [-12, 3, -16]]),
]

data = dict(
    mapId='zenith_sky_terrace', name='ZENITH 日冕天台', version='0.1.0', mode='arena',
    supportedTeamLayouts=['1v1', '1v2', '2v2'], units='metres', upAxis='Y',
    bounds=dict(min=[-30, 0, -22], max=[30, 7, 22]), symmetry='point (x, z) -> (-x, -z)',
    palette=palette, objects=objects, anchors=anchors, routes=routes,
    player=dict(radius=.32, height=1.8, eyeHeight=1.65, walkSpeed=4.2, stepHeight=.28),
    clearances=dict(spawnDoor=3.6, homeRampWidth=6, counterRampWidth=4, underTerraceHeadroom=2.6, gardenLanes=2.25),
)
(ROOT / 'runtime/map.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(f'Wrote {len(objects)} objects, {len(anchors)} anchors; 60 x 44 m Arena')
