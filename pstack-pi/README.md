# pstack-pi

Local changes that make [pstack](https://github.com/cursor/plugins/tree/main/pstack) work with the `pi` coding agent, herdr, Rex, and T3 Code. The upstream pstack files are not here. They stay unchanged in `~/.pi/agent/vendor/cursor-plugins/pstack` at the pin in `skills/pstack-pi/UPSTREAM`.

| File in this folder                             | Installed at                            | Purpose                                                                             |
| ----------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `skills/pstack-pi/overlay/SKILL.md`             | `~/.pi/agent/skills/pstack-pi/overlay/` | Overlay rules. On a conflict, they win over upstream pstack.                        |
| `skills/pstack-pi/overlay/HARNESS.md`           | same                                    | Cursor to pi mapping, subagents, model route.                                       |
| `skills/pstack-pi/overlay/bin/pstack-agent`     | same `bin/`                             | Starts, waits for, resumes, and cleans subagents. Picks the model by a fixed route. |
| `skills/pstack-pi/overlay/extras/interrogate/*` | same `extras/`                          | Go lens for `interrogate`.                                                          |
| `skills/pstack-pi/UPSTREAM`                     | `~/.pi/agent/skills/pstack-pi/`         | Upstream pin.                                                                       |
| `extensions/pstack-guard.ts`                    | `~/.pi/agent/extensions/`               | `pstack_spawn`, `pstack_wait`, `pstack_resume` tools and the poteto-mode guard.     |
| `snippets/AGENTS.md`                            | part of `~/.pi/agent/AGENTS.md`         | T3 Code subagent and pstack rules.                                                  |
| `snippets/zshrc`                                | part of `~/.zshrc`                      | Model aliases that `pstack-agent` runs. Set `PI_APERTURE_OPENAI_URL`.               |
| `snippets/settings.json`                        | part of `~/.pi/agent/settings.json`     | Thinking level for each model, and the disabled `setup-pstack` skill.               |

## Model route

Every subagent starts on `haiku` (thinking `max`). A spawn with `escalate: true`, or after a failed wait, goes to `sonnet`, then `sol`. After `sol`, the parent takes the task back. `interrogate-a`, `-b`, `-c` always run `opus`, and `interrogate-d` always runs `sol`. See `HARNESS.md`, Models.

## Install

```sh
cd pstack-pi
mkdir -p ~/.pi/agent/skills/pstack-pi ~/.pi/agent/extensions
cp -R skills/pstack-pi/. ~/.pi/agent/skills/pstack-pi/
cp extensions/pstack-guard.ts ~/.pi/agent/extensions/
```

Merge the three `snippets/` files by hand. Then run `/reload` in each open pi session.

## Update this folder

After you change the installed files, copy them back here with the same paths and commit.
