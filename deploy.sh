#!/usr/bin/env bash
# ===========================================
# deploy.sh — Deploy HR Platform to Droplet
# รันจากเครื่อง Mac: bash deploy.sh
# ===========================================
set -euo pipefail

# ---- Config ----
DROPLET_IP="129.212.230.217"
DROPLET_USER="root"
GITHUB_REPO="nanpipat/hr-rebase"
APP_DIR="/opt/hr-platform"

# ---- GitHub Token (อ่านจาก env var หรือถามตอนรัน) ----
if [ -z "${GITHUB_TOKEN:-}" ]; then
  read -rsp "GitHub Personal Access Token: " GITHUB_TOKEN
  echo ""
fi
REPO_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- Colors ----
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
section() { echo -e "\n${GREEN}========== $* ==========${NC}"; }

# ---- SSH helper ----
# ใช้ StrictHostKeyChecking=no ครั้งแรก (ยอมรับ fingerprint อัตโนมัติ)
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"
remote() { ssh $SSH_OPTS "${DROPLET_USER}@${DROPLET_IP}" "$@"; }
remote_sudo() { remote "bash -s" <<< "$1"; }

# =========================================
section "1/6 — ทดสอบ SSH connection"
# =========================================
info "กำลัง connect ไปที่ ${DROPLET_IP}..."
remote "uname -a && free -h"

# =========================================
section "2/6 — ติดตั้ง Docker"
# =========================================
info "ตรวจสอบ Docker..."
if remote "docker --version" 2>/dev/null; then
  info "Docker มีอยู่แล้ว ข้าม"
else
  warn "Docker ไม่พบ กำลังติดตั้ง..."
  remote "
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
  "
  info "Docker ติดตั้งเสร็จ"
fi

# =========================================
section "3/6 — เพิ่ม Swap 2GB"
# =========================================
SWAP_EXISTS=$(remote "swapon --show | wc -l")
if [ "$SWAP_EXISTS" -gt 1 ]; then
  info "Swap มีอยู่แล้ว:"
  remote "swapon --show"
else
  warn "ยังไม่มี swap กำลังสร้าง 2GB..."
  remote "
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # ลด swappiness เพื่อใช้ swap เฉพาะตอนจำเป็น
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl -p
  "
  info "Swap 2GB พร้อมแล้ว"
fi

# =========================================
section "4/6 — Clone / อัปเดต Repository"
# =========================================
REPO_EXISTS=$(remote "[ -d '${APP_DIR}/.git' ] && echo yes || echo no")
if [ "$REPO_EXISTS" = "yes" ]; then
  info "Repo มีอยู่แล้ว — git pull..."
  remote "cd ${APP_DIR} && git pull"
else
  info "กำลัง clone repo ไปที่ ${APP_DIR}..."
  remote "
    apt-get install -y -qq git
    git clone ${REPO_URL} ${APP_DIR}
  "
fi

# =========================================
section "5/6 — Copy .env.droplet และ Build"
# =========================================
info "Upload .env.droplet → ${APP_DIR}/.env"
scp $SSH_OPTS "${SCRIPT_DIR}/.env.droplet" "${DROPLET_USER}@${DROPLET_IP}:${APP_DIR}/.env"

info "Build + รัน Docker Compose (Droplet config)..."
remote "
  cd ${APP_DIR}
  docker compose -f docker-compose.droplet.yml pull --ignore-pull-failures 2>/dev/null || true
  docker compose -f docker-compose.droplet.yml build --no-cache
  docker compose -f docker-compose.droplet.yml up -d
"

# =========================================
section "6/6 — ตรวจสอบ Services"
# =========================================
info "รอ 15 วินาที ให้ services ขึ้น..."
sleep 15

info "สถานะ containers:"
remote "cd ${APP_DIR} && docker compose -f docker-compose.droplet.yml ps"

echo ""
info "ตรวจ Frappe health:"
remote "curl -sf http://localhost/api/method/ping 2>/dev/null && echo '✅ Frappe OK' || echo '⏳ Frappe ยังไม่พร้อม (Frappe ใช้เวลา init ~2-5 นาที)'"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Deploy เสร็จแล้ว!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Frappe Admin UI : http://${DROPLET_IP}"
echo -e "  Frappe API      : http://${DROPLET_IP}/api"
echo -e "  Frappe port 8000: http://${DROPLET_IP}:8000"
echo ""
echo -e "${YELLOW}หมายเหตุ:${NC}"
echo -e "  - Frappe ใช้เวลา init ครั้งแรก ~3-5 นาที"
echo -e "  - ดู logs ได้ด้วย: ssh root@${DROPLET_IP} 'cd ${APP_DIR} && docker compose -f docker-compose.droplet.yml logs -f frappe'"
echo ""
