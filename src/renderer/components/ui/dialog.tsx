import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/**
 * 模态框组件。
 */
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

/**
 * 模态框内容区域。
 */
export function DialogContent({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <RadixDialog.Content
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--color-surface)] p-6 shadow-2xl ${className}`}
      >
        <RadixDialog.Title className="mb-4 text-[16px] font-semibold text-[var(--color-text-primary)]">
          {title}
        </RadixDialog.Title>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
