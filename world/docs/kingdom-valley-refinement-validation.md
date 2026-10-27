# Kingdom and Valley refinement — validation record

Date: 2026-10-27. Art baseline: `36936478839311d00e29babcb9a0b2f844c7a6e8`.
The concurrent companion/HUD/input/localization changes through `4727c530` were
integrated without replacing the map work. Final publication must retain any later
non-conflicting remote work as well.

## Scope and identities

The Sunset Kingdom uses an explicitly legendary Arthurian Romance language:
eight townhouse families, limestone courses, oak framing, gray-blue slate, small
bronze/gold accents, heraldic pavilions and a stone-crowned keep. The high keep's
original spiral traversal is retained, but its stone corbels, shields and flat
crown distinguish it from Black Sail's wooden lighthouse gallery.

Parhelion Valley uses a contemporary instrument-campus language: a split optical
dome, framed glazing, fabrication workshop, calibration tower, field-camp craft,
a weathered maintenance station, resonator shrine and hydrology bridge fittings.
Its white ceramic/cool alloy/teal palette does not reuse another chapter's houses.
Destination-era seam vignettes intentionally foreshadow the other chapters.

Historic references are bounded in `kingdom-valley-art-direction.md`. Neither the
Romance castle nor the original research hub is claimed as a literal archaeological
reconstruction. Runtime material boundaries are in
`kingdom-valley-material-direction.md`.

## Automated acceptance

The final `4727c530` integrated candidate passed **257 tests, 0 failures, 0 skipped**, TypeScript
`tsc --noEmit`, and the Vite production build, including the final waterfall
correction. These tests cover the frozen asset hashes recorded below.

Five-world regression freezes each complete layout and verifies the unchanged
Kyoto, Everwinter and Black Sail asset SHA-256 hashes. Britain and Valley preserve
every original ordered decoded collision triangle, mesh transform and gameplay
extras, not merely an unordered geometric set. This protects BVH/contact behavior.
All markers, objective graphs, teleports, routes and conditional gameplay state
remain unchanged. Existing actual-player traversal tests exercise the maps.

The production assets must contain all ten Britain and seven Valley material
identities; fixture-only checks are insufficient. Finite geometry/index, size and
collision checks run on the actual exported GLBs. Additional production ray tests
prevent the formerly visible overlapping upper keep landing faces. Source tests
reject duplicated workshop slats and buried Round Hall window frames.

## Review method and evidence

Each of the two refined chapters has 16 selected before/after camera views at
1200 × 800, Cycles CPU, 256 samples, no denoising, identical lighting/exposure.
Imported geometry is the actual decoded exported GLB. Conditional `showWhen`
objects and descendants are hidden consistently, without inventing gameplay state.
Boards place the original images beside labels; no generated architecture or
scene-pixel retouching is used.

The original baseline renderer began before per-frame camera JSON logging was
added. Its frames retain successful 256-sample write logs, dimensions and hashes;
unchanged cameras are supported by the original fixed-camera batch record, not an
independent per-frame camera log. The two known framing changes (Britain distant
Camelot and Valley falls) were rerendered with logged final camera values. All new
final frames require an exact per-frame match to the final camera JSON. The review
manifests identify this evidence distinction instead of claiming stronger proof.

Actual pixel review prompted fixes to the keep's coplanar black top triangles,
unsupported gallery posts, distant castle footing, Round Hall windows embedded
inside wall thickness, repeated/blank rear house facades, duplicate workshop
slats, tent strap alignment, observatory porch edge, outpost detailing and shrine
form. Valley's former broad gold roof/dish were replaced by cool ceramic/alloy;
royal gold is restrained on the Kingdom's slate roof ribs and fittings.

## Verification boundary

These are **offline exported-GLB PBR fallback renders**, not screenshots of the
runtime toon shader. Live WebGL compilation, browser input, GPU memory, frame
rates and frame times have not been verified in this cloud pass. Node tests and
bundling are not substitutes. Decorative ART silhouettes can be richer than the
original coarse collision proxies; existing traversable surfaces and routes were
preserved rather than promising all roof ornament is walkable.

The waterfall already exported as alpha BLEND/0.7. Its prior slab-like appearance
was not missing alpha: it was a broad flat water sheet in front of rectilinear
cave proxy artwork, shaded differently by offline lit PBR than runtime unlit
water. No runtime water shader or transparency setting is changed for an image.

Desktop synchronization, browser acceptance and public deployment are separate
operations. This document alone does not claim that those steps have occurred.

## Final artifact record

Britain: `world_britain.glb`, 6,131,368 bytes, SHA-256
`c4f1d2a95d182a179fba26b189ea755abfb8867013144310757c8d36cb3aba8d`.
ART: 804,999 triangles (baseline 562,454); COLLISION: 294,768 unchanged.
33 ART meshes before runtime chunking, not a measured GPU draw-call count.
The baseline GLB was 7,238,240 bytes. All 16 final views and four Britain boards
have completed review; the corresponding 32-frame manifest is verified.

Valley: `world_alpha.glb`, 3,788,892 bytes, SHA-256
`8db7385bff231dfe22588c52108284d2f7c55b11a605b2067452f49508f5f3e7`.
ART: 507,692 triangles (baseline 450,414); COLLISION: 285,494 unchanged.
73 ART meshes before runtime chunking, not a measured GPU draw-call count.
The baseline GLB was 4,914,212 bytes. The final waterfall ART review passed;
its continuous curtain and irregular rock lip replace the strip/slab appearance
without changing water transparency or collision. All 16 final views and four
Valley boards have completed actual pixel review; its 32-frame manifest verifies.

Combined evidence: **64 source frames at 256 samples and eight comparison boards**,
with dimensions, hashes and completed-render logs checked by `verify-review.py`.
The baseline camera-log distinction above is retained in both manifests. No new
blocking visual defect was found in the final boards. The terrain, large-scale
layout and distant low-poly scenery were preserved; this is architectural and
material refinement, not a replacement of every terrain/vegetation asset.

The increases in ART triangles and Valley material batches are explicitly recorded
above. No measured runtime performance improvement is claimed; browser/GPU
profiling remains required for performance acceptance.
