"""Original deterministic seamless micro-materials; no third-party/source image inputs.
Generated with Pillow. Neutral-relative colour maps multiply the authored palette;
ORM is linear packed AO/roughness/metalness, normals are tangent-space OpenGL.
"""
from pathlib import Path
import random, math, json, hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/materials';OUT.mkdir(exist_ok=True)
N=128

def tiled_noise(seed, frequency):
    r=random.Random(seed);g=[[r.uniform(-1,1) for _ in range(frequency)] for _ in range(frequency)]
    out=[]
    for y in range(N):
        row=[];yy=y/N*frequency;iy=int(yy);fy=yy-iy;fy=fy*fy*(3-2*fy)
        for x in range(N):
            xx=x/N*frequency;ix=int(xx);fx=xx-ix;fx=fx*fx*(3-2*fx)
            a=g[iy%frequency][ix%frequency]*(1-fx)+g[iy%frequency][(ix+1)%frequency]*fx
            b=g[(iy+1)%frequency][ix%frequency]*(1-fx)+g[(iy+1)%frequency][(ix+1)%frequency]*fx
            row.append(a*(1-fy)+b*fy)
        out.append(row)
    return out

def make(name,seed,kind):
    a=tiled_noise(seed,6);b=tiled_noise(seed+9,23);c=tiled_noise(seed+28,48)
    height=[];base=[];orm=[]
    for y in range(N):
        row=[]
        for x in range(N):
            n=.54*a[y][x]+.29*b[y][x]+.17*c[y][x]
            if kind=='wood': n=.45*math.sin(y/N*math.tau*13+.6*a[y][x])+.25*b[y][x]+.16*c[y][x]
            if kind=='canvas': n=.25*(math.sin(x/N*math.tau*32)+math.sin(y/N*math.tau*32))+.2*a[y][x]
            if kind=='slate': n=.45*a[y][x]+.18*math.sin(y/N*math.tau*19+.3*b[y][x])+.12*c[y][x]
            row.append(n)
            strength={'stone':11,'paving':19,'wood':26,'snow':5,'canvas':10,'slate':13}[kind]
            shade=max(0,min(255,round(240+n*strength)))
            base.append((shade,shade,shade))
            rough=max(185,min(255,round(238+n*17)))
            orm.append((max(220,min(255,round(248+n*8))),rough,255))
        height.append(row)
    normals=[]
    for y in range(N):
        for x in range(N):
            dx=(height[y][(x+1)%N]-height[y][(x-1)%N])*.3
            dy=(height[(y+1)%N][x]-height[(y-1)%N][x])*.3
            le=math.sqrt(dx*dx+dy*dy+1)
            normals.append((int((-dx/le*.5+.5)*255),int((dy/le*.5+.5)*255),int((1/le*.5+.5)*255)))
    for channel,pixels in [('basecolor',base),('orm',orm),('normal',normals)]:
        im=Image.new('RGB',(N,N));im.putdata(pixels);im.save(OUT/f'{name}_{channel}.png',optimize=True)

for i,name in enumerate(['stone','paving','wood','snow','canvas','slate']): make(name,1764+i*71,name)
manifest={'provenance':'Original deterministic mathematical material synthesis; no external imagery, scans, textures or AI image inputs.','authoringScript':'source/make_materials.py','seedBase':1764,'size':[N,N],'colour':'basecolor sRGB relative multiplier; ORM and normal linear data','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.glob('*.png'))}}
(OUT/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
