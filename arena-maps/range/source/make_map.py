"""Parhelion Arena TRAINING RANGE 0.1.0 (offline practice, never an online map).

Same data format as the chapter maps. The player stands at a firing line on the west side and
looks east down four marked lanes. Dummies (shared/trainingRange.ts) stand on the posts below.

    north (-Z)
    +----------------------------------------------------------------------+
    |  A  STATIC     |10m  |20m  |30m        |45m            o o o (dummies) |
    |  B  STRAFING   |     15m >-<            30m >-<                         |
    |  C  COVER         peek [] 20m   shield 25m                              |
    |  firing line  [bench] [bench] [bench]          GRENADE PIT  |__|        |
    |  MELEE YARD  o  o  o                                                     |
    +----------------------------------------------------------------------+
    south (+Z)

Run: python3 source/make_map.py  (writes runtime/map.json)
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
objects, anchors = [], []
palette = dict(floor='#c9d3df', lane='#b6c2d1', line='#ffd36b', wall='#e9eef4', trim='#5b6b80',
               cover='#8494a8', target='#ff6b5a', pit='#7d6a5a', glow='#7fe0ff')
FIRING_LINE = -24.0


def box(name, p, s, mat='wall', collision=True, role='structure'):
    objects.append(dict(id=name, type='box', position=[round(v, 4) for v in p], size=[round(v, 4) for v in s],
                        material=mat, collision=collision, role=role))


def anchor(name, kind, p, **extra):
    anchors.append(dict(id=name, kind=kind, position=[round(v, 4) for v in p], **extra))


# Hall: floor, perimeter, a raised back wall behind the targets.
box('floor_range', [0, -.3, 0], [76, .6, 46], 'floor', role='floor')
box('wall_west', [-38, 3, 0], [.5, 6, 46])
box('wall_east', [38, 4, 0], [.5, 8, 46])
box('wall_north', [0, 3, -23], [76, 6, .5])
box('wall_south', [0, 3, 23], [76, 6, .5])
# Firing line: low benches with gaps so the player can step forward.
for i, z in enumerate([-15, -6, 6, 15]):
    box(f'bench_{i}', [FIRING_LINE - .4, .45, z], [.7, .9, 4.5], 'cover', role='cover')
# Lane C cover: a waist-high block the peek dummy hides behind (20 m).
box('peek_cover', [FIRING_LINE + 19.2, .6, 8], [.8, 1.2, 3.2], 'cover', role='cover')
# Grenade pit: a U-shaped bunker, open to the east; lob over the front wall.
box('pit_front', [2, .9, 17.4], [.4, 1.8, 5.2], 'pit', role='cover')
box('pit_north', [5, .9, 14.9], [6.4, 1.8, .4], 'pit', role='cover')
box('pit_south', [5, .9, 19.9], [6.4, 1.8, .4], 'pit', role='cover')
# Melee yard posts (cover the yard from stray fire, decorative trim on top).
box('yard_rail', [-17, .5, -20], [14, 1, .3], 'cover', role='cover')

anchor('spawn_west', 'spawn', [-30, 0, 0], team='west')
anchor('spawn_west_2', 'spawn', [-30, 0, 3], team='west')
anchor('spawn_east', 'spawn', [33, 0, 0], team='east')
anchor('cover_bench', 'cover', [FIRING_LINE - 1.2, 0, 0], height=.9)
anchor('cover_pit', 'cover', [1, 0, 17.4], height=1.8)

routes = [dict(id='lanes', name='Firing line to the targets', points=[[-30, 0, 0], [-20, 0, 0], [0, 0, 0], [30, 0, 0]])]
data = dict(
    mapId='training_range', name='TRAINING RANGE 训练场', version='0.1.0', mode='arena',
    supportedTeamLayouts=['1v1'], units='metres', upAxis='Y',
    bounds=dict(min=[-38, 0, -23], max=[38, 8, 23]), symmetry='none',
    presentation=dict(preset='day'),
    palette=palette, objects=objects, anchors=anchors, routes=routes,
    player=dict(radius=.32, height=1.8, eyeHeight=1.65, walkSpeed=4.2, stepHeight=.28),
    range=dict(firingLine=FIRING_LINE, lanes=dict(static=-10, strafe=0, cover=8), distances=[10, 20, 30, 45]),
)
(ROOT / 'runtime').mkdir(exist_ok=True)
(ROOT / 'runtime/map.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(f'Wrote {len(objects)} objects, {len(anchors)} anchors; 76 x 46 m training range')
