"""Render the actual exported GLB with Blender CPU Cycles, not runtime screenshots.
blender -b --factory-startup -t 4 --python docs/chapter-qa/render_arena_assets.py -- blackflag frostcourt camlann
Outputs low-cost 960x640 overview and lane views alongside a reproducibility manifest.
"""
import bpy,json,math,sys,os,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/os.environ.get('QA_RENDER_OUTPUT','docs/chapter-qa/renders');OUT.mkdir(exist_ok=True)
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['blackflag','frostcourt','camlann']
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
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32
    scene.cycles.use_denoising=False
    scene.render.resolution_x=960;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform='Standard';scene.view_settings.exposure=0;scene.view_settings.gamma=1
    world=bpy.data.worlds.new('QA World');world.use_nodes=True;scene.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.26,.33,.43,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.8
    sun_data=bpy.data.lights.new('QA Sun','SUN');sun_data.energy=2.3;sun_data.angle=math.radians(8)
    sun=bpy.data.objects.new('QA Sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(.48,-.4,-.55)
    atmosphere=None
    if lighting=='runtime-informed':
        preset=data.get('presentation',{}).get('preset','day')
        atmosphere=json.loads((ROOT/'docs/chapter-qa/runtime-atmosphere-snapshot.json').read_text())[preset]
        scene.view_settings.exposure=math.log2(atmosphere['exposure'])
        sun_data.color=linear_hex(atmosphere['sun']['color']);sun_data.energy=atmosphere['sun']['intensity']
        sun.rotation_euler=(-coord(atmosphere['sun']['pos'])).to_track_quat('-Z','Y').to_euler()
        nodes=world.node_tree.nodes;links=world.node_tree.links
        ambient=nodes['Background'];ambient.inputs[0].default_value=(*linear_hex(atmosphere['hemi'][0]),1);ambient.inputs[1].default_value=atmosphere['hemi'][2]*.45
        camera_bg=nodes.new('ShaderNodeBackground');camera_bg.inputs[0].default_value=(*linear_hex(atmosphere['background']),1);camera_bg.inputs[1].default_value=1
        ray=nodes.new('ShaderNodeLightPath');mix=nodes.new('ShaderNodeMixShader')
        links.new(ray.outputs['Is Camera Ray'],mix.inputs[0]);links.new(ambient.outputs[0],mix.inputs[1]);links.new(camera_bg.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes['World Output'].inputs['Surface'])
    lo,hi=data['bounds']['min'],data['bounds']['max'];w=hi[0]-lo[0];d=hi[2]-lo[2]
    cx,cz=(lo[0]+hi[0])/2,(lo[2]+hi[2])/2
    overview=([cx+w*.92,max(w,d)*.72,cz+d*.92],[cx,0,cz],max(w,d)*1.38)
    # Readable lane camera, independent of hidden spawn alcoves.
    lanes={'blackflag':([-17,2.0,11],[7,2,-4]),'frostcourt':([-17,1.7,11],[3,2,-3]),'camlann':([-16,1.7,11],[5,2,-5]),'sakura':([-12,1.7,17.5],[6,2,14])}
    lane=lanes.get(ident,([cx-w*.3,1.7,cz+d*.3],[cx,1.7,cz]))
    lane[0][1]=surface_y(data,lane[0][0],lane[0][2],lane[0][1]-.5)+1.7
    shots=[('overview',overview),('lane',(lane[0],lane[1],None))]
    if ident=='camlann':
        shots.append(('hero',([0,surface_y(data,0,9,1.2)+1.7,9],[0,3,-15],None)))
        shots.append(('sword',([-23,surface_y(data,-23,2,1.2)+1.7,2],[-18,2,-4],None)))
    for view,(p,t,scale) in shots:
        if view not in views: continue
        camera=camera_at(scene,p,t,scale)
        scene.render.filepath=str(OUT/f'{ident}-{view}.png')
        bpy.ops.render.render(write_still=True)
        manifest.append({'map':ident,'asset':str(src.relative_to(ROOT)),'sha256':asset_sha,'sourceStillMatches':hashlib.sha256(src.read_bytes()).hexdigest()==asset_sha,'view':view,'camera':p,'target':t,'renderer':'Blender Cycles CPU','samples':32,'lighting':lighting,'eyeHeight':1.7 if view!='overview' else None,'atmosphereReference':atmosphere,'output':str(Path(scene.render.filepath).relative_to(ROOT)),'limitations':'Offline GLB inspection only. Not browser/gameplay proof or GPU FPS. Runtime-informed option approximates source sun/ambient/exposure; Three PBR/cel hook, particles, sky, fog, postprocessing and shadows are not reproduced exactly.'})
        bpy.data.objects.remove(camera,do_unlink=True)
(OUT/'render-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
