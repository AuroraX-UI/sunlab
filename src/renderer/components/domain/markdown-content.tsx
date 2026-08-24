import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { CodeBlock } from "./code-block";

/**
 * 自定义 Markdown 渲染器组件映射。
 * 将 Markdown 元素映射到带 Tailwind 样式的 React 组件。
 */
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 text-[20px] font-semibold text-[var(--color-text-primary)]">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-[17px] font-semibold text-[var(--color-text-primary)]">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-[15px] font-semibold text-[var(--color-text-primary)]">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[14px] leading-relaxed text-[var(--color-text-primary)]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-6 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-6 text-[14px] leading-relaxed text-[var(--color-text-primary)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-accent)] hover:underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const isBlock = Boolean(match) || String(children).includes("\n");
    if (isBlock) {
      return <CodeBlock language={match?.[1] ?? "text"} code={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className="rounded bg-[var(--color-code-bg)] px-1.5 py-0.5 text-[13px] font-[var(--font-mono)] text-[var(--color-text-primary)]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-[var(--color-border)] pl-4 text-[var(--color-text-secondary)]">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--color-border)] px-3 py-1.5">{children}</td>
  ),
};

/**
 * Markdown 渲染组件。
 * 使用 react-markdown + remark-gfm，自定义组件映射保持 Codex Desktop 视觉风格。
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
