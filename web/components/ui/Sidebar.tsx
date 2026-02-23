"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMenuForRole } from "@/lib/role-menu";
import { useTranslations } from "@/lib/i18n";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import NotificationBell from "@/components/ui/NotificationBell";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations();

  const menuItems = user ? getMenuForRole(user.role) : [];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{t("common.appName")}</h2>
          {user && (
            <p className="text-xs text-gray-400 mt-1 truncate">{user.company_name}</p>
          )}
        </div>
        {user && <NotificationBell />}
      </div>
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
      {user && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="px-4 mb-3">
            <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
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
  );
}
