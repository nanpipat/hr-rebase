"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/i18n";

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations("profile");
  const tc = useTranslations("common");

  useEffect(() => {
    if (user?.frappe_employee_id) {
      router.replace(`/employees/${user.frappe_employee_id}`);
    }
  }, [user, router]);

  if (!user) return <p className="text-gray-500">{tc("loading")}</p>;

  // Fallback if employee not linked
  if (!user.frappe_employee_id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
              {user.full_name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.full_name}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 capitalize">
                {user.role}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {t("notLinked")}
          </p>
        </div>
      </div>
    );
  }

  return <p className="text-gray-500">{t("redirecting")}</p>;
}
