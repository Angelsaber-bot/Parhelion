# Blackbeard flintlock — original prop

## Files

- `blackbeard_flintlock_editable.blend`: separate named components, editable stock subdivision and edge modifiers, original texture packed.
- `blackbeard_flintlock.glb`: asset-only game interchange export. No studio floor, camera or lights.
- `source/build_firearm.py`: complete authored construction source.
- `textures/walnut_original.png`: original analytic walnut grain, generated for this asset, not a third-party photograph.
- `previews/`: actual Cycles renders, no image-generation proxy.
- `qa/geometry.json`: evaluated geometry counts and bounds.

## Axes and attachment

Meters. Barrel points local **-Y**, local **+Z** is up. `Blackbeard_Flintlock_ROOT` is at the intended palm center; the named `GRIP_ATTACH - palm center` marker is at the same origin. The right palm wraps around the curved stock, with trigger finger extending forward toward -Y. Parent the root to the character's right hand attachment and adjust the hand pose rather than deforming the prop. The hammer/cock, trigger and frizzen are separately named mesh pieces if animation is desired.

The grip origin is roughly 22 mm forward and 5 mm above the original modeling origin; all component coordinates already include this adjustment. Do not apply that adjustment twice.

## Authorship and rights

All meshes, curves, material assignments and the walnut image were created specifically for Parhelion through Blender Python. No downloaded third-party meshes, ripped game assets or external image textures were used. No external attribution dependency is attached to this prop. The model is an artistic pirate flintlock interpretation, not a dimensional mechanical replica or functional design.

## Scope

One static firearm prop with editable components. It contains no armature or firing effects; attach to the character rig. Small screws and inlays are separate geometry, not a normal bake. The native materials use glTF-compatible Principled values and a base-color image. Texture pixels are packed in the GLB.

## Final verification

Native three-quarter, side and lock-detail views were rendered and inspected. A fresh GLB import was rendered and visually checked against the native asset; the material colors, original wood texture, transforms and open muzzle survived export. The imported file contains 47 meshes / 28,108 triangles, 6 materials and one embedded texture, with no studio lights or cameras. GLB size is 819,452 bytes.

Bounds in meters: min `(-0.0320, -0.4670, -0.1050)`, max `(0.0528, 0.0650, 0.2230)`. Overall length: 0.532 m. Suggested muzzle-flash socket in root-local coordinates: `(0, -0.467, 0.138)`, forward `-Y`.

The cock/trigger/frizzen are separate editable parts but their object origins are not articulation pivots; set pivots before animating these mechanisms. Character firing recoil and muzzle effects can be driven without changing the prop geometry.
