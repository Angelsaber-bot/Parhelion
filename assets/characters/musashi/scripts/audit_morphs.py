import bpy,json,math
from pathlib import Path
R=Path(__file__).resolve().parents[1];bpy.ops.wm.open_mainfile(filepath=str(R/'Musashi_Animated_Working.blend'),load_ui=False,use_scripts=False)
o=next(o for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys);base=o.data.shape_keys.key_blocks[0];out=[]
for key in o.data.shape_keys.key_blocks[1:]:
 ds=[(i,(o.matrix_world.to_3x3()@(v.co-base.data[i].co))) for i,v in enumerate(key.data)];moving=[(i,d) for i,d in ds if d.length>1e-6];cs=[o.matrix_world@base.data[i].co for i,d in moving];out.append({'name':key.name,'moved_vertices':len(moving),'max_delta':max(d.length for _,d in ds),'bounds':[[min(c[k] for c in cs),max(c[k] for c in cs)] for k in range(3)] if cs else None})
(R/'qa/morph-audit.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
