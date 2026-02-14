"use client";

import { useEffect, useState } from "react";
import { getEmployeeCompensation } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  employeeId: string;
}

export default function CompensationTab({ employeeId }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeeCompensation(employeeId)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <p className="text-gray-500 py-4">Loading...</p>;

  if (!data?.assignment) {
    return <EmptyState title="No salary structure" description="No salary structure has been assigned to this employee yet." />;
  }

  const assignment = data.assignment as Record<string, unknown>;
  const earnings = (data.earnings || []) as Array<Record<string, unknown>>;
  const deductions = (data.deductions || []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Structure</h3>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">Structure</dt>
            <dd className="mt-1 text-sm text-gray-900">{String(data.structure || "-")}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Base</dt>
            <dd className="mt-1 text-sm text-gray-900">{Number(assignment.base || 0).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">From Date</dt>
            <dd className="mt-1 text-sm text-gray-900">{String(assignment.from_date || "-")}</dd>
          </div>
        </dl>
      </div>

      {earnings.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Earnings</h4>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {earnings.map((e, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 text-sm text-gray-900">{String(e.salary_component)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{Number(e.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deductions.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Deductions</h4>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deductions.map((d, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 text-sm text-gray-900">{String(d.salary_component)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{Number(d.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
