"""Train a causal PyTorch imitation policy from opted-in Arena match batches."""

import argparse
from collections import defaultdict, deque
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import re
import sys
from tempfile import NamedTemporaryFile

try:
    import torch
    from torch import nn
    from torch.nn import functional as F
    from torch.utils.data import DataLoader, Dataset
except ImportError as error:
    raise SystemExit("Install the Arena ML requirements (PyTorch) in your training environment.") from error


OBSERVATIONS = 18
SCENE = 12
FEATURES = OBSERVATIONS + SCENE
CHUNK = 12
ROW_SIZE = OBSERVATIONS + 7
AXES_START = OBSERVATIONS + 1
BUTTON_COLUMN = AXES_START + 4
SLOT_COLUMN = BUTTON_COLUMN + 1
BUTTONS = 7
OUTPUTS = 4 + BUTTONS + 3
YAW_SCALE, PITCH_SCALE = .9, .55


def integer(value, low, high):
    return type(value) is int and low <= value <= high


def bounded(value, limit):
    return type(value) in (int, float) and -limit <= value <= limit


def batch_rows(batch, path):
    rows = batch.get("rows")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 240:
        raise ValueError(f"{path}: invalid input rows")
    segment = 0
    for row in rows:
        if not isinstance(row, list) or len(row) != ROW_SIZE or not integer(row[0], segment, 10**9):
            raise ValueError(f"{path}: invalid input row")
        if (any(not bounded(value, 2) for value in row[1:AXES_START]) or
                any(not bounded(value, 4) for value in row[AXES_START:AXES_START + 2]) or
                any(not bounded(value, 2) for value in row[AXES_START + 2:BUTTON_COLUMN]) or
                not integer(row[BUTTON_COLUMN], 0, 127) or not integer(row[SLOT_COLUMN], 0, 2)):
            raise ValueError(f"{path}: invalid observations or controls")
        segment = row[0]
    return rows


def batch_scenes(batch, rows, start, path):
    scenes = batch.get("exploration", [])
    if not isinstance(scenes, list) or len(scenes) > math.ceil(len(rows) / CHUNK):
        raise ValueError(f"{path}: invalid scene records")
    previous = start - CHUNK
    for scene in scenes:
        if (not isinstance(scene, list) or len(scene) != SCENE + 1 or
                not integer(scene[0], previous + CHUNK, start + len(rows) - 1) or
                any(not bounded(value, 1) for value in scene[1:])):
            raise ValueError(f"{path}: invalid scene record")
        previous = scene[0]
    return scenes


def read_batch(path):
    try:
        batch = json.loads(path.read_bytes())
    except (OSError, ValueError) as error:
        raise ValueError(f"{path}: {error}") from error
    if not isinstance(batch, dict) or batch.get("version") != 1:
        raise ValueError(f"{path}: expected an Arena TrainingBatch v1 JSON file")
    return batch


def load_captures(directory, rules):
    grouped = defaultdict(dict)
    versions = set()
    if not directory.is_dir():
        raise ValueError(f"{directory}: expected a directory of Arena batches")
    for path in sorted(directory.rglob("*.json")):
        batch = read_batch(path)
        capture, map_id = batch.get("capture"), batch.get("map")
        if not isinstance(capture, str) or re.fullmatch(r"[0-9a-f]{32}", capture) is None:
            raise ValueError(f"{path}: invalid capture identifier")
        if not isinstance(map_id, str) or re.fullmatch(r"[a-z0-9-]{1,32}", map_id) is None:
            raise ValueError(f"{path}: invalid map identifier")
        sequence, start, version = (batch.get(field) for field in ("sequence", "start", "rulesVersion"))
        if not integer(sequence, 0, 10**8) or not integer(start, 0, 10**9) or not integer(version, 1, 65535):
            raise ValueError(f"{path}: invalid batch identity")
        versions.add(version)
        if rules is not None and version != rules:
            continue
        existing = grouped[capture].get(sequence)
        if existing is not None and batch != read_batch(existing):
            raise ValueError(f"{path}: conflicting copy of a capture batch")
        grouped[capture][sequence] = path
    if rules is None and len(versions) > 1:
        raise ValueError(f"The corpus has multiple rules versions {sorted(versions)}. Choose --rules-version.")
    if not grouped:
        raise ValueError("No matching Arena batches. Play recorded matches first.")
    captures = {capture: [paths[sequence] for sequence in sorted(paths)] for capture, paths in grouped.items()}
    return rules if rules is not None else versions.pop(), captures


def synthetic_captures():
    """Controlled traces for testing the pipeline; never data for a live model."""
    result = {}
    for index in range(8):
        rows, scenes = [], []
        for turn in range(20):
            heading = -1 if (index + turn) % 2 else 1
            contact = (index + turn) % 3 == 0
            obs = [0.0] * OBSERVATIONS
            obs[0], obs[1], obs[12] = float(contact), .43 * heading if contact else 0, 1
            scenes.append([turn * CHUNK, heading * .6, 0, 0, 0, 1, 0, .5, 1, .5, 0, 0, 0])
            for tick in range(CHUNK):
                buttons = 1 if contact else (2 if tick == 4 and heading == 1 else 0)
                rows.append([1, *obs, .04 * heading, .006 * heading, .25 * heading, .6, buttons, index % 3])
        result[f"{index:032x}"] = [{"start": 0, "rows": rows, "exploration": scenes, "map": "fixture"}]
    return result


def capture_windows(batches):
    """Yield causal inputs and contiguous labels. Gaps and respawns reset history."""
    rows, scenes = [], []
    start = 0
    current_map = None
    for item in batches:
        batch = item if isinstance(item, dict) else read_batch(item)
        batch_start, map_id = batch["start"], batch.get("map")
        if current_map is not None and map_id != current_map:
            raise ValueError(f"{item}: map changed within a capture")
        current_map = map_id
        if rows and batch_start != start + len(rows):
            if batch_start < start + len(rows):
                raise ValueError(f"{item}: overlapping input ranges within a capture")
            yield from windows(rows, scenes, start)
            rows, scenes = [], []
        if not rows:
            start = batch_start
        new_rows = batch_rows(batch, item)
        scenes.extend(batch_scenes(batch, new_rows, batch_start, item))
        rows.extend(new_rows)
    yield from windows(rows, scenes, start)


def windows(rows, scenes, start):
    last_segment, last_tick = None, None
    for tick, *scene in scenes:
        index = tick - start
        segment = rows[index][0]
        chunk = []
        for row in rows[index:index + CHUNK]:
            if row[0] != segment:
                break
            chunk.append(row)
        if len(chunk) < CHUNK // 2:
            continue
        obs = rows[index][1:AXES_START]
        axes = [sum(row[column] for row in chunk) / scale
                for column, scale in zip(range(AXES_START, BUTTON_COLUMN), (YAW_SCALE, PITCH_SCALE, len(chunk), len(chunk)))]
        buttons = [float(any(row[BUTTON_COLUMN] & (1 << flag) for row in chunk)) for flag in range(BUTTONS)]
        target = [max(-1, min(1, value)) for value in axes] + buttons + [float(chunk[-1][SLOT_COLUMN])]
        contiguous = last_segment == segment and last_tick is not None and tick - last_tick == CHUNK
        yield obs + scene, target, contiguous
        last_segment, last_tick = segment, tick


def usable_captures(captures):
    usable = {}
    for capture, batches in captures.items():
        examples = list(capture_windows(batches))
        if examples:
            usable[capture] = examples
    return usable


def split_captures(captures, seed, fraction, prior):
    assignments = dict(prior)
    fresh = sorted(set(captures) - assignments.keys())

    def digest(capture):
        return int.from_bytes(hashlib.sha256(f"{seed}/{capture}".encode()).digest()[:8], "big") / 2**64

    for capture in fresh:
        assignments[capture] = "holdout" if digest(capture) < fraction else "train"
    for split in ("train", "holdout"):
        if not any(assignments[capture] == split for capture in captures):
            if not fresh:
                raise ValueError(f"The retained corpus has no {split} captures from the checkpoint split.")
            candidate = min(fresh, key=digest) if split == "holdout" else max(fresh, key=digest)
            assignments[candidate] = split
            fresh.remove(candidate)
    return assignments


class ArenaDataset(Dataset):
    """Keep one copy of each feature row and pad at episode boundaries."""

    def __init__(self, examples, context):
        self.context = context
        x, y, self.starts = [], [], []
        for capture in examples:
            for features, targets, contiguous in capture:
                self.starts.append(self.starts[-1] if contiguous else len(x))
                x.append(features)
                y.append(targets)
        self.features = torch.tensor(x, dtype=torch.float32)
        self.targets = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.starts)

    def __getitem__(self, index):
        left = max(self.starts[index], index - self.context + 1)
        state = self.features[left:index + 1]
        if len(state) < self.context:
            state = F.pad(state, (0, 0, self.context - len(state), 0))
        return state, self.targets[index]


@dataclass(frozen=True)
class Config:
    context: int
    width: int
    heads: int
    layers: int
    ff: int
    dropout: float


class Block(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.heads = config.heads
        self.norm1 = nn.LayerNorm(config.width, eps=1e-5)
        self.qkv = nn.Linear(config.width, 3 * config.width)
        self.attn = nn.Linear(config.width, config.width)
        self.norm2 = nn.LayerNorm(config.width, eps=1e-5)
        self.up = nn.Linear(config.width, config.ff)
        self.down = nn.Linear(config.ff, config.width)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, state):
        batch, ticks, width = state.shape
        heads = self.heads
        q, k, v = self.qkv(self.norm1(state)).reshape(batch, ticks, 3, heads, width // heads).permute(2, 0, 3, 1, 4)
        attended = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        state = state + self.dropout(self.attn(attended.transpose(1, 2).reshape(batch, ticks, width)))
        return state + self.dropout(self.down(F.relu(self.up(self.norm2(state)))))


class ArenaPolicy(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.embed = nn.Linear(FEATURES, config.width)
        self.position = nn.Parameter(torch.empty(config.context, config.width))
        nn.init.normal_(self.position, std=.02)
        self.layers = nn.ModuleList(Block(config) for _ in range(config.layers))
        self.norm = nn.LayerNorm(config.width, eps=1e-5)
        self.out = nn.Linear(config.width, OUTPUTS)

    def forward(self, state):
        state = self.embed(state) + self.position
        for layer in self.layers:
            state = layer(state)
        return self.out(self.norm(state[:, -1]))


def losses(logits, target, button_weights):
    axes = F.smooth_l1_loss(logits[:, :4].tanh(), target[:, :4], beta=.2, reduction="none")
    axes = (axes * (1 + target[:, :4].abs())).mean(dim=1)
    buttons = F.binary_cross_entropy_with_logits(
        logits[:, 4:11], target[:, 4:11], pos_weight=button_weights, reduction="none"
    ).mean(dim=1)
    weapon = F.cross_entropy(logits[:, 11:], target[:, 11].long(), reduction="none")
    return axes * 2 + buttons + weapon * .3


@torch.inference_mode()
def evaluate(model, loader, device, button_weights):
    model.eval()
    loss, samples = 0.0, 0
    camera = {key: [0.0] * 6 for key in ("all", "noContact", "visibleContact")}
    tp = torch.zeros(BUTTONS)
    fp = torch.zeros(BUTTONS)
    fn = torch.zeros(BUTTONS)
    slot_correct = 0
    for states, actions in loader:
        states, actions = states.to(device), actions.to(device)
        logits = model(states)
        loss += losses(logits, actions, button_weights).sum().item()
        samples += len(states)
        errors = (logits[:, :4].tanh() - actions[:, :4]).abs()
        visible = states[:, -1, 0] > .5
        for key, mask in (("all", torch.ones_like(visible)), ("noContact", ~visible), ("visibleContact", visible)):
            counts = camera[key]
            counts[0] += mask.sum().item()
            for i, value in enumerate(errors[mask].sum(dim=0).tolist(), start=1):
                counts[i] += value
            counts[5] += actions[mask, 0].abs().sum().item()
        fired = logits[:, 4:11] >= 0
        actual = actions[:, 4:11] > .5
        tp += (fired & actual).sum(dim=0).cpu()
        fp += (fired & ~actual).sum(dim=0).cpu()
        fn += (~fired & actual).sum(dim=0).cpu()
        slot_correct += (logits[:, 11:].argmax(dim=1) == actions[:, 11].long()).sum().item()
    separated = {}
    for key, (count, yaw, pitch, mx, mz, still) in camera.items():
        separated[key] = ({"windows": int(count), "yawMaeRad": yaw * YAW_SCALE / count,
                           "pitchMaeRad": pitch * PITCH_SCALE / count, "moveMae": (mx + mz) / (2 * count),
                           "stillYawMaeRad": still * YAW_SCALE / count} if count else {"windows": 0})
    return {
        "objective": loss / samples, "cameraAndMovement": separated, "weaponAccuracy": slot_correct / samples,
        "buttonF1": (2 * tp / (2 * tp + fp + fn).clamp(min=1)).tolist(),
        "buttonPositives": (tp + fn).long().tolist(),
    }


def weights(module):
    return {"weight": module.weight.detach().cpu().tolist(), "bias": module.bias.detach().cpu().tolist()}


def wire_model(model, rules_version, synthetic):
    config = model.config
    assignments = ("norm1", "qkv", "attn", "norm2", "up", "down")
    result = {
        "version": 1, "rulesVersion": rules_version, "context": config.context,
        "width": config.width, "heads": config.heads, "embed": weights(model.embed),
        "position": model.position.detach().cpu().tolist(),
        "layers": [{name: weights(getattr(layer, name)) for name in assignments} for layer in model.layers],
        "norm": weights(model.norm), "out": weights(model.out),
    }
    if synthetic:
        result["synthetic"] = True
    return result


@torch.inference_mode()
def parity_fixture(model):
    model.eval()
    device = model.embed.weight.device
    length = model.config.context
    generator = torch.Generator().manual_seed(3943)
    observations = torch.rand(length + 3, FEATURES, generator=generator) * 2 - 1
    state = torch.zeros((length, FEATURES), device=device)
    logits = []
    for frame in observations:
        state = torch.cat((state[1:], frame.to(device).unsqueeze(0)), dim=0)
        logits.append(model(state.unsqueeze(0))[0].cpu().tolist())
    return {"observations": observations.tolist(), "logits": logits}


def atomic_write(path, write):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
    try:
        write(temporary)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def write_json(path, data):
    atomic_write(path, lambda temporary: temporary.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n"))


def automatic_device():
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def train(args):
    config = Config(args.context, args.width, args.heads, args.layers, args.ff or args.width * 4, args.dropout)
    rules, batches = ((args.rules_version or 42), synthetic_captures()) if args.synthetic else load_captures(args.dataset, args.rules_version)
    captures = usable_captures(batches)
    if len(captures) < 2:
        raise ValueError(f"Found {len(captures)} usable captures. Record at least two separately started Arena matches.")
    saved = torch.load(args.resume, map_location="cpu", weights_only=True) if args.resume else None
    signature = {"config": vars(config), "rulesVersion": rules, "synthetic": args.synthetic, "seed": args.seed, "holdout": args.holdout}
    if saved and saved.get("signature") != signature:
        raise ValueError("Checkpoint incompatible with the requested model configuration, rules, or capture split.")
    assignments = split_captures(captures, args.seed, args.holdout, saved["split"] if saved else {})
    train_groups = [frames for capture, frames in captures.items() if assignments[capture] == "train"]
    holdout_groups = [frames for capture, frames in captures.items() if assignments[capture] == "holdout"]
    train_set, holdout_set = (ArenaDataset(groups, config.context) for groups in (train_groups, holdout_groups))
    print(f"Rules v{rules} | train {len(train_set)} windows / {len(train_groups)} captures | holdout {len(holdout_set)} windows / {len(holdout_groups)} captures", flush=True)

    device = torch.device(automatic_device() if args.device == "auto" else args.device)
    torch.manual_seed(args.seed)
    if device.type == "cpu":
        torch.set_num_threads(min(4, torch.get_num_threads()))
    model = ArenaPolicy(config).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    if saved:
        model.load_state_dict(saved["model"])
        optimizer.load_state_dict(saved["optimizer"])
        for group in optimizer.param_groups:
            group["lr"] = args.learning_rate
    generator = torch.Generator()
    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True, generator=generator)
    holdout_loader = DataLoader(holdout_set, batch_size=args.batch_size)
    positive = train_set.targets[:, 4:11].sum(dim=0)
    button_weights = ((len(train_set) - positive) / positive.clamp(min=1)).sqrt().clamp(1, 12).to(device)
    best, best_state = None, None
    start_epoch = saved["epoch"] if saved else 0
    for epoch in range(start_epoch + 1, start_epoch + args.epochs + 1):
        generator.manual_seed(args.seed + epoch)
        torch.manual_seed(args.seed + epoch)
        model.train()
        train_loss = 0.0
        for states, targets in train_loader:
            states, targets = states.to(device), targets.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = losses(model(states), targets, button_weights).mean()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0, error_if_nonfinite=True)
            optimizer.step()
            train_loss += loss.item() * len(states)
        validation = evaluate(model, holdout_loader, device, button_weights)
        print(f"epoch {epoch}: train {train_loss / len(train_set):.5f}, holdout {validation['objective']:.5f}", flush=True)
        if best is None or validation["objective"] < best["holdout"]["objective"]:
            best = {"epoch": epoch, "trainingObjective": train_loss / len(train_set), "holdout": validation}
            best_state = {name: value.detach().cpu().clone() for name, value in model.state_dict().items()}
        if args.checkpoint:
            state = {"signature": signature, "split": assignments, "epoch": epoch,
                     "model": model.state_dict(), "optimizer": optimizer.state_dict()}
            atomic_write(args.checkpoint, lambda path: torch.save(state, path))

    model.load_state_dict(best_state)
    model.eval()
    write_json(args.output, wire_model(model, rules, args.synthetic))
    if args.fixture:
        write_json(args.fixture, parity_fixture(model))
    report = {
        "rulesVersion": rules, "data": "synthetic-fixture" if args.synthetic else "human-demonstrations",
        "parameters": sum(parameter.numel() for parameter in model.parameters()),
        "trainCaptures": len(train_groups), "trainWindows": len(train_set),
        "holdoutCaptures": len(holdout_groups), "holdoutWindows": len(holdout_set), **best,
    }
    if args.metrics:
        write_json(args.metrics, report)
    print(json.dumps(report, allow_nan=False), flush=True)


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, nargs="?", help="directory containing opted-in TrainingBatch v1 JSON files")
    parser.add_argument("--output", type=Path, required=True, help="game-format JSON weights")
    parser.add_argument("--rules-version", type=int, help="filter to one game rules version")
    parser.add_argument("--metrics", type=Path, help="held-out metrics JSON")
    parser.add_argument("--checkpoint", type=Path, help="save current model and optimizer after every epoch")
    parser.add_argument("--resume", type=Path, help="continue a training checkpoint for additional epochs")
    parser.add_argument("--fixture", type=Path, help="export a small PyTorch-to-game numerical parity fixture")
    parser.add_argument("--synthetic", action="store_true", help="explicit QA-only traces; output cannot be activated in Arena")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--context", type=int, default=8)
    parser.add_argument("--width", type=int, default=64)
    parser.add_argument("--heads", type=int, default=4)
    parser.add_argument("--layers", type=int, default=3)
    parser.add_argument("--ff", type=int, help="feed-forward layer width, default four times --width")
    parser.add_argument("--dropout", type=float, default=.1)
    parser.add_argument("--holdout", type=float, default=.2, help="approximate fraction of whole captures to hold out")
    parser.add_argument("--seed", type=int, default=61855)
    parser.add_argument("--device", default="auto", choices=("auto", "cpu", "mps", "cuda"))
    args = parser.parse_args()
    if (args.dataset is None) == (not args.synthetic):
        parser.error("provide either a corpus directory or --synthetic")
    if (not 1 <= args.context <= 16 or not 2 <= args.width <= 128 or not 1 <= args.heads <= 8 or
            args.width % args.heads or not 1 <= args.layers <= 6 or
            (args.ff is not None and not 1 <= args.ff <= 4 * args.width)):
        parser.error("unsupported model dimensions for the Arena runtime")
    feedforward = args.ff or 4 * args.width
    multiplies = args.context * args.width * (
        FEATURES + (args.context + 1) * args.layers + args.layers * (4 * args.width + 2 * feedforward)
    )
    if multiplies > 4_000_000:
        parser.error("model exceeds the Arena runtime inference budget")
    if (not 1 <= args.epochs or not 1 <= args.batch_size or not 0 < args.learning_rate <= 1 or
            not 0 <= args.dropout < 1 or not 0 < args.holdout < 1 or not 0 <= args.seed < 2**31):
        parser.error("invalid training settings")
    if args.rules_version is not None and not integer(args.rules_version, 1, 65535):
        parser.error("invalid rules version")
    artifacts = [p.resolve() for p in (args.output, args.metrics, args.fixture, args.checkpoint) if p]
    if len(set(artifacts)) != len(artifacts) or (args.dataset and any(p.is_relative_to(args.dataset.resolve()) for p in artifacts)):
        parser.error("use separate output paths outside the input corpus")
    if args.resume and any(args.resume.resolve() == p.resolve() for p in (args.output, args.metrics, args.fixture) if p):
        parser.error("do not use the resume checkpoint path for a JSON output")
    try:
        train(args)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Arena ML: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(cli())
