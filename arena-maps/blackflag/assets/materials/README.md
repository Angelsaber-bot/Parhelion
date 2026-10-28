# Original BLACKFLAG material inputs

All PNG files here are generated from original geometric / line / brush-pattern
instructions in `../../source/surfaces.py`, using deterministic seed 2048.
No third-party photos, paintings, texture packs, logos, stock images or AI concepts
are included. The heraldic sun-mask/crossed-cutlass motif was designed for this map.
These project-authored files use the same repository terms as the authored source;
no external attribution or additional texture license is required.

- `oak_basecolor.png`: neutral painted grain, board joints, knots and nail heads;
  multiplied by the authored oak/tar material colours.
- `canvas_basecolor.png`: neutral woven cloth and sewn panel modulation.
- `blackflag_sail_basecolor.png`: fully coloured dark heraldic sail, neutral material tint.
- `*_orm.png`: RGB packing, R=unoccluded 255, G=roughness variation, B=metallic.

Every image is power-of-two and <=1024 pixels per axis. PNGs are embedded as GLB
bufferViews by the shared exporter, so the shipped model does not fetch these files.
