# Guarded immutable-tree traversal — bounded CPU evidence

Only `world/src/chunk.ts` changes runtime behavior in this experiment. The existing
`freezeStaticArt` already fixes local and world matrices. The new fast path avoids
recursively visiting an unchanged frozen subtree on each scene matrix update.
It does not alter rendering quality, geometry, materials, lights, culling, physics,
20 Hz AI or 120 Hz actions. This is **not a GPU/FPS measurement**.

## Main finding and cost

The actual guarded implementation, compared with original Three traversal on the
**same real scene and heap**, measured **0.634 → 0.425 ms per scene matrix pass**. A final confirmation after
a cold-path safety correction measured **0.567 → 0.405 ms**: approximately
**0.16–0.21 ms less CPU work** across the two same-scene checks. Nine alternating batches per variant, 150 warmup
passes and 350 measured passes per batch, Node 24.22.1. The scene contains 3,054
optimized roots / 5,121 immutable nodes in this harness. All methods are restored
after the manual diagnostic. No unsafe unconditional no-op is used in this result.

Safety bookkeeping costs memory: independent-process post-GC heap medians were
112.43 MiB control versus 116.19 MiB candidate, approximately **+3.76 MiB**. RSS
medians were 1056.52/1066.51 MiB; shared-host variance applies. External memory and
ArrayBuffers are unchanged (534.61/515.30 MiB in each variant). Resource inventories
are identical. There is no geometry, material, texture or light allocation in the
optimization itself and no recurring frame allocation in the fast path.

## Safe boundary

- Every node in a candidate tree must use Three's original matrix callback. A
  custom callback on **any descendant** rejects the fast path.
- `updateWorldMatrix` and explicit world-position queries are untouched. Existing
  freeze semantics remain: frozen world-space snapshots do not follow subsequent
  parent transforms; live actor siblings continue updating normally.
- Adding or removing a child at any depth restores original recursive traversal,
  so a late dynamic child is never silently ignored.
- Removing the optimized root restores its method and clears its listeners.
  Ownership is weak; no global strong scene registry is introduced.
- Explicit root matrix flags or a dirty-world request also restore traversal.
- Repeated freezing, absorbing previously frozen children and later custom
  overrides clear old ownership/listeners without stacking them. A saved/wrapped
  old fast method invoked after invalidation falls back to original Three traversal.
- This remains an **immutable subtree** API. Arbitrarily thawing existing deep
  descendants by directly changing their flags while retaining a frozen ancestor
  is not a supported operation. Restore/thaw the root or change topology first.

Added regressions exercise those boundaries, including real custom subclasses,
late dynamic additions at three depths, reparenting, removal, dirty requests,
world queries and visibility/material updates. Existing static/quality cases plus
these new checks pass 41/41; no old assertion was relaxed.

## Full-frame proxy (secondary, noisy evidence)

Two fixed source copies, differing **only in chunk.ts**, execute production main,
real GLBs/BVHs/state with the existing no-GPU renderer/Canvas2D adapters. Each of
three independent processes per variant visits Valley HQ, winter wilderness and
Kyoto wilderness: 180 warmup + 600 sampled 60 Hz frames per location. Yield 10 ms
outside timing every 60 frames for real asset promises, keep player alive outside
timing, and collect memory after explicit GC. Order is C/A, A/C, C/A. No attack
inputs or action-stress workload is claimed. All six runs have zero captured
errors/warnings and identical resource inventories.

| CPU ms / simulated frame | Control median / p95 | Candidate median / p95 |
|---|---:|---:|
| Valley HQ | 4.014 / 7.261 | 2.598 / 5.405 |
| Winter wilderness | 3.743 / 6.277 | 2.297 / 4.884 |
| Kyoto wilderness | 2.945 / 6.708 | 2.020 / 5.041 |

These are medians of process statistics, not pooled p95s. Cloud load varied
substantially; the first Valley pair was slightly slower with the candidate
(2.566→2.598 ms). Do not turn the aggregate into a “35% faster game” headline.
The more controlled same-scene .16–.21 ms results are the primary evidence.

Control chunk SHA-256:
`9708a6498380e7f9b1d1e71051518860c6cc6734536732d0e5045f20da1394ab`

Full-frame candidate chunk SHA-256 (the frozen six-process experiment):
`3d97725071bfbc9b42adbf27fe942fb214117ba98552e964a7bf9dae1cc24665`

Final runtime chunk SHA-256:
`0fea533abd7f08950f26bf4e024ccc8b59b66d77355b67d96b951e1bf89cce04`.
The only subsequent change handles a saved/wrapped fast-method reference after
ownership invalidation. The final same-scene confirmation includes that cold-path
correction; the full-frame experiment remains honestly labeled with its prior hash.

Directed integration before that cold-path correction passed 69/69 real-main,
capsule/gate/target, authored-route, actor-contract and resource-budget checks;
typecheck passed. Final static safety/quality tests pass 41/41. Complete Node22/24
project testing is recorded separately against the final integration snapshot.

Raw data: [polish-static-traversal-20261030.json](polish-static-traversal-20261030.json).
Fixed runtime copies and logs are retained outside the published repository. Candidate assets were hard-linked to the frozen control while `chunk.ts` had a separate inode; neither copy was linked to editable runtime source. The raw measurement file above contains the evidence required to inspect the reported values.

Run the same-scene diagnostic from `world/`:

```sh
node --import tsx validation/static-subtree-cpu.ts
```

For fixed-copy whole-frame comparison, use `validation/world-cpu-comparison.ts`
with each copy's world directory as its argument. These scripts are manual probes,
not flaky CI time thresholds. Browser/GPU frame rate and the user's Mac FPS remain
unverified. The final whole-project suite is run separately after integration.
