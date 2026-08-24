import type { HTMLAttributes } from "react";

/**
 * 标签变体类型。
 */
type BadgeVariant = "success" | "danger" | "warning" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-[var(--color-diff-add-bg)] text-[var(--color-success)]",
  danger: "bg-[var(--color-diff-remove-bg)] text-[var(--color-danger)]",
  warning: "bg-[#FFF8E1] text-[var(--color-warning)]",
  neutral: "bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)]",
};

/**
 * 通用标签组件，用于状态指示和权限等级展示。
 */
export function Badge({ variant = "neutral", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
