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

## Phase 3 – Thai Payroll & Compliance (FUTURE)

> Not started. Planned for after Phase 2 completion.
