"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getPayrollSlips,
  getPayrollSlipDetail,
  processPayroll,
  submitPayroll,
} from "@/lib/api";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

// ── Types ──────────────────────────────────────────────────

interface SlipSummary {
  name: string;
  employee: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  gross_pay: number;
  total_deduction: number;
  net_pay: number;
  status: string;
  posting_date: string | null;
}

interface SlipDetail {
  name: string;
  employee: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  posting_date: string | null;
  gross_pay: number;
  total_deduction: number;
  net_pay: number;
  status: string;
  earnings: Array<{ salary_component: string; amount: number; formula: string | null }>;
  deductions: Array<{ salary_component: string; amount: number; formula: string | null }>;
}

interface ProcessResult {
  month: number;
  year: number;
  created_count: number;
  skipped_count: number;
  error_count: number;
  total_gross: number;
  total_deduction: number;
  total_net: number;
}

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(startDate: string) {
  if (!startDate) return "";
  const d = new Date(startDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function slipStatusVariant(status: string): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (status) {
    case "Submitted":
      return "success";
    case "Draft":
      return "warning";
    case "Cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Section Card ─────────────────────────────────────────────

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-gray-900",
  subtitle,
}: {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Payslip Detail Modal ─────────────────────────────────────

function PayslipDetailView({
  detail,
  onClose,
}: {
  detail: SlipDetail;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payslip Detail</h3>
            <p className="text-sm text-gray-500">{formatMonth(detail.start_date)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Employee info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Employee</p>
              <p className="font-medium text-gray-900">{detail.employee_name}</p>
            </div>
            <Badge variant={slipStatusVariant(detail.status)}>{detail.status}</Badge>
          </div>

          {/* Earnings */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Earnings
            </h4>
            <div className="space-y-2">
              {detail.earnings.map((e, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{e.salary_component}</span>
                  <span className="text-sm font-medium text-gray-900">
                    +{formatCurrency(e.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Gross Pay</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(detail.gross_pay)}
              </span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Deductions
            </h4>
            <div className="space-y-2">
              {detail.deductions.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{d.salary_component}</span>
                  <span className="text-sm font-medium text-red-600">
                    -{formatCurrency(d.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Total Deductions</span>
              <span className="text-sm font-bold text-red-600">
                -{formatCurrency(detail.total_deduction)}
              </span>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-blue-900">Net Pay</span>
              <span className="text-2xl font-bold text-blue-700">
                {formatCurrency(detail.net_pay)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Process Payroll Section (Admin/HR) ───────────────────────

function ProcessPayrollSection({ onProcessed }: { onProcessed: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const { toast } = useToast();

  async function handleProcess() {
    setProcessing(true);
    try {
      const res = await processPayroll({ month, year });
      setResult(res.data);
      if (res.data.created_count > 0) {
        toast(`${res.data.created_count} salary slips created`, "success");
      } else if (res.data.skipped_count > 0) {
        toast("All slips already exist for this period", "info");
      } else {
        toast("No employees with salary structure assignments", "info");
      }
      onProcessed();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to process payroll", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    if (!confirm(`Submit all draft salary slips for ${MONTHS[month - 1]} ${year}? This cannot be undone.`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitPayroll({ month, year });
      toast(`${res.data.submitted_count} salary slips submitted`, "success");
      setResult(null);
      onProcessed();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to submit payroll", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Run Payroll">
      <div className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
              min={2020}
              max={2030}
            />
          </div>
          <button
            onClick={handleProcess}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {processing ? "Processing..." : "Process Payroll"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            {submitting ? "Submitting..." : "Submit All"}
          </button>
        </div>

        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-lg font-bold text-blue-600">{result.created_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Skipped</p>
              <p className="text-lg font-bold text-gray-500">{result.skipped_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Gross</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(result.total_gross)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Net</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(result.total_net)}</p>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function PayrollPage() {
  const { user } = useAuth();
  const [slips, setSlips] = useState<SlipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<SlipDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filter state
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const isAdmin = user?.role === "admin" || user?.role === "hr";
  const { toast } = useToast();

  function fetchSlips() {
    setLoading(true);
    getPayrollSlips(filterYear)
      .then((res) => {
        const data = (res.data || []) as unknown as SlipSummary[];
        setSlips(data);
      })
      .catch(() => {
        setSlips([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchSlips();
  }, [filterYear]);

  async function handleViewDetail(slipId: string) {
    setLoadingDetail(true);
    try {
      const res = await getPayrollSlipDetail(slipId);
      setSelectedDetail(res.data);
    } catch {
      toast("Failed to load payslip detail", "error");
    } finally {
      setLoadingDetail(false);
    }
  }

  // Stats
  const totalGross = slips.reduce((sum, s) => sum + s.gross_pay, 0);
  const totalNet = slips.reduce((sum, s) => sum + s.net_pay, 0);
  const draftCount = slips.filter((s) => s.status === "Draft").length;
  const submittedCount = slips.filter((s) => s.status === "Submitted").length;

  // Latest payslip for employee view
  const latestSlip = slips.length > 0 ? slips[0] : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-40 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin ? "Payroll Management" : "My Payslips"}
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Year:</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin: Process Payroll Section */}
      {isAdmin && <ProcessPayrollSection onProcessed={fetchSlips} />}

      {/* Stats */}
      {isAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Slips"
            value={slips.length}
            color="text-blue-600"
          />
          <StatCard
            label="Draft"
            value={draftCount}
            color={draftCount > 0 ? "text-orange-600" : "text-gray-900"}
          />
          <StatCard
            label="Submitted"
            value={submittedCount}
            color="text-green-600"
          />
          <StatCard
            label="Total Net Pay"
            value={`${formatCurrency(totalNet)}`}
            color="text-gray-900"
            subtitle={`Gross: ${formatCurrency(totalGross)}`}
          />
        </div>
      ) : latestSlip ? (
        /* Employee: Latest Payslip Summary */
        <div
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all"
          onClick={() => handleViewDetail(latestSlip.name)}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Latest Payslip</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatMonth(latestSlip.start_date)}
              </p>
            </div>
            <Badge variant={slipStatusVariant(latestSlip.status)}>{latestSlip.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Gross Pay</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(latestSlip.gross_pay)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Deductions</p>
              <p className="text-xl font-bold text-red-600">-{formatCurrency(latestSlip.total_deduction)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Pay</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(latestSlip.net_pay)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Click to view details</p>
        </div>
      ) : null}

      {/* Payslip Table */}
      {slips.length === 0 ? (
        <div className="bg-white rounded-lg shadow">
          <EmptyState
            title="No payslips"
            description={
              isAdmin
                ? "No salary slips found. Process payroll to generate slips."
                : "No payslips available for the selected year."
            }
          />
        </div>
      ) : (
        <SectionCard
          title={isAdmin ? `Salary Slips (${slips.length})` : "Payslip History"}
        >
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Gross
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Deductions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Net Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {slips.map((slip) => (
                  <tr key={slip.name} className="hover:bg-gray-50">
                    {isAdmin && (
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {slip.employee_name}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatMonth(slip.start_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                      {formatCurrency(slip.gross_pay)}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 text-right">
                      -{formatCurrency(slip.total_deduction)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(slip.net_pay)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={slipStatusVariant(slip.status)}>{slip.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleViewDetail(slip.name)}
                        disabled={loadingDetail}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Payslip Detail Modal */}
      {selectedDetail && (
        <PayslipDetailView
          detail={selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      )}
    </div>
  );
}
