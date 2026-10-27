# Napoleon — mounted white cavalry horse

A high-detail, FGO-inspired Napoleon fan interpretation, adapted from the supplied reference to a **cavalry saber and white horse**, not a gun or cannon. The likeness remains an artistic interpretation for user review, not a claim of exact reproduction.

## Deliverables

- `napoleon_mounted_editable.blend` — editable meshes, one mounted rig, original baked animation actions, packed textures and review studio. Blender 4.3.2.
- `runtime/napoleon_mounted.glb` — self-contained glTF 2.0 runtime asset.
- `runtime/napoleon_mounted.glb.gz` — byte-exact gzip of that GLB; decompress before passing its bytes to a GLB loader.
- `previews/` — actual native and GLB round-trip renders, including side/rear and locomotion/attack poses.
- `asset-manifest.json` — exact hashes, axes, clip and socket contract, public-file whitelist.
- `SOURCE_AND_LICENSE.md` — source provenance and scope.

## Runtime contract

One `Napoleon_MountedRig` skeleton drives horse, rider, tack, reins and saber. Use one animation mixer/clock; do not independently advance a second horse animation.

| Clip | Seconds | Behavior |
|---|---:|---|
| `MountedIdle` | 3.0 | Loop |
| `MountedWalk` | 1.066666667 | Loop; nominal forward movement 0.703125 m/s |
| `MountedRun` | 0.8 | Loop; nominal forward movement 2.093023256 m/s |
| `MountedAttack` | 1.4 | One shot: raise, cavalry saber cut, recovery |

Animation sampling is 30 fps, with one duplicated terminal pose. There is no planar locomotion root motion to extract. Apply movement in the engine. Match the nominal speed, or scale animation time by `engine_speed / nominal_speed`, to preserve stance contact. The attack contact marker is **0.766666667 seconds** (Blender frame 24; zero-based frame 23). This is an animation event marker, not an automatically configured damage collider.

Meters. Blender authoring: +Z up / -Y forward. GLB: +Y up / +Z forward. The scene root is the ground-oriented character placement reference. Skin geometry has approximately 8–11 mm of hoof clearance in the checked poses; account for that small clearance in ground placement rather than assuming every frame's lowest vertex is exactly zero.

### Named sockets

- `SaddleSocket`: horse saddle reference.
- `RiderSeatAnchor`: rider seat contact reference; fixed relative to the saddle throughout all four clips.
- `ReinSocket`: actual rider left-palm/rein endpoint reference.
- `SaberSocket`: saber grip reference.
- `SaberTip`: tip reference. Determine the blade's world direction using `SaberTip.position - SaberSocket.position`, rather than guessing an engine-local axis.

The saber blade is 0.91 m long; full grip-to-tip span is approximately 1.03 m, with the pommel extending below the grip. Its visible curvature is intentional.

## Detail and performance

This is a **high-detail hero asset**, not a crowd/mobile LOD. The final authored topology is preserved. Runtime batching merges compatible objects without decimation; redundant curve sampling was reduced at authoring time without removing any garment or weapon feature. The final package contains 349,738 triangles, 76 bones, 28 materials and 9 embedded images. Use an explicit LOD strategy if many copies must be visible simultaneously; none is silently substituted in this deliverable.

All final native skin weights are normalized and limited to four influences, including the subdivided horse body. Horse mane and tail use an alpha texture. A renderer must support glTF alpha blending and normal maps.

## Verification and limits

Verified in Blender 4.3.2 through actual beauty/multiview/animation renders and GLB reimport renders. Native checks cover normalized weights, finite bone matrices, loop closure, and rider-seat synchronization. The horse stance-contact audit checks the agreed forward speeds. Independent Three.js CPU loading/skinning/clip/socket checks are supplied by the integration task.

This package does not itself prove full browser-game integration, collision tuning, gameplay balance, all possible cross-fades, facial animation, dismounting, or arbitrary runtime retargeting. The four clips are purpose-authored for this mounted character. Geometry, materials and rig remain editable for further art-direction revisions.

## Public packaging

Use only the whitelist in `asset-manifest.json`. Do **not** publish the preparation directory, downloaded source bundles, user reference screenshot, discarded candidates, intermediate Blender backups, or unrelated working files.
