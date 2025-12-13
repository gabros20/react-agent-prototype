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
  const textParts: TextPart[] = [];

  if (typeof msg.content === "string") {
    textParts.push({ id: randomUUID(), type: "text", text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part === null) continue;
      if (typeof part !== "object" || !("type" in part)) continue;

      switch (part.type) {
        case "text":
          if ("text" in part && typeof part.text === "string") {
            textParts.push({ id: randomUUID(), type: "text", text: part.text });
          }
          break;

        case "image":
        case "file":
          // Multimodal content - store as text placeholder
          // UserMessage.parts only supports TextPart[], so we can't store rich content
          console.warn(`[message-converter] User message has unsupported "${part.type}" content - storing placeholder`);
          textParts.push({
            id: randomUUID(),
            type: "text",
            text: `[${part.type} content - not yet supported]`,
          });
          break;

        default:
          console.warn(`[message-converter] Unknown user content part type: ${(part as { type: string }).type}`);
          break;
      }
    }
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
              "input" in part
            ) {
              parts.push({
                id: randomUUID(),
                type: "tool-call",
                toolCallId: part.toolCallId as string,
                toolName: part.toolName as string,
                input: part.input ?? {},
              });
            }
            break;

          case "reasoning":
            if ("text" in part && typeof part.text === "string") {
              parts.push({ id: randomUUID(), type: "reasoning", text: part.text });
            }
            break;

          // AI SDK types we don't fully support yet - convert to text representations
          // These are edge cases (multimodal, human-in-the-loop) that can be added later
          case "image":
          case "file":
            // Multimodal content - store as text placeholder for now
            console.warn(`[message-converter] Unsupported part type "${part.type}" - storing as text placeholder`);
            parts.push({
              id: randomUUID(),
              type: "text",
              text: `[${part.type} content - not yet supported]`,
            });
            break;

          case "tool-approval-request":
          case "tool-approval-response":
            // Human-in-the-loop approval - log and skip (these are transient)
            console.warn(`[message-converter] Skipping transient part type: ${part.type}`);
            break;

          default:
            // Unknown type - log for debugging
            console.warn(`[message-converter] Unknown part type in createAssistantMessage: ${(part as { type: string }).type}`);
            break;

          // Note: "step-start" is a stream event type, NOT a message content part type.
          // It won't appear in ModelMessage.content, only in fullStream events.
          // Our RichMessage supports it for internal tracking but AI SDK doesn't include it in messages.
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
                input: tc.input ?? {},
              };

            case "reasoning":
              return { type: "reasoning", text: (part as any).text };

            case "compaction-marker":
              // Convert marker to text for the LLM
              return { type: "text", text: (part as any).summary };

            case "step-start":
              // Step markers are internal - skip for LLM context
              // (AI SDK handles step boundaries internally)
              return null;

            default:
              // Unknown part type - log and skip
              console.warn(`[message-converter] Unknown part type in richMessageToModel: ${part.type}`);
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
