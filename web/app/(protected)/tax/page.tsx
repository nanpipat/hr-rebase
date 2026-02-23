"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getTaxSlabs,
  getEmployeeTaxDeductions,
  updateEmployeeTaxDeductions,
  getEmployeeTaxSummary,
  getPND1,
  getWithholdingCert,
} from "@/lib/api";
import Tabs, { useActiveTab } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "@/lib/i18n";

export default function TaxPage() {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const t = useTranslations();
  const isAdminOrHR = user?.role === "admin" || user?.role === "hr";
  const employeeId = user?.frappe_employee_id || "";
  const activeTab = useActiveTab("deductions");

  const tabs = isAdminOrHR
    ? [
        { id: "deductions", label: t("tax.myDeductions") },
        { id: "slabs", label: t("tax.taxSlabs") },
        { id: "pnd1", label: t("tax.pnd1") },
      ]
    : [
        { id: "deductions", label: t("tax.myDeductions") },
        { id: "summary", label: t("tax.summary") },
      ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {t("tax.title")}
      </h1>
      <Tabs tabs={tabs} activeTab={activeTab} basePath="/tax" />
      <div className="mt-6">
        {activeTab === "deductions" && employeeId && (
          <DeductionsTab employeeId={employeeId} t={t} showToast={showToast} />
        )}
        {activeTab === "slabs" && <SlabsTab t={t} />}
        {activeTab === "summary" && employeeId && (
          <SummaryTab employeeId={employeeId} t={t} />
        )}
        {activeTab === "pnd1" && isAdminOrHR && <PND1Tab t={t} />}
      </div>
    </div>
  );
}

function DeductionsTab({
  employeeId,
  t,
  showToast,
}: {
  employeeId: string;
  t: (k: string) => string;
  showToast: (m: string, type?: "success" | "error" | "info") => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getEmployeeTaxDeductions(employeeId);
        setData(res.data || {});
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
  }, [employeeId]);

  const handleSave = async () => {
    try {
      await updateEmployeeTaxDeductions(employeeId, data);
      showToast(t("tax.deductionsSaved"), "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("tax.failedSave"),
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

  const fields = [
    { key: "tax_id", label: t("tax.taxId"), type: "text" },
    {
      key: "personal_allowance",
      label: t("tax.personalAllowance"),
      type: "number",
    },
    {
      key: "spouse_allowance",
      label: t("tax.spouseAllowance"),
      type: "number",
    },
    { key: "children_count", label: t("tax.childrenCount"), type: "number" },
    {
      key: "life_insurance_premium",
      label: t("tax.lifeInsurance"),
      type: "number",
    },
    {
      key: "health_insurance_premium",
      label: t("tax.healthInsurance"),
      type: "number",
    },
    {
      key: "housing_loan_interest",
      label: t("tax.housingLoan"),
      type: "number",
    },
    { key: "donation_deduction", label: t("tax.donation"), type: "number" },
  ];

  return (
    <div className="bg-white border rounded-lg p-6 max-w-lg">
      <h3 className="font-semibold text-gray-800 mb-4">
        {t("tax.myDeductions")}
      </h3>
      <div className="space-y-3">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label className="block text-sm text-gray-600 mb-1">{label}</label>
            <input
              type={type}
              value={String(data[key] ?? "")}
              onChange={(e) =>
                setData({
                  ...data,
                  [key]:
                    type === "number"
                      ? parseFloat(e.target.value) || 0
                      : e.target.value,
                })
              }
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        {t("common.save")}
      </button>
    </div>
  );
}

function SlabsTab({ t }: { t: (k: string) => string }) {
  const [slabs, setSlabs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getTaxSlabs();
        setSlabs(
          ((res.data as Record<string, unknown>)?.slabs as Array<
            Record<string, unknown>
          >) || [],
        );
      } catch {
        /* ignore */
      }
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
    <div className="bg-white border rounded-lg p-4">
      <h3 className="font-semibold text-gray-800 mb-3">{t("tax.thaiPIT")}</h3>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">{t("tax.fromAmount")}</th>
            <th className="px-4 py-2 text-left">{t("tax.toAmount")}</th>
            <th className="px-4 py-2 text-left">{t("tax.taxRate")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {slabs.map((s, i) => (
            <tr key={i}>
              <td className="px-4 py-2">
                ฿{Number(s.from_amount).toLocaleString()}
              </td>
              <td className="px-4 py-2">
                {Number(s.to_amount) > 0
                  ? `฿${Number(s.to_amount).toLocaleString()}`
                  : "+"}
              </td>
              <td className="px-4 py-2">{Number(s.percent_deduction)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTab({
  employeeId,
  t,
}: {
  employeeId: string;
  t: (k: string) => string;
}) {
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getEmployeeTaxSummary(employeeId, year);
      setSummary(res.data || {});
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch();
  }, [employeeId, year]);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-400">
        {t("common.loading")}
      </div>
    );

  const months = (summary.monthly_data as Array<Record<string, unknown>>) || [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">
          {t("tax.annualSummary")}
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">{t("common.year")}:</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm w-20"
          />
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        {t("tax.totalAnnualTax")}:{" "}
        <span className="font-semibold text-lg">
          ฿{Number(summary.total_annual_tax || 0).toLocaleString()}
        </span>
      </p>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">{t("common.month")}</th>
            <th className="px-4 py-2 text-right">
              {t("tax.monthlyWithholding")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {months.map((m) => (
            <tr key={Number(m.month)}>
              <td className="px-4 py-2">{monthNames[Number(m.month) - 1]}</td>
              <td className="px-4 py-2 text-right">
                ฿{Number(m.monthly_withholding).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PND1Tab({ t }: { t: (k: string) => string }) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getPND1(month, year);
      setData(res.data || {});
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="font-semibold text-gray-800 mb-3">
        {t("tax.pnd1Report")}
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
          onClick={fetch}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"
        >
          {t("benefits.loadReport")}
        </button>
      </div>
      {loading && (
        <div className="text-center py-4 text-gray-400">
          {t("common.loading")}
        </div>
      )}
      {!loading &&
        (data.records as Array<Record<string, unknown>>)?.length > 0 && (
          <>
            <div className="text-sm text-gray-600 mb-2">
              {t("tax.totalIncome")}: ฿
              {Number(data.total_income).toLocaleString()} | {t("tax.totalTax")}
              : ฿{Number(data.total_tax).toLocaleString()}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">
                    {t("common.employee")}
                  </th>
                  <th className="px-3 py-2 text-left">{t("tax.taxId")}</th>
                  <th className="px-3 py-2 text-right">
                    {t("tax.monthlyIncome")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("tax.taxWithheld")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data.records as Array<Record<string, unknown>>).map((r) => (
                  <tr key={String(r.employee)}>
                    <td className="px-3 py-2">{String(r.employee_name)}</td>
                    <td className="px-3 py-2">{String(r.tax_id || "-")}</td>
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
          </>
        )}
    </div>
  );
}
