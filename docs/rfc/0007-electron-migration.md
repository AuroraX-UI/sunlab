# ADR 0007: 从 Tauri 2 迁移到 Electron

- 状态：Accepted
- 日期：2026-08-24
- 取代：RFC 0001 中 Tauri 2 + Rust 的桌面框架选型
- 影响范围：src-tauri/（退役）、src/core/（保留并扩展）、package.json、构建管线

## 1. 决策

Sunlab Desktop 桌面框架从 Tauri 2 切换到 Electron 最新稳定版。

核心动机：
1. 跨平台渲染一致性——Electron 内置 Chromium，不依赖用户系统 WebView 质量。
2. 生态成熟度——调试工具、社区方案、原生模块和招聘池均优于 Tauri。
3. 协议层统一——宿主进程与协议内核均为 Node.js/TypeScript，消除跨语言边界。
4. 插件系统兼容性——Node.js 插件运行时天然匹配 Electron 主进程模型。

## 2. 性能风险与缓解策略

### 2.1 已知劣势

| 维度 | Electron | Tauri 2 | 差距 |
|------|----------|---------|------|
| 二进制体积 | ~150-200 MB | ~5-10 MB | ~20x |
| 空闲内存 | ~80-120 MB | ~40-60 MB | ~2x |
| 冷启动时间 | ~800-1200 ms | ~300-500 ms | ~2.5x |
| 渲染引擎 | Chromium 内置 | 系统 WebView | 一致 vs 碎片 |

### 2.2 缓解措施

#### 二进制体积

1. 使用 electron-builder 的 asar 归档加压缩。
2. 排除不需要的 locale 文件（仅保留 en 和 zh-CN）。
3. 按平台分发，不打包全平台二进制。
4. 长期：评估 Electron 的 slim builds 特性。

#### 内存优化

1. 单窗口架构：只创建一个 BrowserWindow，避免多进程开销。
2. utilityProcess：CPU 密集型工作放入 utility process，不阻塞主线程。
3. backgroundThrottling 设为 false：防止后台节流导致流式输出卡顿。
4. 虚拟列表：对话时间线使用 react-window 或类似库。
5. 定期 GC：长时间会话中触发垃圾回收。

#### 启动性能

1. V8 code cache 配合 BrowserWindow 启动参数。
2. 延迟加载非关键模块（设置面板、插件管理器）使用动态 import()。
3. Splash screen 在主窗口加载完成前显示轻量 splash。
4. Preload script 最小化：只暴露必要的 IPC bridge。

#### IPC 效率

1. MessagePort：高频事件流通过 MessageChannelMain 建立直连通道。
2. 批量发送：将多个小通知合并为 batch 后一次性发送。
3. 结构化克隆：利用 Electron 的结构化克隆序列化避免 JSON.stringify 开销。

## 3. 架构变更

### 3.1 进程模型

Electron Main 进程内包含 Supervisor（child_process spawn app-server）和
Protocol Kernel（FrameCodec + RequestManager）。两者通过 stdio 与 app-server 子进程
通信。Protocol Kernel 通过 MessagePort 将事件流推送到 Renderer（React）。

### 3.2 代码迁移映射

| 当前位置 | 目标位置 | 说明 |
|---------|---------|------|
| src-tauri/src/error.rs | src/core/protocol/errors.ts | 已有等价实现 |
| src-tauri/src/config/runtime.rs | src/main/runtime-config.ts | 新写 |
| src-tauri/src/transport/codec.rs | src/core/protocol/client.ts | 已有等价实现 |
| src-tauri/src/transport/request_manager.rs | src/core/protocol/client.ts | 已有等价实现 |
| src-tauri/src/lib.rs supervisor | src/main/supervisor.ts | 新写 |
| src-tauri/src/lib.rs IPC | src/main/ipc-handlers.ts | 改为 ipcMain.handle |

### 3.3 目录结构

```text
src/
main/               Electron 主进程
  index.ts           入口
  supervisor.ts      app-server 进程管理
  ipc-handlers.ts    IPC 注册
  runtime-config.ts
preload/            Context bridge
  api.ts
renderer/           React UI
  App.tsx
  components/
  hooks/
core/               协议内核（不变）
  protocol/
  testing/
  plugin-api/
```

## 4. 安全配置

Electron 默认安全性不如 Tauri，必须显式加固：

BrowserWindow webPreferences 必须设置：
- nodeIntegration: false
- contextIsolation: true
- sandbox: true
- webSecurity: true
- allowRunningInsecureContent: false

CSP 策略限制为 self，禁止远程资源加载。

禁止事项：
1. 不开启 nodeIntegration。
2. 不从远程 URL 加载内容。
3. 不禁用 contextIsolation。
4. 不在 preload 中暴露完整 require。

## 5. 与 ADR 0006 的关系

不受影响。受控 fork 的 codex app-server 是独立子进程，通过 stdio JSON-RPC 通信，
与桌面框架无关。

## 6. 与 RFC 0001-0005 的关系

RFC 0001 框架选型从 Tauri 2 改为 Electron；分层架构和安全模型不变。
RFC 0002 协议内核不变；宿主实现从 Rust 改为 TypeScript。
RFC 0003 插件 API 设计不变；插件运行时更自然地匹配 Node.js。
RFC 0004 pnpm 和受控 fork 策略不变。
RFC 0005 R1 Rust 任务标记为已完成并归档；后续改为 TypeScript 实现。

## 7. 迁移计划

Phase 0 准备：
1. 归档 src-tauri/ 为参考。
2. 安装 Electron 最新稳定版和相关工具链。
3. 配置 electron-builder 和开发脚本。

Phase 1 最小壳：
1. 创建 src/main/index.ts 入口。
2. 创建 src/preload/api.ts context bridge。
3. 将 React App 挂载到 Electron BrowserWindow。
4. 实现基础 supervisor。
5. 通过 IPC 暴露 start/request/resolve 操作。

Phase 2 性能基线：
1. 测量冷启动时间和空闲内存。
2. 实现 MessagePort 高频通道。
3. 建立性能回归门禁。

Phase 3 产品化：
1. 自动更新 electron-updater。
2. 多窗口支持（设置面板独立窗口）。
3. 系统托盘和全局快捷键。

## 8. 退出条件

如果出现以下情况应重新评估：
1. 内存占用持续超过 200 MB 且无法优化。
2. 冷启动超过 2 秒且用户反馈明显。
3. Chromium 安全漏洞修复周期跟不上上游发布节奏。
4. 团队规模扩大后需要更小的分发体积作为硬需求。
