#!/bin/zsh
set -euo pipefail

LABEL="com.hectortsh.hermes-agent-campus"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [[ -f "$PLIST" ]]; then
  rm "$PLIST"
fi

print "Campus LaunchAgent removed. Repository and logs were left intact."
