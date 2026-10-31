# Saber remaster closure — 2026-10-31

## Accepted source and asset boundary

- `d1a7d67`: native live blink/focus, safe reset/disposal, blade-tip metadata helper.
- `5732cb3`: lower-default Q/X glare and private Excalibur acting; other identities unchanged.
- `591332e`: final **revision2e** armor/civilian models, deterministic builder, morph/rig/contact tests.
- `e3e31a7`: shared runtime activates both revision2 URLs.
- `310ce6d`: preserved revision1 published-hash fixture remains historical; current revision2 still passes unchanged 55-bone carry/grip/transition gates (6/6).

Armor SHA-256 `64cc8b1766565e356ad01c3a0c18a063d2bb3880b622739e7f1f31d38ad37e28`.
Civilian SHA-256 `7c7a75ed7fe2b9df400be1a47f1ab1b33e741ddb07819ac227f66d961e2cdb3f`.
The asset directory README/manifest describes origin, sizes and deterministic regeneration.

| Area | Actual delivered change | Intentionally retained |
|---|---|---|
| Model | Consistent face/morph sculpt, conformal skinned locks/ahoge, layered breast keel, shared cloth folds, differentiated materials | Original native rig, core design and supplied textures |
| Ordinary acting | Live blink/focus and Attack spine anticipation/recovery | Original Idle/Walk/Run tracks, accepted grounded stride, downward carry and exact contact clock |
| Excalibur | Bounded planted-foot weight loading, higher two-hand charge, recovery, private hair wind and authored camera | Private clone ownership, actual target/charge/damage/skip authority |
| Readability | Lower normal-mode lights/core/impact opacity, fewer motes and two clearer ribbons | Reduced-effects option; no global exposure change or other-actor lighting reduction |
| Sword | Guard/hilt/grip fixed; net world blade 1.082→0.913 m (−15.6%) | Relaxed downward silhouette, actual hand/socket transforms |

This is a substantive refinement, not a from-scratch topology or frame-for-frame FGO recreation. User reference video could not be viewed; no unavailable footage was claimed as inspected. No new official game asset was extracted/downloaded.

## Evidence and explicit limits

Evidence root is sibling `parhelion-four-servants-evidence/saber/`.

- `revision2e-quarter/saber-face.png`: accepted final connected hair/face quarter view.
- `final-model-front/saber-candidate-armor-phase-0.png`: final native full-body idle.
- `final-both-quarter/`: final armor/civilian consistent-light review.
- `final-attack-framed-quarter/`: same-camera native 1.2-second Attack samples, fixed enlarged framing. The earlier `final-attack-quarter/` crops raised sword tips and is **not full-weapon framing proof**.
- `stage-final-fixed-frames/` and `stage-baseline-final-frames/`: seven matched phases, same old camera/exposure. These intentionally isolate light/material differences, not the new camera movement.
- `final-default-brightness-comparison.jpg` / `final-default-brightness-metrics.json`: at selected frame110 near-white SDR area 3.965%→0.135%; frame52 close-up 0.934%→0.087%. All seven selected mean luminances lower. Tiny outro128 near-white fraction rises 0.0255%→0.0278%; no universal zero-white claim.
- `temporal-clearance-final-e-full-sword.json`: exact final asset hashes, 81 time samples/outfit across 8-second actual follow/turn/stop. 146 silver-blade triangles against 813,459 armor / 61,481 civilian non-hand body triangles: zero intersections; minimum triangle-surface gaps 73.54 / 85.11 mm. Guard/grip contact is intentionally outside this blade audit.
- `final-locomotion-fixed.log`: current assets retain original upper carry/grip; all six tests pass.

All renders are CPU offline native geometry/material evidence, **not WebGL screenshots or GPU bloom/FPS proof**. Seven stage samples do not certify the exhaustive brightest frame. Actual-input QA independently tests the live shared attachment, real X damage, restoration, resource ownership and camera projection. Face close-ups intentionally crop the body/sword; late charge is the full-body/full-sword framing gate.

Sword-ground clipping is improved, not eliminated: flat native follow minimum −14.38 mm armor / −13.87 mm civilian. Four paired actual-map worsts remain Kyoto −353 mm, Winter −330 mm, Britain −37 mm, False Dawn −58 mm (all improved from revision1). No universal sword terrain solver or hidden root lift was added. Existing sole geometry and controller paths remain unchanged.

## Superseded / rejected previews

Revision2b is an early material/proportion preview; revision2c has rejected blocky hair tips/chest protrusions; revision2d still has floating quarter-view hair roots. **Only revision2e assets are final**. Earlier `stage-new-fixed-frames/` uses intermediate model/ribbons, not final art. All originals are retained, not silently replaced.

## Reproduction

From `world/`, use `node --import tsx validation/characters/export-saber-remaster.ts OUTPUT final --idle --frames=0` (both outfits), or `--attack --armor-only --frames=0,10,20,30,40,50,60,70,80,90,100,110,119`.
`render-saber-remaster.py` consumes those CPU-skinned manifests with original GLB materials. The final attack review uses one fixed framing center `[0,1.15,0]`, size `2.7` for every frame; original raw exports remain retained.
`audit-saber-remaster.ts OUTPUT.json` measures both revisions' native full silver blades. `audit-saber-remaster-body.ts OUTPUT_DIR final --revision=2 --full-sword --runtime-times` repeats the full native-body follow audit. `audit-saber-remaster-terrain.ts` retains actual World/Player/companion route construction and explicit revision selection; no experimental arm correction remains.
