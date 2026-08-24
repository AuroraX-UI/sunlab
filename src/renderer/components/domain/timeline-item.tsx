import { MarkdownContent } from "./markdown-content";

/**
 * 时间线项数据类型。
 */
export interface TimelineItemData {
  id: string;
  role: "user" | "agent";
  kind: "message" | "tool_call" | "file_change" | "terminal";
  text: string;
  status?: "running" | "done" | "error";
  metadata?: {
    toolName?: string;
    language?: string;
    fileName?: string;
    additions?: number;
    deletions?: number;
  };
}

/**
 * 单条时间线项组件。
 * 根据 role 和 kind 选择渲染方式：
 * - user 消息：右侧对齐，灰色背景
 * - agent 消息：左侧对齐，Markdown 渲染
 * - 工具调用/文件变更：卡片样式
 */
export function TimelineItem({ item }: { item: TimelineItemData }) {
  if (item.role === "user") {
    return (
      <div className="mb-6 flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--color-surface-tertiary)] px-4 py-2.5 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
          {item.text}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <MarkdownContent content={item.text} />
    </div>
  );
}

// 延迟导入避免循环依赖
