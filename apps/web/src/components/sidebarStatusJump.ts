import type { ThreadStatusJump } from "../keybindings";
import { resolveThreadLastVisitedAt, resolveThreadStatusPill } from "./Sidebar.logic";

type StatusJumpThread = Parameters<typeof resolveThreadStatusPill>[0]["thread"];

export function resolveThreadStatusJump(thread: StatusJumpThread): ThreadStatusJump | null {
  const pill = resolveThreadStatusPill({ thread });
  if (pill === null) return null;
  switch (pill.label) {
    case "Working":
    case "Connecting":
      return "working";
    case "Completed":
      return "done";
    case "Failed":
    case "Pending Approval":
    case "Awaiting Input":
    case "Guest Request":
    case "Waiting":
    case "Plan Ready":
      return null;
  }
}

export function resolveNextThreadWithStatus<T extends StatusJumpThread>(input: {
  threads: readonly T[];
  keyOf: (thread: T) => string;
  orderedThreadKeys: readonly string[];
  excludedThreadKeys: ReadonlySet<string>;
  currentThreadKey: string | null;
  status: ThreadStatusJump;
  localLastVisitedAtById: Readonly<Record<string, string>>;
}): T | null {
  const threadByKey = new Map(
    input.threads.flatMap((thread) => {
      const key = input.keyOf(thread);
      return input.excludedThreadKeys.has(key) ? [] : [[key, thread] as const];
    }),
  );
  const threadKeys = [...new Set([...input.orderedThreadKeys, ...threadByKey.keys()])];
  const currentIndex =
    input.currentThreadKey === null ? -1 : threadKeys.indexOf(input.currentThreadKey);
  for (let offset = 1; offset <= threadKeys.length; offset += 1) {
    const key = threadKeys[(currentIndex + offset) % threadKeys.length];
    if (key === undefined || key === input.currentThreadKey) continue;
    const thread = threadByKey.get(key);
    if (!thread) continue;
    const lastVisitedAt = resolveThreadLastVisitedAt(
      thread.lastVisitedAt,
      input.localLastVisitedAtById[key],
    );
    if (resolveThreadStatusJump({ ...thread, lastVisitedAt }) === input.status) return thread;
  }
  return null;
}
