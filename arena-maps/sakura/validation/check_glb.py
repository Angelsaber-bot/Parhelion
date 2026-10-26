"""Run the shared GLB check for SAKURA: python3 validation/check_glb.py"""
import runpy, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.argv = [sys.argv[0], str(ROOT), 'sakura']
runpy.run_path(str(ROOT.parent / '_lib' / 'check_glb.py'), run_name='__main__')
