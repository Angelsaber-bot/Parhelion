# Branch scene consistency — 2026-10-31

## Structural result

`validation/environment-eight-hour/audit-branch-scene-consistency.ts` boots actual
main four times: low/normal × all five chronicles' first/second saved choices,
paired with harbor/repurpose and winter/seal False Dawn endings. These are explicit
preboot save fixtures, not a claim that this audit played the quests.

- Fresh boots restore the intended single branch and completion plaques. Sealed
  emitters remain dark; repurposed accepted circuits restore. Unchosen remote
  station does not gain a resolved plaque.
- Forty direct visual projections per boot alternate choices without allocating
  replacements or moving mesh matrices/position data/colliders. This is projection
  stress, not quest completion. Actual R reset restores dormant/hidden state.
- Fifty low-quality / 51 normal-quality site meshes: the expected extra normal
  split-ground batch, not duplicated props. Names are unique within each site;
  shared layer names in different site roots are intentional. Each campaign socket
  has exactly one resident at its authored XZ position.
- Branch/world bounds and collision hashes match exactly across quality. Near/far
  site root visibility follows local update gates without altering branch flags.
- 291 unrelated old material signatures and 3,266 normalized-byte color attribute
  references remain unchanged during projection. Decoded color samples are finite
  and in range. The audit uses attribute getters rather than treating normalized
  bytes as linear float values. New geometry/material object identity also survives
  reset; authoritative collision data remains exact.

No product defect was reproduced, so no scenery/material/physics change was made.

## Placement review and limits

Existing source support relationships remain unchanged: radio pennants meet the
antenna assembly; Britain record strips attach to the board and folding seats have
crossed legs; harbor colored shutters overlay the mast shutters; Winter blanket
and travel straps sit on the existing cot; Kyoto archival cases/mats meet local
floor height. Prior accepted images show their scene context. Bounded transforms
and unchanged geometry establish no state-induced displacement or duplication;
this is not an exhaustive pixel-level proof against every apparent floating edge.

NPC identity/placement is checked, not every animated limb contact. Actual GPU
shaders, textures, PCF shadows, HUD occlusion, FPS and full interactive quest paths
are outside this structural audit. Independent genuine-input quest QA remains the
source for gameplay completion. A direct state projection is explicitly not a
replacement for that QA.

## Evidence and reproduction

Evidence lives under sibling `parhelion-eight-hour-evidence/environment/`:

- `branch-consistency/branch-scene-consistency.json`: all four boot results, branch
  bounds and collision digests; `branch-consistency-final.log` records execution.
- `final-preview-selected/index.html`: five clearly labeled accepted offline images,
  copied byte-for-byte with SHA256/source manifest. No new renders or publication.
  The larger `final-preview-gallery/` is retained internal evidence, not the selected
  user-facing set. Noisy tavern ceiling frames remain in their dedicated repair
  evidence rather than being presented as polished final game screenshots.

```sh
cd world
node --import tsx validation/environment-eight-hour/audit-branch-scene-consistency.ts OUTPUT
python validation/environment-eight-hour/assemble-preview-gallery.py EVIDENCE_ENVIRONMENT OUTPUT_GALLERY
```
