#!/bin/sh
set -e

# Set default port if not provided
export PORT=${PORT:-8080}

# Substitute environment variables in nginx config
envsubst '${PORT}' < /etc/nginx/nginx.conf > /tmp/nginx.conf
mv /tmp/nginx.conf /etc/nginx/nginx.conf

# Generate runtime environment file for frontend
ENV_JS_PATH="/usr/share/nginx/html/env.js"
: "${GOOGLE_PLACES_API_KEY:=}"

cat > "$ENV_JS_PATH" <<EOF
window.__ENV = Object.assign({}, window.__ENV, {
  GOOGLE_PLACES_API_KEY: ${GOOGLE_PLACES_API_KEY:+"$GOOGLE_PLACES_API_KEY"}
});
EOF

echo "Generated runtime env at $ENV_JS_PATH"

# Start nginx
nginx -g "daemon off;"
