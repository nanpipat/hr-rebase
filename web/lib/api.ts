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
