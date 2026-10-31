# Final gameplay and lifecycle acceptance — 2026-10-31

## Exact accepted source

`67f6a1a65b93daa137f004cf7f4e07241588fe3d`, isolated checkout `parhelion-checkpoint-67f6a1a`. Independent before/after inspection found all 1,676 tracked files / 614,542,310 bytes unchanged. The integration owner separately ran the complete configured test/type/build gate.

## Fresh progression, continuation and ending

The three drivers shipped in that exact checkout were rerun without runtime adapters:

- `validation/journey/fresh-mainline-continuation.ts`: empty storage and normal spawn through original onboarding, equipment, receiver, dry ford, courier, six targets, two relays, original tower climb, all four physical seams and summon. 981.516667 **simulated** seconds, HP 100, earned energy 14.52, 753 swimming frames, 25 earned flags, no captured errors.
- `validation/journey/earned-harbor-continuation.ts --ending`: reload precisely those earned save bytes at normal spawn, walk to first BlackSail discovery, normal-input harbor fight and key, actual unlocked travel UI back to Alpha, physical array and emitters, normal-input Warden victory, seal ending. 309.25 simulated seconds, HP 100, energy 100, 37 flags / 3 discoveries, no captured errors.
- `validation/journey/verify-earned-ending-reload.ts`: reload final exact bytes, retain complete/seal state and all flags/discoveries, no restarted encounter. Normal spawn `(3,20.494974,159)`, HP 100, energy 0 (temporary combat energy is not persisted).

The intermediate save SHA-256 is `a0a7d55bb67a5a360f5eba1bedb96601df27ea155495436f4d822b06402d4520`; final save is `54b6e13fe442a5b74b256de303c77e5aeb1210391c13ffd005c756378a9dd346`. Both reproduce the earlier accepted original-route proof exactly.

No teleports, constructed progress, forced grounding, HP/energy gifts, direct damage calls or hostile-HP edits were used in these runs. The operator knows authored waypoints, answers and combat policy; this is **not** human discoverability, elapsed human playtime or GPU evidence. Normal save/reload is an explicit continuity checkpoint, not a continuous uninterrupted walk. The rejected optional tower ramp remains absent; original staged jump/glider/perch traversal is retained.

Evidence outside git: `qa/final-fresh-67f6a1a.*`, `qa/final-earned-ending-67f6a1a.*`, `qa/final-earned-reload-67f6a1a.*`.

## Twenty-cycle lifecycle stress

External QA harness `validation/lifecycle-review/run-long-session.ts` exercised the same frozen runtime: 20 measured cycles across four boots after warming all five regions and both outfits, with ten repeated state baselines. Synthetic legacy unlocks are explicit setup for this **separate** stress test; they are not the fresh journey above.

Normal configured travel input opens the actual panel; each destination click causes exactly one teleport and no healing. Ordinary pause/resume, settings outfit swaps, summon/recall, insufficient-charge ultimate rejection, autosave and exact storage reload retain progress and presentation state. No energy, HP or grounding writes are used.

Results: all 20 cycles pass; 231 connected DOM/window listeners remain stable. Scene, geometry, material and texture counts plateau by region/outfit. 780 replaced native geometry/material resources dispose exactly once. Contact cues remain three slots / 55,296 bytes and inactive at the observation boundary. The new player terrain cache stays bounded at 512 triangles / 53,248 bytes, 32 collider snapshot entries, two support planes and 40 bytes of height scratch. No stuck modal, duplicate command callback or lost progress was observed.

The ultimate checks here deliberately do **not** claim paid-cast coverage: energy was insufficient and normal rejection was asserted. Separate native paid-cast/context interruption tests cover those paths. Connected listener census is not exhaustive JavaScript/native heap reachability; no raw heap dump is needed or distributed.

Evidence: `qa/final-lifecycle-67f6a1a.{json,log}`. This updated external harness is versioned separately from the frozen product source. No hours-of-play or device frame-rate claim follows from accelerated cycles.
