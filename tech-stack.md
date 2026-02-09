# Tech Stack Recommendation (Thailand HR SaaS)

## 1. Core HR Engine

### ✅ **Frappe Framework / Frappe HR**

**Role:** HR Core / Workflow Engine

**Why**

- HR domain พร้อมใช้
- Permission / Workflow แข็ง
- Update ได้ยาว
- MIT License (ขายได้)

**Tech**

- Python
- MariaDB
- Redis (queue / cache)

---

## 2. Backend for Frontend (BFF)

### ✅ **Go (Echo / Fiber)**

**Role**

- Public API
- Auth / JWT
- Tenant isolation
- API versioning
- Data shaping

**Why Go**

- คุณถนัด (จากประวัติคุณสาย Go อยู่แล้ว 😉)
- Performance ดี
- Binary เดียว deploy ง่าย
- Long-term maintenance ดีกว่า Node ใน SaaS

**Pattern**

- Clean Architecture
- Domain-driven (เฉพาะ payroll / thai logic)

---

## 3. Payroll & Thai Compliance Service

### ✅ Go (แยก service)

**Role**

- Payroll calculation
- Tax engine
- Social Security
- Report generator

**Why แยก**

- Thai logic เปลี่ยนบ่อย
- Test ได้ง่าย
- Scale เฉพาะ payroll run

**Storage**

- PostgreSQL (เหมาะกับ report / history)
- Immutable payroll period

---

## 4. Frontend (Web)

### ✅ **Next.js**

**Why**

- Enterprise-friendly
- SSR / SEO (marketing site รวมได้)
- Component ecosystem ใหญ่
- Dev หาได้ง่าย

**UI**

- TailwindCSS
- Headless UI / shadcn

---

## 5. Mobile App (Phase 2)

### ✅ **Flutter**

**Why**

- Android / iOS
- เหมาะกับ employee self-service
- Offline-friendly (attendance)

---

## 6. Authentication & Security

### Options

- Keycloak (self-host)
- Auth0 (เร็ว)
- Custom JWT (เริ่มต้น)

**Recommendation**

> Phase 1: Custom JWT
> Phase 2: Keycloak (enterprise)

---

## 7. Data & Integration Layer

- REST (หลัก)
- Event-based (Webhook / Async)
- Optional: Kafka / NATS (ถ้าโต)

---

## 8. Infrastructure

### Container & Orchestration

- Docker
- Kubernetes (เมื่อถึงจุดนั้น)
- Helm

### Cloud

- AWS / GCP / On-prem
- RDS / Cloud SQL
- S3-compatible storage

---

## 9. Observability

- Prometheus + Grafana
- Loki
- OpenTelemetry

---

## 10. CI/CD

- GitLab CI
- Automated test
- DB migration per service

---

# Stack Summary (One Screen)

```text
Frontend
 ├─ Web: Next.js + Tailwind
 └─ Mobile: Flutter (optional)

Backend
 ├─ BFF: Go (Echo/Fiber)
 ├─ HR Core: Frappe HR (Python)
 └─ Payroll: Go Service

Data
 ├─ MariaDB (HR)
 ├─ PostgreSQL (Payroll)
 └─ Redis

Infra
 ├─ Docker
 ├─ Kubernetes
 └─ Cloud / On-prem
```

---

## Why This Stack Fits “คุณ”

ผมเลือก stack นี้เพราะ:

- คุณสาย backend จริง
- เข้าใจ infra / Docker / K8s
- อยากได้ของที่ **ขายได้ ไม่ใช่แค่ demo**
- อยากควบคุมต้นทุน + ความซับซ้อน

---

## ทางเลือก (ถ้าจะลด complexity)

ถ้าอยาก **lean มากๆ**:

- ตัด Mobile ออกก่อน
- Payroll รวมกับ BFF (ยังเป็น module)
- ใช้ PostgreSQL แค่ตัวเดียว

---
