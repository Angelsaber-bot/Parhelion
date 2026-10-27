"""Static GLB of the actual authored reference pose; primary GLB remains skinned."""
import bpy
from pathlib import Path
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'Musashi_Reference_Presentation.blend'),load_ui=False,use_scripts=False)
s=bpy.context.scene;arm=bpy.data.objects['Musashi_Rig'];arm.animation_data.action=bpy.data.actions['ReferencePose'];s.frame_set(1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();copies=[]
for o in list(s.objects):
 if o.type!='MESH' or o.hide_render:continue
 ev=o.evaluated_get(dg);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=dg);n=bpy.data.objects.new('ReferencePose_'+o.name,me);s.collection.objects.link(n);n.matrix_world=o.matrix_world;copies.append(n)
for ma in {m for o in copies for m in o.data.materials if m}:
 p=ma.node_tree.nodes.get('Principled BSDF')
 if p and 'Sheen Weight' in p.inputs:
  sw=p.inputs['Sheen Weight'].default_value
  if sw>0:
   tint=p.inputs['Sheen Tint'].default_value;p.inputs['Sheen Tint'].default_value=(*[tint[i]*sw for i in range(3)],1);p.inputs['Sheen Weight'].default_value=1
root=bpy.data.objects.new('Musashi_ReferencePoseRoot',None);s.collection.objects.link(root)
for o in copies:mw=o.matrix_world.copy();o.parent=root;o.matrix_world=mw
root.scale=(.72,)*3;root['purpose']='Static presentation of actual model geometry. Use Musashi_Runtime.glb for skeletal gameplay.'
bpy.ops.object.select_all(action='DESELECT')
for o in copies+[root]:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'Musashi_ReferencePose.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_skins=False,export_extras=True,export_cameras=False,export_lights=False)
