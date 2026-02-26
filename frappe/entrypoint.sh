#!/bin/bash
set -e

SITE_NAME="${FRAPPE_SITE_NAME:-hr.localhost}"
ADMIN_PASSWORD="${FRAPPE_ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-frappe_root_pw}"
MARIADB_HOST="${MARIADB_HOST:-mariadb}"

# Support full REDIS_URL (Railway style) or plain REDIS_HOST
if [ -n "${REDIS_URL}" ]; then
    # Extract host from REDIS_URL e.g. redis://:password@host:port
    REDIS_PING_CMD="redis-cli -u ${REDIS_URL} ping"
    REDIS_CACHE_URL="${REDIS_URL}/0"
    REDIS_QUEUE_URL="${REDIS_URL}/1"
    REDIS_SOCKETIO_URL="${REDIS_URL}/2"
    REDIS_DISPLAY="${REDIS_URL%%@*}@..."  # hide password in logs
else
    REDIS_HOST="${REDIS_HOST:-redis}"
    REDIS_PING_CMD="redis-cli -h ${REDIS_HOST} ping"
    REDIS_CACHE_URL="redis://${REDIS_HOST}:6379/0"
    REDIS_QUEUE_URL="redis://${REDIS_HOST}:6379/1"
    REDIS_SOCKETIO_URL="redis://${REDIS_HOST}:6379/2"
    REDIS_DISPLAY="${REDIS_HOST}"
fi

cd /home/frappe/hr-bench

# Wait for MariaDB to be ready
echo "Waiting for MariaDB at ${MARIADB_HOST}..."
while ! mysqladmin ping -h "${MARIADB_HOST}" -u root -p"${DB_ROOT_PASSWORD}" --silent 2>/dev/null; do
    sleep 2
done
echo "MariaDB is ready."

# Wait for Redis to be ready
echo "Waiting for Redis at ${REDIS_DISPLAY}..."
for i in $(seq 1 60); do
    if ${REDIS_PING_CMD} 2>/dev/null | grep -q PONG; then
        echo "Redis is ready."
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "ERROR: Redis not reachable after 120s, continuing anyway..."
    fi
    sleep 2
done

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
        --no-mariadb-socket

    # Install ERPNext (dependency for HRMS)
    echo "Installing ERPNext..."
    bench --site "${SITE_NAME}" install-app erpnext

    # Install HRMS app
    echo "Installing HRMS app..."
    bench --site "${SITE_NAME}" install-app hrms

    # Install custom HR extension app (if available)
    if [ -d "apps/hr_core_ext" ]; then
        echo "Installing hr_core_ext app..."
        bench --site "${SITE_NAME}" install-app hr_core_ext
    fi

    # Set site as default
    bench use "${SITE_NAME}"

    # Run setup script for initial data
    if [ -f "apps/hr_core_ext/hr_core_ext/setup/setup.py" ]; then
        echo "Running initial setup..."
        bench --site "${SITE_NAME}" execute hr_core_ext.setup.setup.run_setup
    fi

    echo "Site creation complete."
else
    echo "Site ${SITE_NAME} already exists, running migrations..."
    bench --site "${SITE_NAME}" migrate
fi

# Start Frappe server
echo "Starting Frappe server..."
bench start
