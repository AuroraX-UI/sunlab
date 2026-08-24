import * as RadixCollapsible from "@radix-ui/react-collapsible";
import type { ReactNode } from "react";

/**
 * 可折叠区域组件。
 */
export const Collapsible = RadixCollapsible.Root;

/**
 * 可折叠区域触发器。
 */
export function CollapsibleTrigger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixCollapsible.Trigger className={className}>
      {children}
    </RadixCollapsible.Trigger>
  );
}

/**
 * 可折叠区域内容。
 */
export function CollapsibleContent({ children }: { children: ReactNode }) {
  return (
    <RadixCollapsible.Content className="overflow-hidden data-[state=closed]:hidden">
      {children}
    </RadixCollapsible.Content>
  );
}
