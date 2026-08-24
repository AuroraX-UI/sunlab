import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

/**
 * 按钮变体类型。
 * - primary: 主操作按钮（蓝色背景）
 * - secondary: 次要按钮（灰色背景）
 * - ghost: 幽灵按钮（无背景，悬停显示）
 * - icon: 图标按钮（圆形，无文字）
 */
type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]",
  secondary:
    "bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-selected)]",
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-selected)]",
  icon: "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-selected)] rounded-full",
};

/**
 * 通用按钮组件。
 * 支持四种视觉变体，基于 Tailwind 工具类。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = "Button";
