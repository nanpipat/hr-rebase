FROM nginx:1.26-alpine

# Default: nginx.conf (full stack)
# Droplet: nginx.droplet.conf (Frappe only)
ARG NGINX_CONF=nginx.conf

COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

EXPOSE 80 8000
