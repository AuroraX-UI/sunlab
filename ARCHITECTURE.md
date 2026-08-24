# 架构概览

本文是快速索引。完整设计见 [docs/rfc/](./docs/rfc/) 目录。

## 进程模型

```text
┌─────────────────────────────────────────────┐
│              Electron Main                   │
│                                              │
│  Supervisor ── spawn ──→ codex app-server    │
│       │                    (stdio NDJSON)   │
│  Protocol Kernel (FrameCodec + RequestMgr)  │
│       │                                      │
│       │ MessagePort                          │
└───────┼─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│           Renderer (React)                   │
│   Timeline · Tool Cards · Approval · Editor  │
└─────────────────────────────────────────────┘
```

## 模块依赖方向

```text
shared ← core ← main ← preload ← renderer
```

严格单向。renderer 不直接访问 Node.js 或 child_process。

## 技术栈速查

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron v37+ |
| 构建 | electron-vite v3 |
| UI | React 19 + Tailwind CSS v4 |
| 组件 | Radix UI |
| 状态 | Zustand v5（UI）+ XState v5（流程） |
| IPC | 自研类型安全 bridge |
| 质量 | Biome 2.x |
| 测试 | Vitest 3 + Playwright |
| 打包 | electron-builder |

## 关键决策索引

| 决策 | RFC | 结论 |
|------|-----|------|
| 平台总体架构 | [0001](./docs/rfc/0001-platform-architecture.md) | Electron + React + 协议内核分层 |
| 协议内核设计 | [0002](./docs/rfc/0002-protocol-kernel.md) | JSON-RPC over stdio，NDJSON 帧协议 |
| 插件平台 | [0003](./docs/rfc/0003-extension-platform.md) | MCP 兼容优先，Capability 安全模型 |
| 上游同步策略 | [0004](./docs/rfc/0004-dependency-upstream-strategy.md) | pnpm 全局 store + 受控 fork |
| R1 执行计划 | [0005](./docs/rfc/0005-r1-execution-plan.md) | Fake server + reducer 测试先行 |
| 受控 Fork 策略 | [ADR 0006](./docs/rfc/0006-controlled-fork-strategy.md) | Layer 3 fork + DEVIATIONS 治理 |
| Tauri → Electron | [ADR 0007](./docs/rfc/0007-electron-migration.md) | 渲染一致性 + Node.js 统一协议层 |
| 技术栈规格 | [RFC 0008](./docs/rfc/0008-electron-tech-stack.md) | electron-vite + Tailwind v4 + Zustand + XState |
| Phase 1 计划 | [RFC 0009](./docs/rfc/0009-electron-phase1-plan.md) | 最小壳 → Supervisor → UI → E2E |

## 外部缓存路径

所有构建产物存储在 `/Volumes/fushilu/.caches/` 下。
详见 `.env.caches` 和 `.npmrc` 配置文件。
