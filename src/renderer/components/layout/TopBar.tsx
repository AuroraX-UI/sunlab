import { ChevronDown, Folder, LayoutPanelLeft, MoreHorizontal, PanelRight, Square } from "lucide-react";
import { useUiStore } from "@/renderer/stores/ui-store";

/**
 * 顶栏组件：线程标题 + 打开位置 + 布局切换。
 */
export function TopBar() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border-light)] bg-[var(--color-surface)] px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Folder className="size-4 shrink-0 text-[var(--color-text-tertiary)]" />
        <span className="min-w-0 truncate text-[14px] text-[var(--color-text-primary)]">
          Codex Harness 在2026年8月全面开源，我想...
        </span>
        <button type="button" className="rounded-md p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]"
        >
          打开位置
          <ChevronDown className="size-3" />
        </button>
        <div className="ml-2 flex items-center gap-0.5">
          <button type="button" onClick={toggleSidebar} className="rounded-md p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
            <LayoutPanelLeft className="size-4" />
          </button>
          <button type="button" className="rounded-md p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
            <Square className="size-3.5" />
          </button>
          <button type="button" onClick={toggleRightPanel} className="rounded-md p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
            <PanelRight className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
