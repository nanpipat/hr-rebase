"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUsers, changeUserRole, changeUserStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/i18n";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  frappe_employee_id?: string;
  created_at: string;
}

const ROLES = ["admin", "hr", "manager", "employee"];
const STATUSES = ["active", "suspended", "disabled"];

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const t = useTranslations("users");
  const tc = useTranslations("common");

  function fetchUsers() {
    setLoading(true);
    getUsers()
      .then((res) => setUsers((res.data || []) as unknown as User[]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleRoleChange(userId: string, role: string) {
    try {
      await changeUserRole(userId, role);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("failedChangeRole"));
    }
  }

  async function handleStatusChange(userId: string, status: string) {
    try {
      await changeUserStatus(userId, status);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("failedChangeStatus"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href="/users/invite"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {t("inviteUser")}
        </Link>
      </div>

      {loading && <p className="text-gray-500">{tc("loading")}</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("nameCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("emailCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("roleCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tc("status")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("employeeIdCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {u.full_name}
                      {isSelf && <span className="ml-2 text-xs text-gray-400">({t("you")})</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-6 py-4 text-sm">
                      {me?.role === "admin" && !isSelf ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {!isSelf ? (
                        <select
                          value={u.status}
                          onChange={(e) => handleStatusChange(u.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            u.status === "active"
                              ? "bg-green-100 text-green-800"
                              : u.status === "suspended"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {u.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {u.frappe_employee_id || "-"}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 text-center">
                    {t("noUsers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
