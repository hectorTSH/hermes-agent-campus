#!/bin/zsh
set -euo pipefail

LABEL="com.hectortsh.hermes-agent-campus"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/hermes-agent-campus.log"
PORT="${CAMPUS_PORT:-4173}"
NPM_BIN="$(command -v npm || true)"

if [[ -z "$NPM_BIN" ]]; then
  print -u2 "npm was not found. Install Node.js 20+ and retry."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cd "$ROOT"
"$NPM_BIN" ci
"$NPM_BIN" run build

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>exec '$NPM_BIN' run serve:network</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>CAMPUS_PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

print "Campus service installed."
print "Local:  http://127.0.0.1:$PORT/?room=home"
print "Remote: http://<mac-mini-lan-or-tailscale-name>:$PORT/?room=home"
print "Log:    $LOG"
