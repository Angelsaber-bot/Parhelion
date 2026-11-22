"""Privately review one recorded human's inputs alongside a public Arena result."""
import argparse
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import sys
from statistics import median
import urllib.request

HOST = "https://parhelion-arena.lejiazhang-us.workers.dev"
HZ = 60
END_TOLERANCE_MS = 5_000
UPLOAD_SLACK_MS = 15_000
TOKEN_FILE = Path(__file__).resolve().parents[1] / ".scratch/neural/public.token"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def client():
    opener = urllib.request.build_opener(NoRedirect())
    def get(path, private=False):
        headers = {"User-Agent": "Parhelion-Arena-Training/1.0", "Accept": "application/json"}
        if private:
            if not path.startswith("/training/corpus?"):
                raise ValueError("unexpected private path")
            token = os.environ.get("ARENA_NEURAL_CORPUS_TOKEN") or TOKEN_FILE.read_text().strip()
            if not re.fullmatch("[0-9a-f]{64}", token):
                raise ValueError("invalid local credentials")
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(HOST + path, headers=headers, method="GET")
        with opener.open(request, timeout=40) as response:
            body = response.read(8_000_001)
        if len(body) > 8_000_000:
            raise ValueError("oversized response")
        return json.loads(body)
    return get


def timestamp(text):
    try:
        value = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if value.tzinfo is not None:
            return round(value.timestamp() * 1000)
    except (ValueError, OverflowError):
        pass
    raise argparse.ArgumentTypeError("Use an ISO date and time including its UTC offset.")


def read_receipt(path):
    text = path.read_text().strip()
    if text.startswith("{"):
        text = json.loads(text)["capture"]
    if not isinstance(text, str) or not re.fullmatch("[a-f0-9]{32}", text):
        raise ValueError("invalid receipt")
    return text


def window(result):
    return result["at"] - 1000 * result["ticks"] / HZ - UPLOAD_SLACK_MS, result["at"] + UPLOAD_SLACK_MS


def map_aliases():
    # Match.end records map.data.mapId. The browser training capture uses the
    # lobby slug, which is the map package name except for the original ASTER.
    repo = Path(__file__).resolve().parents[2]
    maps = [("aster", repo / "arena/runtime/map.json")]
    maps.extend((p.parents[1].name, p) for p in (repo / "arena-maps").glob("*/runtime/map.json"))
    aliases = {}
    for slug, path in maps:
        for name in (slug, json.loads(path.read_bytes())["mapId"]):
            if aliases.setdefault(name, slug) != slug:
                raise ValueError("ambiguous map alias")
    return aliases


def recordings(get, map_id, rules, earliest, latest, receipt, aliases):
    revision = get("/training/status")["dataset"]["revision"]
    after, found = 0, {}
    while after < revision:
        records = get(f"/training/corpus?after={after}&through={revision}", private=True)["records"]
        if not records:
            break
        for record in records:
            index, batch = record["id"], record["batch"]
            if not after < index <= revision:
                raise ValueError("unordered private corpus")
            after = index
            capture = batch["capture"]
            if aliases.get(batch["map"]) != map_id or (receipt is not None and capture != receipt):
                continue
            if batch["version"] != 1 or (rules and batch["rulesVersion"] != rules):
                continue
            at = record.get("receivedAt")
            if type(at) is not int or at <= 0:
                return None
            m = found.setdefault(capture, {"first":at, "last":at, "rows":{}, "smoke":{}, "sensor_batches":0, "missing_sensor_batches":0})
            m["first"], m["last"] = min(m["first"], at), max(m["last"], at)
            if not earliest <= at <= latest:
                continue
            if "smokeDepths" in batch:
                m["sensor_batches"] += 1
            else:
                m["missing_sensor_batches"] += 1
            # Never retain image data or identifiers inside the analysis.
            for offset, row in enumerate(batch["rows"]):
                tick = batch["start"] + offset
                if tick in m["rows"] or len(row) != 25 or row[1] not in (0, .5, 1):
                    raise ValueError("invalid or overlapping samples")
                m["rows"][tick] = (row[0], row[1], row[2], row[19], row[22], row[23])
            for tick, *depths in batch.get("smokeDepths", []):
                if any(d < 0 for d in depths):
                    m["smoke"][tick] = depths
    return [m for m in found.values() if m["rows"] and earliest <= m["first"] <= m["last"] <= latest]


def seconds(tick):
    return round(tick / HZ, 3)


def summarize(m):
    counts, examples = {}, {}
    def event(category, **fields):
        counts[category] = counts.get(category, 0) + 1
        values = examples.setdefault(category, [])
        if len(values) < 12:
            values.append(fields)

    previous = None
    last_clear, retreat, retreat_fire = None, None, None
    visible = glimpse = backward = backward_fire = 0
    yaw_changes, bearing_errors = [], []
    pressed = {"ability_or_defense_press":8, "throw_press":64, "dash_press":4}
    def close_retreat(start, end, kind):
        if start is not None:
            event(kind, start_s=seconds(start), end_s=seconds(end))
    for tick, (segment, contact, target_yaw, yaw, mz, buttons) in sorted(m["rows"].items()):
        contiguous = previous is not None and tick == previous[0] + 1 and segment == previous[1]
        if not contiguous:
            if previous:
                close_retreat(retreat, previous[0] + 1, "backward_interval")
                close_retreat(retreat_fire, previous[0] + 1, "backward_with_trigger_interval")
            last_clear = retreat = retreat_fire = None
        if contiguous and previous[2] == 1 and contact != 1:
            event("clear_contact_lost", at_s=seconds(tick), next_contact=contact)
        if contiguous and contact == 1 and previous[2] != 1:
            event("clear_contact_acquired", at_s=seconds(tick),
                  since_last_clear_s=seconds(tick-last_clear) if last_clear is not None else None,
                  abs_bearing_error_deg=round(abs(math.degrees(target_yaw)), 2), trigger_held=bool(buttons & 1))
        if contact == 1:
            visible += 1
            last_clear = tick
            bearing_errors.append(abs(math.degrees(target_yaw)))
        glimpse += int(contact == .5)
        yaw_changes.append(abs(math.degrees(yaw)))
        back = mz < -.25
        while_firing = back and bool(buttons & 1)
        backward += int(back)
        backward_fire += int(while_firing)
        if back and retreat is None:
            retreat = tick
        if not back and retreat is not None:
            close_retreat(retreat, tick, "backward_interval")
            retreat = None
        if while_firing and retreat_fire is None:
            retreat_fire = tick
        if not while_firing and retreat_fire is not None:
            close_retreat(retreat_fire, tick, "backward_with_trigger_interval")
            retreat_fire = None
        if contiguous:
            for key, mask in pressed.items():
                if buttons & mask and not previous[3] & mask:
                    event(key, at_s=seconds(tick), clear_contact=contact == 1)
        previous = (tick, segment, contact, buttons)
    if previous:
        close_retreat(retreat, previous[0] + 1, "backward_interval")
        close_retreat(retreat_fire, previous[0] + 1, "backward_with_trigger_interval")
    for tick, depths in sorted(m["smoke"].items()):
        event("visible_smoke_sample", at_s=seconds(tick), rays_with_smoke=[name for name, v in zip(("left","center","right"), depths) if v < 0])
    def rounded_median(values):
        if not values:
            return None
        return round(median(values), 2)
    if m["smoke"]:
        smoke_evidence = "visible ray samples present; inside-smoke state unavailable"
    elif not m["sensor_batches"]:
        smoke_evidence = "sensor field missing; historical smoke presence unknown"
    elif m["missing_sensor_batches"]:
        smoke_evidence = "no visible sampled smoke in instrumented batches; missing batches have unknown smoke"
    else:
        smoke_evidence = "sensor field present and empty; no visible sampled smoke; inside-smoke state unavailable"
    return {"sampled_input_s":seconds(len(m["rows"])), "first_input_s":seconds(min(m["rows"])),
            "contact_clear_s":seconds(visible), "contact_glimpse_s":seconds(glimpse),
            "backward_input_s":seconds(backward), "backward_with_trigger_s":seconds(backward_fire),
            "median_abs_yaw_input_deg_per_tick":rounded_median(yaw_changes), "median_visible_abs_bearing_error_deg":rounded_median(bearing_errors),
            "event_counts":counts, "first_12_examples_per_kind":examples,
            "smoke_evidence":smoke_evidence, "smoke_sensor_batches":m["sensor_batches"], "missing_smoke_sensor_batches":m["missing_sensor_batches"],
            "time_basis":"recorded inputs / 60 since capture start; not elapsed wall time",
            "interpretation":"Input presses do not establish a shot, hit, defensive effect or grenade release. A clear contact can be a different opponent."}


def review(get, map_id, end, receipt=None):
    # The public endpoint is oldest-first. Refuse an incomplete time neighbourhood.
    aliases = map_aliases()
    if map_id not in aliases:
        return {"status":"unknown_map"}
    map_id = aliases[map_id]
    results = get(f"/stats?since={max(0,end-600_000)}&limit=1000")["records"]
    if len(results) == 1000:
        return {"status":"public_result_window_truncated"}
    nearby = [r for r in results if aliases.get(r["map"]) == map_id]
    targets = [r for r in nearby if abs(r["at"]-end) <= END_TOLERANCE_MS]
    if len(targets) != 1:
        return {"status":"no_unique_public_result", "corresponding_results":len(targets)}
    result = targets[0]
    lo, hi = window(result)
    candidates = recordings(get, map_id, result.get("rulesVersion"), lo, hi, receipt, aliases)
    out = {"map":map_id, "result_end_utc":datetime.fromtimestamp(result["at"]/1000, timezone.utc).isoformat(),
           "score":{side:result["score"][side] for side in ("A","B")}}
    if candidates is None:
        return dict(out, status="missing_private_received_times")
    if len(candidates) != 1:
        return dict(out, status="no_unique_capture_in_receipt_window", candidates=len(candidates))
    candidate = candidates[0]
    for other in nearby:
        if other is result:
            continue
        a, b = window(other)
        # Adjacent rounds on the same map can have overlapping upload tolerance
        # without any overlap in play. Reject actual competing round windows or
        # a capture so short that all of its receipts could belong to either.
        overlapping_play = a + UPLOAD_SLACK_MS <= min(result["at"], candidate["last"]) and max(lo + UPLOAD_SLACK_MS, candidate["first"]) <= other["at"]
        fits_either = a <= candidate["first"] <= candidate["last"] <= b
        if overlapping_play or fits_either:
            return dict(out, status="overlapping_same_map_result")
    return dict(out, status="local_receipt_and_time_match" if receipt else "anonymous_map_and_time_candidate",
                owner_verified_by_service=False,
                timing_basis="round end and simulated duration compared with server receipt times, allowing 15 s for uploads; pauses and delayed batches can prevent a match",
                analysis=summarize(candidate))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--map", required=True, help="Arena map id, for example sakura")
    p.add_argument("--ended-at", required=True, type=timestamp, help="public result ending timestamp, ±5 s; include timezone")
    p.add_argument("--receipt-file", type=Path, help="optional private text file containing a local capture ID or receipt JSON")
    args = p.parse_args()
    if not re.fullmatch("[a-z0-9_-]{1,64}", args.map):
        p.error("invalid map slug")
    try:
        result = review(client(), args.map, args.ended_at, read_receipt(args.receipt_file) if args.receipt_file else None)
        print(json.dumps(result, indent=2, allow_nan=False))
    except (OSError, ValueError, KeyError, TypeError) as exc:
        sys.exit(f"Private review unavailable ({type(exc).__name__}). Check connectivity, the local receipt and the configured corpus credential.")


if __name__ == "__main__":
    main()
