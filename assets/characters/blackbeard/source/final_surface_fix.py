import bpy,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blackbeard_editable.blend',use_scripts=False)
rig=bpy.data.objects['Blackbeard_Rig'];scene=bpy.context.scene;body=bpy.data.objects['BB - authored anatomical body'];socket=bpy.data.objects['Blackbeard_Muzzle']
for o in scene.objects:
 if o.type=='MESH' and 'sideburn' in o.name:
  for v in o.data.vertices:v.co.x*=.92;v.co.y-=.007
scene['surface_revision']='Sideburn shifted clear of ear curvature; harness Chest rigid; knee clearance corrected'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blackbeard_editable.blend',compress=True)
p=open(ROOT+'/source/integrate_runtime.py').read();exec(p[p.index('# Runtime copy:'):])
