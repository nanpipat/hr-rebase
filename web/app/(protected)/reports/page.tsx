"use client";

import { useEffect, useState } from "react";
import {
  getEmployeeSummaryReport,
  getAttendanceReport,
  getLeaveReport,
  getPayrollReport,
  getTaxReport,
  exportReportCSV,
} from "@/lib/api";
import Tabs, { useActiveTab } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "@/lib/i18n";

export default function ReportsPage() {
  const t = useTranslations();
  const { toast: showToast } = useToast();
  const activeTab = useActiveTab("employee");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const tabs = [
    { id: "employee", label: t("reports.employee") },
    { id: "attendance", label: t("reports.attendance") },
    { id: "leave", label: t("reports.leave") },
    { id: "payroll", label: t("reports.payroll") },
    { id: "tax", label: t("reports.tax") },
  ];

  const handleExport = async (reportType: string) => {
    try {
      const res = await exportReportCSV(reportType, year, month);
      const { headers, rows } = res.data;
      const csv = [
        headers.join(","),
        ...rows.map((r: unknown[]) => r.join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report_${year}_${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t("reports.exportFailed"), "error");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {t("reports.title")}
      </h1>

      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {t("common.month")}
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {t("common.year")}
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-3 py-2 text-sm w-24"
          />
        </div>
        <button
          onClick={() => handleExport(activeTab)}
          className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
        >
          {t("reports.exportCSV")}
        </button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} basePath="/reports" />

      <div className="mt-6">
        {activeTab === "employee" && <EmployeeReport t={t} />}
        {activeTab === "attendance" && (
          <AttendanceReportTab month={month} year={year} t={t} />
        )}
        {activeTab === "leave" && <LeaveReportTab year={year} t={t} />}
        {activeTab === "payroll" && (
          <PayrollReportTab month={month} year={year} t={t} />
        )}
        {activeTab === "tax" && (
          <TaxReportTab month={month} year={year} t={t} />
        )}
      </div>
    </div>
  );
}

function EmployeeReport({ t }: { t: (k: string) => string }) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getEmployeeSummaryReport();
        setData(res.data || {});
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold">
            {String(data.total_employees || 0)}
          </div>
          <div className="text-xs text-gray-500">
            {t("reports.totalEmployees")}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {String(data.active_employees || 0)}
          </div>
          <div className="text-xs text-gray-500">
            {t("reports.activeEmployees")}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600">
            {String(data.turnover_rate || 0)}%
          </div>
          <div className="text-xs text-gray-500">
            {t("reports.turnoverRate")}
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {String(data.left_this_year || 0)}
          </div>
          <div className="text-xs text-gray-500">
            {t("reports.leftThisYear")}
          </div>
        </div>
      </div>
      {(data.departments as Array<Record<string, unknown>>)?.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">{t("reports.byDepartment")}</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">
                  {t("reports.department")}
                </th>
                <th className="px-4 py-2 text-right">{t("reports.total")}</th>
                <th className="px-4 py-2 text-right">{t("reports.active")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data.departments as Array<Record<string, unknown>>).map((d) => (
                <tr key={String(d.department)}>
                  <td className="px-4 py-2">{String(d.department)}</td>
                  <td className="px-4 py-2 text-right">{String(d.total)}</td>
                  <td className="px-4 py-2 text-right">{String(d.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AttendanceReportTab({
  month,
  year,
  t,
}: {
  month: number;
  year: number;
  t: (k: string) => string;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getAttendanceReport(month, year);
        setData(res.data || {});
      } catch {}
      setLoading(false);
    })();
  }, [month, year]);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="bg-white border rounded-lg p-4">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">{t("common.employee")}</th>
            <th className="px-3 py-2 text-right">{t("common.present")}</th>
            <th className="px-3 py-2 text-right">{t("common.absent")}</th>
            <th className="px-3 py-2 text-right">{t("reports.halfDay")}</th>
            <th className="px-3 py-2 text-right">{t("reports.late")}</th>
            <th className="px-3 py-2 text-right">{t("reports.earlyExit")}</th>
            <th className="px-3 py-2 text-right">{t("reports.totalHours")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(data.employees as Array<Record<string, unknown>>)?.map((e) => (
            <tr key={String(e.employee)}>
              <td className="px-3 py-2">{String(e.employee_name)}</td>
              <td className="px-3 py-2 text-right">{String(e.present)}</td>
              <td className="px-3 py-2 text-right">{String(e.absent)}</td>
              <td className="px-3 py-2 text-right">{String(e.half_day)}</td>
              <td className="px-3 py-2 text-right">{String(e.late)}</td>
              <td className="px-3 py-2 text-right">{String(e.early_exit)}</td>
              <td className="px-3 py-2 text-right">{String(e.total_hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaveReportTab({
  year,
  t,
}: {
  year: number;
  t: (k: string) => string;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getLeaveReport(year);
        setData(res.data || {});
      } catch {}
      setLoading(false);
    })();
  }, [year]);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">{t("reports.byType")}</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">{t("reports.leaveType")}</th>
              <th className="px-4 py-2 text-right">{t("reports.totalDays")}</th>
              <th className="px-4 py-2 text-right">{t("reports.count")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data.by_type as Array<Record<string, unknown>>)?.map((lt) => (
              <tr key={String(lt.leave_type)}>
                <td className="px-4 py-2">{String(lt.leave_type)}</td>
                <td className="px-4 py-2 text-right">
                  {String(lt.total_days)}
                </td>
                <td className="px-4 py-2 text-right">{String(lt.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayrollReportTab({
  month,
  year,
  t,
}: {
  month: number;
  year: number;
  t: (k: string) => string;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getPayrollReport(year, month);
        setData(res.data || {});
      } catch {}
      setLoading(false);
    })();
  }, [month, year]);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white border rounded-lg p-4">
        <div className="text-2xl font-bold">
          {String(data.total_slips || 0)}
        </div>
        <div className="text-xs text-gray-500">{t("reports.totalSlips")}</div>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <div className="text-2xl font-bold text-green-600">
          ฿{Number(data.total_gross || 0).toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">{t("reports.totalGross")}</div>
      </div>
      <div className="bg-white border rounded-lg p-4">
        <div className="text-2xl font-bold text-blue-600">
          ฿{Number(data.total_net || 0).toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">{t("reports.totalNet")}</div>
      </div>
    </div>
  );
}

function TaxReportTab({
  month,
  year,
  t,
}: {
  month: number;
  year: number;
  t: (k: string) => string;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getTaxReport(year, month);
        setData(res.data || {});
      } catch {}
      setLoading(false);
    })();
  }, [month, year]);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm text-gray-500">
            {t("reports.totalIncome")}:
          </span>{" "}
          <span className="font-semibold">
            ฿{Number(data.total_income || 0).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-sm text-gray-500">
            {t("reports.totalTax")}:
          </span>{" "}
          <span className="font-semibold">
            ฿{Number(data.total_tax || 0).toLocaleString()}
          </span>
        </div>
      </div>
      {(data.records as Array<Record<string, unknown>>)?.length > 0 && (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">{t("common.employee")}</th>
              <th className="px-3 py-2 text-right">{t("reports.income")}</th>
              <th className="px-3 py-2 text-right">
                {t("reports.taxWithheld")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data.records as Array<Record<string, unknown>>).map((r) => (
              <tr key={String(r.employee)}>
                <td className="px-3 py-2">{String(r.employee_name)}</td>
                <td className="px-3 py-2 text-right">
                  ฿{Number(r.monthly_income).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  ฿{Number(r.tax_withheld).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
