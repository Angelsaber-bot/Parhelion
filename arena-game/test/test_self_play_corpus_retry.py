import importlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
cycle = importlib.import_module("self-play-cycle")


class CorpusRetryTest(unittest.TestCase):
    def setUp(self):
        self.service = cycle.Service.__new__(cycle.Service)
        self.service.token = "test"
        self.service.http = Mock()

    def test_retries_the_incomplete_page_without_repeating_saved_rows(self):
        def page(revision):
            batch = {"capture": "a" * 32, "sequence": revision, "map": "frostcourt", "rulesVersion": cycle.RULES}
            return json.dumps({"records": [{"id": revision, "batch": batch}]}).encode()

        self.service.http.open.side_effect = [io.BytesIO(page(1)), io.BytesIO(page(2)[:-3]), io.BytesIO(page(2))]
        with tempfile.TemporaryDirectory() as directory, patch.object(cycle.time, "sleep") as sleep:
            path = Path(directory)
            self.service.download_corpus(2, path)
            entries = [json.loads(line) for line in (path / "corpus-order.jsonl").read_text().splitlines()]
            self.assertEqual([entry["revision"] for entry in entries], [1, 2])
            self.assertEqual(len(list(path.glob("*.json"))), 2)
            sleep.assert_called_once_with(1)
        requests = [c.args[0] for c in self.service.http.open.call_args_list]
        self.assertTrue(requests[1].full_url.endswith("/corpus?after=1&through=2"))
        self.assertIs(requests[1], requests[2])

    def test_exhausts_read_retries_but_does_not_repeat_an_ambiguous_write(self):
        for payload, attempts in [(None, 3), ({"generation": 1}, 1)]:
            with self.subTest(payload=payload):
                self.service.http.open.reset_mock()
                self.service.http.open.side_effect = [io.BytesIO(b"{") for _ in range(attempts)]
                with patch.object(cycle.time, "sleep"), self.assertRaises(json.JSONDecodeError):
                    self.service.request("/selfplay", payload)
                self.assertEqual(self.service.http.open.call_count, attempts)
