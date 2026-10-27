# Artoria refined outfits — World runtime revision 1

Accepted civilian and Armor Revision 2 appearance, with four skinned clips: `Idle`, `Walk`, `Run`, `Attack`. Runtime assets are lossless `.glb.gz`; no polygon simplification or visual downgrade is applied. The authored full geometry is retained. `manifest.json` gives both gzip and decoded GLB SHA-256.

- Armor: 914,868 triangles, 30 material primitives; gzip 23,841,751 bytes, raw 43,190,944 bytes.
- Civilian: 75,152 triangles, 15 material primitives; gzip 12,623,552 bytes, raw 16,240,588 bytes.
- +Y up, +Z front, feet at y=0, approximately 1.7m human scale. The sword is right-hand skinned.
- Idle 2.4s, Walk 0.9s, Run ~0.566667s, Attack 1.2s. Attack contact ~0.666667s. Walk nominal 0.7476m/s, Run nominal 1.9983m/s.
- Runtime uses `fetch` + `DecompressionStream('gzip')` + `GLTFLoader.parseAsync`, also accepting a GLB already decompressed by HTTP. Textures are embedded, no remote decoder/assets required.
- These are high-detail assets. One active model is kept; the second loads serially and replaces it. GPU frame rate and memory on actual devices are not yet measured; do not claim production performance acceptance.
- Source Blender files, authoring scripts and rendered animation QA are maintained in the artwork delivery. This folder is the exact game-ready runtime asset set, not the old `assets/characters/saber/` v1.

See `docs/ARTORIA_RUNTIME_R1.md` for interaction, save compatibility and verification limits. No website publication is implied.
