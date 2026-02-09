# HR Platform (Thailand-first)

## Phase 1 – Web MVP (Docker-first, Production-like)

---

## 0. Goal of Phase 1

Deliver a **working HR web application** that:

- Uses Frappe HR as HR Core (backend engine)
- Has a custom Web UI (no Frappe Desk exposure)
- Can be started with:
  ```bash
  docker compose up
  ```

````

* Is usable immediately after startup

Scope:

* Web only (no mobile)
* Core HR features only (no Thai payroll yet)
* Single-tenant first (multi-tenant-ready design)

---

## 1. Technology Lock (Phase 1)

### 1.1 Core HR Engine

* Frappe Framework: **v15.x**
* Frappe HR: **compatible with Frappe v15**
* Python: 3.10+
* Database: MariaDB 10.6+

> Reason:
>
> * v15 is stable and widely used
> * ERPNext / Frappe HR actively support it

### 1.2 Backend for Frontend (BFF)

* Language: Go 1.22+
* Framework: Echo
* Auth: JWT (custom, simple)
* Role: API gateway + data shaping

### 1.3 Frontend

* Next.js 14 (App Router)
* TailwindCSS
* Server-side auth check

### 1.4 Infra

* Docker
* Docker Compose
* Nginx (reverse proxy)

---

## 2. Repository Structure (Monorepo)

```text
hr-platform/
├─ docker-compose.yml
├─ .env
├─ README.md
│
├─ frappe/
│  ├─ Dockerfile
│  ├─ sites/
│  └─ apps/
│
├─ bff/
│  ├─ cmd/
│  ├─ internal/
│  ├─ Dockerfile
│  └─ go.mod
│
├─ web/
│  ├─ app/
│  ├─ components/
│  ├─ Dockerfile
│  └─ package.json
│
└─ nginx/
   └─ nginx.conf
```

---

## 3. Docker Compose Design

### Services

* mariadb
* redis
* frappe
* bff
* web
* nginx

### Network

* Single internal docker network
* Only nginx exposed to host

### URLs

* Web UI: [http://localhost](http://localhost)
* API (via nginx): [http://localhost/api](http://localhost/api)
* Frappe internal only

---

## 4. Step-by-Step Implementation Plan

---

## 4.1 Initialize Project

### Tasks

* [ ] Create git repository
* [ ] Create base folder structure
* [ ] Add `.env.example`
* [ ] Add root `docker-compose.yml`

---

## 4.2 Frappe HR Setup (Core Engine)

### 4.2.1 Frappe Image

Tasks:

* [ ] Create custom Frappe Dockerfile
* [ ] Install:

  * frappe-framework (v15)
  * frappe-hr app
* [ ] Initialize bench inside container

Notes:

* Use official frappe docker image as base
* Pin app versions (avoid latest floating)

### 4.2.2 Site Bootstrap

Tasks:

* [ ] Auto-create site on container start
* [ ] Install Frappe HR app
* [ ] Create default Company
* [ ] Disable Frappe Desk access (security)

Expected Result:

* Frappe running
* HR DocTypes available
* Accessible internally only

---

## 4.3 HR Core Configuration

### Employee

* [ ] Enable Employee doctype
* [ ] Required fields:

  * employee_id
  * full_name
  * department
  * position
  * status

### Leave

* [ ] Configure Leave Types
* [ ] Configure Leave Policy
* [ ] Enable approval workflow

### Attendance

* [ ] Enable check-in / check-out
* [ ] Daily attendance summary

> IMPORTANT:
> No payroll logic in this phase

---

## 4.4 Frappe API Strategy

### API Access Pattern

* Use REST API:

  * `/api/resource/*`
  * `/api/method/*`
* Create **custom Frappe app**:

  * `hr_core_ext`
* All custom endpoints go there

### Tasks

* [ ] Create Frappe custom app
* [ ] Add read-only APIs:

  * get employees
  * get attendance summary
  * get leave balance
* [ ] Create internal service user
* [ ] API key-based access (from BFF)

---

## 4.5 Backend for Frontend (Go)

### Responsibilities

* Auth (JWT)
* Permission check
* Tenant context
* Data transformation
* Hide Frappe schema

### API Endpoints (Phase 1)

```text
POST   /api/auth/login
GET    /api/me
GET    /api/employees
POST   /api/leaves
GET    /api/attendance/me
```

### Tasks

* [ ] Initialize Go project
* [ ] JWT middleware
* [ ] Frappe API client
* [ ] Map Frappe user ↔ app user
* [ ] Error normalization

---

## 4.6 Frontend (Next.js Web)

### Pages

* /login
* /dashboard
* /employees
* /attendance
* /leave

### Tasks

* [ ] Auth flow (cookie-based JWT)
* [ ] API client
* [ ] Protected routes
* [ ] Basic UI components
* [ ] Error & loading state

Design:

* Mobile-friendly
* Simple HR language
* No Frappe UI reused

---

## 4.7 Nginx & Routing

### Routing Rules

* `/` → web
* `/api/*` → bff
* No direct access to frappe

Tasks:

* [ ] Nginx config
* [ ] SSL-ready (future)

---

## 4.8 One-Command Startup

### Tasks

* [ ] Ensure first-run init works
* [ ] Health checks
* [ ] Seed sample data
* [ ] README instructions

Final Command:

```bash
docker compose up
```

Expected Result:

* Open browser
* Login
* Use HR system immediately

---

## 5. Phase 1 Deliverables

* Working Web HR System
* Custom UI
* Frappe HR running as invisible core
* Clean base for Phase 2 (Payroll)

---

## 6. Explicit Non-Goals (Phase 1)

* No Thai payroll
* No mobile app
* No government report
* No multi-company UI

---



## Phase 1 – Definition of Done

Phase 1 is considered complete when:

- [ ] `docker compose up` runs without manual intervention
- [ ] Frappe site is auto-created on first run
- [ ] Frappe HR app is installed automatically
- [ ] No Frappe Desk UI is accessible from browser
- [ ] Web UI login works
- [ ] Employee list is visible from Web UI
- [ ] Leave request can be created and approved
- [ ] Attendance data is viewable
- [ ] All communication goes through BFF only

## Version Policy

- Do NOT use `latest` tag for any Docker image
- All base images must be pinned by version
- Frappe Framework must be v15.x only

## API Boundary Rule

- Frontend MUST NOT call Frappe APIs directly
- All frontend requests go through BFF only
- Frappe is treated as a private internal service

## Frappe User Strategy

- Create one internal service user for BFF
- Use API key + secret
- No end-user login directly to Frappe

## Fail Fast Rules

- If a task cannot be completed reliably, stop and report
- Do not apply temporary hacks to bypass errors
- Prefer clarity over speed



````
