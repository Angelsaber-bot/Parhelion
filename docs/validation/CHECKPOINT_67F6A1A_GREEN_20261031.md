# Final-candidate checkpoint 67f6a1a — green

Exact source: `67f6a1a65b93daa137f004cf7f4e07241588fe3d`.
Independent before/after verification: **1,676 tracked files / 614,542,310 bytes**,
zero drift. Aggregate completed on 2026-10-31 before 10:59:28 UTC.

| Gate | Result |
|---|---|
| Configured World source/tool types | Pass |
| World tests | 1,595 / 1,595 |
| Arena tests | 351 / 351 |
| Unified World/Arena/Worker/site build | Pass |
| Site tests after build | 13 / 13 |
| Additional frozen Arena startup/menu/pointer-lock UI gates | 26 / 26 |
| Additional frozen Worker/LAN/rematch lifecycle gates | 10 / 10 |

This includes accepted player visual foot support, known-null incomplete-legacy
repair protection and truthful Relay B/original tower instructions. The optional
tower ramp was rejected and reverted; original Alpha GLB bytes are restored.
The exact three approved copy differences are checked before reversing only those
fields for full historical layout comparison. Red c59950e remains recorded.

Configured Arena/Worker test-inclusive types passed. The separate extra strict
World validation diagnostic sample is not a configured green gate; see
[the bounded typing audit](VALIDATION_TYPE_AUDIT_20261031.md).

## Private recovery/build artifacts

The cumulative source bundle requires original base
`9c6cd86e84f3130e0eab6dc416ec1383e520a8f0`; it is not a standalone clone.
Its SHA-256 is
`6f46b45e078f3225601065def2ce8d3d5fa10aeb2645f7e4ffdd54bd8921e5ab`.

Exact playable build ID:
`91e8f0e9fa703d409699c256436982fdf50e1ebb1e929a029d54082160889704`.
Its 80 files total 179,612,090 bytes. The private ZIP adds exact-source launch
scripts, existing notices/provenance, a concise README and player-guide revision
`6f64a5b`, separately identified from the playable source. It contains 93 entries,
103,165,453 compressed bytes, SHA-256
`3abd9eb8640a502f76aa15054c695d322d82538e332ece6c975c3f7c9037cefd`.

Every archived byte and build-manifest digest was checked. A fresh extraction
launched in the cloud on loopback only, served launcher/World/Arena pages,
reused its matching build and shut down its owned process. No browser was opened,
no real matchmaking connection was made and no user device was accessed.
The archive uses fixed timestamps, permissions and sorted entries; no caches,
process dumps, dependencies or rejected candidate evidence are included.

This is not publication approval or a public release. Existing notices do not
grant separate fan-character design rights. CPU/DOM/offline evidence does not
establish GPU performance or native-browser recovery; wrist-safe ADS retains
documented residual contacts. Final fresh-save/stress/performance receipts are
separate follow-up evidence, not presumed by this aggregate result.
