# ToolLoopAgent vs Custom ReAct Loop Implementation

**Filename**: `TOOLLOOPAGENT_REACT_IMPLEMENTATION.md`  
**Topic**: Vercel AI SDK ToolLoopAgent - ReAct Pattern Implementation Analysis  
**Focus**: Understanding whether ToolLoopAgent implements the agentic loop or requires custom implementation

---

### **TL;DR: The Answer**

**Vercel's `ToolLoopAgent` function _is_ the implementation of the agentic loop (like ReAct).**

-   **You do NOT need to implement the ReAct _looping logic_ yourself if you use `ToolLoopAgent`**. The function handles the cycle of: LLM thinks -> calls tool -> you execute tool -> result is sent back to LLM -> LLM thinks again.
-   **You DO still need to provide a good _system prompt_ that encourages the model to reason and use the tools effectively.** The `ToolLoopAgent` doesn't create the prompt; it executes the _pattern_ that the prompt enables.
-   The benefit of `ToolLoopAgent` is that it **abstracts away the complex state management** of the agentic loop, reducing boilerplate and potential bugs.
-   The "control" you lose is the fine-grained management of that loop. If you need custom logic _between_ tool calls that `ToolLoopAgent` doesn't support, then you should build your own loop with `streamText`.

---

### **Deep Dive: Evidence from the Codebase**

Let's analyze the provided code digest (`vercel-ai/fd309b20...txt`) to see exactly what `ToolLoopAgent` is doing under the hood and what you'd need to rebuild.

#### 1. What is `ToolLoopAgent`?

The core logic is found in the `ToolLoopAgent` function definition. It is a high-level abstraction built _on top of_ `streamText`.

Here is the most critical piece of code from the digest that proves it manages the loop:

```typescript
// Found in: packages/core/core/tool-loop/tool-loop-agent.ts

export async function ToolLoopAgent<
  // ... type definitions
>({
  // ... parameters
}: ToolLoopAgentArgs<...>): Promise<ToolLoopAgentResult<...>> {

  // ... initialization code

  let toolCalls: ToolCall[] = [];
  let toolResults: ToolResult[] = [];

  // THIS IS THE AGENTIC LOOP IMPLEMENTATION
  for (let i = 0; i < maxToolRoundtrips; i++) {
    const result = await streamText({
      // ... parameters passed to streamText
    });

    // ... code to stream text deltas via onTextDelta

    toolCalls = [];
    toolResults = [];

    // Process the stream result
    const { fullStream } = result;
    for await (const part of fullStream) {
      if (part.type === 'tool-call') {
        toolCalls.push(part);
      }
      // ... other part types
    }

    // Agent finish condition: if there are no tool calls, the loop is done.
    if (toolCalls.length === 0) {
      // ... return final result and exit
      return { ... };
    }

    // Agent "Act" step: Execute the tools
    for (const toolCall of toolCalls) {
      const tool = tools[toolCall.toolName];
      // ... validation
      const result = await tool.execute(toolCall.args);
      toolResults.push({ toolCallId: toolCall.toolCallId, result });
    }

    // Add the tool calls and results to the message history
    messages.push(
      { role: 'assistant', content: toolCalls },
      { role: 'tool', content: toolResults },
    );

    // The 'for' loop continues, sending the updated message history
    // back to streamText in the next iteration.
  }

  // Handle case where max roundtrips is exceeded
  // ...
}
```

**Analysis of this code:**

-   **It's a Loop:** The `for (let i = 0; i < maxToolRoundtrips; i++)` is the explicit agentic loop. This is the ReAct pattern's core cycle.
-   **It Calls the LLM:** Inside the loop, it calls `streamText` to get the model's next action (or final answer).
-   **It Identifies Tool Calls:** It processes the stream to find parts of type `'tool-call'`.
-   **It Executes Tools:** It then iterates through the identified `toolCalls` and runs the corresponding `tool.execute()` function.
-   **It Manages State:** It automatically appends the assistant's `tool-call` message and the `tool-result` messages to the `messages` array for the next iteration.
-   **It has a Stop Condition:** The loop breaks naturally when the LLM responds with text instead of tool calls, or it force-stops when `maxToolRoundtrips` is hit.

This proves that `ToolLoopAgent` is not just a helper; it is the **complete, pre-built agentic loop**.

---

### **What You Would Need to Implement Yourself (The "Own the Loop" Approach)**

If your team decides to use only `streamText` and own the logic, you would have to replicate everything that `ToolLoopAgent` abstracts away. Here is the checklist of what you'd need to build:

1. **State Management:**

    - You need to create and manage your own `messages` array. You will be responsible for manually pushing user prompts, assistant replies, `tool-call` objects, and `tool-result` objects into this array in the correct order.

2. **The Core Loop:**

    - You must write your own `while(true)` or `for` loop, similar to the one inside `ToolLoopAgent`.

3. **Termination Logic:**

    - You need to implement a "break" condition for your loop. This would involve checking the `finishReason` from the `streamText` result. If it's `'stop'`, you break. You also need to add a counter (`maxIterations`) to prevent infinite loops if the agent gets stuck.

4. **Tool Call Parsing and Execution:**

    - Inside your loop, after calling `streamText`, you must manually iterate through the stream result to find all the `tool-call` parts.
    - You'll need a mapping (like a dictionary or `Map`) to look up your tool functions based on the `toolName` provided by the LLM.
    - You have to call the `execute()` method for each tool and handle the `Promise` it returns. This includes `try/catch` blocks for failed tool executions.

5. **Result Formatting:**

    - After a tool executes, you must format the output into a valid `tool-result` message object, ensuring the `toolCallId` matches the original call.

6. **History Updates:**

    - You are responsible for correctly appending the `tool-call` and `tool-result` messages to your `messages` array before the next iteration of your loop. Getting this wrong will confuse the model.

7. **Streaming for UI:**
    - `ToolLoopAgent` provides convenient callbacks like `onToolCall`, `onToolResult`, and `onTextDelta`. If you build your own loop, you'll need to manually create a streaming mechanism (e.g., using a `ReadableStream` or callbacks) to send these intermediate steps to your frontend for a good user experience (e.g., showing "Searching the web...").

### **Conclusion & Recommendation for Your Team**

-   **Your Debate is Solved:** The `ToolLoopAgent` **is** Vercel's implementation of the ReAct pattern's execution loop. Your team doesn't need to choose between "ReAct in the prompt" and `ToolLoopAgent`—you use them together. You write a ReAct-style system prompt telling the model _how to think_, and `ToolLoopAgent` handles the _mechanical process_ of executing that thinking.

-   **When to use `ToolLoopAgent` (95% of cases):**

    -   You want to build a standard tool-using agent quickly.
    -   You want to reduce boilerplate code and potential bugs in state management.
    -   Your logic is straightforward: LLM calls a tool, you run it, you return the result.
    -   You want easy access to intermediate steps for the UI via the built-in callbacks.

-   **When to build your own loop with `streamText` (5% of cases):**
    -   You need to **intercept and modify** the agent's plan. For example, asking the user for confirmation _before_ executing a destructive tool (`Are you sure you want to delete this file?`). `ToolLoopAgent`'s loop is self-contained and doesn't have a built-in "pause for confirmation" step.
    -   You have complex, non-linear logic between tool calls that doesn't fit the simple loop model.
    -   You want to implement a more advanced agent architecture (e.g., a supervisor agent that dispatches tasks to other agents) where you need full control over the message flow.

**Final Advice:** **Start with `ToolLoopAgent`.** It provides the solid foundation you're looking for and handles the most error-prone parts of building an agent. If and only if you hit a specific limitation where you need more control than its callbacks provide, then consider building a custom loop using the checklist above. You will find that `ToolLoopAgent` already solves the exact problem you're discussing.
