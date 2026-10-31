# Environment evidence index — 2026-10-31 cloud pass

All heavy files live outside the repository under the sibling
`parhelion-eight-hour-evidence/environment/`. No public deployment is implied.

## What these images establish

The exporters read the actual Three builders and, for action fields, cropped shipped
GLB art and sampled production terrain. Blender CPU renders establish geometry,
composition, palette and authored pose/state readability. They do **not** establish
runtime WebGL/toon shading, PCF shadow bias/resolution, bloom, frame pacing or FPS.

Earlier `candidate-v2` and `false-dawn-v7` frames use studio shadowing. The field tool
now requires exported runtime shadow metadata by default; its `runtime` mode honors
caster flags through Cycles shadow-ray visibility, but remains an offline-lighting
review. `studio` and renderer-only `candidate` modes are explicitly named alternatives.

## Useful visual checkpoints

| Question | Evidence relative to environment/ | Important limit |
|---|---|---|
| Five original hub compositions | `baseline/renders/{region}.png` | Original geometry reference, studio light |
| New inhabited hub workspaces | `candidate-v2/renders/{region}-campaign.png` | Corrected base×vertex palette; studio shadows |
| Valley before crafted forms | `false-dawn-v3/renders/alpha-battle.png` | Same camera as subsequent Valley review |
| Crafted Valley structure | `false-dawn-v7/renders/alpha-battle.png` | Studio shadowing; not final runtime caster policy |
| Safe split-ground shadow gain | `field-shadow-split/{off,on}/{alpha,blacksail}-battle.png` | Actual factory flag exports; thin ground never casts in on |
| Remote relay instrument/approach readability | `false-dawn-remote-v7/renders/{blacksail,winter}-battle.png` | Default factory caster flags off; normal main now enables guarded structural casting |
| Player-height task readability | `campaign-player-frontage/{region}-player-frontage.png` | Actual1.62m eye/75°vertical FOV; studio lighting; BlackSail before correction |
| Harbor manifest visibility correction | `harbor-frontage-fixed/renders/blacksail-player-frontage.png` | Same world camera as previous row; pillar preserved |
| Final spatially separated briefing residents | `campaign-side-residents/renders/{region}-campaign.png` | Current except BlackSail +0.8m correction in harbor-frontage-fixed; studio lighting |
| Five resident silhouettes | `campaign-residents-v4/residents.png` | Before final minor lid/mouth/page refinement |
| Final Ada face and bounded note-check | `resident-acting-v2/{rest,read}/ada.png` | Actual runtime poses at 0/5.12 seconds; not a motion video |
| Actual main TPS field cameras, low/normal | `native-field-final/{low,med}/renders/{region}-{entry,console,exit}.png` | Production cameras/material scalars/caster flags and FrontSide primary rays; no actors/HUD/GPU shader parity |
| Partial accepted anchor circuits | `grounding-circuits/{000,100,111}/renders/alpha-detail.png` | Reviewed 06:32 UTC: none / I only / all accepted; default factory shadows off |

The first `candidate/` export mistakenly overwrote base color with vertex color on
some legacy textured stations. It is not a material acceptance reference; use the
corrected `candidate-v2` frames. Archived raw inputs can be restored losslessly using
QA's verified manifests; do not remove final images or active renderer inputs.

## Physical and lifecycle proof

- `hub-field-walks/audit.json`: all three full hub-travel landing→field console routes,
  using the original dry West Ford bridge in Alpha, plus all 47 travel arrivals.
- `alpha-crossing/audit.json`: original bridge centerline and per-leg physical proof,
  zero swimming/jumps; earlier unnecessary swim route retained in
  `hub-field-walks/initial-swim-route-audit.json`.
- `campaign-natural-stances.log`: five resident body clearances and all ten natural
  briefing→station stopping positions retain intended nearest-distance/LOS targeting.
- `approaches/audit.json`: five actual road→ramp→hub walks, no jumping.
- `roof-approach-regression.log`: same production routes after hard-roof collision fix.
- `false-dawn-audit/geometry-routes.json`: current three action-field approaches,
  seven interaction routes, nine actor feet/clearance/LOS/routes and reachable warmth.
- `false-dawn-remote-v5-geometry.log`: physical remote revision audit. Later dial/cue
  material/indicator refinements did not alter collision.
- `world/validation/campaign-sites.test.ts`: all old/new hub task sockets reachable,
  17 explicit original interior/doorway destinations, bounded resources, immutable
  state collision, upward actual-Player roof contact and natural interaction stances.
- `world/validation/false-dawn-sites.test.ts`: interaction-disc spawn margins,
  per-prop terrain support, partial/reset cues, completion indicator front visibility,
  no winding reliance on double-sided rendering, fixed resource/collision identities,
  exact visual/collider equivalence of optional shadow split, hysteresis/caster cap,
  supported idempotent toggles and default/low-quality exclusion.
- `world/validation/settlement-npcs.test.ts`: bounded six-batch actors, near-only acting,
  finite/invalid-delta handling, 900-frame work/gesture check and visible lip regression.

## Integrated shadow quality contract

Main enables the guarded capability only outside low quality. Low boot has seven
Valley batches / zero field casters; normal has eight / at most two, with 70/85 m
hysteresis. The eighth batch is thin noncasting ground sharing the body material.
Supported live internal toggles retain objects/collision/progress; global quality
Apply/reload remains unchanged. Actual-main low/normal tests verify 40 toggle/state
cycles, but do not establish GPU frame cost or PCF visual parity.

## Reproducing a field review

Run from `world/`; use an output directory outside the repository:

```sh
node --import tsx validation/environment-eight-hour/export-fields.ts OUTPUT/meshes \
  --near-shadows --anchors=100
python ../../parhelion-eight-hour-evidence/render_budget.py --weight 1 \
  --tag environment-REVIEW -- blender -b -t 2 \
  -P validation/environment-eight-hour/render-fields.py -- \
  OUTPUT/meshes OUTPUT/renders detail,battle alpha runtime
```

Omit `--near-shadows` for the default/low shadow capability. `--anchors=000|100|111`
selects exact independently saved confirmation circuits; it is not a gameplay shortcut.
Always use the shared admission wrapper, do not launch Blender outside its budget.

## Native camera refinement

See `FIELD_NATIVE_CAMERA_REVIEW_20261031.md` for the production-main low/normal
18-pose metadata comparison, interaction LOS, hero-to-instrument ray checks, and
explicit distinction between camera-to-target and shoulder-offset crosshair rays.
Early native-field-review/exit frames are retained but superseded by native-field-final
for visibility acceptance: the earlier CPU shader exposed foliage backfaces.

## Original landmark review

`ORIGINAL_LANDMARK_REVIEW_20261031.md` records five old authored entrances/interiors,
native low/normal camera/material checks, 28 ordinary-input route legs, intentional
Honnoji charred palette, and CPU hemisphere/crop limitations. The only reproduced
art defect is the tavern's missing underside; the separately audited six-triangle
candidate is documented in `TAVERN_UNDERSIDE_REPAIR_20261031.md`.

## Branch consistency and selected previews

`BRANCH_SCENE_CONSISTENCY_20261031.md` records four fresh low/normal branch boots,
projection/reset identity and bounds checks, and explicit limits. The selected
handoff gallery is `environment/final-preview-selected/index.html`: five existing
accepted offline images with unchanged-byte/source manifest, not live screenshots.

## Native era servant coverage

`ERA_SERVANT_VISUAL_REVIEW_20261031.md`: Musashi/Blackbeard/Napoleon actual-main
idle, follow, ordinary contact and ultimate-return snapshots; native attachments,
materials, roots and resumed idle checked. Final grounded CPU frames are under
`environment/era-servant-grounded/`; explicit setup/meter and offline-camera limits
are documented. No model/motion change was needed.

## Construction reference cleanup

`SITEART_CONSTRUCTION_RETENTION_20261031.md`: eight-builder final-buffer parity and
zero retained construction bins after finish; 2.275 MiB of disjoint CPU backing
stores no longer retained by these arrays. This is not a measured heap/FPS claim.

## Optional tower west walking access
See [TOWER_WEST_WALKING_ACCESS_20261031.md](TOWER_WEST_WALKING_ACCESS_20261031.md). Exact append-only 264 ART / 24 COL triangle walking route, original jump/glide/perch route preserved; explicitly not a global softlock repair. Paired native TPS CPU previews and controlled-but-intermittently-airborne descent traces under `environment/tower-access-v2*`; independent fresh earned-route replay tracked separately.
