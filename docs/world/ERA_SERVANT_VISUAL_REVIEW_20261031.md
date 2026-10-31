# Native era servant visual review — 2026-10-31

## Result

No attachment, missing-material, scale/root or stuck-return defect was reproduced
in the representative Musashi, Blackbeard and mounted Napoleon samples. Existing
models and motion are retained unchanged. Animation owner coordinated the review;
the only shared renderer change (`653c2b7`) is optional **camera-only** yaw framing,
with unchanged default behavior. It does not rotate exported vertices or actors.

Actual production main supplied four poses per servant: settled idle, ordinary
keyboard-follow, first ordinary attack damage contact, and settled return after an
accepted ultimate. All three resume changing idle bone transforms afterward.

| Native actor | Meshes / materials | Triangles | Actual ultimate damage in fixture |
|---|---:|---:|---:|
| Musashi | 15 / 15 | 205,252 | 156 |
| Blackbeard | 27 / 25 | 402,274 | 144 |
| Mounted Napoleon | 31 / 28 | 349,738 | 155 |

All sampled CPU-deformed vertices and material scalars are finite. Actor root scale,
scene parent, mesh/material object identities and weapon socket parent/local offsets
remain stable (1e-5 m tolerance for authored animation float noise). Root-relative
minimum mesh Y is approximately zero, within 1 mm in these samples. Napoleon's
seat–saddle distance remains 0.015 m and saber grip–tip distance about 1.02505 m.
These are sampled geometric checks, not an assertion that every animated frame is
collision-free or that every foot is perfectly planted throughout locomotion.

## Actual pixel observations

- Musashi: both native blades stay in their hands; lowered carry, moving legs,
  attack pose and returned idle remain distinguishable. No detached weapon or
  missing clothing/material surface is visible in sampled views.
- Blackbeard: pistol follows the right hand from lowered carry to moving ready and
  firing pose, then returns; skin, straps, boots and metallic details remain assigned.
- Napoleon: rider remains seated on the native horse; saber changes from upright
  carry to crossing strike and back, with horse leg motion present. No rider-scale
  jump, detached saber or persistent attack pose is visible.

All 12 initial pose frames were inspected. Corrected local-terrain follow/contact/
return frames were also inspected for support context. These are **offline CPU
renders of actual runtime poses**, using original GLB materials and a neutral
local collision-surface floor. Review camera is orthographic with camera-only yaw
following actor orientation; it is not the gameplay TPS camera. Lighting, shadows,
bitmap upload and shaders are not a live GPU/FPS acceptance test. Small 640 px,
8-sample frames retain visible sampling noise; no denoising or retouch was applied.

## Explicit fixture boundaries

`validation/environment-eight-hour/audit-era-servant-poses.ts` boots real main and
uses its native loaded actors, scene, collider navigation, ordinary attack contacts
and ultimate handlers. It explicitly recruits the roster, sets a supported player
start, isolates a recovering high-HP target, and sets ultimate meter to 100. It does
not claim natural quest acquisition, meter charging or general combat balance.
Follow uses ordinary W input; no actor bone, pose, scale or root writes are made.
The target/meter fixtures do not replace independent genuine-input combat QA.

The first preview exporter omitted nearby collision triangles: its generic studio
plane stayed at world origin while actors were near X=-940, so no floor was visible.
That was an **evidence setup limitation**, not floating game geometry. Corrected
exports include actual nearby collision triangles without changing actor poses.
Earlier pose-only frames are retained, not used as floor-contact proof.

## Evidence and reproduction

Sibling `parhelion-eight-hour-evidence/environment/`:

- `era-servant-grounded/audit.json`: native asset hashes, actor/socket/bounds records,
  exact sampled damage and retained identity checks.
- `era-servant-grounded/{musashi,blackbeard,napoleon}/renders/`: final four-frame sets,
  filenames `{id}-{idle,follow,attack-contact,ultimate-return}.png`.
- `era-servant-grounded/render-player-acting-review-frozen.py`: renderer frozen from
  `653c2b7`, avoiding concurrent ADS overlay changes in another worker's tool.
- `era-servant-grounded-render.log`: sequential one-token admission/exit records.
- `era-servant-review-final/`: earlier pose-only images; valid for pose inspection,
  superseded for visible floor support. `era-servant-review/` is the shorter follow
  sample; the final follow sample uses 90 ordinary input frames.

```sh
cd world
node --import tsx validation/environment-eight-hour/audit-era-servant-poses.ts OUTPUT
```

Use the shared render admission wrapper (weight 1) and
`validation/characters/render-player-acting-review.py` separately for each actor
folder. Never mix actors' shared topology buffers in one exporter directory. No
public upload, deployment, local Work or character asset modification occurred.
