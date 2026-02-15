"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getEmployees,
  getLeaves,
  getLeaveBalance,
  getMyAttendance,
  getAttendanceRequests,
  getTodayCheckin,
  checkin as apiCheckin,
  checkout as apiCheckout,
  getPayrollSlips,
  getMyShift,
} from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

// ── Helpers ──────────────────────────────────────────────────

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item) || "Unassigned";
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function today() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Shared Components ────────────────────────────────────────

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
  onClick,
}: {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-5 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  max,
  color = "bg-blue-500",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-28 truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 w-8 text-right">{value}</span>
    </div>
  );
}

function QuickAction({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700"
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
          <div className="h-8 bg-gray-200 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Donut Ring (CSS conic-gradient) ──────────────────────────

function DonutRing({
  segments,
  centerLabel,
  centerValue,
  size = 160,
}: {
  segments: { value: number; color: string; label: string }[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{ width: size, height: size, background: "#f3f4f6" }}
      >
        <div className="text-center">
          <p className="text-sm text-gray-400">No data</p>
        </div>
      </div>
    );
  }

  let cumulative = 0;
  const gradientParts: string[] = [];
  for (const seg of segments) {
    const start = (cumulative / total) * 360;
    cumulative += seg.value;
    const end = (cumulative / total) * 360;
    gradientParts.push(`${seg.color} ${start}deg ${end}deg`);
  }

  const thickness = 20;
  const innerSize = size - thickness * 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradientParts.join(", ")})`,
        }}
      />
      <div
        className="absolute bg-white rounded-full flex items-center justify-center"
        style={{
          width: innerSize,
          height: innerSize,
          top: thickness,
          left: thickness,
        }}
      >
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{centerValue}</p>
          <p className="text-xs text-gray-500">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

function DonutLegend({
  segments,
}: {
  segments: { value: number; color: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      {segments.map((seg) => (
        <div key={seg.label} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: seg.color }}
          />
          <span className="text-gray-600">{seg.label}</span>
          <span className="font-medium text-gray-900 ml-auto">{seg.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────

interface AdminData {
  employees: Array<Record<string, string>>;
  leaves: Array<Record<string, unknown>>;
  attendanceRequests: Array<Record<string, unknown>>;
  payrollSlips: Array<Record<string, unknown>>;
}

function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getEmployees().catch(() => ({ data: [] })),
      getLeaves().catch(() => ({ data: [] })),
      getAttendanceRequests().catch(() => ({ data: [] })),
      getPayrollSlips(new Date().getFullYear(), new Date().getMonth() + 1).catch(() => ({ data: [] })),
    ]).then(([empRes, leaveRes, attReqRes, payrollRes]) => {
      setData({
        employees: empRes.data || [],
        leaves: leaveRes.data || [],
        attendanceRequests: attReqRes.data || [],
        payrollSlips: payrollRes.data || [],
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <SkeletonCards count={5} />;
  if (!data) return null;

  const { employees, leaves, attendanceRequests, payrollSlips } = data;

  // Stat calculations
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "Active").length;
  const pendingLeaves = leaves.filter((l) => l.status === "Open").length;
  const pendingAttReqs = attendanceRequests.filter((r) => r.status === "Pending").length;
  const attendanceRate =
    totalEmployees > 0
      ? Math.round((activeEmployees / totalEmployees) * 100)
      : 0;

  // Payroll stats
  const payrollDraft = payrollSlips.filter((s) => s.status === "Draft").length;
  const payrollSubmitted = payrollSlips.filter((s) => s.status === "Submitted").length;
  const payrollTotal = payrollSlips.length;
  const payrollStatus = payrollTotal === 0 ? "Not run" : payrollDraft > 0 ? `${payrollDraft} draft` : "Completed";

  // Department breakdown
  const deptCounts = countBy(employees, (e) => e.department);
  const deptEntries = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
  const maxDeptCount = deptEntries.length > 0 ? deptEntries[0][1] : 0;

  // Leave type distribution
  const leaveTypeCounts = countBy(
    leaves as Array<Record<string, string>>,
    (l) => l.leave_type
  );
  const leaveTypeEntries = Object.entries(leaveTypeCounts).sort((a, b) => b[1] - a[1]);
  const maxLeaveTypeCount = leaveTypeEntries.length > 0 ? leaveTypeEntries[0][1] : 0;

  // Pending leaves for approval queue
  const pendingLeaveList = leaves
    .filter((l) => l.status === "Open")
    .slice(0, 5);

  // Recent activity (merge leaves + attendance requests, sort by date)
  const activities: Array<{
    type: string;
    text: string;
    date: string;
    status: string;
  }> = [];

  for (const l of leaves.slice(0, 20)) {
    const status = String(l.status);
    const name = String(l.employee_name || "Someone");
    const leaveType = String(l.leave_type || "Leave");
    const from = formatDate(String(l.from_date || ""));
    const to = formatDate(String(l.to_date || ""));
    const dateRange = from === to ? from : `${from} - ${to}`;

    let text = "";
    if (status === "Open") text = `${name} requested ${leaveType} (${dateRange})`;
    else if (status === "Approved") text = `${name}'s ${leaveType} approved (${dateRange})`;
    else if (status === "Rejected") text = `${name}'s ${leaveType} rejected (${dateRange})`;
    else if (status === "Cancelled") text = `${name}'s ${leaveType} cancelled`;
    else text = `${name} — ${leaveType} ${status}`;

    activities.push({
      type: "leave",
      text,
      date: String(l.from_date || ""),
      status,
    });
  }

  for (const r of attendanceRequests.slice(0, 10)) {
    const status = String(r.status);
    const name = String(r.employee_name || "Someone");
    const date = formatDate(String(r.from_date || ""));

    activities.push({
      type: "attendance",
      text:
        status === "Pending"
          ? `${name} requested attendance correction (${date})`
          : `${name}'s attendance request ${status.toLowerCase()} (${date})`,
      date: String(r.from_date || ""),
      status,
    });
  }

  activities.sort((a, b) => (b.date > a.date ? 1 : -1));
  const recentActivities = activities.slice(0, 8);

  const activityIconColor = (type: string, status: string) => {
    if (status === "Approved") return "text-green-500";
    if (status === "Rejected") return "text-red-500";
    if (status === "Cancelled") return "text-gray-400";
    if (type === "attendance") return "text-blue-500";
    return "text-yellow-500";
  };

  // Colors for departments
  const deptColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];

  // Colors for leave types
  const leaveTypeColors = [
    "bg-blue-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Employees"
          value={totalEmployees}
          color="text-blue-600"
          onClick={() => router.push("/employees")}
        />
        <StatCard
          label="Active Employees"
          value={activeEmployees}
          color="text-green-600"
          subtitle={totalEmployees > 0 ? `${Math.round((activeEmployees / totalEmployees) * 100)}% of total` : undefined}
          onClick={() => router.push("/employees")}
        />
        <StatCard
          label="Pending Leave"
          value={pendingLeaves}
          color={pendingLeaves > 0 ? "text-orange-600" : "text-gray-900"}
          subtitle={pendingLeaves > 0 ? "Awaiting approval" : "All clear"}
          onClick={() => router.push("/leave")}
        />
        <StatCard
          label="Attendance Requests"
          value={pendingAttReqs}
          color={pendingAttReqs > 0 ? "text-orange-600" : "text-gray-900"}
          subtitle={pendingAttReqs > 0 ? "Pending review" : "All clear"}
          onClick={() => router.push("/attendance")}
        />
        <StatCard
          label="Payroll"
          value={payrollStatus}
          color={payrollDraft > 0 ? "text-orange-600" : payrollSubmitted > 0 ? "text-green-600" : "text-gray-500"}
          subtitle={payrollTotal > 0 ? `${payrollSubmitted} submitted` : "This month"}
          onClick={() => router.push("/payroll")}
        />
      </div>

      {/* Department Breakdown + Leave Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <SectionCard
          title="Department Breakdown"
          action={
            <button
              onClick={() => router.push("/employees")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </button>
          }
        >
          {deptEntries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No department data available
            </p>
          ) : (
            <div className="space-y-3">
              {deptEntries.map(([dept, count], i) => (
                <HorizontalBar
                  key={dept}
                  label={dept}
                  value={count}
                  max={maxDeptCount}
                  color={deptColors[i % deptColors.length]}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Leave Overview */}
        <SectionCard
          title="Leave Overview"
          action={
            <button
              onClick={() => router.push("/leave")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Manage
            </button>
          }
        >
          {leaves.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No leave records
            </p>
          ) : (
            <div className="space-y-5">
              {/* Leave type distribution */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  By Type
                </p>
                {leaveTypeEntries.map(([type, count], i) => (
                  <HorizontalBar
                    key={type}
                    label={type}
                    value={count}
                    max={maxLeaveTypeCount}
                    color={leaveTypeColors[i % leaveTypeColors.length]}
                  />
                ))}
              </div>

              {/* Pending approvals */}
              {pendingLeaveList.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Pending Approvals ({pendingLeaves})
                  </p>
                  <div className="space-y-2">
                    {pendingLeaveList.map((l, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg"
                      >
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">
                            {String(l.employee_name || "")}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {String(l.leave_type || "")}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(String(l.from_date || ""))} -{" "}
                          {formatDate(String(l.to_date || ""))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <SectionCard title="Recent Activity">
        {recentActivities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No recent activity
          </p>
        ) : (
          <div className="space-y-1">
            {recentActivities.map((activity, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50"
              >
                <div className={`mt-0.5 flex-shrink-0 ${activityIconColor(activity.type, activity.status)}`}>
                  {activity.type === "attendance" ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : activity.status === "Approved" ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : activity.status === "Rejected" ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{activity.text}</p>
                </div>
                <Badge variant={statusVariant(activity.status)}>
                  {activity.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction label="View Employees" href="/employees" icon="👥" />
        <QuickAction label="Manage Leave" href="/leave" icon="📋" />
        <QuickAction label="Attendance" href="/attendance" icon="📊" />
        <QuickAction label="Shifts" href="/shifts" icon="🕐" />
        <QuickAction label="Payroll" href="/payroll" icon="💰" />
        <QuickAction label="Manage Users" href="/settings" icon="⚙️" />
      </div>
    </div>
  );
}

// ── Employee Dashboard ───────────────────────────────────────

interface TodayCheckin {
  checkins: Array<{ time: string; log_type: string }>;
  first_in: string | null;
  last_out: string | null;
  working_hours: number;
  is_checked_in: boolean;
}

interface EmployeeData {
  leaveBalance: Array<Record<string, unknown>>;
  attendanceSummary: { present: number; absent: number; on_leave: number; total_days: number } | null;
  myLeaves: Array<Record<string, unknown>>;
  todayCheckin: TodayCheckin | null;
  latestPayslip: { gross_pay: number; total_deduction: number; net_pay: number; start_date: string; status: string } | null;
  myShift: { has_shift: boolean; shift_type?: string; start_time?: string; end_time?: string } | null;
}

function EmployeeDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);

  function fetchData() {
    Promise.all([
      getLeaveBalance().catch(() => ({ data: [] })),
      getMyAttendance().catch(() => ({ data: null })),
      getLeaves().catch(() => ({ data: [] })),
      getTodayCheckin().catch(() => ({ data: null })),
      getPayrollSlips(new Date().getFullYear()).catch(() => ({ data: [] })),
      getMyShift().catch(() => ({ data: null })),
    ]).then(([balanceRes, attRes, leavesRes, checkinRes, payrollRes, shiftRes]) => {
      const attData = attRes.data as unknown as {
        summary?: { present: number; absent: number; on_leave: number; total_days: number };
      } | null;

      const slips = (payrollRes.data || []) as Array<Record<string, unknown>>;
      const latest = slips.length > 0 ? slips[0] as unknown as { gross_pay: number; total_deduction: number; net_pay: number; start_date: string; status: string } : null;

      setData({
        leaveBalance: balanceRes.data || [],
        attendanceSummary: attData?.summary || null,
        myLeaves: (leavesRes.data || []).slice(0, 5),
        todayCheckin: checkinRes.data as TodayCheckin | null,
        latestPayslip: latest,
        myShift: shiftRes.data as { has_shift: boolean; shift_type?: string; start_time?: string; end_time?: string } | null,
      });
      setLoading(false);
    });
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCheckin() {
    setCheckinLoading(true);
    try {
      await apiCheckin();
      toast("Checked in successfully", "success");
      const res = await getTodayCheckin().catch(() => ({ data: null }));
      setData((prev) => prev ? { ...prev, todayCheckin: res.data as TodayCheckin | null } : prev);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to check in", "error");
    } finally {
      setCheckinLoading(false);
    }
  }

  async function handleCheckout() {
    setCheckinLoading(true);
    try {
      await apiCheckout();
      toast("Checked out successfully", "success");
      const res = await getTodayCheckin().catch(() => ({ data: null }));
      setData((prev) => prev ? { ...prev, todayCheckin: res.data as TodayCheckin | null } : prev);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to check out", "error");
    } finally {
      setCheckinLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { attendanceSummary, leaveBalance, myLeaves, todayCheckin, latestPayslip, myShift } = data;

  // Attendance segments for donut
  const attSegments = attendanceSummary
    ? [
        { value: attendanceSummary.present, color: "#22c55e", label: "Present" },
        { value: attendanceSummary.absent, color: "#ef4444", label: "Absent" },
        { value: attendanceSummary.on_leave, color: "#eab308", label: "On Leave" },
      ]
    : [];
  const attTotal = attendanceSummary?.total_days || 0;
  const attPresentPct = attTotal > 0 ? Math.round((attendanceSummary!.present / attTotal) * 100) : 0;

  // Leave balance bar colors
  const balanceColors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];

  // Check-in helpers
  const notCheckedIn = !todayCheckin || (todayCheckin.checkins.length === 0 && !todayCheckin.is_checked_in);
  const hasCheckedOut = todayCheckin && !todayCheckin.is_checked_in && todayCheckin.checkins.length > 0 && todayCheckin.last_out;

  function formatCheckinTime(iso: string | null): string {
    if (!iso) return "--:--";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function formatCheckinHours(h: number): string {
    if (h <= 0) return "--";
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  // Shift time formatter
  function formatShiftTime(t: string | undefined): string {
    if (!t) return "--:--";
    const parts = t.split(":");
    const h = parseInt(parts[0]);
    const m = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${ampm}`;
  }

  return (
    <div className="space-y-6">
      {/* My Shift Card */}
      {myShift?.has_shift && (
        <SectionCard
          title="My Shift"
          action={
            <button
              onClick={() => router.push("/shifts")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View details
            </button>
          }
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{myShift.shift_type}</p>
              <p className="text-xs text-gray-500">
                {formatShiftTime(myShift.start_time)} - {formatShiftTime(myShift.end_time)}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Quick Check-in Card */}
      <SectionCard
        title="Today's Check-in"
        action={
          <button
            onClick={() => router.push("/attendance")}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View details
          </button>
        }
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              todayCheckin?.is_checked_in ? "bg-green-100" : hasCheckedOut ? "bg-gray-100" : "bg-blue-100"
            }`}>
              <svg className={`w-6 h-6 ${
                todayCheckin?.is_checked_in ? "text-green-600" : hasCheckedOut ? "text-gray-500" : "text-blue-600"
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {todayCheckin?.is_checked_in
                  ? `Working since ${formatCheckinTime(todayCheckin.first_in)}`
                  : hasCheckedOut
                    ? `Done - ${formatCheckinHours(todayCheckin!.working_hours)} today`
                    : "Not checked in yet"}
              </p>
              <p className="text-xs text-gray-500">
                {todayCheckin?.is_checked_in
                  ? `${formatCheckinHours(todayCheckin.working_hours)} elapsed`
                  : hasCheckedOut
                    ? `${formatCheckinTime(todayCheckin!.first_in)} - ${formatCheckinTime(todayCheckin!.last_out)}`
                    : "Tap to start your day"}
              </p>
            </div>
          </div>
          <div>
            {notCheckedIn ? (
              <button
                onClick={handleCheckin}
                disabled={checkinLoading}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {checkinLoading ? "..." : "Check In"}
              </button>
            ) : todayCheckin?.is_checked_in ? (
              <button
                onClick={handleCheckout}
                disabled={checkinLoading}
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {checkinLoading ? "..." : "Check Out"}
              </button>
            ) : (
              <span className="text-sm text-gray-400 font-medium">Checked Out</span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Latest Payslip */}
      {latestPayslip && (
        <SectionCard
          title="Latest Payslip"
          action={
            <button
              onClick={() => router.push("/payroll")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all
            </button>
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  {(() => {
                    const d = new Date(latestPayslip.start_date + "T00:00:00");
                    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  })()}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat("th-TH").format(latestPayslip.net_pay)}
                </p>
                <p className="text-xs text-gray-400">Net Pay</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div>
                <span className="text-xs text-gray-500">Gross: </span>
                <span className="text-sm font-medium text-gray-700">
                  {new Intl.NumberFormat("th-TH").format(latestPayslip.gross_pay)}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Deductions: </span>
                <span className="text-sm font-medium text-red-600">
                  -{new Intl.NumberFormat("th-TH").format(latestPayslip.total_deduction)}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Attendance Ring + Leave Balance side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Attendance */}
        <SectionCard
          title="My Attendance"
          action={
            <button
              onClick={() => router.push("/attendance")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View details
            </button>
          }
        >
          {!attendanceSummary ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No attendance data for this month
            </p>
          ) : (
            <div className="flex items-center gap-8">
              <DonutRing
                segments={attSegments}
                centerLabel="Present"
                centerValue={`${attPresentPct}%`}
              />
              <DonutLegend segments={attSegments} />
            </div>
          )}
        </SectionCard>

        {/* Leave Balance */}
        <SectionCard
          title="Leave Balance"
          action={
            <button
              onClick={() => router.push("/leave")}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Request leave
            </button>
          }
        >
          {leaveBalance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No leave allocations found
            </p>
          ) : (
            <div className="space-y-4">
              {leaveBalance.map((b, i) => {
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
                        <span className="text-sm font-bold text-gray-900">
                          {remaining}
                        </span>
                        <span className="text-xs text-gray-400">/ {total} days</span>
                        {isLow && (
                          <span className="text-xs text-amber-600 font-medium">Low</span>
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
                    <p className="text-xs text-gray-400 mt-0.5">
                      Used: {used} days
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* My Recent Leaves */}
      <SectionCard
        title="My Recent Leaves"
        action={
          <button
            onClick={() => router.push("/leave")}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View all
          </button>
        }
      >
        {myLeaves.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No leave requests yet
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {myLeaves.map((leave, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {String(leave.leave_type || "")}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(String(leave.from_date || ""))}
                      {leave.from_date !== leave.to_date &&
                        ` - ${formatDate(String(leave.to_date || ""))}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {String(leave.total_leave_days || leave.total_days || "1")}d
                  </span>
                  <Badge variant={statusVariant(String(leave.status))}>
                    {String(leave.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction label="Request Leave" href="/leave" icon="📋" />
        <QuickAction label="My Attendance" href="/attendance" icon="📊" />
        <QuickAction label="My Payslips" href="/payroll" icon="💰" />
        <QuickAction label="My Profile" href="/profile" icon="👤" />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const isAdminOrHR =
    user.role === "admin" || user.role === "hr" || user.role === "manager";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back,{" "}
            <span className="font-medium text-gray-700">{user.full_name}</span>
          </p>
        </div>
        <p className="text-sm text-gray-400 hidden md:block">{today()}</p>
      </div>

      {isAdminOrHR ? <AdminDashboard /> : <EmployeeDashboard />}
    </div>
  );
}
