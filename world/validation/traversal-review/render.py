"""Offline actual GLB + runtime apron. Not a browser/render-engine acceptance capture."""
import bpy, sys, json, math, os
from mathutils import Vector
source,repair,out=sys.argv[sys.argv.index('--')+1:]
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
for ob in list(bpy.data.objects):
    if ob.name.startswith(('COL_','MK_')) or ob.name in ['COLLISION','MARKERS'] or ob.get('showWhen'): ob.hide_render=True
r=json.load(open(repair)); raw=r['position']; vertices=[(raw[i],-(raw[i+2]-720),raw[i+1]) for i in range(0,len(raw),3)]
faces=[(i,i+1,i+2) for i in range(0,len(vertices),3)]
mesh=bpy.data.meshes.new('RuntimeApron');mesh.from_pydata(vertices,[],faces);mesh.update()
colors=mesh.color_attributes.new(name='Timber',type='FLOAT_COLOR',domain='CORNER')
for i,loop in enumerate(mesh.loops):
    j=loop.vertex_index*3;colors.data[i].color=(*r['color'][j:j+3],1)
mat=bpy.data.materials.new('RuntimeWood');mat.use_nodes=True
node=mat.node_tree.nodes.get('Principled BSDF');node.inputs['Roughness'].default_value=.9
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Timber';mat.node_tree.links.new(vc.outputs['Color'],node.inputs['Base Color'])
mesh.materials.append(mat)
repair_ob=bpy.data.objects.new('HonnojiBridgeApproach',mesh);bpy.context.collection.objects.link(repair_ob)
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('ReviewSky');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.42,.48,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='SUN',location=(0,0,100));sun=bpy.context.object;sun.rotation_euler=(.5,-.4,-.7);sun.data.energy=2;sun.data.angle=.15
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.lens=28
cv=lambda p:Vector((p[0],-(p[2]-720),p[1]))
cam.location=cv([-36,11,765]);target=cv([-49,4.4,765]);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=1050;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
for state in ['before','after']:
    repair_ob.hide_render=state=='before';scene.render.filepath=os.path.join(os.path.abspath(out),'honnoji-'+state+'.png');bpy.ops.render.render(write_still=True)
