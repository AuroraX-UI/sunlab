# Sunlab Codex Desktop

这是一个基于 Codex Harness `app-server` 的桌面客户端，使用 **Tauri 2 + React + TypeScript** 构建。它不是 CLI 包装器，而是通过 stdio JSON-RPC 2.0 直接驱动 `codex app-server`。

## 架构

```text
React UI
  ↓ Tauri invoke / event
Rust bridge
  ↕ stdin / stdout JSON-RPC 2.0
codex app-server
```

- `src-tauri/src/lib.rs`：负责启动子进程、分配请求 ID、等待响应，并区分通知、服务端请求和 supervisor 状态。
- `src/App.tsx`：负责线程启动、消息发送、时间线渲染、Agent 流式输出和审批弹窗。
- `src/core/protocol/state.ts`：归一化 thread、turn、item 和 approval 状态。
- `src/core/testing/fakeAppServer.ts`：提供确定性离线协议场景。
- `scripts/fake-codex-app-server.mjs`：提供可被桌面宿主和测试复用的 Node fake runtime。

## 当前能力

- 启动并初始化本机 `codex app-server`
- 创建线程（`thread/start`）
- 发送任务（`turn/start`）
- 渲染 Agent 消息增量与完成后的工具/文件变更项
- 转发并处理审批请求（例如 `item/commandExecution/requestApproval`）
- 显示原始 JSON-RPC 协议事件，便于继续开发

## 使用

确认本机已安装 Codex CLI 并完成登录：

```bash
codex --version
codex login status
```

安装依赖后启动开发模式：

```bash
pnpm install
pnpm tauri dev
```

使用 fake Codex runtime 启动：

```bash
SUNLAB_CODEX_BIN=./scripts/fake-codex-app-server.mjs \
SUNLAB_FAKE_SCENARIO=happy-turn \
pnpm tauri dev
```

在界面中输入工作区绝对路径，点击 **连接 Codex**。连接成功后即可发送任务；使用 `Cmd/Ctrl + Enter` 发送。

## 缓存与配置路径

编译产物和依赖已定向到外部缓存卷：

- 前端构建产物：`/Volumes/fushilu/.caches/sunlab/desktop/dist`
- Rust 目标目录：`/Volumes/fushilu/.caches/sunlab/cargo-target`
- pnpm store：`/Volumes/fushilu/.caches/pnpm/store`
- pnpm virtual store：`/Volumes/fushilu/.caches/sunlab/pnpm/virtual-store`
- 项目依赖链接目录：项目内真实 `node_modules/`，包链接指向外部 virtual store

当前仍默认复用 Codex CLI 的登录态。需要切换到 Sunlab 专用配置时，使用：

```bash
SUNLAB_CODEX_HOME=/Volumes/fushilu/.caches/sunlab/codex-home pnpm tauri dev
```

首次切换后需要在新的 `CODEX_HOME` 中重新完成 Codex 登录。

## 常用检查

```bash
pnpm test
pnpm typecheck
pnpm build
npm run check:rust
npm run test:rust
pnpm verify
```

查看全部 fake 场景：

```bash
pnpm fake:list
```

项目内的 `npm run check:rust` 和 `npm run tauri` 会移除外部注入的 `CARGO_TARGET_DIR`，确保 Cargo 使用 Sunlab 的独立目标目录；`src-tauri/target` 是指向该目录的符号链接，用于兼容 Tauri 构建脚本。

## 后续扩展点

- 用官方 schema 生成强类型：`codex app-server generate-ts --out src/generated`
- 增加线程列表、恢复、归档和搜索
- 渲染 diff、终端输出、MCP 工具调用和 reasoning 卡片
- 为不同产品角色定义默认工作区、权限边界与审批策略
