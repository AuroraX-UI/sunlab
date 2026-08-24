# Sunlab Codex Desktop

基于 Codex Harness `app-server` 的桌面客户端，使用 **Electron + React + TypeScript** 构建。
通过 stdio JSON-RPC 2.0 直接驱动 `codex app-server`，不是 CLI 包装器。

## 架构

```text
Renderer (React 19)
  ↕ MessagePort / IPC Bridge（类型安全）
Main Process (Node.js)
  ├─ Supervisor：spawn + 管理 codex app-server 子进程
  └─ Protocol Kernel：FrameCodec + RequestManager
        ↕ stdin / stdout NDJSON JSON-RPC 2.0
codex app-server
```

详细设计见 [docs/rfc/](./docs/rfc/) 目录。

## 目录结构

```text
src/
main/               Electron 主进程
preload/            Context bridge
renderer/           React UI
core/               协议内核（跨环境共享）
shared/             纯类型和常量
scripts/            构建和开发脚本
docs/rfc/           架构决策文档
third_party/codex/  受控 fork 治理
e2e/                Playwright E2E 测试
```

## 快速开始

### 前置条件

- Node.js 22+
- pnpm 10+
- 本机已安装 Codex CLI 并完成登录

```bash
codex --version
codex login status
```

### 安装与启动

```bash
source .env.caches   # 加载外部缓存路径
pnpm install
pnpm dev
```

使用 fake app-server（无需真实 Codex CLI）：

```bash
SUNLAB_CODEX_BIN=./scripts/fake-codex-app-server.mjs \
SUNLAB_FAKE_SCENARIO=happy-turn \
pnpm dev
```

## 常用命令

```bash
pnpm dev          # 启动开发模式（HMR）
pnpm build        # 生产构建
pnpm test         # Vitest 单元测试
pnpm typecheck    # TypeScript 检查
pnpm verify       # 全量验证（lint + typecheck + test + build）
pnpm fake:list    # 列出全部 fake 场景
```

## 缓存路径

所有构建产物存储在 `/Volumes/fushilu/.caches/` 下：

| 用途 | 路径 |
|------|------|
| pnpm 全局包存储 | `/Volumes/fushilu/.caches/pnpm/store` |
| Electron 二进制 | `/Volumes/fushilu/.caches/electron` |
| Vite 构建输出 | `/Volumes/fushilu/.caches/sunlab/desktop/dist` |
| electron-builder 打包 | `/Volumes/fushilu/.caches/sunlab/desktop/release` |
| Playwright 浏览器 | `/Volumes/fushilu/.caches/ms-playwright` |

配置文件：`.npmrc`（包管理）和 `.env.caches`（环境变量）。

## 后续扩展点

- 官方 schema 类型生成：`codex app-server generate-ts`
- 线程列表、恢复、归档和搜索
- Diff 渲染、终端输出、MCP 工具调用卡片
- 插件系统与扩展 SDK
- 自动更新与多 channel 分发
