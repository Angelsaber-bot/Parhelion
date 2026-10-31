# Captain and cavalry remaster — 2026-10-31

Scope: substantial refinement of the existing project-authored models and new runtime assets, **not** a claim of rebuilding every mesh from zero. No external game extraction or new licensing grant. Retain each character's `SOURCE_AND_LICENSE.md` and derivative `remaster_v2/README.md`.

| Layer | Blackbeard | Napoleon |
| --- | --- | --- |
| Model | Permanent tricorn, midnight/oxblood open mantle, modeled trim, stronger beard/jaw, less mirror-like skin/armor | White horse and long cavalry saber retained; oxblood mantle/pale lining, surface-fitted horse breast crest, face/hair/horse-head refinement |
| Idle / walk / run | Baked chest breathing, head counterbalance and moving torso; original gait contacts/root trajectory | Baked rider/horse head counterbalance and torso weight; original horse gait/root trajectory |
| Ordinary attack / Q | Planted knee load, torso preparation, free-hand counterbalance and recovery; Q uses existing authoritative attack retiming | Rider anticipation, rein-hand preservation, raised sword preparation and recovery; Q uses existing authoritative attack retiming |
| X preparation | Tricorn/flintlock portrait, planted quarterdeck command, true source-pose handoff before contact | Rider resolve, full white-horse acceleration, raised saber/rein control, true native cavalry strike handoff |
| X contact / recovery | Real first muzzle event and three accepted salvo counts; fixed bounded smoke, ship/command pennant, captain lowers command | Actual saber contact, bounded descending-hoof dust/prints, rein-controlled recovery; **no firearm/cannon** |

## Authority and lifecycle

No damage, energy, targeting, navigation, collision, action duration, event ownership or save ID changes. New clips preserve native event socket position/direction (Blackbeard 17/30 s; cavalry 23/30 s). Private cinematic preparation hands off to the actual source clip before contact rather than inventing a counter-triggered post-hit swing. Attachment creation is idempotent; source geometry/materials are restored on legacy attachment disposal; native skeletons and borrowed textures are not disposed by the attachment owner. Exported v2 markers prevent a second runtime bake or duplicate hat.

## Reproduction and evidence boundaries

- `validation/captain-cavalry-remaster.test.ts`: fixed original assets, positive new body motion, contact/foot ownership, source immutability and disposal.
- `validation/captain-cavalry-model.test.ts`: actual new GLB roundtrip, every original embedded image SHA, exact gzip transport, positive mesh sculpt, normalized skin weights, no duplicate adaptation, true event socket comparison. `CAPTAIN_MODEL_TEST_ROOT` can explicitly select isolated candidate exports.
- `validation/characters/audit-captain-camera.ts`: 61 charge/outro samples per identity × normal/reduced × landscape/portrait, head/feet/weapon landmark bounds. Independent actual-main full-vertex projection is stronger and separately reported by QA.
- `validation/characters/audit-captain-cloth.ts`: directional back-surface BVH clearance against original skin/jacket at clip samples. Not an all-triangle or dynamic cloth collision guarantee.
- Model previews import the real GLBs and play their actual baked clips. Stage snapshots run `UltimateClock` and `skillAnimationSample`, then CPU-skin stage geometry; they are not a live gameplay proof. Any `--review-back` camera is an explicitly labeled diagnostic override, not a production shot.
- Actual normal-input paid-X, charge/damage/cancel/restoration and resource tests belong to the independent QA report, not these offline pictures.

## Visual corrections and limits

First-pass cape and horse badge spacing failures were retained in external evidence, not represented as finished assets. A second actual-stage check found a raised cavalry saber cropped by the charge camera; scoped camera change 31373bf widened that shot. Independent actual-main full-vertex samples subsequently confirmed no crop at the tested landscape/portrait charge/release phases.

Garments are weighted, lightly folded modeled cloth, **not** a new cloth physics simulation. Native movement, contact clocks and gameplay authority remain unchanged. Offline CPU images do not establish GPU correctness, real device frame rate, or intersection-free motion at every possible blend. No new native `.blend` is claimed: the editable derivative is the original GLB plus deterministic sculpt/tailoring/animation source.

## Final garment fit acceptance

Final Blackbeard GLB SHA256: `ab5516f9792a5989d54afbf6fbce0a9e381bf9dcfe71d6e7d63d6bc12b4a41ab`. Final Napoleon GLB SHA256: `598cacfe5ee35f1c1ad5e6b35ff6b711ff8f8660d8f305efd2c05d2017bb9ec1`.

Dynamic rear review exposed shoulder/back penetration in the initial candidate. Back curves and shoulder connections were fitted with clearance; the cavalry center hem was raised to clear the existing saddle cantle. A skin/jacket/back-direction BVH audit found zero negative-clearance sampled vertices across 30 Blackbeard and 24 Napoleon clip poses; the cavalry audit also includes the saddle seat. This does not prove global all-triangle collision freedom. Final rear/side PNGs are `captain-fit-v4-review/blackbeard-fit-v4-*` (identical Blackbeard v5 bytes) and `captain-fit-v5-review/napoleon-fit-v5-*`. Earlier model comparisons/stage renders have explicit older hashes and are not final garment-clearance proof.
