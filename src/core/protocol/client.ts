import type { JsonRpcError, IncomingProtocolMessage, JsonRpcRequestId } from "./messages";
import { fromJsonRpcError } from "./errors";
import {
  applyProtocolMessage,
  createInitialKernelState,
  type ApprovalRecord,
  type KernelState,
} from "./state";

export type Unsubscribe = () => void;

export interface ProtocolTransport {
  start(): Promise<void>;
  request(method: string, params?: unknown): Promise<unknown>;
  resolveServerRequest(id: JsonRpcRequestId, result: unknown): Promise<void>;
  onMessage(listener: (message: IncomingProtocolMessage) => void): Unsubscribe;
}

export type KernelListener = (state: KernelState) => void;

export class ProtocolClient {
  private readonly listeners = new Set<KernelListener>();
  private unsubscribeTransport?: Unsubscribe;

  constructor(
    private readonly transport: ProtocolTransport,
    private stateValue: KernelState = createInitialKernelState(),
  ) {
    this.unsubscribeTransport = transport.onMessage((message) => this.accept(message));
  }

  getState(): KernelState {
    return this.stateValue;
  }

  subscribe(listener: KernelListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.stateValue);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<void> {
    await this.transport.start();
  }

  async request<TResult = unknown>(
    method: string,
    params?: unknown,
  ): Promise<TResult> {
    try {
      const result = await this.transport.request(method, params);
      this.accept({
        kind: "response",
        method,
        result,
      });
      return result as TResult;
    } catch (error) {
      throw this.normalizeThrownError(error);
    }
  }

  async resolveServerRequest(id: JsonRpcRequestId, result: unknown): Promise<void> {
    await this.transport.resolveServerRequest(id, result);
    this.acceptResolvedApproval(id);
  }

  dispose(): void {
    this.unsubscribeTransport?.();
    this.listeners.clear();
  }

  private accept(message: IncomingProtocolMessage): void {
    this.stateValue = applyProtocolMessage(this.stateValue, message);
    for (const listener of this.listeners) {
      listener(this.stateValue);
    }
  }

  private acceptResolvedApproval(id: JsonRpcRequestId): void {
    const approval = this.stateValue.approvals[`${id}`];
    if (!approval || approval.status !== "pending") return;
    this.stateValue = applyApprovalResolution(
      this.stateValue,
      approval,
      "approved",
    );
    for (const listener of this.listeners) listener(this.stateValue);
  }

  private normalizeThrownError(error: unknown): Error {
    const candidate = error as { code?: unknown; message?: unknown; data?: unknown };
    if (
      candidate &&
      typeof candidate.code === "number" &&
      typeof candidate.message === "string"
    ) {
      const protocolError = fromJsonRpcError(
        {
          code: candidate.code,
          message: candidate.message,
          data: candidate.data,
        },
      );
      return new Error(`${protocolError.kind}: ${protocolError.message}`);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function applyApprovalResolution(
  state: KernelState,
  approval: ApprovalRecord,
  status: "approved" | "denied" | "cancelled",
): KernelState {
  const next: KernelState = {
    ...state,
    approvals: {
      ...state.approvals,
      [approval.id]: {
        ...approval,
        status,
        localSeqResolved: state.lastSeq + 1,
      },
    },
    lastSeq: state.lastSeq + 1,
  };

  if (!approval.threadId) return next;
  const thread = next.threads[approval.threadId];
  if (thread?.status === "waitingApproval") {
    next.threads[approval.threadId] = { ...thread, status: "running" };
  }
  if (approval.turnId && next.turns[approval.turnId]?.status === "waitingApproval") {
    next.turns[approval.turnId] = {
      ...next.turns[approval.turnId],
      status: "running",
    };
  }
  return next;
}

export type { JsonRpcError };
