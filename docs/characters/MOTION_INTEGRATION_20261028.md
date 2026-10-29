# Character motion update — 2026-10-28

## Changes

- Saber armor and civilian walking retain the original published Idle upper-body
  pose and sword direction; the lower body walks naturally. Idle breathing keeps
  its own clock rather than speeding up with the footsteps.
- Correct hero elbow bending and wrist/forearm alignment while preserving weapon
  anchors, first-shot behavior and attack timing.
- Improve hero and Musashi locomotion, companion transitions, Arena avatar
  grounded movement and first-person weapon motion.
- Keep all newer chapter lighting, collision, map, UI and site changes from
  `02059bc4c0895be51f5e33d9ff023d27105d3a96` intact.

## Validation

The merged version passed World **422 tests**, Arena **309 tests**, and site
**13 tests**. World/Arena typechecks and production builds and the whole-site
build passed. This commit does not deploy a website or update a desktop.

Actual model comparison sheets:

- [Hero elbows](../idle-carry-elbow-correction-20261028/hero-elbow-candidate-review.jpg)
- [Hero gait side view](../idle-carry-elbow-correction-20261028/hero-elbow-cycle-side.jpg)
- [Saber armor Idle versus Walk](../idle-carry-elbow-correction-20261028/saber-armor-published-idle-vs-walk.jpg)
- [Saber civilian Idle versus Walk](../idle-carry-elbow-correction-20261028/saber-civilian-published-idle-vs-walk.jpg)
- [Musashi movement](../character-motion-20261028/musashi-walk-before-after.jpg)
- [Arena movement](../character-motion-20261028/arena-motion-before-after.jpg)

These are offline CPU-skinned renders of actual game geometry/materials, not
WebGL gameplay captures or measured FPS results. Open fingers, compressed ADS
and inherited Saber sword-tip ground penetration remain known limitations. The
accepted pose has not been altered to hide them.

Only release-relevant source, tests, comparison images and this summary are
published. Raw execution logs and historical working reports are not included.
