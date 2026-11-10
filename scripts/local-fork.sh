#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="local/pr-28191"
MIN_ELECTRON="45.2.3"
MIN_NODE_ABI="4.40.0"
CERT="T3 Local Signing"
APP="$HOME/Applications/T3 Code (Beta).app"
QUIT_FIX_PR="33620"

die() { echo "error: $*" >&2; echo "Manual steps: LOCAL_FORK.md, section \"Manual steps\"" >&2; exit 1; }
ok() { echo "ok: $*"; }
step() { echo "==> $*"; }

version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; }

need_clean_tree() {
  [ -z "$(git status --porcelain)" ] || { git status --short; die "working tree is not clean"; }
}

need_branch() {
  [ "$(git branch --show-current)" = "$BRANCH" ] || git switch "$BRANCH"
}

cmd_prereqs() {
  command -v vp >/dev/null || die "vp not found. Install: curl -fsSL https://vite.plus | bash"
  security find-identity -p codesigning | grep -F "\"$CERT\"" >/dev/null || die "code-signing certificate \"$CERT\" not found. See LOCAL_FORK.md"
  ok "prerequisites"
}

pin_check() {
  local electron node_abi
  electron="$(node -p "require('./apps/desktop/package.json').dependencies.electron")"
  node_abi="$(sed -nE 's/^  node-abi: ([0-9.]+)$/\1/p' pnpm-workspace.yaml)"
  version_ge "$electron" "$MIN_ELECTRON" || die "electron $electron is below $MIN_ELECTRON. Run: $0 sync"
  version_ge "${node_abi:-0}" "$MIN_NODE_ABI" || die "node-abi ${node_abi:-missing} is below $MIN_NODE_ABI. Run: $0 sync"
  ok "electron $electron, node-abi $node_abi"
}

pin_electron() {
  local file=apps/desktop/package.json current
  current="$(node -p "require('./$file').dependencies.electron")"
  if version_ge "$current" "$MIN_ELECTRON"; then
    ok "electron $current"
  else
    node -e "
      const fs = require('fs');
      const text = fs.readFileSync('$file', 'utf8');
      fs.writeFileSync('$file', text.replace(/(\"electron\": \")[^\"]+(\")/, '\$1$MIN_ELECTRON\$2'));
    "
    ok "electron $current -> $MIN_ELECTRON"
  fi
}

pin_node_abi() {
  local file=pnpm-workspace.yaml current
  current="$(sed -nE 's/^  node-abi: ([0-9.]+)$/\1/p' "$file")"
  [ -n "$current" ] || die "node-abi override not found in $file"
  if version_ge "$current" "$MIN_NODE_ABI"; then
    ok "node-abi $current"
  else
    sed -i '' -E "s/^  node-abi: [0-9.]+$/  node-abi: $MIN_NODE_ABI/" "$file"
    ok "node-abi $current -> $MIN_NODE_ABI"
  fi
}

pin_videorc_import() {
  local file=apps/web/src/main.tsx
  if grep -qF 'import "./videorc/videorc.css";' "$file"; then
    ok "videorc import"
  else
    grep -qF 'import "./index.css";' "$file" || die "import \"./index.css\" not found in $file"
    sed -i '' '/^import "\.\/index\.css";$/a\
import "./videorc/videorc.css";
' "$file"
    ok "videorc import restored"
  fi
}

resolve_conflicts() {
  local file unresolved=()
  while IFS= read -r file; do
    case "$file" in
      pnpm-lock.yaml | apps/desktop/package.json | pnpm-workspace.yaml | apps/web/src/main.tsx)
        git checkout --theirs -- "$file"
        ok "took upstream $file"
        ;;
      *) unresolved+=("$file") ;;
    esac
  done < <(git diff --name-only --diff-filter=U)

  if [ "${#unresolved[@]}" -gt 0 ]; then
    printf '  %s\n' "${unresolved[@]}" >&2
    die "resolve these files by hand, git add them, then run: $0 sync --continue"
  fi
}

cmd_sync() {
  cmd_prereqs
  if [ "${1:-}" != "--continue" ]; then
    need_clean_tree
    need_branch
    step "fetch upstream"
    git fetch upstream
    step "merge upstream/main"
    git merge --no-edit upstream/main || true
  fi

  local merging=0
  git rev-parse -q --verify MERGE_HEAD >/dev/null && merging=1

  [ "$merging" = 1 ] && resolve_conflicts
  pin_electron
  pin_node_abi
  pin_videorc_import

  step "vp i"
  vp i

  git add apps/desktop/package.json pnpm-workspace.yaml apps/web/src/main.tsx pnpm-lock.yaml
  if [ "$merging" = 1 ]; then
    [ -z "$(git diff --name-only --diff-filter=U)" ] || die "unresolved conflicts are left"
    git commit --no-edit
  elif ! git diff --cached --quiet; then
    git commit -m "chore(local): keep local pins after upstream merge"
  fi

  need_clean_tree
  cmd_selectors
  ok "sync done. Next: $0 check, then $0 push"
}

cmd_check() {
  step "typecheck and focused tests in apps/web"
  (
    cd apps/web
    vp run typecheck
    vp test run src/lib/workspaceFocus.browser.test.ts src/components/ChatView.logic.browser.test.ts
  )
  ok "check"
}

cmd_push() {
  need_clean_tree
  need_branch
  git fetch origin upstream
  git merge-base --is-ancestor origin/main upstream/main || die "origin/main is not an ancestor of upstream/main. Do not add commits to origin/main"
  git merge-base --is-ancestor upstream/main HEAD || die "$BRANCH does not contain upstream/main. Run: $0 sync"
  step "push $BRANCH"
  git push
  step "fast-forward origin/main to upstream/main"
  git push origin upstream/main:main
  ok "push"
}

check_dev_watcher() {
  local pid cwd
  while read -r pid; do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    if [ "$cwd" = "$ROOT/apps/desktop" ]; then
      die "dev Electron watcher (PID $pid) runs in this repo. Stop it first: kill $pid"
    fi
  done < <(ps -axo pid=,command= | awk '/[d]ev-electron\.mjs/ {print $1}')
}

check_app_not_running() {
  if ps -axo comm= | grep -F "$APP/Contents/" >/dev/null; then
    die "quit \"$(basename "$APP" .app)\" first"
  fi
}

cmd_build() {
  cmd_prereqs
  if [ "${1:-}" != "--allow-dirty" ] && [ -n "$(git status --porcelain)" ]; then
    git status --short
    die "the build uses the working tree. Commit or stash first, or pass --allow-dirty"
  fi
  check_dev_watcher
  check_app_not_running
  pin_check
  step "build zip"
  rm -f release/T3-Code-*-arm64.zip release/T3-Code-*-arm64.zip.blockmap
  node scripts/build-desktop-artifact.ts --platform mac --target zip --arch arm64

  local zips=(release/T3-Code-*-arm64.zip)
  [ "${#zips[@]}" = 1 ] && [ -f "${zips[0]}" ] || die "expected exactly one release/T3-Code-*-arm64.zip"

  check_app_not_running
  step "install ${zips[0]} to $APP"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  ditto -x -k "${zips[0]}" "$tmp"
  [ -d "$tmp/T3 Code (Beta).app" ] || die "zip has no \"T3 Code (Beta).app\""
  rm -rf "$APP"
  mkdir -p "$(dirname "$APP")"
  ditto "$tmp/T3 Code (Beta).app" "$APP"
  codesign --force --deep -s "$CERT" "$APP"

  cmd_verify
}

cmd_verify() {
  [ -d "$APP" ] || die "$APP not found"
  local version electron count
  version="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")"
  electron="$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist")"
  count="$(grep -a -c vrc-chromatic-spin "$APP/Contents/Resources/app.asar" || true)"

  ok "app version $version"
  version_ge "$electron" "$MIN_ELECTRON" || die "Electron $electron is below $MIN_ELECTRON"
  ok "Electron $electron"
  [ "$count" -ge 1 ] || die "Videorc CSS is missing from app.asar"
  ok "Videorc CSS in app.asar"
  echo "Next: open the app and check the Videorc look table in LOCAL_FORK.md"
}

selector_check() {
  local label="$1" first="$2"
  shift 2
  local lines
  lines="$(rg -F --no-filename -g '!videorc/**' -- "$first" apps/web/src || true)"
  for token in "$@"; do
    lines="$(printf '%s\n' "$lines" | rg -F -- "$token" || true)"
  done
  if [ -n "$lines" ]; then
    ok "$label"
  else
    echo "MISSING: $label ($first $*)" >&2
    return 1
  fi
}

cmd_selectors() {
  local failed=0
  selector_check "button slot" 'data-slot="button"' || failed=1
  selector_check "primary button" 'bg-primary' || failed=1
  selector_check "destructive button" 'bg-destructive' || failed=1
  selector_check "switch" 'data-slot="switch"' || failed=1
  selector_check "switch thumb" 'data-slot="switch-thumb"' || failed=1
  selector_check "checkbox indicator" 'data-slot="checkbox-indicator"' || failed=1
  selector_check "popover chips" 'bg-popover' || failed=1
  selector_check "secondary chips" 'bg-secondary' || failed=1
  selector_check "background chips" 'bg-background' || failed=1
  selector_check "keycaps" 'data-slot="kbd"' || failed=1
  selector_check "menu popup" 'data-slot="menu-popup"' || failed=1
  selector_check "select popup" 'data-slot="select-popup"' || failed=1
  selector_check "popover popup" 'data-slot="popover-popup"' || failed=1
  selector_check "tooltip popup" 'data-slot="tooltip-popup"' || failed=1
  selector_check "dialog popup" 'data-slot="dialog-popup"' || failed=1
  selector_check "chromatic Send button" 'isolate' 'overflow-hidden' 'rounded-full' || failed=1
  selector_check "composer shell" 'data-slot="composer-shell"' || failed=1
  selector_check "composer host" 'data-slot="composer-host"' || failed=1
  selector_check "composer outline" '--chat-composer-outline' || failed=1
  selector_check "banner surface" 'data-composer-banner-surface' || failed=1
  selector_check "banner outline" '--chat-composer-attached-outline' || failed=1
  selector_check "active sidebar row" 'bg-sidebar-row-active' || failed=1
  selector_check "tree item" 'role="treeitem"' || failed=1
  selector_check "toggle" 'data-slot="toggle"' || failed=1
  [ "$failed" = 0 ] || die "Videorc selectors are missing. Update apps/web/src/videorc/videorc.css"
}

cmd_upstream_status() {
  git fetch upstream
  local electron state
  electron="$(git show upstream/main:apps/desktop/package.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).dependencies.electron))")"
  if version_ge "$electron" "$MIN_ELECTRON"; then
    echo "REMOVE: Electron and node-abi pins (upstream has electron $electron)"
  else
    echo "KEEP:   Electron and node-abi pins (upstream has electron $electron)"
  fi

  if git show upstream/main:apps/web/src/index.css | awk '/composer-tiptap\.ProseMirror[^{]*\{/ {inside=1} inside && /font-variant-ligatures: *normal/ {found=1} inside && /\}/ {inside=0} END {exit !found}'; then
    echo "REMOVE: composer ligature change (upstream turns ligatures on in .composer-tiptap.ProseMirror)"
  else
    echo "KEEP:   composer ligature change"
  fi

  state="$(gh pr view "$QUIT_FIX_PR" --repo pingdotgg/t3code --json state -q .state)"
  if [ "$state" = MERGED ]; then
    echo "REMOVE: quit error fix (#$QUIT_FIX_PR is merged). Take upstream DesktopWindow.ts and DesktopWindow.test.ts"
  else
    echo "KEEP:   quit error fix (#$QUIT_FIX_PR is $state)"
  fi
}

usage() {
  cat <<EOF
Usage: $0 <command>

  sync [--continue]       Merge upstream/main, keep local pins, run vp i, check Videorc selectors
  check                   Typecheck and focused tests in apps/web
  push                    Push $BRANCH, fast-forward origin/main to upstream/main
  build [--allow-dirty]   Build the zip, install to $APP, sign, verify
  verify                  Verify the installed app
  selectors               Check that Videorc selectors still exist in apps/web/src
  upstream-status         Show which local changes upstream now has
EOF
}

case "${1:-}" in
  sync) shift; cmd_sync "$@" ;;
  check) cmd_check ;;
  push) cmd_push ;;
  build) shift; cmd_build "$@" ;;
  verify) cmd_verify ;;
  selectors) cmd_selectors ;;
  upstream-status) cmd_upstream_status ;;
  *) usage; exit 1 ;;
esac
