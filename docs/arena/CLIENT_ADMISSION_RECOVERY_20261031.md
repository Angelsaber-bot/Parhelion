# Arena client admission and disconnect recovery

Cloud-only source/testing changes; no production rooms or public deployment.
Rules v8, packets, match timers, equipment, offline/LAN choices and input bindings
are unchanged.

## Mouse capture

Controls handles Promise rejection, synchronous throws and the legacy void API's
`pointerlockerror` event. A failed request clears held input and exposes the
existing Continue/Leave menu with a truthful mouse-capture notice. Explicit
Continue/canvas retry reuses the same game/session. A stale rejection or error
cannot reopen the menu after successful capture. While capture is pending or
rejected, offline play pauses; online authority continues, as before.

Six actual-main DOM boundary cases cover both modes and all failure channels,
custom held input, stale failure after a newer success, one session and final
exit. Renderer/game/session adapters are explicit; this is not native browser
pointer-lock or GPU evidence. Existing startup tests retain their assertions;
the Game boundary now implements the already-existing setPaused method needed
by initial unlocked-state projection.

## Worker JSON transport

A rejected join now clears handshake/input timers, retires message handlers and
closes the client-owned socket once. Delayed welcome/snapshot/error messages
cannot create an unreachable session after caller rejection. Seven unit cases
cover error, timeout, wrong-version and close paths plus healthy input batching,
rematch and server-close delivery. The original probe reproduced an open socket
after rejected join when peer close was absent/delayed; this is not a claim that
the deployed Worker routinely omits its own close.

## Colyseus/LAN transport

The installed SDK automatically retries abnormal disconnects after sufficient
uptime, but this repository's ArenaRoom removes that player and does not expose
an allowReconnection path. The client now disables unsupported SDK reconnection
as soon as it acquires a room. Explicit Leave is idempotent; closed sessions no
longer send input/rematch or deliver snapshots. A server disconnect is reported
once, rather than silently leaving the UI in a retrying orphan session.

A real installed-SDK/ArenaRoom loopback test waits beyond the default five-second
minimum uptime, terminates the socket, confirms one close notification and server
player removal, and observes zero retries. Repeated Leave is separately checked.
Existing two-transport consecutive-rematch tests still pass. No server reconnect
protocol or matchmaking lease/count redesign was introduced.
