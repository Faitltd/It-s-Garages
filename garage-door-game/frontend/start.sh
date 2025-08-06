#!/bin/sh

# Set default port if not provided
export PORT=${PORT:-8080}

# Substitute environment variables in nginx config
envsubst '${PORT}' < /etc/nginx/nginx.conf > /tmp/nginx.conf
mv /tmp/nginx.conf /etc/nginx/nginx.conf

# Start nginx
nginx -g "daemon off;"
