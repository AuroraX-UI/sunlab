import { ChevronDown, Clock, FolderOpen, GitPullRequest, HelpCircle, Pencil, Puzzle, Search, Settings } from "lucide-react";
import { ThreadItem } from "@/renderer/components/domain/thread-item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/renderer/components/ui/collapsible";
import { useUiStore } from "@/renderer/stores/ui-store";

/**
 * 侧边栏导航项数据。
 */
const NAV_ITEMS = [
  { icon: Pencil, label: "新对话" },
  { icon: GitPullRequest, label: "拉取请求" },
  { icon: Clock, label: "已安排" },
  { icon: Puzzle, label: "插件" },
] as const;

/**
 * 项目分组 mock 数据（Phase 1 静态展示，后续从 IPC 获取）。
 */
const PROJECT_GROUPS = [
  { name: "funfox", threads: [{ id: "funfox-1", title: "详细了解当前项目和开发进...", loading: true }] },
  { name: "RedHub", threads: [{ id: "redhub-1", title: "你先了解下当前项目，我们...", unread: true }] },
  { name: "爬虫项目", threads: [{ id: "spider-1", title: "先了解当前项目、问题和开发..." }] },
  { name: "数据库代理 - Data Nexus", threads: [{ id: "nexus-1", title: "先仔细了解当前项目" }] },
  { name: "sunlab", threads: [{ id: "sunlab-1", title: "Codex Harness 在2026年8月全..." }] },
] as const;

/**
 * 最近线程 mock 数据。
 */
const RECENT_THREADS = [
  { id: "recent-1", title: "有mcp工具127.0.0.1:30837可以访问..." },
  { id: "recent-2", title: "搜索现任美国总统" },
  { id: "recent-3", title: "整理一下README文档只需要最外面..." },
  { id: "recent-4", title: "调研免费临时邮箱部署方案" },
  { id: "recent-5", title: "修复资料完善按钮无响应" },
  { id: "recent-6", title: "讨论一下项目方案，以下信息仅供参..." },
  { id: "recent-7", title: "你是什么模型" },
] as const;

/**
 * 侧边栏品牌行：Codex 下拉 + 搜索 + 新对话按钮。
 */
function SidebarHeader() {
  return (
    <div className="flex h-11 items-center justify-between px-3">
      <button type="button" className="flex items-center gap-1 text-[15px] font-semibold text-[var(--color-text-primary)]">
        Codex
        <ChevronDown className="size-3.5 text-[var(--color-text-tertiary)]" />
      </button>
      <div className="flex items-center gap-1">
        <button type="button" className="rounded-md p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-secondary)]">
          <Search className="size-4" />
        </button>
        <button type="button" className="rounded-md p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-secondary)]">
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * 侧边栏导航区域：新对话/拉取请求/已安排/插件。
 */
function SidebarNav() {
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <Icon className="size-4 shrink-0 text-[var(--color-text-tertiary)]" />
          {label}
        </button>
      ))}
    </nav>
  );
}

/**
 * 项目分组区域：可折叠的项目列表。
 */
function ProjectSection() {
  const expandedProjects = useUiStore((state) => state.expandedProjects);
  const toggleProject = useUiStore((state) => state.toggleProject);
  const selectedThreadId = useUiStore((state) => state.selectedThreadId);
  const selectThread = useUiStore((state) => state.selectThread);

  return (
    <div className="flex flex-col gap-0.5 px-2">
      <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
        项目
      </p>
      {PROJECT_GROUPS.map(({ name, threads }) => (
        <Collapsible
          key={name}
          open={expandedProjects.has(name)}
          onOpenChange={() => toggleProject(name)}
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-tertiary)]">
            <FolderOpen className="size-4 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <ChevronDown className="size-3 shrink-0 text-[var(--color-text-tertiary)]" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-5 flex flex-col gap-0.5 border-l border-[var(--color-border-light)] pl-1">
              {threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  title={thread.title}
                  selected={selectedThreadId === thread.id}
                  unread={"unread" in thread ? thread.unread : false}
                  loading={"loading" in thread ? thread.loading : false}
                  onClick={() => selectThread(thread.id)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
      <button type="button" className="px-2.5 py-1 text-left text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
        展开显示
      </button>
    </div>
  );
}

/**
 * 最近线程区域。
 */
function RecentSection() {
  const selectedThreadId = useUiStore((state) => state.selectedThreadId);
  const selectThread = useUiStore((state) => state.selectThread);

  return (
    <div className="flex flex-col gap-0.5 px-2">
      <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
        最近
      </p>
      {RECENT_THREADS.map((thread) => (
        <ThreadItem
          key={thread.id}
          title={thread.title}
          selected={selectedThreadId === thread.id}
          onClick={() => selectThread(thread.id)}
        />
      ))}
    </div>
  );
}

/**
 * 侧边栏底部：设置 + 帮助。
 */
function SidebarFooter() {
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border-light)] px-3 py-2">
      <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]">
        <Settings className="size-4 text-[var(--color-text-tertiary)]" />
        custom
      </button>
      <button type="button" className="rounded-md p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)]">
        <HelpCircle className="size-4" />
      </button>
    </div>
  );
}

/**
 * 左侧边栏组件：品牌行 + 导航 + 项目分组 + 最近线程 + 底部操作。
 */
export function Sidebar() {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SidebarHeader />
        <SidebarNav />
        <ProjectSection />
        <RecentSection />
      </div>
      <SidebarFooter />
    </aside>
  );
}
