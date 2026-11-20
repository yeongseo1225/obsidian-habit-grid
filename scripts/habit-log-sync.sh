#!/bin/bash
# Habit Grid: copy completed Apple Reminders into the plugin's log file (macOS only).
#
# Usage: habit-log-sync.sh "/path/to/your/vault" [days]
#
# Reads these settings from <vault>/.obsidian/plugins/habit-grid/data.json:
#   syncLists  Reminders lists to read, separated by commas (default: Habits)
#   folder     habits folder (default: habit-grid)
#   syncDir    sync subfolder (default: sync)
#   logName    log file name without extension (default: Reminders log)
# Only reads Reminders. Appends one line per completed reminder: "- [x] 2026-11-19 Title".
# Lines already in the file are skipped, so running it again is safe.

set -u
VAULT="${1:-}"
DAYS="${2:-30}"
if [ -z "$VAULT" ] || [ ! -d "$VAULT" ]; then
  echo "Usage: $0 \"/path/to/your/vault\" [days]" >&2
  exit 1
fi
case "$DAYS" in ''|*[!0-9]*) echo "days must be a number" >&2; exit 1;; esac

DATA="$VAULT/.obsidian/plugins/habit-grid/data.json"
setting() { # setting <key> <default>
  local v=""
  [ -f "$DATA" ] && v=$(plutil -extract "$1" raw -o - "$DATA" 2>/dev/null)
  [ -n "$v" ] && echo "$v" || echo "$2"
}
LISTS=$(setting syncLists "Habits")
FOLDER=$(setting folder "habit-grid")
SYNCDIR=$(setting syncDir "sync")
LOGNAME=$(setting logName "Reminders log")
LOG="$VAULT/$FOLDER/$SYNCDIR/$LOGNAME.md"
if [ ! -f "$LOG" ]; then
  echo "Log file not found: $LOG (open the vault once with Habit Grid enabled to create it)" >&2
  exit 1
fi

# Prints "yyyy-MM-dd<TAB>title" for every reminder completed in the last N days.
read_list() {
  osascript - "$1" "$DAYS" <<'APPLESCRIPT'
on pad(n)
  return text -2 thru -1 of ("0" & n)
end pad
on run argv
  set listName to item 1 of argv
  set cutoff to (current date) - ((item 2 of argv as integer) * days)
  set out to ""
  tell application "Reminders"
    if not (exists list listName) then error "List not found: " & listName
    set done to (reminders of list listName whose completed is true and completion date is greater than cutoff)
    repeat with r in done
      set d to completion date of r
      set ds to ((year of d) as string) & "-" & my pad((month of d) as integer) & "-" & my pad(day of d)
      set t to name of r
      set out to out & ds & tab & t & linefeed
    end repeat
  end tell
  return out
end run
APPLESCRIPT
}

added=0
IFS=',' read -ra NAMES <<< "$LISTS"
for raw in "${NAMES[@]}"; do
  name=$(echo "$raw" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  [ -z "$name" ] && continue
  if ! rows=$(read_list "$name" 2>&1); then
    echo "Skipped list '$name': $rows" >&2
    continue
  fi
  while IFS=$'\t' read -r day title; do
    [ -z "$day" ] || [ -z "$title" ] && continue
    title=$(echo "$title" | tr '\r\n' '  ')
    line="- [x] $day $title"
    if ! grep -Fxq -- "$line" "$LOG"; then
      # make sure the file ends with a newline before appending
      [ -s "$LOG" ] && [ -n "$(tail -c1 "$LOG")" ] && echo >> "$LOG"
      echo "$line" >> "$LOG"
      added=$((added + 1))
    fi
  done <<< "$rows"
done
echo "Added $added line(s) to $LOG"
