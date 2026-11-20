#!/bin/bash
# Habit Grid: install (or remove) the automatic Mac sync job.
#
# Install:   bash install-mac-sync.sh "/path/to/your/vault"
# Uninstall: bash install-mac-sync.sh --uninstall
#
# Install does three things, all inside your own user account:
#   1. copies habit-log-sync.sh (next to this file) to ~/.habit-grid-sync/
#   2. writes a launchd job to ~/Library/LaunchAgents/md.habitgrid.sync.plist
#      that wakes every 5 minutes and when you log in
#   3. runs the sync once, so macOS asks for access to Reminders
# Nothing is downloaded. Uninstall removes the job and the copied script.

set -eu
LABEL="md.habitgrid.sync"
DEST="$HOME/.habit-grid-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HERE="$(cd "$(dirname "$0")" && pwd)"
# HABIT_SYNC_NO_LAUNCHCTL=1 skips the launchd calls (used for testing)
launchd() { [ "${HABIT_SYNC_NO_LAUNCHCTL:-0}" = "1" ] || launchctl "$@"; }

if [ "${1:-}" = "--uninstall" ]; then
  launchd bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  rm -rf "$DEST"
  echo "Removed the Habit Grid Mac sync job."
  exit 0
fi

VAULT="${1:-}"
if [ -z "$VAULT" ] || [ ! -d "$VAULT/.obsidian" ]; then
  echo "Usage: bash $0 \"/path/to/your/vault\"   (the folder that contains .obsidian)" >&2
  exit 1
fi
if [ ! -f "$HERE/habit-log-sync.sh" ]; then
  echo "habit-log-sync.sh must be in the same folder as this file." >&2
  exit 1
fi

mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
cp "$HERE/habit-log-sync.sh" "$DEST/habit-log-sync.sh"
chmod +x "$DEST/habit-log-sync.sh"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(xml "$DEST/habit-log-sync.sh")</string>
    <string>$(xml "$VAULT")</string>
    <string>--timer</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>300</integer>
  <key>StandardErrorPath</key>
  <string>/tmp/habit-grid-sync.log</string>
  <key>StandardOutPath</key>
  <string>/tmp/habit-grid-sync.log</string>
</dict>
</plist>
PLISTEOF

launchd bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchd bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed. Running the sync once now; allow access to Reminders if macOS asks."
bash "$DEST/habit-log-sync.sh" "$VAULT" || true
echo
echo "Last step: in Obsidian, open Settings > Habit Grid and turn on \"Use Mac sync\"."
echo "To remove everything later: bash \"$0\" --uninstall"
