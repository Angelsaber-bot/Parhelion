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
| Remote relay instrument/approach readability | `false-dawn-remote-v7/renders/{blacksail,winter}-battle.png` | Default factory caster flags off |
| Five resident silhouettes | `campaign-residents-v4/residents.png` | Before final minor lid/mouth/page refinement |
| Final Ada face and bounded note-check | `resident-acting-v2/{rest,read}/ada.png` | Actual runtime poses at 0/5.12 seconds; not a motion video |
| Partial accepted anchor circuits | `grounding-circuits/{000,100,111}/renders/alpha-detail.png` | Pending admission/render review at index creation; default factory shadows off |

The first `candidate/` export mistakenly overwrote base color with vertex color on
some legacy textured stations. It is not a material acceptance reference; use the
corrected `candidate-v2` frames. Archived raw inputs can be restored losslessly using
QA's verified manifests; do not remove final images or active renderer inputs.

## Physical and lifecycle proof

- `approaches/audit.json`: five actual road→ramp→hub walks, no jumping.
- `roof-approach-regression.log`: same production routes after hard-roof collision fix.
- `false-dawn-audit/geometry-routes.json`: current three action-field approaches,
  seven interaction routes, nine actor feet/clearance/LOS/routes and reachable warmth.
- `false-dawn-remote-v5-geometry.log`: physical remote revision audit. Later dial/cue
  material/indicator refinements did not alter collision.
- `world/validation/campaign-sites.test.ts`: all old/new hub task sockets reachable,
  bounded resources, immutable state collision, upward actual-Player roof contact.
- `world/validation/false-dawn-sites.test.ts`: interaction-disc spawn margins,
  per-prop terrain support, partial/reset cues, completion indicator front visibility,
  no winding reliance on double-sided rendering, fixed resource/collision identities,
  exact visual/collider equivalence of optional shadow split, hysteresis/caster cap,
  supported idempotent toggles and default/low-quality exclusion.
- `world/validation/settlement-npcs.test.ts`: bounded six-batch actors, near-only acting,
  finite/invalid-delta handling, 900-frame work/gesture check and visible lip regression.

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
