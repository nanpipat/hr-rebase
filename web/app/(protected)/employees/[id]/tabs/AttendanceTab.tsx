"use client";

import { useEffect, useState } from "react";
import { getEmployeeAttendance } from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";

interface Props {
  employeeId: string;
}

export default function AttendanceTab({ employeeId }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeeAttendance(employeeId)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;

  const summary = data?.summary as Record<string, number> | undefined;
  const records = (data?.records || []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total Days</p>
            <p className="text-2xl font-bold">{summary.total_days}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Present</p>
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Absent</p>
            <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">On Leave</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.on_leave}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Late Days</p>
            <p className="text-2xl font-bold text-orange-600">{summary.late_days || 0}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Working Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((r, i) => (
              <tr key={i}>
                <td className="px-6 py-4 text-sm text-gray-900">{String(r.attendance_date)}</td>
                <td className="px-6 py-4 text-sm">
                  <Badge variant={statusVariant(String(r.status))}>{String(r.status)}</Badge>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {r.working_hours ? `${r.working_hours}h` : "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {r.late_entry ? "Yes" : "-"}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center">
                  No attendance records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
