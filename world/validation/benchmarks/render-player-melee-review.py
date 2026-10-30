"""Offline CPU still review of actual posed vertices + original player/Dawn materials."""
import bpy, json, sys, os
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--') + 1:]
source, output=args[:2]
view=args[2] if len(args)>2 else 'front'
close=len(args)>3 and args[3]=='close'
only=set(args[4].split(',')) if len(args)>4 else None
os.makedirs(output, exist_ok=True)
for filename in sorted(os.listdir(source)):
    if not filename.endswith('.json'): continue
    if only and filename not in only: continue
    if close and not filename.endswith('phase0.4.json'): continue
    manifest = json.load(open(os.path.join(source, filename)))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for asset in manifest['assets']: bpy.ops.import_scene.gltf(filepath=asset)
    materials = {m.name: m for m in bpy.data.materials}
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj, do_unlink=True)
    for entry in manifest['meshes']:
        raw = open(os.path.join(source, entry['file']), 'rb').read(); n = entry['count']
        xyz = np.frombuffer(raw, dtype='<f4', count=n*3).reshape((-1, 3)).copy()
        xyz[:, [1, 2]] = np.column_stack((-xyz[:, 2], xyz[:, 1]))
        uv = np.frombuffer(raw, dtype='<f4', offset=n*12, count=n*4).reshape((-1, 4)).copy()
        uv[:, [1, 3]] = 1-uv[:, [1, 3]]
        faces = np.frombuffer(raw, dtype='<u4', offset=n*28, count=entry['indices']).reshape((-1, 3))
        mesh = bpy.data.meshes.new(entry['name']); mesh.from_pydata(xyz.tolist(), [], faces.tolist()); mesh.update()
        for material in entry['materials']:
            name = material['name']; mat = materials.get(name)
            if mat is None:
                mat = bpy.data.materials.new(name or 'Glider'); mat.use_nodes = True
                node = mat.node_tree.nodes.get('Principled BSDF')
                node.inputs['Base Color'].default_value = tuple(material['color'])+(1,)
                node.inputs['Roughness'].default_value = material['roughness']; node.inputs['Metallic'].default_value = material['metalness']
            mesh.materials.append(mat)
        for group in entry['groups']:
            for poly in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]: poly.material_index = group['materialIndex']
        for poly in mesh.polygons: poly.use_smooth = True
        for channel, name in enumerate(['UVMap', 'UVMap.001']):
            layer = mesh.uv_layers.new(name=name)
            layer.data.foreach_set('uv', uv[faces.reshape(-1), channel*2:channel*2+2].reshape(-1).tolist())
        obj = bpy.data.objects.new(entry['name'], mesh); bpy.context.collection.objects.link(obj)
    scene = bpy.context.scene; scene.world = bpy.data.worlds.new('Studio'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.22,.27,.36,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    glider_view = 'glide' in manifest['id'] or 'stow-167ms' in manifest['id']
    target = Vector((0, -.3, 1.05))
    if close:
        hand=manifest['joints']['Hand_R'];target=Vector((hand[0],-hand[2],hand[1]))
    for name, pos, power in [('key',(-4,-4,7),1000),('fill',(4,-1,5),750),('rim',(1,4,6),900)]:
        data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = 4
        obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = pos
        obj.rotation_euler = (target-obj.location).to_track_quat('-Z','Y').to_euler()
    data = bpy.data.cameras.new('Camera'); camera = bpy.data.objects.new('Camera', data)
    scene.collection.objects.link(camera); scene.camera = camera
    camera.location = target+(Vector((0,-5,0)) if view=='front' else Vector((4,-3,0)));  camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type = 'ORTHO'; data.ortho_scale = .72 if close else 2.5
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 16 if close else 8; scene.cycles.use_denoising = False
    scene.render.resolution_x = 640 if close else 620; scene.render.resolution_y = 640 if close else 620; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.filepath = os.path.join(output, manifest['id']+'.png')
    scene.view_settings.view_transform = 'AgX'; bpy.ops.render.render(write_still=True)
    print('POSE_RENDERED', manifest['id'], flush=True)
