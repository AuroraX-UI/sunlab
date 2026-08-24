# RFC 0008: Electron 技术栈规格

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-24
- 前置文档：[ADR 0007](./0007-electron-migration.md)

## 1. 选型原则

1. **类型安全贯穿全栈**：从 IPC 到状态管理到协议解析，编译期捕获错误。
2. **运行时零成本抽象**：优先选择编译期方案，避免不必要的 polyfill 和 wrapper。
3. **单工具链**：一个构建器、一个 linter/formatter、一个测试框架。
4. **渐进增强**：核心功能不依赖实验性特性；新特性通过 feature flag 引入。

## 2. 技术选型总览

| 层级 | 技术 | 版本基线 | 替代方案 | 选择理由 |
|------|------|----------|----------|----------|
| 桌面运行时 | Electron | v37 stable | Tauri 2 | 渲染一致性、Node.js 协议层 |
| 构建系统 | electron-vite | v3 stable | 手动 Vite multi-config | 统一 main/preload/renderer 构建和 HMR |
| UI 框架 | React | 19.x | Solid/Svelte | 并发渲染、生态、团队熟悉度 |
| 样式引擎 | Tailwind CSS | v4 CSS-first | vanilla-extract/panda | 零运行时、原生 cascade layers |
| 组件原语 | Radix UI | latest | Ark UI/Headless UI | 无头、可访问性、tree-shakeable |
| 动画 | Motion (framer-motion) | v11+ | CSS transitions | layout animations、手势支持 |
| 虚拟列表 | @tanstack/react-virtual | v3 | react-window | 无限滚动 + 动态高度 |
| 客户端状态 | Zustand | v5 | Jotai/Redux Toolkit | 原子更新、middleware 生态、最小样板 |
| 状态机 | XState | v5 | Robot/Zedux | 可视化编辑器、actor model、审批流程 |
| 类型安全 IPC | 自研 typed bridge | N/A | tRPC over IPC | 零依赖、编译期推导、preload 最小化 |
| 运行时验证 | Zod | v4 | Effect Schema/Valibot | tree-shakeable parse、类型推断 |
| Linter/Formatter | Biome | 2.x | ESLint + Prettier | 单工具、Rust 实现、速度快 10-25x |
| 测试框架 | Vitest | 3.x | Jest | 与 Vite 共享 transform、ESM 原生 |
| E2E 测试 | Playwright | latest | Cypress/WebdriverIO | _electron 原生支持、trace viewer |
| 打包分发 | electron-builder | v25+ | Forge/electron-packager | 多目标、代码签名、自动更新集成 |
| 自动更新 | electron-updater | latest | Squirrel | 差量下载、多 channel 支持 |

## 3. 各层详细设计

### 3.1 构建系统：electron-vite

使用 `electron-vite` 替代手动配置三个独立 Vite instance：

```ts
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    build: { rollupOptions: { external: ['electron'] } },
  },
  preload: {
    build: { rollupOptions: { external: ['electron'] } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    build: { outDir: '/Volumes/fushilu/.caches/sunlab/desktop/dist' },
  },
});
```

开发命令：

```bash
pnpm dev        # 启动 main + preload + renderer 的 HMR
pnpm build      # 三目标统一构建
```

### 3.2 目录结构与 TS Project References

```text
src/
main/               Electron 主进程（Node.js 环境）
  index.ts           入口：创建窗口、注册 IPC、启动 supervisor
  supervisor.ts      codex app-server 进程管理
  ipc-handlers.ts    ipcMain.handle 注册
  runtime-config.ts  环境变量和路径配置
  windows.ts         BrowserWindow 创建和生命周期
preload/
  api.ts             contextBridge.exposeInMainWorld
renderer/
  App.tsx            React 根组件
  routes/            页面路由
  components/        通用组件
  hooks/             自定义 hooks
  stores/            Zustand stores
  machines/          XState 状态机
core/                共享协议内核（main 和 renderer 都可导入）
  protocol/
  plugin-api/
shared/              纯类型定义和常量（无副作用）
  types/
  constants/
```

TS 配置使用 project references 隔离环境：

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true
  },
  "references": [
    { "path": "./src/main" },
    { "path": "./src/preload" },
    { "path": "./src/renderer" },
    { "path": "./src/core" }
  ]
}
```

每个子目录有独立 `tsconfig.json`，声明各自的 `types` 和 `lib`：

| 子目录 | types | lib |
--------|-------|-----|
| main | node | ES2022 |
| preload | node, electron | ES2022 |
| renderer | react, vite/client | ES2022, DOM |
| core | 无特殊 | ES2022 |

### 3.3 类型安全 IPC Bridge

不使用 tRPC 或其他第三方 RPC 库。自研一层薄封装：

```typescript
// shared/ipc-contract.ts — 定义所有 IPC 通道的类型
export interface IpcContract {
  'app-server:start': {
    request: void;
    response: void;
  };
  'app-server:request': {
    request: { method: string; params?: unknown };
    response: unknown;
  };
  'app-server:event': {
    payload: { method: string; params?: unknown; id?: number };
  };
}

type IpcChannel = keyof IpcContract;
type IpcRequest<C extends IpcChannel> = IpcContract[C]['request'];
type IpcResponse<C extends IpcChannel> = IpcContract[C]['response'];
type IpcPayload<C extends IpcChannel> = IpcContract[C] extends { payload: infer P } ? P : never;
```

主进程注册：

```typescript
// main/ipc-handlers.ts
import { ipcMain } from 'electron';
import type { IpcContract } from '../shared/ipc-contract';

export function registerHandler<C extends keyof IpcContract>(
  channel: C,
  handler: (request: IpcRequest<typeof channel>) => Promise<IpcResponse<typeof channel>>,
) {
  ipcMain.handle(channel, (_event, request) => handler(request));
}
```

preload 暴露：

```typescript
// preload/api.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcContract } from '../shared/ipc-contract';

const api = {
  invoke: <C extends keyof IpcContract>(
    channel: C,
    request: IpcContract[C]['request'],
  ) => ipcRenderer.invoke(channel, request),
  on: <C extends keyof IpcContract>(
    channel: C,
    callback: (payload: IpcPayload<C>) => void,
  ) => {
    const listener = (_event: unknown, data: IpcPayload<C>) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('sunlab', api);

export type SunlabApi = typeof api;
```

renderer 使用：

```typescript
// renderer/hooks/useAppServer.ts
declare global {
  interface Window {
    sunlab: import('../preload/api').SunlabApi;
  }
}

export function useAppServer() {
  const start = () => window.sunlab.invoke('app-server:start', undefined);
  const send = (method: string, params?: unknown) =>
    window.sunlab.invoke('app-server:request', { method, params });
  return { start, send };
}
```

高频事件流使用 MessagePort 直连（绕过 ipcMain 序列化）：

```typescript
// main/windows.ts — 创建 MessageChannel
import { MessageChannelMain } from 'electron';

const { port1, port2 } = new MessageChannelMain();
port1.postMessage({ type: 'protocol://notification', method: 'item/updated', params: {...} });
mainWindow.webContents.postMessage('port', null, [port2]);
```

### 3.4 状态管理

#### Zustand v5 — 客户端 UI 状态

用于 thread 列表、当前选中项、面板开关等轻量状态：

```typescript
// renderer/stores/ui-store.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface UiStore {
  sidebarOpen: boolean;
  selectedThreadId: string | null;
  toggleSidebar: () => void;
  selectThread: (id: string) => void;
}

export const useUiStore = create<UiStore>()(
  subscribeWithSelector((set) => ({
    sidebarOpen: true,
    selectedThreadId: null,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    selectThread: (id) => set({ selectedThreadId: id }),
  })),
);
```

#### XState v5 — 复杂状态机

用于 turn lifecycle、approval flow、plugin execution 等有明确状态转换的场景：

```typescript
// renderer/machines/approval-machine.ts
import { setup } from 'xstate';

export const approvalMachine = setup({
  types: {
    context: {} as { toolName: string; reason: string },
    events: {} as
      | { type: 'APPROVE' }
      | { type: 'DENY'; reason?: string }
      | { type: 'TIMEOUT' },
  },
  initial: 'pending',
  states: {
    pending: {
      after: { 30000: 'timeout' },
      on: {
        APPROVE: 'approved',
        DENY: 'denied',
      },
    },
    approved: { type: 'final' },
    denied: { type: 'final' },
    timeout: { type: 'final' },
  },
}).createMachine({ id: 'approval' });
```

#### 分层原则

| 数据类型 | 存储位置 | 示例 |
|---------|---------|------|
| 服务端事实（app-server 状态） | Protocol Kernel reducer | threads, items, turns |
| 派生 UI 状态 | Zustand selector | filteredThreads, visibleItems |
| 流程控制 | XState machine | approvalFlow, turnLifecycle |
| 临时表单状态 | React useState | draftMessage, searchQuery |

禁止在 Zustand 中存储 app-server 的原始 JSON-RPC 响应。Protocol Kernel 是唯一事实来源，
Zustand 只存派生 selector。

### 3.5 样式：Tailwind CSS v4

Tailwind v4 采用 CSS-first 配置，不再需要 `tailwind.config.js`：

```css
/* src/renderer/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-surface: oklch(0.14 0 0);
  --color-surface-raised: oklch(0.18 0 0);
  --color-accent: oklch(0.65 0.20 260);
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

配合 Radix UI 使用：

```tsx
// renderer/components/dialog.tsx
import * as Dialog from '@radix-ui/react-dialog';

export function ApprovalDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-raised p-6 shadow-xl">
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
```

### 3.6 代码质量：Biome 2.x

替代 ESLint + Prettier：

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "files": { "ignore": ["node_modules", "dist"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedVariables": "error" },
      "suspicious": { "noExplicitAny": "warn" }
    }
  }
}
```

脚本：

```json
{
  "lint": "biome check src/",
  "format": "biome format --write src/"
}
```

### 3.7 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | Vitest | Protocol Kernel reducers、Zustand stores、XState machines |
| 集成测试 | Vitest + fake app-server | Supervisor + Codec + RequestManager 全链路 |
| E2E 测试 | Playwright `_electron` | 启动真实 Electron 进程，验证 UI 交互流 |
| 快照测试 | Vitest snapshot | Timeline rendering、tool card layouts |

E2E 示例：

```typescript
// e2e/app.spec.ts
import { test, expect, _electron } from '@playwright/test';

test('app launches and shows welcome screen', async () => {
  const electronApp = await _electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  await expect(window.locator('[data-testid=welcome]')).toBeVisible();
  await electronApp.close();
});
```

### 3.8 打包与分发

```typescript
// electron-builder.yml
appId: com.sunlab.desktop
productName: Sunlab Desktop
directories:
  output: /Volumes/fushilu/.caches/sunlab/desktop/release
files:
  - dist/**
asar: true
compression: maximum
dmg:
  contents:
    - { x: 130, y: 220 }
    - { x: 410, y: 220, type: link, path: /Applications }
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
publish:
  provider: generic
  url: https://releases.sunlab.dev/desktop
```

自动更新配置：

```typescript
// main/auto-update.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.autoDownload = false;
autoUpdater.on('update-available', (info) => {
  // 通知用户，显示 changelog，等待确认后下载
});
```

## 4. 性能预算

| 指标 | 目标 | 测量方法 |
|------|------|----------|
| 冷启动到可交互 | <1500ms | Performance.mark + Playwright trace |
| 空闲内存（单线程） | <120MB | process.memoryUsage() 定时采集 |
| 流式输出帧率 | >55fps | requestAnimationFrame delta 采样 |
| IPC 延迟（单次） | <5ms | performance.now() 差值 |
| Bundle 大小（renderer gzip） | <300KB | vite-bundle-analyzer |

CI 门禁在 Phase 2 建立，任何指标回退超过 15% 则阻塞 merge。

## 5. 依赖清单

### 外部缓存路径

所有构建产物和工具二进制存储在 `/Volumes/fushilu/.caches/` 下，避免占满主盘。
项目根目录 `.env.caches` 定义环境变量，`.npmrc` 配置 pnpm 和 Electron 的下载路径。

| 用途 | 路径 | 环境变量 |
|------|------|----------|
| pnpm 全局包存储 | `/Volumes/fushilu/.caches/pnpm/store` | `.npmrc store-dir` |
| pnpm 项目虚拟链接 | `/Volumes/fushilu/.caches/sunlab/pnpm/virtual-store` | `.npmrc virtual-store-dir` |
| pnpm 缓存 | `/Volumes/fushilu/.caches/pnpm/cache` | `.npmrc cache-dir` |
| Electron 二进制下载 | `/Volumes/fushilu/.caches/electron` | `.npmrc electron_config_cache` |
| Playwright 浏览器 | `/Volumes/fushilu/.caches/ms-playwright` | `PLAYWRIGHT_BROWSERS_PATH` |
| Vite 构建输出 | `/Volumes/fushilu/.caches/sunlab/desktop/dist` | `SUNLAB_DIST_DIR` |
| electron-builder 打包产物 | `/Volumes/fushilu/.caches/sunlab/desktop/release` | `SUNLAB_RELEASE_DIR` |
| Rust/Cargo 编译缓存 | `/Volumes/fushilu/.caches/sunlab/cargo-target` | `CARGO_TARGET_DIR` |
| node-gyp 原生模块构建 | `/Volumes/fushilu/.caches/node-gyp` | `npm_config_devdir` |

### dependencies

```json
{
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "zustand": "^5.0.0",
  "xstate": "^5.19.0",
  "@xstate/react": "^5.0.0",
  "@tanstack/react-virtual": "^3.13.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "@radix-ui/react-dropdown-menu": "^2.1.0",
  "@radix-ui/react-tooltip": "^1.1.0",
  "@radix-ui/react-popover": "^1.1.0",
  "motion": "^11.15.0",
  "zod": "^4.0.0"
}
```

### devDependencies

```json
{
  "electron": "^37.0.0",
  "electron-vite": "^3.1.0",
  "electron-builder": "^26.0.0",
  "electron-updater": "^6.3.0",
  "@vitejs/plugin-react": "^5.0.0",
  "tailwindcss": "^4.1.0",
  "@tailwindcss/vite": "^4.1.0",
  "biome": "^2.0.0",
  "@playwright/test": "^1.52.0",
  "typescript": "~5.9.0",
  "vitest": "^3.2.0",
  "vite": "^7.1.0"
}
```
