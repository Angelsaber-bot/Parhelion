"""Parhelion Arena map 4: NEON harbour container yard at night 0.1.0.

Same data format as arena/runtime/map.json. Point-symmetric about the origin like ZENITH, but
the spawns sit in opposite CORNERS (A south-west, B north-east), so every fight runs on the
diagonal. The other three maps are open courts, tiers or lanes; this one is a maze:

- ground: a yard of 6 m shipping containers (2.6 m tall) forming short corridors, blind corners
  and crate-strewn crossings: constant close-to-mid range peeking
- height: each team has a container staircase (ground -> 2.6 m -> 5.2 m) up a double stack,
  then a catwalk onto the crane GANTRY DECK at 5.2 m that spans the central crossroad; the deck
  sees the whole yard, but anyone underneath it is out of its sight, and both staircases lead up
- the edges are open lanes along the quay fence for rotating around the maze

    north (-Z)                                       B spawn (NE)
    +--------------------------------------------------------+
    |  [tall]      m4b      m8      [wall]  |               |
    |      m8a                 m3b    [wall]---+  B           |
    |  ramp1 S0 S1 ==catwalk                                 |
    |  m1        =====[ GANTRY DECK 5.2 m ]=====       m1b    |
    |                          catwalk== S1 S0 ramp1         |
    |       A  +---[wall]  m3a          m8b                   |
    |  A spawn (SW)  [wall]     m4a      m5        [tall]     |
    +--------------------------------------------------------+

Run: python3 source/make_map.py  (writes runtime/map.json)
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
objects, anchors = [], []
palette = dict(asphalt='#2b2f3e', steel='#5d6680', red='#e0525a', blue='#3f7fd6', teal='#2fb5a8', orange='#f08a3a',
               yellow='#f2c94c', white='#e9eef7', neon_pink='#ff4fb3', neon_cyan='#3ff2ff', cyan='#5fd0d8', amber='#f2b25c')
C = 2.6  # container height and width; length 6
COLORS = ['red', 'blue', 'teal', 'orange', 'yellow', 'white']


def box(name, p, s, mat='steel', collision=True, role='structure'):
    objects.append(dict(id=name, type='box', position=[round(v, 4) for v in p], size=[round(v, 4) for v in s],
                        material=mat, collision=collision, role=role))


def ramp(name, x, y, z, w, h, d, axis, low_at, mat):
    objects.append(dict(id=name, type='ramp', position=[x, y, z], size=[w, h, d], material=mat,
                        collision=True, role='ramp', axis=axis, lowAt=low_at))


def anchor(name, kind, p, **extra):
    anchors.append(dict(id=name, kind=kind, position=[round(v, 4) for v in p], **extra))


def mirror(p):
    return [-p[0], p[1], -p[2]]


def pair(name, p, s, mat='steel', collision=True, role='cover', mat_b=None):
    box(name + '_a', p, s, mat, collision, role)
    box(name + '_b', mirror(p), s, mat_b or mat, collision, role)


def container(name, x, z, along, level=0, color=0):
    """A 6 x 2.6 x 2.6 container pair; `along` is 'x' or 'z' (its long axis); level 1 stacks it."""
    size = [6, C, C] if along == 'x' else [C, C, 6]
    pair(name, [x, C / 2 + level * C, z], size, COLORS[color % len(COLORS)], role='cover', mat_b=COLORS[(color + 3) % len(COLORS)])


def pair_ramp(name, x, y, z, w, h, d, axis, low_at):
    ramp(name + '_a', x, y, z, w, h, d, axis, low_at, 'steel')
    ramp(name + '_b', -x, y, -z, w, h, d, axis, -low_at, 'steel')


def pair_anchor(name, kind, p, **extra):
    anchor(name + '_a', kind, p, **extra)
    anchor(name + '_b', kind, mirror(p), **extra)


# ---- shell: 56 x 56 m quay, 7 m fence (chain-link in the art)
box('floor_quay', [0, -.3, 0], [56, .6, 56], 'asphalt', role='floor')
box('wall_west', [-28, 3.5, 0], [.5, 7, 56]); box('wall_east', [28, 3.5, 0], [.5, 7, 56])
box('wall_north', [0, 3.5, -28], [56, 7, .5]); box('wall_south', [0, 3.5, 28], [56, 7, .5])

# ---- corner spawns, walled by containers on two sides (three exits each)
container('spawn_wall_e', -17.5, 21, 'z', color=1)
container('spawn_wall_n', -21, 14.5, 'x', color=2)
pair('spawn_pad', [-23.5, .025, 22], [4, .05, 4], 'cyan', False, 'wayfinding', mat_b='amber')
anchor('spawn_west_01', 'spawn', [-24, 0, 21], yaw=1.5708, team='west')
anchor('spawn_west_02', 'spawn', [-22.5, 0, 24.2], yaw=1.5708, team='west')
anchor('spawn_east_01', 'spawn', [24, 0, -21], yaw=-1.5708, team='east')
anchor('spawn_east_02', 'spawn', [22.5, 0, -24.2], yaw=-1.5708, team='east')

# ---- the climb: ramp -> container S0 with a second ramp on top -> double stack S1 -> catwalk -> deck
pair_ramp('ramp_ground', -20, 0, -6, 6, C, C, 'x', -1)          # x -23..-17, low end west
container('stair_base', -14, -6, 'x', color=3)                  # S0, x -17..-11
pair_ramp('ramp_upper', -14, C, -6, 6, C, C, 'x', -1)           # on top of S0, 2.6 -> 5.2
container('stack_low', -8, -6, 'x', color=4)                     # S1, x -11..-5
container('stack_high', -8, -6, 'x', level=1, color=0)
pair('catwalk', *[[-5.25, 5.1, -3.85], [1.5, .2, 1.7]], 'steel', role='floor')
box('gantry_deck', [0, 5.1, 0], [10, .2, 6], 'steel', role='floor')
for p in ([-5.3, 2.5, -3.3], [-5.3, 2.5, 3.3]):
    pair(f'gantry_leg_{"n" if p[2] < 0 else "s"}', p, [.5, 5, .5], 'yellow', role='structure')
pair('deck_crate', [-2.4, 5.8, 1.6], [1.2, 1.2, 1.2], 'orange')
pair_anchor('cover_deck', 'cover', [-2.4, 5.2, 0], height=1.2, exposure='whole yard')
pair_anchor('cover_stack_top', 'cover', [-9.5, 5.2, -6], height=0, exposure='open top of the stack')

# ---- the maze: single containers, one tall double stack each, crates
container('maze_1', -21, 2, 'z', color=5)
container('maze_2', -12, 7, 'x', color=1)
container('maze_3', -7, 15, 'z', color=2)
container('maze_4', 2, 21, 'x', color=3)
container('maze_5', -11, 19.5, 'x', color=0)
container('maze_8', -8, -14, 'x', color=4)
container('tall_low', -18, -16, 'z', color=2)
container('tall_high', -18, -16, 'z', level=1, color=5)
for n, p in [('crate_1', [-14, .6, 1]), ('crate_2', [-3, .6, 9]), ('crate_3', [-24, .6, -3]), ('crate_4', [-12, .6, -20.5]),
             ('crate_5', [-1.6, .6, -1.4]), ('crate_6', [-24.5, .6, 7.5])]:
    pair(n, p, [1.4, 1.2, 1.4], 'orange')
for n, p, h in [('crate_1', [-14, 0, 2.1], 1.2), ('crate_2', [-3, 0, 10.1], 1.2), ('crate_3', [-24, 0, -1.9], 1.2),
                ('crate_4', [-12, 0, -19.4], 1.2), ('crate_5', [-1.6, 0, -.3], 1.2), ('maze_2', [-12, 0, 9.3], 2.6),
                ('maze_3', [-5.1, 0, 15], 2.6), ('maze_8', [-8, 0, -12.1], 2.6), ('tall', [-16.1, 0, -16], 5.2),
                ('maze_1', [-19.1, 0, 2], 2.6)]:
    pair_anchor('cover_' + n, 'cover', p, height=h)
anchor('objective_crossroad', 'objective', [0, 0, -4.6], radius=2, interaction='future objective, no capture logic')
pair_anchor('shield_socket_cross', 'reserved_shield', [-6, 0, 0], width=2.4, height=2)

routes = [
    dict(id='west_quay', name='A spawn / west quay / north edge', points=[
        [-24, 0, 21], [-26, 0, 12], [-26, 0, -8], [-26, 0, -24], [-14, 0, -24.5], [-7, 0, -24.5], [-7, 0, -17]]),
    dict(id='the_climb', name='A staircase to the gantry deck', points=[
        [-24, 0, 21], [-26, 0, 12], [-25, 0, -6], [-23, 0, -6], [-17, C, -6], [-11, 2 * C, -6], [-5.25, 2 * C, -5.4],
        [-5.25, 2 * C, -3.4], [0, 2 * C, 0]]),
    dict(id='crossroad', name='Through the maze under the deck to B', points=[
        [-22, 0, 17], [-16, 0, 16.5], [-16, 0, 11], [-8, 0, 10], [-8, 0, 4], [-3, 0, 1.5], [0, 0, -1], [3, 0, -1.5],
        [8, 0, -4], [8, 0, -10], [16, 0, -11], [16, 0, -16.5], [22, 0, -17]]),
    dict(id='south_quay', name='A spawn / south quay to the east', points=[
        [-22.5, 0, 24.2], [-14, 0, 25.5], [8, 0, 25.5], [24, 0, 25.5], [25.5, 0, 12]]),
]

data = dict(
    mapId='neon_harbour', name='NEON 夜港', version='0.1.0', mode='arena',
    supportedTeamLayouts=['1v1', '1v2', '2v2'], units='metres', upAxis='Y',
    bounds=dict(min=[-28, 0, -28], max=[28, 8, 28]), symmetry='point (x, z) -> (-x, -z)',
    presentation=dict(preset='night'),
    palette=palette, objects=objects, anchors=anchors, routes=routes,
    player=dict(radius=.32, height=1.8, eyeHeight=1.65, walkSpeed=4.2, stepHeight=.28),
    clearances=dict(container=[6, 2.6, 2.6], deckHeight=5.2, rampWidth=2.6),
)
(ROOT / 'runtime').mkdir(exist_ok=True)
(ROOT / 'runtime/map.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(f'Wrote {len(objects)} objects, {len(anchors)} anchors; 56 x 56 m Arena, container yard')
