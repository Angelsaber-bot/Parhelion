"""Export disposable optimized scene, retain authored .blend components separately."""
import bpy,json,sys,hashlib
from pathlib import Path
from mathutils import Matrix
R=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'Musashi_Animated_Working.blend'),load_ui=False,use_scripts=False)
sc=bpy.context.scene;arm=bpy.data.objects['Musashi_Rig'];arm.data.pose_position='REST';sc.frame_set(1)
face=next(o for o in sc.objects if o.type=='MESH' and o.data.shape_keys)
def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.hide_set(False);o.select_set(True);bpy.context.view_layer.objects.active=o
def tri(o):o.data.calc_loop_triangles();return len(o.data.loop_triangles)
objs=[o for o in sc.objects if o.type=='MESH'];report={'source_objects':len(objs),'face_morphs':len(face.data.shape_keys.key_blocks)-1,'limitations':['Procedural textile micro-bump omitted from runtime PBR; sculpted seams and metal details retained.','No browser/GPU render tested; Node Three geometry test separate.']}
# Apply only static geometry modifiers; never the armature or facial morphs.
for o in objs:
 if o==face:continue
 active(o)
 for m in list(o.modifiers):
  if m.type=='ARMATURE':continue
  if m.type=='SOLIDIFY':
   # double-sided garment/hair shader avoids duplicate interior polygons.
   o.modifiers.remove(m);continue
  if m.type=='BEVEL':m.segments=1
  bpy.ops.object.modifier_apply(modifier=m.name)
report['triangles_before_reduction']=sum(tri(o) for o in objs)
# Preserve anatomical/face topology. Reduce high-density purely decorative procedural ribbons.
for o in objs:
 if o==face or 'adult base anatomy' in o.name or 'stocking' in o.name or 'arm cover' in o.name:continue
 if tri(o)>1200:
  active(o);m=o.modifiers.new('Runtime redundant-surface reduction','DECIMATE');m.ratio=.68 if 'Hair' in o.name else .75;m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
# Normalize at most four actual bone influences; fail instead of silently assigning holes.
unweighted=[]
for o in objs:
 valid={g.index:g for g in o.vertex_groups if g.name in arm.data.bones}
 for v in o.data.vertices:
  weights=sorted([(g.group,g.weight) for g in v.groups if g.group in valid and g.weight>1e-8],key=lambda g:-g[1])[:4]
  if not weights:unweighted.append((o.name,v.index));continue
  total=sum(w for _,w in weights);keep={i for i,_ in weights}
  for g in list(v.groups):
   if g.group not in keep:o.vertex_groups[g.group].remove([v.index])
  for i,w in weights:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
 if not o.data.uv_layers:raise RuntimeError('Missing UV '+o.name)
if unweighted:raise RuntimeError('Unweighted vertices '+repr(unweighted[:20]))
# Keep PBR exporter supported and explicitly double-sided for open tailored surfaces.
for ma in {m for o in objs for m in o.data.materials if m}:
 ma.use_backface_culling=False;p=ma.node_tree.nodes.get('Principled BSDF')
 if p and 'Sheen Weight' in p.inputs:
  sw=p.inputs['Sheen Weight'].default_value
  if sw>0:
   tint=p.inputs['Sheen Tint'].default_value;p.inputs['Sheen Tint'].default_value=(*[tint[i]*sw for i in range(3)],1);p.inputs['Sheen Weight'].default_value=1
 if p and p.inputs['Normal'].is_linked:
  for l in list(p.inputs['Normal'].links):ma.node_tree.links.remove(l)
# Separate two-material blade so all runtime pieces consolidate by actual PBR material.
for o in list(objs):
 if o==face or len(o.data.materials)<2:continue
 active(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
objs=[o for o in sc.objects if o.type=='MESH'];groups={}
for o in objs:
 if o==face:continue
 key=tuple(m.name for m in o.data.materials);groups.setdefault(key,[]).append(o)
for key,items in groups.items():
 if len(items)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
 o=items[0];o.name='Musashi_Runtime_'+key[0]
 mods=[m for m in o.modifiers if m.type=='ARMATURE']
 if not mods:m=o.modifiers.new('Skin','ARMATURE');m.object=arm
 for m in mods[1:]:o.modifiers.remove(m)
# A single root gives correct metre scale without resampling facial targets or skeleton.
root=bpy.data.objects.new('Musashi_CharacterRoot',None);sc.collection.objects.link(root)
objs=[o for o in sc.objects if o.type=='MESH']
for o in [arm]+objs:
 if o.parent is None:
  mw=o.matrix_world.copy();o.parent=root;o.matrix_world=mw
root.scale=(.72,)*3;root['body_height_m']=2.324*.72;root['source_up']='+Z';root['gltf_up']='+Y';root['gltf_forward']='+Z';root['in_place_clips']=True
arm.data.pose_position='POSE';arm.animation_data.action=bpy.data.actions['Idle'];sc.frame_set(1);bpy.context.view_layer.update()
report.update(runtime_objects=len(objs),runtime_triangles=sum(tri(o) for o in objs),materials=len({m for o in objs for m in o.data.materials}),bones=len(arm.data.bones),unweighted_vertices=len(unweighted),scale=.72,clips=[a.name for a in bpy.data.actions])
sc['Runtime_QA_Build']=json.dumps(report);(R/'qa/runtime-build.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Musashi_Runtime.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
 if o.type in ['MESH','ARMATURE'] or o==root or o.name.startswith('Attachment_'):o.select_set(True)
kw=dict(filepath=str(R/'Musashi_Runtime.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_skins=True,export_all_influences=False,export_morph=True,export_morph_normal=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO',export_texcoords=True,export_normals=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties;bpy.ops.export_scene.gltf(**{k:v for k,v in kw.items() if k in props})
print(json.dumps(report,indent=2))
