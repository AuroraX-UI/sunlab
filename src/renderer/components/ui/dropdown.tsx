import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

/**
 * 下拉菜单组件。
 */
export const Dropdown = RadixDropdown.Root;
export const DropdownTrigger = RadixDropdown.Trigger;

/**
 * 下拉菜单内容区域。
 */
export function DropdownContent({ children, align = "start" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={4}
        className="z-50 min-w-[160px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg"
      >
        {children}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  );
}

/**
 * 下拉菜单项。
 */
export function DropdownItem({
  onSelect,
  children,
  destructive = false,
}: {
  onSelect?: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <RadixDropdown.Item
      onSelect={onSelect}
      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors ${
        destructive
          ? "text-[var(--color-danger)] hover:bg-[var(--color-diff-remove-bg)]"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-selected)]"
      }`}
    >
      {children}
    </RadixDropdown.Item>
  );
}

/**
 * 下拉菜单分隔线。
 */
export function DropdownSeparator() {
  return <RadixDropdown.Separator className="my-1 h-px bg-[var(--color-border-light)]" />;
}
