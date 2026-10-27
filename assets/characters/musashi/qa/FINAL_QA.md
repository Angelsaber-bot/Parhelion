# Musashi final candidate — verification and limits

## Passed technical checks

- Full runtime: **173,648 triangles**. Explicit optional LOD1: **85,377 triangles**. The default deliverable remains full-detail LOD0; LOD1 is not silently substituted.
- Both: 13 material/mesh groups, 65 bones, 56 facial morph targets, normalized maximum four bone influences, no unweighted vertices.
- Actual Three.js GLB loading, CPU deformed vertex samples for all four clips, six crossfades, finite bounds and loop/return endpoints passed.
- Every facial morph individually deformed and checked in the actual GLBs. LOD0 and LOD1 retain identical face geometry, UVs, normals and morph deltas (hash in `morph-socket-validation.json`).
- Both hand sockets were sampled through all four clips: bone-local drift below 8e-16. Actual hand-grip renders were also inspected.
- Walk stance compensation error below 0.000007 m/s; Run below 0.0031 m/s at sampled/baked frame intervals. These are in-place clips requiring the documented forward speed.
- Analytical animation reach clamps: zero. Attack is an original two-sword combo with baked right/left contact events at frames 20 and 34 (30 fps, first frame 1).
- Actual exported GLBs were re-imported and rendered in Blender. glTF sheen colour was corrected to preserve the authored 0.18 strength rather than exporting white full-strength sheen.

## Visual repairs actually made

Torso/hip skin intersections, rear inner-wrap protrusion, motion-exposed thigh penetration, thumb opposition, forearm ornament skinning, rear scalp coverage, lower-leg weights and stocking/shoe seams were inspected and corrected. Reference front/back/side/detail renders and representative Idle/Walk/Run/Attack frames show actual geometry, not generated concept art.

## Honest limits

- This is an **authored reference-led reconstruction**, not an official/ripped game model and not a certified “unchanged” copy. Face maturity/sharpness, hair tuft and neckline remain stylized interpretations. Rear folds/accessory construction are inferred where the supplied sprite gives no view.
- Clothing and hair are skinned, not physically simulated. Representative authored clips were inspected; arbitrary retargeted extremes or future physics are not certified collision-free.
- Node tests stub texture loading and do not prove a browser/GPU renderer. Browser testing was unavailable; no claim of browser verification is made. Blender round-trip renders separately check exported appearance.
- Source textile micro-bump is omitted from runtime PBR. Static `Musashi_ReferencePose.glb` is a preview, not a replacement for the skinned runtime.
- Base creator modification/redistribution terms do not grant Fate/TYPE-MOON character-IP rights.
