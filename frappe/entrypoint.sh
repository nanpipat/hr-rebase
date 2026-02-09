#!/bin/bash
set -e

SITE_NAME="${FRAPPE_SITE_NAME:-hr.localhost}"
ADMIN_PASSWORD="${FRAPPE_ADMIN_PASSWORD:-admin}"
DB_ROOT_PASSWORD="${MARIADB_ROOT_PASSWORD:-frappe_root_pw}"

cd /home/frappe/hr-bench

# Wait for MariaDB to be ready
echo "Waiting for MariaDB..."
while ! mysqladmin ping -h mariadb -u root -p"${DB_ROOT_PASSWORD}" --silent 2>/dev/null; do
    sleep 2
done
echo "MariaDB is ready."

# Wait for Redis to be ready
echo "Waiting for Redis..."
while ! redis-cli -h redis ping 2>/dev/null | grep -q PONG; do
    sleep 2
done
echo "Redis is ready."

# Check if site already exists
if [ ! -f "sites/${SITE_NAME}/site_config.json" ]; then
    echo "Creating new site: ${SITE_NAME}"

    bench new-site "${SITE_NAME}" \
        --mariadb-root-password "${DB_ROOT_PASSWORD}" \
        --admin-password "${ADMIN_PASSWORD}" \
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
