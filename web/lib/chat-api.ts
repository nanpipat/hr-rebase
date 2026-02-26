const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StreamCallbacks {
  onDelta: (text: string) => void;
  onToolUse: (name: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function streamChat(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    credentials: "include",
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    callbacks.onError(err.message || `Error: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response stream");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            switch (eventType) {
              case "text_delta":
                callbacks.onDelta(parsed.text || "");
                break;
              case "tool_use":
                callbacks.onToolUse(parsed.name || "");
                break;
              case "message_stop":
                callbacks.onDone();
                break;
              case "error":
                callbacks.onError(parsed.message || "Unknown error");
                break;
            }
          } catch {
            // ignore parse errors
          }
          eventType = "";
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError("Connection lost");
    }
  }
}
