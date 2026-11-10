#!/bin/bash
# Run in a new Ghostty window by the fork's "Update fork" button. Runs Claude Code on prompt.md, allowed
# exactly the commands an update needs, so a clean update finishes without questions.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/bin:$HOME/.local/share/vite-plus/bin:$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

# Nothing to update needs no agent: say so briefly and let the window close.
git fetch --quiet origin --tags
latest="$(gh release view --repo pingdotgg/t3code --json tagName --jq .tagName)"
if git merge-base --is-ancestor "$latest" custom; then
  echo "Already on upstream $latest; nothing to update."
  sleep 2
  exit 0
fi

exec claude --allowedTools \
  "Read" "Grep" "Glob" \
  "Bash(git status:*)" "Bash(git log:*)" "Bash(git diff:*)" "Bash(git show:*)" \
  "Bash(git rev-parse:*)" "Bash(git branch:*)" \
  "Bash(git merge --no-commit --no-ff:*)" "Bash(git merge --abort)" "Bash(git commit --no-edit)" \
  "Bash(git reset --hard HEAD~1)" \
  "Bash(gh release view:*)" "Bash(gh pr view:*)" \
  "Bash(vp i)" "Bash(vp run check:changed:*)" \
  "Bash(scripts/fork-update/build.sh)" "Bash(scripts/fork-update/install.sh)" \
  -- "$(sed "s/{{RELEASE}}/$latest/g" scripts/fork-update/prompt.md)"
