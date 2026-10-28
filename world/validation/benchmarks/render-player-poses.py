"""Offline CPU Blender review of exported runtime GLBs. Not a game renderer/FPS benchmark."""
import bpy,sys,os,math
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];directory=args[0]
views=[('ready','front',0),('ready','back',math.pi),('ready','side',math.pi/2),('aim','threequarter',.6),('aim_up','side',math.pi/2),('aim_down','side',math.pi/2),('aim_down','front',0),('aim_up','front',0),('run','threequarter',.6),('swim','side',math.pi/2),('glide','back',math.pi)]
for pose,view,angle in views:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=os.path.join(directory,pose+'.glb'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=False
 scene.render.resolution_x=700;scene.render.resolution_y=850;scene.render.resolution_percentage=100
 scene.world.color=(.18,.18,.18)
 # glTF +Y up imports as Blender +Z; glTF +Z front becomes Blender -Y.
 target=Vector((0,0,.95));distance=4
 bpy.ops.object.camera_add(location=(distance*math.sin(angle),-distance*math.cos(angle),1.25));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.45;scene.camera=cam
 for location,energy,size in [((3,-4,5),500,4),((-3,-2,3),350,3),((1,3,4),450,3)]:
  bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
 scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.65;scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(directory,pose+'-'+view+'.png');bpy.ops.render.render(write_still=True)
