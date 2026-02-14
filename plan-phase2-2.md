# PHASE 2.2 – Employee Profile Depth Expansion

## Status

PLANNED

---

# 🎯 Objective

Transform Employee Profile from:

- shallow identity view

Into:

- full HR-grade employee profile
- multi-tab structure
- Frappe HR-backed data
- production-ready behaviors

No fake data.
No placeholder tabs.
Everything backed by Frappe HR.

---

# 🧱 Architecture Reminder

Frontend (Next.js)
↓
BFF (Go + Echo)
↓
Frappe HR (v15 HRMS)

Postgres remains identity & audit store only.

---

# 🗺️ Scope of Phase 2.2

This phase includes:

- Employee Profile full redesign
- 8 real tabs
- API expansion
- Permission enforcement
- File attachments
- Timeline & history
- Validation hardening

Does NOT include:

- Payroll calculation
- Expense module
- Performance module
- Recruitment module

---

# 🧩 Target Employee Profile Tabs

1. Overview
2. Employment
3. Contact
4. Leave
5. Attendance
6. Compensation (read-only)
7. Documents
8. Timeline

---

# ===============================

# 🟢 SPRINT 1 – Profile Core Structure

# ===============================

## Goal

Create new Employee Profile layout + Overview + Employment tabs.

---

## Backend Tasks

### 1. New Handler File

File:

- bff/internal/handlers/employee_profile.go

Register routes in:

- bff/internal/router.go

---

### 2. GET /api/employees/:id/profile

Purpose:
Aggregate core employee data.

Data sources:

- Frappe Employee
- Manager name
- Department
- Photo (File doctype)

Must enforce:

- company_id scope
- role-based visibility

---

### 3. GET /api/employees/:id/employment

Return:

- designation
- department
- branch
- employment_type
- reports_to
- date_of_joining
- contract_end_date
- status

Source:
Frappe Employee

---

### 4. PUT /api/employees/:id/employment

Editable fields:

- designation
- department
- branch
- reports_to
- employment_type
- status

Restrictions:

- Admin / HR only
- Prevent circular manager
- Audit log entry required

---

## Frontend Tasks

### 1. New Route

File:

- web/app/(protected)/employees/[id]/page.tsx

Layout:

- Tab navigation component

---

### 2. Tab Component

File:

- web/components/employee/EmployeeTabs.tsx

Tabs:

- Overview
- Employment

---

### 3. Overview Component

File:

- web/components/employee/tabs/OverviewTab.tsx

Must show:

- Photo
- Name
- Status badge
- Department
- Designation
- Reports to
- Join date

---

### 4. Employment Form

File:

- web/components/employee/tabs/EmploymentTab.tsx

Editable fields for HR/Admin only.

Use:

- react-hook-form
- role guard

---

# ===============================

# 🟢 SPRINT 2 – Contact + Leave + Attendance

# ===============================

## Backend

### 1. GET /api/employees/:id/contact

Return:

- personal_email
- company_email
- phone
- mobile
- current_address
- permanent_address
- emergency_contacts[]

### 2. PUT /api/employees/:id/contact

Editable by:

- HR
- Employee (limited fields)

---

### 3. GET /api/employees/:id/leaves

Return:

- balances[]
- leave_history[]
- upcoming[]

Source:

- Leave Allocation
- Leave Application

---

### 4. GET /api/employees/:id/attendance

Return:

- daily logs
- monthly summary
- late count

Source:

- Attendance
- Employee Checkin

---

## Frontend

Create:

- ContactTab.tsx
- LeaveTab.tsx
- AttendanceTab.tsx

Each must:

- Handle loading
- Handle empty state
- Respect role permissions

---

# ===============================

# 🟢 SPRINT 3 – Compensation + Documents

# ===============================

## Backend

### 1. GET /api/employees/:id/compensation

Return:

- salary_structure_name
- effective_from
- salary_components[]

Source:

- Salary Structure Assignment
- Salary Structure

Read-only.

---

### 2. GET /api/employees/:id/documents

Return:

- file list

### 3. POST /api/employees/:id/documents

Upload file to Frappe.
Attach to Employee.

---

## Frontend

Create:

- CompensationTab.tsx
- DocumentsTab.tsx

DocumentsTab must support:

- Upload (Admin/HR)
- Download
- Delete (Admin/HR)

---

# ===============================

# 🟢 SPRINT 4 – Timeline & Hardening

# ===============================

## Backend

### 1. GET /api/employees/:id/timeline

Aggregate:

- Audit log
- Status changes
- Leave approvals
- Role changes

---

### 2. Validation Improvements

- Prevent leave after resignation
- Prevent manager circular reference
- Prevent editing inactive employee

---

## Frontend

Create:

- TimelineTab.tsx

Display:

- chronological events
- actor
- timestamp
- action

---

# 🔒 Permission Rules

Employee:

- Can view own profile
- Can edit limited contact info

Manager:

- Can view team profiles
- Cannot edit employment fields

HR:

- Full edit except system-level

Admin:

- Full control

---

# 📊 Definition of Done

Phase 2.2 is DONE when:

- Employee profile has 8 real tabs
- All tabs backed by real Frappe data
- HR can manage employee lifecycle fully
- Managers can review team data
- Employee sees meaningful personal dashboard
- No empty placeholder UI remains
- System demo lasts 45+ minutes comfortably

---

# 📈 After Phase 2.2

Next phases:

2.3 – Expense Module
2.4 – Shift / Advanced Attendance
2.5 – Performance
2.6 – Recruitment
3.0 – Thai Payroll

```

```
