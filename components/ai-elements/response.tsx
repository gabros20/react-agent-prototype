"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";

export type ResponseProps = {
  children?: string;
  className?: string;
  components?: Components;
};

// Custom image component - fixes malformed URLs where agent adds https:// to local /uploads/ paths
const MarkdownImage = ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  let fixedSrc = src;
  if (typeof src === 'string') {
    const malformedMatch = src.match(/^https?:\/+uploads\//);
    if (malformedMatch) {
      fixedSrc = src.replace(/^https?:\/+/, '/');
    }
  }

  return (
    <img
      src={fixedSrc}
      alt={alt || ""}
      loading="eager"
      decoding="sync"
      className="rounded-md max-w-full h-auto"
      style={{ maxHeight: "300px", objectFit: "contain" }}
      {...props}
    />
  );
};

export const Response = memo(
  ({ children, className, components }: ResponseProps) => (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      <ReactMarkdown
        components={{
          img: MarkdownImage,
          ...components,
        }}
        rehypePlugins={[rehypeRaw]}
      >
        {children}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
