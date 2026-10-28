"""Offline actual exported-GLB field preview; not a browser or runtime screenshot."""
import bpy, sys, json, math, os
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; source,out,manifest=args
os.makedirs(out,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
data=json.load(open(manifest)); scene=bpy.context.scene
for ob in list(bpy.data.objects):
    if ob.name.startswith(('COL_','MK_')) or ob.name in ['COLLISION','MARKERS'] or ob.get('showWhen'):
        ob.hide_render=True
        for child in ob.children_recursive:child.hide_render=True
# Recreate the runtime M_Beam's see-through additive intent. Its baked GLB default
# cannot express additive shading; this explicitly labelled offline approximation
# preserves actual geometry and vertex tints, not opaque exported fallback slabs.
for ob in list(bpy.data.objects):
    if ob.name.startswith('Seam_') and ob.name.endswith('_Gate'):
        m=bpy.data.materials.new(ob.name+'_offline_additive_approx');m.use_nodes=True
        n=m.node_tree.nodes;n.clear(); output=n.new('ShaderNodeOutputMaterial');add=n.new('ShaderNodeAddShader')
        transparent=n.new('ShaderNodeBsdfTransparent');emit=n.new('ShaderNodeEmission');attribute=n.new('ShaderNodeVertexColor')
        attribute.layer_name=ob.data.color_attributes[0].name;emit.inputs['Strength'].default_value=.28
        m.node_tree.links.new(attribute.outputs['Color'],emit.inputs['Color']);m.node_tree.links.new(transparent.outputs[0],add.inputs[0]);m.node_tree.links.new(emit.outputs[0],add.inputs[1]);m.node_tree.links.new(add.outputs[0],output.inputs[0])
        ob.data.materials.clear();ob.data.materials.append(m)
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
scene.render.resolution_x=1000;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.38,.57,.68,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.rotation_euler=(.44,-.52,-.44);sun.data.energy=1.5;sun.data.angle=.2;sun.data.color=(1,.86,.68)
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=-.35
cv=lambda p:Vector((p[0],-p[2],p[1]))
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.clip_end=1600
for s in data['gates']:
    cam.data.type='PERSP';cam.data.lens=28;cam.location=cv(s['eye']);target=cv(s['target']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.abspath(os.path.join(out,s['id']+'-eye.png'));bpy.ops.render.render(write_still=True)
if os.environ.get('SEAM_EYES_ONLY') == '1': sys.exit(0)
# Hide translucent field surfaces in overhead diagnostics so the actual
# terrain/pylons remain readable; cyan traces represent their exact horizontal footprint.
for ob in bpy.data.objects:
    if ob.name.startswith('Seam_') and ob.name.endswith('_Gate'): ob.hide_render=True
# Diagnostic traces are derived from the same exported-collider segment manifest.
def line(name,a,b,y,color):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=.25;curve.bevel_resolution=0
    poly=curve.splines.new('POLY');poly.points.add(1)
    for p,v in zip(poly.points,[a,b]):p.co=(*cv([v[0],y,v[1]]),1)
    ob=bpy.data.objects.new(name,curve);scene.collection.objects.link(ob)
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);curve.materials.append(m)
    return ob
for s in data['gates']:
    # Lines float above the terrain solely in the diagnostic; field itself still
    # uses the actual imported geometry in the eye render.
    lines=[]
    for seg in s['segments']:lines.append(line('NEW aligned physical field',seg['a'],seg['b'],s['base']+72,(.1,.9,.9)))
    lines.append(line('OLD empty-ground blocker',s['old'][0],s['old'][1],s['base']+72,(1,.12,.18)))
    cam.data.type='ORTHO';cam.data.ortho_scale=112;cam.location=cv([s['center'][0],s['base']+190,s['center'][1]]);target=cv([s['center'][0],s['base'],s['center'][1]])
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.abspath(os.path.join(out,s['id']+'-top.png'));bpy.ops.render.render(write_still=True)
    for ob in lines:bpy.data.objects.remove(ob,do_unlink=True)
