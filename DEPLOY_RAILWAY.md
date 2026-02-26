# Deploy on Railway

## Architecture on Railway

```
Internet
   │
   └── web (public URL)  ←── Next.js rewrites /api/* internally
            │
            ▼  (private network)
          bff.railway.internal:8080
            │
            ▼  (private network)
        frappe.railway.internal:8000
            │
       ┌────┴─────┐
       ▼          ▼
  MySQL        Redis
(managed)    (managed)
```

**PostgreSQL** (managed) → bff เชื่อมต่อโดยตรง

---

## Step 1 — Pre-build Frappe Image (สำคัญมาก)

Frappe image ดาวน์โหลด ERPNext + HRMS (~2GB) ระหว่าง build Railway จะ timeout ถ้า build ตรง
ต้อง build เองก่อนแล้ว push ขึ้น registry:

```bash
# Build locally
docker build -t ghcr.io/<your-github-username>/hr-frappe:latest ./frappe

# Push to GitHub Container Registry
docker push ghcr.io/<your-github-username>/hr-frappe:latest
```

> ทางเลือก: ใช้ Docker Hub แทน: `docker.io/<username>/hr-frappe:latest`

---

## Step 2 — สร้าง Railway Project

1. ไปที่ [railway.app](https://railway.app) → New Project → Empty Project
2. ตั้งชื่อ project เช่น `hr-platform`

---

## Step 3 — เพิ่ม Managed Databases

### MySQL (สำหรับ Frappe)
- Add Service → Database → **MySQL**
- Railway จะสร้าง `MYSQL_URL`, `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

### Redis (สำหรับ Frappe)
- Add Service → Database → **Redis**
- Railway จะสร้าง `REDIS_URL`, `REDISHOST`, `REDISPORT`

### PostgreSQL (สำหรับ BFF)
- Add Service → Database → **PostgreSQL**
- Railway จะสร้าง `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

---

## Step 4 — Deploy Frappe

1. Add Service → **Docker Image**
2. ใส่ image: `ghcr.io/<your-github-username>/hr-frappe:latest`
3. ตั้งชื่อ service: `frappe`
4. เพิ่ม Environment Variables:

```
FRAPPE_SITE_NAME=hr.localhost
FRAPPE_ADMIN_PASSWORD=<strong-password>
MARIADB_HOST=${{MySQL.MYSQLHOST}}
MARIADB_ROOT_PASSWORD=${{MySQL.MYSQLPASSWORD}}
REDIS_HOST=${{Redis.REDISHOST}}
```

> หมายเหตุ: Railway reference variables ด้วย `${{ServiceName.VARIABLE}}`
> MySQL root password อาจต้องตั้งแยกถ้า Railway ไม่ expose root — ดูรายละเอียดใน MySQL service

5. Networking → ไม่ต้อง expose port สาธารณะ (internal only)

---

## Step 5 — Deploy BFF

1. Add Service → **GitHub Repo** → เลือก repo นี้
2. ตั้งชื่อ service: `bff`
3. **Root Directory**: `bff`  (หรือ Railway จะหา `railway.toml` ใน `bff/` เอง)
4. เพิ่ม Environment Variables:

```
BFF_FRAPPE_URL=http://frappe.railway.internal:8000
BFF_FRAPPE_API_KEY=<frappe-api-key>
BFF_FRAPPE_API_SECRET=<frappe-api-secret>
BFF_DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<random-64-char-string>
JWT_EXPIRY_HOURS=24
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=<your-key>
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

5. Networking → ไม่ต้อง expose port สาธารณะ (internal only)

> **Frappe API Key/Secret**: หลัง Frappe ขึ้นแล้ว login เข้า Frappe Admin → Settings → API Access → สร้าง key สำหรับ Administrator user

---

## Step 6 — Deploy Web (Next.js)

1. Add Service → **GitHub Repo** → เลือก repo นี้ (สร้าง service ใหม่ในโปรเจกต์เดิม)
2. ตั้งชื่อ service: `web`
3. **Root Directory**: `web`
4. เพิ่ม Environment Variables:

```
NEXT_PUBLIC_API_URL=/api
BFF_INTERNAL_URL=http://bff.railway.internal:8080
```

5. **Generate Domain** → คัดลอก URL (เช่น `https://hr-web.up.railway.app`)
6. Networking → Expose port **3000**

---

## Step 7 — CORS Configuration (BFF)

เพิ่ม web domain ที่ได้จาก Step 6 เข้า BFF:

```
ALLOWED_ORIGINS=https://hr-web.up.railway.app
```

แก้ไข `bff/cmd/server/main.go` — CORS config:

```go
AllowOrigins: []string{
    "http://localhost:5009",
    "http://localhost",
    "http://localhost:3000",
    os.Getenv("ALLOWED_ORIGINS"), // เพิ่มบรรทัดนี้
},
```

> แล้ว rebuild + redeploy bff

---

## Step 8 — ตรวจสอบ

```
https://hr-web.up.railway.app/          → Next.js ขึ้น
https://hr-web.up.railway.app/api/health → { "status": "ok" }
```

---

## Environment Variables Summary

### frappe service
| Variable | Value |
|----------|-------|
| `FRAPPE_SITE_NAME` | `hr.localhost` |
| `FRAPPE_ADMIN_PASSWORD` | ตั้งเอง |
| `MARIADB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `MARIADB_ROOT_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `REDIS_HOST` | `${{Redis.REDISHOST}}` |
| `DEFAULT_COMPANY_NAME` | ชื่อบริษัท |

### bff service
| Variable | Value |
|----------|-------|
| `BFF_FRAPPE_URL` | `http://frappe.railway.internal:8000` |
| `BFF_FRAPPE_API_KEY` | จาก Frappe admin |
| `BFF_FRAPPE_API_SECRET` | จาก Frappe admin |
| `BFF_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | random string ยาวๆ |
| `ANTHROPIC_API_KEY` | optional |

### web service
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `BFF_INTERNAL_URL` | `http://bff.railway.internal:8080` |

---

## Redeploy หลังแก้โค้ด

Railway จะ auto-deploy เมื่อ push ไป GitHub (ถ้าเชื่อมต่อกับ GitHub repo)

Frappe image ต้อง rebuild + push เองถ้ามีการแก้ไข Python API:
```bash
docker build -t ghcr.io/<username>/hr-frappe:latest ./frappe
docker push ghcr.io/<username>/hr-frappe:latest
# แล้วกด Redeploy ใน Railway dashboard สำหรับ frappe service
```
