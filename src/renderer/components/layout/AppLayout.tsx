import { Composer } from "@/renderer/components/layout/Composer";
import { RightPanel } from "@/renderer/components/layout/RightPanel";
import { Sidebar } from "@/renderer/components/layout/Sidebar";
import { TopBar } from "@/renderer/components/layout/TopBar";
import { useUiStore } from "@/renderer/stores/ui-store";
import type { ReactNode } from "react";

/**
 * 应用三栏布局。
 * 左侧 Sidebar + 中间主区域（TopBar + children + Composer）+ 右侧面板。
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const sidebarVisible = useUiStore((state) => state.sidebarVisible);
  const rightPanelVisible = useUiStore((state) => state.rightPanelVisible);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarVisible && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <Composer />
      </div>
      {rightPanelVisible && <RightPanel />}
    </div>
  );
}
