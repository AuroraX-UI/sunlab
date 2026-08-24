export type JsonRpcRequestId = number | string;

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type ClientRequest = {
  jsonrpc: "2.0";
  id: JsonRpcRequestId;
  method: string;
  params?: unknown;
};

export type ServerResponse = {
  jsonrpc: "2.0";
  id: JsonRpcRequestId;
  result?: unknown;
  error?: JsonRpcError;
};

export type NotificationMessage = {
  kind: "notification";
  method: string;
  params?: unknown;
};

export type ServerRequestMessage = {
  kind: "serverRequest";
  id: JsonRpcRequestId;
  method: string;
  params?: unknown;
};

export type ResponseMessage = {
  kind: "response";
  method: string;
  requestId?: JsonRpcRequestId;
  result?: unknown;
  error?: JsonRpcError;
};

export type IncomingProtocolMessage =
  | NotificationMessage
  | ServerRequestMessage
  | ResponseMessage;
