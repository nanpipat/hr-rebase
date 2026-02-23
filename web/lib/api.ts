const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "hr" | "manager" | "employee";
  company_id: string;
  company_name: string;
  frappe_employee_id?: string;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

// Auth
export async function login(email: string, password: string) {
  return api<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function signup(data: {
  company_name: string;
  email: string;
  password: string;
  full_name: string;
}) {
  return api<{ token: string; user: AuthUser }>("/auth/signup", {
    method: "POST",
    body: data,
  });
}

export async function logout() {
  return api<{ message: string }>("/auth/logout", { method: "POST" });
}

export async function getMe() {
  return api<AuthUser>("/me");
}

// Employees
export async function getEmployees() {
  return api<{ data: Array<Record<string, string>> }>("/employees");
}

export async function getEmployee(id: string) {
  return api<{ data: Record<string, unknown> }>(`/employees/${id}`);
}

export async function getEmployeeFull(id: string) {
  return api<{ data: Record<string, unknown> }>(`/employees/${id}/full`);
}

export async function updateEmployee(id: string, data: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>(`/employees/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function createEmployee(data: { employee_name: string }) {
  return api<{ data: { employee_id: string } }>("/employees", {
    method: "POST",
    body: data,
  });
}

export async function getEmployeeCompensation(id: string) {
  return api<{ data: Record<string, unknown> }>(`/employees/${id}/compensation`);
}

export async function getEmployeeLeave(id: string) {
  return api<{
    data: {
      allocations: Array<Record<string, unknown>>;
      applications: Array<Record<string, unknown>>;
    };
  }>(`/employees/${id}/leave`);
}

export async function getEmployeeAttendance(id: string, fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<{ data: Record<string, unknown> }>(`/employees/${id}/attendance${query}`);
}

export async function getEmployeeDocuments(id: string) {
  return api<{ data: Array<Record<string, unknown>> }>(`/employees/${id}/documents`);
}

export async function uploadEmployeeDocument(
  id: string,
  filename: string,
  content: string,
  docType?: string
) {
  return api<{ data: Record<string, unknown> }>(`/employees/${id}/documents`, {
    method: "POST",
    body: { filename, content, doc_type: docType },
  });
}

export async function getEmployeePromotions(id: string) {
  return api<{ data: Array<Record<string, unknown>> }>(`/employees/${id}/promotions`);
}

export async function updateEmployeeContact(id: string, data: Record<string, string>) {
  return api<{ data: Record<string, unknown> }>(`/employees/${id}/contact`, {
    method: "PUT",
    body: data,
  });
}

export async function getEmployeeTimeline(id: string) {
  return api<{ data: Array<Record<string, unknown>> }>(`/employees/${id}/timeline`);
}

export async function deleteEmployeeDocument(employeeId: string, docId: string) {
  return api<{ data: Record<string, unknown> }>(`/employees/${employeeId}/documents/${docId}`, {
    method: "DELETE",
  });
}

// Leave
export async function getLeaves() {
  return api<{ data: Array<Record<string, unknown>> }>("/leaves");
}

export async function createLeave(data: {
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
}) {
  return api<{ data: Record<string, unknown> }>("/leaves", { method: "POST", body: data });
}

export async function approveLeave(id: string, status: "Approved" | "Rejected") {
  return api<{ message: string }>(`/leaves/${id}/approve`, {
    method: "PUT",
    body: { status },
  });
}

export async function updateLeave(
  id: string,
  data: { leave_type?: string; from_date?: string; to_date?: string; reason?: string }
) {
  return api<{ data: Record<string, unknown> }>(`/leaves/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function cancelLeave(id: string) {
  return api<{ data: Record<string, unknown> }>(`/leaves/${id}`, { method: "DELETE" });
}

export async function getLeaveBalance() {
  return api<{ data: Array<Record<string, unknown>> }>("/leaves/balance");
}

// Attendance
export async function getMyAttendance(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<{ data: Record<string, unknown> }>(`/attendance/me${query}`);
}

export async function submitAttendanceRequest(data: {
  attendance_date: string;
  reason: string;
  status?: string;
}) {
  return api<{ data: Record<string, unknown> }>("/attendance/requests", {
    method: "POST",
    body: data,
  });
}

export async function getAttendanceRequests() {
  return api<{ data: Array<Record<string, unknown>> }>("/attendance/requests");
}

export async function approveAttendanceRequest(id: string, action: "approve" | "reject") {
  return api<{ data: Record<string, unknown> }>(`/attendance/requests/${id}/approve`, {
    method: "PUT",
    body: { action },
  });
}

// Check-in / Check-out
export async function checkin() {
  return api<{ data: { name: string; time: string; log_type: string } }>("/checkin", {
    method: "POST",
  });
}

export async function checkout() {
  return api<{ data: { name: string; time: string; log_type: string } }>("/checkout", {
    method: "POST",
  });
}

export async function getTodayCheckin() {
  return api<{
    data: {
      checkins: Array<{ time: string; log_type: string }>;
      first_in: string | null;
      last_out: string | null;
      working_hours: number;
      is_checked_in: boolean;
    };
  }>("/checkin/today");
}

export async function getCheckinHistory(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<{
    data: {
      days: Array<{
        date: string;
        first_in: string | null;
        last_out: string | null;
        working_hours: number;
        checkin_count: number;
        checkins: Array<{ time: string; log_type: string }>;
      }>;
    };
  }>(`/checkin/history${query}`);
}

// Users
export async function getUsers() {
  return api<{ data: Array<Record<string, unknown>> }>("/users");
}

export async function getUser(id: string) {
  return api<{ data: Record<string, unknown> }>(`/users/${id}`);
}

export async function changeUserRole(id: string, role: string) {
  return api<{ message: string }>(`/users/${id}/role`, {
    method: "PUT",
    body: { role },
  });
}

export async function changeUserStatus(id: string, status: string) {
  return api<{ message: string }>(`/users/${id}/status`, {
    method: "PUT",
    body: { status },
  });
}

// Invites
export async function createInvite(data: {
  email: string;
  role: string;
  full_name: string;
}) {
  return api<{ data: { id: string; token: string; email: string } }>("/invites", {
    method: "POST",
    body: data,
  });
}

export async function getInvites() {
  return api<{ data: Array<Record<string, unknown>> }>("/invites");
}

export async function acceptInvite(data: {
  token: string;
  password: string;
  full_name: string;
}) {
  return api<{ token: string; user: AuthUser }>("/invites/accept", {
    method: "POST",
    body: data,
  });
}

export async function revokeInvite(id: string) {
  return api<{ message: string }>(`/invites/${id}`, { method: "DELETE" });
}

// Payroll
export async function getPayrollSlips(year?: number, month?: number) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<{ data: Array<Record<string, unknown>> }>(`/payroll/slips${query}`);
}

export async function getPayrollSlipDetail(id: string) {
  return api<{
    data: {
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
    };
  }>(`/payroll/slips/detail?id=${encodeURIComponent(id)}`);
}

export async function setupEmployeePayroll(
  employeeId: string,
  data: { base_salary: number; housing?: number; transport?: number }
) {
  return api<{ data: Record<string, unknown> }>(`/payroll/employees/${employeeId}/setup`, {
    method: "POST",
    body: data,
  });
}

export async function generateSalarySlip(
  employeeId: string,
  data: { month: number; year: number }
) {
  return api<{ data: Record<string, unknown> }>(`/payroll/employees/${employeeId}/generate`, {
    method: "POST",
    body: data,
  });
}

export async function processPayroll(data: { month: number; year: number; company?: string }) {
  return api<{
    data: {
      month: number;
      year: number;
      created_count: number;
      skipped_count: number;
      error_count: number;
      total_gross: number;
      total_deduction: number;
      total_net: number;
      slips: Array<Record<string, unknown>>;
      skipped: Array<Record<string, unknown>>;
      errors: Array<Record<string, unknown>>;
    };
  }>("/payroll/process", { method: "POST", body: data });
}

export async function submitPayroll(data: { month: number; year: number }) {
  return api<{
    data: {
      submitted_count: number;
      error_count: number;
      submitted: Array<Record<string, unknown>>;
      errors: Array<Record<string, unknown>>;
    };
  }>("/payroll/submit", { method: "POST", body: data });
}

// Shifts
export async function getShiftTypes() {
  return api<{ data: Array<Record<string, unknown>> }>("/shifts/types");
}

export async function createShiftType(data: {
  name: string;
  start_time: string;
  end_time: string;
  late_entry_grace_period?: number;
  early_exit_grace_period?: number;
}) {
  return api<{ data: Record<string, unknown> }>("/shifts/types", {
    method: "POST",
    body: data,
  });
}

export async function updateShiftType(name: string, data: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>(`/shifts/types/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: data,
  });
}

export async function getMyShift() {
  return api<{
    data: {
      has_shift: boolean;
      shift_type?: string;
      start_time?: string;
      end_time?: string;
      assignment_start?: string;
      assignment_end?: string | null;
      late_entry_grace_period?: number;
      early_exit_grace_period?: number;
    };
  }>("/shifts/me");
}

export async function getShiftAssignments(params?: {
  employee_id?: string;
  shift_type?: string;
  date?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.employee_id) sp.set("employee_id", params.employee_id);
  if (params?.shift_type) sp.set("shift_type", params.shift_type);
  if (params?.date) sp.set("date", params.date);
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return api<{ data: Array<Record<string, unknown>> }>(`/shifts/assignments${query}`);
}

export async function assignShift(data: {
  employee_id: string;
  shift_type: string;
  start_date: string;
  end_date?: string;
}) {
  return api<{ data: Record<string, unknown> }>("/shifts/assignments", {
    method: "POST",
    body: data,
  });
}

export async function unassignShift(id: string) {
  return api<{ data: Record<string, unknown> }>(`/shifts/assignments/${id}`, {
    method: "DELETE",
  });
}

export async function getShiftRequests() {
  return api<{ data: Array<Record<string, unknown>> }>("/shifts/requests");
}

export async function createShiftRequest(data: {
  shift_type: string;
  from_date: string;
  to_date: string;
}) {
  return api<{ data: Record<string, unknown> }>("/shifts/requests", {
    method: "POST",
    body: data,
  });
}

export async function approveShiftRequest(id: string, action: "approve" | "reject") {
  return api<{ data: Record<string, unknown> }>(`/shifts/requests/${id}/approve`, {
    method: "PUT",
    body: { action },
  });
}

export async function processAutoAttendance(data: { date?: string; company?: string }) {
  return api<{
    data: {
      date: string;
      processed_count: number;
      skipped_count: number;
      error_count: number;
      late_count: number;
      early_exit_count: number;
      created: Array<Record<string, unknown>>;
      skipped: Array<Record<string, unknown>>;
      errors: Array<Record<string, unknown>>;
    };
  }>("/shifts/auto-attendance", { method: "POST", body: data });
}

// Overtime
export async function getOvertimeRequests(params?: { status?: string; month?: string; year?: string }) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.month) sp.set("month", params.month);
  if (params?.year) sp.set("year", params.year);
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return api<{ data: Array<Record<string, unknown>> }>(`/overtime${query}`);
}

export async function createOvertimeRequest(data: {
  ot_date: string;
  ot_type: string;
  hours: number;
  reason?: string;
}) {
  return api<{ data: Record<string, unknown> }>("/overtime", { method: "POST", body: data });
}

export async function approveOvertimeRequest(id: string, action: "approve" | "reject") {
  return api<{ data: Record<string, unknown> }>(`/overtime/${id}/approve`, {
    method: "PUT",
    body: { action },
  });
}

export async function cancelOvertimeRequest(id: string) {
  return api<{ data: Record<string, unknown> }>(`/overtime/${id}`, { method: "DELETE" });
}

export async function getOvertimeConfig() {
  return api<{ data: Record<string, unknown> }>("/overtime/config");
}

export async function updateOvertimeConfig(data: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>("/overtime/config", { method: "PUT", body: data });
}

// Social Security
export async function getSSOConfig() {
  return api<{ data: Record<string, unknown> }>("/sso/config");
}

export async function updateSSOConfig(data: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>("/sso/config", { method: "PUT", body: data });
}

export async function getSSOReport(month: number, year: number) {
  return api<{ data: Record<string, unknown> }>(`/sso/report?month=${month}&year=${year}`);
}

export async function getEmployeeSSO(id: string) {
  return api<{ data: Record<string, unknown> }>(`/sso/employees/${id}`);
}

export async function updateEmployeeSSO(id: string, ssoNumber: string) {
  return api<{ data: Record<string, unknown> }>(`/sso/employees/${id}`, {
    method: "PUT",
    body: { sso_number: ssoNumber },
  });
}

// Provident Fund
export async function getPVDConfig() {
  return api<{ data: Record<string, unknown> }>("/pvd/config");
}

export async function updatePVDConfig(data: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>("/pvd/config", { method: "PUT", body: data });
}

export async function getEmployeePVD(id: string) {
  return api<{ data: Record<string, unknown> }>(`/pvd/employees/${id}`);
}

export async function enrollEmployeePVD(id: string, data: { employee_rate?: number; employer_rate?: number }) {
  return api<{ data: Record<string, unknown> }>(`/pvd/employees/${id}`, { method: "POST", body: data });
}

export async function updateEmployeePVD(id: string, data: { employee_rate?: number; employer_rate?: number }) {
  return api<{ data: Record<string, unknown> }>(`/pvd/employees/${id}`, { method: "PUT", body: data });
}

export async function unenrollEmployeePVD(id: string) {
  return api<{ data: Record<string, unknown> }>(`/pvd/employees/${id}`, { method: "DELETE" });
}

export async function getPVDReport(month: number, year: number) {
  return api<{ data: Record<string, unknown> }>(`/pvd/report?month=${month}&year=${year}`);
}

// Tax
export async function getTaxSlabs() {
  return api<{ data: Record<string, unknown> }>("/tax/slabs");
}

export async function getEmployeeTaxDeductions(id: string) {
  return api<{ data: Record<string, unknown> }>(`/tax/employees/${id}/deductions`);
}

export async function updateEmployeeTaxDeductions(id: string, data: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>(`/tax/employees/${id}/deductions`, {
    method: "PUT",
    body: data,
  });
}

export async function getEmployeeTaxSummary(id: string, year: number) {
  return api<{ data: Record<string, unknown> }>(`/tax/employees/${id}/summary?year=${year}`);
}

export async function getPND1(month: number, year: number) {
  return api<{ data: Record<string, unknown> }>(`/tax/pnd1?month=${month}&year=${year}`);
}

export async function getWithholdingCert(id: string, year: number) {
  return api<{ data: Record<string, unknown> }>(`/tax/withholding-cert/${id}?year=${year}`);
}

// Notifications
export async function getNotifications(limit?: number, offset?: number) {
  const sp = new URLSearchParams();
  if (limit) sp.set("limit", String(limit));
  if (offset) sp.set("offset", String(offset));
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return api<{ data: Array<Record<string, unknown>> }>(`/notifications${query}`);
}

export async function getNotificationCount() {
  return api<{ count: number }>("/notifications/count");
}

export async function markNotificationRead(id: number) {
  return api<{ message: string }>(`/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead() {
  return api<{ message: string }>("/notifications/read-all", { method: "PUT" });
}

// Reports
export async function getEmployeeSummaryReport(company?: string) {
  const sp = new URLSearchParams();
  if (company) sp.set("company", company);
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return api<{ data: Record<string, unknown> }>(`/reports/employees${query}`);
}

export async function getAttendanceReport(month: number, year: number) {
  return api<{ data: Record<string, unknown> }>(`/reports/attendance?month=${month}&year=${year}`);
}

export async function getLeaveReport(year: number) {
  return api<{ data: Record<string, unknown> }>(`/reports/leave?year=${year}`);
}

export async function getPayrollReport(year: number, month?: number) {
  const sp = new URLSearchParams({ year: String(year) });
  if (month) sp.set("month", String(month));
  return api<{ data: Record<string, unknown> }>(`/reports/payroll?${sp.toString()}`);
}

export async function getTaxReport(year: number, month?: number) {
  const sp = new URLSearchParams({ year: String(year) });
  if (month) sp.set("month", String(month));
  return api<{ data: Record<string, unknown> }>(`/reports/tax?${sp.toString()}`);
}

export async function exportReportCSV(type: string, year?: number, month?: number) {
  const sp = new URLSearchParams({ type });
  if (year) sp.set("year", String(year));
  if (month) sp.set("month", String(month));
  return api<{ data: { headers: string[]; rows: unknown[][] } }>(`/reports/export?${sp.toString()}`);
}

// Org Chart
export async function getOrgTree() {
  return api<{ data: { tree: Array<Record<string, unknown>>; total_employees: number } }>("/orgchart/tree");
}

export async function getDepartmentTree() {
  return api<{ data: { departments: Array<Record<string, unknown>>; total_departments: number } }>("/orgchart/departments");
}
