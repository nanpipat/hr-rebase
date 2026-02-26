"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/i18n";
import {
  getDepartment,
  getDepartments,
  updateDepartment,
  type Department,
  type DepartmentDetail,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── Edit Modal ────────────────────────────────────────────────

function EditModal({
  dept,
  allDepartments,
  onClose,
  onSaved,
  t,
  tc,
}: {
  dept: DepartmentDetail["department"];
  allDepartments: Department[];
  onClose: () => void;
  onSaved: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  tc: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [name, setName] = useState(dept.department_name);
  const [parent, setParent] = useState(dept.parent_department || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDepartment(dept.name, {
        department_name: name.trim(),
        parent_department: parent,
      });
      toast(t("departmentUpdated"), "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("failedUpdate"), "error");
    } finally {
      setSaving(false);
    }
  };

  const parentChoices = allDepartments.filter((d) => d.name !== dept.name);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("editDepartment")}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("departmentName")} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("parentDepartment")}
            </label>
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">{t("noParent")}</option>
              {parentChoices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.department_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("saving") : tc("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations("departments");
  const tc = useTranslations("common");

  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);

  const canManage = user?.role === "admin" || user?.role === "hr";

  const decodedId = decodeURIComponent(id || "");

  const load = () => {
    setLoading(true);
    Promise.all([
      getDepartment(decodedId),
      getDepartments(),
    ])
      .then(([detailRes, listRes]) => {
        setDetail(detailRes.data);
        setAllDepartments(listRes.data?.departments || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (decodedId) load();
  }, [decodedId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => router.push("/departments")}
          className="text-blue-600 hover:underline text-sm"
        >
          {t("backToList")}
        </button>
      </div>
    );
  }

  if (!detail) return null;

  const { department, employees } = detail;

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/departments")}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3"
        >
          ← {t("backToList")}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{department.department_name}</h1>
            {department.parent_department && (
              <p className="text-sm text-gray-500 mt-1">
                {t("parentDepartment")}: {department.parent_department}
              </p>
            )}
          </div>
          {canManage && (
            <button
              onClick={() => setShowEdit(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              {tc("edit")}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">{t("employeeCount")}</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">{employees.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">{t("parentDepartment")}</p>
          <p className="text-base font-semibold text-gray-900 mt-1">
            {department.parent_department || "-"}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">ID</p>
          <p className="text-base font-semibold text-gray-900 mt-1">{department.name}</p>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t("employeeList")}</h2>
        </div>
        {employees.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500 text-center">{t("noEmployees")}</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {tc("employee")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {tc("status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map((emp) => (
                <tr
                  key={emp.employee_id}
                  onClick={() => router.push(`/employees/${emp.employee_id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                        {(emp.employee_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{emp.employee_name}</p>
                        <p className="text-xs text-gray-400">
                          {emp.employee_id}
                          {emp.designation ? ` · ${emp.designation}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showEdit && (
        <EditModal
          dept={department}
          allDepartments={allDepartments}
          onClose={() => setShowEdit(false)}
          onSaved={load}
          t={t}
          tc={tc}
        />
      )}
    </div>
  );
}
