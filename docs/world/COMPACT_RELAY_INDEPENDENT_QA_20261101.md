# Compact relay — independent QA

This is CPU-only production-main/input and numerical testing, not a human fun study, texture/render acceptance, device FPS or browser GPU proof. The synthetic operator knows authored waypoints and combat tells. The scripts never grant player HP/energy, change enemy HP through damage hooks, force grounding or fabricate progress; the separately labeled event-order unit fixture does inject damage and placement.

## Real input routes

`world/validation/compact-relay-review/fresh-yard.ts OUTPUT.json clear|retain-gunner|pressure` boots empty storage and performs the original archivist/terminal/report/equipment interactions before walking into the yard. The script records source hashes and rejects runtime-byte drift.

- **Clear:** approaching breaker is shot normally; the player walks the northern maintenance route onto the raised firing platform, obtains a genuine line to the musketeer and clears it. Killing both alone does not complete training. Holding Interact at the cabinet for three seconds does. First successful run: 117.37 simulated seconds including onboarding, HP 100.
- **Retain gunner:** kill the approaching breaker normally, take the short covered path and connect with the 66-HP musketeer still alive. Completion withdraws it rather than recording a kill. First successful run: 94.42 simulated seconds including onboarding, HP 100. This is **not a zero-kill route**.
- **Pressure diagnostic:** do not shoot first; walk to the cabinet and observe eight seconds. The breaker chases, winds up and lands two real sweeps, reducing HP 100→60 and clearing channel progress. Completion remains absent. This demonstrates a real threat at the objective, not that every approach is difficult.

The entrance itself is a safe preparation position in the tested policy: a retained earlier 60-second stationary attempt killed the breaker but could not hit the musketeer behind the baffle, and took no damage. That timeout is not a full-clear pass, nor proof of broken AI. Deliberate relocation to the platform resolved the blocked firing angle.

## Retained failures and fixes

1. The first operator route went straight west from the armory rack through its original central workbench. The route was corrected around that table, without modifying old collision.
2. A real product admission failure then prevented starting: the new musketeer socket fell inside the original hub spawn exclusion. Both fresh play and an actual-main fixture reproduced the blocked-spawn toast. Integration added a narrowly scoped placement path for the exact authored sockets/encounter; ordinary spawn rules remain separately guarded.
3. Early admission observation records accidentally retained a mutable `player.pos` reference. Their `admission.position` is not accepted as start-position evidence; independent `entry`/`started` snapshots are. The final script copies it immediately. Early successful runs hashed nine relevant source files; final scripts also include combatTerrain/combatView, and final frozen-source verification remains required.

## Durable regression gates

- `compact-relay-independent.test.ts`: three-second channel at 30/60/120 Hz; held-entry/repeat reward protection; hurt, movement, attack, invalid state and range interruption before completion; explicit release before restart; invalid/background delta and reset.
- `compact-relay-runtime-independent.test.ts`: all kills are not completion; living-patrol withdrawal; leash after clear; legacy progress preservation; one reward across replay; stale callbacks and reload; failed-save warning; explicit deployment and active-replay/stale-selection rejection.
- `compact-relay-main-independent.test.ts`: explicitly preloaded armory ownership, supported placement and injected kill/hurt fixtures. Verifies wheel-only admission refusal, real key retry, pending onHurt drainage before the completion frame, pause/resume, no held auto-retry, saved completion, deployment/double-click and Arena-link save-failure handling. Navigation is intercepted in this CPU test; it does not claim actual tab loading or online Arena play.
- `compact-relay-review/earned-reload-deploy.ts EARNED_REPORT.json OUTPUT.json`: reuses exact prior synthetic save bytes at normal spawn, walks to the deployment board, invokes real permitted travel and walks through the original outpost entrance. It does not construct an earned save or grant Relay B.

The gameplay slice offers two verified solutions with different movement/line-of-sight choices and a useful deployment unlock. Automated completion and resource/state correctness do not establish whether the user finds it engaging. No old brightness/companion/Arena runtime change is needed for these tests.

## Closing current-source evidence

On runtime `0ddd4aa3d5f15a91fc6b7faaf371ce684305ff09`, the actual-main boundary fixture passes including a deliberately injected active hostile at the new destination: travel is rejected, then restoring the original enemy state permits a new explicit confirmation. This is a safety fault fixture, not genuine combat. The original five settlement rules are unchanged.

The earned `retain-gunner` snapshot SHA256 `5a55a2038a827c6bb91444ea3c9009d1e40e0d5db662300859ecbf98300e6ad7` was reloaded at normal spawn. In 70.37 simulated seconds the operator walked to the unlocked board, chose deployment, settled at the approved outpost gate and walked inside normally. HP stayed 100; old `relay_b` remained absent. All eleven captured runtime source hashes were unchanged over this replay. No current-session training or partial hold was restored.

A native-root trajectory check found the pressure-probe breaker remained outside the decorative cabinet's XZ box (owner measured closest root distance 1.5393m). This is not dense body/weapon intersection proof and no unsupported claim of zero clipping is made.

External JSON/logs retain both failed attempts and successful runs. Final full-suite/frozen-source hashes are recorded separately by integration and independent QA; the focused results above must not be substituted for that gate.
