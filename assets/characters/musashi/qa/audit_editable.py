import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];reports=[]
for name in ['Musashi_Editable.blend','Musashi_Reference_Presentation.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(R/name),load_ui=False,use_scripts=False);s=bpy.context.scene;faces=[o for o in s.objects if o.type=='MESH' and o.data.shape_keys];arm=next(o for o in s.objects if o.type=='ARMATURE');images=[{'name':im.name,'packed':bool(im.packed_file or im.packed_files),'source':im.source} for im in bpy.data.images if im.users>0 and im.type not in ['RENDER_RESULT','COMPOSITING']];r={'file':name,'mesh_parts':len([o for o in s.objects if o.type=='MESH']),'bones':len(arm.data.bones),'morphs':len(faces[0].data.shape_keys.key_blocks)-1,'actions':[a.name for a in bpy.data.actions],'active_action':arm.animation_data.action.name,'images':images,'pass':all(i['packed'] or i['source']=='GENERATED' for i in images)};reports.append(r)
(R/'qa/editable-validation.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2));assert all(r['pass'] for r in reports)
