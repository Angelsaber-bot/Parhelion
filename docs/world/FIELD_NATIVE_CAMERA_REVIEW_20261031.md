# False Dawn native-camera environment review — 2026-10-31

## Scope and fidelity

`export-native-field-review.ts` boots **production main**, shipped maps, merged static
BVH, current scene materials, quality policy and the actual third-person spring-arm
camera. The 1280×720 / 75° vertical-FOV views are not manually chosen eye cameras.
Each review stance is explicitly placed once, allowed 45 ordinary frames to settle,
then aimed normally. This is a controlled visual setup, not a claimed walkthrough.
Independent normal-input journeys and workstation interactions remain separate proof.

The exporter captures actual geometry, material scalars and caster flags from the
World root. CPU Cycles honors caster flags and exported sun direction, but does not
reproduce WebGL toon/sky shaders, PCF/bias, bloom, texture pixels or frame cost.
Primary camera rays now respect exported FrontSide/BackSide through a transparent
backface shader; indirect lighting remains an approximation. Inverted-hull outline
shells are deliberately excluded, as are actors, weapons and
HUD outside World. Therefore these frames establish architectural framing and static
sightlines, **not hero occlusion or complete gameplay screenshot parity**. Cropped
geometry extends 42 m from each field; the distant horizon is not a map-boundary claim.

## Findings

- Low and normal camera/support/interaction-ray metadata are exactly equal. All
  sampled stances settle grounded, without forced-ground assignment or swimming.
- All three console stances are about 0.90 m from their marker and pass the same
  chest-height static LOS test used by production interaction. Visible front faces
  are not obstructed by shelter posts, canvas or apparatus.
- Alpha's southern emitter is meaningful cover: the sampled camera aim ray hits its
  housing, while a 1.5 m lateral peek clears the target. No cover collision changed.
- Winter's crate blocks the specified target ray; a lateral peek clears the physical
  target ray. Its original approach tree occupies the left frame edge, not the dial
  or brazier. An early double-sided CPU cover frame incorrectly showed the inside
  of its canopy as an opaque ceiling. Runtime FrontSide art rays and corrected
  primary-ray rendering reject that apparent obstruction. The tree was not moved.
- Harbor's crate is **low cover**, not full-height protection from the sampled
  elevated camera ray. The ray passes above its visible top; the lateral peek also
  clears. However, that ray is not identical to the TPS crosshair ray because of
  the shoulder offset: the initial narrow harbor peek still clips the crate on the
  production center ray. Wider stances at harbor `[786,32]` and Winter `[60,-628.5]`
  clear both center physical and front-face visual rays to the target depth. No
  incoming-fire protection or muzzle clearance is inferred from these camera rays.
- Hero mesh ray checks show all three instrument aim points remain visible from the
  actual camera; the lower logical marker point can be covered by the hero's coat/legs
  at the close console stance. That is not a failed interaction: chest-to-marker
  static LOS remains clear and the face/dial target ray is unobstructed.
- The exact combat support-gap stance at
  `[-54.303720415746646, 3.9185068458863785, -105.20407474105565]`
  reproduces its supported feet position. A structural column occupies the right
  portion of the actual TPS frame, while the central aim ray to the reported Warden
  target is clear. The 3.77 mm transient grounded gap is a controller-support issue,
  not evidence for moving/removing this architecture. Environment collision is untouched.
- Turning directly away while still at a console can put its back or shelter frame
  in the near foreground of the spring-arm view. The actual-input exit segments
  below move clear normally; no extra exit sign, moved prop or collision exemption
  is justified by these sampled views. Narrative review also found the existing
  tracked target and West Ford prose sufficient, not a need for decorative signs.
- Low exports contain zero field casters; normal contains two. Alpha changes from
  21 to 22 cropped meshes due to the approved noncasting-ground split; triangle
  counts remain 11,080. Harbor remains 27 meshes / 14,678 triangles; Winter remains
  24 / 8,666. These counts include nearby original map art, not only new structures.

## Ordinary-input local movement

`audit-field-local-input.ts` independently places each segment's start once, settles
normal physics, then uses mouse orientation + W only through production RAF.
All six console→entry / cover→wider-peek segments pass, with no jump, swimming,
forced-ground assignment, progress write, health write or defeat. Durations:
Alpha exit 3.85 s / peek 0.92 s; Harbor exit 1.93 s / peek 1.33 s;
Winter exit 2.27 s / peek 1.62 s. All endpoints are grounded.

Alpha's downhill exit records 111 transient airborne frames despite uninterrupted
normal walking; other segments record zero. This is reported to the controller/combat
owner, **not** hidden by a geometry change or described as continuously grounded.
It is consistent with the separate support-continuity diagnosis. These are six
independent local segments, not a complete unbroken journey from a fresh save.

## Evidence and reproduction

Heavy outputs are in sibling `parhelion-eight-hour-evidence/environment/`:

- `native-field-final/{low,med}/meshes/{region}.json`: camera, feet, ray results,
  actual material/caster metadata and limitations.
- `native-field-final/{low,med}/renders/{region}-{entry,console,exit}.png`: same-camera
  quality comparisons. Normal also has `cover`, `peek`, remote `peek-wide`, and Alpha `support`.
- `native-field-final/quality-parity.json`: repeatable scalar audit, 18 poses.
- `native-field-final/local-input.json`: actual-main six-segment input/feet audit.
- `native-field-review/` and `native-field-exit/`: retained earlier inputs/images,
  superseded for final visibility acceptance because their CPU renderer exposed
  backfaces. `native-field-frontside/` isolates the Winter correction.

From `world/`:

```sh
node --import tsx validation/environment-eight-hour/export-native-field-review.ts OUT/low/meshes low
node --import tsx validation/environment-eight-hour/export-native-field-review.ts OUT/med/meshes med
node --import tsx validation/environment-eight-hour/audit-native-field-review.ts OUT
node --import tsx validation/environment-eight-hour/audit-field-local-input.ts OUT
python ../../parhelion-eight-hour-evidence/render_budget.py --weight 1 \
  --tag environment-native-review -- blender -b -t 2 \
  -P validation/environment-eight-hour/render-fields.py -- \
  OUT/med/meshes OUT/med/renders entry,console,cover,peek,peek-wide,support,exit alpha,blacksail,winter runtime
```

No production geometry, collider, quest state, spawn rule or camera behavior was
changed by this review. Do not interpret a CPU lighting difference as proof that
runtime materials need recoloring.
