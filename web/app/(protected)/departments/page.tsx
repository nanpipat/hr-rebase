"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTranslations } from "@/lib/i18n";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type Department,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── Modal ─────────────────────────────────────────────────────

function DepartmentModal({
  departments,
  editing,
  onClose,
  onSaved,
  t,
  tc,
}: {
  departments: Department[];
  editing: Department | null;
  onClose: () => void;
  onSaved: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  tc: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [name, setName] = useState(editing?.department_name || "");
  const [parent, setParent] = useState(editing?.parent_department || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDepartment(editing.name, {
          department_name: name.trim(),
          parent_department: parent,
        });
        toast(t("departmentUpdated"), "success");
      } else {
        await createDepartment({ department_name: name.trim(), parent_department: parent || undefined });
        toast(t("departmentCreated"), "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : editing ? t("failedUpdate") : t("failedCreate"), "error");
    } finally {
      setSaving(false);
    }
  };

  // Filter out the editing department from parent choices (can't be its own parent)
  const parentChoices = departments.filter((d) => !editing || d.name !== editing.name);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {editing ? t("editDepartment") : t("addDepartment")}
        </h2>
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

export default function DepartmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations("departments");
  const tc = useTranslations("common");
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const canManage = user?.role === "admin" || user?.role === "hr";

  const load = () => {
    setLoading(true);
    getDepartments()
      .then((res) => setDepartments(res.data?.departments || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (dept: Department) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteDepartment(dept.name);
      toast(t("departmentDeleted"), "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("failedDelete"), "error");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (dept: Department, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(dept);
    setShowModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "" : t("count", { total: departments.length })}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            {t("addDepartment")}
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
              <div className="h-6 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("departmentName")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("parentDepartment")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {t("employeeCount")}
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {tc("actions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {departments.map((dept) => (
                <tr
                  key={dept.name}
                  onClick={() => router.push(`/departments/${encodeURIComponent(dept.name)}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
                        {(dept.department_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dept.department_name}</p>
                        <p className="text-xs text-gray-400">{dept.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {dept.parent_department || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {dept.employee_count}
                  </td>
                  {canManage && (
                    <td
                      className="px-6 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => openEdit(dept, e)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {tc("edit")}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(dept);
                          }}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          {tc("delete")}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-6 py-8 text-sm text-gray-500 text-center">
                    {t("noDepartments")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <DepartmentModal
          departments={departments}
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={load}
          t={t}
          tc={tc}
        />
      )}
    </div>
  );
}
