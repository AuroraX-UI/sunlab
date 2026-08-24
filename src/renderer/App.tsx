import { Timeline } from "@/renderer/components/domain/timeline";
import type { TimelineItemData } from "@/renderer/components/domain/timeline";
import { AppLayout } from "@/renderer/components/layout/AppLayout";

/**
 * Mock 对话数据（Phase 1 静态展示，S7 接入真实 IPC 后替换）。
 */
const MOCK_ITEMS: TimelineItemData[] = [
  {
    id: "user-1",
    role: "user",
    kind: "message",
    text: "「暗色主题为主」改为明亮为主。还有需要参考最新版本的codex desktop ui",
  },
  {
    id: "agent-1",
    role: "agent",
    kind: "message",
    text: `## 关于「一比一复刻 Codex Desktop UI」

这个策略我认为完全正确，理由：

1. 降低设计风险——Codex Desktop 的 UI 已经被大量用户验证过，交互模式成熟
2. 加速开发——不用花时间做视觉设计决策，照着抄就行
3. 后续超越有基础——先做到一样好看，再加差异化功能

具体复刻要点：

Codex Desktop 的核心视觉语言是：

- 明亮主题为主（白色背景 + 高对比度深色文字）
- 左侧边栏：项目分组线程列表 + 新建按钮 + 设置入口
- 主区域：对话时间线，Agent 消息流式逐字出现
- 卡片系统：工具调用、文件变更、终端输出各自有独立的视觉样式
- 审批弹窗：底部或居中模态框，显示操作详情 + 允许/拒绝按钮
- 字体：正文用系统 sans-serif，代码用 monospace

这些全部可以用 Tailwind CSS v4 CSS-first 配置实现：

\`\`\`css
@import "tailwindcss";

@theme {
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F7F7F8;
  --color-accent: #0066CC;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
\`\`\``,
  },
];

/**
 * 应用根组件。
 * Phase 1 使用 mock 数据渲染对话时间线，S7 接入真实 IPC 后替换。
 */
export default function App() {
  return (
    <AppLayout>
      <Timeline items={MOCK_ITEMS} />
    </AppLayout>
  );
}
