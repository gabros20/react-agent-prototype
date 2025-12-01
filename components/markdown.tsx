"use client";

import { marked } from "marked";
import { useMemo } from "react";
import DOMPurify from "dompurify";

interface MarkdownProps {
	children: string;
	className?: string;
}

// Configure marked for better rendering
marked.setOptions({
	gfm: true, // GitHub Flavored Markdown
	breaks: true, // Convert \n to <br>
});

// Custom renderer with fixed image dimensions to prevent layout shifts
const renderer = new marked.Renderer();
renderer.image = ({ href, title, text }) => {
	// Set explicit dimensions to reserve space and prevent layout shifts
	// Using max-width with fixed height creates a bounded area
	return `<img
		src="${href}"
		alt="${text || ''}"
		${title ? `title="${title}"` : ''}
		loading="eager"
		decoding="sync"
		width="400"
		height="300"
		class="rounded-md object-contain"
		style="max-width: 100%; height: auto; max-height: 300px;"
	/>`;
};

marked.use({ renderer });

// Synchronous parse function - marked.parse can be sync with { async: false }
function parseMarkdown(content: string): string {
	try {
		const rawHtml = marked.parse(content, { async: false }) as string;

		if (typeof window !== "undefined") {
			return DOMPurify.sanitize(rawHtml, {
				ADD_ATTR: ["target", "loading", "decoding", "width", "height", "style"],
				ADD_TAGS: ["img"],
			});
		}
		return rawHtml;
	} catch (error) {
		console.error("Markdown parsing error:", error);
		return content;
	}
}

export function Markdown({ children, className = "" }: MarkdownProps) {
	// Use useMemo for synchronous parsing - no layout shifts from async state updates
	const html = useMemo(() => parseMarkdown(children), [children]);

	return (
		<div
			className={`prose prose-sm max-w-none ${className}`}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
