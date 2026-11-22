"""Sample from the immutable training split and count human windows consumed by PPO."""
from bisect import bisect_right
from collections import Counter
import json

import torch


# Five seconds of usable decision windows (12 ticks per window at 60 Hz).
# Very short games can still contribute to ordinary replay.
MIN_PRIORITY_WINDOWS = 25


class RecentReplay:
    def __init__(self, directory, split, ranges):
        self.rows = {}
        self.recent = []
        self.cursor = 0
        self.split = split
        self.ranges = ranges
        manifest = directory / "corpus-order.jsonl" if directory else None
        if manifest and manifest.exists():
            with manifest.open() as records:
                for line in records:
                    item = json.loads(line)
                    capture = item["capture"]
                    key, at = item["revision"], item.get("receivedAt")
                    row = self.rows.setdefault(capture, dict(map=item["map"], firstBatch=key, firstReceivedAt=at, batches=0))
                    row.update(lastBatch=key, lastReceivedAt=at, batches=row["batches"] + 1)
            self.ordered = sorted(self.rows, key=lambda c: self.rows[c]["lastBatch"], reverse=True)
            self.recent = [c for c in self.ordered if c in ranges and split.get(c) == "train"
                           and ranges[c][1] - ranges[c][0] >= MIN_PRIORITY_WINDOWS][:3]
        else:
            self.ordered = []
        self.training_order = sorted(ranges, key=lambda c: ranges[c][0])
        self.ends = [ranges[c][1] for c in self.training_order]
        self.sample_counts = {}

    def draw(self, weights, count):
        if not self.ordered:
            # Old local datasets have no trusted reception order. Preserve the existing sampler.
            return torch.multinomial(weights, count, replacement=True)
        priority = count // 4 if self.recent else 0
        balanced = count // 8
        uniform = count - priority - balanced
        draws = [torch.randint(len(weights), (uniform,))]
        if balanced:
            draws.append(torch.multinomial(weights, balanced, replacement=True))
        # Rotate the remainder across recordings, including across optimizer updates.
        for i, capture in enumerate(self.recent):
            n = priority // len(self.recent) + int((i - self.cursor) % len(self.recent) < priority % len(self.recent))
            if n:
                lo, hi = self.ranges[capture]
                draws.append(torch.randint(lo, hi, (n,)))
        if self.recent:
            self.cursor = (self.cursor + priority) % len(self.recent)
        selection = torch.cat(draws)
        hits = Counter(self.training_order[bisect_right(self.ends, idx)] for idx in selection.tolist())
        for capture, count in hits.items():
            counts = self.sample_counts.setdefault(capture, [0, 0])
            counts[0] += count
            counts[1] += 1
        return selection

    def report(self):
        def entry(c):
            lo, hi = self.ranges.get(c, (0, 0))
            draws, updates = self.sample_counts.get(c, (0, 0))
            return {**self.rows[c], "split": self.split.get(c, "unassigned"), "trainWindows": hi - lo,
                    "replayedWindows": draws, "replayUpdates": updates}

        return {"latestReceived": entry(self.ordered[0]) if self.ordered else None,
                "recentTrain": [entry(c) for c in self.recent],
                "latestReplayed": next((entry(c) for c in self.ordered if c in self.sample_counts), None)}
