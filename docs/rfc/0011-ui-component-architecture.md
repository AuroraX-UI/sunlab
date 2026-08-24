# RFC 0011: UI 组件架构与模块拆解

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-24
- 前置文档：RFC 0010（UI 设计规格）、RFC 0008（技术栈）、RFC 0009（Phase 1 计划）

## 1. 策略

跳过独立原型阶段，直接在 Electron renderer 中实现真实 UI。
原因：Tailwind CSS 是 utility-first，原型和最终代码之间没有翻译损耗；
React 组件天然支持热更新，迭代速度等同于设计工具。

## 2. 组件树

以下是基于 Codex Desktop 截图分析出的完整组件层级：

```text
<App>
  <AppLayout>                            三栏布局 shell
    <Sidebar>                            左侧边栏（300px）
      <SidebarHeader>                    品牌行：Codex ∨ + 搜索 + 新对话
      <SidebarNav>                       导航：新对话/拉取请求/已安排/插件
      <ProjectSection>                   项目分组区域
        <ProjectGroup>                   可折叠项目组（如 sunlab）
          <ThreadItem />                 子线程项（选中态/未读标记/加载态）
      <RecentSection>                    最近线程区域
        <ThreadItem />
      <SidebarFooter>                    设置 + 帮助
    <MainArea>                           中间主区域（flex-1）
      <TopBar>                           顶栏（48px）
        <ThreadTitle />                  线程标题 + 更多菜单
        <TopBarActions />                打开位置 + 布局切换
      <ConversationView>                 对话区域（flex-1, overflow-y-auto）
        <Timeline>                       时间线容器（虚拟列表）
          <TimelineItem>                 单条时间线项
            <MarkdownContent />          Markdown 渲染（段落/列表/链接/粗体）
            <CodeBlock />                代码块（语言标签 + 复制/下载）
            <ToolCallCard />             工具调用卡片（可折叠详情）
            <FileChangeCard />           文件变更卡片（diff 预览）
            <DiffViewer />               Diff 渲染（+绿/-红行高亮）
      <Composer>                         底部输入区
        <MessageInput />                 多行文本输入（自适应高度）
        <ComposerToolbar>                底部操作栏
          <AttachButton />               + 附加文件
          <PermissionBadge />            🛡 完全访问（绿色标签）
          <ModelSelector />              自定义 / 最高 ▾
          <SendButton />                 ↑ 发送按钮
    <RightPanel>                         右侧环境信息（280px，可切换显示）
      <EnvironmentPanel>
        <GitStatusSection>               Git 状态区
          <ChangeSummary />              变更 +0 -0
          <BranchSelector />             本地 / main（可展开）
          <CommitAction />               提交或推送
          <CompareBranch />              比较分支（外部链接）
        <SourceSection>                  来源区
          <RemoteUrl />                  github.com/...
          <ViewAllLink />                查看全部
    <ApprovalModal />                    审批弹窗（条件渲染）
```

## 3. 组件分层与复用规则

| 层级 | 目录 | 职责 | 复用性 |
|------|------|------|--------|
| 布局组件 | `renderer/components/layout/` | 页面结构 shell | 低（每个只用一次） |
| 领域组件 | `renderer/components/domain/` | 业务语义（时间线、审批、工具卡片） | 中（同类型多处使用） |
| 通用组件 | `renderer/components/ui/` | 无业务语义的基础 UI 原子 | 高（全局复用） |
| 页面视图 | `renderer/views/` | 组合布局+领域组件形成完整页面 | 低 |

### 3.1 通用组件清单（`components/ui/`）

这些组件不包含任何业务逻辑，可以在任何项目中复用：

| 组件 | 用途 | 基于 |
|------|------|------|
| `Button` | 按钮（primary/secondary/ghost/icon 四种变体） | Radix + Tailwind |
| `Input` | 文本输入框 | Radix |
| `Textarea` | 多行文本（自适应高度） | 原生 + Tailwind |
| `Badge` | 标签（success/danger/warning/neutral） | Tailwind |
| `Tooltip` | 悬浮提示 | Radix Tooltip |
| `Dropdown` | 下拉菜单 | Radix DropdownMenu |
| `Dialog` | 模态框 | Radix Dialog |
| `Collapsible` | 可折叠区域 | Radix Collapsible |
| `ScrollArea` | 自定义滚动条 | Radix ScrollArea |
| `Separator` | 分隔线 | Radix Separator |
| `Avatar` | 头像/图标占位 | Radix Avatar |
| `Skeleton` | 加载占位 | Tailwind animate-pulse |

### 3.2 领域组件清单（`components/domain/`）

这些组件包含业务语义，依赖 Protocol Kernel 的类型定义：

| 组件 | 职责 | 数据来源 |
|------|------|----------|
| `Timeline` | 渲染对话时间线，虚拟列表优化 | `useTimelineStore` |
| `TimelineItem` | 根据 item.kind 分发到具体渲染器 | Protocol Kernel `Item` 类型 |
| `MarkdownContent` | Markdown → React 组件树 | 纯文本字符串 |
| `CodeBlock` | 代码块 + 语法高亮 + 复制按钮 | `{ language, code }` |
| `ToolCallCard` | 工具调用详情（命令/输出/耗时） | Protocol Kernel `ToolCallItem` |
| `FileChangeCard` | 文件变更摘要 + diff 展开 | Protocol Kernel `FileChangeItem` |
| `DiffViewer` | 行级 diff 渲染（+绿/-红） | `{ additions, deletions, hunks }` |
| `ApprovalModal` | 审批请求弹窗（允许/拒绝） | `useApprovalMachine` |
| `ThreadItem` | 侧边栏线程列表项 | `{ id, title, unread, loading }` |
| `PermissionBadge` | 权限等级标签（完全访问/受控/只读） | `{ level: 'full' \| 'controlled' \| 'readonly' }` |

### 3.3 布局组件清单（`components/layout/`）

| 组件 | 职责 |
|------|------|
| `AppLayout` | 三栏 flex 布局，管理面板显隐 |
| `Sidebar` | 左侧边栏容器（含所有侧边栏子组件） |
| `TopBar` | 顶栏容器 |
| `RightPanel` | 右侧面板容器（可折叠） |
| `Composer` | 底部输入区容器 |

## 4. Hooks 设计

| Hook | 文件 | 职责 | 依赖 |
|------|------|------|------|
| `useAppServer` | `hooks/use-app-server.ts` | IPC bridge：start/request/resolve | `window.sunlab` |
| `useTimeline` | `hooks/use-timeline.ts` | 从 Protocol Kernel reducer 派生渲染数据 | Protocol Kernel |
| `useSidebar` | `hooks/use-sidebar.ts` | 侧边栏状态（选中线程/展开项目） | `useUiStore` |
| `useApproval` | `hooks/use-approval.ts` | 审批流状态机 | XState `approvalMachine` |
| `useComposer` | `hooks/use-composer.ts` | 输入框状态 + 发送逻辑 | `useComposerStore` + IPC |
| `useEnvironment` | `hooks/use-environment.ts` | Git 状态和远程信息 | IPC（未来扩展） |

## 5. Store 设计

### 5.1 `useUiStore`

```typescript
interface UiStore {
  sidebarVisible: boolean;
  rightPanelVisible: boolean;
  selectedThreadId: string | null;
  expandedProjects: Set<string>;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  selectThread: (id: string) => void;
  toggleProject: (name: string) => void;
}
```

### 5.2 `useComposerStore`

```typescript
interface ComposerStore {
  draft: string;
  permissionLevel: 'full' | 'controlled' | 'readonly';
  modelTier: 'highest' | 'balanced' | 'fast';
  setDraft: (text: string) => void;
  setPermissionLevel: (level: ComposerStore['permissionLevel']) => void;
  setModelTier: (tier: ComposerStore['modelTier']) => void;
}
```

### 5.3 `useTimelineStore`

```typescript
interface TimelineStore {
  items: TimelineItemData[];
  isLoading: boolean;
  addOrUpdateItem: (item: TimelineItemData) => void;
  appendDelta: (itemId: string, delta: string) => void;
  clearItems: () => void;
}
```

注意：TimelineStore 是 Protocol Kernel reducer 的 UI 投影，
不是独立的事实来源。数据流向：

```text
app-server → IPC → Protocol Kernel reducer → TimelineStore → React 渲染
```

## 6. 文件结构

```text
src/renderer/
  App.tsx                          根组件
  views/
    chat/
      ChatView.tsx                 对话页面（组合所有区域）
  components/
    layout/
      AppLayout.tsx
      Sidebar.tsx
      SidebarHeader.tsx
      SidebarNav.tsx
      ProjectSection.tsx
      ProjectGroup.tsx
      RecentSection.tsx
      SidebarFooter.tsx
      TopBar.tsx
      ThreadTitle.tsx
      TopBarActions.tsx
      RightPanel.tsx
      EnvironmentPanel.tsx
      Composer.tsx
      MessageInput.tsx
      ComposerToolbar.tsx
    ui/
      button.tsx
      input.tsx
      textarea.tsx
      badge.tsx
      tooltip.tsx
      dropdown.tsx
      dialog.tsx
      collapsible.tsx
      scroll-area.tsx
      separator.tsx
      skeleton.tsx
    domain/
      timeline.tsx
      timeline-item.tsx
      markdown-content.tsx
      code-block.tsx
      tool-call-card.tsx
      file-change-card.tsx
      diff-viewer.tsx
      approval-modal.tsx
      thread-item.tsx
      permission-badge.tsx
  hooks/
    use-app-server.ts
    use-timeline.ts
    use-sidebar.ts
    use-approval.ts
    use-composer.ts
    use-environment.ts
  stores/
    ui-store.ts
    composer-store.ts
    timeline-store.ts
  machines/
    approval-machine.ts
  styles/
    globals.css                     Tailwind @theme 配置
```

## 7. 实现顺序

按依赖关系排列，每一步完成后都可以独立验证：

| 步骤 | 内容 | 验证方式 |
|------|------|----------|
| S1 | `globals.css`（Tailwind @theme 色彩/字体/间距变量） | 编译无报错 |
| S2 | `components/ui/` 全部通用组件 | Storybook 或独立页面渲染 |
| S3 | `AppLayout` + `Sidebar` + `TopBar` 静态结构 | 打开窗口看到三栏布局 |
| S4 | `ConversationView` + `Timeline` + `MarkdownContent` | 硬编码 mock 数据渲染出对话内容 |
| S5 | `Composer` + 输入交互 | 能输入文字并点击发送（console.log） |
| S6 | `RightPanel` 静态结构 | 环境信息面板显示 mock Git 数据 |
| S7 | IPC bridge 接入（替换 mock 数据为真实 app-server 事件） | fake app-server 流式回复逐字出现 |
| S8 | `ApprovalModal` + XState machine | fake app-server 触发审批弹窗 |

S1–S6 是纯 UI，不依赖 Electron IPC，可以在浏览器中用 Vite dev server 独立开发。
S7–S8 需要 Electron 主进程和 fake app-server 运行。

## 8. 解耦与复用原则

### 8.1 组件间通信

- 父→子：props（类型安全，单向数据流）
- 子→父：回调函数（onXxx 命名）
- 跨组件：Zustand store 或 XState context
- 禁止：子组件直接修改父组件状态、组件之间互相 import

### 8.2 组件拆分粒度

- 一个组件只做一件事
- 如果 JSX 超过 80 行，考虑拆分子组件
- 如果 useEffect 超过 2 个，考虑提取自定义 hook
- 如果 props 超过 7 个，考虑用对象封装或拆分组件

### 8.3 样式复用

- 颜色、字号、间距全部通过 Tailwind `@theme` 变量引用
- 不在组件中硬编码 hex 值
- 重复出现 3 次以上的 class 组合提取为 Tailwind `@apply` 或组件

## 9. 依赖清单（UI 部分）

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.0",
    "xstate": "^5.19.0",
    "@xstate/react": "^5.0.0",
    "@tanstack/react-virtual": "^3.13.0",
    "lucide-react": "^0.468.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-collapsible": "^1.1.0",
    "@radix-ui/react-scroll-area": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "shiki": "^1.24.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.1.0",
    "@tailwindcss/vite": "^4.1.0"
  }
}
```

新增依赖说明：
- `lucide-react`：图标库（tree-shakeable）
- `react-markdown` + `remark-gfm`：Markdown 渲染
- `shiki`：代码语法高亮（VS Code 同款引擎，支持 Tailwind 主题）
