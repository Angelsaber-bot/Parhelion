import bpy,os,json,hashlib,sys
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));MAIN=os.path.dirname(ROOT)
source=MAIN+'/blackbeard_runtime.blend';hashbefore=hashlib.sha256(open(source,'rb').read()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=source,load_ui=False,use_scripts=False)
rig=bpy.data.objects['Blackbeard_Rig'];assert rig.type=='ARMATURE' and 'Head' in rig.data.bones
names=['Idle','Walk','Run','Attack','Melee'];assert all(n in bpy.data.actions for n in names)
rig.animation_data_create();rig.animation_data.action=None
for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
with bpy.data.libraries.load(ROOT+'/blackbeard_tricorn_editable.blend',link=False) as(src,dst):dst.collections=['BLACKBEARD - Optional tricorn']
collection=dst.collections[0];bpy.context.scene.collection.children.link(collection)
obs=[o for o in collection.objects if o.type=='MESH'];assert len(obs)==15
bpy.context.view_layer.update();world={o:o.matrix_world.copy() for o in obs}
for o in obs:
 o.parent=None;o.matrix_world=world[o]
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for o in list(collection.objects):
 if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in obs:o.select_set(True)
bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='Blackbeard_optional_tricorn'
for g in list(o.vertex_groups):o.vertex_groups.remove(g)
g=o.vertex_groups.new(name='Head');g.add(list(range(len(o.data.vertices))),1.0,'REPLACE')
mod=o.modifiers.new('Rigid Head attachment','ARMATURE');mod.object=rig;wm=o.matrix_world.copy();o.parent=rig;o.matrix_world=wm
o['optional_accessory']=True;o['variant']='tricorn';o['bind_bone']='Head';o['source']='Original Parhelion hat geometry and materials'
# Existing actions and socket are preserved exactly; export from Idle frame 1.
scene=bpy.context.scene;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1);scene['variant']='Optional tricorn equipped';scene['source_main_sha256']=hashbefore
socket=bpy.data.objects.get('Blackbeard_Muzzle');assert socket is not None
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);socket.select_set(True)
for x in scene.objects:
 if x.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in x.modifiers):x.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/blackbeard_tricorn.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_frame_range=False,export_skins=True,export_all_influences=False,export_extras=True,export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_tricorn_runtime.blend',compress=True)
if '--export-only' in sys.argv:
 report={'source_main_sha256':hashbefore,'source_main_unchanged':hashbefore==hashlib.sha256(open(source,'rb').read()).hexdigest(),'actions_preserved':names,'muzzle_socket':socket.name,'hat_binding':'All vertices Head=1.0; preserve rest-world coordinates','hat_mesh':o.name,'hat_vertices':len(o.data.vertices),'hat_materials':len(o.data.materials),'preview_note':'Static Idle and face geometry unchanged by Walk/Run footplant revision; retained actual previews.'}
 open(ROOT+'/qa/runtime_variant_native.json','w').write(json.dumps(report,indent=2));print(report);sys.exit(0)
# Actual assembled-variant renders. No geometry or source-main writes occur after this.
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=1100;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
cam=scene.camera;cam.data.type='ORTHO';cam.location=(3,-5,2.8);cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.50;scene.render.filepath=ROOT+'/previews/05_runtime_variant_full.png';bpy.ops.render.render(write_still=True)
if '--full-only' not in sys.argv:
 scene.render.resolution_x=1100;scene.render.resolution_y=1100;cam.location=(.7,-2.3,2.14);cam.rotation_euler=(Vector((0,-.03,1.90))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.70;scene.render.filepath=ROOT+'/previews/06_runtime_variant_face.png';bpy.ops.render.render(write_still=True)
report={'source_main_sha256':hashbefore,'source_main_unchanged':hashbefore==hashlib.sha256(open(source,'rb').read()).hexdigest(),'actions_preserved':names,'muzzle_socket':socket.name,'hat_binding':'All vertices Head=1.0; preserve rest-world coordinates','hat_mesh':o.name,'hat_vertices':len(o.data.vertices),'hat_materials':len(o.data.materials)}
open(ROOT+'/qa/runtime_variant_native.json','w').write(json.dumps(report,indent=2));print(report)
