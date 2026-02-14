"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEmployeeFull } from "@/lib/api";
import Tabs, { useActiveTab, type Tab } from "@/components/ui/Tabs";
import OverviewTab from "./tabs/OverviewTab";
import ContactTab from "./tabs/ContactTab";
import EmploymentTab from "./tabs/EmploymentTab";
import CompensationTab from "./tabs/CompensationTab";
import LeaveTab from "./tabs/LeaveTab";
import AttendanceTab from "./tabs/AttendanceTab";
import DocumentsTab from "./tabs/DocumentsTab";
import PromotionsTab from "./tabs/PromotionsTab";
import TimelineTab from "./tabs/TimelineTab";

const allTabs: (Tab & { roles: string[] })[] = [
  { id: "overview", label: "Overview", roles: ["admin", "hr", "manager", "employee"] },
  { id: "contact", label: "Contact", roles: ["admin", "hr", "manager", "employee"] },
  { id: "employment", label: "Employment", roles: ["admin", "hr"] },
  { id: "compensation", label: "Compensation", roles: ["admin", "hr"] },
  { id: "leave", label: "Leave", roles: ["admin", "hr", "manager", "employee"] },
  { id: "attendance", label: "Attendance", roles: ["admin", "hr", "manager", "employee"] },
  { id: "documents", label: "Documents", roles: ["admin", "hr", "employee"] },
  { id: "promotions", label: "Promotions", roles: ["admin", "hr"] },
  { id: "timeline", label: "Timeline", roles: ["admin", "hr"] },
];

function EmployeeProfileContent() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const activeTab = useActiveTab("overview");
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const role = user?.role || "employee";
  const isAdminOrHR = role === "admin" || role === "hr";
  const isSelf = user?.frappe_employee_id === id;
  const visibleTabs = allTabs.filter((t) => t.roles.includes(role));

  const fetchEmployee = useCallback(() => {
    setLoading(true);
    getEmployeeFull(id)
      .then((res) => setEmployee(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!employee) return <p className="text-gray-500">Employee not found</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <a href="/employees" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to Employees
        </a>
        {isSelf && (
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">My Profile</span>
        )}
      </div>

      <Tabs tabs={visibleTabs} activeTab={activeTab} basePath={`/employees/${id}`} />

      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab employee={employee} />}
        {activeTab === "contact" && (
          <ContactTab employee={employee} canEdit={isAdminOrHR || role === "employee"} onUpdate={fetchEmployee} />
        )}
        {activeTab === "employment" && (
          <EmploymentTab employee={employee} canEdit={isAdminOrHR} onUpdate={fetchEmployee} />
        )}
        {activeTab === "compensation" && <CompensationTab employeeId={id} />}
        {activeTab === "leave" && <LeaveTab employeeId={id} />}
        {activeTab === "attendance" && <AttendanceTab employeeId={id} />}
        {activeTab === "documents" && <DocumentsTab employeeId={id} />}
        {activeTab === "promotions" && <PromotionsTab employeeId={id} />}
        {activeTab === "timeline" && <TimelineTab employeeId={id} />}
      </div>
    </div>
  );
}

export default function EmployeeProfilePage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <EmployeeProfileContent />
    </Suspense>
  );
}
