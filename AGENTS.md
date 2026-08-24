# Sunlab Desktop — AI 编码规则

本文件是 AI 编码助手（Codex、Cursor、Copilot 等）在本仓库中工作的最高优先级指令。
违反以下规则的代码变更不应被提交。

## 项目定位与当前阶段

Sunlab Desktop 是一个基于 Electron 的 Codex `app-server` 桌面客户端，
目标是替代并超越官方 Codex Desktop。

当前处于 **Phase 1（Electron 最小壳）** 阶段（见 RFC 0009）。

| 阶段 | 状态 | 优先级 |
|------|------|--------|
| Phase 1：最小壳 + Supervisor + 对话 UI | 进行中 | 最高 |
| Phase 2：性能基线 + MessagePort | 未开始 | 高 |
| Phase 3：自动更新 + 多窗口 + 托盘 | 未开始 | 中 |
| 插件系统与扩展 SDK | 未开始 | 视需求 |

AI 助手在编写代码时应优先推进当前阶段任务，避免提前实现后续阶段的功能。

---

## 1. 语言规范

### 1.1 强制中文的场景

| 场景 | 要求 |
|------|------|
| 代码注释（`//` 和 JSDoc） | 全部使用中文 |
| Git 提交信息（标题和正文） | 中文 |
| 文档（RFC / ADR / README / CONTRIBUTING） | 中文 |
| PR 标题和描述 | 中文 |
| Code Review 评论 | 中文 |
| UI 用户可见文案 | 中文 |

### 1.2 强制英文的场景

| 场景 | 要求 |
|------|------|
| 变量、函数、类名 | camelCase 或 PascalCase 英文 |
| 文件名和目录名 | kebab-case 英文 |
| 错误消息（面向开发者） | 英文 |
| 常量名 | UPPER_SNAKE_CASE 英文 |
| Git 分支名 | kebab-case 英文 |

### 1.3 提交信息格式

```text
<类型>: <中文摘要，不超过 50 字>

<可选正文：解释动机和上下文，中文>

<可选尾行：Closes #issue>
```

类型必须是以下之一：
- `feat`：新功能
- `fix`：缺陷修复
- `refactor`：重构（不改变行为）
- `docs`：文档
- `style`：格式调整（不影响逻辑）
- `test`：测试
- `chore`：构建、依赖或工具链变更

---

## 2. 架构与模块边界

### 2.1 目录结构

```text
src/
main/               Electron 主进程（Node.js 环境）
preload/            Context bridge（隔离层）
renderer/           React UI（浏览器环境）
core/               协议内核（跨环境共享）
shared/             纯类型和常量（无副作用，所有层可导入）
scripts/            构建和开发脚本
docs/rfc/           架构决策文档
third_party/codex/  受控 fork 治理
e2e/                Playwright E2E 测试
```

### 2.2 依赖方向规则（严格单向）

```text
shared ← core ← main
              ← preload
              ← renderer

renderer → shared     ✅ 允许
renderer → core       ❌ 禁止（renderer 不直接操作协议）
renderer → main       ❌ 禁止（必须经过 preload bridge）
main → core           ✅ 允许
main → renderer       ❌ 禁止
preload → core        ❌ 禁止（preload 只做透传）
任何层 → shared       ✅ 允许
shared → 其他层       ❌ 禁止
```

### 2.3 每个目录的职责边界

| 目录 | 允许做的事 | 禁止做的事 |
|------|-----------|-----------|
| `shared/` | 类型定义、常量、枚举 | 任何副作用（I/O、进程、DOM） |
| `core/` | 协议解析、状态 reducer、数据转换 | DOM 操作、Electron API、Node.js API |
| `main/` | 进程管理、文件系统、IPC 注册 | React 渲染逻辑、DOM 操作 |
| `preload/` | contextBridge 暴露 | 业务逻辑、状态管理、协议解析 |
| `renderer/` | React 组件、Zustand store、hooks | 直接访问 Node.js API 或 child_process |

### 2.4 边界验证方式

违反边界规则的代码可以通过以下方式检测：

1. TypeScript Project References：各子目录独立 tsconfig，编译器阻止越界导入。
2. Biome 规则：配置 `noRestrictedImports` 禁止特定导入路径。
3. Code Review：PR 描述必须说明新增 import 是否跨越了模块边界。

---

## 3. 决策层级

AI 助手在遇到不确定情况时按以下层级判断：

| 层级 | 场景 | 行为 |
|------|------|------|
| 自主执行 | 当前阶段明确要求的任务；已有 RFC 覆盖的实现细节 | 直接实现，写测试，跑 verify |
| 写注释说明 | 实现时发现设计假设与代码实际情况不一致 | 在代码中添加 TODO 注释说明差异 |
| 向用户提问 | 影响公共 API 签名、数据模型或安全边界的变更 | 先描述方案再动手 |
| 新建 RFC | 引入新技术栈、改变架构分层、修改安全模型 | 必须先写 RFC 并获得用户确认 |

**禁止自主决策的情况：**
1. 修改 `.npmrc` 或 `.env.caches` 中的路径。
2. 更改 BrowserWindow 安全配置（nodeIntegration、contextIsolation 等）。
3. 在 `src/core/` 中引入 Electron 或 Node.js 特有模块。
4. 删除或跳过测试用例。

---

## 4. 代码风格

### 4.1 工具链

使用 Biome 2.x。禁止引入 ESLint 或 Prettier。

```bash
pnpm lint    # 检查
pnpm format  # 格式化并写入
```

### 4.2 TypeScript 规则

- `strict: true` 是底线，不允许关闭。
- 不使用 `any`。不知道类型时使用 `unknown` 并在消费处收窄。
- 导出函数和类必须有中文 JSDoc 注释。
- 优先使用 `interface` 定义对象形状，`type` 用于联合类型。
- 异步函数返回 `Promise<T>`，不允许隐式 `Promise<void>` 除非确实无返回值。
- 使用 `satisfies` 操作符进行类型检查而不改变推断类型。

### 4.3 命名约定

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 文件名 | kebab-case | `request-manager.ts` |
| 目录名 | kebab-case | `ipc-handlers/` |
| 变量/函数 | camelCase | `sendMessage()` |
| 类/接口/类型 | PascalCase | `RequestManager` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FRAME_BYTES` |
| React 组件 | PascalCase | `ApprovalDialog` |
| Zustand store | use 前缀 + Store 后缀 | `useUiStore` |
| XState machine | camelCase + Machine 后缀 | `approvalMachine` |
| IPC channel | 冒号分隔 kebab-case | `'app-server:request'` |
| Electron 事件 | `protocol://` 前缀 | `'protocol://notification'` |

### 4.4 注释规范

每个导出的函数、类、接口必须有中文 JSDoc：

```typescript
/**
 * 将 JSON-RPC 消息编码为 NDJSON 帧。
 *
 * @param message - 待序列化的 JSON-RPC 对象
 * @returns 包含换行符的 Uint8Array
 * @throws {FrameTooLargeError} 当序列化后超过 maxFrameBytes 时抛出
 */
export function encode(message: JsonRpcMessage): Uint8Array {
```

- 行内注释用 `// ` 开头，写「为什么」而不是「做了什么」。
- 不写无意义的重复注释（如 `// 导入 React`）。

---

## 5. 状态管理模式

### 5.1 分层原则

| 数据类型 | 存储位置 | 示例 |
|---------|---------|------|
| 服务端事实（app-server 状态） | Protocol Kernel reducer | threads, items, turns |
| 派生 UI 状态 | Zustand selector | filteredThreads, visibleItems |
| 流程控制 | XState machine | approvalFlow, turnLifecycle |
| 临时表单状态 | React useState | draftMessage, searchQuery |

### 5.2 Zustand 使用规则

1. 每个 store 只管理一个关注点（UI 状态、通知偏好等），不混合协议状态。
2. 使用 `subscribeWithSelector` middleware 支持细粒度订阅。
3. 禁止在 Zustand store 中直接调用 IPC——通过自定义 hook 封装。
4. selector 返回引用稳定的值，避免不必要的重渲染。

### 5.3 XState 使用规则

1. 只用于有明确状态转换图的场景（审批流、turn 生命周期、连接状态）。
2. machine 定义放在 `src/renderer/machines/` 下。
3. 使用 `setup()` API 创建 typed machine。
4. 禁止在 machine action 中直接调用 IPC——通过 actor 回调或 event 处理。

---

## 6. IPC 模式

### 6.1 添加新 IPC 通道的步骤

1. 在 `shared/ipc-contract.ts` 中定义 channel 类型和 request/response 类型。
2. 在 `main/ipc-handlers.ts` 中注册 handler。
3. 在 `preload/api.ts` 中暴露 invoke/on 方法。
4. 在 `renderer/hooks/` 中封装自定义 hook。
5. 编写单元测试覆盖 handler 逻辑。

### 6.2 高频事件流

高频事件（如 app-server 通知流）不走 `ipcMain.handle`，
使用 `MessageChannelMain` 建立直连通道以减少序列化开销。

### 6.3 类型安全

IPC contract 使用 TypeScript 泛型推导：

```typescript
export interface IpcContract {
  'app-server:request': {
    request: { method: string; params?: unknown };
    response: unknown;
  };
}
```

renderer 调用时编译器自动推导参数和返回值类型，无需手动断言。

---

## 7. 错误处理

### 7.1 主进程

所有异步操作必须有 try-catch 或 `.catch()`。
未捕获的 Promise rejection 在 Electron 主进程中会导致未定义行为。

```typescript
async function startAppServer(config: RuntimeConfig): Promise<void> {
  try {
    const child = spawn(config.program, config.args);
  } catch (error) {
    throw new SupervisorError('启动 app-server 失败', { cause: error });
  }
}
```

### 7.2 Renderer

IPC 调用必须处理 rejection：

```typescript
const result = await window.sunlab.invoke('app-server:request', params)
  .catch((error) => {
    console.error('app-server 请求失败:', error);
    return null;
  });
```

### 7.3 自定义错误类

每个模块可以定义自己的错误类继承自 `Error`。
禁止在业务代码中使用裸字符串 throw。

---

## 8. 测试策略

### 8.1 测试金字塔

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest | Protocol Kernel reducers、Zustand stores、XState machines、纯函数 |
| 集成测试 | Vitest + fake app-server | Supervisor + Codec + RequestManager 全链路 |
| E2E 测试 | Playwright `_electron` | 启动真实 Electron 进程，验证 UI 交互 |

### 8.2 必须编写测试的场景

1. 所有导出的纯函数（reducer、codec、工具函数）。
2. Zustand store 的状态转换。
3. XState machine 的关键路径。
4. Supervisor 的生命周期管理（mock child_process）。
5. IPC handler 的输入校验和错误处理。

### 8.3 测试文件位置

与被测文件同目录，命名为 `<filename>.test.ts`。

---

## 9. 安全红线

以下规则违反任何一条都应立即阻止合并：

1. nodeIntegration 必须为 false。
2. contextIsolation 必须为 true。
3. sandbox 必须为 true。
4. 不从远程 URL 加载内容。
5. 不将 API key 写入代码或日志。
6. 不在 renderer 中直接调用 child_process。
7. CSP 至少限制为 default-src 'self'。
8. 不在 preload 中暴露完整 require 或 fs。
9. 不绕过用户审批流程。
10. 不移除沙箱边界检查。

---

## 10. 性能预算

| 指标 | 目标 | CI 门禁 |
|------|------|---------|
| 冷启动到可交互 | <1500ms | Phase 2 建立 |
| 空闲内存（单窗口） | <120MB | Phase 2 建立 |
| 流式输出帧率 | >55fps | Phase 2 建立 |
| Renderer bundle gzip | <300KB | 每次 build 检查 |

Phase 1 阶段手动测量并记录基线数据，Phase 2 建立 CI 自动门禁。

---

## 11. 外部缓存路径

所有构建产物和大型二进制存储在 `/Volumes/fushilu/.caches/` 下。
配置文件：`.npmrc`（包管理）和 `.env.caches`（环境变量）。
AI 助手不应修改这些路径。

---

## 12. 文档规范

### 12.1 文档层级

| 文档 | 位置 | 用途 |
|------|------|------|
| README.md | 项目根目录 | 快速上手，指向详细设计 |
| ARCHITECTURE.md | 项目根目录 | 进程模型、技术栈速查、决策索引 |
| CONTRIBUTING.md | 项目根目录 | 贡献流程、命令速查 |
| AGENTS.md | 项目根目录 | AI 编码规则（本文件） |
| RFC / ADR | docs/rfc/ | 架构决策记录，编号递增 |

### 12.2 何时需要写 RFC

1. 引入新的技术栈或框架。
2. 改变进程间通信模式。
3. 修改安全模型或沙箱策略。
4. 设计新的插件 API。
5. 改变上游同步策略。

RFC 格式参考现有文件（0001–0009），包含：摘要、动机、详细设计、风险、退出条件。

---

## 13. Git 工作流

### 13.1 分支命名

```text
feat/<功能简述>     新功能
fix/<缺陷简述>      缺陷修复
refactor/<范围>     重构
docs/<主题>         文档
```

### 13.2 PR 流程

1. 从 `main` 创建功能分支。
2. 完成开发和测试，确保 `pnpm verify` 通过。
3. 创建 PR，使用中文标题和描述。
4. 至少一人 Code Review 后合并（squash merge）。

### 13.3 提交前检查清单

- [ ] 所有注释使用中文
- [ ] 提交信息使用中文且符合格式
- [ ] `pnpm verify` 通过
- [ ] 新增导出函数有中文 JSDoc
- [ ] 无 `any` 类型泄漏
- [ ] 未修改 `.npmrc` 或 `.env.caches`
- [ ] 未违反模块依赖方向规则

---

## 14. 禁止事项汇总

1. 禁止引入新的 UI 框架（只用 React）。
2. 禁止引入 CSS-in-JS 库（只用 Tailwind CSS v4）。
3. 禁止引入 Redux/MobX（用 Zustand + XState）。
4. 禁止安装 ESLint 或 Prettier（用 Biome 替代）。
5. 禁止修改 `.env.caches` 和 `.npmrc` 中的路径配置。
6. 禁止在 `src/core/` 中导入 Electron 或 Node.js 特有模块。
7. 禁止在 `src/shared/` 中有任何副作用（包括 console.log）。
8. 禁止跳过 `pnpm verify` 直接提交。
9. 禁止删除现有测试用例来让构建通过。
10. 禁止在 renderer 中直接 import Node.js 内置模块。

---

## 附录 A：功能添加检查清单

当需要添加一个新功能时，按以下顺序确认：

1. **是否需要 RFC？** 对照 §12.2 判断。
2. **属于哪个阶段？** 如果不是当前阶段的任务，标注为 backlog。
3. **影响哪些模块？** 按 §2.2 依赖方向确认改动范围。
4. **需要新的 IPC channel？** 按 §6.1 步骤操作。
5. **需要新的状态？** 按 §5.1 分层原则确定存储位置。
6. **需要新的错误类型？** 按 §7.3 创建自定义 Error 子类。
7. **测试怎么写？** 按 §8 确定测试层级和位置。
8. **性能影响？** 对照 §10 预算评估。

## 附录 B：常见反模式

以下是 AI 助手容易犯但不应犯的错误：

| 反模式 | 正确做法 |
|--------|---------|
| 在 renderer 中直接调用 `spawn()` | 通过 IPC 让主进程调用 |
| 在 Zustand store 中存储原始 JSON-RPC 响应 | Protocol Kernel reducer 是唯一事实来源 |
| 在 `core/` 中 import `electron` | core 是环境无关的，只做纯计算 |
| 用 `any` 绕过类型检查 | 使用 `unknown` + type guard 收窄 |
| 在 preload 中做业务逻辑 | preload 只做 contextBridge 透传 |
| 跳过测试因为"改动很小" | 所有导出函数必须有测试 |
| 在注释中写英文 | 注释全部使用中文 |
| 直接修改上游 codex 文件 | 在 `third_party/codex/sunlab/` 中扩展 |
