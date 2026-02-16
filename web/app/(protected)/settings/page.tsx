"use client";

import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/i18n";

export default function SettingsPage() {
  const { user } = useAuth();
  const t = useTranslations("settings");

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>

      <div className="max-w-lg bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-500">{t("company")}</label>
          <p className="text-gray-900">{user.company_name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500">{t("yourName")}</label>
          <p className="text-gray-900">{user.full_name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500">{t("email")}</label>
          <p className="text-gray-900">{user.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500">{t("role")}</label>
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
            {user.role}
          </span>
        </div>
      </div>
    </div>
  );
}
