# Miyamoto Musashi — reference-led game asset

Unofficial, editable reconstruction of the supplied FGO Musashi design. **This is not an extracted official model or a claim of exact reproduction.** The face, tuft, neckline and unseen rear construction retain interpretation; compare the actual renders before approving likeness.

## Deliverables

| File | Purpose |
|---|---|
| `Musashi_Editable.blend` | Individually editable authored parts, packed face texture, skeleton, four animation actions and 56 facial morphs |
| `Musashi_Runtime.glb` | Consolidated, skinned high-detail game asset |
| `Musashi_Runtime_LOD1.glb` | Reduced geometry variant with the same rig, clips and facial morphs |
| `Musashi_Reference_Presentation.blend` | Editable shoulder-sword / low-sword presentation pose |
| `Musashi_ReferencePose.glb` | Static, already-posed preview; no animation autoplay required; not the gameplay asset |
| `renders/` | Actual Blender model renders, animation samples and GLB round-trip renders |
| `qa/validation-summary.json` | Final Three.js deformation, loop, stance and transition checks |

## Runtime contract

- Metre scale: anatomical head height approximately **1.67 m**; hair extends higher.
- glTF **+Y up, +Z forward**. Start `Idle` immediately; the bind pose is a T-pose.
- Actions: `Idle` 3.0 s, `Walk` 1.0667 s, `Run` 0.6667 s, `Attack` 1.6 s.
- `Idle`, `Walk`, `Run` loop. `Attack` is a two-sword combo and returns to the idle pose.
- Locomotion is **in place**, not root motion. Nominal movement speeds: Walk **0.7488 m/s**, Run **2.0016 m/s**. See `qa/animation-metadata.json` for stance phase and contact timing.
- Two explicit attachment nodes: `Attachment_LeftHand_Katana`, `Attachment_RightHand_Katana`. Both swords are rigid-skinned to their corresponding hand bones. Editable source retains separate weapon components.
- 65-bone Mixamo-named skeleton, normalized maximum four influences per vertex.
- 56 facial morph targets. Eight semantic names were verified with actual one-hot renders: `Angry`, `Surprised`, `Blink`, `BlinkRight`, `BlinkLeft`, `HappyEyes`, `HideIrises`, `MouthOpenA`. The remaining source targets retain generic names.
- Cloth and hair are skinned, **not physics simulated**. There are no Blender-only live animation constraints required by the GLBs.

## Verification boundary

Actual GLBs are tested with Three.js `GLTFLoader`, `AnimationMixer` and deformed `SkinnedMesh.getVertexPosition` samples, including six crossfades. Node texture loading is stubbed for that CPU geometry test; this is **not a browser/GPU test**. Blender imports and renders the exported GLBs separately to check material/geometry round-trip appearance. Procedural textile micro-bump is omitted from runtime PBR; the editable source retains it.

## Source and rights

Only the licensed mastjie-authored base anatomy, facial topology/texture layout/morphs and skeleton are reused. The kimono, obi, gloves/stockings, heels, hair, ribbon, ornaments, two katana and scabbards are authored for this reconstruction. See `reference/PROVENANCE.md` and the verbatim `BASE-CREATOR-TERMS.txt`.

The base creator allows modification and redistribution. **Those terms do not grant TYPE-MOON / FGO character-IP rights or make this an officially licensed commercial asset.**

## Authoring / QA scripts

Delivered `.blend` and `.glb` files are self-contained; no source download is needed to open them. Generator scripts target Blender 4.3 and locate this asset directory relative to `__file__`. Regeneration additionally requires the licensed base import: set `MUSASHI_BASE_BLEND` to its `.blend` path. This is not downloaded automatically. Three.js QA scripts use the project's installed Three package, or `PARHELION_THREE_ROOT` can point to another compatible installed `three` package.

`.glb.gz` files are deterministic gzip transport copies; decompress them before loading unless the server correctly serves `Content-Encoding: gzip`.

The editable construction scenes retain the source working scale; the runtime/export root applies a uniform 0.72 conversion. Exported GLBs are already metre-scaled—do not apply that conversion again.
