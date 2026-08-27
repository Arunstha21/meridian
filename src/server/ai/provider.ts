import { env } from "@/lib/env";
import { errors } from "@/lib/errors";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ProviderMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type CompletionResponse = {
  message: ProviderMessage;
  finishReason: string;
};

/**
 * Minimal OpenAI-compatible chat-completions client. Works with OpenAI,
 * OpenRouter, Ollama (/v1), LM Studio, vLLM and anything else speaking the
 * same protocol. Non-streaming: the agent loop needs complete tool_calls
 * before it can continue, and local endpoints vary widely in streaming
 * tool-call support.
 */
export async function chatCompletion(
  messages: ProviderMessage[],
  tools: ToolDefinition[]
): Promise<CompletionResponse> {
  if (!env.AI_BASE_URL || !env.AI_MODEL) {
    throw errors.validation("AI chat is not configured. Set AI_BASE_URL and AI_MODEL.");
  }

  const base = env.AI_BASE_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.AI_API_KEY ? { authorization: `Bearer ${env.AI_API_KEY}` } : {})
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(120_000)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI provider error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: ProviderMessage; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];
  if (!choice?.message) throw new Error("AI provider returned no message.");

  return {
    message: choice.message,
    finishReason: choice.finish_reason ?? "stop"
  };
}
