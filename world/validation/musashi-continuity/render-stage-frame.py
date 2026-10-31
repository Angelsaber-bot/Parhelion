"""Render actual UltimateStage CPU snapshots. Not browser/GPU evidence; see manifests."""
import bpy, json, sys, os, math, gzip
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
source,out=args[:2]
os.makedirs(out,exist_ok=True)
reuse=os.environ.get('ULTIMATE_REUSE_MATERIALS')=='1'
material_cache={}
if reuse:bpy.ops.wm.read_factory_settings(use_empty=True)
for filename in sorted(os.listdir(source)):
    if not filename.endswith('.json'): continue
    shard_count=int(os.environ.get('ULTIMATE_SHARDS','1'));shard_index=int(os.environ.get('ULTIMATE_SHARD','0'))
    if sum(filename.encode()) % shard_count != shard_index:continue
    if len(args)>2 and not filename.startswith(args[2]):continue
    manifest=json.load(open(os.path.join(source,filename)))
    if os.environ.get('ULTIMATE_SKIP_EXISTING')=='1' and os.path.isfile(os.path.join(out,manifest['id']+'.png')):continue
    if not reuse:bpy.ops.wm.read_factory_settings(use_empty=True)
    else:
        for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
        for mesh in list(bpy.data.meshes):
            if mesh.users==0:bpy.data.meshes.remove(mesh)
        for mat in list(bpy.data.materials):
            if mat.users==0:bpy.data.materials.remove(mat)
    asset=manifest['asset']
    if not os.path.isfile(asset):
        decoded=os.path.join(source,os.path.basename(asset))
        if not os.path.isfile(decoded):
            with gzip.open(asset+'.gz','rb') as zipped, open(decoded,'wb') as raw:raw.write(zipped.read())
        asset=decoded
    if reuse and asset in material_cache:materials=material_cache[asset]
    else:
        bpy.ops.import_scene.gltf(filepath=asset)
        materials={m.name:m for m in bpy.data.materials}
        if reuse:
            material_cache[asset]=materials
            for mat in materials.values():mat.use_fake_user=True
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
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
        for spec in entry['materials']:
            if not spec['basic'] and spec['name'] in materials:
                mesh.materials.append(materials[spec['name']]);continue
            mat=bpy.data.materials.new('Stage '+entry['name']);mat.use_nodes=True
            nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
            output=nodes.new('ShaderNodeOutputMaterial')
            if spec.get('standard',False):
                em=nodes.new('ShaderNodeBsdfPrincipled');color_input=em.inputs['Base Color'];em.inputs['Roughness'].default_value=spec.get('roughness',.85);em.inputs['Metallic'].default_value=spec.get('metalness',0)
            else:
                em=nodes.new('ShaderNodeEmission');color_input=em.inputs['Color'];em.inputs['Strength'].default_value=1
            color_input.default_value=(*spec['color'],1)
            vertex=None
            if spec.get('vertexColors',False):
                vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='StageRGBA'
                multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;multiply.inputs[2].default_value=(*spec['color'],1)
                links.new(vertex.outputs['Color'],multiply.inputs[1]);links.new(multiply.outputs['Color'],color_input)
            if spec.get('additive',False):
                trans=nodes.new('ShaderNodeBsdfTransparent');add=nodes.new('ShaderNodeAddShader');links.new(trans.outputs[0],add.inputs[0]);links.new(em.outputs[0],add.inputs[1]);links.new(add.outputs[0],output.inputs[0])
                if 'Strength' in em.inputs:em.inputs['Strength'].default_value=spec['opacity']
                if vertex and 'Strength' in em.inputs:
                    alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';alpha.inputs[1].default_value=spec['opacity'];links.new(vertex.outputs['Alpha'],alpha.inputs[0]);links.new(alpha.outputs[0],em.inputs['Strength'])
            elif spec['opacity']<1 or vertex:
                trans=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=spec['opacity']
                if vertex:
                    alpha=nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';alpha.inputs[1].default_value=spec['opacity'];links.new(vertex.outputs['Alpha'],alpha.inputs[0]);links.new(alpha.outputs[0],mix.inputs[0])
                links.new(trans.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs[0])
            else:links.new(em.outputs[0],output.inputs[0])
            mesh.materials.append(mat)
        for group in entry['groups']:
            for p in mesh.polygons[group['start']//3:(group['start']+group['count'])//3]:p.material_index=group['materialIndex']
        for p in mesh.polygons:p.use_smooth=True
        layer=mesh.uv_layers.new(name='UVMap')
        layer.data.foreach_set('uv',uv[faces.reshape(-1)].reshape(-1).tolist())
        color_names={node.layer_name for material in mesh.materials if material.use_nodes for node in material.node_tree.nodes if node.type=='VERTEX_COLOR'}
        for color_name in color_names:
            attribute=mesh.color_attributes.new(name=color_name or 'Color',type='FLOAT_COLOR',domain='POINT');attribute.data.foreach_set('color',colors.tolist())
        obj=bpy.data.objects.new(entry['name'],mesh);bpy.context.collection.objects.link(obj);objects.append(obj)
    def convert(xyz):return Vector((xyz[0],-xyz[2],xyz[1]))
    scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Actual stage background');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(*manifest['background'],1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=1
    for i,light in enumerate(manifest['lights']):
        kind=light.get('type','directional')
        data=bpy.data.lights.new('Stage '+kind+' '+str(i),'POINT' if kind=='point' else 'SUN');data.color=light['color']
        # Three point intensity is candela; Blender point power is total radiant flux.
        data.energy=light['intensity']*4*math.pi if kind=='point' else light['intensity']*(.35 if kind=='hemisphere' else 1)
        if kind=='point':data.shadow_soft_size=.12
        else:data.angle=math.pi/2 if kind=='hemisphere' else .08
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=convert(light['position']);obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
        if kind=='hemisphere':
            fill=bpy.data.lights.new('Hemisphere ground approximation '+str(i),'SUN');fill.energy=light['intensity']*.15;fill.color=light['groundColor'];fill.angle=math.pi/2
            ground=bpy.data.objects.new(fill.name,fill);scene.collection.objects.link(ground);ground.rotation_euler=(math.pi,0,0)
    data=bpy.data.cameras.new('Exact stage camera');camera=bpy.data.objects.new('Exact stage camera',data);scene.collection.objects.link(camera);scene.camera=camera
    spec=manifest['camera'];camera.location=convert(spec['position']);camera.rotation_euler=convert(spec['direction']).to_track_quat('-Z','Y').to_euler();data.type='PERSP';data.sensor_fit='HORIZONTAL';data.angle=2*math.atan(math.tan(math.radians(spec['fov'])/2)*spec['aspect']);data.clip_start=spec['near'];data.clip_end=spec['far']
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=max(1,int(os.environ.get("ULTIMATE_SAMPLES","8")));scene.cycles.use_denoising=False;scene.cycles.transparent_max_bounces=64;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=int(os.environ.get("ULTIMATE_WIDTH","1280"));scene.render.resolution_y=int(os.environ.get("ULTIMATE_HEIGHT","720"));scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,manifest['id']+'.png')
    scene.view_settings.view_transform='Standard'
    # Approximation of actual runtime UnrealBloomPass; omitted unless explicitly enabled.
    if os.environ.get('ULTIMATE_BLOOM','0')=='1':
        scene.use_nodes=True;tree=scene.node_tree;tree.nodes.clear();layers=tree.nodes.new('CompositorNodeRLayers');glare=tree.nodes.new('CompositorNodeGlare');glare.glare_type='FOG_GLOW';glare.quality='MEDIUM';glare.threshold=.72;glare.size=6;glare.mix=-.45;output=tree.nodes.new('CompositorNodeComposite');tree.links.new(layers.outputs['Image'],glare.inputs['Image']);tree.links.new(glare.outputs['Image'],output.inputs['Image'])
    bpy.ops.render.render(write_still=True)
    print('POSE_RENDERED',manifest['id'],flush=True)
