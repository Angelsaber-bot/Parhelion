# Enemy contact upgrade — first cloud slice

## Changes
- The simulation emits one immutable `attackContact` snapshot per completed tell. Presentation no longer infers gunshots from a generic windup→recover transition; phase breaks, canceled casts and deaths cannot produce false shots.
- A reproduced lethal-contact bug reset enemies and then accidentally overwrote the attacker into recovery within the same tick. Defeat now terminates that tick immediately, preserving the reset for every actor.
- Native enemy attack playback is sampled from the simulation timer. The last 200 ms of the existing tell contains the forward stroke, with the contact pose already reached when damage resolves. Recovery contains follow-through rather than starting a late attack. Late model loading, LOD switches and paused frames seek the same pose.
- Four native sword kits receive clone-only, bind-aware upper-body acting, calibrated against their actual held-blade vertices. Source clips, root motion, feet, colliders, statistics and hit footprints are unchanged. Restoring the previous overlay before mixer evaluation prevents repeat/paused-pose accumulation.
- Ordinary attackers try at most three terrain-authorized local walk candidates around a small obstruction. Musketeers/bombardiers get a bounded 0.65 s reposition opportunity after recovery, then commit again; they cannot endlessly flee or slide during a tell/punish window.
- At most two ordinary near-player tells overlap. Authored boss/elite rhythms are not delayed; later members of a six-actor pack still get repeated turns. No new enemy population or HP/damage inflation.

## Evidence and limits

Focused tests cover actual native GLBs, exact pose sampling, immutable template rigs, held-blade direction, soles, repeated paused frames, death, cancellation, cover, bounded movement, leash, pack fairness, existing boss patterns and combat invariants. TypeScript checks passed in the working tree.

`world/validation/enemy-review/export-contact-sequence.ts` exports six temporal samples using the production `EnemyVisuals` implementation. CPU-skinned snapshots were rendered with original GLB materials using Blender Cycles CPU. Initial images revealed the native samurai blade still pointed down at supposed impact; the bind-aware acting update corrects that. The first still sequences are in ignored `artifacts/enemy-contact-acting-v2-renders/`. These are offline temporal pose evidence, **not** a WebGL capture, live playthrough, measured GPU draw count or FPS claim.

Further per-kit differentiation, cosmetic integration and full regression remain active work for the eight-hour overhaul. No Arena server/network rules, publication, deployment or user-computer actions are part of this change.
