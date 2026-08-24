# Sunlab Desktop AI 编码规则

本文件是 AI 编码助手（Codex、Cursor、Copilot 等）在本仓库中工作的最高优先级指令。
违反以下规则的代码变更不应被提交。

## 1. 语言规范

### 1.1 强制使用中文的场景

| 场景 | 要求 |
|------|------|
| 代码注释 | 全部使用中文 |
| Git 提交信息 | 标题和正文均使用中文 |
| 文档（RFC/ADR/README） | 全部使用中文 |
| 变量/函数命名 | 使用英文（遵循业界惯例） |
| 错误消息 | 面向开发者的错误用英文，面向用户的 UI 文案用中文 |
| PR 标题和描述 | 中文 |
| Code Review 评论 | 中文 |

### 1.2 提交信息格式

```
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

示例：
```
feat: 实现类型安全的 IPC 通道注册器

主进程通过 registerHandler 注册回调，preload 通过 invoke 调用，
TypeScript 编译器自动推导 request/response 类型。

Closes #42
```

## 2. 目录结构与模块边界

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

### 2.1 依赖方向规则（严格单向）

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

### 2.2 每个目录的职责边界

| 目录 | 允许做的事 | 禁止做的事 |
|------|-----------|-----------|
| `shared/` | 类型定义、常量、枚举 | 任何副作用（I/O、进程、DOM） |
| `core/` | 协议解析、状态 reducer、数据转换 | DOM 操作、Electron API |
| `main/` | 进程管理、文件系统、IPC 注册 | React 渲染逻辑 |
| `preload/` | contextBridge 暴露 | 业务逻辑、状态管理 |
| `renderer/` | React 组件、Zustand store、hooks | 直接访问 Node.js API 或 child_process |

## 3. 代码风格

### 3.1 工具链

使用 Biome 2.x 进行代码检查和格式化。不使用 ESLint 和 Prettier。

```bash
pnpm lint    # 检查
pnpm format  # 格式化并写入
```

### 3.2 TypeScript 规则

- `strict: true` 是底线，不允许关闭。
- 不使用 `any`。如果确实不知道类型，使用 `unknown` 并在消费处收窄。
- 导出函数和类必须有 JSDoc 注释（中文）。
- 优先使用 `interface` 定义对象形状，`type` 用于联合类型和工具类型。
- 异步函数返回 `Promise<T>`，不允许隐式返回 `Promise<void>` 除非确实无返回值。

### 3.3 命名约定

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 文件名 | kebab-case | `request-manager.ts` |
| 目录名 | kebab-case | `ipc-handlers/` |
| 变量/函数 | camelCase | `sendMessage()` |
| 类/接口/类型 | PascalCase | `RequestManager` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FRAME_BYTES` |
| React 组件 | PascalCase | `ApprovalDialog` |
| Zustand store | camelCase + Store 后缀 | `useUiStore` |
| IPC channel | 冒号分隔 kebab-case | `'app-server:request'` |
| Tauri/Electron 事件 | `protocol://` 前缀 | `'protocol://notification'` |

### 3.4 注释规范

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

- 每个**导出**的函数、类、接口必须有 JSDoc。
- 行内注释用 `//` + 空格 + 中文。
- 不要写「这个函数做了什么」这种重复注释；要写「为什么这样做」。

## 4. 错误处理

### 4.1 主进程错误

主进程中的所有异步操作 MUST 有 try-catch 或 `.catch()`。
未捕获的 Promise rejection 在 Electron 主进程中会导致未定义行为。

```typescript
// main/supervisor.ts
async function startAppServer(config: RuntimeConfig): Promise<void> {
  try {
    const child = spawn(config.program, config.args, { stdio: ['pipe', 'pipe', 'inherit'] });
    // ...
  } catch (error) {
    throw new SupervisorError('启动 app-server 失败', { cause: error });
  }
}
```

### 4.2 Renderer 错误

Renderer 中的 IPC 调用 MUST 处理 rejection：

```typescript
const result = await window.sunlab.invoke('app-server:request', params)
  .catch((error) => {
    console.error('app-server 请求失败:', error);
    return null;
  });
```

### 4.3 自定义错误类

每个模块可以定义自己的错误类，继承自 `Error`：

```typescript
export class SupervisorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SupervisorError';
  }
}
```

禁止在业务代码中使用裸字符串作为错误。

## 5. 测试要求

### 5.1 必须编写测试的场景

1. 所有导出的纯函数（reducer、codec、工具函数）。
2. Zustand store 的状态转换。
3. XState machine 的关键路径。
4. Supervisor 的生命周期管理（使用 mock child_process）。

### 5.2 测试文件位置

测试文件与被测文件同目录，命名为 `<filename>.test.ts`：

```text
src/core/protocol/client.ts
src/core/protocol/client.test.ts    ← 同目录
```

### 5.3 运行命令

```bash
pnpm test         # Vitest 单元测试
pnpm test:e2e     # Playwright E2E 测试
pnpm verify       # 全量验证（lint + typecheck + test + build）
```

## 6. 安全红线

以下规则违反任何一条都应立即阻止合并：

1. **不开启 nodeIntegration**：BrowserWindow 的 webPreferences 中 nodeIntegration 必须为 false。
2. **不禁用 contextIsolation**：必须为 true。
3. **不在 preload 中暴露完整 require 或 fs**。
4. **不从远程 URL 加载内容**：renderer 只加载本地资源。
5. **不将 API key 写入代码或日志**。
6. **不在 renderer 中直接调用 child_process**。
7. **CSP 至少限制为 default-src 'self'**。

## 7. 外部缓存路径

所有构建产物和大型二进制存储在 `/Volumes/fushilu/.caches/` 下：

| 用途 | 路径 |
|------|------|
| pnpm 全局包存储 | `/Volumes/fushilu/.caches/pnpm/store` |
| Electron 二进制 | `/Volumes/fushilu/.caches/electron` |
| Vite 构建 | `/Volumes/fushilu/.caches/sunlab/desktop/dist` |
| electron-builder 打包 | `/Volumes/fushilu/.caches/sunlab/desktop/release` |
| Playwright 浏览器 | `/Volumes/fushilu/.caches/ms-playwright` |

配置文件：`.npmrc`（包管理）和 `.env.caches`（环境变量）。
AI 助手不应修改这些路径，除非用户明确要求。

## 8. 文档约定

- RFC 文件放在 `docs/rfc/` 下，编号递增。
- ADR（架构决策记录）也是 RFC 格式，但状态为 `Accepted`。
- README.md 保持简洁，指向 docs/rfc/ 获取详细设计。
- 每个新模块 SHOULD 在创建时附带一段 JSDoc 模块级注释说明其职责。

## 9. 禁止事项汇总

1. 禁止引入新的 UI 框架（只用 React）。
2. 禁止引入 CSS-in-JS 库（只用 Tailwind CSS v4）。
3. 禁止引入 Redux/MobX（用 Zustand + XState）。
4. 禁止安装 ESLint 或 Prettier（用 Biome 替代）。
5. 禁止修改 `.env.caches` 和 `.npmrc` 中的路径配置。
6. 禁止在 `src/core/` 中导入 Electron 或 Node.js 特有模块。
7. 禁止在 `src/shared/` 中有任何副作用（包括 console.log）。
8. 禁止跳过 `pnpm verify` 直接提交。
