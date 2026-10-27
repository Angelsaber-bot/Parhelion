import bpy,json,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
reference='--reference' in sys.argv;src=R/('Musashi_Reference_Presentation.blend' if reference else 'Musashi_Animated_Working.blend');dst=R/('Musashi_Reference_Presentation.blend' if reference else 'Musashi_Editable.blend')
bpy.ops.wm.open_mainfile(filepath=str(src),load_ui=False,use_scripts=False)
# Remove only unused imported datablocks, never live source parts or fake-user clips.
removed=[]
for db in [bpy.data.meshes,bpy.data.curves,bpy.data.materials,bpy.data.images,bpy.data.cameras,bpy.data.lights,bpy.data.worlds]:
 for x in list(db):
  if x.users==0:removed.append(x.name);db.remove(x)
s=bpy.context.scene;face=next(o for o in s.objects if o.type=='MESH' and o.data.shape_keys)
s['release_status']='Reference-led reconstruction; see README and QA. Not a claim of exact official reproduction.'
s['verification']='Actual GLB CPU skinning/morph/animation tests plus Blender GLB round-trip renders; no browser/GPU claim.'
s['source_face_morphs']=len(face.data.shape_keys.key_blocks)-1
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dst));print('Removed unused datablocks:',removed)
