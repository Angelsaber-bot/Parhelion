# Rejected optional tower walking-access experiment — 2026-10-31

## Final decision: rejected and production addition reverted

Fresh earned-input QA on `12e5158` found the solid ramp side blocked an existing pre-RelayB ridge crossing: (30,-126) → (10,-142) → (-18,-160) stopped at approximately (-18,26.009,-157.35). Original `e7b660e` passes the same inputs. A simple isolated southwest relocation also obstructed the actual contour-following route at approximately (-18,25.256,-149.35). Neither is a valid old-route-preserving improvement.

Root rejected the optional feature rather than accepting a complex underpass, changing physics, or silently rerouting the QA path. Production generator wiring and exact-append allowances were removed; Alpha GLB restored byte-for-byte to SHA-256 `1fb8d6823f2afcbdd11586d92013df4250243505a956c49db98fb14624f2e850`. All original map assertions and the approved Relay B copy normalization remain. The isolated, explicitly rejected helper/tools and raw evidence remain reproducible; there is **no shipped stone walking ramp**. The cheap `tower-access.test.ts` now asserts complete original geometry identity and unchanged relay prerequisites, not acceptance of the prototype.

Original legitimate jump → glider → natural perch → grounded jump remains the valid route, proven in the fresh original progression run. The following sections are historical candidate measurements, **not accepted product claims**. Full failed fresh trace: `qa/fresh-mainline-ramp-12e5158.*`; isolated relocation trace: `environment/tower-access-v3-component.log`.

## Historical candidate scope and reason

The original tower **is reachable**: QA reproduced grounded jump → glider → natural north-west perch landing → second grounded jump, including a fresh earned-progression run without teleport/ground/HP/flag writes (`f13e7e1`, original `e7b660e` fixture). Earlier 72 radial single-jump component trials only established that those simpler approaches failed; they did not prove a global softlock.

Root approved this restrained addition after paired actual-TPS geometry previews. It makes the authored west approach visibly walkable, not a mandatory progression repair. Tower console position, Relay A/B prerequisites, old tower/hill/outer rim/calibration ring/lamp and original north-side climb remain unchanged. No Player physics or support threshold changes belong to this scope.

## Exact addition

- Ramp center z=-159.5, width 3.6 m; x=-26 to -15.5; top height 23.945749171617024 to 30.5 m; slope 31.973°.
- Landing x=-15.5 to -13 at 30.5 m. Existing north glide perch z≈-165.94 remains outside footprint (z=-161.3..-157.7).
- 264 ART triangles, 24 collision triangles; one new primitive/batch each; existing `M_Toon` / `M_Collision`. No new lights, materials, textures, markers, outlines or dynamic objects.
- Original Alpha GLB SHA-256: `1fb8d6823f2afcbdd11586d92013df4250243505a956c49db98fb14624f2e850`.
- Appended Alpha SHA-256: `352bf0800b458c5be43dd8a86e49cce1e419d652d6883ef385cd49b8a6f02dbe`.
- All 3,672,364 original BIN bytes remain an exact prefix; SHA-256 `ee8b47f6622dd66ef27716a6a707eebcb1107a0d6dcc31c3429df0b136d7be20`.
- +29,376 BIN bytes / +30,468 GLB bytes. Only two nodes/meshes, four accessors/views, ART/COLLISION child appends and buffer length are added. Removing that exact whitelist recovers original JSON semantically exactly. Bounds exist for both new POSITION accessors.

`tools/gen/valley/tower-access.ts` appends after legacy structure batches. Its collider-audited base is fixed: procedural terrain differs from decoded terrain by ~6.4 mm here, so using fresh procedural height would change the accepted shape. A narrow terrain-support assertion rejects unrelated terrain changes. Source buffers equal shipped float values exactly; JSON transport canonicalizes signed-zero normals only. The repeatable `validation/environment-eight-hour/patch-tower-access.py` pins the original asset hash and never overwrites its input. Do not broadly regenerate legacy assets to reproduce this append.

## Physical and camera evidence

Sibling evidence root: `parhelion-eight-hour-evidence/environment/`.

- `tower-access-v2/component.json`: ten ordinary Player legs from west ground to deck/console frontage and back. Ascent/deck zero airborne substeps; descent 283 airborne 120 Hz substeps, supported final endpoint.
- `tower-access-v2/actual-input.json`: explicit supported diagnostic setup per segment, then production W/mouse/RAF. No ground, velocity, HP or progress writes. **Not fresh-save proof.**
  - Ascent: zero airborne 60 Hz frames, final grounded.
  - Descent: 141 airborne frames, longest interval 0.6 s, max downward speed 6.6 m/s, largest frame height drop 0.1085 m, final grounded.
  - Untouched neighboring descent: 137 airborne frames, longest 1.65 s, max downward speed 5.3167 m/s, final grounded.
  - All: max horizontal speed 5.5 m/s, HP 100→100, zero head-to-camera collision rays. This is controlled but intermittently airborne descent, **not fully grounded travel both ways**.
- `tower-access-shipped/actual-input.json`: rerun against shared production asset/source after integration, rather than candidate fixture.
- `tower-access-v2-before/renders/alpha-{entry,exit}.png` versus `tower-access-v2/renders/alpha-{entry,exit}.png`: source-identical isolated fixtures, native TPS camera and actual material metadata. Entry keeps lamp outside route; crest clears retained outer rim; thin calibration ring stays visible over landing. CPU geometry previews without hero/HUD, not GPU shading or temporal-animation acceptance.
- V1 retained under `tower-access-candidate/` is superseded: lamp/rim composition was not accepted. The first naive deck diagonal hit an original pillar; the corrected route goes via (-9,-162),(-8,-154),(-2,-154),(-2,-149).

## Regression contract / remaining acceptance

`validation/tower-access.test.ts` pins the original BIN and recovered JSON, exact source/asset geometry, upward-facing walk surfaces, triangle counts, north-perch separation and tower relay prerequisites. `map-polish.test.ts` permits only exact named ART/COL nodes and exact additional budget, retaining every old node/material/layout/collider assertion and prior Relay B copy normalization. No baseline regeneration.

Focused 38 tests and configured World typecheck pass. That fresh earned-route replay subsequently FAILED original corridor preservation, causing rejection and exact production reversion as recorded above.
