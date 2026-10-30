#!/bin/bash
# 双击一次即可：让这台 Mac 每 2 分钟自动从 GitHub main 同步 Parhelion，并重建本地一键网站。
# 静音运行，不弹窗。有未提交的本地修改时会跳过，不会覆盖；_local/ 等未跟踪文件永远不动。
# 日志：~/Library/Logs/Parhelion-sync.log    卸载：再运行本文件并输入 u
set -u
REPO="$(cd "$(dirname "$0")" && pwd)"
LABEL=com.parhelion.sync
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
if [ "${1:-}" = u ] || { [ -t 0 ] && [ -f "$PLIST" ] && printf '已安装。直接回车=重新安装，输入 u 回车=卸载：' && read -r a && [ "$a" = u ]; }; then
  rm -f "$PLIST"; echo "已卸载自动同步。"; exit 0
fi
chmod +x "$REPO/site/scripts/mac/sync.sh"
# launchd starts with a bare PATH; remember where this Mac's node/npm/git live.
NODE_DIR="$(dirname "$(command -v node || echo /opt/homebrew/bin/node)")"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$REPO/site/scripts/mac/sync.sh</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>120</integer>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/Parhelion-sync.log</string>
</dict></plist>
PL
launchctl bootstrap "gui/$(id -u)" "$PLIST" && launchctl kickstart "gui/$(id -u)/$LABEL"
echo "已安装：每 2 分钟自动同步 GitHub main → $REPO"
echo "如果 macOS 询问“bash 想访问桌面文件夹”，请点“允许”。"
sleep 5; echo; echo "最近日志："; tail -n 5 "$HOME/Library/Logs/Parhelion-sync.log" 2>/dev/null
printf '\n按回车关闭。'; [ -t 0 ] && read -r _
