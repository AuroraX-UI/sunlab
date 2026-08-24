import { describe, expect, it } from "vitest";
import { FakeAppServerTransport, fakeMessages } from "../testing/fakeAppServer";
import { ProtocolClient } from "./client";
import { applyProtocolMessage, createInitialKernelState } from "./state";

describe("protocol kernel", () => {
  it("creates a thread from a thread/start response", () => {
    const state = applyProtocolMessage(createInitialKernelState(), {
      kind: "response",
      method: "thread/start",
      result: { thread: { id: "thread_1", cwd: "/tmp/project", status: { type: "idle" } } },
    });

    expect(state.threads.thread_1?.cwd).toBe("/tmp/project");
    expect(state.threads.thread_1?.status).toBe("idle");
    expect(state.lastSeq).toBe(1);
  });

  it("applies a complete happy-path turn", () => {
    let state = createInitialKernelState();
    for (const message of fakeMessages("happyPath")) {
      state = applyProtocolMessage(state, message);
    }

    expect(state.turns["turn-1"]?.status).toBe("completed");
    expect(state.items["item-1"]?.text).toBe("done");
    expect(state.items["item-1"]?.status).toBe("completed");
    expect(Object.keys(state.approvals)).toHaveLength(0);
  });

  it("records an approval request and blocks the turn", () => {
    let state = createInitialKernelState();
    for (const message of fakeMessages("commandApproval").slice(0, 3)) {
      state = applyProtocolMessage(state, message);
    }

    expect(state.threads["thread-1"]?.status).toBe("waitingApproval");
    expect(state.turns["turn-1"]?.status).toBe("waitingApproval");
    expect(state.approvals["42"]?.payload).toMatchObject({ command: ["rm", "-rf", "/tmp/example"] });
  });

  it("lets an authoritative completed item win over a late delta", () => {
    let state = createInitialKernelState();
    for (const message of fakeMessages("outOfOrderDelta")) {
      state = applyProtocolMessage(state, message);
    }

    expect(state.items["item-1"]?.text).toBe("authoritative");
    expect(state.items["item-1"]?.localSeqUpdated).toBeLessThan(state.lastSeq);
  });

  it("replays deterministic fake-server events through ProtocolClient", async () => {
    const client = new ProtocolClient(new FakeAppServerTransport("happyPath"));
    const snapshots: number[] = [];
    client.subscribe((state) => snapshots.push(state.lastSeq));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(snapshots.at(-1)).toBe(fakeMessages("happyPath").length);
    expect(client.getState().items["item-1"]?.status).toBe("completed");
  });
});
