import { useEffect, useRef } from "react";
import type { TimelineItemData } from "./timeline-item";
import { TimelineItem } from "./timeline-item";

/**
 * 对话时间线容器。
 * 自动滚动到底部（当用户已在底部附近时）。
 */
export function Timeline({ items }: { items: TimelineItemData[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[14px] text-[var(--color-text-tertiary)]">
        连接后发送第一条消息，事件会在这里实时渲染。
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      {items.map((item) => (
        <TimelineItem key={item.id} item={item} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export type { TimelineItemData };
