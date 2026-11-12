You are updating Kory's personal fork of T3 Code, in this checkout, to upstream's latest release,
{{RELEASE}}, which `custom` does not contain yet (its tag is already fetched). Merge it if that goes
cleanly; otherwise stop and explain. Kory clicked "Update fork" in the app and is watching this
terminal window.

## The fork

- Branch `custom`. Upstream (pingdotgg/t3code) is the `origin` remote; Kory's public fork
  (kory-smith/spook-code) is `kory`.
- `custom` is upstream `main` plus two upstream PRs merged in when the fork was made, plus Kory's
  own commits on top. `git log --oneline --no-merges origin/main..custom` lists them. Both PRs were
  later closed unmerged upstream, so the fork carries them for good:
  - #31242 (vim mode), closed with every PR from an author over the open-PR limit, not on merit.
  - #29686 (sidebar environment filter), closed as a duplicate of the still-open #25069. The fork
    replaced its filter menu with one sidebar tab per environment (`SidebarEnvironmentTabs.tsx`),
    which vim mode's Cmd-Shift-[ and ] switch between.

## Steps

<!-- Every command below must be allowed in update.command's --allowedTools. -->

Stop at the first failure, explain it, and leave the checkout as it was: `git merge --abort` while
the merge is uncommitted, `git reset --hard HEAD~1` once step 5 has committed it. Never resolve
conflicts, edit files, or run commands beyond these.

1. `git status` must show a clean `custom`. If not, stop.
2. Read the release's features (fixes and chores left out, as the notes run to hundreds of entries):
   `gh release view {{RELEASE}} --repo pingdotgg/t3code --json name,body --jq '.name, (.body | split("\n## New Contributors")[0] | split("\n") | map(select(test("^\\* (fix|chore|refactor|docs|test|ci|build|perf|style)\\b") | not)) | join("\n") | gsub(" by @[^ ]+ in https://[^\\s]+"; ""))'`.
3. `gh pr view 25069 --repo pingdotgg/t3code --json state,mergedAt`. If it merged, say so: the
   merge below will likely conflict in `Sidebar.tsx` and `uiStateStore.ts`, and the fork's
   environment tabs then need moving onto #25069's filter by hand, outside this update.
4. `git merge --no-commit --no-ff {{RELEASE}}`. If it reports conflicts, list each conflicted file with
   one line on what upstream changed and what the fork changed there, then abort and stop.
5. `vp i`, then `apps/web/node_modules/.bin/playwright install chromium-headless-shell` (browser
   tests cannot start when a release bumps Playwright), then `git commit --no-edit`, so the checks
   below can compare against the release.
6. `vp run check:changed {{RELEASE}}`. Upstream CI already checked the release, so this checks only
   what the fork adds on top of it. If checks fail, report the failures, roll back, and stop.
7. `scripts/fork-update/build.sh`. If the build fails, report the error, roll back, and stop.
8. `scripts/fork-update/install.sh`. It quits T3, backs up the app and data, installs the build,
   relaunches T3, and pushes `custom`.
9. Finish with a short summary: the release you merged, anything notable in its notes, and the
   status of #25069.
