---
name: pstack-pi
description: "Required overlay for every pstack skill on pi + herdr or Rex. Read this file in full before you use poteto-mode or any other pstack skill (how, why, interrogate, arena, architect, swarm, reflect, recall, ketchup, no-comments, tdd, figure-it-out, show-me-your-work, poteto-help, principle-*), and before you read a file under ~/.pi/agent/vendor/cursor-plugins/pstack. On a conflict, this overlay wins over the upstream pstack text."
---

# pstack on pi + herdr or Rex: overlay

Upstream pstack is in `$PSTACK` = `~/.pi/agent/vendor/cursor-plugins/pstack`. Do not edit files in `$PSTACK`. All local changes are in this overlay.

## Rules that apply to all pstack skills

1. Read `HARNESS.md` (next to this file) in full, one time per session, before the first pstack step. Read it again after a compaction.
2. **On a conflict, use this order: the user, then this file, then `HARNESS.md`, then the upstream pstack text.**
3. When an upstream file names a Cursor primitive (`Task`, `subagent_type`, `readonly`, `run_in_background`, a cloud agent, `AskQuestion`, a todolist or the todolist tool, `/loop`, `pstack-models.mdc`, a `claude-*`, `grok-*`, or `gemini-*` model slug (Fable included), `.cursor/`, `agent-transcripts/`, `create-skill`, `cursor-team-kit`, `mcps/`, Custom Mode, Plan Mode, Bugbot, a reasoning level or fast mode, the image-generation tool), use its equivalent in `HARNESS.md`.
4. A todolist is a numbered checklist in your reply.
5. A slash command in pstack is a pi skill command. `/how` means `/skill:how`.
6. Start every subagent with the `pstack_spawn` tool. Pass the run that it returns to `pstack_wait` (`HARNESS.md`, Subagents). `pstack-agent` picks the model by a fixed route (`HARNESS.md`, Models). Ignore every model slug, every model table, and every `pstack-models.mdc` line in the upstream files.
7. A subagent brief (`task`) must stand alone. When the subagent follows a pstack skill, set `skill`. Then the tool adds the lines that tell the subagent to read this file and that `SKILL.md`. With `role: "poteto-agent"`, the tool adds the line that tells the subagent to read this file, and the path of the poteto-mode `SKILL.md`. In a poteto-mode session, the tool also adds the `worker.md` line. The brief and this overlay win over `worker.md`.
8. A skill with `paths:` in its frontmatter loads by file type. See `HARNESS.md`, Paths and upstream links.
9. Do not use `setup-pstack` or `make-bot-ui`. They need Cursor. Ignore the upstream `# defaults: 2` check and every request to rerun `/setup-pstack`.
10. After each edit to this overlay, `bin/pstack-agent`, or `pstack-guard.ts`, run `pstack-agent smoke <skill>` for each skill that the edit changes. Do not give the test to the user.

## Update from upstream

`~/.pi/agent/skills/pstack` is a symlink into the vendor checkout, so a pull changes the live skills at once.

1. Run `pstack-agent upstream-check`. It fetches and lists each overlay line that the incoming change makes stale.
2. Show the user a table of the overlay edits. Get approval.
3. In the same turn: `git -C ~/.pi/agent/vendor/cursor-plugins pull`, edit the overlay, and change the pin in `~/.pi/agent/skills/pstack-pi/UPSTREAM`.
4. Run `pstack-agent upstream-check` again. It must print PASS. Then run `smoke` for each changed skill.

## Skill overrides

Each entry replaces the named part of the upstream skill. The other parts of the upstream skill stay in force.

### poteto-mode

- **Delegation.** The parent runs the playbook and does not do the step work. Start a subagent with `pstack_spawn` for each step that reads or searches code, reproduces a bug, runs commands with long output, writes code, or verifies. This replaces "Reproduce it yourself" in Bug fix step 1. The parent keeps only the goal, the plan, the briefs, the reports, and its own review. To review, read `git diff --stat`, then only the hunks you must check. Exception: a fully specified one-line edit.
- **Guard.** `~/.pi/agent/extensions/pstack-guard.ts` enforces the Delegation and Models rules, and it blocks transcript reads in the parent. It starts when the session receives `/skill:poteto-mode`. `/skill:reflect` starts only the transcript block. In T3 Code, a `$poteto-mode` or `$reflect` mention starts it too. When a call is blocked, delegate the step. Do not try a different tool to get the same result. Subagents are not guarded. Only the user can switch it off (`/pstack-guard off`).
- **Subagents section.** Replace the `subagent_type: "poteto-agent"` paragraph and the "Defaults for every `Task` call" paragraph with this text: Start every subagent with `pstack_spawn`. Inside a playbook step (code-writing delegates, ad-hoc helpers), set `role: "poteto-agent"`. The session that receives `/skill:poteto-mode` runs the playbook. Never spawn a poteto-agent subagent to run the playbook. Routed workflow skills (`how`, `why`, `interrogate`, `reflect`, `swarm`) write their own briefs. `pstack_spawn` returns at once, and `pstack_wait` collects. Give file pointers, not inlined context. A writer gets its own git worktree (`cwd`).
- **Models.** The parent runs on `opus`. Every subagent starts on `haiku`, for every skill and seat, except `interrogate` (its own table). The route is fixed in `pstack-agent` (`HARNESS.md`, Models).
- **Escalation.** The parent is the watcher. Before it accepts a result, it checks the report, `git diff --stat`, the hunks it must check, and for code one test or check command. If the result is wrong, weak, or misses the brief, spawn the same label again with `escalate: true` and the consolidated scope. The route goes `haiku`, then `sonnet`, then `sol`. A failed wait escalates the next spawn of the label by itself. After `sol`, the spawn is refused: the parent takes the task back and decides the next step. Say each escalation in the reply.
- **Second opinion.** A second opinion is the same prompt again with a different angle in the brief. Agreement is high-signal.
- **Fresh subagents by default.** Replace that paragraph with this rule: Use `pstack_resume` for a fix round, a follow-up question, or one more check on the subagent's own work, in the same scope. Resume only after `pstack_wait` returned. Put every open directive in the resume text. Give new work to a fresh subagent with consolidated scope: the original brief, every later directive, and the prior report and branch. New work is a new scope, the next queue item, or the third fix round. A retry after a wrong root cause or design is a spawn of the same label with `escalate: true`. Full rules: `HARNESS.md`, Reuse a subagent.
- **Mode.** pi has no Custom Modes. The skill applies one time. Start each new task with `/skill:poteto-mode`.

### how

- Always spawn the subagent, also for a simple question. Do not explore or answer inline. Brief, wait, and present.
- Explainer: `pstack_spawn` with label `how-explainer`, `skill: "how"`, `readonly`. The task is the user's question. There are no explorers.
- Send a follow-up on the same subsystem with `pstack_resume` to `how-explainer`. Run `pstack-agent clean` only when the user moves on.

### why

- Upstream `why` answers inline. On pi, do not research inline. Spawn one subagent, wait, and present its answer.
- Investigator: `pstack_spawn` with label `why-investigator`, `skill: "why"`, `readonly`. The task is the user's question and the target. There are no category investigators and no synthesizer.
- Send a follow-up on the same target with `pstack_resume` to `why-investigator`. Run `pstack-agent clean` only when the user moves on.
- `readonly` is correct here. On pi it does not remove MCP tools.
- MCP discovery: use the evidence tools in your pi tool list (MCP tools, `gh`, `sentry-cli`, `psql`). Subagents get the same tools.

### interrogate

Upstream `interrogate` now runs adversaries through arena Phase A steps 3 and 4 and Phase B. In place of the `interrogate reviewers` line, use this table:

| Adversary | Label | Model | Lead angle (one line in its brief) |
|---|---|---|---|
| A | `interrogate-a` | `opus` | correctness and edge cases |
| B | `interrogate-b` | `opus` | security, data safety, failure modes |
| C | `interrogate-c` | `opus` | design and simpler alternatives, proven by a run |
| D | `interrogate-d` | `sol` | cross-model check: correctness and security failures the other adversaries can miss |

1. Give each adversary its own worktree: `git worktree add /tmp/interrogate-<slug>/<label> HEAD`, then copy the uncommitted changes of the scope into it. Set `cwd` to the worktree. Do not set `readonly`, because adversaries write repros in their worktree.
2. Call `pstack_spawn` four times in one message, with the model from the table. In the next message, call `pstack_wait` with the four runs.
3. If D fails because Aperture or Sol is not available, continue with A, B, and C, and say so in the output.
4. The angle only tells the adversary where to look first. The upstream brief stays in force: a finding needs a run.
5. In the output, write each adversary as `Adversary [label]: [model] ([angle])`. Write "single model family" only when D did not run.
6. Remove the worktrees after Verify.

Go diffs: when the diff changes `.go` files, read `extras/interrogate/go-lens.md` before Fan out and run its checks. Add a `## Go Lens` section to each adversary brief, after the upstream brief, with the `## Go Checks` output and the row for that adversary. Add a `### Go Checks` section to the output, after Findings, with the summary table from the script.

### architect

- Upstream `architect` sketches two shapes alone, with no runners. Do it in one subagent. For a large or contested design, run `arena` as upstream says.

### arena

- Runners: N = 3 by default. Give each runner a different design direction in its brief, so the candidates differ.
- Each candidate gets its own worktree: `git worktree add /tmp/arena-<slug>/candidate-<n>`. Spawn `arena-<n>` with `cwd` set to that worktree.
- Cross-judge: the judge must not be from the parent's family. The route starts every seat on `haiku`, so the judge is from the parent's family. Spawn `arena-judge` with `readonly` and report "single model family". Tell the judge to score only against the rubric.

### swarm

- Workers run local, one herdr tab or Rex window each. Keep N at 6 or less, unless the user asks for more.
- Workers start on `haiku`. A model race is not available: the route picks the model.
- A worker that writes gets its own git worktree (`cwd`). For a non-default branch: `git worktree add <path> <branch>`.

### reflect

- Upstream `reflect` is one pass. On pi, always spawn one subagent. Never reflect inline, also for a short session. Call `pstack_spawn` with label `reflect`, `skill: "reflect"`, no `readonly`, and the task "Reflect on the transcript." The tool adds the transcript path. The guard blocks transcript reads in the parent. Wait, then present its Accepted, Rejected, and Backlog lists.
- Skill used (for the subagent): a skill counts as used when the transcript shows a read of its `SKILL.md` (under `.pi/skills/`, `.agents/skills/`, `~/.pi/agent/skills/`, `~/.agents/skills/`, `~/.pi/agent/git/`, or `$PSTACK`), a `pstack_spawn` with that `skill`, a `pstack-agent spawn` brief or a `/skill:<name>` command that names it, or a tool call that matches its commands.
- `create-skill` routing: a substantive edit is a draft that you show to the user as a diff, then apply. A description tune is a new `description` that you show to the user. A new skill is `~/.pi/agent/skills/<kebab-name>/SKILL.md` per pi `docs/skills.md`.
- Upstream `plugins/cache/` and `.cursor/skills/` rule: never edit a skill under `$PSTACK` or `~/.pi/agent/git/`. To change a pstack skill, add an override to this overlay. For other skills, copy the folder to `.pi/skills/<skill>/` or `~/.pi/agent/skills/<skill>/`, show that path before approval, and edit the copy.

### recall

- Fan-out subagents: `pstack_spawn` with label `recall-<n>` and `readonly`.

### no-comments

- Comment Sicko: `pstack_spawn` with label `comment-sicko`, `role: "comment-sicko"`, and the scope as the task. Then `pstack_wait`.

### ketchup

- Also check each `pstack:*` herdr tab or Rex window of this session.
- Visuals: a table or an ASCII diagram. For a larger visual, write an HTML file and give its path.

### ketchup-video

- Render the video with `ffmpeg` in `${TMPDIR:-/tmp}/ketchup-video/`. pi cannot embed a video. Give the file path in place of the embedded video.

### poteto-help

- Give local paths under `$PSTACK` and this overlay, not GitHub links.
- Setup on pi: no plugin install and no `/setup-pstack`. Start `herdr` or Rex. In a herdr pane or a Rex terminal, `cd` to the repo and run `piopus55aperture` or `piopus55copilot`. Then start a task with `/skill:poteto-mode`.
- If `HERDR_ENV` is not `1`, `REX_SESSION` is not set, and `T3CODE_CLI_PATH` is not set, subagents run as hidden background processes. Tell the user to start pi inside herdr, Rex, or T3 Code. In T3 Code, each subagent is a T3 thread (`HARNESS.md`, T3 Code).
- Cost: ask for fewer seats, and use `pstack_resume` for follow-ups.

### Playbooks that delete, ship, or run for a long time

- Autopilot-full, Autopilot-stack, Shipping: one subagent per PR owner or verifier, each in its own herdr tab or Rex window and git worktree. There are no cloud agents. Run restacks one at a time.
- Verifiers: a verifier is a separate subagent from its worker. Its brief does not include the worker's reasoning. It starts on `haiku`, like every subagent. pi has no PR or CI event subscriptions: watch each PR as `HARNESS.md`, Loops, says. Probe liveness read-only with `herdr pane read <pane> --source recent` in herdr, or `rex capture -s "$REX_SESSION" -b <block> --trim | tail -n 100` in Rex. Never resume an agent to check on it.
- An hourly tick is a tick tab (`HARNESS.md`, Loops). Re-read the playbook from `$PSTACK` at each tick.
- Worktree cleanup: transcript checks use `readonly`. See `HARNESS.md`, Upstream scripts, for the empty chat column.
