"""Original BLACKFLAG hand-directed procedural surface paintings.

Restrained, mip-friendly board/dye variation supplies the broad read; crafted grain,
caulking, pegs and sewn hems reward eye-level inspection. No photographs, external
assets, pixel-noise textures, alpha sorting, normal-map cost or extra draw calls.
All PNGs remain RGB, power-of-two, deterministic and <=1024 pixels per axis.
"""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def _save(image, out, name):
    # Small authored colour vocabularies compress well without indexed/quantized
    # colour ambiguity in glTF importers. The exported PNG is always opaque RGB.
    image.convert('RGB').save(out / name, optimize=True)


def _oak(out):
    n = 1024
    rng = random.Random(2048)
    im = Image.new('RGB', (n, n))
    rough = Image.new('L', (n, n), 211)
    d, rd = ImageDraw.Draw(im), ImageDraw.Draw(rough)
    # Neutrally painted modulation: build.py still owns timber/deck/tar hues.
    values = (242, 225, 237, 229, 246, 231, 239, 224)
    for row, val in enumerate(values):
        y = row * 128
        d.rectangle((0, y, n, y + 127), fill=(val, val - 3, val - 9))
        rd.rectangle((0, y, n, y + 127), fill=204 + row % 3 * 6)
        # Broad brush facets survive lower mips, without a noisy screen-space floor.
        for lo, hi, offset in ((6, 19, -5), (20, 38, -2), (39, 80, 3),
                               (81, 105, 0), (106, 124, -6)):
            v = min(250, val + offset)
            d.rectangle((0, y + lo, n, y + hi), fill=(v, v - 3, v - 9))
        # Grain is periodic across the tile. Long tapered ribbons read as oak,
        # not the uniformly spaced pinstripes of a manufactured laminate.
        for i in range(22):
            base = y + rng.randrange(9, 120)
            phase = rng.random() * math.tau
            amp = rng.uniform(1.1, 4.1)
            pts = [(x, base + amp * math.sin(math.tau * x / n * 2 + phase)
                    + .8 * math.sin(math.tau * x / n * 7 + phase))
                   for x in range(0, n + 1, 8)]
            v = val - rng.choice((12, 16, 20, 26))
            d.line(pts, fill=(v, v - 4, v - 10), width=1 if i % 5 else 2)
            if i % 5 == 0:
                # The thin sun-worn lip creates a painted chisel/grain edge.
                d.line([(x, yy + 2) for x, yy in pts],
                       fill=(min(253, val + 5), val + 1, val - 5), width=1)
                rd.line(pts, fill=191, width=4)
        # A few quiet quarter-sawn rays, not random pixel noise.
        for i in range(7):
            x = rng.randrange(32, 940)
            yy = y + rng.randrange(20, 112)
            d.line((x, yy, x + rng.randrange(18, 58), yy - 1),
                   fill=(val - 8, val - 10, val - 15), width=2)
        # Four asymmetric, elongated knots per eight-board repeat keep repetition
        # less conspicuous than putting the same dark target in every plank.
        if row % 2 == 0:
            cx, cy = 192 + (row * 113) % 640, y + 60 + row % 3 * 9
            for rx, ry in ((85, 15), (65, 11), (43, 7), (23, 4)):
                pts = [(cx + rx * math.cos(t), cy + ry * math.sin(t)
                        + 1.5 * math.cos(t * 2))
                       for t in (math.tau * j / 48 for j in range(49))]
                d.line(pts, fill=(val - 26, val - 30, val - 36), width=1)
            d.ellipse((cx - 8, cy - 2, cx + 8, cy + 3),
                      fill=(val - 65, val - 65, val - 66))
            d.line((cx + 6, cy, cx + 27, cy - 1),
                   fill=(val - 39, val - 40, val - 42), width=1)
        # Tarred caulking with one narrow rubbed bevel, staggered butt joints and
        # recessed iron pegs. Dark detail remains a tiny fraction of the board.
        d.rectangle((0, y, n, y + 2), fill=(135, 134, 127))
        d.line((0, y + 4, n, y + 4), fill=(252, 248, 237), width=2)
        d.line((0, y + 126, n, y + 126), fill=(val - 20, val - 23, val - 28))
        rd.rectangle((0, y, n, y + 4), fill=244)
        joint = (row * 271 + 150) % n
        # Wrap the whole joint, including pegs, when it straddles the repeat edge.
        for jx in (joint - n, joint, joint + n):
            d.line((jx, y + 4, jx, y + 126), fill=(143, 137, 123), width=3)
            d.line((jx + 3, y + 6, jx + 3, y + 123),
                   fill=(248, 242, 225), width=1)
            rd.line((jx, y + 4, jx, y + 126), fill=238, width=4)
            for yy in (y + 14, y + 113):
                for xx in (jx - 11, jx + 12):
                    d.ellipse((xx - 3, yy - 3, xx + 3, yy + 3), fill=(174, 167, 149))
                    d.ellipse((xx - 2, yy - 2, xx + 2, yy + 2), fill=(111, 117, 113))
                    d.line((xx - 1, yy - 1, xx + 1, yy - 1), fill=(204, 199, 178))
    _save(im, out, 'oak_basecolor.png')
    # Matched board/grain roughness rather than an unrelated wavy noise field.
    # NEAREST retains the small authored value vocabulary and predictable budget.
    rough = rough.resize((256, 256), Image.Resampling.NEAREST)
    _save(Image.merge('RGB', (Image.new('L', rough.size, 255), rough,
                              Image.new('L', rough.size, 0))), out, 'oak_orm.png')


def _canvas(out):
    n = 512
    cloth = Image.new('RGB', (n, n), (242, 237, 222))
    d = ImageDraw.Draw(cloth)
    for panel, value in enumerate((242, 236, 245, 239)):
        x = panel * 128
        d.rectangle((x, 0, x + 127, n), fill=(value, value - 5, value - 19))
        # Single-pixel fibres remain very low contrast; yarn is not a coarse grid.
        for xx in range(x + 4, x + 127, 4):
            v = value - 5 + (xx // 4) % 3
            d.line((xx, 0, xx, n), fill=(v, v - 5, v - 18))
        for y in range(0, n, 4):
            v = value - 7 + (y // 4) % 3
            d.line((x + 3, y, x + 126, y), fill=(v, v - 4, v - 16))
        # Flat-felled seam: folded fabric shadow, raised edge and paired stitches.
        d.rectangle((x, 0, x + 3, n), fill=(205, 198, 177))
        d.line((x + 5, 0, x + 5, n), fill=(251, 246, 228), width=2)
        for y in range(2, n, 10):
            d.line((x + 9, y, x + 9, y + 4), fill=(214, 204, 178))
            d.line((x + 11, y + 1, x + 11, y + 4), fill=(252, 247, 228))
    # One cross seam makes covered cargo read as sewn material, not painted wood.
    for y in (0, 256):
        d.line((0, y + 1, n, y + 1), fill=(213, 205, 184), width=2)
        d.line((0, y + 4, n, y + 4), fill=(251, 246, 229))
        for x in range(3, n, 10):
            d.line((x, y + 7, x + 4, y + 7), fill=(221, 212, 189))
    _save(cloth, out, 'canvas_basecolor.png')
    orm = Image.new('RGB', (256, 256), (255, 242, 0))
    d = ImageDraw.Draw(orm)
    for x in range(0, 256, 64):
        d.rectangle((x, 0, x + 3, 255), fill=(255, 249, 0))
    for y in range(0, 256, 8):
        d.line((0, y, 255, y), fill=(255, 238, 0))
    _save(orm, out, 'canvas_orm.png')


def _heraldic_sail(out):
    n = 1024
    rng = random.Random(928)
    sail = Image.new('RGB', (n, n), (41, 55, 66))
    d = ImageDraw.Draw(sail)
    # Indigo/charcoal sailcloth retains one clear silhouette at FPS distance.
    for panel, shift in enumerate((0, 2, -1, 1, -2, 1, 2, 0)):
        x = panel * 128
        d.rectangle((x, 0, x + 127, n), fill=(41 + shift, 55 + shift, 66 + shift))
        for xx in range(x + 4, x + 127, 4):
            v = (xx // 4) % 3
            d.line((xx, 0, xx, n), fill=(42 + shift + v, 56 + shift + v, 66 + shift + v))
        for y in range(0, n, 8):
            d.line((x + 4, y, x + 126, y), fill=(40 + shift, 54 + shift, 65 + shift))
        d.line((x, 0, x, n), fill=(30, 44, 55), width=2)
        d.line((x + 3, 0, x + 3, n), fill=(56, 68, 75), width=1)
        for y in range(6, n, 14):
            d.line((x + 7, y, x + 7, y + 5), fill=(75, 84, 85))
    for y in (340, 682):
        d.line((0, y, n, y), fill=(32, 46, 57), width=2)
        d.line((0, y + 3, n, y + 3), fill=(56, 68, 75))
        for x in range(4, n, 14):
            d.line((x, y + 6, x + 5, y + 6), fill=(74, 83, 84))
    gold, cream, shadow = (189, 151, 90), (233, 221, 184), (41, 55, 66)
    d.rectangle((32, 32, 991, 991), outline=gold, width=10)
    d.rectangle((51, 51, 972, 972), outline=(100, 104, 95), width=2)
    # Sewn hem follows the border; spacing is intentionally clear but quiet.
    for p in range(60, 965, 18):
        for y in (24, 999):
            d.line((p, y, p + 7, y), fill=(118, 116, 99), width=2)
        for x in (24, 999):
            d.line((x, p, x, p + 7), fill=(118, 116, 99), width=2)
    # Original crossed-cutlass + compass-sun identity, never a sourced logo.
    d.line((300, 750, 730, 330), fill=cream, width=27)
    d.line((294, 345, 730, 760), fill=cream, width=27)
    d.line((304, 742, 724, 332), fill=(180, 170, 142), width=6)
    d.line((302, 348, 725, 751), fill=(180, 170, 142), width=6)
    d.line((291, 679, 365, 760), fill=gold, width=24)
    d.line((658, 756, 738, 675), fill=gold, width=24)
    d.line((276, 777, 324, 728), fill=gold, width=26)
    d.line((752, 779, 707, 732), fill=gold, width=26)
    for i in range(16):
        a = math.tau * i / 16
        r = 228 if i % 2 == 0 else 204
        d.polygon([(512 + 157 * math.cos(a - .095), 490 + 157 * math.sin(a - .095)),
                   (512 + r * math.cos(a), 490 + r * math.sin(a)),
                   (512 + 157 * math.cos(a + .095), 490 + 157 * math.sin(a + .095))], fill=gold)
    d.ellipse((344, 322, 680, 658), fill=shadow, outline=cream, width=18)
    d.ellipse((367, 345, 657, 635), outline=gold, width=5)
    d.polygon([(430, 414), (466, 383), (559, 383), (596, 414),
               (578, 522), (548, 558), (476, 558), (445, 521)], fill=cream)
    d.polygon([(448, 446), (497, 455), (480, 485), (453, 476)], fill=shadow)
    d.polygon([(528, 455), (576, 446), (571, 476), (544, 485)], fill=shadow)
    d.polygon([(512, 475), (499, 506), (525, 506)], fill=shadow)
    for x in (483, 503, 523, 543):
        d.line((x, 531, x, 557), fill=shadow, width=7)
    # Sparse brush-loss outside the badge keeps its combat-distance identity clean.
    for i in range(76):
        x, y = rng.randrange(65, 959), rng.randrange(65, 959)
        if abs(x - 512) > 280 or abs(y - 490) > 300:
            d.line((x, y, x + rng.randrange(4, 18), y), fill=(65, 77, 83))
    _save(sail, out, 'blackflag_sail_basecolor.png')


def _metals(out):
    # Separate hammered iron and worn brass response, not two differently coloured
    # plastics. G=roughness, B=metallic; R stays 255 (no fabricated baked AO).
    # 128² maps deliberately use quiet broad patina, not sparkling pixel noise.
    for name, rough, metal in (('iron', 225, 229), ('brass', 168, 237),
                                ('metal', 192, 233)):
        im = Image.new('RGB', (128, 128), (255, rough, metal))
        d = ImageDraw.Draw(im)
        rng = random.Random(711 if name == 'brass' else 422)
        for j in range(20):
            x, y = rng.randrange(128), rng.randrange(128)
            rx, ry = rng.randrange(5, 21), rng.randrange(3, 12)
            # Periodic wrap prevents a seam at the repeating material boundary.
            for ox in (-128, 0, 128):
                for oy in (-128, 0, 128):
                    d.ellipse((x - rx + ox, y - ry + oy, x + rx + ox, y + ry + oy),
                              fill=(255, min(249, rough + 14), metal - 12))
        for y in range(7, 128, 21):
            d.line((0, y, 127, y), fill=(255, rough - 12, metal), width=1)
        _save(im, out, name + '_orm.png')


def painted_surfaces():
    """Paint the existing source textures and return their output directory.

    The original filenames/API are retained; iron/brass ORM variants are optional
    additional bindings. Unused legacy metal_orm remains available to old callers.
    """
    out = ROOT / 'assets/materials'
    out.mkdir(parents=True, exist_ok=True)
    _oak(out)
    _canvas(out)
    _heraldic_sail(out)
    _metals(out)
    return out
