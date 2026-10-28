"""Portable path contract, evaluated by authoring scripts after Blender's `--`."""
from pathlib import Path
import argparse,sys
_args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
_parser=argparse.ArgumentParser(add_help=False)
_parser.add_argument('--asset-root',type=Path,default=Path(__file__).resolve().parents[2])
_parser.add_argument('--workdir',type=Path)
_parser.add_argument('--output-dir',type=Path)
_opts,_remaining=_parser.parse_known_args(_args)
ASSET=_opts.asset_root.resolve();WORK=(_opts.workdir or ASSET/'authoring'/'build').resolve();OUTPUT=(_opts.output_dir or ASSET).resolve()
D=str(WORK);OUT=str(OUTPUT);H=str(ASSET/'source'/'head')
for p in [WORK/'sculpt',WORK/'qa',WORK/'renders',OUTPUT]:p.mkdir(parents=True,exist_ok=True)
