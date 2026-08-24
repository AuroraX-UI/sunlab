import type {
  IncomingProtocolMessage,
  JsonRpcRequestId,
} from "../protocol/messages";
import type { ProtocolTransport } from "../protocol/client";

export type FakeScenario =
  | "happyPath"
  | "commandApproval"
  | "outOfOrderDelta";

export function fakeMessages(scenario: FakeScenario): IncomingProtocolMessage[] {
  const ids = {
    thread: "thread-1",
    turn: "turn-1",
    item: "item-1",
  };

  if (scenario === "happyPath") {
    return [
      { kind: "notification", method: "thread/started", params: { thread: { id: ids.thread, status: { type: "idle" } } } },
      { kind: "notification", method: "turn/started", params: { threadId: ids.thread, turnId: ids.turn } },
      { kind: "notification", method: "item/started", params: { threadId: ids.thread, turnId: ids.turn, item: { id: ids.item, type: "agentMessage" } } },
      { kind: "notification", method: "item/completed", params: { threadId: ids.thread, turnId: ids.turn, item: { id: ids.item, type: "agentMessage", content: [{ text: "done" }] } } },
      { kind: "notification", method: "turn/completed", params: { threadId: ids.thread, turnId: ids.turn } },
    ];
  }

  if (scenario === "commandApproval") {
    return [
      { kind: "notification", method: "turn/started", params: { threadId: ids.thread, turnId: ids.turn } },
      { kind: "notification", method: "item/started", params: { threadId: ids.thread, turnId: ids.turn, item: { id: ids.item, type: "commandExecution" } } },
      { kind: "serverRequest", id: 42, method: "item/commandExecution/requestApproval", params: { threadId: ids.thread, turnId: ids.turn, command: ["rm", "-rf", "/tmp/example"] } },
      { kind: "notification", method: "item/completed", params: { threadId: ids.thread, turnId: ids.turn, item: { id: ids.item, type: "commandExecution", output: "ok" } } },
      { kind: "notification", method: "turn/completed", params: { threadId: ids.thread, turnId: ids.turn } },
    ];
  }

  return [
    { kind: "notification", method: "item/started", params: { threadId: ids.thread, turnId: ids.turn, item: { id: ids.item, type: "agentMessage" } } },
    { kind: "notification", method: "item/completed", params: { threadId: ids.thread, turnId: ids.turn, item: { id: ids.item, type: "agentMessage", content: [{ text: "authoritative" }] } } },
    { kind: "notification", method: "item/agentMessage/delta", params: { threadId: ids.thread, turnId: ids.turn, itemId: ids.item, delta: "late delta" } },
  ];
}

export class FakeAppServerTransport implements ProtocolTransport {
  private listeners = new Set<(message: IncomingProtocolMessage) => void>();

  constructor(private readonly scenario: FakeScenario) {}

  async start(): Promise<void> {}

  async request(method: string): Promise<unknown> {
    if (method === "thread/start") {
      return { thread: { id: "thread-1", status: { type: "idle" } } };
    }
    return {};
  }

  async resolveServerRequest(id: JsonRpcRequestId): Promise<void> {
    this.emit({ kind: "response", method: "approval/resolved", requestId: id, result: {} });
  }

  onMessage(listener: (message: IncomingProtocolMessage) => void): () => void {
    this.listeners.add(listener);
    queueMicrotask(() => {
      for (const message of fakeMessages(this.scenario)) this.emit(message);
    });
    return () => this.listeners.delete(listener);
  }

  emit(message: IncomingProtocolMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}
