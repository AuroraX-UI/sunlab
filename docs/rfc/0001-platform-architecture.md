# RFC 0001: Sunlab Desktop 平台总体技术架构

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-23
- 相关文档：
  - [RFC 0002: Codex App-Server 协议内核](./0002-protocol-kernel.md)
  - [RFC 0003: 扩展与插件平台](./0003-extension-platform.md)

## 1. 摘要

Sunlab Desktop 是一个基于 Codex Harness `app-server` 的桌面 Agent 工作台。它的目标不是复刻一个聊天窗口，而是构建一个协议完整、安全可控、可扩展、面向真实软件交付的 Agent 操作台。

长期目标是替代官方 Codex Desktop，并在以下方面形成差异化：

1. 更完整的工程交付视图：任务计划、代码变更、终端、测试、部署和审计在同一工作流中。
2. 更开放的扩展模型：MCP、Codex Skill、Codex Plugin、Sunlab Plugin 和 Workflow 共存。
3. 更强的本地控制：用户可以明确知道 Agent 能访问什么、修改什么、请求什么网络与密钥。
4. 更好的二次开发体验：类型安全 SDK、manifest 驱动扩展、mock server、热加载和私有分发。

## 2. 背景

当前仓库已经完成最小验证：

- Tauri 2 + React + TypeScript 前端。
- Rust 进程启动并连接 `codex app-server`。
- stdio JSON-RPC 请求/响应转发。
- 服务端通知转发到前端。
- 基础审批弹窗。
- `initialize` 和 `thread/start` 已通过本机 Codex CLI 冒烟测试。

当前实现适合作为协议探针，但不足以支撑产品化目标。主要问题是业务逻辑分散在 React 组件中，缺少稳定的事件 reducer、协议类型、进程监督、持久化会话缓存和扩展宿主。

## 3. 目标

### 3.1 产品目标

1. 提供不弱于官方 Codex Desktop 的日常编码体验。
2. 支持长任务、多线程、历史恢复、中断、后台运行和失败重试。
3. 将文件 diff、命令执行、MCP 工具、reasoning、计划和审批组织成可审查的时间线。
4. 允许开发者通过插件扩展 UI、工具、上下文和工作流。
5. 为 Sunlab 项目提供专属 workspace profile、模板、技能和交付流水线。

### 3.2 技术目标

1. Rust Host 只负责进程、传输、原生能力和安全边界，不承载产品业务规则。
2. TypeScript Client Core 是协议状态的唯一归一化层。
3. React UI 是状态的投影，不应直接解释原始 JSON-RPC。
4. 所有扩展能力必须通过显式 capability 授权。
5. 官方生态兼容优先于私有标准：先支持 MCP、Codex Skill 和 Codex Plugin，再发展 Sunlab Plugin。
6. 本地事件日志必须足以重建线程时间线。

## 4. 非目标

1. 第一阶段不重写模型推理层，仍然依赖 `codex app-server`。
2. 不在客户端内直接保存或代理 OpenAI API Key；凭证仍由 Codex 配置体系和操作系统安全机制管理。
3. 不追求第一版支持所有实验性 app-server 能力。
4. 不把 plugin registry 作为第一批交付物；先定义本地 manifest 和权限模型。
5. 不允许未授权插件直接访问任意文件、网络、密钥或修改全局审批策略。

## 5. 架构原则

| 原则 | 含义 |
| --- | --- |
| App-server is source of truth | 线程、turn、item、审批和模型状态以 app-server 为准，本地存储只是投影和缓存。 |
| Small kernel, large ecosystem | 内核只做协议、状态、安全和调度；能力增长由扩展承担。 |
| Capability security | 每个插件只能使用 manifest 声明且用户同意的能力。 |
| Schema-driven UI | Timeline item、tool call、diff、表单等优先根据 schema 渲染，而不是为每个事件硬编码页面。 |
| Replayable state | 关键 UI 状态可以通过 append-only event journal 重放得到。 |
| Official compatibility first | MCP、Skill、Plugin 的兼容层优先于 Sunlab 私有扩展格式。 |
| Progressive disclosure | 新用户看到简单聊天与任务视图，高级用户可以展开协议、权限、上下文和自动化细节。 |

## 6. 总体架构

```text
+-------------------------------------------------------------------+
|                         Sunlab Desktop                            |
+-------------------------------------------------------------------+
| UI Runtime                                                        |
| - Thread Workspace                                                |
| - Timeline Router                                                 |
| - Diff / Terminal / Tool Renderers                                |
| - Approval Center                                                 |
| - Project Context Panel                                           |
| - Settings / Models / MCP / Plugins                               |
| - Command Palette                                                 |
+-------------------------------------------------------------------+
| Client Core                                                       |
| - ProtocolClient                                                  |
| - Request Manager                                                 |
| - Event Journal                                                   |
| - Thread State Machine                                            |
| - Item Reducer                                                    |
| - Approval Coordinator                                            |
| - Local Cache                                                     |
+-------------------------------------------------------------------+
| Extension Host                                                    |
| - Plugin Registry                                                 |
| - Permission Broker                                               |
| - Capability Resolver                                             |
| - MCP Adapter                                                     |
| - Codex Skill Adapter                                             |
| - Codex Plugin Adapter                                            |
| - Workflow Engine                                                 |
+-------------------------------------------------------------------+
| Rust Native Host                                                  |
| - AppServer Supervisor                                            |
| - stdio JSON-RPC Transport                                        |
| - Process Health Monitor                                          |
| - Secure Settings Broker                                          |
| - Scoped Filesystem Service                                       |
| - Native Notification Service                                     |
+-------------------------------------------------------------------+
| External Runtime                                                  |
| - codex app-server                                                |
| - MCP servers                                                     |
| - local shells / PTY                                              |
| - Git / project toolchains                                        |
| - cloud deployment targets                                        |
+-------------------------------------------------------------------+
```

## 7. 模块职责

### 7.1 Rust Native Host

Rust 层是唯一启动和管理 `codex app-server` 子进程的模块。

职责：

1. 解析 Sunlab Desktop 配置。
2. 选择 Codex CLI 可执行文件和版本。
3. 设置 `CODEX_HOME`、工作区路径和受控环境变量。
4. 启动、监控、重启和停止 app-server。
5. 处理 NDJSON JSON-RPC 分帧。
6. 维护 pending request 表。
7. 向前端广播 notification 和 server request。
8. 暴露受限的原生服务，例如打开目录、读取 scoped file、系统通知。

非职责：

1. 不判断某个 timeline item 应该显示成什么组件。
2. 不维护产品级线程列表业务规则。
3. 不执行插件 JavaScript。
4. 不直接向前端暴露任意 shell 或任意文件 API。

### 7.2 TypeScript Client Core

Client Core 是前端可依赖的唯一协议入口。

职责：

1. 封装 request/response/notification/server request 三类消息。
2. 归一化 thread、turn、item、delta、approval、error 状态。
3. 为每个事件分配本地 sequence。
4. 处理乱序、重复、迟到 delta 和 completed snapshot 覆盖。
5. 提供 selector 给 React 使用。
6. 支持从 event journal replay 状态。
7. 协调审批请求的生命周期。

### 7.3 UI Runtime

UI Runtime 负责把 Client Core 状态渲染给用户。

核心子模块：

| 模块 | 说明 |
| --- | --- |
| Thread Workspace | 线程列表、当前线程、搜索、过滤、pin 和归档。 |
| Timeline Router | 根据 item type 和注册 renderer 选择卡片。 |
| Approval Center | 集中处理命令、patch、MCP、权限和网络请求审批。 |
| Context Panel | 展示工作区、选中文件、AGENTS.md、项目配置和注入上下文。 |
| Tool Inspector | 查看工具参数、结果、耗时、错误和安全级别。 |
| Change Review | 查看 patch、按文件 review、生成 commit message、触发 Git 操作。 |
| Settings | Codex 路径、模型、审批策略、MCP、插件、缓存和日志。 |

### 7.4 Extension Host

Extension Host 管理第三方能力的生命周期、权限和能力解析。

详细设计见 [RFC 0003](./0003-extension-platform.md)。

## 8. 进程与生命周期

### 8.1 应用启动流程

```text
App Boot
  -> Load local settings
  -> Open caches and journals
  -> Restore cached threads/items
  -> Resolve codex binary
  -> Start AppServer Supervisor
  -> Spawn codex app-server
  -> Initialize JSON-RPC session
  -> Load account/model/thread metadata
  -> Activate enabled extensions
  -> Enter Ready
```

### 8.2 AppServer 生命周期

```text
Stopped
  -> Starting
  -> Initializing
  -> Ready
  -> Degraded
  -> Restarting
  -> Failed
```

状态含义：

| 状态 | 含义 |
| --- | --- |
| Stopped | 用户主动停止，或者尚未启动。 |
| Starting | 子进程已创建，但尚未完成握手。 |
| Initializing | `initialize` 请求已发出。 |
| Ready | 初始化成功，可发送业务请求。 |
| Degraded | 进程仍在，但出现部分能力失败或连续警告。 |
| Restarting | 进程退出后正在自动重启。 |
| Failed | 达到最大重试次数，需要用户介入。 |

Supervisor MUST 记录：

1. 启动时间。
2. Codex CLI 版本。
3. `CODEX_HOME`。
4. 退出码。
5. 最近 stderr 摘要。
6. 重启次数和退避间隔。

## 9. 数据与目录模型

### 9.1 当前阶段

编译产物和包缓存放在外部卷：

```text
/Volumes/fushilu/.caches/sunlab/
├── desktop/dist/
├── cargo-target/
└── node_modules/
```

### 9.2 目标布局

```text
/Volumes/fushilu/.caches/sunlab/
├── desktop/
│   └── dist/
├── cargo-target/
├── node_modules/
├── logs/
│   ├── app.log.ndjson
│   ├── appserver.stderr.log
│   └── protocol.trace.ndjson
├── cache/
│   ├── threads/
│   │   └── <thread-id>/
│   │       ├── index.sqlite
│   │       ├── events.ndjson
│   │       └── snapshots/
│   ├── models.json
│   └── mcp-status.json
└── plugins/
    ├── installed/
    ├── cache/
    └── quarantine/
```

最终用户配置路径待定，但 SHOULD 独立于缓存路径。推荐候选：

```text
/Volumes/fushilu/.sunlab/desktop/
├── settings.toml
├── profiles/
├── permissions/
├── workflows/
└── secrets-reference.json
```

迁移到 Sunlab 专用 `CODEX_HOME` 时，认证数据由 Codex 管理，Sunlab Desktop MUST NOT 自行复制或解释 token 文件。

## 10. 安全模型

### 10.1 边界

系统存在四类边界：

1. Web 前端与 Rust Host 之间的 Tauri IPC。
2. Rust Host 与 `codex app-server` 之间的 stdio。
3. Sunlab Desktop 与外部插件之间的 Extension API。
4. 用户工作区与系统敏感资源之间的文件/网络边界。

### 10.2 审批中心

审批不是普通弹窗，而是一等状态对象。

每个审批 MUST 至少包含：

```ts
type ApprovalRecord = {
  id: string;
  kind:
    | "command"
    | "fileChange"
    | "network"
    | "mcpTool"
    | "permissionProfile";
  threadId?: string;
  turnId?: string;
  itemId?: string;
  title: string;
  risk: "low" | "medium" | "high" | "critical";
  summary: string;
  payload: unknown;
  requestedAtMs: number;
  expiresAtMs?: number;
};
```

Approval Center MUST 展示：

1. 请求来源 thread/turn/item。
2. 具体命令、cwd、环境变量摘要。
3. patch 的完整 diff。
4. MCP server、tool name 和参数。
5. 网络目标和权限增量。
6. 允许后的影响范围。
7. 本次允许、本次拒绝、会话内记住、永久修改策略之间的区别。

### 10.3 默认策略

1. 默认审批策略使用 `on-request`。
2. 未获得授权的插件不能修改审批策略。
3. 高风险操作不允许静默批准。
4. 所有审批决定写入 audit log。
5. 对未知插件的敏感权限默认拒绝。

## 11. 可观测性

日志分为四类：

| 类型 | 内容 | 保留建议 |
| --- | --- | --- |
| Application log | UI/Core 生命周期和用户可见错误 | 最近 14 天 |
| Supervisor log | app-server spawn/exit/restart | 最近 30 天 |
| Protocol trace | JSON-RPC 方向、method、id、耗时、payload 大小 | 可关闭 |
| Audit log | 审批决定、插件授权、权限变更、工作流执行 | 长期保留 |

Protocol trace MUST 支持脱敏模式。默认不得记录完整 Authorization、token、cookie、secret 或环境变量值。

## 12. 测试策略

### 12.1 分层测试

| 层级 | 测试重点 |
| --- | --- |
| Protocol contract | 用官方 JSON Schema 校验请求、响应、notification。 |
| Reducer unit test | 同一事件序列产生确定性的 thread/item 状态。 |
| Fake app-server | 回放正常流、乱序流、崩溃流、慢响应和审批流。 |
| Supervisor integration | 进程崩溃、重启、超时、取消和优雅停止。 |
| Plugin permission test | 未声明能力必须被拒绝。 |
| E2E | 启动、发消息、审批、中断、恢复线程、查看 diff。 |

### 12.2 必须覆盖的关键场景

1. app-server 启动失败。
2. initialize 超时。
3. 进程在 turn 中崩溃后重启。
4. 同一 item 收到多个 delta 后收到 completed snapshot。
5. 审批请求被用户拒绝后 agent 继续。
6. 审批弹窗未处理时用户切换线程。
7. 插件请求未授权能力。
8. 工作流某一步失败后暂停并可恢复。

## 13. 技术选型

| 领域 | 选型 | 理由 |
| --- | --- | --- |
| 桌面壳 | Tauri 2 | 体积小、Rust 原生能力强、安全模型清晰。 |
| 前端框架 | React + TypeScript | 生态成熟，适合复杂状态和 schema 渲染。 |
| 状态层 | Zustand 或 Redux Toolkit | 需要在 R1 通过 spike 确定；关键是可测试 reducer。 |
| 本地索引 | SQLite | 适合线程、item、审批和插件元数据查询。 |
| 日志 | NDJSON | 便于流式追加、检索和回放。 |
| 协议校验 | JSON Schema + generated types | 以官方 schema 为准。 |
| 扩展通信 | MCP / Worker / declarative contributions | 按风险分级，详见 RFC 0003。 |

## 14. 实施路线

### R0: Protocol Probe

已完成。

验收：

- 可以启动 app-server 并初始化。
- 可以创建线程并发送 turn。
- 可以显示基础流式输出和审批弹窗。

### R1: Protocol Kernel

目标：让客户端具备产品级协议骨架。

范围：

1. Rust supervisor 重构。
2. JSON-RPC client 泛型化。
3. 官方 schema 类型生成。
4. Thread/Turn/Item reducer。
5. Event journal。
6. Approval coordinator。
7. Fake app-server 测试套件。

验收：

- 杀掉 app-server 后应用能进入明确的失败/重启状态。
- 相同事件序列 replay 后状态一致。
- React 组件不再直接解析原始 JSON-RPC。
- 协议 contract tests 覆盖核心方法。

### R2: Complete Thread Experience

范围：

1. 线程列表、搜索、恢复。
2. 历史 turns/items 加载。
3. 中断、排队、重试。
4. 多线程并行状态展示。
5. 全局错误中心和诊断页。

验收：

- 用户可以在重启桌面后继续旧线程。
- 长时间运行的 turn 状态不会因为切线程丢失。

### R3: Engineering Workspace

范围：

1. patch/diff review。
2. terminal output。
3. command execution card。
4. MCP tool inspector。
5. plan/task list。
6. Git status 集成。

验收：

- 用户能在不离开 Sunlab Desktop 的情况下审查一次完整代码变更。

### R4: Extension Foundation

范围：

1. Plugin manifest。
2. Permission broker。
3. MCP adapter。
4. Codex Skill adapter。
5. UI contribution registry。
6. 本地插件加载与热更新。

验收：

- 一个示例插件可以注册 panel、timeline renderer 和 MCP tool，并在权限提示后生效。

### R5: Sunlab Workflow

范围：

1. Recipe 格式。
2. Workflow engine。
3. 手动与事件触发器。
4. 审批门。
5. 运行历史。

验收：

- “修复失败测试”“审查 PR”“发布 preview”可以作为可分享 workflow 执行。

### R6: Developer Platform

范围：

1. `create-sunlab-plugin` CLI。
2. TypeScript SDK。
3. mock app-server。
4. plugin debugger。
5. 打包与签名。
6. 私有 registry 协议。

## 15. 开放问题

1. 最终 Sunlab 配置路径应放在用户主目录还是外部卷？
2. 是否允许多个 app-server 实例同时存在，例如个人与企业 profile 并行？
3. Plugin runtime 第二版是否引入 WASM 作为高安全沙箱？
4. Workflow 是否需要跨设备分布式执行，还是先保证单机可靠？
5. 团队模式下权限策略由本地用户控制，还是由组织 policy override？

## 16. 结论

Sunlab Desktop 的核心竞争力来自三层组合：

1. 稳定的 Codex App-Server 协议内核；
2. 面向真实工程交付的工作台体验；
3. 开放但安全的扩展平台。

第一阶段 MUST 优先完成 R1 Protocol Kernel。没有稳定的协议状态模型，后续 UI、插件和工作流都会建立在不可靠地基上。
