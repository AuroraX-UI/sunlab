import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/**
 * 悬浮提示组件。
 * 包裹在需要提示的元素外层使用。
 */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={4}
            className="rounded-md bg-[var(--color-text-primary)] px-2 py-1 text-[12px] text-[var(--color-text-inverse)] shadow-md"
          >
            {content}
            <RadixTooltip.Arrow className="fill-[var(--color-text-primary)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
