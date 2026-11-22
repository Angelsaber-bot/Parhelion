import importlib
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts"), str(ROOT / "tools")]
cycle = importlib.import_module("self-play-cycle")
from arena_recent_replay import RecentReplay


class RecentReplayTest(unittest.TestCase):
    def test_paged_corpus_uses_server_order_not_names_and_excludes_holdout(self):
        captures = ["f" * 32, "e" * 32, "d" * 32, "a" * 32, "b" * 32]
        maps = ["old", "sakura", "temple", "short", "reserved"]
        def row(revision, capture_index, sequence, at=None):
            return {"id": revision, **({"receivedAt": at} if at else {}),
                    "batch": dict(capture=captures[capture_index], sequence=sequence,
                                  rulesVersion=cycle.RULES, map=maps[capture_index])}

        pages = [[row(1, 0, 0), row(2, 1, 0, 1234), row(3, 2, 0, 1244)],
                 [row(4, 1, 1, 1254), row(5, 3, 0, 1264), row(6, 4, 0, 1274)]]
        service = cycle.Service.__new__(cycle.Service)
        service.request = Mock(side_effect=[{"records": page} for page in pages])
        with TemporaryDirectory() as folder:
            path = Path(folder)
            service.download_corpus(6, path)
            self.assertEqual(sorted(p.suffix for p in path.iterdir()), [".json"] * 6 + [".jsonl"])
            ranges = dict(zip(captures[:4], [(0, 120), (120, 150), (150, 180), (180, 181)]))
            split = {c: "holdout" if c == captures[-1] else "train" for c in captures}
            replay = RecentReplay(path, split, ranges)
            torch.manual_seed(32)
            samples = torch.cat([replay.draw(torch.ones(181), 64) for _ in range(3)])
            report = replay.report()
            self.assertEqual(report["latestReceived"]["map"], "reserved")
            self.assertEqual(report["latestReceived"]["trainWindows"], 0)
            self.assertEqual([c["map"] for c in report["recentTrain"]], ["sakura", "temple", "old"])
            actual_latest = "short" if (samples == 180).any() else "sakura"
            self.assertEqual(report["latestReplayed"]["map"], actual_latest)
            recent = report["recentTrain"][0]
            self.assertEqual((recent["firstBatch"], recent["lastBatch"], recent["batches"]), (2, 4, 2))
            self.assertEqual((recent["firstReceivedAt"], recent["lastReceivedAt"]), (1234, 1254))
            self.assertEqual(recent["replayedWindows"], int(((samples >= 120) & (samples < 150)).sum()))
            self.assertGreaterEqual(recent["replayedWindows"], 16)
            self.assertEqual(recent["replayUpdates"], 3)
            self.assertIsNone(report["recentTrain"][-1]["firstReceivedAt"])
            self.assertFalse(any(c in json.dumps(report) for c in captures))

    def test_absent_manifest_preserves_existing_local_draws(self):
        weights = torch.tensor([2., 1., 6.])
        with TemporaryDirectory() as folder:
            replay = RecentReplay(Path(folder), {}, {})
            torch.manual_seed(28)
            sample = replay.draw(weights, 4)
            torch.manual_seed(28)
            self.assertEqual(sample.tolist(), torch.multinomial(weights, 4, replacement=True).tolist())
            self.assertIsNone(replay.report()["latestReceived"])
