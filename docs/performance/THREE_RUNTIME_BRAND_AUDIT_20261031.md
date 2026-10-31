# Actual-main Three constructor-boundary audit

The headless fixture bundles production main as CommonJS while native GLTF loaders
can return objects from Three's ESM constructor lineage. Structural `isMesh` /
`isSkinnedMesh` / `isTexture` brands therefore need not imply `instanceof` the
bundled constructor. This is a **headless validation boundary**, not evidence that
a browser build with one Three singleton necessarily had the same behavior.

Positive checks previously caught actual no-ops hidden by state-only assertions:
- native enemy acting overlays (`6d3551b`);
- loaded rifle/blade finish material application (`3411b9e`), now independently
  asserting actual color/map changes for both weapons, restoration and neutrality;
- owned native character texture disposal (animation owner's positive native tests).

`world/validation/three-brand-independent-dom.test.ts` audits the remaining
procedural guards without changing them wholesale. It uses structural brands to
count objects, then tests constructor identity against the exact namespace used
by bundled main. It verifies actual settlement toon materials, resident triangle
accounting, pacified sentinel fallback color/emissive changes and restoration,
instanced-object disposal, and geometry disposal for approaches, campaign/era/
Valley/False Dawn sites and residents. A persisted pagehide must retain resources;
final and repeated pagehide must dispose each observed geometry exactly once.

This found a separate real lifecycle omission: main had never wired
`settlementNpcs.dispose()` to final pagehide. The before log names
`SettlementResidents/ResidentEyes`, with zero disposal events. The integration
owner added the same final-only hook used by the other authored sites. It is not
an instanceof false negative: all procedural mesh guards accepted these objects.

The twilight fog is positively the bundled Fog constructor. The renderer stub
matches the overridden WebGLRenderer constructor but deliberately lacks GPU
capabilities such as getContext, so ultimate-stage bloom is excluded by its
capability guard. This exclusion must not be 'fixed' to simulate GPU execution.
The fixture deliberately unifies typed-array constructors for GLTF geometry;
normalized color storage has separate decoded-value, mutation-isolation and
native-retention proofs. No browser pixel, bloom, GPU disposal or FPS claim is
made by this audit. Settlement construction light cloning/collider extraction
also retain their existing geometry/route tests; the runtime census alone does
not independently replay every intermediate construction branch.

Numeric runtime census and before/after results are external evidence under
`parhelion-eight-hour-evidence/qa/three-brand-independent-*.log`.
