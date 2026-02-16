"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMyAttendance,
  submitAttendanceRequest,
  getAttendanceRequests,
  approveAttendanceRequest,
  checkin,
  checkout,
  getTodayCheckin,
  getCheckinHistory,
} from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "@/lib/i18n";

// ── Types ────────────────────────────────────────────────────

interface AttendanceSummary {
  total_days: number;
  present: number;
  absent: number;
  on_leave: number;
}

interface TodayCheckinData {
  checkins: Array<{ time: string; log_type: string }>;
  first_in: string | null;
  last_out: string | null;
  working_hours: number;
  is_checked_in: boolean;
}

interface HistoryDay {
  date: string;
  first_in: string | null;
  last_out: string | null;
  working_hours: number;
  checkin_count: number;
  checkins: Array<{ time: string; log_type: string }>;
}

// ── Helpers ──────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatHours(h: number): string {
  if (h <= 0) return "--";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getMonthRange(year: number, month: number) {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const last = new Date(year, month + 1, 0);
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { from, to };
}

// ── Today's Check-in Card ────────────────────────────────────

function TodayCard({
  data,
  onCheckin,
  onCheckout,
  loading,
  t,
}: {
  data: TodayCheckinData | null;
  onCheckin: () => void;
  onCheckout: () => void;
  loading: boolean;
  t: (key: string) => string;
}) {
  const [elapsed, setElapsed] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (data?.is_checked_in && data.first_in) {
      const updateElapsed = () => {
        const firstIn = new Date(data.first_in!);
        const now = new Date();
        let totalSec = Math.floor((now.getTime() - firstIn.getTime()) / 1000);
        if (totalSec < 0) totalSec = 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        setElapsed(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        );
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsed("");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data?.is_checked_in, data?.first_in]);

  const hasCheckedOut =
    data && !data.is_checked_in && data.checkins.length > 0 && data.last_out;
  const notCheckedIn =
    !data || (data.checkins.length === 0 && !data.is_checked_in);

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">{t("today")}</h2>

      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Timer / Status circle */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <div
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-4 ${
              data?.is_checked_in
                ? "border-green-400 bg-green-50"
                : hasCheckedOut
                  ? "border-gray-300 bg-gray-50"
                  : "border-blue-300 bg-blue-50"
            }`}
          >
            {data?.is_checked_in ? (
              <>
                <span className="text-2xl font-mono font-bold text-green-700">{elapsed}</span>
                <span className="text-xs text-green-600 mt-1">{t("working")}</span>
              </>
            ) : hasCheckedOut ? (
              <>
                <span className="text-2xl font-bold text-gray-700">
                  {formatHours(data!.working_hours)}
                </span>
                <span className="text-xs text-gray-500 mt-1">{t("doneForToday")}</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-blue-700">--:--</span>
                <span className="text-xs text-blue-600 mt-1">{t("notCheckedIn")}</span>
              </>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">{t("checkin")}</p>
              <p className="text-sm font-medium text-gray-900">{formatTime(data?.first_in ?? null)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("checkout")}</p>
              <p className="text-sm font-medium text-gray-900">{formatTime(data?.last_out ?? null)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("workingHours")}</p>
              <p className="text-sm font-medium text-gray-900">
                {data ? formatHours(data.working_hours) : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("statusLabel")}</p>
              <p className="text-sm font-medium">
                {data?.is_checked_in ? (
                  <span className="text-green-600">{t("checkedIn")}</span>
                ) : hasCheckedOut ? (
                  <span className="text-gray-600">{t("checkedOut")}</span>
                ) : (
                  <span className="text-blue-600">{t("notCheckedInStatus")}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex-shrink-0">
          {notCheckedIn ? (
            <button
              onClick={onCheckin}
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {loading ? t("checkingIn") : t("checkInButton")}
            </button>
          ) : data?.is_checked_in ? (
            <button
              onClick={onCheckout}
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {loading ? t("checkingOut") : t("checkOutButton")}
            </button>
          ) : (
            <button
              disabled
              className="w-full md:w-auto px-8 py-3 bg-gray-200 text-gray-500 rounded-lg font-medium text-sm cursor-not-allowed"
            >
              {t("checkedOutButton")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Summary Cards ────────────────────────────────────────────

function SummaryCards({ summary, t }: { summary: AttendanceSummary | null; t: (key: string) => string }) {
  if (!summary) return null;

  const cards = [
    { label: t("totalDays"), value: summary.total_days, color: "text-gray-900" },
    { label: t("present"), value: summary.present, color: "text-green-600" },
    { label: t("absent"), value: summary.absent, color: "text-red-600" },
    { label: t("onLeave"), value: summary.on_leave, color: "text-yellow-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Check-in History ─────────────────────────────────────────

function CheckinHistorySection() {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(() => {
    setLoading(true);
    const { from, to } = getMonthRange(year, month);
    getCheckinHistory(from, to)
      .then((res) => setDays(res.data?.days || []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{t("checkinHistory")}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">{tc("loading")}</div>
        ) : days.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            {t("noCheckinRecords", { month: monthLabel(year, month) })}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("dateCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("inCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("outCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("hoursCol")}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t("logsCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {days.map((day) => (
                <tr key={day.date} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {formatDateLabel(day.date)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {formatTime(day.first_in)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {formatTime(day.last_out)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {formatHours(day.working_hours)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {day.checkin_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useTranslations("attendance");
  const tc = useTranslations("common");

  const [todayData, setTodayData] = useState<TodayCheckinData | null>(null);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Correction request form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ attendance_date: "", reason: "", status: "Present" });
  const [submitting, setSubmitting] = useState(false);

  const canApprove =
    user?.role === "admin" || user?.role === "hr" || user?.role === "manager";

  const fetchAll = useCallback(() => {
    setPageLoading(true);
    Promise.all([
      getTodayCheckin().catch(() => ({ data: null })),
      getMyAttendance().catch(() => ({ data: null })),
      getAttendanceRequests().catch(() => ({ data: [] })),
    ])
      .then(([todayRes, attRes, reqRes]) => {
        setTodayData(todayRes.data as TodayCheckinData | null);
        const attData = attRes.data as unknown as { summary?: AttendanceSummary } | null;
        setSummary(attData?.summary ?? null);
        setRequests(reqRes.data || []);
      })
      .finally(() => setPageLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleCheckin() {
    setActionLoading(true);
    try {
      await checkin();
      toast(t("checkedInSuccess"), "success");
      // Refresh today's data
      const res = await getTodayCheckin().catch(() => ({ data: null }));
      setTodayData(res.data as TodayCheckinData | null);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("failedCheckIn"), "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckout() {
    setActionLoading(true);
    try {
      await checkout();
      toast(t("checkedOutSuccess"), "success");
      const res = await getTodayCheckin().catch(() => ({ data: null }));
      setTodayData(res.data as TodayCheckinData | null);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("failedCheckOut"), "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitAttendanceRequest(form);
      setShowForm(false);
      setForm({ attendance_date: "", reason: "", status: "Present" });
      toast(t("correctionSubmitted"), "success");
      fetchAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("failedSubmit"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveRequest(id: string, action: "approve" | "reject") {
    try {
      await approveAttendanceRequest(id, action);
      toast(t("requestApproved", { action }), "success");
      fetchAll();
    } catch {
      toast(t("failedAction", { action }), "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? tc("cancel") : t("requestCorrection")}
        </button>
      </div>

      {pageLoading && <p className="text-gray-500 mb-6">{tc("loading")}</p>}

      {/* Today's Check-in Card */}
      {!pageLoading && (
        <TodayCard
          data={todayData}
          onCheckin={handleCheckin}
          onCheckout={handleCheckout}
          loading={actionLoading}
          t={t}
        />
      )}

      {/* Monthly Summary */}
      <SummaryCards summary={summary} t={t} />

      {/* Check-in History */}
      <CheckinHistorySection />

      {/* Correction Request Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitRequest}
          className="bg-white rounded-lg shadow p-6 mb-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">{t("correctionRequest")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("dateLabel")}</label>
              <input
                type="date"
                value={form.attendance_date}
                onChange={(e) => setForm({ ...form, attendance_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("statusLabel")}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="Present">{t("presentOption")}</option>
                <option value="Work From Home">{t("wfhOption")}</option>
                <option value="Half Day">{t("halfDayOption")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("reasonLabel")}</label>
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
            {submitting ? t("submitting") : t("submitRequest")}
          </button>
        </form>
      )}

      {/* Attendance Requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("attendanceRequests")}</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {canApprove && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {tc("employee")}
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {tc("date")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {tc("reason")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {tc("status")}
                  </th>
                  {canApprove && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {tc("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((req, i) => (
                  <tr key={i}>
                    {canApprove && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {String(req.employee_name || "")}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {String(req.from_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {String(req.reason || "")}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={statusVariant(String(req.status))}>
                        {String(req.status)}
                      </Badge>
                    </td>
                    {canApprove && (
                      <td className="px-6 py-4 text-sm space-x-2">
                        {req.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleApproveRequest(String(req.name), "approve")}
                              className="text-green-600 hover:text-green-800 text-xs font-medium"
                            >
                              {tc("approve")}
                            </button>
                            <button
                              onClick={() => handleApproveRequest(String(req.name), "reject")}
                              className="text-red-600 hover:text-red-800 text-xs font-medium"
                            >
                              {tc("reject")}
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
    </div>
  );
}
