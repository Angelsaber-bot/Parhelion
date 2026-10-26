# Runtime weapon art

This folder contains the 8 final GLBs, byte-for-byte from the authored first collection, plus a **presentation-only** registry. The original Blender/source/preview delivery remains separate; `ART_HANDOFF_中文.md` records that original export's properties, not the current integration status.

- `lumen` → Dawn AR; `corona` → Afterglow Shotgun; `halo` → Meridian DMR.
- `firefly` → Firefly SMG; `longnight` → Longnight Sniper; `blade` → Refract Blade; `polearm` → Meteor Polearm; `hammer` → Faultline Hammer. All eight are playable in the validated two-gun/one-melee loadout (prototype tuning, not competitive validation).
- glTF is +X forward / +Y up; runtime mounts rotate once +90° about Y to point down -Z. Registry positions are original glTF-space cosmetic anchors. Uniform scale/offset fits the existing character and FPS view; no real-world manufacturing scale is implied.
- `muzzle`, `grip`, `support`, `sight` are explicit gameplay-presentation anchor coordinates, not authored skeletal bones.
- 271,476 triangles in the whole collection; loaded only when equipped or individually selected. No embedded textures, skeleton, animation clips or LODs. Detail is intended for desktop first-person use; no mobile FPS guarantee.
- Arena owns a reference-counted geometry pool. Each instance has independent materials and cosmetic magazine/bolt/fore-end poses. Asset-root direct children identify parts, so primitive-child duplicate names are not accidentally animated.
- World loads only Dawn AR and fits its two hand anchors to the existing explorer rig; swimming/gliding still sling the rifle. Shoulder ADS raises the gun and solves the two arms; existing target-hitscan/quest rules remain intact.
- Failed model loads retain the procedural combat model; the gallery shows an explicit retry. Built paths use Vite's fingerprinted relative URLs under each application's own base.

See repository `docs/LOADOUT_CONTROLS_V3.md` for integration, verification and publication limits.
