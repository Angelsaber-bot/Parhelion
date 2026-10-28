"""Original painted BLACKFLAG surfaces; deterministic Pillow raster + embedded glTF UVs.
No sourced textures, network downloads, Blender dependency, or additional draw calls.
"""
from pathlib import Path
import math, random
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]

def painted_surfaces():
    out=ROOT/'assets/materials';out.mkdir(exist_ok=True)
    n=1024;rng=random.Random(2048)
    # Neutral oak modulation: the authored material colour remains the art direction.
    im=Image.new('RGB',(n,n));d=ImageDraw.Draw(im)
    for row in range(8):
        y=row*128; val=rng.randrange(220,250)
        d.rectangle((0,y,n,y+127),fill=(val,val-3,val-8))
        d.line((0,y,n,y),fill=(150,144,135),width=3)
        d.line((0,y+4,n,y+4),fill=(253,250,241),width=2)
        for i in range(32):
            base=y+rng.randrange(8,123); phase=rng.random()*math.tau; amp=rng.uniform(.7,3)
            pts=[(x,base+amp*math.sin(x/70+phase)+.7*math.sin(x/18+phase)) for x in range(-8,1034,8)]
            g=val-rng.randrange(10,32);d.line(pts,fill=(g,g-4,g-10),width=rng.choice([1,1,2]))
        joint=(row*271+150)%1024
        d.line((joint,y+3,joint,y+126),fill=(158,149,133),width=3)
        d.line((joint+4,y+3,joint+4,y+124),fill=(252,249,235),width=1)
        for yy in (y+13,y+114):
            for xx in (joint-11,joint+12): d.ellipse((xx-2,yy-2,xx+2,yy+2),fill=(130,128,119))
        # Elongated knot and tapered grain; limited, readable, not photographic noise.
        cx=(row*183+430)%1024;cy=y+64
        for rad in (10,17,25,35): d.ellipse((cx-rad*2.8,cy-rad*.32,cx+rad*2.8,cy+rad*.32),outline=(val-30,val-34,val-40),width=1)
        d.ellipse((cx-7,cy-3,cx+7,cy+3),fill=(val-66,val-66,val-65))
    im.save(out/'oak_basecolor.png',optimize=True)
    # Low contrast woven canvas, used on sail and tied cargo. Broader brush variation survives mipmaps.
    cloth=Image.new('RGB',(512,512),(243,239,226));d=ImageDraw.Draw(cloth)
    for i in range(0,512,4):
        v=230+(i//4)%4*3;d.line((0,i,512,i),fill=(v,v-4,v-11));d.line((i,0,i,512),fill=(v+4,v,v-8))
    for i in range(10):
        x=i*64;d.line((x,0,x,512),fill=(210,202,180),width=2);d.line((x+4,0,x+4,512),fill=(255,251,237),width=1)
    cloth.save(out/'canvas_basecolor.png',optimize=True)
    # A deliberately designed heraldic sun / crossed cutlasses, not a borrowed skull/logo.
    sail=Image.new('RGB',(1024,1024),(41,55,66));d=ImageDraw.Draw(sail)
    for i in range(0,1024,4):
        v=48+(i//4)%5;d.line((i,0,i,1024),fill=(v-9,v+4,v+14),width=1)
    for x in range(0,1024,128): d.line((x,0,x,1024),fill=(58,72,80),width=3)
    gold=(189,151,90);cream=(233,221,184)
    d.rectangle((32,32,991,991),outline=gold,width=12);d.rectangle((52,52,971,971),outline=(100,104,95),width=3)
    # Sword silhouettes: simple readable gold shapes beneath a compass-sun crest.
    d.line((300,750,730,330),fill=cream,width=27);d.line((294,345,730,760),fill=cream,width=27)
    d.line((291,679,365,760),fill=gold,width=24);d.line((658,756,738,675),fill=gold,width=24)
    d.line((276,777,324,728),fill=gold,width=26);d.line((752,779,707,732),fill=gold,width=26)
    for i in range(16):
        a=math.tau*i/16;r=228 if i%2==0 else 204
        pts=[(512+157*math.cos(a-.095),490+157*math.sin(a-.095)),(512+r*math.cos(a),490+r*math.sin(a)),(512+157*math.cos(a+.095),490+157*math.sin(a+.095))]
        d.polygon(pts,fill=gold)
    d.ellipse((344,322,680,658),fill=(41,55,66),outline=cream,width=18)
    d.ellipse((367,345,657,635),outline=gold,width=5)
    # Original helm mask inside sun, clear at distance.
    d.polygon([(430,414),(466,383),(559,383),(596,414),(578,522),(548,558),(476,558),(445,521)],fill=cream)
    d.polygon([(448,446),(497,455),(480,485),(453,476)],fill=(41,55,66))
    d.polygon([(528,455),(576,446),(571,476),(544,485)],fill=(41,55,66))
    d.polygon([(512,475),(499,506),(525,506)],fill=(41,55,66))
    for x in (483,503,523,543):d.line((x,531,x,557),fill=(41,55,66),width=7)
    # Edge sun fade and sparse scuffs; no alpha means no transparency sorting cost.
    for i in range(130):
        x=rng.randrange(58,970);y=rng.randrange(60,970)
        if abs(x-512)>280 or abs(y-490)>300:d.line((x,y,x+rng.randrange(3,16),y+1),fill=(70,81,84),width=1)
    sail.save(out/'blackflag_sail_basecolor.png',optimize=True)
    # Packed metallic-roughness: glTF G=roughness, B=metal. Share per category.
    for category,rough,metal in [('oak',210,0),('canvas',240,0),('metal',125,220)]:
        orm=Image.new('RGB',(256,256));pix=orm.load()
        for y in range(256):
            for x in range(256):
                wav=int(9*math.sin(x*.11+math.sin(y*.19)*2)+5*math.cos(y*.21))
                pix[x,y]=(255,max(0,min(255,rough+wav)),metal)
        orm.save(out/f'{category}_orm.png',optimize=True)
    return out
