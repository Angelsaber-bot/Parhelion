import importlib
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
cli = importlib.import_module("review-match")
END = 1_800_000_000_000
CAPTURE = "a" * 32


def row(contact=0, back=0, buttons=0, segment=1):
    fields = [0] * 25
    fields[0], fields[1], fields[22], fields[23] = segment, contact, back, buttons
    return fields


def batch(n, capture, at, rows, start=0, smoke=None, map_id="sakura"):
    body = {"version":1,"rulesVersion":43,"map":map_id,"capture":capture,"start":start,"rows":rows,"views":["PRIVATE_PIXEL"]}
    if smoke is not None:
        body["smokeDepths"] = smoke
    return {"id":n,"receivedAt":at,"batch":body}


def result(at=END, map_id="sakura_shrine"):
    return {"map":map_id,"at":at,"ticks":1200,"rulesVersion":43,"score":{"A":1,"B":2}}


def api(results, batches):
    def get(path, private=False):
        if path.startswith("/stats?"):
            assert not private
            return {"records":results}
        if path == "/training/status":
            assert not private
            return {"dataset":{"revision":len(batches)}}
        assert path.startswith("/training/corpus?") and private
        return {"records":batches}
    return get


class MatchReview(unittest.TestCase):
    def setUp(self):
        self.records = [
            batch(1, CAPTURE, END-12000, [row(), row(1,-1,1|8), row(0,-1,1), row(1,0,64)], smoke=[[2,0,-.375,0]]),
            batch(2, CAPTURE, END, [row(0,-1,8,2)], start=60)
        ]

    def test_receipt_time_and_private_events(self):
        review = cli.review(api([result()],self.records), "sakura", END, CAPTURE)
        self.assertEqual(review["status"], "local_receipt_and_time_match")
        analysis = review["analysis"]
        self.assertEqual(analysis["backward_with_trigger_s"], .033)
        self.assertEqual(analysis["event_counts"]["ability_or_defense_press"], 1)
        self.assertEqual(analysis["event_counts"]["throw_press"], 1)
        self.assertEqual(analysis["event_counts"]["clear_contact_acquired"], 2)
        self.assertEqual(analysis["first_12_examples_per_kind"]["visible_smoke_sample"][0]["rays_with_smoke"], ["center"])
        encoded = json.dumps(review)
        for private in (CAPTURE, "PRIVATE_PIXEL", "receivedAt"):
            self.assertNotIn(private, encoded)

    def test_ambiguous_owner_and_overlap_are_not_attributed(self):
        other = batch(3, "b"*32, END-200, [row()])
        response = cli.review(api([result()],self.records+[other]), "sakura", END)
        self.assertNotIn("analysis", response)
        response = cli.review(api([result(),result(END+9000)],self.records), "sakura", END, CAPTURE)
        self.assertEqual(response["status"], "overlapping_same_map_result")
        response = cli.review(api([result()],self.records+[other]), "sakura", END, CAPTURE)
        self.assertEqual(response["status"], "local_receipt_and_time_match")

    def test_old_receipts_wrong_clock_and_public_ambiguity_fail_closed(self):
        for batches in ([], [batch(1, CAPTURE, END-100000, [row()])], [{k:v for k,v in self.records[0].items() if k != "receivedAt"}]):
            self.assertNotIn("analysis", cli.review(api([result()],batches),"sakura",END,CAPTURE))
        self.assertNotIn("analysis", cli.review(api([result(),result(END+1000)],self.records), "sakura", END, CAPTURE))

    def test_unique_anonymous_candidate_missing_smoke_stays_unknown(self):
        response = cli.review(api([result()],[batch(1,CAPTURE,END,[row()])]), "sakura", END)
        self.assertEqual(response["status"], "anonymous_map_and_time_candidate")
        self.assertIn("unknown", response["analysis"]["smoke_evidence"])

    def test_adjacent_shrine_and_station_matches_accept_public_or_lobby_id(self):
        shrine = dict(result(END - 30_000), ticks=18_000, score={"A":5, "B":7})
        station = dict(result(map_id="aster_research_station"), ticks=480, score={"A":0, "B":0})
        other = "b" * 32
        get = api([shrine, station], [
            batch(1, CAPTURE, END-35_000, [row()], map_id="sakura"),
            batch(2, other, END-1_000, [row()], map_id="aster")])
        for name in ["sakura", "sakura_shrine"]:
            self.assertEqual(cli.review(get, name, shrine["at"], CAPTURE)["score"], shrine["score"])
            self.assertNotIn("analysis", cli.review(get, name, station["at"], other))
        for name in ["aster", "aster_research_station"]:
            self.assertEqual(cli.review(get, name, station["at"], other)["status"], "local_receipt_and_time_match")
            self.assertNotIn("analysis", cli.review(get, name, station["at"], CAPTURE))
            self.assertNotIn("analysis", cli.review(get, name, shrine["at"]))

    def test_empty_and_missing_smoke_and_input_edges(self):
        active = batch(1, CAPTURE, END-100, [row(0,1), row(0,1,4|8|64)], smoke=[])
        now = cli.review(api([result()], [active]), "sakura", END)["analysis"]
        self.assertEqual(now["event_counts"], dict(dash_press=1, ability_or_defense_press=1, throw_press=1))
        self.assertEqual(now["backward_input_s"], 0)
        self.assertIn("present and empty", now["smoke_evidence"])
        legacy = batch(2, CAPTURE, END, [row()], start=2)
        mixed = cli.review(api([result()], [active, legacy]), "sakura", END)["analysis"]
        self.assertEqual((mixed["smoke_sensor_batches"], mixed["missing_smoke_sensor_batches"]), (1, 1))
        self.assertIn("unknown", mixed["smoke_evidence"])
