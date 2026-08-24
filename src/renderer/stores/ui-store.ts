import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * UI 全局状态管理。
 * 管理侧边栏显隐、右侧面板显隐、选中的线程和展开的项目分组。
 */
interface UiStore {
  sidebarVisible: boolean;
  rightPanelVisible: boolean;
  selectedThreadId: string | null;
  expandedProjects: Set<string>;

  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  selectThread: (id: string | null) => void;
  toggleProject: (name: string) => void;
}

export const useUiStore = create<UiStore>()(
  subscribeWithSelector((set) => ({
    sidebarVisible: true,
    rightPanelVisible: true,
    selectedThreadId: null,
    expandedProjects: new Set<string>(),

    toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
    toggleRightPanel: () => set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),
    selectThread: (id) => set({ selectedThreadId: id }),
    toggleProject: (name) =>
      set((state) => {
        const next = new Set(state.expandedProjects);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return { expandedProjects: next };
      }),
  })),
);
