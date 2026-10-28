import bpy,json,os
from mathutils import Vector
from pathlib import Path
exec(Path(__file__).with_name('_paths.py').read_text())
B=D
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ASSET/'source'/'vrm'/'HairSample_Male.vrm'))
source={}
for name in ['Face','Body','Hair001']:
 o=bpy.data.objects[name];g={v.index:{o.vertex_groups[a.group].name:a.weight for a in v.groups if a.weight>1e-7}for v in o.data.vertices};source[name]=g
mapping=json.load(open(H+'/source_vertex_correspondence.json'))
bpy.ops.wm.open_mainfile(filepath=H+'/approved_head_design.blend')
report={'source':'HairSample_Male original indexed weights','parts':{},'expression_state':'Neutral only. No original 54 expression recovery claimed.'}
for o in list(bpy.data.objects):
 if o.type!='MESH' or o.hide_render:continue
 # Override prior group state explicitly; never infer it was preserved by extraction.
 o.vertex_groups.clear(); assignments=[]; ambiguous=0;conflicts=[];exact=0
 if o.name in mapping['parts']:
  for record in mapping['parts'][o.name]['mapping']:
   candidates=record['source_candidates'];ws=[source[n][i]for n,i,d in candidates]
   if len(ws)>1:
    ambiguous+=1
    names=set(k for w in ws for k in w)
    delta=max(max(w.get(k,0)for w in ws)-min(w.get(k,0)for w in ws)for k in names)
    if delta>1e-5:conflicts.append({'vertex':record['target_index'],'max_weight_difference':delta,'source_candidates':candidates,'weights':ws})
   # Coincident body/face neck seam: average compatible provenance; noncompatible tuples handled explicitly below.
   chosen={k:sum(w.get(k,0)for w in ws)/len(ws)for k in set(k for w in ws for k in w)}
   assignments.append(chosen);exact+=1
 elif o.name=='Ritsuka_Hair_Editable_CC0_Adaptation':
  # Frozen sculpted hair intentionally rigid to Head. Original hair-root chains do not match 67-bone body skeleton.
  assignments=[{'J_Bip_C_Head':1}for v in o.data.vertices]
 else:assignments=[{'J_Bip_C_Head':1}for v in o.data.vertices]
 if conflicts:raise RuntimeError('Incompatible source seam weights require explicit resolution: '+o.name+' '+str(conflicts[:3]))
 for i,weights in enumerate(assignments):
  for name,w in weights.items():
   vg=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);vg.add([i],w,'REPLACE')
 report['parts'][o.name]={'cage_vertices':len(o.data.vertices),'exact_correspondence':exact,'multiple_candidates':ambiguous,'incompatible_candidates':len(conflicts),'policy':'Source candidate weights identical within 1e-5; averaged. New brows/underlayer and all hair use Head=1.'}
# Evaluate design and subdivision carrying source vertex groups. Save evaluated weight array, not expressions.
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();result={}
for o in bpy.data.objects:
 if o.type!='MESH' or o.hide_render:continue
 ev=o.evaluated_get(dg);me=ev.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
 result[o.name]={'vertices':[list(v.co)for v in me.vertices],'weights':[{o.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-7}for v in me.vertices]}
 report['parts'][o.name]['evaluated_vertices']=len(me.vertices)
 ev.to_mesh_clear()
json.dump(result,open(B+'/qa/approved-head-evaluated-weights.json','w'))
json.dump(report,open(B+'/qa/head-weight-transfer-report.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=B+'/sculpt/01_head_design_source_weights.blend')
print(json.dumps(report,indent=2))
