#!/usr/bin/env bash
# Builds the app and installs it on this server. Run from a clone of the repo: ./deploy.sh [--no-pull]
set -euo pipefail

APP_DIR=/opt/chatappfriends
WEB_DIR=/srv/http/chatappfriends
ENV_FILE=/etc/chatappfriends/server.env
NGINX_SERVER_FILE=/etc/nginx/conf.d/https-server.conf
NGINX_APP_FILE=/etc/nginx/apps/chatappfriends.conf
UNIT_FILE=/etc/systemd/system/chatappfriends.service

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

fail() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

render() {
  sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__WEB_DIR__|$WEB_DIR|g" -e "s|__ENV_FILE__|$ENV_FILE|g" \
      -e "s|__HOSTNAME__|$TS_HOSTNAME|g" -e "s|__TLS_CERT__|$TLS_CERT|g" -e "s|__TLS_KEY__|$TLS_KEY|g" \
      -e "s|__NODE__|$NODE_BIN|g" "$1"
}

step "Checking prerequisites"
for tool in node npm nginx tailscale systemctl curl openssl; do
  command -v "$tool" >/dev/null || fail "$tool is not installed"
done
NODE_BIN="$(command -v node)"
[[ "$NODE_BIN" == /home/* ]] && fail "node resolves to $NODE_BIN, which the service cannot read. Install it with: pacman -S nodejs npm"
[[ -f deploy/deploy.env ]] || fail "Create deploy/deploy.env first (see deploy/deploy.env.example)"
# shellcheck disable=SC1091
source deploy/deploy.env
sudo test -r "${TLS_CERT:?TLS_CERT is not set}" || fail "Certificate not found: $TLS_CERT"
sudo test -r "${TLS_KEY:?TLS_KEY is not set}" || fail "Certificate key not found: $TLS_KEY"
TS_HOSTNAME="$(tailscale status --json | node -pe 'JSON.parse(require("fs").readFileSync(0)).Self.DNSName.replace(/\.$/, "")')"
TS_IP="$(tailscale ip -4)"
NGINX_CONFIG="$(sudo nginx -T 2>/dev/null || true)"
grep -q 'include[[:space:]]*/etc/nginx/conf.d/\*.conf' <<<"$NGINX_CONFIG" \
  || fail "Add 'include /etc/nginx/conf.d/*.conf;' inside the http block of /etc/nginx/nginx.conf, then rerun"

if ! sudo test -f "$ENV_FILE"; then
  step "Creating $ENV_FILE"
  sudo install -d -m 700 /etc/chatappfriends
  sed -e "s|__TAILSCALE_IP__|$TS_IP|g" -e "s|__HOSTNAME__|$TS_HOSTNAME|g" \
      -e "s|__JWT_SECRET__|$(openssl rand -hex 32)|" -e "s|__INVITE_CODE__|$(openssl rand -hex 8)|" \
      deploy/server.env.example | sudo install -m 600 /dev/stdin "$ENV_FILE"
  echo "Set the database credentials in $ENV_FILE (sudo nano $ENV_FILE), then rerun ./deploy.sh"
  exit 0
fi
sudo grep -q 'CHANGE_ME' "$ENV_FILE" && fail "Set the database credentials in $ENV_FILE first"

if [[ "${1:-}" != "--no-pull" ]]; then
  step "Pulling the latest code"
  git pull --ff-only
fi

step "Building"
npm ci
npm run build

step "Installing the backend to $APP_DIR"
sudo install -d "$APP_DIR/server" "$APP_DIR/client"
sudo install -m 644 package.json "$APP_DIR/package.json"
sudo install -m 644 server/package.json "$APP_DIR/server/package.json"
sudo install -m 644 client/package.json "$APP_DIR/client/package.json"
if ! sudo cmp -s package-lock.json "$APP_DIR/package-lock.json" || ! sudo test -d "$APP_DIR/node_modules"; then
  sudo install -m 644 package-lock.json "$APP_DIR/package-lock.json"
  (cd "$APP_DIR" && sudo npm ci --omit=dev --workspace server)
fi
sudo rm -rf "$APP_DIR/server/dist"
sudo cp -r server/dist "$APP_DIR/server/dist"

step "Installing the frontend to $WEB_DIR"
sudo install -d "$(dirname "$WEB_DIR")"
sudo rm -rf "$WEB_DIR.new"
sudo cp -r client/dist "$WEB_DIR.new"
sudo chmod -R a+rX "$WEB_DIR.new"
sudo rm -rf "$WEB_DIR"
sudo mv "$WEB_DIR.new" "$WEB_DIR"

step "Configuring nginx and systemd"
sudo test -f "$NGINX_SERVER_FILE" || render deploy/nginx-server.conf | sudo install -D -m 644 /dev/stdin "$NGINX_SERVER_FILE"
render deploy/nginx-app.conf | sudo install -D -m 644 /dev/stdin "$NGINX_APP_FILE"
render deploy/chatappfriends.service | sudo install -m 644 /dev/stdin "$UNIT_FILE"
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable chatappfriends.service nginx.service >/dev/null
sudo systemctl restart chatappfriends.service
sudo systemctl reload-or-restart nginx.service

step "Checking the deployment"
for _ in {1..15}; do
  if curl -fsS "https://$TS_HOSTNAME:8443/api/health" >/dev/null 2>&1; then
    curl -fsS -o /dev/null "https://$TS_HOSTNAME/chatappfriends/" || fail "nginx is not serving the frontend"
    echo "Deployed: https://$TS_HOSTNAME/chatappfriends/"
    exit 0
  fi
  sleep 2
done
fail "The backend did not become healthy. See: journalctl -u chatappfriends -n 50"
