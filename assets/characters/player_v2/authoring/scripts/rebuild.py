"""Rebuild all art from only bundled source and Blender 4.3.2 (no network/install)."""
from pathlib import Path
import runpy,json,hashlib,os
ROOT=Path(__file__).resolve().parent
for stage in ['prepare_sources.py','prepare_head_weights.py','build_uniform.py','export_batched.py','cloth_clearance.py']:
 print('\n=== AUTHORING STAGE:',stage,'===',flush=True)
 runpy.run_path(str(ROOT/stage),run_name='__main__')
print('Rebuild finished; inspect manifest and evidence, then perform actual visual/runtime QA.',flush=True)
