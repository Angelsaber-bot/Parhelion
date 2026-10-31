# Fresh-start journey — 2026-10-31

Run from `world/`:

```sh
node --import tsx validation/journey/fresh-start-walk.ts
```

This CPU/DOM synthetic operator boots the real main module with empty storage and uses keyboard/mouse events plus normal production frames. It does not teleport, write flags, force grounded state, alter health/energy, start encounters directly, or call damage APIs.

Verified chain: initial spawn → residence archivist → Observatory terminal → archivist report → armory pickup → signal keeper → two explicit receiver work choices → physical Valley travel via the original dry West Ford bridge → recorder dialogue → deliberate courier admission → normal rifle-input victory. Original summon-circle/region gate is not granted. The successful run takes about 175 simulated seconds with HP100 remaining; this is **not human reading/completion time**, a usability study, or a balance average. The operator knows waypoints and correct work answers.

Initial route failures were retained rather than hidden: a direct bearing reaches the closed maintenance gate instead of the central garden entrance; walking through the HQ exterior wall is correctly blocked; standing too far toward the resident selects the nearer NPC rather than the receiver. The final route uses actual entrances/roads and approaches the work socket. An earlier successful 187-second variant used ordinary swimming; later inspection found the original elevated West Ford bridge, which the final driver uses without changing geometry. Every frame is checked for zero swimming. Environment follow-up moves the Alpha keeper to the west side of the canopy, with explicit east receiver/dispatch and west resident target/LOS tests. Re-running the same genuine-input journey after this separation passes in about 188 simulated seconds; marker positions and collision remain unchanged.

Evidence is in sibling `parhelion-eight-hour-evidence/journey/fresh-start-dry-ford-final.log`; earlier exploratory logs are retained alongside the task evidence. Rendering remains the explicitly no-GPU fixture. Real WebGL appearance, device FPS, browser permissions and human discoverability are not established by this run.
