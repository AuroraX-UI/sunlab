/**
 * 加载占位组件，使用脉冲动画提示内容正在加载。
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--color-surface-tertiary)] ${className}`} />;
}
