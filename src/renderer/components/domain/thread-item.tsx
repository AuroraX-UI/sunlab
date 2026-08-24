import { Circle } from "lucide-react";

/**
 * 侧边栏线程列表项属性。
 */
interface ThreadItemProps {
  title: string;
  selected?: boolean;
  unread?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

/**
 * 侧边栏中的单个线程列表项。
 * 显示线程标题，支持选中态、未读蓝点和加载指示。
 */
export function ThreadItem({ title, selected = false, unread = false, loading = false, onClick }: ThreadItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        selected
          ? "bg-[var(--color-selected)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {loading && (
        <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-text-tertiary)]" />
      )}
      {unread && !loading && <Circle className="size-2 shrink-0 fill-[var(--color-accent)] text-[var(--color-accent)]" />}
    </button>
  );
}
