#!/bin/bash
# Run in a new Ghostty window by the fork's "Update fork" button. Runs Claude Code on prompt.md, allowed
# exactly the commands an update needs, so a clean update finishes without questions.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/bin:$HOME/.local/share/vite-plus/bin:$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

exec claude --allowedTools \
  "Read" "Grep" "Glob" \
  "Bash(git status:*)" "Bash(git fetch:*)" "Bash(git log:*)" "Bash(git diff:*)" "Bash(git show:*)" \
  "Bash(git describe:*)" "Bash(git rev-parse:*)" "Bash(git merge-base:*)" "Bash(git branch:*)" \
  "Bash(git merge --no-commit --no-ff:*)" "Bash(git merge --abort)" "Bash(git commit --no-edit)" \
  "Bash(gh release view:*)" "Bash(gh pr view:*)" \
  "Bash(vp i)" "Bash(vp run check:changed)" \
  "Bash(scripts/fork-update/build.sh)" "Bash(scripts/fork-update/install.sh)" \
  -- "$(cat scripts/fork-update/prompt.md)"
