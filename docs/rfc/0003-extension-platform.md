# RFC 0003: 扩展与插件平台

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-23
- 相关文档：
  - [RFC 0001](./0001-platform-architecture.md)
  - [RFC 0002](./0002-protocol-kernel.md)

## 1. 摘要

本文定义 Sunlab Desktop 的扩展平台，包括 Plugin Manifest、Capability Model、Permission Broker、MCP/Skill/Codex Plugin 兼容层、UI contribution、Workflow Recipe 和开发者工具。

设计目标不是尽早做一个插件市场，而是建立一个能让用户、开发者和团队安全扩展 Agent 行为的平台。

## 2. 扩展哲学

传统插件通常只能“增加按钮”或“调用 API”。Sunlab Desktop 的插件应能参与五个层面：

1. **上下文**：向 Agent 注入项目知识、规范、运行状态和领域数据。
2. **工具**：注册 MCP tool、动态 tool 或 workflow action。
3. **界面**：渲染 timeline item、添加 panel、增强审批详情。
4. **治理**：提供审批上下文、风险评分、组织策略和建议决定。
5. **交付**：接入 Git、测试、构建、部署、回滚和通知。

因此，扩展不是应用外挂，而是平台的一等参与方。

## 3. 扩展类型

### 3.1 MCP Extension

最高优先级兼容形态。

适用：

1. 外部工具。
2. 数据库/API/云资源。
3. 独立进程服务。
4. 跨编辑器和桌面应用复用。

优势：

1. 官方生态已有标准。
2. 进程隔离天然较好。
3. 权限可通过 server/tool 级别控制。

### 3.2 Codex Skill

适用于 prompt/context 型扩展。

典型用途：

1. 项目规范。
2. 代码风格指南。
3. 领域术语。
4. 常见修复手册。

Sunlab Desktop SHOULD 通过 app-server 已有 skill 接口管理，而不是绕过 Codex 自己加载 prompt 文件。

### 3.3 Codex Plugin

适用于与官方插件生态保持兼容的能力。

Sunlab Desktop SHOULD 优先复用 app-server 提供的 plugin 安装、启用和状态接口。只有官方接口不足时，才引入 Sunlab-specific compatibility shim。

### 3.4 Declarative Sunlab Plugin

第一方推荐的低风险插件形式。

插件只提交 manifest 和静态贡献点，不在桌面进程里执行任意 JavaScript。

可声明：

1. commands。
2. panels。
3. timeline renderers。
4. context snippets。
5. workflow actions。
6. settings schema。

### 3.5 Worker Plugin

高阶插件形式，运行在独立 worker/sidecar 进程。

可调用：

1. limited filesystem API。
2. network allowlist。
3. event subscription。
4. custom MCP bridge。
5. workflow hook。

Worker Plugin MUST 经过 Permission Broker。

### 3.6 Webview UI Plugin

用于复杂自定义 UI。

约束：

1. 无默认 Node/native access。
2. CSP 受宿主限制。
3. 只能通过 typed bridge 与 host 通信。
4. iframe/webview origin 隔离。
5. 默认不继承主窗口能力。

## 4. Plugin Manifest

每个插件根目录必须有 `sunlab.plugin.json`。

### 4.1 示例

```json
{
  "$schema": "https://sunlab.dev/schemas/plugin-manifest.v1.json",
  "id": "dev.sunlab.deploy-preview",
  "name": "Deploy Preview",
  "version": "0.3.0",
  "engine": {
    "sunlabDesktop": "^1.0.0",
    "runtime": "declarative"
  },
  "publisher": {
    "name": "Sunlab",
    "url": "https://sunlab.dev"
  },
  "capabilities": [
    "ui:panel",
    "ui:timeline-renderer",
    "workflow:action",
    "workspace:read",
    "network:https://api.sunlab.dev/*"
  ],
  "contributions": {
    "commands": [
      {
        "id": "deploy-preview.run",
        "title": "Deploy Preview",
        "when": "workspace.type == 'revocloud'"
      }
    ],
    "panels": [
      {
        "id": "deploy.preview",
        "title": "Preview",
        "location": "sidebar",
        "entry": "./panels/preview.html"
      }
    ],
    "timelineRenderers": [
      {
        "id": "deploy.status",
        "itemType": "sunlab.deployStatus",
        "entry": "./renderers/status.html"
      }
    ],
    "contextProviders": [
      {
        "id": "deploy.config",
        "glob": ["deploy/*.yaml", ".sunlab/config.toml"],
        "maxFiles": 20
      }
    ],
    "workflows": [
      {
        "id": "deploy-preview",
        "path": "./workflows/deploy-preview.yaml"
      }
    ]
  }
}
```

### 4.2 必填字段

| 字段 | 说明 |
| --- | --- |
| `id` | 反向域名格式，全局唯一。 |
| `name` | 用户可见名称。 |
| `version` | SemVer。 |
| `engine.runtime` | `declarative` / `worker` / `webview`。 |
| `capabilities` | 声明的权限集合。 |
| `contributions` | 对平台的扩展贡献。 |

### 4.3 版本策略

1. Manifest 使用独立 `schemaVersion`。
2. Plugin API 使用 `engine.sunlabDesktop` range。
3. Breaking change 必须提升 major version。
4. Host MUST 对不支持的 manifest 拒绝加载并给出修复建议。

## 5. Capability Model

### 5.1 能力命名

建议采用 `<domain>:<capability>[?<scope>]` 形式。

基础域：

```text
ui
context
workspace
filesystem
network
process
thread
approval
model
mcp
workflow
settings
secret
telemetry
```

示例：

```text
ui:panel
ui:timeline-renderer
workspace:read
workspace:write
filesystem:read:/Users/me/project/**?exclude=.env
network:post:https://api.example.com/*
mcp:start:local
thread:read
thread:subscribe
approval:provide-context
workflow:define
settings:read:public
secret:read:deploy-token
```

### 5.2 权限级别

| 级别 | 说明 | 用户交互 |
| --- | --- | --- |
| `open` | 无敏感数据，仅本地 UI 声明 | 安装时提示 |
| `scoped` | 明确 path/host/tool scope | 安装时必须同意 |
| `sensitive` | 可读写源码、执行有限命令 | 安装加首次使用确认 |
| `critical` | 密钥、任意网络、审批策略、系统目录 | 每次或管理员锁定策略 |

### 5.3 Permission Broker

Broker 负责：

1. 校验 manifest 声明。
2. 展示人类可读权限说明。
3. 保存 granted/denied 状态。
4. 在运行时拦截越权调用。
5. 记录 audit log。
6. 支持临时授权和撤销。

规则：

1. 未声明能力 MUST 拒绝。
2. 声明但用户拒绝 MUST 拒绝。
3. 通配符 MUST 展示展开后的具体风险。
4. critical capability 不允许“永久信任”成为默认选项。
5. 组织策略 MAY 禁止用户放宽权限。

### 5.4 权限展示

安装界面 MUST 将权限翻译为普通用户语言，例如：

```text
读取 deploy/ 和 .sunlab/config.toml
访问 https://api.sunlab.dev/*
在工作流中执行 deploy-preview 动作
为审批弹窗补充部署风险说明
```

禁止只展示原始 capability 字符串。

## 6. Plugin Lifecycle

### 6.1 状态

```text
Discovered
  -> Validating
  -> Quarantined
  -> InstallRequested
  -> ConsentRequired
  -> Installed
  -> Activating
  -> Active
  -> Degraded
  -> Disabled
  -> Updating
  -> Uninstalling
```

### 6.2 安装流程

```text
User selects package
  -> Verify package signature/checksum
  -> Extract to quarantine
  -> Validate manifest and assets
  -> Show capabilities
  -> User grants permissions
  -> Move to installed
  -> Register contributions
  -> Activate if enabled
```

### 6.3 更新流程

更新时 MUST 做 semantic diff：

1. 新增 capability：必须重新授权。
2. 收窄 capability：可以静默更新。
3. runtime 变化：必须提示。
4. publisher 变化：必须高风险确认。
5. workflow 变更：列出步骤 diff。

## 7. UI Contribution

### 7.1 Panel

Panel 可出现在：

```text
sidebar.left
sidebar.right
bottom.dock
inspector.tab
thread.toolbar
settings.section
```

Declarative panel 使用 HTML entry + typed bridge：

```ts
declare global {
  interface Window {
    sunlab?: SunlabPluginBridge;
  }
}

interface SunlabPluginBridge {
  ready(): void;
  getContext(): Promise<PanelContext>;
  invoke(commandId: string, args?: unknown): Promise<unknown>;
  onEvent(handler: (event: PluginEvent) => void): Unsubscribe;
}
```

### 7.2 Timeline Renderer

Timeline Renderer 注册的是某种 item type 的视图。

```ts
type TimelineRendererContribution = {
  id: string;
  itemType: string;
  priority?: number;
  supports?: {
    compactMode?: boolean;
    virtualization?: boolean;
    print?: boolean;
  };
};
```

内置 renderer 优先级高于插件 renderer，除非用户显式选择“始终使用插件渲染器”。

### 7.3 Approval Enhancer

Approval enhancer 不能替用户决定，除非被单独授予 `approval:auto-review` 并且策略允许。

它可以提供：

1. 额外风险说明。
2. 命令解释。
3. 网络目标信誉。
4. 部署环境影响。
5. 推荐决定。

输出必须是 evidence，不是隐式授权。

## 8. MCP Adapter

### 8.1 来源

MCP server 可以来自：

1. 用户本地配置。
2. Workspace 配置。
3. Sunlab profile。
4. 插件 manifest。
5. 组织策略下发。

### 8.2 启动方式

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@example/postgres-mcp"],
      "env": {
        "POSTGRES_DSN_REF": "sunlab-secret:local-db"
      },
      "trust": "ask",
      "allowedTools": ["describeSchema", "runReadOnlyQuery"]
    }
  }
}
```

### 8.3 安全要求

1. 插件提供的 MCP server 默认 `trust: ask`。
2. secret 引用由 Secret Broker 解析，不进入插件 manifest 明文。
3. tool allowlist 必须可展示。
4. 每次 tool call 记录 server/tool/hash。
5. 高风险 tool call 进入 Approval Center。

## 9. Workflow

### 9.1 Recipe 格式

Workflow 使用 YAML 或 JSON。

```yaml
$schema: https://sunlab.dev/schemas/workflow.v1.json
id: sunlab.fix-failing-tests
name: Fix Failing Tests
version: 1.2.0
trigger:
  type: manual
inputs:
  testCommand:
    type: string
    default: "npm test"
  maxAttempts:
    type: number
    default: 3
permissions:
  - workspace:read
  - workspace:write
  - process:spawn:npm-test
steps:
  - id: detect
    type: command
    run: "${inputs.testCommand}"
    continueOnError: true
  - id: repair
    type: agentTurn
    thread:
      cwd: "${workspace.root}"
      approvalPolicy: on-request
    promptFile: ./prompts/repair-tests.md
    context:
      - failingTests:${steps.detect.output.summary}
  - id: verify
    type: command
    run: "${inputs.testCommand}"
    approvals:
      - when: "steps.repair.changedFiles > 0"
        level: beforeRun
  - id: summarize
    type: agentTurn
    promptFile: ./prompts/summarize.md
```

### 9.2 Step Type

第一批支持：

| step | 说明 |
| --- | --- |
| `agentTurn` | 在指定 thread 中发起 Agent 任务。 |
| `command` | 受控执行命令。 |
| `mcpTool` | 调用 MCP tool。 |
| `approvalGate` | 强制人工确认。 |
| `input` | 请求用户输入。 |
| `condition` | 条件跳转。 |
| `parallel` | 并行子步骤。 |

### 9.3 Run 状态

```text
Pending
  -> Running
  -> WaitingApproval
  -> WaitingInput
  -> Paused
  -> Succeeded
  -> Failed
  -> Cancelled
```

每次 run 保存：

1. workflow id/version。
2. inputs（脱敏）。
3. 每个 step 的输出摘要。
4. thread/turn/item 引用。
5. 审批记录引用。
6. artifact 引用。

## 10. Context Provider

Context Provider 决定哪些额外信息进入 Agent 上下文。

类型：

1. static files。
2. glob files。
3. environment facts。
4. Git state。
5. recent failures。
6. service health。
7. database schema。
8. ticket metadata。

Provider MUST 声明：

```ts
type ContextContribution = {
  id: string;
  title: string;
  kind: "files" | "facts" | "snapshot";
  budget: {
    maxItems?: number;
    maxBytes?: number;
  };
  refresh: "manual" | "threadStart" | "turnStart" | "interval";
};
```

禁止 provider 静默读取 `.env`、credential store、SSH key 或系统浏览器数据。

## 11. Developer Platform

### 11.1 本地开发

推荐目录：

```text
my-sunlab-plugin/
├── sunlab.plugin.json
├── README.md
├── panels/
│   └── main.html
├── renderers/
│   └── deploy-status.js
├── workflows/
│   └── deploy-preview.yaml
└── tests/
    └── manifest.test.ts
```

CLI：

```bash
npx create-sunlab-plugin@latest my-sunlab-plugin
cd my-sunlab-plugin
sunlab plugin dev
```

`plugin dev` 提供：

1. manifest watch。
2. hot reload。
3. permission dry-run。
4. mock app-server。
5. protocol trace viewer。
6. UI sandbox。

### 11.2 TypeScript SDK

初步接口：

```ts
import { definePlugin } from "@sunlab/desktop-plugin";

export default definePlugin({
  activationEvents: ["onStartup"],
  activate(context) {
    context.ui.registerPanel({
      id: "service.health",
      location: "sidebar.right",
      title: "Service Health",
      render(root, api) {
        root.innerHTML = "<h2>Health</h2>";
      },
    });

    context.timeline.registerRenderer({
      itemType: "sunlab.deployStatus",
      render(item, api) {
        return api.html`<article>${item.data.url}</article>`;
      },
    });
  },
});
```

SDK MUST 保证：

1. 没有 manifest capability 的调用会在开发模式立刻报错。
2. 所有异步 API 可取消。
3. 所有事件带 source plugin id。
4. 类型从公开 schema 生成，而不是手写重复定义。

### 11.3 打包

```bash
sunlab plugin pack
```

产物：

```text
dist/dev.sunlab.deploy-preview-0.3.0.sunplug
dist/dev.sunlab.deploy-preview-0.3.0.sunplug.sha256
dist/manifest.json
```

Package MUST 包含：

1. normalized manifest。
2. file hashes。
3. publisher signature。
4. minimum host version。
5. permission summary。

## 12. Registry

第一版不要求公共 marketplace。

Registry 只需支持：

1. search。
2. metadata。
3. package download。
4. version resolution。
5. signature/checksum。
6. organization allowlist。

API 草案：

```http
GET /v1/plugins?query=deploy&platform=desktop
GET /v1/plugins/:id
GET /v1/plugins/:id/versions
GET /v1/plugins/:id/versions/:version/package
```

企业模式 SHOULD 支持私有 registry 和 offline bundle。

## 13. 与官方生态的关系

| 生态 | 策略 |
| --- | --- |
| MCP | 第一优先兼容；Sunlab plugin 的 tool 能力尽量落在 MCP 上。 |
| Codex Skills | 通过 app-server 管理；Sunlab 只做更好的发现、作用域和审计。 |
| Codex Plugins | 通过 app-server 管理；不重复实现安装逻辑。 |
| VS Code extension | 不作为第一目标；必要时共享 protocol core 思路。 |
| OpenAI-compatible providers | 由 Codex 配置层处理，Sunlab Desktop 不直接接管推理。 |

## 14. 安全边界与失败策略

1. 插件崩溃不能导致 app-server 崩溃。
2. 插件 UI 异常只降级该 contribution。
3. Permission broker 故障时新插件不能激活。
4. MCP server 无响应要显示健康状态并允许禁用。
5. Workflow 步骤失败必须暂停，不能盲目继续。
6. 所有插件 IPC 都有超时。
7. 所有敏感调用都有 audit id。

## 15. 实施路线

### Phase 1: Manifest and Static Contributions

1. manifest parser。
2. JSON Schema。
3. permission summary。
4. command registration。
5. static panel。
6. install/disable/uninstall。

### Phase 2: MCP Integration

1. MCP server registry。
2. health/status。
3. tool inspector。
4. approval mapping。
5. secret reference。

### Phase 3: Dynamic UI

1. webview bridge。
2. timeline renderer registry。
3. approval enhancer。
4. sandbox CSP。

### Phase 4: Worker Plugin

1. sidecar runtime。
2. capability RPC。
3. resource limits。
4. crash isolation。

### Phase 5: Workflow Platform

1. recipe parser。
2. run engine。
3. trigger system。
4. run history。
5. sharing format。

## 16. 验收标准

Extension Foundation 完成的标准：

1. 一个 declarative plugin 能安装、启用、禁用和卸载。
2. 未声明 capability 会被拒绝并有清晰错误。
3. 一个 MCP server 能被注册、查看健康状态并展示工具调用。
4. 一个自定义 timeline renderer 能接管指定 item type。
5. 一个 approval enhancer 能补充风险信息但不能自动批准。
6. 一个 workflow 能定义 manual trigger、agentTurn、command 和 approvalGate。
7. 插件崩溃后主应用和其他插件继续工作。

## 17. 开放问题

1. Worker runtime 使用 Node sidecar、Deno sidecar 还是 WASM？
2. Webview plugin 是否允许第三方 CDN 资产？
3. Team policy 是否需要集中式签名证书链？
4. Workflow 是否支持跨机器 resume？
5. Plugin storage 的配额和清理策略如何定义？

## 18. 结论

Sunlab Desktop 的超越点在于：把 Agent 从“聊天助手”升级为“可治理的工程执行平台”。插件不只是增加按钮，而是可以安全参与上下文、工具、审批、UI 和交付流程。

平台必须先建立 manifest、capability 和 permission broker，再开放动态 UI 与 Workflow。这样二次开发才能长期可信。
