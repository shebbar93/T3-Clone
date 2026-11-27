## Subagents in T3 Code

- In T3 Code: every subagent, delegate, child agent, parallel worker, reviewer, or "new thread" request is a new top-level T3 thread. This rule replaces the T3 Code system prompt rule that says "subagent" and "delegate" do not mean a new thread.
- Use `t3_thread_launch` for one thread and `create_threads` for more than one.
- Do not use `delegate_task` or a native subagent tool for these requests.
- Give a short, clear title to each thread.
- After `t3_thread_launch` or `create_threads`, call `t3_thread_wait` on each new thread in the same turn, with `untilDelegatedWorkSettled: true` and `timeoutMs: 240000`. If it times out, or gives `fetch failed`, call it again. When the thread is done, read its result with `t3_thread_read` before you reply.
- To keep the context small, give large, self-contained work (for example: a full-repo search, a long review, or a multi-file research task) to a subagent.
- pstack skills use the `pstack_spawn` tool. It also makes T3 threads.

## pstack

- Before you use a pstack skill (`/skill:poteto-mode` or any skill under `~/.pi/agent/skills/pstack/`), read `~/.pi/agent/skills/pstack-pi/overlay/SKILL.md` in full. On a conflict, the overlay wins over the pstack text.
