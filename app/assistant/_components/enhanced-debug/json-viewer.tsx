"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, Copy, Check, Maximize2 } from "lucide-react";

interface JsonViewerProps {
	data: unknown;
	maxHeight?: string;
	className?: string;
	onFullView?: () => void;
	showFullViewButton?: boolean;
}

export function JsonViewer({ data, maxHeight = "200px", className, onFullView, showFullViewButton = true }: JsonViewerProps) {
	const [copied, setCopied] = useState(false);

	const formattedJson = useMemo(() => {
		try {
			return JSON.stringify(data, null, 2);
		} catch {
			return String(data);
		}
	}, [data]);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(formattedJson);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (data === undefined || data === null) {
		return <div className={cn("text-xs text-muted-foreground italic", className)}>No data</div>;
	}

	return (
		<div className={cn("relative group overflow-hidden", className)}>
			<pre
				className={cn(
					"text-xs bg-muted/50 p-3 rounded-md overflow-auto font-mono",
					"border border-border/50 whitespace-pre-wrap break-words"
				)}
				style={{ maxHeight }}
			>
				<code>
					<JsonSyntaxHighlight json={formattedJson} />
				</code>
			</pre>

			<div className='absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
				<Button variant='ghost' size='icon' className='h-6 w-6 bg-background/80 hover:bg-background' onClick={handleCopy}>
					{copied ? <Check className='h-3 w-3' /> : <Copy className='h-3 w-3' />}
				</Button>
				{showFullViewButton && onFullView && (
					<Button variant='ghost' size='icon' className='h-6 w-6 bg-background/80 hover:bg-background' onClick={onFullView}>
						<Maximize2 className='h-3 w-3' />
					</Button>
				)}
			</div>
		</div>
	);
}

// Simple JSON syntax highlighting without external deps
function JsonSyntaxHighlight({ json }: { json: string }) {
	const highlighted = useMemo(() => {
		return json
			.replace(/"([^"]+)":/g, '<span class="text-blue-600 dark:text-blue-400">"$1"</span>:')
			.replace(/: "([^"]*)"([,\n])/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>$2')
			.replace(/: (\d+\.?\d*)([,\n])/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>$2')
			.replace(/: (true|false)([,\n])/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>$2')
			.replace(/: (null)([,\n])/g, ': <span class="text-gray-500">$1</span>$2');
	}, [json]);

	return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

// Collapsible JSON viewer for nested objects
interface CollapsibleJsonProps {
	data: unknown;
	label?: string;
	defaultOpen?: boolean;
	className?: string;
	onFullView?: () => void;
}

export function CollapsibleJson({ data, label, defaultOpen = false, className, onFullView }: CollapsibleJsonProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	if (data === undefined || data === null) {
		return null;
	}

	const preview = useMemo(() => {
		try {
			const str = JSON.stringify(data);
			if (str.length <= 50) return str;
			return str.slice(0, 50) + "...";
		} catch {
			return String(data).slice(0, 50);
		}
	}, [data]);

	return (
		<div className={cn("space-y-1", className)}>
			<button
				type='button'
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full'
			>
				<ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
				{label && <span className='font-medium'>{label}:</span>}
				{!isOpen && <span className='truncate text-muted-foreground/70 font-mono'>{preview}</span>}
			</button>

			{isOpen && (
				<div className='ml-4'>
					<JsonViewer data={data} maxHeight='150px' onFullView={onFullView} showFullViewButton={!!onFullView} />
				</div>
			)}
		</div>
	);
}
