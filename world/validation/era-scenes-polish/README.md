# Four station craft polish — 2026-10-30

**Review `stations-before-after.png` and `stations-state-readability.png`.** These are actual exported station geometry/materials rendered offline with Blender CPU, not game screenshots or browser/FPS acceptance. Render/export scripts and a SHA256 manifest are included. Raw source inputs, individual full-resolution renders and logs are retained outside the publication footprint; no private files are required to regenerate them using the commands below. Both comparison versions use the same 720×820 camera, neutral light, 32 samples, vertex colors and normals. Final renders additionally consume the actual new UV-mapped texture pixels. Studio cast shadows do not reproduce the runtime policy (all four stations remain non-shadowcasting).

## Authored changes

- Britain: bevelled heraldic memorial plate, mounting studs, small seal and worn coping joints; inscription offset and taper tested to keep it readable.
- Black Sail: swallowtail signal pennants, compact rope turns and a belaying pin around the existing hoist.
- Winter: cast-iron door hinges, reinforcing bands and a small readable pressure dial on the existing field stove.
- Kyoto: swept eaves with an actual underside, inset rafters, round ridge cap, split cloth and corrected lantern rib radii. The prior ribs were partly buried inside the lantern shade.
- Five deterministic 64² surface maps per station: restrained stone mottling, wood grain, metal variation, paper fibers and fine cloth weave. No downloaded textures, custom shader hooks, image loaders, lights or animation. Mipmapped to reduce distance shimmer.
- Dormant, discovered and completed surfaces remain reversible; completed tags/seal get a distinct pale-gold finish, while regional cloth palettes stay distinct.

## Bounded cost and unchanged gameplay

| Region | Before triangles | After triangles | Draws before/after |
|---|---:|---:|---:|
| Britain | 1436 | 1684 | 7 / 7 |
| Black Sail | 1360 | 1704 | 7 / 7 |
| Winter | 876 | 1184 | 7 / 7 |
| Kyoto | 1808 | 2068 | 7 / 7 |

Textures: exactly **81,920 bytes base pixels / 109,220 bytes complete mip chain per station**; **436,880 bytes (426.64 KiB)** complete mip chains across all four. This is an intentional bounded addition, not a claim of zero GPU cost. Geometry remains below the existing 256 KiB/station budget. No added lights or shadow casters; no per-frame animation. Real browser/GPU time remains unverified.

All four collision geometries retain exact pre-polish SHA256 hashes; station transforms, interaction positions/radii, central walking spines and real-settlement line of sight are unchanged. Five-map framework untouched.

## Verification

- Focused final art/era/route/static/resource suites: 111 passed, 0 failed (raw evidence `focused-tests.log`).
- TypeScript typecheck: passed.
- New tests assert deterministic texture pixels, exact map set/budget, finite UVs, stable resource identity over 1000 state changes, exactly-once disposal, reversible state, baseline collider hashes, inscription clearance, roof underside/front-face visibility, hidden rafters and externally visible lantern ribs.
- Offline review caught and corrected the plaque covering its inscription, an overly checkered cloth draft, roof rafters poking through the eaves and lantern ribs buried inside the shade.
- No user computer, public upload, GitHub push or deployment was performed by this task.

## Reproduce from a clean checkout

Prerequisites: Git with baseline commit `b3a230c62d8271f4c04baebb6e2a8f55c1e050de` available locally, Node 22.22.2+ and npm, Blender 4.x with Cycles CPU, Python 3 with Pillow, and DejaVu Sans. On Debian/Ubuntu the font is provided by `fonts-dejavu-core`; elsewhere set `ERA_QA_FONT` to a DejaVuSans.ttf file. Install Pillow into your preferred Python environment (`python3 -m pip install Pillow`). Dependencies and baseline retrieval may require network access. PNG byte hashes may vary with Blender/Pillow versions; geometry hashes and budgets are the reproducible source-level contracts.

Run the following from the **current repository root**. It creates a separate detached baseline worktree and evidence directory. It does not publish, deploy or start the game.

```sh
set -eu
ROOT="$(git rev-parse --show-toplevel)"
BASELINE=b3a230c62d8271f4c04baebb6e2a8f55c1e050de
QA="$(mktemp -d "${TMPDIR:-/tmp}/parhelion-era-qa.XXXXXX")"
BASE="$QA/baseline"
OUT="$QA/evidence"
git cat-file -e "$BASELINE^{commit}"
git worktree add --detach "$BASE" "$BASELINE"
npm ci --prefix "$BASE/world"
npm ci --prefix "$ROOT/world"

# Use identical export channels for both versions. Only this QA exporter is
# copied; the baseline runtime art remains the unmodified baseline commit.
# Its old exporter omitted normals/UVs, which would confound the comparison.
cp "$ROOT/world/validation/era-story-scenes-review.ts" \
   "$BASE/world/validation/era-polish-export.ts"
(cd "$BASE/world" && node --import tsx validation/era-polish-export.ts "$OUT/before")
(cd "$ROOT/world" && node --import tsx validation/era-story-scenes-review.ts "$OUT/after")
(cd "$ROOT/world" && node --import tsx validation/era-story-scenes-review.ts "$OUT/inactive" inactive)

RENDER="$ROOT/world/validation/era-scenes-polish/render.py"
for STATE in before after inactive; do
  blender -b -t 2 -P "$RENDER" -- "$OUT/$STATE"
done
python3 "$ROOT/world/validation/era-scenes-polish/assemble.py" "$OUT" "$OUT/review"
printf 'Raw evidence: %s\nContact sheets and manifest: %s\nBaseline worktree retained: %s\n' \
       "$OUT" "$OUT/review" "$BASE"
```

The output is self-contained under the printed temporary evidence path. The assembler accepts a raw-evidence root (containing all three exported/rendered directories) and an optional output directory; it never needs the author's private workspace. Existing retained inputs can be supplied using the same arguments. Remove the temporary baseline worktree with `git worktree remove` only after reviewing and preserving any desired evidence.
