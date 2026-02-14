"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMyAttendance,
  submitAttendanceRequest,
  getAttendanceRequests,
  approveAttendanceRequest,
} from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface AttendanceRecord {
  attendance_date: string;
  status: string;
  working_hours: number;
  leave_type?: string;
}

interface AttendanceData {
  records: AttendanceRecord[];
  summary: {
    total_days: number;
    present: number;
    absent: number;
    on_leave: number;
  };
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ attendance_date: "", reason: "", status: "Present" });
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();
  const canApprove =
    user?.role === "admin" || user?.role === "hr" || user?.role === "manager";

  function fetchData() {
    setLoading(true);
    Promise.all([
      getMyAttendance().catch(() => ({ data: null })),
      getAttendanceRequests().catch(() => ({ data: [] })),
    ])
      .then(([attRes, reqRes]) => {
        setData(attRes.data as unknown as AttendanceData);
        setRequests(reqRes.data || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitAttendanceRequest(form);
      setShowForm(false);
      setForm({ attendance_date: "", reason: "", status: "Present" });
      toast("Correction request submitted", "success");
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to submit request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveRequest(id: string, action: "approve" | "reject") {
    try {
      await approveAttendanceRequest(id, action);
      toast(`Request ${action}d`, "success");
      fetchData();
    } catch {
      toast(`Failed to ${action} request`, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? "Cancel" : "Request Correction"}
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Days</p>
            <p className="text-2xl font-bold">{data.summary.total_days}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Present</p>
            <p className="text-2xl font-bold text-green-600">{data.summary.present}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Absent</p>
            <p className="text-2xl font-bold text-red-600">{data.summary.absent}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">On Leave</p>
            <p className="text-2xl font-bold text-yellow-600">{data.summary.on_leave}</p>
          </div>
        </div>
      )}

      {/* Correction Request Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitRequest}
          className="bg-white rounded-lg shadow p-6 mb-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">Attendance Correction Request</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={form.attendance_date}
                onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Present">Present</option>
                <option value="Work From Home">Work From Home</option>
                <option value="Half Day">Half Day</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              required
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

      {/* Pending Requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance Requests</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {canApprove && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {canApprove && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((req, i) => (
                  <tr key={i}>
                    {canApprove && (
                      <td className="px-6 py-4 text-sm text-gray-900">{String(req.employee_name || "")}</td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-900">{String(req.from_date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{String(req.reason || "")}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={statusVariant(String(req.status))}>{String(req.status)}</Badge>
                    </td>
                    {canApprove && (
                      <td className="px-6 py-4 text-sm space-x-2">
                        {req.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleApproveRequest(String(req.name), "approve")}
                              className="text-green-600 hover:text-green-800 text-xs font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproveRequest(String(req.name), "reject")}
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Records Table */}
      {data?.records && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Working Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.records.map((record, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.attendance_date}</td>
                  <td className="px-6 py-4 text-sm">
                    <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {record.working_hours ? `${record.working_hours}h` : "-"}
                  </td>
                </tr>
              ))}
              {data.records.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm text-gray-500 text-center">
                    No attendance records
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
