"use client";

import { useEffect, useState } from "react";
import { updateEmployee, getDepartments, type Department } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Props {
  employee: Record<string, unknown>;
  canEdit: boolean;
  onUpdate: () => void;
}

export default function EmploymentTab({ employee, canEdit, onUpdate }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    department: String(employee.department || ""),
    designation: String(employee.designation || ""),
    employment_type: String(employee.employment_type || ""),
    branch: String(employee.branch || ""),
    reports_to: String(employee.reports_to || ""),
    status: String(employee.status || ""),
  });

  useEffect(() => {
    if (editing) {
      getDepartments()
        .then((res) => setDepartments(res.data?.departments || []))
        .catch(() => {});
    }
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateEmployee(String(employee.employee_id), form);
      setEditing(false);
      toast("Employment details updated", "success");
      onUpdate();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  }

  const textFields = [
    { key: "designation", label: "Designation" },
    { key: "employment_type", label: "Employment Type" },
    { key: "branch", label: "Branch" },
    { key: "reports_to", label: "Reports To (Employee ID)" },
    { key: "status", label: "Status" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Employment Details</h3>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Edit
          </button>
        )}
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
          <dd className="mt-1 text-sm text-gray-900">{String(employee.employee_id)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Company</dt>
          <dd className="mt-1 text-sm text-gray-900">{String(employee.company || "-")}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Date of Joining</dt>
          <dd className="mt-1 text-sm text-gray-900">{String(employee.date_of_joining || "-")}</dd>
        </div>

        {/* Department — dropdown when editing */}
        <div>
          <dt className="text-sm font-medium text-gray-500">Department</dt>
          {editing ? (
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="">— Select Department —</option>
              {departments.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.department_name}
                </option>
              ))}
            </select>
          ) : (
            <dd className="mt-1 text-sm text-gray-900">
              {String(employee.department || "-")}
            </dd>
          )}
        </div>

        {/* Other text fields */}
        {textFields.map((f) => (
          <div key={f.key}>
            <dt className="text-sm font-medium text-gray-500">{f.label}</dt>
            {editing ? (
              <input
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            ) : (
              <dd className="mt-1 text-sm text-gray-900">
                {String(employee[f.key] || "-")}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {editing && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
