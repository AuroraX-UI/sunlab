import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * 代码块属性。
 */
interface CodeBlockProps {
  language?: string;
  code: string;
}

/**
 * 代码块组件：语言标签栏 + 复制按钮 + 等宽字体代码内容。
 * Phase 1 不做语法高亮，Phase 2 接入 Shiki。
 */
export function CodeBlock({ language = "text", code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--color-border-light)]">
      <div className="flex items-center justify-between bg-[var(--color-code-header)] px-3 py-1.5">
        <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-secondary)]"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[var(--color-code-bg)] p-4 text-[13px] leading-relaxed text-[var(--color-text-primary)]">
        <code className="font-[var(--font-mono)]">{code}</code>
      </pre>
    </div>
  );
}
