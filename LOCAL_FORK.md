# Local fork notes

This repo is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code).

Branch `local/pr-28191` is upstream `main` plus the fix from
[pingdotgg/t3code#28191](https://github.com/pingdotgg/t3code/pull/28191)
(clicked workspace areas no longer show the focus ring after a stray key).

| Remote     | URL                                              |
| ---------- | ------------------------------------------------ |
| `origin`   | `git@github.com-personal:shebbar93/T3-Clone.git` |
| `upstream` | `https://github.com/pingdotgg/t3code.git`        |

The local app is installed at `~/Applications/T3 Code (Beta).app`.
It has no update feed, so it does not auto-update to upstream code.
Quit `T3 Code (Nightly)` before you open it. Both apps use the bundle id `com.t3tools.t3code`.

## Prerequisites

- Vite+ (`vp`). Install: `curl -fsSL https://vite.plus | bash`, then open a new terminal.

## Get upstream updates

1. Merge upstream:
   ```sh
   cd ~/Documents/Github/personal/t3code
   git switch local/pr-28191
   git fetch upstream
   git merge upstream/main
   ```
2. If there is a conflict, fix the files, then `git add <file>` and `git commit`.
3. Install dependencies: `vp i`
4. Optional check:
   ```sh
   cd apps/web
   vp run typecheck
   vp test run src/lib/workspaceFocus.browser.test.ts src/components/ChatView.logic.browser.test.ts
   cd ../..
   ```
5. Push: `git push`

## Build and install the app

The DMG target fails on this machine (`hdiutil: couldn't unmount ... Resource busy`). Use the zip target.

1. Build:
   ```sh
   node scripts/build-desktop-artifact.ts --platform mac --target zip --arch arm64
   ```
2. Quit the app, then install:
   ```sh
   rm -rf /tmp/t3zip
   ditto -x -k release/T3-Code-*-arm64.zip /tmp/t3zip
   ditto "/tmp/t3zip/T3 Code (Beta).app" "$HOME/Applications/T3 Code (Beta).app"
   codesign --force --deep -s - "$HOME/Applications/T3 Code (Beta).app"
   rm -rf /tmp/t3zip
   ```

`/Applications` needs admin rights, so the app goes to `~/Applications`.

## When upstream merges the PR

Check the PR state:

```sh
gh pr view 28191 -R pingdotgg/t3code --json state
```

If it is `MERGED`, the fix is in upstream `main`. You do not need this branch.
Build from `upstream/main` with the same steps.
