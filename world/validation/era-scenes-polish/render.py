"""Matched actual station geometry/material inspection, Blender CPU only.
Usage: blender -b -t 2 -P render.py -- <export-directory>
Not browser/GPU/FPS acceptance. Uses source UVs, vertex colors and surface-map pixels.
"""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1])
for region in (sys.argv[sys.argv.index('--')+2:] or ['britain','blacksail','winter','kyoto']):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 for m in json.loads((root/(region+'.json')).read_text()):
  p=m['position'];v=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)];idx=m['index'] or list(range(len(v)));faces=[idx[i:i+3] for i in range(0,len(idx),3)];g=bpy.data.meshes.new(m['name']);g.from_pydata(v,[],faces);g.update();o=bpy.data.objects.new(m['name'],g);bpy.context.collection.objects.link(o)
  mat=bpy.data.materials.new(m['name']);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;n=nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=tuple(m['color'])+(1,);n.inputs['Roughness'].default_value=m['roughness'];n.inputs['Metallic'].default_value=m['metalness'];n.inputs['Emission Color'].default_value=tuple(m['emissive'])+(1,);n.inputs['Emission Strength'].default_value=m['intensity'];g.materials.append(mat)
  col=g.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='POINT');colors=m['vertexColor'];col.data.foreach_set('color',[c for i in range(0,len(colors),3) for c in colors[i:i+3]+[1]])
  vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='Tint';mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=tuple(m['color'])+(1,);links.new(vc.outputs['Color'],mix.inputs[2]);base=mix.outputs['Color']
  if m.get('normal'):
   nn=m['normal'];g.normals_split_custom_set_from_vertices([(nn[i],-nn[i+2],nn[i+1]) for i in range(0,len(nn),3)])
   for poly in g.polygons:poly.use_smooth=True
  if m.get('texture') and m.get('uv'):
   uv=g.uv_layers.new(name='UVMap');source=m['uv']
   for loop in g.loops:uv.data[loop.index].uv=source[loop.vertex_index*2:loop.vertex_index*2+2]
   t=m['texture'];im=bpy.data.images.new(m['name']+'_surface',width=t['width'],height=t['height']);im.colorspace_settings.name='sRGB';im.pixels.foreach_set([v/255 for v in t['data']]);im.update();tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Linear';tex.extension='REPEAT';mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;links.new(base,mix.inputs[1]);links.new(tex.outputs['Color'],mix.inputs[2]);base=mix.outputs['Color']
  links.new(base,n.inputs['Base Color'])
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.28,.35,.43,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
 bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;mat=bpy.data.materials.new('floor');mat.diffuse_color=(.22,.25,.26,1);ground.data.materials.append(mat)
 d=bpy.data.lights.new('Soft sun','AREA');d.energy=650;d.shape='DISK';d.size=6;o=bpy.data.objects.new('Soft sun',d);scene.collection.objects.link(o);o.location=(-3,-5,8);o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Camera');o=bpy.data.objects.new('Camera',d);scene.collection.objects.link(o);scene.camera=o;d.type='ORTHO';d.ortho_scale=5.1;o.location=(5,-8,5);o.rotation_euler=(Vector((0,0,1.85))-o.location).to_track_quat('-Z','Y').to_euler();scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=720;scene.render.resolution_y=820;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.render.filepath=str(root/(region+'.png'));bpy.ops.render.render(write_still=True)
