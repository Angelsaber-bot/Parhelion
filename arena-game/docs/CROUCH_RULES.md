# Arena crouch / protocol v2

Crouch is a server-authoritative stance, not a camera-only effect. The keyboard/mouse binding is a client setting; the wire action is the held bit `BTN.CROUCH = 32`.

- Standing retains the map's existing height/eye and character speed. Crouching uses a 1.20 m hull, 1.05 m eye and 55% movement speed. Radius stays the map radius.
- Releasing crouch stands only when the full standing footprint/hull fits. Low roofs and steps below them cannot push the head into the ceiling. Jumping keeps existing jump/gravity rules, using the actual stance height.
- Crouch cancels an existing dash and prevents starting one while crouched; horizontal velocity is capped even in the air, so a player cannot carry full dash speed through a low tunnel. Dash cooldown is not refunded.
- The crouch hitbox has head centre 1.00 m/radius 0.18 m, body bottom/top 0.18/0.85 m and body radius 0.30 m. Damage, magazines, firing intervals and accuracy are unchanged.
- Shooting uses the authoritative stance eye. Player snapshots, prediction/replay and lag-compensation history retain `crouched`. Bots use the target's shorter head/body heights. Respawn initializes standing with cleared previous button edges.

## Coordinated online upgrade (not deployed by this patch)

`rulesVersion = 2` is added to online join options, welcome and snapshots. Both Colyseus and the Cloudflare Worker check it. The client waits for a matching welcome before starting prediction, and refuses missing/old versions. Worker matchmaking includes the version in its key.

This intentionally refuses mixed old/new clients and servers: the previous server sanitizes buttons to 0–31 and cannot simulate bit 32 or the smaller hitbox. Publish the matching client and server together only after explicit deployment authorization. The old public server has **not** been changed by this local integration; no production matchmaking was probed.

## Validation

`npm test` includes low-roof/step/jump safety, speed, dash exclusion, replay, hit volumes, rewound stance, respawn, input sanitization, RoomCore JSON snapshots, real Colyseus crouch/release, both directions of old-version rejection, and real WebSocket JSON transport using the same RoomCore as the Worker. `npm run typecheck` checks both client/server and Worker TS projects.

The real Cloudflare Durable Object runtime is a separate verification boundary. In this cloud sandbox, `wrangler dev --local` failed before startup with `uv_interface_addresses returned Unknown system error 1`. The updated `test/worker-smoke.ts` is ready to run against an authorized local/updated Worker; this is not claimed as a passing DO runtime test.
