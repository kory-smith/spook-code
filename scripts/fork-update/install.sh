#!/bin/bash
# Swaps the freshly built fork into /Applications: quits T3, backs up the current app and T3's
# databases, installs and relaunches the new build, then pushes `custom` to the fork.
# Roll back by moving the backed-up app into /Applications and restoring the .sqlite files.
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
built="$(find "$repo/release" -maxdepth 2 -name '*.app' -print -quit)"
if [[ -z "$built" ]]; then
  echo "No built app in $repo/release; run build.sh first." >&2
  exit 1
fi
app="/Applications/$(basename "$built")"
bundle_id="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$built/Contents/Info.plist")"
backup="$HOME/.t3-fork-backups/$(date +%Y%m%d-%H%M%S)"
userdata="$HOME/.t3/userdata"

echo "Quitting $(basename "$app")…"
osascript -e "tell application id \"$bundle_id\" to quit" >/dev/null 2>&1 || true
for _ in $(seq 60); do
  pgrep -qf "$app/Contents/MacOS/" || break
  sleep 1
done
if pgrep -qf "$app/Contents/MacOS/"; then
  echo "T3 did not quit within a minute; nothing was changed." >&2
  exit 1
fi

mkdir -p "$backup"
if [[ -d "$app" ]]; then mv "$app" "$backup/"; fi
for database in "$userdata"/*.sqlite; do
  [[ -f "$database" ]] && sqlite3 "$database" ".backup '$backup/$(basename "$database")'"
done
echo "Backed up the previous app and T3's databases to $backup"

ditto "$built" "$app"
open "$app"
echo "Installed and relaunched $(basename "$app")."

# Keep the three newest backups.
find "$HOME/.t3-fork-backups" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +4 |
  while read -r old; do rm -rf -- "$old"; done

git -C "$repo" push kory custom || echo "Push to kory failed; run 'git push kory custom' later." >&2
