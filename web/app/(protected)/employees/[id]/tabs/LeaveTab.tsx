"use client";

import { useEffect, useState } from "react";
import { getEmployeeLeave } from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  employeeId: string;
}

export default function LeaveTab({ employeeId }: Props) {
  const [allocations, setAllocations] = useState<Array<Record<string, unknown>>>([]);
  const [applications, setApplications] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeeLeave(employeeId)
      .then((res) => {
        setAllocations(res.data.allocations || []);
        setApplications(res.data.applications || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;

  return (
    <div className="space-y-8">
      {/* Balance Cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Balance</h3>
        {allocations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allocations.map((a, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm font-medium text-gray-500">{String(a.leave_type)}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {Number(a.remaining || 0)}
                  </span>
                  <span className="text-sm text-gray-400">
                    / {Number(a.total_allocated || 0)} days
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Used: {Number(a.used || 0)} days
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No leave allocations found.</p>
        )}
      </div>

      {/* Leave History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave History</h3>
        {applications.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {applications.map((app, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 text-sm text-gray-900">{String(app.leave_type)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{String(app.from_date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{String(app.to_date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{String(app.total_leave_days || "")}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={statusVariant(String(app.status))}>{String(app.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No leave records" description="No leave applications found for this employee." />
        )}
      </div>
    </div>
  );
}
