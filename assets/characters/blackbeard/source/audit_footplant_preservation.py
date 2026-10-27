import bpy,os,json,hashlib
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
legnames={p+'.'+s for p in ['Thigh','Shin','Foot','Toe']for s in ['L','R']}
def snapshot(path):
 bpy.ops.wm.open_mainfile(filepath=path,use_scripts=False);out={}
 for a in bpy.data.actions:
  if a.name not in ['Idle','Walk','Run','Attack','Melee']:continue
  out[a.name]={}
  for f in a.fcurves:
   # Exact untouched source channel coordinates and interpolation are compared.
   if a.name in ['Walk','Run'] and any('"'+n+'"'in f.data_path for n in legnames):continue
   out[a.name][f.data_path+str(f.array_index)]=[(list(k.co),k.interpolation)for k in f.keyframe_points]
 geo={o.name:hashlib.sha256(b''.join(__import__('struct').pack('<fff',*v.co)for v in o.data.vertices)).hexdigest()for o in bpy.context.scene.objects if o.type=='MESH'}
 return out,geo
old,og=snapshot(R+'/qa/pre_footplant_fix/blackbeard_editable.blend');new,ng=snapshot(R+'/blackbeard_editable.blend');report={'untouched_channels_exact_equal':old==new,'editable_mesh_coordinates_exact_equal':og==ng,'actions_checked':list(new),'only_changed_channels':'Walk/Run Thigh/Shin/Foot/Toe location and quaternion'};json.dump(report,open(R+'/qa/footplant_preservation.json','w'),indent=2);print(report)
assert old==new and og==ng
