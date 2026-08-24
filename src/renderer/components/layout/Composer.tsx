import { ArrowUp, Plus, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Textarea } from "@/renderer/components/ui/textarea";

/**
 * 底部输入区组件：消息输入 + 权限标签 + 模型选择 + 发送按钮。
 */
export function Composer() {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!draft.trim()) return;
    console.log("发送消息:", draft.trim());
    setDraft("");
  };

  return (
    <footer className="shrink-0 bg-[var(--color-surface)] px-4 pb-3 pt-2">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="输入任务内容..."
          className="min-h-[44px] border-0 bg-transparent focus:border-0 focus:ring-0"
        />
        <div className="flex items-center justify-between px-2.5 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <Plus className="size-4" />
            </button>
            <span className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-success)]">
              <ShieldCheck className="size-3.5" />
              完全访问
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--color-text-tertiary)]">自定义</span>
            <button type="button" className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              最高
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!draft.trim()}
              className="flex size-8 items-center justify-center rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
