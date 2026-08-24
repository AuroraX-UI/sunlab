import { fromJsonRpcError, type ProtocolError } from "./errors";
import type { IncomingProtocolMessage } from "./messages";

export type ThreadStatus =
  | "idle"
  | "running"
  | "waitingApproval"
  | "interrupting"
  | "error"
  | "archived";

export type TurnStatus =
  | "starting"
  | "running"
  | "waitingApproval"
  | "completed"
  | "failed"
  | "interrupting"
  | "interrupted";

export type ItemStatus = "running" | "completed" | "failed" | "unknownEnded";

export type ThreadSummary = {
  id: string;
  cwd?: string;
  projectId?: string;
  preview?: string;
  status: ThreadStatus;
  updatedAtMs?: number;
};

export type TimelineItem = {
  id: string;
  threadId: string;
  turnId: string;
  type: string;
  status: ItemStatus;
  text: string;
  data?: unknown;
  localSeqCreated: number;
  localSeqUpdated: number;
  localSeqCompleted?: number;
};

export type Turn = {
  id: string;
  threadId: string;
  status: TurnStatus;
  itemIds: string[];
  startedAtMs?: number;
  endedAtMs?: number;
  error?: ProtocolError;
};

export type ApprovalRecord = {
  id: string;
  method: string;
  threadId?: string;
  turnId?: string;
  itemId?: string;
  payload: unknown;
  status: "pending" | "approved" | "denied" | "cancelled";
  localSeqReceived: number;
  localSeqResolved?: number;
};

export type KernelState = {
  threads: Record<string, ThreadSummary>;
  turns: Record<string, Turn>;
  items: Record<string, TimelineItem>;
  approvals: Record<string, ApprovalRecord>;
  lastSeq: number;
};

export function createInitialKernelState(): KernelState {
  return {
    threads: {},
    turns: {},
    items: {},
    approvals: {},
    lastSeq: 0,
  };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeThreadStatus(value: unknown): ThreadStatus {
  const raw = typeof value === "object" && value !== null
    ? asRecord(value).type
    : value;
  if (raw === "running") return "running";
  if (raw === "waitingApproval" || raw === "waiting_approval") return "waitingApproval";
  if (raw === "interrupting") return "interrupting";
  if (raw === "error") return "error";
  if (raw === "archived") return "archived";
  return "idle";
}

function extractAgentText(item: unknown): string {
  const record = asRecord(item);
  if (!Array.isArray(record.content)) return "";
  return record.content.map((part) => asRecord(part).text ?? "").join("");
}

function ensureThread(state: KernelState, threadId: string): ThreadSummary {
  return state.threads[threadId] ?? {
    id: threadId,
    status: "idle",
  };
}

function ensureTurn(state: KernelState, threadId: string, turnId: string): Turn {
  return state.turns[turnId] ?? {
    id: turnId,
    threadId,
    status: "running",
    itemIds: [],
  };
}

function markThreadAndTurn(
  next: KernelState,
  threadId: string,
  turnId: string,
  threadStatus: ThreadStatus,
  turnStatus: TurnStatus,
  endedAtMs?: number,
  error?: ProtocolError,
): void {
  const thread = next.threads[threadId] ?? ensureThread(next, threadId);
  next.threads[threadId] = {
    ...thread,
    status: threadStatus,
    updatedAtMs: endedAtMs ?? Date.now(),
  };

  const turn = next.turns[turnId] ?? ensureTurn(next, threadId, turnId);
  const unresolvedItemIds = turn.itemIds.filter((itemId) => {
    const item = next.items[itemId];
    return item?.status === "running";
  });

  for (const itemId of unresolvedItemIds) {
    next.items[itemId] = {
      ...next.items[itemId],
      status: "unknownEnded",
      localSeqUpdated: next.lastSeq,
    };
  }

  next.turns[turnId] = {
    ...turn,
    status: turnStatus,
    endedAtMs: endedAtMs ?? Date.now(),
    error,
  };
}

export function applyProtocolMessage(
  state: KernelState,
  message: IncomingProtocolMessage,
): KernelState {
  const next: KernelState = {
    ...state,
    threads: { ...state.threads },
    turns: { ...state.turns },
    items: { ...state.items },
    approvals: { ...state.approvals },
    lastSeq: state.lastSeq + 1,
  };

  if (message.kind === "response") {
    if (message.method === "thread/start") {
      const result = asRecord(message.result);
      const thread = asRecord(result.thread ?? result);
      const threadId = asString(thread.id ?? result.threadId);
      if (threadId) {
        next.threads[threadId] = {
          ...ensureThread(next, threadId),
          cwd: asString(thread.cwd),
          projectId: asString(thread.projectId),
          preview: asString(thread.preview),
          status: normalizeThreadStatus(thread.status),
          updatedAtMs: Date.now(),
        };
      }
    }
    return next;
  }

  const params = asRecord(message.params);
  const threadId = asString(params.threadId);
  const turnId = asString(params.turnId);

  switch (message.method) {
    case "thread/started": {
      const startedThread = asRecord(params.thread);
      const startedThreadId = asString(startedThread.id);
      if (startedThreadId) {
        next.threads[startedThreadId] = {
          ...ensureThread(next, startedThreadId),
          cwd: asString(startedThread.cwd),
          projectId: asString(startedThread.projectId),
          preview: asString(startedThread.preview),
          status: normalizeThreadStatus(startedThread.status),
          updatedAtMs: Date.now(),
        };
      }
      break;
    }

    case "thread/status/changed": {
      if (threadId) {
        const thread = ensureThread(next, threadId);
        next.threads[threadId] = {
          ...thread,
          status: normalizeThreadStatus(params.status),
          updatedAtMs: Date.now(),
        };
      }
      break;
    }

    case "turn/started": {
      if (threadId && turnId) {
        const thread = ensureThread(next, threadId);
        next.threads[threadId] = { ...thread, status: "running", updatedAtMs: Date.now() };
        const existing = next.turns[turnId];
        next.turns[turnId] = {
          id: turnId,
          threadId,
          status: "running",
          itemIds: existing?.itemIds ?? [],
          startedAtMs: Date.now(),
        };
      }
      break;
    }

    case "item/started": {
      const item = asRecord(params.item);
      const itemId = asString(item.id);
      if (threadId && turnId && itemId) {
        const turn = ensureTurn(next, threadId, turnId);
        next.turns[turnId] = {
          ...turn,
          itemIds: turn.itemIds.includes(itemId) ? turn.itemIds : [...turn.itemIds, itemId],
        };
        next.items[itemId] = {
          id: itemId,
          threadId,
          turnId,
          type: asString(item.type) ?? "unknown",
          status: "running",
          text: "",
          data: item,
          localSeqCreated: next.lastSeq,
          localSeqUpdated: next.lastSeq,
        };
      }
      break;
    }

    case "item/agentMessage/delta": {
      const itemId = asString(params.itemId);
      const delta = asString(params.delta);
      const existing = itemId ? next.items[itemId] : undefined;
      if (itemId && existing && existing.status !== "completed") {
        next.items[itemId] = {
          ...existing,
          text: existing.text + (delta ?? ""),
          localSeqUpdated: next.lastSeq,
        };
      }
      break;
    }

    case "item/completed": {
      const item = asRecord(params.item);
      const itemId = asString(item.id);
      const existing = itemId ? next.items[itemId] : undefined;
      if (threadId && turnId && itemId) {
        const turn = ensureTurn(next, threadId, turnId);
        next.turns[turnId] = {
          ...turn,
          itemIds: turn.itemIds.includes(itemId) ? turn.itemIds : [...turn.itemIds, itemId],
        };
        next.items[itemId] = {
          id: itemId,
          threadId,
          turnId,
          type: asString(item.type) ?? existing?.type ?? "unknown",
          status: "completed",
          text: item.type === "agentMessage" ? extractAgentText(item) : JSON.stringify(item),
          data: item,
          localSeqCreated: existing?.localSeqCreated ?? next.lastSeq,
          localSeqUpdated: next.lastSeq,
          localSeqCompleted: next.lastSeq,
        };
      }
      break;
    }

    case "turn/completed": {
      if (threadId && turnId) {
        markThreadAndTurn(next, threadId, turnId, "idle", "completed", Date.now());
      }
      break;
    }

    case "error": {
      if (threadId && turnId) {
        const rpcError = asRecord(params.error);
        const protocolError = fromJsonRpcError({
          code: typeof rpcError.code === "number" ? rpcError.code : -32000,
          message: asString(rpcError.message) ?? "Turn failed",
          data: rpcError,
        });
        markThreadAndTurn(next, threadId, turnId, "error", "failed", Date.now(), protocolError);
      }
      break;
    }

    default: {
      if (message.kind === "serverRequest" && /approval|elicitation/i.test(message.method)) {
        const approvalId = `${message.id}`;
        next.approvals[approvalId] = {
          id: approvalId,
          method: message.method,
          threadId,
          turnId,
          itemId: asString(params.itemId),
          payload: message.params,
          status: "pending",
          localSeqReceived: next.lastSeq,
        };
        if (threadId) {
          const thread = ensureThread(next, threadId);
          next.threads[threadId] = {
            ...thread,
            status: "waitingApproval",
            updatedAtMs: Date.now(),
          };
        }
        if (turnId) {
          const turn = ensureTurn(next, threadId ?? "", turnId);
          next.turns[turnId] = { ...turn, status: "waitingApproval" };
        }
      }
      break;
    }
  }

  return next;
}
