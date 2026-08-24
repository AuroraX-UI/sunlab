# Sunlab Desktop RFC

本目录保存 Sunlab Desktop 的平台级技术决策和规格。RFC 一旦进入 `Accepted` 状态，就表示实现方向已经确认；修改已接受 RFC 需要新增变更记录或新的 RFC。

| 编号 | 标题 | 状态 | 说明 |
| --- | --- | --- | --- |
| [0001](./0001-platform-architecture.md) | 平台总体技术架构 | Draft | 产品愿景、分层架构、安全模型、数据路径和演进路线 |
| [0002](./0002-protocol-kernel.md) | Codex App-Server 协议内核 | Draft | JSON-RPC 传输、进程监督、事件存储、线程状态机和恢复策略 |
| [0003](./0003-extension-platform.md) | 扩展与插件平台 | Draft | Plugin Manifest、能力模型、MCP/Skill 兼容、UI 扩展点和 Workflow |
| [0004](./0004-dependency-upstream-strategy.md) | 依赖与上游同步策略 | Draft | pnpm 存储模型、Codex 上游版本策略、schema diff 和 fork 治理 |
| [0005](./0005-r1-execution-plan.md) | R1 Protocol Kernel 工程执行计划 | Draft | R1 任务拆解、里程碑、验收标准、风险和推荐 PR 顺序 |
| [0006](./0006-controlled-fork-strategy.md) | Codex App-Server 受控 Fork 策略 | Accepted | Layer 3 受控 fork、DEVIATIONS 治理、上游同步自动化 |
| [0007](./0007-electron-migration.md) | 从 Tauri 2 迁移到 Electron | Accepted | 框架选型变更、性能缓解策略、迁移计划 |
| [0008](./0008-electron-tech-stack.md) | Electron 技术栈规格 | Draft | 构建系统、UI 框架、状态管理、IPC、测试、打包全链路 |
| [0009](./0009-electron-phase1-plan.md) | Electron Phase 1 执行计划 | Draft | 任务拆解、PR 序列、验收标准、风险缓解 |
| [0010](./0010-ui-design-spec.md) | UI 设计规格 | Draft | 明亮主题、布局结构、组件规格、色彩系统、字体和间距 |
| [0011](./0011-ui-component-architecture.md) | UI 组件架构 | Draft | 组件树、分层复用规则、Hooks/Store 设计、实现顺序 |

## 阅读顺序

1. 先阅读 `0001`，理解 Sunlab Desktop 与官方 Codex Desktop 的差异定位。
2. 再阅读 `0002`，理解为什么协议内核优先于功能 UI。
3. 最后阅读 `0003`，理解插件如何参与工具、上下文、审批和界面渲染。

## 当前关键决策

1. **App-server 是 Agent 状态的事实来源**：本地缓存和 event journal 只是投影，不伪造服务端状态。
2. **Rust Host 保持薄内核**：只负责进程、传输、原生能力和安全边界。
3. **Client Core 是唯一协议入口**：React 只消费归一化 selector，不允许直接解析 JSON-RPC method。
4. **官方生态优先**：MCP、Codex Skill 和 Codex Plugin 的兼容层先于私有插件标准。
5. **Capability 是安全边界**：所有扩展能力必须在 manifest 中声明，并经过用户或组织策略授权。
6. **协议内核先行**：在 thread/turn/item/approval reducer 稳定之前，不大规模扩展产品 UI。
7. **受控 fork app-server**：维护 `codex` 的受控 fork，所有定制集中在 `sunlab/` 目录，定期同步上游 stable tag（ADR 0006）。
8. **Electron 作为桌面框架**：跨平台渲染一致性和 Node.js 协议层统一的收益超过体积和内存代价（ADR 0007）。
9. **Phase 1 最小壳优先**：Electron 迁移从最小可运行壳开始，逐步替换 Tauri 层；每个 PR 独立可验证（RFC 0009）。
10. **协议内核以可测试性为交付标准**：没有 fake runtime、golden fixture 和 schema gate，就不能宣布协议内核完成。

## 文档约定

- **MUST / MUST NOT**：强制要求。
- **SHOULD**：默认要求，允许在明确说明理由时偏离。
- **MAY**：可选能力。
- 所有对外协议字段必须以当前 Codex CLI 生成的 JSON Schema 为准；RFC 中列出的方法用于表达语义边界，不代替类型定义。
