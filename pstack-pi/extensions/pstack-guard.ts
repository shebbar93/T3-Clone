import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  type ExtensionAPI,
  type ExtensionContext,
  isToolCallEventType,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { Value } from "typebox/value";

const ENTRY = "pstack-guard";
const AGENT_DIR = path.join(os.homedir(), ".pi", "agent");
const AGENT = path.join(AGENT_DIR, "skills", "pstack-pi", "overlay", "bin", "pstack-agent");
const SESSIONS = path.join(AGENT_DIR, "sessions");
const BRIEFS = path.join(os.tmpdir(), "pstack-briefs");
const SUBAGENT_PREFIX = "You are a pstack subagent";
const READ_LIMIT = 60;
const TEXT_EXTENSIONS = [".md", ".mdx", ".txt"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const EDITABLE = new Set(TEXT_EXTENSIONS);
const READABLE = new Set([...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS]);
const FREE_ROOTS = [...new Set(["/tmp", "/private/tmp", os.tmpdir(), fs.realpathSync(os.tmpdir()), path.join(os.homedir(), ".pi")])];
const SHELL_FREE_HINTS = ["\\$\\{?TMPDIR", "\\$\\{?PSTACK", "pstack", "\\.pi/"];
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FREE_BASH_HINT = new RegExp(
  [
    ...FREE_ROOTS.map((root) => `${escapeRegExp(root)}(?![\\w.-])`),
    ...TEXT_EXTENSIONS.map((extension) => `${escapeRegExp(extension)}\\b`),
    ...SHELL_FREE_HINTS,
  ].join("|"),
);
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g;
const QUOTED = /"(?:[^"\\]|\\[\s\S])*"|'[^']*'/g;
const EXPLORE = new Set(["rg", "grep", "ast-grep", "sg", "fd", "find", "sed", "awk", "cat", "head", "tail", "less", "bat"]);
const RUNNERS = new Set(["vp", "vpr", "npm", "pnpm", "yarn", "bun", "bunx", "npx", "node", "go", "cargo", "make", "pytest", "vitest", "jest", "tsc"]);
const AGENT_CLI = /(?:pstack-agent|\$\{?A\}?)\s+(spawn|wait|resume)\b/;
const TRANSCRIPT_TEXT = /\.pi\/agent\/sessions|\bPI_SESSION_FILE\b|\.jsonl\b/;

const LABEL_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*$";
const RUN_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*@[0-9a-f-]+$";
const RUN_LINE = /^run: (\S+@\S+)$/m;
const ROLES = ["poteto-agent", "comment-sicko"] as const;

const DELEGATE_HELP = `pstack-guard: the poteto-mode parent must delegate this step. Call pstack_spawn, then pstack_wait. The parent can still run git, gh, and pstack-agent clean, and make a one-line edit. It can read ${TEXT_EXTENSIONS.join(", ")} and image files, and ranges of up to ${READ_LIMIT} lines. Only the user can switch the guard off, with /pstack-guard off.`;
const TOOL_HELP = "pstack-guard: use the pstack_spawn, pstack_wait, and pstack_resume tools. They add the run id that stops a wait from returning an old result.";
const TRANSCRIPT_HELP = "pstack-guard: in a reflect session, the parent must not read a transcript. Call pstack_spawn with skill \"reflect\". The tool gives the transcript path to the subagent.";

type Flag = "delegate" | "workerBrief" | "hideTranscripts";

const POLICIES = {
  "poteto-mode": new Set<Flag>(["delegate", "workerBrief", "hideTranscripts"]),
  reflect: new Set<Flag>(["hideTranscripts"]),
} satisfies Record<string, ReadonlySet<Flag>>;

type GuardedSkill = keyof typeof POLICIES;

const isGuardedSkill = (name: string): name is GuardedSkill => Object.hasOwn(POLICIES, name);

const StoredSchema = Type.Union([Type.Object({ skills: Type.Array(Type.String()) }), Type.Object({ on: Type.Boolean() })]);

function storedSkills(stored: Static<typeof StoredSchema>): GuardedSkill[] {
  if ("skills" in stored) return stored.skills.filter(isGuardedSkill);
  return stored.on ? ["poteto-mode"] : [];
}

function triggeredSkills(text: string) {
  const names = [
    ...[...text.matchAll(/^\/skill:([a-z0-9-]+)(?=\s|$)/g)].map((match) => match[1] ?? ""),
    ...[...text.matchAll(/(?:^|\s)\$([a-z0-9-]+)(?=\s|$)/g)].map((match) => match[1] ?? ""),
    ...[...text.matchAll(/<skill name="([^"]+)"/g)].flatMap((match) => (match[1] ?? "").split(",")),
  ];
  return names.map((name) => name.trim()).filter(isGuardedSkill);
}

const exempt = () => process.env.PSTACK_GUARD === "0" || (process.env.PSTACK_NS ?? "").includes(".");

function resolvePath({ cwd, raw }: { cwd: string; raw: string }) {
  const bare = raw.replace(/^@/, "");
  const expanded = bare === "~" || bare.startsWith("~/") ? path.join(os.homedir(), bare.slice(1)) : bare;
  return path.resolve(cwd, expanded);
}

const under = ({ root, target }: { root: string; target: string }) =>
  target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
const isFree = (target: string) => FREE_ROOTS.some((root) => under({ root, target }));
const isTranscript = (target: string) => under({ root: SESSIONS, target }) || path.extname(target).toLowerCase() === ".jsonl";

function commandSegments(command: string) {
  const body = command.replace(HEREDOC, "").replace(QUOTED, (quoted) => quoted.replace(/[;&|\n]/g, " "));
  return body.split(/&&|\|\||;|\n/).map((segment) => {
    const words = segment.trim().replace(/^(?:\w+=\S*\s+)+/, "").split(/\s+/);
    return { segment, first: path.basename(words[0] ?? ""), second: words[1] };
  });
}

function delegateViolation(command: string) {
  for (const { segment, first, second } of commandSegments(command)) {
    if (first === "git" && second === "grep") return "git grep";
    if (RUNNERS.has(first)) return first;
    if (EXPLORE.has(first) && !FREE_BASH_HINT.test(segment)) return first;
  }
  return undefined;
}

const agentCliViolation = (command: string) =>
  commandSegments(command).find(({ segment }) => AGENT_CLI.test(segment))?.segment.trim();

const transcriptViolation = (command: string) =>
  commandSegments(command).find(({ segment, first }) => first !== "pstack-agent" && TRANSCRIPT_TEXT.test(segment))?.segment.trim();

type Verdict = { readonly block: true; readonly reason: string };

const block = ({ what, help }: { what: string; help: string }): Verdict => ({ block: true, reason: `Blocked: ${what}. ${help}` });

function locate({ cwd, raw }: { cwd: string; raw: string }) {
  const target = resolvePath({ cwd, raw });
  return { target, extension: path.extname(target).toLowerCase(), free: isFree(target) };
}

function checkBash({ command, rules }: { command: string; rules: ReadonlySet<Flag> }) {
  const cli = agentCliViolation(command);
  if (cli !== undefined) return block({ what: `\`${cli}\` in bash`, help: TOOL_HELP });
  const transcript = rules.has("hideTranscripts") ? transcriptViolation(command) : undefined;
  if (transcript !== undefined) return block({ what: `\`${transcript}\` in bash`, help: TRANSCRIPT_HELP });
  const hit = rules.has("delegate") ? delegateViolation(command) : undefined;
  return hit === undefined ? undefined : block({ what: `\`${hit}\` in bash`, help: DELEGATE_HELP });
}

const isSmallRead = (limit: number | undefined) => (limit ?? Infinity) <= READ_LIMIT;

function checkRead({ raw, limit, cwd, rules }: { raw: string; limit: number | undefined; cwd: string; rules: ReadonlySet<Flag> }) {
  const { target, extension, free } = locate({ cwd, raw });
  if (rules.has("hideTranscripts") && isTranscript(target)) return block({ what: `read of ${target}`, help: TRANSCRIPT_HELP });
  if (!rules.has("delegate")) return undefined;
  const allowed = free || !under({ root: cwd, target }) || READABLE.has(extension) || isSmallRead(limit);
  return allowed ? undefined : block({ what: `read of ${target} without a limit of ${READ_LIMIT} lines or less`, help: DELEGATE_HELP });
}

function checkEdit({ raw, edits, cwd }: { raw: string; edits: readonly { oldText: string; newText: string }[]; cwd: string }) {
  const { target, extension, free } = locate({ cwd, raw });
  if (free || EDITABLE.has(extension)) return undefined;
  const [only, ...rest] = edits;
  const oneLine = only !== undefined && rest.length === 0 && !`${only.oldText}${only.newText}`.includes("\n");
  return oneLine ? undefined : block({ what: `edit of ${target}`, help: DELEGATE_HELP });
}

function checkWrite({ raw, cwd }: { raw: string; cwd: string }) {
  const { target, extension, free } = locate({ cwd, raw });
  return free || EDITABLE.has(extension) ? undefined : block({ what: `write of ${target}`, help: DELEGATE_HELP });
}

function sessionEnv(ctx: ExtensionContext): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PI_SESSION_ID: ctx.sessionManager.getSessionId(),
    PI_SESSION_FILE: ctx.sessionManager.getSessionFile() ?? "",
    PI_PROVIDER: ctx.model?.provider ?? "",
  };
}

type TextBlock = { type: "text"; text: string };

const textBlock = (text: string): TextBlock => ({ type: "text", text });

type AgentResult = { readonly code: number; readonly stdout: string; readonly stderr: string };

function runAgent({ args, ctx, signal }: { args: readonly string[]; ctx: ExtensionContext; signal: AbortSignal | undefined }) {
  return new Promise<AgentResult>((resolve, reject) => {
    const child = spawn(AGENT, args, { cwd: ctx.cwd, env: sessionEnv(ctx), signal, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function startedRun(result: AgentResult) {
  if (result.code !== 0) throw new Error((result.stderr || result.stdout).trim() || `pstack-agent exit ${result.code}`);
  const run = RUN_LINE.exec(result.stdout)?.[1];
  if (run === undefined) throw new Error(`pstack-agent printed no run line:\n${result.stdout}`);
  return { content: [textBlock(`${result.stdout.trim()}\nPass "${run}" to pstack_wait.`)], details: { run } };
}

const SpawnParams = Type.Object({
  label: Type.String({ pattern: LABEL_PATTERN, description: "Subagent label. A new spawn with the same label replaces the old subagent." }),
  escalate: Type.Optional(
    Type.Boolean({
      description:
        "The route picks the model: haiku, then sonnet, then sol. Set true to run this label one step up after a weak or wrong result. A failed wait escalates the next spawn of the label by itself.",
    }),
  ),
  task: Type.String({ minLength: 1, description: "The brief. It must stand alone: the subagent does not see this chat. Give file paths, not copied file text." }),
  skill: Type.Optional(Type.String({ pattern: "^[a-z0-9-]+$", description: "Name of the pstack skill that the subagent follows, for example reflect." })),
  role: Type.Optional(Type.Enum(ROLES, { description: "Upstream agent body to put in front of the brief." })),
  readonly: Type.Optional(Type.Boolean({ description: "Remove the edit and write tools. In T3 Code this is only an instruction in the brief." })),
  cwd: Type.Optional(Type.String({ description: "Working directory, for example a git worktree." })),
});

function spawnArgs({ params, brief, cwd, worker }: { params: Static<typeof SpawnParams>; brief: string; cwd: string; worker: boolean }) {
  return [
    "spawn",
    params.label,
    brief,
    ...(params.escalate === true ? ["--escalate"] : []),
    ...(params.readonly === true ? ["--readonly"] : []),
    ...(params.cwd === undefined ? [] : ["--cwd", resolvePath({ cwd, raw: params.cwd })]),
    ...(params.skill === undefined ? [] : ["--skill", params.skill]),
    ...(params.role === undefined ? [] : ["--role", params.role]),
    ...(worker ? ["--worker"] : []),
  ];
}

export default function (pi: ExtensionAPI) {
  let active = new Set<GuardedSkill>();

  const show = (ctx: ExtensionContext) => {
    if (ctx.hasUI) ctx.ui.setStatus(ENTRY, active.size > 0 ? `${ENTRY}: ${[...active].join(", ")}` : undefined);
  };

  const set = ({ skills, ctx }: { skills: ReadonlySet<GuardedSkill>; ctx: ExtensionContext }) => {
    const changed = skills.size !== active.size || [...skills].some((skill) => !active.has(skill));
    active = new Set(skills);
    if (changed) pi.appendEntry(ENTRY, { skills: [...active] });
    show(ctx);
  };

  const restore = (ctx: ExtensionContext) => {
    active = new Set();
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === ENTRY && Value.Check(StoredSchema, entry.data)) {
        active = new Set(storedSkills(entry.data));
      }
    }
    show(ctx);
  };

  const policy = (): ReadonlySet<Flag> => (exempt() ? new Set<Flag>() : new Set([...active].flatMap((skill) => [...POLICIES[skill]])));

  pi.on("session_start", async (_event, ctx) => restore(ctx));
  pi.on("session_tree", async (_event, ctx) => restore(ctx));

  pi.on("input", async (event, ctx) => {
    if (exempt() || event.source === "extension") return;
    if (event.text.startsWith(SUBAGENT_PREFIX)) return;
    const triggered = triggeredSkills(event.text);
    if (triggered.length > 0) set({ skills: new Set([...active, ...triggered]), ctx });
  });

  const turnOn = ({ skill, ctx }: { skill: string; ctx: ExtensionContext }) => {
    if (isGuardedSkill(skill)) set({ skills: new Set([...active, skill]), ctx });
    else if (ctx.hasUI) ctx.ui.notify(`${ENTRY}: no policy for '${skill}'`, "error");
  };

  pi.registerCommand(ENTRY, {
    description: `pstack guard: on [${Object.keys(POLICIES).join(" | ")}] | off | status`,
    handler: async (args, ctx) => {
      const [action, skill = "poteto-mode"] = args.trim().split(/\s+/);
      if (action === "off") set({ skills: new Set(), ctx });
      if (action === "on") turnOn({ skill, ctx });
      if (ctx.hasUI) ctx.ui.notify(`${ENTRY}: ${active.size > 0 ? [...active].join(", ") : "off"}`, "info");
    },
  });

  pi.registerTool({
    name: "pstack_spawn",
    label: "pstack spawn",
    description:
      "Start one pstack subagent in its own herdr tab, Rex window, T3 Code thread, or background process. Returns a run id for pstack_wait. When skill is set, the brief tells the subagent to read the pstack-pi overlay and that skill's SKILL.md first. With skill reflect, the tool adds the path of this session's transcript.",
    promptSnippet: "Start a pstack subagent with a stand-alone brief and get its run id",
    promptGuidelines: [
      "Use pstack_spawn, pstack_wait, and pstack_resume for pstack subagents. Do not run pstack-agent spawn, wait, or resume in bash.",
      "Pass the run that pstack_spawn or pstack_resume returns to pstack_wait. Do not call pstack_wait in the same message as the pstack_spawn that it waits for.",
    ],
    parameters: SpawnParams,
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const rules = policy();
      await fs.promises.mkdir(BRIEFS, { recursive: true });
      const brief = path.join(BRIEFS, `${params.label}-${toolCallId.replace(/[^\w-]/g, "-")}.md`);
      await fs.promises.writeFile(brief, `${params.task.trim()}\n`);
      const args = spawnArgs({ params, brief, cwd: ctx.cwd, worker: rules.has("workerBrief") });
      return startedRun(await runAgent({ args, ctx, signal }));
    },
  });

  pi.registerTool({
    name: "pstack_wait",
    label: "pstack wait",
    description:
      "Block until each pstack subagent run ends, then return each result. A run is the label@id that pstack_spawn or pstack_resume returned. A run that a later spawn, resume, or clean replaced fails at once and never returns old output.",
    promptSnippet: "Wait for pstack subagent runs and return their results",
    parameters: Type.Object({
      runs: Type.Array(Type.String({ pattern: RUN_PATTERN }), { minItems: 1, description: "Runs from pstack_spawn or pstack_resume." }),
      timeoutSeconds: Type.Optional(Type.Integer({ minimum: 1, description: "Default 3600." })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const timeout = params.timeoutSeconds === undefined ? [] : ["--timeout", String(params.timeoutSeconds)];
      const results = await Promise.all(params.runs.map((run) => runAgent({ args: ["wait", run, ...timeout], ctx, signal })));
      const share = { maxLines: Math.floor(DEFAULT_MAX_LINES / results.length), maxBytes: Math.floor(DEFAULT_MAX_BYTES / results.length) };
      const text = results
        .map((result) => {
          const output = truncateHead(`${result.stdout}${result.stderr}`, share);
          return output.truncated ? `${output.content}\n[Truncated. The full result is in the out.md path in the header.]` : output.content;
        })
        .join("\n");
      return { content: [textBlock(text)], details: { exitCodes: results.map((result) => result.code) }, isError: results.some((result) => result.code !== 0) };
    },
  });

  pi.registerTool({
    name: "pstack_resume",
    label: "pstack resume",
    description:
      "Send a follow-up to a pstack subagent after pstack_wait returned its result. Same tab, session, and model. Returns a new run for pstack_wait. Put every open directive in the text.",
    promptSnippet: "Send a follow-up to a finished pstack subagent and get a new run id",
    parameters: Type.Object({
      label: Type.String({ pattern: LABEL_PATTERN }),
      text: Type.String({ minLength: 1 }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      return startedRun(await runAgent({ args: ["resume", params.label, params.text], ctx, signal }));
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (active.size === 0 || exempt()) return undefined;
    const rules = policy();
    if (isToolCallEventType("bash", event)) return checkBash({ command: event.input.command, rules });
    if (isToolCallEventType("read", event)) return checkRead({ raw: event.input.path, limit: event.input.limit, cwd: ctx.cwd, rules });
    if (!rules.has("delegate")) return undefined;
    if (isToolCallEventType("edit", event)) return checkEdit({ raw: event.input.path, edits: event.input.edits, cwd: ctx.cwd });
    if (isToolCallEventType("write", event)) return checkWrite({ raw: event.input.path, cwd: ctx.cwd });
    return undefined;
  });
}
