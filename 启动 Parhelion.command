#!/bin/bash
# 一键启动 Parhelion 网站（首页 + Arena + World），地址 http://127.0.0.1:4173/
# 先构建：cd site && npm run build（会同时构建 arena-game 和 world）
set -u
cd "$(dirname "$0")/site" || exit 1
NODE="$(command -v node 2>/dev/null || true)"
if [ -z "$NODE" ]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then NODE="$candidate"; break; fi
  done
fi
pause_error() { printf '\n按回车关闭此窗口…'; if [ -t 0 ]; then read -r _; fi; }
if [ -z "$NODE" ]; then printf '\n未找到 Node.js（需要 22 或更新版本）：https://nodejs.org\n'; pause_error; exit 1; fi
if [ ! -f dist/public/index.html ]; then printf '\n还没有构建网站：先在 site 目录运行 npm run build\n'; pause_error; exit 1; fi
"$NODE" scripts/launch.mjs &
CHILD_PID=$!
# Only forward termination to the Node process started by this exact window.
trap 'kill -TERM "$CHILD_PID" 2>/dev/null || true; wait "$CHILD_PID" 2>/dev/null || true; exit 0' INT TERM HUP
wait "$CHILD_PID"
STATUS=$?
trap - INT TERM HUP
if [ "$STATUS" -ne 0 ]; then pause_error; fi
exit "$STATUS"
