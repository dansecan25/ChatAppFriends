#!/usr/bin/env bash
# Reinstalls dependencies, builds the frontend and installs it. Pull first, and reload nginx afterwards.
cd "$(dirname "${BASH_SOURCE[0]}")"
source deploy/common.sh

WEB_DIR=/srv/http/chatappfriends
NGINX_APP_FILE=/etc/nginx/apps/chatappfriends.conf

reinstall_dependencies
npm run build:client

rm -rf "$WEB_DIR"
cp -r client/dist "$WEB_DIR"
chmod -R a+rX "$WEB_DIR"

hostname="$(tailscale status --json | node -pe 'JSON.parse(require("fs").readFileSync(0)).Self.DNSName.replace(/\.$/, "")')"
sed -e "s|__HOSTNAME__|$hostname|g" deploy/nginx-app.conf > "$NGINX_APP_FILE"
nginx -t

echo "Done. Now run: systemctl reload nginx.service"
