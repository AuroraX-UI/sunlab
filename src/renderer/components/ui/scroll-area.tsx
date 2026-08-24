import * as RadixScrollArea from "@radix-ui/react-scroll-area";
import type { ReactNode } from "react";

/**
 * 自定义滚动区域组件。
 */
export function ScrollArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <RadixScrollArea.Root className={`overflow-hidden ${className}`}>
      <RadixScrollArea.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-2 touch-none select-none p-0.5 transition-colors"
      >
        <RadixScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--color-border)]" />
      </RadixScrollArea.Scrollbar>
    </RadixScrollArea.Root>
  );
}
