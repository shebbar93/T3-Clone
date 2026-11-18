# Go Lens

Use this lens when the diff changes `.go` files. It adds two things to each adversary brief: the tool results that the lead collected, and the Go skills for the adversary's angle.

## Lead: run the checks one time, before you spawn adversaries

```bash
mkdir -p ${TMPDIR:-/tmp}/pstack-briefs
~/.pi/agent/skills/pstack-pi/overlay/extras/interrogate/go-checks.sh <base-ref> > ${TMPDIR:-/tmp}/pstack-briefs/go-checks.md
```

The script finds each Go module that has changed files. In each module it runs:

| Check | Scope |
|---|---|
| `gofmt -l` | Changed files |
| `go build ./...`, `go vet ./...` | Module |
| `golangci-lint run --new-from-rev <base>` | Repo config (`.golangci.yml`). New issues only. |
| `golangci-lint run -c .golangci.local.yml --new-from-rev <base>` | Local config, when the file exists. New issues only. |
| `go test -race -count=1 ./...` | Module |
| `govulncheck ./...` | Module |

Rules for the lead:

- Adversaries do not run the full script again. Paste the script output into each brief under `## Go Checks`.
- `MISSING` is a coverage gap. Report it. It is not a pass.
- If `go build` fails because generated code is missing (protobuf, sqlc), run the repo's own generate target (see the Makefile or README), then run the script again. If the generate target also fails, report that.
- A `go test` failure caused by the environment (Docker, network, a database) is a coverage gap, not a code finding. Say which package and why.
- `govulncheck`: a vulnerability is a finding only when the diff adds or changes the module, or adds the call path. A vulnerability that is already on the base branch, or that comes from the local Go toolchain, is dropped with that reason.
- The repo configs disable some checks with a written reason (for example `ST1005`, `exported`). Do not raise a disabled check as a finding.

## Adversary: the Go skills for each angle

Add the row for the adversary's angle to its brief. The adversary reads each skill named in the row before it starts. The skills are in the adversary's skill list. If a skill is not in the list, find it with `find . ~/.agents ~/.pi -path '*/<skill>/SKILL.md' -not -path '*/node_modules/*'`.

| Adversary | Skills | Look for |
|---|---|---|
| A, correctness | `golang-error-handling`, `golang-concurrency`, `golang-context`, `golang-safety`, `golang-testing` | Errors dropped, shadowed, or not wrapped with `%w`. `errors.Is/As` against wrapped errors. `(nil, nil)` returns. Nil map writes. Goroutines with no exit, and channels that nobody closes. A copied mutex. `ctx` not passed down, stored in a struct, or a `cancel` that is never called. `defer` in a loop. A test that checks implementation and not behavior. An error branch with no test. |
| B, security | `golang-security`, `golang-database` (when the diff has SQL), `golang-safety` | SQL built with `fmt.Sprintf` or `+`. No `http.MaxBytesReader` on a request body. A server with no `ReadHeaderTimeout`. A new handler with no authn or authz. Secrets, tokens, or PII in logs or error bodies. `math/rand` used for secrets. `InsecureSkipVerify`. `exec.Command` or `filepath.Join` with user input. |
| C, design | `golang-code-style`, `golang-naming`, `golang-structs-interfaces`, `golang-design-patterns`, `golang-modernize` | Names do not follow `golang-naming` (length proportional to scope, no `util`/`common` packages, no stutter). Interfaces defined at the producer, or an interface with one implementation and no test seam. Logic in the wrong package. Old idioms for the `go` version in `go.mod` (`slices`, `maps`, `cmp.Or`, `min`/`max`). |
| D, cross-model (`sol`) | The skills in rows A and B | The "Look for" items in rows A and B. |

All adversaries: when the diff imports a library that has its own skill (`golang-grpc`, `golang-stretchr-testify`, `golang-spf13-cobra`, `golang-samber-*`, and others), read that skill too. `golang-how-to` lists the skill for each import.

## Adversary: how to use the check output

- Each `FAIL` row in `## Go Checks` is a run. Report it as a finding with the tool command and its output line (`file:line: linter: message`), when the failure breaks the intent.
- A lint hit that only shows style, with no effect on behavior, is not a finding. Examples: `fieldalignment`, `decorder`, `funcorder`.
- Do not report again what a tool already reported. Add a finding only when a run of your own shows the root cause or the effect on a caller.
- Tools do not find logic bugs. Spend most of the time on the "Look for" column above, and prove each item with a failing test or a repro in your worktree.
