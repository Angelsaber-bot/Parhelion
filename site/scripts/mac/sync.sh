#!/bin/bash
# Keeps this Mac's Parhelion clone on the latest GitHub main and rebuilds the local one-click site.
# Run by the launchd agent com.parhelion.sync (installed by 安装自动同步.command) from a copy in
# ~/Library/Application Support/Parhelion, because macOS blocks background jobs from running scripts on the Desktop.
# Usage: sync.sh <repo path>. Silent: no sound, no windows.
# Never overwrites local work: skips when tracked files are modified, the branch is not main, or main has diverged.
# Untracked folders such as _local/ are never touched.
set -u
export PATH="${PATH:-/usr/bin:/bin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
LOG="$HOME/Library/Logs/Parhelion-sync.log"
LOCK="${TMPDIR:-/tmp}/parhelion-sync.lock"
mkdir -p "$(dirname "$LOG")"
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }

mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK"' EXIT
# Keep the log small: past 1 MB keep only the newest lines.
if [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 1000000 ]; then tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi
cd "$REPO" || { log "无法进入 $REPO（如提示 Operation not permitted，需要允许访问桌面文件夹）"; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>&1)" || { log "无法读取仓库（macOS 权限？）：$BRANCH"; exit 1; }
[ "$BRANCH" = main ] || { log "当前在 $BRANCH 分支，不是 main，跳过"; exit 0; }
git fetch --quiet origin main 2>>"$LOG" || { log "git fetch 失败（网络？）"; exit 0; }
LOCAL="$(git rev-parse HEAD)"; REMOTE="$(git rev-parse origin/main)"
[ "$LOCAL" = "$REMOTE" ] && exit 0
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then log "有未提交的本地修改，跳过本次同步"; exit 0; fi
git merge --ff-only --quiet origin/main 2>>"$LOG" || { log "本地有未推送的提交，无法快进，跳过"; exit 0; }
log "已同步到 $(git log -1 --format='%h %s')"
# Keep the installed copy current (write a new file, then rename, so the running copy is not rewritten mid-read).
if [ "$SELF" != "$REPO/site/scripts/mac/sync.sh" ] && ! cmp -s "$REPO/site/scripts/mac/sync.sh" "$SELF"; then
  cp "$REPO/site/scripts/mac/sync.sh" "$SELF.new" && chmod +x "$SELF.new" && mv "$SELF.new" "$SELF"
fi

# Reinstall dependencies only when a lockfile changed, then rebuild site/dist for 启动 Parhelion.command.
for app in arena-game world; do
  if [ ! -d "$app/node_modules" ] || ! git diff --quiet "$LOCAL" HEAD -- "$app/package-lock.json"; then
    npm ci --prefix "$app" --no-audit --no-fund >> "$LOG" 2>&1 || { log "$app 依赖安装失败"; exit 1; }
  fi
done
if npm run build --prefix site >> "$LOG" 2>&1; then log "本地网站已重建"; else log "本地网站构建失败，详见上方日志"; fi
