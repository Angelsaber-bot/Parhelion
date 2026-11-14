# Arena online protection (rules v31)

Online authoritative simulation still owns movement, collision, ammunition, damage and cooldowns. The Worker and Colyseus adapters use the same input guard and per-viewer snapshot policy. Offline practice remains local and untrusted.

## Enemy information

Online transports must call `RoomCore.snapshotFor(sessionId, snapshot)`, never broadcast `Match.snapshot()` directly. Capture the full snapshot once per broadcast tick: creating it consumes pending events.

Solid-map line of sight and active smoke determine enemy disclosure. Multiple body samples preserve partial exposure. Teammates and self remain available. Dead observers receive no enemy poses. There is no post-occlusion grace period. The server does not trust a client-provided visibility list or camera direction.

A separate allowlisted roster carries identity, team and scores only. Hidden enemy muzzle/animation events and concealed projectiles/shields are withheld; remote shot endpoints are individually filtered. Own damage and public kill notices still arrive. Smoke volumes are public environmental state. The client hides retained avatar models immediately and avoids interpolating across a period of concealment.

This reduces position-based ESP and hidden-target acquisition. It cannot erase last-known positions, prevent inference from public effects or teammates, or stop image-based aiming at visible enemies. Sampling and network delay can cause reveal delay at cover edges; live corner-peek validation remains a release check. Concealed positional shot sounds/effects are also suppressed rather than exposing exact hidden coordinates.

## Suspicious aim evidence

`AimAudit` observes actual server-processed inputs and fire events. Repeated rapid, highly precise snap-to-head shots can generate a bounded `aim-review` JSON log. Reports include session ID, target ID, server tick, input sequence and angle measurements; they are not sent to opponents. They require review and never automatically ban, kick or alter damage. A single flick or high accuracy alone is not a cheating verdict. This heuristic is not a complete aimbot detector and can produce false positives or miss smoothed/vision-based aim assistance.

Reports are drained to the local server console or Cloudflare Worker logs. They are not an account-level ban system or a durable moderation database. Disconnecting clears that session's detector state.

## Release checks

- Run Arena typecheck and all Arena tests, including real-socket suites.
- Build the site and validate local play, partial cover, smoke, deaths, reappearance and scoreboard rows.
- Commit only reviewed changes; preserve unrelated World work.
- Deploy `parhelion-arena` first, run `test/worker-smoke.ts` against it, then publish `parhelion-game` and verify its version.
- v31 clients require a v31 server. Do not publish only the frontend.

Public play already uses WSS/TLS. Extra payload encryption with a key available to the browser cannot keep enemy data secret from that browser's owner.
