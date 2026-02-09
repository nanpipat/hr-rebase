# Phase 2 – Identity, SaaS Foundation & Full HR Application Layer

## Purpose (Why this phase exists)

Phase 2 exists to solve the **biggest missing piece** of Phase 1:

> The system has HR features,  
> but no real-world concept of:
>
> - companies
> - users
> - roles
> - permissions
> - onboarding
> - real usage flows

This phase transforms the project from:
❌ “HR backend with screens”  
into  
✅ “Real SaaS HR Application that companies can actually use”

---

## Non-Negotiable Principles (DO NOT BREAK)

1. Frappe HR remains the **single source of truth** for HR domain
2. Frontend NEVER talks to Frappe directly
3. All permission checks happen in BFF
4. Employees and Users are different concepts
5. Invite-only for all company users
6. SaaS-style company signup is mandatory
7. Everything must work via `docker compose up`

---

## 1. Domain Model (Authoritative)

### 1.1 Core Entities (Application Layer)

```text
Platform
 └─ Company
     ├─ Users
     ├─ Employees (via Frappe)
     └─ Organization Structure
```

### 1.2 User vs Employee (Must be enforced)

```text
User
- login identity
- email
- password
- role
- company_id

Employee
- HR entity
- job position
- department
- reporting line
- may or may not have a User
```

Rules:

- User ≠ Employee
- User MAY be linked to an Employee
- Company Admin MAY be an Employee
- Employee MAY exist without login
- User MUST belong to exactly one company

---

## 2. SaaS Company Signup (Platform Entry Point)

### 2.1 Public Signup Flow

```text
Public Landing Page
 → Sign up
 → Create Company
 → Create Company Admin User
 → Auto-create Employee Profile (Admin)
 → Redirect to Admin Dashboard
```

### 2.2 Signup Data Requirements

Required:

- Company Name
- Admin Email
- Password

Optional:

- Company size
- Industry (for future use)

### 2.3 Backend Responsibilities

- Validate unique company name
- Validate unique email globally
- Create:
  - Company
  - User (role = Company Admin)
  - Employee (linked to admin user)

- Create Frappe Company record
- Create Frappe Employee record
- Store mapping IDs

---

## 3. Authentication & Session Management

### 3.1 Auth Strategy

- JWT-based authentication
- Access token (short-lived)
- Refresh token (httpOnly cookie)
- Company context embedded in token

### 3.2 Login Rules

- Only invited users can login
- Disabled users cannot login
- User cannot login to another company
- One active session per user (Phase 1.2)

---

## 4. User Management (Invite-only System)

### 4.1 Invite User Flow (Critical)

```text
Company Admin / HR
 → Invite User
 → Assign Role
 → (Optional) Link to Employee
 → Generate Invite Token
 → Send Invite Email
 → User Accepts Invite
 → Set Password
 → Activate User
```

### 4.2 Invite Rules

- Invite token:
  - Single-use
  - Expirable (default: 72 hours)

- Email must be unique per platform
- Invite can be revoked before acceptance
- Invite cannot change company

### 4.3 User States

- Invited
- Active
- Suspended
- Disabled

---

## 5. Role & Permission System (Strict)

### 5.1 Roles (Company Scope)

- Company Admin
- HR
- Manager
- Employee

### 5.2 Permission Strategy

Permissions are enforced in **BFF**, not frontend.

Each API request must resolve:

- user_id
- role
- company_id
- employee_id (if exists)

### 5.3 Capability Matrix

| Capability          | Admin | HR  | Manager  | Employee |
| ------------------- | ----- | --- | -------- | -------- |
| Manage company      | ✔     | ❌  | ❌       | ❌       |
| Invite users        | ✔     | ✔   | ❌       | ❌       |
| Assign roles        | ✔     | ✔   | ❌       | ❌       |
| View all employees  | ✔     | ✔   | ❌       | ❌       |
| View team employees | ✔     | ✔   | ✔        | ❌       |
| Create employees    | ✔     | ✔   | ❌       | ❌       |
| Edit employees      | ✔     | ✔   | ❌       | ❌       |
| Submit leave        | ✔     | ✔   | ✔        | ✔        |
| Approve leave       | ✔     | ✔   | ✔ (team) | ❌       |
| View attendance     | ✔     | ✔   | ✔ (team) | ✔ (self) |

---

## 6. Employee Lifecycle (HR-Centric)

### 6.1 Employee Creation

```text
HR / Admin
 → Create Employee
 → Assign department
 → Assign position
 → Assign manager
 → Set employment status
 → Save
```

### 6.2 Employee States

- Draft (pre-join)
- Active
- Inactive
- Resigned

### 6.3 Login Linking

- HR can link an existing User to Employee
- HR can create User from Employee
- HR can disable User without deleting Employee

---

## 7. Organization Structure

### 7.1 Org Entities

- Department
- Position
- Reporting Line

### 7.2 Visibility Rules

- HR/Admin: full company view
- Manager: subtree only
- Employee: self only

---

## 8. HR Feature Integration (Using Frappe Core)

### 8.1 Employee Module

- Source of truth: Frappe HR
- UI: custom UI only
- Mapping maintained in BFF

### 8.2 Leave Module

- Leave types & workflow in Frappe
- Submission & approval via BFF
- Timeline view in UI

### 8.3 Attendance Module

- Raw attendance in Frappe
- Role-based visibility
- Monthly summary views

---

## 9. Menu & UI Behavior (Role-Based)

### 9.1 Menu Visibility

Menus must be rendered dynamically by role.

Admin / HR:

- Dashboard
- Users
- Employees
- Organization
- Leave
- Attendance
- Settings

Manager:

- Dashboard
- My Team
- Leave Approvals
- Team Attendance

Employee:

- Dashboard
- My Profile
- My Leave
- My Attendance

---

## 10. Dashboard (Role-Specific)

### Admin / HR Dashboard

- Total employees
- Employees on leave today
- Attendance issues
- Pending approvals

### Manager Dashboard

- Team attendance
- Pending leave approvals

### Employee Dashboard

- Leave balance
- Last attendance
- Upcoming leave

---

## 11. Seed Data & Demo Readiness

### On Company Creation

Auto-create:

- Departments
- Positions
- Admin employee profile
- Sample leave types
- Sample attendance rules

Optional:

- Demo employees
- Demo leave requests

Goal:

- Zero empty screen
- System feels alive immediately

---

## 12. Security & Guardrails

- All APIs validate company scope
- No cross-company access
- No direct Frappe access
- Role escalation forbidden
- Audit log for:
  - User creation
  - Role changes
  - Employee status changes

---

## 13. Definition of Done (Phase 2)

Phase 2 is DONE when:

- [ ] Company can sign up without manual setup
- [ ] Company Admin becomes Employee
- [ ] Invite-only user system enforced
- [ ] All roles behave differently
- [ ] Employees can exist without login
- [ ] HR workflows feel realistic
- [ ] System can be demoed for 30+ minutes
- [ ] No feature relies on Frappe UI
- [ ] `docker compose up` works from zero state

---

## 14. Explicit Non-Goals

- No payroll calculation
- No Thai tax logic
- No mobile app
- No external integrations
- No billing system

```

```
