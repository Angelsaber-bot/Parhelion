# Eight-hour handoff packaging plan — not publication

## Schedule and authority

Feature cutoff: **2026-10-31 11:45 UTC**. Final verification/delivery target:
**12:54:21 UTC**. The isolated player-foot experiment has a separate 10:45 decision
point. A rejected experiment does not enter the final source or build.

Cloud development, testing and private packaging do not authorize a public push,
resource publication, deployment, or starting Work on the user's computer. Those
require fresh approval. Existing historical deployment instructions are not a new
authorization; no hosting/account/credential setup is part of this handoff.

## Deliverable 1 — exact source recovery

At the final accepted hash, create a **cumulative Git bundle anchored at original
`9c6cd86e84f3130e0eab6dc416ec1383e520a8f0`**, with a named local checkpoint tag.
Verify the bundle prerequisite/ref and SHA256. This is a compact recovery delta,
not a standalone clone: recovery requires the original commit and its assets.
Exclude untracked experiments, renders, caches, heap dumps, node_modules and
credentials. Never stage the shared working tree indiscriminately.

Current verified reference is `e7b660ede943097233a11b70cebf7fb887f1e7bc`:
- Cumulative bundle: `e7b660e-integrated-green.bundle`, approximately 876 KiB.
- SHA256: `05b825ca361100064ec7c2302eb66aa04c52847cdbdaa8ab8fd876b6fb1333a1`.
- World 1,577 / Arena 351 / site 13 tests; configured types and unified build pass.
- Independent before/after: 1,635 files / 614,345,747 bytes, no drift.

Later focused fixes are listed separately until included in a new frozen full
aggregate. In particular `0cff4c9` known-null session-repair protection is not in
this reference build. Do not attach a later source label to earlier binaries.

## Deliverable 2 — concise manifest and guide

Include exact source/base/build IDs, source-bundle and optional archive SHA256,
validation counts/status, notable changes, retained limitations, and a clear
“not publicly deployed” statement. Use the existing Chinese player guide rather
than a wall of test output. Link the exact checkpoint report and retain the
original red-checkpoint records separately.

Changes to summarize: optional continuation/resident stories and earned finishes;
scene/character/combat presentation; support and companion navigation corrections;
Arena effects/startup/transport ownership; storage and graphics/resume recovery;
measured resource reductions without invented device-FPS claims.

Known limits: no native GPU/FPS or PCF-shadow acceptance; CPU review is not a full
browser screenshot; residual sleeve/stock and low-sword contact limitations;
fresh-story and legacy-story walkthrough scopes must remain distinct. Deferred
Lobby reservation accounting is not fixed by client cleanup. Arena rules v8,
loadouts, offline and separate LAN/server options remain unchanged.

## Optional private playable ZIP — inspect first, assemble once

The verified reference output is the frozen checkpoint's **`site/dist`**:
**80 files, 179,601,775 bytes (~171.3 MiB)**, no symlinks. Breakdown is roughly
129 MiB World, 40 MiB Arena, plus launcher/server/notices. Its 79 manifest entries
were SHA256-verified against `build.json`; that manifest itself is the 80th file.
Build ID: `3af4d4629e27f4982887fb9010aa4096b6610de3a75ff4c5ea92dd62c76ffbce`.
Compressed ZIP size has not been measured; many assets are already gzip/WebP.
Do not create repeated large archives while development continues.

A future package should preserve this layout:

```
Parhelion-private-build/
  HANDOFF.txt + source/build/archive manifest
  PLAYER_UPDATE_GUIDE_20261031_ZH.md
  site/dist/                  # exact tested binaries and build.json
  site/scripts/launch.mjs     # same-source launcher
  site/scripts/http.mjs       # launcher's existing helper
  provenance/                # source notices listed below
```

The existing launcher needs Node 22+ and binds **127.0.0.1 only**. It serves the
site and local Arena backend, but is **not a new LAN-hosting package**; preserve
the separate existing LAN workflow in the source docs. Opening `index.html` via
`file://` is not the tested run mode. No user-local launch is performed as part of
packaging. Deployment/automatic-sync scripts need not enter the playable ZIP.
Do not include stale `.parhelion-launch.json` process-state files.

Retain `site/dist/THIRD_PARTY_NOTICES.txt` (654,281 bytes) and
`server.cjs.LEGAL.txt` (5,528 bytes). The former collects software/build dependency
notices; it is **not a complete character-design rights grant**. Preserve the
existing Blackbeard/Napoleon/player source-license documents, Musashi provenance
and `BASE-CREATOR-TERMS.txt`, and the current Artoria runtime provenance/manifest.
The old procedural Saber README is not sufficient provenance for the later
refined native asset. Fan-character design/reference rights remain distinct;
private handoff does not certify public/commercial distribution rights.

Before final archive creation: rerun full frozen validation; independently hash
source and every build-manifest entry; confirm required notices; inspect contents
for source labels, runtime state, caches and secrets; create one archive; list and
hash it. Optional extraction smoke stays in the authorized cloud workspace and
must not silently start the user's local environment or a public service.
