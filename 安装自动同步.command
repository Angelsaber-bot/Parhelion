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
# macOS does not let background jobs run scripts stored on the Desktop, so the agent runs a copy from here.
SUPPORT="$HOME/Library/Application Support/Parhelion"
mkdir -p "$SUPPORT" && cp "$REPO/site/scripts/mac/sync.sh" "$SUPPORT/sync.sh" && chmod +x "$SUPPORT/sync.sh"
# launchd starts with a bare PATH; remember where this Mac's node/npm/git live.
NODE_DIR="$(dirname "$(command -v node || echo /opt/homebrew/bin/node)")"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SUPPORT/sync.sh</string><string>$REPO</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>120</integer>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/Parhelion-sync.log</string>
</dict></plist>
PL
LOG="$HOME/Library/Logs/Parhelion-sync.log"
BEFORE="$(wc -l < "$LOG" 2>/dev/null || echo 0)"
launchctl bootstrap "gui/$(id -u)" "$PLIST" && launchctl kickstart "gui/$(id -u)/$LABEL"
echo "已安装：每 2 分钟自动同步 GitHub main → $REPO"
echo "如果 macOS 询问“bash 想访问桌面文件夹”，请点“允许”。"
sleep 8
NEW="$(tail -n +"$((BEFORE + 1))" "$LOG" 2>/dev/null)"
echo; echo "这次运行的日志："; printf '%s\n' "${NEW:-（没有新日志：已经是最新，无需同步）}"
if printf '%s' "$NEW" | grep -q -e "Operation not permitted" -e "无法进入" -e "无法读取仓库"; then
  echo
  echo "macOS 还没允许后台程序访问桌面。刚刚打开了「完全磁盘访问权限」设置："
  echo "  1. 点左下角 +，按 Command+Shift+G，输入 /bin/bash 回车，选中 bash 添加并打开开关"
  echo "  2. 回到这里再双击一次「安装自动同步.command」"
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
fi
printf '\n按回车关闭。'; [ -t 0 ] && read -r _
