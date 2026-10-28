"""Render actual Blackflag GLB in neutral Blender CPU Cycles, not a runtime screenshot.
Use QA_RENDER_ROOT for a frozen baseline and QA_RENDER_OUTPUT for evidence output.
1296x864,64 samples; overview/lane share the frozen publication camera/framing.
This workflow intentionally does not approximate runtime Three.js effects or lights.
"""
import bpy,json,math,sys,os,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(os.environ.get('QA_RENDER_ROOT', str(Path(__file__).resolve().parents[2])))
OUT=Path(os.environ.get('QA_RENDER_OUTPUT', str(Path(__file__).resolve().parent/'after')));OUT.mkdir(exist_ok=True,parents=True)
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['blackflag']
def coord(v): return Vector((v[0],-v[2],v[1]))
def camera_at(scene,point,target,ortho=None):
    data=bpy.data.cameras.new('QA Camera'); obj=bpy.data.objects.new('QA Camera',data);scene.collection.objects.link(obj)
    obj.location=coord(point);obj.rotation_euler=(coord(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.lens=25;data.clip_end=1000
    if ortho: data.type='ORTHO';data.ortho_scale=ortho
    scene.camera=obj
    return obj
manifest=json.loads((OUT/'render-manifest.json').read_text()) if (OUT/'render-manifest.json').exists() else []
views=os.environ.get('QA_VIEWS','overview,lane').split(',')
lighting=os.environ.get('QA_LIGHTING','neutral')
assert lighting=='neutral', 'This independent comparison intentionally uses neutral lighting; runtime Blackflag effects are not reproduced.'
manifest=[x for x in manifest if not(x['map'] in ids and x['view'] in views)]
def linear_hex(n):
    rgb=[((n>>shift)&255)/255 for shift in (16,8,0)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
def surface_y(data,x,z,limit):
    tops=[]
    for o in data['objects']:
        if not o['collision']: continue
        px,py,pz=o['position'];w,h,d=o['size']
        if not(px-w/2<=x<=px+w/2 and pz-d/2<=z<=pz+d/2):continue
        if o['type']=='ramp':
            c,ctr,half=(x,px,w/2) if o['axis']=='x' else (z,pz,d/2)
            top=py+h*(1-max(-1,min(1,(c-ctr)/half))*o['lowAt'])/2
        else: top=py+h/2
        if top<=limit:tops.append(top)
    return max(tops) if tops else 0
for ident in ids:
    src=ROOT/'arena-maps'/ident/'assets'/f'{ident}_visual.glb'
    asset_sha=hashlib.sha256(src.read_bytes()).hexdigest()
    data=json.loads((ROOT/'arena-maps'/ident/'runtime/map.json').read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(src))
    assert hashlib.sha256(src.read_bytes()).hexdigest()==asset_sha, 'GLB changed during import; rerender required'
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=64
    scene.cycles.use_denoising=False
    scene.render.resolution_x=1296;scene.render.resolution_y=864;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform='Standard';scene.view_settings.exposure=0;scene.view_settings.gamma=1
    world=bpy.data.worlds.new('QA World');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.26,.33,.43,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.8
    sun_data=bpy.data.lights.new('QA Sun','SUN');sun_data.energy=2.3;sun_data.angle=math.radians(8)
    sun=bpy.data.objects.new('QA Sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.48,-.4,-.55)
    atmosphere=None
    lo,hi=data['bounds']['min'],data['bounds']['max'];w=hi[0]-lo[0];d=hi[2]-lo[2]
    cx,cz=(lo[0]+hi[0])/2,(lo[2]+hi[2])/2
    overview=([cx+w*.92,max(w,d)*.72,cz+d*.92],[cx,0,cz],max(w,d)*1.38)
    # Readable lane camera, independent of hidden spawn alcoves.
    lanes={'blackflag':([-17,2.0,11],[7,2,-4]),'frostcourt':([-17,1.7,11],[3,2,-3]),'camlann':([-16,1.7,11],[5,2,-5]),'sakura':([-12,1.7,17.5],[6,2,14])}
    lane=lanes.get(ident,([cx-w*.3,1.7,cz+d*.3],[cx,1.7,cz]))
    lane[0][1]=surface_y(data,lane[0][0],lane[0][2],lane[0][1]-.5)+1.7
    shots=[('overview',overview),('lane',(lane[0],lane[1],None))]
    if ident=='blackflag':
        shots.append(('rigging',([49,22,39],[0,12,0],82)))
        shots.append(('deck',([24,4.5,-10],[-22,9,2],None)))
        shots.append(('cannon',([-15,2.3,-8],[-11,.75,-13],None)))
        shots.append(('cannon-front',([-14,3.1,-16],[-11,.85,-13],None)))
        shots.append(('stern',([48,10,23],[35,4,0],None)))
    if ident=='camlann':
        shots.append(('hero',([0,surface_y(data,0,9,1.2)+1.7,9],[0,3,-15],None)))
        shots.append(('sword',([-23,surface_y(data,-23,2,1.2)+1.7,2],[-18,2,-4],None)))
    for view,(p,t,scale) in shots:
        if view not in views: continue
        camera=camera_at(scene,p,t,scale)
        scene.render.filepath=str(OUT/f'{ident}-{view}.png')
        bpy.ops.render.render(write_still=True)
        manifest.append({'map':ident,'asset':str(src.relative_to(ROOT)),'sha256':asset_sha,'sourceStillMatches':hashlib.sha256(src.read_bytes()).hexdigest()==asset_sha,'view':view,'camera':p,'target':t,'renderer':'Blender Cycles CPU','samples':64,'lighting':lighting,'eyeHeight':1.7 if view=='lane' else None,'orthographicScale':scale,'resolution':[1296,864],'lensMm':25,'atmosphereReference':atmosphere,'output':str(Path(scene.render.filepath)),'imageSha256':hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest(),'limitations':'Neutral offline actual-GLB geometry/material inspection only. Not browser/gameplay/FPS evidence. Runtime Three.js PBR hook, selective shadow policy, sky, fog, fill light, particles and postprocessing are not reproduced.'})
        bpy.data.objects.remove(camera,do_unlink=True)
(OUT/'render-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
