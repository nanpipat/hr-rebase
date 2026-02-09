# HR Platform (Thailand-first)

A modern HR web application using Frappe HR as the backend engine with a custom web UI.

## Architecture

```
Browser → Nginx (port 80) → Frontend (Next.js) / BFF (Go/Echo) → Frappe HR (internal)
```

- **Frappe HR** - Core HR engine (employees, leaves, attendance)
- **BFF (Go)** - API gateway with JWT auth, data shaping
- **Web (Next.js)** - Custom frontend UI
- **Nginx** - Reverse proxy, single entry point
- **MariaDB** - Database
- **Redis** - Cache & queue

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env with your settings (especially JWT_SECRET)
```

### 2. Start

```bash
docker compose up
```

### 3. Access

- Web UI: http://localhost
- Login with Frappe admin credentials

## Project Structure

```
hr-platform/
├── docker-compose.yml     # Service orchestration
├── .env.example           # Environment template
├── frappe/                # Frappe HR core engine
│   ├── Dockerfile
│   ├── entrypoint.sh      # Auto site creation & bootstrap
│   ├── apps/hr_core_ext/  # Custom Frappe APIs
│   └── sites/             # Frappe site config
├── bff/                   # Backend for Frontend (Go)
│   ├── cmd/server/        # Entry point
│   ├── internal/          # Handlers, middleware, client
│   └── Dockerfile
├── web/                   # Frontend (Next.js)
│   ├── app/               # App Router pages
│   ├── components/        # UI components
│   ├── lib/               # API client
│   └── Dockerfile
└── nginx/                 # Reverse proxy
    └── nginx.conf
```

## API Endpoints

| Method | Path              | Description        | Auth     |
|--------|-------------------|--------------------|----------|
| POST   | /api/auth/login   | User login         | Public   |
| GET    | /api/me           | Current user info  | Required |
| GET    | /api/employees    | List employees     | Required |
| POST   | /api/leaves       | Create leave req   | Required |
| GET    | /api/leaves       | List leave records | Required |
| GET    | /api/attendance/me| My attendance      | Required |

## Key Rules

- Frontend NEVER calls Frappe directly (all through BFF)
- Frappe is an internal-only service
- All Docker images use pinned versions (no `latest`)
- BFF uses a service user with API key for Frappe access

## Phase 1 Scope

- Web only (no mobile)
- Core HR: Employees, Leave, Attendance
- No payroll, no government reports
- Single tenant
