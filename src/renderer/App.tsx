import { AppLayout } from "@/renderer/components/layout/AppLayout";

/**
 * 应用根组件。
 * Phase 1 使用 mock 数据渲染对话时间线，S7 接入真实 IPC 后替换。
 */
export default function App() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-8 py-6">
        <h1 className="mb-4 text-[20px] font-semibold text-[var(--color-text-primary)]">
          关于「一比一复刻 Codex Desktop UI」
        </h1>
        <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
          这个策略我认为完全正确，理由：
        </p>
        <ol className="mb-4 list-decimal space-y-1 pl-6 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
          <li>降低设计风险——Codex Desktop 的 UI 已经被大量用户验证过，交互模式成熟</li>
          <li>加速开发——不用花时间做视觉设计决策，照着抄就行</li>
          <li>后续超越有基础——先做到一样好看，再加差异化功能</li>
        </ol>
        <p className="mb-4 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
          具体复刻要点：
        </p>
        <p className="mb-2 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
          Codex Desktop 的核心视觉语言是：
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-6 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
          <li>明亮主题为主（白色背景 + 高对比度深色文字）</li>
          <li>左侧边栏：项目分组线程列表 + 新建按钮 + 设置入口</li>
          <li>主区域：对话时间线，Agent 消息流式逐字出现</li>
          <li>卡片系统：工具调用、文件变更、终端输出各自有独立的视觉样式</li>
          <li>审批弹窗：底部或居中模态框，显示操作详情 + 允许/拒绝按钮</li>
          <li>字体：正文用系统 sans-serif，代码用 monospace</li>
        </ul>
      </div>
    </AppLayout>
  );
}
