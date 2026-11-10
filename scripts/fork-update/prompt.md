You are updating Kory's personal fork of T3 Code, in this checkout, to upstream's latest release,
{{RELEASE}}, which `custom` does not contain yet (its tag is already fetched). Merge it if that goes
cleanly; otherwise stop and explain. Kory clicked "Update fork" in the app and is watching this
terminal window.

## The fork

- Branch `custom`. Upstream (pingdotgg/t3code) is the `origin` remote; Kory's public fork
  (kory-smith/spook-code) is `kory`.
- `custom` is upstream `main` plus two merged upstream PRs that were open when the fork was made,
  #31242 (vim mode) and #29686 (sidebar environment filter), plus Kory's own commits on top.
  `git log --oneline --no-merges origin/main..custom` lists them.

## Steps

<!-- Every command below must be allowed in update.command's --allowedTools. -->

Stop at the first failure, explain it, and leave the checkout as it was: `git merge --abort` while
the merge is uncommitted, `git reset --hard HEAD~1` once step 5 has committed it. Never resolve
conflicts, edit files, or run commands beyond these.

1. `git status` must show a clean `custom`. If not, stop.
2. Read the release's features (fixes and chores left out, as the notes run to hundreds of entries):
   `gh release view {{RELEASE}} --repo pingdotgg/t3code --json name,body --jq '.name, (.body | split("\n## New Contributors")[0] | split("\n") | map(select(test("^\\* (fix|chore|refactor|docs|test|ci|build|perf|style)\\b") | not)) | join("\n") | gsub(" by @[^ ]+ in https://[^\\s]+"; ""))'`.
3. `gh pr view 31242 --repo pingdotgg/t3code --json state,mergedAt` and the same for 29686. If
   either merged or closed upstream, mention it: the merge below may conflict around that work.
4. `git merge --no-commit --no-ff {{RELEASE}}`. If it reports conflicts, list each conflicted file with
   one line on what upstream changed and what the fork changed there, then abort and stop.
5. `vp i`, then `git commit --no-edit`, so the checks below can compare against the release.
6. `vp run check:changed {{RELEASE}}`. Upstream CI already checked the release, so this checks only
   what the fork adds on top of it. If checks fail, report the failures, roll back, and stop.
7. `scripts/fork-update/build.sh`. If the build fails, report the error, roll back, and stop.
8. `scripts/fork-update/install.sh`. It quits T3, backs up the app and data, installs the build,
   relaunches T3, and pushes `custom`.
9. Finish with a short summary: the release you merged, anything notable in its notes, and the
   status of the two PRs.
