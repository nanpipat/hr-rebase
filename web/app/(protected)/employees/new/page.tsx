"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, getDepartments, type Department } from "@/lib/api";

export default function NewEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    employee_name: "",
    department: "",
    designation: "",
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDepartments()
      .then((res) => setDepartments(res.data?.departments || []))
      .catch(() => {}); // non-critical
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await createEmployee({
        employee_name: form.employee_name,
        department: form.department || undefined,
        designation: form.designation || undefined,
      });
      router.push(`/employees/${data.employee_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Employee</h1>

      <form onSubmit={handleSubmit} className="max-w-lg bg-white rounded-lg shadow p-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employee Name *
          </label>
          <input
            type="text"
            value={form.employee_name}
            onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
          >
            <option value="">— Select Department —</option>
            {departments.map((d) => (
              <option key={d.name} value={d.name}>
                {d.department_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Designation
          </label>
          <input
            type="text"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="e.g. Software Engineer"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? "Creating..." : "Create Employee"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
