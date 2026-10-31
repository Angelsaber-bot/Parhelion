# Musashi private-stage continuity candidate

Retains the remaster model, live actor, phase durations, native contact clocks,
root transform and weapon socket locals. This is a private X presentation change,
not a damage, movement or physics change.

- Alternating intro placement and outro recovery replace overlapping placement
  and flat-foot return. Each recovery step lifts 40 mm. Reduced effects retains
  the captured stance instead of compressing two steps into its short phases.
- Anatomical leg-reach support uses bounded world-down pelvis correction, not
  bone scaling. Native test maximum extra correction: 34.990 mm. Low-height
  recovery displacement: left 9.817 mm, right 14.109 mm.
- Active hand contact and both hands at the third contact retain the historical
  strict 20 micrometre positional tolerance. The explicitly approved inactive
  guard hand allowance is 15 mm. Root/socket/bone identity checks remain exact.
- Third-cut followthrough and preparation separate the two blade paths and
  withdraw them successively rather than holding a wide crossed tableau.
  The historical performance fixture remains available and explicitly tested.
- The shared portrait/windup boundary and local framing now interpolate.
  The former non-contact 1.354 m single-frame camera cut is removed; measured
  maximum within-phase 60 Hz camera movement is 0.222 m. Deliberate strike cuts
  remain. Epsilon continuity and deterministic repeated evaluation are tested.

Native solid-blade audit: 446 samples at 60 Hz, 1,152 triangles per blade;
legacy 12 intersection samples, candidate zero. This is sampled geometry, not
continuous collision proof or gameplay hit validation. Focused native tests:
15 passed. Full video and independent actual Q/X review are separate acceptance
steps; these numerical results alone do not establish visual acceptance.

Evidence is outside the repository in the sibling three-animation evidence
folder. `musashi/baseline-full-x` contains the complete old 223-frame/30 fps
cycle; `musashi/candidate-full-x` is the new complete-cycle review target.
CPU previews use original native geometry/materials but do not reproduce
WebGL bloom, additive blending, fog or GPU performance.
