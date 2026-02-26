"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/i18n";
import { streamChat, ChatMessage } from "@/lib/chat-api";

// ── Types ──────────────────────────────────────────────────

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: number;
}

// ── Storage helpers ────────────────────────────────────────

const SESSIONS_KEY = "hr-chat-sessions";
const MAX_SESSIONS = 30;
const MAX_MESSAGES = 100;

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS)),
    );
  } catch {}
}

function newSession(): ChatSession {
  return {
    id: Date.now().toString(),
    title: "New chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

function sessionTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  return first.content.length > 42
    ? first.content.slice(0, 42) + "…"
    : first.content;
}

// ── ChatModal ──────────────────────────────────────────────

export default function ChatModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const t = useTranslations("chat");

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const current = sessions.find((s) => s.id === currentId) ?? null;
  const messages = current?.messages ?? [];

  // ── Load from localStorage once ──
  useEffect(() => {
    if (loaded) return;
    const saved = loadSessions();
    if (saved.length > 0) {
      setSessions(saved);
      setCurrentId(saved[0].id);
    } else {
      const s = newSession();
      setSessions([s]);
      setCurrentId(s.id);
    }
    setLoaded(true);
  }, [loaded]);

  // ── Persist on change ──
  useEffect(() => {
    if (!loaded) return;
    saveSessions(sessions);
  }, [sessions, loaded]);

  // ── Focus textarea on open ──
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [open, currentId]);

  // ── Esc to close ──
  useEffect(() => {
    if (!open) return;
    const h = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, isLoading]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ── Update session helper ──
  const updateSession = useCallback(
    (id: string, updater: (s: ChatSession) => ChatSession) => {
      setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
    },
    [],
  );

  // ── New Chat ──
  const handleNewChat = useCallback(() => {
    if (isLoading) return;
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setCurrentId(s.id);
    setInput("");
  }, [isLoading]);

  // ── Switch session ──
  const handleSelectSession = useCallback(
    (id: string) => {
      if (isLoading || id === currentId) return;
      abortRef.current?.abort();
      setCurrentId(id);
      setInput("");
      setIsLoading(false);
    },
    [isLoading, currentId],
  );

  // ── Delete session ──
  const handleDeleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const s = newSession();
          setCurrentId(s.id);
          return [s];
        }
        if (id === currentId) setCurrentId(next[0].id);
        return next;
      });
    },
    [currentId],
  );

  // ── Send message ──
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !currentId) return;

      const sid = currentId;
      const userMsg: UIMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
      };
      const assistantMsg: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        toolsUsed: [],
        isStreaming: true,
      };

      const prevMessages = sessions.find((s) => s.id === sid)?.messages ?? [];
      const nextMessages = [...prevMessages, userMsg, assistantMsg].slice(
        -MAX_MESSAGES,
      );

      updateSession(sid, (s) => ({
        ...s,
        messages: nextMessages,
        title: sessionTitle([...prevMessages, userMsg]),
        updatedAt: Date.now(),
      }));

      setInput("");
      setIsLoading(true);

      const history: ChatMessage[] = [
        ...prevMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text.trim() },
      ];

      const controller = new AbortController();
      abortRef.current = controller;

      await streamChat(
        history,
        {
          onDelta: (delta) => {
            updateSession(sid, (s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant")
                msgs[msgs.length - 1] = {
                  ...last,
                  content: last.content + delta,
                };
              return { ...s, messages: msgs };
            });
          },
          onToolUse: (name) => {
            updateSession(sid, (s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant")
                msgs[msgs.length - 1] = {
                  ...last,
                  toolsUsed: [...(last.toolsUsed ?? []), name],
                };
              return { ...s, messages: msgs };
            });
          },
          onDone: () => {
            updateSession(sid, (s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant")
                msgs[msgs.length - 1] = { ...last, isStreaming: false };
              return { ...s, messages: msgs, updatedAt: Date.now() };
            });
            setIsLoading(false);
          },
          onError: (msg) => {
            updateSession(sid, (s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last?.role === "assistant")
                msgs[msgs.length - 1] = {
                  ...last,
                  content: last.content || `เกิดข้อผิดพลาด: ${msg}`,
                  isStreaming: false,
                };
              return { ...s, messages: msgs };
            });
            setIsLoading(false);
          },
        },
        controller.signal,
      );
    },
    [isLoading, currentId, sessions, updateSession],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toolLabels: Record<string, string> = {
    get_leave_balance: t("toolLeaveBalance"),
    get_leave_applications: t("toolLeaveApps"),
    create_leave_application: t("toolCreateLeave"),
    get_today_checkin: t("toolCheckin"),
    get_attendance_summary: t("toolAttendance"),
    get_my_shift: t("toolShift"),
    get_payroll_slips: t("toolPayroll"),
  };

  const suggestedPrompts = [
    t("prompt1"),
    t("prompt2"),
    t("prompt3"),
    t("prompt4"),
    t("prompt5"),
    t("prompt6"),
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl h-[90vh] bg-white rounded-2xl shadow-2xl flex overflow-hidden">
        {/* ── Left: History panel ── */}
        <div className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
          {/* New Chat */}
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={handleNewChat}
              disabled={isLoading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm text-gray-700 hover:text-indigo-700 transition-all disabled:opacity-40 font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New chat
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === currentId}
                onSelect={() => handleSelectSession(s.id)}
                onDelete={() => handleDeleteSession(s.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right: Chat area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  viewBox="0 0 500 500"
                  fill="none"
                >
                  <defs>
                    <linearGradient
                      id="modalHeaderGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#A855F7" />
                      <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>
                  </defs>
                  <rect
                    x="50"
                    y="50"
                    width="400"
                    height="400"
                    rx="80"
                    stroke="url(#modalHeaderGrad)"
                    strokeWidth="18"
                  />
                  <path
                    d="M185 140C185 185 150 215 150 215C150 215 185 245 185 290C185 245 220 215 220 215C220 215 185 185 185 140Z"
                    fill="url(#modalHeaderGrad)"
                  />
                  <path
                    d="M260 80C260 105 245 120 245 120C245 120 260 135 260 155C260 135 275 120 275 120C275 120 260 105 260 80Z"
                    fill="url(#modalHeaderGrad)"
                  />
                  <text
                    x="250"
                    y="375"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontWeight="900"
                    fontSize="150"
                    fill="url(#modalHeaderGrad)"
                  >
                    AI
                  </text>
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">
                {t("title")}
              </span>
            </div>
            <button
              onClick={() => !isLoading && onClose()}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages or Welcome */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-lg">
                  <svg
                    className="w-10 h-10 text-white"
                    viewBox="0 0 500 500"
                    fill="none"
                  >
                    <defs>
                      <linearGradient
                        id="modalWelcomeGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#A855F7" />
                        <stop offset="100%" stopColor="#EC4899" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="50"
                      y="50"
                      width="400"
                      height="400"
                      rx="80"
                      stroke="url(#modalWelcomeGrad)"
                      strokeWidth="18"
                    />
                    <path
                      d="M185 140C185 185 150 215 150 215C150 215 185 245 185 290C185 245 220 215 220 215C220 215 185 185 185 140Z"
                      fill="url(#modalWelcomeGrad)"
                    />
                    <path
                      d="M260 80C260 105 245 120 245 120C245 120 260 135 260 155C260 135 275 120 275 120C275 120 260 105 260 80Z"
                      fill="url(#modalWelcomeGrad)"
                    />
                    <text
                      x="250"
                      y="375"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                      fontWeight="900"
                      fontSize="150"
                      fill="url(#modalWelcomeGrad)"
                    >
                      AI
                    </text>
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  {t("welcome")}
                  {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!
                </h2>
                <p className="text-gray-500 text-sm text-center mb-7 max-w-sm">
                  {t("welcomeDesc")}
                </p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-3 py-2.5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm text-gray-600 hover:text-indigo-700 transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center flex-shrink-0 mt-1">
                        <svg
                          className="w-10 h-10 text-white"
                          viewBox="0 0 500 500"
                          fill="none"
                        >
                          <defs>
                            <linearGradient
                              id={`msgGrad${msg.id}`}
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop offset="0%" stopColor="#A855F7" />
                              <stop offset="100%" stopColor="#EC4899" />
                            </linearGradient>
                          </defs>
                          <rect
                            x="50"
                            y="50"
                            width="400"
                            height="400"
                            rx="80"
                            stroke={`url(#msgGrad${msg.id})`}
                            strokeWidth="18"
                          />
                          <path
                            d="M185 140C185 185 150 215 150 215C150 215 185 245 185 290C185 245 220 215 220 215C220 215 185 185 185 140Z"
                            fill={`url(#msgGrad${msg.id})`}
                          />
                          <path
                            d="M260 80C260 105 245 120 245 120C245 120 260 135 260 155C260 135 275 120 275 120C275 120 260 105 260 80Z"
                            fill={`url(#msgGrad${msg.id})`}
                          />
                          <text
                            x="250"
                            y="375"
                            textAnchor="middle"
                            fontFamily="sans-serif"
                            fontWeight="900"
                            fontSize="150"
                            fill={`url(#msgGrad${msg.id})`}
                          >
                            AI
                          </text>
                        </svg>
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5"
                          : "bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3"
                      }`}
                    >
                      {msg.role === "assistant" &&
                        msg.toolsUsed &&
                        msg.toolsUsed.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {msg.toolsUsed.map((tool, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                {toolLabels[tool] || tool}
                              </span>
                            ))}
                          </div>
                        )}
                      <div
                        className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "" : "text-gray-800"}`}
                        dangerouslySetInnerHTML={{
                          __html:
                            msg.role === "assistant"
                              ? renderMarkdown(msg.content)
                              : escapeHtml(msg.content),
                        }}
                      />
                      {msg.isStreaming && !msg.content && (
                        <div className="flex gap-1 py-1">
                          <span
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-xs font-semibold text-indigo-600">
                          {user?.full_name?.[0] ?? "U"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-4 py-3 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("inputPlaceholder")}
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SessionItem ────────────────────────────────────────────

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`group relative flex items-center rounded-lg px-2 py-2 cursor-pointer text-sm transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${active ? "text-indigo-500" : "text-gray-400"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      <span className="truncate flex-1 pr-1">{session.title}</span>
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1.5 p-0.5 rounded hover:bg-red-100 hover:text-red-500 text-gray-400 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">$1</code>',
  );
  html = html.replace(/^[•\-\*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(
    /^\d+\. (.+)$/gm,
    '<li class="ml-4 list-decimal">$1</li>',
  );
  html = html.replace(/\n/g, "<br/>");
  return html;
}
