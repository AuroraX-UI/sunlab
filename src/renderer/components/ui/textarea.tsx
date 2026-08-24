import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

/**
 * 自适应高度的多行文本输入框。
 * 通过 field-sizing 实现内容驱动的自动增高。
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", rows = 1, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={`w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none ${className}`}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
