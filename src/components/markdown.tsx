"use client";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function Markdown({ children, components }: { children: string; components?: Components }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold break-words [&_p]:whitespace-pre-wrap">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>{children}</ReactMarkdown>
    </div>
  );
}
