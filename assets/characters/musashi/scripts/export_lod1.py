import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'Musashi_Runtime.blend'),load_ui=False,use_scripts=False)
s=bpy.context.scene;arm=bpy.data.objects['Musashi_Rig'];arm.data.pose_position='REST';objs=[o for o in s.objects if o.type=='MESH'];report=[]
for o in objs:
 if o.data.shape_keys:continue
 o.data.calc_loop_triangles();before=len(o.data.loop_triangles)
 if before<1000:continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 m=o.modifiers.new('LOD1 mesh reduction','DECIMATE');m.ratio=.62 if any(t in o.name for t in ['skin','stockings']) else .43;m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 o.data.calc_loop_triangles();report.append({'mesh':o.name,'before':before,'after':len(o.data.loop_triangles)})
 # Re-normalize interpolation roundoff, retaining four highest bone weights.
 for v in o.data.vertices:
  gs=sorted([(g.group,g.weight) for g in v.groups if g.weight>1e-8],key=lambda x:-x[1])[:4];total=sum(w for _,w in gs);ids={i for i,_ in gs}
  for g in list(v.groups):
   if g.group not in ids:o.vertex_groups[g.group].remove([v.index])
  for i,w in gs:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
arm.data.pose_position='POSE';s.frame_set(1);bpy.context.view_layer.update()
for o in s.objects:o.select_set(o.type in ['MESH','ARMATURE'] or o.name=='Musashi_CharacterRoot' or o.name.startswith('Attachment_'))
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Musashi_Runtime_LOD1.blend'))
kw=dict(filepath=str(R/'Musashi_Runtime_LOD1.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_skins=True,export_all_influences=False,export_morph=True,export_morph_normal=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_extras=True,export_cameras=False,export_lights=False,export_image_format='AUTO',export_texcoords=True,export_normals=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties;bpy.ops.export_scene.gltf(**{k:v for k,v in kw.items() if k in props});(R/'qa/lod1-reduction.json').write_text(json.dumps(report,indent=2))
