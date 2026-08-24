/**
 * 水平分隔线组件。
 */
export function Separator({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-[var(--color-border-light)] ${className}`} />;
}
