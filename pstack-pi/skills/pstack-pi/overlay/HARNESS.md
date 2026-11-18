# pstack on pi + herdr or Rex

Upstream pstack is written for Cursor. The vendor copy at `$PSTACK` (`~/.pi/agent/vendor/cursor-plugins/pstack`) is not edited. This file maps each Cursor primitive to its pi + herdr and pi + Rex equivalents. When a pstack file names a Cursor primitive, use the equivalent below. Do not say that a Cursor-only action ran. If a pstack file names a Cursor primitive that this file does not map, do not guess: tell the user, and add a row here.

Tools: `pstack_spawn`, `pstack_wait`, `pstack_resume` (from `~/.pi/agent/extensions/pstack-guard.ts`). They call the helper `~/.pi/agent/skills/pstack-pi/overlay/bin/pstack-agent` (below: `pstack-agent` or `$A`). Use the helper in bash only for `clean`, `upstream-check`, and `smoke`.

## Multiplexer

Run the parent `pi` inside herdr or Rex. Then each subagent opens in a tab that the user can watch. `pstack-agent` picks the multiplexer by itself:

| Check | Multiplexer | A subagent opens in | Your pane | Namespace `<ns>` default |
|---|---|---|---|---|
| `HERDR_ENV=1` | herdr | a herdr tab in `$HERDR_WORKSPACE_ID` | `$HERDR_PANE_ID` | `$HERDR_PANE_ID` |
| else `REX_SESSION` is set and `rex` is on `PATH` | Rex | a Rex window (tab) in `$REX_SESSION` | `$REX_BLOCK` | `rex-<last part of $REX_BLOCK>` |
| else `T3CODE_CLI_PATH` is set (pi runs in T3 Code) | T3 Code | a T3 thread, titled `pstack:<ns>:<label>` | none | `t3-<last part of $PI_SESSION_ID>` |
| none of these | none | a hidden background `pi -p` process | none | `main` |

In Rex, a tab is a window and a pane is a block. Before you use a `rex` command that this file does not show, run `rex __internal skill` (the `rex` skill) and follow it. When a section below gives a herdr command, use the Rex command in the same row or block when you are in Rex. The active transcript is `$PI_SESSION_FILE` in both.

### T3 Code

`pstack-agent` uses the `t3 thread` CLI (`$T3CODE_CLI_PATH`). `spawn`, `wait`, `resume`, and `clean` work as in herdr. These rules are different:

- A subagent is a T3 thread on provider `pi`. `spawn` prints the thread link. Give the user that link.
- `--cwd` must be in a T3 project. If it is not (for example, a `/tmp` worktree), `spawn` adds a project `pstack:<ns>:<label>` for it. `clean` removes that project and its threads.
- `clean` does not close threads in a project that was there before. The user archives them in the T3 sidebar.
- Models: the route is the same as in herdr and Rex (see Models). `haiku`, `sonnet`, and `opus` are `aperture/claude-<m>-5-5` (or `github-copilot/claude-<m>-5.5`). `sol` is `azure/gpt-6.1-sol` (or `github-copilot/gpt-6.1-sol`). The `azure` entry in `~/.pi/agent/models.json` points to Aperture, so `sol` does not need the alias env vars. The thinking level comes from `modelThinkingLevels` in `~/.pi/agent/settings.json`, with the same levels as the aliases. `PSTACK_T3_MODEL=<provider>/<model>` replaces the routed model for one call.
- `--readonly` is only an instruction in the brief. The T3 CLI cannot remove the `edit` and `write` tools.
- `wait` reads the thread state with `t3 thread show`. A thread that waits for an answer ends `wait` with state `waiting` and its link.
- Use `pstack_spawn` for pstack subagents. Do not use `delegate_task` or `t3_thread_launch` for them.

## Subagents (Cursor `Task` tool)

One subagent = one interactive `pi` session in its own herdr tab or Rex window, labelled `pstack:<ns>:<label>`. `<ns>` is the caller's namespace (see Multiplexer). The user can watch and steer each tab. Run files are in `${TMPDIR:-/tmp}/pstack/<ns>/<label>/` (below: `<dir>`). The session file is in the pi session store. `<dir>/session` holds its path after the first `wait`.

1. Call `pstack_spawn` once for each parallel subagent, all in one message. The `task` must stand alone: the subagent does not see this chat. Each call returns a run, `<label>@<id>`. `pstack-agent` refuses an empty brief and a brief that ends with a heading or a `:` line.
2. In the next message, call `pstack_wait` with the runs. It blocks until the last assistant message in each session ends its turn, then writes that message to `<dir>/out.md` and returns it. A run that a later spawn, resume, or clean replaced fails at once. The `pi` process stays open in its tab until `clean`.
3. When the skill is done: `$A clean`. It closes every `pstack:<ns>:*` tab or window of this caller and the tabs or windows of their nested subagents.

| Cursor `Task` parameter | pi + herdr or Rex equivalent |
|---|---|
| `subagent_type: generalPurpose` | Ignore. Every subagent is a plain `pi` agent. |
| `subagent_type: "poteto-agent"` / `"comment-sicko"` (was `"Comment Sicko"`) | `role: "poteto-agent"` / `role: "comment-sicko"`. The tool puts the agent body in front of the brief. Ignore the `model:` line in that frontmatter. |
| `model: <any slug>` | Ignore. The route picks the model. See Models. |
| `readonly: true` | `readonly: true` (no `edit`/`write` tools, and a no-write instruction for `bash`) |
| `readonly: false` / agent mode | Omit `readonly` |
| `run_in_background: true` | Default. `spawn` returns at once. `wait` collects. |
| `environment: "cloud"`, Cursor cloud agent, cloud VM | Not available. Run local. Give each writer its own git worktree (`git worktree add`, or `herdr worktree create` in herdr), then `pstack_spawn` with `cwd`. |
| `cloud_base_branch` | `git worktree add <path> <branch>`, then `pstack_spawn` with `cwd` |
| Result "in the Task response body" | `<dir>/out.md`, returned by `pstack_wait` |
| Resume / message a finished agent | `pstack_resume`, then `pstack_wait` with the new run. Same tab, same session. See Reuse a subagent. |
| Agent ID | The label. The herdr pane ID is in `<dir>/pane`. The Rex block ID is in `<dir>/block`. |

### Models

`pstack-agent` picks the model from the seat and the route. The caller does not. `pstack_spawn` has no `model` parameter, and `pstack-agent spawn` refuses `--model`. This replaces the `pstack-models.mdc` rule, every model slug in upstream files and agent frontmatter, and every role-to-model table.

| Step | `model` | Alias | Thinking |
|---|---|---|---|
| 1 | `haiku` | `pihaiku55<backend>` | `max` |
| 2 | `sonnet` | `pisonnet55<backend>` | `xhigh` |
| 3 | `sol` | `pisol61<backend>` (GPT-6.1 Sol) | `medium` |

Every `pstack_spawn` must set `seat` (`--seat`). The schema requires it, and `pstack-agent` refuses a spawn without it.

| `seat` | Use it for | Model |
|---|---|---|
| `write` | A subagent that changes files: code, docs, repros | route, from `haiku` |
| `research` | A subagent that reads and answers: `how`, `why`, `recall`, `reflect`, smoke | route, from `haiku` |
| `review` | A subagent that checks the work of another agent: verifier, `arena-judge`, second opinion, `show-me-your-work` reviewer, `comment-sicko` | `opus` (`piopus55<backend>`), pinned |

A weak review gives no findings, and that looks like success, so it never escalates. That is why `review` is pinned to `opus`.

Route rules, per label, in `<ns>`:

1. Every `write` or `research` spawn starts on step 1 (`haiku`). A `review` spawn always runs `opus` and does not escalate. The labels `interrogate-a`, `-b`, `-c` always run `opus`, and `interrogate-d` always runs `sol`, for any seat.
2. The spawn goes one step up when:
   - the call has `escalate: true` (`--escalate`), or
   - the last `pstack_wait` of that label failed: `timeout`, `exited`, `error`, `length`, or `aborted`. The state `waiting` (T3) or `replaced` is not a failure.
3. `escalate` with no earlier run of the label is refused.
4. After step 3, the spawn is refused. The parent takes the task back and says so in the reply.
5. A successful wait, then a spawn without `escalate`, starts again on step 1. `pstack-agent clean` with no labels resets every route of the caller.

The state is in `<ns>/.route/<label>` (step index) and `<label>.failed`. The backend follows the parent pi: `copilot` when the parent runs on `github-copilot`, else `aperture`. Set `PSTACK_BACKEND=aperture|copilot` to force one. The helper runs the alias with `zsh -ic`, so the alias and its env vars load.

- When to escalate: the parent checks each result (report, `git diff --stat`, the hunks it must check, and one test or check command for code). If the result is wrong, weak, or misses the brief, spawn the same label again with `escalate: true` and the consolidated scope. Do not retry at the same step. Say so in the reply.
- Reasoning level and speed: ignore every upstream "reasoning level", "effort level", "fast mode", "fast or standard speed", `-fast` suffix, and `/setup-pstack` budget. Do not add `--thinking`. Each alias keeps its own thinking level.
- Skills that ask for more than one model family: the `arena` cross-judge, Autopilot and Shipping verifiers, and a second opinion or `show-me-your-work` reviewer use `seat: "review"`, so they run `opus`. Arena runners use `seat: "write"`. blast-radius uses `seat: "research"`. Give each seat a different angle in its brief. Report "single model family" in the output.
- Override for one call only, by the user, outside a guarded session: `PSTACK_PI_CMD='pi --provider <provider> --model <id> --thinking <level>' $A spawn ...` (or `PSTACK_T3_MODEL` in T3). It replaces the routed model.

### Reuse a subagent (same tab, cached context)

`pstack_resume` sends a follow-up to a finished subagent. It uses the same herdr tab or Rex window, the same pi session, and the same model. While `pi` still runs, herdr sends the text with `herdr agent prompt`, and Rex sends it as a paste (`block.event`) and then Enter. After `pi` stopped, the helper runs `pi --session <id>` again in the same tab. The subagent keeps what it already read, and the prompt cache makes that old context cheap for about 5 minutes. A new spawn opens a new tab and reads everything again.

Resume when the follow-up is on the subagent's own work, in the same scope:

- a fix round on its own diff
- a follow-up question to a `how` explainer or a `why` investigator
- one more check in the same files

Spawn a fresh subagent when:

- the scope changes, or the next queue item starts
- the result needs the next route step (`escalate: true`)
- the subagent got the root cause or the design wrong. Its context holds the wrong model of the problem.
- it already did two fix rounds on the same problem

Rules for a resume:

1. Resume only after `pstack_wait` returned. Never resume a subagent while it runs.
2. Put every open directive in the resume text, not only the new one. A short "fix it" loses earlier directives.
3. Do not `$A clean` a label that you can still resume. Clean when the skill is done.

## Loops and wakes (Cursor `/loop`)

pi has no `/loop`. Use one of these:

| Cursor | pi + herdr or Rex |
|---|---|
| `/loop` until a check passes, in dynamic mode, or "drive a long hunt with `/loop`" | Stay in your turn. Run the check, act on the result, and run it again until it passes. Block in `bash` on the watcher, for example `gh pr checks <n> --watch` or `scripts/watch-pr/watch-pr`. Rearm the watcher after every push. |
| Wake on an event in another process | Run the process in a tab. herdr: wait with `herdr pane wait-output <pane> --match <text> --timeout <ms>`, or `herdr agent wait <pane> --until done --timeout <ms>` for an agent pane. Rex: wait for an exit with `rex wait -s "$REX_SESSION" <block> --for <duration>`. Wait for a text with `for i in $(seq 60); do rex capture -s "$REX_SESSION" -b <block> --trim \| rg -q '<text>' && break; sleep 2; done`. For an agent, use `pstack_wait`. |
| `/loop 1h` (fixed heartbeat, for example an audit tick) | A tick tab that prompts your pane when it is idle. See the recipes below. Close it with `$A clean tick`. |

Tick recipe in herdr (replace `<tick prompt>`):

```bash
NS=$(printf %s "${PSTACK_NS:-$HERDR_PANE_ID}" | tr -c 'A-Za-z0-9._-' '-')
P=$(herdr tab create --workspace "$HERDR_WORKSPACE_ID" --label "pstack:$NS:tick" --no-focus |
  python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
herdr pane run "$P" "while sleep 3600; do herdr agent wait $HERDR_PANE_ID --until idle --until done; herdr agent prompt $HERDR_PANE_ID '<tick prompt>'; done"
```

Tick recipe in Rex (replace `<tick prompt>`). Rex cannot tell when an agent is idle, so the tick reads your session file. Your pane is idle when its last message is an assistant message that ended its turn. If you start a new pi session (`/new`, `/resume`), close the tick and start it again.

```bash
NS=$(printf %s "${PSTACK_NS:-rex-${REX_BLOCK##*-}}" | tr -c 'A-Za-z0-9._-' '-')
T="${TMPDIR:-/tmp}"; T="${T%/}/pstack-tick-$NS.sh"
cat > "$T" <<EOF
while sleep 3600; do
  until python3 -c 'import json,sys
last=None
for l in open(sys.argv[1]):
    o=json.loads(l)
    if o.get("type")=="message": last=o["message"]
sys.exit(0 if last and last.get("role")=="assistant" and last.get("stopReason") in ("stop","aborted","error","length") else 1)' "$PI_SESSION_FILE"; do sleep 30; done
  rex send -s "$REX_SESSION" -b "$REX_BLOCK" '<tick prompt>' && rex send-key -s "$REX_SESSION" -b "$REX_BLOCK" enter
done
EOF
rex window new -s "$REX_SESSION" "pstack:$NS:tick" --focus=false --json -- bash "$T"
```

## Other Cursor primitives

| Cursor | pi + herdr or Rex |
|---|---|
| `AskQuestion` | Ask in chat. Give numbered options and recommend one. |
| Image-generation tool (`teach`: a spatial idea, marker-on-whiteboard style) | Use `diagram-design`. Layout, rooms, sites, before and after: **Axonometric plan**. Parts of one object pulled apart: **Exploded axonometric**. Keep the build-up rule: one HTML file for each step. |
| todolist / todolist tool / `TodoWrite` | Keep a numbered checklist in your reply. Update it as each phase ends. |
| `~/.cursor/rules/pstack-models.mdc` | Not used. See Models. |
| `/setup-pstack` | Not used, and not loaded: `~/.pi/agent/settings.json` has `"skills": ["-skills/pstack/setup-pstack"]`. Edit the defaults at the top of `bin/pstack-agent` (this overlay). |
| Custom Mode, "Use as Mode", Option+Enter | Not available. `/skill:<name>` puts the skill into the session once. Start each new task with `/skill:poteto-mode`. |
| Plan Mode | Not available. Use the Multi-phase plan playbook, or `/skill:plannotator` to review a plan. |
| Cursor's built-in `babysit` skill | Not available. Use the poteto-mode Babysit playbook. |
| Bugbot, the agentic security review | Cursor's PR review bots. Triage their comments only when they are on the PR. When they are absent, run `/skill:interrogate` on the diff. |
| Transcripts `~/.cursor/projects/<slug>/agent-transcripts/` | `~/.pi/agent/sessions/<slug>/*.jsonl`. `<slug>` = cwd, each `/` changed to `-`, wrapped in `--`. Example: `/Users/me/proj` -> `--Users-me-proj--`. The active session file is `$PI_SESSION_FILE`. In herdr, `herdr pane list` (field `agent_session.value` for your pane `$HERDR_PANE_ID`) also gives it. |
| Transcript line shape | One JSON object per line. Chat lines have `"type":"message"`. The first line is `"type":"session"` with `cwd`. |
| `.cursor/skills/` (project) | `.pi/skills/` (project) or `~/.pi/agent/skills/` (user) |
| `.cursor/rules/` | `AGENTS.md` (project root or `~/.pi/agent/AGENTS.md`) |
| `~/.cursor/plugins/` | `~/.pi/agent/git/` (pi packages) |
| `~/Library/Application Support/Cursor` caches | `~/.pi/agent/sessions/` (old sessions), the herdr worktree folders, and `${TMPDIR:-/tmp}/pstack/` (run files) |
| `create-skill` (Cursor built-in) | Write `SKILL.md` by hand. Read pi `docs/skills.md` first. Frontmatter needs `name` and `description`. |
| `mcps/` directory, MCP discovery | Use the tools in your current pi tool list. pi has no MCP by default. Treat a missing MCP as a coverage gap, not as a skip. |
| `deslop` / `/deslop` (cursor-team-kit) | TS/JS: `/skill:slop-review`. Other languages: one pass by hand over the diff. Remove AI tells: extra comments, guards nobody needs, needless casts, and style that does not match the file. Prose: `/skill:unslop`. |
| `control-ui` (cursor-team-kit) | `/skill:agent-browser` |
| `control-cli` (cursor-team-kit) | herdr: run the CLI in a tab, then `herdr pane read` / `herdr pane wait-output`. Rex: `rex window new -s "$REX_SESSION" <name> --focus=false --keep-open --json -- <cli>`, then `rex capture -s "$REX_SESSION" -b <block> --trim`, `rex send`, `rex send-key` |
| Cursor dashboard, agent status | herdr: `herdr tab list --workspace $HERDR_WORKSPACE_ID`, `herdr pane read $(cat <dir>/pane) --source recent --lines 100`. Rex: `rex window ls -s "$REX_SESSION" --json`, `rex capture -s "$REX_SESSION" -b $(cat <dir>/block) --trim \| tail -n 100` |
| Cursor restart | pi, herdr, or Rex restart. A pi restart ends local subagents in that pane. A `herdr server stop`, a Rex server restart, or a reboot ends every tab. Reattach work by PR and branch, and by `<dir>/` files. |
| Cursor automations, `api2.cursor.sh` webhooks, Grok Bot | Not available. |
| `/<skill>` slash command | `/skill:<name>` |

## Paths and upstream links

| Upstream text | pi + herdr or Rex |
|---|---|
| `pstack/<path>` (repo path), `node pstack/...` | `$PSTACK/<path>` |
| `git show origin/main:pstack/<path>` | `cat $PSTACK/<path>`. Do not `git pull` the vendor copy in a run. The user updates it. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | Give the local path `$PSTACK/<path>`. Link upstream only for background, and say it is written for Cursor. |
| `docs/guide/*` | `$PSTACK/docs/guide/*`. Written for Cursor. Translate with this file. |
| `/add-plugin pstack`, Customize in the sidebar | Not used. pstack is on disk. Setup steps: overlay `SKILL.md`, poteto-help. |
| Frontmatter `mode`, `icon`, `color`, `reminder` | pi ignores them. |
| Frontmatter `paths: [<globs>]` (Cursor loads the skill when a file that matches is in use) | pi ignores `paths`. Do it by hand: before you read or edit a file that matches a glob, read that skill. Example: `typescript-best-practices` for `**/*.ts`, `**/*.tsx`. |
| `readonly` strips MCP | Not on pi. `readonly` removes only `edit` and `write`. MCP tools stay. |

## Upstream scripts that know Cursor

| Script | What to do |
|---|---|
| `$PSTACK/skills/poteto-mode/scripts/worktree-audit.sh` | Its "newest chat" column reads `~/.cursor/projects`, so on pi it is empty. For each worktree, a `haiku` subagent finds the newest pi session with `rg -l -F "<worktree path>" ~/.pi/agent/sessions \| xargs ls -t \| head -1`. In poteto-mode, the guard blocks the parent from reading transcripts. |

## Other herdr and Rex uses

- Dev server for verification:
  - herdr: `herdr tab create --workspace $HERDR_WORKSPACE_ID --label pstack:$HERDR_PANE_ID:server --no-focus`, then `herdr pane run <pane> "npm run dev"`, then `herdr pane wait-output <pane> --match "Ready" --timeout 60000`.
  - Rex: `rex window new -s "$REX_SESSION" "pstack:<ns>:server" -c "$PWD" --focus=false --keep-open --json -- npm run dev`. Save `.block_ids[0]`. Then wait for `Ready` with the capture loop in Loops and wakes.
  - Close it with `$A clean server`.
- Interactive agent that you must steer. Use this only when `pstack-agent` is not sufficient.
  - herdr: `herdr tab create ... --label pstack:$HERDR_PANE_ID:<label>`, `herdr pane run <pane> "zsh -ic <alias>"` (alias from Models), then `herdr agent prompt <pane> "<text>"` / `herdr agent wait <pane> --until done` / `herdr pane read <pane> --source recent --lines 200`.
  - Rex: `rex window new -s "$REX_SESSION" "pstack:<ns>:<label>" --focus=false --json -- zsh -ic <alias>`. Send text with `rex send -s "$REX_SESSION" -b <block> "<text>"` and `rex send-key -s "$REX_SESSION" -b <block> enter`. Read with `rex capture -s "$REX_SESSION" -b <block> --trim \| tail -n 200`.
