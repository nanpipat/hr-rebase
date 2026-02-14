# HR Platform – Task Log

## Phase 1 – Web MVP (COMPLETED)

### 1.1 Project Setup
- [x] Git repository initialized
- [x] Monorepo folder structure (frappe/, bff/, web/, nginx/)
- [x] `.env.example` with all required variables
- [x] `docker-compose.yml` with 6 services (mariadb, redis, frappe, bff, web, nginx)
- [x] README.md with quick start instructions

### 1.2 Frappe HR Core Engine
- [x] Custom Dockerfile (base: frappe/bench:v5.22.6)
- [x] Auto site bootstrap via `entrypoint.sh`
- [x] Frappe v15 + ERPNext v15 + HRMS v15 installed
- [x] Custom extension app `hr_core_ext` created
- [x] Default company auto-created on first run
- [x] Service user `bff-service@hr.localhost` with HR roles
- [x] Leave types configured (Annual 6d, Sick 30d, Personal 3d)
- [x] Whitelisted APIs: employee, leave, attendance

### 1.3 BFF (Go + Echo)
- [x] Go 1.22 project initialized
- [x] Echo web framework with middleware
- [x] JWT middleware (generate + validate)
- [x] Frappe HTTP client (login, callMethod, getResource)
- [x] Auth handler (POST /api/auth/login, GET /api/me)
- [x] Employee handler (GET /api/employees)
- [x] Leave handler (POST /api/leaves, GET /api/leaves)
- [x] Attendance handler (GET /api/attendance/me)
- [x] Data models (user, employee, leave, attendance)

### 1.4 Frontend (Next.js 14)
- [x] Next.js 14 with App Router + TypeScript
- [x] TailwindCSS styling
- [x] API client with JWT cookie support
- [x] Login page
- [x] Dashboard page (with placeholder stats)
- [x] Employee list page
- [x] Leave request + history page
- [x] Attendance summary page
- [x] Sidebar navigation component
- [x] Protected route pattern (redirect to /login)

### 1.5 Infrastructure
- [x] Nginx reverse proxy (/api → bff, / → web)
- [x] Frappe not exposed to host (security)
- [x] Single docker network (hr_network)
- [x] Health checks on mariadb and redis
- [x] `docker compose up` works from zero state

---

## Phase 2 – Identity, SaaS Foundation & Full HR Application Layer (COMPLETED)

> Status: **COMPLETED**

### 2.1 Database & Infrastructure
- [x] PostgreSQL 16 service added to docker-compose.yml (with healthcheck)
- [x] BFF_DATABASE_URL env var wired to BFF service
- [x] postgres_data volume for persistence
- [x] Database connection with retry logic (database/db.go)
- [x] golang-migrate migration runner with go:embed SQL files

### 2.2 Database Schema (4 migrations)
- [x] 001: `companies` table (id UUID, name, slug, frappe_company_name, industry, size)
- [x] 002: `users` table (id UUID, email, password_hash, role ENUM, status ENUM, company_id FK, frappe_employee_id)
- [x] 003: `invites` table (id UUID, token, email, role, company_id FK, invited_by FK, expires_at, revoked)
- [x] 004: `audit_log` table (id BIGSERIAL, actor_id, company_id, action, target_type, target_id, details JSONB)

### 2.3 Repository Layer (Data Access)
- [x] CompanyRepository (Create, GetByID, GetBySlug, GetByName, Update)
- [x] UserRepository (Create, GetByID, GetByEmail, ListByCompany, UpdateRole, UpdateStatus, LinkEmployee)
- [x] InviteRepository (Create, GetByToken, ListByCompany, MarkAccepted, Revoke)
- [x] AuditRepository (Log with JSONB details)

### 2.4 Authentication Rework (BFF-Owned)
- [x] BFF-owned login with bcrypt (replaced Frappe-based auth)
- [x] POST /api/auth/signup (create company + admin user + Frappe company + employee)
- [x] POST /api/auth/login (email + bcrypt verification)
- [x] GET /api/me (from BFF PostgreSQL)
- [x] POST /api/auth/logout (clear cookie)
- [x] JWT claims expanded: user_id, company_id, role
- [x] Password hashing with bcrypt (cost 10)

### 2.5 Role-Based Access Control
- [x] UserRole enum (admin, hr, manager, employee)
- [x] RequireRole() middleware
- [x] RequireAdminOrHR() convenience middleware
- [x] JWT middleware sets user_id, company_id in Echo context
- [x] All API endpoints enforce company scope

### 2.6 Invite System
- [x] POST /api/invites (admin/HR creates invite, crypto/rand 32-byte token, 72h expiry)
- [x] POST /api/invites/accept (public, set password, auto-login)
- [x] GET /api/invites (list company invites)
- [x] DELETE /api/invites/:id (revoke invite)
- [x] Audit logging on invite creation

### 2.7 User Management
- [x] GET /api/users (list company users, admin/HR)
- [x] GET /api/users/:id (user detail)
- [x] PUT /api/users/:id/role (change role, admin only, self-demotion prevented)
- [x] PUT /api/users/:id/status (suspend/disable, admin/HR)
- [x] PUT /api/users/:id/employee (link user to Frappe employee)
- [x] Audit logging on role/status changes

### 2.8 Company-Scoped Endpoints
- [x] Employees: company-scoped via Frappe company name filter
- [x] POST /api/employees (create in Frappe, admin/HR)
- [x] Leave: role-based filtering (employee sees own only)
- [x] POST /api/leaves (create leave via Frappe API)
- [x] PUT /api/leaves/:id/approve (admin/HR/manager)
- [x] Attendance: own (GET /attendance/me) + team view (GET /attendance)

### 2.9 Frappe API Extensions
- [x] company.py: create_company, create_employee
- [x] employee.py: added company + employee_id filters
- [x] leave.py: create_leave_application, approve_leave_application
- [x] FrappeClient: CreateCompany(), CreateEmployee() methods

### 2.10 Frontend Overhaul
- [x] Rewritten API client (auth, users, invites, employees, leave, attendance)
- [x] AuthProvider + useAuth() context hook
- [x] Role-based menu system (role-menu.ts + getMenuForRole)
- [x] Sidebar with role-based menu, user info, logout button
- [x] Login page (email field, signup link)
- [x] Signup page (company registration)
- [x] Accept invite page (/invite/[token])
- [x] Protected route group ((protected)/layout.tsx with AuthProvider + auth guard)
- [x] Dashboard (role-specific widgets)
- [x] Employees page (with Add Employee button for admin/HR)
- [x] New Employee page (/employees/new)
- [x] Leave page (with approve/reject for admin/HR/manager)
- [x] Attendance page
- [x] Users page (role/status management, admin/HR only)
- [x] Invite User page (generates shareable link)
- [x] Settings page (company info, admin only)
- [x] Old per-section layouts removed (replaced by shared protected layout)

### 2.11 Build Verification
- [x] BFF Go build passes (go build ./...)
- [x] Frontend TypeScript check passes (tsc --noEmit)
- [x] Frontend Next.js build passes (14 routes generated)
- [x] Docker Compose configuration verified (7 services: mariadb, redis, frappe, postgres, bff, web, nginx)

---

## Phase 2.1 – HR Depth & Real-world Usage Hardening (COMPLETED)

> Status: **COMPLETED**

### 2.1.1 Frappe API Extensions — Richer Employee Data
- [x] employee.py: `get_employee_full()` — full profile (personal, contact, emergency, employment, reporting)
- [x] employee.py: `update_employee()` — update allowed fields with reports_to resolution
- [x] employee.py: `validate_manager()` — circular reporting chain detection
- [x] leave.py: `get_leave_allocations()` — balance by type (allocated/used/remaining)
- [x] leave.py: `cancel_leave_application()` — cancel Open leaves
- [x] leave.py: `update_leave_application()` — edit Open leaves
- [x] attendance.py: `get_attendance_detail()` — daily records with late/early + checkins
- [x] attendance.py: `create_attendance_request()` — correction request
- [x] attendance.py: `get_attendance_requests()` — list with human-readable status
- [x] attendance.py: `approve_attendance_request()` — approve/reject
- [x] document.py (new): `get_employee_documents()`, `upload_employee_document()` (base64)
- [x] compensation.py (new): `get_salary_structure()` — salary structure + components
- [x] promotion.py (new): `get_promotions()` — promotion history with property changes

### 2.1.2 BFF FrappeClient Extensions + Models
- [x] `CallMethodPost()` — POST-based Frappe method calls (form-encoded, proper Content-Type)
- [x] Model: EmployeeFull, EmployeeUpdate, ManagerValidation
- [x] Model: LeaveAllocation, UpdateLeaveRequest
- [x] Model: AttendanceDetailSummary, AttendanceCheckin, AttendanceRequest, CreateAttendanceRequestBody
- [x] Model: EmployeeDocument (new file)
- [x] Model: SalaryComponent, SalaryAssignment, SalaryStructureResponse (new file)
- [x] Model: Promotion, PromotionDetail (new file)

### 2.1.3 BFF Employee Profile Endpoints
- [x] GET `/api/employees/:id/full` — full employee profile (self-filter for employees)
- [x] PUT `/api/employees/:id` — update employee (admin/HR, circular manager validation)
- [x] GET `/api/employees/:id/compensation` — salary structure (admin/HR)
- [x] GET `/api/employees/:id/leave` — allocations + applications (self-filter)
- [x] GET `/api/employees/:id/attendance` — detail with late markers (self-filter)
- [x] GET `/api/employees/:id/documents` — attached files (self-filter)
- [x] POST `/api/employees/:id/documents` — upload document (admin/HR)
- [x] GET `/api/employees/:id/promotions` — promotion history (admin/HR)

### 2.1.4 Leave Hardening
- [x] PUT `/api/leaves/:id` — edit leave before approval
- [x] DELETE `/api/leaves/:id` — cancel Open leave
- [x] GET `/api/leaves/balance` — current user's leave allocations
- [x] Leave create now uses CallMethodPost for mutations

### 2.1.5 Attendance Hardening
- [x] POST `/api/attendance/requests` — submit correction request
- [x] GET `/api/attendance/requests` — list requests (role-filtered)
- [x] PUT `/api/attendance/requests/:id/approve` — approve/reject (admin/HR/manager)

### 2.1.6 Frontend — Reusable Components
- [x] Tabs component (query param routing, `?tab=`)
- [x] Badge component (status variants: success/danger/warning/info/neutral)
- [x] EmptyState component (icon + description + optional action)
- [x] API client extended with 15 new functions

### 2.1.7 Frontend — Tab-based Employee Profile
- [x] `/employees/[id]` — main profile page with role-filtered tabs
- [x] Overview tab (personal, contact, emergency, reporting info)
- [x] Employment tab (editable fields for admin/HR with save)
- [x] Compensation tab (salary structure + earnings/deductions tables)
- [x] Leave tab (balance cards + leave history table)
- [x] Attendance tab (summary cards + daily records with late marker)
- [x] Documents tab (file list with size/date)
- [x] Promotions tab (promotion timeline with property changes)
- [x] Employee list: rows are now clickable → navigates to profile

### 2.1.8 Frontend — Leave/Attendance Hardening + Profile
- [x] Leave page: balance cards at top, cancel button for Open leaves
- [x] Attendance page: "Request Correction" form, pending requests section, approve/reject for managers
- [x] Profile page (`/profile`): user info, role badge, linked employee link
- [x] Role menu: added "Profile" for all roles

### 2.1.9 Build Verification
- [x] BFF Go build passes (`go build ./...`)
- [x] Frontend Next.js build passes (15 routes including `/employees/[id]` and `/profile`)

---

## Phase 2.2 – Contact Self-Edit, Timeline & Document Management (COMPLETED)

> Status: **COMPLETED**

### 2.2.1 Frappe API Extensions
- [x] employee.py: `update_employee_contact()` — employee self-edit (limited contact fields)
- [x] employee.py: `get_employee_timeline()` — aggregated timeline (Version log + Leave Applications)
- [x] employee.py: `update_employee()` — added validation: prevent editing non-Active employees
- [x] document.py: `delete_employee_document()` — delete attached file (admin/HR)
- [x] leave.py: `create_leave_application()` — added validation: prevent leave for non-Active employees

### 2.2.2 BFF Handlers & Routes
- [x] PUT `/api/employees/:id/contact` — employee self-edit contact info (all roles, self-filtered)
- [x] GET `/api/employees/:id/timeline` — timeline events (all roles, self-filtered)
- [x] DELETE `/api/employees/:id/documents/:doc_id` — delete document (admin/HR only)

### 2.2.3 Frontend — Contact Tab
- [x] ContactTab component with view/edit modes
- [x] Self-edit: phone, personal email, addresses, emergency contact
- [x] Admin/HR can also edit any employee's contact info
- [x] Added to employee profile page (visible to all roles)

### 2.2.4 Frontend — Timeline Tab
- [x] TimelineTab component with chronological event display
- [x] Field change events (blue dots) with old→new value diff
- [x] Leave events (yellow dots) with type/dates/status
- [x] Added to employee profile page (admin/HR only)

### 2.2.5 Frontend — Documents Enhancement
- [x] Download link for each document (opens file_url in new tab)
- [x] Delete button for admin/HR
- [x] API client: `deleteEmployeeDocument()`, `updateEmployeeContact()`, `getEmployeeTimeline()`

### 2.2.6 Validation Hardening
- [x] Frappe: prevent editing non-Active employees (except status change itself)
- [x] Frappe: prevent leave creation for non-Active employees

### 2.2.7 Build Verification
- [x] BFF Go build passes (`go build ./...`)
- [x] Frontend Next.js build passes (15 routes)

---

## Phase 2.3 – UI Polish & Dashboard (COMPLETED)

> Status: **COMPLETED**

### 2.3.1 Real Dashboard
- [x] Admin/HR/Manager view: stat cards (total employees, active employees, pending leaves, pending attendance requests)
- [x] Admin/HR/Manager view: recent leave requests table with status badges
- [x] Employee view: attendance summary (present/absent), pending leave count
- [x] Employee view: leave balance cards with progress bars
- [x] All stat cards are clickable → navigate to relevant page
- [x] Loading skeleton animations while fetching data

### 2.3.2 Employee List Enhancement
- [x] Search bar: filter by name, ID, or designation (instant client-side)
- [x] Department dropdown filter (auto-populated from data)
- [x] Status dropdown filter (auto-populated from data)
- [x] "Clear" button to reset all filters
- [x] Result count display ("X of Y employees")
- [x] Avatar initials + employee ID shown in table rows
- [x] Loading skeleton while fetching

### 2.3.3 Toast Notification System
- [x] Toast component with success/error/info variants
- [x] Auto-dismiss after 4 seconds with manual dismiss button
- [x] Slide-in animation (tailwind keyframes)
- [x] ToastProvider wired into protected layout
- [x] Replaced all `alert()` calls: leave page (3), attendance page (2), ContactTab, EmploymentTab

### 2.3.4 Build Verification
- [x] Frontend Next.js build passes (15 routes)

---

## Phase 3 – Thai Payroll & Compliance (FUTURE)

> Not started. Planned for after Phase 2.3 completion.
