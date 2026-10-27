from PIL import Image
import numpy as np
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'textures';p.mkdir(exist_ok=True)
rng=np.random.default_rng(439);n=512;y,x=np.mgrid[:n,:n]
weave=.5*np.sin(x*np.pi/3)*np.sin(y*np.pi/3)+.25*np.sin((x+y)*np.pi/6)
noise=rng.normal(0,1,(n,n));fine=weave*.045+noise*.012
colors={'umber_weave':(.043,.022,.019),'crimson_weave':(.20,.012,.016),'dark_leather':(.025,.011,.008)}
for name,c in colors.items():
 f=fine if 'weave' in name else noise*.025+.018*np.sin(x/22)*np.sin(y/31)
 rgb=np.clip(np.array(c)[None,None,:]*(1+f[:,:,None]),0,1)
 srgb=np.where(rgb<=.0031308,rgb*12.92,1.055*rgb**(1/2.4)-.055)
 Image.fromarray(np.uint8(np.clip(srgb*255,0,255)),'RGB').save(p/(name+'.png'))
h=weave*.10;dy,dx=np.gradient(h);norm=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);norm/=np.linalg.norm(norm,axis=-1)[:,:,None]
Image.fromarray(np.uint8((norm*.5+.5)*255),'RGB').save(p/'woven_normal.png')
