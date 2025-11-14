Thought for 2sI'll help you understand how to implement a recursive agent with the AI SDK version 6. Let me first search for the AI SDK documentation and examples to give you accurate information.

Searched AI SDK examplesSearched AI SDK docsGreat! Now let me get more detailed information about AI SDK 6 and error handling patterns.

Fetched AI SDK docsNow let me search for specific error handling documentation in AI SDK.

Searched error handlingNow let me fetch the official error handling documentation.

Fetched error docsNow I have comprehensive information about AI SDK 6 and error handling. Let me create a detailed explanation with code examples.

# Implementing Recursive Agents with AI SDK 6: A Complete Guide

Great question! Let me walk you through implementing a recursive agent with AI SDK 6 that uses **thinking-acting-observing patterns**, **prompt chaining**, **multi-step tool execution**, and **robust error recovery**.

## Core Concepts

### 1. **AI SDK 6 Agent Abstraction**

AI SDK 6 introduces a unified `Agent` interface with `ToolLoopAgent` as the default implementation. It automatically handles the **think-act-observe loop**:

1. **Think**: LLM reasons about the task
2. **Act**: Executes tool calls
3. **Observe**: Processes tool results
4. **Recurse**: Repeats until completion

### 2. **Loop Control with `stopWhen`**

AI SDK v5+ replaced `maxSteps` with `stopWhen` for flexible loop control:

```typescript
import { stepCountIs, toolCallCountIs } from "ai";

// Stop after 20 steps (default in ToolLoopAgent)
stopWhen: stepCountIs(20);

// Stop after 5 tool calls
stopWhen: toolCallCountIs(5);

// Custom condition
stopWhen: async ({ steps }) => {
	return steps.some((step) => step.text?.includes("FINAL_ANSWER"));
};
```

## Complete Implementation Example

Here's a **full recursive agent** with thinking, acting, observing, error recovery, and retries:

```typescript
import { ToolLoopAgent, tool, stepCountIs, APICallError } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Define tools for the agent
const searchTool = tool({
	description: "Search for information on the web",
	inputSchema: z.object({
		query: z.string(),
	}),
	execute: async ({ query }) => {
		// Simulate search with potential failures
		if (Math.random() < 0.2) {
			throw new Error("Search service temporarily unavailable");
		}
		return {
			results: [`Result 1 for ${query}`, `Result 2 for ${query}`],
		};
	},
});

const calculatorTool = tool({
	description: "Perform mathematical calculations",
	inputSchema: z.object({
		expression: z.string(),
	}),
	execute: async ({ expression }) => {
		try {
			// Evaluate safely (use a real math parser in production)
			const result = eval(expression);
			return { result };
		} catch (error) {
			throw new Error(`Invalid expression: ${expression}`);
		}
	},
});

const memoryTool = tool({
	description: "Store important information for later use",
	inputSchema: z.object({
		key: z.string(),
		value: z.string(),
	}),
	execute: async ({ key, value }) => {
		// Store in a simple memory system
		memory.set(key, value);
		return { stored: true, key };
	},
});

// Agent memory
const memory = new Map<string, string>();

// Create the recursive agent
const researchAgent = new ToolLoopAgent({
	model: openai("gpt-4o"),

	// System instructions define the thinking process
	instructions: `You are a research assistant that breaks down complex questions.
  
  Think step-by-step:
  1. Analyze the question and identify what information you need
  2. Use available tools to gather information
  3. Store important findings using the memory tool
  4. Synthesize your findings into a final answer
  5. When you have a complete answer, include "FINAL_ANSWER:" prefix
  
  Be thorough but efficient.`,

	// Available tools
	tools: {
		search: searchTool,
		calculator: calculatorTool,
		memory: memoryTool,
	},

	// Loop control - stop after 15 steps or when final answer is given
	stopWhen: async ({ steps }) => {
		// Check if we've reached max steps
		if (steps.length >= 15) {
			return true;
		}

		// Check if the last step contains a final answer
		const lastStep = steps[steps.length - 1];
		return lastStep?.text?.includes("FINAL_ANSWER:") || false;
	},
});

// Wrapper with retry logic and error recovery
async function runAgentWithRetry(prompt: string, maxRetries: number = 3): Promise<{ text: string; steps: number; retries: number }> {
	let retryCount = 0;
	let delay = 1000; // Start with 1 second delay

	while (retryCount <= maxRetries) {
		try {
			console.log(`[Attempt ${retryCount + 1}] Starting agent...`);

			// Run the agent
			const result = await researchAgent.generate({
				prompt,
			});

			console.log(`[Success] Completed in ${result.steps.length} steps`);

			return {
				text: result.text,
				steps: result.steps.length,
				retries: retryCount,
			};
		} catch (error) {
			retryCount++;

			// Check if it's a recoverable error
			if (APICallError.isInstance(error)) {
				console.error(`[Error] API call failed (${error.statusCode}): ${error.message}`);

				// Don't retry on client errors (4xx except 429)
				if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
					throw new Error(`Non-recoverable API error: ${error.message}`);
				}
			} else {
				console.error(`[Error] ${error.message}`);
			}

			// If we've exhausted retries, throw the error
			if (retryCount > maxRetries) {
				throw new Error(`Agent failed after ${maxRetries} retries: ${error.message}`);
			}

			// Exponential backoff with jitter
			const jitter = Math.random() * 500;
			const waitTime = Math.min(delay * 2 ** retryCount, 10000) + jitter;

			console.log(`[Retry ${retryCount}] Waiting ${Math.round(waitTime)}ms before retry...`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	throw new Error("Unexpected error: retry loop exited without result");
}

// Usage example
async function main() {
	try {
		const result = await runAgentWithRetry("What is the population of Tokyo and what percentage is that of Japan's total population?");

		console.log("\n=== RESULT ===");
		console.log(`Steps: ${result.steps}`);
		console.log(`Retries: ${result.retries}`);
		console.log(`Answer: ${result.text}`);
	} catch (error) {
		console.error("Fatal error:", error.message);
	}
}

main();
```

## Key Features Explained

### **1. Prompt Chaining (Implicit in ToolLoopAgent)**

The `ToolLoopAgent` automatically chains prompts by:

-   Adding tool results to the conversation history
-   Continuing the conversation with the LLM after each tool execution
-   Building context progressively through multiple steps

### **2. Multi-Step Tool Calling**

```typescript
// The agent can call multiple tools in sequence
// Step 1: Agent calls search tool
// Step 2: Agent calls calculator tool with search results
// Step 3: Agent calls memory tool to store findings
// Step 4: Agent synthesizes final answer
```

### **3. Error Recovery Strategies**

#### **Strategy A: Tool-Level Error Handling**

```typescript
const resilientTool = tool({
	description: "A tool with built-in error recovery",
	inputSchema: z.object({ query: z.string() }),

	execute: async ({ query }, { messages }) => {
		try {
			return await riskyOperation(query);
		} catch (error) {
			// Return error context instead of throwing
			return {
				success: false,
				error: error.message,
				suggestion: "Try reformulating your query",
			};
		}
	},
});
```

#### **Strategy B: Agent-Level Retry with Exponential Backoff**

```typescript
async function runWithBackoff(agent, prompt, maxRetries = 3) {
	let retryCount = 0;
	let delay = 500;

	while (true) {
		try {
			return await agent.generate({ prompt });
		} catch (error) {
			retryCount++;

			// Only retry on specific errors
			if (APICallError.isInstance(error) && error.statusCode === 429 && retryCount <= maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, delay * 2 ** retryCount));
			} else {
				throw error;
			}
		}
	}
}
```

#### **Strategy C: Streaming with Error Parts**

```typescript
const { fullStream } = await agent.stream({ prompt });

for await (const part of fullStream) {
	switch (part.type) {
		case "text-delta":
			process.stdout.write(part.textDelta);
			break;

		case "tool-call":
			console.log(`Calling tool: ${part.toolName}`);
			break;

		case "error":
			// Handle streaming errors gracefully
			console.error("Stream error:", part.error);
			// Optionally continue or abort
			break;

		case "tool-error":
			// Handle tool execution errors
			console.error(`Tool ${part.toolName} failed:`, part.error);
			break;

		case "abort":
			console.log("Stream aborted");
			break;
	}
}
```

### **4. Advanced: Custom Recursive Agent**

For more control, implement the `Agent` interface yourself:

```typescript
import { Agent, generateText, CoreMessage } from "ai";

class CustomRecursiveAgent implements Agent {
	private model = openai("gpt-4o");
	private maxDepth: number;

	constructor(maxDepth: number = 5) {
		this.maxDepth = maxDepth;
	}

	async generate({ prompt, messages = [] }: { prompt: string; messages?: CoreMessage[] }) {
		return this.recursiveGenerate(prompt, messages, 0);
	}

	private async recursiveGenerate(prompt: string, messages: CoreMessage[], depth: number) {
		// Base case: max depth reached
		if (depth >= this.maxDepth) {
			return {
				text: "Max recursion depth reached",
				steps: [],
			};
		}

		// Make LLM call with error handling
		try {
			const result = await generateText({
				model: this.model,
				messages: [...messages, { role: "user", content: prompt }],
				tools: {
					// Your tools here
				},
			});

			// Check if we need to recurse
			if (result.toolCalls && result.toolCalls.length > 0) {
				// Process tool results and recurse
				const newMessages = [...messages, { role: "user", content: prompt }, { role: "assistant", content: result.text }];

				return this.recursiveGenerate("Continue based on the tool results", newMessages, depth + 1);
			}

			// Base case: no more tool calls
			return result;
		} catch (error) {
			// Implement retry logic here
			throw error;
		}
	}
}
```

## Best Practices Summary

1. **Use `ToolLoopAgent`** for most use cases - it handles recursion automatically
2. **Set appropriate `stopWhen` conditions** to prevent infinite loops
3. **Implement exponential backoff** for rate-limited APIs (429 errors)
4. **Handle errors at multiple levels**: tool level, agent level, and application level
5. **Use streaming with `fullStream`** to handle errors gracefully in real-time
6. **Log step counts and retries** for debugging and monitoring
7. **Include clear instructions** in the agent's system prompt to guide the thinking process
8. **Consider implementing circuit breakers** for production systems to prevent cascading failures

This architecture gives you a robust, production-ready recursive agent that can handle complex multi-step reasoning with automatic error recovery!
Thought for 4sGreat follow-up question! Let me search for AI SDK examples and documentation about vector database integration.

Searched vector DB examplesSearched AI SDK embeddingsExcellent! Let me fetch more detailed information about AI SDK embeddings and vector database integration.

Fetched embeddings docsNow I have comprehensive information. Let me provide you with a detailed guide on integrating vector databases with AI SDK 6 agents.

# Integrating Vector Databases with AI SDK 6 Agents

The AI SDK 6 has excellent support for vector databases through **embeddings** and **tool calling**. You can plug in any vector database (Supabase pgvector, Neon, Upstash Vector, Pinecone, etc.) to create a semantic memory layer for your recursive agent.

## Architecture Overview

```plaintext
User Query → Agent → Tools → [Search Tool → Vector DB → Retrieve Context] → LLM + Context → Response
                ↓
           [Store Tool → Embed → Vector DB → Store Memory]
```

## Complete Implementation with Vector Database

Here's a full example integrating **Upstash Vector** (but the pattern works for any vector DB):

### **1. Setup Vector Store with Embeddings**

```typescript
// lib/vector-store.ts
import { Index } from "@upstash/vector";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

// Initialize your vector database client
const vectorIndex = new Index({
	url: process.env.UPSTASH_VECTOR_REST_URL!,
	token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

// Choose your embedding model
const embeddingModel = openai.textEmbeddingModel("text-embedding-3-small");

// Chunking strategy - split content into smaller pieces
function chunkText(text: string, maxChunkSize: number = 500): string[] {
	const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
	const chunks: string[] = [];
	let currentChunk = "";

	for (const sentence of sentences) {
		if ((currentChunk + sentence).length > maxChunkSize) {
			if (currentChunk) chunks.push(currentChunk.trim());
			currentChunk = sentence;
		} else {
			currentChunk += " " + sentence;
		}
	}

	if (currentChunk) chunks.push(currentChunk.trim());
	return chunks;
}

// Store content with embeddings (for agent memory)
export async function storeMemory(content: string, metadata: { userId?: string; topic?: string } = {}): Promise<{ stored: number; ids: string[] }> {
	try {
		const chunks = chunkText(content);

		// Generate embeddings for all chunks in parallel
		const { embeddings } = await embedMany({
			model: embeddingModel,
			values: chunks,
		});

		// Prepare vector upserts with metadata
		const vectors = embeddings.map((embedding, i) => ({
			id: `${Date.now()}-${i}`,
			vector: embedding,
			metadata: {
				content: chunks[i],
				timestamp: Date.now(),
				chunkIndex: i,
				...metadata,
			},
		}));

		// Upsert to vector database
		await vectorIndex.upsert(vectors);

		return {
			stored: vectors.length,
			ids: vectors.map((v) => v.id),
		};
	} catch (error) {
		console.error("[Vector Store] Failed to store memory:", error);
		throw new Error(`Memory storage failed: ${error.message}`);
	}
}

// Retrieve relevant context (for RAG)
export async function retrieveContext(
	query: string,
	options: {
		topK?: number;
		minScore?: number;
		filter?: Record<string, any>;
	} = {}
): Promise<Array<{ content: string; score: number; metadata: any }>> {
	try {
		const { topK = 5, minScore = 0.7 } = options;

		// Generate embedding for the query
		const { embedding } = await embed({
			model: embeddingModel,
			value: query,
		});

		// Query vector database
		const results = await vectorIndex.query({
			vector: embedding,
			topK,
			includeMetadata: true,
			filter: options.filter,
		});

		// Filter by minimum similarity score
		return results
			.filter((result) => result.score >= minScore)
			.map((result) => ({
				content: result.metadata?.content as string,
				score: result.score,
				metadata: result.metadata,
			}));
	} catch (error) {
		console.error("[Vector Store] Failed to retrieve context:", error);
		throw new Error(`Context retrieval failed: ${error.message}`);
	}
}

// Alternative: Using Supabase pgvector
export async function storeMemorySupabase(content: string, supabase: SupabaseClient) {
	const chunks = chunkText(content);
	const { embeddings } = await embedMany({
		model: embeddingModel,
		values: chunks,
	});

	const records = chunks.map((chunk, i) => ({
		content: chunk,
		embedding: embeddings[i],
		created_at: new Date().toISOString(),
	}));

	const { error } = await supabase.from("memory_vectors").insert(records);

	if (error) throw error;
	return records.length;
}

export async function retrieveContextSupabase(query: string, supabase: SupabaseClient, options: { topK?: number } = {}) {
	const { embedding } = await embed({
		model: embeddingModel,
		value: query,
	});

	// Using pgvector's similarity search
	const { data, error } = await supabase.rpc("match_memory_vectors", {
		query_embedding: embedding,
		match_count: options.topK || 5,
		match_threshold: 0.7,
	});

	if (error) throw error;
	return data;
}
```

### **2. Create Memory Tools for Your Agent**

```typescript
// lib/agent-tools.ts
import { tool } from "ai";
import { z } from "zod";
import { storeMemory, retrieveContext } from "./vector-store";

// Tool: Store information in long-term memory
export const rememberTool = tool({
	description: `Store important information in long-term memory for future reference.
  Use this when the user shares facts, preferences, or context you should remember.`,

	inputSchema: z.object({
		content: z.string().describe("The information to remember"),
		topic: z.string().optional().describe("Optional topic/category"),
		importance: z.enum(["low", "medium", "high"]).default("medium"),
	}),

	execute: async ({ content, topic, importance }) => {
		try {
			const result = await storeMemory(content, {
				topic,
				importance,
				storedAt: new Date().toISOString(),
			});

			return {
				success: true,
				message: `Stored ${result.stored} memory chunk(s)`,
				ids: result.ids,
			};
		} catch (error) {
			return {
				success: false,
				error: error.message,
			};
		}
	},
});

// Tool: Retrieve relevant information from memory
export const recallTool = tool({
	description: `Search long-term memory for relevant information based on a query.
  Use this to recall facts, preferences, or context from previous conversations.`,

	inputSchema: z.object({
		query: z.string().describe("What to search for in memory"),
		topK: z.number().optional().default(5).describe("Number of results"),
	}),

	execute: async ({ query, topK }) => {
		try {
			const results = await retrieveContext(query, { topK });

			if (results.length === 0) {
				return {
					found: false,
					message: "No relevant memories found",
				};
			}

			return {
				found: true,
				results: results.map((r) => ({
					content: r.content,
					relevance: r.score,
					metadata: r.metadata,
				})),
			};
		} catch (error) {
			return {
				found: false,
				error: error.message,
			};
		}
	},
});

// Tool: Semantic search across a knowledge base
export const searchKnowledgeTool = tool({
	description: `Search the knowledge base using semantic search.
  Returns the most relevant documents based on meaning, not just keywords.`,

	inputSchema: z.object({
		query: z.string(),
		filters: z
			.object({
				topic: z.string().optional(),
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
			})
			.optional(),
	}),

	execute: async ({ query, filters }) => {
		try {
			const results = await retrieveContext(query, {
				topK: 10,
				minScore: 0.75,
				filter: filters,
			});

			return {
				results: results.map((r) => ({
					content: r.content,
					score: r.score,
					...r.metadata,
				})),
				count: results.length,
			};
		} catch (error) {
			return { error: error.message };
		}
	},
});
```

### **3. Create Agent with Memory Tools**

```typescript
// lib/memory-agent.ts
import { ToolLoopAgent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { rememberTool, recallTool, searchKnowledgeTool } from "./agent-tools";

export const memoryAgent = new ToolLoopAgent({
	model: openai("gpt-4o"),

	instructions: `You are a helpful AI assistant with long-term memory.

MEMORY USAGE:
1. Use the "remember" tool to store important information the user shares
2. Use the "recall" tool to retrieve relevant context from previous conversations
3. Always check memory before answering questions about user preferences or past interactions

THINKING PROCESS:
- Step 1: Understand the user's query
- Step 2: Check if you need to recall any context from memory
- Step 3: Use tools or knowledge to answer the question
- Step 4: Store any new important information shared by the user
- Step 5: Provide a complete answer

Be conversational and reference past interactions when relevant.`,

	tools: {
		remember: rememberTool,
		recall: recallTool,
		searchKnowledge: searchKnowledgeTool,
	},

	stopWhen: stepCountIs(15),
});
```

### **4. Agent with Retry Logic & Error Recovery**

```typescript
// app/api/agent/route.ts
import { APICallError } from "ai";
import { memoryAgent } from "@/lib/memory-agent";

export const maxDuration = 60;

export async function POST(req: Request) {
	try {
		const { prompt, conversationId } = await req.json();

		// Run agent with retry logic
		const result = await runAgentWithRetry(prompt, {
			maxRetries: 3,
			conversationId,
		});

		return Response.json(result);
	} catch (error) {
		console.error("[Agent API] Error:", error);
		return Response.json({ error: error.message }, { status: 500 });
	}
}

async function runAgentWithRetry(
	prompt: string,
	options: {
		maxRetries?: number;
		conversationId?: string;
	} = {}
) {
	const { maxRetries = 3, conversationId } = options;
	let retryCount = 0;
	let delay = 1000;

	while (retryCount <= maxRetries) {
		try {
			console.log(`[v0] Attempt ${retryCount + 1} - Running agent...`);

			// Run the agent
			const result = await memoryAgent.generate({
				prompt,
				// Pass conversation context if needed
				messages: conversationId ? await getConversationHistory(conversationId) : [],
			});

			console.log(`[v0] Success - Completed in ${result.steps.length} steps`);

			return {
				text: result.text,
				steps: result.steps.length,
				usage: result.usage,
				retries: retryCount,
			};
		} catch (error) {
			retryCount++;

			// Handle specific error types
			if (APICallError.isInstance(error)) {
				console.error(`[v0] API Error ${error.statusCode}: ${error.message}`);

				// Don't retry client errors (except rate limits)
				if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
					throw error;
				}
			}

			// Check for vector store errors
			if (error.message.includes("Vector") || error.message.includes("embedding")) {
				console.error("[v0] Vector store error - attempting fallback");
				// Optionally: Run agent without memory tools
			}

			if (retryCount > maxRetries) {
				throw new Error(`Agent failed after ${maxRetries} retries: ${error.message}`);
			}

			// Exponential backoff with jitter
			const jitter = Math.random() * 500;
			const waitTime = Math.min(delay * 2 ** retryCount, 10000) + jitter;

			console.log(`[v0] Retrying in ${Math.round(waitTime)}ms...`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}
	}

	throw new Error("Unexpected: retry loop completed without result");
}

async function getConversationHistory(conversationId: string) {
	// Retrieve conversation history from your database
	// Return as CoreMessage[] format
	return [];
}
```

### **5. Streaming Response with Vector Search**

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { rememberTool, recallTool } from "@/lib/agent-tools";

export async function POST(req: Request) {
	const { messages } = await req.json();

	// Before streaming, do a quick memory lookup
	const lastMessage = messages[messages.length - 1];
	const relevantContext = await retrieveContext(lastMessage.content, {
		topK: 3,
	});

	// Inject context into system prompt
	const contextPrompt = relevantContext.length > 0 ? `\n\nRelevant context from memory:\n${relevantContext.map((r) => r.content).join("\n")}` : "";

	const result = streamText({
		model: openai("gpt-4o"),
		messages,
		system: `You are a helpful assistant with access to long-term memory.${contextPrompt}`,
		tools: {
			remember: rememberTool,
			recall: recallTool,
		},
	});

	return result.toUIMessageStreamResponse();
}
```

## Supported Vector Databases

You can use **any** vector database with this pattern. Here are popular options:

### **Upstash Vector**

-   Serverless, no infrastructure
-   Built-in hosted embedding models OR custom embeddings
-   REST API, perfect for edge functions

### **Supabase pgvector**

```sql
-- SQL setup for Supabase
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_vectors (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  embedding VECTOR(1536), -- Match your embedding dimensions
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON memory_vectors USING ivfflat (embedding vector_cosine_ops);

-- Function for similarity search
CREATE FUNCTION match_memory_vectors(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM memory_vectors
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### **Neon with pgvector**

Same as Supabase, use the `@neondatabase/serverless` package.

### **Pinecone**

```typescript
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index("agent-memory");
```

## Best Practices

1. **Chunk Strategically**: Split content into 200-500 token chunks for optimal retrieval
2. **Use Metadata**: Add timestamps, topics, user IDs for filtered searches
3. **Hybrid Search**: Combine semantic search with keyword filtering
4. **Cache Embeddings**: Don't re-embed the same content
5. **Monitor Costs**: Track embedding API calls (typically $0.00013 per 1K tokens for OpenAI)
6. **Handle Failures Gracefully**: If vector store fails, agent can still respond without memory
7. **Deduplicate**: Check for similar content before storing to avoid redundancy

This architecture gives you a production-ready recursive agent with semantic memory that can learn from conversations and retrieve relevant context on-demand!
