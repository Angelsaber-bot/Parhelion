# BLACKFLAG · 黑帆战舰

Game-scaled Blackbeard chapter arena: **64 × 34 m** safe fighting deck, two 2.4 m
raised end decks, four 5 m ramps, broadside loops and staggered cargo/hatch cover.
No required jumps, gangplanks, moving deck or swimming simulation. The approved
2026-10-28 density/safety runtime map and collision GLB are **byte-for-byte unchanged**.

## Art direction and October 28 craft polish

Warm painted oak, deep navy tarred hull and heraldic cloth, aged brass, cream
canvas and cool sea. The unchanged **SAKURA** arena is the design benchmark:
recognizable landmark, readable foreground/midground/background, intentional
colour contrast and modeled secondary craft—not copied shrine architecture.

The silhouette now has a layered main course and cream topsail, shorter foremast
and fore topsail, a raked dark lateen mizzen, mast caps/fighting tops, a high luffing
pennant and triangular jib. The original sun-mask/crossed-cutlass sail artwork
remains the strongest focal mark; the smaller stern cartouche interprets that
same motif as raised carved geometry rather than another flat graphic.

Craft is concentrated where it has a purpose:

- **Ship structure:** multi-strake rounded hull/bilge, keel, extended bowsprit,
  winged gilt figurehead, curved stern roof, framed transom and side quarter-gallery
  windows, mullions, relief curls, carved brackets and swan-neck lanterns.
- **Rigging:** distinct spars, stays, shrouds/ratlines, rope-lashed mast caps,
  external chainplates and paired deadeyes; not a random web across walking lanes.
- **Period fittings:** external catheads and stocked anchors with forged flukes,
  a small cast bronze bell beside the bow screen, helmsman's wheel, flush rope
  coils, hatch rings and compass-rose deck marquetry.
- **Guns and cargo:** subtly varied cannon shoulders, open muzzles, low wooden
  trucks, axle hubs, trunnions/capsquares, quoin blocks and restrained recoil
  ropes. Closed packing cases have real board layers, straps, pegs and bracing.
  Cargo canvas has a weighted, softly rolling hem instead of a pointed awning.
  Cabin fronts have arched glazed fanlights, raised door fields, visible hinges,
  corner scroll knees and a recessed rail dado/bead.
- **Distance:** modeled distant brigs, low island silhouettes, interrupted wave
  strokes and varied-width hull wake ribbons; no background collision.

This is an original fictional arena, **not an archaeological reconstruction**.
Period craft references include the [Royal Museums Greenwich c.1710 20-gun model](https://www.rmg.co.uk/collections/objects/rmgc-object-66359),
QAR project's [gun carriage](https://www.qaronline.org/conservation/artifacts/arms-and-armament/gun-carriage),
[mixed-origin cannon](https://www.qaronline.org/blog/2024-01-03/artifact-month-swedish-cannon),
and [ship's bell](https://www.qaronline.org/conservation/artifacts/ship-components/bell).
References informed construction vocabulary; no photographs, scanned meshes or
historical coats of arms were copied into the asset.

## Original embedded surfaces

All images are deterministic original procedural paintings in `source/surfaces.py`.
Seven PNGs are embedded inside the GLB, **100,693 encoded bytes**:
1024² oak and heraldic sail, 512² canvas, 256² wood/canvas ORM, and separate 128²
iron/brass ORM. `metal_orm.png` remains an unused source-compatibility output.

Oak has board-scale paint facets, varied tapered grain, asymmetric knots, caulked
joints, pegs and matching roughness. Canvas has woven panel modulation, folded hems,
double stitch rows and restrained cross seams. Sail dye varies across sewn panels;
its purpose-painted heraldry has dedicated 0–1 UVs. Iron stays dark and rougher;
aged brass has a distinct restrained metal response. No external URLs or texture
licenses are needed at runtime.

Oak repeats every 8 world metres with 1 m board width; canvas repeats at 2 m.
Linear magnification and trilinear mipmapped minification are declared. No alpha
sorting and no embedded point lights. Actual PBR response, dynamic sea glints and
atmosphere remain the shared chapter renderer's responsibility.

`DETAIL_ship_sails` and `DETAIL_ship_gallery` explicitly set `extras.castShadow=true`.
`DETAIL_chapter_craft` sets it false so sea and distant scenery cannot enter the
ship shadow pass. Solid gameplay meshes retain their existing runtime shadow
behavior. Offline Blender inspection is not proof of the WebGL implementation.

## Editable source / rebuild

Requires Python 3 + Pillow. Blender is needed only for offline preview renders.

```sh
python3 arena-maps/blackflag/source/build.py
python3 arena-maps/_lib/check_glb.py arena-maps/blackflag blackflag
python3 arena-maps/blackflag/validation/check_art.py
cd arena-game && npx vitest run test/maps.test.ts test/chapter-qa.test.ts
```

`source/build.py` owns dimensioned geometry. Its Blackflag-only `ShipChapter` export
adds explicit shadow groups without changing the shared chapter builder or any
other map. Its indexed cylindrical beam helper shares smooth side normals and
omits subpixel rope end caps, retaining hard caps on substantial spars. This saves
vertices rather than removing silhouette or authored detail.

`runtime/map.json` remains authoritative collision, anchors and routes. Its semantic
palette is unchanged; revised visual PBR colours and the additional mizzen textile
are stored in the visual GLB material table only. `blackflag_collision.glb` remains
the corresponding inspectable proxy.

### Final art budget and invariants

| Item | Verified value |
|---|---:|
| Visual triangles | 49,879 |
| Visual GLB | 3,507,008 bytes |
| Visual nodes / material primitives | 39 / 141 |
| Embedded images / lights | 7 / 0 |
| Shared GLB checks | 449 passed |
| Additional art/UV/normal/physics checks | 446 passed |
| Rebuild | byte-deterministic across all 11 generated files |

The original **50k triangle / 4MB total GLB limits remain**. The previous local
128-primitive ceiling is explicitly revised to 160 (141 used) to permit precise
sail/gallery shadow groups and modeled craft. This is a documented material-batch
tradeoff, not a claim of measured FPS improvement. GLB size is 10.8% lower than the
3,933,468-byte density-repair baseline despite added detail; runtime device/GPU
performance was not measured by these static checks.

The approved 34 solid collision meshes, bounds, player dimensions, anchors,
spawns, objectives and movement routes are unchanged. Raised side protection
still reaches 4.2 m at the true ±17 m edge. Every `VIS_` gameplay mesh stays inside
its matching proxy. Closed cargo backing remains solid; dark barrel recesses do
not imply shoot-through holes. New anchors/catheads/mizzen are outside the playable
boundary; topmasts and topsails are above gameplay height; compass inlay is flush.
All new cannon fittings stay inside the existing cover proxies.

## Evidence and limits

`previews/blackflag-overview.png` and `previews/blackflag-lane.png` are actual final
GLB exports rendered with the shared neutral Blender CPU Cycles setup, not browser
screenshots or AI concepts. Final independent views and the 1.7 m player-eye lane
are also in `docs/blackflag-polish-qa`; their manifest binds camera and asset SHA256.
The JPG previews are refreshed from the same verified final renders.

`validation/art_report.json`, `glb_report.json` and `rebuild_report.json` record
reproducible asset checks. Independent gameplay/render QA is documented under
`docs/blackflag-polish-qa`. Static checks do not establish human PvP balance,
real-device FPS, or exact runtime lighting parity. No publication, deployment,
desktop access or sandbox workaround was performed by this art build.

## 2026-10-28 lantern light and helm collider

Built on the October 28 craft polish without changing its art direction: lantern
glass is emissive, four lanterns hang from the main and fore masts above head
height, and every lantern carries a runtime halo and a deck light pool. The ship
atmosphere dims the room environment to 0.5 so rigging and sail shadows read on
the deck. The helmsman's wheel was walk-through; `stern_helm` is a slim collider
matching its disc (approved hashes in `validation/check_art.py` updated for it).
