# Honnō-ji bridge apron — real-asset offline review

The production bridge top decodes to Y=4.6019; the original approach was a roughly
0.6 m vertical lip. Its edge could remove capsule ground contact and block jumping
when the player pressed against it. The new single-mesh, 44-triangle timber apron
reaches Y=4.63 before the capsule meets the old lip, then overlaps existing planks.
It adds no lights/textures/shadow casters and does not alter Player physics or map
positions. Material/geometry disposal is idempotent.

`honnoji-before.png` and `honnoji-after.png` use the actual production Kyoto GLB and
exact runtime apron vertices, at the same camera and neutral Blender lighting.
Pixel inspection confirms the apron meets both the road and original bridge with
no visible floating edge or gap; existing rail and gate openings remain intact.
The lighter weathered timber and eight subtle timber courses distinguish the repair.
This is **not a browser screenshot**, shader-parity test or FPS acceptance.

The independent full-five-region fixture tests three lateral walking lines in both
directions at walk and sprint speeds, no jump input, with a 0.25 s final idle settle
for ordinary downhill airborne frames. It checks both original bridge rails and the
closed temple wall away from the gate. The mainline route no longer needs a pre-jump.
All 12 route tests pass; runtime typecheck passes.

Reproduce from `world/`:

```sh
node --import tsx --test validation/era-route-playability.test.ts
node --import tsx validation/traversal-review/export.ts
node validation/kyoto/decode.mjs public/assets/world_kyoto.glb /tmp/kyoto-traversal-decoded.glb
blender -b -t 4 -P validation/traversal-review/render.py -- \
  /tmp/kyoto-traversal-decoded.glb validation/traversal-review/repair-geometry.json \
  validation/traversal-review
```

The initial side-street camera was inside an existing Rakuchu house and produced
black frames. Those were rejected and overwritten after diagnosing the ray hit;
the delivered camera is centered above the open street and shows the complete apron.
