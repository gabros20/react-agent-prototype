"use client";

import { marked } from "marked";
import { useEffect, useState } from "react";
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

export function Markdown({ children, className = "" }: MarkdownProps) {
	const [html, setHtml] = useState("");

	useEffect(() => {
		const parseMarkdown = async () => {
			try {
				// Parse markdown to HTML
				const rawHtml = await marked.parse(children);

				// Sanitize HTML to prevent XSS (DOMPurify only works in browser)
				const cleanHtml =
					typeof window !== "undefined"
						? DOMPurify.sanitize(rawHtml, {
								ADD_ATTR: ["target"], // Allow target attribute for links
								ADD_TAGS: ["img"], // Ensure images are allowed
						  })
						: rawHtml; // SSR fallback

				setHtml(cleanHtml);
			} catch (error) {
				console.error("Markdown parsing error:", error);
				setHtml(children); // Fallback to plain text
			}
		};

		parseMarkdown();
	}, [children]);

	return <div className={`prose prose-sm max-w-none ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
