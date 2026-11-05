#!/usr/bin/env bash
# Deletes all node_modules and package locks, then installs everything fresh.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# A saved mediasoup worker skips recompiling on CPUs that can't use the prebuilt one, which takes 30 minutes.
version="$(node -p "require('./server/package.json').dependencies.mediasoup")"
worker="/opt/mediasoup/$version/mediasoup-worker"
if [[ -x "$worker" ]]; then
  export MEDIASOUP_WORKER_BIN="$worker"
fi

rm -rf node_modules client/node_modules server/node_modules
rm -f package-lock.json client/package-lock.json server/package-lock.json
npm run install:all
