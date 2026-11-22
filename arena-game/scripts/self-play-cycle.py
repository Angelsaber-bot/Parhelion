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
        self.replay_key = None

    def request(self, path, payload=None, optional=False, raw=False, public=False):
        headers = {"Accept": "application/json", "User-Agent": "Parhelion-Arena-Training/1.0",
                   "Content-Type": "application/json"}
        if not public:
            headers["Authorization"] = "Bearer " + self.token
        data = json.dumps(payload, separators=(",", ":")).encode() if payload is not None else None
        request = urllib.request.Request(SERVICE + path, data=data, headers=headers, method="PUT" if data else "GET")
        for attempt in range(3):
            try:
                with self.http.open(request, timeout=55) as result:
                    body = result.read(LIMIT + 1)
                if len(body) > LIMIT:
                    raise ValueError("Oversized Arena response")
                return body if raw else (json.loads(body) if body else None)
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
        order = []
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
                order.append(json.dumps({"capture": batch["capture"], "map": batch["map"],
                                         "revision": after, "receivedAt": row.get("receivedAt")}))
        # Private temporary index, outside the *.json pattern used for input batches.
        temporary = directory / "corpus-order.tmp"
        temporary.write_text("\n".join(order))
        temporary.replace(directory / "corpus-order.jsonl")

    def game_supports(self, version):
        for attempt in range(4):
            try:
                worker = self.request("/status", public=True)
                page = worker.get("playableRuntime") or {}
                if all(isinstance(runtime, dict) and runtime.get("rulesVersion") == RULES
                       and runtime.get("neuralPolicyVersion", 0) >= version for runtime in (worker, page)):
                    return True
            except (OSError, ValueError, TypeError):
                pass
            if attempt < 3:
                time.sleep(8)
        return False

    def replay_corpus(self, directory, reference_revision, dataset):
        # Retention can remove old captures even when the human checkpoint stays the same.
        key = (reference_revision, dataset["batches"], dataset["revision"])
        if self.replay_key != key or not directory.is_dir():
            if directory.exists():
                shutil.rmtree(directory)
            self.download_corpus(reference_revision, directory)
            self.replay_key = key
        return directory


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
    if not all({"unseenTurn", "unseenQuiet"} <= side["cameraAndMovement"].keys() for side in (observed, reference)):
        return {"human_holdout": False}
    turns, quiet = (observed["cameraAndMovement"][group] for group in ("unseenTurn", "unseenQuiet"))
    ref_turns, ref_quiet = (reference["cameraAndMovement"][group] for group in ("unseenTurn", "unseenQuiet"))
    direct_gates = {}
    if metrics.get("controller") == "learned-input-v1":
        for group, gate in (("visibleTrigger", "human_trigger"), ("lostContactTrigger", "human_lost_trigger")):
            trigger, baseline = observed.get(group, {}), reference.get(group, {})
            # Both models see the same held-out actions. Continued fire and releasing
            # the trigger are scored against the recorded player, including after contact loss.
            direct_gates[gate] = (trigger.get("windows", 0) > 0 and trigger["windows"] == baseline.get("windows")
                                  and trigger["shotsRequested"] == baseline.get("shotsRequested")
                                  and trigger["brier"] <= baseline["brier"] + .02)
        contact = observed["cameraAndMovement"]["visibleContact"]
        reference_contact = reference["cameraAndMovement"]["visibleContact"]
        direct_gates["human_tracking"] = (contact["windows"] > 0 and all(
            contact[axis] <= reference_contact[axis] * 1.1 + .002 for axis in ("yawMaeRad", "pitchMaeRad")))
    return {
        **direct_gates,
        "human_holdout": metrics["holdoutWindows"] >= 60 and search["windows"] >= 30
                         and turns["windows"] >= 8 and quiet["windows"] >= 8,
        # During genuine search turns a stationary policy must lose. Quiet windows
        # separately catch a policy that swings the camera when the player stood still.
        "human_search": (turns.get("yawMaeRad", 100) < turns.get("stillYawMaeRad", 0)
                         and turns.get("yawMaeRad", 100) <= ref_turns.get("yawMaeRad", 0) * 1.1 + .002
                         and search.get("yawMaeRad", 100) <= ref.get("yawMaeRad", 0) * 1.1 + .002),
        "human_quiet": quiet.get("yawMaeRad", 100) <= ref_quiet.get("yawMaeRad", 0) * 1.1 + .002,
        "human_actions": observed["objective"] <= reference["objective"] * 1.12,
    }


def evaluation_report(results, metrics):
    scenarios = results["byScenario"]
    probe = results.get("diagnostic")
    official = results["byMode"]
    opponent = results.get("comparedOpponent") or ("incumbent" if results["incumbent"] != "baseline" else "baseline")
    modes = probe["modes"] if probe else official.get(opponent)
    if not modes:
        return None
    def tally(mode):
        row = modes[mode]
        return [row["legWins"], row["legDraws"], row["legLosses"]]
    report = dict(rearSeconds=scenarios["rear-search"]["candidate"]["meanContactSeconds"],
                referenceRearSeconds=scenarios["rear-search"]["opponent"]["meanContactSeconds"],
                smokeBlindFire=scenarios["smoke"]["candidate"]["smokeHiddenFireFraction"],
                wallEscape=scenarios["wall"]["candidate"]["wallClearFraction"],
                roundSet="diagnostic" if probe else "tournament", opponent=opponent,
                duel=tally("1v1"), team=tally("2v2"))
    if results.get("perceptionMatchedReference"):
        report["perceptionMatchedReference"] = True
    if metrics.get("holdout") and metrics.get("referenceHoldout"):
        sides = [metrics[key]["cameraAndMovement"] for key in ("holdout", "referenceHoldout")]
        if all(side[group]["windows"] for side in sides for group in ("unseenTurn", "unseenQuiet")):
            report["humanCamera"] = dict(captures=metrics["holdoutCaptures"], windows=metrics["holdoutWindows"],
                turn=[side["unseenTurn"]["yawMaeRad"] for side in sides],
                quiet=[side["unseenQuiet"]["yawMaeRad"] for side in sides])
    return report


def verify_game_release(service, digest):
    # Verify the same public endpoints used in the lobby and between matches.
    status = service.request("/status", public=True)
    model = service.request("/neural?version=" + digest, raw=True, public=True)
    if (status.get("neural") or {}).get("digest") != digest or hashlib.sha256(model).hexdigest() != digest:
        raise RuntimeError("Committed Arena release differs from the weights served to the game")
    print(f"Verified public Arena release {digest}", flush=True)


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
    archive = json.loads(unpack(old["history"])) if old.get("history") else []
    # Previous runners saved a plain list of the original and most recent frozen opponents.
    if isinstance(archive, list):
        history, payoffs = archive, {}
    elif archive["version"] == 2:
        history, payoffs = archive["snapshots"], archive["payoffs"]
    else:
        raise ValueError("Unsupported Arena opponent league archive")
    league = work / "league.json"
    league.write_text(json.dumps(payoffs))
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
        if json.loads(actor.read_bytes())["version"] != 4:
            # Verify the original digest above before changing the rollout environment.
            # A fresh critic and optimizer learn from actions actually executed by the new controller.
            initial = work / "direct-controls.pt"
            run([sys.executable, TRAINER, "warm-start", "--resume", checkpoint, "--prior", prior, "--output", initial])
            checkpoint = initial
            run([sys.executable, TRAINER, "export", "--resume", checkpoint, "--output", actor])
            parent_digest = hashlib.sha256(actor.read_bytes()).hexdigest()
            print("Training direct player controls from the human imitation checkpoint", flush=True)
        collect = ts + ["scripts/self-play-rollout.ts", "--model", actor, "--seed", seed, "--output", rollout,
                        "--episodes", args.episodes, "--seconds", args.seconds, "--league", league]
        last_eval = old.get("lastEvaluation") or {}
        previous_failures = set(last_eval.get("failedGates", []))
        curriculum = {"wall": {"wallStalls"}, "rear": {"rearSearch", "human_search", "candidateHasSearch"},
                      "smoke": {"smokeContact", "smokeOffscreenTrigger"}}
        focus = [scenario for scenario, gates in curriculum.items() if gates & previous_failures]
        for scenario in focus:
            collect += ["--focus", scenario]
        if focus:
            print("Additional practice informed by last evaluation:", ", ".join(focus), flush=True)
        live = status.get("neural")
        incumbent = work / "incumbent.json"
        fallback = work / "public-fallback.json"
        if live:
            model = service.request("/neural?version=" + live["digest"], raw=True)
            if hashlib.sha256(model).hexdigest() != live["digest"]:
                raise ValueError("Live Arena model changed while restoring the opponent pool")
            incumbent.write_bytes(model)
            collect += ["--opponent", incumbent]
        else:
            # Offline practice includes the stock room bot alongside the tactical baseline.
            fallback.write_bytes(service.request("/exploration?active=1", raw=True) if service else b"null")
            collect += ["--deployed-fallback", fallback]
        for index, snapshot in enumerate(history):
            opponent = work / f"opponent-{index}.json"
            opponent.write_text(snapshot)
            collect += ["--opponent", opponent]
        run(collect)
        phase("updating")
        evaluate = generation % args.eval_every == 0
        corpus = args.corpus
        if service:
            corpus = service.replay_corpus(work.parent / "human", revision, status["dataset"])
        update = [sys.executable, TRAINER, "update", "--resume", checkpoint, "--rollout", rollout, "--actor", actor,
                  "--checkpoint", output, "--output", candidate, "--metrics", metrics_file, "--prior", prior, "--seed", seed]
        if corpus and Path(corpus).is_dir():
            update += ["--dataset", corpus]
        if not evaluate:
            update.append("--skip-holdout")
        run(update)
        metrics = json.loads(metrics_file.read_bytes())
        if service:
            print("Human replay coverage", json.dumps({
                "generation": generation, "referenceRevision": revision, "workerRevision": status["dataset"]["revision"],
                **metrics["humanReplayCoverage"]}), flush=True)
        model_text = candidate.read_text()
        digest = hashlib.sha256(model_text.encode()).hexdigest()
        if (metrics["generation"] != generation or metrics["parentHash"] != parent_digest
                or metrics["actorHash"] != digest or digest == parent_digest):
            raise RuntimeError("Optimizer did not advance the expected actor generation")
        failed = []
        promoted = False
        if evaluate:
            phase("evaluating")
            cmd = ts + ["scripts/evaluation/evaluate-self-play.ts", candidate, "--seeds", "2", "--seed", random.SystemRandom().randrange(500000000, 1900000000)]
            if live:
                # Freeze the comparison budget before scoring: twelve independent map/seed blocks
                # against the live policy, with both sides and game modes within every block.
                cmd += ["--incumbent", incumbent, "--incumbent-seeds", "4"]
            elif service:
                # RoomCore uses the released exploration model (or the plain scripted fallback).
                cmd += ["--deployed-fallback", fallback]
            results = run(cmd, json_result=True)
            gates = human_gates(metrics)
            failed = [key for key, passed in gates.items() if not passed]
            failed += [key for key, passed in results["gates"].items() if not passed]
            if not results["passed"] and all(results["gates"].values()):
                failed.append("simulation")
            promoted = results["passed"] and not failed
            if promoted and service and not service.game_supports(json.loads(model_text)["version"]):
                failed.append("release_runtime")
                promoted = False
            print("Evaluation", json.dumps({"passed": promoted, "failedGates": failed, "config": results["config"],
                  "byScenario": results["byScenario"], "byMap": results["byMap"],
                  "contactTransitions": results.get("contactTransitions"),
                  "comparisons": results["comparisons"], "fullRounds": results["fullRounds"],
                  "diagnostic": results["diagnostic"]}), flush=True)
        # Keep one older anchor and a recent opponent. The incumbent and parent are also sampled.
        if not history:
            history = [actor.read_text()]
        elif generation % 3 == 0:
            history = [history[0], actor.read_text()]
        archive = {"version": 2, "snapshots": history, "payoffs": json.loads(league.read_bytes())}
        record = dict(rulesVersion=RULES, parent=parent, generation=generation, humanRevision=revision,
                      episodes=metrics["games"], optimizerSteps=metrics["updates"],
                      environmentSteps=metrics["environmentSteps"], digest=digest,
                      reason="passed" if promoted else "evaluation_failed" if evaluate else "shadow",
                      failedGates=failed, checkpoint=pack(output.read_bytes()),
                      history=pack(json.dumps(archive, separators=(",", ":")).encode()))
        if evaluate:
            report = evaluation_report(results, metrics)
            if report:
                record["evaluationReport"] = report
        if service:
            if promoted:
                record.update(promote=model_text, expectedReleaseDigest=live["digest"] if live else None)
            committed = service.request("/selfplay", record)
            if committed["generation"] != generation or committed["digest"] != digest or committed["published"] != promoted:
                raise RuntimeError("Arena checkpoint acknowledgement differs from the submitted generation")
            if promoted:
                verify_game_release(service, digest)
        else:
            record["lastEvaluation"] = (dict(generation=generation, reason=record["reason"],
                                             failedGates=failed, published=False, report=report)
                                        if evaluate else old.get("lastEvaluation"))
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


def run_generations(args, service, session, progress):
    started = time.monotonic()
    deadline = started + args.time_budget_seconds if args.time_budget_seconds else None
    durations = {}
    iterations = games = updates = 0
    first = None
    reason = "generation limit"
    while args.continuous or iterations < args.generations:
        if not service and args.continuous and (args.state / "pause").exists():
            reason = "local pause request"
            break
        before = time.monotonic()
        if iterations and deadline is not None:
            evaluating = (progress["generation"] + 1) % args.eval_every == 0
            # The first tournament may be slower than an ordinary update. Allow it
            # to complete once started; the next invocation resumes its committed state.
            estimate = durations.get(evaluating, max(durations.values()) * (2 if evaluating else 1))
            if before + 1.25 * estimate >= deadline:
                reason = "time budget"
                break
        with tempfile.TemporaryDirectory(dir=session) as directory:
            progress = cycle(args, service, Path(directory), progress)
        elapsed = time.monotonic() - before
        generation = progress["generation"]
        evaluated = generation % args.eval_every == 0
        durations[evaluated] = max(durations.get(evaluated, 0), elapsed)
        first = first if first is not None else generation
        iterations += 1
        games += progress["episodes"]
        updates += progress["optimizerSteps"]
    committed = f"generations {first}–{progress['generation']}" if iterations else "no generations"
    report = (f"Committed {committed} ({iterations} total), "
              f"{games} games and {updates} optimizer updates in {time.monotonic() - started:.0f}s. "
              f"Yielded on {reason}.")
    print(report, flush=True)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
            print(report, file=output)


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
    cli.add_argument("--time-budget-seconds", type=int,
                     help="Soft wall-clock budget for self-play. Finish and checkpoint an in-flight generation before yielding.")
    cli.add_argument("--episodes", type=int, default=12)
    cli.add_argument("--seconds", type=int, default=45)
    cli.add_argument("--eval-every", type=int, default=5)
    args = cli.parse_args()
    if min(args.generations, args.episodes, args.seconds, args.eval_every) < 1:
        cli.error("Counts must be positive")
    if args.time_budget_seconds is not None and args.time_budget_seconds < 1:
        cli.error("The self-play time budget must be positive")
    if args.cloud and args.corpus:
        cli.error("Cloud evaluation loads the human corpus for its reference revision")
    if not args.cloud and args.corpus is None and (ROOT / ".scratch/training/corpus").is_dir():
        args.corpus = ROOT / ".scratch/training/corpus"
    if args.corpus:
        args.corpus = args.corpus.resolve()
        if not args.corpus.is_dir():
            cli.error("Expected a directory of human training batches")
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
    with tempfile.TemporaryDirectory(prefix="arena-self-play-") as session:
        run_generations(args, service, session, progress)


if __name__ == "__main__":
    main()
