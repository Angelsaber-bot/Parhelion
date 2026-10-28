# Chapter authoring helpers

`glbkit.py` remains a dependency-free, deterministic mesh/GLB writer. Calls without
`textures` keep the original factor-only byte format; existing map sources and
assets do not need to change. `chapterkit.py` authors the three new chapter maps'
JSON collision and matching inspectable proxies alongside their visual art.

## Original embedded surfaces

```python
c.textures = {
    'stone': {
        'baseColor': ROOT / 'assets/materials/stone_basecolor.png',
        'orm': ROOT / 'assets/materials/stone_orm.png',
        'normal': ROOT / 'assets/materials/stone_normal.png',
        'scale': .75,
        'normalScale': .38,
    }
}
c.save(render_object=crafted)
```

Each channel is optional. ORM is glTF **R=AO, G=roughness, B=metallic**. Palette
factors still multiply texture channels, so full-colour images need a white base
factor; relative-colour grain/mottle maps can retain the authored palette.

UVs default to dominant-face planar projection in world metres; `scale` multiplies
them. A crafted mesh may override `mesh.uvs[material]` for a purpose-painted atlas,
as Camlann does for its continuous ground surface. Textures are embedded in GLB
buffer views: no remote or sibling-image URLs are required at runtime.

The chapter metadata's channel list describes the pipeline's supported channel
slots; individual materials may use only a subset. Inspect actual GLB material
bindings or the independent QA material report for each map's used channels.

`check_glb.py` checks every visual/proxy bound and node against map data, embedded
images/UV counts, and the existing 60k-triangle / 4MB geometry+JSON budget. New
chapters may additionally embed up to 1MB of original surface images.

Only `camlann`, `blackflag`, `frostcourt` use `src/chapterMaterial.ts` in Arena:
standard PBR channels are preserved, with a restrained shadow-hue/rim treatment.
ASTER, SAKURA and legacy maps retain their old `toCel` path unchanged. CPU GLB
renders are useful asset inspections, not proof of WebGL rendering or GPU FPS.
