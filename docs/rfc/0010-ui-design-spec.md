# RFC 0010: UI 设计规格（基于 Codex Desktop 明亮主题）

- 状态：Draft
- 作者：Sunlab Desktop Architecture Group
- 更新时间：2026-08-24
- 前置文档：RFC 0008（Electron 技术栈）、ADR 0007（Electron 迁移）

## 1. 设计原则

1. **明亮主题为主**——白色/浅灰背景，高对比度深色文字。
2. **一比一复刻 Codex Desktop**——布局、间距、字号、圆角、图标风格全部对齐。
3. **最小视觉噪音**——无多余装饰，用留白和字重区分层级。
4. **信息密度适中**——侧边栏紧凑，主内容区宽松。

## 2. 布局结构

```text
┌─────────────────────────────────────────────────────────────┐
│  Top Bar（线程标题 + 操作按钮）                                │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│ Sidebar  │       Conversation Area          │  Right Panel  │
│ (~300px) │       (flex-1, white bg)         │  (~280px)     │
│          │                                  │               │
│ 项目分组  │  Markdown 渲染的对话时间线         │  环境信息      │
│ 线程列表  │  代码块 + 语法高亮                │  Git 状态      │
│ 最近线程  │                                  │  远程仓库      │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│  Composer（输入框 + 权限标签 + 模型选择 + 发送）               │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 尺寸规格

| 区域 | 宽度 | 背景色 |
|------|------|--------|
| Sidebar | 300px 固定 | `#F7F7F8` |
| Top Bar | 100% × 48px | `#FFFFFF` |
| Conversation Area | flex-1 | `#FFFFFF` |
| Right Panel | 280px 固定 | `#F7F7F8` |
| Composer | 100% × ~72px | `#FFFFFF` |

## 3. 色彩系统（Tailwind CSS v4 CSS-first）

```css
@import "tailwindcss";

@theme {
  /* 基础表面色 */
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F7F7F8;
  --color-surface-tertiary: #F0F0F2;

  /* 文字色 */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;
  --color-text-inverse: #FFFFFF;

  /* 交互色 */
  --color-accent: #0066CC;
  --color-accent-hover: #0052A3;

  /* 选中态 */
  --color-selected: #E8E8EA;
  --color-selected-hover: #DEDEE0;

  /* 代码块 */
  --color-code-bg: #F6F8FA;
  --color-code-header: #F0F0F2;

  /* 语义色 */
  --color-success: #22863A;
  --color-danger: #D73A49;
  --color-warning: #B08800;

  /* Diff */
  --color-diff-add-bg: #F0FFF4;
  --color-diff-add-text: #22863A;
  --color-diff-remove-bg: #FFEEF0;
  --color-diff-remove-text: #D73A49;

  /* 边框 */
  --color-border: #E1E4E8;
  --color-border-light: #F0F0F2;

  /* 字体 */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "SF Mono", "JetBrains Mono", "Fira Code", monospace;
}
```

## 4. 组件规格

### 4.1 Sidebar（左侧边栏）

```text
┌─────────────────────┐
│ Codex ∨     🔍  ✏️  │  品牌行：下拉 + 搜索 + 新对话
├─────────────────────┤
│ 📝 新对话            │  导航项
│ 🔀 拉取请求          │
│ ⏰ 已安排            │
│ 🧩 插件             │
├─────────────────────┤
│ 项目                 │  分区标题
│                     │
│ 📁 funfox           │  项目组（可折叠）
│   ├ 详细了解当前...   │  子线程（缩进）
│ 📁 RedHub           │
│   ├ 你先了解下当... ● │  蓝点 = 未读
│ 📁 sunlab           │
│   ├ Codex Harness...│  ← 选中态（灰色背景）
├─────────────────────┤
│ 最近                 │  分区标题
│ 有mcp工具127.0.0...  │
│ 搜索现任美国总统      │
│ ...                 │
├─────────────────────┤
│ ⚙️ custom      ？    │  底部：设置 + 帮助
└─────────────────────┘
```

规格：
- 宽度：300px
- 背景：`--color-surface-secondary`
- 品牌行高度：44px
- 导航项高度：36px，字号 13px
- 项目组标题高度：32px，字号 13px，粗体
- 子线程项高度：32px，字号 13px，缩进 24px
- 选中态背景：`--color-selected`，圆角 6px
- 分区标题：字号 11px，`--color-text-tertiary`，UPPERCASE

### 4.2 Top Bar（顶栏）

```text
┌─────────────────────────────────────────────────────────────┐
│ 📂 Codex Harness 在2026年8月全... ⋯     打开位置 ∨  ⬜ ⬜ ⬜ │
└─────────────────────────────────────────────────────────────┘
```

规格：
- 高度：48px
- 背景：`--color-surface`
- 底部边框：1px `--color-border-light`
- 左侧：文件夹图标 + 线程标题（截断，单行）+ "⋯" 更多菜单
- 右侧："打开位置" 下拉按钮 + 3 个布局切换图标（侧边栏/面板/全屏）

### 4.3 Conversation Area（对话区域）

对话内容使用 Markdown 渲染，包含：

- **标题**：H1-H3，粗体，字号递减
- **段落**：14px，行高 1.6
- **列表**：有序/无序，缩进对齐
- **代码块**：带头部标签栏（语言名 + 复制/下载按钮），背景 `--color-code-bg`，圆角 8px
- **行内代码**：背景 `--color-code-bg`，圆角 4px，padding 2px 6px
- **链接**：`--color-accent` 色
- **粗体**：`font-weight: 600`

左侧有细竖线 + 圆点作为时间线指示器（视觉装饰，非交互）。

### 4.4 Right Panel（右侧环境信息面板）

```text
┌───────────────────┐
│ 环境信息        +  │
├───────────────────┤
│ 📋 变更     +0 -0  │
│ 📂 本地         ∨  │
│ 🔀 main         ∨  │
│ ⬆️ 提交或推送       │
│ 🐙 比较分支    ↗   │
├───────────────────┤
│ 来源            +  │
├───────────────────┤
│ 🔗 github.com/...  │
│ 🔗 查看全部         │
└───────────────────┘
```

规格：
- 宽度：280px
- 背景：`--color-surface-secondary`
- 左侧边框：1px `--color-border-light`
- 每项高度：36px，字号 13px
- Diff 数字：`+0` 绿色，`-0` 红色
- 可折叠项带 chevron-down 图标

### 4.5 Composer（输入区）

```text
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 输入任务内容...                                          │ │
│ │                                                         │ │
│ │ +   🛡 完全访问          自定义  最高 ▾   (↑)             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

规格：
- 输入框：圆角 12px，边框 1px `--color-border`，背景 `--color-surface`
- 最小高度：72px，多行自适应
- "+" 按钮：附加文件，36px 圆形
- 权限标签：`🛡 完全访问`，绿色文字 + 盾牌图标
- 模型选择："自定义" 文字 + "最高" 下拉
- 发送按钮：36px 圆形，背景 `--color-text-primary`，白色箭头图标
- 底部 padding：12px

### 4.6 Approval Modal（审批弹窗）

Phase 1 先实现居中模态框：

```text
┌───────────────────────────────────┐
│         需要审批                    │
│                                   │
│  ┌─────────────────────────────┐  │
│  │ 命令详情 / 文件变更预览        │  │
│  └─────────────────────────────┘  │
│                                   │
│         [允许]    [拒绝]           │
└───────────────────────────────────┘
```

规格：
- 背景：半透明黑色遮罩（`rgba(0,0,0,0.4)`）
- 弹窗：白色背景，圆角 12px，最大宽度 480px
- 标题：16px 粗体
- 内容区：代码块样式展示操作详情
- 按钮：允许 = `--color-accent` 背景，拒绝 = `--color-surface-tertiary` 背景

## 5. 字体规格

| 用途 | 字体 | 字号 | 行高 | 字重 |
|------|------|------|------|------|
| 正文 | sans-serif | 14px | 1.6 | 400 |
| 标题 H1 | sans-serif | 20px | 1.3 | 600 |
| 标题 H2 | sans-serif | 17px | 1.4 | 600 |
| 标题 H3 | sans-serif | 15px | 1.5 | 600 |
| 侧边栏项 | sans-serif | 13px | 1.4 | 400 |
| 侧边栏分组 | sans-serif | 11px | 1.4 | 500 |
| 代码 | monospace | 13px | 1.6 | 400 |
| 小字/标签 | sans-serif | 12px | 1.4 | 400 |

## 6. 间距系统

使用 Tailwind 默认间距（4px 基数）：

| 场景 | 间距 |
|------|------|
| 页面外边距 | 16px |
| 组件内边距 | 12px |
| 列表项间距 | 4px |
| 分区之间 | 24px |
| 卡片内边距 | 16px |
| 代码块内边距 | 16px |

## 7. 图标

使用 Lucide Icons（tree-shakeable，与 Radix UI 风格一致）。

常用图标映射：

| 功能 | Lucide 图标 |
|------|------------|
| 新对话 | `SquarePen` |
| 搜索 | `Search` |
| 项目/文件夹 | `FolderOpen` |
| 拉取请求 | `GitPullRequest` |
| 已安排 | `Clock` |
| 插件 | `Puzzle` |
| 设置 | `Settings` |
| 帮助 | `CircleHelp` |
| 发送 | `ArrowUp` |
| 附件 | `Plus` |
| 审批盾牌 | `ShieldCheck` |
| Git 分支 | `GitBranch` |
| 提交 | `GitCommitHorizontal` |
| 外部链接 | `ArrowUpRight` |

## 8. 响应式行为

Phase 1 只需支持桌面最小宽度 1024px：

| 宽度 | Sidebar | Right Panel | 说明 |
|------|---------|-------------|------|
| >=1280px | 显示 | 显示 | 完整三栏 |
| 1024-1279px | 显示 | 隐藏 | 双栏 |
| <1024px | 暂不支持 | 暂不支持 | Phase 3 考虑 |

Right Panel 可通过顶栏按钮切换显示/隐藏。

## 9. 与现有文档的关系

| 文档 | 变更 |
|------|------|
| RFC 0008 | 主题色从暗色改为明亮，代码块样式更新 |
| ADR 0007 | 无变更（架构不受主题影响） |
| AGENTS.md | 无变更 |
