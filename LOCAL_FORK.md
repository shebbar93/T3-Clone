# Local fork notes

This repo is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code).

Branch `local/pr-28191` is upstream `main` plus these local changes:

| Change                                                                                                                                      | Why                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composer font ligatures (`apps/web/src/index.css`)                                                                                          | ProseMirror turns ligatures off. This turns them on in the prompt box.                                                                                                                                        |
| Composer block caret (`apps/web/src/index.css`, `caret-shape: block` on `.composer-tiptap`)                                                 | Local preference. CSS only, prompt box only. Needs Chromium 144 or later (Electron 45 has Chromium 156).                                                                                                      |
| Thread details hidden by default (`rightPanelStore.ts`)                                                                                     | Local preference.                                                                                                                                                                                             |
| Electron `45.2.3` (`apps/desktop/package.json`), `node-abi` `4.40.0` (`pnpm-workspace.yaml`)                                                | Electron 44 (Chromium 152) draws a typed `->` as `>` after the next space. Electron 45 (Chromium 156) draws the arrow correctly.                                                                              |
| Videorc look (`apps/web/src/videorc/`, one import in `apps/web/src/main.tsx`)                                                               | Light skeuomorphic style from [Videorc UI](https://ui.videorc.com). CSS only. See [Videorc look](#videorc-look).                                                                                              |
| Quit error fix (`apps/desktop/src/window/DesktopWindow.ts`), from open upstream PR [#33620](https://github.com/pingdotgg/t3code/pull/33620) | Quit with Cmd+Q showed `TypeError: Object has been destroyed`. Remove when #33620 is in upstream `main`.                                                                                                      |
| Composer focus (`ChatView.tsx`, `KeybindingsSettings.logic.ts`, `composer.focus` in `packages/contracts/src/keybindings.ts`)                | The `composer.focus` command puts focus in the prompt box. It has no default key. Bind Ctrl+L in Settings > Keybindings. Cmd+W also puts focus in the prompt box when it closes the last right panel surface. |
| Thread cycle (`resolveAdjacentThreadId` in `Sidebar.logic.ts`)                                                                              | `thread.previous` and `thread.next` go around from the first thread to the last, and from the last to the first.                                                                                              |
| First working thread (`thread.firstWorking` in contracts, `packages/shared/src/keybindings.ts`, `Sidebar.tsx`)                              | `mod+shift+w` goes to the first thread in the Working section. If that thread is open, it stays open.                                                                                                         |

| Remote     | URL                                              |
| ---------- | ------------------------------------------------ |
| `origin`   | `git@github.com-personal:shebbar93/T3-Clone.git` |
| `upstream` | `https://github.com/pingdotgg/t3code.git`        |

The local app is installed at `~/Applications/T3 Code (Beta).app`.
It has no update feed, so it does not auto-update to upstream code.
Quit `T3 Code (Nightly)` before you open it. Both apps use the bundle id `com.t3tools.t3code`.

## Prerequisites

- Vite+ (`vp`). Install: `curl -fsSL https://vite.plus | bash`, then open a new terminal.
- Code-signing certificate `T3 Local Signing` in the login keychain. Create it once in Keychain Access: menu bar **Keychain Access > Certificate Assistant > Create a Certificate…**, Identity Type **Self Signed Root**, Certificate Type **Code Signing**. The install step signs with it, so the app keeps the same identity after each rebuild and macOS does not ask again for the "t3code Safe Storage" keychain item. `security find-identity -p codesigning` shows it as `CSSMERR_TP_NOT_TRUSTED`. This is correct, and `codesign` still uses it.

## Script

`scripts/local-fork.sh` does the update, build, and checks. Run `scripts/local-fork.sh` with no command to see the commands. If a command fails and its error does not tell you the fix, use the [manual steps](#manual-steps) for that part.

| Command                 | What it does                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync`                  | Merges `upstream/main`. It takes upstream's file for conflicts in `pnpm-lock.yaml`, `apps/desktop/package.json`, `pnpm-workspace.yaml`, and `apps/web/src/main.tsx`. Then it puts back the Electron and `node-abi` minimum versions and the Videorc import, runs `vp i`, commits, and runs `selectors`. |
| `sync --continue`       | Use this after you resolve other conflicts by hand and `git add` them.                                                                                                                                                                                                                                  |
| `check`                 | Typecheck and focused tests in `apps/web`.                                                                                                                                                                                                                                                              |
| `push`                  | Pushes the branch, then fast-forwards `origin/main` to `upstream/main`, so [PR #1](https://github.com/shebbar93/T3-Clone/pull/1) shows only local changes. It stops if this is not a fast-forward.                                                                                                      |
| `build [--allow-dirty]` | Stops if the tree is dirty, the dev Electron watcher runs from this repo, or the app is open. Builds the zip (the DMG target fails on this machine), installs the app to `~/Applications`, signs it, and runs `verify`.                                                                                 |
| `verify`                | Checks the installed app: Electron `45.2.3` or higher, and the Videorc CSS is in `app.asar`.                                                                                                                                                                                                            |
| `selectors`             | Checks that each selector in the [Videorc look](#videorc-look) table still exists in `apps/web/src`.                                                                                                                                                                                                    |
| `upstream-status`       | Prints `KEEP` or `REMOVE` for each local change. See [When upstream has the local fixes](#when-upstream-has-the-local-fixes).                                                                                                                                                                           |

Usual update:

1. `scripts/local-fork.sh sync`
2. `scripts/local-fork.sh check`
3. `scripts/local-fork.sh push`
4. `scripts/local-fork.sh build`
5. Open the app and check the [Videorc look](#videorc-look) table.

If `build` stops on the dev watcher, stop it with the `kill <pid>` it prints. The watcher restarts the dev Electron app each time the build writes `apps/desktop/dist-electron`. The dev app then shows "This T3 home is unavailable".

## Videorc look

`apps/web/src/videorc/videorc.css` restyles existing components with CSS selectors. It changes no component code, so a merge does not conflict on it. But if upstream renames a selector below, that style stops with no error. `scripts/local-fork.sh selectors` finds a selector that was removed. It cannot show that the look is correct, so after a merge also check these in the app:

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

Run `scripts/local-fork.sh upstream-status`. For each `REMOVE` line, remove that local change. If #33620 is merged, take upstream's `DesktopWindow.ts` and `DesktopWindow.test.ts` when you merge. If no local fix is left, build from `upstream/main` with the same steps.

## Manual steps

These are the steps that the script does. Use them when the script fails, or to see what it does.

### Get upstream updates

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
   vp test run src/lib/workspaceFocus.browser.test.ts src/components/ChatView.logic.browser.test.ts \
     src/components/ChatView.composerFocus.browser.test.tsx
   cd ../..
   ```
5. Push the branch, then move `origin/main` to `upstream/main`:
   ```sh
   git push
   git push origin upstream/main:main
   ```
   The second push keeps upstream changes out of [PR #1](https://github.com/shebbar93/T3-Clone/pull/1), so the PR shows only local changes. It must be a fast-forward. Do not add commits to `origin/main`.

### Build and install the app

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
   codesign --force --deep -s "T3 Local Signing" "$HOME/Applications/T3 Code (Beta).app"
   rm -rf /tmp/t3zip
   ```
3. Check the installed app:
   ```sh
   APP="$HOME/Applications/T3 Code (Beta).app"
   /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist"
   /usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist"
   grep -c vrc-chromatic-spin "$APP/Contents/Resources/app.asar"
   ```
   The first line is the app version from `apps/desktop/package.json`. The second line must be `45.2.3` or higher. The third line must be `1` or higher, or the Videorc look is missing.
4. Open the app and check the [Videorc look](#videorc-look) table.

`/Applications` needs admin rights, so the app goes to `~/Applications`.

### Check upstream for the local fixes

To check the other fixes:

```sh
git show upstream/main:apps/desktop/package.json | grep '"electron"'
git show upstream/main:apps/web/src/index.css | grep -n 'font-variant-ligatures'
git show upstream/main:apps/web/src/index.css | grep -n 'caret-shape'
gh pr view 33620 --repo pingdotgg/t3code --json state -q .state
```

If upstream has Electron 45 or later, remove the local Electron and `node-abi` change.
If upstream turns ligatures on in `.composer-tiptap.ProseMirror`, remove the local ligature change.
If upstream sets `caret-shape` on `.composer-tiptap`, remove the local caret change.
If #33620 is `MERGED`, take upstream's `DesktopWindow.ts` and `DesktopWindow.test.ts` when you merge.
If no local fix is left, build from `upstream/main` with the same steps.
