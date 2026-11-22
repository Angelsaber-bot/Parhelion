"""Fit a search-only teacher using game outcomes from the bundled policy and a matching rollout."""
import argparse
import hashlib
from importlib import import_module
import json
from pathlib import Path
import subprocess
import tempfile

import torch


@torch.no_grad()
def fit(model_path, rollout_path, output, rounds):
    root = Path(__file__).resolve().parents[1]
    base = json.loads(model_path.read_bytes())
    digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
    trainer = import_module("train-self-play")
    states, *_ = trainer.read_trajectories(rollout_path, digest, base["rulesVersion"], base["context"])
    actor = import_module("fit-match-movement").actor_from_json(base)
    h = torch.cat([actor.encode(batch) for batch in states.split(256)]).double()
    h = torch.cat([h, torch.ones_like(h[:, :1])], dim=1)
    clear = states[:, -1, 0] > 0
    if clear.all() or not clear.any():
        raise ValueError("Both search and combat trajectories are required")
    search, combat = h[~clear], h[clear]
    # Generalized eigenvectors favor changes visible during search with a smaller
    # effect on combat. Only scores from subsequent simulations select actions.
    metric = combat.T @ combat / len(combat) + .05 * torch.eye(h.shape[1], dtype=h.dtype)
    whitening = torch.linalg.inv(torch.linalg.cholesky(metric))
    _, vectors = torch.linalg.eigh(whitening @ (search.T @ search / len(search)) @ whitening.T)
    directions = (whitening.T @ vectors[:, -7:]).T
    basis = directions / (search @ directions.T).square().mean(0).sqrt().clamp_min(1e-9)[:, None]
    with tempfile.TemporaryDirectory() as directory:
        proposal, features = (Path(directory) / name for name in ("candidate.json", "basis.json"))
        features.write_text(json.dumps(basis.tolist()))
        subprocess.run(["node", "--import", "tsx", "scripts/train-search-movement.ts", "train-teacher",
                        model_path.resolve(), proposal, str(rounds), features], cwd=root, check=True)
        selected = json.loads(proposal.read_bytes())["out"]
    axes = trainer.SEARCH_AXES
    readout = {"baseSha256": digest, **{key: [selected[key][i] for i in axes] for key in ("weight", "bias")}}
    trainer.bc.write_json(output, readout)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ("model", "rollout", "output"):
        cli.add_argument(name, type=Path)
    cli.add_argument("--rounds", type=int, default=30)
    args = cli.parse_args()
    torch.set_num_threads(2)
    fit(args.model, args.rollout, args.output, args.rounds)
