/**
 * Convert OpenAI Chat Completion requests into a prompt string
 * suitable for the Cursor CLI `agent -p` command.
 *
 * Model IDs are aligned with `agent --list-models` (update when Cursor ships new models).
 */

import type { OpenAIChatMessage, OpenAIChatRequest, OpenAIContentPart } from "../types/openai.js";

/**
 * Real `agent --model` IDs. Keep in sync with `agent --list-models` periodically.
 */
const KNOWN_CURSOR_MODELS = new Set([
  "auto",
  "composer-2",
  "composer-2-fast",
  "composer-1.5",
  "composer-1",
  "claude-4.6-sonnet-medium",
  "claude-4.6-sonnet-medium-thinking",
  "claude-4.6-opus-high",
  "claude-4.6-opus-high-thinking",
  "claude-4.6-opus-max",
  "claude-4.6-opus-max-thinking",
  "claude-4.5-sonnet",
  "claude-4.5-sonnet-thinking",
  "claude-4.5-opus-high",
  "claude-4.5-opus-high-thinking",
  "claude-4-sonnet",
  "claude-4-sonnet-1m",
  "claude-4-sonnet-thinking",
  "claude-4-sonnet-1m-thinking",
  "gpt-5.4-low",
  "gpt-5.4-medium",
  "gpt-5.4-medium-fast",
  "gpt-5.4-high",
  "gpt-5.4-high-fast",
  "gpt-5.4-xhigh",
  "gpt-5.4-xhigh-fast",
  "gpt-5.4-mini-none",
  "gpt-5.4-mini-low",
  "gpt-5.4-mini-medium",
  "gpt-5.4-mini-high",
  "gpt-5.4-mini-xhigh",
  "gpt-5.4-nano-none",
  "gpt-5.4-nano-low",
  "gpt-5.4-nano-medium",
  "gpt-5.4-nano-high",
  "gpt-5.4-nano-xhigh",
  "gpt-5.3-codex",
  "gpt-5.3-codex-fast",
  "gpt-5.3-codex-low",
  "gpt-5.3-codex-low-fast",
  "gpt-5.3-codex-high",
  "gpt-5.3-codex-high-fast",
  "gpt-5.3-codex-xhigh",
  "gpt-5.3-codex-xhigh-fast",
  "gpt-5.3-codex-spark-preview",
  "gpt-5.3-codex-spark-preview-low",
  "gpt-5.3-codex-spark-preview-high",
  "gpt-5.3-codex-spark-preview-xhigh",
  "gpt-5.2",
  "gpt-5.2-low",
  "gpt-5.2-low-fast",
  "gpt-5.2-fast",
  "gpt-5.2-high",
  "gpt-5.2-high-fast",
  "gpt-5.2-xhigh",
  "gpt-5.2-xhigh-fast",
  "gpt-5.2-codex",
  "gpt-5.2-codex-low",
  "gpt-5.2-codex-low-fast",
  "gpt-5.2-codex-fast",
  "gpt-5.2-codex-high",
  "gpt-5.2-codex-high-fast",
  "gpt-5.2-codex-xhigh",
  "gpt-5.2-codex-xhigh-fast",
  "gpt-5.1",
  "gpt-5.1-low",
  "gpt-5.1-high",
  "gpt-5.1-codex-max-low",
  "gpt-5.1-codex-max-low-fast",
  "gpt-5.1-codex-max-medium",
  "gpt-5.1-codex-max-medium-fast",
  "gpt-5.1-codex-max-high",
  "gpt-5.1-codex-max-high-fast",
  "gpt-5.1-codex-max-xhigh",
  "gpt-5.1-codex-max-xhigh-fast",
  "gpt-5.1-codex-mini-low",
  "gpt-5.1-codex-mini",
  "gpt-5.1-codex-mini-high",
  "gpt-5-mini",
  "gemini-3.1-pro",
  "gemini-3-flash",
  "grok-4-20",
  "grok-4-20-thinking",
  "kimi-k2.5",
]);

/** Friendly / legacy names → real CLI IDs (backward compatibility). */
const MODEL_ALIASES: Record<string, string> = {
  "sonnet-4.6": "claude-4.6-sonnet-medium",
  "sonnet-4.6-thinking": "claude-4.6-sonnet-medium-thinking",
  "opus-4.6": "claude-4.6-opus-high",
  "opus-4.6-thinking": "claude-4.6-opus-high-thinking",
  "opus-4.6-max": "claude-4.6-opus-max",
  "opus-4.6-max-thinking": "claude-4.6-opus-max-thinking",
  "sonnet-4.5": "claude-4.5-sonnet",
  "sonnet-4.5-thinking": "claude-4.5-sonnet-thinking",
  "opus-4.5": "claude-4.5-opus-high",
  "opus-4.5-thinking": "claude-4.5-opus-high-thinking",
  "sonnet-4": "claude-4-sonnet",
  "sonnet-4-thinking": "claude-4-sonnet-thinking",
  "gpt-5.4": "gpt-5.4-medium",
  "gpt-5.4-mini": "gpt-5.4-mini-medium",
  "gpt-5.4-nano": "gpt-5.4-nano-medium",
  "gpt-5.1-codex-max": "gpt-5.1-codex-max-medium",
  "gemini-3-pro": "gemini-3.1-pro",
  "grok": "grok-4-20",
};

export interface CliInput {
  prompt: string;
  model: string;
}

function resolveOne(id: string): string {
  if (MODEL_ALIASES[id]) return MODEL_ALIASES[id]!;
  if (KNOWN_CURSOR_MODELS.has(id)) return id;
  return "auto";
}

/**
 * Resolve the Cursor CLI model name from an OpenAI-style model string.
 */
export function extractModel(model: string): string {
  if (model.startsWith("cursor/")) {
    const id = model.slice("cursor/".length) || "auto";
    return resolveOne(id);
  }

  if (model.startsWith("cursor-")) {
    const remainder = model.slice("cursor-".length);
    if (remainder) return resolveOne(remainder);
  }

  return resolveOne(model);
}

function messageContentToText(content: string | OpenAIContentPart[]): string {
  if (typeof content === "string") return content;

  return content
    .filter((part): part is OpenAIContentPart & { type: "text" } => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

/**
 * Flatten an array of OpenAI messages into a single prompt string.
 */
export function messagesToPrompt(messages: OpenAIChatMessage[]): string {
  const nonEmpty = messages.filter((m) => {
    const text = messageContentToText(m.content);
    return text.length > 0;
  });

  if (nonEmpty.length === 1 && nonEmpty[0].role === "user") {
    return messageContentToText(nonEmpty[0].content);
  }

  const parts: string[] = [];
  for (const msg of nonEmpty) {
    const text = messageContentToText(msg.content);
    switch (msg.role) {
      case "system":
        parts.push(`[System]\n${text}`);
        break;
      case "user":
        parts.push(`[User]\n${text}`);
        break;
      case "assistant":
        parts.push(`[Assistant]\n${text}`);
        break;
    }
  }

  return parts.join("\n\n");
}

export function openaiToCli(request: OpenAIChatRequest): CliInput {
  return {
    prompt: messagesToPrompt(request.messages),
    model: extractModel(request.model || "auto"),
  };
}
