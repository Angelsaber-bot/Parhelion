# Blackbeard captain — project remaster revision 2

This is a new runtime GLB derivative of the existing project model, not an official game asset or a downloaded replacement. Existing provenance and rights boundaries remain in [../SOURCE_AND_LICENSE.md](../SOURCE_AND_LICENSE.md); this revision adds no external asset source or blanket license claim.

Project-authored changes: rest-mesh facial/hair refinement, bone-bound tailored clothing, revised material finish, and baked idle, walk, run and attack acting. Blackbeard retains his flintlock and gains a permanent tricorn/naval coat; Napoleon retains the white horse and long cavalry saber, with mantle and fitted horse breast crest. No firearm is added to Napoleon (the horse skeleton's `Cannon` bones are anatomical lower-leg names).

All original embedded texture images are retained byte-for-byte. Original source GLBs are unchanged. Manifest records source/output hashes, image hashes, animation durations and sizes; gzip decompresses exactly to its paired GLB. Combat contacts, costs, navigation, hitboxes and save identifiers are not changed by these assets.

Rebuild from repository root: `cd world && node --import tsx validation/characters/build-captain-cavalry-remaster.ts`. Editable implementation is the original GLB plus `captainCavalrySculpt.ts`, `captainCavalryArt.ts` and `captainCavalryClip.ts`; this exporter does not claim a newly authored native Blender project. Private-clone ultimate acting/camera and bounded stage art are separate source modules and cannot cause damage.

Validation: `node --import tsx --test validation/captain-cavalry-model.test.ts validation/captain-cavalry-remaster.test.ts`. CPU model previews and actual stage snapshots are geometry/material evidence, not browser GPU or FPS certification. Full-motion intersection-free claims require temporal inspection, not one contact frame.
