"""Original, tileable 256px material surfaces. Standard-library PNG writer only.

Textures are relative-colour surfaces, multiplied by the authored palette. ORM is
glTF R=occlusion/G=roughness/B=metallic; normals are derived from the same relief.
No downloaded images, external textures, baked lighting or proprietary source art.
"""
from pathlib import Path
import math, struct, zlib

SIZE=256

def png(path, pixels, width=SIZE, height=SIZE):
    def chunk(t,b): return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
    data=b''.join(b'\0'+bytes(pixels[y*width*3:(y+1)*width*3]) for y in range(height))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data,9))+chunk(b'IEND',b''))

def clamp(x): return max(0,min(255,round(x)))

def noise_grid(seed,n):
    def value(x,y):
        q=(x*374761393+y*668265263+seed*69069)&0xffffffff
        q=((q^(q>>13))*1274126177)&0xffffffff
        return ((q^(q>>16))&65535)/65535
    return [[value(x,y) for x in range(n)] for y in range(n)]

def sample(g,u,v):
    n=len(g); x,y=u*n,v*n; i,j=math.floor(x),math.floor(y); tx,ty=x-i,y-j
    tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
    a=g[j%n][i%n]*(1-tx)+g[j%n][(i+1)%n]*tx
    b=g[(j+1)%n][i%n]*(1-tx)+g[(j+1)%n][(i+1)%n]*tx
    return a*(1-ty)+b*ty

def build(root):
    root=Path(root); root.mkdir(parents=True,exist_ok=True)
    specs={}
    for seed,kind in enumerate(('fieldstone','oak','turf','earth','linen','iron'),71):
        grids=[noise_grid(seed+k*13,n) for k,n in enumerate((4,8,24,64))]
        height=[]; colour=[]; orm=[]
        for y in range(SIZE):
            for x in range(SIZE):
                u,v=x/SIZE,y/SIZE
                a,b,c,d=[sample(g,u,v) for g in grids]
                n=.45*a+.3*b+.18*c+.07*d
                if kind=='fieldstone':
                    pits=max(0,(.28-d))*.25; relief=.5+.22*n-pits
                    tone=.77+.20*n-pits*.35
                    rgb=(tone*1.01,tone,tone*.985); rough=.89+.1*c
                elif kind=='oak':
                    wave=math.sin(math.tau*u*28+a*3+b)
                    pores=abs(math.sin(math.tau*u*71+b*4))*abs(math.sin(math.tau*v*5+c*2))
                    line=max(0,(wave-.65))*.2
                    relief=.5+.055*wave+.035*c-line
                    tone=.83+.11*n-line-.035*pores
                    rgb=(tone*1.015,tone,tone*.97); rough=.76+.17*b
                elif kind=='turf':
                    relief=.5+.1*n+.035*d
                    tone=.79+.19*n; rgb=(tone*.98,tone,tone*.94); rough=.96
                elif kind=='earth':
                    relief=.5+.14*n+.055*d
                    tone=.79+.2*n; rgb=(tone,tone*.99,tone*.96); rough=.93
                elif kind=='linen':
                    weave=.5+.5*math.sin(math.tau*u*64)*math.sin(math.tau*v*64)
                    relief=.5+.08*weave; tone=.89+.08*weave+.02*a
                    rgb=(tone,tone,tone); rough=.88+.08*weave
                else:
                    scratches=max(0,math.sin(math.tau*u*53+b*5)-.95)*.5
                    relief=.5+.02*n-scratches*.1; tone=.8+.15*n+scratches
                    rgb=(tone*.98,tone,tone*1.015); rough=.6+.25*b
                colour.extend(clamp(k*255) for k in rgb)
                height.append(relief)
                orm.extend([clamp((.94+.06*n)*255),clamp(rough*255),255 if kind=='iron' else 0])
        normals=[]
        for y in range(SIZE):
            for x in range(SIZE):
                dx=(height[y*SIZE+(x+1)%SIZE]-height[y*SIZE+(x-1)%SIZE])*7
                dy=(height[((y+1)%SIZE)*SIZE+x]-height[((y-1)%SIZE)*SIZE+x])*7
                l=math.sqrt(dx*dx+dy*dy+1)
                normals.extend([clamp((.5-dx/l*.5)*255),clamp((.5-dy/l*.5)*255),clamp((.5+.5/l)*255)])
        for channel,pixels in [('basecolor',colour),('orm',orm),('normal',normals)]: png(root/f'{kind}_{channel}.png',pixels)
        specs[kind]=dict(baseColor=root/f'{kind}_basecolor.png',orm=root/f'{kind}_orm.png',normal=root/f'{kind}_normal.png',normalScale=.38,scale=.65)
    return specs


def ground_atlas(path, tracks):
    """Paint worn trails into the one continuous collision-floor surface.
    No raised paper decals, coplanar overlaps or shadow-casting path-edge sheets.
    Atlas is full-colour with UV [0,1] over 64x48m, not a repeating surface tile.
    """
    width,height=512,384
    broad,small=noise_grid(467,10),noise_grid(83,48)
    segments=[]
    for points,half_width in tracks:
        for (ax,az),(bx,bz) in zip(points,points[1:]):
            dx,dz=bx-ax,bz-az
            segments.append((ax,az,dx,dz,dx*dx+dz*dz,half_width))
    pixels=[]
    for j in range(height):
        v=(j+.5)/height; z=v*48-24
        for i in range(width):
            u=(i+.5)/width; x=u*64-32
            a,b=sample(broad,u,v),sample(small,u,v)
            d=100
            for ax,az,dx,dz,ll,half_width in segments:
                t=max(0,min(1,((x-ax)*dx+(z-az)*dz)/ll))
                d=min(d,math.hypot(x-ax-dx*t,z-az-dz*t)-half_width)
            # Irregular, smoothly worn margins. Coarse turf variation stays subtle,
            # unlike a patchwork of differently coloured square terrain cells.
            t=max(0,min(1,(d+.32+(b-.5)*.38)/.8)); t=t*t*(3-2*t)
            grass=(145+12*a,167+14*a,107+11*a)
            soil=(187+10*a,164+9*a,123+9*a)
            tone=.95+.05*b
            pixels.extend(clamp((soil[k]*(1-t)+grass[k]*t)*tone) for k in range(3))
    png(Path(path),pixels,width,height)
