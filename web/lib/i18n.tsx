"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

// ── Types ────────────────────────────────────────────────────

export type Locale = "th" | "en";

type Messages = Record<string, unknown>;

const messages: Record<Locale, Messages> = { en, th };

// ── Context ──────────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "th",
  setLocale: () => {},
});

// ── Provider ─────────────────────────────────────────────────

const STORAGE_KEY = "hr-platform-locale";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");

  // Read stored locale on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "th") {
        setLocaleState(stored);
      }
    } catch {
      // SSR or storage unavailable
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────

export function useLocale() {
  return useContext(LocaleContext);
}

/**
 * Get a nested value from an object using dot‑separated path.
 *   resolve({ a: { b: "hi" } }, "a.b")  →  "hi"
 */
function resolve(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * Interpolate {placeholders} in a string.
 *   interpolate("Hello {name}", { name: "Jo" })  →  "Hello Jo"
 */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return values[key] != null ? String(values[key]) : `{${key}}`;
  });
}

/**
 * Returns a `t()` function scoped to a namespace.
 *
 *   const t = useTranslations("login");
 *   t("emailLabel")                    → "Email"  or "อีเมล"
 *   t("greeting", { name: "Alice" })   → "Hello Alice"
 */
export function useTranslations(namespace?: string) {
  const { locale } = useLocale();
  const msgs = messages[locale] ?? messages.th;

  const t = useCallback(
    (key: string, values?: Record<string, string | number>): string => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const raw = resolve(msgs, fullKey) ?? resolve(messages.en, fullKey) ?? key;
      return interpolate(raw, values);
    },
    [locale, namespace, msgs],
  );

  return t;
}
