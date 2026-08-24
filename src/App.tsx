import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type JsonRpcEvent = {
  method?: string;
  params?: any;
  id?: number | string;
};

type TimelineItem = {
  id: string;
  role: "user" | "agent";
  text: string;
  status: string;
  kind: string;
};

const APP_VERSION = "0.1.0";

function displayError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export default function App() {
  const [workspace, setWorkspace] = useState("/Users/fushilu/workspace/revocloud/sunlab");
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState("未连接");
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [events, setEvents] = useState<JsonRpcEvent[]>([]);
  const [approval, setApproval] = useState<JsonRpcEvent | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const appendEvent = useCallback((event: JsonRpcEvent) => {
    setEvents((current) => [...current.slice(-199), event]);
  }, []);

  const upsertItem = useCallback((id: string, patch: Partial<TimelineItem>) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index < 0) {
        return [...current, { id, role: "agent", text: "", status: "running", kind: "item", ...patch }];
      }
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const startServer = async () => {
    try {
      setStatus("启动 app-server…");
      await invoke("app_server_start");
      await invoke("app_server_request", {
        method: "initialize",
        params: {
          clientInfo: { name: "sunlab-codex-desktop", title: "Sunlab Codex Desktop", version: APP_VERSION },
        },
      });
      const response = await invoke<any>("app_server_request", {
        method: "thread/start",
        params: { cwd: workspace, approvalPolicy: "on-request" },
      });
      const id = response.thread?.id ?? response.threadId ?? response.id;
      if (!id) throw new Error(`thread/start 未返回线程 ID：${JSON.stringify(response)}`);
      setThreadId(id);
      setItems([]);
      setStatus(`已连接 ${id}`);
    } catch (error) {
      setStatus(displayError(error));
    }
  };

  const submit = async () => {
    if (!input.trim() || !threadId) return;
    const message = input.trim();
    setInput("");
    setItems((current) => [...current, {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
      status: "done",
      kind: "message",
    }]);
    await invoke("app_server_request", {
      method: "turn/start",
      params: { threadId, input: [{ type: "text", text: message }] },
    }).catch((error) => setStatus(displayError(error)));
  };

  const resolveApproval = async (decision: "approved" | "abort") => {
    if (!approval || approval.id === undefined) return;
    await invoke("app_server_resolve", { id: approval.id, result: { decision } });
    setApproval(null);
  };

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;

    const bind = async () => {
      const bindings = await Promise.all([
        listen<JsonRpcEvent>("protocol://notification", ({ payload }) => {
        appendEvent(payload);
        const params = payload.params ?? {};
        const item = params.item;

        if (payload.method === "item/started") {
          upsertItem(item.id, { kind: item.type, status: "running" });
        } else if (payload.method === "item/agentMessage/delta") {
          setItems((current) => {
            const index = current.findIndex((timelineItem) => timelineItem.id === params.itemId);
            if (index < 0) return current;
            const next = [...current];
            next[index] = { ...next[index], text: next[index].text + params.delta };
            return next;
          });
        } else if (payload.method === "item/completed") {
          const text = item.type === "agentMessage"
            ? (Array.isArray(item.content) ? item.content.map((part: any) => part.text ?? "").join("") : "")
            : JSON.stringify(item, null, 2);
          upsertItem(item.id, { status: "done", kind: item.type, text });
        } else if (payload.method === "turn/completed") {
          setStatus("回合已完成");
          } else if (payload.method === "error") {
            setStatus(params.error?.message ?? "发生错误");
          }
        }),
        listen<JsonRpcEvent>("protocol://server-request", ({ payload }) => {
          appendEvent(payload);
          if (payload.id !== undefined) setApproval(payload);
        }),
        listen<{ type?: string; state?: string }>("protocol://supervisor", ({ payload }) => {
          if (payload.state) setStatus(`App-server：${payload.state}`);
        }),
      ]);

      for (const unlisten of bindings) {
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      }
    };

    void bind();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [appendEvent, upsertItem]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
  }, [items]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Sunlab Codex Desktop</h1>
          <p>{status}</p>
        </div>
        <div className="controls">
          <input value={workspace} onChange={(event) => setWorkspace(event.target.value)} aria-label="工作区路径" />
          <button onClick={startServer}>{threadId ? "重启线程" : "连接 Codex"}</button>
        </div>
      </header>

      <section ref={timelineRef} className="timeline">
        {items.length === 0 && <p className="empty">连接后发送第一条消息，事件会在这里实时渲染。</p>}
        {items.map((item) => (
          <article key={item.id} className={`card ${item.role}`}>
            <small>{item.role === "user" ? "USER" : item.kind.toUpperCase()} · {item.status}</small>
            <pre>{item.text || "…"}</pre>
          </article>
        ))}
      </section>

      <section className="composer">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
          }}
          placeholder={threadId ? "输入任务，Cmd/Ctrl + Enter 发送" : "先连接 Codex app-server"}
        />
        <button disabled={!threadId || !input.trim()} onClick={() => void submit()}>发送</button>
      </section>

      {approval && (
        <div className="modal">
          <div className="approval">
            <h2>需要审批</h2>
            <pre>{JSON.stringify(approval.params, null, 2)}</pre>
            <div>
              <button onClick={() => void resolveApproval("approved")}>允许</button>
              <button onClick={() => void resolveApproval("abort")}>停止</button>
            </div>
          </div>
        </div>
      )}

      <details className="event-log">
        <summary>协议事件（{events.length}）</summary>
        <pre>{events.map((event) => `${event.method ?? "response"} ${JSON.stringify(event.params ?? event)}`).join("\n\n")}</pre>
      </details>
    </main>
  );
}
