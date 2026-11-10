# Local fork notes

This repo is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code).

Branch `local/pr-28191` is upstream `main` plus these local changes:

| Change                                                                                       | Why                                                                                                                              |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Composer font ligatures (`apps/web/src/index.css`)                                           | ProseMirror turns ligatures off. This turns them on in the prompt box.                                                           |
| Thread details hidden by default (`rightPanelStore.ts`)                                      | Local preference.                                                                                                                |
| Electron `45.2.3` (`apps/desktop/package.json`), `node-abi` `4.40.0` (`pnpm-workspace.yaml`) | Electron 44 (Chromium 152) draws a typed `->` as `>` after the next space. Electron 45 (Chromium 156) draws the arrow correctly. |
| Videorc look (`apps/web/src/videorc/`, one import in `apps/web/src/main.tsx`)                | Light skeuomorphic style from [Videorc UI](https://ui.videorc.com). CSS only. See [Videorc look](#videorc-look).                 |

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
   If `apps/desktop/package.json` conflicts on `electron`, keep the higher version. Do not go below `45.2.3`. Keep `node-abi` new enough to know that Electron version, or the build fails with `Could not detect abi`.
   If `pnpm-lock.yaml` conflicts, take upstream's file (`git checkout --theirs pnpm-lock.yaml`), run `vp i` to put the local Electron and `node-abi` versions back, then `git add pnpm-lock.yaml`.
   If `apps/web/src/main.tsx` conflicts, keep upstream's lines and put `import "./videorc/videorc.css";` back after `import "./index.css";`.
3. Install dependencies: `vp i`
4. Optional check:
   ```sh
   cd apps/web
   vp run typecheck
   vp test run src/lib/workspaceFocus.browser.test.ts src/components/ChatView.logic.browser.test.ts
   cd ../..
   ```
5. Push the branch, then move `origin/main` to `upstream/main`:
   ```sh
   git push
   git push origin upstream/main:main
   ```
   The second push keeps upstream changes out of [PR #1](https://github.com/shebbar93/T3-Clone/pull/1), so the PR shows only local changes. It must be a fast-forward. Do not add commits to `origin/main`.

## Build and install the app

The DMG target fails on this machine (`hdiutil: couldn't unmount ... Resource busy`). Use the zip target.

The build uses the working tree, so uncommitted files go into the app. Run `git status` first.

Stop `vp run dev:desktop` before you build. Its watcher (`scripts/dev-electron.mjs`) restarts the dev Electron app each time the build writes `apps/desktop/dist-electron`. The dev app then shows "This T3 home is unavailable", because the `vp run dev` server already owns the repo's `.t3`. The watcher can stay after its terminal closes. To find it:

```sh
ps -axo pid,ppid,command | grep '[d]ev-electron.mjs'
lsof -a -p <pid> -d cwd
```

If the cwd is `apps/desktop` in this repo, stop it with `kill <pid>`.

1. Build:
   ```sh
   rm -f release/T3-Code-*-arm64.zip release/T3-Code-*-arm64.zip.blockmap
   node scripts/build-desktop-artifact.ts --platform mac --target zip --arch arm64
   ```
   The first line removes old zips. Upstream changes the version in the file name, and the install step accepts only one zip.
2. Quit the app, then install:
   ```sh
   rm -rf /tmp/t3zip
   ditto -x -k release/T3-Code-*-arm64.zip /tmp/t3zip
   rm -rf "$HOME/Applications/T3 Code (Beta).app"
   ditto "/tmp/t3zip/T3 Code (Beta).app" "$HOME/Applications/T3 Code (Beta).app"
   codesign --force --deep -s - "$HOME/Applications/T3 Code (Beta).app"
   rm -rf /tmp/t3zip
   ```
3. Check the installed app:
   ```sh
   APP="$HOME/Applications/T3 Code (Beta).app"
   /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist"
   /usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist"
   grep -c vrc-chromatic-surge "$APP/Contents/Resources/app.asar"
   ```
   The first line is the app version from `apps/desktop/package.json`. The second line must be `45.2.3` or higher. The third line must be `1` or higher, or the Videorc look is missing.
4. Open the app and check the [Videorc look](#videorc-look) table.

`/Applications` needs admin rights, so the app goes to `~/Applications`.

## Videorc look

`apps/web/src/videorc/videorc.css` restyles existing components with CSS selectors. It changes no component code, so a merge does not conflict on it. But if upstream renames a selector below, that style stops with no error. After a merge, check these in the app:

| Look                                   | Depends on                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Chrome primary and destructive buttons | `[data-slot="button"]` with `.bg-primary` or `.bg-destructive`                                            |
| Chrome switch, checkbox, bead knob     | `[data-slot="switch"]`, `[data-slot="switch-thumb"]`, `[data-slot="checkbox-indicator"]`                  |
| Glass chips, keycaps                   | `.bg-popover`, `.bg-secondary`, `.bg-background` on buttons, toggles, badges; `[data-slot="kbd"]`         |
| Floating panel rims                    | `menu-popup`, `select-popup`, `popover-popup`, `tooltip-popup`, `dialog-popup` slots                      |
| Chromatic Send button                  | Classes `isolate overflow-hidden rounded-full` in `ComposerPrimaryActions.tsx`                            |
| Prompt rim and drop                    | `composer-shell`, `composer-host` slots; `--chat-composer-outline`                                        |
| Banner rims                            | `[data-composer-banner-surface]`, `--chat-composer-attached-outline`                                      |
| Chrome plate                           | `.bg-sidebar-row-active`, `[role="treeitem"][aria-selected="true"]`, `[data-slot="toggle"][data-pressed]` |

To remove the look: delete `apps/web/src/videorc/` and its import in `apps/web/src/main.tsx`.

## When upstream has the local fixes

The focus fix from [#28191](https://github.com/pingdotgg/t3code/pull/28191) is in upstream `main` as [#33525](https://github.com/pingdotgg/t3code/pull/33525). This branch uses upstream's version.

To check the other fixes:

```sh
git show upstream/main:apps/desktop/package.json | grep '"electron"'
git show upstream/main:apps/web/src/index.css | grep -n 'font-variant-ligatures'
```

If upstream has Electron 45 or later, remove the local Electron and `node-abi` change.
If upstream turns ligatures on in `.composer-tiptap.ProseMirror`, remove the local ligature change.
If no local fix is left, build from `upstream/main` with the same steps.
