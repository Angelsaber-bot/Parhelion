# Integrated resource checkpoint — 0158c2d

Independent no-GPU runtime inventory compares original `9c6cd86e84f3130e0eab6dc416ec1383e520a8f0` with frozen `0158c2d26912978695e0f0129375aa6a8fe475d9`. Current external audit harness boots each product's actual modules/assets, low effects/no post, deterministic frames and identical scenarios. This checkpoint includes new campaign/False Dawn sites, residents, contact presentation, memory/material changes; it excludes unapproved Saber stride work.

| Whole loaded scene | Original | Checkpoint |
|---|---:|---:|
| Objects |10,794|10,660|
| Meshes |9,361|9,411|
| Geometry identities |5,112|5,162|
| Material identities |1,276|1,146|
| Light objects |20|14|
| Unique scene-reachable geometry backing bytes |385,230,650|282,644,098|

The graph-backed reduction is102,586,552bytes. **Do not add this to the separate native-retention savings**: they are overlapping accounting scopes, and graph reachability does not establish complete process retention. Geometry totals include hidden geometry; shared backing buffers are counted once. Light objects are not shadow-pass or GPU-cost measurements.

## Visible new-content costs
At five standard landscape views, candidate material groups/triangles remain unchanged except BlackSail16:9 (+1group/+2,288triangles). This does not mean new content is free: cameras facing the new hubs show the following increments over original:

| Hub |16:9 groups / triangles added|9:16 groups / triangles added|
|---|---:|---:|
| Alpha |9 /8,360|9 /8,332|
| Britain |9 /6,868|9 /6,868|
| BlackSail |10 /9,948|10 /9,920|
| Winter |13 /11,582|9 /7,776|
| Kyoto |9 /7,876|9 /7,820|

Camera/player transforms match exactly apart from approximately2e-15m rounding at Winter. Frustum candidates exclude hidden ancestry/layers but do not simulate occlusion, shadow maps, shader execution or postprocessing. These are **not actual WebGL draw calls, GPU memory, FPS, or device performance claims**. Added content raises some visible geometry costs even as source metadata release and material/color reuse reduce retained resources.

Evidence: sibling `parhelion-eight-hour-evidence/qa/checkpoint-0158c2d/` inventory/comparison JSON and logs. Independent before-hash verification covers all1,460tracked files /613,389,344bytes with zero drift. Full aggregate and after-hash status are maintained separately by integration QA.

## 07:43 checkpoint 82e89d3: cue budget and corrected native boundary

Frozen `82e89d334b73bb88b90cca07465855692e2cc5a4` adds exactly three
objects/meshes/geometries/materials and **55,296 bytes** of unique geometry backing
stores versus frozen0158c2d in every paired landscape sample. These are the fixed
Warden contact-cue slots; lights remain14. HQ loaded graph is now10,663objects,
9,414meshes,5,165geometries,1,149materials,282,699,394geometry bytes.

**Correction to the interpretation of earlier native frustum counts:** the
headless GLTF constructor mismatch also skipped the intended
`SkinnedMesh.frustumCulled=false` assignment before6d3551b. The structural census
already counted those meshes, so totals remain comparable. But corrected native
enemies now contribute additional single-pass candidates even with identical
cameras: BlackSail+8/+16groups (22,652/45,304triangles), Winter+10/+20
(41,284/82,568), Kyoto+2/+2 (86,617each), landscape16:9/9:16 respectively.
All changed roots are native enemies; this is **not new geometry or evidence of
a browser performance regression**. The prior browser singleton was expected to
apply this culling policy already. Earlier raw headless frustum figures must not
be treated as accurate native-browser draw counts, nor do corrected ones prove
GPU execution. Static resource/memory/source-equivalence proofs are unaffected.

Evidence: `qa/checkpoint-82e89d3/{runtime-scene,resource-comparison}.json`.
The82e89d3 full World aggregate was **not green** (1,370/1,399); its29 failures
include legacy VM fixture wiring and a real missing Arena translation, tracked
separately by integration. This inventory is not milestone acceptance.
