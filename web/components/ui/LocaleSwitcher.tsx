"use client";

import { useLocale, type Locale } from "@/lib/i18n";

const labels: Record<Locale, string> = {
  th: "TH",
  en: "EN",
};

export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  function toggle() {
    setLocale(locale === "th" ? "en" : "th");
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
      title={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      <span className="text-base leading-none">🌐</span>
      <span>{labels[locale]}</span>
    </button>
  );
}
