"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { type TraceEntry, ENTRY_TYPE_COLORS, ENTRY_TYPE_LABELS, formatDuration, formatTimestamp, useTraceStore } from "../../_stores/trace-store";
import { countTokens, formatTokenCount } from "@/lib/tokenizer";

// Format data for display - prettify strings, format JSON
function formatDataForDisplay(data: unknown): string {
	if (data === undefined || data === null) return "";

	if (typeof data === "string") {
		// Try to parse as JSON first - if it's stringified JSON, prettify it
		try {
			const parsed = JSON.parse(data);
			if (typeof parsed === "object" && parsed !== null) {
				return JSON.stringify(parsed, null, 2);
			}
		} catch {
			// Not JSON, treat as plain string
		}
		// If it's a plain string, display it with proper line breaks
		return data.replace(/\\n/g, "\n");
	}

	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

// Simple syntax highlighting for JSON
function highlightJson(text: string): string {
	return (
		text
			// Keys
			.replace(/"([^"]+)":/g, '<span class="text-blue-600 dark:text-blue-400">"$1"</span>:')
			// String values (handle end of line, comma, or closing brace/bracket)
			.replace(/: "([^"]*)"([,\n\r\}\]]|$)/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>$2')
			// Number values
			.replace(/: (-?\d+\.?\d*)([,\n\r\}\]]|$)/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>$2')
			// Boolean values
			.replace(/: (true|false)([,\n\r\}\]]|$)/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>$2')
			// Null values
			.replace(/: (null)([,\n\r\}\]]|$)/g, ': <span class="text-gray-500">$1</span>$2')
	);
}

// Syntax highlighting for XML/prompt content
function highlightXml(text: string): string {
	// Escape HTML first to prevent XSS
	const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

	return (
		escaped
			// XML tags: <tag> </tag> <tag/>
			.replace(/&lt;(\/?)([\w-]+)(.*?)(\/?)?&gt;/g, (match, slash1, tagName, attrs, slash2) => {
				const highlightedAttrs = attrs.replace(
					/([\w-]+)=(&quot;|"|')([^"']*?)(&quot;|"|')/g,
					'<span class="text-amber-600 dark:text-amber-400">$1</span>=<span class="text-green-600 dark:text-green-400">$2$3$4</span>'
				);
				return `<span class="text-rose-600 dark:text-rose-400">&lt;${slash1}</span><span class="text-blue-600 dark:text-blue-400">${tagName}</span>${highlightedAttrs}<span class="text-rose-600 dark:text-rose-400">${
					slash2 || ""
				}&gt;</span>`;
			})
			// Highlight **bold** text
			.replace(/\*\*([^*]+)\*\*/g, '<span class="font-bold text-foreground">**$1**</span>')
			// Highlight `code` backticks
			.replace(/`([^`]+)`/g, '<span class="text-pink-600 dark:text-pink-400 bg-muted px-1 rounded">`$1`</span>')
			// Highlight URLs
			.replace(/(https?:\/\/[^\s<>"]+)/g, '<span class="text-cyan-600 dark:text-cyan-400 underline">$1</span>')
			// Highlight markdown headers (# ## ###)
			.replace(/^(#{1,6})\s+(.+)$/gm, '<span class="text-purple-600 dark:text-purple-400 font-semibold">$1 $2</span>')
			// Highlight bullet points
			.replace(/^(\s*[-*])\s+/gm, '<span class="text-orange-500">$1</span> ')
			// Highlight numbered lists
			.replace(/^(\s*\d+\.)\s+/gm, '<span class="text-orange-500">$1</span> ')
	);
}

export function TraceDetailModal() {
	const { isModalOpen, modalEntry, closeModal } = useTraceStore();
	const [copiedTab, setCopiedTab] = useState<string | null>(null);

	const formattedInput = useMemo(() => {
		if (!modalEntry?.input) return "";
		return formatDataForDisplay(modalEntry.input);
	}, [modalEntry?.input]);

	const formattedOutput = useMemo(() => {
		if (!modalEntry?.output) return "";
		return formatDataForDisplay(modalEntry.output);
	}, [modalEntry?.output]);

	// Calculate token counts for display
	const inputTokens = useMemo(() => {
		if (!modalEntry?.input) return 0;
		const text = typeof modalEntry.input === "string" ? modalEntry.input : JSON.stringify(modalEntry.input);
		return countTokens(text);
	}, [modalEntry?.input]);

	const outputTokens = useMemo(() => {
		if (!modalEntry?.output) return 0;
		const text = typeof modalEntry.output === "string" ? modalEntry.output : JSON.stringify(modalEntry.output);
		return countTokens(text);
	}, [modalEntry?.output]);

	if (!modalEntry) return null;

	const handleCopy = async (data: unknown, tab: string) => {
		const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
		await navigator.clipboard.writeText(text);
		setCopiedTab(tab);
		setTimeout(() => setCopiedTab(null), 2000);
	};

	const metadata = {
		traceId: modalEntry.traceId,
		entryId: modalEntry.id,
		timestamp: new Date(modalEntry.timestamp).toISOString(),
		duration: modalEntry.duration ? `${modalEntry.duration}ms` : undefined,
		stepNumber: modalEntry.stepNumber,
		toolCallId: modalEntry.toolCallId,
		jobId: modalEntry.jobId,
		tokens: modalEntry.tokens,
		tokenCounts: {
			input: inputTokens,
			output: outputTokens,
			total: inputTokens + outputTokens,
		},
		level: modalEntry.level,
	};

	// Filter out undefined values
	const filteredMetadata = Object.fromEntries(Object.entries(metadata).filter(([_, v]) => v !== undefined));

	const isInputString = typeof modalEntry.input === "string";
	const isOutputString = typeof modalEntry.output === "string";

	return (
		<Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
			<DialogContent size='full' className='max-h-[90vh] flex flex-col'>
				<DialogHeader className='flex-shrink-0'>
					<div className='flex items-center justify-between gap-4 pr-8'>
						<div className='flex items-center gap-3'>
							<Badge className={cn(ENTRY_TYPE_COLORS[modalEntry.type], "text-white")}>{ENTRY_TYPE_LABELS[modalEntry.type]}</Badge>
							{modalEntry.toolName && <span className='font-mono text-sm font-medium'>{modalEntry.toolName}</span>}
						</div>
						<div className='flex items-center gap-3 text-sm text-muted-foreground'>
							<span>{formatTimestamp(modalEntry.timestamp)}</span>
							{modalEntry.duration !== undefined && (
								<>
									<span>•</span>
									<span>{formatDuration(modalEntry.duration)}</span>
								</>
							)}
							{modalEntry.stepNumber !== undefined && (
								<>
									<span>•</span>
									<span>Step {modalEntry.stepNumber}</span>
								</>
							)}
						</div>
					</div>
					<DialogTitle className='text-base font-normal text-muted-foreground mt-2'>{modalEntry.summary}</DialogTitle>
				</DialogHeader>

				{/* Error banner */}
				{modalEntry.error && (
					<div className='bg-red-500/10 border border-red-500/30 rounded-lg p-3 mx-4'>
						<p className='font-medium text-red-600 dark:text-red-400 text-sm'>{modalEntry.error.message}</p>
						{modalEntry.error.stack && (
							<pre className='text-xs text-muted-foreground mt-2 overflow-x-auto whitespace-pre-wrap'>{modalEntry.error.stack}</pre>
						)}
					</div>
				)}

				<Tabs defaultValue='input' className='flex-1 flex flex-col min-h-0 overflow-hidden'>
					<TabsList className='flex-shrink-0 mx-4'>
						<TabsTrigger value='input' disabled={modalEntry.input === undefined}>
							Input{" "}
							{inputTokens > 0 && (
								<span className='ml-1.5 text-xs text-muted-foreground'>({formatTokenCount(inputTokens)} tokens)</span>
							)}
						</TabsTrigger>
						<TabsTrigger value='output' disabled={modalEntry.output === undefined}>
							Output{" "}
							{outputTokens > 0 && (
								<span className='ml-1.5 text-xs text-muted-foreground'>({formatTokenCount(outputTokens)} tokens)</span>
							)}
						</TabsTrigger>
						<TabsTrigger value='metadata'>Metadata</TabsTrigger>
					</TabsList>

					<div className='flex-1 min-h-0 px-4 pb-4'>
						<TabsContent value='input' className='h-full mt-4'>
							<div className='relative h-[90vh] rounded-lg border bg-muted/30'>
								<Button
									variant='outline'
									size='sm'
									className='absolute top-2 right-4 z-10'
									onClick={() => handleCopy(modalEntry.input, "input")}
								>
									{copiedTab === "input" ? <Check className='h-4 w-4 mr-1' /> : <Copy className='h-4 w-4 mr-1' />}
									Copy
								</Button>
								<div className='h-full overflow-scroll p-4'>
									<pre className={cn("text-sm font-mono whitespace-pre-wrap", !isInputString && "text-xs")}>
										<code
											dangerouslySetInnerHTML={{
												__html: isInputString ? highlightXml(formattedInput) : highlightJson(formattedInput),
											}}
										/>
									</pre>
								</div>
							</div>
						</TabsContent>

						<TabsContent value='output' className='h-full mt-4'>
							<div className='relative h-[90vh] rounded-lg border bg-muted/30'>
								<Button
									variant='outline'
									size='sm'
									className='absolute top-2 right-4 z-10'
									onClick={() => handleCopy(modalEntry.output, "output")}
								>
									{copiedTab === "output" ? <Check className='h-4 w-4 mr-1' /> : <Copy className='h-4 w-4 mr-1' />}
									Copy
								</Button>
								<div className='h-[90vh] overflow-scroll p-4'>
									<pre className={cn("text-sm font-mono whitespace-pre-wrap", !isOutputString && "text-xs")}>
										<code
											dangerouslySetInnerHTML={{
												__html: isOutputString ? highlightXml(formattedOutput) : highlightJson(formattedOutput),
											}}
										/>
									</pre>
								</div>
							</div>
						</TabsContent>

						<TabsContent value='metadata' className='h-full mt-4'>
							<div className='relative h-[90vh] rounded-lg border bg-muted/30'>
								<Button
									variant='outline'
									size='sm'
									className='absolute top-2 right-4 z-10'
									onClick={() => handleCopy(filteredMetadata, "metadata")}
								>
									{copiedTab === "metadata" ? <Check className='h-4 w-4 mr-1' /> : <Copy className='h-4 w-4 mr-1' />}
									Copy
								</Button>
								<div className='h-full overflow-scroll p-4'>
									<pre className='text-xs font-mono whitespace-pre-wrap'>
										<code dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(filteredMetadata, null, 2)) }} />
									</pre>
								</div>
							</div>
						</TabsContent>
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
