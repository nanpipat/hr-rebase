# HR Platform (Thailand-first)

## Product & System Overview

## 1. Vision

สร้างระบบ HR สำหรับตลาดไทย  
ที่:

- ใช้งานง่าย
- รองรับกฎหมายและ workflow ไทย
- ขยายได้ (SaaS / On-prem / White-label)
- ไม่ผูก vendor และไม่ lock-in framework

โดยใช้ **Frappe HR เป็น HR Core Engine**  
และพัฒนา UI + Thai-specific logic ขึ้นมาเองทั้งหมด

---

## 2. Target Users

- บริษัทขนาดเล็ก–กลาง (20–500 คน)
- บริษัท Tech / Startup
- องค์กรที่อยากได้ HR แบบ customize ได้
- บริษัทที่ Payroll / ภาษี เป็น pain point

---

## 3. High-Level Architecture

```text
[ Web / Mobile App (Our UI) ]
          |
          | API (JWT / OAuth)
          v
[ Backend for Frontend (BFF) ]
          |
          | Internal API / Event
          v
[ HR Core Engine (Frappe HR) ]
          |
          v
[ HR Database (MariaDB) ]


[ Payroll / Thai Compliance Service ]
          |
          | Read-only / Sync Data
          v
[ Payroll DB ]
```

### Design Principles

- UI แยกจาก HR Core 100%
- Thai logic ไม่ฝังใน HR Core
- Update Frappe ได้โดยไม่พังระบบ
- รองรับ multi-tenant ตั้งแต่แรก

---

## 4. Core Modules

## 4.1 HR Core (Powered by Frappe HR)

### Employee Management

- Employee Profile
- Employment Status (Probation, Active, Resigned)
- Position / Department
- Manager hierarchy
- Employment history

### Organization Structure

- Company
- Department
- Team
- Position
- Reporting line

### Leave Management

- Leave Types (Vacation, Sick, Personal, etc.)
- Leave Quota
- Leave Approval Workflow
- Leave Balance Calculation

### Attendance (Raw Data)

- Check-in / Check-out
- Shift / Working hour definition
- Manual / Device-based attendance
- Attendance summary (daily)

> HR Core เก็บ **ข้อมูลดิบ + workflow มาตรฐาน**
> ไม่คำนวณเงิน / ภาษี

---

## 4.2 Thai Payroll & Compliance (Custom Module)

### Payroll Engine

- Salary structure
- Fixed / Variable income
- Allowance / Deduction
- OT / Late / Absence rule
- Custom salary formula

### Thai Tax Engine

- ภาษีเงินได้บุคคลธรรมดา
- ภงด.1 / 1ก
- หนังสือรับรอง 50ทวิ
- ภาษีสะสมรายปี

### Social Security (SSO)

- คำนวณเงินสมทบ
- เพดานประกันสังคม
- รายงาน สปส.

### Output & Reporting

- Payroll Slip
- Monthly / Yearly Summary
- Government-ready reports (PDF / Excel)

> Payroll Service อ่านข้อมูลจาก HR Core
> แต่ไม่เขียนทับ logic ของ HR

---

## 5. Workflow (End-to-End)

## 5.1 Employee Onboarding

```text
HR Admin
 → Create Employee
 → Assign Position & Salary Info
 → Employee Activated
```

Data Flow:

- Employee master → HR Core
- Salary config → Payroll Service

---

## 5.2 Daily Attendance

```text
Employee
 → Check-in / Check-out
 → Attendance recorded
 → Daily attendance summary
```

Notes:

- HR Core เก็บ raw attendance
- Payroll ดึง summary ไปคำนวณเงิน

---

## 5.3 Leave Request Flow

```text
Employee
 → Submit Leave Request
 → Manager Approval
 → HR Final Approval
 → Leave balance updated
```

Rules:

- Workflow configurable
- Leave type rule แยกตามบริษัท

---

## 5.4 Monthly Payroll Run

```text
Payroll Admin
 → Select Pay Period
 → Fetch Attendance + Leave
 → Calculate Salary
 → Calculate Tax & SSO
 → Generate Payslip
 → Lock Payroll Period
```

Key Point:

- Payroll Period = immutable once locked
- Re-run ต้อง create revision

---

## 6. Permission & Role Model

### Application Roles

- Super Admin (Platform)
- Company Admin
- HR
- Manager
- Employee

### Permission Scope

- Company-level isolation
- Department-level access
- Manager sees only subordinates

---

## 7. Multi-Tenant Strategy

### SaaS Mode

- 1 Company = 1 Logical Tenant
- Shared infrastructure
- Company ID isolation

### Enterprise / On-prem

- 1 Company = 1 Deployment
- Custom domain
- Custom feature set

---

## 8. UI Philosophy

- No Frappe Desk exposure
- Mobile-first
- Simple HR language (non-technical)
- Thai-friendly terminology
- Workflow visualization

---

## 9. Extensibility (Future Modules)

- Time Attendance Device Integration
- Government API (ถ้ามี)
- Accounting Export
- Performance Review
- Recruitment
- Employee Self-service App

---

## 10. Non-Goals (Explicitly Not Doing)

- ไม่พยายามเป็น ERP
- ไม่ embed Thai payroll logic ใน HR Core
- ไม่ customize Frappe Core directly
- ไม่ force standard workflow กับลูกค้า

---
