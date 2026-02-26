"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMenuForRole } from "@/lib/role-menu";
import { useTranslations } from "@/lib/i18n";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import NotificationBell from "@/components/ui/NotificationBell";
import ChatModal from "@/components/ui/ChatModal";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations();
  const [chatOpen, setChatOpen] = useState(false);

  const menuItems = user ? getMenuForRole(user.role) : [];

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
        {/* Header: App name + AI icon + Notification */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {t("common.appName")}
            </h2>
            {user && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {user.company_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* AI Chat button */}
            <button
              onClick={() => setChatOpen(true)}
              title={t("chat.title")}
              className="w-8 h-8 rounded-lg bg-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
            >
              <svg
                className="w-10 h-10 text-white"
                viewBox="0 0 500 500"
                fill="none"
              >
                <defs>
                  <linearGradient
                    id="sidebarGrad"
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
                  stroke="url(#sidebarGrad)"
                  strokeWidth="18"
                />
                <path
                  d="M185 140C185 185 150 215 150 215C150 215 185 245 185 290C185 245 220 215 220 215C220 215 185 185 185 140Z"
                  fill="url(#sidebarGrad)"
                />
                <path
                  d="M260 80C260 105 245 120 245 120C245 120 260 135 260 155C260 135 275 120 275 120C275 120 260 105 260 80Z"
                  fill="url(#sidebarGrad)"
                />
                <text
                  x="250"
                  y="375"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight="900"
                  fontSize="150"
                  fill="url(#sidebarGrad)"
                >
                  AI
                </text>
              </svg>
            </button>
            {user && <NotificationBell />}
          </div>
        </div>

        {/* Nav */}
        <nav className="space-y-1 flex-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {user && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="px-4 mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                {user.role}
              </span>
            </div>
            <LocaleSwitcher />
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md mt-1"
            >
              {t("common.logout")}
            </button>
          </div>
        )}
      </aside>

      {/* Chat Modal */}
      <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
