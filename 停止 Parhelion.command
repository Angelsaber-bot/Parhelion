#!/bin/bash
# 停止由「启动 Parhelion.command」打开的网站（只停这个文件夹里的进程）。
D="$(cd "$(dirname "$0")" && pwd)"
pkill -TERM -f "$D/启动 Parhelion.command" 2>/dev/null
sleep 2
pkill -TERM -f "$D/site/dist/server.cjs" 2>/dev/null
echo "Parhelion 已停止。"
