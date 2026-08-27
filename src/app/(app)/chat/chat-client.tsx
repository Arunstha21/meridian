"use client";

import { useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { clearChatAction } from "./actions";

export type ChatUiMessage = { role: "user" | "assistant"; content: string };

export function ChatClient({
  initialMessages,
  enabled,
  userName
}: {
  initialMessages: ChatUiMessage[];
  enabled: boolean;
  userName: string;
}) {
  const [messages, setMessages] = useState<ChatUiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy || !enabled) return;

    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "The assistant could not respond.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      }
    } catch {
      setError("Network error — could not reach the assistant.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const clear = async () => {
    await clearChatAction();
    setMessages([]);
  };

  if (!enabled) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-fg">
            M
          </div>
          <div>
            <h1 className="text-lg font-medium">Assistant</h1>
            <p className="text-xs text-muted">Your financial copilot</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          AI chat is not configured. Set{" "}
          <code className="rounded bg-border/50 px-1">AI_BASE_URL</code> and{" "}
          <code className="rounded bg-border/50 px-1">AI_MODEL</code> environment variables (any
          OpenAI-compatible endpoint: Ollama, LM Studio, OpenRouter, OpenAI…), then restart.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-fg">
            M
          </div>
          <div>
            <h1 className="text-base font-medium">Assistant</h1>
            <p className="text-xs text-muted">Ask about your money</p>
          </div>
        </div>
        {messages.length > 0 ? (
          <form action={clear}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg p-2 text-muted hover:bg-border/40 hover:text-destructive"
              title="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-xs font-medium">Clear</span>
            </button>
          </form>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-fg">
              M
            </div>
            <p className="mt-4 text-lg font-medium">Hello {userName.split(" ")[0]} 👋</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Ask about your spending, net worth, income — or ask me to record a transaction.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                "How much did I spend on groceries this month?",
                "What's my net worth right now?",
                "Compare this month's spending to last month",
                "Add $4.50 coffee from this morning"
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-xl bg-surface px-4 py-2.5 text-left text-sm shadow-sm transition-colors hover:bg-surface-hover"
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-fg" : "bg-surface-inset shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface-inset px-4 py-2.5 text-sm text-muted shadow-sm">
              Thinking…
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-destructive-bg px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <form onSubmit={send} className="border-t border-border bg-surface p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask anything about your money…"
            className="max-h-36 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
