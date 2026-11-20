"""Train a visual behavior teacher on causal pairs of first-person Arena frames."""

import base64
import json
import sys
from bisect import bisect_right
from functools import lru_cache

import torch
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader, Dataset


def visual_model():
    return nn.Sequential(
        nn.Conv2d(2, 12, 5, stride=2, padding=2), nn.ReLU(),
        nn.Conv2d(12, 24, 3, stride=2, padding=1), nn.ReLU(),
        nn.AdaptiveAvgPool2d((3, 5)), nn.Flatten(), nn.Linear(360, 48), nn.ReLU(), nn.Linear(48, 14),
    )


def visual_input(previous, current):
    now = pixels(current).float() / 255
    return torch.stack((now, now - pixels(previous).float() / 255))


def frame_pair(frames, ticks, tick, segment):
    """Find only frames displayed before the labelled input. Never cross a life boundary."""
    index = bisect_right(ticks, tick) - 1
    if index < 0:
        return None
    latest, current_segment, current = frames[index]
    if current_segment != segment or tick - latest >= 18:
        return None
    previous = current
    if index and frames[index - 1][1] == segment and latest - frames[index - 1][0] <= 18:
        previous = frames[index - 1][2]
    return previous, current


@lru_cache(maxsize=2048)
def pixels(encoded):
    raw = torch.frombuffer(bytearray(base64.b64decode(encoded, validate=True)), dtype=torch.uint8)
    if len(raw) == 144:
        return raw.reshape(9, 16).repeat_interleave(4, dim=0).repeat_interleave(4, dim=1)
    if len(raw) != 1152:
        raise ValueError("Unsupported Arena visual frame encoding")
    return (torch.stack((raw >> 4, raw & 15), dim=1) * 17).reshape(36, 64)


class VisualExamples(Dataset):
    def __init__(self, dataset):
        self.dataset = dataset
        self.indices = [i for i, pair in enumerate(dataset.views) if pair is not None]

    def __len__(self):
        return len(self.indices)

    def __getitem__(self, item):
        index = self.indices[item]
        previous, current = self.dataset.views[index]
        return visual_input(previous, current), self.dataset.targets[index], index


def distillation_loss(student, teacher):
    # All terms are per sample. Mask unavailable visual supervision at the caller.
    axes = F.smooth_l1_loss(student[:, :4].tanh(), teacher[:, :4].tanh(), beta=.2, reduction="none").mean(1)
    buttons = F.binary_cross_entropy_with_logits(student[:, 4:11], teacher[:, 4:11].sigmoid(), reduction="none").mean(1)
    slots = -(student[:, 11:].log_softmax(dim=1) * teacher[:, 11:].softmax(dim=1)).sum(1)
    return axes * 2 + buttons + .3 * slots


def train_visual_teacher(train_set, holdout_set, args, device, button_weights, losses, atomic_write):
    train, holdout = VisualExamples(train_set), VisualExamples(holdout_set)
    report = {
        "input": "first-person luminance and temporal difference",
        "studentInput": "structured Arena observations",
        "trainWindows": len(train), "holdoutWindows": len(holdout),
        "detailTrainWindows": sum(len(train_set.views[i][1]) == 1536 for i in train.indices),
    }
    if not len(train):
        if args.visual_output:
            raise ValueError("No paired game frames to train the requested visual actor")
        return report
    model = visual_model().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001)
    loader = DataLoader(train, batch_size=args.batch_size, shuffle=True,
                        generator=torch.Generator().manual_seed(args.seed))
    for _ in range(min(args.epochs, 8)):
        for x, y, _ in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = losses(model(x.to(device)), y.to(device), button_weights).mean()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1., error_if_nonfinite=True)
            optimizer.step()
    model.eval()
    with torch.inference_mode():
        soft = torch.zeros((len(train_set), 14))
        mask = torch.zeros(len(train_set), dtype=torch.float32)
        for x, _, indices in DataLoader(train, batch_size=args.batch_size):
            soft[indices] = model(x.to(device)).cpu()
            mask[indices] = 1
        total, constant = 0., 0.
        mean_logits = soft[train.indices].mean(dim=0, keepdim=True).to(device)
        for x, y, _ in DataLoader(holdout, batch_size=args.batch_size):
            y = y.to(device)
            total += losses(model(x.to(device)), y, button_weights).sum().item()
            constant += losses(mean_logits.expand(len(y), -1), y, button_weights).sum().item()
        if len(holdout):
            report.update(holdoutObjective=total / len(holdout), constantOutputObjective=constant / len(holdout))
    train_set.visual_targets = soft, mask
    if args.visual_output:
        atomic_write(args.visual_output, lambda path: torch.save(model.state_dict(), path))
    return report


def run_actor(path):
    """Private subprocess protocol. The sole observation is the bot's own camera image."""
    torch.set_num_threads(1)
    model = visual_model()
    model.load_state_dict(torch.load(path, weights_only=True, map_location="cpu"))
    model.eval()
    previous = None
    print("ready", flush=True)
    with torch.inference_mode():
        for line in sys.stdin:
            frame = json.loads(line)
            current = frame["luminance"]
            if len(current) not in (192, 1536):
                raise ValueError("Invalid Arena camera frame")
            before = current if frame["reset"] or previous is None else previous
            action = model(visual_input(before, current).unsqueeze(0))[0].tolist()
            print(json.dumps(action, allow_nan=False), flush=True)
            previous = current


if __name__ == "__main__":
    run_actor(sys.argv[1])
