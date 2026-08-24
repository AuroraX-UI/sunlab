import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

/**
 * 通用文本输入框组件。
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none ${className}`}
      {...props}
    />
  ),
);

Input.displayName = "Input";
