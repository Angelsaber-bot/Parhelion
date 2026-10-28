# BLACKFLAG · 黑帆战舰

Game-scaled Blackbeard chapter arena: **64 × 34 m** safe fighting deck, two 2.4 m
raised end decks, four 5 m ramps, two broadside loops and central cargo/hatch cover.
No required jumps, gangplanks, moving deck or swimming simulation.

## Art direction / Sakura benchmark

Warm painted oak, deep navy tarred hull/cloth, aged brass, cream canvas and cool sea.
The minimum design benchmark was the unchanged **SAKURA** arena, inspected in actual
source and pixels: recognizable landmark, rhythmic lane framing, readable foreground /
midground / background, intentional colour contrast, and modeled secondary craft.
BLACKFLAG interprets those principles as a ship, not copied shrine architecture:

- **Landmark:** billowing, panel-sewn black heraldic sail with original sun-mask and
  crossed-cutlass artwork; shorter cream fore sail, luffing pennant and triangular jib.
- **Silhouette:** multi-strake rounded hull/bilge, keel, extended bowsprit and winged
  gilt figurehead; raised stern gallery with curved roof, glazed bays and carved curls.
- **Eye-level craft:** oak board grain, staggered joints/nails, rail stanchions, brass
  coping, framed bulkheads/doors/portholes, real barrel staves/hoops, closed cargo rack,
  draped cloth, segmented crates, carriage trucks and open-bore cannon geometry.
- **Depth:** nearby rigging and cover; mast/hatch/quarterdeck in midground; modeled
  distant brigs, low island silhouettes and broken sea wave strokes beyond the hull.

All textures are **original deterministic procedural paintings**, authored in
`source/surfaces.py`. Six PNGs are embedded inside the GLB (105,430 encoded bytes):
1024² oak, 1024² heraldic sail, 512² canvas, and three 256² packed ORM maps.
Wood uses a repeat tile every 8 world metres with 1 m board width; canvas repeats
at 2 m; the heraldic sail has dedicated 0–1 UVs. Linear magnification and trilinear
mipmapped minification are declared. No external URLs, borrowed texture licenses,
alpha/transparency sorting or embedded point lights. PBR roughness/metal response
is stored in the GLB; runtime rendering remains the shared chapter renderer's concern.

## Editable source / rebuild

Requires Python 3 + Pillow; Blender is only needed for optional offline previews.

```sh
python3 arena-maps/blackflag/source/build.py
python3 arena-maps/_lib/check_glb.py arena-maps/blackflag blackflag
python3 arena-maps/blackflag/validation/check_art.py
cd arena-game && npx vitest run test/maps.test.ts test/chapter-qa.test.ts
```

`source/build.py` is dimensioned layout and authored mesh craft, using the shared
`glbkit.py` / `chapterkit.py`; `source/surfaces.py` paints the material inputs.
`runtime/map.json` is authoritative collision, anchors and movement routes;
`assets/blackflag_collision.glb` is the corresponding inspectable proxy.

### Final art budget and invariants

| Item | Verified value |
|---|---:|
| Visual triangles | 42,940 |
| Visual GLB | 3,933,468 bytes |
| Visual nodes / material primitives | 37 / 126 |
| Embedded images / lights | 6 / 0 |
| Shared GLB checks | 422 passed |
| Additional art/UV/physics checks | 145 passed |
| Rebuild | byte-deterministic, including textures |

The 2026-10-28 density repair intentionally adds two staggered middeck cargo
islands, paired broadside cannon breastworks and four raised-deck side bulwarks.
New cover has matching solid collision; existing routes, spawns, objectives,
bounds and player parameters are preserved. The raised side protection reaches
4.2m (1.8m above the end decks) at the true ±17m edge; shared simulation bounds
prevent jump/dash escape. New three cover anchors are reachable by bots.
The art checker now pins this authorized layout and collision hash, not R2.
The material-primitive ceiling is explicitly 128 (126 used), reflecting the eight
added solid meshes; the original 50k triangle and 4MB total GLB budgets remain.
All `VIS_` gameplay geometry remains inside the matching collision proxy. Cargo
barrels have closed rack infill: dark gaps are recesses, not suggested shoot-through
holes. Decorative rigging/canvas/hull/sea/background do not claim physics. Small
trim details are flush, within existing solids, or outside the safe deck.

## Evidence / limits

`previews/blackflag-overview.png` and `previews/blackflag-lane.png` show the actual
final exported GLB with the shared neutral Blender CPU Cycles setup, **not browser
screenshots or AI concepts**. `previews/render-manifest.json` binds camera, renderer
and asset SHA256. JPG previews were refreshed from those same verified renders.
`validation/art_report.json`, `glb_report.json`, `rebuild_report.json` and
`gameplay-tests.log` record reproducible checks.

Static art and collision checks are not human PvP balance or real-device GPU/FPS
measurements. Browser capture remained unavailable in this environment; no sandbox
bypass, deployment, push, desktop access or external publication was performed.

The final density-repair export passes 422 shared GLB checks and 145 authored-art
checks. All 65 focused maps/chapter tests pass with the new layout, including
bidirectional routes, spawn LOS, connected anchors and completed bot matches.
