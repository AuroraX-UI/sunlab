import {
  ChevronDown,
  FileDiff,
  GitBranch,
  GitCommitHorizontal,
  Link,
  Plus,
  ArrowUpRight,
  Globe,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/renderer/components/ui/collapsible";
import { Separator } from "@/renderer/components/ui/separator";

/**
 * 面板行组件：图标 + 文字 + 可选的右侧内容。
 */
function PanelRow({
  icon,
  label,
  right,
  expandable = false,
  className = "",
}: {
  icon?: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  expandable?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--color-text-secondary)] ${className}`}>
      {icon && <span className="shrink-0 text-[var(--color-text-tertiary)]">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {right}
      {expandable && <ChevronDown className="size-3 shrink-0 text-[var(--color-text-tertiary)]" />}
    </div>
  );
}

/**
 * 右侧环境信息面板。
 * 显示 Git 状态（变更数/分支/提交）和远程仓库信息。
 */
export function RightPanel() {
  return (
    <aside className="w-[280px] shrink-0 border-l border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
      <div className="flex flex-col overflow-y-auto p-2">
        {/* 环境信息 */}
        <div className="flex items-center justify-between px-1.5 py-2">
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">环境信息</span>
          <button type="button" className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
            <Plus className="size-4" />
          </button>
        </div>

        <div className="rounded-lg bg-[var(--color-surface)] shadow-sm">
          <PanelRow
            icon={<FileDiff className="size-4" />}
            label="变更"
            right={
              <span className="flex gap-1 text-[12px]">
                <span className="text-[var(--color-success)]">+0</span>
                <span className="text-[var(--color-danger)]">-0</span>
              </span>
            }
          />
          <Separator className="mx-3" />

          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <PanelRow icon={<FileDiff className="size-4" />} label="本地" expandable />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-2 text-[12px] text-[var(--color-text-tertiary)]">无本地变更</div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <PanelRow icon={<GitBranch className="size-4" />} label="main" expandable />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-2 text-[12px] text-[var(--color-text-tertiary)]">当前分支：main</div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="mx-3" />
          <PanelRow icon={<GitCommitHorizontal className="size-4" />} label="提交或推送" />

          <Separator className="mx-3" />
          <PanelRow
            icon={<Globe className="size-4" />}
            label="比较分支"
            right={<ArrowUpRight className="size-3 text-[var(--color-text-tertiary)]" />}
          />
        </div>

        {/* 来源 */}
        <div className="mt-4 flex items-center justify-between px-1.5 py-2">
          <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">来源</span>
          <button type="button" className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
            <Plus className="size-4" />
          </button>
        </div>

        <div className="rounded-lg bg-[var(--color-surface)] shadow-sm">
          <PanelRow icon={<Globe className="size-4" />} label="github.com/AuroraX-UI/sunlab.git" />
          <Separator className="mx-3" />
          <PanelRow icon={<Link className="size-4" />} label="查看全部" />
        </div>
      </div>
    </aside>
  );
}
