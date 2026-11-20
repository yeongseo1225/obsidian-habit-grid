#!/bin/bash
# Habit Grid: copy completed Apple Reminders into the plugin's log file (macOS only).
#
# Usage: habit-log-sync.sh "/path/to/your/vault" [--days N] [--timer]
#   --days N  read the last N days instead of the "Days to read" setting
#   --timer   used by the launchd job: runs only when the "Sync interval" has passed
#
# Reads these settings from <vault>/.obsidian/plugins/habit-grid/data.json:
#   macSync    turn on "Use Mac sync" in the plugin settings, or the script does nothing (default: off)
#   syncLists  Reminders lists to read, separated by commas (default: Habits)
#   syncDays   how many past days to read (default: 30)
#   syncMinutes  minutes between runs when started with --timer (default: 30)
#   syncRequest  time (ms) of the last "Sync now" press; a newer request runs the script once regardless of the interval
#   folder     habits folder (default: habit-grid)
#   syncDir    sync subfolder (default: sync)
#   logName    log file name without extension (default: Reminders log)
# Only reads Reminders. Appends one line per completed reminder: "- [x] 2026-11-19 Title".
# Lines already in the file are skipped, so running it again is safe.

set -u
VAULT="${1:-}"
[ $# -gt 0 ] && shift
DAYS=""
TIMER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --days) DAYS="${2:-}"; shift 2 || shift;;
    --timer) TIMER=1; shift;;
    *) echo "Unknown option: $1" >&2; exit 1;;
  esac
done
if [ -z "$VAULT" ] || [ ! -d "$VAULT" ]; then
  echo "Usage: $0 \"/path/to/your/vault\" [--days N] [--timer]" >&2
  exit 1
fi

DATA="$VAULT/.obsidian/plugins/habit-grid/data.json"
setting() { # setting <key> <default>
  local v=""
  [ -f "$DATA" ] && v=$(plutil -extract "$1" raw -o - "$DATA" 2>/dev/null)
  [ -n "$v" ] && echo "$v" || echo "$2"
}
if [ "$(setting macSync false)" != "true" ]; then
  echo "Mac sync is off. Turn on \"Use Mac sync\" in the Habit Grid settings to use this script."
  exit 0
fi
[ -z "$DAYS" ] && DAYS=$(setting syncDays 30)
case "$DAYS" in ''|*[!0-9]*) DAYS=30;; esac
MINUTES=$(setting syncMinutes 30)
case "$MINUTES" in ''|*[!0-9]*) MINUTES=30;; esac
# With --timer the job wakes often; run only when the chosen interval has passed since the last run
STAMP="$HOME/Library/Caches/habit-grid-sync-$(md5 -q -s "$VAULT").last"
if [ "$TIMER" = 1 ]; then
  now=$(date +%s); last=$(cat "$STAMP" 2>/dev/null || echo 0)
  req=$(setting syncRequest 0); req=${req%%.*}
  case "$req" in ''|*[!0-9]*) req=0;; esac
  if [ $((now - last)) -lt $((MINUTES * 60 - 30)) ] && [ $((req / 1000)) -le "$last" ]; then exit 0; fi
fi
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
    set L to list listName
    set found to (reminders of L whose completed is true and completion date is greater than cutoff)
    if (count of found) is 0 then return ""
    -- read names and dates in bulk: much faster than reading each reminder one by one
    set ns to name of (reminders of L whose completed is true and completion date is greater than cutoff)
    set dts to completion date of (reminders of L whose completed is true and completion date is greater than cutoff)
    repeat with i from 1 to count of ns
      set d to item i of dts
      set ds to ((year of d) as string) & "-" & my pad((month of d) as integer) & "-" & my pad(day of d)
      set out to out & ds & tab & (item i of ns) & linefeed
    end repeat
  end tell
  return out
end run
APPLESCRIPT
}

added=0
# existing lines without trailing spaces, so "- [x] 2026-11-19 Walk " matches "- [x] 2026-11-19 Walk"
existing=$(sed -E 's/[[:space:]]+$//' "$LOG")
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
    line=$(echo "$line" | sed -E 's/[[:space:]]+$//')
    if ! printf '%s\n' "$existing" | grep -Fxq -- "$line"; then
      existing="$existing"$'\n'"$line"
      # make sure the file ends with a newline before appending
      [ -s "$LOG" ] && [ -n "$(tail -c1 "$LOG")" ] && echo >> "$LOG"
      echo "$line" >> "$LOG"
      added=$((added + 1))
    fi
  done <<< "$rows"
done
echo "Added $added line(s) to $LOG"
mkdir -p "$HOME/Library/Caches" && date +%s > "$STAMP"
