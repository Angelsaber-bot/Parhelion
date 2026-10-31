# Saber runtime revision 2 — native model and acting refinement

This is a substantive refinement of the project's existing native model and rig,
**not a claim of a new from-scratch topology or a frame-for-frame FGO recreation**.
Revision 1 remains untouched beside this directory. Integration approval and final
visual QA are recorded in the four-servant remaster evidence, not inferred from a
file existing here.

## Model and animation changes

- Continuous cheek/jaw/nose-plane sculpt. All 56 native expression targets are
  transformed consistently, not discarded or replaced by a face sprite.
- A quieter determined resting expression; real morph-based live blink/focus
  acting has explicit ownership/reset/disposal. No gameplay event comes from it.
- Original skinned tapered crown/side locks and a single swept ahoge. Roots are
  conformed to the actual native hair shell; the two disconnected old ahoge
  components are retired without opening the scalp. Stage wind deforms the new
  locks as well as the original hair on the private clone only.
- Differentiated gold hair, cobalt fabric/enamel and cooler steel. Eight shared
  radial folds reshape lower dress, trim and tassets together. A restrained
  physical breast-keel replaces the rejected protruding stacked details.
- Attack anticipation and recovery gain distributed spine rotation, with the
  original keyframe times, 1.2 s duration and existing contact instant retained.
  Idle, Walk and Run tracks remain byte-for-byte equal after loader decoding;
  the approved downward carry and accepted grounded stride are retained.
- Only the silver blade and its edge beyond the guard are proportionally
  shortened: socket-space net blade 1.505→1.270; at the native 0.718686 rig scale,
  world net blade is approximately **1.082→0.913 m (−15.6%)**. Guard, hilt, hands
  and socket transforms are unchanged. `WeaponSocket_R.extras.saberBladeTip=1.412`
  keeps Excalibur effects attached to the actual new tip. Older assets fall back
  to 1.647 in the presentation helper.

## Preserved contracts / limits

Native joint ordering, inverse bind contract, leg lengths, hand/socket transforms,
all foot-weighted vertex positions and locomotion clips are unchanged. Existing
Saber sole calibration therefore remains applicable. Foot/root/controller paths
are not changed by this model revision. New geometry is bound to existing Head
and Spine2 joints; no extra runtime skeleton or remote decoder is required.

Shortening improves all four measured real-map routes, but **does not eliminate
all sword/terrain intersections**. Thirty-Hz paired worst blade clearances were:
Kyoto −503→−353 mm; Winter −512→−330 mm; Britain −185→−37 mm; False Dawn
−290→−58 mm. Exact navigation rays confirmed the worst cached surfaces. Flat
idle/walk are clear; the isolated Run cycle still reaches approximately −14 mm.
Do not describe this as a universal terrain-aware sword solver.

The private Excalibur performance adds bounded 3.5 cm weight loading with planted
feet, higher two-hand preparation and controlled recovery. Default Q/X glare is
reduced in source, not only behind the reduced-effects setting: lower near light,
white core, impact/beam alpha, fewer motes and two clean beam ribbons. Other
identities' lighting and skill opacity are unchanged. CPU renders do not prove
WebGL bloom appearance or GPU FPS.

## Reproducibility and provenance

Run `python assets/characters/artoria_refined/runtime_revision2/source/build_remaster.py`
from the repository root. It reads only the preserved project revision-1 assets,
uses NumPy for deterministic geometry transforms, and writes the two `.glb.gz`
files plus `manifest.json`. The manifest records input and output SHA-256, size
and positively changed geometry/animation counts. No mesh reduction is used.

No official FGO or other third-party game asset was downloaded/extracted for this
revision. Existing project-provided geometry/textures and their upstream rights
remain unchanged; this document does not independently grant or re-license those
rights. New procedural strands, keel geometry and acting code are authored for
this project. The user-provided Bilibili page was inaccessible to the web tool;
the official 2020 announcement was verified at
https://news.fate-go.jp/2020/newyear2020_cp/ . No unavailable video was claimed to
have been watched, and no frame-for-frame replication is claimed.
