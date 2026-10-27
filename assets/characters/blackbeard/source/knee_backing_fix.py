import bpy,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blackbeard_editable.blend',use_scripts=False)
rig=bpy.data.objects['Blackbeard_Rig'];scene=bpy.context.scene;body=bpy.data.objects['BB - authored anatomical body'];socket=bpy.data.objects['Blackbeard_Muzzle']
rig.animation_data.action=None
for p in rig.pose.bones:p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
m=bpy.data.materials.new('BB dark knee padded backing');m.diffuse_color=(.023,.016,.013,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Roughness'].default_value=.85
for s in [-1,1]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(s*.19,-.145,.615));o=bpy.context.object;o.name='BB fitted knee padded backing '+str(s);o.scale=(.073,.087,.141)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 g=o.vertex_groups.new(name='Shin.'+('L'if s>0 else'R'));g.add(list(range(len(o.data.vertices))),1,'REPLACE');mo=o.modifiers.new('Blackbeard deform','ARMATURE');mo.object=rig;o.parent=rig;o['runtime_group']='costume'
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
scene['knee_backing']='Fitted dark padding joins stand-off knee shells to shin; rigid Shin weights'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_editable.blend',compress=True)
p=open(ROOT+'/source/integrate_runtime.py').read();exec(p[p.index('# Runtime copy:'):])
