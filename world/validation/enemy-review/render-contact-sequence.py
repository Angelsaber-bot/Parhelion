"""Render CPU-skinned runtime snapshots with the original GLB materials (offline pose QA only)."""
import bpy, json, sys, os, math, gzip
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source,out=args[:2]
os.makedirs(out,exist_ok=True)
for filename in sorted(os.listdir(source)):
    if not filename.endswith('.json'): continue
    if len(args)>2 and not filename.startswith(args[2]):continue
    manifest=json.load(open(os.path.join(source,filename)))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    asset=manifest['asset']
    if not os.path.isfile(asset):
        decoded=os.path.join(source,os.path.basename(asset))
        if not os.path.isfile(decoded):
            with gzip.open(asset+'.gz','rb') as zipped, open(decoded,'wb') as raw:raw.write(zipped.read())
        asset=decoded
    bpy.ops.import_scene.gltf(filepath=asset)
    materials={m.name:m for m in bpy.data.materials}
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
    for name,item in manifest.get('extraMaterials',{}).items():
        material=bpy.data.materials.new(name);material.use_nodes=True;node=material.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=tuple(item['color'])+(1,);node.inputs['Metallic'].default_value=item['metalness'];node.inputs['Roughness'].default_value=item['roughness'];node.inputs['Emission Color'].default_value=tuple(item['emissive'])+(1,);node.inputs['Emission Strength'].default_value=item['emissiveIntensity'];materials[name]=material
    objects=[]
    for entry in manifest['meshes']:
        raw=open(os.path.join(source,entry['file']),'rb').read();n=entry['count'];indices=entry['indices']
        xyz=np.frombuffer(raw,dtype='<f4',count=n*3).reshape((-1,3)).copy()
        xyz[:,[1,2]]=np.column_stack((-xyz[:,2],xyz[:,1]))
        # glTF/Three stores V downward; Blender's GLB importer flips the UV to its V-up convention.
        uv=np.frombuffer(raw,dtype='<f4',offset=n*12,count=n*2).reshape((-1,2)).copy();uv[:,1]=1-uv[:,1]
        colors=np.frombuffer(raw,dtype='<f4',offset=n*20,count=n*4)
        faces=np.frombuffer(raw,dtype='<u4',offset=n*36,count=indices).reshape((-1,3))
        mesh=bpy.data.meshes.new(entry['name']);mesh.from_pydata(xyz.tolist(),[],faces.tolist());mesh.update()
        for name in entry['materials']:
            mesh.materials.append(materials[name])
        for group in entry['groups']:
            for p in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:p.material_index=group['materialIndex']
        for p in mesh.polygons:p.use_smooth=True
        layer=mesh.uv_layers.new(name='UVMap')
        layer.data.foreach_set('uv',uv[faces.reshape(-1)].reshape(-1).tolist())
        color_names={node.layer_name for material in mesh.materials if material.use_nodes for node in material.node_tree.nodes if node.type=='VERTEX_COLOR'}
        for color_name in color_names:
            attribute=mesh.color_attributes.new(name=color_name or 'Color',type='FLOAT_COLOR',domain='POINT');attribute.data.foreach_set('color',colors.tolist())
        obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj);objects.append(obj)
    all_points=[o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in all_points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in all_points) for i in range(3)))
    center=(lo+hi)/2;size=max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
    # Optional fixed Three-space framing avoids camera breathing in sequence previews.
    if 'framing' in manifest:
        frame=manifest['framing'];x,y,z=frame['center'];center=Vector((x,-z,y));size=frame['size']
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));plane=bpy.context.object
    mat=bpy.data.materials.new('QA floor');mat.diffuse_color=(.055,.068,.09,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.055,.068,.09,1);mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;plane.data.materials.append(mat)
    scene=bpy.context.scene;scene.world=bpy.data.worlds.new('QA studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.27,.36,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    for name,pos,power,color,scale in [('key',(-4,-4,7),1100,(1,.86,.73),4),('fill',(4,-1,5),850,(.66,.79,1),4),('rim',(1,4,6),1250,(.78,.85,1),3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=scale
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('QA camera');camera=bpy.data.objects.new('QA camera',data);scene.collection.objects.link(camera);scene.camera=camera
    # Front three-quarter view shows both lowered arms and the white horse's stride/weapon.
    view=args[3] if len(args)>3 else 'front'
    offset=(size*1.8,0,size*.22) if view=='side' else (-size*.85,-size*1.5,size*.42) if view=='opposite' else (size*.85,-size*1.5,size*.42)
    camera.location=center+Vector(offset);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=size*1.32
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=False
    scene.render.resolution_x=480;scene.render.resolution_y=480;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,manifest['id']+'.png')
    scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
    print('POSE_RENDERED',manifest['id'],flush=True)
