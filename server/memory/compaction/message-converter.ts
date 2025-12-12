/**
 * Message Converter
 *
 * Converts between AI SDK ModelMessage format and our RichMessage format.
 * This bridge allows the compaction system to work with AI SDK's message types.
 */

import { randomUUID } from "crypto";
import type { ModelMessage } from "ai";
import type {
  RichMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  MessagePart,
} from "./types";
import { countMessageTokens } from "./token-service";

// ============================================================================
// AI SDK → RichMessage Conversion
// ============================================================================

/**
 * Convert AI SDK ModelMessage array to RichMessage array
 */
export function modelMessagesToRich(
  messages: ModelMessage[],
  sessionId: string
): RichMessage[] {
  return messages
    .filter((msg) => msg.role !== "system") // Skip system messages
    .map((msg) => modelMessageToRich(msg, sessionId));
}

/**
 * Convert single AI SDK ModelMessage to RichMessage
 */
export function modelMessageToRich(
  msg: ModelMessage,
  sessionId: string
): RichMessage {
  const base = {
    id: randomUUID(),
    sessionId,
    createdAt: Date.now(),
  };

  switch (msg.role) {
    case "user":
      return createUserMessage(msg, base);

    case "assistant":
      return createAssistantMessage(msg, base);

    case "tool":
      return createToolMessage(msg, base);

    default:
      // Treat unknown as assistant with text
      return {
        ...base,
        role: "assistant",
        parts: [{ id: randomUUID(), type: "text", text: String(msg.content) }],
        tokens: 0,
      } as AssistantMessage;
  }
}

function createUserMessage(
  msg: ModelMessage,
  base: { id: string; sessionId: string; createdAt: number }
): UserMessage {
  let textParts: TextPart[] = [];

  if (typeof msg.content === "string") {
    textParts = [{ id: randomUUID(), type: "text", text: msg.content }];
  } else if (Array.isArray(msg.content)) {
    textParts = msg.content
      .filter((p): p is { type: "text"; text: string } => p !== null && typeof p === "object" && "type" in p && p.type === "text")
      .map((p) => ({ id: randomUUID(), type: "text" as const, text: p.text }));
  }

  const message: UserMessage = {
    ...base,
    role: "user",
    parts: textParts,
    tokens: 0,
  };
  message.tokens = countMessageTokens(message);
  return message;
}

function createAssistantMessage(
  msg: ModelMessage,
  base: { id: string; sessionId: string; createdAt: number }
): AssistantMessage {
  const parts: MessagePart[] = [];

  if (typeof msg.content === "string") {
    parts.push({ id: randomUUID(), type: "text", text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part === null) continue;

      if (typeof part === "object" && "type" in part) {
        switch (part.type) {
          case "text":
            if ("text" in part && typeof part.text === "string") {
              parts.push({ id: randomUUID(), type: "text", text: part.text });
            }
            break;

          case "tool-call":
            if (
              "toolCallId" in part &&
              "toolName" in part &&
              "args" in part
            ) {
              parts.push({
                id: randomUUID(),
                type: "tool-call",
                toolCallId: part.toolCallId as string,
                toolName: part.toolName as string,
                args: part.args,
              });
            }
            break;

          case "reasoning":
            if ("text" in part && typeof part.text === "string") {
              parts.push({ id: randomUUID(), type: "reasoning", text: part.text });
            }
            break;
        }
      }
    }
  }

  const message: AssistantMessage = {
    ...base,
    role: "assistant",
    parts,
    tokens: 0,
  };
  message.tokens = countMessageTokens(message);
  return message;
}

function createToolMessage(
  msg: ModelMessage,
  base: { id: string; sessionId: string; createdAt: number }
): ToolMessage {
  const parts: ToolResultPart[] = [];

  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (
        part !== null &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "tool-result" &&
        "toolCallId" in part &&
        "toolName" in part &&
        "output" in part
      ) {
        parts.push({
          id: randomUUID(),
          type: "tool-result",
          toolCallId: part.toolCallId as string,
          toolName: part.toolName as string,
          output: (part as any).output,
        });
      }
    }
  }

  const message: ToolMessage = {
    ...base,
    role: "tool",
    parts,
    tokens: 0,
  };
  message.tokens = countMessageTokens(message);
  return message;
}

// ============================================================================
// RichMessage → AI SDK Conversion
// ============================================================================

/**
 * Convert RichMessage array back to AI SDK ModelMessage array
 */
export function richMessagesToModel(messages: RichMessage[]): ModelMessage[] {
  return messages.map(richMessageToModel);
}

/**
 * Convert single RichMessage to AI SDK ModelMessage
 */
export function richMessageToModel(msg: RichMessage): ModelMessage {
  switch (msg.role) {
    case "user":
      return {
        role: "user",
        content: (msg as UserMessage).parts.map((p) => p.text).join("\n"),
      };

    case "assistant":
      return {
        role: "assistant",
        content: (msg as AssistantMessage).parts.map((part) => {
          switch (part.type) {
            case "text":
              return { type: "text", text: (part as TextPart).text };

            case "tool-call":
              const tc = part as ToolCallPart;
              return {
                type: "tool-call",
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              };

            case "reasoning":
              return { type: "reasoning", text: (part as any).text };

            case "compaction-marker":
              // Convert marker to text for the LLM
              return { type: "text", text: (part as any).summary };

            default:
              return null;
          }
        }).filter(Boolean) as any[],
      };

    case "tool":
      // Tool messages need the specific tool-result content format
      // AI SDK v6 uses 'output' field instead of 'result'
      return {
        role: "tool" as const,
        content: (msg as ToolMessage).parts.map((part) => ({
          type: "tool-result" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.compactedAt
            ? { status: "compacted", message: "Output cleared - see conversation summary" }
            : part.output,
        })),
      } as ModelMessage;

    default:
      // Fallback
      return {
        role: "assistant",
        content: "",
      };
  }
}
