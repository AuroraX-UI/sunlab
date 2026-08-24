#!/usr/bin/env node
import readline from "node:readline";
import { readFile } from "node:fs/promises";

const arguments_ = process.argv.slice(2);
const option = (name, fallback) => {
  const index = arguments_.indexOf(`--${name}`);
  return index >= 0 ? arguments_[index + 1] : fallback;
};
const flag = (name) => arguments_.includes(`--${name}`);

const scenarioName = option("scenario", "happy-turn");
const delayMs = Number(option("delay-ms", "10"));
const scenarioFile = option("scenario-file");
const failAfter = option("fail-after");

const threadId = "thread_fake_1";
const turnId = "turn_fake_1";
const itemId = "item_fake_1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function jsonRpcResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function notification(method, params = {}) {
  return { jsonrpc: "2.0", method, params: { ...params } };
}

function serverRequest(id, method, params = {}) {
  return { jsonrpc: "2.0", id, method, params };
}

async function write(value) {
  await sleep(delayMs);
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function emit(method, params) {
  await write(notification(method, params));
}

async function respond(request, result) {
  await write(jsonRpcResponse(request.id, result));
}

async function runHappyTurn({ lateDelta = false, slow = false } = {}) {
  const stepDelay = slow ? Math.max(delayMs, 120) : delayMs;
  await emit("turn/started", { threadId, turnId });
  await emit("item/started", {
    threadId,
    turnId,
    item: { id: itemId, type: "agentMessage" },
  });
  await emit("item/agentMessage/delta", {
    threadId,
    turnId,
    itemId,
    delta: "Hello ",
  });
  if (slow) await sleep(stepDelay);
  await emit("item/agentMessage/delta", {
    threadId,
    turnId,
    itemId,
    delta: "from fake Codex.",
  });

  if (lateDelta) {
    await emit("item/completed", {
      threadId,
      turnId,
      item: {
        id: itemId,
        type: "agentMessage",
        content: [{ type: "input_text", text: "authoritative snapshot" }],
      },
    });
    await emit("item/agentMessage/delta", {
      threadId,
      turnId,
      itemId,
      delta: " late delta",
    });
  } else {
    await emit("item/completed", {
      threadId,
      turnId,
      item: {
        id: itemId,
        type: "agentMessage",
        content: [{ type: "input_text", text: "Hello from fake Codex." }],
      },
    });
  }

  await emit("turn/completed", { threadId, turnId });
}

async function runApprovalTurn(kind) {
  const itemType = kind === "file" ? "fileChange" : "commandExecution";
  const method = kind === "file"
    ? "item/fileChange/requestApproval"
    : "item/commandExecution/requestApproval";
  const params = kind === "file"
    ? { files: ["src/main.ts"], additions: 12, deletions: 3 }
    : { command: ["npm", "test"], cwd: "/workspace/project" };

  await emit("turn/started", { threadId, turnId });
  await emit("item/started", {
    threadId,
    turnId,
    item: { id: itemId, type: itemType },
  });
  const approved = new Promise((resolve) => {
    pendingApprovalResolvers.set("approval_fake_1", resolve);
  });
  await write(serverRequest("approval_fake_1", method, {
    threadId,
    turnId,
    itemId,
    ...params,
  }));
  await approved;
  await emit("item/completed", {
    threadId,
    turnId,
    item: { id: itemId, type: itemType, output: "approved" },
  });
  await emit("turn/completed", { threadId, turnId });
}

const pendingApprovalResolvers = new Map();

function resolvePendingApproval(id, result) {
  const resolver = pendingApprovalResolvers.get(`${id}`);
  if (!resolver) return false;
  pendingApprovalResolvers.delete(`${id}`);
  resolver(result);
  return true;
}

const builtinScenarios = {
  async "handshake-only"(request) {
    if (request.method === "initialize") await respond(request, {});
  },
  async "hang-forever"() {},
  async "invalid-frame"(request) {
    process.stdout.write("{\"jsonrpc\":\"2.0\",not-json\n");
    if (request.method === "initialize") await respond(request, {});
  },
  async "huge-frame"(request) {
    if (request.method === "initialize") {
      await respond(request, {
        filler: "x".repeat(2 * 1024 * 1024),
      });
    }
  },
  async "slow-delta"(request) {
    if (request.method === "initialize") await respond(request, {});
    if (request.method === "thread/start") {
      await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
    }
    if (request.method === "turn/start") {
      await respond(request, { turnId });
      await runHappyTurn({ slow: true });
    }
  },
  "late-delta": null,
  "out-of-order-items": null,
  "command-approval": null,
  "file-change-approval": null,
  "deny-and-retry": null,
  async "turn-error"(request) {
    if (request.method === "initialize") await respond(request, {});
    if (request.method === "thread/start") {
      await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
    }
    if (request.method === "turn/start") {
      await respond(request, { turnId });
      await emit("turn/started", { threadId, turnId });
      await emit("error", {
        threadId,
        turnId,
        error: { code: -32000, message: "fake turn failure" },
      });
    }
  },
  async "crash-after-initialize"(request) {
    if (request.method === "initialize") {
      await respond(request, {});
      process.exitCode = 101;
      process.stderr.write("fake runtime crashed after initialize\n");
      setTimeout(() => process.exit(101), delayMs);
    }
  },
  async "crash-after-turn-start"(request) {
    if (request.method === "initialize") await respond(request, {});
    if (request.method === "thread/start") {
      await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
    }
    if (request.method === "turn/start") {
      await respond(request, { turnId });
      await emit("turn/started", { threadId, turnId });
      setTimeout(() => process.exit(101), delayMs);
    }
  },
  async "stderr-flood"(request) {
    const interval = setInterval(() => {
      for (let index = 0; index < 100; index += 1) {
        process.stderr.write(`fake warning ${Date.now()} ${index}\n`);
      }
    }, 1);
    interval.unref();
    if (request.method === "initialize") await respond(request, {});
  },
};

builtinScenarios["late-delta"] = async (request) => {
  if (request.method === "initialize") await respond(request, {});
  if (request.method === "thread/start") {
    await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
  }
  if (request.method === "turn/start") {
    await respond(request, { turnId });
    await runHappyTurn({ lateDelta: true });
  }
};

builtinScenarios["happy-turn"] = async (request) => {
  if (request.method === "initialize") await respond(request, {});
  if (request.method === "thread/start") {
    await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
  }
  if (request.method === "turn/start") {
    await respond(request, { turnId });
    await runHappyTurn();
  }
};

builtinScenarios["out-of-order-items"] = async (request) => {
  if (request.method === "initialize") await respond(request, {});
  if (request.method === "thread/start") {
    await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
  }
  if (request.method === "turn/start") {
    await respond(request, { turnId });
    await emit("turn/started", { threadId, turnId });
    await emit("item/completed", {
      threadId,
      turnId,
      item: { id: itemId, type: "agentMessage", content: [{ text: "before start" }] },
    });
    await emit("item/started", {
      threadId,
      turnId,
      item: { id: itemId, type: "agentMessage" },
    });
    await emit("turn/completed", { threadId, turnId });
  }
};

async function approvalScenario(kind) {
  return async (request) => {
    if (request.method === "initialize") await respond(request, {});
    if (request.method === "thread/start") {
      await respond(request, { thread: { id: threadId, status: { type: "idle" } } });
    }
    if (request.method === "turn/start") {
      await respond(request, { turnId });
      await runApprovalTurn(kind);
    }
  };
}

builtinScenarios["command-approval"] = await approvalScenario("command");
builtinScenarios["file-change-approval"] = await approvalScenario("file");
builtinScenarios["deny-and-retry"] = await approvalScenario("command");

async function loadExternalScenario(path) {
  if (path.endsWith(".json")) {
    const definition = JSON.parse(await readFile(path, "utf8"));
    return createScenarioHandler(definition);
  }

  const module = await import(path);
  const scenario = module.default ?? module;
  if (typeof scenario !== "function") {
    throw new Error(`Scenario file must export a function: ${path}`);
  }
  return scenario;
}

function createScenarioHandler(definition) {
  return async (request) => {
    const steps = (definition.steps ?? []).filter((step) => step.respondTo === request.method);
    for (const step of steps) {
      if (step.response) {
        await write(jsonRpcResponse(request.id, step.response));
      } else if (step.error) {
        await write({
          jsonrpc: "2.0",
          id: request.id,
          error: step.error,
        });
      } else if (step.emit) {
        await emit(step.emit.method, step.emit.params ?? {});
      } else if (step.serverRequest) {
        const requestId = step.serverRequest.id ?? `${request.id}-server-request`;
        await write(serverRequest(requestId, step.serverRequest.method, step.serverRequest.params ?? {}));
      } else if (step.sleepMs) {
        await sleep(step.sleepMs);
      }
    }
  };
}

async function handleRequest(request, handler) {
  if (!Number.isInteger(request.id) && typeof request.id !== "string") return;
  try {
    await handler(request);
    if (failAfter && request.method === failAfter) {
      process.stderr.write(`fake runtime failed after ${failAfter}\n`);
      setTimeout(() => process.exit(101), delayMs);
    }
  } catch (error) {
    await write({
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32000, message: error.message },
    });
  }
}

if (flag("list-scenarios")) {
  console.log(Object.keys(builtinScenarios).sort().join("\n"));
  process.exit(0);
}

const handler = scenarioFile
  ? await loadExternalScenario(scenarioFile)
  : builtinScenarios[scenarioName];

if (!handler) {
  console.error(`Unknown scenario: ${scenarioName}`);
  console.error(`Use --list-scenarios to see available scenarios.`);
  process.exit(2);
}

const reader = readline.createInterface({ input: process.stdin });
reader.on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    process.stderr.write(`invalid fake-server request frame: ${line.slice(0, 160)}\n`);
    return;
  }
  if (resolvePendingApproval(request.id, request.result)) return;
  void handleRequest(request, handler);
});

process.stdin.on("end", () => {
  process.exit(0);
});
