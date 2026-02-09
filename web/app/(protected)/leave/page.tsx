"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getLeaves, createLeave, approveLeave } from "@/lib/api";

export default function LeavePage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leave_type: "Annual Leave",
    from_date: "",
    to_date: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canApprove = user?.role === "admin" || user?.role === "hr" || user?.role === "manager";

  function fetchLeaves() {
    setLoading(true);
    getLeaves()
      .then((res) => setLeaves(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchLeaves();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createLeave(form);
      setShowForm(false);
      setForm({ leave_type: "Annual Leave", from_date: "", to_date: "", reason: "" });
      fetchLeaves();
    } catch {
      alert("Failed to create leave request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(id: string, status: "Approved" | "Rejected") {
    try {
      await approveLeave(id, status);
      fetchLeaves();
    } catch {
      alert(`Failed to ${status.toLowerCase()} leave`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? "Cancel" : "New Request"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
            <select
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option>Annual Leave</option>
              <option>Sick Leave</option>
              <option>Personal Leave</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {canApprove && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {canApprove && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaves.map((leave, idx) => (
                <tr key={idx}>
                  {canApprove && (
                    <td className="px-6 py-4 text-sm text-gray-900">{String(leave.employee_name || "")}</td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-900">{String(leave.leave_type)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{String(leave.from_date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{String(leave.to_date)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{String(leave.total_leave_days || leave.total_days)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        leave.status === "Approved"
                          ? "bg-green-100 text-green-800"
                          : leave.status === "Rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {String(leave.status)}
                    </span>
                  </td>
                  {canApprove && (
                    <td className="px-6 py-4 text-sm space-x-2">
                      {leave.status === "Open" && (
                        <>
                          <button
                            onClick={() => handleApprove(String(leave.name), "Approved")}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprove(String(leave.name), "Rejected")}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr>
                  <td colSpan={canApprove ? 7 : 5} className="px-6 py-4 text-sm text-gray-500 text-center">
                    No leave records
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
