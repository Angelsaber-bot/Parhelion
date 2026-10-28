import bpy,os,sys,shutil,json
from pathlib import Path
exec(Path(__file__).with_name('_paths.py').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ASSET/'source'/'vrm'/'Base_Male.vrm'))
bpy.ops.wm.save_as_mainfile(filepath=D+'/sculpt/00_base_rigged.blend')
# The complete derivation can be rerun next; this copy also supports a quicker body-only rebuild.
shutil.copy2(ASSET/'source'/'head'/'approved_evaluated_weights.json',WORK/'qa'/'approved-head-evaluated-weights.json')
