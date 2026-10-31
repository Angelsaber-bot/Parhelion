# Earned Saber ultimate acceptance — 2026-10-31

## Exact inputs and evidence boundary

- Product: green frozen `67f6a1a65b93daa137f004cf7f4e07241588fe3d`, `/workspace/scratch/218192752ff4/parhelion-checkpoint-67f6a1a/world`.
- Input artifact: `parhelion-eight-hour-evidence/qa/final-earned-ending-67f6a1a.json`, its exact `.saved` string, SHA-256 `54b6e13fe442a5b74b256de303c77e5aeb1210391c13ffd005c756378a9dd346`.
- That earlier genuine journey earned the original gates and False Dawn seal ending. It had **no Saber contract**. Reload starts at the normal production spawn `(3,20.4949741364,159)`, HP100, energy0.
- Driver: `world/validation/journey/earned-saber-ultimate.ts`, SHA-256 `615a6d273b67097715156148c3f47e351e3379188bd2f7a1d98e4aad7c455f75`.

This is a CPU/headless actual-main input test. Known waypoints, live target-position reads and bounded mouse aiming are an explicitly synthetic operator, not human discoverability, reaction, balance, GPU rendering or FPS evidence. The fixture supplies DOM/renderer substitutes and deterministic RAF. It does **not** grant position, grounded state, progression, HP, damage, energy or cooldown. Damage/event observation wrappers forward the original callbacks unchanged. No product source was edited.

## Successful strengthened run

Normal keyboard/mouse controls physically traverse the Valley's West Ford and western seam, then Britain's authored Mistwood route and Sword Lake causeway. Ordinary F at the eligible lake prompt earns `saber_contract`; it is the **only new done flag** in the resulting save. A normal summon/recall key recalls Saber while the rifle builds charge.

Six ordinary enemies are defeated: `wild_56b`, `wild_56`, `wild_3b`, `wild_3`, `wild_4`, `wild_4b`. Further real rifle hits on `wild_5b` earn the remaining charge. Across these fights **34 accepted rifle hits remove 460 HP**, increasing energy from0 to100 through the unchanged production token bucket. The policy then stops firing and leaves that enemy's remaining2HP untouched instead of inflating a target's health.

The operator approaches the next ordinary breaker `wild_5`, summons Saber through the normal key and aims using mouse input. With the enemy naturally at66HP:

- At simulated286.633333s, normal **X** admits Saber's ultimate and pays energy100→0.
- The cinematic visits **intro, charge, release and outro**.
- At294.666667s, one authored strike requests the unchanged138 damage and actually removes **66HP**, killing the live target. This is health-capped damage, not proof of a138HP loss.
- Exactly one ultimate cast and one ultimate strike event occur. Ultimate damage does not recharge itself.
- Director and casting both finish; the private cinematic stage becomes inactive.
- Player position and world-camera position return **exactly** to their pre-cast values before further input. Pointer lock and gameplay action context remain active.
- A subsequent normal mouse event changes yaw, and normal S movement advances the player approximately1.83m, proving controls resumed rather than merely checking a flag.
- Run ends at297.733333 simulated seconds, player HP100, energy0, zero runtime errors and warnings.

The private stage's visual quality remains covered by separate temporal evidence. This test verifies its production lifecycle and native damage ownership, not rendered cinematic pixels.

## Preserved runs and reproduction

Workspace evidence under `parhelion-eight-hour-evidence/qa/`:

- `earned-saber-ultimate-attempt1.{json,log}` and `earned-saber-ultimate-attempt1-driver.ts`: initial successful cast on the2HP charging target, with honestly capped2HP damage. Retained, not overwritten.
- `earned-saber-ultimate-attempt2.{json,log}`: strengthened healthy-target/exact-camera/mouse-input proof described above.
- Attempt2 JSON SHA-256: `cdde48a20c2841770579bcd01c68f8002ebb00bb44a953b70f891819ebb048ab`.
- Attempt2 log SHA-256: `597f359cf2493dd99918e209a3fa28205b2278650299faf8c5afdb3d23d9db20`.

The two separate boots used the shared weight1 admission gate, coordinated with QA's low-duty real-time soak. They completed in44.8s and39.8s wall time respectively; those are harness durations, **not a performance benchmark**. No quiet timing or FPS claim is made. The second boot released its lease at11:21:59UTC.

From `world/`, with a new output path (the driver uses exclusive creation):

```sh
node --import tsx validation/journey/earned-saber-ultimate.ts \
  /workspace/scratch/218192752ff4/parhelion-checkpoint-67f6a1a/world \
  /workspace/scratch/218192752ff4/parhelion-eight-hour-evidence/qa/final-earned-ending-67f6a1a.json \
  /workspace/scratch/218192752ff4/parhelion-eight-hour-evidence/qa/earned-saber-ultimate-new.json
```

This complements, rather than relabels, earlier unit/cinematic fixtures that inject charge or target placement. Only Saber was recruited/cast here; other servants were not force-unlocked or claimed tested by this journey.
