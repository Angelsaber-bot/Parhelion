"""Render CPU-skinned runtime snapshots with the original GLB materials (offline pose QA only)."""
import bpy, json, sys, os, math, gzip
import numpy as np
from mathutils import Vector, Quaternion
args=sys.argv[sys.argv.index('--')+1:]
source,out=args[:2]
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
loaded_asset=None
materials={}
for filename in sorted(os.listdir(source)):
    if not filename.endswith('.json'): continue
    if len(args)>2 and not filename.startswith(tuple(args[2].split(','))):continue
    manifest=json.load(open(os.path.join(source,filename)))
    if 'meshes' not in manifest or 'asset' not in manifest:continue
    view_filter=os.environ.get('ACTING_VIEW_FILTER')
    if view_filter=='actual' and not manifest.get('actualCamera'):continue
    if view_filter=='diagnostic' and manifest.get('actualCamera'):continue
    asset=manifest['asset']
    if not os.path.isfile(asset):
        decoded=os.path.join(source,os.path.basename(asset))
        if not os.path.isfile(decoded):
            with gzip.open(asset+'.gz','rb') as zipped, open(decoded,'wb') as raw:raw.write(zipped.read())
        asset=decoded
    asset_key=(asset,tuple(manifest.get('extraAssets',[])))
    if asset_key != loaded_asset:
        bpy.ops.import_scene.gltf(filepath=asset)
        for extra_asset in manifest.get('extraAssets',[]): bpy.ops.import_scene.gltf(filepath=extra_asset)
        materials={m.name:m for m in bpy.data.materials}
        loaded_asset=asset_key
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
    for collection in (bpy.data.meshes,bpy.data.armatures,bpy.data.cameras,bpy.data.lights,bpy.data.worlds):
        for block in list(collection):
            if block.users == 0: collection.remove(block)
    for material in list(bpy.data.materials):
        if material.users == 0 and material.name not in materials: bpy.data.materials.remove(material)
    objects=[]
    for entry in manifest['meshes']:
        compact='staticFile' in entry
        opener=gzip.open if compact else open
        raw=opener(os.path.join(source,entry['file']),'rb').read();n=entry['count'];indices=entry['indices']
        static=open(os.path.join(source,entry['staticFile']),'rb').read() if compact else raw
        xyz=np.frombuffer(raw,dtype='<f4',count=n*3).reshape((-1,3)).copy()
        xyz[:,[1,2]]=np.column_stack((-xyz[:,2],xyz[:,1]))
        # glTF/Three stores V downward; Blender's GLB importer flips the UV to its V-up convention.
        uv=np.frombuffer(static,dtype='<f4',offset=0 if compact else n*12,count=n*2).reshape((-1,2)).copy();uv[:,1]=1-uv[:,1]
        colors=np.frombuffer(static,dtype='<f4',offset=n*8 if compact else n*20,count=n*4)
        faces=np.frombuffer(static,dtype='<u4',offset=n*24 if compact else n*36,count=indices).reshape((-1,3))
        mesh=bpy.data.meshes.new(entry['name'])
        mesh.vertices.add(n);mesh.vertices.foreach_set('co',xyz.reshape(-1))
        mesh.loops.add(indices);mesh.loops.foreach_set('vertex_index',faces.reshape(-1))
        mesh.polygons.add(len(faces));mesh.polygons.foreach_set('loop_start',np.arange(len(faces),dtype=np.int32)*3)
        mesh.polygons.foreach_set('loop_total',np.full(len(faces),3,dtype=np.int32))
        mesh.polygons.foreach_set('use_smooth',np.ones(len(faces),dtype=bool))
        material_indices=np.zeros(len(faces),dtype=np.int32)
        for name in entry['materials']:
            mesh.materials.append(materials[name])
        for group in entry['groups']:
            material_indices[group['start']//3:(group['start']+group['count'])//3]=group['materialIndex']
        mesh.polygons.foreach_set('material_index',material_indices);mesh.update(calc_edges=True)
        layer=mesh.uv_layers.new(name='UVMap')
        layer.data.foreach_set('uv',uv[faces.reshape(-1)].reshape(-1))
        if 'uv1File' in entry:
            uv1=np.fromfile(os.path.join(source,entry['uv1File']),dtype='<f4').reshape((-1,2));uv1[:,1]=1-uv1[:,1]
            layer1=mesh.uv_layers.new(name='UVMap.001');layer1.data.foreach_set('uv',uv1[faces.reshape(-1)].reshape(-1))
        color_names={node.layer_name for material in mesh.materials if material.use_nodes for node in material.node_tree.nodes if node.type=='VERTEX_COLOR'}
        for color_name in color_names:
            attribute=mesh.color_attributes.new(name=color_name or 'Color',type='FLOAT_COLOR',domain='POINT');attribute.data.foreach_set('color',colors)
        obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj);objects.append(obj)
    # Optional measured intersection segments: review overlays only, never character geometry.
    if manifest.get('contactSegments'):
        contact_mat=bpy.data.materials.new('QA measured surface crossings');contact_mat.diffuse_color=(1,.025,.01,1)
        contact_mat.use_nodes=True;contact_bsdf=contact_mat.node_tree.nodes.get('Principled BSDF')
        contact_bsdf.inputs['Base Color'].default_value=(1,.025,.01,1);contact_bsdf.inputs['Emission Color'].default_value=(1,.025,.01,1);contact_bsdf.inputs['Emission Strength'].default_value=2
        for i,segment in enumerate(manifest['contactSegments']):
            curve=bpy.data.curves.new('Measured crossing '+str(i),'CURVE');curve.dimensions='3D';curve.bevel_depth=.0025;curve.bevel_resolution=2
            spline=curve.splines.new('POLY');spline.points.add(1)
            for point,value in zip(spline.points,segment):point.co=(value[0],-value[2],value[1],1)
            line=bpy.data.objects.new('Measured crossing '+str(i),curve);bpy.context.collection.objects.link(line);curve.materials.append(contact_mat)
    all_points=[o.matrix_world @ Vector(corner) for o in objects for corner in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in all_points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in all_points) for i in range(3)))
    center=(lo+hi)/2;size=max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
    # Optional fixed Three-space framing avoids camera breathing in sequence previews.
    if 'framing' in manifest:
        frame=manifest['framing'];x,y,z=frame['center'];center=Vector((x,-z,y));size=frame['size']
    ground=float(manifest.get('groundY',-.025)) # Legacy comparisons retain their documented -25 mm studio plane.
    if 'terrainTriangles' in manifest:
        triangles=np.asarray(manifest['terrainTriangles'],dtype=np.float32).reshape((-1,3))
        triangles[:,[1,2]]=np.column_stack((-triangles[:,2],triangles[:,1]))
        terrain=bpy.data.meshes.new('Actual collision surface')
        terrain.from_pydata(triangles.tolist(),[],np.arange(len(triangles)).reshape((-1,3)).tolist());terrain.update()
        plane=bpy.data.objects.new('Actual collision surface',terrain);bpy.context.collection.objects.link(plane)
    else:
        bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,ground));plane=bpy.context.object
    mat=bpy.data.materials.new('QA floor');mat.diffuse_color=(.055,.068,.09,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.055,.068,.09,1);mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;plane.data.materials.append(mat)
    if manifest.get('grid'):
        gridmat=bpy.data.materials.new('QA metre reference');gridmat.diffuse_color=(.13,.17,.21,1)
        for axis in range(2):
            for value in range(-60,61):
                bpy.ops.mesh.primitive_plane_add(size=1,location=(value if axis==0 else 0,value if axis==1 else 0,ground+.002))
                line=bpy.context.object;line.scale=(.006,120,1) if axis==0 else (120,.006,1);line.data.materials.append(gridmat)
    scene=bpy.context.scene;scene.world=bpy.data.worlds.new('QA studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.27,.36,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    for name,pos,power,color,scale in [('key',(-4,-4,7),1100,(1,.86,.73),4),('fill',(4,-1,5),850,(.66,.79,1),4),('rim',(1,4,6),1250,(.78,.85,1),3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=scale
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos
        if manifest.get('trackLights'):
            ox,oy,oz=manifest.get('lightingOrigin',[center.x,0,-center.y]);obj.location+=Vector((ox,-oz,oy))
        obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('QA camera');camera=bpy.data.objects.new('QA camera',data);scene.collection.objects.link(camera);scene.camera=camera
    # Front three-quarter view shows both lowered arms and the white horse's stride/weapon.
    view=manifest.get('view','front');offset=(-size*1.7,-size*.08,size*.13) if view=='right' else (size*1.7,-size*.08,size*.13) if view=='side' else (size*.40,-size*1.65,size*.20)
    # Optional review framing only: rotate camera around the native actor's current yaw.
    # The exported runtime vertices/pose/root are never rotated or rewritten.
    if 'reviewYaw' in manifest:
        yaw=float(manifest['reviewYaw']);assert math.isfinite(yaw)
        x,y,z=offset;offset=(x*math.cos(yaw)-y*math.sin(yaw),x*math.sin(yaw)+y*math.cos(yaw),z)
    camera.location=center+Vector(offset);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=size*1.32
    actual_camera=manifest.get('actualCamera')
    if actual_camera:
        px,py,pz=actual_camera['position'];qx,qy,qz,qw=actual_camera['quaternion']
        camera.location=(px,-pz,py);camera.rotation_mode='QUATERNION'
        camera.rotation_quaternion=Quaternion((1,0,0),math.pi/2) @ Quaternion((qw,qx,qy,qz))
        data.type='PERSP';data.sensor_fit='VERTICAL';data.sensor_height=32
        data.lens=16/math.tan(math.radians(actual_camera['fov'])/2);data.clip_start=.01;data.clip_end=2000
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8;scene.cycles.use_denoising=False
    scene.render.resolution_x=int(os.environ.get('ACTING_SIZE','480'));scene.render.resolution_y=round(scene.render.resolution_x/actual_camera['aspect']) if actual_camera else scene.render.resolution_x;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,manifest['id']+'.png')
    if actual_camera and actual_camera.get('projectionPoints'):
        from bpy_extras.object_utils import world_to_camera_view
        bpy.context.view_layer.update();proof=[]
        for sample in actual_camera['projectionPoints']:
            px,py,pz=sample['world'];projected=world_to_camera_view(scene,camera,Vector((px,-pz,py)))
            error=max(abs(projected.x*2-1-sample['ndc'][0]),abs(projected.y*2-1-sample['ndc'][1]))
            proof.append({'world':sample['world'],'xyError':error})
        if max(row['xyError'] for row in proof)>1e-4:raise RuntimeError('Actual-camera projection mismatch: '+str(proof))
        json.dump({'scope':'Three actual camera versus Blender projection XY only','samples':proof},open(os.path.join(out,manifest['id']+'-camera-proof.json'),'w'))
    scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
    print('POSE_RENDERED',manifest['id'],flush=True)
