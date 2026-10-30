# World gameplay iteration — release validation

Base: `350f5640c722f1013e4f598c669c558c529dc6eb`.
Frozen source/asset/test/build manifest SHA-256:
`c5078e2d2f0e54cccb804356938d1c861e00d26e0cb230debe1a05b91bb31d30`.
The 745-file validation manifest remained unchanged through final checks.

## Final local release gate

- Node 22.22.2 World: **754/754** passed.
- Node 24.22.1 World: **754/754** passed.
- Arena, Node 22 and Node 24: **322/322 each** passed.
- Node 22 whole-site build, including both client typechecks: passed.
- Site tests: **13/13** passed.
- Content build ID: **5a8cc65202a5**.
- Whitespace check: passed.

The shared-client ESM package scope is part of this release: it fixes a confirmed
Node 22/tsx split locale singleton without weakening translation assertions.
The production deployment workflow now requires World regression success and
bounds test concurrency to two processes. Existing Worker → smoke → Pages ordering,
Cloudflare project targets, credentials and access configuration are unchanged.

## Covered behavior

Real-asset five-region traversal, seam/quest gates, cannon/boat rays, optional
Kyoto approach, the Honnō-ji apron, save compatibility/reset, repeat bosses and
knight trial, no-free-energy rules, actual character contact clips, low-wall weapon
LOS, death/late-load cleanup, travel/respawn and genuine production DOM/input chains
are covered by tests. Evade replay at27/30/60/120 synthetic FPS has the same3.12m
travel and141.667ms fixed-step protection sampling. This is a fairness check, not
achieved rendering performance.

Offline Blender reviews inspected the added stations, full-body three-cut melee,
and normal/reduced skill presentation. Added effects use no lights or textures,
retain a fixed pool, and do not allocate GPU resources per activation.

## Performance and browser boundaries

An early no-GPU snapshot showed a Kyoto CPU proxy regression; that record remains
available. A subsequent isolated visibility-root optimization reduced that CPU
proxy median by roughly54–59% in three controlled repetitions, with real production
integration and behavior checks. Models, lighting and AI budgets were preserved.
See `WORLD_CPU_VISIBILITY_FOLLOWUP_20261030.md` for the method and limitations.

The supported cloud browser could open the public site but could not create a
WebGL context. Therefore real WebGL image quality, target-device FPS and human
playtest acceptance remain unverified. In particular, the earlier27–40FPS report
cannot be marked resolved from Node measurements alone.

This document records the pre-publication validation input. Publication is only
confirmed by the matching remote commit and successful Deploy workflow run.
