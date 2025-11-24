Thought for 4s# AI SDK Elements - Complete Reference Guide

## Overview

**AI Elements** is a component library built on shadcn/ui specifically for AI applications. It handles the unique challenges of streaming responses, tool displays, markdown rendering, and AI-specific states that standard React components don't address.

**Installation:**

```shellscript
npx ai-elements@latest
# or
pnpm dlx ai-elements@latest
```

**Documentation:** [https://sdk.vercel.ai/docs/ai-sdk-ui](https://sdk.vercel.ai/docs/ai-sdk-ui)

---

## Core Components & Their Purpose

### 1. **Conversation Component**

-   **What it does:** Container for the entire chat interface with auto-scrolling behavior
-   **Use case:** Wraps all messages and handles scroll-to-bottom on new messages
-   **Source:** [https://sdk.vercel.ai/docs/ai-sdk-ui/conversation](https://sdk.vercel.ai/docs/ai-sdk-ui/conversation)
-   **Key features:**

-   Automatic scroll management
-   Handles overflow and virtualization for long conversations
-   Built-in loading states

### 2. **Message Component**

-   **What it does:** Displays individual messages with role-based styling and alignment
-   **Use case:** Wraps each message (user/assistant) with proper styling
-   **Source:** [https://sdk.vercel.ai/docs/ai-sdk-ui/message](https://sdk.vercel.ai/docs/ai-sdk-ui/message)
-   **Key features:**

-   Role-based alignment (user right, assistant left)
-   Handles message parts (text, tool calls, data)
-   Streaming state awareness

-   **Implementation pattern:**

```typescriptreact
import { Message, MessageContent } from "@/components/ai-elements/message"

<Message key={message.id} role={message.role}>
  <MessageContent>
    {/* content here */}
  </MessageContent>
</Message>
```

### 3. **Response Component**

-   **What it does:** Markdown renderer with syntax highlighting for AI responses
-   **Use case:** Renders text parts with proper markdown formatting
-   **Source:** [https://sdk.vercel.ai/docs/ai-sdk-ui/response](https://sdk.vercel.ai/docs/ai-sdk-ui/response)
-   **Key features:**

-   Syntax highlighting for code blocks
-   Proper markdown parsing (headers, lists, bold, italic, links)
-   Streaming-aware rendering
-   Handles incomplete markdown during streaming

-   **Implementation pattern:**

```typescriptreact
import { Response } from "@/components/ai-elements/response"

{message.parts
  .filter((part) => part.type === "text")
  .map((part, i) => (
    <Response key={i} text={part.text} />
  ))
}
```

### 4. **Tool Component**

-   **What it does:** Displays tool calls and their execution states
-   **Use case:** Shows when AI uses tools/functions with inputs/outputs
-   **Source:** [https://sdk.vercel.ai/docs/ai-sdk-ui/tool](https://sdk.vercel.ai/docs/ai-sdk-ui/tool)
-   **Key features:**

-   Visual indicators for tool states
-   Displays tool names and arguments
-   Shows results/errors
-   State indicators: `input-streaming`, `input-available`, `output-available`, `output-error`

-   **Implementation pattern:**

```typescriptreact
import { Tool } from "@/components/ai-elements/tool"

{message.parts
  .filter((part) => part.type === "tool-call")
  .map((part, i) => (
    <Tool key={i} toolCall={part} />
  ))
}
```

### 5. **Reasoning Component**

-   **What it does:** Displays AI thought processes for reasoning models
-   **Use case:** Shows thinking/reasoning steps from models like o1
-   **Source:** [https://sdk.vercel.ai/docs/ai-sdk-ui/reasoning](https://sdk.vercel.ai/docs/ai-sdk-ui/reasoning)
-   **Key features:**

-   Collapsible reasoning display
-   Shows chain of thought
-   Supports streaming reasoning tokens

-   **When to use:** Only with reasoning-capable models (OpenAI o1, o3)

### 6. **PromptInput Component**

-   **What it does:** Smart input field with auto-resize and attachment support
-   **Use case:** Replace basic textarea with feature-rich input
-   **Source:** [https://sdk.vercel.ai/docs/ai-sdk-ui/prompt-input](https://sdk.vercel.ai/docs/ai-sdk-ui/prompt-input)
-   **Key features:**

-   Auto-resizes as user types
-   File attachment support
-   Submit on Enter, new line on Shift+Enter
-   Loading/disabled states
-   Character count display

---

## AI SDK Hooks Integration

### useChat Hook

**Documentation:** [https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)

**Key properties returned:**

-   `messages` - Array of message objects
-   `input` - Current input value
-   `isLoading` - Boolean for loading state
-   `error` - Error object if request fails
-   `stop()` - Function to abort streaming
-   `reload()` - Retry last request
-   `append()` - Add a message programmatically
-   `setInput()` - Update input value

**Message object structure:**

```typescript
{
	id: string;
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	parts: Array<{
		type: "text" | "tool-call" | "tool-result" | "data";
		text?: string;
		toolCallId?: string;
		toolName?: string;
		args?: object;
		result?: any;
	}>;
}
```

---

## Status Indicators & States

### Loading States

**What to show:**

1. **Submitting** - User clicked send, request not started

1. Display: "Thinking..." or spinner

1. **Streaming** - Response actively streaming

1. Display: "Generating response..." with animated indicator

1. **Tool execution** - AI is calling tools

1. Display: Tool component with appropriate state badge

### Tool Call States

**From AI SDK:** [https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#tool-calling](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#tool-calling)

-   `input-streaming` - Tool arguments being streamed
-   `input-available` - Full arguments received
-   `output-available` - Tool completed successfully
-   `output-error` - Tool execution failed

---

## Implementation Patterns

### Basic Chat with AI Elements

```typescriptreact
import { useChat } from '@ai-sdk/react'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Response } from '@/components/ai-elements/response'
import { Tool } from '@/components/ai-elements/tool'

export default function Chat() {
  const { messages, input, isLoading, handleSubmit, handleInputChange } = useChat()

  return (
    <div>
      {messages.map(message => (
        <Message key={message.id} role={message.role}>
          <MessageContent>
            {message.parts.map((part, i) => {
              if (part.type === 'text') {
                return <Response key={i} text={part.text} />
              }
              if (part.type === 'tool-call') {
                return <Tool key={i} toolCall={part} />
              }
            })}
          </MessageContent>
        </Message>
      ))}
      {isLoading && <div>Generating...</div>}
    </div>
  )
}
```

### Custom Implementation (Without AI Elements Library)

If not using the official library, replicate these features:

1. **Markdown Rendering:** Use `react-markdown` + `react-syntax-highlighter`
2. **Tool Detection:** Filter `message.toolInvocations` from useChat
3. **Status Indicators:** Check `isLoading` state and message completion
4. **Streaming Handling:** Messages update automatically during streaming

---

## Alternative Libraries (Used in My Implementation)

Since AI Elements requires installation, I used these alternatives:

| Feature          | AI Element          | Alternative Used               | Package                          |
| ---------------- | ------------------- | ------------------------------ | -------------------------------- |
| Markdown         | `<Response>`        | `react-markdown`               | `npm i react-markdown`           |
| Syntax Highlight | Built into Response | `react-syntax-highlighter`     | `npm i react-syntax-highlighter` |
| Tool Display     | `<Tool>`            | Custom card with badges        | Built-in React                   |
| Message Bubbles  | `<Message>`         | Custom div with Tailwind       | Built-in                         |
| Auto-scroll      | `<Conversation>`    | `useEffect` + `scrollIntoView` | Built-in                         |

---

## Key Resources

1. **AI Elements Homepage:** [https://vercel.com/blog/introducing-ai-elements](https://vercel.com/blog/introducing-ai-elements)
2. **AI SDK UI Docs:** [https://sdk.vercel.ai/docs/ai-sdk-ui](https://sdk.vercel.ai/docs/ai-sdk-ui)
3. **useChat Reference:** [https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
4. **Tool Calling Guide:** [https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#tool-calling](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot#tool-calling)
5. **Streaming Guide:** [https://sdk.vercel.ai/docs/ai-sdk-ui/streaming](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming)
6. **GitHub Examples:** [https://github.com/vercel/ai/tree/main/examples](https://github.com/vercel/ai/tree/main/examples)

---

## What I Implemented (Without Official AI Elements)

Instead of using the AI Elements package, I built equivalent functionality:

✅ **Markdown Rendering** - `react-markdown` with custom components for code blocks✅ **Status Indicators** - "Thinking..." and "Generating response..." based on `isLoading`✅ **Tool Call Display** - Detected `toolInvocations` and rendered with badges showing state✅ **Message Bubbles** - Role-based styling (user right, assistant left)✅ **Streaming Support** - Works with AI SDK's streaming responses✅ **Stop Button** - Appears during generation using `stop()` function

This gives you the same rich UI as AI Elements demos while maintaining full control over styling and behavior.

Thought for 3sFound advanced componentsFetched AI Elements guideFound streaming componentsNow let me fetch the specific component documentation pages:

Fetched component docsFound all componentsNow let me get the Task and Reasoning components documentation:

Fetched more componentsNow I have comprehensive information about all the advanced AI Elements components. Let me create an enhanced documentation:

# AI SDK Elements - Advanced Components Guide

## Overview

AI Elements is an open-source component library built on shadcn/ui specifically designed for building polished AI interfaces. It includes 20+ specialized components that handle unique AI interaction patterns like streaming responses, tool calls, reasoning displays, and status indicators.

**Main Documentation:** [https://ai-sdk.dev/elements/overview](https://ai-sdk.dev/elements/overview)**Installation:** `npx ai-elements@latest`**GitHub:** [https://github.com/vercel/ai-elements](https://github.com/vercel/ai-elements)

---

## Advanced Components You're Missing

### 1. **Shimmer Component**

-   **What it does:** Animated text shimmer/wave effect for loading states
-   **Use case:** Show loading, streaming, or "AI is typing" states with visual polish
-   **Source:** [https://ai-sdk.dev/elements/components/shimmer](https://ai-sdk.dev/elements/components/shimmer)
-   **Installation:** `npx ai-elements@latest add shimmer`

**Key Features:**

-   Smooth CSS gradient animation powered by Framer Motion
-   Customizable duration and spread width
-   Polymorphic component (render as any HTML element)
-   Automatic spread calculation based on text length
-   Infinite looping with linear easing

**Implementation:**

```typescriptreact
import { Shimmer } from '@/components/ai-elements/shimmer'

// Basic usage
<Shimmer>Loading your response...</Shimmer>

// Custom speed
<Shimmer duration={1}>Fast loading...</Shimmer>
<Shimmer duration={4}>Slow loading...</Shimmer>

// As different elements
<Shimmer as="h1">Large Heading</Shimmer>
<Shimmer as="span">Inline text</Shimmer>
```

**Props:**

-   `children`: string - Text to display with shimmer
-   `as`: ElementType - HTML element to render (default: "p")
-   `duration`: number - Animation duration in seconds (default: 2)
-   `spread`: number - Width multiplier for shimmer effect (default: 2)
-   `className`: string - Additional Tailwind classes

---

### 2. **Chain of Thought Component**

-   **What it does:** Displays AI reasoning process step-by-step with status indicators
-   **Use case:** Show how AI arrived at conclusions, display search/research steps
-   **Source:** [https://ai-sdk.dev/elements/components/chain-of-thought](https://ai-sdk.dev/elements/components/chain-of-thought)
-   **Installation:** `npx ai-elements@latest add chain-of-thought`

**Key Features:**

-   Collapsible reasoning panel with smooth animations
-   Step-by-step visualization with icons
-   Three status types: `complete`, `active`, `pending`
-   Built-in search results display with badges
-   Image support with captions
-   Keyboard navigation and accessibility

**Implementation:**

```typescriptreact
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  ChainOfThoughtImage,
} from '@/components/ai-elements/chain-of-thought'
import { SearchIcon, ImageIcon } from 'lucide-react'

<ChainOfThought defaultOpen={false}>
  <ChainOfThoughtHeader>Chain of Thought</ChainOfThoughtHeader>

  <ChainOfThoughtContent>
    {/* Search step */}
    <ChainOfThoughtStep
      icon={SearchIcon}
      label="Searching for information"
      description="Looking up relevant sources"
      status="complete"
    >
      <ChainOfThoughtSearchResults>
        <ChainOfThoughtSearchResult>wikipedia.org</ChainOfThoughtSearchResult>
        <ChainOfThoughtSearchResult>docs.example.com</ChainOfThoughtSearchResult>
      </ChainOfThoughtSearchResults>
    </ChainOfThoughtStep>

    {/* Active step */}
    <ChainOfThoughtStep
      icon={ImageIcon}
      label="Analyzing images"
      status="active"
    />

    {/* Pending step */}
    <ChainOfThoughtStep
      label="Generating response"
      status="pending"
    />
  </ChainOfThoughtContent>
</ChainOfThought>
```

**Props:**

-   `ChainOfThought`: `open`, `defaultOpen`, `onOpenChange`
-   `ChainOfThoughtStep`: `icon` (LucideIcon), `label`, `description`, `status`
-   `ChainOfThoughtImage`: `caption`

---

### 3. **Plan Component**

-   **What it does:** Displays AI-generated execution plans with collapsible content
-   **Use case:** Show multi-step workflows, task breakdowns, implementation strategies
-   **Source:** [https://ai-sdk.dev/elements/components/plan](https://ai-sdk.dev/elements/components/plan)
-   **Installation:** `npx ai-elements@latest add plan`

**Key Features:**

-   Collapsible plan interface built on shadcn Card
-   Streaming support with shimmer loading states
-   Custom action buttons
-   Expandable details section
-   Theme-aware styling

**Implementation:**

```typescriptreact
import {
  Plan,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanAction,
  PlanContent,
  PlanFooter,
  PlanTrigger,
} from '@/components/ai-elements/plan'

<Plan isStreaming={isGenerating}>
  <PlanHeader>
    <PlanAction>
      <Button variant="ghost" size="icon">
        <FileIcon className="h-4 w-4" />
      </Button>
    </PlanAction>

    <PlanTitle>Build Authentication System</PlanTitle>

    <PlanDescription>
      Implement JWT-based auth with refresh tokens and session management.
    </PlanDescription>
  </PlanHeader>

  <PlanContent>
    <PlanTrigger />

    <div className="space-y-4 p-4">
      <h3 className="font-semibold">Overview</h3>
      <p>This plan outlines the implementation strategy...</p>

      <h3 className="font-semibold">Key Steps</h3>
      <ol className="list-decimal list-inside space-y-2">
        <li>Set up database schema for users</li>
        <li>Implement password hashing with bcrypt</li>
        <li>Create JWT signing and verification</li>
        <li>Add refresh token rotation</li>
      </ol>
    </div>
  </PlanContent>

  <PlanFooter>
    <Button onClick={executePlan}>Execute Plan ⌘↩</Button>
  </PlanFooter>
</Plan>
```

**Props:**

-   `Plan`: `isStreaming` - Shows shimmer effect on title/description during streaming
-   `PlanTitle`: `children` (string) - Automatically gets shimmer if streaming
-   `PlanDescription`: `children` (string) - Automatically gets shimmer if streaming

---

### 4. **Task Component**

-   **What it does:** Structured task list with collapsible details and status indicators
-   **Use case:** Show agent workflow progress, file operations, multi-step processes
-   **Source:** [https://ai-sdk.dev/elements/components/task](https://ai-sdk.dev/elements/components/task)
-   **Installation:** `npx ai-elements@latest add task`

**Key Features:**

-   Visual status icons (pending, in-progress, completed, error)
-   Progress counter showing completed vs total
-   Support for file items with custom icons
-   Expandable content for details
-   Progressive reveal with customizable timing

**Implementation:**

```typescriptreact
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from '@/components/ai-elements/task'
import { SiReact, SiTypescript } from '@icons-pack/react-simple-icons'

<Task status="in_progress">
  <TaskTrigger title="Scanning project files" />

  <TaskContent>
    <TaskItem>Found 52 React components</TaskItem>

    <TaskItemFile>
      <SiReact className="h-4 w-4" style={{ color: '#149ECA' }} />
      <span>app/page.tsx</span>
    </TaskItemFile>

    <TaskItemFile>
      <SiTypescript className="h-4 w-4" style={{ color: '#3178C6' }} />
      <span>components/chat.tsx</span>
    </TaskItemFile>

    <TaskItem>Analyzing dependencies...</TaskItem>
  </TaskContent>
</Task>
```

**With AI SDK (useObject):**

```typescriptreact
const { object, submit, isLoading } = useObject({
  api: '/api/agent',
  schema: tasksSchema,
})

{object?.tasks?.map((task) => (
  <Task key={task.title} status={task.status}>
    <TaskTrigger title={task.title} />
    <TaskContent>
      {task.items.map((item) => (
        item.type === 'file' ? (
          <TaskItemFile>{item.file.name}</TaskItemFile>
        ) : (
          <TaskItem>{item.text}</TaskItem>
        )
      ))}
    </TaskContent>
  </Task>
))}
```

---

### 5. **Reasoning Component**

-   **What it does:** Displays AI thinking/reasoning for reasoning-capable models
-   **Use case:** Show chain of thought from models like OpenAI o1, Deepseek R1
-   **Source:** [https://ai-sdk.dev/elements/components/reasoning](https://ai-sdk.dev/elements/components/reasoning)
-   **Installation:** `npx ai-elements@latest add reasoning`

**Key Features:**

-   Auto-opens during streaming, auto-closes when finished
-   Manual toggle control
-   Visual streaming indicator with pulsing animation
-   Built on Radix UI Collapsible primitives
-   Full accessibility support

**Implementation:**

```typescriptreact
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning'

// In your message rendering
{message.parts.map((part) => {
  if (part.type === 'reasoning') {
    return (
      <Reasoning isStreaming={status === 'streaming'}>
        <ReasoningTrigger title="Thinking..." />
        <ReasoningContent>
          <p className="text-sm text-muted-foreground">{part.text}</p>
        </ReasoningContent>
      </Reasoning>
    )
  }
})}
```

**Backend Setup (with Deepseek R1):**

```typescriptreact
// app/api/chat/route.ts
import { streamText } from 'ai'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: 'deepseek/deepseek-r1',
    messages,
  })

  return result.toUIMessageStreamResponse({
    sendReasoning: true, // Enable reasoning parts
  })
}
```

**Props:**

-   `Reasoning`: `isStreaming` (boolean) - Auto-controls open/close state
-   `ReasoningTrigger`: `title` (string) - Custom trigger text (default: "Reasoning")

---

### 6. **Loader Component**

-   **What it does:** Animated loading spinner
-   **Use case:** Show loading states during AI processing
-   **Source:** [https://ai-sdk.dev/elements/components/loader](https://ai-sdk.dev/elements/components/loader)
-   **Installation:** `npx ai-elements@latest add loader`

**Implementation:**

```typescriptreact
import { Loader } from '@/components/ai-elements/loader'

{isLoading && <Loader />}
```

---

### 7. **Tool Component**

-   **What it does:** Displays tool/function calls with execution status
-   **Use case:** Show when AI uses tools with inputs/outputs
-   **Source:** [https://ai-sdk.dev/elements/components/tool](https://ai-sdk.dev/elements/components/tool)
-   **Installation:** `npx ai-elements@latest add tool`

**Key Features:**

-   Visual indicators for tool states
-   Displays tool names, arguments, and results
-   Supports error states
-   Collapsible details

**Tool States:**

-   `input-streaming` - Tool arguments being streamed
-   `input-available` - Full arguments received
-   `output-available` - Tool completed successfully
-   `output-error` - Tool execution failed

**Implementation:**

```typescriptreact
import { Tool } from '@/components/ai-elements/tool'

{message.parts
  .filter((part) => part.type === 'tool-call')
  .map((part) => (
    <Tool key={part.toolCallId} toolCall={part} />
  ))
}
```

---

## Complete Component Comparison

| Component            | Purpose           | Visual Effect            | Key Feature                           |
| -------------------- | ----------------- | ------------------------ | ------------------------------------- |
| **Shimmer**          | Loading indicator | Animated wave/shimmer    | Customizable speed & spread           |
| **Chain of Thought** | Reasoning steps   | Step timeline with icons | Search results, images, status badges |
| **Plan**             | Execution plans   | Collapsible card         | Streaming support, action buttons     |
| **Task**             | Workflow progress | Collapsible task list    | File icons, progress counter          |
| **Reasoning**        | AI thinking       | Auto-expanding panel     | Pulsing indicator, auto-open/close    |
| **Loader**           | Loading state     | Spinning animation       | Simple, clean indicator               |
| **Tool**             | Function calls    | Status badges            | Shows inputs/outputs/errors           |
| **Response**         | Markdown text     | Syntax highlighting      | Code blocks, formatting               |
| **Message**          | Chat bubbles      | Role-based styling       | Streaming-aware                       |
| **Conversation**     | Chat container    | Auto-scroll              | Overflow handling                     |
| **PromptInput**      | Smart input       | Auto-resize              | File attachments, shortcuts           |

---

## How to Achieve the Polished Look

To get the polished AI interface you saw in the demos, combine these components:

### Example: Complete Chat with All Features

```typescriptreact
'use client'

import { useChat } from '@ai-sdk/react'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtHeader, ChainOfThoughtStep } from '@/components/ai-elements/chain-of-thought'
import { Tool } from '@/components/ai-elements/tool'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { Task, TaskTrigger, TaskContent, TaskItem } from '@/components/ai-elements/task'
import { PromptInput, PromptInputTextarea, PromptInputSubmit } from '@/components/ai-elements/prompt-input'
import { Loader } from '@/components/ai-elements/loader'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat()

  return (
    <Conversation>
      <ConversationContent>
        {messages.map((message) => (
          <Message key={message.id} role={message.role}>
            <MessageContent>
              {message.parts.map((part, i) => {
                // Text responses with markdown
                if (part.type === 'text') {
                  return <Response key={i} text={part.text} />
                }

                // Tool calls
                if (part.type === 'tool-call') {
                  return <Tool key={i} toolCall={part} />
                }

                // Reasoning (o1, R1 models)
                if (part.type === 'reasoning') {
                  return (
                    <Reasoning key={i} isStreaming={isLoading}>
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  )
                }
              })}
            </MessageContent>
          </Message>
        ))}

        {/* Loading state with shimmer */}
        {isLoading && (
          <Message role="assistant">
            <MessageContent>
              <Shimmer>Generating response...</Shimmer>
              <Loader />
            </MessageContent>
          </Message>
        )}
      </ConversationContent>

      {/* Smart input */}
      <form onSubmit={handleSubmit}>
        <PromptInput>
          <PromptInputTextarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything..."
          />
          <PromptInputSubmit disabled={isLoading} />
        </PromptInput>
      </form>
    </Conversation>
  )
}
```

---

## Essential Links

1. **Main Docs:** [https://ai-sdk.dev/elements/overview](https://ai-sdk.dev/elements/overview)
2. **Setup Guide:** [https://ai-sdk.dev/elements/overview/setup](https://ai-sdk.dev/elements/overview/setup)
3. **GitHub Examples:** [https://github.com/vercel/ai-elements](https://github.com/vercel/ai-elements)
4. **Chatbot Example:** [https://ai-sdk.dev/elements/examples/chatbot](https://ai-sdk.dev/elements/examples/chatbot)
5. **v0 Clone Example:** [https://ai-sdk.dev/elements/examples/v0](https://ai-sdk.dev/elements/examples/v0)
6. **All Components:** [https://ai-sdk.dev/elements/components](https://ai-sdk.dev/elements/components)

---

## Quick Start Checklist

To upgrade your chat to match the demos:

-   Install AI Elements: `npx ai-elements@latest`
-   Add **Shimmer** for "Generating..." states
-   Add **Loader** spinner during streaming
-   Add **Response** component for markdown rendering
-   Add **Tool** component for tool call visualization
-   Add **ChainOfThought** if showing reasoning steps
-   Add **Task** if showing agent workflows
-   Add **Reasoning** if using o1/R1 models
-   Replace textarea with **PromptInput** for better UX
-   Wrap everything in **Conversation** for auto-scroll

This will transform your basic chat into a polished, production-ready AI interface!
