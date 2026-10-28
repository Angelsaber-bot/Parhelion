"""Assemble actual offline pose frames into a labeled GIF/contact sheet; no generated art."""
from pathlib import Path
from PIL import Image, ImageDraw
import sys

source, output = map(Path, sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
paths = sorted(source.glob('musashi-after-walk-*.png'), key=lambda p: int(p.stem.rsplit('-', 1)[1]))
if len(paths) != 16:
    raise ValueError(f'Expected 16 full-cycle runtime frames, got {len(paths)}')
frames = []
for i, path in enumerate(paths):
    image = Image.open(path).convert('RGB').resize((480, 480))
    canvas = Image.new('RGB', (480, 524), (20, 25, 34))
    canvas.paste(image, (0, 34))
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 9), 'MUSASHI / ACTUAL CPU POSE / OFFLINE RENDER', fill=(231, 235, 242))
    draw.text((12, 508), f'Walk phase {i + 1:02}/16 - not a WebGL capture', fill=(185, 198, 216))
    frames.append(canvas)
# GIF uses 10ms units: 1.070s total approximates the authored 1.0667s cycle.
frames[0].save(output / 'musashi-walk-cycle.gif', save_all=True, append_images=frames[1:],
               duration=[70 if i % 3 != 1 else 60 for i in range(16)], loop=0, optimize=False, disposal=2)
sheet = Image.new('RGB', (1280, 1360), (20, 25, 34))
draw = ImageDraw.Draw(sheet)
draw.text((16, 12), 'MUSASHI / ACTUAL RUNTIME CPU SKINNING - 16-PHASE WALK - OFFLINE MATERIAL RENDER, NOT WEBGL', fill=(231, 235, 242))
for i, path in enumerate(paths):
    image = Image.open(path).convert('RGB').resize((320, 320))
    x, y = (i % 4) * 320, 36 + (i // 4) * 330
    sheet.paste(image, (x, y))
    draw.text((x + 10, y + 304), f'{i + 1:02}/16', fill=(242, 242, 242))
sheet.save(output / 'musashi-walk-cycle-sheet.jpg', quality=91)
print(f'Actual runtime walk-cycle previews: {output}')
