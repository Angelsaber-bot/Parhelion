# Offline pose static-payload identity audit

An independent positive regression found a **verification-tool defect**, not a
runtime game defect. The compact exporter keyed UV/color/index payloads by
visible traversal slot. When an earlier mesh became hidden, a later plane could
reuse a box's static bytes: **720 bytes instead of the required 120**.
`runtime-pose-static-identity-independent.test.ts` captures that exact case.

The animation owner replaced slot-only sharing with stable mesh identity and
geometry/attribute identity/version signatures, using monotonic payload IDs.
The independent repro now passes; old inputs remain untouched. Native UV1 data
is separately exported without changing old uv0/color/index offsets. Corrected
player previews restore the face atlas; earlier UV0-only player material views
are not evidence of a runtime dark-face defect.

Read-only census command:

```
python world/validation/characters/audit-runtime-pose-static-layout.py \
  <evidence-root> <output-json>
```

At the reviewed snapshot: **30 directories, 1,890 frames, 52,156 mesh entries**.
All **221** byte-layout/signature issues were confined to historical
`animation/saber-wrist16-candidate-poses`. Those rejected mixed-outfit render
inputs must not be used as valid clearance pixels. Any numeric source-geometry
measurements require their own separate provenance.

Accepted Saber30fps/Winter/Britain, current ADS and all three grounded era
servant directories pass this census. This does **not** prove every UV/color
component, source shader equivalence or GPU pixels; it establishes static byte
length and stable name/count/index/group consistency. Fixed-layout historical
sequences are not blanket-invalidated by the synthetic visibility bug.

Workspace evidence: `qa/pose-static-identity-independent-{before,after}.log`,
retained tiny `qa/pose-static-identity-*` payloads, and
`qa/pose-static-layout-census.json`. Old renders and failed proof remain retained.
