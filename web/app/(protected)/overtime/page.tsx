"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getOvertimeRequests,
  createOvertimeRequest,
  approveOvertimeRequest,
  cancelOvertimeRequest,
  getOvertimeConfig,
  updateOvertimeConfig,
} from "@/lib/api";
import Badge, { statusVariant } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "@/lib/i18n";

function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OvertimePage() {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const t = useTranslations();
  const isAdminOrHR = user?.role === "admin" || user?.role === "hr";
  const isManager = user?.role === "manager";

  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({});

  // Form state
  const [otDate, setOtDate] = useState("");
  const [otType, setOtType] = useState("weekday_ot");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await getOvertimeRequests();
      setRequests((res.data as Array<Record<string, unknown>>) || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createOvertimeRequest({
        ot_date: otDate,
        ot_type: otType,
        hours: parseFloat(hours),
        reason,
      });
      showToast(t("overtime.requestSubmitted"), "success");
      setShowForm(false);
      setOtDate("");
      setHours("");
      setReason("");
      fetchRequests();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("overtime.failedCreate"),
        "error",
      );
    }
    setSubmitting(false);
  };

  const handleApprove = async (id: string, action: "approve" | "reject") => {
    try {
      await approveOvertimeRequest(id, action);
      showToast(t("overtime.requestAction", { action }), "success");
      fetchRequests();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("overtime.failedAction"),
        "error",
      );
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelOvertimeRequest(id);
      showToast(t("overtime.requestCancelled"), "success");
      fetchRequests();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("overtime.failedCancel"),
        "error",
      );
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await getOvertimeConfig();
      setConfig(res.data || {});
      setShowConfig(true);
    } catch {
      /* ignore */
    }
  };

  const handleSaveConfig = async () => {
    try {
      await updateOvertimeConfig(config);
      showToast(t("overtime.configSaved"), "success");
      setShowConfig(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("overtime.failedSaveConfig"),
        "error",
      );
    }
  };

  const pending = requests.filter((r) => r.status === "Pending");
  const otTypeLabels: Record<string, string> = {
    weekday_ot: t("overtime.weekdayOT"),
    holiday_work: t("overtime.holidayWork"),
    holiday_ot: t("overtime.holidayOT"),
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isAdminOrHR || isManager
            ? t("overtime.managementTitle")
            : t("overtime.myTitle")}
        </h1>
        <div className="flex gap-2">
          {isAdminOrHR && (
            <button
              onClick={fetchConfig}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              {t("overtime.settings")}
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            {t("overtime.newRequest")}
          </button>
        </div>
      </div>

      {/* Pending Approvals for Admin/HR/Manager */}
      {(isAdminOrHR || isManager) && pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-yellow-800 mb-3">
            {t("overtime.pendingApprovals")} ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={String(r.name)}
                className="flex items-center justify-between bg-white p-3 rounded border"
              >
                <div>
                  <span className="font-medium text-sm">
                    {String(r.employee_name)}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {formatDate(String(r.ot_date))}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {otTypeLabels[String(r.ot_type)] || String(r.ot_type)}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {String(r.hours)}h
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(String(r.name), "approve")}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    {t("common.approve")}
                  </button>
                  <button
                    onClick={() => handleApprove(String(r.name), "reject")}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    {t("common.reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
          >
            <h2 className="text-lg font-semibold mb-4">
              {t("overtime.newRequest")}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("overtime.dateLabel")}
                </label>
                <input
                  type="date"
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("overtime.typeLabel")}
                </label>
                <select
                  value={otType}
                  onChange={(e) => setOtType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="weekday_ot">{t("overtime.weekdayOT")}</option>
                  <option value="holiday_work">
                    {t("overtime.holidayWork")}
                  </option>
                  <option value="holiday_ot">{t("overtime.holidayOT")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("overtime.hoursLabel")}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("common.reason")}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border rounded-lg"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t("common.loading") : t("common.submit")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">
              {t("overtime.settings")}
            </h2>
            <div className="space-y-3">
              {[
                { key: "weekday_ot_rate", label: t("overtime.weekdayOTRate") },
                {
                  key: "holiday_work_monthly",
                  label: t("overtime.holidayWorkMonthly"),
                },
                { key: "holiday_ot_rate", label: t("overtime.holidayOTRate") },
                {
                  key: "standard_hours_per_day",
                  label: t("overtime.stdHoursPerDay"),
                },
                {
                  key: "standard_working_days",
                  label: t("overtime.stdWorkingDays"),
                },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={String(config[key] || "")}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: parseFloat(e.target.value),
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-sm border rounded-lg"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          {t("common.loading")}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title={t("overtime.noRequests")}
          description={t("overtime.noRequestsDesc")}
        />
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {(isAdminOrHR || isManager) && (
                  <th className="px-4 py-3 text-left">
                    {t("common.employee")}
                  </th>
                )}
                <th className="px-4 py-3 text-left">{t("common.date")}</th>
                <th className="px-4 py-3 text-left">
                  {t("overtime.typeLabel")}
                </th>
                <th className="px-4 py-3 text-left">
                  {t("overtime.hoursLabel")}
                </th>
                <th className="px-4 py-3 text-left">{t("common.reason")}</th>
                <th className="px-4 py-3 text-left">{t("common.status")}</th>
                <th className="px-4 py-3 text-left">{t("overtime.amount")}</th>
                <th className="px-4 py-3 text-left">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => (
                <tr key={String(r.name)} className="hover:bg-gray-50">
                  {(isAdminOrHR || isManager) && (
                    <td className="px-4 py-3">{String(r.employee_name)}</td>
                  )}
                  <td className="px-4 py-3">{formatDate(String(r.ot_date))}</td>
                  <td className="px-4 py-3">
                    {otTypeLabels[String(r.ot_type)] || String(r.ot_type)}
                  </td>
                  <td className="px-4 py-3">{String(r.hours)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                    {String(r.reason || "")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(String(r.status))}>
                      {String(r.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {Number(r.amount) > 0
                      ? `฿${Number(r.amount).toLocaleString()}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "Pending" && !(isAdminOrHR || isManager) && (
                      <button
                        onClick={() => handleCancel(String(r.name))}
                        className="text-red-600 text-xs hover:underline"
                      >
                        {t("common.cancel")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
