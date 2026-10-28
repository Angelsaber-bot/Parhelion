#!/usr/bin/env python3
"""Read-only independent GLB buffer, texture/UV/channel and resource-cost audit.
No GPU context. Reports primitive counts/memory estimates, never FPS.
"""
from pathlib import Path
import struct,json,math,io,hashlib,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
failures=[];results=[]
def require(ok,message):
    if not ok:raise AssertionError(message)
def read_accessor(g,blob,index):
    a=g['accessors'][index];view=g['bufferViews'][a['bufferView']]
    components={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    code,size={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[a['componentType']]
    width=components*size;stride=view.get('byteStride',width);start=view.get('byteOffset',0)+a.get('byteOffset',0)
    require(a['count']==0 or start+(a['count']-1)*stride+width<=view.get('byteOffset',0)+view['byteLength'],'accessor overruns bufferView')
    values=[]
    for n in range(a['count']):values.extend(struct.unpack_from('<'+str(components)+code,blob,start+n*stride))
    require(all(math.isfinite(x) for x in values),'nonfinite accessor')
    return values
for ident in sys.argv[1:] or ['blackflag','frostcourt','camlann','sakura']:
    try:
        path=ROOT/'arena-maps'/ident/'assets'/f'{ident}_visual.glb';raw=path.read_bytes()
        magic,version,size=struct.unpack_from('<III',raw);require((magic,version,size)==(0x46546c67,2,len(raw)),'invalid GLB header')
        length,kind=struct.unpack_from('<II',raw,12);require(kind==0x4e4f534a,'missing JSON chunk');g=json.loads(raw[20:20+length])
        binlength,binkind=struct.unpack_from('<II',raw,20+length);require(binkind==0x004e4942,'missing binary chunk');blob=raw[28+length:28+length+binlength]
        require(len(g['buffers'])==1 and 'uri'not in g['buffers'][0],'all geometry must be embedded');require(g['buffers'][0]['byteLength']<=len(blob),'truncated embedded buffer')
        for view in g['bufferViews']:require(view.get('buffer',0)==0 and view.get('byteOffset',0)>=0 and view.get('byteOffset',0)+view['byteLength']<=len(blob),'invalid bufferView')
        images=[];encoded=0;decoded=0
        for image in g.get('images',[]):
            require('uri'not in image,'external image');view=g['bufferViews'][image['bufferView']];chunk=blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
            with Image.open(io.BytesIO(chunk))as picture:
                picture.load();width,height=picture.size;require(image['mimeType']=={'PNG':'image/png','JPEG':'image/jpeg'}[picture.format],'image MIME mismatch');require(0<width<=4096 and 0<height<=4096,'unsafe/invalid image dimensions')
                images.append({'name':image.get('name',''),'size':[width,height],'format':picture.format,'encodedBytes':len(chunk)});encoded+=len(chunk);decoded+=width*height*4
        for texture in g.get('textures',[]):
            require(0<=texture['source']<len(images),'invalid texture source')
            if 'sampler'in texture:require(0<=texture['sampler']<len(g['samplers']),'invalid sampler')
        triangles=0;primitives=0;textured=0;channels={}
        for mesh in g['meshes']:
            for primitive in mesh['primitives']:
                primitives+=1;require(primitive.get('mode',4)==4,'expected triangle primitives')
                attrs=primitive['attributes'];positions=read_accessor(g,blob,attrs['POSITION']);require(len(positions)%3==0,'position arity')
                indices=read_accessor(g,blob,primitive['indices']);require(len(indices)%3==0 and min(indices)>=0 and max(indices)<len(positions)//3,'invalid triangle indices');triangles+=len(indices)//3
                material=g['materials'][primitive['material']];pbr=material.get('pbrMetallicRoughness',{})
                require(0<=pbr.get('metallicFactor',1)<=1 and 0<=pbr.get('roughnessFactor',1)<=1,'invalid PBR factors')
                refs={name:value for name,value in {**pbr,**material}.items() if name.endswith('Texture')}
                if refs:textured+=1
                for name,ref in refs.items():
                    channels[name]=channels.get(name,0)+1;require(0<=ref['index']<len(g.get('textures',[])),'invalid material texture')
                    semantic='TEXCOORD_'+str(ref.get('texCoord',0));require(semantic in attrs,f'{name} missing {semantic}')
                    uv=read_accessor(g,blob,attrs[semantic]);require(len(uv)==len(positions)//3*2,'UV count does not match positions')
        require(triangles<60000,'geometry triangle budget exceeded')
        require(len(raw)-encoded<4000000 and encoded<1000000,'geometry/embedded-image delivery budget exceeded')
        results.append({'map':ident,'sha256':hashlib.sha256(raw).hexdigest(),'visualBytes':len(raw),'triangles':triangles,'primitives':primitives,'texturedPrimitives':textured,'channels':channels,'images':images,'embeddedImageBytes':encoded,'rgbaTextureBytes':decoded,'rgbaWithMipEstimateBytes':math.ceil(decoded*4/3)})
    except Exception as error:failures.append({'map':ident,'error':str(error)})
print(json.dumps({'scope':'offline asset structure and resource cost, not GPU/browser performance','results':results,'failures':failures},indent=2))
sys.exit(bool(failures))
