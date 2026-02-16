"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getLeaves,
  createLeave,
  approveLeave,
  cancelLeave,
  getLeaveBalance,
} from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "@/lib/i18n";

// ── Helpers ──────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function isCurrentMonth(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

/** Get all dates between from and to (inclusive) as YYYY-MM-DD strings */
function getDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

type LeaveRecord = Record<string, unknown>;

// ── Shared Components ────────────────────────────────────────

function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
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

// ── Leave Balance Bar ────────────────────────────────────────

const balanceColors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];

function LeaveBalanceSection({ balance, t }: { balance: LeaveRecord[]; t: (key: string, v?: Record<string, string | number>) => string }) {
  if (balance.length === 0) return null;

  return (
    <SectionCard title={t("leaveBalance")}>
      <div className="space-y-4">
        {balance.map((b, i) => {
          const remaining = Number(b.remaining || 0);
          const total = Number(b.total_allocated || 0);
          const used = Number(b.used || 0);
          const pct = total > 0 ? (remaining / total) * 100 : 0;
          const isLow = total > 0 && pct < 20;

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {String(b.leave_type)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{remaining}</span>
                  <span className="text-xs text-gray-400">/ {total} {t("daysCol")}</span>
                  {isLow && (
                    <span className="text-xs text-amber-600 font-medium">{t("low")}</span>
                  )}
                </div>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isLow ? "bg-amber-500" : balanceColors[i % balanceColors.length]
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{t("usedDays", { count: used })}</p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Pending Approval Queue ───────────────────────────────────

function PendingApprovalQueue({
  pendingLeaves,
  onApprove,
  t,
  tc,
}: {
  pendingLeaves: LeaveRecord[];
  onApprove: (id: string, status: "Approved" | "Rejected") => void;
  t: (key: string, v?: Record<string, string | number>) => string;
  tc: (key: string) => string;
}) {
  if (pendingLeaves.length === 0) return null;

  return (
    <SectionCard title={`${t("pendingApprovals")} (${pendingLeaves.length})`}>
      <div className="space-y-3">
        {pendingLeaves.map((leave, i) => (
          <div
            key={i}
            className="border border-orange-200 bg-orange-50 rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">
                    {String(leave.employee_name || "")}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-sm text-gray-600">
                    {String(leave.leave_type || "")}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-sm text-gray-500">
                    {formatDate(String(leave.from_date || ""))}
                    {leave.from_date !== leave.to_date &&
                      ` - ${formatDate(String(leave.to_date || ""))}`}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({String(leave.total_leave_days || leave.total_days || "1")}d)
                  </span>
                </div>
                {String(leave.description || "") !== "" && (
                  <p className="text-xs text-gray-500 mt-1 italic truncate">
                    &ldquo;{String(leave.description)}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => onApprove(String(leave.name), "Approved")}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  {tc("approve")}
                </button>
                <button
                  onClick={() => onApprove(String(leave.name), "Rejected")}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  {tc("reject")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Mini Calendar ────────────────────────────────────────────

const leaveTypeColorMap: Record<string, string> = {
  "Annual Leave": "bg-blue-500",
  "Sick Leave": "bg-red-400",
  "Personal Leave": "bg-purple-500",
  "Casual Leave": "bg-teal-500",
  "Compensatory Off": "bg-orange-500",
};

function getLeaveColor(leaveType: string) {
  return leaveTypeColorMap[leaveType] || "bg-gray-400";
}

function LeaveCalendar({
  leaves,
  calMonth,
  calYear,
  onPrev,
  onNext,
  t,
}: {
  leaves: LeaveRecord[];
  calMonth: number;
  calYear: number;
  onPrev: () => void;
  onNext: () => void;
  t: (key: string) => string;
}) {
  // Build a map of date -> leave types for this month
  const leaveDayMap = useMemo(() => {
    const map: Record<string, { type: string; status: string; employee?: string }[]> = {};
    for (const l of leaves) {
      const status = String(l.status || "");
      if (status === "Cancelled" || status === "Rejected") continue;
      const from = String(l.from_date || "");
      const to = String(l.to_date || "");
      if (!from || !to) continue;
      const dates = getDateRange(from, to);
      for (const d of dates) {
        const dd = new Date(d + "T00:00:00");
        if (dd.getMonth() === calMonth && dd.getFullYear() === calYear) {
          if (!map[d]) map[d] = [];
          map[d].push({
            type: String(l.leave_type || ""),
            status,
            employee: String(l.employee_name || ""),
          });
        }
      }
    }
    return map;
  }, [leaves, calMonth, calYear]);

  // Calendar grid
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  // Monday=0, Sunday=6
  const startDow = (firstDay.getDay() + 6) % 7;

  const monthName = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells: Array<{ day: number | null; dateStr: string }> = [];
  // Empty cells before first day
  for (let i = 0; i < startDow; i++) cells.push({ day: null, dateStr: "" });
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <SectionCard
      title={t("leaveCalendar")}
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
            {monthName}
          </span>
          <button
            onClick={onNext}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      }
    >
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>
      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={i} className="h-10" />;
          }
          const isToday = cell.dateStr === todayStr;
          const dayLeaves = leaveDayMap[cell.dateStr] || [];
          const isWeekend = i % 7 >= 5;

          return (
            <div
              key={i}
              className={`h-10 rounded-lg flex flex-col items-center justify-center relative ${
                isToday
                  ? "bg-blue-50 ring-2 ring-blue-300"
                  : isWeekend
                    ? "bg-gray-50"
                    : ""
              }`}
              title={
                dayLeaves.length > 0
                  ? dayLeaves.map((l) => `${l.employee || ""}: ${l.type} (${l.status})`).join("\n")
                  : undefined
              }
            >
              <span
                className={`text-sm ${
                  isToday ? "font-bold text-blue-700" : isWeekend ? "text-gray-400" : "text-gray-700"
                }`}
              >
                {cell.day}
              </span>
              {dayLeaves.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayLeaves.slice(0, 3).map((l, j) => (
                    <span
                      key={j}
                      className={`w-1.5 h-1.5 rounded-full ${getLeaveColor(l.type)}`}
                    />
                  ))}
                  {dayLeaves.length > 3 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-100">
        {Object.entries(leaveTypeColorMap).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {type}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Status Filter Tabs ───────────────────────────────────────

const statusFilters = ["All", "Open", "Approved", "Rejected", "Cancelled"] as const;
type StatusFilter = (typeof statusFilters)[number];

function StatusFilterTabs({
  active,
  onChange,
  counts,
}: {
  active: StatusFilter;
  onChange: (f: StatusFilter) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {statusFilters.map((f) => {
        const count = f === "All" ? counts.All : counts[f] || 0;
        const isActive = active === f;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f}
            {count > 0 && (
              <span
                className={`ml-1.5 text-xs ${
                  isActive ? "text-blue-200" : "text-gray-400"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Leave Request Form ───────────────────────────────────────

function LeaveRequestForm({
  balance,
  onSubmit,
  onCancel,
  t,
  tc,
}: {
  balance: LeaveRecord[];
  onSubmit: (data: { leave_type: string; from_date: string; to_date: string; reason: string }) => Promise<void>;
  onCancel: () => void;
  t: (key: string, v?: Record<string, string | number>) => string;
  tc: (key: string) => string;
}) {
  const leaveTypes = balance.length > 0
    ? balance.map((b) => String(b.leave_type))
    : ["Annual Leave", "Sick Leave", "Personal Leave"];

  const [form, setForm] = useState({
    leave_type: leaveTypes[0] || "Annual Leave",
    from_date: "",
    to_date: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Find remaining for selected type
  const selectedBalance = balance.find(
    (b) => String(b.leave_type) === form.leave_type
  );
  const remaining = selectedBalance ? Number(selectedBalance.remaining || 0) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-6 mb-6 space-y-4"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{t("newLeaveRequest")}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("leaveType")}
          </label>
          <select
            value={form.leave_type}
            onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {leaveTypes.map((lt) => (
              <option key={lt} value={lt}>
                {lt}
              </option>
            ))}
          </select>
          {remaining !== null && (
            <p className={`text-xs mt-1 ${remaining <= 0 ? "text-red-500" : "text-gray-400"}`}>
              {t("remaining", { count: remaining })}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("fromLabel")}
          </label>
          <input
            type="date"
            value={form.from_date}
            onChange={(e) => setForm({ ...form, from_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("toLabel")}
          </label>
          <input
            type="date"
            value={form.to_date}
            onChange={(e) => setForm({ ...form, to_date: e.target.value })}
            min={form.from_date || undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("reasonLabel")}
        </label>
        <textarea
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          rows={2}
          placeholder={t("reasonPlaceholder")}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {submitting ? t("submitting") : t("submitRequest")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
        >
          {t("cancelButton")}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function LeavePage() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [balance, setBalance] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  // Calendar state
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  const { toast } = useToast();
  const t = useTranslations("leave");
  const tc = useTranslations("common");
  const canApprove =
    user?.role === "admin" || user?.role === "hr" || user?.role === "manager";

  function fetchData() {
    setLoading(true);
    Promise.all([
      getLeaves().catch(() => ({ data: [] })),
      getLeaveBalance().catch(() => ({ data: [] })),
    ])
      .then(([leavesRes, balanceRes]) => {
        setLeaves(leavesRes.data || []);
        setBalance(balanceRes.data || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Computed values
  const pendingLeaves = useMemo(
    () => leaves.filter((l) => l.status === "Open"),
    [leaves]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: leaves.length };
    for (const l of leaves) {
      const s = String(l.status || "");
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    if (statusFilter === "All") return leaves;
    return leaves.filter((l) => l.status === statusFilter);
  }, [leaves, statusFilter]);

  // Stats for admin
  const approvedThisMonth = useMemo(
    () => leaves.filter((l) => l.status === "Approved" && isCurrentMonth(String(l.from_date || ""))).length,
    [leaves]
  );
  const rejectedThisMonth = useMemo(
    () => leaves.filter((l) => l.status === "Rejected" && isCurrentMonth(String(l.from_date || ""))).length,
    [leaves]
  );

  // Handlers
  async function handleSubmitLeave(data: {
    leave_type: string;
    from_date: string;
    to_date: string;
    reason: string;
  }) {
    try {
      await createLeave(data);
      setShowForm(false);
      toast(t("leaveSubmitted"), "success");
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("failedCreate"), "error");
    }
  }

  async function handleApprove(id: string, status: "Approved" | "Rejected") {
    try {
      await approveLeave(id, status);
      toast(`Leave ${status.toLowerCase()}`, "success");
      fetchData();
    } catch {
      toast(`Failed to ${status.toLowerCase()} leave`, "error");
    }
  }

  async function handleCancel(id: string) {
    if (!confirm(t("cancelLeaveConfirm"))) return;
    try {
      await cancelLeave(id);
      toast(t("leaveCancelled"), "success");
      fetchData();
    } catch {
      toast(t("failedCancel"), "error");
    }
  }

  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-40 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
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
          {canApprove ? t("managementTitle") : t("myTitle")}
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          {t("newRequest")}
        </button>
      </div>

      {/* Leave Request Form */}
      {showForm && (
        <LeaveRequestForm
          balance={balance}
          onSubmit={handleSubmitLeave}
          onCancel={() => setShowForm(false)}
          t={t}
          tc={tc}
        />
      )}

      {/* Admin Stat Cards */}
      {canApprove && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t("totalRequests")}
            value={leaves.length}
            color="text-blue-600"
          />
          <StatCard
            label={t("pendingApproval")}
            value={pendingLeaves.length}
            color={pendingLeaves.length > 0 ? "text-orange-600" : "text-gray-900"}
            subtitle={pendingLeaves.length > 0 ? tc("needsAttention") : tc("allClear")}
          />
          <StatCard
            label={t("approvedThisMonth")}
            value={approvedThisMonth}
            color="text-green-600"
          />
          <StatCard
            label={t("rejectedThisMonth")}
            value={rejectedThisMonth}
            color={rejectedThisMonth > 0 ? "text-red-600" : "text-gray-900"}
          />
        </div>
      )}

      {/* Pending Approval Queue (admin/hr/manager) */}
      {canApprove && (
        <PendingApprovalQueue
          pendingLeaves={pendingLeaves}
          onApprove={handleApprove}
          t={t}
          tc={tc}
        />
      )}

      {/* Leave Balance (all roles) */}
      <LeaveBalanceSection balance={balance} t={t} />

      {/* Leave Calendar */}
      <LeaveCalendar
        leaves={leaves}
        calMonth={calMonth}
        calYear={calYear}
        onPrev={prevMonth}
        onNext={nextMonth}
        t={t}
      />

      {/* Status Filter + Leave Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <StatusFilterTabs
            active={statusFilter}
            onChange={setStatusFilter}
            counts={statusCounts}
          />
        </div>

        {filteredLeaves.length === 0 ? (
          <div className="bg-white rounded-lg shadow">
            <EmptyState
              title={t("noLeaveRecords")}
              description={
                statusFilter !== "All"
                  ? t("noFilteredRecords", { status: statusFilter.toLowerCase() })
                  : t("noLeaveRequestsYet")
              }
              action={
                !showForm
                  ? { label: t("requestLeave"), onClick: () => setShowForm(true) }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {canApprove && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {t("employeeCol")}
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("typeCol")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("periodCol")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("daysCol")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("reasonCol")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("statusCol")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t("actionsCol")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeaves.map((leave, idx) => {
                  const from = String(leave.from_date || "");
                  const to = String(leave.to_date || "");
                  const period =
                    from === to
                      ? formatDateFull(from)
                      : `${formatDate(from)} - ${formatDate(to)}`;

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      {canApprove && (
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {String(leave.employee_name || "")}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${getLeaveColor(
                              String(leave.leave_type || "")
                            )}`}
                          />
                          {String(leave.leave_type)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {period}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {String(leave.total_leave_days || leave.total_days || "")}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px]">
                        {leave.description ? (
                          <span
                            className="truncate block"
                            title={String(leave.description)}
                          >
                            {String(leave.description)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge variant={statusVariant(String(leave.status))}>
                          {String(leave.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {leave.status === "Open" && (
                          <div className="flex items-center gap-2">
                            {canApprove && (
                              <>
                                <button
                                  onClick={() =>
                                    handleApprove(String(leave.name), "Approved")
                                  }
                                  className="text-green-600 hover:text-green-800 text-xs font-medium"
                                >
                                  {tc("approve")}
                                </button>
                                <button
                                  onClick={() =>
                                    handleApprove(String(leave.name), "Rejected")
                                  }
                                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                                >
                                  {tc("reject")}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleCancel(String(leave.name))}
                              className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                            >
                              {tc("cancel")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
