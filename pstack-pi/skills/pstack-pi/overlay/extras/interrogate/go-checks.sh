#!/usr/bin/env bash
set -u

BASE=${1:-$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD origin/master 2>/dev/null || echo HEAD~1)}
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT" || exit 2

CHANGED=$(git diff --name-only --diff-filter=AMR "$BASE"...HEAD -- '*.go'; git diff --name-only --diff-filter=AMR HEAD -- '*.go')
CHANGED=$(printf '%s\n' "$CHANGED" | sort -u | sed '/^$/d')
if [ -z "$CHANGED" ]; then
  echo "go-checks: no Go files changed since $BASE"
  exit 0
fi

SUMMARY=""
DETAIL=""

check() {
  local mod=$1 name=$2; shift 2
  local out rc
  out=$("$@" 2>&1); rc=$?
  local status=pass
  [ $rc -ne 0 ] && status=FAIL
  [ $rc -eq 127 ] && status=MISSING
  SUMMARY+="| $mod | $name | $status |"$'\n'
  if [ "$status" != pass ]; then
    DETAIL+=$'\n'"### $mod: $name ($status)"$'\n```\n'"$(printf '%s\n' "$out" | tail -n 80)"$'\n```\n'
  fi
}

gofmt_check() {
  local files
  files=$(gofmt -l "$@")
  [ -z "$files" ] || { echo "not gofmt-formatted:"; echo "$files"; return 1; }
}

govulncheck_run() {
  if command -v govulncheck >/dev/null; then
    govulncheck ./...
  else
    go run golang.org/x/vuln/cmd/govulncheck@latest ./...
  fi
}

lint_run() {
  command -v golangci-lint >/dev/null || { echo "golangci-lint not installed"; return 127; }
  golangci-lint run --new-from-rev "$BASE" "$@" ./...
}

for MOD in $(git ls-files '*go.mod' | xargs -n1 dirname | sort -r); do
  MODFILES=$(printf '%s\n' "$CHANGED" | awk -v m="$MOD/" 'm=="./" || index($0, m)==1')
  [ -z "$MODFILES" ] && continue
  CHANGED=$(printf '%s\n' "$CHANGED" | grep -vxFf <(printf '%s\n' "$MODFILES"))
  EXISTING=$(for f in $MODFILES; do [ -f "$f" ] && echo "$f"; done)
  (
    cd "$MOD" || exit 1
    REL=$(for f in $EXISTING; do echo "${f#"$MOD"/}"; done)
    check "$MOD" "gofmt -l (changed files)" gofmt_check $REL
    check "$MOD" "go build ./..." go build ./...
    check "$MOD" "go vet ./..." go vet ./...
    check "$MOD" "golangci-lint run --new-from-rev $BASE" lint_run
    for LOCAL in .golangci.local.yml .golangci.local.yaml; do
      [ -f "$LOCAL" ] && check "$MOD" "golangci-lint run -c $LOCAL --new-from-rev $BASE" lint_run -c "$LOCAL"
    done
    check "$MOD" "go test -race -count=1 ./..." go test -race -count=1 ./...
    check "$MOD" "govulncheck ./..." govulncheck_run
    printf '%s' "$SUMMARY" > "${TMPDIR:-/tmp}/go-checks.summary.$$.$(echo "$MOD" | tr '/' '_')"
    printf '%s' "$DETAIL" > "${TMPDIR:-/tmp}/go-checks.detail.$$.$(echo "$MOD" | tr '/' '_')"
  )
done

echo "## Go checks (base $(git rev-parse --short "$BASE"), head $(git rev-parse --short HEAD))"
echo
echo "| Module | Check | Status |"
echo "|---|---|---|"
cat "${TMPDIR:-/tmp}"/go-checks.summary.$$.* 2>/dev/null
cat "${TMPDIR:-/tmp}"/go-checks.detail.$$.* 2>/dev/null
rm -f "${TMPDIR:-/tmp}"/go-checks.summary.$$.* "${TMPDIR:-/tmp}"/go-checks.detail.$$.*
