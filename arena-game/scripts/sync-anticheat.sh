#!/bin/bash
# User-run release: Arena updates, preserving unrelated World edits.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
cd "$repo"
[ "$(git branch --show-current)" = main ] || { echo '请先切回 main；脚本已停止。'; exit 1; }
git diff --cached --quiet || { echo '暂存区已有其他改动，请先处理；脚本没有改动暂存区。'; exit 1; }
command -v gh >/dev/null || { echo '需要 GitHub CLI（gh）才能核对自动发布结果。'; exit 1; }
gh auth status

git fetch origin main
git merge --ff-only origin/main
git diff --check -- arena-game
git add -- arena-game
if ! git diff --cached --quiet; then
  git commit -m "Update Arena online protection"
fi
release_sha=$(git rev-parse HEAD)
release_dir=$(mktemp -d /tmp/parhelion-arena-release.XXXXXX)
echo "本次提交：$release_sha"
echo "独立构建目录：$release_dir"
# Only committed source enters the release. Uncommitted World work stays untouched.
git archive "$release_sha" | tar -x -C "$release_dir"
for app in arena-game world; do
  if [ -d "$repo/$app/node_modules" ]; then
    ln -s "$repo/$app/node_modules" "$release_dir/$app/node_modules"
  else
    npm ci --prefix "$release_dir/$app" --no-audit --no-fund
  fi
done
cd "$release_dir"
npm test --prefix arena-game
npm run build
npm test --prefix site
# An archive has no .git; label its generated manifest with its verified source SHA.
PARHELION_RELEASE_SHA="$release_sha" node --input-type=module <<'JS'
import fs from 'node:fs';
const path = 'site/dist/build.json';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
manifest.commit = process.env.PARHELION_RELEASE_SHA;
fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
JS
cd "$repo"
[ "$(git rev-parse HEAD)" = "$release_sha" ] || { echo '构建期间 HEAD 已变化；停止发布，请重新运行。'; exit 1; }
# Update generated local playable files only, preserving all source edits.
mkdir -p site/dist
rsync -a --delete "$release_dir/site/dist/" "$repo/site/dist/"
git push origin main

run_id=''
for attempt in $(seq 1 30); do
  run_id=$(gh run list --workflow deploy.yml --commit "$release_sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  [ -n "$run_id" ] && break
  sleep 3
done
[ -n "$run_id" ] || { echo '尚未找到这次提交的 Deploy 流水线；请到 GitHub Actions 检查。'; exit 1; }
gh run watch "$run_id" --exit-status
# A green build with missing Cloudflare secrets is not a successful deployment.
gh run view "$run_id" --json jobs > "$release_dir/workflow.json"
node --input-type=module - "$release_dir/workflow.json" <<'JS'
import fs from 'node:fs';
const run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const steps = run.jobs.flatMap(job => job.steps ?? []);
for (const name of ['Deploy Arena Worker', 'Smoke test public Arena server', 'Deploy site to Cloudflare Pages']) {
  if (!steps.some(step => step.name === name && step.conclusion === 'success')) {
    throw new Error(`未确认发布成功（可能跳过）：${name}`);
  }
}
JS
curl --fail --silent --show-error --location --output /dev/null https://parhelion-game.pages.dev/arena/
echo "本机构建、GitHub main 和公网发布已完成：$release_sha"
echo '公网：https://parhelion-game.pages.dev/arena/'
echo "发布记录：https://github.com/Angelsaber-bot/Parhelion/actions/runs/$run_id"
