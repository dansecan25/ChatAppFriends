# Shared by deploy-client.sh and deploy-server.sh. Must run from the repo root.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: run this as root" >&2; exit 1; }

# Refuses to delete anything if the mediasoup worker is missing, because reinstalling would then recompile it.
reinstall_dependencies() {
  local version worker
  version="$(node -p "require('./server/package.json').dependencies.mediasoup")"
  worker="/opt/mediasoup/$version/mediasoup-worker"
  [[ -x "$worker" ]] || { echo "ERROR: no mediasoup worker at $worker. See NEW_PROJECT_GUIDE.md, pitfalls." >&2; exit 1; }
  ./regenerate-packages.sh
}
