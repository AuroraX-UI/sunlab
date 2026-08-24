import type { JsonRpcError, JsonRpcRequestId } from "./messages";

export type ProtocolErrorKind =
  | "transportClosed"
  | "timeout"
  | "invalidFrame"
  | "serverRejected"
  | "cancelled"
  | "approvalDenied"
  | "unsupportedMethod"
  | "unknown";

export type ProtocolError = {
  kind: ProtocolErrorKind;
  message: string;
  code?: number | string;
  data?: unknown;
  requestId?: JsonRpcRequestId;
  retryable: boolean;
};

export function createProtocolError(
  kind: ProtocolErrorKind,
  message: string,
  options: Partial<Omit<ProtocolError, "kind" | "message">> = {},
): ProtocolError {
  return {
    kind,
    message,
    retryable: options.retryable ?? kind === "transportClosed",
    ...options,
  };
}

export function fromJsonRpcError(error: JsonRpcError, requestId?: JsonRpcRequestId): ProtocolError {
  return {
    kind: error.code === -32601 ? "unsupportedMethod" : "serverRejected",
    message: error.message,
    code: error.code,
    data: error.data,
    requestId,
    retryable: false,
  };
}
