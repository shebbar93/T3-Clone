# Local fork notes

This repo is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code).

Branch `local/pr-28191` is upstream `main` plus these local changes:

| Change                                                                                                                       | Why                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composer block caret (`caret-shape: block` on `.composer-tiptap` in `local-fork/videorc-theme.css`)                          | Local preference. Part of the [Videorc themes](#videorc-themes). Needs Chromium 144 or later (Electron 45 has Chromium 156).                                                                                                                                                    |
| Allo font features (`font-feature-settings: "cv05", "ss03"` on `html` in `local-fork/videorc-theme.css`)                     | Dotted zero and open figures for the [Allo](https://allo.joshpuckett.me/) Interface font. `.font-mono` and `--diffs-font-features` reset to `normal`, so code and diffs do not get them. The prompt box keeps upstream's `normal`, so a separate Prompt font does not get them. |
| Thread details hidden by default (`rightPanelStore.ts`)                                                                      | Local preference.                                                                                                                                                                                                                                                               |
| Electron `45.2.3` (`apps/desktop/package.json`), `node-abi` `4.40.0` (`pnpm-workspace.yaml`)                                 | Electron 44 (Chromium 152) draws a typed `->` as `>` after the next space. Electron 45 (Chromium 156) draws the arrow correctly.                                                                                                                                                |
| Rune look (`local-fork/rune-theme.css`, published as "Stillwater Rune" and "Carbonfox Rune")                                 | Components in the style of [Rune](https://github.com/anomalyco/rune). No app code change. See [Rune themes](#rune-themes).                                                                                                                                                      |
| Videorc look (`local-fork/`, published as environment themes)                                                                | Light skeuomorphic style from [Videorc UI](https://ui.videorc.com). No app code change. See [Videorc themes](#videorc-themes).                                                                                                                                                  |
| Composer focus (`ChatView.tsx`, `KeybindingsSettings.logic.ts`, `composer.focus` in `packages/contracts/src/keybindings.ts`) | The `composer.focus` command puts focus in the prompt box. It has no default key. Bind Ctrl+L in Settings > Keybindings. Cmd+W closes the selected right panel tabs. When no right panel surface is left, Cmd+W also puts focus in the prompt box.                              |
| Thread cycle (`resolveAdjacentThreadId` in `Sidebar.logic.ts`)                                                               | `thread.previous` and `thread.next` go around from the first thread to the last, and from the last to the first.                                                                                                                                                                |
| First working thread (`thread.firstWorking` in contracts, `packages/shared/src/keybindings.ts`, `Sidebar.tsx`)               | `mod+shift+w` goes to the first thread in the Working section. If that thread is open, it stays open. Settings > Keybindings shows it as "Thread: First Working".                                                                                                               |

A new command needs a label in `KeybindingsSettings.logic.ts` and its key in each `apps/web/src/i18n/translations/*.json`, or `KeybindingsSettings.logic.test.ts` fails. Do not commit the full output of `vp run i18n:generate`. It also changes many keys that are not local. Add only the new key, then run `vp run i18n:check`.

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

| Command                 | What it does                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync`                  | Merges `upstream/main`. It takes upstream's file for conflicts in `pnpm-lock.yaml`, `apps/desktop/package.json`, and `pnpm-workspace.yaml`. Then it puts back the Electron and `node-abi` minimum versions, runs `vp i`, commits, and runs `selectors` and `themes`. |
| `sync --continue`       | Use this after you resolve other conflicts by hand and `git add` them.                                                                                                                                                                                               |
| `check`                 | Typecheck and focused tests in `apps/web`, including the tests for each local change.                                                                                                                                                                                |
| `push`                  | Pushes the branch, then fast-forwards `origin/main` to `upstream/main`, so [PR #1](https://github.com/shebbar93/T3-Clone/pull/1) shows only local changes. It stops if this is not a fast-forward.                                                                   |
| `build [--allow-dirty]` | Stops if the tree is dirty, the dev Electron watcher runs from this repo, or the app is open. Builds the zip (the DMG target fails on this machine), installs the app to `~/Applications`, signs it, and runs `verify`.                                              |
| `verify`                | Checks the installed app: Electron `45.2.3` or higher.                                                                                                                                                                                                               |
| `selectors`             | Checks that each selector in the [Videorc look](#videorc-look) table still exists in `apps/web/src`.                                                                                                                                                                 |
| `upstream-status`       | Prints `KEEP` or `REMOVE` for each local change. See [When upstream has the local fixes](#when-upstream-has-the-local-fixes).                                                                                                                                        |
| `themes [--apply]`      | Without `--apply`, shows what would change in the published [Videorc themes](#videorc-themes) and changes nothing. With `--apply`, publishes them.                                                                                                                   |

Usual update:

1. `scripts/local-fork.sh sync`
2. `scripts/local-fork.sh check`
3. `scripts/local-fork.sh push`
4. `scripts/local-fork.sh build`
5. `scripts/local-fork.sh themes --apply`
6. Open the app and check the [Videorc look](#videorc-look) table.

If `build` stops on the dev watcher, stop it with the `kill <pid>` it prints. The watcher restarts the dev Electron app each time the build writes `apps/desktop/dist-electron`. The dev app then shows "This T3 home is unavailable".

## Videorc look

`local-fork/videorc-theme.css` restyles existing components with CSS selectors. It is not in the app code. The script publishes it as theme CSS, so a merge cannot conflict on it. But if upstream renames a selector below, that style stops with no error. `scripts/local-fork.sh selectors` finds a selector that was removed. It cannot show that the look is correct, so after a merge also check these in the app:

| Look                                    | Depends on                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Chrome primary and destructive buttons  | `[data-slot="button"]` with `.bg-primary` or `.bg-destructive`                                            |
| Chrome switch, checkbox, bead knob      | `[data-slot="switch"]`, `[data-slot="switch-thumb"]`, `[data-slot="checkbox-indicator"]`                  |
| Glass chips, keycaps                    | `.bg-popover`, `.bg-secondary`, `.bg-background` on buttons, toggles, badges; `[data-slot="kbd"]`         |
| Floating panel rims                     | `menu-popup`, `select-popup`, `popover-popup`, `tooltip-popup`, `dialog-popup` slots                      |
| Chromatic Send button                   | Classes `isolate overflow-hidden rounded-full` in `ComposerPrimaryActions.tsx`                            |
| Prompt rim and drop                     | `composer-shell`, `composer-host` slots; `--chat-composer-outline`                                        |
| Prompt raised look (dark), 10px corners | `composer-host` `::after` outline; `data-chat-composer-main-surface`, `data-chat-composer-surface`        |
| Banner rims                             | `[data-composer-banner-surface]`, `--chat-composer-attached-outline`                                      |
| No Allo font features in the prompt     | `.composer-tiptap.ProseMirror` sets `font-feature-settings: normal` (upstream)                            |
| Chrome plate                            | `.bg-sidebar-row-active`, `[role="treeitem"][aria-selected="true"]`, `[data-slot="toggle"][data-pressed]` |

## Videorc themes

Upstream keeps custom CSS inside each theme. There is no CSS that applies to all themes. So `scripts/local-fork.sh themes --apply` publishes one environment theme for each palette, each with the Videorc CSS. The local T3 server reads them from `~/.t3/userdata/themes/` and sends them to the desktop app and the local web client. The server watches the folder, so you do not restart it.

| Input in git                                                                                        | Published as                                                                                                                |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `local-fork/videorc-theme.css`                                                                      | The `css` of each theme below                                                                                               |
| Built-in palettes from `apps/web/src/themePalette.ts` (T3 Code, T3 Chat, Grove, Ocean, Ember, Iris) | `<name>-videorc.json`, shown as "&lt;Name&gt; Videorc"                                                                      |
| `local-fork/themes/custom/*.json` (your custom themes, exported from the app)                       | `<name>-videorc.json`, shown as "&lt;Name&gt; Videorc". The original custom theme in the app does not change.               |
| `local-fork/themes/environment/*.json` (environment themes, such as Carbonfox)                      | The same file name. The CSS is added in place.                                                                              |
| `local-fork/themes/environment/<id>.css` (optional)                                                 | Added to the CSS of `<id>.json`, after the Videorc CSS.                                                                     |
| `local-fork/drafting-flat.css`                                                                      | Added to each environment theme whose id ends with `-drafting`, after the Videorc CSS. It makes the Videorc gradients flat. |
| `local-fork/rune-buttons.css`                                                                       | Added to each environment theme whose id ends with `-drafting`, after `drafting-flat.css` and before `<id>.css`.            |
| `local-fork/drafting.css`                                                                           | Added to each environment theme whose id ends with `-drafting`, after `<id>.css`.                                           |

The output depends only on the files in git, so the same commit always gives the same files. `themes` shows each file as `ADD`, `UPDATE`, `SAME`, or `REMOVE`, and exits with code 2 if a change is waiting. `~/.t3/userdata/themes/.videorc-manifest` lists the files that the script owns. If you remove an input, `--apply` removes its file. It shows other files in the folder as `OTHER` and does not change them.

It stops with an error and writes nothing if:

- A theme fails the server's `EnvironmentThemeFile` schema, or loses its CSS.
- The CSS loads a remote file (`url()`, `@import`, `image-set()`).
- Two inputs give the same id, or an id is reserved.
- The folder would have more than 32 theme files. The server reads only 32.

It writes each file to a temp file, then renames it, so the server never reads a partial file. It needs `bun`.

### Change the Videorc CSS

1. Edit `local-fork/videorc-theme.css`.
2. Run `scripts/local-fork.sh themes`. Each theme must show `UPDATE`.
3. Run `scripts/local-fork.sh themes --apply`.
4. Commit `local-fork/videorc-theme.css`.

### Add or change a custom theme

1. In the app, go to **Settings > Appearance**. On the theme card, click the download button. The file name is `<id>.json`.
2. Move the file to `local-fork/themes/custom/`. For a changed theme, replace the old file with the same name.
3. Run `scripts/local-fork.sh themes`, then `scripts/local-fork.sh themes --apply`.
4. Commit the file.

To remove a custom theme from the Videorc set, delete its file from `local-fork/themes/custom/`, then run `themes --apply`.

### Add or change an environment theme

1. Copy the theme file without the Videorc CSS to `local-fork/themes/environment/<id>.json`. If the file has a `css` field, the script replaces it.
2. Run `scripts/local-fork.sh themes`, then `scripts/local-fork.sh themes --apply`.
3. Commit the file.

Optional: put CSS for only this theme in `local-fork/themes/environment/<id>.css`. The script adds it after the Videorc CSS. If both set the same property, this file is used.

A theme id that ends with `-drafting` (Stillwater Drafting, Carbonfox Drafting) also gets `local-fork/drafting.css`: sharp corners, corner ticks, square icons, and the [Quicksilver](https://github.com/kristianbonnici/t3-quicksilver-theme) (MIT) composer edge. The edge shows only while the agent works. It is a metal rim with a wave on it. An idle composer has no rim. Reduce Motion stops the wave and keeps the metal rim.

`scripts/local-fork.sh selectors` does not check `drafting.css`. After a merge, also check these in a Drafting theme:

| Look                                             | Depends on                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 3px corners on Tailwind `rounded-xl` and larger  | `--radius-xl`, `--radius-2xl`, `--radius-3xl`, `--control-radius`, and the `.rounded-xl`, `.rounded-2xl`, `.rounded-3xl` classes |
| Wave only while the agent works                  | Composer button labels `Stop generation`, `Stopping`, `Queue message`, `Steer message` in `ComposerPrimaryActions.tsx`           |
| Edge on the input area when a banner is attached | `[data-composer-banner-surface="attached"]` inside `composer-host`; `data-chat-composer-main-surface`                            |
| Banner corners                                   | `[data-composer-banner-surface]::before`, `composer-banner-attachment` slot                                                      |
| Corner ticks                                     | `[data-user-message-bubble]`, `[data-thread-item] [data-sidebar-row][aria-current="page"]`                                       |

The Quicksilver edge runs in dark and light mode. Quicksilver has no light version, so light mode uses the same metal colors. Only the shadows change: `--qs-ring` and `--qs-drop` on `:root` and `.dark`. In light mode, an idle composer keeps its usual outline, because the edge rules apply only while the agent works.

Stillwater Drafting has no stars and no glow at the top of the sidebar. `stillwater-drafting.css` has no `--ob-stars` or `--ob-twinkle` layer and no `[data-slot="sidebar-inner"]::before` or `::after` rule. The twinkle animation sat inside the sidebar `backdrop-filter`, so Chromium blurred the sidebar again on each frame. In a headless Chromium test, it used about 30% of the GPU process when the app was idle. Remove the star and glow layers again when you paste a new upstream Stillwater CSS. While the agent works, the wave costs about 13% of the renderer. A lower `--qs-pace` step count decreases only GPU work, because Chromium calculates the style again on each frame.

To change the palette of an environment theme, change its file in `local-fork/themes/environment/`, not in `~/.t3/userdata/themes/`. The next `--apply` writes over the file in `~/.t3/userdata/themes/`.

### Use a theme

1. In the app, go to **Settings > Appearance**.
2. Select a theme with "Videorc" in its name, or Carbonfox, Carbonfox Drafting, or Stillwater Drafting.
3. Do not click **Duplicate** on a Videorc theme. A copy does not get later changes from `--apply`.

### Undo

- One theme: remove its input file, then run `themes --apply`.
- All themes: delete the files listed in `~/.t3/userdata/themes/.videorc-manifest`. For Carbonfox, copy `local-fork/themes/environment/carbonfox.json` to `~/.t3/userdata/themes/` to get the version without CSS.

### Backup

| Copy                                 | Kept by                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `local-fork/`                        | Git, on this branch and `origin`                                                       |
| `~/Documents/t3code-videorc-backup/` | Your disk, outside the repo. It has the CSS and the theme files from 16 November 2026. |

## Rune themes

`local-fork/rune-theme.css` restyles the components with the look of [Rune](https://github.com/anomalyco/rune) (MIT), the OpenCode UI kit. The values come from Rune's `themes/opencode/assets/theme.json` (elevations, hairlines, overlays) and `crates/rune-kit` (switch and keycap sizes). It does not change the Videorc themes.

The Rune buttons are in `local-fork/rune-buttons.css`. The Drafting themes also use this file, after `videorc-theme.css`, so they get the Rune buttons and keep the rest of the Videorc look.

For each `local-fork/themes/environment/<name>-drafting.json`, `themes --apply` also publishes `<name>-rune.json`, shown as "&lt;Name&gt; Rune". It uses the same palette, so a palette change goes to both themes.

| CSS of a Rune theme, in order                   | What it gives                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `local-fork/rune-buttons.css`                   | Rune buttons                                                                                          |
| `local-fork/rune-theme.css`                     | Other Rune components, the Videorc chromatic Send button, the block caret, and the Allo font features |
| `local-fork/themes/environment/<name>-rune.css` | Optional. `stillwater-rune.css` has the Stillwater background, starry sidebar, and code wells         |
| `local-fork/drafting.css`                       | Sharp corners, corner ticks, and the Quicksilver composer edge                                        |

After a merge, `scripts/local-fork.sh selectors` also checks the Rune selectors. Then check these in a Rune theme:

| Look                                          | Depends on                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Raised buttons with a 0.5px rim               | `[data-slot="button"]` with `.bg-primary`, `.bg-destructive`, `.bg-popover`, or `.bg-secondary`           |
| Small switch with a square knob               | `--thumb-size` and `data-size` on `[data-slot="switch"]`, `[data-slot="switch-thumb"]`                    |
| Neutral checkbox                              | `[data-slot="checkbox"]`, `[data-slot="checkbox-indicator"]`                                              |
| Hairline inputs                               | `[data-slot="input-control"]`, `[data-slot="select-trigger"].bg-background`                               |
| Flat fill on the selected sidebar row         | `.bg-sidebar-row-active`, `[role="treeitem"][aria-selected="true"]`, `[data-slot="toggle"][data-pressed]` |
| Raised message bubble with a border and ticks | `[data-user-message-bubble].bg-message`                                                                   |
| Floating panel and dialog shadows             | The popup slots in the [Videorc look](#videorc-look) table                                                |

To change the Rune look, edit `local-fork/rune-buttons.css` or `local-fork/rune-theme.css`, then run `scripts/local-fork.sh themes` and `scripts/local-fork.sh themes --apply`.

## When upstream has the local fixes

The quit error fix is in upstream `main` as [#33620](https://github.com/pingdotgg/t3code/pull/33620). This branch uses upstream's version.

The focus fix from [#28191](https://github.com/pingdotgg/t3code/pull/28191) is in upstream `main` as [#33525](https://github.com/pingdotgg/t3code/pull/33525). This branch uses upstream's version.

The composer ligature fix is in upstream `main` (`.composer-tiptap.ProseMirror` in `apps/web/src/index.css`). This branch uses upstream's version.

Run `scripts/local-fork.sh upstream-status`. For each `REMOVE` line, remove that local change. If no local fix is left, build from `upstream/main` with the same steps.

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
3. Install dependencies: `vp i`
4. Optional check:
   ```sh
   cd apps/web
   vp run typecheck
   vp test run src/lib/workspaceFocus.browser.test.ts src/components/ChatView.logic.browser.test.ts \
     src/components/ChatView.composerFocus.browser.test.tsx src/components/Sidebar.logic.test.ts \
     src/components/settings/KeybindingsSettings.logic.test.ts src/rightPanelStore.test.ts
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
   ```
   The first line is the app version from `apps/desktop/package.json`. The second line must be `45.2.3` or higher.
4. Run `scripts/local-fork.sh themes --apply`.
5. Open the app and check the [Videorc look](#videorc-look) table.

`/Applications` needs admin rights, so the app goes to `~/Applications`.

### Check upstream for the local fixes

To check the other fixes:

```sh
git show upstream/main:apps/desktop/package.json | grep '"electron"'
git show upstream/main:apps/web/src/index.css | grep -n 'caret-shape'
```

If upstream has Electron 45 or later, remove the local Electron and `node-abi` change.
If upstream sets `caret-shape` on `.composer-tiptap`, remove the `caret-shape` rule from `local-fork/videorc-theme.css`, then run `scripts/local-fork.sh themes --apply`.
If no local fix is left, build from `upstream/main` with the same steps.
