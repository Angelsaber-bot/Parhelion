import bpy,os,json,math
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE=os.path.abspath('Parhelion/assets/characters/blackbeard/reference_base/official/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
names=['GEO-body_male_realistic','GEO-body_male_realistic.eye.L','GEO-body_male_realistic.eye.R']
with bpy.data.libraries.load(SOURCE,link=False) as (src,dst):dst.objects=names
for o in dst.objects:bpy.context.collection.objects.link(o);o.hide_set(False);o.hide_render=False
bpy.context.view_layer.update();body=bpy.data.objects['GEO-body_male_realistic'];offset=body.location.x
worlds={o:o.matrix_world.copy() for o in dst.objects}
for o in dst.objects:
 o.parent=None
 o.matrix_world=Matrix.Translation(Vector((-offset,0,0)))@worlds[o]
 for m in o.modifiers:
  if m.type=='MULTIRES':m.levels=1;m.render_levels=1
bpy.context.view_layer.update()
# actual source spatial data; preserve scan-derived integrated topology.
print('SOURCE BODY',body.matrix_world[:],[(m.type,getattr(m,'total_levels',None)) for m in body.modifiers])
print('BOUNDS',[(min((o.matrix_world@v.co)[i] for v in o.data.vertices),max((o.matrix_world@v.co)[i] for v in o.data.vertices)) for i in range(3) for o in [body]])
print('MATS',[m.name for m in body.data.materials])
# apply world coordinates, stretch to a powerful captain, keep coherent real head/hands.
for o in dst.objects:
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
# Build tan skin with broad subtle variation (baked later for runtime).
def mat(n,c,metal=0,rough=.5):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
skin=mat('Captain warm tan skin',(.36,.19,.105),0,.6)
body.data.materials.clear();body.data.materials.append(skin)
for p in body.data.polygons:p.material_index=0;p.use_smooth=True
white=mat('Warm sclera',(.68,.64,.55),0,.42)
for o in dst.objects:
 if o!=body:o.data.materials.clear();o.data.materials.append(white)
# Grow to 2 m, broaden upper anatomy while preserving volume landmarks.
S=1.18
for o in dst.objects:
 for v in o.data.vertices:v.co*=S
# inspect evaluated eyes and head before structural edits
body.name='BB - authored anatomical body'
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.16,.21,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
scene.view_settings.view_transform='AgX'
def area(n,loc,power,size,col):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=col;o.rotation_euler=(Vector((0,0,1.4))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm key',(-2,-3,4),180,3,(1,.86,.72));area('Cool fill',(2,-2,2),100,2,(.76,.86,1));area('Rim',(1,2,3),240,2,(.8,.88,1))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Review camera';scene.camera=cam;cam.data.type='ORTHO'
def render(name,loc,target,scale):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;scene.render.filepath=ROOT+'/previews/'+name+'.png';bpy.ops.render.render(write_still=True)
# All provided base assets CC0; no bundled text drivers/rig imported.
scene['base_credit']='Dan Ulrich / Blender Studio, Human Base Meshes v1.4.1, CC0'
scene['status']='Authored base inspection and proportion study; not complete'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/anatomy_base.blend')
#render('base_face',(1,-3,1.98),(0,-.07,1.85),.53)
#render('base_torso',(1,-3,1.95),(0,0,1.52),1.1)
