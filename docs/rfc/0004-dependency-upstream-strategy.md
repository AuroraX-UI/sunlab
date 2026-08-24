# RFC 0004: 依赖与上游同步策略

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-23
- 相关文档：
  - [RFC 0001](./0001-platform-architecture.md)
  - [RFC 0002](./0002-protocol-kernel.md)

## 1. 摘要

本文定义两类外部依赖策略：

1. JavaScript 依赖与磁盘占用管理，采用 **pnpm workspace + global content-addressable store + project virtual store**。
2. Codex Harness 上游运行时同步，采用 **受控 fork + 模块化偏离 + 定期上游同步** 策略（详见 [ADR 0006](./0006-controlled-fork-strategy.md)）。

核心结论：

- pnpm 不是把所有项目的 `node_modules` 放进同一个目录，而是把包内容放入全局可寻址存储，再在项目内生成符号链接和硬链接。
- Sunlab Desktop 维护 `codex app-server` 的受控 fork，所有定制代码集中在 `sunlab/` 子目录。
- 定期同步上游最新 stable tag，通过自动化脚本检测新版本并触发合并和兼容性测试。

## 2. Node 依赖与 pnpm

### 2.1 目标

1. 避免每个项目重复下载和解压相同 npm 包。
2. 保证项目依赖关系仍由各自 lockfile 决定。
3. 减少主盘占用，把全局包存储放在大容量卷。
4. 保持 Tauri、Vite、React、TypeScript 的本地构建体验。

### 2.2 pnpm 存储模型

pnpm 有三层目录概念：

```text
Global content-addressable store
  /Volumes/fushilu/.caches/pnpm/store

Project node_modules/.pnpm
  /Users/fushilu/workspace/revocloud/sunlab/node_modules/.pnpm

Project direct dependencies
  /Users/fushilu/workspace/revocloud/sunlab/node_modules/react
```

实际结构不是所有项目的 `node_modules` 合并为一个目录，而是：

1. 包内容按 integrity 存进全局 store。
2. 项目的 `node_modules/.pnpm/<package>@<version>` 通过 hard link 或 reflink 指向 store。
3. 项目顶层 `node_modules/react` 是指向 `.pnpm/react@<version>` 结构的 symlink。
4. 不同项目如果使用同一包版本，可以共享 store 内容。
5. 不同项目如果依赖不同版本，会各自拥有对应版本链接。

因此，lockfile 仍然决定项目行为，不会因为多个项目共享物理包内容而互相污染。

### 2.3 配置

推荐全局配置：

```bash
pnpm config set store-dir /Volumes/fushilu/.caches/pnpm/store --global
pnpm config set cache-dir /Volumes/fushilu/.caches/pnpm/cache --global
pnpm config set state-dir /Volumes/fushilu/.caches/pnpm/state --global
```

仓库内也可以显式声明：

```ini
# .npmrc
store-dir=/Volumes/fushilu/.caches/pnpm/store
virtual-store-dir=node_modules/.pnpm
```

注意：绝对路径适合当前个人机，但如果仓库要交给团队或开源， SHOULD 使用环境变量展开：

```ini
store-dir=${PNPM_HOME_STORE:-/Volumes/fushilu/.caches/pnpm/store}
```

CI 或贡献者文档不应假设 `/Volumes/fushilu` 一定存在。

### 2.4 迁移步骤

从 npm 迁移到 pnpm 时：

1. 提交或保留 `package.json` 依赖语义。
2. 删除 npm 生成的 `package-lock.json` 前先归档到外部缓存。
3. 移除现有 `node_modules` 符号链接或目录。
4. 配置 pnpm store 路径。
5. 执行 `pnpm install`。
6. 提交新的 `pnpm-lock.yaml`。
7. 更新脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "tauri": "tauri"
  },
  "packageManager": "pnpm@<version>"
}
```

8. CI 固定 Corepack 或 pnpm 版本。

当前仓库已在 2026-08-23 完成初次迁移：

1. 固定 `packageManager` 为 `pnpm@10.31.0`。
2. 提交 `pnpm-lock.yaml`。
3. 全局 store 使用 `/Volumes/fushilu/.caches/pnpm/store`。
4. virtual store 使用 `/Volumes/fushilu/.caches/sunlab/pnpm/virtual-store`。
5. npm lockfile 已归档到外部依赖备份目录。

### 2.5 Monorepo 演进

当项目拆出 client core、extension SDK、fake server 后，应使用 pnpm workspace：

```yaml
# pnpm-workspace.yaml
packages:
  - apps/desktop
  - packages/protocol-core
  - packages/plugin-sdk
  - packages/testing
```

workspace 优势：

1. 内部包通过 workspace 协议引用。
2. TypeScript project references 可以跨包增量构建。
3. plugin SDK 与 desktop host 共享类型来源。
4. fake app-server 可独立发布用于插件开发。

### 2.6 注意事项

1. pnpm 默认严格隔离未声明依赖，可能暴露幽灵依赖。这是优点，不要简单关闭。
2. 少数工具假设依赖被提升，可用 `.npmrc` 的 `public-hoist-pattern[]` 处理，但范围要最小化。
3. 原生模块和平台二进制仍应进入 lockfile 并在 macOS/Linux CI 分别验证。
4. 不要用共享 `node_modules` 目录替代包管理器；那会导致版本冲突和安装脚本不可复现。

## 3. Codex App-Server 上游策略

### 3.1 关系定位

Sunlab Desktop 与 `codex app-server` 的关系是：

```text
Sunlab Desktop = product shell + protocol client + extension platform + controlled fork runtime
```

架构边界是：**Sunlab Desktop 通过受控 fork 拥有 Agent 运行时的定制能力，同时保持上游同步以获得安全修复和协议演进。**

这带来四个好处：

1. 能持续获得上游模型、工具、审批和安全改进。
2. 降低协议内核的维护成本。
3. 让 Sunlab 差异化集中在工作台、扩展和工作流。
4. 受控 fork 的模块化偏离使 AI 辅助开发可以理解完整上下文。

### 3.2 上游源码使用方式

上游开源仓库是主要参考：

```text
https://github.com/openai/codex
```

使用方式分四级：

| 级别 | 方式 | 适用场景 | Sunlab 策略 |
| --- | --- | --- | --- |
| L0 | 使用用户已安装的 `codex` 二进制 | 开发期快速验证 | 仅限本地调试 |
| L1 | 使用上游官方构建 | 已被 L3 取代 | 弃用 |
| L2 | 从 pinned upstream commit 构建 | 已被 L3 取代 | 弃用 |
| L3 | 受控 fork + 模块化偏离 | 当前默认策略 | 所有阶段 |

### 3.3 默认策略：L0/L1

开发阶段可以继续使用本机 `codex`。

进入产品分发后，SHOULD 采用捆绑运行时：

```text
resources/runtime/codex/<target-triple>/<version>/codex
resources/runtime/codex/<target-triple>/<version>/VERSION
resources/runtime/codex/<target-triple>/<version>/SHA256SUMS
```

启动前校验：

1. 平台架构匹配。
2. 版本文件存在。
3. checksum 匹配。
4. 可执行权限正确。
5. 不接受 PATH 中未知版本覆盖捆绑版本，除非用户开启开发者模式。

### 3.4 版本兼容

每个 Sunlab Desktop release MUST 记录：

```json
{
  "sunlabDesktop": "0.4.0",
  "codexRuntime": {
    "min": "0.149.0-alpha.4",
    "recommended": "0.149.0-alpha.4",
    "tested": ["0.149.0-alpha.4"],
    "upstreamCommit": "<optional>"
  }
}
```

启动时执行 handshake：

1. spawn app-server。
2. 发送 `initialize`。
3. 解析返回中的 user agent/version 信息。
4. 与 compatibility matrix 比较。
5. 若低于最低版本，禁止创建线程并提示升级。
6. 若高于 tested range，进入 `degraded-compatible` 模式并提示可能存在协议差异。

### 3.5 Protocol Contract Gate

上游同步的核心不是看 changelog，而是自动比较协议面。

每次上游版本更新 MUST 执行：

```bash
codex app-server generate-json-schema \
  --experimental \
  --out /Volumes/fushilu/.caches/sunlab/schema/<version>

codex app-server generate-ts \
  --out packages/protocol-core/src/generated/<version>
```

CI diff 以下内容：

1. request methods。
2. notification methods。
3. server request methods。
4. params required fields。
5. response required fields。
6. enum values。
7. error variants。
8. item type。
9. approval result shape。

变更分类：

| 变更 | 分类 | 动作 |
| --- | --- | --- |
| 新增 optional field | compatible | 自动接受，补充类型 |
| 新增 method | additive | 增加 feature gate 和测试 |
| 删除 method | breaking | 必须评估迁移路径 |
| required 字段新增 | breaking | 更新 reducer 和 fake server |
| response shape 收窄 | breaking | contract test 失败 |
| approval result enum 改变 | critical | Approval resolver 必须更新 |
| item type 改变 | critical | Timeline renderer registry 必须更新 |

没有通过 protocol contract gate 的上游版本不能成为 recommended runtime。

### 3.6 Golden Event Fixtures

对每个 supported Codex version 维护事件回放集：

```text
packages/testing/fixtures/
├── v0.149/
│   ├── initialize.ndjson
│   ├── thread-start.ndjson
│   ├── agent-message-delta.ndjson
│   ├── command-approval.ndjson
│   ├── file-change.ndjson
│   ├── crash-mid-turn.ndjson
│   └── out-of-order-item.ndjson
```

fixture 来源：

1. 本地真实会话脱敏。
2. fake app-server 生成。
3. 上游集成测试。
4. bug 复现最小样本。

reducer 对 fixture 的输出 snapshot 必须稳定。

### 3.7 上游跟踪节奏

建议三级通道：

| 通道 | 目标 | 更新频率 |
| --- | --- | --- |
| stable | 用户日常产品 | 跟随上游稳定 release |
| beta | 新功能验证 | 每周或上游 alpha |
| canary | 协议观察 | 自动构建，不进入默认设置 |

每周任务：

1. 拉取 upstream main。
2. 生成 schema。
3. 运行 protocol diff。
4. 运行 reducer fixtures。
5. 输出 compatibility report。

每月任务：

1. 选择 candidate runtime。
2. 跑完整 E2E。
3. 更新 compatibility matrix。
4. 决定是否提升 recommended version。

### 3.8 二次开发原则

采用受控 fork 后，二次开发直接在 fork 中实现，按以下优先级放置代码：

1. **`sunlab/` 目录**：所有新模块、中间件、插件和遥测逻辑。
2. **上游文件最小修改**：仅在必须时修改（如添加 `mod sunlab;`），且不超过 10 行。
3. **客户端实现**：UI、状态、缓存、审批展示和工作流仍在 Sunlab Desktop 宿主层。
4. **MCP extension**：外部工具和数据源仍通过 MCP 协议接入。

所有对上游文件的修改必须在 `DEVIATIONS.md` 中登记（详见 [ADR 0006](./0006-controlled-fork-strategy.md)）。

禁止直接修改的点：

1. 不要在前端绕过审批中心处理高风险操作。
2. 不要伪造 app-server 状态。
3. 不要解析私有日志来代替正式协议。
4. 不要让插件直接 patch app-server 行为。
5. 不要在 Sunlab Desktop 中保存上游凭证或重加密逻辑。

### 3.9 受控 Fork 治理

Fork 治理规则详见 [ADR 0006](./0006-controlled-fork-strategy.md)。核心要求：

1. 所有 Sunlab 定制代码放在 `third_party/codex/sunlab/` 目录下。
2. 对上游原始文件的修改必须在 `DEVIATIONS.md` 中登记且不超过 10 行。
3. CI 自动检测上游新 stable tag 并触发合并流程。
4. 每个 deviation 有独立集成测试。
5. 每 90 天审查一次 deviation 列表。
6. 构建产物在 About 页显示 `Codex Engine (Sunlab Fork) <upstream>+<sunlab>`。

### 3.10 Upstream Contribution

以下类型能力 SHOULD 尝试上游化：

1. 新增协议字段。
2. 更完整的 schema。
3. 更稳定的错误码。
4. workflow telemetry 事件。
5. dynamic tool lifecycle。
6. plugin permission metadata。
7. session export/import。

Contribution 流程：

```text
Internal design note
  -> Upstream issue/discussion
  -> Minimal prototype
  -> Maintainable test
  -> Upstream PR
  -> Temporary downstream patch only if blocked
  -> Remove patch after merge/release
```

### 3.11 安全与合规

使用和修改上游源码时 MUST：

1. 保留原许可证、NOTICE 和版权信息。
2. 在 About / third-party notices 中披露使用的上游组件。
3. 明确区分 OpenAI Codex 上游代码与 Sunlab Desktop 代码。
4. 不暗示 fork 构建是官方发行版。
5. 对修改后的运行时做额外安全审计。

## 4. 目录影响

采用 pnpm 和捆绑运行时后，目标布局调整如下：

```text
/Volumes/fushilu/.caches/sunlab/
├── desktop/dist/
├── cargo-target/
├── node_modules/
├── logs/
├── cache/
├── plugins/
├── schema/
│   └── codex/<version>/
└── upstream/
    ├── src/
    ├── schemas/
    └── reports/

/Volumes/fushilu/.caches/pnpm/
├── store/
├── cache/
└── state/
```

`upstream/src` 属于开发缓存，不属于产品源码。

## 5. CI 设计

### 5.1 Dependency Job

1. 安装固定 pnpm 版本。
2. `pnpm install --frozen-lockfile`。
3. `pnpm typecheck`。
4. `pnpm build`。
5. Rust `cargo check`。
6. 检查不允许的直接依赖。

### 5.2 Upstream Compatibility Job

输入：pinned upstream ref。

步骤：

1. clone upstream shallowly。
2. checkout ref。
3. build or resolve artifact。
4. generate JSON Schema。
5. generate TS types。
6. run schema diff against current baseline。
7. run fake app-server fixtures。
8. run protocol reducer tests。
9. publish compatibility report artifact。

失败策略：

| job | 结果 |
| --- | --- |
| schema additive diff | warning |
| schema breaking diff | block promotion |
| reducer fixture fail | block merge |
| E2E fail | block release |
| security regression | immediate rollback |

## 6. 迁移决策

### 6.1 是否现在切 pnpm？

如果近期会拆 monorepo，SHOULD 现在切换。

理由：

1. plugin SDK、protocol core、fake server 很快会出现。
2. workspace 引用比 npm file dependency 更稳定。
3. 外部 store 能缓解主盘空间压力。

### 6.2 是否现在构建上游源码？

开发阶段不需要。

当前本机 `codex-cli 0.149.0-alpha.4` 已经能完成核心冒烟测试。R1 应该继续以协议 schema 和 fake server 为中心，不应该因为构建上游而分散精力。

进入 R2/R3 分发前，再引入 pinned runtime bundle。

### 6.3 什么时候考虑 patch？

同时满足以下条件才允许：

1. 能力阻塞产品级验收。
2. MCP/Skill/client/configuration 无法实现。
3. upstream issue 已建立且维护者了解诉求。
4. patch 可隔离、可测试、可移除。
5. 有明确 owner 和 review date。

## 7. 验收标准

Node 依赖策略完成的最低标准：

1. `pnpm install --frozen-lockfile` 可重复。
2. 全局 store 位于大容量卷。
3. 项目内不存在手工共享 `node_modules`。
4. CI 锁定 pnpm/Corepack 版本。
5. monorepo 内部包使用 workspace 协议。

上游策略完成的最低标准：

1. 每个 release 记录 supported Codex version。
2. initialize handshake 校验 runtime。
3. schema diff 进入 CI。
4. reducer fixtures 覆盖核心通知和审批流。
5. downstream patch 有 base commit、owner、review date 和移除条件。
6. About 页能展示上游版本和是否包含 patch。

## 8. 开放问题

1. 捆绑上游运行时是否随桌面应用签名打包？
2. 企业环境是否允许桌面自动下载 Codex runtime？
3. 上游 alpha 版本的 compatibility window 应该多长？
4. schema breaking change 是否支持多版本 adapter 同时运行？
5. patched runtime 是否只限内部 dogfood，还是允许进入公开 release？

## 9. 结论

pnpm 解决的是 **JavaScript 依赖的物理存储与项目隔离**：全局 store 共享包内容，但每个项目仍有自己的 virtual store 和 lockfile。

Codex 上游策略解决的是 **Agent 运行时的长期演进**：Sunlab Desktop 应保持客户端定位，通过 schema contract、golden fixtures 和版本握手吸收上游变化；只有在生态机制确实不足时，才使用受控 patch，并把回馈上游作为第一目标。
