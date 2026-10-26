# 0.2.0 — ramp-side stuck repair and larger Arena

The user reported getting stuck and passages being too narrow for an Arena. Work remained in the existing Aster test workspace. The user explicitly reserved `<original-project>/Parhelion` for a later migration, so nothing was written there. SABLE DIVIDE was also untouched.

## Reproduction and root cause

The screenshot's actual 2047×1331 pixels were inspected after Library materialization on this Mac. The status line showed approximately X=-11.1, Y=0, Z=-9.1, beside the west gallery ramp. With real keyboard input in 0.1.0, walking from the west spawn, ascending partway and stepping off that side reproduced a stop near (-11.2, 0, -9.1). Holding outward/backward keys left X/Z unchanged.

The old side passage was only 0.975 m between the ramp body and north court wall. With a 0.64 m player diameter, the centre had only about 0.335 m of lateral room. Falling off the ramp could leave the horizontal footprint partially intersecting the ramp's solid side. `blocked(nextPosition)` then rejected every small candidate, including one that moved away, because that candidate still intersected. Gravity did not resolve horizontal penetration. This is a solver defect aggravated by the narrow slot, rather than an intended wall stop.

The solver now resolves existing horizontal overlaps before movement and after falling, pushing the footprint out along the nearest separating direction. Ordinary movement still uses short collision-checked substeps and permits tangential/diagonal sliding. It does not teleport a player along routes. `baseline_ramp_fixture.json` and `baseline_physics_0_1_0.cjs` preserve the original case: the old solver remains immobile, while the repaired solver escapes **that same old geometry**. Enlargement therefore does not conceal an unfixed defect.

## Measured space changes

Widths below are face-to-face geometry clearances. Subtract the 0.64 m player diameter for available centre travel where relevant. The current audit recomputes the new clearances from object positions/dimensions.

| Space | 0.1.0 | 0.2.0 |
| --- | ---: | ---: |
| Arena floor bounds | 48×36 m | 72×56 m |
| Floor area | 1,728 m² | 4,032 m² (+133.3%) |
| Reported ramp/wall slot | 0.975 m | 4.775 m |
| Spawn turning gap | 3.2 m | 5.2 m |
| Four court entrances | 4 m | 6 m |
| Side ramp width | 5.6 m | 8 m |
| Central ramp width | 4 m | 6 m |
| Laboratory front bypass | 2.175 m | 4.275 m |
| Laboratory rear bypass | 3.25 m | 7.25 m |
| Reactor-to-cover lateral bypass | 2.6 m | 5.2 m |

This was a layout redesign: court walls, ramp locations, longer gentler slopes, reactor offset, cover spacing, spawn pockets and laboratory pods were repositioned individually. Player radius 0.32 m, height 1.8 m, eye height 1.65 m, 0.28 m step height and 4.2 m/s speed are unchanged. Side ramps now rise 3 m over 10 m; central ramp rises 3 m over 9 m. A 4 m apron separates its low end from the reactor plinth. High ground still has three normal approaches and screened spawns. Four candidate spawn anchors remain; adding arbitrary extra anchors would not improve this validated layout.

## Actual keyboard regression observations

No route teleports or scripted waypoint tour was used as proof. Each case starts with a normal spawn reset where needed, then uses continuous W/A/S/D or simultaneous diagonal chords. Visible status coordinates were checked at transitions.

| Case | Observed result |
| --- | --- |
| West ramp side fall | (-17,1.51,-17.9) → (-17,0,-11.8), then movement remained available |
| West corner diagonal/reverse | (-13.7,0,-9.6) → (-16.9,0,-12.7) |
| East ramp side fall | (17,1.51,-18) → (17,0,-11.9), then movement remained available |
| East corner diagonal/reverse | (13.8,0,-9.6) → (16.9,0,-12.7) |
| West ramp/deck | Centre deck Y=3 → west landing (-24.1,0,-18) → deck Y=3 |
| East ramp/deck | Centre deck (0.5,3,-17.8) → east landing (24,0,-17.8); ascent also observed |
| Central ramp | Deck Y=3 → court (-0.2,0,-4.1) → deck (-0.2,3,-17.3) |
| Four court entries | NW/NE/SW/SE all crossed in both directions; see browser JSON |
| Spawn exits | Both north exits walked; both south exits walked out and returned to their spawn |
| Boundaries | Stops at approximately X=±35.4 and Z=±27.4; diagonal sliding and reverse-away inputs succeeded |
| Laboratory flank | (-28.7,0,24.5) → (27.9,0,24.5) → (-28.7,0,24.5) |

The broader audit covers 30 ramp-edge cases, 92 corners and 14,330 walkable raster nodes. The final result passes 48 standard checks plus 164 movement/clearance checks. It is still a finite inspection, not a proof of all collision configurations or competitive balance. Full evidence and limitations are in `validation/VALIDATION.md`.
