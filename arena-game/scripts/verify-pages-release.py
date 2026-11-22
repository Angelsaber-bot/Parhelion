"""Confirm the artifact serving the production Arena before enabling a new model format."""
import hashlib
import importlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

training = importlib.import_module("self-play-cycle")
BASE = "https://parhelion-game.pages.dev/arena/"
ROOT = Path(__file__).resolve().parents[2] / "site/dist/public/arena"
http = urllib.request.build_opener(training.NoRedirect())


def get(url, token=None):
    headers = {"User-Agent": "Parhelion-Deployment/1.0", "Cache-Control": "no-cache"}
    if token:
        headers["Authorization"] = "Bearer " + token
    with http.open(urllib.request.Request(url, headers=headers), timeout=20) as response:
        return response.read()


def verify(commit):
    assets = re.findall(r'(?:src|href)="\./(assets/[^"]+\.(?:js|css))"', (ROOT / "index.html").read_text())
    if not any(p.endswith(".js") for p in assets) or not any(p.endswith(".css") for p in assets):
        raise ValueError("Missing playable Arena bundles")
    expected = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in assets}
    runtime = json.loads((ROOT / "neural-runtime.json").read_bytes())
    project_url = ("https://api.cloudflare.com/client/v4/accounts/" + os.environ["CLOUDFLARE_ACCOUNT_ID"]
                   + "/pages/projects/parhelion-game")
    # Read the same production project Wrangler updated. Preview deployments never count.
    project = json.loads(get(project_url, os.environ["CLOUDFLARE_API_TOKEN"]))["result"]
    deployed = project.get("canonical_deployment") or {}
    if (project.get("subdomain") != "parhelion-game.pages.dev" or deployed.get("environment") != "production" or
            deployed.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash") != commit or
            deployed.get("latest_stage", {}).get("status") != "success"):
        raise ValueError("Production Pages is still serving an earlier deployment")
    print("Cloudflare confirmed production deployment", deployed["id"], commit, flush=True)
    try:
        lobby = get(BASE + "?build=" + commit).decode()
        for path, digest in expected.items():
            if './' + path + '"' not in lobby or hashlib.sha256(get(BASE + path)).hexdigest() != digest:
                raise ValueError("Public Arena bundle mismatch: " + path)
        if json.loads(get(BASE + "neural-runtime.json?build=" + commit)) != runtime:
            raise ValueError("Public model format differs from deployed build")
        print("Verified public Arena bundle hashes", expected, flush=True)
    except urllib.error.HTTPError as error:
        if error.code != 403:
            raise
        print("Public HTTP probe received 403 from this runner. Production SHA verified via Cloudflare.", flush=True)
    return runtime


if __name__ == "__main__":
    commit = os.environ["GITHUB_SHA"]
    for attempt in range(8):
        try:
            runtime = verify(commit)
            break
        except (OSError, ValueError, KeyError):
            if attempt == 7:
                raise
            time.sleep(8)
    if os.environ.get("ARENA_NEURAL_CORPUS_TOKEN"):
        training.Service().request("/runtime", {**runtime, "commit": commit})
        print("Registered playable Arena model format", runtime["neuralPolicyVersion"])
