# Phase 2.1 – HR Depth & Real-world Usage Hardening

## Status

PLANNED

---

## 0. Objective (Why this phase exists)

Phase 2 delivered a **complete SaaS + Identity + Permission foundation**  
but the HR experience is still **shallow**.

Phase 2.1 deepens existing HR features so that:

- HR can manage an employee end-to-end
- Managers understand their teams
- Employees see meaningful personal data
- The system no longer feels like a demo

No new HR modules are invented.
We expose **existing Frappe HR depth through a proper UI and workflows**.

---

## 1. Scope Definition

### In Scope

- Employee Profile (deep, tab-based)
- Leave hardening
- Attendance hardening
- Approval visibility
- HR document handling
- HR timeline & history
- UX depth (empty states, errors, clarity)

### Out of Scope

- Payroll calculation
- Tax / SSO
- Accounting
- Mobile app
- External integrations

---

## 2. Core Design Rules (Must Not Be Broken)

1. Frappe HR = source of truth
2. UI tabs map to real Frappe DocTypes
3. No “fake” tabs without data
4. Frontend never calls Frappe directly
5. All permission checks enforced in BFF
6. Employee ≠ User (still enforced)

---

## 3. Employee Profile – Major Redesign

### 3.1 Replace Current Concept

Current:

- User profile centric

Target:

- Employee profile centric
- User profile becomes a **sub-page**

URL:

```text
/employees/:employee_id
```

---

## 4. Employee Profile – Tab Architecture

Employee profile MUST be tab-based.

Each tab:

- Has clear ownership (HR / Manager / Employee)
- Maps to real Frappe HR data
- Has defined read/write rules

---

### 4.1 Tab: Overview

**Purpose**
Quick snapshot for all roles.

**Visible to**

- Admin
- HR
- Manager (team only)
- Employee (self)

**Data**

- Employee ID
- Full name
- Status (Active / Inactive / Resigned)
- Department
- Position
- Manager
- Employment type
- Date of joining

**API**

- Frappe: `Employee`

---

### 4.2 Tab: Employment

**Purpose**
HR operational control.

**Visible to**

- Admin
- HR

**Editable**

- Admin / HR only

**Data**

- Company
- Branch
- Department
- Position
- Manager
- Employment type
- Status history

**API**

- Frappe: `Employee`
- Frappe: `Employee Promotion` (read-only)

**Rules**

- Prevent circular manager assignment
- Status change logged in audit_log

---

### 4.3 Tab: Compensation (Read-only)

**Purpose**
Prepare for payroll without implementing it.

**Visible to**

- Admin
- HR

**Data**

- Salary Structure
- Salary Components
- Effective date

**API**

- Frappe: `Salary Structure Assignment`
- Frappe: `Salary Structure`

**Rules**

- No editing in Phase 2.1
- Display-only

---

### 4.4 Tab: Leave

**Purpose**
Leave transparency and HR oversight.

**Visible to**

- Admin
- HR
- Manager (team)
- Employee (self)

**Data**

- Leave balance by type
- Leave history
- Upcoming leave

**API**

- Frappe: `Leave Allocation`
- Frappe: `Leave Application`

**Enhancements**

- Highlight negative balance risk
- Status color coding

---

### 4.5 Tab: Attendance

**Purpose**
Understand attendance behavior.

**Visible to**

- Admin
- HR
- Manager (team)
- Employee (self)

**Data**

- Daily attendance
- Monthly summary
- Late / Absent markers

**API**

- Frappe: `Attendance`
- Frappe: `Employee Checkin`

---

### 4.6 Tab: Approvals

**Purpose**
Clarify who approves what.

**Visible to**

- Admin
- HR
- Manager
- Employee (read-only)

**Data**

- Reporting manager
- Leave approver
- Attendance correction approver

**Source**

- Employee.manager
- Frappe workflow roles

---

### 4.7 Tab: Documents

**Purpose**
HR document repository.

**Visible to**

- Admin
- HR
- Employee (self)

**Data**

- Document list
- File type
- Upload date

**API**

- Frappe: `File` (attached to Employee)

**Rules**

- HR/Admin upload
- Employee download only

---

### 4.8 Tab: History / Timeline

**Purpose**
Audit & HR traceability.

**Visible to**

- Admin
- HR

**Data Sources**

- Frappe version history
- Application audit_log

**Events**

- Status changes
- Role changes
- Leave approvals
- Manager changes

---

## 5. User Profile (Secondary)

URL:

```text
/profile
```

**Contains**

- Email
- Password reset
- Active sessions
- Role (read-only)

**Explicitly excludes**

- HR data

---

## 6. Leave Hardening

### 6.1 Validation Rules

- Prevent overlapping leave
- Prevent exceeding balance
- Prevent leave after resignation

### 6.2 Edit & Cancel Rules

- Editable before approval
- Locked after approval
- HR override allowed

---

## 7. Attendance Hardening

### 7.1 Attendance Correction

Flow:

```text
Employee
 → Submit correction
 → Manager approval
 → HR finalize
```

**API**

- Frappe: `Attendance Request`

---

## 8. Organization & Manager Logic Hardening

### Rules

- Manager must be active employee
- No circular reporting
- Multi-level hierarchy supported

### Enforcement

- BFF validation
- UI prevention

---

## 9. Permission Edge Cases (Must Be Supported)

- HR without employee record
- Admin resigned but still active user
- Manager with mixed-role team
- Disabled user with active employee

---

## 10. UX Hardening

### 10.1 Empty States

- Explain purpose of tab
- Suggest next action

### 10.2 Error States

- Permission denied vs no data
- Human-readable HR messages

---

## 11. API Coverage Checklist

BFF MUST expose read APIs for:

- Employee
- Employee Promotion
- Leave Allocation
- Leave Application
- Attendance
- Employee Checkin
- Salary Structure Assignment
- File
- Attendance Request

---

## 12. Seed Data Expansion

On company creation:

- Sample leave allocations
- Sample attendance
- Sample promotion history

Goal:

- Zero empty screens during demo

---

## 13. Definition of Done – Phase 2.1

Phase 2.1 is DONE when:

- [ ] Employee profile has 7–8 real tabs
- [ ] Each tab backed by real data
- [ ] HR can manage employee lifecycle end-to-end
- [ ] Manager sees meaningful team data
- [ ] Employee profile feels “full”
- [ ] System can be demoed to HR for 30–45 minutes
- [ ] No placeholder-only UI remains

---

## 14. Explicit Non-Goals

- Payroll calculation
- Thai tax logic
- Accounting integration
- Mobile app

```

```
