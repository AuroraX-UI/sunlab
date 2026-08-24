# RFC 0009: Electron Phase 1 工程执行计划

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-24
- 前置文档：[ADR 0007](./0007-electron-migration.md)、[RFC 0008](./0008-electron-tech-stack.md)

## 1. 目标

Phase 1 的交付物是一个可启动的 Electron 最小壳：

1. `pnpm dev` 启动 Electron 窗口，加载 React UI。
2. 主进程通过 child_process 启动 fake app-server。
3. Renderer 通过类型安全 IPC bridge 与主进程通信。
4. 对话界面可以发送消息并接收流式响应。
5. `pnpm verify` 覆盖前端单测 + 类型检查 + 构建。

Phase 1 不包含：自动更新、系统托盘、多窗口、插件系统、真实 app-server 集成。

## 2. 任务拆解

### Task 1：依赖安装与构建配置

**操作**：
1. 移除 Tauri 依赖（`@tauri-apps/api`、`@tauri-apps/cli`）。
2. 安装 Electron 及工具链（见 RFC 0008 §5）。
3. 创建 `electron.vite.config.ts` 替代现有 `vite.config.ts`。
4. 配置 TS Project References。

**验收**：
- `pnpm install` 无报错。
- `pnpm typecheck` 通过。
- `pnpm build` 输出到 `/Volumes/fushilu/.caches/sunlab/desktop/dist/`。

**预估工作量**：0.5 天

---

### Task 2：Electron 主进程入口

**操作**：
1. 创建 `src/main/index.ts`——创建 BrowserWindow，加载 renderer URL 或文件。
2. 创建 `src/main/windows.ts`——窗口配置（尺寸、安全设置、CSP）。
3. 安全加固：nodeIntegration false、contextIsolation true、sandbox true。
4. 开发模式加载 Vite dev server URL；生产模式加载 dist/index.html。

**验收**：
- `pnpm dev` 打开一个空白 Electron 窗口，React App 渲染成功。
- DevTools 可打开（仅开发模式）。
- 关闭窗口后进程优雅退出。

**预估工作量**：0.5 天

---

### Task 3：Preload Context Bridge

**操作**：
1. 创建 `src/preload/api.ts`——暴露类型安全的 invoke 和 on 方法。
2. 定义 `shared/ipc-contract.ts`——所有 IPC channel 的 TypeScript 类型。
3. 在 renderer 中声明 `window.sunlab` 全局类型。

**验收**：
- `window.sunlab.invoke('app-server:start', undefined)` 从 renderer 发出 IPC 调用。
- TypeScript 编译器能推导 request/response 类型，无 any 泄漏。

**预估工作量**：0.5 天

---

### Task 4：App-Server Supervisor

**操作**：
1. 创建 `src/main/supervisor.ts`——spawn 子进程、stdio pipe、生命周期管理。
2. 支持 fake app-server（Node.js script）和真实 codex binary 两种模式。
3. 实现 FrameCodec（NDJSON 解析）和 RequestManager（ID 映射 + 超时清理），复用或重写自 `src/core/protocol/`。
4. 实现 stderr 日志转发。
5. 进程退出时 fail_all pending requests 并通知 renderer。

**验收**：
- Supervisor 能启动 `scripts/fake-codex-app-server.mjs` 并完成 initialize 握手。
- 发送请求能收到响应。
- 杀死子进程后 pending requests 收到 TransportClosed 错误。
- 单元测试覆盖 supervisor 核心逻辑（不依赖真实进程）。

**预估工作量**：1.5 天

---

### Task 5：IPC Handlers 注册

**操作**：
1. 创建 `src/main/ipc-handlers.ts`——注册 ipcMain.handle 回调。
2. 暴露三个操作：start / request / resolve。
3. 将 app-server 通知通过 MessageChannelMain 推送到 renderer。

**验收**：
- Renderer 可以调用 `window.sunlab.invoke('app-server:start', ...)` 触发 supervisor 启动。
- Renderer 通过 `window.sunlab.on('app-server:event', callback)` 接收通知流。

**预估工作量**：0.5 天

---

### Task 6：最小对话 UI

**操作**：
1. 重构 `src/renderer/App.tsx`——对话时间线 + 消息输入框 + 发送按钮。
2. 使用 Zustand store 管理消息列表状态。
3. 连接 IPC bridge：发送用户输入 → app-server → 流式渲染回复。
4. 显示 supervisor 状态指示器（starting / ready / stopped / failed）。
5. Tailwind CSS v4 基础样式（暗色主题）。

**验收**：
- 用户输入 "hello" 后能看到 fake app-server 的流式回复逐字出现。
- 页面无 React 警告或 hydration mismatch。
- 窗口缩放到最小宽度时布局不错位。

**预估工作量**：1 天

---

### Task 7：测试与验证脚本

**操作**：
1. 更新 `package.json` scripts：移除 Tauri/Rust 相关命令。
2. 新增 Playwright E2E 测试（至少一个 smoke test）。
3. 更新 `pnpm verify` 为：biome check + vitest + tsc + electron-vite build + playwright test。
4. 确保 `.env.caches` 被 CI 和开发流程 source。

**验收**：
- `pnpm verify` 全部通过。
- E2E 测试在本地 macOS 上运行成功。

**预估工作量**：0.5 天

---

### Task 8：归档 Tauri 代码

**操作**：
1. 将 `src-tauri/` 移入 `_archived/tauri/`（保留 git 历史）。
2. 删除 Cargo.toml、tauri.conf.json 等配置文件。
3. 清理 package.json 中残留的 Tauri 引用。

**验收**：
- 项目根目录无 src-tauri 目录。
- `rg -r "tauri" --type ts --type json` 无匹配（排除 docs/）。

**预估工作量**：0.25 天

## 3. 执行顺序与依赖关系

```text
Task 8 (归档)     ← 无依赖，最先做，避免干扰
    ↓
Task 1 (依赖安装) ← 需要 src-tauri 已移除
    ↓
Task 2 (主进程)   ← 需要 electron-vite 配置就绪
    ↓
Task 3 (preload)  ← 需要 BrowserWindow 存在才能验证
    ↓
Task 4 (supervisor) ← 可与 Task 3 并行开发
    ↓
Task 5 (IPC handlers) ← 需要 Task 3 + Task 4 都就绪
    ↓
Task 6 (UI)       ← 需要 Task 5 的 IPC bridge 可用
    ↓
Task 7 (测试)     ← 最后收口
```

推荐 PR 序列：

| PR | 包含任务 | 预估 |
|----|---------|------|
| PR-1 | Task 8 + Task 1 | 归档 + 依赖迁移 |
| PR-2 | Task 2 + Task 3 | 最小壳 + IPC bridge |
| PR-3 | Task 4 | Supervisor + 协议层 |
| PR-4 | Task 5 + Task 6 | 完整链路 + UI |
| PR-5 | Task 7 | 测试收口 |

## 4. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Electron 版本 API 变更 | 主进程代码需要调整 | 锁定 minor version，关注 changelog |
| Tailwind v4 CSS-first 兼容性 | 现有样式可能需要重写 | Phase 1 只写新样式，不迁移旧样式 |
| Playwright Electron 支持不稳定 | E2E 可能 flaky | 先用 Vitest 集成测试兜底，E2E 作为补充 |
| pnpm virtual-store 外部路径权限 | 某些平台 symlink 失败 | macOS APFS 支持 symlink，暂不考虑 Windows |
| fake app-server 与真实协议差异 | Supervisor 逻辑可能在真实场景失败 | R1 已建立 protocol contract gate；Phase 2 接入真实 binary 时验证 |

## 5. Definition of Done

Phase 1 完成的标志：

1. `git clone && pnpm install && source .env.caches && pnpm dev` 能打开可用窗口。
2. 对话界面能通过 fake app-server 收发消息并展示流式输出。
3. `pnpm verify` 绿色通过。
4. 性能基线数据已记录（冷启动、空闲内存）。
5. README 包含开发者上手指南。
