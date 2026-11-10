import { ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { resolveNextThreadWithStatus, resolveThreadStatusJump } from "./sidebarStatusJump";

const COMPLETED_AT = "2026-03-09T10:05:00.000Z";
const BEFORE_COMPLETION = "2026-03-09T10:04:00.000Z";
const AFTER_COMPLETION = "2026-03-09T10:06:00.000Z";

function runtimeWith(status: "preparing" | "running" | "completed") {
  return {
    status,
    activeRunId: null,
    providerInstanceId: ProviderInstanceId.make("codex"),
    providerName: "Codex",
    lastError: null,
    updatedAt: "2026-03-09T10:00:00.000Z",
  };
}

const finishedThread = {
  hasActionableProposedPlan: false,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  interactionMode: "default" as const,
  latestRun: {
    runId: "turn-1" as never,
    status: "completed" as const,
    assistantMessageId: null,
    requestedAt: "2026-03-09T10:00:00.000Z",
    startedAt: "2026-03-09T10:00:00.000Z",
    completedAt: COMPLETED_AT,
  },
  lastVisitedAt: BEFORE_COMPLETION,
  runtime: runtimeWith("completed"),
};

describe("resolveThreadStatusJump", () => {
  it.each([
    {
      name: "a preparing thread",
      thread: { ...finishedThread, runtime: runtimeWith("preparing") },
      expected: "working",
    },
    {
      name: "a running thread",
      thread: { ...finishedThread, runtime: runtimeWith("running") },
      expected: "working",
    },
    {
      name: "a running thread that waits on another thread",
      thread: { ...finishedThread, runtime: runtimeWith("running"), blockedOnThreadWait: true },
      expected: null,
    },
    {
      name: "a finished thread not seen since it finished",
      thread: finishedThread,
      expected: "done",
    },
    {
      name: "a finished thread seen after it finished",
      thread: { ...finishedThread, lastVisitedAt: AFTER_COMPLETION },
      expected: null,
    },
    {
      name: "a finished thread that waits for approval",
      thread: { ...finishedThread, hasPendingApprovals: true },
      expected: null,
    },
    {
      name: "a finished thread whose background task holds completion",
      thread: {
        ...finishedThread,
        pendingBackgroundTasks: [
          { taskId: "bg-1", description: "Run subagent", kind: "subagent", awaited: true },
        ],
      },
      expected: null,
    },
    {
      name: "a finished plan thread with an actionable plan",
      thread: { ...finishedThread, interactionMode: "plan", hasActionableProposedPlan: true },
      expected: null,
    },
  ] as const)("gives $expected for $name", ({ thread, expected }) => {
    expect(resolveThreadStatusJump(thread)).toBe(expected);
  });
});

describe("resolveNextThreadWithStatus", () => {
  const working = (key: string) => ({ key, ...finishedThread, runtime: runtimeWith("running") });
  const done = (key: string) => ({ key, ...finishedThread });
  const seen = (key: string) => ({ key, ...finishedThread, lastVisitedAt: AFTER_COMPLETION });
  const threads = [working("a"), done("b"), seen("c"), working("d"), done("e")];
  const next = (overrides: {
    currentThreadKey: string | null;
    status: "working" | "done";
    orderedThreadKeys?: readonly string[];
    excludedThreadKeys?: ReadonlySet<string>;
  }) =>
    resolveNextThreadWithStatus({
      threads,
      keyOf: (thread) => thread.key,
      orderedThreadKeys: ["a", "b", "c", "d", "e"],
      excludedThreadKeys: new Set(),
      localLastVisitedAtById: {},
      ...overrides,
    })?.key ?? null;

  it.each([
    { currentThreadKey: "a", status: "working", expected: "d" },
    { currentThreadKey: "d", status: "working", expected: "a" },
    { currentThreadKey: "c", status: "done", expected: "e" },
    { currentThreadKey: "e", status: "done", expected: "b" },
    { currentThreadKey: null, status: "done", expected: "b" },
    { currentThreadKey: "missing", status: "working", expected: "a" },
  ] as const)(
    "goes from $currentThreadKey to the next $status thread $expected",
    ({ currentThreadKey, status, expected }) => {
      expect(next({ currentThreadKey, status })).toBe(expected);
    },
  );

  it("finds a thread that is not in the visible sidebar order", () => {
    expect(next({ currentThreadKey: "a", status: "working", orderedThreadKeys: ["a", "b"] })).toBe(
      "d",
    );
  });

  it("skips excluded threads", () => {
    expect(
      next({ currentThreadKey: "a", status: "done", excludedThreadKeys: new Set(["b", "e"]) }),
    ).toBeNull();
  });

  it("uses the visit stored on this device when the server sends none", () => {
    const withLocalVisit = (localLastVisitedAt: string) =>
      resolveNextThreadWithStatus({
        threads: [working("a"), { ...done("x"), lastVisitedAt: undefined }],
        keyOf: (thread) => thread.key,
        orderedThreadKeys: ["a", "x"],
        excludedThreadKeys: new Set(),
        currentThreadKey: "a",
        status: "done",
        localLastVisitedAtById: { x: localLastVisitedAt },
      })?.key ?? null;
    expect(withLocalVisit(BEFORE_COMPLETION)).toBe("x");
    expect(withLocalVisit(AFTER_COMPLETION)).toBeNull();
  });

  it("returns null when only the current thread has the status", () => {
    expect(
      resolveNextThreadWithStatus({
        threads: [working("a"), seen("b")],
        keyOf: (thread) => thread.key,
        orderedThreadKeys: ["a", "b"],
        excludedThreadKeys: new Set(),
        currentThreadKey: "a",
        status: "working",
        localLastVisitedAtById: {},
      }),
    ).toBeNull();
  });
});
