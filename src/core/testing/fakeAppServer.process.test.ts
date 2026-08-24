import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const scriptPath = resolve(
  process.cwd(),
  "scripts/fake-codex-app-server.mjs",
);
const scenarioPath = resolve(
  process.cwd(),
  "scripts/scenarios/handshake.json",
);

const runtimes: Array<ChildProcessWithoutNullStreams> = [];

function startFakeServer(...arguments_: string[]) {
  const child = spawn(process.execPath, [scriptPath, ...arguments_], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  runtimes.push(child);
  return child;
}

function send(child: ChildProcessWithoutNullStreams, value: unknown): void {
  child.stdin.write(`${JSON.stringify(value)}\n`);
}

async function waitFor(
  child: ChildProcessWithoutNullStreams,
  predicate: (message: any) => boolean,
  description: string,
  timeoutMs = 2_000,
): Promise<any> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      child.off("data", onStdout);
      rejectPromise(new Error(`Timed out waiting for ${description}`));
    }, timeoutMs);

    function onStdout(chunk: string) {
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;
        let message: any;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (!predicate(message)) continue;
        clearTimeout(timer);
        child.off("data", onStdout);
        resolvePromise(message);
        return;
      }
    }

    child.stdout.on("data", onStdout);
  });
}

function request(id: number | string, method?: string, params?: unknown) {
  if (method === undefined) return { jsonrpc: "2.0", id, result: params };
  return { jsonrpc: "2.0", id, method, params };
}

afterAll(() => {
  for (const runtime of runtimes) {
    runtime.kill();
  }
});

describe("fake codex app-server process", () => {
  it("completes a deterministic happy turn", async () => {
    const runtime = startFakeServer("--scenario", "happy-turn");
    send(runtime, request(1, "initialize", {}));
    await waitFor(
      runtime,
      (message) => message.id === 1,
      "initialize response",
    );

    send(runtime, request(2, "thread/start", {}));
    await waitFor(
      runtime,
      (message) => message.id === 2,
      "thread/start response",
    );

    send(runtime, request(3, "turn/start", {}));
    await waitFor(
      runtime,
      (message) => message.method === "turn/completed",
      "turn completion",
    );
    expect(runtime.exitCode).toBeNull();
    runtime.kill();
  });

  it("resolves a command approval server request", async () => {
    const runtime = startFakeServer("--scenario", "command-approval");
    send(runtime, request(1, "initialize", {}));
    send(runtime, request(2, "thread/start", {}));
    send(runtime, request(3, "turn/start", {}));

    const approval = await waitFor(
      runtime,
      (message) => message.id === "approval_fake_1",
      "command approval request",
    );
    send(runtime, request(approval.id, undefined, { decision: "approved" }));
    await waitFor(
      runtime,
      (message) => message.method === "turn/completed",
      "turn completion after approval",
    );
    runtime.kill();
  }, 3_000);

  it("exits with the configured crash code", async () => {
    const runtime = startFakeServer("--scenario", "crash-after-initialize");
    send(runtime, request(1, "initialize", {}));
    await waitFor(
      runtime,
      (message) => message.id === 1,
      "initialize response before crash",
    );
    const exit = await new Promise<{ code: number | null }>((resolvePromise) => {
      runtime.once("exit", (code) => resolvePromise({ code }));
    });
    expect(exit.code).toBe(101);
  });

  it("supports declarative JSON scenarios", async () => {
    const runtime = startFakeServer("--scenario-file", scenarioPath);
    send(runtime, request(1, "initialize", {}));
    const response = await waitFor(
      runtime,
      (message) => message.id === 1,
      "declarative scenario response",
    );
    expect(response.result).toEqual({ platformOs: "fake" });
    runtime.kill();
  });
});
