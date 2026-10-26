"""Run against the saved .blend, no renders. Record editable detail bounds in runtime axes."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
scene=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get();items=[]
for name in ['DETAIL_ARCHITECTURE','DETAIL_EQUIPMENT','DETAIL_FLOOR']:
    for o in bpy.data.collections[name].objects:
        ev=o.evaluated_get(dg);points=[o.matrix_world@Vector(p) for p in ev.bound_box]
        vs=[(p.x,p.z,-p.y) for p in points]
        items.append({'name':o.name,'collection':name,'min':[min(p[i] for p in vs) for i in range(3)],'max':[max(p[i] for p in vs) for i in range(3)]})
report={'version':scene['version'],'editableDetails':len(items),'details':items,'collisionObjects':len(bpy.data.collections['COLLISION'].objects),'baseVisualObjects':len(bpy.data.collections['VISUAL'].objects),'batchCount':len(bpy.data.collections['EXPORT_BATCHES'].objects)}
(ROOT/'validation/model_bounds.json').write_text(json.dumps(report,indent=2)+'\n');print('MODEL_AUDIT_OK',len(items))
