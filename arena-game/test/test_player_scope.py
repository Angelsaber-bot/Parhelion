from importlib import import_module
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
bc = import_module("train-arena-policy")


class PlayerScopeTest(unittest.TestCase):
    def test_only_confirmed_full_captures_are_loaded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "matches"
            data.mkdir()
            captures = ["a" * 32, "b" * 32, "c" * 32]
            for capture in captures:
                for seq in (0, 1):
                    batch = dict(version=1, capture=capture, map="aster", sequence=seq, start=seq*12, rulesVersion=43)
                    (data / f"{capture}-{seq}.json").write_text(json.dumps(batch))
            manifest = root / "selection.json"
            manifest.write_text(json.dumps({bc.capture_digest(captures[0]): "train", bc.capture_digest(captures[1]): "holdout"}))
            with patch.dict(os.environ, {"ARENA_PLAYER_DEMOS": str(manifest)}):
                _, groups = bc.load_captures(data, 43)
                self.assertEqual([len(groups[k]) for k in captures[:2]], [2, 2])
                self.assertNotIn(captures[2], groups)
