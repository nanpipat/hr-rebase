"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getSSOConfig,
  updateSSOConfig,
  getSSOReport,
  getEmployeeSSO,
  updateEmployeeSSO,
  getPVDConfig,
  updatePVDConfig,
  getEmployeePVD,
  enrollEmployeePVD,
  updateEmployeePVD,
  unenrollEmployeePVD,
  getPVDReport,
} from "@/lib/api";
import Tabs, { useActiveTab } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "@/lib/i18n";

export default function BenefitsPage() {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const t = useTranslations();
  const isAdminOrHR = user?.role === "admin" || user?.role === "hr";
  const employeeId = user?.frappe_employee_id || "";

  const activeTab = useActiveTab("sso");

  const tabs = [
    { id: "sso", label: t("benefits.sso") },
    { id: "pvd", label: t("benefits.pvd") },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {t("benefits.title")}
      </h1>
      <Tabs tabs={tabs} activeTab={activeTab} basePath="/benefits" />
      <div className="mt-6">
        {activeTab === "sso" && (
          <SSOSection
            isAdmin={isAdminOrHR}
            employeeId={employeeId}
            t={t}
            showToast={showToast}
          />
        )}
        {activeTab === "pvd" && (
          <PVDSection
            isAdmin={isAdminOrHR}
            employeeId={employeeId}
            t={t}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}

function SSOSection({
  isAdmin,
  employeeId,
  t,
  showToast,
}: {
  isAdmin: boolean;
  employeeId: string;
  t: (k: string) => string;
  showToast: (m: string, type?: "success" | "error" | "info") => void;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [mySSO, setMySSO] = useState<Record<string, unknown>>({});
  const [report, setReport] = useState<Record<string, unknown>>({});
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cfgRes, myRes] = await Promise.all([
          getSSOConfig(),
          employeeId
            ? getEmployeeSSO(employeeId)
            : Promise.resolve({ data: {} }),
        ]);
        setConfig(cfgRes.data || {});
        setMySSO(myRes.data || {});
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [employeeId]);

  const fetchReport = async () => {
    try {
      const res = await getSSOReport(month, year);
      setReport(res.data || {});
    } catch {
      /* ignore */
    }
  };

  const handleSaveConfig = async () => {
    try {
      await updateSSOConfig(config);
      showToast(t("benefits.configSaved"), "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("benefits.failedSave"),
        "error",
      );
    }
  };

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* My SSO Info */}
      {employeeId && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">
            {t("benefits.mySSOInfo")}
          </h3>
          <p className="text-sm text-gray-600">
            {t("benefits.ssoNumber")}:{" "}
            <span className="font-medium">
              {String(mySSO.sso_number || "-")}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {t("benefits.rate")}: {String(config.rate || 5)}%
          </p>
          <p className="text-sm text-gray-600">
            {t("benefits.maxContribution")}: ฿
            {String(config.max_contribution || 750)}/{t("common.month")}
          </p>
        </div>
      )}

      {/* Admin: Config */}
      {isAdmin && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">
            {t("benefits.ssoConfig")}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.rate")} (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={String(config.rate || "")}
                onChange={(e) =>
                  setConfig({ ...config, rate: parseFloat(e.target.value) })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.maxSalary")}
              </label>
              <input
                type="number"
                value={String(config.max_salary || "")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_salary: parseFloat(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.maxContribution")}
              </label>
              <input
                type="number"
                value={String(config.max_contribution || "")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_contribution: parseFloat(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSaveConfig}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            {t("common.save")}
          </button>
        </div>
      )}

      {/* Admin: Report */}
      {isAdmin && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">
            {t("benefits.ssoReport")}
          </h3>
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
              onClick={fetchReport}
              className="px-4 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"
            >
              {t("benefits.loadReport")}
            </button>
          </div>
          {(report.employees as Array<Record<string, unknown>>)?.length > 0 && (
            <>
              <div className="text-sm text-gray-600 mb-2">
                {t("benefits.totalEmployee")}: ฿
                {String(
                  (report as Record<string, unknown>)
                    .total_employee_contribution,
                )}{" "}
                | {t("benefits.totalEmployer")}: ฿
                {String(
                  (report as Record<string, unknown>)
                    .total_employer_contribution,
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      {t("common.employee")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("benefits.baseSalary")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("benefits.empContribution")}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {t("benefits.emrContribution")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(report.employees as Array<Record<string, unknown>>)?.map(
                    (e: Record<string, unknown>) => (
                      <tr key={String(e.employee)}>
                        <td className="px-3 py-2">{String(e.employee_name)}</td>
                        <td className="px-3 py-2 text-right">
                          ฿{Number(e.base_salary).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          ฿{Number(e.employee_contribution).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          ฿{Number(e.employer_contribution).toLocaleString()}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PVDSection({
  isAdmin,
  employeeId,
  t,
  showToast,
}: {
  isAdmin: boolean;
  employeeId: string;
  t: (k: string) => string;
  showToast: (m: string, type?: "success" | "error" | "info") => void;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [myPVD, setMyPVD] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cfgRes, myRes] = await Promise.all([
          getPVDConfig(),
          employeeId
            ? getEmployeePVD(employeeId)
            : Promise.resolve({ data: {} }),
        ]);
        setConfig(cfgRes.data || {});
        setMyPVD(myRes.data || {});
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [employeeId]);

  const handleSaveConfig = async () => {
    try {
      await updatePVDConfig(config);
      showToast(t("benefits.configSaved"), "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("benefits.failedSave"),
        "error",
      );
    }
  };

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* My PVD Info */}
      {employeeId && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">
            {t("benefits.myPVDInfo")}
          </h3>
          <p className="text-sm text-gray-600">
            {t("common.status")}:{" "}
            <span
              className={`font-medium ${myPVD.pvd_enrolled ? "text-green-600" : "text-gray-400"}`}
            >
              {myPVD.pvd_enrolled
                ? t("benefits.enrolled")
                : t("benefits.notEnrolled")}
            </span>
          </p>
          {!!myPVD.pvd_enrolled && (
            <>
              <p className="text-sm text-gray-600 mt-1">
                {t("benefits.employeeRate")}: {String(myPVD.pvd_employee_rate)}%
              </p>
              <p className="text-sm text-gray-600">
                {t("benefits.employerRate")}: {String(myPVD.pvd_employer_rate)}%
              </p>
              <p className="text-sm text-gray-600">
                {t("benefits.enrollmentDate")}:{" "}
                {String(myPVD.pvd_enrollment_date || "-")}
              </p>
            </>
          )}
        </div>
      )}

      {/* Admin: Config */}
      {isAdmin && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">
            {t("benefits.pvdConfig")}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.minRate")} (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={String(config.min_rate || "")}
                onChange={(e) =>
                  setConfig({ ...config, min_rate: parseFloat(e.target.value) })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.maxRate")} (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={String(config.max_rate || "")}
                onChange={(e) =>
                  setConfig({ ...config, max_rate: parseFloat(e.target.value) })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.defaultEmpRate")} (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={String(config.default_employee_rate || "")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    default_employee_rate: parseFloat(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("benefits.defaultEmrRate")} (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={String(config.default_employer_rate || "")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    default_employer_rate: parseFloat(e.target.value),
                  })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSaveConfig}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            {t("common.save")}
          </button>
        </div>
      )}
    </div>
  );
}
