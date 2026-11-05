# Shared by deploy-client.sh and deploy-server.sh. Must run from the repo root.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: run this as root" >&2; exit 1; }

# Deletes the dependencies and lockfile, then installs fresh ones using the saved mediasoup worker.
# Both apps share node_modules, so this also applies when deploying only one of them.
reinstall_dependencies() {
  local version worker
  version="$(node -p "require('./server/package.json').dependencies.mediasoup")"
  worker="/opt/mediasoup/$version/mediasoup-worker"
  [[ -x "$worker" ]] || { echo "ERROR: no mediasoup worker at $worker. See NEW_PROJECT_GUIDE.md, pitfalls." >&2; exit 1; }

  rm -rf node_modules client/node_modules server/node_modules package-lock.json
  MEDIASOUP_WORKER_BIN="$worker" npm install
}
