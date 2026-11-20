"""Run bounded, restartable generations against the shared Arena simulator."""
import argparse
import base64
import gzip
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRAINER = ROOT / "tools/train-self-play.py"
SERVICE = "https://parhelion-arena.lejiazhang-us.workers.dev/training"
RULES = int(re.search(r"export const RULES_VERSION = (\d+)", (ROOT / "shared/protocol.ts").read_text())[1])
LIMIT = 18 * 1024 * 1024


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Service:
    def __init__(self):
        self.token = os.environ.get("ARENA_NEURAL_CORPUS_TOKEN", "").strip()
        if not re.fullmatch("[a-f0-9]{64}", self.token):
            raise ValueError("Missing Arena training credential")
        self.http = urllib.request.build_opener(NoRedirect())

    def request(self, path, payload=None, optional=False):
        headers = {"Authorization": "Bearer " + self.token, "Accept": "application/json",
                   "User-Agent": "Parhelion-Arena-Training/1.0", "Content-Type": "application/json"}
        data = json.dumps(payload, separators=(",", ":")).encode() if payload is not None else None
        request = urllib.request.Request(SERVICE + path, data=data, headers=headers, method="PUT" if data else "GET")
        for attempt in range(3):
            try:
                with self.http.open(request, timeout=55) as result:
                    body = result.read(LIMIT + 1)
                if len(body) > LIMIT:
                    raise ValueError("Oversized Arena response")
                return json.loads(body) if body else None
            except urllib.error.HTTPError as exc:
                if optional and exc.code == 404:
                    return None
                if exc.code not in (408, 429, 500, 502, 503, 504) or attempt == 2:
                    raise
            except OSError:
                if attempt == 2:
                    raise
            time.sleep(2 ** attempt)

    def download_corpus(self, revision, directory):
        directory.mkdir(exist_ok=True)
        after = 0
        while after < revision:
            rows = self.request(f"/corpus?after={after}&through={revision}")["records"]
            if not rows:
                break
            for row in rows:
                batch = row["batch"]
                if not after < row["id"] <= revision or batch["rulesVersion"] != RULES:
                    raise ValueError("Out-of-order corpus response")
                if not re.fullmatch("[a-f0-9]{32}", batch["capture"]) or not isinstance(batch["sequence"], int):
                    raise ValueError("Invalid corpus identifier")
                name = f'{RULES}-{batch["capture"]}-{batch["sequence"]}.json'
                (directory / name).write_text(json.dumps(batch, separators=(",", ":")))
                after = row["id"]


def pack(data):
    return base64.b64encode(gzip.compress(data, compresslevel=3, mtime=0)).decode("ascii")


def unpack(data):
    return gzip.decompress(base64.b64decode(data, validate=True))


def run(cmd, *, json_result=False):
    result = subprocess.run(list(map(str, cmd)), cwd=ROOT, check=True,
                            stdout=subprocess.PIPE if json_result else None)
    return json.loads(result.stdout) if json_result else None


def human_gates(metrics):
    if not metrics.get("holdout") or not metrics.get("referenceHoldout"):
        return {"human_holdout": False}
    observed, reference = metrics["holdout"], metrics["referenceHoldout"]
    search = observed["cameraAndMovement"]["noContact"]
    ref = reference["cameraAndMovement"]["noContact"]
    return {
        "human_holdout": metrics["holdoutWindows"] >= 60 and search["windows"] >= 30,
        "human_search": search.get("yawMaeRad", 100) <= min(search.get("stillYawMaeRad", 0), ref.get("yawMaeRad", 0) * 1.1 + .002),
        "human_actions": observed["objective"] <= reference["objective"] * 1.12,
    }


def cycle(args, service, work, progress):
    old = service.request("/selfplay", optional=True) if service else progress
    old = old or {}
    parent = old.get("generation", 0)
    generation = parent + 1
    status = service.request("/status") if service else {}
    if service and status["rulesVersion"] != RULES:
        raise ValueError("Incompatible Arena rules")
    checkpoint = work / "source.pt"
    prior = work / "reference.pt"
    history = json.loads(unpack(old["history"])) if old.get("history") else []
    if service:
        bc = service.request("/checkpoint", optional=True)
        if not bc:
            raise RuntimeError("Waiting for the first human reference checkpoint")
        prior.write_bytes(base64.b64decode(bc["data"], validate=True))
        revision = bc["revision"]
    else:
        shutil.copyfile(args.reference, prior)
        revision = args.human_revision
    if old.get("checkpoint"):
        checkpoint.write_bytes(unpack(old["checkpoint"]))
    else:
        shutil.copyfile(prior, checkpoint)
    actor, candidate = work / "actor.json", work / "candidate.json"
    output, rollout, metrics_file = work / "next.pt", work / "rollout.json", work / "metrics.json"
    seed = (0x314159 + 104729 * generation) % 2147483647
    def phase(state):
        print(f"Generation {generation} | human revision {revision} | {state}", flush=True)
        if service:
            service.request("/selfplay/job", {"rulesVersion": RULES, "parent": parent, "state": state})
    phase("collecting")
    try:
        ts = ["node", "--import", "tsx"]
        run([sys.executable, TRAINER, "export", "--resume", checkpoint, "--output", actor])
        parent_digest = hashlib.sha256(actor.read_bytes()).hexdigest()
        if parent and parent_digest != old["digest"]:
            raise ValueError("Restored actor differs from the last committed generation")
        collect = ts + ["scripts/self-play-rollout.ts", "--model", actor, "--seed", seed, "--output", rollout,
                        "--episodes", args.episodes, "--seconds", args.seconds]
        live = status.get("neural")
        incumbent = work / "incumbent.json"
        if live:
            model = service.request("/neural?version=" + live["digest"])
            incumbent.write_text(json.dumps(model, separators=(",", ":")))
            collect += ["--opponent", incumbent]
        for index, snapshot in enumerate(history):
            opponent = work / f"opponent-{index}.json"
            opponent.write_text(snapshot)
            collect += ["--opponent", opponent]
        run(collect)
        phase("updating")
        evaluate = generation % args.eval_every == 0
        corpus = args.corpus
        if evaluate and service:
            corpus = work / "human"
            service.download_corpus(revision, corpus)
        update = [sys.executable, TRAINER, "update", "--resume", checkpoint, "--rollout", rollout, "--actor", actor,
                  "--checkpoint", output, "--output", candidate, "--metrics", metrics_file, "--prior", prior, "--seed", seed]
        if corpus and Path(corpus).is_dir():
            update += ["--dataset", corpus]
        run(update)
        metrics = json.loads(metrics_file.read_bytes())
        model_text = candidate.read_text()
        digest = hashlib.sha256(model_text.encode()).hexdigest()
        if (metrics["generation"] != generation or metrics["parentHash"] != parent_digest
                or metrics["actorHash"] != digest or digest == parent_digest):
            raise RuntimeError("Optimizer did not advance the expected actor generation")
        failed = []
        promoted = False
        if evaluate:
            phase("evaluating")
            cmd = ts + ["test/bench/evaluate-self-play.ts", candidate, "--seeds", "2", "--seed", random.SystemRandom().randrange(500000000, 1900000000)]
            if live:
                cmd += ["--incumbent", incumbent]
            results = run(cmd, json_result=True)
            gates = human_gates(metrics)
            failed = [key for key, passed in gates.items() if not passed]
            failed += [key for key, passed in results["gates"].items() if not passed]
            if not results["passed"] and all(results["gates"].values()):
                failed.append("simulation")
            promoted = results["passed"] and not failed
            print("Evaluation", json.dumps({"passed": promoted, "failedGates": failed}), flush=True)
        # Keep one older anchor and a recent opponent. The incumbent and parent are also sampled.
        if not history:
            history = [actor.read_text()]
        elif generation % 3 == 0:
            history = [history[0], actor.read_text()]
        record = dict(rulesVersion=RULES, parent=parent, generation=generation, humanRevision=revision,
                      episodes=metrics["games"], optimizerSteps=metrics["updates"],
                      environmentSteps=metrics["environmentSteps"], digest=digest,
                      reason="passed" if promoted else "evaluation_failed" if evaluate else "shadow",
                      failedGates=failed, checkpoint=pack(output.read_bytes()),
                      history=pack(json.dumps(history, separators=(",", ":")).encode()))
        if service:
            if promoted:
                record.update(promote=model_text, expectedReleaseDigest=live["digest"] if live else None)
            service.request("/selfplay", record)
        else:
            tmp = args.state / "state.tmp"
            tmp.write_text(json.dumps(record, separators=(",", ":")))
            tmp.replace(args.state / "state.json")
        summary = {k: v for k, v in record.items() if k not in ("checkpoint", "history", "promote")}
        print(json.dumps(summary), flush=True)
        return record
    except Exception:
        if service:
            try:
                phase("error")
            except Exception:
                pass
        raise


def audit_camera(service, directory):
    corpus = directory / "human"
    status = service.request("/status")
    if status["rulesVersion"] != RULES:
        raise ValueError("Incompatible Arena rules")
    service.download_corpus(status["dataset"]["revision"], corpus)
    visual = directory / "visual.pt"
    run([sys.executable, ROOT / "tools/train-arena-policy.py", corpus, "--rules-version", RULES,
         "--output", directory / "student.json", "--visual-output", visual, "--epochs", 2, "--device", "cpu"])
    run(["node", "tools/visual-audition.mjs", visual, "--smoke", "--seconds", 4])


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--cloud", action="store_true")
    cli.add_argument("--camera-audit-only", action="store_true", help="Test a private pixel-only actor in a rendered Arena match")
    cli.add_argument("--reference", type=Path, default=ROOT / ".scratch/neural/checkpoint.pt")
    cli.add_argument("--corpus", type=Path)
    cli.add_argument("--state", type=Path, default=ROOT / ".scratch/self-play")
    cli.add_argument("--human-revision", type=int, default=0)
    cli.add_argument("--generations", type=int, default=1)
    cli.add_argument("--continuous", action="store_true", help="Keep taking new generations on a persistent runner")
    cli.add_argument("--episodes", type=int, default=12)
    cli.add_argument("--seconds", type=int, default=45)
    cli.add_argument("--eval-every", type=int, default=5)
    args = cli.parse_args()
    if min(args.generations, args.episodes, args.seconds, args.eval_every) < 1:
        cli.error("Counts must be positive")
    if args.cloud and args.corpus:
        cli.error("Cloud evaluation loads the human corpus for its reference revision")
    if args.corpus:
        args.corpus = args.corpus.resolve()
    os.umask(0o077)
    service = Service() if args.cloud else None
    if args.camera_audit_only:
        if not service:
            cli.error("Use --cloud to select the opted-in corpus for the audit")
        with tempfile.TemporaryDirectory(prefix="arena-camera-") as directory:
            audit_camera(service, Path(directory))
        return
    progress = {}
    if not service:
        import fcntl
        args.state.mkdir(parents=True, exist_ok=True)
        lock = (args.state / "lock").open("a")
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if (args.state / "state.json").exists():
            progress = json.loads((args.state / "state.json").read_bytes())
    iteration = 0
    while args.continuous or iteration < args.generations:
        with tempfile.TemporaryDirectory(prefix="arena-self-play-") as directory:
            progress = cycle(args, service, Path(directory), progress)
        iteration += 1


if __name__ == "__main__":
    main()
