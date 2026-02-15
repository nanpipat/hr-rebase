"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getShiftTypes,
  createShiftType,
  getShiftAssignments,
  assignShift,
  unassignShift,
  getShiftRequests,
  createShiftRequest,
  approveShiftRequest,
  getMyShift,
  getEmployees,
  processAutoAttendance,
} from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

// ── Types ────────────────────────────────────────────────────

interface ShiftType {
  name: string;
  start_time: string;
  end_time: string;
  late_entry_grace_period: number;
  early_exit_grace_period: number;
}

interface ShiftAssignment {
  name: string;
  employee: string;
  employee_name: string;
  shift_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

interface ShiftRequest {
  name: string;
  employee: string;
  employee_name: string;
  shift_type: string;
  from_date: string;
  to_date: string;
  status: string;
}

interface MyShiftData {
  has_shift: boolean;
  shift_type?: string;
  start_time?: string;
  end_time?: string;
  assignment_start?: string;
  assignment_end?: string | null;
}

interface AutoAttendanceResult {
  date: string;
  processed_count: number;
  skipped_count: number;
  error_count: number;
  late_count: number;
  early_exit_count: number;
  created: Array<Record<string, unknown>>;
  skipped: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
}

// ── Helpers ──────────────────────────────────────────────────

function formatTime(t: string): string {
  if (!t) return "--:--";
  const parts = t.split(":");
  const h = parseInt(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: string): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SHIFT_COLORS: Record<string, string> = {
  "Day Shift": "bg-blue-100 text-blue-800",
  "Evening Shift": "bg-amber-100 text-amber-800",
  "Night Shift": "bg-purple-100 text-purple-800",
};

function shiftBadgeClass(name: string): string {
  return SHIFT_COLORS[name] || "bg-gray-100 text-gray-800";
}

// ── Shared UI ────────────────────────────────────────────────

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

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Admin: Shift Type Form ────────────────────────────────────

function CreateShiftTypeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { name: string; start_time: string; end_time: string; late_entry_grace_period: number; early_exit_grace_period: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    start_time: "08:00",
    end_time: "17:00",
    late_entry_grace_period: 15,
    early_exit_grace_period: 15,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        start_time: form.start_time + ":00",
        end_time: form.end_time + ":00",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">New Shift Type</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Late Grace (min)</label>
          <input
            type="number"
            value={form.late_entry_grace_period}
            onChange={(e) => setForm({ ...form, late_entry_grace_period: parseInt(e.target.value) || 0 })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            min={0}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Early Grace (min)</label>
          <input
            type="number"
            value={form.early_exit_grace_period}
            onChange={(e) => setForm({ ...form, early_exit_grace_period: parseInt(e.target.value) || 0 })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            min={0}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Admin: Assign Shift Form ──────────────────────────────────

function AssignShiftForm({
  shiftTypes,
  employees,
  onSubmit,
  onCancel,
}: {
  shiftTypes: ShiftType[];
  employees: Array<{ employee_id: string; employee_name: string }>;
  onSubmit: (data: { employee_id: string; shift_type: string; start_date: string; end_date?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    employee_id: "",
    shift_type: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        employee_id: form.employee_id,
        shift_type: form.shift_type,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Assign Shift</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
          <select
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          >
            <option value="">Select...</option>
            {employees.map((emp) => (
              <option key={emp.employee_id} value={emp.employee_id}>
                {emp.employee_name} ({emp.employee_id})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shift Type</label>
          <select
            value={form.shift_type}
            onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          >
            <option value="">Select...</option>
            {shiftTypes.map((st) => (
              <option key={st.name} value={st.name}>
                {st.name} ({formatTime(st.start_time)} - {formatTime(st.end_time)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End Date (optional)</label>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Assigning..." : "Assign"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Admin: Auto Attendance Section ──────────────────────────

function AutoAttendanceSection() {
  const { toast } = useToast();
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AutoAttendanceResult | null>(null);

  async function handleProcess() {
    setProcessing(true);
    try {
      const res = await processAutoAttendance({ date });
      setResult(res.data);
      toast(
        `Processed ${res.data.processed_count} attendance records (${res.data.late_count} late, ${res.data.early_exit_count} early exit)`,
        "success"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to process auto attendance", "error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SectionCard title="Auto Attendance">
      <div className="space-y-4">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleProcess}
            disabled={processing}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
          >
            {processing ? "Processing..." : "Process Attendance"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Generates Attendance records from check-in data matched against shift assignments for the selected date.
        </p>

        {result && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="text-lg font-bold text-green-700">{result.processed_count}</p>
                <p className="text-xs text-green-600">Processed</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-lg font-bold text-gray-700">{result.skipped_count}</p>
                <p className="text-xs text-gray-600">Skipped</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded">
                <p className="text-lg font-bold text-orange-700">{result.late_count}</p>
                <p className="text-xs text-orange-600">Late</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <p className="text-lg font-bold text-red-700">{result.error_count}</p>
                <p className="text-xs text-red-600">Errors</p>
              </div>
            </div>

            {result.created.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Created:</p>
                <div className="text-xs text-gray-600 space-y-0.5">
                  {result.created.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span>{c.employee_name as string}</span>
                      <Badge variant={statusVariant(c.status as string)}>{c.status as string}</Badge>
                      {Boolean(c.late_entry) && <span className="text-orange-600">Late</span>}
                      {Boolean(c.early_exit) && <span className="text-orange-600">Early Exit</span>}
                      <span className="text-gray-400">{c.working_hours as number}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Roster View ──────────────────────────────────────────────

function RosterView({ assignments }: { assignments: ShiftAssignment[] }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [weekOffset]);

  // Group assignments by employee
  const employeeShifts = useMemo(() => {
    const map = new Map<string, { name: string; shifts: Map<string, string> }>();

    for (const a of assignments) {
      if (!map.has(a.employee)) {
        map.set(a.employee, { name: a.employee_name, shifts: new Map() });
      }
      const entry = map.get(a.employee)!;
      // Mark each date in the week that falls within the assignment range
      for (const date of weekDates) {
        if (date >= a.start_date && (!a.end_date || date <= a.end_date)) {
          entry.shifts.set(date, a.shift_type);
        }
      }
    }

    return Array.from(map.entries()).map(([id, data]) => ({
      employeeId: id,
      employeeName: data.name,
      shifts: data.shifts,
    }));
  }, [assignments, weekDates]);

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <SectionCard
      title="Shift Roster"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            &larr;
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            This Week
          </button>
          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            &rarr;
          </button>
        </div>
      }
    >
      {employeeShifts.length === 0 ? (
        <EmptyState title="No shift assignments" description="Assign shifts to employees to see the roster" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 pr-4 w-40">
                  Employee
                </th>
                {weekDates.map((date, i) => (
                  <th
                    key={date}
                    className={`text-center text-xs font-medium uppercase py-2 px-1 ${
                      date === todayStr ? "text-blue-600" : "text-gray-500"
                    }`}
                  >
                    <div>{dayNames[i]}</div>
                    <div className="text-[10px] font-normal">{date.slice(5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employeeShifts.map((emp) => (
                <tr key={emp.employeeId}>
                  <td className="text-sm text-gray-900 py-2 pr-4">{emp.employeeName}</td>
                  {weekDates.map((date) => {
                    const shift = emp.shifts.get(date);
                    return (
                      <td key={date} className="text-center py-2 px-1">
                        {shift ? (
                          <span
                            className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${shiftBadgeClass(
                              shift
                            )}`}
                          >
                            {shift.replace(" Shift", "")}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ── Admin View ──────────────────────────────────────────────

function AdminShiftView() {
  const { toast } = useToast();
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [employees, setEmployees] = useState<Array<{ employee_id: string; employee_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  function fetchData() {
    setLoading(true);
    Promise.all([
      getShiftTypes().catch(() => ({ data: [] })),
      getShiftAssignments().catch(() => ({ data: [] })),
      getShiftRequests().catch(() => ({ data: [] })),
      getEmployees().catch(() => ({ data: [] })),
    ])
      .then(([typesRes, assignRes, reqRes, empRes]) => {
        setShiftTypes((typesRes.data || []) as unknown as ShiftType[]);
        setAssignments((assignRes.data || []) as unknown as ShiftAssignment[]);
        setRequests((reqRes.data || []) as unknown as ShiftRequest[]);
        setEmployees(
          ((empRes.data || []) as Array<Record<string, string>>)
            .filter((e) => e.status === "Active")
            .map((e) => ({ employee_id: e.employee_id, employee_name: e.employee_name }))
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "Draft"),
    [requests]
  );

  async function handleCreateType(data: {
    name: string;
    start_time: string;
    end_time: string;
    late_entry_grace_period: number;
    early_exit_grace_period: number;
  }) {
    try {
      await createShiftType(data);
      toast("Shift type created", "success");
      setShowTypeForm(false);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create shift type", "error");
    }
  }

  async function handleAssign(data: {
    employee_id: string;
    shift_type: string;
    start_date: string;
    end_date?: string;
  }) {
    try {
      await assignShift(data);
      toast("Shift assigned", "success");
      setShowAssignForm(false);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to assign shift", "error");
    }
  }

  async function handleUnassign(id: string) {
    try {
      await unassignShift(id);
      toast("Shift unassigned", "success");
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to unassign shift", "error");
    }
  }

  async function handleApprove(id: string, action: "approve" | "reject") {
    try {
      await approveShiftRequest(id, action);
      toast(`Shift request ${action}d`, "success");
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : `Failed to ${action} request`, "error");
    }
  }

  if (loading) return <SkeletonCards count={3} />;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Shift Types" value={shiftTypes.length} color="text-blue-600" />
        <StatCard
          label="Active Assignments"
          value={assignments.length}
          color="text-green-600"
          subtitle={`${new Set(assignments.map((a) => a.employee)).size} employees`}
        />
        <StatCard
          label="Pending Requests"
          value={pendingRequests.length}
          color={pendingRequests.length > 0 ? "text-orange-600" : "text-gray-900"}
          subtitle={pendingRequests.length > 0 ? "Awaiting review" : "All clear"}
        />
      </div>

      {/* Forms */}
      {showTypeForm && (
        <CreateShiftTypeForm onSubmit={handleCreateType} onCancel={() => setShowTypeForm(false)} />
      )}
      {showAssignForm && (
        <AssignShiftForm
          shiftTypes={shiftTypes}
          employees={employees}
          onSubmit={handleAssign}
          onCancel={() => setShowAssignForm(false)}
        />
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <SectionCard title={`Pending Requests (${pendingRequests.length})`}>
          <div className="space-y-3">
            {pendingRequests.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.employee_name}</p>
                  <p className="text-xs text-gray-500">
                    Requesting <span className="font-medium">{r.shift_type}</span> from{" "}
                    {formatDate(r.from_date)} to {formatDate(r.to_date)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(r.name, "approve")}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApprove(r.name, "reject")}
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Shift Types */}
      <SectionCard
        title="Shift Types"
        action={
          !showTypeForm && (
            <button
              onClick={() => setShowTypeForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Type
            </button>
          )
        }
      >
        {shiftTypes.length === 0 ? (
          <EmptyState
            title="No shift types"
            description="Create shift types to get started"
            action={{ label: "Add Shift Type", onClick: () => setShowTypeForm(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Late Grace</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Early Grace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shiftTypes.map((st) => (
                  <tr key={st.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shiftBadgeClass(st.name)}`}>
                        {st.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTime(st.start_time)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTime(st.end_time)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{st.late_entry_grace_period} min</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{st.early_exit_grace_period} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Roster View */}
      <RosterView assignments={assignments} />

      {/* Current Assignments */}
      <SectionCard
        title="Shift Assignments"
        action={
          !showAssignForm && (
            <button
              onClick={() => setShowAssignForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Assign Shift
            </button>
          )
        }
      >
        {assignments.length === 0 ? (
          <EmptyState
            title="No assignments"
            description="Assign shifts to employees to manage their schedule"
            action={{ label: "Assign Shift", onClick: () => setShowAssignForm(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((a) => (
                  <tr key={a.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{a.employee_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shiftBadgeClass(a.shift_type)}`}>
                        {a.shift_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(a.start_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{a.end_date ? formatDate(a.end_date) : "Ongoing"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleUnassign(a.name)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Auto Attendance */}
      <AutoAttendanceSection />

      {/* All Requests */}
      {requests.length > 0 && (
        <SectionCard title="All Shift Requests">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((r) => (
                  <tr key={r.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{r.employee_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shiftBadgeClass(r.shift_type)}`}>
                        {r.shift_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(r.from_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(r.to_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Employee View ────────────────────────────────────────────

function EmployeeShiftView() {
  const { toast } = useToast();
  const [myShift, setMyShift] = useState<MyShiftData | null>(null);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [form, setForm] = useState({
    shift_type: "",
    from_date: new Date().toISOString().slice(0, 10),
    to_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function fetchData() {
    setLoading(true);
    Promise.all([
      getMyShift().catch(() => ({ data: { has_shift: false } })),
      getShiftTypes().catch(() => ({ data: [] })),
      getShiftRequests().catch(() => ({ data: [] })),
    ])
      .then(([myRes, typesRes, reqRes]) => {
        setMyShift(myRes.data as MyShiftData);
        setShiftTypes((typesRes.data || []) as unknown as ShiftType[]);
        setRequests((reqRes.data || []) as unknown as ShiftRequest[]);
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
      await createShiftRequest(form);
      toast("Shift request submitted", "success");
      setShowRequestForm(false);
      setForm({ shift_type: "", from_date: new Date().toISOString().slice(0, 10), to_date: "" });
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to submit request", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SkeletonCards count={2} />;

  return (
    <div className="space-y-6">
      {/* Current Shift */}
      <SectionCard title="My Current Shift">
        {myShift?.has_shift ? (
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{myShift.shift_type}</p>
              <p className="text-sm text-gray-500">
                {formatTime(myShift.start_time || "")} - {formatTime(myShift.end_time || "")}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatDate(myShift.assignment_start || "")}
                {myShift.assignment_end ? ` to ${formatDate(myShift.assignment_end)}` : " (ongoing)"}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState title="No shift assigned" description="You don't have a shift assignment yet" />
        )}
      </SectionCard>

      {/* Request Shift Change */}
      {showRequestForm ? (
        <form onSubmit={handleSubmitRequest} className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Request Shift Change</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shift Type</label>
              <select
                value={form.shift_type}
                onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                required
              >
                <option value="">Select...</option>
                {shiftTypes.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name} ({formatTime(st.start_time)} - {formatTime(st.end_time)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <button
            onClick={() => setShowRequestForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Request Shift Change
          </button>
        </div>
      )}

      {/* My Requests */}
      <SectionCard title="My Shift Requests">
        {requests.length === 0 ? (
          <EmptyState title="No requests" description="You haven't submitted any shift change requests" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((r) => (
                  <tr key={r.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shiftBadgeClass(r.shift_type)}`}>
                        {r.shift_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(r.from_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(r.to_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function ShiftsPage() {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === "admin" || user?.role === "hr";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdminOrHR ? "Shift Management" : "My Shifts"}
        </h1>
      </div>
      {isAdminOrHR ? <AdminShiftView /> : <EmployeeShiftView />}
    </div>
  );
}
