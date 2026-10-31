# Companion engagement and bounded detour audit — 2026-10-31

## Status and evidence boundary

**Initial proof checkpoint `cd1349a` was validation-only.** Root subsequently approved the narrow production implementation described below; the rejected pursuit-memory experiment remains validation-only. Existing attack ranges, hit clocks, LOS, target ownership, player movement and colliders are unchanged. Entry teleport/direct catalog admission in the actual-main runner are labeled setup; all grounding, summon/dodge inputs, enemy AI and companion contacts afterward are real. The dodge policy reads accepted tell clocks, so these are mechanics probes, not human-reaction or full story playthrough evidence. No hostile HP, player HP, charge, grounded flag or companion position is written.

Baseline navigation blob: `557f4dc58c495380ad05845e4bed4df6adcf85f1`. The exact historical reference is `validation/fixtures/companion-navigation-pre-detour.ts`; only its header/import paths differ. Keeping that reference prevents future fixed-versus-fixed comparisons.

## Actual-main findings

`validation/combat-review/audit-companion-engagement.ts` observes original acquisition/track/strike callbacks without changing their arguments/results. It records native attack starts, genuine damage events, root-floor samples, navigation goals and actual LOS hits.

| Probe | Result |
|---|---|
| Alpha slope, Saber only | 19 native contacts, 264 total damage, Warden defeated in 35 s; player 84 HP |
| Alpha emitter-III cover side | 19 contacts, Warden defeated in 34.78 s; player 100 HP |
| Winter baseline, 30 s | Stalker defeated in 5 contacts; lancer remains 66 HP; player 59 HP |
| Winter, rejected continuity-only experiment, 60 s | Lancer still 66 HP despite 1,073 last-visible navigation returns |
| Winter, final detour-only candidate | 10 genuine contacts, both defenders defeated in 23.75 s; player 59 HP |
| Harbor baseline, 30 s observation | 16 genuine contacts, two defenders down, one remaining; no stuck interval observed. This bounded observation is not claimed as encounter completion. |

Alpha sampled root-floor agreement is approximately 2e-9 m; this checks navigation root support, **not visual sole penetration**. Alpha native contact timing agrees with the existing 5/9 fraction of the 1.2 s clip within the 60 Hz observation resolution. No attack timing change is proposed.

## Two symptoms, one necessary fix

Winter initially shows acquisition flicker: with player `(60.341,4.274,-636.622)`, Saber near `(59.75,4.173,-634.674)` and lancer `(63.202,4.112,-631.473)`, a few millimetres of movement alternate sight clear/blocked. Player distance is 5.89 m, companion distance 4.71 m and height difference only 6 cm; this is not a range/height boundary. The blocked ray hits `(62.704,5.121,-631.935)`, normal `(-.8779,.47885,0)`.

Environment ownership independently identified the exact intentional front-left relay diagonal support: world X62.2→64, Z−632, thickness .13 m. No collider or art alteration is requested. LOS loss changes the navigation goal from prey to formation, creating small reversals whose movement resets the existing stuck counter.

A small eastward normal-key player reposition remains behind the relay and does not resolve the issue. A wider normal-key route around it restores two real hits, then exposes a genuine local steering failure near `(62.669846,4.068778,-632.065622)`.

The planner accepts a long path whose discrete head-clearance samples skip the nearby diagonal beam; actual short-step revalidation correctly rejects entry. It then chooses the same long path again. Captured geometry replay finds 105 clear routes among 256 **offline diagnostic** direction/reach probes, but baseline steering advances less than 1 mm and remains stuck for 9.9 s. The game does not run that offline scan.

A last-visible-position pursuit-memory experiment was tested and **rejected**: it did not solve the actual Winter encounter after 60 s. Its validation-only helper remains solely to reproduce the negative control. It is not part of the production proposal.

## Smallest detour-only candidate

`validation/combat-review/companion-navigation-candidate.ts` copies the historical controller and changes only failure recovery:

1. Only a movement rejected by the existing floor/path revalidation records a failed heading. The original position rollback remains intact.
2. At most nine failed headings are retained for .4 s, merging headings within .28 rad. Invalid/zero dt does not age them; ordinary controller reset clears them.
3. While a failed heading remains, local planning reach is .65 m instead of 3 m, and recently failed headings are skipped. Original nine candidate directions, speed/turn limits, terrain/body/head checks and final step revalidation remain unchanged.
4. No extra rearward directions, target memory, LOS relaxation, damage range, safe-return rule, teleport or global cache is added.
5. If no safe direction exists, remain stopped. Records expire rather than authorizing a blocked move.

The captured Winter root recovers to within .258 m of its goal under actual world BVHs. The existing stopping distance is .255 m horizontally; the slightly larger 3D distance includes terrain-height difference. The final actual-main Winter completion uses real native strikes, not this geometry replay to declare victory.

## Regression and query boundaries

Own nine candidate cases cover 30/60/120 Hz diagonal-beam recovery, every accepted step passing the original path check, original speed caps, exact unaffected open/slope/narrow-door trajectories, ledges/nonwalkable slopes, enclosed no-path expiry/reset and changing targets. Existing navigation/query-budget regressions also pass. Independent QA adds pause/invalid-dt memory freeze, disabled-obstacle recovery, gate enabled mid-plan/reopening, and reset-to-fresh parity.

The maximum remains nine planning path calls plus one actual-step path revalidation and its existing floor check. No 256-direction runtime scan is added. Failed records are capped at nine; final Winter observed at most three. BVH work retains the existing bounds prefilter and enabled-state checks.

## Quiet CPU/query probe

`validation/combat-review/measure-companion-detour.ts` uses twelve measured trials after two warmups, alternating baseline/candidate order, 120 Hz for ten simulated seconds. Shared weight-4 admission reserved the short run. The timer includes `navigation.step` only, with common query-count wrappers. These are **component CPU samples, not GPU FPS, WCET or device guarantees**.

- Captured Winter recovery-active candidate steps: median .019 ms, p95 .065 ms, maximum observed .368 ms (588 samples).
- Baseline repeatedly blocked steps: median .089 ms, p95 .148 ms, maximum observed 3.708 ms (14,400 samples).
- Observed maximum individual BVH casts per step: candidate 32, baseline 34. Both observed at most three path calls in this specific replay; structural cap remains ten.
- Flat-control query totals match exactly (10,068 BVH casts, 4,836 path calls per variant), as do every endpoint coordinate. Flat p95 is .00336 ms baseline / .00337 ms candidate.
- Whole-trial candidate timing is mostly idle after arrival, so its very low median is **not presented as a general navigation speedup**. Raw maxima are retained without invented causes.

Reports: `artifacts/enemy-performance/companion-detour-cpu.json`, `artifacts/companion-detour-cpu.log`, and `artifacts/companion-engagement/*.json`. Historical setup and accepted animation root/path hashes predate the proposed navigation fix; they must not be claimed unchanged on routes where recovery intentionally differs.

## Late attachment at the actual stuck state

A paired actual-main control waits until **24.183333 s**, after the wider normal-key route and a genuine two-second navigation stall, then installs either a fresh historical navigator or the candidate. Both attachments preserve the exact companion root `(62.669846,4.068778,-632.065622)`; no actor reposition is used.

- Historical reset remains blocked until the existing long-separation regroup activates at 37.8 s, moving the companion 13.438 m via its original safe-return mechanism. It finally completes at 43.383333 s. This is not claimed to be an infinite softlock.
- Candidate resumes normal walking, lands remaining real contacts at 26.216667, 28.033333 and 29.816667 s, and completes at 29.816667 s. **No root jump >.5 m/frame occurs**; no new teleport/regroup policy is involved.
- Both end at player 59 HP and use the same original attack damage/clock. The replacement itself resets only navigator transient state in both arms of this validation comparison; production integration would not dynamically replace the controller.

Files: `winter-late-baseline-reset-diagnostic-wide-reposition.json` and `winter-late-detour-diagnostic-wide-reposition.json` in the engagement artifacts directory. Reproduce with `audit-companion-engagement.ts winter --diagnose --wide-reposition --late-baseline-reset|--late-detour --seconds=60` before production integration.


## Approved production implementation

Root approved the matching `src/companionNavigation.ts` change at 08:27 UTC. It adds only the physical failure records, bounded expiry, short local reach and reset cleanup described above. No servant, target, attack, art, Arena or main wiring is changed. The same nine-case contract now runs independently against the isolated candidate and production, with the frozen historical controller as baseline. Together with existing navigation/query tests, 27 cases pass; World typecheck passes. Independent actual-main no-wrapper replay is the next acceptance check.

The engagement runner defaults to current production with no navigator replacement. `--historical-navigation` explicitly installs the frozen baseline for diagnostic comparison; `--detour` explicitly installs the isolated candidate. These modes are labeled in output, rather than silently comparing two fixed controllers.
