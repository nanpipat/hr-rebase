FROM frappe/bench:v5.22.6

USER frappe

# Initialize bench with Frappe v15 (use fresh path to avoid conflict with base image)
RUN bench init --frappe-branch version-15 --skip-redis-config-generation /home/frappe/hr-bench

WORKDIR /home/frappe/hr-bench

# Get ERPNext (required dependency for HRMS)
RUN bench get-app --branch version-15 erpnext https://github.com/frappe/erpnext.git

# Get Frappe HR app
RUN bench get-app --branch version-15 hrms https://github.com/frappe/hrms.git

# Copy, install, and register custom app
COPY --chown=frappe:frappe apps/hr_core_ext /home/frappe/hr-bench/apps/hr_core_ext
RUN /home/frappe/hr-bench/env/bin/pip install -e /home/frappe/hr-bench/apps/hr_core_ext \
    && printf '\nhr_core_ext\n' >> /home/frappe/hr-bench/sites/apps.txt

# Copy site config
COPY --chown=frappe:frappe sites/common_site_config.json /home/frappe/hr-bench/sites/common_site_config.json

# Copy bootstrap script
COPY --chown=frappe:frappe entrypoint.sh /home/frappe/hr-bench/entrypoint.sh
RUN chmod +x /home/frappe/hr-bench/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/home/frappe/hr-bench/entrypoint.sh"]
