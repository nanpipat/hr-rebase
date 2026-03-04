#!/bin/bash
set -e

SITE_NAME="${FRAPPE_SITE_NAME:-hr.localhost}"
ADMIN_PASSWORD="${FRAPPE_ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-frappe_root_pw}"
MARIADB_HOST="${MARIADB_HOST:-mariadb}"

cd /home/frappe/hr-bench

# Build Redis URLs — support Railway REDIS_URL (with password) or plain REDIS_HOST
if [ -n "${REDIS_URL}" ]; then
    echo "Using REDIS_URL for Redis configuration."
    REDIS_CACHE_URL="${REDIS_URL}/0"
    REDIS_QUEUE_URL="${REDIS_URL}/1"
    REDIS_SOCKETIO_URL="${REDIS_URL}/2"
else
    REDIS_HOST="${REDIS_HOST:-redis}"
    REDIS_PASSWORD="${REDIS_PASSWORD:-}"
    if [ -n "${REDIS_PASSWORD}" ]; then
        REDIS_CACHE_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:6379/0"
        REDIS_QUEUE_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:6379/1"
        REDIS_SOCKETIO_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:6379/2"
    else
        REDIS_CACHE_URL="redis://${REDIS_HOST}:6379/0"
        REDIS_QUEUE_URL="redis://${REDIS_HOST}:6379/1"
        REDIS_SOCKETIO_URL="redis://${REDIS_HOST}:6379/2"
    fi
fi

# Wait for MariaDB to be ready
echo "Waiting for MariaDB at ${MARIADB_HOST}..."
while ! mysqladmin ping -h "${MARIADB_HOST}" -u root -p"${DB_ROOT_PASSWORD}" --silent 2>/dev/null; do
    sleep 2
done
echo "MariaDB is ready."

# Wait for Redis (simple sleep — skip active ping since auth makes cli check unreliable)
echo "Waiting 15s for Redis to be ready..."
sleep 15
echo "Redis wait complete."

# Write dynamic common_site_config.json
echo "Writing common_site_config.json..."
cat > sites/common_site_config.json <<EOF
{
  "db_host": "${MARIADB_HOST}",
  "db_port": 3306,
  "redis_cache": "${REDIS_CACHE_URL}",
  "redis_queue": "${REDIS_QUEUE_URL}",
  "redis_socketio": "${REDIS_SOCKETIO_URL}",
  "socketio_port": 9000,
  "webserver_port": 8000,
  "serve_default_site": true,
  "allow_cors": "*"
}
EOF

# Check if site already exists
if [ ! -f "sites/${SITE_NAME}/site_config.json" ]; then
    echo "Creating new site: ${SITE_NAME}"

    bench new-site "${SITE_NAME}" \
        --mariadb-root-password "${DB_ROOT_PASSWORD}" \
        --admin-password "${ADMIN_PASSWORD}" \
        --db-host "${MARIADB_HOST}" \
        --mariadb-user-host-login-scope='%'

    echo "Installing ERPNext..."
    bench --site "${SITE_NAME}" install-app erpnext

    echo "Installing HRMS app..."
    bench --site "${SITE_NAME}" install-app hrms

    if [ -d "apps/hr_core_ext" ]; then
        echo "Installing hr_core_ext app..."
        bench --site "${SITE_NAME}" install-app hr_core_ext
    fi

    bench use "${SITE_NAME}"

    if [ -f "apps/hr_core_ext/hr_core_ext/setup/setup.py" ]; then
        echo "Running initial setup..."
        bench --site "${SITE_NAME}" execute hr_core_ext.setup.setup.run_setup
    fi

    # Generate API Key for Administrator (used by BFF)
    echo "Generating API Key for Administrator..."
    python3 - <<PYEOF
import frappe
frappe.init(site="${SITE_NAME}", sites_path="/home/frappe/hr-bench/sites")
frappe.connect()

user = frappe.get_doc("User", "Administrator")
if not user.api_key:
    user.api_key = frappe.generate_hash(length=15)
if not user.api_secret:
    from frappe.utils.password import update_password
    api_secret = frappe.generate_hash(length=15)
    user.api_secret = api_secret
    update_password(user.name, api_secret, doctype="User", fieldname="api_secret")
user.save(ignore_permissions=True)
frappe.db.commit()

# บันทึก credentials ลงไฟล์ในตอน init เท่านั้น
with open("/home/frappe/hr-bench/sites/api_credentials.txt", "w") as f:
    f.write(f"BFF_FRAPPE_API_KEY={user.api_key}\n")
    f.write(f"BFF_FRAPPE_API_SECRET={api_secret}\n")

print(f"[API KEY READY]")
print(f"BFF_FRAPPE_API_KEY={user.api_key}")
print(f"BFF_FRAPPE_API_SECRET={api_secret}")
frappe.destroy()
PYEOF

    echo "Site creation complete."
else
    echo "Site ${SITE_NAME} already exists, running migrations..."
    bench --site "${SITE_NAME}" migrate
fi

echo "Starting Frappe server..."
bench start
