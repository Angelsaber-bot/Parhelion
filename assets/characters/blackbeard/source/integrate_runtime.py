import bpy,os,json,math,bmesh
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/costume_complete.blend',load_ui=False,use_scripts=False)
# Append only the validated native rig; no scripts or external driver execution.
with bpy.data.libraries.load(ROOT+'/rig/rigged_body.blend',link=False) as(src,dst):dst.objects=['Blackbeard_Rig'];dst.actions=[n for n in src.actions if n in ['Idle','Walk','Run','Attack','Melee']]
rig=dst.objects[0];bpy.context.collection.objects.link(rig)
rig.animation_data_create();rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=True
for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
body=bpy.data.objects['BB - authored anatomical body'];body.data.name='Blackbeard_Anatomy';data=json.load(open(ROOT+'/rig/body_weights.json'));assert len(body.data.vertices)==data['vertex_count']
for g in list(body.vertex_groups):body.vertex_groups.remove(g)
for n in data['groups']:body.vertex_groups.new(name=n)
for idx,ws in enumerate(data['weights']):
 for n,w in ws:body.vertex_groups[n].add([idx],w,'REPLACE')
mo=body.modifiers.new('Blackbeard deform','ARMATURE');mo.object=rig;body.parent=rig
# Spatial weight map used for gloves and harness (matching authored anatomy).
kdt=KDTree(len(body.data.vertices))
for v in body.data.vertices:kdt.insert(v.co,v.index)
kdt.balance()
manifest=json.load(open(ROOT+'/rig/rig_manifest.json'))
# Load firearm with its inspected source hierarchy intact, then transform its meshes once.
with bpy.data.libraries.load(ROOT+'/weapon/blackbeard_flintlock_editable.blend',link=False) as(src,dst):dst.objects=[n for n in src.objects if not any(t in n.lower() for t in ['camera','light','floor','studio'])]
weaponobjs=[o for o in dst.objects if o]
for o in weaponobjs:
 if not o.users_collection:bpy.context.collection.objects.link(o)
bpy.context.view_layer.update();W=Matrix(manifest['weapon_attachment']['rest_world_matrix'])
# Use precomputed world matrices before clearing parents to avoid double transforms.
wm={o:o.matrix_world.copy() for o in weaponobjs}
for o in weaponobjs:
 o.parent=None;o.matrix_world=W@wm[o]
 if o.type=='MESH':o['bind_region']='Hand.R';o['runtime_group']='firearm'
# Muzzle socket parented as a named attachment bone-independent empty.
bpy.ops.object.empty_add(type='ARROWS');socket=bpy.context.object;socket.name='Blackbeard_Muzzle';socket.matrix_world=W@Matrix.Translation(Vector((0,-.467,.138)));socket.parent=rig;socket.parent_type='BONE';socket.parent_bone='Hand.R';socket.matrix_world=W@Matrix.Translation(Vector((0,-.467,.138)));socket['role']='firearm muzzle / VFX attach'
# Convert all renderable geometry to exportable meshes, preserving original shape under modifiers.
geom=[]
for o in list(bpy.context.scene.objects):
 if o.type not in {'MESH','CURVE'} or o.name=='Studio floor':continue
 if o==body:geom.append(o);continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.type=='CURVE':bpy.ops.object.convert(target='MESH');o=bpy.context.object
 else:
  for m in list(o.modifiers):
   if m.type!='ARMATURE':
    try:bpy.ops.object.modifier_apply(modifier=m.name)
    except RuntimeError:pass
 # Bake geometry world transform before all weight logic.
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for g in list(o.vertex_groups):o.vertex_groups.remove(g)
 for n in data['groups']:o.vertex_groups.new(name=n)
 name=o.name
 if o.get('bind_region'):fixed=o['bind_region']
 elif any(q in name for q in ['iris','pupil','catchlight','tooth','hair','beard','brow','crown','fringe','nape','sideburn','moustache','root cap','ear hoop']) and 'chest hair' not in name:fixed='Head'
 elif '.eye.' in name:fixed='Head'
 elif 'chest hair' in name or 'harness' in name:fixed='Chest'
 elif any(q in name for q in ['waist','yoke','central black','codpiece','lace','chain']):fixed='Hips'
 else:fixed=None
 for v in o.data.vertices:
  if fixed:ws=[(fixed,1)]
  elif any(q in name for q in ['boot','sole','toe armor','fur band','fur tuft','linen boot','knee']):
   side='L' if v.co.x>=0 else 'R'
   if 'knee' in name:ws=[('Shin.'+side,1)]
   elif v.co.z<.17:ws=[('Foot.'+side,1)]
   else:ws=[('Shin.'+side,1)]
  elif any(q in name for q in ['trouser leg','crimson inset','red leg seam','gathered crimson']):
   side='L' if v.co.x>=0 else 'R';z=v.co.z
   if z>1.04:ws=[('Hips',1)]
   elif z>.88:t=(z-.88)/.16;ws=[('Hips',t),('Thigh.'+side,1-t)]
   elif z<.69:t=max(0,min(1,(z-.56)/.13));ws=[('Thigh.'+side,t),('Shin.'+side,1-t)]
   else:ws=[('Thigh.'+side,1)]
  else:
   _,idx,d=kdt.find(v.co);ws=data['weights'][idx]
  for n,w in ws:
   if w>.0001:o.vertex_groups[n].add([v.index],w,'REPLACE')
 mo=o.modifiers.new('Blackbeard deform','ARMATURE');mo.object=rig;o.parent=rig
 if o.get('runtime_group')!='firearm':o['runtime_group']='hair' if fixed=='Head' else 'costume'
 geom.append(o)
# Cull the body under closed trousers/boots AFTER preserving vertex-index weights.
# Hands remain untouched because of the explicit lateral condition.
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.10 and abs(v.co.x)<(.30 if v.co.z>1.0 else .40)],context='VERTS');bm.to_mesh(body.data);bm.free();body.data.update()
# Organized editable mesh components; retain separate names here.
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=91;scene.render.fps=30;scene['status']='Reconstructed Blackbeard runtime candidate; user art acceptance pending'
scene['base_license']='CC0: Dan Ulrich / Blender Studio Human Base Meshes v1.4.1'
scene['character_reference']='User-selected FGO Blackbeard design; derivative fan interpretation; no game meshes copied'
# No class system is assigned to this character.
rig.animation_data.action=bpy.data.actions.get('Idle');scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_editable.blend',compress=True)
# Runtime copy: consolidate weighted pieces for reasonable draw calls; materials retain boundaries.
rig.animation_data.action=None
for p in rig.pose.bones:p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
for group in ['hair','costume','firearm']:
 obs=[o for o in list(scene.objects) if o.type=='MESH' and o!=body and o.get('runtime_group')==group]
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='Blackbeard_'+group;o.data.name=o.name
rig.animation_data.action=bpy.data.actions.get('Idle');scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in scene.objects:
 if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers):o.select_set(True)
socket.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/blackbeard.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_frame_range=False,export_skins=True,export_all_influences=False,export_extras=True,export_materials='EXPORT')
# Also preserve the exact optimized runtime scene for later fixes/QA.
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_runtime.blend',compress=True)
